// The compatible species of each chapter (docs/mecaniques.md): the partners
// the swimmer may court there. They glow softly when it comes near. Each
// chapter with an obstacle offers partners that bring every body trait
// crossing it, so the descent can never get stuck.

import { clamp } from '../engine';
import { BIOMES, span, type ChapterId } from './biomes';
import { GATES, SOFT, WORLD_START } from './limites';

export interface Partner {
  /** species id (SPECIES) */
  id: string;
  kind: 'swim' | 'floor';
  scale: number;
}

const p = (id: string, kind: Partner['kind'] = 'swim', scale = 0.8): Partner => ({ id, kind, scale });

/** the partners of each chapter (docs/chapitres.md), the traits they bring in comments */
export const PARTNERS: Record<ChapterId, Partner[]> = {
  nurserie: [p('copepode'), p('larve')],
  // nageoires; pulsation from the box jellyfish, a reef dweller
  recif: [p('poissonClown'), p('poissonLion'), p('hippocampe'), p('meduseBoite', 'swim', 0.7)],
  // pinces from the lobster, corps fin from the leafy sea dragon
  foret: [p('dragonFeuillu'), p('seiche'), p('homard', 'floor')],
  // corps fin from the eel and the ciliate worm, lanterne from the comb jelly
  grotte: [p('anguille'), p('serpentCilie', 'floor'), p('ctenophore')],
  carcasse: [p('plumeau', 'floor'), p('crabe', 'floor')],
  // carapace from the mantis shrimp and the lobster, cils from the ciliate worm
  sources: [p('verDeFeu', 'floor'), p('crevetteMante', 'floor'), p('homard', 'floor'), p('serpentCilie')],
  // carapace from the krill, filaments from the cold-water jellyfish
  glacier: [p('clione'), p('krill'), p('chrysaora')],
  // pulsation and filaments from the jellyfish and the siphonophore
  jardin: [p('meduse', 'swim', 0.7), p('ctenophore'), p('siphonophore')],
  // lanterne from the anglerfish and the abyssal dragon (the song is step 5)
  fosse: [p('baudroie'), p('dragonAbyssal'), p('nautile')],
  remontee: []
};

export function isPartner(chapter: ChapterId, id: string): boolean {
  return PARTNERS[chapter].some((q) => q.id === id);
}

/** the body traits of an obstacle that none of the chapter's partners brings ('chant' is not a body trait) */
export function uncovered(chapter: ChapterId, keys: readonly string[], traitsOf: (id: string) => readonly string[]): string[] {
  const brought = new Set(PARTNERS[chapter].flatMap((q) => traitsOf(q.id)));
  return keys.filter((k) => k !== 'chant' && !brought.has(k));
}

/** where the swimmer can meet the partners of chapter `bi`: its span, short of its own obstacle and of the ends of the world */
export function meetRange(bi: number): [number, number] {
  const id = BIOMES[bi].id, [x0, x1] = span(id), gate = GATES.find((g) => g.chapter === id);
  return [Math.max(x0, WORLD_START) + 150, (gate ? Math.min(x1, gate.x) : x1) - SOFT - 80];
}

/** how many of each partner species live in the plane of each chapter at least */
export const PER_PARTNER = 2;

/**
 * The partners to add to the swimming plane, [chapter index, partner, x], so
 * that each chapter has PER_PARTNER of each (`have`: how many the fauna
 * already placed there), spread along where they can be met.
 */
export function partnerSpawns(R: () => number, have: (bi: number, id: string) => number = () => 0): [number, Partner, number][] {
  const out: [number, Partner, number][] = [];
  BIOMES.forEach((b, bi) => {
    const [a, c] = meetRange(bi), add = PARTNERS[b.id].flatMap((q) => Array<Partner>(Math.max(0, PER_PARTNER - have(bi, q.id))).fill(q));
    add.forEach((q, k) => out.push([bi, q, a + ((k + 0.2 + 0.6 * R()) / add.length) * (c - a)]));
  });
  return out;
}

/** a partner of chapter `bi` at (x, z): in the swimming plane and where it can be met */
export function marksPartner(bi: number, id: string, x: number, z: number): boolean {
  const [a, c] = meetRange(bi);
  return Math.abs(z) < 60 && x >= a && x <= c && isPartner(BIOMES[bi].id, id);
}

/** from how far the glow starts, and where it is full (world px) */
export const GLOW_FAR = 650, GLOW_NEAR = 160;
/** the hue of the glow: a warm gold, unlike the blue and green lights of the deep */
export const GLOW_HUE = 45;

/** the strength of a partner's glow (0..1) at distance d from the swimmer: rises as it comes near, and breathes slowly */
export function partnerGlow(d: number, t: number, seed: number): number {
  const u = clamp((GLOW_FAR - d) / (GLOW_FAR - GLOW_NEAR), 0, 1);
  if (!u) return 0;
  return u * u * (3 - 2 * u) * (0.7 + 0.3 * Math.sin(t * 1.7 + seed));
}
