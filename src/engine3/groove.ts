// What a dance lays over the swim of a creature (dance.ts): a few angles and offsets, set once per step, that the
// update of the body reads as it goes (creature3.ts). The trunk bends a little more here and there, the head turns,
// the body moves a few pixels from where it swims, and the limbs swing and rise by kind and by side. The chains stay
// whole and the swim goes on underneath; without a groove, nothing changes.

import type { NodeDef } from '../engine/types';

/** the kinds of limbs a dance tells apart */
export const LIMBS = ['fin', 'leg', 'arm', 'thread', 'feeler', 'frill'] as const;
export type Limb = (typeof LIMBS)[number];
export const FIN = 0, LEG = 1, ARM = 2, THREAD = 3, FEELER = 4, FRILL = 5;

/** the points along the trunk (head to tail) and along a row of limbs (front to back) where a dance sets its angles;
 * the links and the limbs between them take what lies between */
export const TRUNK = 9, ROW = 5;

export interface Groove {
  /** the trunk's added bend, in radians over the length of the body, at TRUNK points from head to tail */
  bend: Float32Array;
  /** the body moved from where it swims (px) */
  x: number; y: number;
  /** the head turned (rad): pitch (+: nose down), yaw (as the creature's yaw), roll (about its length) */
  pitch: number; yaw: number; roll: number;
  /** each kind of limb, on each side (0: left, 1: right), at ROW points front to back: how far it swings fore and aft,
   * and how far it rises (rad); see slot */
  swing: Float32Array; raise: Float32Array;
  /** how much each kind of limb curls, on each side (rad over its length) */
  curl: Float32Array;
}

export function newGroove(): Groove {
  const n = LIMBS.length * 2;
  return { bend: new Float32Array(TRUNK), x: 0, y: 0, pitch: 0, yaw: 0, roll: 0, swing: new Float32Array(n * ROW), raise: new Float32Array(n * ROW), curl: new Float32Array(n) };
}

export function clearGroove(g: Groove): void {
  g.bend.fill(0); g.swing.fill(0); g.raise.fill(0); g.curl.fill(0);
  g.x = g.y = g.pitch = g.yaw = g.roll = 0;
}

/** where limb kind l, side s (0: left, 1: right), point p of its row is in swing and raise */
export const slot = (l: number, s: number, p: number): number => (l * 2 + s) * ROW + p;

/** a field of n points from o, at u (0..1), linearly between them */
export function along(f: Float32Array, o: number, n: number, u: number): number {
  const q = (u < 0 ? 0 : u > 1 ? 1 : u) * (n - 1), i = Math.min(n - 2, q | 0);
  return f[o + i] + (f[o + i + 1] - f[o + i]) * (q - i);
}

/** the kind of limb a part on the trunk is, as a dance sees it; -1: it does not dance (an eye, a light spot, a spike) */
export function limbOf(d: NodeDef): number {
  if (d.style === 'eye' || d.style === 'disc' || d.flex < 0.09) return -1;
  if (d.drive === 'walk') return LEG;
  switch (d.role) {
    case 'body': return -1;
    case 'fin': return FIN;
    case 'whip': case 'jaw': return ARM;
    case 'cilia': return THREAD;
    case 'sting': return d.style === 'line' ? THREAD : FRILL;
    case 'sense': case 'light': return FEELER;
    default: return d.style === 'line' ? THREAD : FRILL;
  }
}
