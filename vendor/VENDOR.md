# Vendored libraries

Local copies are required because Manifest V3 forbids loading remote code. These
files are loaded by `src/popup.html` as classic `<script>` tags and expose globals
that `popup.js` reads.

| File | Source package (path) | Version | Global | License |
|------|-----------------------|---------|--------|---------|
| `turndown.umd.js` | `turndown` (`lib/turndown.browser.umd.js`) | 7.2.4 | `window.TurndownService` | MIT |
| `turndown-plugin-gfm.umd.js` | `turndown-plugin-gfm` (`dist/turndown-plugin-gfm.js`) | 1.0.2 | `window.turndownPluginGfm` | MIT |

## Integrity (SHA-256)

These are pinned and checked by `npm run verify:vendor` (`tools/verify-vendor.mjs`). The
files are byte-identical to the npm builds above; any drift fails the check.

```
cdf933e0a2085df3c64d6c763331f04345f6c3b25746216e8f1426c9c5253045  vendor/turndown.umd.js
cf744cc1b7580f06d64ce236a4ff2630a53d389eccf2133a09d71ca443511912  vendor/turndown-plugin-gfm.umd.js
```

## Updating

```bash
npm install turndown@<ver> turndown-plugin-gfm@<ver>
cp node_modules/turndown/lib/turndown.browser.umd.js   vendor/turndown.umd.js
cp node_modules/turndown-plugin-gfm/dist/turndown-plugin-gfm.js vendor/turndown-plugin-gfm.umd.js
# update the SHA-256 values above + in tools/verify-vendor.mjs to the new files' hashes
npm test                # conversion test must still pass
npm run verify:vendor   # integrity check must pass
```

Then open `test/manual-test.html` in a browser and confirm the shipped build still
converts sample HTML correctly.
