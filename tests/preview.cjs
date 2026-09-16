// Development preview with synthetic bookmarks. Never loaded by the extension.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const folders = [
    { id: 'work', title: '日常', children: [
        ['GitHub', 'https://github.com'], ['Figma', 'https://figma.com'],
        ['Notion', 'https://notion.so'], ['YouTube', 'https://youtube.com'],
        ['哔哩哔哩', 'https://bilibili.com'], ['Spotify', 'https://spotify.com'],
        ['Google', 'https://google.com'], ['知乎', 'https://zhihu.com'],
        ['Dribbble', 'https://dribbble.com'], ['Discord', 'https://discord.com'],
        ['MDN Web Docs · 开发文档与参考手册', 'https://developer.mozilla.org'],
        ['我的工作台', 'https://example.com'],
    ].map(([title, url], i) => ({ id: String(i), title, url })) },
    { id: 'learn', title: '学习', children: [{ id: 'wiki', title: 'Wikipedia', url: 'https://wikipedia.org' }] },
    { id: 'empty', title: '灵感', children: [] },
];
const fixture = `
const folders = ${JSON.stringify(folders)};
const local = JSON.parse(localStorage.getItem('preview-state') || 'null') || { migrationComplete: true, bookmarkTabs: folders.map(({id,title})=>({id,title})) };
if (new URLSearchParams(location.search).has('wallpaper')) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#427b9b"/><stop offset="1" stop-color="#edc59b"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h1600v900H0z"/><circle cx="1150" cy="260" r="110" fill="#ffecd1"/><path fill="#748d85" d="M0 620 430 310 770 610 1130 480 1600 650V900H0z"/><path fill="#294f57" d="M0 760 300 570 690 770 1100 600 1600 740V900H0z"/></svg>';
    local.customBackground = 'url("data:image/svg+xml;base64,' + btoa(svg) + '")';
}
const sync = { theme: localStorage.getItem('theme') || 'dark' };
const storage = data => ({ get: async () => data, set: async values => { Object.assign(data, values); if (data === local) localStorage.setItem('preview-state', JSON.stringify(local)); }, remove: async (key, callback) => { delete data[key]; callback?.(); } });
window.chrome = { storage: { local: storage(local), sync: storage(sync) }, bookmarks: { getTree: async () => [{children: folders}], getChildren: async id => folders.find(folder => folder.id === id).children }, search: { query: ({text}) => console.log(text) } };
`;
http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/preview-fixture.js') {
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        return res.end(fixture);
    }
    const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    try {
        let content = fs.readFileSync(filename);
        if (filename.endsWith('index.html')) content = content.toString().replace('<script src="theme-loader.js">', '<script src="preview-fixture.js"></script><script src="theme-loader.js">');
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
        res.setHeader('Content-Type', (types[path.extname(filename)] || 'text/plain') + '; charset=utf-8');
        res.end(content);
    } catch { res.writeHead(404); res.end(); }
}).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'));
