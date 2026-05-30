// Derive the ordered list of selectable "sections" from the work item form layout
// (embedded, full-page) and/or the REST field set (dialog), then append synthetic
// Parent + Discussion sections. No DOM, no Chrome APIs.
import { getFormLayout, getFieldIndexByRef } from './dataproviders.mjs';

const HTML_FIELD_TYPE = 7;          // embedded numeric field type for HTML/long-text
const HTML_CONTROL = 'HtmlFieldControl';
export const PARENT_SLUG = '__parent__';
export const DISCUSSION_SLUG = '__discussion__';

// Best-effort ordering for the REST/dialog path (no form layout is available there, so
// we cannot read the org's real field order). Fields NOT in this list are never dropped;
// they sort alphabetically after the listed ones.
//
// Cross-org note: the System.* and Microsoft.VSTS.* refs are generic and order correctly
// on ANY Azure DevOps org. The Custom.* / WebTechScrum.* / WebDevScrum.* refs are
// process-specific (the DART org); on other orgs they simply never match, which only
// affects ordering, not which sections appear. On full-page views the embedded form
// layout supplies the exact order and this list is not consulted.
const KNOWN_CONTENT_ORDER = [
  'Custom.UserStoryorProblemStatement',
  'System.Description',
  'Microsoft.VSTS.Common.AcceptanceCriteria',
  'Custom.SecurityRequirements',
  'Custom.DevelopmentInstructions',
  'WebTechScrum.TestScenarios',
  'Custom.DeploymentInstructions',
  'WebDevScrum.ReleaseNotes',
  'Microsoft.VSTS.TCM.ReproSteps',
  'Microsoft.VSTS.TCM.SystemInfo',
];

export function slugifyLabel(label) {
  return String(label).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isContentControl(control, byRef) {
  if (!control || control.visible === false || control.isContribution) return false;
  if (control.controlType === HTML_CONTROL) return true;          // primary signal
  const def = byRef[control.id];
  return !!(def && def.type === HTML_FIELD_TYPE);                  // embedded fallback
}

/**
 * Walk an embedded form layout in render order. A group is a content section if it has
 * >=1 visible HtmlFieldControl (or a type-7 field). Includes empty sections (full-page
 * fidelity). Contribution controls (the cross-origin Parent iframe) and hidden
 * groups/controls/non-details pages are skipped.
 */
export function buildSectionsFromLayout(providers, model) {
  const layout = getFormLayout(providers);
  const byRef = getFieldIndexByRef(providers);
  const out = [];
  if (!layout || !Array.isArray(layout.pages)) return out;

  for (const page of layout.pages) {
    if (!page || page.isContribution) continue;
    if (page.pageType != null && page.pageType !== 1) continue;
    for (const section of page.sections || []) {
      for (const group of section.groups || []) {
        if (!group || group.visible === false || group.isContribution) continue;
        const fieldRefs = [];
        for (const control of group.controls || []) {
          if (isContentControl(control, byRef)) fieldRefs.push(control.id);
        }
        if (fieldRefs.length === 0) continue;
        const first = model.fields[fieldRefs[0]];
        const label = group.label || (first && first.label) || fieldRefs[0];
        out.push({
          slug: slugifyLabel(label), label, fieldRefs,
          present: fieldRefs.some((r) => model.fields[r] && model.fields[r].present),
          synthetic: null,
        });
      }
    }
  }
  return out;
}

/**
 * REST/dialog path: list the model's long-text (type "html") fields that have content,
 * ordered by KNOWN_CONTENT_ORDER then alphabetically. System.History (discussion/log) is
 * excluded. Only populated fields appear (REST $expand=all omits empty fields).
 */
export function buildSectionsFromFields(model) {
  const fields = Object.values((model && model.fields) || {});
  const content = fields.filter((f) =>
    (f.type === 'html' || f.type === HTML_FIELD_TYPE) &&
    f.referenceName !== 'System.History' &&
    f.present);

  content.sort((a, b) => {
    const ia = KNOWN_CONTENT_ORDER.indexOf(a.referenceName);
    const ib = KNOWN_CONTENT_ORDER.indexOf(b.referenceName);
    const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
    const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
    if (ra !== rb) return ra - rb;
    return String(a.label).localeCompare(String(b.label));
  });

  return content.map((f) => ({
    slug: slugifyLabel(f.label), label: f.label, fieldRefs: [f.referenceName],
    present: true, synthetic: null,
  }));
}

/** Union: keep `primary` (layout order + empties), append `extra` entries not already covered. */
export function mergeSections(primary, extra) {
  const seen = new Set();
  for (const s of primary) for (const r of s.fieldRefs) seen.add(r);
  const merged = primary.slice();
  for (const s of extra || []) {
    if (s.fieldRefs.some((r) => seen.has(r))) continue;
    merged.push(s);
    for (const r of s.fieldRefs) seen.add(r);
  }
  return merged;
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
