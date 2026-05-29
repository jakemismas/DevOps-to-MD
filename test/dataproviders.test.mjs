import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataProviders } from './helpers/load-fixture.mjs';
import {
  getProviders, getEmbeddedWorkItemId, getFormatFlags, getFieldLabelIndex,
  getFieldIndexByRef, getFormLayout, getParentId, buildModelFromEmbedded, isEmptyValue
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
