// Injected into the Azure DevOps page via chrome.scripting.executeScript({func: harvest}).
//
// IMPORTANT: this function is serialized and runs in the page (ISOLATED world). It must
// be FULLY SELF-CONTAINED — no imports, no references to module-scope variables. All
// inputs arrive via `args`. It returns plain JSON (executeScript awaits the Promise).
//
// It reads the embedded #dataProviders blob (DOM) and, when asked, fetches the work
// item's discussion comments with the user's existing session cookies (same-origin
// fetch, credentials:'include' — no PAT). The comment paging loop mirrors
// src/lib/comments.mjs:fetchAllComments (kept in sync deliberately); it also falls back
// across API versions if the preview version is rejected.

export async function harvest(args) {
  const opts = args || {};
  const WI_PROVIDER = 'ms.vss-work-web.work-item-data-provider';
  const result = {
    ok: true,
    embedded: null,
    embeddedWorkItemId: null,
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
    const el = document.getElementById('dataProviders');
    if (el && el.textContent) {
      try {
        const root = JSON.parse(el.textContent);
        const dp = root && root.data && root.data[WI_PROVIDER];
        if (dp) {
          result.embedded = dp;
          result.embeddedWorkItemId = dp['work-item-id'] != null ? dp['work-item-id'] : null;
        } else {
          result.errors.push('missing:work-item-data-provider');
        }
      } catch (e) {
        result.errors.push('parse:dataProviders:' + (e && e.message));
      }
    } else {
      result.errors.push('missing:dataProviders');
    }

    if (opts.needComments && opts.commentsUrl) {
      result.commentsAttempted = true;
      const max = opts.maxPages || 10;
      const candidates = [opts.commentsUrl];
      if (opts.commentsUrl.indexOf('7.1-preview.4') >= 0) {
        candidates.push(opts.commentsUrl.replace('7.1-preview.4', '7.0-preview.3'));
      }

      // Establish a working base URL using the first page.
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

      // Page the rest.
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
