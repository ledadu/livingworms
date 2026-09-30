import type { EntryView, VersionView } from './layout';
import { renderMarkdown } from './markdown';

// The panel: a sheet over the sea (from the bottom on a phone), one version at a time, its captures in large and its
// text short (the pitch, the rest behind « Lire la suite »). Tabs to go from one version to another.
export class NouveautesPanel {
  readonly root: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly body: HTMLElement;
  private readonly sheet: HTMLElement;
  private current = 0;
  private opener: HTMLElement | null = null;

  constructor(title: string, private readonly versions: VersionView[], private readonly onOpen: () => void) {
    this.root = el('div', 'nv');
    this.root.id = 'nouveautes';
    this.root.hidden = true;
    const sheet = (this.sheet = el('section', 'nv-sheet'));
    sheet.tabIndex = -1;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'nv-title');
    const head = el('header', 'nv-head');
    const h = el('h2', '', title);
    h.id = 'nv-title';
    const close = el('button', 'nv-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Fermer');
    close.addEventListener('click', () => this.hide());
    head.append(h, close);
    this.tabs = el('nav', 'nv-tabs');
    this.tabs.setAttribute('aria-label', 'Versions');
    this.tabs.hidden = versions.length < 2;
    versions.forEach((version, i) => {
      const tab = el('button', version.unreleased ? 'nv-tab nv-prep' : 'nv-tab', version.unreleased ? `${version.short} · en préparation` : version.short);
      tab.type = 'button';
      tab.addEventListener('click', () => this.show(i));
      this.tabs.append(tab);
    });
    this.body = el('div', 'nv-body');
    sheet.append(head, this.tabs, this.body);
    this.root.append(sheet);
    // a tap beside the sheet closes it; the sea underneath never gets the gestures of the panel
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.hide(); });
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchmove']) this.root.addEventListener(ev, (e) => e.stopPropagation());
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
      e.stopPropagation();
    });
    this.show(0);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  // Opens on the version `start` (0: the newest, in dev the one in preparation).
  open(opener: HTMLElement | null = null, start = 0): void {
    if (this.isOpen) return;
    this.opener = opener;
    this.show(start);
    this.root.hidden = false;
    this.sheet.focus({ preventScroll: true });
    this.onOpen();
  }

  hide(): void {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.opener?.focus({ preventScroll: true });
    this.opener = null;
  }

  // Shows the version i (0: the newest).
  show(i: number): void {
    const version = this.versions[i];
    this.current = i;
    [...this.tabs.children].forEach((tab, k) => tab.setAttribute('aria-current', String(k === i)));
    this.body.replaceChildren();
    this.body.scrollTop = 0;
    if (!version) {
      this.body.append(el('p', 'nv-empty', 'Pas encore de nouveautés à raconter. Reviens après la prochaine version ! 🐚'));
      return;
    }
    const top = el('div', version.unreleased ? 'nv-version nv-prep' : 'nv-version');
    top.append(el('h3', '', version.label), el('p', 'nv-note', version.note));
    if (version.title) top.append(el('p', 'nv-vtitle', version.title));
    if (version.intro) top.append(el('p', 'nv-intro', version.intro));
    this.body.append(top, ...version.entries.map(entryCard));
    const older = this.versions[i + 1];
    if (older) {
      const more = el('button', 'nv-older', `${older.label}${older.note && !older.unreleased ? ` · ${older.note}` : ''} →`);
      more.type = 'button';
      more.addEventListener('click', () => this.show(i + 1));
      this.body.append(more);
    }
  }

  get shown(): number {
    return this.current;
  }
}

function entryCard(entry: EntryView): HTMLElement {
  const card = el('article', `nv-entry t-${entry.type}`);
  if (entry.images.length) {
    const shots = el('div', entry.images.length > 1 ? 'nv-shots nv-many' : 'nv-shots');
    for (const src of entry.images) {
      const img = el('img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      shots.append(img);
    }
    card.append(shots);
  }
  card.append(el('p', 'nv-badge', entry.badge), el('h4', '', entry.title), el('p', 'nv-pitch', entry.pitch));
  if (entry.body) {
    const more = el('details', 'nv-more');
    const text = el('div', 'nv-text');
    text.innerHTML = renderMarkdown(entry.body);
    more.append(el('summary', '', 'Lire la suite'), text);
    card.append(more);
  }
  return card;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
