// The Markdown renderer of the dashboard pages (the same as journal.html): window.renderMarkdown(text, base), where
// base prefixes the relative links and images.
(() => {
  // A small Markdown renderer: headings, lists, tables, code blocks, inline code, bold, italic and links.
  let imageBase = '';
  const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function inline(text) {
    // Code spans first, set aside so that nothing inside them turns into bold, italic or links.
    const codes = [];
    return escapeHtml(text)
      .replace(/`([^`]+)`/g, (_, code) => `\u0000${codes.push(code) - 1}\u0000`)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) =>
        `<a href="${/^https?:/.test(src) ? src : imageBase + src}" target="_blank"><img src="${/^https?:/.test(src) ? src : imageBase + src}" alt="${alt}" title="${alt}"></a>`)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/(^|[\s(])_([^_\s][^_]*)_(?=$|[\s).,;:!?])/g, '$1<i>$2</i>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/(^|[^"])\[([^\]]+)\]\(([^)]+)\)/g, (_, before, label, href) =>
        `${before}<a href="${/^(https?:|#)/.test(href) ? href : imageBase + href}" target="_blank">${label}</a>`)
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]*[^\s<).,;:!?'"])/g, '$1<a href="$2" target="_blank">$2</a>')
      .replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${codes[index]}</code>`);
  }

  function markdown(source) {
    const lines = source.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*```/.test(line)) {
        const code = [];
        const language = line.trim().slice(3).trim();
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
        i++;
        out.push(`<pre${language ? ` data-lang="${escapeHtml(language)}"` : ''}>${escapeHtml(code.join('\n'))}</pre>`);
        continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }
      if (/^\s*>/.test(line)) {
        const quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
        out.push(`<blockquote>${markdown(quote.join('\n'))}</blockquote>`);
        continue;
      }
      const heading = /^(#{1,4})\s+(.*)$/.exec(line);
      if (heading) {
        const level = Math.min(heading[1].length, 3);
        out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        i++;
        continue;
      }
      if (/^\s*\|/.test(line)) {
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
        const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
        const body = rows.filter((row) => !/^\s*\|[\s:|-]+\|\s*$/.test(row));
        const [head, ...rest] = body;
        out.push(`<table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rest
          .map((row) => `<tr>${cells(row).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`);
        continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        const ordered = /^\s*\d/.test(line);
        const items = [];
        while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
          const depth = lines[i].match(/^\s*/)[0].length;
          let item = lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, '');
          // A continuation line (indented, not a new item) belongs to the item above.
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) item += ` ${lines[i++].trim()}`;
          const task = /^\[([ xX])\]\s+/.exec(item);
          if (task) item = item.slice(task[0].length);
          items.push(`<li style="margin-left:${depth * 8}px">${task ? (task[1] === ' ' ? '☐ ' : '☑ ') : ''}${inline(item)}</li>`);
        }
        out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
        continue;
      }
      if (line.trim() === '') {
        i++;
        continue;
      }
      const paragraph = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^(#|\s*```|\s*>|\s*\||\s*([-*+]|\d+[.)])\s)/.test(lines[i])) paragraph.push(lines[i++]);
      // A line ending in two spaces or a backslash is a hard break.
      out.push(`<p>${paragraph.map((one) => inline(one.replace(/(\s{2,}|\\)$/, '\u0001'))).join(' ').replace(/\u0001 /g, '<br>').replace(/\u0001/g, '')}</p>`);
    }
    return out.join('\n');
  }

  window.renderMarkdown = (source, base = '') => {
    imageBase = base;
    return markdown(source);
  };
})();
