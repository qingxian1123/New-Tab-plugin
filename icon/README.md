# Bundled icon assets

Only the SVGs used by this extension are included. No CDN is required at runtime.

- `brands/`: [Simple Icons](https://github.com/simple-icons/simple-icons), version **16.31.0**, CC0-1.0. SVGs are unchanged; brand colors are applied by the card component. See `brands/LICENSE.md`.
- `lucide/`: [Lucide Static](https://github.com/lucide-icons/lucide), version **1.46.0**, ISC. See `lucide/LICENSE`.

Official source archives:

- https://registry.npmjs.org/simple-icons/-/simple-icons-16.31.0.tgz
- https://registry.npmjs.org/lucide-static/-/lucide-static-1.46.0.tgz

Brand names and logos remain the property of their respective owners.

Add domain mappings in `shortcut-grid.js` and copy the corresponding SVG into `brands/` when extending the catalog. Domain matching includes subdomains and enforces a dot boundary.
