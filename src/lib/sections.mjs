// Derive the ordered list of selectable "sections" from the work item form layout,
// then append synthetic Parent + Discussion sections. No DOM, no Chrome APIs.
import { getFormLayout, getFieldIndexByRef } from './dataproviders.mjs';

const HTML_FIELD_TYPE = 7; // long-text / HTML field
export const PARENT_SLUG = '__parent__';
export const DISCUSSION_SLUG = '__discussion__';

export function slugifyLabel(label) {
  return String(label).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A group qualifies as a content section if it has >=1 visible control that
 * resolves to a long-text/HTML field (type 7). Contribution controls (e.g. the
 * cross-origin Parent Details iframe) have no field referenceName and are skipped,
 * as are hidden groups/controls and non-details pages (History/Links/etc.).
 * Returns [{ slug, label, fieldRefs, present, synthetic:null }] in render order.
 */
export function buildSectionList(providers, model) {
  const layout = getFormLayout(providers);
  const byRef = getFieldIndexByRef(providers);
  const out = [];
  if (!layout || !Array.isArray(layout.pages)) return out;

  for (const page of layout.pages) {
    if (!page || page.isContribution) continue;
    if (page.pageType != null && page.pageType !== 1) continue; // 1 = the editable details page
    for (const section of page.sections || []) {
      for (const group of section.groups || []) {
        if (!group || group.visible === false || group.isContribution) continue;
        const fieldRefs = [];
        for (const control of group.controls || []) {
          if (!control || control.visible === false || control.isContribution) continue;
          const def = byRef[control.id];
          if (def && def.type === HTML_FIELD_TYPE) fieldRefs.push(control.id);
        }
        if (fieldRefs.length === 0) continue;
        const first = model.fields[fieldRefs[0]];
        const label = group.label || (first && first.label) || fieldRefs[0];
        out.push({
          slug: slugifyLabel(label),
          label,
          fieldRefs,
          present: fieldRefs.some(ref => model.fields[ref] && model.fields[ref].present),
          synthetic: null,
        });
      }
    }
  }
  return out;
}

export function injectSyntheticSections(list, model) {
  return list.concat([
    { slug: PARENT_SLUG, label: 'Parent', fieldRefs: [], present: model.parentId != null, synthetic: 'parent' },
    {
      slug: DISCUSSION_SLUG, label: 'Discussion', fieldRefs: [],
      present: Array.isArray(model.comments) ? model.comments.length > 0 : false,
      synthetic: 'discussion',
    },
  ]);
}
