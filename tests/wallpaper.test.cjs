const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(initial = {}) {
    const element = () => ({ style: { values: {}, setProperty(k, v) { this.values[k] = v; } }, classList: { toggle() {} }, listeners: {}, addEventListener(k, fn) { this.listeners[k] = fn; } });
    const nodes = new Map();
    const document = { body: element(), documentElement: element(), getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); } };
    const data = { ...initial };
    const writes = [];
    const storage = { get: async () => data, set: async next => { writes.push(next); Object.assign(data, next); } };
    const readers = [];
    class FileReader { constructor() { readers.push(this); } readAsDataURL() {} }
    class Image { set src(value) { this.onload(); } }
    const context = vm.createContext({ document, chrome: { storage: { local: storage } }, FileReader, Image });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../wallpaper.js'), 'utf8') + '\nglobalThis.wallpaper = new WallpaperController();', context);
    const controller = context.wallpaper;
    controller.bind();
    return { controller, data, writes, storage, readers, document };
}

test('existing wallpapers load without the old overlay and clamp invalid dim values', async () => {
    const { controller, document } = setup({ customBackground: "url('data:image/png;base64,old')" });
    await controller.load();
    assert.equal(controller.saved.dim, 0);
    assert.equal(document.documentElement.style.values['--wallpaper-dim'], '0');
    assert.equal(controller.normalizeDim(-5), 0);
    assert.equal(controller.normalizeDim(99), 60);
});

test('dim and removal are drafts; cancel restores the original image and opacity', async () => {
    const { controller, writes, document } = setup({ customBackground: 'url(old)', wallpaperDim: 12 });
    await controller.load();
    controller.begin();
    controller.dim.value = 45;
    controller.dim.listeners.input();
    assert.equal(controller.draft.dim, 45);
    controller.remove.listeners.click();
    assert.equal(controller.draft.image, '');
    assert.equal(writes.length, 0);
    controller.cancel();
    assert.equal(document.documentElement.style.values['--bg-image'], 'url(old)');
    assert.equal(document.documentElement.style.values['--wallpaper-dim'], '0.12');
});

test('save persists changes across reload, including wallpaper removal', async () => {
    const { controller, data } = setup({ customBackground: 'url(old)' });
    await controller.load();
    controller.begin();
    controller.draft = { image: 'url(new)', dim: 20 };
    await controller.save();
    controller.cancel();
    await controller.load();
    assert.equal(controller.saved.image, 'url(new)');
    assert.equal(controller.saved.dim, 20);
    controller.begin();
    controller.remove.listeners.click();
    await controller.save();
    assert.equal(data.customBackground, '');
    assert.equal(data.wallpaperDim, 0);
});

test('failed writes retain the draft and the last saved wallpaper', async () => {
    const { controller, storage } = setup({ customBackground: 'url(old)' });
    await controller.load();
    controller.begin();
    controller.draft.image = 'url(new)';
    storage.set = async () => { throw new Error('quota'); };
    await assert.rejects(controller.save(), /quota/);
    assert.equal(controller.saved.image, 'url(old)');
    assert.equal(controller.draft.image, 'url(new)');
});

test('invalid uploads are rejected and an upload finishing after cancellation cannot change the background', async () => {
    const { controller, readers, document } = setup();
    await controller.load();
    controller.begin();
    await controller.selectFile({ type: 'text/plain', size: 10 });
    assert.match(controller.error.textContent, /请选择/);
    await controller.selectFile({ type: 'image/png', size: 7 * 1024 * 1024 });
    assert.match(controller.error.textContent, /超过/);
    const pending = controller.selectFile({ type: 'image/png', size: 10 });
    controller.cancel();
    readers[0].result = 'data:image/png;base64,test';
    readers[0].onload();
    await pending;
    assert.equal(document.documentElement.style.values['--bg-image'], 'none');
    assert.equal(controller.busy, false);
});
