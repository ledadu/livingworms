import { describe, expect, it } from 'vitest';
import { scriptsLast } from './chargement-page';
import html from '../../index.html?raw';

const page = (head: string, body: string): string => `<!doctype html>\n<html>\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;

describe('scriptsLast', () => {
  it('moves the scripts of the head, in order, to the end of the body', () => {
    const doc = page('<meta charset="utf-8">\n  <script type="module">a()</script>\n  <style>p{}</style>\n  <script type="application/json" id="d">{}</script>', '<div id="chargement"></div>');
    const out = scriptsLast(doc);
    const at = (s: string): number => out.indexOf(s);
    expect(at('<script type="module">a()</script>')).toBeGreaterThan(at('<div id="chargement">'));
    expect(at('<script type="application/json"')).toBeGreaterThan(at('a()</script>'));
    expect(at('</body>')).toBeGreaterThan(at('{}</script>'));
    expect(at('<style>p{}</style>')).toBeLessThan(at('</head>'));
    expect(out.match(/<script/g)).toHaveLength(2);
  });

  it('is not fooled by a « </head> » inside the code', () => {
    const doc = page('<script type="module">const s = "</head><body>";</script>', '<p>x</p>');
    const out = scriptsLast(doc);
    expect(out.indexOf('const s')).toBeGreaterThan(out.indexOf('<p>x</p>'));
    expect(out.indexOf('</head>')).toBeLessThan(out.indexOf('<p>x</p>'));
  });

  it('leaves a page without scripts in its head as it is', () => {
    const doc = page('<title>t</title>', '<p>x</p><script>b()</script>');
    expect(scriptsLast(doc)).toBe(doc);
    expect(scriptsLast('<p>no head</p>')).toBe('<p>no head</p>');
  });
});

describe('index.html', () => {
  it('opens its body on the loading screen, before any script', () => {
    const body = html.slice(html.indexOf('<body>'));
    expect(body.indexOf('<div id="chargement"')).toBeGreaterThan(0);
    expect(body.indexOf('<div id="chargement"')).toBeLessThan(body.indexOf('<script'));
  });

  it('has no stylesheet that holds the first paint back', () => {
    for (const link of html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g) ?? []) expect(link).toMatch(/media="print"/);
  });
});
