// Local SVG assets only; no remote icon library or executable CDN dependency.
const ShortcutIcons = {
    brands: {
        'github.com': ['github', '#8b7cf8'],
        'gitlab.com': ['gitlab', '#ef8150'],
        'google.com': ['google', '#4285f4'],
        'youtube.com': ['youtube', '#ef5350'],
        'notion.so': ['notion', '#848b98'],
        'notion.com': ['notion', '#848b98'],
        'figma.com': ['figma', '#a878f5'],
        'bilibili.com': ['bilibili', '#ec78a0'],
        'zhihu.com': ['zhihu', '#3987ee'],
        'baidu.com': ['baidu', '#5478ed'],
        'dribbble.com': ['dribbble', '#e977ab'],
        'spotify.com': ['spotify', '#38b975'],
        'reddit.com': ['reddit', '#f07848'],
        'discord.com': ['discord', '#8189f8'],
        'stackoverflow.com': ['stackoverflow', '#e79549'],
        'vercel.com': ['vercel', '#848b98'],
        'npmjs.com': ['npm', '#e56565'],
        'developer.mozilla.org': ['mdnwebdocs', '#a878f5'],
        'wikipedia.org': ['wikipedia', '#848b98'],
        'pinterest.com': ['pinterest', '#e65d72'],
        'twitch.tv': ['twitch', '#a878f5'],
    },

    findBrand(hostname) {
        const host = hostname.toLowerCase();
        return Object.entries(this.brands).find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1];
    },

    create(name, className = '') {
        const icon = document.createElement('span');
        icon.className = `ui-icon ${className}`.trim();
        icon.setAttribute('aria-hidden', 'true');
        icon.style.setProperty('--icon-url', `url("icon/lucide/${name}.svg")`);
        return icon;
    },

    createSiteIcon(url) {
        const badge = document.createElement('span');
        badge.className = 'shortcut-icon';
        badge.setAttribute('aria-hidden', 'true');
        const brand = this.findBrand(url.hostname);
        if (brand) {
            badge.style.setProperty('--brand-color', brand[1]);
            const glyph = this.create('globe', 'brand-icon');
            glyph.style.setProperty('--icon-url', `url("icon/brands/${brand[0]}.svg")`);
            badge.appendChild(glyph);
        } else {
            badge.appendChild(this.create('globe'));
            // Chrome's favicon cache also works without a third-party icon service.
            if (/^https?:$/.test(url.protocol) && globalThis.chrome?.runtime?.getURL) {
                const favicon = new URL(chrome.runtime.getURL('/_favicon/'));
                favicon.searchParams.set('pageUrl', url.origin);
                favicon.searchParams.set('size', '64');
                const image = document.createElement('img');
                image.alt = '';
                image.decoding = 'async';
                image.className = 'shortcut-favicon';
                image.onload = () => badge.replaceChildren(image);
                image.onerror = () => image.remove();
                image.src = favicon.href;
            }
        }
        return badge;
    },
};

class ShortcutGrid {
    constructor(container, heading, count, onChooseFolders) {
        this.container = container;
        this.heading = heading;
        this.count = count;
        this.onChooseFolders = onChooseFolders;
    }

    createCard(site) {
        let url;
        try {
            url = new URL(site.url);
        } catch {
            return null;
        }
        // Bookmarklets and data URLs must not execute inside the extension page.
        if (!['http:', 'https:', 'ftp:', 'file:', 'chrome:', 'edge:'].includes(url.protocol)) return null;
        const title = site.title || site.name || url.hostname || '未命名书签';
        const host = url.hostname.replace(/^www\./, '') || '本地文件';
        const item = document.createElement('li');
        item.className = 'shortcut-item';
        const link = document.createElement('a');
        link.className = 'shortcut-card';
        link.href = url.href;
        link.title = `${title}\n${url.href}`;
        link.appendChild(ShortcutIcons.createSiteIcon(url));
        const name = document.createElement('span');
        name.className = 'shortcut-title';
        name.textContent = title;
        const domain = document.createElement('span');
        domain.className = 'shortcut-domain';
        domain.textContent = host;
        link.append(name, domain, ShortcutIcons.create('arrow-up-right', 'shortcut-open'));
        item.appendChild(link);
        return item;
    }

    render(sites, title) {
        const cards = sites.map(site => this.createCard(site)).filter(Boolean);
        this.heading.textContent = title;
        this.count.textContent = `${cards.length} 个网站`;
        this.container.removeAttribute('aria-busy');
        this.container.replaceChildren(...cards);
        if (!cards.length) this.renderEmpty('这个文件夹还没有网站', '在浏览器中将网站收藏到此文件夹，即可在这里快速访问。');
    }

    renderEmpty(title = '把常用网站，放在眼前', description = '选择书签文件夹，创建属于你的快捷访问空间。', choose = false) {
        this.container.removeAttribute('aria-busy');
        const item = document.createElement('li');
        item.className = 'shortcuts-empty';
        item.appendChild(ShortcutIcons.create('bookmark', 'empty-icon'));
        const heading = document.createElement('h3');
        heading.textContent = title;
        const text = document.createElement('p');
        text.textContent = description;
        item.append(heading, text);
        if (choose) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'choose-folders-btn';
            button.append(ShortcutIcons.create('plus'), document.createTextNode('选择书签文件夹'));
            button.addEventListener('click', this.onChooseFolders);
            item.appendChild(button);
        }
        this.container.replaceChildren(item);
    }

    showUnselected() {
        this.heading.textContent = '快捷访问';
        this.count.textContent = '从一个文件夹开始';
        this.renderEmpty(undefined, undefined, true);
    }

    showLoading(title) {
        this.heading.textContent = title;
        this.count.textContent = '正在加载';
        this.container.setAttribute('aria-busy', 'true');
        const item = document.createElement('li');
        item.className = 'shortcuts-loading';
        item.textContent = '正在读取书签…';
        this.container.replaceChildren(item);
    }
}
