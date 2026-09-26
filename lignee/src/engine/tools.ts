// Measures and variations on species definitions.

import { Creature } from './creature';
import { HARMONIES, spec, walkNodes } from './defs';
import type { Harmony, NodeDef, PaletteDef, Spec } from './types';
import { clamp, clone, rand } from './util';

export interface Stats { chains: number; nodes: number; depth: number; }

export function stats(sp: Spec): Stats {
  const cr = new Creature(sp, 0, 0, { phase: 0 });
  let nodes = 0, depth = 0;
  for (const s of cr.list) { nodes += s.n + 1; if (s.depth > depth) depth = s.depth; }
  return { chains: cr.list.length, nodes, depth: depth + 1 };
}

export function nodeDepth(d: NodeDef): number {
  let m = 0;
  for (const a of d.attach) m = Math.max(m, nodeDepth(a.node));
  return 1 + m;
}

export function nodeTitle(d: NodeDef): string {
  const names: string[] = [];
  for (const a of d.attach) walkNodes(a.node, (x) => { if (!names.includes(x.name)) names.push(x.name); });
  return d.name + (names.length ? ' + ' + names.join(' + ') : '');
}

/** a variation that keeps the structure (used for siblings of a litter) */
export function mutate(sp: Spec, amt = 1, R: () => number = Math.random): Spec {
  const s = spec(clone(sp));
  const r = (a: number, b: number) => a + R() * (b - a);
  s.palette.hue = (((s.palette.hue + r(-30, 30) * amt) % 360) + 360) % 360;
  s.palette.light = clamp(s.palette.light + r(-6, 6) * amt, 25, 80);
  walkNodes(s.body, (n, _depth, a) => {
    n.len *= 1 + r(-0.14, 0.14) * amt;
    n.width *= 1 + r(-0.14, 0.14) * amt;
    n.curl += r(-0.25, 0.25) * amt;
    if (R() < 0.2 * amt) n.links = Math.max(1, n.links + (R() < 0.5 ? -1 : 1));
    n.color.shift += r(-10, 10) * amt;
    if (a) {
      a.angle += r(-0.12, 0.12) * amt;
      if ((a.pattern === 'fan' || a.pattern === 'series') && R() < 0.3 * amt) a.count = Math.max(1, a.count + (R() < 0.5 ? -1 : 1));
    }
  });
  return s;
}

export function randomPalette(): PaletteDef {
  const h = Object.keys(HARMONIES) as Harmony[];
  return { hue: Math.round(rand(0, 360)), harmony: h[Math.floor(Math.random() * h.length)], sat: Math.round(rand(55, 85)), light: Math.round(rand(45, 65)) };
}
