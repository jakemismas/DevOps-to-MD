import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataProviders } from './helpers/load-fixture.mjs';
import {
  getProviders, getEmbeddedWorkItemId, getFormatFlags, getFieldLabelIndex,
  getFieldIndexByRef, getFormLayout, getParentId, buildModelFromEmbedded, isEmptyValue,
  buildModelFromRest
} from '../src/lib/dataproviders.mjs';

const providers = getProviders(loadDataProviders());

test('embedded work item id', () => {
  assert.equal(getEmbeddedWorkItemId(providers), 470134);
});

test('model: title and parent id', () => {
  const model = buildModelFromEmbedded(providers);
  assert.equal(model.title, 'Navigate to PriceFx within Salesforce App');
  assert.equal(model.parentId, 451728);
});

test('multiline format flags (1=HTML, 0=Markdown)', () => {
  const flags = getFormatFlags(providers);
  assert.equal(flags['7640679'], 1); // User Story (HTML)
  assert.equal(flags['2765953'], 1); // Acceptance Criteria (HTML)
  assert.equal(flags['7464447'], 0); // Test Scenarios (Markdown)
  assert.equal(flags['7566956'], 0); // Deployment Instructions (Markdown)
});

test('field label index maps id -> friendly label', () => {
  const idx = getFieldLabelIndex(providers);
  assert.equal(idx['7640679'].label, 'User Story or Problem Statement');
  assert.equal(idx['7640679'].referenceName, 'Custom.UserStoryorProblemStatement');
  assert.equal(idx['7640679'].type, 7);
});

test('field index by referenceName', () => {
  const byRef = getFieldIndexByRef(providers);
  assert.equal(byRef['Custom.UserStoryorProblemStatement'].id, 7640679);
  assert.equal(byRef['Microsoft.VSTS.Common.AcceptanceCriteria'].id, 2765953);
});

test('model fields: populated vs empty + format', () => {
  const f = buildModelFromEmbedded(providers).fields;
  assert.equal(f['Custom.UserStoryorProblemStatement'].present, true);
  assert.equal(f['Custom.UserStoryorProblemStatement'].format, 1);
  assert.equal(f['Microsoft.VSTS.Common.AcceptanceCriteria'].present, true);
  assert.equal(f['WebTechScrum.TestScenarios'].present, true);
  assert.equal(f['WebTechScrum.TestScenarios'].format, 0);
  assert.equal(f['Custom.DeploymentInstructions'].format, 0);
  // empty on this ticket but defined in the layout:
  assert.equal(f['System.Description'].present, false);
  assert.equal(f['Custom.SecurityRequirements'].present, false);
  assert.equal(f['Custom.DevelopmentInstructions'].present, false);
});

test('parent resolution prefers Hierarchy-Reverse, not a forward/child relation', () => {
  // synthetic providers: no System.Parent field, both a child (forward) and parent (reverse) relation
  const synthetic = {
    wiData: { fields: {}, multilineFieldsFormat: {}, relations: [
      { ID: 999, LinkType: 2 },   // child / forward
      { ID: 451728, LinkType: -2 } // parent / reverse
    ]},
    projectFields: { fields: [] },
    typeData: null,
  };
  assert.equal(getParentId(synthetic), 451728);
});

test('parent resolution from REST-style rel string url', () => {
  const synthetic = {
    wiData: { fields: {}, relations: [
      { rel: 'System.LinkTypes.Hierarchy-Reverse', url: 'https://dev.azure.com/o/_apis/wit/workItems/451728' }
    ]},
    projectFields: { fields: [] }, typeData: null,
  };
  assert.equal(getParentId(synthetic), 451728);
});

test('getFormLayout tolerates a JSON string form', () => {
  const layout = getFormLayout({ typeData: { form: '{"pages":[{"label":"Details"}]}' } });
  assert.equal(layout.pages[0].label, 'Details');
});

test('getFormLayout reads the object form from the fixture', () => {
  const layout = getFormLayout(providers);
  assert.ok(Array.isArray(layout.pages));
  assert.equal(layout.pages[0].label, 'Details');
});

test('isEmptyValue treats whitespace-only markup as empty', () => {
  assert.equal(isEmptyValue('<div>&nbsp;</div>'), true);
  assert.equal(isEmptyValue('<div>hi</div>'), false);
  assert.equal(isEmptyValue(''), true);
  assert.equal(isEmptyValue(null), true);
});

test('buildModelFromRest: fields keyed by referenceName, label/type from defs, parent via System.Parent', () => {
  const restWorkItem = {
    id: 476404,
    fields: {
      'System.Title': 'Dialog item title',
      'System.Parent': 451728,
      'System.Description': '<div>desc</div>',
      'Custom.SecurityRequirements': '   ', // whitespace -> not present
    },
    relations: [],
  };
  const fieldDefs = [
    { referenceName: 'System.Title', name: 'Title', type: 'string' },
    { referenceName: 'System.Description', name: 'Description', type: 'html' },
    { referenceName: 'Custom.SecurityRequirements', name: 'Security Requirements', type: 'html' },
  ];
  const model = buildModelFromRest(restWorkItem, fieldDefs);
  assert.equal(model.workItemId, 476404);
  assert.equal(model.title, 'Dialog item title');
  assert.equal(model.parentId, 451728);
  assert.equal(model.fields['System.Description'].label, 'Description');
  assert.equal(model.fields['System.Description'].type, 'html');
  assert.equal(model.fields['System.Description'].present, true);
  assert.equal(model.fields['System.Description'].format, null);
  assert.equal(model.fields['Custom.SecurityRequirements'].present, false);
  // a field with no matching def still appears, labeled by its reference name:
  assert.equal(model.fields['System.Title'].label, 'Title');
});

test('buildModelFromRest: parent via Hierarchy-Reverse relation when System.Parent absent', () => {
  const model = buildModelFromRest({
    id: 5,
    fields: { 'System.Title': 'T' },
    relations: [
      { rel: 'System.LinkTypes.Hierarchy-Forward', url: 'https://x/_apis/wit/workItems/900' },
      { rel: 'System.LinkTypes.Hierarchy-Reverse', url: 'https://x/_apis/wit/workItems/451728' },
    ],
  }, []);
  assert.equal(model.parentId, 451728);
});

test('buildModelFromRest: no parent -> null', () => {
  const model = buildModelFromRest({ id: 5, fields: { 'System.Title': 'T' }, relations: [] }, []);
  assert.equal(model.parentId, null);
});

test('buildModelFromRest: parent relation url with trailing slash or query still resolves', () => {
  const withSlash = buildModelFromRest({ id: 1, fields: {}, relations: [
    { rel: 'System.LinkTypes.Hierarchy-Reverse', url: 'https://x/_apis/wit/workItems/451728/' },
  ] }, []);
  assert.equal(withSlash.parentId, 451728);
  const withQuery = buildModelFromRest({ id: 1, fields: {}, relations: [
    { rel: 'System.LinkTypes.Hierarchy-Reverse', url: 'https://x/_apis/wit/workItems/451728?api-version=7.1' },
  ] }, []);
  assert.equal(withQuery.parentId, 451728);
});

test('buildModelFromEmbedded skips field defs lacking a referenceName (no model.fields["undefined"])', () => {
  const providers = {
    workItemId: 5,
    wiData: { fields: { '1': 'Title', '99': '<div>orphan</div>' }, multilineFieldsFormat: {} },
    projectFields: { fields: [
      { id: 1, name: 'Title', referenceName: 'System.Title', type: 1 },
      { id: 99, name: 'Orphan', type: 7 }, // no referenceName
    ] },
    typeData: null,
  };
  const model = buildModelFromEmbedded(providers);
  assert.ok(!Object.prototype.hasOwnProperty.call(model.fields, 'undefined'));
  assert.ok(model.fields['System.Title']);
});

test('getProviders reads field defs / form from sibling top-level providers', () => {
  const root = { data: {
    'ms.vss-work-web.work-item-data-provider': { 'work-item-id': 5, 'work-item-data': { fields: { '1': 'T' } } },
    'ms.vss-work-web.work-item-project-field-data': { data: { fields: [{ id: 1, name: 'Title', referenceName: 'System.Title', type: 1 }] } },
    'ms.vss-work-web.work-item-type-data': { data: { form: { pages: [] } } },
  } };
  const p = getProviders(root);
  assert.ok(p.projectFields && Array.isArray(p.projectFields.fields));
  assert.equal(p.projectFields.fields[0].referenceName, 'System.Title');
  assert.ok(p.typeData && p.typeData.form);
});
