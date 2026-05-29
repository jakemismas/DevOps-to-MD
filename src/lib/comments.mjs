// Normalize Azure DevOps REST comment payloads + a pure, testable paging loop.
// (harvester.js inlines an equivalent loop because injected functions must be
// fully self-contained; keep the two in sync.)

/** Accepts a REST page object ({comments:[...]}) or a raw comment array. */
export function normalizeComments(input) {
  const raw = Array.isArray(input)
    ? input
    : (input && Array.isArray(input.comments) ? input.comments : []);
  return raw
    .filter(c => c && c.isDeleted !== true)
    .map(c => ({
      author: (c.createdBy && c.createdBy.displayName) || 'Unknown',
      date: c.createdDate || c.modifiedDate || null,
      html: c.renderedText || c.text || '',
      text: c.text || '',
    }));
}

/**
 * Page through the comments endpoint until there is no continuationToken.
 * fetchJson(url) must resolve to a parsed JSON page. Bounded by maxPages.
 * Returns a flat array of raw comment objects. The second return value flags truncation.
 */
export async function fetchAllComments(fetchJson, firstUrl, { maxPages = 10 } = {}) {
  const all = [];
  let url = firstUrl;
  let pages = 0;
  let truncated = false;
  while (url) {
    if (pages >= maxPages) { truncated = true; break; }
    const page = await fetchJson(url);
    pages++;
    if (page && Array.isArray(page.comments)) all.push(...page.comments);
    const token = page && page.continuationToken;
    if (!token) break;
    url = appendContinuation(firstUrl, token);
  }
  return { comments: all, truncated };
}

function appendContinuation(firstUrl, token) {
  const sep = firstUrl.includes('?') ? '&' : '?';
  return `${firstUrl}${sep}continuationToken=${encodeURIComponent(token)}`;
}
