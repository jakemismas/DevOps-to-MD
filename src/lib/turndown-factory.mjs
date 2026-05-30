// Build a configured HTML->Markdown converter. The TurndownService constructor and
// (optional) GFM plugin are injected so the popup uses the vendored UMD globals while
// the conversion test uses the npm builds. Identical config either way.
//
// Returns: (htmlString) => markdownString

export function createTurndown(TurndownService, gfmPlugin) {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    strongDelimiter: '**',
    emDelimiter: '*',
    linkStyle: 'inlined',
  });

  if (gfmPlugin && typeof gfmPlugin.gfm === 'function') {
    td.use(gfmPlugin.gfm); // tables, strikethrough, task lists
  }

  // Drop empty/whitespace-only block wrappers (Azure DevOps emits many empty <div>s).
  td.addRule('dropEmptyBlocks', {
    filter(node) {
      if (!['DIV', 'P', 'SPAN'].includes(node.nodeName)) return false;
      try { if (node.querySelector && node.querySelector('img')) return false; } catch { /* ignore */ }
      const text = (node.textContent || '').replace(/ /g, ' ').trim();
      return text === '';
    },
    replacement() { return ''; },
  });

  // Render @mention spans as plain text.
  td.addRule('mention', {
    filter(node) {
      return node.nodeName === 'SPAN' && /(^|[\s-])mention/i.test(node.getAttribute && (node.getAttribute('class') || ''));
    },
    replacement(content) { return content; },
  });

  // Strip dangerous link schemes (javascript:, vbscript:, data:) down to plain text so
  // the copied Markdown can never carry an executable destination into wherever it is
  // pasted. Safe links fall through to Turndown's default inline-link rule.
  td.addRule('unsafeLink', {
    filter(node) {
      if (node.nodeName !== 'A') return false;
      const href = (node.getAttribute && node.getAttribute('href')) || '';
      return /^\s*(?:javascript|vbscript|data):/i.test(href);
    },
    replacement(content) { return content; },
  });

  // Azure DevOps inline images point at cookie-authenticated attachment URLs that
  // render as broken images once pasted outside the signed-in session. Emit a visible,
  // labeled link instead of a silently-broken ![](...).
  td.addRule('adoAttachmentImage', {
    filter(node) {
      return node.nodeName === 'IMG' &&
        /\/_apis\/wit\/attachments\//i.test((node.getAttribute && node.getAttribute('src')) || '');
    },
    replacement(_content, node) {
      const src = (node.getAttribute && node.getAttribute('src')) || '';
      let name = (node.getAttribute && node.getAttribute('alt')) || '';
      if (!name) {
        const m = /[?&]fileName=([^&]+)/i.exec(src);
        if (m) { try { name = decodeURIComponent(m[1]); } catch { name = m[1]; } }
      }
      return `[image: ${name || 'attachment'} (Azure DevOps attachment, requires sign-in)](${src})`;
    },
  });

  return (html) => td.turndown(html || '').replace(/\n{3,}/g, '\n\n');
}
