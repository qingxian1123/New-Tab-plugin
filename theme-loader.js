(function() {
    try {
        const savedTheme = localStorage.getItem('theme');
        
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        
        document.documentElement.setAttribute('data-theme', theme);
        
    } catch (e) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();