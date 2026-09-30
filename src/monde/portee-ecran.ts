// The brood screen (docs/mecaniques.md, « La portée »): four eggs hatch over the sea, each child shows what it
// inherited from the parent and from the partner, and the one we touch is played from then on.
// The children come from brood() (src/content/portee.ts); the game decides what a choice does (onChoose).

import type { Spec } from '../engine';
import { snapshot3 } from '../engine3/snapshot3';
import { brood, type BroodOptions, type Child } from '../content/portee';
import { TRAIT_LABELS } from '../content/traits';
import './portee.css';

/** the delay between two eggs, and the time an egg takes to hatch (ms, as in portee.css) */
const HATCH_STEP = 450, HATCH = 1400;

export interface Inherited { from: string; parts: string[] }

/** what a child inherited, one line per side, its body first on the side it comes from; a side with nothing is left out */
export function inherited(c: Child, parent: string, partner: string): Inherited[] {
  const body = c.spec.body.name || 'Corps';
  const p = c.body === 'parent' ? [body, ...c.fromParent] : c.fromParent;
  const q = c.body === 'partner' ? [body, ...c.fromPartner] : c.fromPartner;
  return [{ from: parent, parts: p }, { from: partner, parts: q }].filter((l) => l.parts.length);
}

/** a child's traits in words, those that cross the chapter's obstacle marked */
export function traitWords(c: Child, keys: readonly string[] = []): { word: string; key: boolean }[] {
  return c.traits.map((t) => ({ word: TRAIT_LABELS[t], key: keys.includes(t) }));
}

export interface Portee {
  readonly isOpen: boolean;
  /** the children shown now (for the tests) */
  readonly children: Child[];
  open(parent: Spec, partner: Spec, o?: BroodOptions): Child[];
  /** choose the i-th child, as a touch then « Continuer » would */
  choose(i: number): void;
  close(): void;
}

export function createPortee(onChoose: (child: Spec, all: Child[], partner: Spec) => void): Portee {
  const root = document.createElement('div');
  root.id = 'portee';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'La portée');
  // the sea behind must not follow the finger
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchmove']) root.addEventListener(ev, (e) => e.stopPropagation());
  document.body.append(root);

  let kids: Child[] = [], picked = -1, mate: Spec | null = null;
  let ok: HTMLButtonElement | null = null;
  const cards: HTMLButtonElement[] = [];

  function pick(i: number): void {
    picked = i;
    cards.forEach((c, k) => c.classList.toggle('picked', k === i));
    if (ok) { ok.disabled = false; ok.textContent = `Continuer avec ${kids[i].spec.name}`; }
  }

  const portee: Portee = {
    get isOpen() { return !root.hidden; },
    get children() { return kids; },
    open(parent, partner, o = {}) {
      kids = brood(parent, partner, o);
      mate = partner;
      picked = -1;
      root.innerHTML = '';
      cards.length = 0;
      const head = document.createElement('header');
      head.innerHTML = '<small>La portée</small><h2>Quatre œufs ont éclos</h2><p>Choisis l’enfant qui continuera la descente.</p>';
      const grid = document.createElement('div');
      grid.className = 'brood';
      kids.forEach((c, i) => {
        const card = document.createElement('button');
        card.className = 'child';
        card.style.setProperty('--delay', `${i * HATCH_STEP}ms`);
        const cv = document.createElement('canvas');
        const egg = document.createElement('span');
        egg.className = 'egg';
        const name = document.createElement('b');
        name.textContent = c.spec.name;
        const list = document.createElement('dl');
        for (const l of inherited(c, parent.name, partner.name)) {
          const dt = document.createElement('dt'), dd = document.createElement('dd');
          dt.textContent = `de ${l.from}`;
          dt.className = l.from === parent.name ? 'parent' : 'partner';
          dd.textContent = l.parts.join(', ');
          list.append(dt, dd);
        }
        const traits = document.createElement('p');
        traits.className = 'traits';
        const words = traitWords(c, o.keys);
        if (!words.length) traits.textContent = 'Pas encore de trait';
        for (const w of words) {
          const span = document.createElement('span');
          span.textContent = w.word;
          if (w.key) span.className = 'key';
          traits.append(span);
        }
        card.append(cv, egg, name, list, traits);
        card.addEventListener('click', () => pick(i));
        cards.push(card);
        grid.append(card);
      });
      ok = document.createElement('button');
      ok.className = 'go';
      ok.disabled = true;
      ok.textContent = 'Touche un enfant';
      ok.addEventListener('click', () => { if (picked >= 0) portee.choose(picked); });
      root.append(head, grid, ok);
      root.hidden = false;
      void root.offsetWidth;
      root.classList.add('show');
      // the portraits once the cards have their size
      requestAnimationFrame(() => kids.forEach((c, i) => snapshot3(c.spec, cards[i].querySelector('canvas')!, { pad: 8, max: 3 })));
      window.setTimeout(() => root.classList.add('hatched'), HATCH_STEP * (kids.length - 1) + HATCH);
      return kids;
    },
    choose(i) {
      const c = kids[i];
      if (!c || root.hidden) return;
      portee.close();
      onChoose(c.spec, kids, mate!);
    },
    close() {
      root.classList.remove('show', 'hatched');
      root.hidden = true;
      root.innerHTML = '';
      cards.length = 0;
      ok = null;
    }
  };
  return portee;
}
