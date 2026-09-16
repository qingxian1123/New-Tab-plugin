// Wallpaper changes stay in a draft until the settings form is saved.
class WallpaperController {
    constructor() {
        this.saved = { image: '', dim: 0 };
        this.draft = null;
        this.readVersion = 0;
        this.busy = false;
        this.upload = document.getElementById('background-upload');
        this.remove = document.getElementById('reset-background-btn');
        this.dim = document.getElementById('wallpaper-dim');
        this.dimValue = document.getElementById('wallpaper-dim-value');
        this.preview = document.getElementById('wallpaper-preview');
        this.status = document.getElementById('wallpaper-status');
        this.error = document.getElementById('settings-error');
        this.saveButton = document.getElementById('settings-save-btn');
    }

    async load() {
        const { customBackground, wallpaperDim } = await chrome.storage.local.get(['customBackground', 'wallpaperDim']);
        this.saved = {
            image: typeof customBackground === 'string' ? customBackground : '',
            dim: this.normalizeDim(wallpaperDim),
        };
        this.render(this.saved);
    }

    normalizeDim(value) {
        return Math.min(60, Math.max(0, Number(value) || 0));
    }

    begin() {
        this.draft = { ...this.saved };
        this.error.textContent = '';
        this.upload.value = '';
        this.render(this.draft);
    }

    cancel() {
        this.readVersion++;
        this.draft = null;
        this.setBusy(false);
        this.render(this.saved);
    }

    render(value) {
        const hasImage = Boolean(value.image);
        document.body.classList.toggle('has-bg', hasImage);
        document.documentElement.style.setProperty('--bg-image', value.image || 'none');
        document.documentElement.style.setProperty('--wallpaper-dim', String(value.dim / 100));
        this.preview.style.backgroundImage = value.image || 'none';
        this.preview.style.setProperty('--wallpaper-dim', String(value.dim / 100));
        this.preview.classList.toggle('has-image', hasImage);
        this.dim.value = value.dim;
        this.dimValue.textContent = `${value.dim}%`;
        this.dim.disabled = !hasImage;
        this.remove.disabled = !hasImage;
        this.status.textContent = hasImage ? '自定义壁纸' : '使用主题背景';
    }

    setBusy(value) {
        this.busy = value;
        this.saveButton.disabled = value;
    }

    async selectFile(file) {
        if (!file || !this.draft) return;
        const version = ++this.readVersion;
        this.error.textContent = '';
        this.setBusy(false);
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
            this.error.textContent = '请选择 JPG、PNG、WebP 或 AVIF 图片。';
            return;
        }
        if (file.size > 6 * 1024 * 1024) {
            this.error.textContent = '图片超过 6 MB，请选择较小的图片。';
            return;
        }
        this.setBusy(true);
        try {
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('read'));
                reader.readAsDataURL(file);
            });
            await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = resolve;
                image.onerror = reject;
                image.src = data;
            });
            if (version !== this.readVersion || !this.draft) return;
            this.draft.image = `url("${data}")`;
            this.render(this.draft);
        } catch {
            if (version === this.readVersion) this.error.textContent = '无法读取这张图片，请选择其他图片。';
        } finally {
            if (version === this.readVersion) this.setBusy(false);
        }
    }

    async save() {
        if (!this.draft || this.busy) throw new Error('Wallpaper is not ready');
        const next = { ...this.draft };
        // A single local write also covers removal and preserves legacy image format.
        await chrome.storage.local.set({ customBackground: next.image, wallpaperDim: next.dim });
        this.saved = next;
        this.draft = null;
    }

    bind() {
        this.upload.addEventListener('change', () => this.selectFile(this.upload.files[0]));
        this.remove.addEventListener('click', () => {
            if (!this.draft) return;
            this.readVersion++;
            this.setBusy(false);
            this.draft.image = '';
            this.draft.dim = 0;
            this.upload.value = '';
            this.error.textContent = '';
            this.render(this.draft);
        });
        this.dim.addEventListener('input', () => {
            if (!this.draft) return;
            this.draft.dim = this.normalizeDim(this.dim.value);
            this.render(this.draft);
        });
    }
}
