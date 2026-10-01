// La Balade libre (docs/mecaniques.md): once the story is over, the same sea, open everywhere, without words, with the
// Atelier at hand. The saved game keeps it (partie.ts, `balade`): the chapter where we swim and the creature played
// there. The lineage and the creature the story ended with stay as the story left them: the tree and the keepsake
// image are the story's. Pure: the game is balade-jeu.ts.

import type { Partie, SavedCreature } from './partie';

/** where the free swim begins: under the surface of the Nurserie, where the lineage came out */
export const FIRST = 'nurserie';

/** the story is over: the free swim begins, with the creature the story ended with (once: an open Balade stays as it is) */
export function openBalade(p: Partie, chapter = FIRST): Partie {
  return p.balade ? p : { ...p, balade: { chapter, creature: null } };
}

/** the creature played: the Balade's, else the story's */
export function playedOf(p: Partie): SavedCreature | null {
  return p.balade?.creature ?? p.creature;
}

/** the creature played in the Balade changes (the Atelier, a child chosen): the lineage stays as the story left it */
export function playIn(p: Partie, creature: SavedCreature): Partie {
  return p.balade ? { ...p, balade: { ...p.balade, creature } } : p;
}

/** the Balade swims into a chapter, back as well as down (the story's chapter does not move); null when nothing changed */
export function wander(p: Partie, chapter: string): Partie | null {
  return p.balade && p.balade.chapter !== chapter ? { ...p, balade: { ...p.balade, chapter } } : null;
}

/** the chapter the page comes back to: the Balade's, else the story's */
export function resumeOf(p: Partie): string {
  return p.balade?.chapter ?? p.chapter;
}

/**
 * A story finished before the saved game kept its Balade: the browser only kept a flag (atelier-access.ts). It was
 * finished if the game still stands at the last chapter; a game begun again since then is a story like any other.
 */
export function finishedBefore(p: Partie, flag: boolean, last: string): boolean {
  return flag && !p.balade && p.chapter === last;
}
