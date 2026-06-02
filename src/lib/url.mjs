// Pure URL parsing + Azure DevOps REST/web URL builders.
// No DOM, no Chrome APIs. Importable by the popup and by Node tests.

const WI_EDIT = /\/_workitems\/edit\/(\d+)/i;
const DEFAULT_COMMENTS_API = '7.1-preview.4';
const DEFAULT_WIT_API = '7.1';

/**
 * Parse an Azure DevOps URL and locate the open work item. Handles both host formats
 * and both ways a work item is opened:
 *   full page:  {org}.visualstudio.com/{Project}/_workitems/edit/{id}
 *               dev.azure.com/{org}/{Project}/_workitems/edit/{id}
 *   dialog:     any hub (Sprints/Boards/Backlogs/Queries) with ?...&workitem={id}
 * Returns null when the host is not ADO or no work item is open.
 */
export function parseAdoUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return null; }

  const host = u.hostname.toLowerCase();
  const segs = u.pathname.split('/').filter(Boolean).map(decodeSafe);

  let kind, org, project, orgBase;
  if (host.endsWith('.visualstudio.com')) {
    kind = 'visualstudio';
    org = host.split('.')[0];
    project = segs.length && !segs[0].startsWith('_') ? segs[0] : null; // _workitems/_boards/_sprints/... are hubs, not projects
    orgBase = u.origin; // org is the subdomain
  } else if (host === 'dev.azure.com') { // exact only; ADO serves work items from the bare host (org is in the path)
    kind = 'devazure';
    org = segs[0] || null;
    project = segs.length > 1 && !segs[1].startsWith('_') ? segs[1] : null; // _workitems/_boards/_sprints/... are hubs, not projects
    orgBase = org ? `${u.origin}/${encodeURIComponent(org)}` : u.origin;
  } else {
    return null; // not a recognized ADO host
  }
  if (!org) return null;

  // Work item id: full-page edit path wins; otherwise the dialog/peek `workitem` param.
  let workItemId = null;
  let view = null;
  const editMatch = u.pathname.match(WI_EDIT);
  if (editMatch) {
    workItemId = parseInt(editMatch[1], 10);
    view = 'fullpage';
  } else {
    const wi = u.searchParams.get('workitem');
    if (wi && /^\d+$/.test(wi)) {
      workItemId = parseInt(wi, 10);
      view = 'dialog';
    }
  }
  if (!Number.isFinite(workItemId)) return null;

  return { host: kind, org, project, workItemId, origin: u.origin, orgBase, view };
}

function decodeSafe(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function projectBase(info) {
  return info.project ? `${info.orgBase}/${encodeURIComponent(info.project)}` : info.orgBase;
}

/** REST: get the work item with all fields + relations (org-scoped; project not required). */
export function buildWorkItemRestUrl(info, id = info.workItemId, { apiVersion = DEFAULT_WIT_API } = {}) {
  return `${info.orgBase}/_apis/wit/workitems/${id}?$expand=all&api-version=${apiVersion}`;
}

/** REST: list field definitions (referenceName -> name + type). Org-scoped. */
export function buildFieldsUrl(info, { apiVersion = DEFAULT_WIT_API } = {}) {
  return `${info.orgBase}/_apis/wit/fields?api-version=${apiVersion}`;
}

/**
 * REST: a work item's discussion comments (rendered HTML included).
 * PROJECT-scoped: unlike the work-items and fields endpoints, the ADO comments API
 * requires the project in the path
 * (`{org}/{project}/_apis/wit/workItems/{id}/comments`); calling it org-scoped returns
 * 404. `info.project` comes from the tab URL and is present for full-page and
 * board/sprint/backlog/query views. (If no project can be determined this falls back to
 * org-scoped and comments will be unavailable, which the popup reports.)
 */
export function buildCommentsUrl(info, { top = 200, apiVersion = DEFAULT_COMMENTS_API } = {}) {
  return `${projectBase(info)}/_apis/wit/workItems/${info.workItemId}/comments` +
    `?$top=${top}&$expand=renderedText&api-version=${apiVersion}`;
}

/** Web (browser) URL for a work item, used for the "View in Azure DevOps" / Parent links. */
export function buildWorkItemUrl(info, id = info.workItemId) {
  return `${projectBase(info)}/_workitems/edit/${id}`;
}

export function buildParentUrl(info, parentId) {
  return buildWorkItemUrl(info, parentId);
}
