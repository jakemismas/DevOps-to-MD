import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataProviders } from './helpers/load-fixture.mjs';
import { getProviders, buildModelFromEmbedded, buildModelFromRest } from '../src/lib/dataproviders.mjs';
import {
  buildSectionsFromLayout, buildSectionsFromFields, mergeSections,
  injectSyntheticSections, slugifyLabel, PARENT_SLUG, DISCUSSION_SLUG,
} from '../src/lib/sections.mjs';

const providers = getProviders(loadDataProviders());
const model = buildModelFromEmbedded(providers);
const list = buildSectionsFromLayout(providers, model);

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
  assert.deepEqual(buildSectionsFromLayout({ typeData: null, projectFields: { fields: [] } }, { fields: {} }), []);
});

// ---- REST/dialog path: buildSectionsFromFields ----

function restModel(fields, defs) {
  return buildModelFromRest({ id: 1, fields, relations: [] }, defs);
}

test('buildSectionsFromFields: html fields only, in known content order, History excluded', () => {
  const model = restModel(
    {
      'System.Title': 'T',                                         // not html -> excluded
      'Microsoft.VSTS.Common.AcceptanceCriteria': '<ul><li>a</li></ul>',
      'Custom.UserStoryorProblemStatement': '<p>story</p>',
      'System.Description': '<p>desc</p>',
      'System.History': '<p>a comment</p>',                        // html but excluded
      'Microsoft.VSTS.Priority': '2',                              // not html -> excluded
    },
    [
      { referenceName: 'System.Title', name: 'Title', type: 'string' },
      { referenceName: 'Microsoft.VSTS.Common.AcceptanceCriteria', name: 'Acceptance Criteria', type: 'html' },
      { referenceName: 'Custom.UserStoryorProblemStatement', name: 'User Story or Problem Statement', type: 'html' },
      { referenceName: 'System.Description', name: 'Description', type: 'html' },
      { referenceName: 'System.History', name: 'History', type: 'html' },
      { referenceName: 'Microsoft.VSTS.Priority', name: 'Priority', type: 'integer' },
    ]
  );
  const sections = buildSectionsFromFields(model);
  assert.deepEqual(sections.map(s => s.label), [
    'User Story or Problem Statement',
    'Description',
    'Acceptance Criteria',
  ]);
  assert.ok(sections.every(s => s.present === true));
  assert.equal(sections[0].fieldRefs[0], 'Custom.UserStoryorProblemStatement');
});

test('buildSectionsFromFields: unknown html fields sort alphabetically after known ones', () => {
  const model = restModel(
    {
      'System.Description': '<p>d</p>',
      'Custom.Zeta': '<p>z</p>',
      'Custom.Alpha': '<p>a</p>',
    },
    [
      { referenceName: 'System.Description', name: 'Description', type: 'html' },
      { referenceName: 'Custom.Zeta', name: 'Zeta Notes', type: 'html' },
      { referenceName: 'Custom.Alpha', name: 'Alpha Notes', type: 'html' },
    ]
  );
  assert.deepEqual(buildSectionsFromFields(model).map(s => s.label), ['Description', 'Alpha Notes', 'Zeta Notes']);
});

// ---- mergeSections ----

test('mergeSections: keeps layout order, appends only refs not already covered', () => {
  const primary = [
    { slug: 'desc', label: 'Description', fieldRefs: ['System.Description'], present: false, synthetic: null },
  ];
  const extra = [
    { slug: 'desc2', label: 'Description (dup)', fieldRefs: ['System.Description'], present: true, synthetic: null },
    { slug: 'sec', label: 'Security Requirements', fieldRefs: ['Custom.SecurityRequirements'], present: true, synthetic: null },
  ];
  const merged = mergeSections(primary, extra);
  assert.deepEqual(merged.map(s => s.label), ['Description', 'Security Requirements']);
});

test('mergeSections with empty primary returns extra unchanged', () => {
  const extra = [{ slug: 'a', label: 'A', fieldRefs: ['X'], present: true, synthetic: null }];
  assert.deepEqual(mergeSections([], extra), extra);
});
