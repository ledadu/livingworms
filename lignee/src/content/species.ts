// The species, sorted by family.

import { spec, type Spec } from '../engine';

const assign = Object.assign;
import { part } from './parts';


export const SPECIES: Record<string, () => Spec> = {
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
      swim: { mode: 'bell', speed: 1.4, freq: 0.7 }, ai: 'drifter', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 2 }, ai: 'prey', eyes: { on: false },
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
      swim: { mode: 'jet', speed: 2.4, freq: 0.9 }, ai: 'hunter', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 1 }, ai: 'prey', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 1 }, ai: 'drifter', eyes: { on: false },
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
      swim: { mode: 'bell', speed: 1.9, freq: 1.1 }, ai: 'drifter', eyes: { on: false },
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
      swim: { mode: 'bell', speed: 1.2, freq: 0.6 }, ai: 'drifter', eyes: { on: false },
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
      swim: { mode: 'bell', speed: 1, freq: 0.3 }, ai: 'drifter', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 1.6 }, ai: 'hunter', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 1.5 }, ai: 'hunter', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 2.2 }, ai: 'hunter', eyes: { on: false },
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
      swim: { mode: 'jet', speed: 1.8, freq: 0.6, walk: true, rear: true, posture: -0.9 }, ai: 'hunter', eyes: { on: false },
      body: {
        name: 'Manteau', links: 5, len: 6, width: 10, shape: 'bloby', style: 'ribbon', flex: 0.12, spring: 0.4, drag: 0.8,
        color: { slot: 0, grad: 10, pattern: 'spots', pdensity: 5, pslot: 2 }, motion: { type: 'breathe', amp: 0.08, freq: 0.6 },
        attach: [
          part('oeil', { links: 1, len: 1.5, width: 2.2, color: { slot: 3 } }, { at: 0.85, angle: 1.57, edge: 0.9, front: true }),
          part('bras', { links: 14, len: 4.5, width: 2.8, color: { slot: 0, pattern: 'spots', pslot: 3, pdensity: 8, plight: 20, pscale: 1.2 }, motion: { type: 'recoil', amp: 1.1, freq: 0.35 } },
            { count: 8, spread: 1.3, edge: 0.8, web: 0.25 })
        ]
      }
    });
  },
  nautile: function () {
    return spec({
      name: 'Nautile', palette: { hue: 28, harmony: 'mono', sat: 55, light: 62 },
      swim: { mode: 'jet', speed: 1.2, freq: 0.7 }, ai: 'drifter', eyes: { on: false },
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
    const band = { pattern: 'bands' as const, pslot: 3, plight: 30 };
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
      swim: { mode: 'steady', speed: 1.5, pitchMax: 0.4 }, ai: 'drifter', eyes: { on: false },
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
      swim: { mode: 'steady', speed: 0.9, posture: -1.15 }, ai: 'prey', eyes: { on: true, size: 0.8, spread: 0.4 },
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
      swim: { mode: 'steady', speed: 1.2, pitchMax: 0.5 }, ai: 'drifter', eyes: { on: true, size: 0.45, spread: 0.85, fwd: 0.2 },
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
      swim: { mode: 'crawl', speed: 1.1 }, ai: 'drifter', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 0.9 }, ai: 'prey', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 0.5 }, ai: 'prey', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 1 }, ai: 'prey', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 0.35 }, ai: 'drifter', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 1.1 }, ai: 'prey', eyes: { on: true, size: 0.7, spread: 0.7, fwd: 0.4 },
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
      swim: { mode: 'steady', speed: 1.3, pitchMax: 0.5 }, ai: 'drifter', eyes: { on: false },
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
      swim: { mode: 'crawl', speed: 0.7 }, ai: 'prey', eyes: { on: true, size: 0.6, spread: 0.4, fwd: 0.3 },
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
