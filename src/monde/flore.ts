// More of what lives fixed to the floor: anemones, corals, razor clams, giant
// clams, sea squirts, Christmas tree worms and the strange sponges of the deep.
// Each kind is a species definition (a tree of whips, like the plants of
// plants.ts), set down in patches of its own along the chapters, after the
// plants of world.ts, so the rest of the world grows back the same.

import { rng, spec, type Spec } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import { eachGlow3 } from '../engine3/render3';
import type { Projector } from '../engine3/view';
import { BIOMES, X0, X1, biomeIndex, presence, type ChapterId } from './biomes';
import type { Plant } from './sprites';

type R01 = () => number;

export interface FloreKind {
  spec: (R: R01, deep: boolean) => Spec;
  /** never moves with the water: always baked */
  rigid?: boolean;
  /** grows straight up (else leans a little) */
  upright?: boolean;
  /** size range */
  scale: [number, number];
  /** how deep its foot goes into the floor, world units */
  sink?: number;
  /** grown down from this height (at scale 1) to the floor, instead of up from it */
  top?: number;
  /** wide rather than tall: its plane turned nearly toward the eye, so it is not seen edge on */
  face?: boolean;
  /** how many in a patch, and how far apart */
  patch: [number, number];
  spread: number;
  /** some of its parts shine in the dark */
  glow?: boolean;
  /** draws back when the swimmer comes near (see shy): what its body keeps of its length meanwhile (1: stays, less: sinks into the sand) */
  shy?: number;
}

const pick = <T>(R: R01, l: T[]): T => l[Math.floor(R() * l.length)];
const ranges = (R: R01) => ({
  r: (a: number, c: number) => a + R() * (c - a),
  ri: (a: number, c: number) => Math.floor(a + R() * (c + 1 - a))
});

export const FLORE: Record<string, FloreKind> = {
  // tube anemone: a long crown of banded tentacles, the short ones of the mouth inside
  cerianthe: {
    scale: [0.9, 1.3], patch: [1, 3], spread: 40, upright: true, shy: 0.45,
    spec: (R) => {
      const { r, ri } = ranges(R);
      return spec({ name: 'Cérianthe', eyes: { on: false },
        palette: { hue: pick(R, [285, 30, 150, 320, 45, 200]), harmony: 'analog', sat: r(75, 95), light: r(46, 54) },
        body: { name: 'Tube', links: 3, len: 2.4, width: 1.6, shape: 'constant', style: 'plates', flex: 0.04, spring: 0.6, color: { slot: 2, light: -24 },
          attach: [
            { node: { name: 'Tentacule', links: 12, len: 3, width: 0.42, shape: 'linear', style: 'line', flex: 0.5, spring: 0.03, curl: -0.3, gravity: 0.03, drag: 0.8,
              color: { slot: 0, grad: 16, pattern: 'bands', pslot: 1, plight: 14, pdensity: 4 }, motion: { type: 'wave', amp: 0.12, freq: 0.35 } },
              pattern: 'fan', at: 1, count: ri(7, 10), angle: 1, spread: 1.1, jitter: 0.5, phaseStep: 0.4 },
            { node: { name: 'Tentacule oral', links: 5, len: 1.7, width: 0.38, shape: 'linear', style: 'line', flex: 0.3, spring: 0.1, color: { slot: 1, light: 18 },
              motion: { type: 'wave', amp: 0.1, freq: 0.5 } },
              pattern: 'fan', at: 1, count: 7, angle: 0, spread: 1, jitter: 0.4 }
          ] } });
    }
  },
  // bubble-tip anemone: fat tentacles, each swollen at its tip
  bulles: {
    face: true, scale: [0.9, 1.25], patch: [1, 2], spread: 50, rigid: true,
    spec: (R) => {
      const { r, ri } = ranges(R);
      return spec({ name: 'Anémone à bulles', eyes: { on: false },
        palette: { hue: pick(R, [120, 95, 330, 350, 20, 160]), harmony: 'complement', sat: r(60, 80), light: r(48, 56) },
        body: { name: 'Pied', links: 2, len: 2.4, width: 3.6, shape: 'bell', style: 'ribbon', flex: 0.05, spring: 0.6, color: { slot: 2, light: -14 },
          attach: [{ node: { name: 'Bulle', links: 4, len: 2.4, width: 1.5, shape: 'bulb', style: 'ribbon', flex: 0.35, spring: 0.12,
            color: { slot: 0, grad: 18 }, motion: { type: 'wave', amp: 0.14, freq: 0.4 },
            attach: [{ node: { name: 'Perle', links: 1, len: 0.4, width: 0.75, shape: 'constant', style: 'disc', color: { slot: 1, light: 16 } }, pattern: 'single', at: 1, angle: 0 }] },
            pattern: 'fan', at: 1, count: ri(8, 11), angle: 0.85, spread: 1.7, jitter: 0.6, phaseStep: 0.5, edge: 0.6 }] } });
    }
  },
  // plumose anemone: a tall smooth column under a cloud of fine tentacles
  metridium: {
    scale: [1, 1.7], patch: [2, 4], spread: 60, rigid: true, upright: true,
    spec: (R, deep) => {
      const { r } = ranges(R);
      return spec({ name: 'Anémone plumeuse', eyes: { on: false },
        palette: { hue: pick(R, [30, 20, 5, 40]), harmony: 'analog', sat: deep ? r(8, 18) : r(35, 65), light: r(74, 84) },
        body: { name: 'Colonne', links: 5, len: 3.6, width: 2.8, shape: 'bell', style: 'ribbon', flex: 0.08, spring: 0.5, color: { slot: 0, light: -10, grad: 12 },
          attach: [{ node: { name: 'Lobe', links: 3, len: 2.2, width: 1.4, shape: 'leaf', style: 'ribbon', flex: 0.2, spring: 0.2, curl: 0.5, color: { slot: 0, light: 4 },
            attach: [{ node: { name: 'Plumule', links: 3, len: 1.3, width: 0.2, shape: 'linear', style: 'line', flex: 0.4, spring: 0.1, curl: 0.4,
              color: { slot: 1, light: 12, alpha: 0.85 }, motion: { type: 'wave', amp: 0.2, freq: 0.6 } },
              pattern: 'series', at: 0.2, to: 1, count: 6, angle: 1.1, jitter: 0.6, scaleTo: 0.6 }] },
            pattern: 'fan', at: 1, count: 4, angle: 0.75, spread: 1.5, jitter: 0.5, phaseStep: 0.6 }] } });
    }
  },
  // brain coral: a dome ridged all over (grown down from its top, its flat end on the floor); some are star corals, dotted with polyps
  cerveau: {
    face: true, scale: [1.3, 2], patch: [1, 2], spread: 70, rigid: true, upright: true, sink: 3, top: 8,
    spec: (R) => {
      const { r, ri } = ranges(R);
      const star = R() < 0.35;
      return spec({ name: star ? 'Corail étoilé' : 'Corail cerveau', eyes: { on: false },
        palette: { hue: pick(R, [40, 30, 90, 330, 20, 60]), harmony: 'analog', sat: r(35, 55), light: r(50, 60) },
        body: { name: 'Dôme', links: 4, len: 2, width: r(9, 12), shape: 'bell', style: 'ribbon', flex: 0.01, spring: 0.95,
          color: star ? { slot: 0, grad: -10, pattern: 'spots', pslot: 1, plight: 18, pdensity: 12, pscale: 0.7 } : { slot: 0, grad: -10, pattern: 'bands', pslot: 2, plight: -12, pdensity: ri(4, 6) } } });
    }
  },
  // table coral: a short foot under a wide flat plate, bristling with little tips
  acropore: {
    face: true, scale: [1, 1.5], patch: [1, 2], spread: 80, rigid: true, upright: true,
    spec: (R) => {
      const { r, ri } = ranges(R);
      return spec({ name: 'Acropore table', eyes: { on: false },
        palette: { hue: pick(R, [30, 180, 200, 280, 90]), harmony: 'analog', sat: r(50, 70), light: r(52, 62) },
        body: { name: 'Pied', links: 2, len: 4, width: 2, shape: 'bell', style: 'ribbon', flex: 0.01, spring: 0.95, color: { slot: 0, light: -8 },
          attach: [{ node: { name: 'Table', links: 6, len: r(2.2, 2.8), width: 1.6, shape: 'tadpole', style: 'ribbon', flex: 0.01, spring: 0.95, curl: 0.12, color: { slot: 0, grad: 8 },
            attach: [{ node: { name: 'Pointe', links: 2, len: 1.5, width: 0.6, shape: 'linear', style: 'ribbon', flex: 0.01, spring: 0.95, color: { slot: 1, light: 14 } },
              pattern: 'series', at: 0.1, to: 1, count: ri(7, 10), angle: -1.35, mirror: false, jitter: 0.5 }] },
            pattern: 'pair', at: 1, angle: 1.5 }] } });
    }
  },
  // staghorn coral: thin branches forking again and again, pale at the tips
  corne: {
    scale: [1, 1.6], patch: [1, 3], spread: 60, rigid: true,
    spec: (R) => {
      const { r, ri } = ranges(R);
      const tip = { name: 'Pointe', links: 3, len: 2.2, width: 0.7, shape: 'linear', style: 'ribbon' as const, flex: 0.01, spring: 0.95, color: { slot: 1, grad: 25 } };
      return spec({ name: 'Corail corne de cerf', eyes: { on: false },
        palette: { hue: pick(R, [35, 25, 200, 270, 320]), harmony: 'analog', sat: r(35, 60), light: r(55, 64) },
        body: { name: 'Tronc', links: 2, len: 3, width: 1.3, shape: 'constant', style: 'ribbon', flex: 0.01, spring: 0.95, color: { slot: 0, light: -6 },
          attach: [{ node: { name: 'Branche', links: 3, len: 2.6, width: 0.95, shape: 'constant', style: 'ribbon', flex: 0.01, spring: 0.95, curl: 0.2, color: { slot: 0 },
            attach: [{ node: tip, pattern: 'fan', at: 1, count: 2, angle: 0, spread: 0.9, jitter: 0.8 },
              { node: tip, pattern: 'series', at: 0.5, to: 0.5, count: 1, angle: 0.9, alternate: true, jitter: 0.8 }] },
            pattern: 'fan', at: 1, count: ri(2, 3), angle: 0, spread: 1.4, jitter: 0.8 }] } });
    }
  },
  // Christmas tree worm: two little spiral trees of plumes, in bright colours, that vanish when you come
  spirobranche: {
    face: true, scale: [1.2, 1.7], patch: [2, 4], spread: 35, upright: true, shy: 1,
    spec: (R) => {
      const { r, ri } = ranges(R);
      return spec({ name: 'Ver arbre de Noël', eyes: { on: false },
        palette: { hue: pick(R, [0, 25, 48, 210, 280, 330, 185]), harmony: pick(R, ['analog', 'complement'] as const), sat: r(75, 95), light: r(52, 62) },
        body: { name: 'Tube', links: 1, len: 1.6, width: 1.5, shape: 'constant', style: 'ribbon', flex: 0.05, spring: 0.6, color: { slot: 3, light: -8 },
          attach: [{ node: { name: 'Spire', links: 7, len: 1.9, width: 0.5, shape: 'linear', style: 'line', flex: 0.08, spring: 0.5, color: { slot: 0, light: -10 },
            attach: [{ node: { name: 'Branchie', links: 2, len: 3.2, width: 0.5, shape: 'linear', style: 'line', flex: 0.15, spring: 0.3, curl: 0.5, color: { slot: 0, grad: 18 } },
              pattern: 'series', at: 0.05, to: 1, count: ri(10, 13), angle: 1.35, alternate: true, scaleTo: 0.25, jitter: 0.2, hueStep: 3 }] },
            pattern: 'pair', at: 1, angle: 0.3 }] } });
    }
  },
  // razor clam: a long narrow shell standing in the sand, its two siphons out
  couteau: {
    scale: [1.3, 1.7], patch: [3, 7], spread: 45, upright: true, sink: 4, shy: 0.3,
    spec: (R) => {
      const { r } = ranges(R);
      return spec({ name: 'Couteau', eyes: { on: false },
        palette: { hue: r(25, 45), harmony: 'analog', sat: r(25, 45), light: r(48, 58) },
        body: { name: 'Coquille', links: 4, len: 3, width: 1.2, shape: 'constant', style: 'ribbon', flex: 0.01, spring: 0.95,
          color: { slot: 0, grad: 14, pattern: 'bands', pslot: 2, plight: -12, pdensity: 6 },
          attach: [{ node: { name: 'Siphon', links: 3, len: 0.8, width: 0.5, shape: 'constant', style: 'ribbon', flex: 0.3, spring: 0.2,
            color: { slot: 1, light: 24, alpha: 0.9 }, motion: { type: 'wave', amp: 0.2, freq: 0.3 } },
            pattern: 'pair', at: 1, angle: 0.18, edge: 0.4 }] } });
    }
  },
  // giant clam: a fan of pale ribbed folds, the mantle bulging out between them in bright blues and greens
  benitier: {
    face: true, scale: [1.3, 1.9], patch: [1, 1], spread: 0, rigid: true, upright: true, sink: 2,
    spec: (R) => {
      const { r, ri } = ranges(R);
      return spec({ name: 'Bénitier', eyes: { on: false },
        palette: { hue: pick(R, [175, 195, 220, 260, 140]), harmony: 'analog', sat: r(70, 90), light: r(46, 54) },
        body: { name: 'Charnière', links: 1, len: 0.6, width: 0.8, shape: 'constant', style: 'ribbon', flex: 0.01, spring: 0.95, color: { slot: 2, light: 26 },
          attach: [
            { node: { name: 'Manteau', links: 3, len: 3.9, width: 2.6, shape: 'leaf', style: 'ribbon', flex: 0.01, spring: 0.95,
              color: { slot: 0, grad: 14, pattern: 'spots', pslot: 1, plight: 28, pdensity: 9, pscale: 1.2 } },
              pattern: 'fan', at: 1, count: ri(5, 6), angle: 0, spread: 2.4, jitter: 0.3 },
            { node: { name: 'Pli', links: 3, len: 2.6, width: 1.15, shape: 'constant', style: 'ribbon', flex: 0.01, spring: 0.95, color: { slot: 2, light: 38, grad: -14 } },
              pattern: 'fan', at: 1, count: 5, angle: 0, spread: 2.6, front: true }
          ] } });
    }
  },
  // sea squirts: a cluster of clear barrels, two openings on each
  ascidie: {
    scale: [1.3, 1.8], patch: [1, 3], spread: 40, rigid: true,
    spec: (R) => {
      const { r, ri } = ranges(R);
      return spec({ name: 'Ascidie', eyes: { on: false },
        palette: { hue: pick(R, [200, 260, 50, 300, 170]), harmony: 'analog', sat: r(50, 75), light: r(62, 72) },
        body: { name: 'Pied', links: 1, len: 0.8, width: 0.6, shape: 'constant', style: 'ribbon', flex: 0.05, spring: 0.6, color: { slot: 2, light: -10 },
          attach: [{ node: { name: 'Tunique', links: 3, len: 1.8, width: 1.4, shape: 'bloby', style: 'ribbon', flex: 0.06, spring: 0.5,
            color: { slot: 0, alpha: 0.5, grad: 10, pattern: 'stripe', pslot: 1, plight: 25, pscale: 0.6 }, motion: { type: 'breathe', amp: 0.06, freq: 0.2 },
            attach: [{ node: { name: 'Siphon', links: 1, len: 0.7, width: 0.55, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.4, color: { slot: 1, light: 20, alpha: 0.8 } },
              pattern: 'pair', at: 1, angle: 0.5 }] },
            pattern: 'fan', at: 1, count: ri(3, 6), angle: 0, spread: 1.4, jitter: 0.7, scaleTo: 0.7 }] } });
    }
  },
  // sea grapes: little upright stems covered in green beads
  caulerpe: {
    scale: [1, 1.4], patch: [2, 4], spread: 40, rigid: true,
    spec: (R) => {
      const { r, ri } = ranges(R);
      return spec({ name: 'Raisin de mer', eyes: { on: false },
        palette: { hue: r(95, 130), harmony: 'analog', sat: r(60, 80), light: r(34, 42) },
        body: { name: 'Stolon', links: 1, len: 0.8, width: 0.5, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 0, light: -8 },
          attach: [{ node: { name: 'Tige', links: 4, len: 3, width: 0.4, shape: 'constant', style: 'line', flex: 0.3, spring: 0.15, gravity: -0.02, color: { slot: 0 },
            motion: { type: 'wave', amp: 0.1, freq: 0.4 },
            attach: [{ node: { name: 'Grain', links: 1, len: 0.5, width: 0.7, shape: 'constant', style: 'disc', color: { slot: 1, light: 16 } },
              pattern: 'series', at: 0.25, to: 1, count: 6, angle: 1.3, alternate: true, jitter: 0.4 }] },
            pattern: 'fan', at: 1, count: ri(4, 6), angle: 0, spread: 2.4, jitter: 0.6, phaseStep: 0.7 }] } });
    }
  },
  // peacock's tail: fans of pale seaweed ringed with white
  padine: {
    scale: [1, 1.4], patch: [2, 4], spread: 45, rigid: true,
    spec: (R) => {
      const { r, ri } = ranges(R);
      return spec({ name: 'Padine', eyes: { on: false },
        palette: { hue: r(35, 60), harmony: 'analog', sat: r(40, 60), light: r(52, 62) },
        body: { name: 'Pied', links: 1, len: 0.8, width: 0.5, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 0, light: -10 },
          attach: [{ node: { name: 'Éventail', links: 5, len: 2, width: 4, shape: 'bell', style: 'ribbon', flex: 0.2, spring: 0.2, curl: 0.25, gravity: -0.02,
            color: { slot: 0, alpha: 0.9, grad: 12, pattern: 'bands', pslot: 3, plight: 22, pdensity: 4 }, motion: { type: 'wave', amp: 0.08, freq: 0.3 } },
            pattern: 'fan', at: 1, count: ri(3, 5), angle: 0, spread: 1.5, jitter: 0.7, phaseStep: 0.9 }] } });
    }
  },
  // upside-down jellyfish: it lies on the sand, bell down, its bushy frilled arms up, and beats slowly
  cassiopee: {
    face: true, scale: [1.4, 1.9], patch: [2, 4], spread: 60, sink: 1,
    spec: (R) => {
      const { r } = ranges(R);
      return spec({ name: 'Méduse à l’envers', eyes: { on: false },
        palette: { hue: r(28, 45), harmony: 'complement', sat: r(45, 60), light: r(46, 54) },
        body: { name: 'Centre', links: 1, len: 1, width: 1.4, shape: 'constant', style: 'ribbon', flex: 0.05, spring: 0.6, color: { slot: 0, light: -6 },
          attach: [
            { node: { name: 'Bras', links: 3, len: 1.2, width: 0.5, shape: 'constant', style: 'ribbon', flex: 0.2, spring: 0.2, curl: 0.3, color: { slot: 0 },
              motion: { type: 'wave', amp: 0.12, freq: 0.5 },
              attach: [{ node: { name: 'Frange', links: 2, len: 0.9, width: 0.9, shape: 'frill', style: 'ribbon', flex: 0.2, spring: 0.2,
                color: { slot: 0, light: 8, grad: 12, pattern: 'spots', pslot: 1, plight: 32, pdensity: 10 } },
                pattern: 'series', at: 0.3, to: 1, count: 3, angle: 0.9, alternate: true, jitter: 0.6 }] },
              pattern: 'fan', at: 1, count: 3, angle: 0.6, spread: 1, jitter: 0.6, phaseStep: 0.8 },
            { node: { name: 'Cloche', links: 4, len: 1.4, width: 1.3, shape: 'leaf', style: 'ribbon', flex: 0.05, spring: 0.5, curl: -0.15,
              color: { slot: 0, alpha: 0.9, light: -4, pattern: 'edge', pslot: 1, plight: 25 }, motion: { type: 'breathe', amp: 0.25, freq: 0.7 } },
              pattern: 'pair', at: 0, angle: 1.5, front: true }
          ] } });
    }
  },
  // basket star: five arms raised and forking again and again, curled like fern sprouts
  panier: {
    scale: [1, 1.5], patch: [1, 1], spread: 0, rigid: true, upright: true, face: true,
    spec: (R) => {
      const { r } = ranges(R);
      const twig = { name: 'Vrille', links: 4, len: 1.1, width: 0.3, shape: 'linear', style: 'line' as const, flex: 0.3, spring: 0.15, curl: 1.2, color: { slot: 0, grad: 14 },
        motion: { type: 'wave' as const, amp: 0.12, freq: 0.4 } };
      return spec({ name: 'Étoile-panier', eyes: { on: false },
        palette: { hue: pick(R, [28, 40, 15, 330]), harmony: 'analog', sat: r(45, 65), light: r(58, 68) },
        body: { name: 'Disque', links: 1, len: 1.2, width: 2.2, shape: 'constant', style: 'ribbon', flex: 0.05, spring: 0.6, color: { slot: 0, light: -8 },
          attach: [{ node: { name: 'Bras', links: 4, len: 1.8, width: 0.6, shape: 'linear', style: 'line', flex: 0.2, spring: 0.2, curl: 0.4, color: { slot: 0 },
            attach: [{ node: { name: 'Rameau', links: 4, len: 1.4, width: 0.45, shape: 'linear', style: 'line', flex: 0.25, spring: 0.2, curl: 0.6, color: { slot: 0, light: 4 },
              attach: [{ node: twig, pattern: 'fan', at: 1, count: 2, angle: 0, spread: 1.1, jitter: 0.5 }] },
              pattern: 'fan', at: 1, count: 2, angle: 0, spread: 1, jitter: 0.5 }] },
            pattern: 'fan', at: 1, count: 5, angle: 0, spread: 2.6, jitter: 0.4, phaseStep: 0.7 }] } });
    }
  },
  // Venus' flower basket: a tall glass vase, a lattice of rings, crowned with a fringe
  euplecte: {
    scale: [1, 1.5], patch: [1, 3], spread: 50, rigid: true, upright: true,
    spec: (R) => {
      const { r } = ranges(R);
      return spec({ name: 'Corbeille de Vénus', eyes: { on: false },
        palette: { hue: r(40, 60), harmony: 'mono', sat: r(10, 25), light: r(78, 86) },
        body: { name: 'Vase', links: 6, len: 2.6, width: 2.8, shape: 'bell', style: 'ribbon', flex: 0.02, spring: 0.9, curl: r(-0.08, 0.08),
          color: { slot: 0, alpha: 0.6, grad: 6, pattern: 'bands', pslot: 1, plight: 8, pdensity: 7 },
          attach: [
            { node: { name: 'Frange', links: 3, len: 0.8, width: 0.2, shape: 'linear', style: 'line', flex: 0.1, spring: 0.5, color: { slot: 1, alpha: 0.8 } },
              pattern: 'fan', at: 1, count: 9, angle: 0, spread: 2.4, jitter: 0.6, edge: 0.9 },
            { node: { name: 'Touffe', links: 3, len: 0.9, width: 0.2, shape: 'linear', style: 'line', flex: 0.2, spring: 0.3, color: { slot: 1, alpha: 0.7 } },
              pattern: 'fan', at: 0, count: 5, angle: Math.PI, spread: 1.8, jitter: 0.6 }
          ] } });
    }
  },
  // bamboo coral of the deep: white stems jointed with black, their polyps shining blue
  bambou: {
    scale: [1.1, 1.8], patch: [1, 3], spread: 70, rigid: true, glow: true,
    spec: (R) => {
      const { r, ri } = ranges(R);
      return spec({ name: 'Corail bambou', eyes: { on: false },
        palette: { hue: pick(R, [200, 185, 230]), harmony: 'complement', sat: r(20, 40), light: r(74, 84) },
        body: { name: 'Tronc', links: 6, len: 3.2, width: 0.7, shape: 'linear', style: 'line', flex: 0.02, spring: 0.9, color: { slot: 0, pattern: 'bands', pslot: 1, plight: -60, pdensity: 3 },
          attach: [{ node: { name: 'Branche', links: 4, len: 2.6, width: 0.4, shape: 'linear', style: 'line', flex: 0.02, spring: 0.9, curl: -0.3, color: { slot: 0, pattern: 'bands', pslot: 1, plight: -60, pdensity: 2 },
            attach: [{ node: { name: 'Polype', links: 1, len: 0.5, width: 0.55, shape: 'constant', style: 'disc', color: { slot: 0, shift: 0, light: 10, glow: 'tip' } },
              pattern: 'single', at: 1, angle: 0 }] },
            pattern: 'series', at: 0.3, to: 1, count: ri(4, 6), angle: 0.7, alternate: true, jitter: 0.5 }] } });
    }
  },
  // harp sponge: two arms along the floor, a row of strings standing on each, a pale bead atop each string
  harpe: {
    face: true, scale: [1.1, 1.6], patch: [1, 2], spread: 80, rigid: true, upright: true, glow: true,
    spec: (R) => {
      const { r, ri } = ranges(R);
      return spec({ name: 'Éponge harpe', eyes: { on: false },
        palette: { hue: r(28, 45), harmony: 'analog', sat: r(15, 30), light: r(76, 84) },
        body: { name: 'Pied', links: 1, len: 1.2, width: 0.8, shape: 'constant', style: 'ribbon', flex: 0.02, spring: 0.9, color: { slot: 0, light: -8 },
          attach: [{ node: { name: 'Bras', links: 6, len: 2, width: 0.55, shape: 'constant', style: 'ribbon', flex: 0.02, spring: 0.9, curl: -0.2, color: { slot: 0 },
            attach: [{ node: { name: 'Corde', links: 6, len: 2.2, width: 0.28, shape: 'constant', style: 'line', flex: 0.02, spring: 0.9, color: { slot: 0, light: 4 },
              attach: [{ node: { name: 'Perle', links: 1, len: 0.5, width: 0.8, shape: 'constant', style: 'disc', color: { slot: 1, light: 12, glow: 'tip' } },
                pattern: 'single', at: 1, angle: 0 }] },
              pattern: 'series', at: 0.2, to: 1, count: ri(4, 6), angle: -1.45, mirror: false, jitter: 0.3 }] },
            pattern: 'pair', at: 1, angle: 1.5 }] } });
    }
  },
  // ping-pong tree sponge: a thin stalk hung with clear, shining spheres
  pingpong: {
    scale: [1.1, 1.6], patch: [1, 3], spread: 50, rigid: true, upright: true, glow: true,
    spec: (R) => {
      const { r, ri } = ranges(R);
      return spec({ name: 'Éponge ping-pong', eyes: { on: false },
        palette: { hue: pick(R, [45, 190, 30]), harmony: 'analog', sat: r(20, 40), light: r(72, 82) },
        body: { name: 'Tige', links: 8, len: 3.2, width: 0.3, shape: 'constant', style: 'line', flex: 0.1, spring: 0.3, drag: 0.75, color: { slot: 0, light: -6 },
          attach: [{ node: { name: 'Rameau', links: 2, len: 1.4, width: 0.22, shape: 'constant', style: 'line', flex: 0.2, spring: 0.3, color: { slot: 0 },
            attach: [{ node: { name: 'Sphère', links: 1, len: 0.6, width: 1.3, shape: 'constant', style: 'disc', color: { slot: 1, light: 14, alpha: 0.6, glow: 'tip' } },
              pattern: 'single', at: 1, angle: 0 }] },
            pattern: 'series', at: 0.25, to: 1, count: ri(5, 8), angle: 1.1, alternate: true, jitter: 0.4, scaleTo: 0.7 }] } });
    }
  }
};

/** what each chapter adds, in patches: how far apart the patches are, and which kinds (weights) */
export const FLORE_OF: Partial<Record<ChapterId, { every: number; kinds: [string, number][] }>> = {
  nurserie: { every: 140, kinds: [['couteau', 2.5], ['caulerpe', 2.5], ['padine', 2], ['cassiopee', 2], ['cerianthe', 1], ['bulles', 0.5]] },
  recif: { every: 90, kinds: [['cerveau', 2.5], ['acropore', 2], ['corne', 2], ['benitier', 1.8], ['bulles', 1.5], ['spirobranche', 2], ['ascidie', 1], ['cerianthe', 0.6], ['caulerpe', 0.5]] },
  foret: { every: 190, kinds: [['metridium', 3], ['ascidie', 1.5], ['panier', 1], ['cerianthe', 1], ['couteau', 1], ['padine', 0.5]] },
  grotte: { every: 260, kinds: [['ascidie', 2], ['metridium', 1.5], ['spirobranche', 0.6], ['bambou', 0.5]] },
  carcasse: { every: 300, kinds: [['metridium', 1], ['cerianthe', 1.5], ['panier', 0.8], ['euplecte', 0.8], ['bambou', 0.8], ['pingpong', 0.3]] },
  sources: { every: 380, kinds: [['bambou', 1], ['metridium', 0.6]] },
  glacier: { every: 280, kinds: [['metridium', 2], ['euplecte', 1.5], ['panier', 1], ['harpe', 1], ['bambou', 1]] },
  fosse: { every: 320, kinds: [['harpe', 1.5], ['pingpong', 1.5], ['euplecte', 1], ['bambou', 1]] },
  remontee: { every: 260, kinds: [['harpe', 1], ['pingpong', 1], ['bambou', 1]] }
};

/** the kinds that never move with the water */
export const FLORE_RIGID = Object.keys(FLORE).filter((k) => FLORE[k].rigid);

/** the chapter that owns x, drawn by chance near a border */
function ownerAt(x: number, R: R01): number {
  const i = biomeIndex(x);
  for (const j of [i - 1, i + 1]) {
    if (j < 0 || j >= BIOMES.length) continue;
    const p = presence(x, j);
    if (p > 0 && R() < p * 0.8) return j;
  }
  return i;
}

function weighted(R: R01, l: [string, number][]): string {
  let s = 0;
  for (const [, w] of l) s += w;
  let u = R() * s;
  for (const [k, w] of l) { u -= w; if (u <= 0) return k; }
  return l[l.length - 1][0];
}

/** where the patches grow along the world: [kind, x, z], the same every time */
export function placeFlore(seed = 93): [string, number, number][] {
  const R = rng(seed), out: [string, number, number][] = [];
  for (let x = X0 + 100; x < X1;) {
    const b = BIOMES[ownerAt(x, R)], f = FLORE_OF[b.id];
    // nothing where the floor falls out of sight
    if (!f || b.abyss || BIOMES[biomeIndex(x)].abyss) { x += 200; continue; }
    const kind = weighted(R, f.kinds), k = FLORE[kind];
    // most patches near the swimming plane, where they are seen up close
    const z = -30 + Math.pow(R(), 1.6) * 950;
    const n = k.patch[0] + Math.floor(R() * (k.patch[1] - k.patch[0] + 1));
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, d = i ? k.spread * (0.3 + R() * 0.7) : 0, px = x + Math.cos(a) * d;
      if (!BIOMES[biomeIndex(px)].abyss) out.push([kind, px, z + Math.sin(a) * d * 0.6]);
    }
    x += f.every * (0.5 + R());
  }
  return out;
}

export function floreSpec(kind: string, R: R01, deep: boolean): Spec | null {
  const k = FLORE[kind];
  return k ? k.spec(R, deep) : null;
}

// ----- the shy ones: they draw back when the swimmer comes near, and come out again once all is calm ----- //

/** how far out a shy one is (1: open, 0: drawn back), and how long all has been calm around it */
export interface Shyness { out: number; calm: number; }

/** quick to hide, slow to trust again */
export const SHY = { reach: 60, hide: 0.25, wait: 2.5, open: 2.5 };

export function shyStep(s: Shyness, near: boolean, dt: number): void {
  if (near) { s.calm = 0; s.out = Math.max(0, s.out - dt / SHY.hide); return; }
  s.calm += dt;
  if (s.calm > SHY.wait) s.out = Math.min(1, s.out + dt / SHY.open);
}

interface ShyState extends Shyness { t: number; shown: number; lens: Float32Array[]; rad: Float32Array[]; }
const shyStates = new WeakMap<Creature3, ShyState>();

/** a live plant of a shy kind: follow the swimmer (at x, y on the swimming plane) and fold its parts in or out */
export function shy(pl: Plant, px: number, py: number, t: number): void {
  const keep = FLORE[pl.kind]?.shy, cr = pl.cr;
  if (keep === undefined || !cr) return;
  let s = shyStates.get(cr);
  if (!s) {
    s = { out: 1, calm: SHY.wait, t, shown: 1, lens: cr.list.map((g) => g.lens.slice()), rad: cr.list.map((g) => g.rad.slice()) };
    shyStates.set(cr, s);
  }
  const r = cr.root, top = r.y[r.n];
  shyStep(s, Math.hypot(px - pl.x, py - top, pl.z * 0.7) < SHY.reach, Math.min(0.1, Math.max(0, t - s.t)));
  s.t = t;
  // eased, so the parts snap in and unfold softly
  const k = s.out * s.out * (3 - 2 * s.out);
  if (Math.abs(k - s.shown) < 0.002) return;
  s.shown = k;
  cr.list.forEach((g, i) => {
    const body = g === r, f = body ? keep + (1 - keep) * k : 0.04 + 0.96 * k;
    for (let j = 1; j <= g.n; j++) g.lens[j] = s.lens[i][j] * f;
    if (!body) for (let j = 0; j <= g.n; j++) g.rad[j] = Math.max(0.05, s.rad[i][j] * f);
  });
}

// ----- the lights of the deep ones ----- //

/** a plant whose parts shine: its lights (x, y, size, hue, alpha, on screen) into `lights`, stronger in the dark, each breathing slowly */
export function floreLights(pl: Plant, view: Projector, dark: number, t: number, lights: number[]): void {
  if (!pl.cr || !FLORE[pl.kind]?.glow) return;
  const a = 0.12 + 0.55 * dark;
  let k = 0;
  eachGlow3(pl.cr, view, (x, y, size, hue, al) => {
    lights.push(x, y, size * 0.8, hue, al * a * (0.75 + 0.25 * Math.sin(t * 1.3 + pl.seed + k++ * 1.7)));
  });
}
