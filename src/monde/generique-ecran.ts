// The credits (generique.ts): at the end of the story the whole lineage goes up the screen, generation after
// generation, each with its portrait, its name, where it was born and the partner of its child. Then the tree becomes
// an image to keep (generique-image.ts), with a button to download it, except where downloads are blocked (the
// Artifact link of claude.ai). A finger held on the credits hurries them; « Passer » goes straight to the image.

import chapitres from '../../docs/chapitres.md?raw';
import { spec as makeSpec, type Spec } from '../engine';
import { snapshot3 } from '../engine3/snapshot3';
import { SPECIES } from '../content/species';
import { backWords, generationLabel, generations, originWords, type Generation } from './arbre';
import { wordsOf } from './chant';
import type { Ancestor, Mate } from './partie';
import { css, type HSL } from './palette';
import { parseChapterTexts, textsOf } from './textes';
import { bandColour, downloadsBlocked, rollMs, souvenirFileName } from './generique';
import { drawSouvenir, fontsReady } from './generique-image';
import './generique.css';

export interface GeneriqueDeps {
  partie: { readonly lineage: Ancestor[] };
  chapters: readonly { id: string; name: string; top: HSL; deep: HSL }[];
  /** the creature played now: the last generation */
  live(): Spec;
  /** the names of the notes of the song this generation learned (chant.ts) */
  notes?(rank: number): string[];
  /** the credits cover the sea: the game waits */
  onOpen?(): void;
  onClose?(): void;
  /** the credits have gone by to the end: the story is over */
  onEnd?(): void;
}

export interface Generique {
  readonly isOpen: boolean;
  /** 'roll' while the credits go by, 'souvenir' on the image, '' when closed */
  readonly stage: '' | 'roll' | 'souvenir';
  /** the credits, then the image */
  play(): void;
  /** straight to the image */
  souvenir(): void;
  /** from the credits to the image */
  skip(): void;
  close(): void;
  /** the image shown, once drawn (for the tests) */
  readonly image: HTMLCanvasElement | null;
  /** whether the image can be downloaded here */
  readonly canKeep: boolean;
}

const TITLE = 'Tous ceux que nous avons été';
const END_WORDS = (() => {
  const all = parseChapterTexts(chapitres);
  return textsOf(all, 'La Remontée', all.length - 1)?.final ?? [];
})();
/** the portraits: a generation, a partner (px, before the screen's density) */
const BIG = { w: 230, h: 172, pad: 14, max: 6 }, SMALL = { w: 120, h: 88, pad: 8, max: 5.5 };

/** the portraits drawn, per creature and per partner species, for the credits and the image */
const drawn = new WeakMap<object, HTMLCanvasElement>();
const mates = new Map<string, HTMLCanvasElement>();

function where(): Parameters<typeof downloadsBlocked>[0] {
  let framed = true;
  try { framed = window.top !== window.self; } catch { /* a foreign frame around us */ }
  return { hostname: location.hostname, search: location.search, framed, ancestors: Array.from(location.ancestorOrigins ?? []), referrer: document.referrer };
}

export function initGenerique(d: GeneriqueDeps): Generique {
  const canKeep = !downloadsBlocked(where());
  const root = document.createElement('div');
  root.id = 'generique';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Le générique');
  root.tabIndex = -1;
  document.body.append(root);
  // the sea behind must not follow the finger
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchmove']) root.addEventListener(ev, (e) => e.stopPropagation());

  let stage: Generique['stage'] = '';
  let gens: Generation[] = [];
  let jobs: (() => void)[] = [];
  let raf = 0;
  let roll: Animation | null = null;
  let image: HTMLCanvasElement | null = null;
  let url = '';
  let live: Spec | null = null;
  /** each opening, so that a moment left from the one before does nothing */
  let run = 0;

  const chapter = (id: string) => d.chapters.find((c) => c.id === id) ?? d.chapters[0];
  /** « a appris l’éclat », as in the tree, or '' */
  const learned = (g: Generation) => { const n = d.notes?.(g.rank); return n?.length ? `a appris ${wordsOf(n)}` : ''; };

  const creatureOf = (g: Generation): Spec | null => {
    if (g.current) return live;
    try { return makeSpec(g.creature as Parameters<typeof makeSpec>[0]); } catch { return null; /* a creature the engine no longer reads */ }
  };
  const keyOf = (g: Generation): object => (g.current && live ? live : g.creature);

  /** a portrait, drawn at its size whatever the screen, then shown wherever it is needed */
  function draw(sp: Spec | null, o: typeof BIG): HTMLCanvasElement | null {
    if (!sp) return null;
    const cv = document.createElement('canvas');
    snapshot3(sp, cv, o);
    return cv;
  }
  const portraitOf = (g: Generation) => {
    const k = keyOf(g);
    let cv = drawn.get(k);
    if (!cv) { const c = draw(creatureOf(g), BIG); if (c) drawn.set(k, (cv = c)); }
    return cv ?? null;
  };
  const mateOf = (m: Mate) => {
    let cv = mates.get(m.id);
    if (!cv && m.id && SPECIES[m.id]) { const c = draw(SPECIES[m.id](), SMALL); if (c) mates.set(m.id, (cv = c)); }
    return cv ?? null;
  };

  /** a place for a portrait in the credits, filled a bit later (drawSome), the first ones first */
  function frame(cls: string, water: HSL, get: () => HTMLCanvasElement | null): HTMLElement {
    const el = document.createElement('div');
    el.className = cls;
    el.style.setProperty('--water', css({ ...water, l: Math.min(40, water.l + 16) }));
    el.style.setProperty('--deep', css({ ...water, l: Math.max(4, water.l - 6) }));
    jobs.push(() => {
      const cv = get();
      if (!cv) return;
      // the same portrait goes into the image: shown here as a copy
      const copy = document.createElement('canvas');
      copy.width = cv.width;
      copy.height = cv.height;
      copy.getContext('2d')?.drawImage(cv, 0, 0);
      el.append(copy);
    });
    return el;
  }

  /** a portrait costs about 10 ms on a computer, more on a phone: a few per frame, at least one */
  function drawSome(): void {
    raf = 0;
    const t0 = performance.now();
    while (jobs.length) { jobs.shift()!(); if (performance.now() - t0 > 12) break; }
    if (jobs.length) raf = requestAnimationFrame(drawSome);
  }

  function buildRoll(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'gq-roll';
    const head = document.createElement('header');
    head.innerHTML = `<small>La Lignée</small><h2>${TITLE}</h2>`;
    list.append(head);
    gens.forEach((g, i) => {
      const water = bandColour(chapter(g.bornIn));
      const gen = document.createElement('section');
      gen.className = g.current ? 'gq-gen gq-now' : 'gq-gen';
      const label = document.createElement('small');
      label.textContent = generationLabel(g.rank);
      const name = document.createElement('p');
      name.className = 'gq-name';
      name.textContent = g.name;
      const born = document.createElement('p');
      born.className = 'gq-born';
      born.textContent = originWords(g, chapter(g.bornIn).name);
      gen.append(frame('gq-portrait', water, () => portraitOf(g)), label, name, born);
      const notes = learned(g);
      if (notes) gen.append(Object.assign(document.createElement('p'), { className: 'gq-notes', textContent: notes }));
      list.append(gen);
      if (i === gens.length - 1) return;
      const join = document.createElement('div');
      join.className = 'gq-join';
      const m = g.partner;
      if (m) {
        const words = document.createElement('p');
        words.textContent = `avec ${m.name}`;
        if (m.id && SPECIES[m.id]) join.append(frame('gq-mini', bandColour(chapter(gens[i + 1].bornIn)), () => mateOf(m)));
        join.append(words);
      } else if (g.back) {
        join.classList.add('gq-back');
        join.append(Object.assign(document.createElement('p'), { textContent: backWords(g.back) }));
      }
      list.append(join);
    });
    const end = document.createElement('p');
    end.className = 'gq-end';
    end.textContent = 'La Lignée';
    list.append(end);
    return list;
  }

  function hurry(on: boolean): void {
    if (roll) roll.playbackRate = on ? 6 : 1;
  }

  function open(): void {
    run++;
    d.onOpen?.();
    live = d.live();
    gens = generations(d.partie.lineage, live as unknown as Ancestor['creature'], d.chapters[0]?.id ?? '');
    jobs = [];
    root.replaceChildren();
    root.hidden = false;
    void root.offsetWidth;
    root.classList.add('show');
    root.focus({ preventScroll: true });
  }

  function startRoll(): void {
    stage = 'roll';
    const list = buildRoll();
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'gq-skip';
    skip.textContent = 'Passer';
    skip.addEventListener('click', () => g.skip());
    root.append(list, skip);
    // from under the screen until the name of the game stands in its middle, a moment, then the image
    const end = list.lastElementChild as HTMLElement, from = root.clientHeight, to = from / 2 - (end.offsetTop + end.offsetHeight / 2);
    roll = list.animate([{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }], { duration: rollMs(-to, from), easing: 'linear', fill: 'forwards' });
    const at = run;
    roll.onfinish = () => { setTimeout(() => { if (stage === 'roll' && run === at) void showSouvenir(true); }, 2600); };
    if (!raf && jobs.length) raf = requestAnimationFrame(drawSome);
  }

  /** the image, at the end of the credits (the story is over) or on its own */
  async function showSouvenir(end: boolean): Promise<void> {
    stage = 'souvenir';
    const at = run;
    // (the credits stay where they are while they fade out)
    roll?.pause();
    roll = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    jobs = [];
    const box = document.createElement('div');
    box.className = 'gq-souvenir';
    box.innerHTML = '<small>L’image souvenir</small>';
    const frameEl = document.createElement('div');
    frameEl.className = 'gq-frame';
    const actions = document.createElement('div');
    actions.className = 'gq-actions';
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'gq-go';
    go.textContent = 'Continuer';
    go.addEventListener('click', () => g.close());
    box.append(frameEl, actions);
    // the credits fade out, the image comes in
    for (const el of root.children) el.classList.add('gq-gone');
    root.append(box);
    if (end) d.onEnd?.();
    await fontsReady();
    if (run !== at || !g.isOpen) return;
    const title = TITLE, foot = END_WORDS;
    const { canvas } = drawSouvenir({ gens, chapters: d.chapters, portrait: portraitOf, mate: mateOf, notes: learned, title, foot });
    image = canvas;
    const img = document.createElement('img');
    img.alt = 'L’arbre de la lignée, en image';
    frameEl.append(img);
    const blob = await new Promise<Blob | null>((r) => { try { canvas.toBlob(r, 'image/jpeg', 0.9); } catch { r(null); } });
    if (run !== at || !g.isOpen) return;
    if (url) URL.revokeObjectURL(url);
    url = blob ? URL.createObjectURL(blob) : '';
    img.src = url || canvas.toDataURL('image/jpeg', 0.9);
    if (canKeep) {
      const keep = document.createElement('a');
      keep.className = 'gq-keep';
      keep.textContent = 'Garder l’image';
      keep.href = img.src;
      keep.download = souvenirFileName(gens[gens.length - 1]?.name ?? '');
      actions.append(keep);
    }
    actions.append(go);
    box.classList.add('ready');
    for (const el of [...root.children]) if (el.classList.contains('gq-gone')) setTimeout(() => el.remove(), 1200);
    root.focus({ preventScroll: true });
  }

  // a finger or a key held hurries the credits
  root.addEventListener('pointerdown', (e) => { if (stage === 'roll' && !(e.target as HTMLElement).closest('button')) hurry(true); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) root.addEventListener(ev, () => hurry(false));
  root.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { if (stage === 'roll') g.skip(); else g.close(); }
    else if (stage === 'roll' && (e.key === ' ' || e.key === 'ArrowDown')) { e.preventDefault(); hurry(true); }
  });
  root.addEventListener('keyup', (e) => { e.stopPropagation(); if (e.key === ' ' || e.key === 'ArrowDown') hurry(false); });

  const reduced = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const g: Generique = {
    get isOpen() { return !root.hidden; },
    get stage() { return stage; },
    get image() { return image; },
    canKeep,
    play() {
      if (g.isOpen) return;
      open();
      // without motion, the tree comes at once as the image
      if (reduced()) void showSouvenir(true); else startRoll();
    },
    souvenir() {
      if (g.isOpen) { if (stage === 'roll') g.skip(); return; }
      open();
      void showSouvenir(false);
    },
    skip() {
      if (stage === 'roll') void showSouvenir(true);
    },
    close() {
      if (!g.isOpen) return;
      roll?.cancel();
      roll = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      jobs = [];
      stage = '';
      image = null;
      live = null;
      root.classList.remove('show');
      root.hidden = true;
      root.replaceChildren();
      if (url) URL.revokeObjectURL(url);
      url = '';
      d.onClose?.();
    }
  };
  return g;
}

/** the button under the lineage tree that opens the image again, once the story is over */
export function souvenirButton(open: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ar-souvenir';
  b.textContent = 'L’image souvenir';
  b.addEventListener('click', open);
  return b;
}
