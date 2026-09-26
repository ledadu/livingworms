// HYDRA bestiary — the content built with engine.js: a library of parts
// (each with the attachment it usually comes with) and the species, sorted
// by family, with where they live in the game.

(function (global) {
'use strict';

var E = global.HydraEngine;
var spec = E.spec, att = E.att, clone = E.clone, assign = E.assign;

var PARTS = {
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
    node: { name: 'Patte', role: 'deco', links: 3, len: 5, width: 0.9, shape: 'linear', style: 'line', flex: 0.25, spring: 0.35, curl: 0.9, color: { slot: 1, light: -4 }, motion: { type: 'row', amp: 0.35, freq: 1.4 } },
    att: { pattern: 'series', at: 0.12, to: 0.42, count: 5, angle: 1.9, angleTo: 1.4, edge: 0.8, scaleTo: 0.8, phaseStep: 0.9, mirror: true }
  },
  pleopode: {
    desc: 'Petites palettes qui rament',
    node: { name: 'Pléopode', role: 'fin', links: 3, len: 3.5, width: 1.6, shape: 'leaf', style: 'ribbon', flex: 0.4, spring: 0.3, curl: 0.3, color: { slot: 3, alpha: 0.9 }, motion: { type: 'row', amp: 0.55, freq: 2.2 } },
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
    desc: 'Bras charnus qui s\'enroulent',
    node: { name: 'Bras', role: 'whip', links: 10, len: 4.5, width: 2.6, shape: 'virgule', style: 'ribbon', flex: 0.55, spring: 0.06, color: { slot: 0 }, motion: { type: 'curl', amp: 1.2, freq: 0.4 } },
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
    node: { name: 'Aile', role: 'fin', links: 6, len: 8, width: 9, shape: 'leaf', style: 'ribbon', flex: 0.35, spring: 0.25, curl: 0.6, color: { slot: 0 }, motion: { type: 'wave', amp: 0.45, freq: 0.6 } },
    att: { pattern: 'pair', at: 0.35, angle: 1.45, edge: 0.8 }
  },
  collerette: {
    desc: 'Nageoire continue qui ondule tout autour',
    node: { name: 'Collerette', role: 'fin', links: 2, len: 3, width: 1.8, shape: 'leaf', style: 'ribbon', flex: 0.4, spring: 0.3, color: { slot: 1, alpha: 0.75 }, motion: { type: 'wave', amp: 0.35, freq: 2 } },
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
    node: { name: 'Patte', role: 'deco', links: 4, len: 6, width: 1.7, shape: 'linear', style: 'plates', flex: 0.12, spring: 0.5, curl: 1, color: { slot: 0, light: -4 }, motion: { type: 'row', amp: 0.3, freq: 1.8 } },
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

function part(id, nodeOver, attOver) {
  var p = PARTS[id], n = clone(p.node);
  if (nodeOver) {
    var col = nodeOver.color, mot = nodeOver.motion;
    assign(n, nodeOver);
    n.color = assign({}, p.node.color, col);
    n.motion = assign({}, p.node.motion, mot);
  }
  return att(assign({}, p.att, attOver, { node: n }));
}

// ----- species ----- //

var SPECIES = {
  anguille: function () {
    return spec({
      name: 'Anguille fouetteuse', palette: { hue: 172, harmony: 'analog', sat: 75, light: 55 },
      swim: { mode: 'steady', speed: 2.2 }, ai: 'hunter', eyes: { on: true, size: 1 },
      body: {
        name: 'Corps', links: 16, len: 7, width: 6, shape: 'worm', style: 'ribbon', flex: 0.35, spring: 0.06, drag: 0.8,
        color: { slot: 0, grad: -12 }, motion: { type: 'undulate', amp: 0.1, freq: 1.2, wave: 1 },
        attach: [part('nageoire', { width: 3.5, links: 4 }, { at: 0.08 }), part('tentacule', null, { at: 0.38 })]
      }
    });
  },
  meduse: function () {
    return spec({
      name: 'Méduse lune', palette: { hue: 290, harmony: 'analog', sat: 70, light: 66 },
      swim: { mode: 'pulse', speed: 1.4, freq: 0.7 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Ombrelle', links: 4, len: 4, width: 13, shape: 'bell', style: 'ribbon', flex: 0.06, spring: 0.6, drag: 0.8,
        color: { slot: 0, alpha: 0.42, light: -8, add: true, glow: 'body' }, motion: { type: 'pulse', amp: 0.22, freq: 0.7 },
        attach: [part('filament', null, { count: 12, spread: 1.2 }), part('brasOral')]
      }
    });
  },
  crevette: function () {
    return spec({
      name: 'Crevette corail', palette: { hue: 12, harmony: 'analog', sat: 80, light: 60 },
      swim: { mode: 'dart', speed: 2 }, ai: 'prey', eyes: { on: false },
      body: {
        name: 'Carapace', links: 11, len: 6, width: 6.5, shape: 'carapace', style: 'plates', flex: 0.14, spring: 0.3, drag: 0.8,
        color: { slot: 0, grad: -8 },
        attach: [
          part('rostre'),
          part('antenne', null, { angle: 2.75 }),
          part('antenne', { name: 'Antennule', links: 9, curl: 1, width: 0.45, color: { slot: 3, light: 6 } }, { at: 0.02, angle: 2.3 }),
          part('oeil', null, { at: 0.06, angle: 2.2, edge: 0.75 }),
          part('patte'),
          part('pleopode'),
          part('eventail')
        ]
      }
    });
  },
  calmar: function () {
    return spec({
      name: 'Calmar', palette: { hue: 350, harmony: 'split', sat: 62, light: 58 },
      swim: { mode: 'pulse', speed: 2.4, freq: 0.9 }, ai: 'hunter', eyes: { on: false },
      body: {
        name: 'Manteau', links: 9, len: 7, width: 7, shape: 'spindle', style: 'ribbon', flex: 0.1, spring: 0.4, drag: 0.8,
        color: { slot: 0, grad: 10 }, motion: { type: 'pulse', amp: 0.1, freq: 0.9 },
        attach: [
          part('nageoire', { name: 'Nageoire', shape: 'leaf', links: 4, width: 5, style: 'ribbon', color: { slot: 0, alpha: 0.75, light: 8 }, motion: { type: 'wave', amp: 0.3, freq: 1.4 } }, { at: 0.05, angle: 2.3, edge: 0.6 }),
          part('oeil', { links: 1, len: 1.5, width: 2.3, color: { slot: 2 } }, { at: 0.85, angle: 1.57, edge: 0.95 }),
          part('bras'),
          part('massue')
        ]
      }
    });
  },
  baudroie: function () {
    return spec({
      name: 'Baudroie', palette: { hue: 222, harmony: 'complement', sat: 45, light: 36 },
      swim: { mode: 'steady', speed: 1.6 }, ai: 'hunter', eyes: { on: true, size: 0.75 },
      body: {
        name: 'Corps', links: 9, len: 6, width: 11, shape: 'tadpole', style: 'ribbon', flex: 0.2, spring: 0.2, drag: 0.8,
        color: { slot: 0, grad: -10 }, motion: { type: 'undulate', amp: 0.1, freq: 1 },
        attach: [
          part('lanterne'),
          part('nageoire', { width: 3.4, links: 4 }, { at: 0.35, angle: 1.5 }),
          part('eventail', { style: 'ribbon', width: 3.5, links: 4, color: { slot: 0, alpha: 0.8 } }, { count: 3, spread: 0.7 })
        ]
      }
    });
  },
  nudibranche: function () {
    return spec({
      name: 'Nudibranche', palette: { hue: 265, harmony: 'triad', sat: 80, light: 60 },
      swim: { mode: 'steady', speed: 1 }, ai: 'prey', eyes: { on: false },
      body: {
        name: 'Pied', links: 12, len: 5.5, width: 6, shape: 'spindle', style: 'ribbon', flex: 0.3, spring: 0.1, drag: 0.82,
        color: { slot: 0, grad: 12 }, motion: { type: 'undulate', amp: 0.06, freq: 0.8 },
        attach: [
          part('antenne', { name: 'Rhinophore', links: 4, len: 3, width: 1.4, style: 'ribbon', curl: -0.4, color: { slot: 2, light: 10 } }, { at: 0.02, angle: 2.7 }),
          part('cerates')
        ]
      }
    });
  },
  plumeau: function () {
    return spec({
      name: 'Ver plumeau', palette: { hue: 38, harmony: 'triad', sat: 75, light: 60 },
      swim: { mode: 'steady', speed: 1 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Tube', links: 14, len: 5, width: 3.2, shape: 'worm', style: 'plates', flex: 0.35, spring: 0.12, drag: 0.82,
        color: { slot: 0, grad: -15 }, motion: { type: 'undulate', amp: 0.08, freq: 0.9 },
        attach: [part('radiole')]
      }
    });
  },
  larve: function () {
    return spec({
      name: 'Larve', palette: { hue: 330, harmony: 'analog', sat: 70, light: 58 },
      swim: { mode: 'steady', speed: 1.8 }, ai: 'prey', eyes: { on: true, size: 1.1 },
      body: {
        name: 'Corps', links: 10, len: 5.5, width: 4.5, shape: 'worm', style: 'disc', flex: 0.4, spring: 0.06, drag: 0.8,
        color: { slot: 0, grad: -14 }, motion: { type: 'undulate', amp: 0.12, freq: 1.5 }
      }
    });
  },
  serpentCilie: function () {
    return spec({
      name: 'Serpent cilié', palette: { hue: 150, harmony: 'complement', sat: 65, light: 52 },
      swim: { mode: 'steady', speed: 1.7 }, ai: 'prey', eyes: { on: true, size: 0.9 },
      body: {
        name: 'Corps', links: 22, len: 6, width: 5.5, shape: 'sansueBigHead', style: 'ribbon', flex: 0.35, spring: 0.05, drag: 0.8,
        color: { slot: 0, grad: -10 }, motion: { type: 'undulate', amp: 0.1, freq: 1 },
        attach: [part('cils', null, { count: 16, at: 0.06 })]
      }
    });
  },
  hydre: function () {
    var tent = part('tentacule', { links: 14, width: 2.8 }, { pattern: 'series', at: 0.2, to: 0.7, count: 3, angle: 1.25, angleTo: 0.8, edge: 0.7, scaleTo: 0.8, phaseStep: 0.8 });
    tent.node.attach.push(part('dard'));
    return spec({
      name: 'Hydre', palette: { hue: 120, harmony: 'split', sat: 55, light: 42 },
      swim: { mode: 'steady', speed: 1.6 }, ai: 'hunter', eyes: { on: true, size: 0.8 },
      body: {
        name: 'Corps', links: 12, len: 8, width: 9, shape: 'sansue', style: 'plates', flex: 0.3, spring: 0.08, drag: 0.8,
        color: { slot: 0, grad: -12 }, motion: { type: 'undulate', amp: 0.08, freq: 0.8 },
        attach: [part('pince', { width: 3.2 }), tent, part('cerates', { name: 'Épine', color: { slot: 3, glow: 'tip' } }, { at: 0.75, to: 0.95, count: 4 })]
      }
    });
  },

  // ----- cnidaires ----- //
  meduseBoite: function () {
    return spec({
      name: 'Méduse-boîte', palette: { hue: 188, harmony: 'analog', sat: 55, light: 74 },
      swim: { mode: 'pulse', speed: 1.9, freq: 1.1 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Cloche', links: 4, len: 4.5, width: 10, shape: 'bell', style: 'ribbon', flex: 0.05, spring: 0.6, drag: 0.8,
        color: { slot: 0, alpha: 0.45, add: true, glow: 'body', pattern: 'edge', pslot: 1, pscale: 0.5 }, motion: { type: 'pulse', amp: 0.16, freq: 1.1 },
        attach: [{
          node: {
            name: 'Pédalie', links: 2, len: 2.5, width: 1.6, shape: 'leaf', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 0, alpha: 0.5, add: true },
            attach: [part('filament', { links: 24, width: 0.4, color: { slot: 1, alpha: 0.6 } }, { at: 1, count: 3, spread: 0.3, edge: 0.4, scaleTo: 0.9 })]
          },
          pattern: 'fan', at: 1, count: 4, spread: 1.4, edge: 1, angle: 0
        }]
      }
    });
  },
  physalie: function () {
    return spec({
      name: 'Galère portugaise', palette: { hue: 250, harmony: 'split', sat: 70, light: 62 },
      swim: { mode: 'steady', speed: 0.7 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Flotteur', links: 6, len: 5, width: 8, shape: 'spindle', style: 'ribbon', flex: 0.08, spring: 0.5, drag: 0.8,
        color: { slot: 0, alpha: 0.8, grad: 12, pattern: 'edge', pslot: 1, pscale: 0.9 }, motion: { type: 'breathe', amp: 0.08, freq: 0.4 },
        attach: [
          part('filament', { name: 'Filament pêcheur', links: 30, width: 0.5, color: { slot: 2, alpha: 0.8, add: false, fade: 0.5 } },
            { pattern: 'series', at: 0.35, to: 0.95, count: 6, angle: 0.3, edge: 0.3, alternate: true, jitter: 0.5 }),
          { node: { name: 'Polype', links: 5, len: 3, width: 1.2, shape: 'worm', style: 'ribbon', flex: 0.4, spring: 0.2, curl: 2, color: { slot: 1, alpha: 0.85 }, motion: { type: 'curl', amp: 0.8, freq: 0.5 } },
            pattern: 'series', at: 0.4, to: 0.85, count: 6, angle: 0.8, alternate: true, jitter: 0.7, edge: 0.4 }
        ]
      }
    });
  },
  anemone: function () {
    return spec({
      name: 'Anémone', palette: { hue: 330, harmony: 'triad', sat: 70, light: 58 },
      swim: { mode: 'steady', speed: 0.4 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Disque', links: 1, len: 2, width: 9, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5,
        color: { slot: 0, pattern: 'stripe', pslot: 3, pscale: 1.6 },
        attach: [part('couronne'), part('couronne', { links: 6, color: { slot: 2, grad: 20 } }, { count: 10, edge: 0.35, scale: 0.7, angle: 0.3 })]
      }
    });
  },
  chrysaora: function () {
    return spec({
      name: 'Méduse ortie', palette: { hue: 24, harmony: 'analog', sat: 80, light: 58 },
      swim: { mode: 'pulse', speed: 1.2, freq: 0.6 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Ombrelle', links: 5, len: 4, width: 13, shape: 'bell', style: 'ribbon', flex: 0.05, spring: 0.6, drag: 0.8,
        color: { slot: 0, alpha: 0.8, pattern: 'bands', pdensity: 3, pslot: 2, plight: 10 }, motion: { type: 'pulse', amp: 0.18, freq: 0.6 },
        attach: [
          part('filament', { links: 26, color: { slot: 3, alpha: 0.7 } }, { count: 16, spread: 1.3 }),
          part('brasOral', { links: 18, len: 5, width: 3.4, color: { slot: 1, alpha: 0.9 } }, { count: 4, spread: 0.3 })
        ]
      }
    });
  },
  siphonophore: function () {
    return spec({
      name: 'Siphonophore', palette: { hue: 200, harmony: 'triad', sat: 70, light: 62 },
      swim: { mode: 'steady', speed: 1 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Stolon', links: 24, len: 5, width: 1.3, shape: 'constant', style: 'line', flex: 0.3, spring: 0.05, drag: 0.8,
        color: { slot: 0, alpha: 0.8 }, motion: { type: 'undulate', amp: 0.05, freq: 0.6 },
        attach: [
          { node: { name: 'Nectophore', role: 'fin', links: 2, len: 4, width: 6, shape: 'bell', style: 'ribbon', flex: 0.05, spring: 0.5, color: { slot: 0, alpha: 0.45, add: true, glow: 'body' }, motion: { type: 'pulse', amp: 0.2, freq: 1.2 } },
            pattern: 'series', at: 0, to: 0.12, count: 4, angle: 1.2, alternate: true, phaseStep: 0.8 },
          { node: {
              name: 'Cormidie', links: 3, len: 3.5, width: 2.8, shape: 'bulb', style: 'ribbon', flex: 0.2, spring: 0.3, color: { slot: 1, glow: 'tip' },
              attach: [part('filament', { links: 12, len: 4, width: 0.35, color: { slot: 2, alpha: 0.6 } }, { at: 1, count: 2, spread: 0.5, edge: 0.5 })]
            },
            pattern: 'series', at: 0.22, to: 1, count: 10, angle: 0.9, alternate: true, jitter: 0.4, phaseStep: 0.6 }
        ]
      }
    });
  },
  ctenophore: function () {
    return spec({
      name: 'Cténophore', palette: { hue: 190, harmony: 'triad', sat: 85, light: 62 },
      swim: { mode: 'steady', speed: 0.9 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Corps', links: 6, len: 4.5, width: 8, shape: 'spindle', style: 'ribbon', flex: 0.08, spring: 0.5, drag: 0.8,
        color: { slot: 0, alpha: 0.45, add: true, glow: 'body' }, motion: { type: 'breathe', amp: 0.05, freq: 0.5 },
        attach: [
          part('peigne'),
          part('peigne', null, { edge: 0.45, scale: 0.8, count: 8, at: 0.2, to: 0.8 }),
          part('tentacule', {
            name: 'Tentacule pêcheur', links: 20, len: 4, width: 0.5, shape: 'linear', style: 'line', color: { slot: 2, alpha: 0.7, add: true },
            attach: [part('cils', { name: 'Tentille', links: 3, len: 2.5, width: 0.3, color: { slot: 2, alpha: 0.6 }, motion: { type: 'none' } }, { count: 6, at: 0.2, to: 1, angle: 1.2, edge: 0 })]
          }, { at: 0.55, angle: 0.35, edge: 0.3 })
        ]
      }
    });
  },

  // ----- crustacés ----- //
  homard: function () {
    return spec({
      name: 'Homard bleu', palette: { hue: 212, harmony: 'analog', sat: 60, light: 42 },
      swim: { mode: 'dart', speed: 1.6 }, ai: 'hunter', eyes: { on: false },
      body: {
        name: 'Carapace', links: 12, len: 6.5, width: 7, shape: 'carapace', style: 'plates', flex: 0.12, spring: 0.35, drag: 0.8,
        color: { slot: 0, grad: -6, pattern: 'spots', pdensity: 5, pslot: 3, plight: 20 },
        attach: [
          part('rostre', { width: 1.3 }),
          part('antenne', { links: 26, width: 0.6, color: { slot: 3, light: 10 } }, { angle: 2.7 }),
          part('antenne', { name: 'Antennule', links: 8, curl: 1, width: 0.4, color: { slot: 1 } }, { at: 0.02, angle: 2.3 }),
          part('oeil', null, { at: 0.05, angle: 2.3, edge: 0.7 }),
          part('pinceHomard'),
          part('patteMarche', { width: 1.3, len: 5, color: { slot: 0, light: 6 } }, { at: 0.2, to: 0.45 }),
          part('pleopode', { color: { slot: 1, alpha: 0.9 } }),
          part('eventail', { color: { slot: 0, light: 2 } })
        ]
      }
    });
  },
  crabe: function () {
    return spec({
      name: 'Crabe', palette: { hue: 8, harmony: 'analog', sat: 75, light: 52 },
      swim: { mode: 'dart', speed: 1.5 }, ai: 'hunter', eyes: { on: false },
      body: {
        name: 'Carapace', links: 6, len: 2.5, width: 13, shape: 'bloby', style: 'ribbon', flex: 0.05, spring: 0.6, drag: 0.8,
        color: { slot: 0, grad: -8, pattern: 'spots', pdensity: 7, pslot: 3, pscale: 0.8 },
        attach: [
          part('patteMarche', null, { at: 0.25, to: 0.95, angle: 1.75, angleTo: 1.2 }),
          part('pinceHomard', { links: 2, len: 6, width: 2.8, curl: -0.6 }, { at: 0, angle: 2.4, edge: 0.85 }),
          part('oeil', { links: 2, len: 2.5, width: 1.4 }, { at: 0, angle: 2.9, edge: 0.4 })
        ]
      }
    });
  },
  krill: function () {
    var s = SPECIES.crevette();
    s.name = 'Krill';
    s.size = 0.6;
    s.palette = { hue: 352, harmony: 'analog', sat: 70, light: 72 };
    s.swim.speed = 2.4;
    s.body.color.alpha = 0.85;
    s.body.attach.push(part('photophore', null, { count: 4, at: 0.2, to: 0.7 }));
    return s;
  },
  crevetteMante: function () {
    return spec({
      name: 'Crevette-mante', palette: { hue: 150, harmony: 'triad', sat: 85, light: 50 },
      swim: { mode: 'dart', speed: 2.2 }, ai: 'hunter', eyes: { on: false },
      body: {
        name: 'Carapace', links: 12, len: 5.5, width: 6, shape: 'carapace', style: 'plates', flex: 0.14, spring: 0.3, drag: 0.8,
        color: { slot: 0, pattern: 'bands', pdensity: 6, pslot: 1 },
        attach: [
          part('oeil', { width: 2.4, len: 3.5, color: { slot: 2 } }, { at: 0, angle: 2.6, edge: 0.5 }),
          part('antenne', { name: 'Antennule', links: 8, color: { slot: 3 } }, { at: 0.02, angle: 2.3 }),
          { node: { name: 'Patte ravisseuse', role: 'jaw', links: 3, len: 5, width: 1.8, shape: 'worm', style: 'plates', flex: 0.1, spring: 0.6, curl: 2.2, color: { slot: 3 } },
            pattern: 'pair', at: 0.12, angle: 2.4, edge: 0.7, front: true },
          part('patte', { color: { slot: 1 } }, { at: 0.3, to: 0.5, count: 3 }),
          part('pleopode', { color: { slot: 2 } }),
          part('eventail', { color: { slot: 1, pattern: 'ocelli', pdensity: 2, pslot: 2 } })
        ]
      }
    });
  },
  copepode: function () {
    return spec({
      name: 'Copépode', size: 0.7, palette: { hue: 28, harmony: 'complement', sat: 70, light: 64 },
      swim: { mode: 'dart', speed: 1.8 }, ai: 'prey', eyes: { on: true, size: 0.6, spread: 0.1, fwd: 0.5 },
      body: {
        name: 'Corps', links: 7, len: 4, width: 5, shape: 'spindle', style: 'plates', flex: 0.1, spring: 0.4, drag: 0.8,
        color: { slot: 0, alpha: 0.85 },
        attach: [
          part('antenne', {
            links: 16, width: 0.5, curl: 0.6, spring: 0.3, flex: 0.08, color: { slot: 0, light: 10 },
            attach: [part('cils', { name: 'Soie', links: 2, len: 2.5, width: 0.25, motion: { type: 'none' }, color: { slot: 0, light: 16 } }, { at: 0.5, to: 1, count: 5, angle: 0.7, mirror: false, edge: 0 })]
          }, { angle: 1.75, edge: 0.6 }),
          { node: { name: 'Sac à œufs', links: 3, len: 3, width: 2.6, shape: 'bloby', style: 'disc', flex: 0.2, spring: 0.3, color: { slot: 1, light: 6, glow: 'tip' } },
            pattern: 'pair', at: 0.8, angle: 0.4, edge: 0.6 },
          part('pleopode', { width: 1.2 }, { at: 0.2, to: 0.6, count: 4 })
        ]
      }
    });
  },

  // ----- mollusques ----- //
  poulpe: function () {
    return spec({
      name: 'Poulpe', palette: { hue: 12, harmony: 'analog', sat: 65, light: 55 },
      swim: { mode: 'pulse', speed: 1.8, freq: 0.6 }, ai: 'hunter', eyes: { on: false },
      body: {
        name: 'Manteau', links: 5, len: 6, width: 10, shape: 'bloby', style: 'ribbon', flex: 0.12, spring: 0.4, drag: 0.8,
        color: { slot: 0, grad: 10, pattern: 'spots', pdensity: 5, pslot: 2 }, motion: { type: 'breathe', amp: 0.08, freq: 0.6 },
        attach: [
          part('oeil', { links: 1, len: 1.5, width: 2.2, color: { slot: 3 } }, { at: 0.85, angle: 1.57, edge: 0.9, front: true }),
          part('bras', { links: 14, len: 4.5, width: 2.8, color: { slot: 0, pattern: 'spots', pslot: 3, pdensity: 8, plight: 20, pscale: 1.2 }, motion: { type: 'curl', amp: 1.2, freq: 0.35 } },
            { count: 8, spread: 1.3, edge: 0.8, web: 0.25 })
        ]
      }
    });
  },
  nautile: function () {
    return spec({
      name: 'Nautile', palette: { hue: 28, harmony: 'mono', sat: 55, light: 62 },
      swim: { mode: 'pulse', speed: 1.2, freq: 0.7 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Coquille', links: 18, len: 7, lenTo: 0.18, width: 12, shape: 'linear', style: 'plates', flex: 0.02, spring: 0.8, curl: 7, drag: 0.8,
        color: { slot: 1, pattern: 'bands', pdensity: 7, pslot: 2, plight: -10 },
        attach: [
          { node: { name: 'Tentacule', role: 'whip', links: 8, len: 3.5, width: 0.8, shape: 'linear', style: 'line', flex: 0.4, spring: 0.1, color: { slot: 2 }, motion: { type: 'curl', amp: 0.8, freq: 0.4 } },
            pattern: 'fan', at: 0, count: 12, spread: 1.2, angle: Math.PI, edge: 0.5, jitter: 0.5, phaseStep: 0.5 },
          part('oeil', { links: 1, len: 1, width: 1.3, color: { slot: 0 } }, { at: 0.03, angle: 2.2, edge: 0.75, front: true })
        ]
      }
    });
  },
  clione: function () {
    return spec({
      name: 'Ange de mer', palette: { hue: 200, harmony: 'complement', sat: 60, light: 72 },
      swim: { mode: 'steady', speed: 1.1 }, ai: 'prey', eyes: { on: false },
      body: {
        name: 'Corps', links: 7, len: 4.5, width: 5, shape: 'spindle', style: 'ribbon', flex: 0.15, spring: 0.3, drag: 0.8,
        color: { slot: 0, alpha: 0.55, glow: 'body', pattern: 'stripe', pslot: 1, pscale: 1.5, plight: -5 }, motion: { type: 'undulate', amp: 0.05, freq: 0.8 },
        attach: [
          part('nageoire', { name: 'Aile', width: 5, links: 4, color: { slot: 0, alpha: 0.5, add: true }, motion: { type: 'wave', amp: 0.9, freq: 1.6 } }, { at: 0.2, angle: 1.6, edge: 0.7 }),
          part('antenne', { name: 'Corne', links: 3, len: 2, width: 0.8, style: 'ribbon', curl: -0.3, color: { slot: 1, alpha: 0.8 } }, { at: 0, angle: 2.7, edge: 0.4 })
        ]
      }
    });
  },
  seiche: function () {
    return spec({
      name: 'Seiche', palette: { hue: 32, harmony: 'complement', sat: 45, light: 55 },
      swim: { mode: 'steady', speed: 1.5 }, ai: 'hunter', eyes: { on: false },
      body: {
        name: 'Manteau', links: 8, len: 6, width: 8.5, shape: 'spindle', style: 'ribbon', flex: 0.08, spring: 0.45, drag: 0.8,
        color: { slot: 0, pattern: 'bands', pdensity: 9, pslot: 2, plight: -12 },
        attach: [
          part('collerette', { color: { slot: 0, alpha: 0.7, light: 10 } }),
          part('oeil', { links: 1, len: 1.5, width: 2, color: { slot: 1 } }, { at: 0.85, angle: 1.57, edge: 0.9, front: true }),
          part('bras', { links: 7, len: 4, width: 2.4 }, { count: 8, spread: 0.7, edge: 0.6 }),
          part('massue', { links: 12 })
        ]
      }
    });
  },

  // ----- poissons ----- //
  poissonLion: function () {
    var band = { pattern: 'bands', pslot: 3, plight: 30 };
    return spec({
      name: 'Rascasse volante', palette: { hue: 8, harmony: 'analog', sat: 70, light: 48 },
      swim: { mode: 'steady', speed: 1.2 }, ai: 'hunter', eyes: { on: true, size: 0.9 },
      body: {
        name: 'Corps', links: 8, len: 6, width: 7, shape: 'tadpole', style: 'ribbon', flex: 0.2, spring: 0.2, drag: 0.8,
        color: assign({ slot: 0, pdensity: 8 }, band), motion: { type: 'undulate', amp: 0.08, freq: 1 },
        attach: [
          part('rayons', { links: 9, len: 5, width: 0.55, color: assign({ slot: 0, pdensity: 4 }, band) }, { at: 0.3, count: 7, spread: 1.3, angle: 1.8 }),
          { node: { name: 'Épine dorsale', role: 'sting', links: 6, len: 4, width: 0.5, shape: 'linear', style: 'line', flex: 0.15, spring: 0.4, curl: 0.4, color: assign({ slot: 0, pdensity: 3 }, band) },
            pattern: 'series', at: 0.1, to: 0.6, count: 7, angle: 0.8, alternate: true, jitter: 0.3 },
          part('caudale', { links: 5, color: { slot: 1 } }, { count: 5, spread: 0.9 })
        ]
      }
    });
  },
  manta: function () {
    return spec({
      name: 'Raie manta', size: 1.5, palette: { hue: 218, harmony: 'complement', sat: 35, light: 30 },
      swim: { mode: 'steady', speed: 1.5 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Disque', links: 7, len: 6, width: 8, shape: 'spindle', style: 'ribbon', flex: 0.1, spring: 0.4, drag: 0.8,
        color: { slot: 0, pattern: 'edge', pslot: 3, plight: 30, pscale: 0.6 },
        attach: [
          part('aile', null, { at: 0.4, angle: 1.35, edge: 0.7 }),
          { node: { name: 'Lobe céphalique', links: 3, len: 3, width: 1.8, shape: 'virgule', style: 'ribbon', flex: 0.2, spring: 0.4, curl: -1.5, color: { slot: 0, light: 6 } },
            pattern: 'pair', at: 0, angle: 2.8, edge: 0.6, front: true },
          { node: { name: 'Queue', role: 'whip', links: 12, len: 5, width: 0.6, shape: 'linear', style: 'line', flex: 0.4, spring: 0.05, color: { slot: 0 } },
            pattern: 'single', at: 1, angle: 0 }
        ]
      }
    });
  },
  hippocampe: function () {
    return spec({
      name: 'Hippocampe', palette: { hue: 44, harmony: 'analog', sat: 80, light: 55 },
      swim: { mode: 'steady', speed: 0.9 }, ai: 'prey', eyes: { on: true, size: 0.8, spread: 0.4 },
      body: {
        name: 'Corps', links: 18, len: 5, lenTo: 0.35, width: 6, shape: 'gourd', style: 'plates', flex: 0.08, spring: 0.55, curl: 6.5, curlBias: 1, drag: 0.8,
        color: { slot: 0, pattern: 'bands', pdensity: 9, pslot: 1, plight: 8 },
        attach: [
          { node: { name: 'Museau', links: 3, len: 3, width: 1.4, shape: 'constant', style: 'plates', flex: 0.05, spring: 0.7, color: { slot: 0, light: 4 } },
            pattern: 'single', at: 0, angle: 2.6 },
          part('nageoire', { name: 'Dorsale', links: 2, width: 2.2, color: { slot: 2, alpha: 0.7 }, motion: { type: 'flutter', amp: 0.4, freq: 3 } }, { at: 0.3, angle: 1.4, edge: 0.8 }),
          { node: { name: 'Couronne', links: 2, len: 2, width: 0.8, shape: 'linear', style: 'ribbon', flex: 0.1, spring: 0.6, color: { slot: 3 } },
            pattern: 'fan', at: 0.06, count: 3, spread: 0.8, angle: 2.2, mirror: true, edge: 0.5 }
        ]
      }
    });
  },
  poissonClown: function () {
    return spec({
      name: 'Poisson-clown', palette: { hue: 22, harmony: 'mono', sat: 95, light: 52 },
      swim: { mode: 'steady', speed: 1.7 }, ai: 'prey', eyes: { on: true, size: 1 },
      body: {
        name: 'Corps', links: 10, len: 3.5, width: 7, shape: 'spindle', style: 'ribbon', flex: 0.25, spring: 0.2, drag: 0.8,
        color: { slot: 0, pattern: 'bands', pdensity: 3, pslot: 3, plight: 20 }, motion: { type: 'undulate', amp: 0.12, freq: 1.6 },
        attach: [
          part('nageoire', { width: 3, links: 3, color: { slot: 0, pattern: 'edge', pslot: 2, plight: -40 }, motion: { type: 'wave', amp: 0.6, freq: 2 } }, { at: 0.25, angle: 1.5 }),
          part('caudale', { links: 4, color: { slot: 0 } }, { count: 5, spread: 1 })
        ]
      }
    });
  },
  dragonFeuillu: function () {
    return spec({
      name: 'Dragon de mer feuillu', palette: { hue: 70, harmony: 'analog', sat: 60, light: 55 },
      swim: { mode: 'steady', speed: 0.8 }, ai: 'prey', eyes: { on: true, size: 0.8, spread: 0.45 },
      body: {
        name: 'Corps', links: 18, len: 5, width: 3, shape: 'sansueBigHead', style: 'plates', flex: 0.15, spring: 0.3, curl: 1.5, drag: 0.8,
        color: { slot: 0, pattern: 'bands', pdensity: 8, pslot: 2 }, motion: { type: 'undulate', amp: 0.05, freq: 0.5 },
        attach: [
          { node: { name: 'Museau', links: 4, len: 3, width: 0.9, shape: 'constant', style: 'plates', flex: 0.05, spring: 0.7, color: { slot: 0 } },
            pattern: 'single', at: 0, angle: Math.PI },
          part('feuille', { attach: [part('feuille', { name: 'Foliole', links: 3, width: 2 }, { at: 0.4, to: 1, count: 2, jitter: 0.5 })] }, { count: 9 })
        ]
      }
    });
  },
  combattant: function () {
    return spec({
      name: 'Poisson combattant', palette: { hue: 330, harmony: 'analog', sat: 85, light: 48 },
      swim: { mode: 'steady', speed: 1.3 }, ai: 'prey', eyes: { on: true },
      body: {
        name: 'Corps', links: 7, len: 5.5, width: 5, shape: 'spindle', style: 'ribbon', flex: 0.25, spring: 0.2, drag: 0.8,
        color: { slot: 0, grad: -10 }, motion: { type: 'undulate', amp: 0.08, freq: 1.2 },
        attach: [
          part('voile'),
          part('nageoire', { width: 2.5, links: 3, color: { slot: 2, alpha: 0.85 }, motion: { type: 'wave', amp: 0.6, freq: 2.2 } }, { at: 0.25, angle: 1.5 }),
          { node: { name: 'Ventrale', role: 'fin', links: 10, len: 4, width: 1.4, shape: 'virgule', style: 'ribbon', flex: 0.45, spring: 0.06, drag: 0.8, color: { slot: 1, alpha: 0.85 } },
            pattern: 'pair', at: 0.35, angle: 0.6, edge: 0.6 }
        ]
      }
    });
  },
  grandGosier: function () {
    return spec({
      name: 'Grand gosier', palette: { hue: 262, harmony: 'split', sat: 45, light: 22 },
      swim: { mode: 'steady', speed: 1.4 }, ai: 'hunter', eyes: { on: true, size: 0.5, spread: 0.3, fwd: 0.6 },
      body: {
        name: 'Corps', links: 16, len: 6, width: 11, shape: 'tadpole', style: 'ribbon', flex: 0.3, spring: 0.08, drag: 0.8,
        color: { slot: 0, pattern: 'edge', pslot: 1, pscale: 0.4, plight: 10 }, motion: { type: 'undulate', amp: 0.1, freq: 0.9 },
        attach: [
          { node: { name: 'Queue-fouet', role: 'whip', links: 18, len: 5, width: 0.9, shape: 'linear', style: 'line', flex: 0.5, spring: 0.04, drag: 0.84, color: { slot: 3, light: 30, glow: 'tip' } },
            pattern: 'single', at: 1, angle: 0 },
          part('pince', { name: 'Mâchoire', links: 5, width: 2, curl: -0.9, color: { slot: 0, light: 10 } }, { angle: 2.95, edge: 0.9 })
        ]
      }
    });
  },
  requinBaleine: function () {
    return spec({
      name: 'Requin-baleine', size: 1.8, palette: { hue: 208, harmony: 'analog', sat: 35, light: 38 },
      swim: { mode: 'steady', speed: 1.2 }, ai: 'drifter', eyes: { on: true, size: 0.45, spread: 0.85, fwd: 0.2 },
      body: {
        name: 'Corps', links: 12, len: 7, width: 8, shape: 'spindle', style: 'ribbon', flex: 0.18, spring: 0.15, drag: 0.8,
        color: { slot: 0, pattern: 'spots', pdensity: 9, pslot: 3, plight: 45, pscale: 0.8 }, motion: { type: 'undulate', amp: 0.08, freq: 0.6 },
        attach: [
          part('nageoire', { name: 'Pectorale', links: 4, len: 5, width: 4.5, curl: 0.7, color: { slot: 0, alpha: 1 }, motion: { type: 'wave', amp: 0.15, freq: 0.6 } }, { at: 0.3, angle: 1.2, edge: 0.8 }),
          { node: { name: 'Lobe caudal', role: 'fin', links: 5, len: 4.5, width: 3, shape: 'leaf', style: 'ribbon', flex: 0.2, spring: 0.3, curl: 0.3, color: { slot: 0 } },
            pattern: 'pair', at: 1, angle: 0.45 }
        ]
      }
    });
  },
  koi: function () {
    return spec({
      name: 'Carpe koï', palette: { hue: 18, harmony: 'mono', sat: 90, light: 52 },
      swim: { mode: 'steady', speed: 1.3 }, ai: 'prey', eyes: { on: true, size: 0.8 },
      body: {
        name: 'Corps', links: 9, len: 6, width: 7, shape: 'spindle', style: 'ribbon', flex: 0.22, spring: 0.15, drag: 0.8,
        color: { slot: 0, pattern: 'spots', pdensity: 6, pscale: 2.4, pslot: 3, plight: 25 }, motion: { type: 'undulate', amp: 0.12, freq: 0.9 },
        attach: [
          part('barbillon', { links: 3, len: 2.5, width: 0.5 }),
          part('nageoire', { width: 3.5, links: 4, color: { slot: 0, alpha: 0.7 } }, { at: 0.22 }),
          part('voile', { links: 6, len: 4, color: { slot: 0, alpha: 0.75 } }, { count: 5, spread: 1 })
        ]
      }
    });
  },

  // ----- vers ----- //
  verDeFeu: function () {
    return spec({
      name: 'Ver de feu', palette: { hue: 4, harmony: 'analog', sat: 80, light: 50 },
      swim: { mode: 'steady', speed: 1.1 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Corps', links: 22, len: 4.5, width: 3.5, shape: 'worm', style: 'plates', flex: 0.3, spring: 0.08, drag: 0.8,
        color: { slot: 0, grad: 10 }, motion: { type: 'undulate', amp: 0.1, freq: 0.8 },
        attach: [
          part('parapode'),
          part('antenne', { name: 'Caroncule', links: 3, len: 2.5, width: 1.2, style: 'ribbon', curl: -0.5, color: { slot: 2 } }, { angle: 2.5 })
        ]
      }
    });
  },
  verPlat: function () {
    return spec({
      name: 'Ver plat', palette: { hue: 280, harmony: 'complement', sat: 60, light: 22 },
      swim: { mode: 'steady', speed: 0.9 }, ai: 'prey', eyes: { on: false },
      body: {
        name: 'Corps', links: 9, len: 5, width: 9, shape: 'spindle', style: 'ribbon', flex: 0.15, spring: 0.3, drag: 0.8,
        color: { slot: 0, pattern: 'edge', pslot: 1, plight: 35, pscale: 1.2 }, motion: { type: 'undulate', amp: 0.05, freq: 0.8 },
        attach: [
          part('collerette', { width: 2.2, color: { slot: 1, light: 30, alpha: 0.85 } }, { count: 12, phaseStep: 0.6 }),
          { node: { name: 'Pseudo-tentacule', links: 2, len: 2.5, width: 1.3, shape: 'leaf', style: 'ribbon', flex: 0.2, spring: 0.4, curl: -0.5, color: { slot: 0, pattern: 'edge', pslot: 1, plight: 35 } },
            pattern: 'pair', at: 0, angle: 2.6, edge: 0.5, front: true }
        ]
      }
    });
  },

  // ----- échinodermes ----- //
  etoile: function () {
    return spec({
      name: 'Étoile de mer', palette: { hue: 18, harmony: 'complement', sat: 75, light: 55 },
      swim: { mode: 'steady', speed: 0.5 }, ai: 'prey', eyes: { on: false },
      body: {
        name: 'Disque', links: 1, len: 2, width: 6, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5,
        color: { slot: 0, pattern: 'spots', pdensity: 8, pslot: 1 },
        attach: [part('brasEtoile', { color: { slot: 0, pattern: 'spots', pdensity: 6, pslot: 1 } })]
      }
    });
  },
  ophiure: function () {
    return spec({
      name: 'Ophiure', palette: { hue: 330, harmony: 'analog', sat: 50, light: 50 },
      swim: { mode: 'steady', speed: 1 }, ai: 'prey', eyes: { on: false },
      body: {
        name: 'Disque', links: 1, len: 1.5, width: 4.5, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5,
        color: { slot: 0, pattern: 'stripe', pslot: 3, pscale: 2 },
        attach: [part('brasEtoile', {
          links: 14, len: 4, width: 1.3, style: 'plates', flex: 0.45, spring: 0.1,
          color: { slot: 0, pattern: 'bands', pdensity: 7, pslot: 3 }, motion: { type: 'curl', amp: 1.6, freq: 0.5 }
        }, { edge: 0.9, phaseStep: 1.3 })]
      }
    });
  },
  oursin: function () {
    return spec({
      name: 'Oursin', palette: { hue: 285, harmony: 'analog', sat: 55, light: 32 },
      swim: { mode: 'steady', speed: 0.35 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Test', links: 1, len: 2, width: 8, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5,
        color: { slot: 0, pattern: 'spots', pdensity: 10, pslot: 1, pscale: 0.6 },
        attach: [part('epines', null, { count: 22 }), part('epines', { links: 2, color: { slot: 3 } }, { count: 14, angle: 0.22, scale: 0.6, edge: 0.6 })]
      }
    });
  },

  // ----- autres ----- //
  axolotl: function () {
    return spec({
      name: 'Axolotl', palette: { hue: 340, harmony: 'analog', sat: 55, light: 78 },
      swim: { mode: 'steady', speed: 1.1 }, ai: 'prey', eyes: { on: true, size: 0.7, spread: 0.7, fwd: 0.4 },
      body: {
        name: 'Corps', links: 12, len: 6, width: 6, shape: 'sansueBigHead', style: 'ribbon', flex: 0.25, spring: 0.1, drag: 0.8,
        color: { slot: 0, grad: -6 }, motion: { type: 'undulate', amp: 0.1, freq: 0.9 },
        attach: [
          part('branchie', { color: { slot: 1, light: -22 } }),
          { node: {
              name: 'Patte', links: 3, len: 4, width: 1.6, shape: 'virgule', style: 'ribbon', flex: 0.2, spring: 0.4, curl: 0.8, color: { slot: 0 }, motion: { type: 'row', amp: 0.3, freq: 1.2 },
              attach: [{ node: { name: 'Doigt', links: 2, len: 1.5, width: 0.45, shape: 'linear', style: 'line', flex: 0.1, spring: 0.5, color: { slot: 0, light: -6 } }, pattern: 'fan', at: 1, count: 4, spread: 1, angle: 0 }]
            },
            pattern: 'series', at: 0.28, to: 0.55, count: 2, angle: 1.6, edge: 0.85, phaseStep: 3.14, mirror: true },
          part('collerette', { name: 'Crête caudale', width: 1.6, color: { slot: 0, alpha: 0.6 } }, { at: 0.55, to: 1, count: 6, edge: 0.6, angle: 1.4, scaleTo: 0.5 })
        ]
      }
    });
  },
  tortue: function () {
    return spec({
      name: 'Tortue de mer', palette: { hue: 95, harmony: 'analog', sat: 40, light: 42 },
      swim: { mode: 'steady', speed: 1.3 }, ai: 'drifter', eyes: { on: false },
      body: {
        name: 'Carapace', links: 5, len: 7, width: 12, shape: 'bloby', style: 'ribbon', flex: 0.05, spring: 0.6, drag: 0.8,
        color: { slot: 0, pattern: 'spots', pdensity: 5, pslot: 3, pscale: 2.2, plight: -10 },
        attach: [
          { node: {
              name: 'Tête', role: 'jaw', links: 2, len: 5, width: 3.5, shape: 'worm', style: 'ribbon', flex: 0.2, spring: 0.4, color: { slot: 1, pattern: 'spots', pdensity: 5, pslot: 2 },
              attach: [part('oeil', { links: 1, len: 0.6, width: 0.9, color: { slot: 2 } }, { at: 0.6, angle: 1.57, edge: 0.8, front: true })]
            },
            pattern: 'single', at: 0, angle: Math.PI, front: true },
          part('nageoire', { name: 'Nageoire avant', links: 5, len: 6, width: 3.5, curl: 0.8, color: { slot: 1, alpha: 1 }, motion: { type: 'wave', amp: 0.55, freq: 0.7 } }, { at: 0.15, angle: 1.35, edge: 0.9 }),
          part('nageoire', { name: 'Nageoire arrière', links: 3, len: 4, width: 2.5, curl: 0.4, color: { slot: 1, alpha: 1 }, motion: { type: 'wave', amp: 0.3, freq: 0.7 } }, { at: 0.9, angle: 0.9, edge: 0.8 })
        ]
      }
    });
  },
  tardigrade: function () {
    return spec({
      name: 'Tardigrade', size: 0.9, palette: { hue: 32, harmony: 'analog', sat: 25, light: 70 },
      swim: { mode: 'steady', speed: 0.7 }, ai: 'prey', eyes: { on: true, size: 0.6, spread: 0.4, fwd: 0.3 },
      body: {
        name: 'Corps', links: 6, len: 5, width: 6.5, shape: 'worm', style: 'plates', flex: 0.2, spring: 0.25, drag: 0.8,
        color: { slot: 0, grad: -8 }, motion: { type: 'breathe', amp: 0.05, freq: 0.5 },
        attach: [{
          node: {
            name: 'Patte', links: 2, len: 3, width: 2.4, shape: 'bloby', style: 'ribbon', flex: 0.2, spring: 0.4, color: { slot: 0, light: 4 }, motion: { type: 'row', amp: 0.4, freq: 1.3 },
            attach: [{ node: { name: 'Griffe', links: 2, len: 1.5, width: 0.35, shape: 'linear', style: 'line', flex: 0.1, spring: 0.6, curl: 0.8, color: { slot: 2, light: -30 } }, pattern: 'fan', at: 1, count: 3, spread: 0.8, angle: 0 }]
          },
          pattern: 'series', at: 0.15, to: 0.95, count: 4, angle: 1.65, edge: 0.9, phaseStep: 1.1, mirror: true
        }]
      }
    });
  },

  // ----- chimères ----- //
  dragonAbyssal: function () {
    return spec({
      name: 'Dragon abyssal', palette: { hue: 262, harmony: 'split', sat: 70, light: 32 },
      swim: { mode: 'steady', speed: 1.6 }, ai: 'hunter', eyes: { on: true, size: 0.9 },
      body: {
        name: 'Corps', links: 26, len: 6, width: 6.5, shape: 'sansueBigHead', style: 'ribbon', flex: 0.3, spring: 0.05, drag: 0.8,
        color: { slot: 0, grad: -8, pattern: 'ocelli', pdensity: 10, pslot: 1, plight: 15 }, motion: { type: 'undulate', amp: 0.1, freq: 0.8 },
        attach: [
          part('barbillon', { links: 18, len: 4, width: 0.5, color: { slot: 1, light: 20, glow: 'tip' } }, { angle: 2.7 }),
          part('antenne', { name: 'Corne', links: 4, len: 3, width: 1.4, style: 'ribbon', curl: 0.9, flex: 0.05, spring: 0.6, color: { slot: 2, light: 20 } }, { at: 0.04, angle: 2.4, edge: 0.6 }),
          part('rayons', { name: 'Crête', links: 4, len: 4, width: 0.5, color: { slot: 2, alpha: 0.8 } },
            { pattern: 'series', at: 0.15, to: 0.85, count: 9, angle: 1.3, angleTo: 0.9, edge: 0.85, web: 0.9, scaleTo: 0.6, phaseStep: 0.4 }),
          part('photophore', null, { count: 6, at: 0.2, to: 0.9 }),
          part('dard', { width: 2.6, color: { slot: 1, glow: 'tip' } })
        ]
      }
    });
  }
};

// ----- catalogue: family, blurb, and where it lives in the game ----- //

var CATS = [
  ['poissons', 'Poissons'], ['cnidaires', 'Méduses & cie'], ['crustaces', 'Crustacés'], ['mollusques', 'Mollusques'],
  ['vers', 'Vers'], ['echinodermes', 'Échinodermes'], ['autres', 'Autres'], ['chimeres', 'Chimères']
];

// cat, description, first depth level in the game (120 m each), spawn weight
var INFO = {
  anguille:      ['poissons', 'Un fouet vivant : deux tentacules et une nage ondulante.', 0, 2.5],
  poissonClown:  ['poissons', 'Trois bandes blanches et une anémone pour maison.', 0, 2],
  koi:           ['poissons', 'Taches blanches, barbillons et nageoires voilées.', 0, 1.5],
  hippocampe:    ['poissons', 'Queue enroulée en spirale ; c\'est le mâle qui porte les œufs.', 0, 1.5],
  combattant:    ['poissons', 'Un voile de nageoires démesuré qui flotte derrière lui.', 1, 1.5],
  poissonLion:   ['poissons', 'Nageoires en éventail rayé et épines venimeuses.', 2, 2],
  manta:         ['poissons', 'Vole sous l\'eau en ondulant de grandes ailes.', 2, 1],
  requinBaleine: ['poissons', 'Le plus grand poisson, constellé de taches blanches.', 2, 0.8],
  dragonFeuillu: ['poissons', 'Camouflé en algue par ses appendices en feuilles.', 3, 1.2],
  grandGosier:   ['poissons', 'Une bouche immense et une queue-fouet lumineuse.', 3, 1.5],
  baudroie:      ['poissons', 'Chasse dans le noir avec un leurre lumineux.', 3, 2],
  meduse:        ['cnidaires', 'Une ombrelle qui pulse et un voile de filaments urticants.', 1, 3],
  chrysaora:     ['cnidaires', 'Méduse ortie : ombrelle rayée et longs bras plissés.', 2, 2],
  anemone:       ['cnidaires', 'Deux couronnes de tentacules qui ondulent au ralenti.', 1, 1.5],
  ctenophore:    ['cnidaires', 'Ses rangées de palettes diffractent la lumière en arc-en-ciel.', 1, 1.5],
  physalie:      ['cnidaires', 'Galère portugaise : un flotteur et des filaments interminables.', 1, 1.2],
  siphonophore:  ['cnidaires', 'Une colonie : des cloches qui nagent et des polypes qui pêchent.', 2, 1.2],
  meduseBoite:   ['cnidaires', 'Quatre bouquets de filaments parmi les plus venimeux.', 3, 1.5],
  crevette:      ['crustaces', 'Antennes deux fois plus longues que le corps.', 0, 3],
  krill:         ['crustaces', 'Minuscule et lumineux : ses photophores brillent dans le bleu.', 0, 2],
  copepode:      ['crustaces', 'Le plus abondant des animaux : grandes antennes et sacs d\'œufs.', 0, 2],
  crabe:         ['crustaces', 'Huit pattes articulées et deux pinces en avant.', 0, 2],
  homard:        ['crustaces', 'Homard bleu : pinces massives et carapace tachetée.', 2, 1.5],
  crevetteMante: ['crustaces', 'Frappe avec ses pattes ravisseuses aussi vite qu\'une balle.', 2, 1.5],
  calmar:        ['mollusques', 'Nage à réaction ; deux tentacules en massue.', 2, 2.5],
  poulpe:        ['mollusques', 'Huit bras reliés par une membrane, couverts de ventouses.', 3, 2],
  seiche:        ['mollusques', 'Sa nageoire en collerette ondule tout autour du manteau.', 1, 1.5],
  nautile:       ['mollusques', 'Une coquille en spirale logarithmique vieille de 500 millions d\'années.', 3, 1],
  clione:        ['mollusques', 'Ange de mer : nage en battant deux petites ailes.', 1, 1.5],
  nudibranche:   ['mollusques', 'Ses cérates stockent le venin des méduses qu\'il mange.', 1, 2],
  larve:         ['vers', 'Le premier stade de beaucoup d\'animaux marins.', 0, 4],
  plumeau:       ['vers', 'Filtre l\'eau avec une couronne de plumes.', 1, 1.2],
  verDeFeu:      ['vers', 'Ses soies urticantes brûlent au moindre contact.', 2, 1.5],
  verPlat:       ['vers', 'Un tapis ondulant bordé de couleur.', 1, 1.5],
  serpentCilie:  ['vers', 'Hommage à test-patte.json : des cils qui battent en vague.', 2, 1.5],
  etoile:        ['echinodermes', 'Cinq bras qui rampent lentement.', 0, 1.5],
  ophiure:       ['echinodermes', 'Bras fins qui ondulent comme des serpents.', 2, 1.5],
  oursin:        ['echinodermes', 'Une boule de piquants qui bougent lentement.', 2, 1.2],
  axolotl:       ['autres', 'Garde ses branchies plumeuses toute sa vie.', 0, 1.2],
  tortue:        ['autres', 'Quatre nageoires et une carapace en écailles.', 1, 1],
  tardigrade:    ['autres', 'Huit pattes griffues, et survit presque à tout.', 0, 1],
  hydre:         ['chimeres', 'Tentacules à dards et épines lumineuses.', 4, 1.5],
  dragonAbyssal: ['chimeres', 'Ocelles, barbillons lumineux et crête palmée.', 4, 1.2]
};

// ----- random creature: a body + a head part + side parts + a tail part ----- //

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function randi(a, b) { return Math.floor(E.rand(a, b + 1)); }

var SYL1 = ['Aby', 'Lumi', 'Cten', 'Hydr', 'Noct', 'Vitr', 'Spir', 'Thal', 'Myr', 'Pel', 'Bathy', 'Cor', 'Aur', 'Sel', 'Pyro', 'Glau'];
var SYL2 = ['ella', 'opsis', 'ura', 'ax', 'ina', 'ops', 'aria', 'onia', 'eus', 'ix', 'ida', 'oma'];

var BODIES = [
  { shape: 'worm', style: 'ribbon', links: [10, 18], len: [5, 7], width: [4, 7], motion: 'undulate' },
  { shape: 'spindle', style: 'ribbon', links: [6, 10], len: [5, 7], width: [6, 9], motion: 'undulate' },
  { shape: 'carapace', style: 'plates', links: [9, 13], len: [5, 7], width: [5, 7] },
  { shape: 'bell', style: 'ribbon', links: [4, 5], len: [4, 5], width: [10, 14], motion: 'pulse' },
  { shape: 'tadpole', style: 'ribbon', links: [8, 12], len: [5, 7], width: [7, 11], motion: 'undulate' },
  { shape: 'sansueBigHead', style: 'ribbon', links: [14, 22], len: [5, 6], width: [4, 6], motion: 'undulate' },
  { shape: 'constant', style: 'ribbon', links: [1, 1], len: [2, 2], width: [6, 9], radial: true }
];
var HEAD = ['antenne', 'barbillon', 'pinceHomard', 'oeil', 'rostre', 'lanterne', 'branchie', 'pince'];
var SIDE = ['nageoire', 'aile', 'rayons', 'patte', 'pleopode', 'cils', 'cerates', 'collerette', 'feuille', 'photophore', 'tentacule', 'patteMarche', 'parapode'];
var TAIL = ['eventail', 'caudale', 'voile', 'dard'];
var MOTIFS = ['bands', 'spots', 'stripe', 'ocelli', 'edge'];

function randomSpecies() {
  var b = pick(BODIES), R = E.rand;
  var s = {
    name: pick(SYL1) + pick(SYL2), palette: E.randomPalette(),
    eyes: { on: !b.radial && Math.random() < 0.6, size: R(0.6, 1.2) },
    ai: pick(['hunter', 'prey', 'drifter'])
  };
  var body = {
    name: 'Corps', links: randi(b.links[0], b.links[1]), len: R(b.len[0], b.len[1]), width: R(b.width[0], b.width[1]),
    shape: b.shape, style: b.style, flex: R(0.1, 0.4), spring: R(0.05, 0.4), drag: 0.8,
    color: { slot: 0, grad: Math.round(R(-15, 15)) }, attach: []
  };
  if (b.motion === 'undulate') body.motion = { type: 'undulate', amp: R(0.05, 0.12), freq: R(0.6, 1.4) };
  if (b.motion === 'pulse') {
    body.motion = { type: 'pulse', amp: 0.2, freq: R(0.5, 1) };
    body.color.alpha = 0.5; body.color.add = true; body.color.glow = 'body';
    body.flex = 0.05; body.spring = 0.6;
    s.swim = { mode: 'pulse', speed: R(1, 2), freq: body.motion.freq };
    s.eyes.on = false;
  } else {
    s.swim = { mode: pick(['steady', 'steady', 'dart']), speed: R(1.2, 2.4) };
  }
  if (Math.random() < 0.55) {
    body.color.pattern = pick(MOTIFS);
    body.color.pslot = randi(1, 3);
    body.color.pdensity = randi(3, 9);
  }
  var ids = [];
  if (b.radial) {
    ids.push(pick(['brasEtoile', 'epines', 'couronne']));
    if (Math.random() < 0.5) ids.push(pick(['epines', 'couronne']));
  } else if (b.motion === 'pulse') {
    ids.push('filament');
    if (Math.random() < 0.7) ids.push(pick(['brasOral', 'tentacule', 'bras']));
  } else {
    if (Math.random() < 0.8) ids.push(pick(HEAD));
    var side = randi(1, 2);
    for (var i = 0; i < side; i++) ids.push(pick(SIDE));
    if (Math.random() < 0.7) ids.push(pick(TAIL));
  }
  ids.forEach(function (id, k) {
    var a = part(id);
    if (Math.random() < 0.35) a.jitter = R(0.2, 0.6);
    if (Math.random() < 0.3) a.node.color.slot = randi(0, 3);
    if (b.radial && k > 0) { a.scale = 0.6; a.edge = 0.4; a.angle = Math.PI / a.count; }
    // a sting or cilia at the tip of whips
    if (a.node.role === 'whip' && Math.random() < 0.4) a.node.attach.push(part(pick(['dard', 'dard', 'cils'])));
    body.attach.push(a);
  });
  return spec(assign(s, { body: body }));
}

// ----- crossbreeding: body of a, some limbs of both ----- //

function cross(a, b) {
  var c = spec(clone(a)), donor = b.body.attach, added = 0;
  c.name = a.name.split(' ')[0] + '-' + b.name.split(' ')[0].toLowerCase();
  var dh = ((b.palette.hue - a.palette.hue + 540) % 360) - 180;
  c.palette.hue = Math.round((a.palette.hue + dh / 2 + 360) % 360);
  c.body.attach = c.body.attach.filter(function () { return Math.random() < 0.7; });
  donor.forEach(function (x) {
    if (Math.random() < 0.55) { c.body.attach.push(att(clone(x))); added++; }
  });
  if (!added && donor.length) c.body.attach.push(att(clone(pick(donor))));
  return c;
}

E.PARTS = PARTS;
E.SPECIES = SPECIES;
E.INFO = INFO;
E.CATS = CATS;
E.part = part;
E.randomSpecies = randomSpecies;
E.cross = cross;

})(window);
