// Extract a normalized work-item model from the page's embedded #dataProviders JSON.
// No DOM, no Chrome APIs. The shape mirrors Azure DevOps:
//   root.data["ms.vss-work-web.work-item-data-provider"]
//     ["work-item-id"]
//     ["work-item-data"] { fields, multilineFieldsFormat, relations }
//     ["work-item-project-field-data"].data.fields  (field defs: id/name/referenceName/type)
//     ["work-item-type-data"].data.form             (form layout; string OR object)

export const WI_PROVIDER = 'ms.vss-work-web.work-item-data-provider';
const PFD_KEY = 'ms.vss-work-web.work-item-project-field-data';
const TD_KEY = 'ms.vss-work-web.work-item-type-data';

const REF = { TITLE: 'System.Title', PARENT: 'System.Parent' };
const HIERARCHY_REVERSE = 'System.LinkTypes.Hierarchy-Reverse'; // parent
const LINKTYPE_PARENT = -2; // embedded numeric code for Hierarchy-Reverse

/**
 * root (parsed #dataProviders) -> grouped provider sub-objects, or null.
 * Field definitions and the form layout can appear either nested under the
 * work-item-data-provider or as sibling top-level providers; check both.
 */
export function getProviders(root) {
  const data = root && root.data;
  if (!data) return null;
  const dp = data[WI_PROVIDER];
  if (!dp) return null;
  const pfdHost = dp['work-item-project-field-data'] || data[PFD_KEY];
  const tdHost = dp['work-item-type-data'] || data[TD_KEY];
  return {
    workItemId: dp['work-item-id'] ?? null,
    wiData: dp['work-item-data'] ?? null,
    projectFields: (pfdHost && pfdHost.data) ?? null,
    typeData: (tdHost && tdHost.data) ?? null,
  };
}

export function getEmbeddedWorkItemId(providers) {
  return providers ? providers.workItemId ?? null : null;
}
export function getFieldsMap(providers) {
  return (providers && providers.wiData && providers.wiData.fields) || {};
}
export function getFormatFlags(providers) {
  return (providers && providers.wiData && providers.wiData.multilineFieldsFormat) || {};
}
export function getRelations(providers) {
  return (providers && providers.wiData && providers.wiData.relations) || [];
}
export function getProjectFieldDefs(providers) {
  return (providers && providers.projectFields && providers.projectFields.fields) || [];
}

/** fieldId -> { id, label, referenceName, type } */
export function getFieldLabelIndex(providers) {
  const idx = {};
  for (const f of getProjectFieldDefs(providers)) {
    idx[String(f.id)] = { id: f.id, label: f.name, referenceName: f.referenceName, type: f.type };
  }
  return idx;
}

/** referenceName -> { id, label, referenceName, type } */
export function getFieldIndexByRef(providers) {
  const idx = {};
  for (const f of getProjectFieldDefs(providers)) {
    if (f.referenceName) idx[f.referenceName] = { id: f.id, label: f.name, referenceName: f.referenceName, type: f.type };
  }
  return idx;
}

/** Form layout object. Tolerates the real page (JSON string) and a plain object. */
export function getFormLayout(providers) {
  const form = providers && providers.typeData && providers.typeData.form;
  if (!form) return null;
  if (typeof form === 'string') {
    try { return JSON.parse(form); } catch { return null; }
  }
  return form;
}

/** Parent id via System.Parent field (preferred) or a Hierarchy-Reverse relation. */
export function getParentId(providers) {
  const byRef = getFieldIndexByRef(providers);
  const fields = getFieldsMap(providers);
  const parentDef = byRef[REF.PARENT];
  if (parentDef) {
    const v = fields[String(parentDef.id)];
    if (v != null && v !== '') return Number(v);
  }
  for (const rel of getRelations(providers)) {
    const lt = rel.LinkType ?? rel.linkType;
    if (rel.rel === HIERARCHY_REVERSE || lt === LINKTYPE_PARENT) {
      if (rel.ID != null) return Number(rel.ID);
      if (typeof rel.url === 'string') {
        const m = rel.url.match(/\/(\d+)(?:[/?#]|$)/); // tolerate trailing slash/query
        if (m) return Number(m[1]);
      }
    }
  }
  return null;
}

/** True when a field value is missing or only whitespace/empty markup. */
export function isEmptyValue(v) {
  if (v == null) return true;
  const s = String(v).trim();
  if (s === '') return true;
  const stripped = s.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
  return stripped === '';
}

/** Normalized model consumed by sections.mjs + markdown.mjs. */
export function buildModelFromEmbedded(providers) {
  const fields = getFieldsMap(providers);
  const flags = getFormatFlags(providers);
  const byRef = getFieldIndexByRef(providers);

  const titleDef = byRef[REF.TITLE];
  const title = titleDef ? fields[String(titleDef.id)] : fields['1'];

  const modelFields = {};
  for (const def of getProjectFieldDefs(providers)) {
    if (!def || !def.referenceName) continue; // never key model.fields by "undefined"
    const value = fields[String(def.id)];
    const fmt = flags[String(def.id)];
    modelFields[def.referenceName] = {
      referenceName: def.referenceName,
      fieldId: def.id,
      label: def.name,
      type: def.type,
      format: fmt === 0 || fmt === 1 ? fmt : null,
      value: value ?? null,
      present: !isEmptyValue(value),
    };
  }

  return {
    workItemId: getEmbeddedWorkItemId(providers),
    title: String(title ?? ''),
    parentId: getParentId(providers),
    fields: modelFields,
  };
}

/**
 * Normalized model from the REST API (side-panel/dialog, SPA-stale, or full-page primary).
 *   restWorkItem: GET .../wit/workitems/{id}?$expand=all -> { id, fields:{refName:value}, relations:[{rel,url}] }
 *   fieldDefs:    [{ referenceName, name, type }]  (trimmed wit/fields list)
 * model.fields is keyed by referenceName; `type` is the REST string ("html" for rich text).
 * `format` is null so markdown.mjs content-sniffs (REST exposes no HTML/Markdown flag).
 */
export function buildModelFromRest(restWorkItem, fieldDefs) {
  const wi = restWorkItem || {};
  const fields = wi.fields || {};
  const relations = wi.relations || [];

  const defByRef = {};
  for (const d of fieldDefs || []) {
    if (d && d.referenceName) defByRef[d.referenceName] = d;
  }

  const modelFields = {};
  for (const ref of Object.keys(fields)) {
    const def = defByRef[ref];
    const value = fields[ref];
    modelFields[ref] = {
      referenceName: ref,
      fieldId: def ? def.id : undefined,
      label: (def && def.name) || ref,
      type: def ? def.type : undefined,
      format: null, // content-sniff at render time
      value: value ?? null,
      present: !isEmptyValue(value),
    };
  }

  let parentId = null;
  const pf = fields[REF.PARENT];
  if (pf != null && pf !== '') {
    parentId = Number(pf);
  } else {
    for (const rel of relations) {
      if (rel && rel.rel === HIERARCHY_REVERSE && typeof rel.url === 'string') {
        const m = rel.url.match(/\/(\d+)(?:[/?#]|$)/); // tolerate trailing slash/query
        if (m) { parentId = Number(m[1]); break; }
      }
    }
  }

  return {
    workItemId: wi.id ?? null,
    title: String(fields[REF.TITLE] ?? ''),
    parentId,
    fields: modelFields,
  };
}
