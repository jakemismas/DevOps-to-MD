// Popup controller: detects the org + open work item, injects the harvester, builds the
// section list (embedded layout union REST fields), manages the gear/preferences UI,
// assembles Markdown, and copies to the clipboard.
import { parseAdoUrl, buildCommentsUrl, buildWorkItemUrl, buildParentUrl, buildWorkItemRestUrl, buildFieldsUrl } from './lib/url.mjs';
import { getProviders, buildModelFromEmbedded, buildModelFromRest, WI_PROVIDER } from './lib/dataproviders.mjs';
import { buildSectionsFromLayout, buildSectionsFromFields, mergeSections, injectSyntheticSections, DISCUSSION_SLUG } from './lib/sections.mjs';
import { normalizeComments } from './lib/comments.mjs';
import { assembleMarkdown } from './lib/markdown.mjs';
import { storageKeyForOrg, mergeSelections, selectionsForStorage } from './lib/prefs.mjs';
import { createTurndown } from './lib/turndown-factory.mjs';
import { harvest } from './harvester.js';

const $ = (id) => document.getElementById(id);
const els = {};
const state = {
  tab: null,
  info: null,
  sectionList: [],
  selections: {},
  storageKey: null,
  generated: false,
  runSeq: 0, // monotonic generate token; a stale run never overwrites a newer one
};

let _turndown = null;
function getTurndown() {
  if (!_turndown) _turndown = createTurndown(window.TurndownService, window.turndownPluginGfm);
  return _turndown;
}

document.addEventListener('DOMContentLoaded', init);

async function init() {
  for (const id of ['org', 'gear', 'panel', 'sectionList', 'generate', 'regenerate', 'copy', 'status', 'output']) {
    els[id] = $(id);
  }
  els.gear.addEventListener('click', () => {
    const opening = els.panel.hidden;
    els.panel.hidden = !opening;
    els.gear.setAttribute('aria-expanded', String(opening));
    if (opening) { const first = els.panel.querySelector('input'); if (first) first.focus(); }
  });
  els.generate.addEventListener('click', onGenerate);
  els.regenerate.addEventListener('click', onGenerate);
  els.copy.addEventListener('click', onCopy);

  state.tab = await getActiveTab();
  state.info = state.tab && state.tab.url ? parseAdoUrl(state.tab.url) : null;

  if (!state.info) {
    els.org.textContent = 'Azure DevOps';
    els.generate.disabled = true;
    els.gear.disabled = true;
    setStatus('Open an Azure DevOps work item (full page or from a board/sprint) to use this.', 'warn');
    return;
  }

  els.org.textContent = state.info.org;
  state.storageKey = storageKeyForOrg(state.info.org);
  setStatus('Reading work item…');
  try {
    const payload = await runHarvest(false);
    const applied = await applyHarvest(payload, { initial: true });
    if (applied) setStatus('');
  } catch (e) {
    setStatus('Could not read this page: ' + e.message, 'error');
  }
}

async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch {
    return null;
  }
}

async function runHarvest(needComments) {
  if (!state.tab || state.tab.id == null) throw new Error('no active tab');
  const args = {
    workItemId: state.info.workItemId,
    restWorkItemUrl: buildWorkItemRestUrl(state.info),
    fieldsUrl: buildFieldsUrl(state.info),
    needComments,
    maxPages: 10,
  };
  if (needComments) args.commentsUrl = buildCommentsUrl(state.info);

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: state.tab.id },
      func: harvest,
      args: [args],
    });
  } catch (e) {
    throw new Error('page injection blocked (' + (e && e.message) + ')');
  }
  const payload = results && results[0] && results[0].result;
  if (!payload) throw new Error('no data returned from the page');
  return payload;
}

// Returns { model } on success, or null after surfacing a problem.
async function applyHarvest(payload, { initial }) {
  const embeddedFresh = payload.embedded && payload.embeddedWorkItemId === state.info.workItemId;
  const embeddedProviders = embeddedFresh
    ? getProviders({ data: { [WI_PROVIDER]: {
        'work-item-id': payload.embeddedWorkItemId,
        'work-item-data': payload.embedded.workItemData,
        'work-item-project-field-data': payload.embedded.projectFieldData,
        'work-item-type-data': payload.embedded.typeData,
      } } })
    : null;

  let model = null;
  if (payload.rest && payload.rest.workItem) {
    model = buildModelFromRest(payload.rest.workItem, payload.rest.fieldDefs);
  } else if (embeddedProviders) {
    model = buildModelFromEmbedded(embeddedProviders);
  }

  if (!model || model.workItemId == null) {
    els.generate.disabled = true;
    const authish = payload.auth || (payload.errors || []).some((e) => /workitem:http:(401|403|302)/.test(e));
    setStatus(authish
      ? 'Could not load this work item. Make sure you are signed in to Azure DevOps, then reload the page.'
      : 'Could not load this work item. Reload the page and try again.', 'warn');
    return null;
  }

  model.url = buildWorkItemUrl(state.info);
  if (model.parentId != null) model.parentUrl = buildParentUrl(state.info, model.parentId);
  model.comments = normalizeComments(payload.comments || []);
  model.commentsTruncated = !!payload.commentsTruncated;

  const layoutSections = embeddedProviders ? buildSectionsFromLayout(embeddedProviders, model) : [];
  const fieldSections = buildSectionsFromFields(model);
  state.sectionList = injectSyntheticSections(mergeSections(layoutSections, fieldSections), model);

  if (initial) {
    const stored = await loadPrefs();
    const merged = mergeSelections(stored, state.sectionList);
    state.selections = merged.selections;
    await savePrefs(); // persist merged map so newly-detected sections aren't re-flagged next visit
    renderSections();
    els.generate.disabled = false;
  }
  return { model };
}

async function onGenerate() {
  if (!state.info) return;
  const myRun = ++state.runSeq;
  const needComments = !!state.selections[DISCUSSION_SLUG];
  setStatus('Generating…');

  let payload;
  try {
    payload = await runHarvest(needComments);
  } catch (e) {
    if (myRun === state.runSeq) setStatus('Could not read the page: ' + e.message, 'error');
    return;
  }
  if (myRun !== state.runSeq) return; // a newer generate superseded this run

  const applied = await applyHarvest(payload, { initial: false });
  if (!applied || myRun !== state.runSeq) return;
  const { model } = applied;

  const commentsFailed = needComments && payload.commentsAttempted && !payload.commentsOk;
  if (commentsFailed) {
    setStatus('Could not load comments. Make sure you are signed in, then reload the work item.', 'warn');
  } else if (model.commentsTruncated) {
    setStatus('Note: only the first pages of a very long discussion were included.', 'warn');
  } else if (needComments && model.comments.length) {
    const n = model.comments.length;
    setStatus(`Included ${n} comment${n === 1 ? '' : 's'}.`);
  } else {
    setStatus('');
  }

  els.output.value = assembleMarkdown(model, state.sectionList, state.selections, { turndown: getTurndown() });
  els.output.hidden = false;
  els.regenerate.hidden = false;
  els.copy.hidden = false;
  state.generated = true;
  els.output.focus();
  els.output.select();
}

function renderSections() {
  els.sectionList.innerHTML = '';
  if (!state.sectionList.length) {
    els.sectionList.textContent = 'No sections detected. Reload the work item.';
    return;
  }
  for (const s of state.sectionList) {
    const row = document.createElement('label');
    row.className = 'section-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!state.selections[s.slug];
    cb.addEventListener('change', () => onToggle(s.slug, cb.checked));
    const text = document.createElement('span');
    text.textContent = s.label;
    row.append(cb, text);
    els.sectionList.append(row);
  }
}

async function onToggle(slug, checked) {
  state.selections[slug] = checked;
  await savePrefs();
  if (state.generated) onGenerate();
}

async function onCopy() {
  try {
    await navigator.clipboard.writeText(els.output.value);
    flashCopied();
  } catch {
    els.output.focus();
    els.output.select();
    try {
      if (document.execCommand('copy')) flashCopied();
      else setStatus('Press Ctrl+A then Ctrl+C to copy.', 'warn');
    } catch {
      setStatus('Press Ctrl+A then Ctrl+C to copy.', 'warn');
    }
  }
}

function flashCopied() {
  const prev = els.copy.textContent;
  els.copy.textContent = 'Copied!';
  setTimeout(() => { els.copy.textContent = prev; }, 1200);
}

function setStatus(msg, kind) {
  els.status.textContent = msg || '';
  els.status.className = 'status' + (kind ? ' ' + kind : '');
  // Errors should interrupt a screen reader; routine status stays polite.
  els.status.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
}

async function loadPrefs() {
  try {
    const got = await chrome.storage.sync.get(state.storageKey);
    if (got && got[state.storageKey]) return got[state.storageKey];
  } catch { /* fall through */ }
  try {
    const got = await chrome.storage.local.get(state.storageKey);
    return (got && got[state.storageKey]) || null;
  } catch {
    return null;
  }
}

async function savePrefs() {
  const payload = { [state.storageKey]: selectionsForStorage(state.selections) };
  try {
    await chrome.storage.sync.set(payload);
  } catch {
    try { await chrome.storage.local.set(payload); } catch { /* ignore */ }
  }
}
