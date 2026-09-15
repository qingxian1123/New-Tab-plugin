const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

class Element {
    constructor(tag = 'div') {
        this.tagName = tag;
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.dataset = {};
        this.style = { setProperty() {} };
    }
    set innerHTML(value) { this.children = []; }
    appendChild(node) { this.children.push(node); return node; }
    append(...nodes) { this.children.push(...nodes); }
    prepend(node) { this.children.unshift(node); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(event, callback) { this.listeners[event] = callback; }
    remove() { this.removed = true; }
    close() {}
    showModal() {}
}

function setup() {
    const elements = new Map();
    const document = {
        getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
        createElement: tag => new Element(tag),
        createTextNode: text => ({ textContent: text }),
        addEventListener() {},
    };
    const writes = [];
    const chrome = { storage: { local: { async set(value) { writes.push(value); } } }, runtime: { getURL: pathname => `chrome-extension://test${pathname}` } };
    const context = vm.createContext({ document, chrome, console, URL, Map });
    vm.runInContext(fs.readFileSync(path.join(root, 'shortcut-grid.js'), 'utf8') + '\nglobalThis.icons = ShortcutIcons; globalThis.Grid = ShortcutGrid;', context);
    vm.runInContext(fs.readFileSync(path.join(root, 'main.js'), 'utf8') + '\nglobalThis.app = App;', context);
    const grid = new context.Grid(new Element('ul'), new Element('h1'), new Element(), () => {});
    context.app.grid = grid;
    return { ...context, grid, writes };
}

test('brand matching recognizes subdomains without matching lookalike domains; all assets are bundled', () => {
    const { icons } = setup();
    assert.equal(icons.findBrand('docs.github.com')[0], 'github');
    assert.equal(icons.findBrand('notgithub.com'), undefined);
    assert.equal(icons.findBrand('github.com.example.org'), undefined);
    for (const [slug] of Object.values(icons.brands)) assert.ok(fs.existsSync(path.join(root, 'icon/brands', slug + '.svg')));
    for (const name of ['globe', 'arrow-up-right', 'bookmark', 'plus', 'folder']) assert.ok(fs.existsSync(path.join(root, 'icon/lucide', name + '.svg')));
});

test('cards retain full names and destinations, reject executable and malformed URLs, and count visible sites', () => {
    const { grid } = setup();
    grid.render([
        { title: '<img onerror=alert(1)>', url: 'https://github.com/path?q=1' },
        { title: 'Invalid', url: 'broken' },
        { title: 'Script', url: 'javascript:alert(1)' },
        { title: 'Data', url: 'data:text/html,test' },
        { title: 'Local', url: 'file:///C:/notes.html' },
    ], '工作');
    assert.equal(grid.container.children.length, 2);
    assert.equal(grid.count.textContent, '2 个网站');
    const link = grid.container.children[0].children[0];
    assert.equal(link.href, 'https://github.com/path?q=1');
    assert.equal(link.children[1].textContent, '<img onerror=alert(1)>');
    assert.equal(link.tagName, 'a');
});

test('generic icon survives failed favicon loading; empty and unselected states remain actionable', () => {
    const { grid, icons, document } = setup();
    const images = [];
    const original = document.createElement;
    document.createElement = tag => { const node = original(tag); if (tag === 'img') images.push(node); return node; };
    const badge = icons.createSiteIcon(new URL('https://example.org/private/path'));
    assert.match(images[0].src, /pageUrl=https%3A%2F%2Fexample.org/);
    assert.ok(!images[0].src.includes('private'));
    images[0].onerror();
    assert.equal(badge.children.length, 1);
    grid.showLoading('工作');
    grid.render([], '工作');
    assert.equal(grid.count.textContent, '0 个网站');
    assert.equal(grid.container.attributes['aria-busy'], undefined);
    grid.showUnselected();
    assert.equal(grid.container.children[0].children.at(-1).tagName, 'button');
});

test('folder changes are staged until save; removing the active tab chooses a remaining tab or empty state', async () => {
    const { app, document, writes } = setup();
    app.state.bookmarkTabs = [{ id: '1', title: 'Work' }, { id: '2', title: 'Life' }];
    app.state.activeTab = '1';
    app.state.selectedFolders = new Map(app.state.bookmarkTabs.map(tab => [tab.id, tab]));
    app.renderFolderTree([{ id: '1', title: 'Work', children: [] }]);
    const checkbox = app.elements.folderTree.children[0].children[0].children[0];
    checkbox.checked = false;
    checkbox.listeners.change();
    assert.equal(app.state.bookmarkTabs.length, 2);
    assert.equal(writes.length, 0);
    app.loadBookmarkFolder = async () => {};
    app.bindEvents();
    const save = document.getElementById('folder-picker-save-btn').listeners.click;
    await save();
    assert.equal(app.state.activeTab, '2');
    assert.equal(app.elements.tabBar.children[0].children.length, 1);
    app.state.selectedFolders.clear();
    await save();
    assert.equal(app.state.activeTab, null);
    assert.equal(app.elements.tabBar.children.length, 1);
});

test('a slow response from the previous folder cannot overwrite the active folder', async () => {
    const { app, chrome, grid } = setup();
    let resolveOld;
    chrome.bookmarks = { getChildren: id => id === 'old' ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve([{title: 'New', url: 'https://figma.com'}]) };
    app.state.bookmarkTabs = [{id: 'old', title: 'Old'}, {id: 'new', title: 'New'}];
    app.state.activeTab = 'old';
    const oldRequest = app.loadBookmarkFolder('old');
    app.state.activeTab = 'new';
    await app.loadBookmarkFolder('new');
    resolveOld([{title: 'Old', url: 'https://github.com'}]);
    await oldRequest;
    assert.equal(grid.heading.textContent, 'New');
    assert.equal(grid.container.children[0].children[0].href, 'https://figma.com/');
});
