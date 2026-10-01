// The lineage tree (docs/mecaniques.md, « L'arbre de la lignée »): every generation from the first larva to the one
// played, where each was born and with whom it had its child. Pure: the screen is arbre-ecran.ts.

import { SPECIES } from '../content/species';
import type { Ancestor, Mate, SavedCreature } from './partie';
import { backOf } from './retour';

export interface Generation {
  /** 1 for the first larva */
  rank: number;
  creature: SavedCreature;
  name: string;
  /** the chapter where it was born (an id) */
  bornIn: string;
  /** the partner of its child, null for the one played (and for births saved before the tree) */
  partner: Mate | null;
  /** the one played now */
  current: boolean;
  /** instead of a child, the lineage went back to the form of this earlier generation (retour.ts) */
  back: { rank: number; name: string } | null;
  /** it is the form of an earlier generation taken again, not a birth */
  again: boolean;
}

const nameOf = (c: SavedCreature) => (typeof c.name === 'string' && c.name) || 'Sans nom';

let ids: Map<string, string> | null = null;
/** the partner of a birth as the game keeps it: its species id in the bestiary (for its portrait), else '', and its name */
export function mateFor(sp: { name: string }): Mate {
  if (!ids) { ids = new Map(); for (const id of Object.keys(SPECIES)) ids.set(SPECIES[id]().name, id); }
  return { id: ids.get(sp.name) || '', name: sp.name };
}

/** a partner as saved, or null when there is none or it is broken */
export function mateOf(a: Pick<Ancestor, 'partner'>): Mate | null {
  const m = a.partner as unknown;
  if (typeof m !== 'object' || m === null) return null;
  const { id, name } = m as Record<string, unknown>;
  return typeof name === 'string' && name ? { id: typeof id === 'string' ? id : '', name } : null;
}

/** the generations, the oldest first: each was born where the one before gave birth, the first in the first chapter */
export function generations(lineage: readonly Ancestor[], current: SavedCreature, first: string): Generation[] {
  const backs = lineage.map((_, i) => backOf(lineage, i));
  const all: Generation[] = lineage.map((a, i) => {
    const k = backs[i];
    return {
      rank: i + 1, creature: a.creature, name: nameOf(a.creature),
      bornIn: i ? lineage[i - 1].chapter : first, partner: k === null ? mateOf(a) : null, current: false,
      back: k === null ? null : { rank: k + 1, name: nameOf(lineage[k].creature) }, again: i > 0 && backs[i - 1] !== null
    };
  });
  all.push({
    rank: all.length + 1, creature: current, name: nameOf(current),
    bornIn: lineage.length ? lineage[lineage.length - 1].chapter : first, partner: null, current: true,
    back: null, again: lineage.length > 0 && backs[lineage.length - 1] !== null
  });
  return all;
}

const ORDINALS = ['Première', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième', 'Sixième', 'Septième', 'Huitième', 'Neuvième',
  'Dixième', 'Onzième', 'Douzième', 'Treizième', 'Quatorzième', 'Quinzième', 'Seizième', 'Dix-septième', 'Dix-huitième',
  'Dix-neuvième', 'Vingtième'];

/** « Troisième génération »: in words, as the game shows no numbers */
export function generationLabel(rank: number): string {
  return `${ORDINALS[rank - 1] ?? `${rank}e`} génération`;
}

/** « née au Récif », « née dans la Grotte »: where a generation (feminine) was born, from the chapter's name */
export function bornWords(chapter: string): string {
  const m = /^(La |Le |Les |L[’'])(.*)$/.exec(chapter);
  if (!m) return `née à ${chapter}`;
  const [, art, rest] = m;
  if (/^(Forêt|Grotte|Fosse)\b/.test(rest)) return `née dans ${art.toLowerCase()}${rest}`;
  const to = art === 'Le ' ? 'au ' : art === 'Les ' ? 'aux ' : `à ${art.toLowerCase()}`;
  return `née ${to}${rest}`;
}

/** where a generation comes from: « née au Récif », or « reprise au Récif » for an earlier form taken again */
export function originWords(g: Pick<Generation, 'again'>, chapter: string): string {
  const w = bornWords(chapter);
  return g.again ? w.replace(/^née/, 'reprise') : w;
}

/** the words on the thread after a generation that went back: « retour à Larve » */
export const backWords = (b: { name: string }) => `retour à ${b.name}`;

export const NAME_MAX = 24;

/** a name typed by the player: spaces tidied, not too long; null when nothing is left (the old name stays) */
export function cleanName(typed: string): string | null {
  const s = typed.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  return s || null;
}
