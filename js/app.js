/* =============================================
   NOVA - Ultimate Edition (Full JS Engine)
   ============================================= */

(function () {
    'use strict';

    // --- DOM Elements ---
    const fileInput = document.getElementById('file-upload');
    const startBtn = document.getElementById('start-btn');
    const randomBtn = document.getElementById('random-btn');
    const webcamBtn = document.getElementById('webcam-btn');
    const webcamVideo = document.getElementById('webcam-video');
    
    const settingsSection = document.getElementById('settings-section');
    const modeSelection = document.querySelectorAll('.mode-btn');
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    const autobgToggle = document.getElementById('autobg-toggle');
    const crtToggle = document.getElementById('crt-toggle');
    const crtOverlay = document.getElementById('crt-overlay');
    
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const canvas = document.getElementById('draw-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const originalCanvas = document.getElementById('original-canvas');
    const compareBtn = document.getElementById('compare-btn');
    const recPulse = document.getElementById('rec-pulse');
    
    const resultSection = document.getElementById('result-section');
    const colorPalette = document.getElementById('color-palette');
    const downloadVideo = document.getElementById('download-video');
    const downloadPng = document.getElementById('download-png');
    const shareCardBtn = document.getElementById('share-card-btn');
    const gallerySection = document.getElementById('gallery-section');
    const galleryGrid = document.getElementById('gallery-grid');
    
    const soundToggle = document.getElementById('sound-toggle');
    const secretModeBtn = document.getElementById('secret-mode-btn');

    // --- State ---
    let selectedImage = null;
    let currentMode = 'spectrum';
    let isAnimating = false;
    let webcamStream = null;
    let lastFrameTime = 0;
    let vibrateTick = 0;

    // Check Secret Mode (Unlocked if user has played all 7 modes)
    let playedModes = JSON.parse(localStorage.getItem('nova_played_modes') || '[]');
    if (playedModes.length >= 7) {
        secretModeBtn.style.display = 'flex';
    }

    // =============================================
    // AUDIO ENGINE (Web Audio API)
    // =============================================
    let audioCtx = null, masterGain = null, ambientInterval = null, isMuted = false;

    function initAudio() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = isMuted ? 0 : 0.4;
        masterGain.connect(audioCtx.destination);
    }

    function playSFX(type) {
        if (!audioCtx || isMuted) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(masterGain);
        
        if (type === 'click') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'success') {
            [440, 554, 659, 880].forEach((f, i) => {
                const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
                o.type = 'triangle'; o.frequency.value = f;
                g.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.1);
                g.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + i * 0.1 + 0.05);
                g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.1 + 0.5);
                o.connect(g); g.connect(masterGain);
                o.start(audioCtx.currentTime + i * 0.1); o.stop(audioCtx.currentTime + i * 0.1 + 0.5);
            });
        } else if (type === 'laser') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.4);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
            osc.start(); osc.stop(audioCtx.currentTime + 0.4);
        }
    }

    function startAmbientMusic() {
        if (!audioCtx || isMuted || ambientInterval) return;
        const notes = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00];
        let idx = 0;
        
        const droneOsc = audioCtx.createOscillator();
        const droneGain = audioCtx.createGain();
        droneOsc.type = 'sine'; droneOsc.frequency.value = 55; // Deep bass
        droneGain.gain.value = 0.1;
        droneOsc.connect(droneGain); droneGain.connect(masterGain);
        droneOsc.start(); droneOsc.stop(audioCtx.currentTime + 300);

        ambientInterval = setInterval(() => {
            if (!audioCtx || isMuted) return;
            const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
            o.type = 'triangle'; o.frequency.value = notes[idx];
            g.gain.setValueAtTime(0, audioCtx.currentTime);
            g.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
            o.connect(g); g.connect(masterGain);
            o.start(); o.stop(audioCtx.currentTime + 0.8);
            idx = (idx + 1) % notes.length;
        }, 450);
    }

    function stopAmbientMusic() {
        if (ambientInterval) { clearInterval(ambientInterval); ambientInterval = null; }
    }

    soundToggle.addEventListener('click', () => {
        initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        isMuted = !isMuted;
        masterGain.gain.value = isMuted ? 0 : 0.4;
        soundToggle.innerText = isMuted ? '🔇' : '🔊';
        soundToggle.style.color = isMuted ? '#555' : 'var(--neon-blue)';
    });

    // =============================================
    // UI EVENTS
    // =============================================
    modeSelection.forEach(btn => {
        btn.addEventListener('click', () => {
            modeSelection.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            playSFX('click');
        });
    });

    speedSlider.addEventListener('input', (e) => {
        speedVal.innerText = e.target.value === '1' ? 'آهسته' : e.target.value === '2' ? 'عادی' : 'سریع';
    });

    randomBtn.addEventListener('click', () => {
        const availableModes = Array.from(modeSelection).filter(b => b.style.display !== 'none' && !b.classList.contains('hidden-mode'));
        const randomBtnEl = availableModes[Math.floor(Math.random() * availableModes.length)];
        randomBtnEl.click();
        startBtn.click();
    });

    crtToggle.addEventListener('change', (e) => {
        crtOverlay.classList.toggle('active', e.target.checked);
    });

    compareBtn.addEventListener('click', () => {
        originalCanvas.style.display = originalCanvas.style.display === 'block' ? 'none' : 'block';
    });

    // Webcam Logic
    webcamBtn.addEventListener('click', async () => {
        try {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
            webcamVideo.srcObject = webcamStream;
            webcamVideo.style.display = 'block';
            webcamBtn.innerText = '📸 گرفتن عکس';
            webcamBtn.onclick = () => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = webcamVideo.videoWidth;
                tempCanvas.height = webcamVideo.videoHeight;
                tempCanvas.getContext('2d').drawImage(webcamVideo, 0, 0);
                
                selectedImage = new Image();
                selectedImage.onload = () => {
                    webcamStream.getTracks().forEach(t => t.stop());
                    webcamVideo.style.display = 'none';
                    webcamBtn.innerText = '📷 استفاده از دوربین';
                    webcamBtn.onclick = null;
                    document.getElementById('upload-section').style.display = 'none';
                    settingsSection.style.display = 'block';
                };
                selectedImage.src = tempCanvas.toDataURL('image/jpeg');
            };
        } catch (err) {
            alert('دسترسی به دوربین امکان‌پذیر نیست.');
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length === 0) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            selectedImage = new Image();
            selectedImage.onload = () => {
                document.getElementById('upload-section').style.display = 'none';
                settingsSection.style.display = 'block';
            };
            selectedImage.src = event.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
    });

    // =============================================
    // IMAGE PROCESSING & SORTING
    // =============================================
    function getHue(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0;
        if (max !== min) {
            const d = max - min;
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return h * 360;
    }

    function sortPixels(pixels, mode, w, h) {
        const cx = w / 2, cy = h / 2;
        const valid = pixels.filter(p => p.a > 128 && (p.r + p.g + p.b > 20));
        
        switch (mode) {
            case 'spectrum':
                valid.forEach(p => p.hue = getHue(p.r, p.g, p.b));
                valid.sort((a, b) => {
                    if (Math.abs(a.hue - b.hue) < 10) return (a.r + a.g + a.b) - (b.r + b.g + b.b);
                    return a.hue - b.hue;
                });
                break;
            case 'thermal':
                valid.sort((a, b) => ((b.r * 2) - b.g - b.b) - ((a.r * 2) - a.g - a.b));
                break;
            case 'luminous':
                valid.sort((a, b) => (0.299 * a.r + 0.587 * a.g + 0.114 * a.b) - (0.299 * b.r + 0.587 * b.g + 0.114 * b.b));
                break;
            case 'clusters':
                valid.sort((a, b) => {
                    const ca = (a.r >> 5) * 64 + (a.g >> 5) * 8 + (a.b >> 5);
                    const cb = (b.r >> 5) * 64 + (b.g >> 5) * 8 + (b.b >> 5);
                    return ca === cb ? Math.random() - 0.5 : ca - cb;
                });
                break;
            case 'rgbsplit':
                const r = [], g = [], b = [];
                valid.forEach(p => {
                    if (p.r >= p.g && p.r >= p.b) r.push(p);
                    else if (p.g >= p.r && p.g >= p.b) g.push(p);
                    else b.push(p);
                });
                return r.concat(g).concat(b);
            case 'edgefill':
                const edges = [], fills = [];
                const getP = (x, y) => pixels[y * w + x];
                valid.forEach(p => {
                    let isEdge = false;
                    if (p.x > 0 && p.x < w-1 && p.y > 0 && p.y < h-1) {
                        const diff = Math.abs(p.r - getP(p.x, p.y-1).r) + Math.abs(p.g - getP(p.x, p.y-1).g) + Math.abs(p.b - getP(p.x, p.y-1).b);
                        if (diff > 100) isEdge = true;
                    }
                    isEdge ? edges.push(p) : fills.push(p);
                });
                return edges.concat(fills);
            case 'radar':
                valid.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
                break;
            case 'secret': // Quantum Shuffle
                valid.sort(() => Math.random() - 0.5);
                break;
        }
        return valid;
    }

    // =============================================
    // ANIMATION & LASER TAG
    // =============================================
    startBtn.addEventListener('click', async () => {
        if (!selectedImage || isAnimating) return;
        
        initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        startAmbientMusic();

        isAnimating = true;
        settingsSection.style.display = 'none';
        progressContainer.style.display = 'block';
        canvasWrapper.style.display = 'block';
        resultSection.style.display = 'none';
        recPulse.style.display = 'block';

        // Save played mode
        if (!playedModes.includes(currentMode)) {
            playedModes.push(currentMode);
            localStorage.setItem('nova_played_modes', JSON.stringify(playedModes));
            if (playedModes.length >= 7) secretModeBtn.style.display = 'flex';
        }

        // Setup Canvas
        let w = selectedImage.width, h = selectedImage.height;
        const maxSize = 600;
        if (w > maxSize || h > maxSize) {
            const ratio = Math.min(maxSize / w, maxSize / h);
            w = Math.floor(w * ratio); h = Math.floor(h * ratio);
        }
        canvas.width = w; canvas.height = h;
        
        originalCanvas.width = w; originalCanvas.height = h;
        originalCanvas.getContext('2d').drawImage(selectedImage, 0, 0, w, h);

        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.canvas.width = w; tempCtx.canvas.height = h;
        tempCtx.drawImage(selectedImage, 0, 0, w, h);
        const imgData = tempCtx.getImageData(0, 0, w, h).data;

        const pixels = [];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                let r = imgData[i], g = imgData[i+1], b = imgData[i+2], a = imgData[i+3];
                
                // Auto-BG removal
                if (autobgToggle.checked && (r + g + b < 60)) {
                    a = 0; // Make transparent
                }
                pixels.push({ x, y, r, g, b, a });
            }
        }

        progressText.innerText = 'در حال پردازش...';
        await new Promise(r => setTimeout(r, 100));
        
        const sorted = sortPixels(pixels, currentMode, w, h);
        const total = sorted.length;

        // Setup ImageData
        const masterData = ctx.createImageData(w, h);
        const md = masterData.data;
        for (let i = 0; i < md.length; i += 4) { md[i+3] = 255; } // Black bg
        
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);

        // Speed Factor
        const speedFactor = parseInt(speedSlider.value) * 100; 
        const pixelsPerFrame = Math.max(1, Math.floor(total / speedFactor));

        // Recording Setup
        const stream = canvas.captureStream(30);
        const audioDest = audioCtx.createMediaStreamDestination();
        masterGain.connect(audioDest);
        const combinedStream = new MediaStream([...stream.getVideoTracks(), ...audioDest.stream.getAudioTracks()]);
        
        const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' });
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        
        recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            downloadVideo.href = URL.createObjectURL(blob);
            
            // PNG Export
            downloadPng.href = canvas.toDataURL('image/png');
            
            // Palette Generation
            generatePalette(sorted);
            
            // Gallery
            saveToGallery(canvas.toDataURL('image/jpeg'));
            
            progressText.innerText = 'شاهکار NOVA آماده است! 🎉';
            recPulse.style.display = 'none';
            resultSection.style.display = 'block';
            settingsSection.style.display = 'block';
            isAnimating = false;
            stopAmbientMusic();
            playSFX('success');
        };
        
        recorder.start();

        let currentIndex = 0;
        const modeState = { lastPoint: null, clusterPoint: null };

        const drawLoop = () => {
            if (currentIndex >= total) {
                // Trigger Laser Tag
                drawLaserTag(w, h, () => {
                    setTimeout(() => recorder.stop(), 500);
                });
                return;
            }

            const end = Math.min(currentIndex + pixelsPerFrame, total);
            const batch = sorted.slice(currentIndex, end);

            for (const p of batch) {
                const idx = (p.y * w + p.x) * 4;
                md[idx] = p.r; md[idx+1] = p.g; md[idx+2] = p.b; md[idx+3] = p.a;
            }

            currentIndex = end;
            const progress = currentIndex / total;

            // Draw base
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
            ctx.putImageData(masterData, 0, 0);

            // Effects
            const last = batch[batch.length - 1];
            if (last) {
                ctx.globalCompositeOperation = 'lighter';
                if (currentMode === 'spectrum') {
                    ctx.fillStyle = `rgba(${last.r}, ${last.g}, ${last.b}, 0.4)`;
                    batch.forEach(p => ctx.fillRect(p.x-1, p.y-1, 3, 3));
                } else if (currentMode === 'radar') {
                    const cx = w/2, cy = h/2;
                    const angle = Math.atan2(last.y - cy, last.x - cx);
                    const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle)*w, cy + Math.sin(angle)*h);
                    grad.addColorStop(0, 'rgba(0, 240, 255, 0.8)'); grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
                    ctx.strokeStyle = grad; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle)*w, cy + Math.sin(angle)*h); ctx.stroke();
                } else if (currentMode === 'clusters' && modeState.clusterPoint) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 0.5;
                    ctx.beginPath(); ctx.moveTo(modeState.clusterPoint.x, modeState.clusterPoint.y); ctx.lineTo(last.x, last.y); ctx.stroke();
                }
                ctx.globalCompositeOperation = 'source-over';
                modeState.clusterPoint = last;
            }

            // Haptics
            if (navigator.vibrate && currentIndex - vibrateTick > total/20) {
                navigator.vibrate(10);
                vibrateTick = currentIndex;
            }

            const pct = Math.floor(progress * 100);
            progressFill.style.width = `${pct}%`;
            progressText.innerText = `در حال خلق تصویر... ${pct}%`;

            requestAnimationFrame(drawLoop);
        };

        requestAnimationFrame(drawLoop);
    });

    // --- Laser NOVA Tag ---
    function drawLaserTag(w, h, onComplete) {
        playSFX('laser');
        progressText.innerText = 'حکاکی امضای NOVA...';
        
        const text = "NOVA";
        ctx.font = "bold 40px Orbitron, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const xPos = w - 20;
        const yPos = h - 20;
        
        let laserX = xPos - textWidth;
        const laserY = yPos - 20;

        const animateLaser = () => {
            // Redraw base image to clear previous laser frame
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
            ctx.putImageData(ctx.getImageData(0, 0, w, h), 0, 0); // This is wrong, we need to restore the original canvas state. Let's use a separate overlay canvas for laser.
            
            // Actually, we can just draw the text up to the laser position
            ctx.save();
            ctx.beginPath();
            ctx.rect(laserX, laserY - 40, xPos - laserX, 60);
            ctx.clip();
            
            // Glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00f0ff';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, xPos, yPos);
            ctx.restore();

            // Draw Laser Dot
            ctx.beginPath();
            ctx.arc(laserX, laserY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00f0ff';
            ctx.fill();
            ctx.shadowBlur = 0;

            laserX += 4; // Speed of laser
            if (laserX < xPos) {
                requestAnimationFrame(animateLaser);
            } else {
                // Final static logo with glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00f0ff';
                ctx.fillStyle = '#00f0ff';
                ctx.fillText(text, xPos, yPos);
                ctx.shadowBlur = 0;
                setTimeout(onComplete, 500);
            }
        };
        
        // Need to capture the canvas state before laser starts to prevent clearing the image
        const finalImage = ctx.getImageData(0, 0, w, h);
        const animateLaserSafe = () => {
            ctx.putImageData(finalImage, 0, 0);
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(laserX, laserY - 40, xPos - laserX, 60);
            ctx.clip();
            ctx.font = "bold 40px Orbitron, sans-serif";
            ctx.textAlign = "right";
            ctx.textBaseline = "bottom";
            ctx.shadowBlur = 20; ctx.shadowColor = '#00f0ff'; ctx.fillStyle = '#ffffff';
            ctx.fillText(text, xPos, yPos);
            ctx.restore();

            ctx.beginPath();
            ctx.arc(laserX, laserY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.shadowBlur = 15; ctx.shadowColor = '#00f0ff'; ctx.fill();
            ctx.shadowBlur = 0;

            laserX += 4;
            if (laserX < xPos) {
                requestAnimationFrame(animateLaserSafe);
            } else {
                ctx.putImageData(finalImage, 0, 0);
                ctx.shadowBlur = 10; ctx.shadowColor = '#00f0ff'; ctx.fillStyle = '#00f0ff';
                ctx.font = "bold 40px Orbitron, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
                ctx.fillText(text, xPos, yPos);
                ctx.shadowBlur = 0;
                setTimeout(onComplete, 500);
            }
        };
        animateLaserSafe();
    }

    // --- Utilities ---
    function generatePalette(pixels) {
        colorPalette.innerHTML = '';
        const step = Math.max(1, Math.floor(pixels.length / 5));
        for (let i = 0; i < 5; i++) {
            const p = pixels[i * step] || {r:0, g:0, b:0};
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = `rgb(${p.r}, ${p.g}, ${p.b})`;
            colorPalette.appendChild(swatch);
        }
    }

    function saveToGallery(dataUrl) {
        let gallery = JSON.parse(localStorage.getItem('nova_gallery') || '[]');
        gallery.unshift(dataUrl);
        if (gallery.length > 10) gallery.pop(); // Keep last 10
        localStorage.setItem('nova_gallery', JSON.stringify(gallery));
        renderGallery();
    }

    function renderGallery() {
        let gallery = JSON.parse(localStorage.getItem('nova_gallery') || '[]');
        if (gallery.length === 0) return;
        gallerySection.style.display = 'block';
        galleryGrid.innerHTML = '';
        gallery.forEach(imgUrl => {
            const img = document.createElement('img');
            img.src = imgUrl;
            const div = document.createElement('div');
            div.className = 'gallery-item';
            div.appendChild(img);
            galleryGrid.appendChild(div);
        });
    }

    // Share Card
    shareCardBtn.addEventListener('click', () => {
        const cardCanvas = document.createElement('canvas');
        cardCanvas.width = 1080; cardCanvas.height = 1920;
        const cCtx = cardCanvas.getContext('2d');
        
        // Background
        cCtx.fillStyle = '#050508'; cCtx.fillRect(0, 0, 1080, 1920);
        
        // Image
        const imgW = 800, imgH = 800;
        const imgX = (1080 - imgW) / 2;
        const imgY = 400;
        cCtx.drawImage(canvas, imgX, imgY, imgW, imgH);
        
        // Title
        cCtx.font = 'bold 90px Orbitron, sans-serif';
        cCtx.fillStyle = '#00f0ff'; cCtx.textAlign = 'center';
        cCtx.fillText('NOVA', 540, 200);
        cCtx.font = '40px Orbitron, sans-serif'; cCtx.fillStyle = '#fff';
        cCtx.fillText('NEON PIXEL GENESIS', 540, 280);
        
        // Palette
        let startX = 200;
        Array.from(colorPalette.children).forEach(swatch => {
            cCtx.beginPath(); cCtx.arc(startX, 1350, 40, 0, Math.PI*2);
            cCtx.fillStyle = swatch.style.backgroundColor; cCtx.fill();
            startX += 150;
        });

        // Download
        const a = document.createElement('a');
        a.href = cardCanvas.toDataURL('image/jpeg', 0.9);
        a.download = 'nova-share-card.jpg';
        a.click();
    });

    // Init
    renderGallery();

})();
