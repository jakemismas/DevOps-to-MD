import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixtureHtml, extractDataProviders } from './helpers/load-fixture.mjs';

// Gate: if the fixture is missing, unparseable, or not work item 470134, fail loudly
// so no downstream test can silently pass against bad data.
test('fixture provenance: #dataProviders parses', () => {
  const html = loadFixtureHtml();
  assert.match(html, /id="dataProviders"/, 'fixture must contain the dataProviders script');
  const root = extractDataProviders(html);
  assert.ok(root && root.data, 'parsed JSON must have a .data object');
});

test('fixture provenance: is work item 470134', () => {
  const root = extractDataProviders(loadFixtureHtml());
  const dp = root.data['ms.vss-work-web.work-item-data-provider'];
  assert.ok(dp, 'work-item-data-provider must be present');
  assert.equal(dp['work-item-id'], 470134, 'work item id must be 470134');
  assert.ok(dp['work-item-data'] && dp['work-item-data'].fields, 'work-item-data.fields must be present');
});
