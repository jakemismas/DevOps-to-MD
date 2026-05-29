// Build a configured HTML->Markdown converter. The TurndownService constructor and
// (optional) GFM plugin are injected so the popup uses the vendored UMD globals while
// the conversion test uses the npm builds — identical config either way.
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

  return (html) => td.turndown(html || '').replace(/\n{3,}/g, '\n\n');
}
