// The circle of notes (chant.ts): a button at the bottom opens it; the notes learned sit around the swimmer, the
// others are faint dots. A finger traces a song from note to note (each sounds as it is touched), and the song is
// sung when the finger lifts. A single touch on a note sings that note. Keys: 1 to 9, Enter, Backspace, Escape.

import { NOTES, extend, noteColour, ringSpots, spotsAlong, type Note, type Spot } from './chant';
import './chant.css';

export interface CercleDeps {
  /** whether the note of this rank (NOTES) has been learned */
  known(i: number): boolean;
  /** a note touched while tracing */
  touch(i: number): void;
  /** the song traced, when the finger lifts */
  sing(song: number[]): void;
  /** where the swimmer is on the screen: the circle opens around it */
  centre?(): Spot | null;
}

export interface Cercle {
  readonly isOpen: boolean;
  readonly button: HTMLButtonElement;
  open(): void;
  close(): void;
  /** the notes learned changed: the button shows once there is one */
  refresh(): void;
  /** a note just learned: the button glows with its colour, and the lineage says it */
  learned(n: Note): void;
}

const SVG = 'http://www.w3.org/2000/svg';
const ICON = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">'
  + '<circle cx="12" cy="12" r="8" stroke-opacity="0.35"/><path d="M8.2 13.4c1.3-3 2.5-3 3.8 0s2.5 3 3.8 0"/>'
  + '<circle cx="12" cy="4" r="1.6" fill="currentColor"/><circle cx="19" cy="15.5" r="1.6" fill="currentColor"/><circle cx="5" cy="15.5" r="1.6" fill="currentColor"/></svg>';
/** how near a note the finger must pass (px) */
const TOUCH = 30;

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

export function initCercle(d: CercleDeps): Cercle {
  const button = document.createElement('button');
  button.id = 'chBtn';
  button.type = 'button';
  button.title = 'Chanter';
  button.setAttribute('aria-label', 'Chanter');
  button.innerHTML = ICON;
  button.hidden = true;
  const say = document.createElement('p');
  say.id = 'chSay';
  say.setAttribute('aria-live', 'polite');
  document.body.append(button, say);

  const root = document.createElement('div');
  root.id = 'chant';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Le chant');
  root.tabIndex = -1;
  const svg = el('svg');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ch-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Fermer');
  root.append(svg, close);
  document.body.append(root);

  // the sea behind must not follow the finger that traces
  for (const e of [root, button]) for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchmove']) e.addEventListener(ev, (x) => x.stopPropagation());
  button.addEventListener('click', () => (cercle.isOpen ? cercle.close() : cercle.open()));
  close.addEventListener('click', () => cercle.close());

  let spots: Spot[] = [], song: number[] = [], finger: Spot | null = null, last: Spot | null = null, moved = false;
  let line: SVGGElement, live: SVGPathElement, groups: SVGGElement[] = [];

  function build(): void {
    const W = window.innerWidth, H = window.innerHeight, r = Math.max(112, Math.min(210, Math.min(W, H) * 0.34));
    // around the swimmer, as long as the whole circle stays on the screen
    const me = d.centre?.(), mx = Math.min(W / 2, r + 60), my = Math.min(H / 2, r + 100);
    const cx = Math.max(mx, Math.min(W - mx, me?.x ?? W / 2)), cy = Math.max(my, Math.min(H - my, me?.y ?? H / 2));
    spots = ringSpots(cx, cy, r);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();
    svg.append(el('circle', { cx, cy, r, class: 'ch-ring' }));
    const title = el('text', { x: cx, y: Math.max(40, cy - r - 84), class: 'ch-title' });
    title.textContent = 'Le chant';
    const hint = el('text', { x: cx, y: Math.min(H - 24, cy + r + 76), class: 'ch-hint' });
    hint.textContent = NOTES.filter((_, i) => d.known(i)).length > 1 ? 'Trace du doigt, d’une note à l’autre' : 'Touche la note pour la chanter';
    line = el('g', { class: 'ch-line' });
    live = el('path', { class: 'ch-line ch-live' });
    svg.append(title, hint, line, live);
    groups = NOTES.map((n, i) => {
      const s = spots[i], g = el('g', { class: 'ch-note', transform: `translate(${s.x} ${s.y})` });
      g.style.setProperty('--c', noteColour(n));
      if (!d.known(i)) {
        g.classList.add('ch-unknown');
        g.append(el('circle', { r: 3.2 }));
      } else {
        g.setAttribute('role', 'button');
        g.setAttribute('tabindex', '0');
        g.setAttribute('aria-label', n.name);
        g.append(el('circle', { r: 25, class: 'ch-halo' }), el('path', { d: n.glyph, transform: 'scale(1.3) translate(-12 -12)', class: 'ch-glyph' }));
        const name = el('text', { y: s.y < cy - 1 ? -36 : 44, class: 'ch-name' });
        name.textContent = n.name;
        g.append(name);
        // Enter or Space adds the note; Enter on the note just added sings
        g.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();
          if (e.key === 'Enter' && song[song.length - 1] === i) sing(); else add(i);
        });
      }
      svg.append(g);
      return g;
    });
  }

  function draw(): void {
    // each stretch of the trace in the colour of the note it goes to
    line.replaceChildren(...song.slice(1).map((i, k) => {
      const a = spots[song[k]], b = spots[i], seg = el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      seg.style.color = noteColour(NOTES[i]);
      return seg;
    }));
    const from = spots[song[song.length - 1]];
    live.setAttribute('d', from && finger ? `M${from.x.toFixed(1)} ${from.y.toFixed(1)}L${finger.x.toFixed(1)} ${finger.y.toFixed(1)}` : '');
    live.style.color = song.length ? noteColour(NOTES[song[song.length - 1]]) : 'transparent';
  }

  function add(i: number): void {
    if (!extend(song, i, d.known)) return;
    d.touch(i);
    const g = groups[i];
    g.classList.remove('on');
    void g.getBoundingClientRect();
    g.classList.add('on');
    draw();
  }

  function sing(): void {
    const s = song;
    song = [];
    if (s.length) { d.sing(s); cercle.close(); }
  }

  const at = (e: PointerEvent): Spot => ({ x: e.clientX, y: e.clientY });
  root.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('.ch-close')) return;
    root.setPointerCapture?.(e.pointerId);
    song = [];
    moved = false;
    last = finger = at(e);
    for (const i of spotsAlong(spots, last.x, last.y, last.x, last.y, TOUCH)) add(i);
    draw();
  });
  root.addEventListener('pointermove', (e) => {
    if (!last) return;
    const p = at(e);
    if (Math.hypot(p.x - last.x, p.y - last.y) > 4) moved = true;
    for (const i of spotsAlong(spots, last.x, last.y, p.x, p.y, TOUCH)) add(i);
    last = finger = p;
    draw();
  });
  const lift = () => {
    if (!last) return;
    last = finger = null;
    // a touch away from every note, without tracing, closes the circle
    if (!song.length && !moved) { cercle.close(); return; }
    sing();
  };
  root.addEventListener('pointerup', lift);
  root.addEventListener('pointercancel', () => { last = finger = null; song = []; draw(); });
  root.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') cercle.close();
    else if (/^[1-9]$/.test(e.key)) add(+e.key - 1);
    else if (e.key === 'Backspace') { song.pop(); draw(); }
    else if (e.key === 'Enter' && song.length) sing();
  });
  root.addEventListener('keyup', (e) => e.stopPropagation());
  window.addEventListener('resize', () => { if (cercle.isOpen) { build(); draw(); } });

  let sayTimer = 0;
  const cercle: Cercle = {
    get isOpen() { return !root.hidden; },
    button,
    open() {
      if (cercle.isOpen || button.hidden) return;
      song = [];
      build();
      draw();
      root.hidden = false;
      void root.offsetWidth;
      root.classList.add('show');
      root.focus({ preventScroll: true });
    },
    close() {
      if (!cercle.isOpen) return;
      root.classList.remove('show');
      root.hidden = true;
      last = finger = null;
      button.focus({ preventScroll: true });
    },
    refresh() {
      button.hidden = !NOTES.some((_, i) => d.known(i));
    },
    learned(n) {
      cercle.refresh();
      button.style.setProperty('--c', noteColour(n));
      button.classList.remove('new');
      void button.offsetWidth;
      button.classList.add('new');
      say.replaceChildren('Ici, nous avons appris ', Object.assign(document.createElement('em'), { textContent: n.name }), '.');
      say.style.setProperty('--c', noteColour(n));
      say.classList.add('show');
      clearTimeout(sayTimer);
      sayTimer = window.setTimeout(() => say.classList.remove('show'), 5200);
    }
  };
  return cercle;
}
