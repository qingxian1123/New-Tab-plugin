(function() {
    try {
        // 1. 主题处理
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);

        // 2. 背景处理（使用 localStorage 缓存，避免首屏闪烁）
        const cachedBackground = localStorage.getItem('cachedBackground');

        if (cachedBackground) {
            // 有缓存背景图，先应用模糊效果，让加载过程更优雅
            document.documentElement.style.setProperty('--bg-image', cachedBackground);
            document.documentElement.classList.add('bg-loading'); // 初始显示模糊背景
        }
        // 等待 main.js 完成预加载后会移除 bg-loading 并添加 bg-loaded

    } catch (e) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();