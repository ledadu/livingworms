// The words of the lineage (docs/chapitres.md, « Les textes »): an opening at the
// start of each chapter, a farewell when a generation stays behind, and the words
// of the end. They are read from the design document itself, so the texts are
// written there and nowhere in the code.

/** which text of a chapter */
export type TextKind = 'opening' | 'farewell' | 'final' | 'obstacle' | 'meeting';

export interface ChapterTexts {
  /** the number of the chapter in the document (1 to 10) */
  num: number;
  /** its heading, without the number: « La Grotte (200–250 m) *— nouveau chapitre…* » */
  title: string;
  opening?: string[];
  farewell?: string[];
  final?: string[];
  /** the first time its obstacle bars the way */
  obstacle?: string[];
  /** the first time we meet the cousin of the rival lineage (rivale.ts) */
  meeting?: string[];
}

/** the label before a quote in the document, and the text it gives */
const LABELS: [RegExp, TextKind][] = [
  [/^ouverture\b/i, 'opening'],
  [/^le retournement\b/i, 'opening'],
  [/^adieu\b/i, 'farewell'],
  [/^texte final\b/i, 'final'],
  [/^devant l['’]obstacle\b/i, 'obstacle'],
  [/^la rencontre\b/i, 'meeting']
];

/** at most this many lines on screen */
export const MAX_LINES = 4;
/** a lone line longer than this is broken at a comma */
const LONG = 48;

/** a text as the lines it is shown in: one sentence per line, typographic apostrophes, two to four lines */
export function toLines(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').replace(/'/g, '’').trim();
  if (!clean) return [];
  let lines = clean.split(/(?<=[.!?…»])\s+(?=[A-ZÀ-ÖØ-Þ«])/).map((s) => s.trim()).filter(Boolean);
  // a single long sentence: break it at the comma nearest its middle
  if (lines.length === 1 && lines[0].length > LONG) {
    const s = lines[0], mid = s.length / 2;
    let best = -1;
    for (let i = s.indexOf(','); i >= 0; i = s.indexOf(',', i + 1)) if (best < 0 || Math.abs(i - mid) < Math.abs(best - mid)) best = i;
    if (best > 8 && best < s.length - 8) lines = [s.slice(0, best + 1), s.slice(best + 1).trim()];
  }
  // too many sentences: the last ones share a line
  while (lines.length > MAX_LINES) lines.splice(MAX_LINES - 1, 2, lines[MAX_LINES - 1] + ' ' + lines[MAX_LINES]);
  return lines;
}

/** every chapter of the document with its texts, in the order of the document */
export function parseChapterTexts(md: string): ChapterTexts[] {
  const out: ChapterTexts[] = [];
  let cur: ChapterTexts | null = null, kind: TextKind | null = null, quote: string[] = [];
  const flush = () => {
    if (cur && kind && quote.length && !cur[kind]) cur[kind] = toLines(quote.join(' '));
    quote = [];
  };
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    const h = /^##\s+(\d+)\.\s+(.*)$/.exec(line);
    if (h) { flush(); kind = null; cur = { num: +h[1], title: h[2].trim() }; out.push(cur); continue; }
    if (/^#{1,2}\s/.test(line)) { flush(); kind = null; cur = null; continue; }
    if (!cur) continue;
    if (line.startsWith('>')) { if (kind) quote.push(line.replace(/^>\s?/, '')); continue; }
    if (quote.length) { flush(); kind = null; }
    if (!line) continue;
    // « Ouverture : », « Adieu (proposition, …) : », « Le retournement : »
    const label = LABELS.find(([re]) => re.test(line));
    kind = label && /:\s*$/.test(line) ? label[1] : null;
  }
  flush();
  return out;
}

/** the texts of a chapter, found by its name (« La Grotte »), else by its place in the story (0 = the first) */
export function textsOf(all: ChapterTexts[], name: string, index: number): ChapterTexts | undefined {
  const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return all.find((c) => plain(c.title).startsWith(plain(name))) ?? all.find((c) => c.num === index + 1);
}

/** how long a text stays once its last line is fully there (ms): a slow reading, never less than a few seconds */
export function holdTime(lines: string[]): number {
  const chars = lines.reduce((n, l) => n + l.length, 0);
  return Math.max(3500, 1000 + chars * 40);
}
