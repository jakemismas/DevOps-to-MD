import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataProviders } from './helpers/load-fixture.mjs';
import { getProviders, buildModelFromEmbedded } from '../src/lib/dataproviders.mjs';
import { buildSectionList, injectSyntheticSections, slugifyLabel, PARENT_SLUG, DISCUSSION_SLUG } from '../src/lib/sections.mjs';

const providers = getProviders(loadDataProviders());
const model = buildModelFromEmbedded(providers);
const list = buildSectionList(providers, model);

test('detects content sections in form-layout order', () => {
  assert.deepEqual(list.map(s => s.label), [
    'User Story or Problem Statement',
    'Description',
    'Acceptance Criteria',
    'Security Requirements',
    'Development Instructions',
    'Test Scenarios',
    'Deployment Instructions'
  ]);
});

test('excludes the contribution Parent iframe group, the Details (non-HTML) group, hidden Release Notes, and non-details pages', () => {
  const labels = list.map(s => s.label);
  assert.ok(!labels.includes('Parent'));        // contribution iframe group
  assert.ok(!labels.includes('Details'));       // type 2/10 fields, not type 7
  assert.ok(!labels.includes('Release Notes')); // control visible:false
});

test('present flags reflect populated vs empty fields', () => {
  const present = Object.fromEntries(list.map(s => [s.label, s.present]));
  assert.equal(present['User Story or Problem Statement'], true);
  assert.equal(present['Acceptance Criteria'], true);
  assert.equal(present['Test Scenarios'], true);
  assert.equal(present['Deployment Instructions'], true);
  assert.equal(present['Description'], false);
  assert.equal(present['Security Requirements'], false);
  assert.equal(present['Development Instructions'], false);
});

test('slugs are stable kebab-case', () => {
  assert.equal(slugifyLabel('User Story or Problem Statement'), 'user-story-or-problem-statement');
  assert.equal(list[0].slug, 'user-story-or-problem-statement');
});

test('injects synthetic Parent and Discussion', () => {
  const full = injectSyntheticSections(list, model);
  const parent = full.find(s => s.slug === PARENT_SLUG);
  const disc = full.find(s => s.slug === DISCUSSION_SLUG);
  assert.equal(parent.synthetic, 'parent');
  assert.equal(parent.present, true); // parentId 451728
  assert.equal(disc.synthetic, 'discussion');
  assert.equal(disc.present, false);  // no comments attached to model yet
});

test('empty layout yields no sections', () => {
  assert.deepEqual(buildSectionList({ typeData: null, projectFields: { fields: [] } }, { fields: {} }), []);
});
