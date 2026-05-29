// Per-organization section-selection preferences. Pure logic; the popup wraps
// chrome.storage around storageKeyForOrg(). No DOM, no Chrome APIs here.

export const STORAGE_NS = 'adoMd:sections';

export function storageKeyForOrg(org) {
  return `${STORAGE_NS}:${String(org || '').toLowerCase()}`;
}

/**
 * Merge stored selections with the sections detected on this ticket.
 *   stored:   { [slug]: boolean } | undefined
 *   detected: [{ slug, ... }]
 * Known slugs keep their stored value. Unknown slugs default OFF and are flagged
 * "new" (so the gear can badge them and output never changes silently). The popup
 * persists the merged map after rendering, so a slug is "new" exactly once.
 */
export function mergeSelections(stored, detected) {
  const selections = {};
  const newSlugs = new Set();
  const known = stored && typeof stored === 'object' ? stored : null;
  for (const section of detected || []) {
    const slug = section.slug;
    if (known && Object.prototype.hasOwnProperty.call(known, slug)) {
      selections[slug] = !!known[slug];
    } else {
      selections[slug] = false;
      newSlugs.add(slug);
    }
  }
  return { selections, newSlugs };
}

export function selectionsForStorage(selections) {
  const out = {};
  for (const k of Object.keys(selections || {})) out[k] = !!selections[k];
  return out;
}
