// The lineage tree on the screen (arbre.ts): a button in the corner opens it at any time. The generations go down
// as the lineage did, from the first larva to the one played, each with its portrait, its name (touched, it can be
// changed), where it was born, and the partner of its child on the thread between them.

import { spec as makeSpec, type Spec } from '../engine';
import { snapshot3 } from '../engine3/snapshot3';
import { SPECIES } from '../content/species';
import { NAME_MAX, backWords, cleanName, generationLabel, generations, originWords, type Generation } from './arbre';
import type { Ancestor } from './partie';
import { wordsOf } from './chant';
import { initVivants, type Vivants } from './arbre-vivant';
import './arbre.css';
import './retour.css';

export interface ArbreDeps {
  partie: { readonly lineage: Ancestor[]; rename(i: number, name: string): void; becomes(sp: object): void };
  chapters: readonly { id: string; name: string }[];
  /** the creature played now */
  live(): Spec;
  /** the names of the notes of the song this generation learned (chant.ts) */
  notes?(rank: number): string[];
  /** take again the form of the k-th ancestor (0: the first), here (retour-jeu.ts); false when it cannot now */
  resume?(k: number): boolean;
  /** an earlier form can be taken again now */
  canResume?(): boolean;
  /** the tree covers the sea: the game waits */
  onOpen?(): void;
  onClose?(): void;
}

export interface Arbre {
  readonly isOpen: boolean;
  readonly button: HTMLButtonElement;
  open(): void;
  close(): void;
  /** name the generation of this rank (1: the first), as typing it would */
  rename(rank: number, name: string): void;
  /** something more under the tree, at each opening (the keepsake image, once the story is over) */
  more: (() => HTMLElement | null) | null;
  /** the living portraits (arbre-vivant.ts) */
  readonly vivants: Vivants;
}

const ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">'
  + '<path d="M9 5.5v13M9 12h6.5"/><circle cx="9" cy="4.5" r="2.2" fill="currentColor"/><circle cx="9" cy="12" r="2.2" fill="currentColor"/>'
  + '<circle cx="17" cy="12" r="1.9"/><circle cx="9" cy="19.5" r="2.2" fill="currentColor"/></svg>';

interface Cache<K> { get(k: K): HTMLCanvasElement | undefined; set(k: K, cv: HTMLCanvasElement): unknown }
/** the portraits drawn, per creature and per partner species, kept from one opening to the next
 * (a renamed ancestor is a new object: drawn again) */
const drawn = new WeakMap<object, HTMLCanvasElement>();
const mates = new Map<string, HTMLCanvasElement>();

export function initArbre(d: ArbreDeps): Arbre {
  const button = document.createElement('button');
  button.id = 'arBtn';
  button.type = 'button';
  button.title = 'La lignée';
  button.setAttribute('aria-label', 'L’arbre de la lignée');
  button.innerHTML = ICON;
  (document.getElementById('atBtn') ?? document.getElementById('gear'))?.after(button);

  const root = document.createElement('div');
  root.id = 'arbre';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'L’arbre de la lignée');
  root.tabIndex = -1;
  document.body.append(root);

  // the sea behind must not follow the finger, nor the keys typed in a name
  for (const el of [root, button]) for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchmove']) el.addEventListener(ev, (e) => e.stopPropagation());
  // Escape closes it, wherever the focus is (a name being typed takes its own Escape first)
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && arbre.isOpen) arbre.close(); };
  root.addEventListener('keydown', (e) => { onKey(e); e.stopPropagation(); });
  root.addEventListener('keyup', (e) => e.stopPropagation());
  document.addEventListener('keydown', onKey);
  root.addEventListener('click', (e) => { if (e.target === root) arbre.close(); });
  button.addEventListener('click', () => (arbre.isOpen ? arbre.close() : arbre.open()));

  let gens: Generation[] = [];
  let jobs: (() => void)[] = [];
  let raf = 0;
  // the portraits swim in their medallions; with « reduce motion », still ones as before
  const vivants = initVivants();

  const chapterName = (id: string) => d.chapters.find((c) => c.id === id)?.name ?? d.chapters[0]?.name ?? '';

  function rename(g: Generation, name: string): void {
    if (g.current) {
      const sp = d.live();
      sp.name = name;
      d.partie.becomes(sp);
    } else d.partie.rename(g.rank - 1, name);
    g.name = name;
  }

  function nameButton(g: Generation): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ar-name';
    b.textContent = g.name;
    b.setAttribute('aria-label', `${g.name}, changer le nom`);
    b.addEventListener('click', () => edit(b, g));
    return b;
  }

  function edit(b: HTMLButtonElement, g: Generation): void {
    const input = document.createElement('input');
    input.className = 'ar-name';
    input.value = g.name;
    input.maxLength = NAME_MAX;
    input.enterKeyHint = 'done';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', `Nom de la ${generationLabel(g.rank).toLowerCase()}`);
    let done = false;
    const finish = (keep: boolean) => {
      if (done) return;
      done = true;
      const name = keep ? cleanName(input.value) : null;
      if (name && name !== g.name) rename(g, name);
      const nb = nameButton(g);
      input.replaceWith(nb);
      nb.focus({ preventScroll: true });
    };
    input.addEventListener('keydown', (e) => {
      // (the Enter must not go on to the name that takes the input's place, which would open it again)
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
    b.replaceWith(input);
    input.focus();
    input.select();
  }

  /** a portrait: a copy of the one drawn before, else drawn a bit later (drawSome, the newest first) */
  function portrait<K>(cache: Cache<K>, key: K, cls: string, sp: () => Spec | null): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.className = cls;
    if (vivants.on) { vivants.add(cv, key as object | string, sp, cls === 'ar-mini'); return cv; }
    const done = cache.get(key);
    if (done) {
      cv.width = done.width;
      cv.height = done.height;
      cv.getContext('2d')?.drawImage(done, 0, 0);
      return cv;
    }
    jobs.push(() => {
      let s: Spec | null = null;
      try { s = sp(); } catch { /* a creature the engine no longer reads: no portrait */ }
      if (!s) return;
      snapshot3(s, cv, { pad: 8, max: 3 });
      cache.set(key, cv);
    });
    return cv;
  }

  function build(): HTMLElement | null {
    vivants.stop();
    root.replaceChildren();
    jobs = [];
    const live = d.live();
    gens = generations(d.partie.lineage, live as unknown as Ancestor['creature'], d.chapters[0]?.id ?? '');
    const head = document.createElement('header');
    head.innerHTML = '<small>La lignée</small><h2>D’où nous venons</h2>';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ar-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fermer');
    close.addEventListener('click', () => arbre.close());
    const tree = document.createElement('ol');
    tree.className = 'ar-tree';
    let current: HTMLElement | null = null;
    // the forms that can be taken again: every earlier one, but the one played now is already
    const resumable = !!d.resume && d.canResume?.() !== false;
    const now = { back: gens.length > 1 && gens[gens.length - 1].again ? gens[gens.length - 2].back?.rank : 0 };
    gens.forEach((g, i) => {
      const li = document.createElement('li');
      li.className = g.current ? 'ar-gen ar-now' : 'ar-gen';
      li.style.setProperty('--i', String(i));
      const cv = portrait<object>(drawn, g.current ? live : g.creature, 'ar-portrait', () => (g.current ? live : makeSpec(g.creature as Parameters<typeof makeSpec>[0])));
      const text = document.createElement('div');
      const label = document.createElement('small');
      label.textContent = generationLabel(g.rank);
      const born = document.createElement('span');
      born.className = 'ar-born';
      born.textContent = originWords(g, chapterName(g.bornIn));
      text.append(label, nameButton(g), born);
      const notes = d.notes?.(g.rank);
      if (notes?.length) text.append(Object.assign(document.createElement('span'), { className: 'ar-notes', textContent: `a appris ${wordsOf(notes)}` }));
      if (g.current) {
        const now = document.createElement('small');
        now.className = 'ar-today';
        now.textContent = 'aujourd’hui';
        text.append(now);
      }
      if (!g.current && resumable && g.rank !== now.back) text.append(againButton(g, live.name));
      li.append(cv, text);
      tree.append(li);
      if (g.current) current = li;
      if (g.partner) {
        const mate = document.createElement('li');
        mate.className = 'ar-mate';
        mate.style.setProperty('--i', String(i + 0.5));
        const m = g.partner;
        const knot = document.createElement('span');
        knot.className = 'ar-knot';
        const words = document.createElement('span');
        words.textContent = `avec ${m.name}`;
        const make = m.id && SPECIES[m.id];
        if (make) mate.append(knot, portrait(mates, m.id, 'ar-mini', make), words);
        else mate.append(knot, words);
        tree.append(mate);
      } else if (g.back) {
        const back = document.createElement('li');
        back.className = 'ar-mate ar-back';
        back.style.setProperty('--i', String(i + 0.5));
        back.append(Object.assign(document.createElement('span'), { className: 'ar-knot' }), Object.assign(document.createElement('span'), { textContent: backWords(g.back) }));
        tree.append(back);
      }
    });
    const foot = document.createElement('p');
    foot.className = 'ar-foot';
    foot.textContent = gens.length > 1 ? 'Touche un nom pour le changer.' : 'À chaque naissance, une génération de plus. Touche un nom pour le changer.';
    root.append(head, close, tree, foot);
    const more = arbre.more?.();
    if (more) root.append(more);
    return current;
  }

  /** « Reprendre cette espèce », then a word to be sure: the tree closes and the scene plays (retour-jeu.ts) */
  function againButton(g: Generation, played: string): HTMLElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ar-again';
    b.textContent = 'Reprendre cette espèce';
    b.setAttribute('aria-label', `Reprendre la forme de ${g.name}`);
    b.addEventListener('click', () => {
      root.querySelector('.ar-ask')?.dispatchEvent(new Event('cancel'));
      const ask = document.createElement('div');
      ask.className = 'ar-ask';
      ask.setAttribute('role', 'group');
      const q = Object.assign(document.createElement('p'), { textContent: `Redevenir ${g.name}, ici ?` });
      const more = Object.assign(document.createElement('small'), { textContent: `${played} restera là où nous sommes, parmi les nôtres.` });
      const yes = Object.assign(document.createElement('button'), { type: 'button', className: 'ar-yes', textContent: 'Reprendre' });
      const no = Object.assign(document.createElement('button'), { type: 'button', className: 'ar-no', textContent: 'Non' });
      const cancel = () => { ask.replaceWith(b); b.focus({ preventScroll: true }); };
      ask.addEventListener('cancel', cancel);
      no.addEventListener('click', cancel);
      yes.addEventListener('click', () => { arbre.close(); d.resume?.(g.rank - 1); });
      ask.append(q, more, yes, no);
      b.replaceWith(ask);
      yes.focus({ preventScroll: true });
    });
    return b;
  }

  /** a portrait costs about 10 ms on a computer, more on a phone: a few per frame, at least one */
  function drawSome(): void {
    raf = 0;
    const t0 = performance.now();
    while (jobs.length) { jobs.pop()!(); if (performance.now() - t0 > 12) break; }
    if (jobs.length) raf = requestAnimationFrame(drawSome);
  }

  const arbre: Arbre = {
    get isOpen() { return !root.hidden; },
    button,
    more: null,
    open() {
      if (arbre.isOpen) return;
      d.onOpen?.();
      const current = build();
      root.hidden = false;
      void root.offsetWidth;
      root.classList.add('show');
      // on the one played (by hand: scrollIntoView could move the page under the sea)
      if (current) root.scrollTop += current.getBoundingClientRect().top - (root.clientHeight - current.offsetHeight) / 2;
      root.focus({ preventScroll: true });
      if (!raf && jobs.length) raf = requestAnimationFrame(drawSome);
      vivants.start(root, true);
    },
    close() {
      if (!arbre.isOpen) return;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      jobs = [];
      vivants.stop();
      root.classList.remove('show');
      root.hidden = true;
      root.replaceChildren();
      button.focus({ preventScroll: true });
      d.onClose?.();
    },
    rename(rank, name) {
      const g = (arbre.isOpen ? gens : generations(d.partie.lineage, d.live() as unknown as Ancestor['creature'], '')).find((x) => x.rank === rank);
      const clean = cleanName(name);
      if (!g || !clean) return;
      rename(g, clean);
      if (arbre.isOpen) { const at = root.scrollTop; build(); root.scrollTop = at; if (!raf && jobs.length) raf = requestAnimationFrame(drawSome); vivants.start(root, false); }
    },
    vivants
  };
  return arbre;
}
