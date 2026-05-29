// Pure URL parsing + Azure DevOps REST/web URL builders.
// No DOM, no Chrome APIs — importable by the popup and by Node tests.

const WI_EDIT = /\/_workitems\/edit\/(\d+)/i;
const DEFAULT_COMMENTS_API = '7.1-preview.4';

/**
 * Parse an Azure DevOps work item URL (both host formats).
 *   https://{org}.visualstudio.com/{Project}/_workitems/edit/{id}
 *   https://dev.azure.com/{org}/{Project}/_workitems/edit/{id}
 * Returns null for any URL that is not a work-item edit page.
 */
export function parseAdoUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return null; }

  const idMatch = u.pathname.match(WI_EDIT);
  if (!idMatch) return null;
  const workItemId = parseInt(idMatch[1], 10);
  if (!Number.isFinite(workItemId)) return null;

  const host = u.hostname.toLowerCase();
  const segs = u.pathname.split('/').filter(Boolean).map(decodeSafe);

  let kind, org, project, orgBase;
  if (host.endsWith('.visualstudio.com')) {
    kind = 'visualstudio';
    org = host.split('.')[0];
    project = segs.length && segs[0] !== '_workitems' ? segs[0] : null;
    orgBase = u.origin; // org is the subdomain
  } else if (host === 'dev.azure.com' || host.endsWith('.dev.azure.com')) {
    kind = 'devazure';
    org = segs[0] || null;
    project = segs.length > 1 && segs[1] !== '_workitems' ? segs[1] : null;
    orgBase = org ? `${u.origin}/${encodeURIComponent(org)}` : u.origin;
  } else {
    return null; // not a recognized ADO host
  }
  if (!org) return null;

  return { host: kind, org, project, workItemId, origin: u.origin, orgBase };
}

function decodeSafe(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function restBase(info) {
  return info.project ? `${info.orgBase}/${encodeURIComponent(info.project)}` : info.orgBase;
}

/** REST endpoint for a work item's discussion comments (rendered HTML included). */
export function buildCommentsUrl(info, { top = 200, apiVersion = DEFAULT_COMMENTS_API } = {}) {
  return `${restBase(info)}/_apis/wit/workItems/${info.workItemId}/comments` +
    `?$top=${top}&$expand=renderedText&api-version=${apiVersion}`;
}

/** Web (browser) URL for a work item — used for the "View in Azure DevOps" / Parent links. */
export function buildWorkItemUrl(info, id = info.workItemId) {
  return `${restBase(info)}/_workitems/edit/${id}`;
}

export function buildParentUrl(info, parentId) {
  return buildWorkItemUrl(info, parentId);
}
