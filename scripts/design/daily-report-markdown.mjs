// 보고서에 포함된 임의 HTML은 실행하지 않고 허용한 Markdown만 표시한다.
export function renderReportMarkdown(markdown, resolveHref = (value) => value) {
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
  function inline(value) {
    const pattern =
      /`([^`]+)`|\[([^\]]+)\]\((<[^>]+>|[^)]+)\)|\*\*([^*]+)\*\*/g;
    let output = '',
      from = 0;
    for (const match of value.matchAll(pattern)) {
      output += escape(value.slice(from, match.index));
      if (match[1]) output += `<code>${escape(match[1])}</code>`;
      else if (match[2]) {
        const href = match[3].replace(/^<|>$/g, '').trim();
        const allowed =
          !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href) ||
          /^https?:\/\//i.test(href);
        output += allowed
          ? `<a href="${escape(resolveHref(href))}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(match[2])}</a>`
          : escape(match[2]);
      } else output += `<strong>${escape(match[4])}</strong>`;
      from = match.index + match[0].length;
    }
    return output + escape(value.slice(from));
  }
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const result = [];
  const headingCounts = new Map();
  const cells = (line) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replace(/\\\|/g, '|'));
  const divider = (line = '') => /^\s*\|?\s*:?-{3,}/.test(line);
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^```/.test(line)) {
      const block = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) block.push(lines[i++]);
      result.push(`<pre><code>${escape(block.join('\n'))}</code></pre>`);
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)/.exec(line);
    if (heading) {
      const slug = heading[2]
        .replace(/[`*]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-');
      const count = headingCounts.get(slug) || 0;
      headingCounts.set(slug, count + 1);
      const level = Math.min(heading[1].length + 1, 6);
      result.push(
        `<h${level} id="doc-${slug}${count ? '-' + count : ''}">${inline(heading[2])}</h${level}>`,
      );
      i++;
      continue;
    }
    if (line.trim().startsWith('|') && divider(lines[i + 1])) {
      const headers = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|'))
        rows.push(cells(lines[i++]));
      result.push(
        `<div class="table-scroll" tabindex="0" role="region" aria-label="문서 표"><table><thead><tr>${headers.map((cell) => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
      );
      continue;
    }
    const list = /^\s*(?:[-*]|\d+\.)\s+/.exec(line);
    if (list) {
      const ordered = /^\s*\d/.test(line),
        items = [];
      while (i < lines.length && /^\s*(?:[-*]|\d+\.)\s+/.test(lines[i]))
        items.push(inline(lines[i++].replace(/^\s*(?:[-*]|\d+\.)\s+/, '')));
      const tag = ordered ? 'ol' : 'ul';
      result.push(
        `<${tag}>${items.map((item) => `<li>${item}</li>`).join('')}</${tag}>`,
      );
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      result.push('<hr>');
      i++;
      continue;
    }
    const paragraph = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(?:#|```|\||\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])
    )
      paragraph.push(lines[i++]);
    result.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return result.join('\n');
}

export function reportSection(markdown, title) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex(
    (line) => line.startsWith('## ') && line.includes(title),
  );
  if (start < 0) return '';
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith('## ')) end++;
  return lines.slice(start + 1, end).join('\n');
}

export function firstReportTable(section) {
  const lines = section.split('\n');
  const start = lines.findIndex(
    (line, i) =>
      line.trim().startsWith('|') &&
      /^\s*\|\s*:?-{3,}/.test(lines[i + 1] || ''),
  );
  if (start < 0) return [];
  const result = [];
  for (
    let i = start + 2;
    i < lines.length && lines[i].trim().startsWith('|');
    i++
  )
    result.push(
      lines[i]
        .trim()
        .replace(/^\||\|$/g, '')
        .split(/(?<!\\)\|/)
        .map((v) =>
          v
            .trim()
            .replace(/\\\|/g, '|')
            .replace(/`|\*\*/g, ''),
        ),
    );
  return result;
}

export function reportImprovementTables(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].trim();
    if (!header.startsWith('|') || !/^\s*\|\s*:?-{3,}/.test(lines[i + 1] || ''))
      continue;
    const labels = header
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((value) => value.trim());
    const matched =
      labels.length === 2 &&
      ((labels[0] === '문제' && labels[1] === '조치') ||
        (labels[0] === '개선 전' && labels[1] === '개선 후'));
    if (!matched) continue;
    let end = i + 2;
    while (end < lines.length && lines[end].trim().startsWith('|')) end++;
    result.push(
      ...firstReportTable(lines.slice(i, end).join('\n')).map(
        ([before, after]) => ({ before, after }),
      ),
    );
    i = end - 1;
  }
  return result;
}
