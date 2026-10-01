// The credits of the sounds (enregistrements.ts, from src/monde/sons/credits.json): the people who published the
// recordings the game plays, each with the title of the sound, its licence and a link to where it comes from. In the
// credits at the end (generique-ecran.ts) and in a panel opened from the settings, « Son » (son-reglages.ts).

import { SOUND_CREDITS, creditWords } from './enregistrements';
import './credits-sons.css';

const FROM = 'Des enregistrements libres de droits, pris sur Freesound. Merci à celles et ceux qui les ont publiés.';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function link(href: string, text: string, cls = ''): HTMLAnchorElement {
  const a = el('a', cls, text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

/** the list of the sounds: each title links to its source, then its author and its licence (linked to its text) */
export function soundsList(): HTMLUListElement {
  const ul = el('ul', 'cs-list');
  for (const c of SOUND_CREDITS) {
    const w = creditWords(c), li = el('li');
    const by = el('span', 'cs-by', `${w.by} · `);
    by.append(link(c.licenseUrl, w.license, 'cs-license'));
    li.append(link(c.url, w.title, 'cs-title'), by);
    ul.append(li);
  }
  return ul;
}

/** the section « Sons » of the credits at the end, before their last words */
export function soundsSection(): HTMLElement {
  const s = el('section', 'cs-roll');
  s.append(el('small', '', 'Sons'), soundsList(), el('p', 'cs-from', FROM));
  return s;
}

/** the panel of the settings: the same list, to read at leisure */
export function initCreditsSons(button: HTMLElement | null): { open(): void; close(): void; readonly isOpen: boolean } {
  let root: HTMLElement | null = null;
  const close = () => {
    if (!root || root.hidden) return;
    root.hidden = true;
    button?.focus();
  };
  const open = () => {
    if (!root) {
      root = el('div', 'cs');
      root.id = 'creditsSons';
      const sheet = el('section', 'cs-sheet');
      sheet.tabIndex = -1;
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      sheet.setAttribute('aria-labelledby', 'cs-title');
      const head = el('header', 'cs-head'), h = el('h2', '', 'Les sons et leurs auteurs'), x = el('button', 'cs-close', '×');
      h.id = 'cs-title';
      x.type = 'button';
      x.setAttribute('aria-label', 'Fermer');
      x.addEventListener('click', close);
      head.append(h, x);
      const body = el('div', 'cs-body');
      body.append(el('p', 'cs-from', FROM), soundsList(), el('p', 'cs-note', 'La musique, le chant et les autres bruits sont faits dans le jeu.'));
      sheet.append(head, body);
      root.append(sheet);
      // a tap beside the sheet closes it; the sea underneath never gets its gestures
      root.addEventListener('click', (e) => { if (e.target === root) close(); });
      for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchmove']) root.addEventListener(ev, (e) => e.stopPropagation());
      root.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
        e.stopPropagation();
      });
      document.body.append(root);
    }
    root.hidden = false;
    root.querySelector<HTMLElement>('.cs-sheet')?.focus();
  };
  button?.addEventListener('click', open);
  return { open, close, get isOpen() { return !!root && !root.hidden; } };
}
