// What stands where in the big world: rocks, plants and the set pieces
// (black smokers, a whale fall, a wreck), baked into small images like in
// the 2.5D prototype, so a frame costs little whatever the biome.

import { TAU, clamp, noise1, rng, seedOf, spec, type Spec } from '../engine';
import { Creature3, settle3 } from '../engine3/creature3';
import { css, type HSL, type Mood } from './palette';
import { plantSpec } from './plants';
import { makeCanvas, type Plant, type Rock, type Sprite } from './sprites';
import { BIOMES, X0, X1, biomeIndex, chapterIndex, floorAt, presence, span, type ChapterId } from './biomes';

type R01 = () => number;
const pick = <T>(R: R01, l: T[]): T => l[Math.floor(R() * l.length)];

/** one of weighted kinds */
function weighted(R: R01, l: [string, number][]): string {
  let s = 0;
  for (const [, w] of l) s += w;
  let u = R() * s;
  for (const [k, w] of l) { u -= w; if (u <= 0) return k; }
  return l[l.length - 1][0];
}

/** the biome that owns x, drawn by chance near a border (so biomes mingle instead of stopping at a line) */
function ownerAt(x: number, R: R01): number {
  const i = biomeIndex(x);
  for (const j of [i - 1, i + 1]) {
    if (j < 0 || j >= BIOMES.length) continue;
    const p = presence(x, j);
    if (p > 0 && R() < p * 0.8) return j;
  }
  return i;
}

// ----- plants that only live in this world ----- //

/** the kinds of the 2.5D prototype, plus sponges, sea lilies and the giant tube worms of the vents */
export function plantSpec2(kind: string, R: R01, biome: ChapterId): Spec {
  const r = (a: number, c: number) => a + R() * (c - a);
  const ri = (a: number, c: number) => Math.floor(r(a, c + 1));
  const deep = !!BIOMES[chapterIndex(biome)].pale;
  switch (kind) {
    case 'eponge':
      return spec({ name: 'Éponge', eyes: { on: false },
        palette: deep ? { hue: r(30, 60), harmony: 'mono', sat: r(8, 20), light: r(70, 82) } : { hue: pick(R, [28, 45, 280, 300, 12]), harmony: 'analog', sat: r(55, 80), light: r(48, 60) },
        body: { name: 'Pied', links: 1, len: 2, width: 3, shape: 'constant', style: 'ribbon', flex: 0.02, spring: 0.9, color: { slot: 0, light: -10 },
          attach: [{ node: { name: 'Tube', links: ri(3, 5), len: r(5, 8), width: r(2.4, 3.6), shape: deep ? 'bell' : 'constant', style: 'ribbon', flex: 0.02, spring: 0.9,
            color: { slot: 0, grad: 14, alpha: deep ? 0.8 : 1, pattern: 'spots', pslot: 3, plight: -18, pdensity: 9, pscale: 0.5 } },
            pattern: 'fan', at: 1, count: ri(2, 5), spread: 0.7, angle: 0, jitter: 0.7, scaleTo: 0.7 }] } });
    case 'crinoide':
      return spec({ name: 'Crinoïde', eyes: { on: false },
        palette: { hue: deep ? pick(R, [0, 330, 40]) : pick(R, [45, 20, 300]), harmony: 'analog', sat: r(55, 80), light: r(50, 62) },
        body: { name: 'Tige', links: ri(6, 10), len: 6, width: 0.9, shape: 'constant', style: 'plates', flex: 0.2, spring: 0.25, drag: 0.72, gravity: -0.02,
          color: { slot: 0, light: -8 },
          attach: [{ node: { name: 'Bras', links: 6, len: 4.5, width: 0.9, shape: 'linear', style: 'ribbon', flex: 0.4, spring: 0.08, curl: 0.5, drag: 0.72, color: { slot: 1, glow: deep ? 'tip' : 'none' },
            attach: [{ node: { name: 'Pinnule', links: 2, len: 2, width: 0.35, shape: 'linear', style: 'line', flex: 0.3, spring: 0.2, color: { slot: 1, light: 10 } },
              pattern: 'series', at: 0.15, to: 1, count: 6, angle: 1.2, alternate: true }] },
            pattern: 'fan', at: 1, count: ri(6, 10), spread: 2.6, angle: 0, jitter: 0.3, phaseStep: 0.5 }] } });
    case 'riftia':
      return spec({ name: 'Riftia', eyes: { on: false }, palette: { hue: r(352, 362) % 360, harmony: 'mono', sat: 85, light: 48 },
        body: { name: 'Souche', links: 1, len: 1, width: 0.5, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 0, light: 40 },
          attach: [{ node: { name: 'Tube', links: ri(6, 9), len: 7, width: 1.5, shape: 'constant', style: 'plates', flex: 0.08, spring: 0.4, drag: 0.72,
            color: { slot: 0, shift: 40, light: 38, grad: -8, alpha: 1 },
            attach: [{ node: { name: 'Panache', links: 3, len: 3.6, width: 2.4, shape: 'bulb', style: 'ribbon', flex: 0.25, spring: 0.2, color: { slot: 0, light: 4 } },
              pattern: 'single', at: 1, angle: 0 }] },
            pattern: 'fan', at: 1, count: ri(5, 9), spread: 0.9, angle: 0, jitter: 0.7, phaseStep: 0.9 }] } });
    default: {
      const sp = plantSpec(kind, R);
      // in the deep the plants lose their colour and glow a little
      if (deep && kind !== 'anemone') { sp.palette.sat *= 0.6; sp.palette.light = Math.min(70, sp.palette.light + 6); }
      return sp;
    }
  }
}

/** build the plant's whip the first time it comes near */
export function growPlant2(p: Plant): Creature3 {
  const R = rng(p.seed), kind = p.kind, hanging = kind === 'sargasse';
  const biome = BIOMES[biomeIndex(p.x)].id;
  const y = hanging ? 3 + R() * 4 : floorAt(p.x, p.z) + 3;
  const upright = kind === 'kelp' || kind === 'posidonie' || kind === 'crinoide' || kind === 'riftia' || hanging;
  const tilt = upright ? (R() - 0.5) * 0.1 : (R() - 0.5) * 0.35;
  const scale = kind === 'kelp' ? (biome === 'foret' ? 1.3 + R() * 0.8 : 0.9 + R() * 0.5) : kind === 'crinoide' ? 1 + R() * 0.6 : 0.8 + R() * 0.45;
  const sp = plantSpec2(kind, R, biome);
  const az = R() * Math.PI, ca = Math.cos(az), sa = Math.sin(az);
  const dv = hanging ? { x: Math.sin(tilt) * ca, y: Math.cos(tilt), z: Math.sin(tilt) * sa } : { x: Math.sin(tilt) * ca, y: -Math.cos(tilt), z: Math.sin(tilt) * sa };
  const cr = new Creature3(sp, p.x, y, p.z, { anchor: { dir: dv, plane: az }, phase: R() * TAU, scale });
  if (kind === 'anemone') for (const sg of cr.list) sg.def.motion.amp *= 0.3;
  settle3(cr, kind === 'kelp' || hanging ? 70 : 40);
  p.cr = cr;
  return cr;
}

// ----- placement ----- //

export interface RockX extends Rock { encrust: number; }

export function makeRocks(): RockX[] {
  const R = rng(77), out: RockX[] = [];
  for (let x = X0; x < X1;) {
    const b = BIOMES[ownerAt(x, R)];
    const z = -60 + R() * 1500;
    let r = b.rocks.r[0] + R() * (b.rocks.r[1] - b.rocks.r[0]);
    if (R() < 0.15 + b.encrust * 0.2) r *= 1.9;
    if (z < 30) r = Math.min(r, 16); // nothing big between the eye and the swimmer
    const seed = seedOf(Math.round(x), Math.round(z));
    out.push({ x, z, r, seed, sprite: null, spriteD: 0, encrust: b.encrust });
    if (b.encrust > 0.5 && R() < 0.5) out.push({ x: x + 30, z: z + 40, r: r * 0.7, seed: seed + 7, sprite: null, spriteD: 0, encrust: b.encrust });
    x += b.rocks.every * (0.5 + R());
  }
  return out;
}

/** rigid kinds never move with the water: always baked, even in the swimming plane (a live plant costs its paths every frame) */
const RIGID = new Set(['riftia', 'coral', 'fan', 'eponge', 'tubes']);
const newPlant = (kind: string, x: number, z: number): Plant =>
  ({ x, z, kind, seed: seedOf(Math.round(x), Math.round(z)), cr: null, sprite: null, spriteD: 0, live: Math.abs(z) < 60 && !RIGID.has(kind) });

export function makePlants(vents: Decor[]): Plant[] {
  const R = rng(41), out: Plant[] = [];
  for (let x = X0; x < X1;) {
    const b = BIOMES[ownerAt(x, R)];
    const z = -40 + R() * 1300;
    let kind = weighted(R, b.flora.kinds);
    if (kind === 'kelp' && z < 40) kind = 'posidonie';
    // the kelp grows in groves, the grass in meadows
    const grove = noise1(x / 600 + 3, 51);
    if (kind === 'kelp' && b.id !== 'foret' && grove < 0.55) kind = 'posidonie';
    if (!(kind === 'posidonie' && b.id === 'nurserie' && noise1(x / 520, 11) < 0.38)) out.push(newPlant(kind, x, z));
    x += b.flora.every * (0.5 + R());
  }
  // the band just in front of the swimmer frames the view
  for (let x = X0; x < X1;) {
    const b = BIOMES[ownerAt(x, R)];
    const z = -110 + R() * 90;
    if (R() < 0.75) out.push(newPlant(weighted(R, b.flora.front), x, z));
    x += (20 + R() * 40) * (b.flora.every / 24);
  }
  // sargassum hanging from the surface over the Nurserie and the Récif
  for (let x = X0; x < span('recif')[1]; x += 18 + R() * 26) {
    const raft = noise1(x / 700, 21) - 0.45 + (x < 1600 ? 0.35 : 0);
    if (raft > 0 && R() < raft * 1.6) out.push(newPlant('sargasse', x, -40 + R() * 700));
  }
  // giant tube worms in bouquets at the foot of every chimney
  for (const v of vents) {
    for (let k = 0; k < 14; k++) {
      const a = R() * TAU, d = 30 + R() * 70;
      out.push(newPlant('riftia', v.x + Math.cos(a) * d, v.z + Math.sin(a) * d * 0.6));
    }
  }
  return out;
}

// ----- set pieces ----- //

export interface Decor { kind: 'vent' | 'whale' | 'wreck' | 'seep'; x: number; z: number; seed: number; h: number; sprite: Sprite | null; spriteD: number; }

export function makeDecor(): Decor[] {
  const out: Decor[] = [];
  const add = (kind: Decor['kind'], x: number, z: number, h = 0) => out.push({ kind, x, z, seed: seedOf(Math.round(x), Math.round(z)), h, sprite: null, spriteD: 0 });
  /** a place along a chapter, from its start (0) to its end (1) */
  const at = (id: ChapterId, u: number) => { const [a, b] = span(id); return Math.round(a + (b - a) * u); };
  // black smokers: a field of chimneys at several depths, in the Sources
  const R = rng(2024);
  for (const [u, z] of [[0.18, 90], [0.28, 420], [0.4, 160], [0.52, 700], [0.64, 60], [0.74, 300], [0.84, 900]] as const) add('vent', at('sources', u), z, 180 + R() * 180);
  add('whale', at('carcasse', 0.5), 150);
  // a wreck in the kelp
  add('wreck', at('foret', 0.62), 330);
  // seeps: streams of bubbles from the sand, warm in the shallows, brine under the Glacier
  for (const [id, u, z] of [['nurserie', 0.49, 60], ['nurserie', 0.81, 240], ['recif', 0.4, 140], ['recif', 0.8, 30],
    ['foret', 0.3, 50], ['foret', 0.85, 260], ['glacier', 0.3, 80], ['glacier', 0.55, 200], ['glacier', 0.75, 40]] as const) add('seep', at(id, u), z);
  return out;
}

/** pull a baked image toward the water colour */
function tint(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, fog: number, col: HSL): void {
  if (fog <= 0.01) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = css(col, fog);
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-over';
}

/** a black smoker: a lumpy basalt chimney, sulphur crusts, a hot orange mouth */
function bakeVent(d: Decor, m: Mood, fog: number, fogCol: HSL, res: number): Sprite {
  const R = rng(d.seed), H = d.h, W = 90;
  const w = W * 2, h = H + 30, c = makeCanvas(w * res, h * res), ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  const cx = w / 2, by = h - 6;
  const path = new Path2D();
  const N = 22, left: [number, number][] = [], right: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, half = (W * 0.5) * (1 - u * 0.78) * (1 + (noise1(u * 7 + d.seed, 3) - 0.5) * 0.5), y = by - u * H;
    const lean = Math.sin(u * 2.2 + d.seed) * 8 * u;
    left.push([cx - half + lean, y]); right.push([cx + half + lean, y]);
  }
  path.moveTo(left[0][0], by + 4);
  for (const [x, y] of left) path.lineTo(x, y);
  for (let i = right.length - 1; i >= 0; i--) path.lineTo(right[i][0], right[i][1]);
  path.lineTo(right[0][0], by + 4);
  path.closePath();
  const g = ctx.createLinearGradient(cx - W / 2, 0, cx + W / 2, 0);
  g.addColorStop(0, css(m.rock, 1, 6));
  g.addColorStop(0.6, css(m.rock, 1, -2));
  g.addColorStop(1, css(m.rock, 1, -8));
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  // stacked crusts
  for (let i = 0; i < 26; i++) {
    const u = R(), y = by - u * H, x = cx + (R() - 0.5) * W * (1 - u * 0.7);
    ctx.fillStyle = R() < 0.5 ? css(m.accents[0], 0.35, -10) : css(m.accents[1], 0.3);
    ctx.beginPath(); ctx.ellipse(x, y, 4 + R() * 10, 2 + R() * 4, 0, 0, TAU); ctx.fill();
  }
  // hot cracks
  ctx.strokeStyle = 'rgba(255,140,40,0.7)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) {
    let x = cx + (R() - 0.5) * 20, y = by - H * (0.55 + R() * 0.4);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += (R() - 0.5) * 10; y += 6 + R() * 10; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = css({ h: m.rock.h, s: m.rock.s, l: 5 }, 0.9);
  ctx.stroke(path);
  // the mouth
  const [tx, ty] = [(left[N][0] + right[N][0]) / 2, left[N][1]];
  ctx.fillStyle = 'rgba(255,170,60,0.95)';
  ctx.beginPath(); ctx.ellipse(tx, ty + 1, (right[N][0] - left[N][0]) / 2, 3, 0, 0, TAU); ctx.fill();
  tint(ctx, c, fog, fogCol);
  return { canvas: c, ax: cx, ay: by, res };
}

/** where the smoke comes out, relative to the foot */
export function ventMouth(d: Decor): number { return -d.h + 6; }

/** a whale fall: a skull, the spine, the ribs, and the white mats that feed on them */
function bakeWhale(d: Decor, m: Mood, fog: number, fogCol: HSL, res: number): Sprite {
  const R = rng(d.seed), L = 460, w = L + 60, h = 150;
  const c = makeCanvas(w * res, h * res), ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  const by = h - 10, x0 = 30;
  const bone = { h: 42, s: 25, l: 78 }, ink = css({ h: 30, s: 20, l: 10 }, 0.85);
  const spineY = (u: number) => by - 18 - Math.sin(u * Math.PI) * 10 + u * 4;
  // mats under the bones
  for (let i = 0; i < 40; i++) {
    const u = R(), x = x0 + u * L;
    ctx.fillStyle = R() < 0.6 ? css(m.accents[1], 0.5) : css(m.accents[0], 0.45);
    ctx.beginPath(); ctx.ellipse(x, by - 2 + R() * 4, 6 + R() * 16, 2 + R() * 3, 0, 0, TAU); ctx.fill();
  }
  ctx.lineCap = 'round';
  // ribs: arcs rising from the spine, broken here and there
  for (let k = 0; k < 13; k++) {
    const u = 0.22 + k * 0.04, x = x0 + u * L, y = spineY(u), len = 70 * Math.sin(Math.PI * (0.15 + (k / 13) * 0.8)) * (R() < 0.2 ? 0.55 : 1);
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 24, y - len * 0.7, x - 6 + (R() - 0.5) * 12, y - len);
    ctx.strokeStyle = ink; ctx.lineWidth = 6.5; ctx.stroke();
    ctx.strokeStyle = css(bone, 1, -6 + R() * 8); ctx.lineWidth = 4.2; ctx.stroke();
  }
  // vertebrae
  for (let k = 0; k < 34; k++) {
    const u = 0.17 + (k / 34) * 0.8, x = x0 + u * L, y = spineY(u), s = 7 * (1 - u * 0.6) + 2;
    ctx.fillStyle = css(bone, 1, (k % 2) * 4);
    ctx.strokeStyle = ink; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.roundRect(x - s * 0.6, y - s, s * 1.2, s * 1.7, 2); ctx.fill(); ctx.stroke();
    // spinous process
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x - 3, y - s - 6 * (1 - u)); ctx.stroke();
  }
  // skull and jaw
  const sx = x0 + 10, sy = by - 8;
  ctx.fillStyle = css(bone, 1, 2);
  ctx.beginPath();
  ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 20, sy - 44, sx + 80, sy - 40); ctx.quadraticCurveTo(sx + 100, sy - 30, sx + 92, sy - 8); ctx.closePath();
  ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = 'rgba(20,14,10,0.7)';
  ctx.beginPath(); ctx.ellipse(sx + 66, sy - 24, 7, 5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(sx - 4, sy + 2); ctx.quadraticCurveTo(sx + 40, sy - 6, sx + 104, sy + 2);
  ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = css(bone, 1, -4); ctx.lineWidth = 4; ctx.stroke();
  // bone-eating worms: a fuzz of red
  for (let i = 0; i < 70; i++) {
    const u = 0.15 + R() * 0.8, x = x0 + u * L + (R() - 0.5) * 8, y = spineY(u) - R() * 8;
    ctx.fillStyle = css({ h: 355, s: 80, l: 50 }, 0.8);
    ctx.fillRect(x, y, 1.2, 1.2 + R() * 2);
  }
  tint(ctx, c, fog, fogCol);
  return { canvas: c, ax: x0 + L / 2, ay: by, res };
}

/** an old wooden hull on its side, broken open, grown over */
function bakeWreck(d: Decor, m: Mood, fog: number, fogCol: HSL, res: number): Sprite {
  const R = rng(d.seed), L = 520, w = L + 80, h = 260;
  const c = makeCanvas(w * res, h * res), ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  const by = h - 8, x0 = 40;
  const wood = { h: 26, s: 30, l: 34 }, ink = css({ h: 25, s: 30, l: 8 }, 0.9);
  ctx.save();
  ctx.translate(x0 + L / 2, by); ctx.rotate(-0.07); ctx.translate(-L / 2, 0);
  const hull = new Path2D();
  hull.moveTo(0, -10);
  hull.quadraticCurveTo(40, -120, 140, -130);
  hull.lineTo(L * 0.72, -130);
  // the broken end: a jagged line
  let y = -130;
  for (let k = 0; k < 8; k++) { y += 16; hull.lineTo(L * 0.72 + (k % 2 ? 22 : -4) + R() * 14, y); }
  hull.lineTo(L * 0.6, 4);
  hull.quadraticCurveTo(L * 0.3, 16, 0, -10);
  hull.closePath();
  const g = ctx.createLinearGradient(0, -130, 0, 10);
  g.addColorStop(0, css(wood, 1, 6)); g.addColorStop(1, css(wood, 1, -12));
  ctx.fillStyle = g; ctx.fill(hull);
  ctx.save(); ctx.clip(hull);
  // planks
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
  for (let k = 0; k < 11; k++) { ctx.beginPath(); ctx.moveTo(0, -120 + k * 12); ctx.quadraticCurveTo(L * 0.4, -118 + k * 13, L, -120 + k * 12); ctx.stroke(); }
  // portholes
  for (let k = 0; k < 5; k++) {
    ctx.fillStyle = 'rgba(8,14,20,0.85)'; ctx.beginPath(); ctx.arc(150 + k * 50, -86, 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = css({ h: 40, s: 40, l: 45 }, 0.8); ctx.lineWidth = 2; ctx.stroke();
  }
  // crusts
  for (let i = 0; i < 90; i++) {
    const x = R() * L * 0.75, yy = -130 + R() * 140, col = pick(R, m.accents);
    ctx.fillStyle = css(col, 0.55, -6); ctx.beginPath(); ctx.ellipse(x, yy, 2 + R() * 7, 1.5 + R() * 3, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.stroke(hull);
  // exposed ribs at the broken end
  ctx.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const x = L * 0.74 + k * 22;
    ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.quadraticCurveTo(x + 10, -60, x - 4, -110 + k * 16 + R() * 20);
    ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = css(wood, 1, -2); ctx.lineWidth = 4; ctx.stroke();
  }
  // the broken mast
  ctx.beginPath(); ctx.moveTo(220, -128); ctx.lineTo(300, -236);
  ctx.strokeStyle = ink; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = css(wood, 1, 4); ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(262, -184); ctx.lineTo(210, -196); ctx.strokeStyle = css(wood, 1, 0); ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  tint(ctx, c, fog, fogCol);
  return { canvas: c, ax: x0 + L / 2, ay: by, res };
}

export function bakeDecor(d: Decor, m: Mood, fog: number, fogCol: HSL, res: number): Sprite | null {
  res = clamp(res, 0.2, 2.5);
  if (d.kind === 'vent') return bakeVent(d, m, fog, fogCol, res);
  if (d.kind === 'whale') return bakeWhale(d, m, fog, fogCol, res);
  if (d.kind === 'wreck') return bakeWreck(d, m, fog, fogCol, res);
  return null;
}

// ----- particles: smoke from the chimneys, bubbles from the seeps ----- //

export class Puffs {
  n: number; x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; r: Float32Array; life: Float32Array;
  private k = 0;
  constructor(n: number) {
    this.n = n;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.r = new Float32Array(n); this.life = new Float32Array(n);
  }
  emit(x: number, y: number, vx: number, vy: number, r: number): void {
    const i = this.k++ % this.n;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.r[i] = r; this.life[i] = 1;
  }
  /** smoke spreads and slows; bubbles grow a little and wobble */
  step(t: number, kind: 'smoke' | 'bubble', decay: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= decay;
      if (kind === 'smoke') { this.vx[i] *= 0.99; this.vy[i] *= 0.995; this.r[i] += 0.12; }
      else { this.vx[i] = Math.sin(t * 3 + i) * 0.25; this.r[i] += 0.004; if (this.y[i] < 4) this.life[i] = 0; }
      this.x[i] += this.vx[i]; this.y[i] += this.vy[i];
    }
  }
}
