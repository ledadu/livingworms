// Showing the words of the lineage (docs/chapitres.md, « Les textes »): fine letters
// that appear slowly, line after line, stay a while, then melt away. The opening of
// a chapter is told the first time we get there; coming back only whispers its name.

import chapitres from '../../docs/chapitres.md?raw';
import { holdTime, parseChapterTexts, textsOf, type TextKind } from './textes';

const TEXTS = parseChapterTexts(chapitres);
/** before the first line, between the start of two lines, a line coming in, the fade out (ms, as in style.css) */
const FIRST = 900, STEP = 1700, LINE_IN = 2600, FADE = 2400;

export interface Narrator {
  /** we enter the chapter: its opening the first time, then only its name */
  chapter(i: number): void;
  /** a text of the chapter now (the farewell when a generation stays behind); false if the document has none */
  tell(i: number, kind: TextKind): boolean;
  /** the chapters whose opening has been told */
  readonly told: Set<number>;
  /** while this is true (a panel covers the sea), the opening waits */
  quiet: () => boolean;
}

export function createNarrator(el: HTMLElement, chapters: { name: string }[]): Narrator {
  const told = new Set<number>();
  let timers: number[] = [];
  const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
  let waitTimer = 0;
  /** a farewell is being said until then (ms): an opening waits for it */
  let farewellUntil = 0;

  function show(name: string, lines: string[], kind: TextKind | 'name'): void {
    for (const id of timers) clearTimeout(id);
    timers = [];
    el.innerHTML = '';
    el.className = 'tell ' + kind;
    const label = document.createElement('small');
    label.textContent = name;
    el.append(label);
    const ps = lines.map((l) => {
      const p = document.createElement('p');
      p.textContent = l;
      el.append(p);
      return p;
    });
    void el.offsetWidth;
    el.classList.add('show');
    ps.forEach((p, k) => later(FIRST + k * STEP, () => p.classList.add('on')));
    const end = lines.length ? FIRST + (lines.length - 1) * STEP + LINE_IN + holdTime(lines) : 3600;
    farewellUntil = kind === 'farewell' ? performance.now() + end + FADE / 2 : 0;
    later(end, () => el.classList.remove('show'));
    later(end + FADE, () => { el.innerHTML = ''; });
  }

  function tell(i: number, kind: TextKind): boolean {
    const c = chapters[i], lines = c && textsOf(TEXTS, c.name, i)?.[kind];
    // nothing speaks over a farewell
    if (!lines?.length || (kind !== 'farewell' && performance.now() < farewellUntil)) return false;
    show(c.name, lines, kind);
    return true;
  }

  const narrator: Narrator = {
    told,
    tell,
    quiet: () => false,
    chapter(i) {
      if (!chapters[i]) return;
      clearTimeout(waitTimer);
      if (narrator.quiet() || performance.now() < farewellUntil) {
        // told when the sea shows again, if we are still there
        waitTimer = window.setTimeout(() => narrator.chapter(i), 600);
        return;
      }
      if (!told.has(i) && tell(i, 'opening')) { told.add(i); return; }
      show(chapters[i].name, [], 'name');
    }
  };
  return narrator;
}
