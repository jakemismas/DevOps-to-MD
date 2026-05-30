import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAdoUrl, buildCommentsUrl, buildWorkItemUrl, buildParentUrl,
  buildWorkItemRestUrl, buildFieldsUrl,
} from '../src/lib/url.mjs';

test('parses visualstudio.com work item URL (org from subdomain)', () => {
  const info = parseAdoUrl('https://dartcontainer.visualstudio.com/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134/');
  assert.deepEqual(info, {
    host: 'visualstudio',
    org: 'dartcontainer',
    project: 'PPM1510 - Pricing Excellence',
    workItemId: 470134,
    origin: 'https://dartcontainer.visualstudio.com',
    orgBase: 'https://dartcontainer.visualstudio.com',
    view: 'fullpage',
  });
});

test('parses dev.azure.com work item URL (org from first path segment)', () => {
  const info = parseAdoUrl('https://dev.azure.com/dartcontainer/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134');
  assert.equal(info.host, 'devazure');
  assert.equal(info.org, 'dartcontainer');
  assert.equal(info.project, 'PPM1510 - Pricing Excellence');
  assert.equal(info.workItemId, 470134);
  assert.equal(info.orgBase, 'https://dev.azure.com/dartcontainer');
  assert.equal(info.view, 'fullpage');
});

test('parses a taskboard/dialog URL via the workitem query param', () => {
  const info = parseAdoUrl(
    'https://dartcontainer.visualstudio.com/PPM1510%20-%20Pricing%20Excellence/_sprints/taskboard/Team/PPM1510/Sprint%2042?workitem=476404'
  );
  assert.equal(info.org, 'dartcontainer');
  assert.equal(info.project, 'PPM1510 - Pricing Excellence');
  assert.equal(info.workItemId, 476404);
  assert.equal(info.view, 'dialog');
  assert.equal(info.orgBase, 'https://dartcontainer.visualstudio.com');
});

test('parses a dev.azure.com boards dialog URL', () => {
  const info = parseAdoUrl('https://dev.azure.com/dartcontainer/Proj/_boards/board/t/Team?workitem=5');
  assert.equal(info.workItemId, 5);
  assert.equal(info.view, 'dialog');
});

test('org-level board/sprint hub is not mistaken for a project (web links stay valid)', () => {
  const vs = parseAdoUrl('https://dartcontainer.visualstudio.com/_boards/board/t/Team?workitem=5');
  assert.equal(vs.project, null);
  assert.equal(vs.workItemId, 5);
  assert.equal(buildWorkItemUrl(vs), 'https://dartcontainer.visualstudio.com/_workitems/edit/5');

  const da = parseAdoUrl('https://dev.azure.com/dartcontainer/_sprints/taskboard/Team?workitem=9');
  assert.equal(da.project, null);
  assert.equal(buildWorkItemUrl(da), 'https://dev.azure.com/dartcontainer/_workitems/edit/9');
});

test('ignores query string / trailing path after the id', () => {
  const info = parseAdoUrl('https://dev.azure.com/org/Proj/_workitems/edit/9/?foo=bar#x');
  assert.equal(info.workItemId, 9);
  assert.equal(info.view, 'fullpage');
});

test('returns null for hub pages with no work item open', () => {
  assert.equal(parseAdoUrl('https://dartcontainer.visualstudio.com/PPM1510/_boards/board'), null);
  assert.equal(parseAdoUrl('https://dev.azure.com/dartcontainer/Proj/_backlogs'), null);
  assert.equal(parseAdoUrl('https://dartcontainer.visualstudio.com/PPM1510/_sprints/taskboard/Team/PPM1510/Sprint%2042'), null);
});

test('ignores a non-numeric workitem param', () => {
  assert.equal(parseAdoUrl('https://dev.azure.com/dartcontainer/Proj/_boards/board?workitem=new'), null);
});

test('returns null for non-ADO hosts and junk', () => {
  assert.equal(parseAdoUrl('https://example.com/_workitems/edit/1'), null);
  assert.equal(parseAdoUrl('not a url'), null);
});

test('rejects dev.azure.com subdomains and look-alike hosts (credentialed-fetch hardening)', () => {
  assert.equal(parseAdoUrl('https://foo.dev.azure.com/org/Proj/_workitems/edit/5'), null); // subdomain not real ADO
  assert.equal(parseAdoUrl('https://dev.azure.com.evil.com/org/Proj/_workitems/edit/5'), null);
  assert.equal(parseAdoUrl('https://evil-dev.azure.com/org/_workitems/edit/5'), null);
  assert.equal(parseAdoUrl('https://notvisualstudio.com/Proj/_workitems/edit/5'), null);
  // the legitimate bare host still works
  assert.equal(parseAdoUrl('https://dev.azure.com/dartcontainer/Proj/_workitems/edit/5').workItemId, 5);
});

test('builds the work item REST URL (org-scoped, $expand=all)', () => {
  const info = parseAdoUrl('https://dartcontainer.visualstudio.com/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134');
  assert.equal(
    buildWorkItemRestUrl(info),
    'https://dartcontainer.visualstudio.com/_apis/wit/workitems/470134?$expand=all&api-version=7.1'
  );
  assert.equal(
    buildWorkItemRestUrl(info, 999),
    'https://dartcontainer.visualstudio.com/_apis/wit/workitems/999?$expand=all&api-version=7.1'
  );
});

test('builds the work item REST URL for dev.azure.com (org in path)', () => {
  const info = parseAdoUrl('https://dev.azure.com/dartcontainer/Proj/_boards/board?workitem=5');
  assert.equal(
    buildWorkItemRestUrl(info),
    'https://dev.azure.com/dartcontainer/_apis/wit/workitems/5?$expand=all&api-version=7.1'
  );
});

test('builds the fields-list REST URL (org-scoped)', () => {
  const info = parseAdoUrl('https://dev.azure.com/dartcontainer/Proj/_workitems/edit/5');
  assert.equal(buildFieldsUrl(info), 'https://dev.azure.com/dartcontainer/_apis/wit/fields?api-version=7.1');
});

test('builds the comments REST URL (org-scoped, preview api, renderedText)', () => {
  const info = parseAdoUrl('https://dartcontainer.visualstudio.com/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134');
  assert.equal(
    buildCommentsUrl(info),
    'https://dartcontainer.visualstudio.com/_apis/wit/workItems/470134/comments?$top=200&$expand=renderedText&api-version=7.1-preview.4'
  );
});

test('builds the comments REST URL for dev.azure.com (org in path)', () => {
  const info = parseAdoUrl('https://dev.azure.com/dartcontainer/Proj/_workitems/edit/5');
  assert.equal(
    buildCommentsUrl(info, { top: 50 }),
    'https://dev.azure.com/dartcontainer/_apis/wit/workItems/5/comments?$top=50&$expand=renderedText&api-version=7.1-preview.4'
  );
});

test('builds work item and parent web URLs (project-scoped for the browser)', () => {
  const info = parseAdoUrl('https://dev.azure.com/dartcontainer/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134');
  assert.equal(buildWorkItemUrl(info), 'https://dev.azure.com/dartcontainer/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134');
  assert.equal(buildParentUrl(info, 451728), 'https://dev.azure.com/dartcontainer/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/451728');
});
