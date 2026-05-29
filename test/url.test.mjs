import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAdoUrl, buildCommentsUrl, buildWorkItemUrl, buildParentUrl } from '../src/lib/url.mjs';

test('parses visualstudio.com work item URL (org from subdomain)', () => {
  const info = parseAdoUrl('https://dartcontainer.visualstudio.com/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134/');
  assert.deepEqual(info, {
    host: 'visualstudio',
    org: 'dartcontainer',
    project: 'PPM1510 - Pricing Excellence',
    workItemId: 470134,
    origin: 'https://dartcontainer.visualstudio.com',
    orgBase: 'https://dartcontainer.visualstudio.com'
  });
});

test('parses dev.azure.com work item URL (org from first path segment)', () => {
  const info = parseAdoUrl('https://dev.azure.com/dartcontainer/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134');
  assert.equal(info.host, 'devazure');
  assert.equal(info.org, 'dartcontainer');
  assert.equal(info.project, 'PPM1510 - Pricing Excellence');
  assert.equal(info.workItemId, 470134);
  assert.equal(info.orgBase, 'https://dev.azure.com/dartcontainer');
});

test('ignores query string / trailing path after the id', () => {
  const info = parseAdoUrl('https://dev.azure.com/org/Proj/_workitems/edit/9/?foo=bar#x');
  assert.equal(info.workItemId, 9);
});

test('returns null for non-work-item URLs', () => {
  assert.equal(parseAdoUrl('https://dartcontainer.visualstudio.com/PPM1510/_boards/board'), null);
  assert.equal(parseAdoUrl('https://dev.azure.com/dartcontainer/Proj/_backlogs'), null);
  assert.equal(parseAdoUrl('https://example.com/_workitems/edit/1'), null);
  assert.equal(parseAdoUrl('not a url'), null);
});

test('builds the comments REST URL (project-scoped, preview api, renderedText)', () => {
  const info = parseAdoUrl('https://dartcontainer.visualstudio.com/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134');
  assert.equal(
    buildCommentsUrl(info),
    'https://dartcontainer.visualstudio.com/PPM1510%20-%20Pricing%20Excellence/_apis/wit/workItems/470134/comments?$top=200&$expand=renderedText&api-version=7.1-preview.4'
  );
});

test('builds the comments REST URL for dev.azure.com (org in path)', () => {
  const info = parseAdoUrl('https://dev.azure.com/dartcontainer/Proj/_workitems/edit/5');
  assert.equal(
    buildCommentsUrl(info, { top: 50 }),
    'https://dev.azure.com/dartcontainer/Proj/_apis/wit/workItems/5/comments?$top=50&$expand=renderedText&api-version=7.1-preview.4'
  );
});

test('builds work item and parent web URLs', () => {
  const info = parseAdoUrl('https://dev.azure.com/dartcontainer/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134');
  assert.equal(buildWorkItemUrl(info), 'https://dev.azure.com/dartcontainer/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134');
  assert.equal(buildParentUrl(info, 451728), 'https://dev.azure.com/dartcontainer/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/451728');
});
