const App = {
    // --- DOM 缓存 ---
    elements: {
        sitesContainer: document.getElementById('sites-container'),
        addSiteDialog: document.getElementById('add-site-dialog'),
        addSiteForm: document.getElementById('add-site-form'),
        cancelBtn: document.getElementById('cancel-btn'),
        searchForm: document.getElementById('search-form'),
        searchInput: document.getElementById('search-input'),
        settingsBtn: document.getElementById('settings-btn'),
        settingsDialog: document.getElementById('settings-dialog'),
        settingsForm: document.getElementById('settings-form'),
        settingsCancelBtn: document.getElementById('settings-cancel-btn'),
        iconsPerRowSlider: document.getElementById('icons-per-row'),
        iconsPerRowValue: document.getElementById('icons-per-row-value'),
        backgroundUploadInput: document.getElementById('background-upload'),
        resetBackgroundBtn: document.getElementById('reset-background-btn'),
        editSitesBtn: document.getElementById('edit-sites-btn'),
        themeToggleBtn: document.getElementById('theme-toggle-btn'),
        iconRadiusSlider: document.getElementById('icon-radius-slider'),
        iconRadiusValue: document.getElementById('icon-radius-value'),
        clock: document.getElementById('clock'),
        date: document.getElementById('date'),
    },

    // --- 常量 ---
    constants: {
        DEBUG: false,
        DEFAULT_SETTINGS: {
            iconsPerRow: 6,
            iconRadius: 20,
        },
        MIN_ICONS_PER_ROW: 6,
        ICON_WIDTH: 64,
        TARGET_ROW_WIDTH: 550,
        MIN_ICON_GAP: 16,
        MAX_ICON_SIZE: 512 * 1024,
        ALLOWED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
        ICON_FETCH_TIMEOUT: 5000,
        GREETING_DELAY: 500,
        GREETING_TYPE_SPEED: 100,
        GREETING_DISPLAY_TIME: 3000,
        CLOCK_UPDATE_INTERVAL: 60000,
    },

    // --- 状态 ---
    state: {
        theme: 'dark',
        settings: {},
        sites: [],
        isEditMode: false,
        hasCustomBackground: false,
    },

    // --- 日志 ---
    log(...args) {
        if (this.constants.DEBUG) console.log(...args);
    },

    error(...args) {
        console.error(...args);
    },

    // ==========================================
    //  生命周期
    // ==========================================

    async init() {
        await this.migrateData();
        await this.loadState();
        this.applyTheme();
        this.applySettings();
        this.renderSites();
        this.bindEvents();
        this.startClock();
        await this.applyBackground();

        document.documentElement.classList.add('ready');
    },

    // --- 一次性数据迁移（sync → local） ---
    async migrateData() {
        try {
            const { migrationComplete } = await chrome.storage.local.get('migrationComplete');
            if (migrationComplete) return;

            const { savedSites: oldSites } = await chrome.storage.sync.get('savedSites');
            if (oldSites && oldSites.length > 0) {
                const { savedSites: newSites } = await chrome.storage.local.get('savedSites');
                if (!newSites || newSites.length === 0) {
                    await chrome.storage.local.set({ savedSites: oldSites });
                }
                await chrome.storage.sync.remove('savedSites');
            }

            await chrome.storage.local.set({ migrationComplete: true });
        } catch (e) {
            // 静默失败
        }
    },

    // --- 加载状态 ---
    async loadState() {
        const { theme, settings } = await chrome.storage.sync.get(['theme', 'settings']);
        const { savedSites } = await chrome.storage.local.get(['savedSites']);

        this.state.theme = theme || 'dark';
        this.state.settings = { ...this.constants.DEFAULT_SETTINGS, ...settings };
        this.state.sites = savedSites || [];

        if (this.state.settings.iconsPerRow < this.constants.MIN_ICONS_PER_ROW) {
            this.state.settings.iconsPerRow = this.constants.MIN_ICONS_PER_ROW;
        }

        try {
            localStorage.setItem('theme', this.state.theme);
        } catch (e) {
            this.error('Failed to sync theme to localStorage', e);
        }
    },

    // ==========================================
    //  时钟 & 日期
    // ==========================================

    startClock() {
        const updateClock = () => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const timeString = `${hours}:${minutes}`;
            if (this.elements.clock.textContent !== timeString) {
                this.elements.clock.textContent = timeString;
            }
        };

        const updateDate = () => {
            const now = new Date();
            this.elements.date.textContent = now.toLocaleDateString('zh-CN', {
                month: 'long',
                day: 'numeric',
                weekday: 'long',
            });
        };

        const setGreetingPlaceholder = () => {
            const hours = new Date().getHours();
            let greetingText = '';

            if (hours >= 5 && hours < 11) greetingText = '早上好，新的一天';
            else if (hours >= 11 && hours < 13) greetingText = '中午好，记得休息';
            else if (hours >= 13 && hours < 18) greetingText = '下午好，保持专注';
            else if (hours >= 18 && hours < 23) greetingText = '晚上好，享受生活';
            else greetingText = '夜深了，早点休息';

            const input = this.elements.searchInput;
            let i = 0;
            input.setAttribute('placeholder', '');

            const typeWriter = () => {
                if (i < greetingText.length) {
                    const current = input.getAttribute('placeholder');
                    input.setAttribute('placeholder', current + greetingText.charAt(i));
                    i++;
                    setTimeout(typeWriter, this.constants.GREETING_TYPE_SPEED);
                } else {
                    setTimeout(() => {
                        input.setAttribute('placeholder', '');
                    }, this.constants.GREETING_DISPLAY_TIME);
                }
            };

            setTimeout(typeWriter, this.constants.GREETING_DELAY);
        };

        updateClock();
        updateDate();

        // 对齐到下一分钟
        const now = new Date();
        const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
        setTimeout(() => {
            updateClock();
            updateDate();
            setInterval(updateClock, this.constants.CLOCK_UPDATE_INTERVAL);
        }, msUntilNextMinute);

        setGreetingPlaceholder();
    },

    // ==========================================
    //  主题
    // ==========================================

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.state.theme);
    },

    toggleTheme() {
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        chrome.storage.sync.set({ theme: this.state.theme });
        try {
            localStorage.setItem('theme', this.state.theme);
        } catch (e) {
            this.error('Failed to save theme to localStorage', e);
        }
    },

    // ==========================================
    //  背景壁纸（扁平化：仅自定义壁纸，无默认网络图）
    // ==========================================

    async applyBackground() {
        const { customBackground } = await chrome.storage.local.get('customBackground');
        if (customBackground) {
            document.documentElement.style.setProperty('--bg-image', customBackground);
            document.body.classList.add('has-bg');
            this.state.hasCustomBackground = true;
        } else {
            document.documentElement.style.removeProperty('--bg-image');
            document.body.classList.remove('has-bg');
            this.state.hasCustomBackground = false;
        }
    },

    // ==========================================
    //  设置
    // ==========================================

    applySettings() {
        const { settings } = this.state;
        const { iconsPerRowSlider, iconsPerRowValue, iconRadiusSlider, iconRadiusValue } = this.elements;
        const { ICON_WIDTH, TARGET_ROW_WIDTH, MIN_ICON_GAP } = this.constants;

        const N = settings.iconsPerRow;
        const totalGapSpace = TARGET_ROW_WIDTH - (N * ICON_WIDTH);
        const gap = (N > 1) ? Math.max(MIN_ICON_GAP, totalGapSpace / (N - 1)) : 0;

        document.documentElement.style.setProperty('--icon-gap', `${gap}px`);
        document.documentElement.style.setProperty('--icons-per-row', N);
        document.documentElement.style.setProperty('--icon-corner-radius', `${settings.iconRadius}px`);

        const newMaxWidth = N * ICON_WIDTH + (N - 1) * gap;
        document.querySelector('main').style.maxWidth = `${newMaxWidth}px`;

        iconsPerRowSlider.value = N;
        iconsPerRowValue.textContent = N;
        iconRadiusSlider.value = settings.iconRadius;
        iconRadiusValue.textContent = settings.iconRadius;
    },

    async saveSettings() {
        const { iconsPerRowSlider, iconRadiusSlider } = this.elements;
        const newSettings = {
            iconsPerRow: parseInt(iconsPerRowSlider.value, 10),
            iconRadius: parseInt(iconRadiusSlider.value, 10),
        };
        this.state.settings = newSettings;
        await chrome.storage.sync.set({ settings: newSettings });
        this.applySettings();
    },

    // ==========================================
    //  网站快捷方式
    // ==========================================

    renderSites() {
        const { sitesContainer } = this.elements;
        const fragment = document.createDocumentFragment();

        this.state.sites.forEach(site => {
            const siteItem = document.createElement('div');
            siteItem.className = 'site-item';

            const siteLink = document.createElement('a');
            siteLink.href = site.url;
            siteLink.className = 'site-link';

            const siteIcon = document.createElement('img');
            siteIcon.className = 'site-icon';
            siteIcon.alt = site.name;

            if (site.icon) {
                siteIcon.src = site.icon;
            } else {
                this.fetchAndCacheIcon(site, siteIcon);
            }

            const siteName = document.createElement('p');
            siteName.className = 'site-name';
            siteName.textContent = site.name;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-site-btn';
            deleteBtn.dataset.id = site.id;
            deleteBtn.textContent = '×';

            siteLink.appendChild(siteIcon);
            siteItem.appendChild(siteLink);
            siteItem.appendChild(siteName);
            siteItem.appendChild(deleteBtn);
            fragment.appendChild(siteItem);
        });

        const addSiteBtn = document.createElement('button');
        addSiteBtn.id = 'add-site-btn';
        addSiteBtn.className = 'add-site-btn';
        addSiteBtn.textContent = '+';
        fragment.appendChild(addSiteBtn);

        sitesContainer.innerHTML = '';
        sitesContainer.appendChild(fragment);
    },

    // 生成字母头像（扁平配色）
    getDefaultIcon(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const hue = name.charCodeAt(0) * 137.5 % 360;
        ctx.fillStyle = `hsl(${hue}, 45%, 58%)`;
        ctx.fillRect(0, 0, 128, 128);

        ctx.fillStyle = '#fff';
        ctx.font = '600 56px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.charAt(0).toUpperCase(), 64, 68);

        return canvas.toDataURL('image/png');
    },

    // 压缩图片为 webp
    async compressImage(blob, maxWidth = 128, maxHeight = 128) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let { width, height } = img;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/webp', 0.85));
            };
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(blob);
        });
    },

    // 获取并缓存图标（仅 Google Favicons）
    async fetchAndCacheIcon(site, siteIconElement) {
        const iconUrl = `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(site.url)}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.constants.ICON_FETCH_TIMEOUT);

            const response = await fetch(iconUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Icon fetch failed');
            const blob = await response.blob();

            if (blob.size > this.constants.MAX_ICON_SIZE) {
                throw new Error('Image too large');
            }

            const compressed = await this.compressImage(blob, 128, 128);
            if (!compressed) throw new Error('Compression failed');

            siteIconElement.src = compressed;
            const siteToUpdate = this.state.sites.find(s => s.id === site.id);
            if (siteToUpdate) {
                siteToUpdate.icon = compressed;
                await chrome.storage.local.set({ savedSites: this.state.sites });
            }
        } catch (error) {
            // 所有获取失败，使用字母头像
            const defaultIcon = this.getDefaultIcon(site.name);
            siteIconElement.src = defaultIcon;
            const siteToUpdate = this.state.sites.find(s => s.id === site.id);
            if (siteToUpdate) {
                siteToUpdate.icon = defaultIcon;
                await chrome.storage.local.set({ savedSites: this.state.sites });
            }
        }
    },

    async addSite(name, url) {
        const newSite = { id: Date.now(), name, url, icon: null };
        this.state.sites.push(newSite);
        await chrome.storage.local.set({ savedSites: this.state.sites });
        this.renderSites();
    },

    async deleteSite(siteId) {
        this.state.sites = this.state.sites.filter(site => site.id !== siteId);
        await chrome.storage.local.set({ savedSites: this.state.sites });
        this.renderSites();
    },

    // ==========================================
    //  编辑模式
    // ==========================================

    toggleEditMode() {
        this.state.isEditMode = !this.state.isEditMode;
        document.body.classList.toggle('edit-mode', this.state.isEditMode);
        this.elements.editSitesBtn.classList.toggle('editing', this.state.isEditMode);

        const editIcon = this.elements.editSitesBtn.querySelector('.edit-icon');
        const doneIcon = this.elements.editSitesBtn.querySelector('.done-icon');
        if (this.state.isEditMode) {
            editIcon.style.display = 'none';
            doneIcon.style.display = 'block';
        } else {
            editIcon.style.display = 'block';
            doneIcon.style.display = 'none';
        }
    },

    // ==========================================
    //  事件绑定
    // ==========================================

    bindEvents() {
        const {
            editSitesBtn, themeToggleBtn, searchForm, searchInput,
            settingsBtn, settingsDialog, settingsCancelBtn,
            iconsPerRowSlider, iconRadiusSlider, settingsForm,
            backgroundUploadInput, resetBackgroundBtn,
            addSiteDialog, cancelBtn, addSiteForm, sitesContainer
        } = this.elements;

        // 编辑模式 & 主题切换
        editSitesBtn.addEventListener('click', () => this.toggleEditMode());
        themeToggleBtn.addEventListener('click', () => this.toggleTheme());

        // 搜索
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (!query) return;

            if (chrome && chrome.search && chrome.search.query) {
                chrome.search.query({ text: query });
            } else {
                window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(query);
            }
        });

        // 设置弹窗
        settingsBtn.addEventListener('click', () => settingsDialog.showModal());
        settingsCancelBtn.addEventListener('click', () => {
            settingsDialog.close();
            this.applySettings();
        });

        // 滑块实时预览
        iconsPerRowSlider.addEventListener('input', () => {
            this.elements.iconsPerRowValue.textContent = iconsPerRowSlider.value;
        });
        iconRadiusSlider.addEventListener('input', () => {
            this.elements.iconRadiusValue.textContent = iconRadiusSlider.value;
        });

        // 保存设置
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveSettings();
            settingsDialog.close();
        });

        // 上传壁纸
        backgroundUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file || !file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = () => {
                const cssValue = `url('${reader.result}')`;
                chrome.storage.local.set({ customBackground: cssValue });
                document.documentElement.style.setProperty('--bg-image', cssValue);
                document.body.classList.add('has-bg');
                this.state.hasCustomBackground = true;
            };
            reader.readAsDataURL(file);
        });

        // 重置壁纸
        resetBackgroundBtn.addEventListener('click', () => {
            chrome.storage.local.remove('customBackground', () => {
                document.documentElement.style.removeProperty('--bg-image');
                document.body.classList.remove('has-bg');
                this.state.hasCustomBackground = false;
                backgroundUploadInput.value = '';
            });
        });

        // 添加站点弹窗
        cancelBtn.addEventListener('click', () => addSiteDialog.close());

        addSiteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('site-name').value;
            let url = document.getElementById('site-url').value;

            if (url && !/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }

            await this.addSite(name, url);
            addSiteForm.reset();
            addSiteDialog.close();
        });

        // 站点点击事件代理
        sitesContainer.addEventListener('click', (e) => {
            const target = e.target;

            if (target.id === 'add-site-btn' || target.parentElement?.id === 'add-site-btn') {
                if (this.state.isEditMode) return;
                addSiteDialog.showModal();
            } else if (target.classList.contains('delete-site-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const siteId = parseInt(target.dataset.id, 10);
                this.deleteSite(siteId);
            } else if (target.closest('.site-link')) {
                if (this.state.isEditMode) {
                    e.preventDefault();
                }
            }
        });
    }
};

// --- 启动 ---
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
