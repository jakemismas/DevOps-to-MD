import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, '..', 'fixtures', 'workitem-470134.html');

export function loadFixtureHtml() {
  return readFileSync(FIXTURE, 'utf8');
}

// Mirrors how the harvester reads the page (document.getElementById('dataProviders'))
// but extracts from raw HTML for Node tests.
export function extractDataProviders(html) {
  const m = html.match(/<script id="dataProviders"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) throw new Error('dataProviders script tag not found in fixture');
  return JSON.parse(m[1]);
}

export function loadDataProviders() {
  return extractDataProviders(loadFixtureHtml());
}
