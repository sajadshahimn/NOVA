/* =============================================
   NOVA - Neon Pixel Genesis (7 Modes)
   ============================================= */

(function () {
    'use strict';

    const fileInput = document.getElementById('file-upload');
    const startBtn = document.getElementById('start-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const canvas = document.getElementById('draw-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const dropZone = document.getElementById('drop-zone');
    const downloadLink = document.getElementById('download-link');
    const modeSelection = document.getElementById('mode-selection');
    const recPulse = document.getElementById('rec-pulse');

    let selectedImage = null;
    let currentMode = 'spectrum';
    let isAnimating = false;

    // --- انتخاب مود ---
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
        });
    });

    // --- آپلود عکس ---
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length === 0) return;
        const file = e.target.files[0];
        if (!file.type.startsWith('image/')) {
            alert('لطفاً فقط فایل تصویری انتخاب کنید.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            selectedImage = new Image();
            selectedImage.onload = () => {
                dropZone.style.display = 'none';
                modeSelection.style.display = 'block';
                startBtn.style.display = 'block';
            };
            selectedImage.onerror = () => alert('خطا در بارگذاری تصویر.');
            selectedImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // --- محاسبه Hue ---
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

    // --- الگوریتم مرتب‌سازی ۷ مود ---
    function sortPixels(pixels, mode, width, height) {
        const cx = width / 2;
        const cy = height / 2;

        // فقط پیکسل‌های نیمه‌شفاف و پس‌زمینه‌ی تیره حذف می‌شن
        const validPixels = pixels.filter(p => p.a > 128 && (p.r + p.g + p.b > 20));
        const state = {};

        switch (mode) {
            case 'spectrum':
                validPixels.forEach(p => { p.hue = getHue(p.r, p.g, p.b); });
                validPixels.sort((a, b) => {
                    if (Math.abs(a.hue - b.hue) < 10) return (a.r + a.g + a.b) - (b.r + b.g + b.b);
                    return a.hue - b.hue;
                });
                break;

            case 'thermal':
                // دید حرارتی: گرم (قرمز) به سرد (آبی)
                // فرمول: قرمز بیشتر = گرمتر
                validPixels.sort((a, b) => {
                    const tempA = (a.r * 2) - a.g - a.b;
                    const tempB = (b.r * 2) - b.g - b.b;
                    return tempB - tempA;
                });
                break;

            case 'luminous':
                // عمق نور: از تاریکی به روشنایی
                validPixels.sort((a, b) => {
                    const lumA = 0.299 * a.r + 0.587 * a.g + 0.114 * a.b;
                    const lumB = 0.299 * b.r + 0.587 * b.g + 0.114 * b.b;
                    return lumA - lumB;
                });
                break;

            case 'clusters':
                // خوشه‌های کیهانی: گروه‌بندی بر اساس رنگ (کوانتیزه کردن)
                validPixels.sort((a, b) => {
                    const ca = (a.r >> 5) * 64 + (a.g >> 5) * 8 + (b.b >> 5); // تقریب به 8 رنگ اصلی
                    const cb = (b.r >> 5) * 64 + (b.g >> 5) * 8 + (b.b >> 5);
                    if (ca === cb) return Math.random() - 0.5;
                    return ca - cb;
                });
                break;

            case 'rgbsplit':
                // تفکیک کانال: اول قرمز، بعد سبز، بعد آبی
                const reds = [], greens = [], blues = [];
                validPixels.forEach(p => {
                    if (p.r >= p.g && p.r >= p.b) reds.push(p);
                    else if (p.g >= p.r && p.g >= p.b) greens.push(p);
                    else blues.push(p);
                });
                return { pixels: reds.concat(greens).concat(blues), state };

            case 'edgefill':
                // از خط تا رنگ: اول لبه‌ها، بعد بقیه
                const edges = [];
                const fills = [];
                // یک الگوریتم ساده برای تشخیص لبه (تفاوت با پیکسل بالا)
                const getPixel = (x, y) => pixels[y * width + x];
                validPixels.forEach(p => {
                    let isEdge = false;
                    if (p.x > 0 && p.x < width - 1 && p.y > 0 && p.y < height - 1) {
                        const top = getPixel(p.x, p.y - 1);
                        const diff = Math.abs(p.r - top.r) + Math.abs(p.g - top.g) + Math.abs(p.b - top.b);
                        if (diff > 100) isEdge = true;
                    }
                    if (isEdge) edges.push(p);
                    else fills.push(p);
                });
                return { pixels: edges.concat(fills), state };

            case 'radar':
                // رادار رنگی: چرخش از مرکز (زاویه)
                validPixels.sort((a, b) => {
                    const angleA = Math.atan2(a.y - cy, a.x - cx);
                    const angleB = Math.atan2(b.y - cy, b.x - cx);
                    return angleA - angleB;
                });
                break;
        }

        return { pixels: validPixels, state };
    }

    // --- افکت‌های بصری مودها ---
    function drawModeEffects(mode, state, batch, progress, w, h) {
        if (batch.length === 0) return;
        const last = batch[batch.length - 1];

        switch (mode) {
            case 'spectrum':
                ctx.globalCompositeOperation = 'overlay';
                ctx.fillStyle = `rgba(${last.r}, ${last.g}, ${last.b}, 0.15)`;
                ctx.fillRect(0, 0, w, h);
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(${last.r}, ${last.g}, ${last.b}, 0.4)`;
                ctx.beginPath();
                for (const p of batch) ctx.rect(p.x - 1, p.y - 1, 3, 3);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
                break;

            case 'thermal':
                // هاله نارنجی/قرمز داغ
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(255, 50, 0, 0.2)`;
                ctx.beginPath();
                for (const p of batch) ctx.rect(p.x - 1, p.y - 1, 2, 2);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
                break;

            case 'luminous':
                // درخشش سفید روی پیکسل‌های روشن جدید
                if (last.r + last.g + last.b > 400) {
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.fillStyle = `rgba(255, 255, 255, 0.6)`;
                    ctx.beginPath();
                    for (const p of batch) ctx.rect(p.x - 1, p.y - 1, 3, 3);
                    ctx.fill();
                    ctx.globalCompositeOperation = 'source-over';
                }
                break;

            case 'clusters':
                // خطوط نازک سفید برای اتصال خوشه‌ها (حس کهکشانی)
                if (state.lastClusterPoint) {
                    ctx.strokeStyle = `rgba(255, 255, 255, 0.2)`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(state.lastClusterPoint.x, state.lastClusterPoint.y);
                    ctx.lineTo(last.x, last.y);
                    ctx.stroke();
                }
                state.lastClusterPoint = last;
                break;

            case 'rgbsplit':
                // افکت گلیچ (خطوط افقی رنگی)
                if (Math.random() > 0.9) {
                    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,0,0,0.3)' : 'rgba(0,240,255,0.3)';
                    ctx.fillRect(0, Math.random() * h, w, Math.random() * 3);
                }
                break;

            case 'edgefill':
                // خطوط لبه رو با رنگ سفید درخشان می‌کشیم
                if (progress < 0.4) { // 40% اول فقط خطوط
                    ctx.fillStyle = `rgba(255, 255, 255, 0.8)`;
                    for (const p of batch) {
                        ctx.fillRect(p.x, p.y, 1, 1);
                    }
                }
                break;

            case 'radar':
                // یک خط عقربه‌ای نورانی از مرکز
                const cx = w / 2, cy = h / 2;
                const angle = Math.atan2(last.y - cy, last.x - cx);
                const radius = Math.hypot(w, h);
                
                ctx.globalCompositeOperation = 'lighter';
                const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
                grad.addColorStop(0, 'rgba(0, 240, 255, 0.8)');
                grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
                
                ctx.strokeStyle = grad;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
                ctx.stroke();
                ctx.globalCompositeOperation = 'source-over';
                break;
        }
    }

    // --- شروع انیمیشن ---
    startBtn.addEventListener('click', async () => {
        if (!selectedImage || isAnimating) return;

        isAnimating = true;
        startBtn.style.display = 'none';
        downloadLink.style.display = 'none';
        progressContainer.style.display = 'block';
        canvasWrapper.style.display = 'block';
        modeSelection.style.display = 'none';
        progressFill.style.width = '0%';
        progressText.innerText = 'در حال پردازش تصویر...';

        let w = selectedImage.width;
        let h = selectedImage.height;
        const maxSize = 600;
        if (w > maxSize || h > maxSize) {
            const ratio = Math.min(maxSize / w, maxSize / h);
            w = Math.floor(w * ratio);
            h = Math.floor(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(selectedImage, 0, 0, w, h);
        const imgData = tempCtx.getImageData(0, 0, w, h).data;

        const pixels = [];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                pixels.push({ x, y, r: imgData[i], g: imgData[i+1], b: imgData[i+2], a: imgData[i+3] });
            }
        }

        progressText.innerText = 'در حال مرتب‌سازی مسیر پیکسل‌ها...';
        await new Promise(r => setTimeout(r, 100));

        const { pixels: sortedPixels, state: modeState } = sortPixels(pixels, currentMode, w, h);
        const totalPixels = sortedPixels.length;

        const masterData = ctx.createImageData(w, h);
        const md = masterData.data;
        for (let i = 0; i < md.length; i += 4) {
            md[i] = 0; md[i+1] = 0; md[i+2] = 0; md[i+3] = 255;
        }

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        // تعداد پیکسل در هر فریم بر اساس مود
        const speedFactor = {
            spectrum: 200, thermal: 250, luminous: 200,
            clusters: 300, rgbsplit: 350, edgefill: 250, radar: 250
        }[currentMode] || 250;
        const pixelsPerFrame = Math.max(1, Math.floor(totalPixels / speedFactor));

        // ضبط ویدیو
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            downloadLink.href = url;
            downloadLink.style.display = 'block';
            progressText.innerText = 'شاهکار NOVA آماده است! 🎉';
            recPulse.style.display = 'none';
            startBtn.innerText = 'خلق مجدد';
            startBtn.style.display = 'block';
            startBtn.disabled = false;
            modeSelection.style.display = 'block';
            isAnimating = false;
        };

        recorder.start();
        recPulse.style.display = 'block';

        let currentIndex = 0;

        const drawLoop = () => {
            if (currentIndex >= totalPixels) {
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, w, h);
                ctx.putImageData(masterData, 0, 0);
                progressFill.style.width = '100%';
                progressText.innerText = 'تکمیل شد!';
                setTimeout(() => recorder.stop(), 1000);
                return;
            }

            const end = Math.min(currentIndex + pixelsPerFrame, totalPixels);
            const batch = sortedPixels.slice(currentIndex, end);

            for (const p of batch) {
                const idx = (p.y * w + p.x) * 4;
                md[idx] = p.r; md[idx+1] = p.g; md[idx+2] = p.b; md[idx+3] = 255;
            }

            currentIndex = end;
            const progress = currentIndex / totalPixels;

            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            ctx.putImageData(masterData, 0, 0);

            drawModeEffects(currentMode, modeState, batch, progress, w, h);

            const pct = Math.floor(progress * 100);
            progressFill.style.width = `${pct}%`;
            progressText.innerText = `در حال خلق تصویر... ${pct}%`;

            requestAnimationFrame(drawLoop);
        };

        requestAnimationFrame(drawLoop);
    });

})();
