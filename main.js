const App = {
    // --- 元素缓存 ---
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
        greeting: document.getElementById('greeting'),
    },

    // --- 常量 ---
    constants: {
        DEBUG: false, // 生产环境设为 false
        DEFAULT_SETTINGS: {
            iconsPerRow: 6,
            iconRadius: 32,
        },
        DEFAULT_BACKGROUND: {
            light: "url('https://source.unsplash.com/random/1920x1080?nature,light')",
            dark: "url('https://source.unsplash.com/random/1920x1080?nature,dark,moody,blur')"
        },
        MIN_ICONS_PER_ROW: 6,
        ICON_WIDTH: 64,
        TARGET_ROW_WIDTH: 550,
        MIN_ICON_GAP: 20,
        MAX_ICON_SIZE: 512 * 1024,
        ALLOWED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
        ICON_FETCH_TIMEOUT: 5000,
        BACKGROUND_PRELOAD_TIMEOUT: 3000,
        GREETING_DELAY: 500,
        GREETING_TYPE_SPEED: 100,
        GREETING_DISPLAY_TIME: 3000,
        CLOCK_UPDATE_INTERVAL: 60000,
    },

    // --- 应用状态 ---
    state: {
        theme: 'dark',
        settings: {},
        sites: [],
        isEditMode: false,
        hasCustomBackground: false,
    },

    // --- 日志辅助函数 ---
    log(...args) {
        if (this.constants.DEBUG) console.log(...args);
    },

    warn(...args) {
        if (this.constants.DEBUG) console.warn(...args);
    },

    error(...args) {
        // 错误始终输出，便于调试
        console.error(...args);
    },

    // --- 初始化 ---
    async init() {
        await this.migrateData();
        await this.loadState();
        this.applyTheme();
        this.applySettings();
        this.renderSites();
        this.bindEvents();
        this.startClock();

        // 立即标记页面准备完成，显示内容
        document.documentElement.classList.add('ready');

        // 背景异步加载，不阻塞内容显示
        this.applyBackground(null, true);

        // 延迟启用过渡效果，避免首屏闪烁
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.classList.add('loaded');
            });
        });
    },

    // --- 一次性迁移函数 ---
    async migrateData() {
        try {
            // 检查是否已完成迁移
            const { migrationComplete } = await chrome.storage.local.get('migrationComplete');
            if (migrationComplete) {
                return; // 已迁移，跳过
            }

            const { savedSites: oldSites } = await chrome.storage.sync.get('savedSites');

            if (oldSites && oldSites.length > 0) {
                const { savedSites: newSites } = await chrome.storage.local.get('savedSites');
                if (!newSites || newSites.length === 0) {
                    await chrome.storage.local.set({ savedSites: oldSites });
                }
                await chrome.storage.sync.remove('savedSites');
            }

            // 标记迁移完成
            await chrome.storage.local.set({ migrationComplete: true });
        } catch (error) {
            // 静默失败，不影响用户体验
        }
    },

    // --- 状态管理 ---
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
            this.error("Failed to sync theme to localStorage", e);
        }
    },

    // --- 时钟逻辑（优化：每分钟更新而非每秒） ---
    startClock() {
        const updateTime = () => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const timeString = `${hours}:${minutes}`;
            if (this.elements.clock.textContent !== timeString) {
                this.elements.clock.textContent = timeString;
            }
        };

        const setGreetingPlaceholder = () => {
            const hours = new Date().getHours();
            let greetingText = '';

            if (hours >= 5 && hours < 11) greetingText = '早上好，新的一天';
            else if (hours >= 11 && hours < 13) greetingText = '中午好，记得休息';
            else if (hours >= 13 && hours < 18) greetingText = '下午好，保持专注';
            else if (hours >= 18 && hours < 23) greetingText = '晚上好，享受生活';
            else greetingText = '夜深了，早点休息';

            const searchInput = this.elements.searchInput;

            let i = 0;
            searchInput.setAttribute('placeholder', '');

            const typeWriter = () => {
                if (i < greetingText.length) {
                    const current = searchInput.getAttribute('placeholder');
                    searchInput.setAttribute('placeholder', current + greetingText.charAt(i));
                    i++;
                    setTimeout(typeWriter, this.constants.GREETING_TYPE_SPEED);
                } else {
                    setTimeout(() => {
                        searchInput.setAttribute('placeholder', '');
                    }, this.constants.GREETING_DISPLAY_TIME);
                }
            };

            setTimeout(typeWriter, this.constants.GREETING_DELAY);
        };

        // 立即更新一次时间
        updateTime();

        // 优化：计算到下一分钟的毫秒数，然后每分钟更新
        const now = new Date();
        const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

        setTimeout(() => {
            updateTime();
            // 之后每 60 秒更新一次
            setInterval(updateTime, this.constants.CLOCK_UPDATE_INTERVAL);
        }, msUntilNextMinute);

        setGreetingPlaceholder();
    },

    // --- 主题逻辑 ---
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
            this.error("Failed to save theme to localStorage", e);
        }

        // 优化：只有在没有自定义背景时，才切换主题背景
        if (!this.state.hasCustomBackground) {
            // 立即更新背景色类以避免闪烁
            document.documentElement.classList.remove('bg-loading', 'bg-loaded');
            document.documentElement.classList.add('bg-ready');
            this.applyBackground();
        }
    },

    // --- 背景逻辑（优化：支持预加载和自定义背景状态管理） ---
    async applyBackground(customBgUrl = null, isInitialLoad = false) {
        // 统一设置到 documentElement，与 theme-loader.js 保持一致
        const setBgVar = (val) => {
            document.documentElement.style.setProperty('--bg-image', val);
            // 同步缓存到 localStorage，供 theme-loader.js 首屏使用
            this.cacheBackground(val);
        };

        // 场景1：刚刚上传新背景（预览模式）
        if (customBgUrl) {
            this.state.hasCustomBackground = true;
            this.cacheBackgroundState(true);
            // 先应用模糊背景
            setBgVar(customBgUrl);
            document.documentElement.classList.add('bg-loading');
            // 预加载完成后移除模糊
            await this.preloadBackground(customBgUrl);
            document.documentElement.classList.remove('bg-loading');
            document.documentElement.classList.add('bg-loaded');
            return;
        }

        // 场景2：初始化或切换主题时读取存储
        const { customBackground } = await chrome.storage.local.get('customBackground');

        if (customBackground) {
            // 有自定义背景
            this.state.hasCustomBackground = true;
            this.cacheBackgroundState(true);

            if (isInitialLoad) {
                // 初始加载：如果 theme-loader 已经应用了模糊背景，直接等待预加载完成后去模糊
                await this.preloadBackground(customBackground);
                document.documentElement.classList.remove('bg-loading');
                document.documentElement.classList.add('bg-loaded');
            } else {
                // 运行时切换：先应用模糊，再去模糊
                setBgVar(customBackground);
                document.documentElement.classList.add('bg-loading');
                await this.preloadBackground(customBackground);
                document.documentElement.classList.remove('bg-loading');
                document.documentElement.classList.add('bg-loaded');
            }
        } else {
            // 无自定义背景，使用主题默认背景
            this.state.hasCustomBackground = false;
            this.cacheBackgroundState(false);
            const bgValue = this.constants.DEFAULT_BACKGROUND[this.state.theme];

            // 清除自定义背景的状态类
            document.documentElement.classList.remove('bg-loading', 'bg-loaded');

            if (isInitialLoad) {
                // 初始加载：预加载后直接显示（用淡入效果）
                setBgVar(bgValue);
                await this.preloadBackground(bgValue);
                document.documentElement.classList.add('bg-ready');
            } else {
                // 主题切换或重置背景：立即恢复主题背景色
                document.documentElement.classList.add('bg-ready');
                this.preloadBackground(bgValue).then(() => {
                    document.body.classList.add('bg-fade');
                    setTimeout(() => {
                        setBgVar(bgValue);
                        setTimeout(() => document.body.classList.remove('bg-fade'), 360);
                    }, 40);
                });
            }
        }
    },

    // 缓存背景到 localStorage（供 theme-loader.js 首屏使用）
    cacheBackground(cssValue) {
        try {
            // 检查是否有实际的背景图
            if (!cssValue || cssValue === 'none' || cssValue === 'url()' || cssValue === "url('')") {
                // 没有背景图，移除缓存
                localStorage.removeItem('cachedBackground');
            } else {
                // 有背景图，缓存到 localStorage
                localStorage.setItem('cachedBackground', cssValue);
            }
        } catch (e) {
            // localStorage 可能已满（自定义背景 Data URL 很大）
            // 静默失败，不影响功能
        }
    },

    // 缓存背景状态标记
    cacheBackgroundState(hasCustom) {
        try {
            localStorage.setItem('hasCustomBackground', hasCustom ? 'true' : 'false');
        } catch (e) {
            // 静默失败
        }
    },

    // 新增：背景图片预加载函数
    preloadBackground(cssUrlValue) {
        return new Promise((resolve) => {
            // 从 CSS url('...') 格式中提取实际 URL
            const match = cssUrlValue.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (!match || !match[1]) {
                resolve(); // 无法解析则直接完成
                return;
            }

            const url = match[1];

            // Data URL 不需要预加载（已在本地），直接完成
            if (url.startsWith('data:')) {
                resolve();
                return;
            }

            const img = new Image();
            let resolved = false;

            const finish = () => {
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            };

            img.onload = finish;
            img.onerror = finish; // 加载失败也继续
            // 设置超时，防止网络问题导致长时间等待
            setTimeout(finish, this.constants.BACKGROUND_PRELOAD_TIMEOUT);
            img.src = url;
        });
    },

    // --- 设置逻辑 ---
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

    // --- 网站快捷方式逻辑（优化：使用 DocumentFragment 批量插入） ---
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

        // 一次性清空并插入，减少重排次数
        sitesContainer.innerHTML = '';
        sitesContainer.appendChild(fragment);
    },

    // 生成默认图标（首字母头像）
    getDefaultIcon(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // 根据名称生成颜色
        const hue = name.charCodeAt(0) * 137.5 % 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
        ctx.fillRect(0, 0, 128, 128);

        // 绘制首字母
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.charAt(0).toUpperCase(), 64, 64);

        return canvas.toDataURL('image/png');
    },

    // 压缩图片
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

    async fetchAndCacheIcon(site, siteIconElement) {
        const fallbackIconUrl = `https://www.google.com/s2/favicons?sz=128&domain_url=${site.url}`;
        let primaryIconUrl = fallbackIconUrl;

        try {
            const domain = new URL(site.url).hostname;
            primaryIconUrl = `https://logo.clearbit.com/${domain}`;
        } catch (e) {
            // URL 无效，使用默认图标
            const defaultIcon = this.getDefaultIcon(site.name);
            siteIconElement.src = defaultIcon;
            const siteToUpdate = this.state.sites.find(s => s.id === site.id);
            if (siteToUpdate) {
                siteToUpdate.icon = defaultIcon;
                await chrome.storage.local.set({ savedSites: this.state.sites });
            }
            return;
        }

        const cacheAndSaveIcon = async (blob) => {
            // 验证图片类型
            if (!blob.type || !this.constants.ALLOWED_IMAGE_TYPES.includes(blob.type)) {
                throw new Error('Invalid image type');
            }

            // 验证图片大小
            if (blob.size > this.constants.MAX_ICON_SIZE) {
                throw new Error('Image too large');
            }

            // 压缩图片
            const compressedDataUrl = await this.compressImage(blob, 128, 128);
            if (!compressedDataUrl) {
                throw new Error('Image compression failed');
            }

            siteIconElement.src = compressedDataUrl;

            const siteToUpdate = this.state.sites.find(s => s.id === site.id);
            if (siteToUpdate) {
                siteToUpdate.icon = compressedDataUrl;
                await chrome.storage.local.set({ savedSites: this.state.sites });
            }
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.constants.ICON_FETCH_TIMEOUT);

            const response = await fetch(primaryIconUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Primary icon response not ok.');
            const blob = await response.blob();
            await cacheAndSaveIcon(blob);
        } catch (error) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.constants.ICON_FETCH_TIMEOUT);

                const fallbackResponse = await fetch(fallbackIconUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!fallbackResponse.ok) throw new Error('Fallback icon response not ok.');
                const fallbackBlob = await fallbackResponse.blob();
                await cacheAndSaveIcon(fallbackBlob);
            } catch (fallbackError) {
                // 所有获取失败，使用默认图标
                const defaultIcon = this.getDefaultIcon(site.name);
                siteIconElement.src = defaultIcon;
                const siteToUpdate = this.state.sites.find(s => s.id === site.id);
                if (siteToUpdate) {
                    siteToUpdate.icon = defaultIcon;
                    await chrome.storage.local.set({ savedSites: this.state.sites });
                }
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

    // --- 编辑模式逻辑 ---
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

    // --- 事件绑定 ---
    bindEvents() {
        const {
            editSitesBtn, themeToggleBtn, searchForm, searchInput, settingsBtn, settingsDialog, settingsCancelBtn,
            iconsPerRowSlider, iconRadiusSlider, settingsForm, backgroundUploadInput,
            resetBackgroundBtn, addSiteDialog, cancelBtn, addSiteForm, sitesContainer
        } = this.elements;

        editSitesBtn.addEventListener('click', () => this.toggleEditMode());
        themeToggleBtn.addEventListener('click', () => this.toggleTheme());

        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (!query) return;

            if (chrome && chrome.search && chrome.search.query) {
                chrome.search.query({ text: query });
            } else {
                this.warn('chrome.search.query API 不可用。后备至 Google 搜索。');
                window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(query);
            }
        });

        settingsBtn.addEventListener('click', () => this.elements.settingsDialog.showModal());
        settingsCancelBtn.addEventListener('click', () => {
            this.elements.settingsDialog.close();
            this.applySettings();
        });

        iconsPerRowSlider.addEventListener('input', () => this.elements.iconsPerRowValue.textContent = iconsPerRowSlider.value);
        iconRadiusSlider.addEventListener('input', () => this.elements.iconRadiusValue.textContent = iconRadiusSlider.value);

        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveSettings();
            settingsDialog.close();
        });

        backgroundUploadInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = () => {
                const rawData = reader.result;
                const cssValue = `url('${rawData}')`;

                chrome.storage.local.set({ customBackground: cssValue });
                this.applyBackground(cssValue);
            };
            reader.readAsDataURL(file);
        });

        resetBackgroundBtn.addEventListener('click', () => {
            chrome.storage.local.remove('customBackground', () => {
                this.state.hasCustomBackground = false;
                this.cacheBackgroundState(false);
                // 清除旧的背景缓存
                localStorage.removeItem('cachedBackground');
                // 清除所有背景状态类，恢复主题背景色
                document.documentElement.classList.remove('bg-loading', 'bg-loaded');
                document.documentElement.classList.add('bg-ready');
                // 重新应用背景
                this.applyBackground();
                backgroundUploadInput.value = '';
            });
        });

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

        sitesContainer.addEventListener('click', (e) => {
            const target = e.target;

            if (target.id === 'add-site-btn' || target.parentElement.id === 'add-site-btn') {
                if (this.state.isEditMode) return;
                addSiteDialog.showModal();
            }
            else if (target.classList.contains('delete-site-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const siteId = parseInt(target.dataset.id, 10);
                this.deleteSite(siteId);
            }
            else if (target.closest('.site-link')) {
                if (this.state.isEditMode) {
                    e.preventDefault();
                }
            }
        });
    }
};

// --- 页面初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
