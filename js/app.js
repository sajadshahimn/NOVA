/* =============================================
   NOVA - Neon Pixel Genesis
   منطق اصلی برنامه
   ============================================= */

(function () {
    'use strict';

    // ---------- المان‌های DOM ----------
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

    // ---------- وضعیت برنامه ----------
    let selectedImage = null;
    let currentMode = 'ripple';
    let isAnimating = false;

    // =============================================
    // انتخاب مود
    // =============================================
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
        });
    });

    // =============================================
    // آپلود عکس
    // =============================================
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

    // =============================================
    // محاسبه Hue از RGB (برای مود Spectrum)
    // =============================================
    function getHue(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
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

    // =============================================
    // مرتب‌سازی پیکسل‌ها بر اساس مود
    // =============================================
    function sortPixels(pixels, mode, width, height) {
        const cx = width / 2;
        const cy = height / 2;

        // فیلتر پیکسل‌های نیمه‌شفاف و بسیار تیره (پس‌زمینه)
        const validPixels = pixels.filter(
            p => p.a > 128 && (p.r + p.g + p.b > 30)
        );

        switch (mode) {
            case 'ripple':
                validPixels.sort((a, b) => {
                    const da = (a.x - cx) ** 2 + (a.y - cy) ** 2;
                    const db = (b.x - cx) ** 2 + (b.y - cy) ** 2;
                    return da - db;
                });
                break;

            case 'rain':
                validPixels.sort((a, b) => {
                    if (a.x === b.x) return a.y - b.y;
                    return a.x - b.x;
                });
                break;

            case 'spiral':
                validPixels.sort((a, b) => {
                    const angleA = Math.atan2(a.y - cy, a.x - cx);
                    const angleB = Math.atan2(b.y - cy, b.x - cx);
                    const distA = Math.hypot(a.x - cx, a.y - cy);
                    const distB = Math.hypot(b.x - cx, b.y - cy);
                    const valA = angleA + distA * 0.05;
                    const valB = angleB + distB * 0.05;
                    return valA - valB;
                });
                break;

            case 'spectrum':
                validPixels.forEach(p => { p.hue = getHue(p.r, p.g, p.b); });
                validPixels.sort((a, b) => {
                    if (Math.abs(a.hue - b.hue) < 10) {
                        return (a.r + a.g + a.b) - (b.r + b.g + b.b);
                    }
                    return a.hue - b.hue;
                });
                break;
        }
        return validPixels;
    }

    // =============================================
    // شروع انیمیشن
    // =============================================
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

        // تنظیم ابعاد بوم
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

        // خواندن پیکسل‌ها
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(selectedImage, 0, 0, w, h);
        const imgData = tempCtx.getImageData(0, 0, w, h).data;

        // استخراج پیکسل‌ها
        const pixels = [];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                pixels.push({
                    x, y,
                    r: imgData[i],
                    g: imgData[i + 1],
                    b: imgData[i + 2],
                    a: imgData[i + 3]
                });
            }
        }

        progressText.innerText = 'در حال مرتب‌سازی مسیر پیکسل‌ها...';
        await new Promise(r => setTimeout(r, 100));

        // مرتب‌سازی
        const sortedPixels = sortPixels(pixels, currentMode, w, h);
        const totalPixels = sortedPixels.length;

        // ============ تنظیمات ضبط ویدیو ============
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9'
        });
        const chunks = [];

        recorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };

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

        // پاک کردن بوم
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        // ============ حلقه‌ی رسم ============
        let currentIndex = 0;
        const pixelsPerFrame = Math.max(1, Math.floor(totalPixels / 300));

        const drawLoop = () => {
            if (currentIndex >= totalPixels) {
                setTimeout(() => recorder.stop(), 1000);
                return;
            }

            for (let i = 0; i < pixelsPerFrame && currentIndex < totalPixels; i++) {
                const p = sortedPixels[currentIndex];

                // رسم پیکسل
                ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
                ctx.fillRect(p.x, p.y, 1, 1);

                // درخشش برای پیکسل‌های روشن
                if (p.r + p.g + p.b > 400) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
                }

                currentIndex++;
            }

            const progress = Math.floor((currentIndex / totalPixels) * 100);
            progressFill.style.width = `${progress}%`;
            progressText.innerText = `در حال خلق تصویر... ${progress}%`;

            requestAnimationFrame(drawLoop);
        };

        requestAnimationFrame(drawLoop);
    });

})();
