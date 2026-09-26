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

// ----- generator: seeded, by family and mood ----- //
// Same seed + same settings = same creature. Every family is a small recipe:
// a body, then head / side / tail parts, then nesting and light depending on
// complexity and bioluminescence.

function rng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function newSeed() { return Math.floor(Math.random() * 0xFFFFFFF); }

var FAMILIES = [
  ['any', 'Au hasard'], ['fish', 'Poisson'], ['jelly', 'Méduse'], ['crustacean', 'Crustacé'],
  ['cephalopod', 'Céphalopode'], ['worm', 'Ver'], ['radial', 'Radiaire'], ['chimera', 'Chimère']
];
var MOODS = [['any', 'Au hasard'], ['reef', 'Récif'], ['abyss', 'Abysses'], ['pastel', 'Pastel'], ['mono', 'Mono'], ['wild', 'Sauvage']];

var SYL1 = ['Aby', 'Lumi', 'Cten', 'Hydr', 'Noct', 'Vitr', 'Spir', 'Thal', 'Myr', 'Pel', 'Bathy', 'Cor', 'Aur', 'Sel', 'Pyro', 'Glau', 'Nere', 'Opal', 'Zeph', 'Cala'];
var SYL2 = ['ella', 'opsis', 'ura', 'ax', 'ina', 'ops', 'aria', 'onia', 'eus', 'ix', 'ida', 'oma', 'ellus', 'ides'];
var EPITHET = { reef: 'corallina', abyss: 'abyssalis', pastel: 'pallida', mono: 'unicolor', wild: 'mirabilis' };

function generate(o) {
  o = assign({ archetype: 'any', mood: 'any', complexity: 0.5, glow: 0.3 }, o);
  if (o.seed === undefined) o.seed = newSeed();
  var R = rng(o.seed);
  function r(a, b) { return a + R() * (b - a); }
  function ri(a, b) { return Math.floor(r(a, b + 1)); }
  function pk(list) { return list[Math.floor(R() * list.length)]; }
  function chance(p) { return R() < p; }

  var arch = o.archetype === 'any' ? pk(['fish', 'fish', 'jelly', 'crustacean', 'cephalopod', 'worm', 'radial', 'chimera']) : o.archetype;
  var mood = o.mood === 'any' ? pk(['reef', 'abyss', 'pastel', 'mono', 'wild']) : o.mood;
  var c = o.complexity, g = o.glow;

  var pal = {
    reef:   { hue: ri(0, 359), harmony: pk(['triad', 'complement', 'split']), sat: ri(75, 95), light: ri(50, 60) },
    abyss:  { hue: ri(190, 310), harmony: pk(['split', 'complement', 'analog']), sat: ri(45, 70), light: ri(18, 32) },
    pastel: { hue: ri(0, 359), harmony: pk(['analog', 'triad']), sat: ri(30, 50), light: ri(70, 82) },
    mono:   { hue: ri(0, 359), harmony: 'mono', sat: ri(60, 85), light: ri(45, 60) },
    wild:   { hue: ri(0, 359), harmony: pk(['analog', 'complement', 'triad', 'split', 'mono']), sat: ri(40, 95), light: ri(25, 70) }
  }[mood];
  if (mood === 'abyss') g = Math.min(1, g + 0.35);
  var translucent = mood === 'pastel' || arch === 'jelly';

  // helpers
  function P(id, nodeOver, attOver) { return part(id, nodeOver, attOver); }
  function motif(col) {
    if (!chance(0.35 + c * 0.3)) return col;
    col.pattern = pk(['bands', 'spots', 'stripe', 'ocelli', 'edge']);
    col.pslot = ri(1, 3);
    col.pdensity = ri(3, 10);
    col.pscale = r(0.7, 1.6);
    col.plight = mood === 'abyss' ? ri(10, 30) : ri(-10, 20);
    return col;
  }
  function glowTip(a) {
    if (chance(g)) a.node.color.glow = 'tip';
    return a;
  }
  // with complexity, parts grow sub-parts at their tip
  function nest(a, depth) {
    depth = depth || 1;
    var role = a.node.role;
    if (depth > 2 || !chance(c * 0.55)) return a;
    var sub;
    if (role === 'whip') sub = pk(['dard', 'cils', 'dard']);
    else if (role === 'sense') sub = pk(['cils', 'photophore']);
    else if (a.node.name === 'Feuille') sub = 'feuille';
    else return a;
    var s = P(sub, sub === 'feuille' ? { name: 'Foliole', links: 3, width: 2 } : null, sub === 'feuille' ? { at: 0.4, to: 1, count: 2 } : null);
    if (sub === 'cils') { s.at = 0.3; s.to = 1; s.count = ri(3, 6); s.edge = 0; }
    a.node.attach.push(nest(glowTip(s), depth + 1));
    return a;
  }
  function jit(a) { if (chance(0.4)) a.jitter = r(0.15, 0.6); return a; }
  function slot(a) { if (chance(0.35)) a.node.color.slot = ri(0, 3); return a; }

  var body, attach = [], swim, ai, eyes = { on: false, size: r(0.6, 1.1) };

  function makeFish() {
    body = { name: 'Corps', links: ri(7, 14), len: r(4.5, 7), width: r(5, 9), shape: pk(['spindle', 'tadpole', 'worm', 'sansueBigHead']), style: 'ribbon',
      flex: r(0.15, 0.35), spring: r(0.1, 0.25), drag: 0.8, color: motif({ slot: 0, grad: ri(-15, 10) }),
      motion: { type: 'undulate', amp: r(0.06, 0.12), freq: r(0.7, 1.4) } };
    attach.push(slot(P(pk(['nageoire', 'rayons', 'nageoire']), null, { at: r(0.15, 0.35) })));
    var tail = pk(['caudale', 'voile', 'lobes', 'caudale']);
    if (tail === 'lobes') attach.push(P('nageoire', { name: 'Lobe caudal', links: 4, width: r(2.5, 4), curl: 0.3, motion: { type: 'none' } }, { at: 1, angle: r(0.3, 0.6), edge: 0 }));
    else attach.push(jit(P(tail, { color: { slot: ri(0, 2) } }, { count: ri(4, 9) })));
    if (chance(0.3)) attach.push(P('barbillon'));
    if (chance(c * 0.6)) attach.push(jit(P(pk(['feuille', 'rayons']), { color: { slot: ri(1, 3) } },
      { pattern: 'series', at: 0.1, to: 0.6, count: ri(4, 8), angle: 0.9, alternate: true, web: 0, mirror: false })));
    if (chance(g * 0.7)) attach.push(P('photophore', null, { count: ri(3, 7) }));
    if (chance(g * 0.5)) attach.push(P('lanterne'));
    eyes.on = true;
    swim = { mode: 'steady', speed: r(1.2, 2.4) };
    ai = pk(['prey', 'prey', 'hunter']);
  }
  function makeJelly() {
    body = { name: 'Ombrelle', links: ri(4, 5), len: r(3.5, 5), width: r(9, 14), shape: 'bell', style: 'ribbon', flex: 0.05, spring: 0.6, drag: 0.8,
      color: motif({ slot: 0, alpha: r(0.35, 0.7), add: chance(0.7), glow: chance(g + 0.2) ? 'body' : 'none' }),
      motion: { type: 'pulse', amp: r(0.14, 0.24), freq: r(0.5, 1.1) } };
    var fil = P('filament', { links: ri(14, 28), color: { slot: ri(1, 3), glow: chance(g) ? 'tip' : 'none' } }, { count: ri(6, 10 + Math.round(c * 8)), spread: r(0.9, 1.5) });
    if (chance(0.3)) {
      // box jelly: pedalia carrying bundles of filaments
      fil.count = 3; fil.spread = 0.3; fil.edge = 0.4; fil.at = 1;
      attach.push({ node: { name: 'Pédalie', links: 2, len: 2.5, width: 1.6, shape: 'leaf', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 0, alpha: 0.5, add: true }, attach: [fil] },
        pattern: 'fan', at: 1, count: 4, spread: 1.4, edge: 1, angle: 0 });
    } else attach.push(jit(fil));
    if (chance(0.65)) attach.push(P('brasOral', { links: ri(10, 18), color: { slot: ri(1, 2) } }, { count: ri(3, 5) }));
    if (chance(c * 0.4)) attach.push(P('couronne', { links: 4, width: 1, color: { slot: 3 } }, { at: 1, count: ri(8, 14), scale: 0.5 }));
    swim = { mode: 'pulse', speed: r(1, 2), freq: body.motion.freq };
    ai = 'drifter';
  }
  function makeCrustacean() {
    body = { name: 'Carapace', links: ri(9, 13), len: r(5, 6.5), width: r(5, 7.5), shape: 'carapace', style: 'plates', flex: 0.14, spring: 0.3, drag: 0.8,
      color: motif({ slot: 0, grad: ri(-10, 5) }) };
    attach.push(P('antenne', { links: ri(14, 26), color: { slot: ri(1, 3) } }, { angle: r(2.5, 2.9) }));
    if (chance(0.6)) attach.push(P('antenne', { name: 'Antennule', links: ri(6, 10), curl: 1, width: 0.4, color: { slot: 3 } }, { at: 0.02, angle: 2.3 }));
    attach.push(P('oeil', null, { at: 0.05, angle: 2.2, edge: 0.75 }));
    if (chance(0.5)) attach.push(P('rostre'));
    if (chance(0.5)) attach.push(P('pinceHomard', { width: r(2.6, 3.8) }));
    attach.push(jit(P(pk(['patte', 'patteMarche']), null, { count: ri(3, 5) })));
    attach.push(P('pleopode', { color: { slot: ri(1, 3) } }, { count: ri(3, 6) }));
    attach.push(P('eventail', { color: { slot: ri(0, 2) } }));
    if (chance(g * 0.7)) attach.push(P('photophore', null, { count: ri(3, 5), at: 0.2, to: 0.7 }));
    swim = { mode: 'dart', speed: r(1.5, 2.3) };
    ai = pk(['prey', 'hunter']);
  }
  function makeCephalopod() {
    body = { name: 'Manteau', links: ri(5, 9), len: r(5, 7), width: r(7, 10), shape: pk(['spindle', 'bloby']), style: 'ribbon', flex: 0.1, spring: 0.4, drag: 0.8,
      color: motif({ slot: 0, grad: ri(0, 12) }), motion: { type: 'breathe', amp: 0.07, freq: r(0.4, 0.8) } };
    attach.push(P('oeil', { links: 1, len: 1.5, width: r(1.8, 2.5), color: { slot: ri(1, 3) } }, { at: 0.85, angle: 1.57, edge: 0.9, front: true }));
    var arms = P('bras', { links: ri(8, 14), color: motif({ slot: 0 }) }, { count: ri(6, 10), spread: r(0.7, 1.4), web: chance(0.4) ? r(0.15, 0.35) : 0 });
    attach.push(nest(arms));
    if (chance(0.6)) attach.push(glowTip(P('massue', { links: ri(10, 16) })));
    attach.push(chance(0.5) ? P('collerette', { color: { slot: 0, alpha: 0.7, light: 10 } }) : P('nageoire', { width: r(3.5, 5.5), links: 4, color: { slot: 0, alpha: 0.8 } }, { at: 0.05, angle: 2.3, edge: 0.6 }));
    swim = { mode: 'pulse', speed: r(1.5, 2.4), freq: r(0.5, 0.9) };
    ai = 'hunter';
  }
  function makeWorm() {
    body = { name: 'Corps', links: ri(16, 26), len: r(4, 6), width: r(3, 5.5), shape: pk(['worm', 'sansueBigHead', 'spindle']), style: pk(['plates', 'ribbon']),
      flex: r(0.25, 0.4), spring: r(0.05, 0.12), drag: 0.8, color: motif({ slot: 0, grad: ri(-12, 12) }),
      motion: { type: 'undulate', amp: r(0.06, 0.12), freq: r(0.6, 1.1) } };
    attach.push(jit(P(pk(['parapode', 'cils', 'cerates', 'feuille', 'pleopode']), null, { count: ri(6, 10 + Math.round(c * 6)) })));
    var head = pk(['radiole', 'antenne', 'barbillon', 'rhino']);
    if (head === 'rhino') attach.push(P('antenne', { name: 'Rhinophore', links: 4, len: 3, width: 1.4, style: 'ribbon', curl: -0.4, color: { slot: 2 } }, { at: 0.02, angle: 2.7 }));
    else attach.push(nest(P(head, null, head === 'radiole' ? { count: ri(4, 7) } : null)));
    if (chance(0.3)) attach.push(glowTip(P('dard')));
    eyes.on = chance(0.4);
    swim = { mode: 'steady', speed: r(0.8, 1.6) };
    ai = pk(['prey', 'drifter']);
  }
  function makeRadial() {
    body = { name: 'Disque', links: 1, len: 2, width: r(5, 9), shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5, color: motif({ slot: 0 }) };
    var first = pk(['brasEtoile', 'couronne', 'epines']);
    var r1 = P(first, { color: motif({ slot: ri(0, 1) }) }, { count: first === 'brasEtoile' ? ri(5, 8) : ri(10, 22) });
    if (first === 'brasEtoile' && chance(0.5)) { r1.node.links = ri(10, 14); r1.node.width = r(1.2, 2); r1.node.flex = 0.45; r1.node.motion = { type: 'curl', amp: 1.4, freq: 0.5 }; }
    attach.push(jit(r1));
    if (chance(0.5 + c * 0.3)) {
      var second = pk(['couronne', 'epines']);
      attach.push(jit(P(second, { links: 4, color: { slot: ri(2, 3) } }, { count: ri(8, 14), scale: 0.6, edge: 0.4, angle: Math.PI / 12 })));
    }
    swim = { mode: 'steady', speed: r(0.3, 0.7) };
    ai = pk(['prey', 'drifter']);
  }

  var build = { fish: makeFish, jelly: makeJelly, crustacean: makeCrustacean, cephalopod: makeCephalopod, worm: makeWorm, radial: makeRadial };
  if (arch === 'chimera') {
    // a body from one family, limbs borrowed from the others
    build[pk(['fish', 'worm', 'cephalopod', 'crustacean'])]();
    var extra = ri(1, 2 + Math.round(c * 2));
    for (var k = 0; k < extra; k++) {
      var id = pk(['tentacule', 'aile', 'rayons', 'feuille', 'cerates', 'bras', 'pinceHomard', 'lanterne', 'voile', 'branchie', 'collerette']);
      attach.push(nest(slot(jit(P(id)))));
    }
    if (chance(0.5)) attach.push(glowTip(P('dard', { width: 2.4 })));
    ai = 'hunter';
    eyes.on = chance(0.7);
  } else {
    build[arch]();
  }
  attach.forEach(function (a) { if (a.node && a.node.role === 'whip') nest(a); });
  if (translucent && arch !== 'jelly') { body.color.alpha = r(0.6, 0.85); }
  body.attach = attach;

  var name = pk(SYL1) + pk(SYL2);
  var ep = g > 0.65 ? 'lucens' : EPITHET[mood];
  if (ep && chance(0.7)) name += ' ' + ep;
  var sp = spec({ name: name, size: r(0.8, 1.25), palette: pal, swim: swim, ai: ai, eyes: eyes, body: body,
    gen: { seed: o.seed, archetype: arch, mood: mood, complexity: c, glow: o.glow } });
  // keep generated species light enough for a phone
  var guard = 0;
  while (E.stats(sp).chains > 150 && sp.body.attach.length > 1 && guard++ < 10) sp.body.attach.pop();
  return sp;
}

function randomSpecies() { return generate({}); }

// ----- fusion ----- //
// modes: mix (bodies blended, limbs of both), bodyA / bodyB (one body, limbs
// from the other), chimera (every limb of both), graft (B becomes a limb of A)

var FUSIONS = [
  ['mix', 'Mélange', 'Les deux corps se mélangent, chaque membre vient de l\'un ou de l\'autre.'],
  ['bodyA', 'Corps de A', 'Garde le corps de A et lui donne des membres de B.'],
  ['bodyB', 'Corps de B', 'Garde le corps de B et lui donne des membres de A.'],
  ['chimera', 'Chimère', 'Le corps de A porte tous les membres des deux espèces.'],
  ['graft', 'Greffe', 'B tout entier devient une paire de membres de A.']
];

var NUM_KEYS = ['links', 'len', 'width', 'flex', 'spring', 'curl', 'curlBias', 'drag', 'lenTo', 'gravity'];

function blendName(a, b, share, R) {
  var wa = a.split(' ')[0], wb = b.split(' ')[0], j = R ? Math.floor(R() * 3) - 1 : 0;
  var cutA = Math.max(2, Math.round(wa.length * (1 - share * 0.6) * 0.6) + j), cutB = E.clamp(Math.round(wb.length * 0.5) - j, 1, wb.length - 1);
  var n = wa.slice(0, cutA) + wb.slice(cutB);
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

function fuse(a, b, o) {
  o = assign({ mode: 'mix', share: 0.5, palette: 'mix' }, o);
  if (o.seed === undefined) o.seed = newSeed();
  var R = rng(o.seed), sh = E.clamp(o.share, 0, 1);
  function takeB(p) { return R() < p; }
  var A = spec(clone(a)), B = spec(clone(b)), out;
  var limbsA = A.body.attach, limbsB = B.body.attach;

  if (o.mode === 'bodyB') {
    out = spec(clone(B));
    out.body.attach = limbsB.filter(function () { return R() < 0.35; })
      .concat(limbsA.filter(function () { return R() < 1 - sh * 0.5; }));
  } else if (o.mode === 'bodyA' || o.mode === 'chimera' || o.mode === 'graft') {
    out = spec(clone(A));
    if (o.mode === 'bodyA') {
      out.body.attach = limbsA.filter(function () { return R() < 0.35 + (1 - sh) * 0.5; })
        .concat(limbsB.filter(function () { return R() < 0.3 + sh * 0.7; }));
    } else if (o.mode === 'chimera') {
      out.body.attach = limbsA.concat(limbsB.map(function (x) { var y = att(clone(x)); y.scale *= 0.6 + sh * 0.6; return y; }));
    } else {
      var bodyB = clone(B.body);
      bodyB.role = 'whip';
      out.body.attach = limbsA.concat([att({ node: bodyB, pattern: 'pair', at: E.clamp(sh, 0.05, 0.95), angle: 1.1 + R() * 0.8, edge: 0.7, scale: 0.35 + R() * 0.3 })]);
    }
  } else {
    // mix: numbers blended, style and shape from one or the other, limbs from both
    out = spec(clone(sh < 0.5 ? A : B));
    NUM_KEYS.forEach(function (k) {
      var v = E.lerp(A.body[k] || 0, B.body[k] || 0, sh);
      out.body[k] = k === 'links' ? Math.max(1, Math.round(v)) : v;
    });
    out.body.shape = takeB(sh) ? B.body.shape : A.body.shape;
    out.body.style = takeB(sh) ? B.body.style : A.body.style;
    out.body.motion = clone(takeB(sh) ? B.body.motion : A.body.motion);
    out.body.color = clone(takeB(sh) ? B.body.color : A.body.color);
    out.swim = clone(takeB(sh) ? B.swim : A.swim);
    out.body.attach = limbsA.filter(function () { return R() < 1 - sh * 0.8; })
      .concat(limbsB.filter(function () { return R() < 0.2 + sh * 0.8; }));
    out.size = E.lerp(A.size || 1, B.size || 1, sh);
  }
  if (!out.body.attach.length) out.body.attach = (limbsB.length ? limbsB : limbsA).slice(0, 1);
  out.body.attach = out.body.attach.map(function (x) { return att(clone(x)); });

  // palette
  if (o.palette === 'b') out.palette = clone(B.palette);
  else if (o.palette === 'a') out.palette = clone(A.palette);
  else {
    var dh = ((B.palette.hue - A.palette.hue + 540) % 360) - 180;
    out.palette = {
      hue: Math.round((A.palette.hue + dh * sh + 360) % 360),
      harmony: sh < 0.5 ? A.palette.harmony : B.palette.harmony,
      sat: Math.round(E.lerp(A.palette.sat, B.palette.sat, sh)),
      light: Math.round(E.lerp(A.palette.light, B.palette.light, sh))
    };
  }
  out.name = blendName(A.name, B.name, sh, R);
  out.gen = null;
  out = spec(out);
  var guard = 0;
  while (E.stats(out).chains > 170 && out.body.attach.length > 1 && guard++ < 12) out.body.attach.splice(Math.floor(R() * out.body.attach.length), 1);
  return out;
}

function cross(a, b) { return fuse(a, b, { mode: 'bodyA', share: 0.5 }); }

E.PARTS = PARTS;
E.SPECIES = SPECIES;
E.INFO = INFO;
E.CATS = CATS;
E.part = part;
E.randomSpecies = randomSpecies;
E.cross = cross;
E.generate = generate;
E.fuse = fuse;
E.rng = rng;
E.FAMILIES = FAMILIES;
E.MOODS = MOODS;
E.FUSIONS = FUSIONS;

})(window);
