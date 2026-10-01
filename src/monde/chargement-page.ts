// The published page is a single file of a megabyte or more (vite-plugin-singlefile), and Vite puts its scripts in the
// head: a phone showed nothing until all of it had arrived. Moved to the end of the body, they let the loading screen
// of index.html (#chargement) show with the first kilobytes. Nothing else changes: the game is a module script, run
// once the page is parsed wherever it stands, and the JSON of the Nouveautés it reads is in the page by then.
import type { Plugin } from 'vite';

/** the page with the scripts of its head moved, in order, to the end of its body */
export function scriptsLast(html: string): string {
  const open = /<head\b[^>]*>/i.exec(html);
  if (!open) return html;
  const moved: string[] = [];
  let head = '', i = open.index + open[0].length;
  // an inline script never holds « </script> », but its code may hold « </head> »: walk the head script by script
  for (;;) {
    const s = html.indexOf('<script', i), e = html.indexOf('</head>', i);
    if (e < 0) return html;
    if (s < 0 || s > e) { head += html.slice(i, e); i = e; break; }
    const end = html.indexOf('</script>', s);
    if (end < 0) return html;
    head += html.slice(i, s).replace(/[ \t]*$/, '');
    moved.push(html.slice(s, end + 9));
    i = end + 9;
  }
  const b = html.lastIndexOf('</body>');
  if (!moved.length || b < i) return html;
  return html.slice(0, open.index + open[0].length) + head.replace(/\n\s*\n/g, '\n') + html.slice(i, b) + moved.join('\n') + '\n' + html.slice(b);
}

/** at build, after vite-plugin-singlefile has written the scripts into the page */
export function chargementPlugin(): Plugin {
  return {
    name: 'la-lignee:chargement',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle))
        if (file.type === 'asset' && file.fileName.endsWith('.html') && typeof file.source === 'string') file.source = scriptsLast(file.source);
    }
  };
}
