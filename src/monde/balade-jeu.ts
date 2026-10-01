// La Balade libre in the game (balade.ts): once the story is over, every obstacle is open whatever the body, the
// lineage says nothing (only the names of the chapters pass), the Remontée does not come back, and the Atelier (✎) and
// the travel of the settings panel are at hand. It opens at the end of the Remontée, and comes back with the page.

import doc from '../../docs/chapitres.md?raw';
import { spec as makeSpec, type Spec } from '../engine';
import { firstAncestor } from '../content';
import { applyAtelierAccess, baladeUnlocked, unlockBalade } from './atelier-access';
import { finishedBefore } from './balade';
import { BIOMES } from './biomes';
import { GATES, type Limits } from './limites';
import type { Narrator } from './narration';
import type { initPartie } from './partie-jeu';
import { parseChapterTexts, textsOf } from './textes';
import './balade.css';

type PartieJeu = ReturnType<typeof initPartie>;

const LAST = BIOMES.length - 1;
/** the words that open it (docs/chapitres.md, at the end of the Remontée), under its name */
const TITLE = 'La Balade libre';
const WORDS = textsOf(parseChapterTexts(doc), BIOMES[LAST].name, LAST)?.balade ?? [];

/** what the Balade changes in the world, given once it is made (main.ts) */
export interface BaladeWorld {
  narrator: Narrator;
  limits: Limits;
  remontee: { over(): void };
  /** the Atelier's button */
  atelier: HTMLElement | null;
  /** what the settings panel shows to the players in the Balade only: the travel and its title */
  travel: HTMLElement[];
  /** a larva that follows the swimmer, as at the end of the story */
  larva(sp: Spec): void;
}

export function initBalade(partie: PartieJeu) {
  // a story finished before the Balade was kept in the saved game: the browser kept only a flag
  if (finishedBefore(partie.saved, baladeUnlocked(), BIOMES[LAST].id)) partie.open();
  let world: BaladeWorld | null = null, waiting = 0;
  let story: { from: object; spec: Spec } | null = null;

  function apply(w: BaladeWorld): void {
    for (const g of GATES) w.limits.crossed.add(g.chapter);
    // no opening: the chapters only whisper their names
    for (let i = 0; i < BIOMES.length; i++) w.narrator.told.add(i);
    w.remontee.over();
    applyAtelierAccess(w.atelier, true);
    for (const el of w.travel) el.hidden = false;
  }

  /** its words, once the sea shows again (after the credits and the keepsake image: narrator.quiet); the buttons glow a while */
  function announce(): void {
    clearTimeout(waiting);
    if (!world?.narrator.say(TITLE, WORDS, true)) { waiting = window.setTimeout(announce, 700); return; }
    document.body.classList.add('balade-new');
    window.setTimeout(() => document.body.classList.remove('balade-new'), 12000);
  }

  const balade = {
    /** the story is over: we swim freely */
    get on() { return partie.free; },
    /** the last generation in the tree and the keepsake: in the Balade, the story's, whatever is played */
    live(played: Spec): Spec {
      const s = partie.saved;
      if (!s.balade?.creature || !s.creature) return played;
      if (story?.from !== s.creature) {
        try { story = { from: s.creature, spec: makeSpec(s.creature as Parameters<typeof makeSpec>[0]) }; } catch { return played; }
      }
      return story.spec;
    },
    /** the saved game as the lineage tree sees it: in the Balade, a name given to the last generation is the story's */
    lignee: {
      get lineage() { return partie.lineage; },
      rename: (i: number, name: string) => partie.rename(i, name),
      becomes: (sp: object) => (partie.free ? partie.last(sp) : partie.becomes(sp))
    },
    /** the world is made: in the Balade, it is open at once */
    attach(w: BaladeWorld): void {
      world = w;
      w.narrator.silent = () => partie.free;
      if (!partie.free) return;
      apply(w);
      w.larva(firstAncestor());
    },
    /** the story is over: the Balade opens now (once) */
    open(): void {
      unlockBalade();
      if (partie.free) return;
      partie.open();
      // (its words a moment later: the credits come first, and the words wait under them)
      if (world) { apply(world); waiting = window.setTimeout(announce, 1000); }
    }
  };
  return balade;
}

export type BaladeJeu = ReturnType<typeof initBalade>;
