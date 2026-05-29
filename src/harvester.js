// Injected into the Azure DevOps page via chrome.scripting.executeScript({func: harvest}).
//
// IMPORTANT: this function is serialized and runs in the page (ISOLATED world). It must
// be FULLY SELF-CONTAINED (no imports, no references to module-scope variables). All
// inputs arrive via `args`. It returns plain JSON (executeScript awaits the Promise).
//
// Data sources, in order of preference (the popup picks which to use):
//   - REST work item ($expand=all) by id + a trimmed wit/fields list, fetched with the
//     user's existing session cookies (same-origin, credentials:'include', no PAT). This
//     is the primary path and works for full page AND dialog/side-panel.
//   - The embedded #dataProviders blob (read from the DOM) supplies the form layout for
//     nice section ordering + empty sections on full pages, and is a values fallback if
//     REST fails. On hub pages (taskboard/boards) it does not contain the opened item.
//   - Comments come from the REST comments endpoint (paged, with an api-version fallback).
// The comment paging loop mirrors src/lib/comments.mjs:fetchAllComments.

export async function harvest(args) {
  const opts = args || {};
  const WI_PROVIDER = 'ms.vss-work-web.work-item-data-provider';
  const PFD_KEY = 'ms.vss-work-web.work-item-project-field-data';
  const TD_KEY = 'ms.vss-work-web.work-item-type-data';
  const result = {
    ok: true,
    embeddedWorkItemId: null,
    embedded: null,            // { workItemData, projectFieldData, typeData } | null
    rest: null,                // { workItem: { id, fields, relations }, fieldDefs: [...] } | null
    comments: [],
    commentsTruncated: false,
    commentsAttempted: false,
    errors: [],
  };

  const getJson = async (url) => {
    const resp = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
    return { ok: resp.ok, status: resp.status, body: resp.ok ? await resp.json() : null };
  };
  const withToken = (base, token) =>
    base + (base.indexOf('?') >= 0 ? '&' : '?') + 'continuationToken=' + encodeURIComponent(token);

  try {
    // 1) Embedded blob (form layout + values fallback). Present on full-page loads only.
    try {
      const el = document.getElementById('dataProviders');
      if (el && el.textContent) {
        const root = JSON.parse(el.textContent);
        const data = (root && root.data) || {};
        const dp = data[WI_PROVIDER];
        if (dp) {
          result.embeddedWorkItemId = dp['work-item-id'] != null ? dp['work-item-id'] : null;
          result.embedded = {
            workItemData: dp['work-item-data'] || null,
            projectFieldData: dp['work-item-project-field-data'] || data[PFD_KEY] || null,
            typeData: dp['work-item-type-data'] || data[TD_KEY] || null,
          };
        }
      }
    } catch (e) {
      result.errors.push('embedded:' + (e && e.message));
    }

    // 2) REST work item ($expand=all) + trimmed field definitions (primary).
    if (opts.restWorkItemUrl) {
      try {
        const r = await getJson(opts.restWorkItemUrl);
        if (r.ok && r.body) {
          const workItem = {
            id: r.body.id,
            fields: r.body.fields || {},
            relations: Array.isArray(r.body.relations) ? r.body.relations : [],
          };
          let fieldDefs = [];
          if (opts.fieldsUrl) {
            try {
              const fr = await getJson(opts.fieldsUrl);
              if (fr.ok && fr.body && Array.isArray(fr.body.value)) {
                fieldDefs = fr.body.value
                  .filter((f) => f && f.referenceName &&
                    Object.prototype.hasOwnProperty.call(workItem.fields, f.referenceName))
                  .map((f) => ({ referenceName: f.referenceName, name: f.name, type: f.type }));
              } else {
                result.errors.push('fields:http:' + fr.status);
              }
            } catch (e) {
              result.errors.push('fields:fetch:' + (e && e.message));
            }
          }
          result.rest = { workItem, fieldDefs };
        } else {
          result.errors.push('workitem:http:' + r.status);
        }
      } catch (e) {
        result.errors.push('workitem:fetch:' + (e && e.message));
      }
    }

    // 3) Comments (paged), only when requested.
    if (opts.needComments && opts.commentsUrl) {
      result.commentsAttempted = true;
      const max = opts.maxPages || 10;
      const candidates = [opts.commentsUrl];
      if (opts.commentsUrl.indexOf('7.1-preview.4') >= 0) {
        candidates.push(opts.commentsUrl.replace('7.1-preview.4', '7.0-preview.3'));
      }

      let base = null;
      let token = null;
      for (const cand of candidates) {
        try {
          const r = await getJson(cand);
          if (r.ok) {
            base = cand;
            if (r.body && Array.isArray(r.body.comments)) {
              for (const c of r.body.comments) result.comments.push(c);
            }
            token = r.body && r.body.continuationToken;
            break;
          }
          result.errors.push('comments:http:' + r.status);
        } catch (e) {
          result.errors.push('comments:fetch:' + (e && e.message));
        }
      }

      let pages = 1;
      while (base && token) {
        if (pages >= max) { result.commentsTruncated = true; break; }
        try {
          const r = await getJson(withToken(base, token));
          if (!r.ok) { result.errors.push('comments:http:' + r.status); break; }
          pages++;
          if (r.body && Array.isArray(r.body.comments)) {
            for (const c of r.body.comments) result.comments.push(c);
          }
          token = r.body && r.body.continuationToken;
        } catch (e) {
          result.errors.push('comments:fetch:' + (e && e.message));
          break;
        }
      }
    }
  } catch (e) {
    result.ok = false;
    result.errors.push('fatal:' + (e && e.message));
  }

  return result;
}
