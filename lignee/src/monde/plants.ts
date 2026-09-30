// The plants of the world: a species definition for every kind of plant, seeded
// so that the same plant grows back the same.

import { spec, type Spec } from '../engine';
import { SPECIES } from '../content';

type R01 = () => number;

export function plantSpec(kind: string, R: R01): Spec {
  const r = (a: number, c: number) => a + R() * (c - a);
  const ri = (a: number, c: number) => Math.floor(r(a, c + 1));
  switch (kind) {
    case 'kelp':
      return spec({ name: 'Kelp', palette: { hue: r(40, 70), harmony: 'analog', sat: r(45, 65), light: r(30, 40) }, eyes: { on: false },
        body: { name: 'Stipe', links: ri(26, 40), len: 12, width: 1.4, shape: 'constant', style: 'ribbon', flex: 0.4, spring: 0.04, drag: 0.7, gravity: -0.07, curl: r(-0.05, 0.05),
          color: { slot: 0, grad: 12 },
          attach: [{ node: { name: 'Fronde', links: 5, len: 6.5, width: 4.2, shape: 'leaf', style: 'ribbon', flex: 0.35, spring: 0.12, curl: 0.6, gravity: -0.03, drag: 0.7, color: { slot: 1, alpha: 0.92, grad: 10 } },
            pattern: 'series', at: 0.12, to: 1, count: ri(9, 14), angle: 0.8, alternate: true, jitter: 0.6, edge: 0.5 }] } });
    case 'posidonie':
      return spec({ name: 'Posidonie', palette: { hue: r(78, 110), harmony: 'analog', sat: r(40, 58), light: r(32, 44) }, eyes: { on: false },
        body: { name: 'Souche', links: 1, len: 1, width: 0.6, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 0 },
          attach: [{ node: { name: 'Feuille', links: ri(7, 10), len: 6, width: 1.5, shape: 'constant', style: 'ribbon', flex: 0.45, spring: 0.05, gravity: -0.05, drag: 0.7,
            color: { slot: 1, grad: 14, pattern: 'stripe', pslot: 3, plight: 12, pscale: 0.5 } }, pattern: 'fan', at: 1, count: ri(4, 7), spread: 0.6, angle: 0, jitter: 0.8, phaseStep: 0.8 }] } });
    case 'sargasse':
      return spec({ name: 'Sargasse', palette: { hue: r(34, 46), harmony: 'analog', sat: r(55, 75), light: r(38, 48) }, eyes: { on: false },
        body: { name: 'Stolon', links: ri(7, 11), len: 6, width: 1, shape: 'constant', style: 'ribbon', flex: 0.45, spring: 0.08, drag: 0.72, gravity: 0.03,
          color: { slot: 0, grad: -8 },
          attach: [
            { node: { name: 'Feuille', links: 3, len: 3.4, width: 2.2, shape: 'leaf', style: 'ribbon', flex: 0.3, spring: 0.2, curl: 0.3, color: { slot: 1, grad: 8 } },
              pattern: 'series', at: 0.1, to: 1, count: ri(6, 10), angle: 1.1, alternate: true, jitter: 0.7 },
            { node: { name: 'Flotteur', links: 1, len: 2.4, width: 1.5, shape: 'constant', style: 'disc', flex: 0.2, spring: 0.3, color: { slot: 3, light: 12 } },
              pattern: 'series', at: 0.2, to: 0.9, count: ri(3, 6), angle: 1.6, alternate: true, jitter: 0.5 }
          ] } });
    case 'coral':
      return spec({ name: 'Corail', palette: { hue: pick(R, [8, 18, 330, 345, 40, 280]), harmony: 'analog', sat: r(65, 88), light: r(52, 62) }, eyes: { on: false },
        body: { name: 'Tronc', links: 3, len: 6, width: 3, shape: 'worm', style: 'ribbon', flex: 0.02, spring: 0.9, color: { slot: 0, grad: 10 },
          attach: [{ node: { name: 'Branche', links: 3, len: 5.5, width: 2.3, shape: 'worm', style: 'ribbon', flex: 0.02, spring: 0.9, color: { slot: 0, grad: 15 },
            attach: [{ node: { name: 'Rameau', links: 2, len: 4.5, width: 1.6, shape: 'bulb', style: 'ribbon', flex: 0.03, spring: 0.9, color: { slot: 1, light: 8 } },
              pattern: 'fan', at: 1, count: 2, spread: 0.8, angle: 0, jitter: 0.6 }] },
            pattern: 'fan', at: 1, count: ri(2, 3), spread: 1, angle: 0, jitter: 0.6 }] } });
    case 'fan':
      return spec({ name: 'Gorgone', palette: { hue: pick(R, [285, 300, 340, 20, 45]), harmony: 'analog', sat: r(55, 80), light: r(46, 56) }, eyes: { on: false },
        body: { name: 'Pied', links: 2, len: 6, width: 1.6, shape: 'constant', style: 'ribbon', flex: 0.02, spring: 0.9, color: { slot: 0 } ,
          attach: [{ node: { name: 'Rayon', links: 7, len: 7.5, width: 0.7, shape: 'linear', style: 'line', flex: 0.06, spring: 0.7, curl: 0.3, color: { slot: 0 } },
            pattern: 'fan', at: 1, count: ri(6, 9), spread: 1.6, angle: 0, web: 0.85, jitter: 0.4 }] } });
    case 'softcoral':
      return spec({ name: 'Corail mou', palette: { hue: pick(R, [330, 290, 20, 180]), harmony: 'analog', sat: r(55, 75), light: r(58, 68) }, eyes: { on: false },
        body: { name: 'Tronc', links: 2, len: 5, width: 3.2, shape: 'bell', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 0, alpha: 0.9 },
          attach: [{ node: { name: 'Lobe', links: 4, len: 4, width: 2.4, shape: 'club', style: 'ribbon', flex: 0.3, spring: 0.15, gravity: -0.03, drag: 0.72,
            color: { slot: 1, alpha: 0.85, pattern: 'spots', pslot: 3, plight: 25, pdensity: 7 } },
            pattern: 'fan', at: 1, count: ri(4, 7), spread: 1.3, angle: 0, jitter: 0.7 }] } });
    case 'seapen':
      return spec({ name: 'Plume de mer', palette: { hue: r(20, 45), harmony: 'split', sat: 60, light: 55 }, eyes: { on: false },
        body: { name: 'Tige', links: 8, len: 6.5, width: 1.4, shape: 'constant', style: 'ribbon', flex: 0.35, spring: 0.1, drag: 0.7, gravity: -0.03, color: { slot: 0 },
          attach: [{ node: { name: 'Pinnule', links: 3, len: 4, width: 1.6, shape: 'leaf', style: 'ribbon', flex: 0.2, spring: 0.2, curl: 0.5, color: { slot: 1 } },
            pattern: 'series', at: 0.3, to: 1, count: 8, angle: 1.1, alternate: true, hueStep: 10, phaseStep: 0.4 }] } });
    case 'tubes':
      return spec({ name: 'Vers tubicoles', palette: { hue: pick(R, [350, 20, 200]), harmony: 'mono', sat: 80, light: 52 }, eyes: { on: false },
        body: { name: 'Souche', links: 1, len: 1, width: 0.5, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 3, light: 30 },
          attach: [{ node: { name: 'Tube', links: 4, len: 5.5, width: 1.8, shape: 'constant', style: 'plates', flex: 0.05, spring: 0.7, color: { slot: 3, light: 35, grad: -10 },
            attach: [{ node: { name: 'Panache', links: 3, len: 3, width: 0.5, shape: 'linear', style: 'line', flex: 0.3, spring: 0.2, color: { slot: 0 } },
              pattern: 'fan', at: 1, count: 6, spread: 1.6, angle: 0 }] },
            pattern: 'fan', at: 1, count: ri(3, 6), spread: 0.7, angle: 0, jitter: 0.5 }] } });
    default: {
      const a = SPECIES.anemone();
      a.palette.hue = pick(R, [0, 20, 300, 330, 160]);
      return a;
    }
  }
}

function pick<T>(R: R01, l: T[]): T { return l[Math.floor(R() * l.length)]; }
