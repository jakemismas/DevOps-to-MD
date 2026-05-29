import test from 'node:test';
import assert from 'node:assert/strict';
import { storageKeyForOrg, mergeSelections, selectionsForStorage } from '../src/lib/prefs.mjs';

test('storage key is namespaced + lowercased per org', () => {
  assert.equal(storageKeyForOrg('Dartcontainer'), 'adoMd:sections:dartcontainer');
  assert.equal(storageKeyForOrg('dev-org'), 'adoMd:sections:dev-org');
});

test('first visit: everything OFF, all flagged new', () => {
  const { selections, newSlugs } = mergeSelections(undefined, [{ slug: 'a' }, { slug: 'b' }]);
  assert.deepEqual(selections, { a: false, b: false });
  assert.deepEqual([...newSlugs].sort(), ['a', 'b']);
});

test('return visit: stored values kept, only genuinely-new slugs flagged', () => {
  const { selections, newSlugs } = mergeSelections({ a: true, c: false }, [{ slug: 'a' }, { slug: 'b' }]);
  assert.equal(selections.a, true);   // kept ON
  assert.equal(selections.b, false);  // new -> OFF
  assert.deepEqual([...newSlugs], ['b']);
});

test('stored OFF stays OFF and is not "new"', () => {
  const { selections, newSlugs } = mergeSelections({ a: false }, [{ slug: 'a' }]);
  assert.equal(selections.a, false);
  assert.equal(newSlugs.size, 0);
});

test('(new) badge clears after the merged map is persisted', () => {
  const detected = [{ slug: 'a' }, { slug: 'b' }];
  const first = mergeSelections(undefined, detected);
  assert.ok(first.newSlugs.has('b'));
  const persisted = selectionsForStorage(first.selections); // popup writes this back
  const second = mergeSelections(persisted, detected);
  assert.equal(second.newSlugs.size, 0); // nothing new on the next visit
});

test('selectionsForStorage coerces to booleans', () => {
  assert.deepEqual(selectionsForStorage({ a: 1, b: 0, c: true }), { a: true, b: false, c: true });
});
