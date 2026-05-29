// Assemble the final Markdown document. Pure: the HTML->Markdown converter is
// injected as `turndown(htmlString) -> markdownString` so this is testable in Node.

const HTML_SNIFF = /<[a-z][\s\S]*>/i;

/** One field -> markdown. format 0 (or sniffed-markdown) passes through verbatim;
 *  format 1 (or sniffed-HTML) is converted. Prevents mangling already-markdown fields. */
export function fieldToMarkdown(field, { turndown } = {}) {
  const value = field && field.value != null ? String(field.value) : '';
  if (value.trim() === '') return '';
  let fmt = field.format;
  if (fmt !== 0 && fmt !== 1) fmt = HTML_SNIFF.test(value) ? 1 : 0; // content-sniff unknown
  if (fmt === 0) return value.trim();
  return ((turndown ? turndown(value) : value) || '').trim();
}

export function formatCommentDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function commentsToMarkdown(comments, { turndown } = {}) {
  if (!comments || comments.length === 0) return '_(no comments)_';
  return comments.map((c) => {
    const body = ((turndown ? turndown(c.html || '') : (c.html || '')) || '').trim();
    const when = formatCommentDate(c.date);
    const head = when ? `**${c.author}** (${when})` : `**${c.author}**`;
    return `${head}\n\n${body}`;
  }).join('\n\n---\n\n');
}

export function parentToMarkdown(model) {
  if (model.parentId == null) return '_(no parent)_';
  return model.parentUrl ? `[${model.parentId}](${model.parentUrl})` : `${model.parentId}`;
}

/**
 * Build the document.
 *   model: { workItemId, title, parentId, parentUrl?, url?, fields, comments? }
 *   sectionList: from sections.mjs (content + synthetic Parent/Discussion)
 *   selections: { [slug]: boolean }
 */
export function assembleMarkdown(model, sectionList, selections, { turndown } = {}) {
  const header = [`# ${model.workItemId}: ${model.title}`];
  if (model.url) header.push(`[View in Azure DevOps](${model.url})`);

  let body = '';
  for (const section of sectionList) {
    if (!selections[section.slug]) continue;
    let content;
    if (section.synthetic === 'parent') {
      content = parentToMarkdown(model);
    } else if (section.synthetic === 'discussion') {
      content = commentsToMarkdown(model.comments || [], { turndown });
    } else {
      const parts = section.fieldRefs
        .map((ref) => fieldToMarkdown(model.fields[ref] || {}, { turndown }))
        .filter((s) => s && s.trim() !== '');
      content = parts.length ? parts.join('\n\n') : '_(empty)_'; // decision: empty -> placeholder
    }
    body += `\n\n## ${section.label}\n\n${content.trim()}`;
  }

  return (header.join('\n') + body).trim() + '\n';
}
