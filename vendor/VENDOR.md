# Vendored libraries

Local copies are required because Manifest V3 forbids loading remote code. These
files are loaded by `src/popup.html` as classic `<script>` tags and expose globals
that `popup.js` reads.

| File | Source package (path) | Version | Global | License |
|------|-----------------------|---------|--------|---------|
| `turndown.umd.js` | `turndown` (`lib/turndown.browser.umd.js`) | 7.2.4 | `window.TurndownService` | MIT |
| `turndown-plugin-gfm.umd.js` | `turndown-plugin-gfm` (`dist/turndown-plugin-gfm.js`) | 1.0.2 | `window.turndownPluginGfm` | MIT |

## Updating

```bash
npm install turndown@<ver> turndown-plugin-gfm@<ver>
cp node_modules/turndown/lib/turndown.browser.umd.js   vendor/turndown.umd.js
cp node_modules/turndown-plugin-gfm/dist/turndown-plugin-gfm.js vendor/turndown-plugin-gfm.umd.js
npm test            # conversion test must still pass
```

Then open `test/manual-test.html` in a browser and confirm the shipped build still
converts sample HTML correctly.
