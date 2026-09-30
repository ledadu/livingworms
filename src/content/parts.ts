// The library of parts: each one with the attachment it usually comes with.

import { att, clone, type AttDef, type AttInput, type NodeInput } from '../engine';

export interface PartDef { desc: string; node: NodeInput; att: AttInput; }

export const PARTS: Record<string, PartDef> = {
  tentacule: {
    desc: 'Fouet souple qui claque',
    node: { name: 'Tentacule', role: 'whip', links: 12, len: 5.5, width: 2.4, shape: 'virgule', style: 'ribbon', flex: 0.75, spring: 0.02, drag: 0.88, color: { slot: 1 } },
    att: { pattern: 'pair', at: 0.4, angle: 1.2, edge: 0.6 }
  },
  filament: {
    desc: 'Long fil translucide qui pique',
    node: { name: 'Filament', role: 'sting', links: 20, len: 5, width: 0.55, shape: 'linear', style: 'line', flex: 0.35, spring: 0.04, drag: 0.7, color: { slot: 1, alpha: 0.75, fade: 0.7, light: 10, add: true } },
    att: { pattern: 'fan', at: 1, count: 8, spread: 1.4, edge: 0.95, scaleTo: 0.7, angle: 0, phaseStep: 0.4 }
  },
  brasOral: {
    desc: 'Ruban plissé qui ondule',
    node: { name: 'Bras oral', role: 'deco', links: 12, len: 4.5, width: 3, shape: 'frill', style: 'ribbon', flex: 0.35, spring: 0.08, drag: 0.72, color: { slot: 2, alpha: 0.8, light: 6 }, motion: { type: 'curl', amp: 0.8, freq: 0.5 } },
    att: { pattern: 'fan', at: 1, count: 4, spread: 0.45, edge: 0.35, angle: 0, phaseStep: 1.2, front: true }
  },
  antenne: {
    desc: 'Longue antenne arquée',
    node: { name: 'Antenne', role: 'sense', links: 22, len: 5, width: 0.5, shape: 'linear', style: 'line', flex: 0.1, spring: 0.25, curl: -1.3, drag: 0.82, color: { slot: 2, light: 8 } },
    att: { pattern: 'pair', at: 0, angle: 2.8, edge: 0.5 }
  },
  patte: {
    desc: 'Pattes articulées qui marchent en rythme',
    node: { drive: 'walk', name: 'Patte', role: 'deco', links: 3, len: 5, width: 0.9, shape: 'linear', style: 'line', flex: 0.25, spring: 0.35, curl: 0.9, color: { slot: 1, light: -4 }, motion: { type: 'row', amp: 0.35, freq: 1.4 } },
    att: { pattern: 'series', at: 0.12, to: 0.42, count: 5, angle: 1.9, angleTo: 1.4, edge: 0.8, scaleTo: 0.8, phaseStep: 0.9, mirror: true }
  },
  pleopode: {
    desc: 'Petites palettes qui rament',
    node: { drive: 'paddle', name: 'Pléopode', role: 'fin', links: 3, len: 3.5, width: 1.6, shape: 'leaf', style: 'ribbon', flex: 0.4, spring: 0.3, curl: 0.3, color: { slot: 3, alpha: 0.9 }, motion: { type: 'row', amp: 0.55, freq: 2.2 } },
    att: { pattern: 'series', at: 0.5, to: 0.82, count: 5, angle: 1.7, edge: 0.7, scaleTo: 0.7, phaseStep: 0.8, mirror: true }
  },
  nageoire: {
    desc: 'Aile qui bat et donne de la vitesse',
    node: { name: 'Nageoire', role: 'fin', links: 5, len: 4.5, width: 4.5, shape: 'leaf', style: 'ribbon', flex: 0.5, spring: 0.2, curl: 0.4, color: { slot: 1, alpha: 0.85 }, motion: { type: 'wave', amp: 0.5, freq: 1.3 } },
    att: { pattern: 'pair', at: 0.12, angle: 1.4, edge: 0.8 }
  },
  eventail: {
    desc: 'Queue en éventail de plaques',
    node: { name: 'Uropode', role: 'fin', links: 3, len: 4, width: 2.6, shape: 'leaf', style: 'plates', flex: 0.15, spring: 0.4, color: { slot: 0, light: 4 } },
    att: { pattern: 'fan', at: 1, count: 5, spread: 1.2, angle: 0, scaleTo: 0.85 }
  },
  oeil: {
    desc: 'Œil au bout d\'un pédoncule',
    node: { name: 'Œil', role: 'deco', links: 2, len: 3, width: 1.8, shape: 'constant', style: 'eye', flex: 0.1, spring: 0.5, color: { slot: 2 } },
    att: { pattern: 'pair', at: 0.03, angle: 2.3, edge: 0.7, front: true }
  },
  dard: {
    desc: 'Pointe rigide qui pique',
    node: { name: 'Dard', role: 'sting', links: 6, len: 2.6, width: 2.2, shape: 'linear', style: 'ribbon', flex: 0.08, spring: 0.5, color: { slot: 3, light: 12, glow: 'tip' } },
    att: { pattern: 'single', at: 1, angle: 0 }
  },
  pince: {
    desc: 'Deux crochets qui mordent',
    node: { name: 'Pince', role: 'jaw', links: 4, len: 3.5, width: 2.4, shape: 'virgule', style: 'plates', flex: 0.2, spring: 0.4, curl: -1.2, color: { slot: 0, light: -6 } },
    att: { pattern: 'pair', at: 0, angle: 2.9, edge: 0.4, front: true }
  },
  cils: {
    desc: 'Rangée de cils qui battent en vague',
    node: { name: 'Cil', role: 'cilia', links: 3, len: 3, width: 0.6, shape: 'linear', style: 'line', flex: 0.4, spring: 0.2, color: { slot: 2, alpha: 0.8 }, motion: { type: 'row', amp: 0.6, freq: 2.5 } },
    att: { pattern: 'series', at: 0.1, to: 0.95, count: 12, angle: 1.57, edge: 0.9, phaseStep: 0.5, mirror: true }
  },
  lanterne: {
    desc: 'Leurre lumineux qui éclaire',
    node: { name: 'Lanterne', role: 'light', links: 9, len: 4, width: 3, shape: 'bulb', style: 'ribbon', flex: 0.3, spring: 0.2, curl: -1.3, color: { slot: 1, light: 14, glow: 'tip' } },
    att: { pattern: 'single', at: 0, angle: 2.8 }
  },
  radiole: {
    desc: 'Plume de filtreur garnie de barbules',
    node: {
      name: 'Radiole', role: 'deco', links: 10, len: 4, width: 0.9, shape: 'linear', style: 'line', flex: 0.3, spring: 0.15, curl: 0.3, color: { slot: 1 }, motion: { type: 'wave', amp: 0.12, freq: 0.6 },
      attach: [{ node: { name: 'Barbule', links: 2, len: 2.5, width: 0.35, shape: 'linear', style: 'line', flex: 0.3, spring: 0.3, color: { slot: 2, alpha: 0.85 } }, pattern: 'series', at: 0.15, to: 1, count: 5, angle: 1.1, scaleTo: 0.6, mirror: true }]
    },
    att: { pattern: 'fan', at: 0, angle: Math.PI, count: 6, spread: 1.8, edge: 0.5, phaseStep: 0.4 }
  },
  cerates: {
    desc: 'Papilles venimeuses des nudibranches',
    node: { name: 'Cérate', role: 'sting', links: 4, len: 3, width: 1.8, shape: 'worm', style: 'ribbon', flex: 0.35, spring: 0.25, color: { slot: 1, grad: 22, glow: 'tip' }, motion: { type: 'wave', amp: 0.15, freq: 0.8 } },
    att: { pattern: 'series', at: 0.18, to: 0.9, count: 8, angle: 1.3, angleTo: 0.7, edge: 0.8, scaleTo: 0.6, phaseStep: 0.6, mirror: true }
  },
  massue: {
    desc: 'Long bras de calmar terminé en massue',
    node: { name: 'Massue', role: 'whip', links: 16, len: 5, width: 2.4, shape: 'club', style: 'ribbon', flex: 0.6, spring: 0.04, drag: 0.88, color: { slot: 0, light: 4 } },
    att: { pattern: 'pair', at: 1, angle: 0.25, edge: 0.4 }
  },
  bras: {
    desc: 'Bras charnus qui s\'enroulent, et tirent le poulpe par saccades',
    node: { drive: 'pull', name: 'Bras', role: 'whip', links: 10, len: 4.5, width: 2.6, shape: 'virgule', style: 'ribbon', flex: 0.55, spring: 0.06, color: { slot: 0 }, motion: { type: 'curl', amp: 1.2, freq: 0.4 } },
    att: { pattern: 'fan', at: 1, count: 8, spread: 0.9, edge: 0.7, angle: 0, phaseStep: 0.7, scaleTo: 0.85 }
  },
  rostre: {
    desc: 'Épine frontale rigide',
    node: { name: 'Rostre', role: 'sting', links: 4, len: 3, width: 1.1, shape: 'linear', style: 'ribbon', flex: 0.05, spring: 0.6, color: { slot: 0, light: 8 } },
    att: { pattern: 'single', at: 0, angle: Math.PI }
  },
  rayons: {
    desc: 'Nageoire à rayons reliés par une membrane',
    node: { name: 'Rayon', role: 'fin', links: 6, len: 4, width: 0.6, shape: 'linear', style: 'line', flex: 0.3, spring: 0.3, curl: 0.4, color: { slot: 1 }, motion: { type: 'wave', amp: 0.15, freq: 0.8 } },
    att: { pattern: 'fan', at: 0.25, count: 6, spread: 1, angle: 1.6, mirror: true, web: 0.95, phaseStep: 0.15 }
  },
  caudale: {
    desc: 'Queue en éventail palmée',
    node: { name: 'Rayon caudal', role: 'fin', links: 7, len: 4, width: 0.6, shape: 'linear', style: 'line', flex: 0.4, spring: 0.12, drag: 0.82, color: { slot: 1 } },
    att: { pattern: 'fan', at: 1, count: 7, spread: 1.1, angle: 0, web: 1, scaleTo: 1.25, phaseStep: 0.2 }
  },
  voile: {
    desc: 'Voile de nageoire long et flottant',
    node: { name: 'Voile', role: 'fin', links: 12, len: 4.5, width: 0.8, shape: 'linear', style: 'line', flex: 0.5, spring: 0.05, drag: 0.8, color: { slot: 1, grad: -12, alpha: 0.9 } },
    att: { pattern: 'fan', at: 1, count: 9, spread: 1.6, angle: 0, web: 1, jitter: 0.3, phaseStep: 0.3 }
  },
  aile: {
    desc: 'Grande aile qui ondule, comme une raie',
    node: { drive: 'ripple', name: 'Aile', role: 'fin', links: 6, len: 8, width: 9, shape: 'leaf', style: 'ribbon', flex: 0.35, spring: 0.25, curl: 0.6, color: { slot: 0 }, motion: { type: 'wave', amp: 0.45, freq: 0.6 } },
    att: { pattern: 'pair', at: 0.35, angle: 1.45, edge: 0.8 }
  },
  collerette: {
    desc: 'Nageoire continue qui ondule tout autour',
    node: { drive: 'ripple', name: 'Collerette', role: 'fin', links: 2, len: 3, width: 1.8, shape: 'leaf', style: 'ribbon', flex: 0.4, spring: 0.3, color: { slot: 1, alpha: 0.75 }, motion: { type: 'wave', amp: 0.35, freq: 2 } },
    att: { pattern: 'series', at: 0.05, to: 0.95, count: 14, angle: 1.57, edge: 1, phaseStep: 0.45, mirror: true, web: 1 }
  },
  brasEtoile: {
    desc: 'Bras rayonnants d\'étoile de mer',
    node: { name: 'Bras', role: 'deco', links: 7, len: 5, width: 4.5, shape: 'linear', style: 'ribbon', flex: 0.2, spring: 0.35, color: { slot: 0 }, motion: { type: 'curl', amp: 0.3, freq: 0.3 } },
    att: { pattern: 'ring', at: 0, count: 5, angle: 0, edge: 0.8, phaseStep: 1.2 }
  },
  epines: {
    desc: 'Couronne de piquants rigides',
    node: { name: 'Piquant', role: 'sting', links: 3, len: 6, width: 0.6, shape: 'linear', style: 'line', flex: 0.05, spring: 0.7, color: { slot: 1 }, motion: { type: 'wave', amp: 0.08, freq: 0.6 } },
    att: { pattern: 'ring', at: 0, count: 20, angle: 0, edge: 0.9, jitter: 0.6, phaseStep: 0.3 }
  },
  couronne: {
    desc: 'Anneau de tentacules d\'anémone',
    node: { name: 'Tentacule d\'anémone', role: 'sting', links: 8, len: 4, width: 1.6, shape: 'bulb', style: 'ribbon', flex: 0.4, spring: 0.15, color: { slot: 1, grad: 15 }, motion: { type: 'wave', amp: 0.25, freq: 0.5 } },
    att: { pattern: 'ring', at: 0, count: 16, angle: 0, edge: 0.85, jitter: 0.6, phaseStep: 0.5 }
  },
  branchie: {
    desc: 'Branchies plumeuses d\'axolotl',
    node: {
      name: 'Branchie', role: 'deco', links: 5, len: 3.5, width: 0.9, shape: 'linear', style: 'line', flex: 0.3, spring: 0.25, curl: 0.3, color: { slot: 1, light: -8 }, motion: { type: 'wave', amp: 0.12, freq: 0.7 },
      attach: [{ node: { name: 'Filament branchial', links: 2, len: 2, width: 0.4, shape: 'linear', style: 'line', flex: 0.3, spring: 0.3, color: { slot: 1, light: -4 } }, pattern: 'series', at: 0.3, to: 1, count: 3, angle: 0.9, scaleTo: 0.7, mirror: true }]
    },
    att: { pattern: 'fan', at: 0.05, count: 3, spread: 0.9, angle: 2.1, mirror: true, edge: 0.9, phaseStep: 0.6 }
  },
  feuille: {
    desc: 'Appendices en feuilles, alternés gauche / droite',
    node: { name: 'Feuille', role: 'deco', links: 4, len: 4, width: 3, shape: 'leaf', style: 'ribbon', flex: 0.35, spring: 0.2, curl: 0.8, color: { slot: 1, alpha: 0.85, grad: 15 }, motion: { type: 'wave', amp: 0.2, freq: 0.5 } },
    att: { pattern: 'series', at: 0.1, to: 0.95, count: 8, angle: 1.3, alternate: true, jitter: 0.6, edge: 0.8, phaseStep: 0.7 }
  },
  patteMarche: {
    desc: 'Pattes articulées de crabe',
    node: { drive: 'walk', name: 'Patte', role: 'deco', links: 4, len: 6, width: 1.7, shape: 'linear', style: 'plates', flex: 0.12, spring: 0.5, curl: 1, color: { slot: 0, light: -4 }, motion: { type: 'row', amp: 0.3, freq: 1.8 } },
    att: { pattern: 'series', at: 0.2, to: 0.9, count: 4, angle: 1.9, angleTo: 1.3, edge: 0.95, phaseStep: 1.2, mirror: true }
  },
  pinceHomard: {
    desc: 'Grosse pince à deux doigts',
    node: {
      name: 'Bras de pince', role: 'jaw', links: 3, len: 7, width: 3.5, shape: 'worm', style: 'plates', flex: 0.15, spring: 0.45, curl: 0.4, color: { slot: 0 },
      attach: [{ node: { name: 'Doigt', role: 'jaw', links: 3, len: 5, width: 3, shape: 'virgule', style: 'plates', flex: 0.1, spring: 0.5, curl: -0.8, color: { slot: 0, light: 6 } }, pattern: 'pair', at: 1, angle: 0.28 }]
    },
    att: { pattern: 'pair', at: 0.08, angle: 2.5, edge: 0.8 }
  },
  barbillon: {
    desc: 'Barbillons fins autour de la bouche',
    node: { name: 'Barbillon', role: 'sense', links: 8, len: 3.5, width: 0.45, shape: 'linear', style: 'line', flex: 0.3, spring: 0.15, curl: -0.8, color: { slot: 0, light: 10 } },
    att: { pattern: 'pair', at: 0, angle: 2.6, edge: 0.5 }
  },
  parapode: {
    desc: 'Pattes à soies urticantes de ver de feu',
    node: {
      name: 'Parapode', role: 'deco', links: 2, len: 2.5, width: 1, shape: 'leaf', style: 'ribbon', flex: 0.3, spring: 0.3, color: { slot: 1 }, motion: { type: 'row', amp: 0.4, freq: 1.4 },
      attach: [{ node: { name: 'Soie', role: 'sting', links: 3, len: 2.5, width: 0.3, shape: 'linear', style: 'line', flex: 0.2, spring: 0.4, color: { slot: 3, light: 15 } }, pattern: 'fan', at: 1, count: 2, spread: 0.7, angle: 0 }]
    },
    att: { pattern: 'series', at: 0.05, to: 0.95, count: 10, angle: 1.57, edge: 0.9, phaseStep: 0.5, mirror: true }
  },
  photophore: {
    desc: 'Points lumineux le long du corps',
    node: { name: 'Photophore', role: 'light', links: 1, len: 1, width: 1.3, shape: 'constant', style: 'disc', flex: 0.1, spring: 0.5, color: { slot: 3, light: 20, glow: 'tip' } },
    att: { pattern: 'series', at: 0.15, to: 0.85, count: 5, angle: 1.57, edge: 0.75, mirror: true }
  },
  peigne: {
    desc: 'Rangée de palettes irisées de cténophore',
    node: { name: 'Palette', role: 'cilia', links: 1, len: 2.4, width: 1.2, shape: 'leaf', style: 'ribbon', flex: 0.2, spring: 0.5, color: { slot: 1, alpha: 0.95, add: true, glow: 'tip' }, motion: { type: 'row', amp: 0.8, freq: 3 } },
    att: { pattern: 'series', at: 0.1, to: 0.9, count: 10, angle: 1.57, edge: 0.95, phaseStep: 0.45, hueStep: 22, mirror: true }
  }
};

export function part(id: string, nodeOver?: NodeInput | null, attOver?: AttInput | null): AttDef {
  const p = PARTS[id], n: NodeInput = clone(p.node);
  if (nodeOver) {
    Object.assign(n, nodeOver);
    n.color = { ...p.node.color, ...nodeOver.color };
    n.motion = { ...p.node.motion, ...nodeOver.motion };
  }
  return att({ ...p.att, ...attOver, node: n });
}
