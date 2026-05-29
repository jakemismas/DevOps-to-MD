// Exercises the REAL Turndown converter (npm build) against the real fixture HTML,
// using the same factory the popup uses. Skips only if devDeps are missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataProviders } from './helpers/load-fixture.mjs';
import { getProviders, buildModelFromEmbedded } from '../src/lib/dataproviders.mjs';

let createTurndown, TurndownService, gfm, ready = true;
try {
  ({ createTurndown } = await import('../src/lib/turndown-factory.mjs'));
  ({ default: TurndownService } = await import('turndown'));
  gfm = await import('turndown-plugin-gfm');
} catch {
  ready = false;
}

const skip = ready ? false : 'devDeps (turndown/turndown-plugin-gfm) not installed — run npm install';

test('converts the real Acceptance Criteria HTML to an ordered list, no raw tags', { skip }, () => {
  const turndown = createTurndown(TurndownService, gfm);
  const model = buildModelFromEmbedded(getProviders(loadDataProviders()));
  const md = turndown(model.fields['Microsoft.VSTS.Common.AcceptanceCriteria'].value);
  assert.match(md, /1\.\s+Sales Team Members can locate Pricefx/);
  assert.match(md, /7\.\s+If the embedded Pricefx app fails to load/);
  assert.ok(!/<[a-z]/i.test(md), 'no raw HTML tags should remain');
});

test('converts the real User Story HTML: strong -> **, entities resolved', { skip }, () => {
  const turndown = createTurndown(TurndownService, gfm);
  const model = buildModelFromEmbedded(getProviders(loadDataProviders()));
  const md = turndown(model.fields['Custom.UserStoryorProblemStatement'].value);
  assert.match(md, /\*\*As a Sales Team Member,\*\*/);
  assert.match(md, /\*\*I want\*\*/);
  assert.match(md, /\*\*so that\*\*/);
  assert.ok(!md.includes('&nbsp;'), '&nbsp; entity should be resolved');
  assert.ok(!/<[a-z]/i.test(md), 'no raw HTML tags should remain');
});

test('GFM plugin is wired: HTML table -> Markdown table', { skip }, () => {
  const turndown = createTurndown(TurndownService, gfm);
  const md = turndown('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
  assert.match(md, /\|\s*A\s*\|\s*B\s*\|/);
  assert.match(md, /\| *-+ *\|/);
});

test('mention span -> plain text', { skip }, () => {
  const turndown = createTurndown(TurndownService, gfm);
  const md = turndown('<div>hello <span class="mention">@Jake</span></div>');
  assert.match(md, /@Jake/);
  assert.ok(!/<span/i.test(md));
});
