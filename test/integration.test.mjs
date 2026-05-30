// End-to-end pipeline test (no browser): simulate the harvester reading the page,
// then run the exact popup pipeline with the REAL Turndown converter against the
// real fixture, and assert the assembled Markdown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixtureHtml, extractDataProviders } from './helpers/load-fixture.mjs';
import { getProviders, buildModelFromEmbedded, buildModelFromRest } from '../src/lib/dataproviders.mjs';
import { buildSectionsFromLayout, buildSectionsFromFields, mergeSections, injectSyntheticSections } from '../src/lib/sections.mjs';
import { normalizeComments } from '../src/lib/comments.mjs';
import { assembleMarkdown } from '../src/lib/markdown.mjs';
import { harvest } from '../src/harvester.js';

let createTurndown, TurndownService, gfm, ready = true;
try {
  ({ createTurndown } = await import('../src/lib/turndown-factory.mjs'));
  ({ default: TurndownService } = await import('turndown'));
  gfm = await import('turndown-plugin-gfm');
} catch { ready = false; }
const skip = ready ? false : 'devDeps not installed';

// Fail loudly (not skip) so `npm test` can't pass with the end-to-end suite silently
// absent. `npm run test:unit` (zero-dependency) does not include this file.
test('integration devDeps are installed (run npm install)', () => {
  assert.ok(ready, 'turndown + turndown-plugin-gfm must be installed for the integration suite; run `npm install`');
});

function buildAll() {
  const root = extractDataProviders(loadFixtureHtml());
  const providers = getProviders(root);
  const model = buildModelFromEmbedded(providers);
  const origin = 'https://dartcontainer.visualstudio.com/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/';
  model.url = origin + model.workItemId;
  if (model.parentId != null) model.parentUrl = origin + model.parentId;
  model.comments = normalizeComments([
    { createdBy: { displayName: 'Ravi Bhagavathula' }, createdDate: '2026-05-19T15:00:00Z',
      renderedText: '<div>@Lily Doniger, can you please test it on Salesforce QA?</div>' },
  ]);
  const sectionList = injectSyntheticSections(buildSectionsFromLayout(providers, model), model);
  return { model, sectionList };
}

function buildAllFromRest() {
  const path = fileURLToPath(new URL('./fixtures/workitem-rest-sample.json', import.meta.url));
  const { workItem, fieldDefs } = JSON.parse(readFileSync(path, 'utf8'));
  const model = buildModelFromRest(workItem, fieldDefs);
  const origin = 'https://dartcontainer.visualstudio.com/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/';
  model.url = origin + model.workItemId;
  if (model.parentId != null) model.parentUrl = origin + model.parentId;
  model.comments = normalizeComments([
    { createdBy: { displayName: 'Ravi Bhagavathula' }, createdDate: '2026-05-19T15:00:00Z',
      renderedText: '<div>@Lily Doniger, can you please test it on Salesforce QA?</div>' },
  ]);
  // Dialog path: no embedded layout, so the list is built purely from REST html fields.
  const sectionList = injectSyntheticSections(mergeSections([], buildSectionsFromFields(model)), model);
  return { model, sectionList };
}

test('full pipeline produces correct Markdown with the real converter', { skip }, () => {
  const turndown = createTurndown(TurndownService, gfm);
  const { model, sectionList } = buildAll();
  const sel = {
    'user-story-or-problem-statement': true,
    'acceptance-criteria': true,
    'description': true,            // selected but empty -> placeholder
    'test-scenarios': true,
    'deployment-instructions': true,
    '__parent__': true,
    '__discussion__': true,
  };
  const md = assembleMarkdown(model, sectionList, sel, { turndown });

  assert.ok(md.startsWith('# 470134: Navigate to PriceFx within Salesforce App\n'));
  assert.match(md, /\[View in Azure DevOps\]\(/);
  assert.match(md, /## User Story or Problem Statement\n\n\*\*As a Sales Team Member,\*\*/);
  assert.match(md, /## Acceptance Criteria\n\n1\.\s+Sales Team Members can locate Pricefx/);
  assert.match(md, /## Description\n\n_\(empty\)_/);                 // empty placeholder
  assert.match(md, /## Test Scenarios\n\nSetup: Assign the Pricefx User/); // markdown passthrough
  assert.match(md, /`dart--qa01\.sandbox\.lightning\.force\.com/);         // backticks preserved
  assert.match(md, /## Deployment Instructions\n\n## Components to Deploy/); // markdown passthrough (own H2)
  assert.match(md, /## Parent\n\n\[451728\]\(/);                    // id-only link
  assert.match(md, /## Discussion\n\n\*\*Ravi Bhagavathula\*\* \(/);
  assert.match(md, /can you please test it on Salesforce QA/);

  // No leftover block HTML from the converted fields
  assert.ok(!md.includes('<div'), 'no <div');
  assert.ok(!md.includes('<span'), 'no <span');
  assert.ok(!md.includes('</'), 'no closing tags');
});

test('REST/dialog pipeline produces correct Markdown with the real converter', { skip }, () => {
  const turndown = createTurndown(TurndownService, gfm);
  const { model, sectionList } = buildAllFromRest();

  // gear lists only populated html content sections (no empty-field rows on the dialog path)
  assert.deepEqual(
    sectionList.filter(s => !s.synthetic).map(s => s.label),
    ['User Story or Problem Statement', 'Acceptance Criteria', 'Test Scenarios']
  );
  assert.ok(!sectionList.some(s => s.label === 'History'), 'System.History is never a section');
  assert.ok(!sectionList.some(s => s.label === 'Security Requirements'), 'empty field omitted on dialog path');

  const sel = {
    'user-story-or-problem-statement': true,
    'acceptance-criteria': true,
    'test-scenarios': true,
    '__parent__': true,
    '__discussion__': true,
  };
  const md = assembleMarkdown(model, sectionList, sel, { turndown });

  assert.ok(md.startsWith('# 476404: Add Pricefx quick-launch tile to the Salesforce home page\n'));
  assert.match(md, /## User Story or Problem Statement\n\n\*\*As a\*\* Sales Team Member,/);
  assert.match(md, /## Acceptance Criteria\n\n1\.\s+Tile appears on the Salesforce home page\./);
  assert.match(md, /## Test Scenarios\n\nSetup: Assign the Pricefx User permission set\./); // markdown passthrough
  assert.match(md, /## Parent\n\n\[451728\]\(/);
  assert.match(md, /## Discussion\n\n\*\*Ravi Bhagavathula\*\* \(/);
  assert.ok(!md.includes('<div'), 'no <div');
  assert.ok(!md.includes('</'), 'no closing tags');
});

test('harvester source is self-contained (uses DOM + credentialed fetch, no imports)', () => {
  const src = harvest.toString();
  assert.ok(src.includes("getElementById('dataProviders')"), 'reads the embedded blob via DOM');
  assert.ok(src.includes("credentials: 'include'"), 'fetches comments with the session');
  assert.ok(!/\bimport\b/.test(src), 'no import statements inside the injected function');
});
