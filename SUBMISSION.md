# Publishing to the Chrome Web Store

Maintainer guide. Listing copy lives in [STORE_LISTING.md](STORE_LISTING.md); the privacy
policy is [PRIVACY.md](PRIVACY.md).

## What is already prepared in this repo

- Manifest is MV3, version `1.0.0`, least-privilege permissions, hardened CSP,
  `homepage_url` pointing at the repo.
- Icons (16/32/48/128) exist and are correct sizes.
- The upload zip is built by `tools/package.ps1` to `build/devops-to-md-1.0.0.zip`
  (runtime files only, `manifest.json` at the zip root, forward-slash paths). It was
  validated with `addons-linter` (see "Validation" below).
- An optional small promo tile (440x280) is generated to `build/promo-440x280.png` by
  `tools/gen-promo.ps1`.
- Privacy policy and all dashboard copy are written and ready to paste.

## One-time prerequisites

1. A Google account (use jake@jakemismas.com).
2. A Chrome Web Store developer account: pay the one-time **$5** registration fee at
   https://chrome.google.com/webstore/devconsole (covers up to 20 extensions).

## You must capture screenshots (Google requires at least one)

The store requires at least one **1280x800** PNG (up to 5). These must show the real UI,
so they have to be captured from the running extension:

1. Load the extension unpacked (see README) and open a real Azure DevOps work item.
2. Click the extension, open the gear, select a few sections, and Generate.
3. Capture the popup (and optionally the work item behind it). Produce a 1280x800 PNG
   (pad/scale a screenshot to exactly 1280x800; a solid background is fine).
4. Suggested set: (a) popup with the section gear open, (b) popup showing generated
   Markdown in the textarea, (c) optional: the same on a Sprints taskboard dialog.

Avoid showing confidential ticket content; use a sample/test work item.

## Steps to publish

1. Build the zip (if not already built):
   `powershell -ExecutionPolicy Bypass -File tools/package.ps1`
   Result: `build/devops-to-md-1.0.0.zip`.
2. Go to https://chrome.google.com/webstore/devconsole and click **Add new item**.
3. Upload `build/devops-to-md-1.0.0.zip`. Wait for it to process.
4. **Store listing** tab - fill from [STORE_LISTING.md](STORE_LISTING.md):
   - Item name, Summary, Detailed description, Category (Developer Tools), Language.
   - Upload the 128 icon if prompted (it is also inside the zip).
   - Upload your screenshot(s). Optionally upload `build/promo-440x280.png` as the small
     promo tile.
5. **Privacy practices** tab:
   - Single purpose: paste the single-purpose statement.
   - For each permission (`activeTab`, `scripting`, `storage`), paste the matching
     justification.
   - Data usage: declare "Website content" is handled; check the three certifications
     (no sale, single-purpose use only, not for creditworthiness).
   - Privacy policy URL: `https://github.com/jakemismas/DevOps-to-MD/blob/main/PRIVACY.md`
   - Remote code: select **No** (libraries are bundled locally).
6. **Distribution** tab: visibility Public (or Unlisted to start), all regions, not paid,
   no ads.
7. Click **Submit for review**. Review is typically 1-3 business days.

## After approval

1. Copy the public listing URL.
2. Add it to the README "From the Chrome Web Store" line, and set it as the GitHub repo
   homepage (`gh repo edit jakemismas/DevOps-to-MD --homepage <store-url>`), so the repo
   and the extension point at each other.
3. Optionally cut a GitHub release tagged `v1.0.0` and attach the zip.

## Validation (already run)

`addons-linter` (the standard static analyzer) was run against the zip:
`npx addons-linter --max-manifest-version=3 --min-manifest-version=3 build/devops-to-md-1.0.0.zip`

It found and we fixed one real packaging issue (zip path separators must be `/`). The only
remaining messages are **Firefox-AMO-specific** and do not apply to Chrome:
`ADDON_ID_REQUIRED` and the `storage.sync` notice both ask for
`browser_specific_settings.gecko.id` (a Firefox key), and `MISSING_DATA_COLLECTION_PERMISSIONS`
is a Firefox manifest key. Do **not** add `browser_specific_settings.gecko` to a
Chrome-only extension. Chrome's own validation runs server-side at upload.
