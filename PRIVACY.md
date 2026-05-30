# Privacy Policy - DevOps to Markdown

Last updated: 2026-05-30

DevOps to Markdown is a Chrome extension that converts the Azure DevOps work item
you are currently viewing into Markdown text for your clipboard. This policy explains
exactly what the extension does and does not do with data.

## Summary

The extension does not have a server. It does not collect, transmit, sell, or share your
data with the developer or any third party. All processing happens locally in your
browser. The only network requests the extension makes go to your own Azure DevOps
organization, to read the work item you are already looking at.

## What the extension accesses

- **Work item content from your active tab.** When you click the extension on an Azure
  DevOps work item and press Generate, it reads that work item's fields (for example User
  Story, Description, Acceptance Criteria), its parent work item id, and, if you select
  the Discussion section, its comments (including comment author display names). This is
  read from the page and from your Azure DevOps organization's REST API using your
  existing signed-in session. The extension never asks for or stores a Personal Access
  Token or password.
- **The active tab's URL.** Used only to detect your Azure DevOps organization, project,
  and the open work item id, and to build the links in the output.

## What the extension stores

- **Your section selections.** Which sections you choose to include are saved as on/off
  values using Chrome's `storage` API, keyed by your Azure DevOps organization name (for
  example `dartcontainer`). If Chrome Sync is enabled on your browser, these preference
  values sync to your Google account like other extension settings. No work item content,
  titles, comments, field values, or personal data are ever stored or synced.

## Where data goes

- Generated Markdown is shown in the extension popup and copied to your clipboard only
  when you choose to copy it.
- Network requests are made only to your Azure DevOps organization
  (`*.visualstudio.com` or `dev.azure.com`), using your browser's existing session. No
  data is ever sent to the developer, to analytics, or to any other third party. The
  extension contains no telemetry and no remote code.

## Data sale and transfer

We do not sell your data. We do not transfer your data to third parties. We do not use
your data for any purpose unrelated to the single purpose described below, and not for
creditworthiness or lending.

## Limited Use disclosure

DevOps to Markdown's use of information received from Azure DevOps, and any other user
data it handles, adheres to the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use),
including the Limited Use requirements. The extension's single purpose is to convert the
Azure DevOps work item you are viewing into Markdown for your clipboard, and user data is
used only to provide that feature, on your device.

## Permissions and why they are needed

- **activeTab** - lets the extension read the Azure DevOps work item in the tab you
  explicitly clicked it on, only at that moment. No standing access to any site.
- **scripting** - lets the extension run its reader on that one tab to extract the work
  item and call the Azure DevOps API in your session.
- **storage** - saves your per-organization section selections so they persist between
  uses.

The extension requests no broad host permissions.

## Contact

Questions about this policy: Jake Mismas, jake@jakemismas.com

Source code: https://github.com/jakemismas/DevOps-to-MD
