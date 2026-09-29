// The world of the 2.5D prototype: a sea floor with depth, rocks and plants
// set at many depths, all baked once into small images (with their fog), so
// that a frame costs about what the 2D version costs.

import { TAU, clamp, noise1, rng, seedOf, type Spec } from '../engine';
import { Creature3, settle3 } from '../engine3/creature3';
import { draw3 } from '../engine3/render3';
import { Ortho } from '../engine3/view';
import { css, fogged, moodAt, waterAt, type HSL, type Mood } from '../game/palette';
import { plantSpec } from '../game/plants';
import { floorY as floor2D, reefness } from '../game/terrain';
import { makeCanvas } from '../game/bake';

const smooth = (t: number) => t * t * (3 - 2 * t);

/** depth of the floor (y down) at x and at depth z */
export function floorAt(x: number, z: number): number {
  const back = smooth(clamp((z - 250) / 700, 0, 1)) * (180 + 240 * noise1(x / 520 + z / 400, 77));
  const front = z < 0 ? -z * 0.12 : 0;
  const ripple = (noise1(x / 170 + z / 90, 78) - 0.5) * 30 * clamp(z / 400, 0, 1);
  return floor2D(x) + front - back + ripple;
}

/** how much the water hides something at view depth d (the swimming plane is at `plane`) */
export function fogOf(d: number, plane: number): number {
  return clamp(1 - Math.exp(-Math.max(0, d - plane * 0.9) / 1700), 0, 0.88);
}

// ----- baked sprites ----- //

export interface Sprite { canvas: HTMLCanvasElement; ax: number; ay: number; res: number; }

/** a lumpy rock with a lit rim, speckles, and life on top */
export function bakeRock(r: number, seed: number, m: Mood, reef: number, fog: number, fogCol: HSL, res: number): Sprite {
  const R = rng(seed), w = r * 2.4, h = r * 1.6;
  const c = makeCanvas(w * res, h * res), ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  const cx = w / 2, by = h - 4;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 36; i++) {
    const a = Math.PI + (i / 36) * Math.PI, k = 1 + (noise1(i * 0.45 + seed, 9) - 0.5) * 0.35;
    pts.push([cx + Math.cos(a) * r * 1.1 * k, by + Math.sin(a) * r * 1.2 * k]);
  }
  const path = new Path2D();
  path.moveTo(pts[0][0], by + 3);
  for (const [x, y] of pts) path.lineTo(x, y);
  path.lineTo(pts[pts.length - 1][0], by + 3);
  path.closePath();
  ctx.fillStyle = css(m.rock, 1, 24);
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.translate(0, 4);
  const g = ctx.createLinearGradient(0, by - r * 1.2, 0, by);
  g.addColorStop(0, css(m.rock, 1, 14));
  g.addColorStop(1, css(m.rock, 1, -10));
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.translate(0, -4);
  for (let i = 0; i < r * 3; i++) {
    ctx.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
    ctx.fillRect(cx + (R() - 0.5) * r * 2.2, by - R() * r * 1.2, 1.3, 1.3);
  }
  ctx.restore();
  // ink
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = css({ h: m.rock.h, s: m.rock.s, l: 14 }, 0.8);
  ctx.stroke(path);
  // what grows on top
  const top = pts.filter(([, y]) => y < by - r * 0.55);
  if (reef > 0.5) {
    ctx.strokeStyle = css(m.accents[0], 0.9, -4);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 1.5) : ctx.moveTo(x, y + 1.5)));
    ctx.stroke();
    for (const [x, y] of top) {
      if (R() > 0.35) continue;
      const col = m.accents[Math.floor(R() * m.accents.length)], s = 3 + R() * 6;
      ctx.fillStyle = css(col, 1, R() * 10);
      ctx.beginPath(); ctx.ellipse(x, y + 1, s, s * 0.65, 0, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = css(col, 0.6, -25); ctx.lineWidth = 0.6; ctx.stroke();
    }
  } else {
    ctx.strokeStyle = css(m.accents[0], 0.85);
    ctx.lineWidth = 0.9;
    for (const [x, y] of top) for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 1.2, l = 2 + R() * 5;
      ctx.beginPath(); ctx.moveTo(x + R() * 3, y + 1.5); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
  }
  tint(ctx, c, fog, fogCol);
  return { canvas: c, ax: cx, ay: by, res };
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

/** a 3D creature drawn flat into a small image at `res` px per unit (no perspective) */
export function bakeCreature(cr: Creature3, fog: number, fogCol: HSL, res: number, into?: HTMLCanvasElement): Sprite {
  const b = cr.box, pad = 5;
  const w = b[3] - b[0] + pad * 2, h = b[4] - b[1] + pad * 2;
  res = Math.min(res, 900 / Math.max(w, h));
  const c = into || makeCanvas(w * res, h * res);
  if (into) { into.width = Math.max(1, Math.ceil(w * res)); into.height = Math.max(1, Math.ceil(h * res)); }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  draw3(ctx, cr, new Ortho(res, (-b[0] + pad) * res, (-b[1] + pad) * res), { ink: true });
  tint(ctx, c, fog, fogCol);
  return { canvas: c, ax: cr.root.x[0] - b[0] + pad, ay: cr.root.y[0] - b[1] + pad, res };
}

// ----- what stands where ----- //

export interface Rock { x: number; z: number; r: number; seed: number; sprite: Sprite | null; spriteD: number; }
export interface Plant { x: number; z: number; kind: string; seed: number; cr: Creature3 | null; sprite: Sprite | null; spriteD: number; live: boolean; }

export const X0 = -800, X1 = 12000;

export function makeRocks(): Rock[] {
  const R = rng(77), out: Rock[] = [];
  for (let x = X0; x < X1; x += 60 + R() * 140) {
    const reef = reefness(x);
    const z = -60 + R() * 1500;
    let r = (14 + R() * 30) * (1 + reef * 1.2) * (R() < 0.15 + reef * 0.25 ? 1.9 : 1);
    if (z < 30) r = Math.min(r, 16); // nothing big between the eye and the swimmer
    out.push({ x, z, r, seed: seedOf(Math.round(x), Math.round(z)), sprite: null, spriteD: 0 });
    if (reef > 0.5 && R() < 0.5) out.push({ x: x + 30, z: z + 40, r: r * 0.7, seed: seedOf(Math.round(x) + 7, 3), sprite: null, spriteD: 0 });
  }
  return out;
}

/** build the plant's whip the first time it comes near */
export function growPlant(p: Plant): Creature3 {
  const R = rng(p.seed), kind = p.kind, hanging = kind === 'sargasse';
  const y = hanging ? 3 + R() * 4 : floorAt(p.x, p.z) + 3;
  const tilt = kind === 'kelp' || kind === 'posidonie' || hanging ? 0 : (R() - 0.5) * 0.35;
  const scale = kind === 'kelp' ? 0.9 + R() * 0.5 : 0.8 + R() * 0.45;
  const sp: Spec = plantSpec(kind, R);
  // each plant lives in its own vertical plane, turned by a random azimuth
  const az = R() * Math.PI, ca = Math.cos(az), sa = Math.sin(az);
  const dv = { x: Math.sin(tilt) * ca, y: hanging ? 1 : -Math.cos(tilt), z: Math.sin(tilt) * sa };
  if (hanging) { dv.x = Math.sin(tilt) * ca; dv.z = Math.sin(tilt) * sa; dv.y = Math.cos(tilt); }
  const cr = new Creature3(sp, p.x, y, p.z, { anchor: { dir: dv, plane: az }, phase: R() * TAU, scale });
  if (kind === 'anemone') for (const sg of cr.list) sg.def.motion.amp *= 0.3;
  settle3(cr, kind === 'kelp' || hanging ? 300 : 140);
  p.cr = cr;
  return cr;
}

export function makePlants(): Plant[] {
  const R = rng(41), out: Plant[] = [];
  const add = (kind: string, x: number, z: number) => {
    out.push({ x, z, kind, seed: seedOf(Math.round(x), Math.round(z)), cr: null, sprite: null, spriteD: 0, live: Math.abs(z) < 60 });
  };
  for (let x = X0; x < X1; x += 14 + R() * 26) {
    const z = -40 + R() * 1300, reef = reefness(x), k = R();
    if (reef < 0.5) {
      const meadow = noise1(x / 520, 11) - 0.4;
      if (noise1(x / 700 + 3, 51) > 0.55 && k < 0.35 && z > 40) add('kelp', x, z);
      else if (meadow > 0 && k < 0.5 + meadow) add('posidonie', x, z);
      else if (k < 0.05) add('anemone', x, z);
    } else {
      if (k < 0.3) add('coral', x, z);
      else if (k < 0.44) add('fan', x, z);
      else if (k < 0.58) add('softcoral', x, z);
      else if (k < 0.68) add('anemone', x, z);
      else if (k < 0.76) add('tubes', x, z);
      else if (k < 0.8 && z > 40) add('kelp', x, z);
    }
  }
  // the floor just in front of the swimmer: a band of life that frames the view
  for (let x = X0; x < X1; x += 20 + R() * 40) {
    const z = -110 + R() * 90, reef = reefness(x), k = R();
    if (reef > 0.5) {
      if (k < 0.3) add('coral', x, z);
      else if (k < 0.45) add('softcoral', x, z);
      else if (k < 0.55) add('fan', x, z);
      else if (k < 0.62) add('anemone', x, z);
      else if (k < 0.68) add('tubes', x, z);
    } else if (noise1(x / 520, 11) - 0.4 > 0 && k < 0.6) add('posidonie', x, z);
  }
  // sargassum hanging from the surface over the Nurserie
  for (let x = X0; x < 7000; x += 18 + R() * 26) {
    const raft = noise1(x / 700, 21) - 0.45 + (x < 1600 ? 0.35 : 0);
    if (raft > 0 && R() < raft * 1.6) add('sargasse', x, -40 + R() * 700);
  }
  return out;
}

export { css, fogged, moodAt, waterAt, type Creature3 };
