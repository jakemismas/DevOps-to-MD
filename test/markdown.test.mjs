import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataProviders } from './helpers/load-fixture.mjs';
import { getProviders, buildModelFromEmbedded } from '../src/lib/dataproviders.mjs';
import { buildSectionsFromLayout, injectSyntheticSections } from '../src/lib/sections.mjs';
import { assembleMarkdown, fieldToMarkdown, commentsToMarkdown, parentToMarkdown, looksLikeHtml } from '../src/lib/markdown.mjs';

// Deterministic fake converter: marks converted HTML so we can tell convert vs verbatim.
const fakeTurndown = (html) => 'CONV:' + String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

function buildModel() {
  const providers = getProviders(loadDataProviders());
  const model = buildModelFromEmbedded(providers);
  model.url = 'https://dartcontainer.visualstudio.com/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/470134';
  model.parentUrl = 'https://dartcontainer.visualstudio.com/PPM1510%20-%20Pricing%20Excellence/_workitems/edit/451728';
  model.comments = [
    { author: 'Ravi Bhagavathula', date: '2026-05-19T12:00:00Z', html: '<p>@Lily Doniger, can you please test it on Salesforce QA?</p>', text: '' },
  ];
  const sectionList = injectSyntheticSections(buildSectionsFromLayout(providers, model), model);
  return { model, sectionList };
}

function allOn(sectionList) {
  return Object.fromEntries(sectionList.map((s) => [s.slug, true]));
}

test('header is "# {id}: {title}" with a View link', () => {
  const { model, sectionList } = buildModel();
  const md = assembleMarkdown(model, sectionList, allOn(sectionList), { turndown: fakeTurndown });
  assert.ok(md.startsWith('# 470134: Navigate to PriceFx within Salesforce App\n'));
  assert.match(md, /\[View in Azure DevOps\]\(https:\/\/dartcontainer\.visualstudio\.com.*470134\)/);
});

test('HTML field is converted; Markdown field passes through verbatim', () => {
  const { model, sectionList } = buildModel();
  const md = assembleMarkdown(model, sectionList, allOn(sectionList), { turndown: fakeTurndown });
  // User Story is HTML (format 1) -> converted
  assert.match(md, /## User Story or Problem Statement\n\nCONV:.*As a Sales Team Member/);
  // Test Scenarios is Markdown (format 0) -> verbatim, NOT converted, backticks preserved
  assert.match(md, /## Test Scenarios\n\nSetup: Assign the Pricefx User permission set/);
  assert.match(md, /`dart--qa01\.sandbox\.lightning\.force\.com/);
  const testScenariosBlock = md.split('## Test Scenarios')[1].split('## ')[0];
  assert.ok(!testScenariosBlock.includes('CONV:'), 'markdown field must not be run through turndown');
});

test('empty selected section renders the placeholder', () => {
  const { model, sectionList } = buildModel();
  const md = assembleMarkdown(model, sectionList, allOn(sectionList), { turndown: fakeTurndown });
  assert.match(md, /## Description\n\n_\(empty\)_/);
  assert.match(md, /## Security Requirements\n\n_\(empty\)_/);
});

test('parent renders id-only as a link; discussion lists author/date/body', () => {
  const { model, sectionList } = buildModel();
  const md = assembleMarkdown(model, sectionList, allOn(sectionList), { turndown: fakeTurndown });
  assert.match(md, /## Parent\n\n\[451728\]\(https:\/\/dartcontainer.*451728\)/);
  assert.match(md, /## Discussion\n\n\*\*Ravi Bhagavathula\*\* \(/);
  assert.match(md, /CONV:.*can you please test it on Salesforce QA/);
});

test('unselected sections are omitted', () => {
  const { model, sectionList } = buildModel();
  const sel = allOn(sectionList);
  sel['acceptance-criteria'] = false;
  const md = assembleMarkdown(model, sectionList, sel, { turndown: fakeTurndown });
  assert.ok(!md.includes('## Acceptance Criteria'));
  assert.ok(md.includes('## User Story or Problem Statement'));
});

test('nothing selected -> only the header', () => {
  const { model, sectionList } = buildModel();
  const md = assembleMarkdown(model, sectionList, {}, { turndown: fakeTurndown });
  const expected = `# 470134: Navigate to PriceFx within Salesforce App\n[View in Azure DevOps](${model.url})`;
  assert.equal(md.trim(), expected);
});

test('fieldToMarkdown content-sniffs unknown format', () => {
  assert.equal(fieldToMarkdown({ value: 'plain **md** text', format: null }, { turndown: fakeTurndown }), 'plain **md** text');
  assert.equal(fieldToMarkdown({ value: '<p>hi</p>', format: null }, { turndown: fakeTurndown }), 'CONV:hi');
  assert.equal(fieldToMarkdown({ value: '', format: 1 }, { turndown: fakeTurndown }), '');
});

test('looksLikeHtml detects real markup but not Markdown that merely mentions tags', () => {
  // Real ADO HTML markup -> true
  assert.equal(looksLikeHtml('<div><b>x</b></div>'), true);   // closing tags
  assert.equal(looksLikeHtml('<a href="x">y</a>'), true);      // attribute-bearing tag
  assert.equal(looksLikeHtml('line<br>next'), true);            // void element
  assert.equal(looksLikeHtml('<img src="a.png" />'), true);     // self-closing
  // Markdown that only mentions tags / uses angle brackets -> false (must NOT be converted)
  assert.equal(looksLikeHtml('See <https://example.com> for details'), false); // autolink
  assert.equal(looksLikeHtml('Use the <video> element and <details>'), false);  // element-name mentions
  assert.equal(looksLikeHtml('Replace <your-org> with the org name'), false);   // placeholder
  assert.equal(looksLikeHtml('if a < b and c > d then stop'), false);           // comparisons
  // HTML/XML quoted inside a code fence -> false (it is literal Markdown content)
  assert.equal(looksLikeHtml('Example:\n\n```xml\n<members>force-app</members>\n```'), false);
  assert.equal(looksLikeHtml('Inline `<div>` token only'), false);
});

test('content-sniff no longer destroys Markdown fields containing angle-bracket tokens', () => {
  // Regression for the review finding: the old /<[a-z][\s\S]*>/i ran these through Turndown,
  // which deleted the bracketed content. They must pass through verbatim now.
  const autolink = 'See <https://example.com> for details';
  assert.equal(fieldToMarkdown({ value: autolink, format: null }, { turndown: fakeTurndown }), autolink);
  const fenced = 'Deploy:\n\n```xml\n<members>force-app</members>\n```';
  assert.equal(fieldToMarkdown({ value: fenced, format: null }, { turndown: fakeTurndown }), fenced);
  // genuine HTML still converts
  assert.equal(fieldToMarkdown({ value: '<div>real <b>html</b></div>', format: null }, { turndown: fakeTurndown }), 'CONV:real html');
});

test('parentToMarkdown / commentsToMarkdown placeholders', () => {
  assert.equal(parentToMarkdown({ parentId: null }), '_(no parent)_');
  assert.equal(parentToMarkdown({ parentId: 5 }), '5');
  assert.equal(commentsToMarkdown([], { turndown: fakeTurndown }), '_(no comments)_');
});
