const App = {
    // --- 元素缓存 ---
    elements: {
        iconRadiusValue: document.getElementById('icon-radius-value'),
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
        clock: document.getElementById('clock'),       
        iconRadiusValue: document.getElementById('icon-radius-value'),
        clock: document.getElementById('clock'),
        greeting: document.getElementById('greeting'), // 获取问候语元素
    },

    // --- 常量 ---
    constants: {
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
    },

    // --- 应用状态 ---
    state: {
        theme: 'dark',
        settings: {},
        sites: [],
        isEditMode: false,
    },

    // --- 初始化 ---
    async init() {
        // --- 💡 关键新增：在加载状态前，先执行一次性数据迁移 ---
        await this.migrateData();
        
        await this.loadState();
        this.applyTheme();
        this.applyBackground();
        this.applySettings();
        this.renderSites();
        this.bindEvents();
    },

    // --- 💡 关键新增：一次性迁移函数 ---
    async migrateData() {
        console.log("Checking for data to migrate...");
        try {
            // 1. 尝试从 'sync' (随身小包) 读取旧数据
            const { savedSites: oldSites } = await chrome.storage.sync.get('savedSites');

            // 2. 如果找到了旧数据
            if (oldSites && oldSites.length > 0) {
                console.warn("Found old data in 'sync'. Migrating to 'local'...");
                
                // 3. 检查 'local' (后备箱) 是否为空，防止覆盖
                const { savedSites: newSites } = await chrome.storage.local.get('savedSites');
                if (!newSites || newSites.length === 0) {
                    // 4. 将旧数据写入 'local'
                    await chrome.storage.local.set({ savedSites: oldSites });
                    console.log("Data successfully migrated to 'local'.");
                } else {
                    console.log("'local' storage already has data. Skipping migration.");
                }

                // 5. (重要) 清理 'sync' 存储，防止下次还执行
                await chrome.storage.sync.remove('savedSites');
                console.log("Old data removed from 'sync'.");

            } else {
                console.log("No data found in 'sync'. Migration not needed.");
            }
        } catch (error) {
            console.error("Error during data migration:", error);
        }
    },
    // --- 迁移函数结束 ---

    // --- 状态管理 ---
    async loadState() {
        // (此函数保持不变，它现在可以正确地从 'local' 读取了)
        const { theme, settings } = await chrome.storage.sync.get(['theme', 'settings']);
        const { savedSites } = await chrome.storage.local.get(['savedSites']);

        this.state.theme = theme || 'dark';
        this.state.settings = { ...this.constants.DEFAULT_SETTINGS, ...settings };
        this.state.sites = savedSites || [];

        if (this.state.settings.iconsPerRow < this.constants.MIN_ICONS_PER_ROW) {
            this.state.settings.iconsPerRow = this.constants.MIN_ICONS_PER_ROW;
        }

        // 💡 关键新增：将加载的主题同步到 localStorage，供 theme-loader.js 使用
        try {
            localStorage.setItem('theme', this.state.theme);
        } catch (e) {
            console.error("Failed to sync theme to localStorage", e);
        }
    },
    async init() {
        await this.migrateData();
        await this.loadState();
        this.applyTheme();
        this.applyBackground();
        this.applySettings();
        this.renderSites();
        this.bindEvents();
        
        // 新增：初始化时钟
        this.startClock();
    },
// --- 修改 new_tab/main.js 中的 startClock 方法 ---

    // --- 修改 new_tab/main.js 中的 startClock 方法 ---
// (替换掉原来的 startClock)

startClock() {
    // 1. 时间逻辑 (保持不变)
    const updateTime = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        if (this.elements.clock.textContent !== timeString) {
            this.elements.clock.textContent = timeString;
        }
    };

    // 2. 问候语逻辑 (修改：设置 placeholder)
    const setGreetingPlaceholder = () => {
        const hours = new Date().getHours();
        let greetingText = '';
        
        // 简短一点的问候语更适合放在搜索框里
        if (hours >= 5 && hours < 11) greetingText = '早上好，新的一天';
        else if (hours >= 11 && hours < 13) greetingText = '中午好，记得休息';
        else if (hours >= 13 && hours < 18) greetingText = '下午好，保持专注';
        else if (hours >= 18 && hours < 23) greetingText = '晚上好，享受生活';
        else greetingText = '夜深了，早点休息';

        const searchInput = this.elements.searchInput;
        
        // --- 方案 A：直接显示 ---
        // searchInput.setAttribute('placeholder', greetingText);

        // --- 方案 B：打字机效果 (推荐，更有科技感) ---
        let i = 0;
        searchInput.setAttribute('placeholder', ''); // 先清空
        
        const typeWriter = () => {
            if (i < greetingText.length) {
                const current = searchInput.getAttribute('placeholder');
                searchInput.setAttribute('placeholder', current + greetingText.charAt(i));
                i++;
                setTimeout(typeWriter, 100); // 打字速度
            } else {
                // 打完字后，停留 3 秒，然后变回默认提示
                setTimeout(() => {
                    searchInput.setAttribute('placeholder', '');
                }, 3000);
            }
        };
        
        // 稍微延迟一点开始打字，错开时间渲染
        setTimeout(typeWriter, 500);
    };

    updateTime();
    setInterval(updateTime, 1000);
    setGreetingPlaceholder(); // 执行
},
    // --- 主题逻辑 ---
    applyTheme() {
        // 💡 关键修改：在 <html> 标签上设置属性，而不是 body
        document.documentElement.setAttribute('data-theme', this.state.theme);
    },

    toggleTheme() {
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        
        // 💡 关键修改：同时保存到 chrome.storage 和 localStorage
        chrome.storage.sync.set({ theme: this.state.theme });
        try {
            localStorage.setItem('theme', this.state.theme);
        } catch (e) {
            console.error("Failed to save theme to localStorage", e);
        }
        
        this.applyBackground(); 
    },

    // --- 背景逻辑 ---
    async applyBackground(customBgUrl = null) {
        const setBgVar = (val) => document.body.style.setProperty('--bg-image', val);

        if (customBgUrl) {
            document.body.classList.add('bg-fade');
            setTimeout(() => {
                setBgVar(`url(${customBgUrl})`);
                setTimeout(() => document.body.classList.remove('bg-fade'), 360);
            }, 40);
            return;
        }

        const { customBackground } = await chrome.storage.local.get('customBackground');
        const bgValue = customBackground || this.constants.DEFAULT_BACKGROUND[this.state.theme];

        document.body.classList.add('bg-fade');
        setTimeout(() => {
            setBgVar(bgValue);
            setTimeout(() => document.body.classList.remove('bg-fade'), 360);
        }, 40);
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

    // --- 网站快捷方式逻辑 ---
    renderSites() {
        const { sitesContainer } = this.elements;
        sitesContainer.innerHTML = ''; 

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
            sitesContainer.appendChild(siteItem);
        });

        const addSiteBtn = document.createElement('button');
        addSiteBtn.id = 'add-site-btn';
        addSiteBtn.className = 'add-site-btn';
        addSiteBtn.textContent = '+';
        sitesContainer.appendChild(addSiteBtn);
    },

    async fetchAndCacheIcon(site, siteIconElement) {
        const fallbackIconUrl = `https://www.google.com/s2/favicons?sz=128&domain_url=${site.url}`;
        let primaryIconUrl = fallbackIconUrl; 
        try {
            const domain = new URL(site.url).hostname;
            primaryIconUrl = `https://logo.clearbit.com/${domain}`;
        } catch (e) {
            console.error(`无效的网站URL "${site.name}": ${site.url}`, e);
        }

        const cacheAndSaveIcon = (blob) => {
            return new Promise((resolve, reject) => {
                if (!blob.type || !blob.type.startsWith('image/')) {
                    reject(new Error('Fetched resource is not an image.'));
                    return;
                }
                const reader = new FileReader();
                reader.onloadend = () => {
                    const dataUrl = reader.result;
                    siteIconElement.src = dataUrl; 
                    
                    const siteToUpdate = this.state.sites.find(s => s.id === site.id);
                    if (siteToUpdate) {
                        siteToUpdate.icon = dataUrl;
                        chrome.storage.local.set({ savedSites: this.state.sites });
                    }
                    resolve(dataUrl);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        };

        try {
            const response = await fetch(primaryIconUrl);
            if (!response.ok) throw new Error('Primary icon response not ok.');
            const blob = await response.blob();
            await cacheAndSaveIcon(blob);
        } catch (error) {
            //console.warn(`Primary icon failed for ${site.url}, trying fallback.`, error.message);
            try {
                const fallbackResponse = await fetch(fallbackIconUrl);
                if (!fallbackResponse.ok) throw new Error('Fallback icon response not ok.');
                const fallbackBlob = await fallbackResponse.blob();
                await cacheAndSaveIcon(fallbackBlob);
            } catch (fallbackError) {
                console.error(`All icon fetches failed for ${site.url}`, fallbackError.message);
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
                console.warn('chrome.search.query API 不可用。后备至 Google 搜索。');
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
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                chrome.storage.local.set({ customBackground: dataUrl });
                this.applyBackground(dataUrl);
            };
            reader.readAsDataURL(file);
        });

        resetBackgroundBtn.addEventListener('click', () => {
            chrome.storage.local.remove('customBackground', () => {
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