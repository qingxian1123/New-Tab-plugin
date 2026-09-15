# New Tab

A minimal Chrome new-tab extension with a clock, search, and a bookmark-backed shortcut grid.

## Load locally

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select this directory.
3. Open a new tab. Use the bottom **+** button to select bookmark folders.

Reload the extension after changing its files. This version requests the `bookmarks` and `favicon` permissions for folder contents and Chrome's cached website icons.

## Shortcut area

- Tabs stay at the bottom of the viewport; checking or unchecking folders stages changes until Save. Removing a tab does not delete browser bookmarks.
- Website cards contain a brand icon and title. The entire card is a keyboard-accessible link.
- Simple Icons SVGs cover common brands. Other sites use Chrome's favicon cache, with a Lucide globe as fallback. See [icon attribution](icon/README.md).
- The grid respects the desktop column setting and switches to four or three columns in smaller windows.
- Legacy saved shortcuts remain in local storage; no default speed-dial tab is added.

## Development

No build step or runtime package installation is needed.

```sh
node --test tests/shortcuts.test.cjs
node tests/preview.cjs
```

The preview is available at `http://127.0.0.1:4173`. It injects synthetic bookmark data only through the development server; the extension never loads these fixtures. Browser favicon-cache behavior must be checked in the loaded extension.

`shortcut-grid.js` owns cards, local icon selection, and empty/loading states. `main.js` owns storage, bookmark selection, settings, and page lifecycle.
