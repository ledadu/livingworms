export const TAU = Math.PI * 2;
export const STEP = 1 / 60;

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export function wrapAngle(a: number): number {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
}

export function lerpHue(a: number, b: number, t: number): number {
  const d = (((b - a) % 360) + 540) % 360 - 180;
  return (a + d * t + 360) % 360;
}

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

/** stable pseudo-random value in [0, 1) */
export function hash(k: number, salt: number): number {
  const v = Math.sin(k * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** seeded generator (mulberry32): same seed, same sequence */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(1)}%,${a.toFixed(3)})`;
}

/** integer hash of two ints, for seeds */
export function seedOf(a: number, b: number): number {
  return (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) >>> 0;
}

/** smooth 1D value noise in [0, 1] */
export function noise1(x: number, seed: number): number {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const h = (n: number) => {
    let v = Math.imul((n | 0) ^ (seed | 0), 0x27d4eb2d);
    v ^= v >>> 15; v = Math.imul(v, 0x85ebca6b); v ^= v >>> 13;
    return (v >>> 0) / 4294967296;
  };
  const a = h(i);
  return a + (h(i + 1) - a) * u;
}
