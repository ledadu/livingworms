// Ambient life: fish schools (boids drawn as sprites), plankton, the swarm of
// siblings, large animals passing far away, and a few whip animals that
// wander. Nothing here is dangerous.

import { Creature, STEP, TAU, clamp, draw, noise1, rand, swimFactor, type Spec } from '../engine';
import { SPECIES } from '../content';
import { fishSprites, makeCanvas } from './bake';
import { css, moodAt, type HSL } from './palette';
import { collide, floorY } from './terrain';

export interface Player { x: number; y: number; vx: number; vy: number; }

// ----- schools ----- //

export class School {
  n: number;
  x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; ph: Float32Array;
  cx: number; cy: number;
  /** wander target of the whole school */
  tx: number; ty: number;
  home: number; band: [number, number];
  sprites: HTMLCanvasElement[];
  size: number; speed: number;
  /** parallax: 1 in the play plane, < 1 far away */
  p: number;
  seed: number;
  private t = 0;

  constructor(home: number, band: [number, number], n: number, body: HSL, belly: HSL, o: { size?: number; speed?: number; p?: number; seed?: number } = {}) {
    this.n = n;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.ph = new Float32Array(n);
    this.home = home; this.band = band;
    this.size = o.size || 1; this.speed = o.speed || 1.6; this.p = o.p || 1; this.seed = o.seed || 1;
    const y0 = (band[0] + band[1]) / 2;
    this.cx = this.tx = home; this.cy = this.ty = y0;
    for (let i = 0; i < n; i++) {
      this.x[i] = home + rand(-60, 60); this.y[i] = y0 + rand(-30, 30);
      this.vx[i] = rand(-1, 1); this.vy[i] = rand(-0.3, 0.3); this.ph[i] = rand(0, TAU);
    }
    this.sprites = fishSprites(body, belly, 14 * this.size);
  }

  update(pl: Player | null, t: number): void {
    const n = this.n, X = this.x, Y = this.y, VX = this.vx, VY = this.vy;
    this.t += STEP;
    // the school's goal drifts around its home
    const w = noise1(t * 0.05 + this.seed, this.seed) - 0.5, v = noise1(t * 0.07 + this.seed * 3, this.seed + 1);
    this.tx = this.home + w * 900;
    this.ty = this.band[0] + v * (this.band[1] - this.band[0]);
    let cx = 0, cy = 0, ax = 0, ay = 0;
    for (let i = 0; i < n; i++) { cx += X[i]; cy += Y[i]; ax += VX[i]; ay += VY[i]; }
    cx /= n; cy /= n; ax /= n; ay /= n;
    this.cx = cx; this.cy = cy;
    const sp = this.speed, sep = 9 * this.size;
    for (let i = 0; i < n; i++) {
      let fx = (cx - X[i]) * 0.0022 + (ax - VX[i]) * 0.05 + (this.tx - cx) * 0.0006;
      let fy = (cy - Y[i]) * 0.0022 + (ay - VY[i]) * 0.05 + (this.ty - cy) * 0.0006;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dx = X[i] - X[j], dy = Y[i] - Y[j];
        if (dx > sep || dx < -sep || dy > sep || dy < -sep) continue;
        const d2 = dx * dx + dy * dy + 0.01;
        if (d2 < sep * sep) { fx += (dx / d2) * 1.2; fy += (dy / d2) * 1.2; }
      }
      if (pl) {
        // scatter around the swimmer, then close ranks behind it
        const dx = X[i] - pl.x, dy = Y[i] - pl.y, d2 = dx * dx + dy * dy;
        if (d2 < 110 * 110) { const d = Math.sqrt(d2) + 0.1, k = (1 - d / 110) * 0.9; fx += (dx / d) * k; fy += (dy / d) * k; }
      }
      // stay in the water
      const floor = floorY(X[i]) - 30;
      if (Y[i] > floor) fy -= (Y[i] - floor) * 0.02;
      if (Y[i] < 20) fy += (20 - Y[i]) * 0.02;
      let vx = VX[i] + fx, vy = VY[i] + fy;
      const m = Math.hypot(vx, vy), max = sp * (1 + 0.25 * Math.sin(this.ph[i] + this.t));
      if (m > max) { vx *= max / m; vy *= max / m; }
      else if (m < sp * 0.4) { vx *= (sp * 0.4) / (m || 1); vy *= (sp * 0.4) / (m || 1); }
      VX[i] = vx; VY[i] = vy * 0.96;
      X[i] += VX[i]; Y[i] += VY[i];
      this.ph[i] += 0.25 + m * 0.12;
    }
  }

  draw(ctx: CanvasRenderingContext2D, a: number, b: number, c: number, d: number, e: number, f: number, alpha = 1): void {
    // (a..f) is the world→screen transform of the plane
    const n = this.n, spr = this.sprites, sw = spr[0].width / 2, sh = spr[0].height / 2;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      const ang = Math.atan2(this.vy[i], this.vx[i]);
      const flip = Math.cos(ang) < 0 ? -1 : 1;
      const co = Math.cos(ang), si = Math.sin(ang);
      const sx = a * this.x[i] + c * this.y[i] + e, sy = b * this.x[i] + d * this.y[i] + f;
      // the fish stays upright: mirror vertically when it swims left
      ctx.setTransform(a * co * 0.5, a * si * 0.5, -a * si * 0.5 * flip, a * co * 0.5 * flip, sx, sy);
      const frame = spr[Math.floor(this.ph[i]) % 3 | 0];
      ctx.drawImage(frame, -sw, -sh);
    }
    ctx.globalAlpha = 1;
  }
}

// ----- plankton ----- //

export class Plankton {
  n: number; x: Float32Array; y: Float32Array; s: Float32Array; ph: Float32Array;
  /** parallax of this sheet of motes */
  p: number;
  constructor(n: number, p: number) {
    this.n = n; this.p = p;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.s = new Float32Array(n); this.ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.x[i] = Math.random(); this.y[i] = Math.random(); this.s[i] = 0.5 + Math.random() * 1.4; this.ph[i] = Math.random() * TAU; }
  }
  /** motes live in a box the size of the screen that scrolls with the plane */
  draw(ctx: CanvasRenderingContext2D, camx: number, camy: number, W: number, H: number, z: number, t: number, col: string, dpr: number): void {
    const p = this.p, ox = -camx * p * z, oy = -camy * p * z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < this.n; i++) {
      const drift = Math.sin(t * 0.3 + this.ph[i]) * 8;
      let sx = (this.x[i] * W + ox + drift) % W; if (sx < 0) sx += W;
      let sy = (this.y[i] * H + oy + t * 3 * this.s[i]) % H; if (sy < 0) sy += H;
      const r = this.s[i] * p * 0.9 * Math.min(1.6, z);
      ctx.moveTo(sx + r, sy);
      ctx.arc(sx, sy, r, 0, TAU);
    }
    ctx.fill();
  }
}

// ----- the siblings: a swarm of tiny glowing larvae ----- //

export class Swarm {
  n: number; x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; ph: Float32Array;
  hx: number; hy: number;
  constructor(n: number, hx: number, hy: number) {
    this.n = n; this.hx = hx; this.hy = hy;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.x[i] = hx + rand(-200, 200); this.y[i] = hy + rand(-60, 60); this.ph[i] = rand(0, TAU); }
  }
  update(pl: Player | null, t: number): void {
    for (let i = 0; i < this.n; i++) {
      const w = noise1(t * 0.4 + i * 3.1, 7) - 0.5, v = noise1(t * 0.4 + i * 5.7, 9) - 0.5;
      let fx = w * 0.08 + (this.hx - this.x[i]) * 0.0004, fy = v * 0.08 + (this.hy - this.y[i]) * 0.0006;
      if (pl) {
        // they gather loosely around the one who swims
        const dx = pl.x - this.x[i], dy = pl.y - this.y[i], d = Math.hypot(dx, dy) + 1;
        if (d < 300) { fx += (dx / d) * 0.012 * (d > 60 ? 1 : -1.5); fy += (dy / d) * 0.012 * (d > 60 ? 1 : -1.5); }
      }
      this.vx[i] = (this.vx[i] + fx) * 0.96; this.vy[i] = (this.vy[i] + fy) * 0.96;
      this.x[i] += this.vx[i]; this.y[i] += this.vy[i];
      if (this.y[i] < 8) this.y[i] = 8;
      this.ph[i] += 0.3;
    }
  }
  draw(ctx: CanvasRenderingContext2D, t: number): void {
    ctx.strokeStyle = 'rgba(255,240,200,0.6)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i < this.n; i++) {
      const x = this.x[i], y = this.y[i], a = Math.atan2(this.vy[i], this.vx[i]) + Math.PI, wig = Math.sin(this.ph[i]) * 0.6;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + wig) * 3, y + Math.sin(a + wig) * 3, x + Math.cos(a - wig) * 6, y + Math.sin(a - wig) * 6);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,248,225,0.95)';
    ctx.beginPath();
    for (let i = 0; i < this.n; i++) {
      const r = 1.3 + Math.sin(t * 2 + i) * 0.2;
      ctx.moveTo(this.x[i] + r, this.y[i]);
      ctx.arc(this.x[i], this.y[i], r, 0, TAU);
    }
    ctx.fill();
  }
}

// ----- visitors: a large animal crossing a distant plane ----- //

export class Visitor {
  cr: Creature; p: number; y: number; dir: number; speed: number;
  x: number; x0: number; x1: number;
  private buf: HTMLCanvasElement; private bctx: CanvasRenderingContext2D;
  constructor(sp: Spec, p: number, x0: number, x1: number, y: number, scale: number, speed: number) {
    this.p = p; this.y = y; this.x0 = x0; this.x1 = x1; this.dir = 1; this.speed = speed;
    this.x = x0;
    this.cr = new Creature(sp, x0, y, { dir: Math.PI, scale, profile: true });
    for (let t = 0; t < 120; t++) this.cr.update(t * STEP, speed, 0, 0.2);
    this.buf = makeCanvas(256, 256);
    this.bctx = this.buf.getContext('2d')!;
  }
  update(t: number): void {
    const r = this.cr.root;
    if (r.x[0] > this.x1) this.dir = -1; else if (r.x[0] < this.x0) this.dir = 1;
    const wob = Math.sin(t * 0.2) * 0.15;
    this.cr.update(t, this.dir * this.speed * swimFactor(this.cr, t), wob + (this.y - r.y[0]) * 0.01, 0.02);
    this.x = r.x[0];
  }
  /** drawn into a small buffer, washed with the water colour, then scaled up: soft and far */
  draw(ctx: CanvasRenderingContext2D, sx: number, sy: number, k: number, fog: HSL, alpha: number): void {
    const b = this.cr.box, w = b[2] - b[0] + 20, h = b[3] - b[1] + 20;
    const s = Math.min(1, 240 / Math.max(w, h)) * 0.6;
    const bw = Math.ceil(w * s), bh = Math.ceil(h * s);
    const c = this.bctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, bw + 2, bh + 2);
    c.setTransform(s, 0, 0, s, (-b[0] + 10) * s, (-b[1] + 10) * s);
    draw(c, this.cr);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = css(fog, 0.8);
    c.fillRect(0, 0, bw, bh);
    c.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.buf, 0, 0, bw, bh, sx + (b[0] - 10) * k, sy + (b[1] - 10) * k, bw / s * k, bh / s * k);
    ctx.globalAlpha = 1;
  }
}

// ----- wandering whip animals ----- //

export class Wanderer {
  cr: Creature; hx: number; hy: number; tx: number; ty: number; benthic: boolean;
  private next = 0;
  private hit = { x: 0, y: 0, hit: false };
  constructor(sp: Spec, x: number, y: number, benthic: boolean, scale = 1) {
    this.cr = new Creature(sp, x, y, { dir: rand(0, TAU), scale, profile: true });
    this.hx = this.tx = x; this.hy = this.ty = y; this.benthic = benthic;
  }
  update(t: number, pl: Player | null): void {
    const r = this.cr.root, x = r.x[0], y = r.y[0];
    if (t > this.next || Math.hypot(this.tx - x, this.ty - y) < 20) {
      this.next = t + rand(3, 7);
      this.tx = this.hx + rand(-260, 260);
      this.ty = this.benthic ? floorY(this.tx) - 12 : clamp(this.hy + rand(-120, 120), 30, floorY(this.tx) - 60);
    }
    let dx = this.tx - x, dy = this.ty - y;
    if (pl) {
      // curious but shy: keeps a little distance
      const px = x - pl.x, py = y - pl.y, d = Math.hypot(px, py);
      if (d < 70) { dx += (px / (d + 1)) * 200; dy += (py / (d + 1)) * 200; }
    }
    const d = Math.hypot(dx, dy) || 1, sp = this.cr.spec.swim.speed * 0.5 * swimFactor(this.cr, t) * Math.min(1, d / 60);
    this.cr.update(t, (dx / d) * sp, (dy / d) * sp, 0.05);
    collide(r.x[0], r.y[0], r.rad[0] + 2, this.hit);
    if (this.hit.hit) { r.x[0] = this.hit.x; r.y[0] = this.hit.y; }
    if (r.y[0] < 12) r.y[0] = 12;
  }
}

/** who lives where, for step 1 */
export function faunaFor(x: number, R: () => number): { sp: Spec; benthic: boolean; scale: number } {
  const reef = moodAt(x).name === 'Le Récif';
  const list = reef
    ? [['poissonClown', 0], ['crevette', 1], ['nudibranche', 1], ['koi', 0], ['hippocampe', 0], ['etoile', 1], ['crabe', 1], ['verPlat', 1]]
    : [['meduse', 0], ['copepode', 0], ['krill', 0], ['larve', 0], ['ctenophore', 0], ['hippocampe', 0]];
  const [id, b] = list[Math.floor(R() * list.length)] as [string, number];
  return { sp: SPECIES[id](), benthic: !!b, scale: id === 'meduse' ? 0.7 : 0.8 };
}

