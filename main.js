const App = {
    // --- DOM 缓存 ---
    elements: {
        sitesContainer: document.getElementById('sites-container'),

        searchForm: document.getElementById('search-form'),
        searchInput: document.getElementById('search-input'),
        settingsBtn: document.getElementById('settings-btn'),
        settingsDialog: document.getElementById('settings-dialog'),
        settingsForm: document.getElementById('settings-form'),
        settingsCancelBtn: document.getElementById('settings-cancel-btn'),
        iconsPerRowSlider: document.getElementById('icons-per-row'),
        iconsPerRowValue: document.getElementById('icons-per-row-value'),

        themeToggleBtn: document.getElementById('theme-toggle-btn'),
        iconRadiusSlider: document.getElementById('icon-radius-slider'),
        iconRadiusValue: document.getElementById('icon-radius-value'),
        clock: document.getElementById('clock'),
        date: document.getElementById('date'),
        tabBar: document.getElementById('tab-bar'),
        folderPickerDialog: document.getElementById('folder-picker-dialog'),
        folderPickerCancelBtn: document.getElementById('folder-picker-cancel-btn'),
        folderTree: document.getElementById('folder-tree'),
    },

    // --- 常量 ---
    constants: {
        DEBUG: false,
        DEFAULT_SETTINGS: {
            iconsPerRow: 6,
            iconRadius: 20,
        },
        MIN_ICONS_PER_ROW: 6,
        GREETING_DELAY: 500,
        GREETING_TYPE_SPEED: 100,
        GREETING_DISPLAY_TIME: 3000,
        CLOCK_UPDATE_INTERVAL: 60000,
    },

    // --- 状态 ---
    state: {
        theme: 'dark',
        settings: {},

        activeTab: null,
        bookmarkTabs: [],
        selectedFolders: new Map(),
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
        this.grid = new ShortcutGrid(this.elements.sitesContainer,
            () => this.showFolderPicker());
        this.renderTabBar();
        this.switchTab(this.state.bookmarkTabs[0]?.id || null);
        this.wallpaper = new WallpaperController();
        this.wallpaper.bind();
        this.bindEvents();
        this.startClock();
        await this.wallpaper.load();

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
        const { bookmarkTabs } = await chrome.storage.local.get('bookmarkTabs');

        this.state.theme = theme || 'dark';
        this.state.settings = { ...this.constants.DEFAULT_SETTINGS, ...settings };
        this.state.bookmarkTabs = bookmarkTabs || [];

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
    //  设置
    // ==========================================

    applySettings() {
        const { settings } = this.state;
        const { iconsPerRowSlider, iconsPerRowValue, iconRadiusSlider, iconRadiusValue } = this.elements;
        const N = settings.iconsPerRow;
        document.documentElement.style.setProperty('--icons-per-row', N);
        document.documentElement.style.setProperty('--icon-corner-radius', settings.iconRadius + 'px');
        document.querySelector('main').style.maxWidth = (N * 124 + 80) + 'px';

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
        await chrome.storage.sync.set({ settings: newSettings });
        this.state.settings = newSettings;
        this.applySettings();
    },

    // ==========================================
    //  Tab 栏（动态渲染）
    // ==========================================

    renderTabBar() {
        const tabBar = this.elements.tabBar;
        tabBar.innerHTML = '';

        // 书签文件夹 tabs
        this.state.bookmarkTabs.forEach(tab => {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'tab-btn' + (this.state.activeTab === tab.id ? ' active' : '');
            tabBtn.dataset.tab = tab.id;
            tabBtn.setAttribute('aria-current', String(this.state.activeTab === tab.id));

            const label = document.createElement('span');
            label.textContent = tab.title;
            tabBtn.appendChild(label);

            tabBtn.addEventListener('click', () => this.switchTab(tab.id));
            tabBar.appendChild(tabBtn);
        });

        // 添加按钮
        const addBtn = document.createElement('button');
        addBtn.className = 'tab-btn tab-add-btn';
        addBtn.appendChild(ShortcutIcons.create('plus'));
        addBtn.title = '选择标签';
        addBtn.setAttribute('aria-label', '选择标签');
        addBtn.addEventListener('click', () => this.showFolderPicker());
        tabBar.appendChild(addBtn);
    },

    switchTab(tabId) {
        this.state.activeTab = tabId;
        this.renderTabBar();
        if (!tabId) {
            this.grid.showUnselected();
        } else {
            const tab = this.state.bookmarkTabs.find(tab => tab.id === tabId);
            this.grid.showLoading(tab?.title || '快捷访问');
            this.loadBookmarkFolder(tabId);
        }
    },

    // ==========================================
    //  书签文件夹 Tab 管理
    // ==========================================

    async removeBookmarkTab(folderId) {
        this.state.bookmarkTabs = this.state.bookmarkTabs.filter(t => t.id !== folderId);
        await chrome.storage.local.set({ bookmarkTabs: this.state.bookmarkTabs });

        if (this.state.activeTab === folderId) {
            this.switchTab(this.state.bookmarkTabs[0]?.id || null);
        }
        this.renderTabBar();
    },

    // ==========================================
    //  书签文件夹选择器
    // ==========================================

    async showFolderPicker() {
        try {
            const tree = await chrome.bookmarks.getTree();
            this.state.selectedFolders = new Map(this.state.bookmarkTabs.map(tab => [tab.id, { ...tab }]));
            this.renderFolderTree(tree[0].children);
            this.elements.folderPickerDialog.showModal();
        } catch (e) {
            this.error('Failed to load bookmark tree', e);
        }
    },

    renderFolderTree(nodes, container, depth) {
        const target = container || this.elements.folderTree;
        const d = depth || 0;
        if (!container) target.innerHTML = '';

        nodes.forEach(node => {
            if (node.children === undefined) return; // 跳过非文件夹

            const item = document.createElement('div');
            item.style.paddingLeft = `${d * 20}px`;

            const btn = document.createElement('label');
            btn.className = 'folder-tree-btn';
            btn.appendChild(ShortcutIcons.create('folder'));
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.state.selectedFolders.has(node.id);
            btn.prepend(checkbox);

            const nameSpan = document.createElement('span');
            nameSpan.textContent = node.title || '未命名文件夹';
            btn.appendChild(nameSpan);

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.state.selectedFolders.set(node.id, { id: node.id, title: node.title || '未命名文件夹' });
                } else {
                    this.state.selectedFolders.delete(node.id);
                }
            });

            item.appendChild(btn);
            target.appendChild(item);

            // 递归子文件夹
            if (node.children.length > 0) {
                this.renderFolderTree(node.children, target, d + 1);
            }
        });
    },

    // ==========================================
    //  书签内容渲染
    // ==========================================

    async loadBookmarkFolder(folderId) {
        try {
            const children = await chrome.bookmarks.getChildren(folderId);
            if (this.state.activeTab !== folderId) return;
            this.renderBookmarkItems(children);
        } catch (e) {
            this.error('Failed to load bookmark folder', e);
            // 文件夹已删除时切换到剩余标签。
            this.removeBookmarkTab(folderId);
        }
    },

    renderBookmarkItems(nodes) {
        const tab = this.state.bookmarkTabs.find(tab => tab.id === this.state.activeTab);
        this.grid.render(nodes.filter(node => node.url), tab?.title || '快捷访问');
    },

    // ==========================================
    //  事件绑定
    // ==========================================

    bindEvents() {
        const {
            themeToggleBtn, searchForm, searchInput,
            settingsBtn, settingsDialog, settingsCancelBtn,
            iconsPerRowSlider, iconRadiusSlider, settingsForm
        } = this.elements;

        // 主题切换
        themeToggleBtn.addEventListener('click', () => this.toggleTheme());

        // 文件夹选择器取消
        this.elements.folderPickerCancelBtn.addEventListener('click', () => {
            this.elements.folderPickerDialog.close();
        });
        document.getElementById('folder-picker-save-btn').addEventListener('click', async () => {
            const tabs = Array.from(this.state.selectedFolders.values());
            await chrome.storage.local.set({ bookmarkTabs: tabs });
            this.state.bookmarkTabs = tabs;
            const activeId = tabs.some(tab => tab.id === this.state.activeTab)
                ? this.state.activeTab : tabs[0]?.id || null;
            this.switchTab(activeId);
            this.elements.folderPickerDialog.close();
        });

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
        settingsBtn.addEventListener('click', () => {
            this.wallpaper.begin();
            settingsDialog.showModal();
        });
        settingsDialog.addEventListener('close', () => {
            this.wallpaper.cancel();
            this.applySettings();
        });
        settingsDialog.addEventListener('cancel', (event) => {
            if (this.savingSettings) event.preventDefault();
        });
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
            if (this.wallpaper.busy || this.savingSettings) return;
            this.savingSettings = true;
            settingsForm.inert = true;
            const button = document.getElementById('settings-save-btn');
            button.disabled = true;
            try {
                await this.saveSettings();
                await this.wallpaper.save();
                settingsDialog.close();
            } catch (error) {
                this.error('Failed to save settings', error);
                document.getElementById('settings-error').textContent = '保存失败，可能是存储空间不足。请尝试较小的图片或重试。';
            } finally {
                this.savingSettings = false;
                settingsForm.inert = false;
                button.disabled = false;
            }
        });

    }
};

// --- 启动 ---
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
