// Just enough Markdown for the policy pages in docs/: headings, paragraphs, lists, tables, links,
// **bold** and _italic_. Text is HTML-escaped before any markup is added, and links may only point
// to http(s), mailto or this site.

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Maps relative links between the docs (e.g. "terms.md") to their URLs on this site. */
export type LinkMap = Record<string, string>;

function inline(text: string, links: LinkMap): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
      const href = links[url] ?? url;
      return /^(https?:|mailto:|\/)/i.test(href) ? `<a href="${href}">${label}</a>` : label;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_(.+?)_(?=$|[\s).,;:!?])/g, '$1<em>$2</em>');
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

export function renderMarkdown(markdown: string, links: LinkMap = {}): string {
  const lines = markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim());
  const html: string[] = [];
  const paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(' '), links)}</p>`);
    paragraph.length = 0;
  };

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const list = /^([-*]|\d+\.)\s+/.exec(line);

    if (!line) {
      flush();
      i++;
    } else if (heading) {
      flush();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2], links)}</h${level}>`);
      i++;
    } else if (list) {
      flush();
      const tag = /\d/.test(list[1]) ? 'ol' : 'ul';
      const items: string[] = [];
      for (let m; i < lines.length && (m = /^([-*]|\d+\.)\s+(.*)$/.exec(lines[i])); i++) items.push(`<li>${inline(m[2], links)}</li>`);
      html.push(`<${tag}>${items.join('')}</${tag}>`);
    } else if (line.startsWith('|') && /^\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
      flush();
      const head = cells(line).map((c) => `<th>${inline(c, links)}</th>`);
      const rows: string[] = [];
      for (i += 2; i < lines.length && lines[i].startsWith('|'); i++) {
        rows.push(`<tr>${cells(lines[i]).map((c) => `<td>${inline(c, links)}</td>`).join('')}</tr>`);
      }
      html.push(`<div class="table"><table><thead><tr>${head.join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
    } else {
      paragraph.push(line);
      i++;
    }
  }
  flush();
  return html.join('\n');
}
