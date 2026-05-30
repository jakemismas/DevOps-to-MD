// Supply-chain guard: verify the vendored UMD libraries match the exact bytes that were
// reviewed and pinned. Run via `npm run verify:vendor`. If a vendored file is ever
// re-copied or tampered with, the SHA-256 will not match and this exits non-zero.
//
// To intentionally update a vendored library: follow vendor/VENDOR.md, then replace the
// matching hash below with the value this script prints on mismatch.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXPECTED = {
  'vendor/turndown.umd.js': 'cdf933e0a2085df3c64d6c763331f04345f6c3b25746216e8f1426c9c5253045',
  'vendor/turndown-plugin-gfm.umd.js': 'cf744cc1b7580f06d64ce236a4ff2630a53d389eccf2133a09d71ca443511912',
};

const root = fileURLToPath(new URL('..', import.meta.url));
let failed = false;
for (const [rel, expected] of Object.entries(EXPECTED)) {
  let actual;
  try {
    actual = createHash('sha256').update(readFileSync(root + rel)).digest('hex');
  } catch (e) {
    console.error(`MISSING ${rel}: ${e.message}`);
    failed = true;
    continue;
  }
  if (actual === expected) {
    console.log(`OK   ${rel}`);
  } else {
    console.error(`FAIL ${rel}\n  expected ${expected}\n  actual   ${actual}`);
    failed = true;
  }
}
if (failed) {
  console.error('\nVendored library integrity check FAILED. If this change was intentional, see vendor/VENDOR.md.');
  process.exit(1);
}
console.log('\nAll vendored libraries verified.');
