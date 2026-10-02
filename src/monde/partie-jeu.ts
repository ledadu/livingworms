// The saved game in the page: loaded when it opens, saved at each birth and each new chapter, and forgotten by the
// « Recommencer » button of the settings panel (or ?nouvelle, for the tests). Once the story is over, the Balade libre
// (balade.ts) keeps its own chapter and creature: the lineage stays as the story left it.
import { openBalade, playIn, playedOf, resumeOf, wander } from './balade';
import { returnTo } from './retour';
import { befriend, birth, clearPartie, friendStays, generation, learnNote, placeAncestor, loadPartie, openStore, reachChapter, renameAncestor, replaceCreature, savePartie, type Mate, type Partie, type Place, type SavedCreature } from './partie';

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
    /** the chapter the story reached */
    get chapter() { return p.chapter; },
    /** the creature played (in the Balade, its own) */
    get creature() { return playedOf(p); },
    get lineage() { return p.lineage; },
    get saved() { return p; },
    /** the story is over: the Balade libre */
    get free() { return !!p.balade; },
    /** the chapter the page comes back to */
    get resume() { return resumeOf(p); },
    /** the creature changed in the Atelier (in the Balade, the Balade's) */
    becomes(sp: object) { keep(p.balade ? playIn(p, plain(sp)) : replaceCreature(p, plain(sp))); },
    /** the last generation of the story is this creature now (renamed in the tree during the Balade) */
    last(sp: object) { keep(replaceCreature(p, plain(sp))); },
    /** a child is born and played from now on, the parent had it with this partner and is left at a place of the chapter
     * (the farewell); in the Balade the child is only played, the lineage stays as the story left it */
    born(sp: object, chapter = p.chapter, partner?: Mate, at?: Place) { keep(p.balade ? playIn(p, plain(sp)) : birth(p, plain(sp), chapter, partner, at)); },
    /** the creature played takes again the form of the k-th ancestor (retour.ts), the one it was left at a place of
     * the chapter; in the Balade the copy is only played, the lineage stays as the story left it */
    returnTo(k: number, chapter = p.chapter, at?: Place) {
      const a = p.lineage[k];
      if (a) keep(p.balade ? playIn(p, { ...a.creature }) : returnTo(p, k, chapter, at));
    },
    /** the i-th ancestor gets a name (the lineage tree) */
    rename(i: number, name: string) { keep(renameAncestor(p, i, name)); },
    reach(chapter: string) {
      if (p.balade) { const next = wander(p, chapter); if (next) keep(next); } else if (reachChapter(p, chapter, chapters)) savePartie(store, p);
    },
    /** the story is over: the Balade libre opens, for good in this game */
    open() { if (!p.balade) keep(openBalade(p)); },
    /** the note of this chapter learned by the generation played (chant.ts) */
    learn(chapter: string) { const next = learnNote(p, chapter); if (next !== p) keep(next); },
    /** the generation played now (1: the first) */
    get gen() { return generation(p); },
    /** the friends of the generations (amis.ts) */
    get friends() { return p.friends ?? []; },
    /** an animal of this species (its bestiary id) follows the generation played */
    befriend(id: string) { const next = befriend(p, id); if (next !== p) keep(next); },
    /** the friend of that generation stays at this place of this chapter */
    friendStays(gen: number, chapter: string, at: Place) { const next = friendStays(p, gen, chapter, at); if (next !== p) keep(next); },
    /** the k-th ancestor was left at another place of its chapter */
    placeAncestor(k: number, at: Place) { const next = placeAncestor(p, k, at); if (next !== p) keep(next); }
  };
}
