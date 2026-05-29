import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeComments, fetchAllComments } from '../src/lib/comments.mjs';

test('normalizes a REST page object (author, date, rendered html)', () => {
  const page = { comments: [
    { createdBy: { displayName: 'Ravi Bhagavathula' }, createdDate: '2026-05-19T12:00:00Z',
      renderedText: '<p>@Lily Doniger, can you please test it on Salesforce QA?</p>',
      text: '@Lily Doniger, can you please test it on Salesforce QA?' }
  ]};
  const [c] = normalizeComments(page);
  assert.equal(c.author, 'Ravi Bhagavathula');
  assert.equal(c.date, '2026-05-19T12:00:00Z');
  assert.match(c.html, /Salesforce QA/);
});

test('falls back to text when renderedText missing; Unknown author', () => {
  const [c] = normalizeComments([{ createdDate: 'd', text: 'hello' }]);
  assert.equal(c.author, 'Unknown');
  assert.equal(c.html, 'hello');
});

test('filters deleted comments', () => {
  const out = normalizeComments({ comments: [{ text: 'a' }, { text: 'b', isDeleted: true }] });
  assert.equal(out.length, 1);
  assert.equal(out[0].text, 'a');
});

test('handles empty / missing input', () => {
  assert.deepEqual(normalizeComments(null), []);
  assert.deepEqual(normalizeComments({}), []);
});

test('fetchAllComments concatenates pages and terminates on no token', async () => {
  const pages = {
    'u?$top=200': { comments: [{ text: 'a' }, { text: 'b' }], continuationToken: 'T1' },
    'u?$top=200&continuationToken=T1': { comments: [{ text: 'c' }] },
  };
  const calls = [];
  const fetchJson = async (u) => { calls.push(u); return pages[u]; };
  const { comments, truncated } = await fetchAllComments(fetchJson, 'u?$top=200');
  assert.deepEqual(comments.map(c => c.text), ['a', 'b', 'c']);
  assert.equal(truncated, false);
  assert.equal(calls.length, 2);
});

test('fetchAllComments respects maxPages cap and flags truncation', async () => {
  const fetchJson = async () => ({ comments: [{ text: 'x' }], continuationToken: 'always' });
  const { comments, truncated } = await fetchAllComments(fetchJson, 'url', { maxPages: 3 });
  assert.equal(comments.length, 3);
  assert.equal(truncated, true);
});
