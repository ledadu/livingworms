// The saved game in the page: loaded when it opens, saved at each birth and each new chapter, and forgotten by the
// « Recommencer » button of the settings panel (or ?nouvelle, for the tests).
import { birth, clearPartie, loadPartie, openStore, reachChapter, replaceCreature, savePartie, type Partie, type SavedCreature } from './partie';

const plain = (sp: object): SavedCreature => JSON.parse(JSON.stringify(sp)) as SavedCreature;

export function initPartie(chapters: readonly string[]) {
  const store = openStore();
  const params = new URLSearchParams(location.search);
  if (params.has('nouvelle')) {
    clearPartie(store);
    params.delete('nouvelle');
    history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '') + location.hash);
  }
  let p: Partie = loadPartie(store, chapters);
  const keep = (next: Partie) => { p = next; savePartie(store, p); };

  const btn = document.getElementById('newGame') as HTMLButtonElement | null;
  if (btn) {
    const label = btn.textContent;
    let armed = 0;
    // two touches, so that a stray one does not lose the game (confirm() is blocked in some frames)
    btn.addEventListener('click', () => {
      if (armed) { clearTimeout(armed); clearPartie(store); location.reload(); return; }
      btn.textContent = 'Toucher encore pour tout recommencer';
      armed = window.setTimeout(() => { armed = 0; btn.textContent = label; }, 3000);
    });
  }

  return {
    get chapter() { return p.chapter; },
    get creature() { return p.creature; },
    get lineage() { return p.lineage; },
    get saved() { return p; },
    /** the creature changed in the Atelier */
    becomes(sp: object) { keep(replaceCreature(p, plain(sp))); },
    /** a child is born and played from now on (the heredity will call it) */
    born(sp: object, chapter = p.chapter) { keep(birth(p, plain(sp), chapter)); },
    reach(chapter: string) { if (reachChapter(p, chapter)) savePartie(store, p); }
  };
}
