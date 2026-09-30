// La Carcasse: the skeleton of a whale lying on the floor, turned into an oasis.
// The skull, the jaws, the spine, the ribs (standing, broken or fallen) and the
// flippers are separate pieces at their own depth, so the animals swim between
// them; a shaft of light falls on the bones. The "natural frescoes" (shells set
// in spirals, rings and rays on the flat bones) are listed in CARCASSE.fresques:
// later chapters use them as traces of the lineages that came before.

import { TAU, clamp, rng, seedOf } from '../engine';
import { css, type HSL, type Mood } from './palette';
import { makeCanvas, type Sprite } from './sprites';
import { BIOMES, biomeMid, floorAt } from './biomes';
import { tint, type Decor } from './world';

export type BonePart = 'skull' | 'jaw' | 'spine' | 'rib' | 'flipper' | 'scapula' | 'disc' | 'shells' | 'shaft';
export type Motif = 'spirale' | 'anneaux' | 'rayons';

export interface Fresque { id: string; motif: Motif; x: number; z: number; /** height of its centre above the floor */ up: number; }

/** where the whale lies: in the middle of the Carcasse chapter, or on the plain under the drop-off until the map has one */
function carcasseX(): number {
  const i = BIOMES.findIndex((b) => b.id === 'carcasse');
  return i >= 0 ? Math.round(biomeMid(i)) : 14100;
}

/** the swimming plane is z = 0; the spine lies behind it, the near ribs just behind the swimmer */
const Z_SPINE = 90, Z_NEAR = 42, Z_FAR = 145;
/** from the tip of the snout to the last tail vertebra */
export const WHALE_LENGTH = 1180;

/** the pieces of the skeleton, head to the left; pure (seeded), for the tests and for makeDecor */
export function carcasseLayout(cx: number): { pieces: Decor[]; fresques: Fresque[] } {
  const R = rng(250), out: Decor[] = [];
  const add = (part: BonePart, x: number, z: number, h = 0, k = 0) =>
    out.push({ kind: 'bone', part, k, x: Math.round(x), z, h, seed: seedOf(Math.round(x), Math.round(z) + k * 131), sprite: null, spriteD: 0 });
  const head = cx - WHALE_LENGTH / 2;
  add('shaft', cx - 80, 300, 1100);
  add('skull', head + 170, Z_SPINE + 6, 0);
  add('jaw', head + 190, Z_NEAR - 14, 0, 0);
  add('jaw', head + 210, Z_FAR + 20, 0, 1);
  // the spine in four lengths, thinner toward the tail
  for (let k = 0; k < 4; k++) add('spine', head + 400 + k * 210, Z_SPINE, 0, k);
  // thirteen pairs of ribs: most still stand, some are broken, some have fallen on the sand
  for (let k = 0; k < 13; k++) {
    const x = head + 350 + k * 36, arc = Math.sin(Math.PI * (0.18 + (k / 13) * 0.78));
    for (const side of [0, 1]) {
      const u = R(), fallen = side === 0 ? u < 0.4 : u < 0.2, broken = !fallen && R() < 0.25;
      add('rib', x + (side ? 10 : -6) + (R() - 0.5) * 10, side ? Z_FAR : Z_NEAR + (fallen ? -12 : 0),
        (fallen ? 18 : 170 * arc * (broken ? 0.55 : 1) * (0.85 + R() * 0.25)), fallen ? 2 : broken ? 1 : 0);
    }
  }
  add('flipper', head + 330, Z_NEAR - 16, 0, 0);
  add('flipper', head + 380, Z_FAR + 30, 0, 1);
  // the frescoes: a shoulder blade standing in the sand, the skull, a tail vertebra rolled away
  add('scapula', head + 470, Z_FAR + 40, 0, 0);
  add('disc', head + WHALE_LENGTH + 90, 60, 0, 2);
  const fresques: Fresque[] = [
    { id: 'carcasse-spirale', motif: 'spirale', x: Math.round(head + 470), z: Z_FAR + 40, up: 92 },
    { id: 'carcasse-anneaux', motif: 'anneaux', x: Math.round(head + 170 + 70), z: Z_SPINE + 6, up: 52 },
    { id: 'carcasse-rayons', motif: 'rayons', x: Math.round(head + WHALE_LENGTH + 90), z: 60, up: 42 }
  ];
  // heaps of shells around the bones
  for (let k = 0; k < 7; k++) add('shells', cx + (R() - 0.5) * WHALE_LENGTH * 1.2, 10 + R() * 320, 0, k);
  return { pieces: out, fresques };
}

const X = carcasseX();
export const CARCASSE = { x: X, ...carcasseLayout(X) };

/** is (x, z) under the skeleton (no big rock there) */
export function underCarcasse(x: number, z: number): boolean {
  return Math.abs(x - X) < WHALE_LENGTH * 0.6 + 80 && z > -40 && z < 260;
}

/** who lives on the bones: [species, kind, x, z, scale] */
export function carcasseDwellers(): [string, 'swim' | 'floor', number, number, number][] {
  const R = rng(251), out: [string, 'swim' | 'floor', number, number, number][] = [];
  const at = () => X + (R() - 0.5) * WHALE_LENGTH;
  const zs = [0, 0, 30, 70, 120, 160];
  for (const [id, kind, n, s] of [['crabe', 'floor', 6, 0.7], ['plumeau', 'floor', 5, 0.75], ['ophiure', 'floor', 3, 0.7], ['verPlat', 'floor', 2, 0.7],
    ['homard', 'floor', 1, 0.8], ['anguille', 'swim', 2, 0.8], ['crevette', 'floor', 3, 0.7]] as const) {
    for (let k = 0; k < n; k++) out.push([id, kind, at(), zs[Math.floor(R() * zs.length)], s]);
  }
  return out;
}

/** a school of small silver fish that turns above the ribs */
export const carcasseSchool = { x: X, z: 150, n: 60, body: { h: 210, s: 18, l: 74 }, belly: { h: 45, s: 30, l: 90 }, size: 0.85 };

/** the light on the bones: [height above the foot, radius, hue, alpha], drawn after the dark */
export function boneLight(d: Decor): [number, number, number, number] | null {
  if (d.part === 'skull') return [50, 120, 45, 0.22];
  if (d.part === 'scapula') return [90, 80, 45, 0.2];
  if (d.part === 'disc') return [40, 55, 45, 0.18];
  if (d.part === 'spine') return [20, 90, 45, 0.1];
  return null;
}

// ----- drawing ----- //

const BONE: HSL = { h: 44, s: 30, l: 82 }, INK: HSL = { h: 225, s: 35, l: 12 };
const SHELLS: HSL[] = [{ h: 32, s: 45, l: 80 }, { h: 12, s: 55, l: 66 }, { h: 350, s: 45, l: 76 }, { h: 26, s: 50, l: 48 }, { h: 200, s: 25, l: 82 }, { h: 48, s: 60, l: 70 }];

type Ctx = CanvasRenderingContext2D;
type R01 = () => number;

/** a bone along a path: a dark outline, the ivory, then the light from above on its back */
function boneStroke(ctx: Ctx, path: Path2D, w: number, R: R01): void {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = css(INK, 0.85); ctx.lineWidth = w + 2.2; ctx.stroke(path);
  ctx.strokeStyle = css(BONE, 1, -8 + R() * 6); ctx.lineWidth = w; ctx.stroke(path);
  ctx.save(); ctx.translate(0, -w * 0.22);
  ctx.strokeStyle = css(BONE, 0.9, 12); ctx.lineWidth = w * 0.35; ctx.stroke(path);
  ctx.restore();
}

/** bone-eating worms: a red fuzz along the bones */
function fuzz(ctx: Ctx, R: R01, x0: number, x1: number, y: (x: number) => number, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0);
    ctx.fillStyle = css({ h: 355, s: 80, l: 52 }, 0.85);
    ctx.fillRect(x, y(x) - R() * 3, 1.2, 1.4 + R() * 2.6);
  }
}

/** white and yellow microbial mats on the sand, under the bones */
function mats(ctx: Ctx, R: R01, x0: number, x1: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = R() < 0.6 ? css({ h: 50, s: 20, l: 90 }, 0.45) : css({ h: 46, s: 65, l: 62 }, 0.4);
    ctx.beginPath(); ctx.ellipse(x0 + R() * (x1 - x0), y + R() * 3, 6 + R() * 18, 1.6 + R() * 2.4, 0, 0, TAU); ctx.fill();
  }
}

/** one shell, turned by a: a spiral cone, or a fan with ribs */
function shell(ctx: Ctx, R: R01, x: number, y: number, s: number, a: number, col: HSL): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.strokeStyle = css(INK, 0.6); ctx.lineWidth = 0.5;
  if (R() < 0.5) {
    ctx.fillStyle = css(col);
    ctx.beginPath(); ctx.moveTo(-s, s * 0.5); ctx.quadraticCurveTo(-s * 0.9, -s * 0.9, 0, -s); ctx.quadraticCurveTo(s * 0.9, -s * 0.9, s, s * 0.5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = css(col, 0.9, -18);
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, s * 0.45); ctx.lineTo(k * s * 0.42, -s * 0.85); ctx.stroke(); }
  } else {
    ctx.fillStyle = css(col);
    ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.quadraticCurveTo(s * 0.8, -s * 0.2, s * 0.35, s * 0.7); ctx.quadraticCurveTo(-s * 0.6, s * 0.7, -s * 0.5, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = css(col, 0.9, -20);
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.1 * k); ctx.lineTo(s * 0.5, -s * 0.4 * k + s * 0.5); ctx.stroke(); }
  }
  ctx.restore();
}

/** shells set in a pattern around (x, y), inside a radius r */
function fresco(ctx: Ctx, R: R01, motif: Motif, x: number, y: number, r: number): void {
  const col = (k: number) => SHELLS[k % SHELLS.length];
  if (motif === 'spirale') {
    for (let th = 0.6; th < 5.4 * Math.PI; th += 0.42) {
      const rr = (th / (5.4 * Math.PI)) * r, s = 1.6 + rr * 0.09;
      shell(ctx, R, x + Math.cos(th) * rr, y + Math.sin(th) * rr * 0.9, s, th + Math.PI / 2, col(Math.floor(th * 1.3)));
    }
  } else if (motif === 'anneaux') {
    for (let ring = 1; ring <= 3; ring++) {
      const rr = (ring / 3) * r, n = 6 + ring * 6;
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU; shell(ctx, R, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7, 1.6 + ring * 0.6, a + Math.PI / 2, col(ring * 2)); }
    }
    shell(ctx, R, x, y, 3.4, 0, col(5));
  } else {
    shell(ctx, R, x, y, 3.6, 0, col(5));
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + 0.2;
      for (let q = 1; q <= 4; q++) shell(ctx, R, x + Math.cos(a) * r * q / 4.4, y + Math.sin(a) * r * q / 4.4 * 0.8, 1.4 + q * 0.4, a + Math.PI / 2, col(k + (q & 1) * 3));
    }
  }
}

function bakeSkull(ctx: Ctx, R: R01, w: number, by: number): void {
  const x0 = 20, L = w - 40;
  mats(ctx, R, x0, x0 + L, by, 26);
  const p = new Path2D();
  // the long flat snout to the left, the vault of the cranium at the back
  p.moveTo(x0, by - 8);
  p.quadraticCurveTo(x0 + L * 0.3, by - 34, x0 + L * 0.58, by - 52);
  p.quadraticCurveTo(x0 + L * 0.74, by - 104, x0 + L * 0.9, by - 86);
  p.quadraticCurveTo(x0 + L, by - 62, x0 + L * 0.97, by - 14);
  p.lineTo(x0 + L * 0.5, by - 4);
  p.closePath();
  const g = ctx.createLinearGradient(0, by - 104, 0, by);
  g.addColorStop(0, css(BONE, 1, 10)); g.addColorStop(0.5, css(BONE, 1, 0)); g.addColorStop(1, css(BONE, 1, -22));
  ctx.fillStyle = g; ctx.fill(p);
  ctx.strokeStyle = css(INK, 0.85); ctx.lineWidth = 1.6; ctx.stroke(p);
  ctx.save(); ctx.clip(p);
  // sutures and the eye socket
  ctx.strokeStyle = css(BONE, 0.7, -26); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0 + L * 0.2, by - 20); ctx.quadraticCurveTo(x0 + L * 0.45, by - 34, x0 + L * 0.62, by - 30); ctx.stroke();
  ctx.fillStyle = css(INK, 0.75);
  ctx.beginPath(); ctx.ellipse(x0 + L * 0.66, by - 36, 9, 6, -0.2, 0, TAU); ctx.fill();
  ctx.restore();
  fresco(ctx, R, 'anneaux', x0 + L * 0.8, by - 52, 26);
  fuzz(ctx, R, x0 + L * 0.1, x0 + L * 0.95, () => by - 8, 30);
}

function bakeJaw(ctx: Ctx, R: R01, w: number, by: number, far: boolean, fl: (x: number) => number): void {
  const x0 = 14, L = w - 28, p = new Path2D(), bow = far ? 13 : 9;
  const y = (x: number) => by + fl(x) - 6 - Math.sin(((x - x0) / L) * Math.PI) * bow;
  for (let i = 0; i <= 3; i++) mats(ctx, R, x0 + (L * i) / 4, x0 + (L * (i + 1)) / 4, by + fl(x0 + (L * (i + 0.5)) / 4), 3);
  p.moveTo(x0, y(x0));
  for (let i = 1; i <= 16; i++) p.lineTo(x0 + (L * i) / 16, y(x0 + (L * i) / 16));
  boneStroke(ctx, p, far ? 8 : 10, R);
  fuzz(ctx, R, x0, x0 + L, y, 14);
}

function bakeSpine(ctx: Ctx, R: R01, w: number, by: number, k: number, fl: (x: number) => number): void {
  const x0 = 10, L = w - 20, n = 11, s0 = 11 - k * 2.2;
  for (let i = 0; i <= 3; i++) mats(ctx, R, x0 + (L * i) / 4, x0 + (L * (i + 1)) / 4, by + fl(x0 + (L * (i + 0.5)) / 4), 4);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, x = x0 + u * L, s = Math.max(3, s0 - u * 2.2), y = by + fl(x) - 4 - s * 0.8;
    // the body of the vertebra, then its spine and its two side processes
    ctx.strokeStyle = css(INK, 0.85); ctx.lineWidth = 1;
    ctx.fillStyle = css(BONE, 1, (i % 2) * 5 - 4);
    ctx.beginPath(); ctx.roundRect(x - s * 0.7, y - s, s * 1.4, s * 1.8, 2.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = css(BONE, 0.9, 12); ctx.fillRect(x - s * 0.5, y - s + 1, s, 1.6);
    const sp = new Path2D(); sp.moveTo(x, y - s); sp.lineTo(x - 3, y - s - s * 1.5 * (1 - k * 0.2));
    boneStroke(ctx, sp, 2.4, R);
    if (R() < 0.8) { const tp = new Path2D(); tp.moveTo(x - s * 0.7, y); tp.lineTo(x - s * 1.8, y + 2); boneStroke(ctx, tp, 1.8, R); }
  }
  fuzz(ctx, R, x0, x0 + L, (x) => by + fl(x) - 4 - s0 * 1.8, 22);
}

function bakeRib(ctx: Ctx, R: R01, w: number, by: number, H: number, state: number): void {
  const x0 = w * 0.62, p = new Path2D();
  if (state === 2) {
    // fallen on the sand
    mats(ctx, R, 4, w - 4, by, 5);
    p.moveTo(6, by - 4); p.quadraticCurveTo(w * 0.5, by - H, w - 6, by - 3);
    boneStroke(ctx, p, 4.6, R);
    return;
  }
  mats(ctx, R, x0 - 14, x0 + 14, by, 4);
  // a rib rises from the spine and bows toward the head; a broken one ends in a splinter
  p.moveTo(x0, by - 12);
  p.quadraticCurveTo(x0 - w * 0.62, by - H * 0.72, x0 - w * 0.36 + (R() - 0.5) * 8, by - H);
  boneStroke(ctx, p, 5.2 - H / 120, R);
  if (state === 1) { ctx.fillStyle = css(BONE, 1, -14); ctx.beginPath(); ctx.arc(x0 - w * 0.36, by - H, 2.4, 0, TAU); ctx.fill(); }
  fuzz(ctx, R, x0 - w * 0.4, x0, (x) => by - 12 - (x0 - x) * (H / (w * 0.5)), 6);
}

function bakeFlipper(ctx: Ctx, R: R01, w: number, by: number): void {
  mats(ctx, R, 6, w - 6, by, 6);
  // the arm, then the finger bones fanned out on the sand
  const arm = new Path2D(); arm.moveTo(8, by - 6); arm.lineTo(w * 0.36, by - 9);
  boneStroke(ctx, arm, 7, R);
  for (let f = 0; f < 4; f++) {
    let x = w * 0.38, y = by - 9;
    for (let q = 0; q < 4; q++) {
      const nx = x + 13 - q, ny = y + (f - 1.5) * 1.6;
      const b = new Path2D(); b.moveTo(x + 1.5, y); b.lineTo(nx - 1.5, ny);
      boneStroke(ctx, b, 3.8 - q * 0.6, R);
      x = nx; y = ny;
    }
  }
}

function bakeSlab(ctx: Ctx, R: R01, w: number, by: number, motif: Motif, disc: boolean): void {
  const cx = w / 2, p = new Path2D();
  mats(ctx, R, 6, w - 6, by, 8);
  let fy: number, fr: number;
  if (disc) {
    // a tail vertebra stood on its edge
    fr = 30; fy = by - 36;
    p.ellipse(cx, fy, 34, 32, 0, 0, TAU);
  } else {
    // the shoulder blade: a fan on a narrow neck, sunk in the sand
    fr = 40; fy = by - 94;
    p.moveTo(cx - 8, by); p.quadraticCurveTo(cx - 14, by - 50, cx - 56, by - 110);
    p.quadraticCurveTo(cx, by - 150, cx + 54, by - 116); p.quadraticCurveTo(cx + 12, by - 52, cx + 9, by);
    p.closePath();
  }
  const g = ctx.createLinearGradient(0, fy - 60, 0, by);
  g.addColorStop(0, css(BONE, 1, 10)); g.addColorStop(1, css(BONE, 1, -20));
  ctx.fillStyle = g; ctx.fill(p);
  ctx.strokeStyle = css(INK, 0.85); ctx.lineWidth = 1.6; ctx.stroke(p);
  if (disc) { ctx.strokeStyle = css(BONE, 0.8, -18); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, fy, 25, 23, 0, 0, TAU); ctx.stroke(); }
  fresco(ctx, R, motif, cx, fy, fr);
}

function bakeShells(ctx: Ctx, R: R01, w: number, by: number): void {
  for (let i = 0; i < 26; i++) {
    const u = R() - 0.5, x = w / 2 + u * w * 0.8, y = by - 2 - (1 - Math.abs(u) * 2) * 9 * R();
    shell(ctx, R, x, y, 1.8 + R() * 2.2, (R() - 0.5) * 2, SHELLS[Math.floor(R() * SHELLS.length)]);
  }
}

/** a shaft of pale light from above, widening down to a pool on the floor */
function bakeShaft(m: Mood, H: number, res: number): Sprite {
  res = Math.min(res, 0.4);
  const w = 520, h = H, c = makeCanvas(w * res, h * res), ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  const cx = w / 2, by = h - 10, light = { h: (m.sky.h + 45) / 2, s: 40, l: 88 };
  const g = ctx.createLinearGradient(0, 0, 0, by);
  g.addColorStop(0, css(light, 0)); g.addColorStop(0.35, css(light, 0.1)); g.addColorStop(1, css(light, 0.2));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(cx - 70, 0); ctx.lineTo(cx + 40, 0); ctx.lineTo(cx + 200, by); ctx.lineTo(cx - 170, by); ctx.closePath(); ctx.fill();
  const pool = ctx.createRadialGradient(cx + 15, by, 0, cx + 15, by, 220);
  pool.addColorStop(0, css(light, 0.22)); pool.addColorStop(1, css(light, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(0, by - 60, w, 70);
  return { canvas: c, ax: cx, ay: by, res };
}

/** image size and foot of each piece */
const SIZE: Record<BonePart, (d: Decor) => [number, number]> = {
  skull: () => [360, 130], jaw: () => [330, 44], spine: () => [230, 60], rib: (d) => d.k === 2 ? [150, 30] : [110, d.h + 26],
  flipper: () => [140, 30], scapula: () => [140, 170], disc: () => [100, 90], shells: () => [70, 26], shaft: () => [0, 0]
};

export function bakeBone(d: Decor, m: Mood, fog: number, fogCol: HSL, res: number): Sprite {
  const part = (d.part || 'shells') as BonePart;
  if (part === 'shaft') return bakeShaft(m, d.h, res);
  // the long bones follow the floor under them (their foot is the floor under their middle)
  const long = part === 'spine' || part === 'jaw', pad = long ? 50 : 0;
  const R = rng(d.seed), [w, h0] = SIZE[part](d), h = h0 + pad, c = makeCanvas(w * res, h * res), ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  const by = h - 6 - pad / 2, k = d.k || 0, f0 = floorAt(d.x, d.z);
  const fl = (x: number) => clamp(floorAt(d.x + x - w / 2, d.z) - f0, -pad / 2, pad / 2);
  if (part === 'skull') bakeSkull(ctx, R, w, by);
  else if (part === 'jaw') bakeJaw(ctx, R, w, by, k === 1, fl);
  else if (part === 'spine') bakeSpine(ctx, R, w, by, k, fl);
  else if (part === 'rib') bakeRib(ctx, R, w, by, d.h, k);
  else if (part === 'flipper') bakeFlipper(ctx, R, w, by);
  else if (part === 'scapula') bakeSlab(ctx, R, w, by, 'spirale', false);
  else if (part === 'disc') bakeSlab(ctx, R, w, by, 'rayons', true);
  else bakeShells(ctx, R, w, by);
  tint(ctx, c, clamp(fog, 0, 0.9), fogCol);
  return { canvas: c, ax: part === 'rib' && k !== 2 ? w * 0.62 : w / 2, ay: by, res };
}
