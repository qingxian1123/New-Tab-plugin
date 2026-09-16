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

## Wallpaper

Open **个性化** to select a JPG, PNG, WebP, or AVIF image up to 6 MB. Existing wallpapers remain compatible. Wallpaper colors are preserved by default in both themes; the optional dim slider ranges from 0% to 60%. Text uses local contrast treatments instead of a full-page opaque overlay.

Uploads, dimming, and removal preview immediately and persist only on Save. Cancel or Escape restores the saved wallpaper. A failed upload or storage write displays an error without replacing the saved image.

## Development workflow

No build step or runtime package installation is needed.

```sh
node --test tests/*.test.cjs
node tests/preview.cjs
```

The preview is available at `http://127.0.0.1:4173`. It injects synthetic bookmark data only through the development server; the extension never loads these fixtures. Browser favicon-cache behavior must be checked in the loaded extension.

`shortcut-grid.js` owns cards, local icon selection, and empty/loading states. `main.js` owns storage, bookmark selection, settings, and page lifecycle.

`wallpaper.js` owns wallpaper drafts, image validation, preview rendering, and persistence. Visit `http://127.0.0.1:4173/?wallpaper` for a synthetic landscape fixture when checking wallpaper contrast.
