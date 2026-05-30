# Chrome Web Store listing - paste-ready copy

This file is the source of truth for the Chrome Web Store Developer Dashboard fields.
It is for the maintainer; it is not shipped in the extension zip.

---

## Store icon
`icons/icon128.png` (128x128). Already in the package.

## Item name
DevOps to Markdown

## Summary (short description, max 132 chars)
Convert the Azure DevOps work item you are viewing into clean Markdown for your clipboard. Pick the sections, click, copy.

## Category
Developer Tools

## Language
English (United States)

## Detailed description (paste into "Description")
DevOps to Markdown turns the Azure DevOps work item you are looking at into clean,
formatted Markdown you can paste anywhere - a pull request, a doc, a chat, or notes.

How it works:
- Open any Azure DevOps work item, either full screen or in the side panel / dialog that
  opens from a Boards card, Sprints taskboard, backlog, or query.
- Click the DevOps to Markdown toolbar icon. It detects your organization automatically.
- Use the gear to choose which sections to include (User Story, Description, Acceptance
  Criteria, Test Scenarios, Deployment Instructions, Discussion, Parent, and more). Your
  choices are remembered per organization.
- Click Generate and copy the Markdown.

Details:
- Rich-text fields are converted to GitHub-flavored Markdown; fields already stored as
  Markdown pass through unchanged.
- The optional Discussion section includes every comment with its author and date.
- The optional Parent line links the parent work item by id.
- Inline Azure DevOps attachment images become a labeled link, because those images only
  load inside your signed-in session.

Privacy:
- No account, no Personal Access Token, no servers, no tracking. The extension reads the
  work item using your existing Azure DevOps session and does everything on your device.
  Nothing is sent to the developer or any third party. It is open source.

## Single purpose (paste into "Single purpose")
The single purpose of this extension is to convert the Azure DevOps work item the user is
currently viewing into Markdown text that the user can copy to their clipboard.

## Permission justifications (paste into each permission's justification box)

- activeTab:
  Used to read the Azure DevOps work item in the tab the user explicitly clicks the
  extension on, only at the moment of the click. The extension has no standing access to
  any site.

- scripting:
  Used to run a small reader on that single active tab to extract the open work item's
  fields and to call the Azure DevOps REST API within the user's existing session. No code
  is injected from remote sources.

- storage:
  Used to remember which sections the user chose to include, saved per Azure DevOps
  organization. Only on/off preference values are stored - never work item content.

- Host permissions: none requested.

- Remote code: No. The HTML-to-Markdown library (Turndown + GFM plugin, MIT) is bundled
  locally in the package; the content security policy is script-src 'self'.

## Data usage disclosures (the "Privacy practices" tab)

Declare that the extension handles these data types:
- "Website content" - it reads the work item content (fields and comments) from the
  user's Azure DevOps tab to produce the Markdown.
- "User activity" or "Personal communications" is NOT collected by the developer; comment
  text/author names are processed on-device only and never transmitted to us. If the form
  forces a category for comment authors, treat it as on-device processing of website
  content, not collection.

Certify the three required statements (all true for this extension):
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

Privacy policy URL (required, paste into "Privacy policy"):
https://github.com/jakemismas/DevOps-to-MD/blob/main/PRIVACY.md

## Distribution
- Visibility: Public (or Unlisted if you want to share by link only at first).
- Regions: All regions.
- This extension does not contain ads.

## Screenshots (you must capture these - see SUBMISSION steps)
- At least one 1280x800 PNG showing the popup over a real Azure DevOps work item.
- Optional small promo tile 440x280 (`build/promo-440x280.png` is generated for you).
