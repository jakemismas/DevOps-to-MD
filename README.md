# DevOps → Markdown

A Chrome (Manifest V3) extension that converts an **Azure DevOps work item** into clean, formatted **Markdown** you can copy to your clipboard and paste anywhere.

Click the toolbar icon on a work item, pick which sections to include (gear icon), press **Generate**, and copy the result. Your section choices are remembered per Azure DevOps organization.

It works whether the work item is opened **full-page** (`/_workitems/edit/{id}`) or as a **dialog / side panel** from a Boards card, Sprints taskboard, Backlog, or Query (the tab URL stays on the hub with `?workitem={id}`).

## What it copies

The Markdown output starts with the work item number and title:

```
# 470134: Navigate to PriceFx within Salesforce App
[View in Azure DevOps](https://dartcontainer.visualstudio.com/.../_workitems/edit/470134)
```

Then each section you selected (User Story or Problem Statement, Description, Acceptance Criteria, Security Requirements, Development Instructions, Test Scenarios, Deployment Instructions, etc.), followed by an optional **Discussion** section listing every comment with its author and date, and an optional **Parent** line (the parent work item id).

- Rich-text (HTML) fields are converted to GitHub-flavored Markdown.
- Fields that Azure DevOps already stores as Markdown are passed through unchanged (no double-conversion).
- The parent id is read from the work item's own data (`System.Parent`); the cross-origin "Parent Details" iframe is never accessed.
- Comments are fetched through your existing signed-in session (no Personal Access Token needed).
- Inline images stored as Azure DevOps attachments become a labeled link (e.g. `[image: shot.png (Azure DevOps attachment, requires sign-in)](...)`) rather than an embedded image, because those URLs only load inside your authenticated session and would otherwise paste as broken images.

## Behavior notes

- **First run on a new org:** nothing is pre-selected. Open the gear, tick the sections you want, press Generate. Choices persist per org.
- **Return visits:** your saved choices are restored. Sections that newly appear on a ticket show up unchecked, so the output never changes silently.
- **Empty selected sections** render a `_(empty)_` placeholder so your scaffold is always present (full-page view). In the dialog/side-panel view the gear lists only the content sections that actually have text, since the page does not expose the empty ones.
- **Section data is always read live** from Azure DevOps when you open the popup, so navigating between work items in-page (SPA) never needs a page reload.

## Install

### From the Chrome Web Store

Published listing: _(pending review; the link will be added here once it is live)_

### Load unpacked (development)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
4. Pin the extension, open an Azure DevOps work item, and click the icon.

To apply code changes, click the **reload** (↻) icon on the extension card in `chrome://extensions`.

## Privacy and permissions

`activeTab`, `scripting`, `storage` only. No broad host permissions, no remote code, no telemetry. All processing happens on your machine; the only network requests go to your own Azure DevOps organization using your existing signed-in session (no Personal Access Token). Only your per-organization section choices are stored (`chrome.storage`); no work item content is ever stored or transmitted. Full details: [PRIVACY.md](PRIVACY.md).

## Development

Pure logic (URL parsing, data extraction, section detection, Markdown assembly, preferences) lives in DOM-free ES modules under `src/lib/` so it can be unit-tested in Node with no browser.

```bash
npm install           # dev-only: turndown (+ gfm) for the conversion test
npm test              # full suite + vendored-library integrity check
npm run test:unit     # zero-dependency tests only (no npm install needed)
npm run verify:vendor # confirm vendored Turndown matches its pinned SHA-256
```

To build the Chrome Web Store upload zip (runtime files only, manifest at the root) and
the optional promo image (Windows/PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File tools/package.ps1    # -> build/devops-to-md-<version>.zip
powershell -ExecutionPolicy Bypass -File tools/gen-promo.ps1  # -> build/promo-440x280.png
```

Tests run against a real saved work item page (`test/fixtures/workitem-470134.html`). A provenance gate (`test/fixture-provenance.test.mjs`) fails loudly if the fixture is missing or wrong, so test expectations can never silently pass against bad data.

The HTML→Markdown library (Turndown + GFM plugin) is vendored under `vendor/` as local files (MV3 forbids remote code); the `npm`-installed copy is used only by the conversion test (Turndown runs natively in Node). `test/manual-test.html` lets you verify the exact shipped build in a browser.

## Project layout

```
manifest.json            MV3 manifest
src/popup.html|css|js     popup UI + controller
src/harvester.js          injected page reader (DOM + authenticated comments fetch)
src/lib/*.mjs             pure, testable logic
vendor/                   vendored Turndown + GFM plugin (+ VENDOR.md provenance)
icons/                    toolbar icons
tools/                    icon/promo generators, packager, vendor-integrity check
test/                     Node tests + real-page fixture
LICENSE, PRIVACY.md       MIT license + privacy policy
STORE_LISTING.md          paste-ready Chrome Web Store copy (maintainer)
```

## License

MIT - see [LICENSE](LICENSE). The bundled Turndown and turndown-plugin-gfm libraries are
also MIT licensed; provenance and checksums are in [vendor/VENDOR.md](vendor/VENDOR.md).
