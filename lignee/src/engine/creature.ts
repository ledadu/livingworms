// Seg: one live whip. Creature: a tree of Segs built from a Spec.

import type { AttDef, Box, NodeDef, PaletteSlot, Spec } from './types';
import { ROOT_SLOT, SHAPES, expand, palette, type Slot } from './defs';
import { STEP, TAU, clamp, hsla, lerp, rand, wrapAngle } from './util';

function rowCurve(w: number): number {
  // quick power stroke, slow recovery
  const f = (((w / TAU) % 1) + 1) % 1;
  if (f < 0.3) { const u = f / 0.3; return 1 - 2 * u * u * (3 - 2 * u); }
  const u = (f - 0.3) / 0.7;
  return -1 + 2 * u * u * (3 - 2 * u);
}

export class Seg {
  def: NodeDef;
  att: AttDef | null;
  parent: Seg | null;
  creature: Creature;
  depth: number;
  n: number;
  at: number;
  rel: number;
  edge: number;
  phase: number;
  k: number;
  side: number;
  hueOff: number;
  radial: boolean;
  flip: number;
  scale: number;
  len: number;
  amax: number;
  bend: number;
  pulse = 0;
  pulseU: boolean;
  anchor?: number;
  sink = 0;
  cut = false;
  x: Float32Array; y: Float32Array; ox: Float32Array; oy: Float32Array;
  ang: Float32Array; rad: Float32Array; lens: Float32Array; bends: Float32Array;
  box: Box;
  maxRad = 0;
  hue = 0;
  cols: string[] = [];
  edgeCol = ''; shineCol = ''; patCol = ''; webCol = '';
  children: Seg[] = [];

  constructor(def: NodeDef, a: AttDef | null, parent: Seg | null, slot: Slot, flip: number, scale: number,
    x: number, y: number, dir: number, creature: Creature) {
    const n = Math.max(1, def.links);
    this.def = def;
    this.att = a;
    this.parent = parent;
    this.creature = creature;
    this.depth = parent ? parent.depth + 1 : 0;
    this.n = n;
    this.at = parent ? Math.min(slot.at, parent.n) : 0;
    const pf = parent ? parent.flip : 1;
    this.rel = slot.angle * pf;
    this.edge = slot.edge * pf;
    this.phase = slot.phase;
    this.k = slot.k;
    this.side = slot.side;
    this.hueOff = slot.hue || 0;
    this.radial = slot.radial;
    this.flip = flip;
    this.scale = scale;
    this.len = def.len * scale;
    this.amax = 0.03 + def.flex * 2.6;
    this.bend = (def.curl * flip) / n;
    this.x = new Float32Array(n + 1); this.y = new Float32Array(n + 1);
    this.ox = new Float32Array(n + 1); this.oy = new Float32Array(n + 1);
    this.ang = new Float32Array(n + 1); this.rad = new Float32Array(n + 1);
    this.lens = new Float32Array(n + 1); this.bends = new Float32Array(n + 1);
    this.box = [x, y, x, y];
    // link length can shrink or grow toward the tip (spiral shells, tapering tails)
    const lt = def.lenTo === undefined ? 1 : def.lenTo;
    for (let i = 1; i <= n; i++) this.lens[i] = this.len * lerp(1, lt, n > 1 ? (i - 1) / (n - 1) : 0);
    this.pulseU = def.motion.type === 'breathe';
    // rest curvature per link: -1 = gathered at the base, +1 = gathered at the tip
    const cb = def.curlBias || 0;
    for (let i = 2; i <= n; i++) this.bends[i] = this.bend * (1 + cb * (n > 2 ? ((i - 2) / (n - 2)) * 2 - 1 : 0));
    const shape = SHAPES[def.shape] || SHAPES.worm, w = def.width * scale;
    for (let i = 0; i <= n; i++) {
      this.rad[i] = Math.max(0.15, shape(w, i / n));
      if (this.rad[i] > this.maxRad) this.maxRad = this.rad[i];
    }
    // start in the rest pose
    let an = dir;
    this.x[0] = this.ox[0] = x;
    this.y[0] = this.oy[0] = y;
    for (let i = 1; i <= n; i++) {
      if (i > 1) an += this.bends[i];
      this.ang[i] = an;
      this.x[i] = this.ox[i] = this.x[i - 1] + Math.cos(an) * this.lens[i];
      this.y[i] = this.oy[i] = this.y[i - 1] + Math.sin(an) * this.lens[i];
    }
    this.ang[0] = this.ang[1];
    this.paint(creature.pal);
    for (const child of def.attach) this.instantiate(child);
  }

  instantiate(a: AttDef): Seg[] {
    const out: Seg[] = [];
    for (const s of expand(a, this.n)) {
      const at = s.at;
      const c = new Seg(a.node, a, this, s, this.flip * s.side, this.scale * s.scale,
        this.x[at], this.y[at], this.ang[at] + s.angle * this.flip, this.creature);
      this.children.push(c);
      out.push(c);
    }
    return out;
  }

  paint(pal: PaletteSlot[]): void {
    const c = this.def.color, sl = pal[c.slot] || pal[0], n = this.n;
    const h = (((sl.h + c.shift + this.hueOff) % 360) + 360) % 360;
    const ps = pal[c.pslot] || pal[3], ph = (((ps.h + c.shift + this.hueOff) % 360) + 360) % 360;
    this.hue = h;
    this.cols = [];
    // bands are baked in the colours for styles drawn link by link
    const bake = c.pattern === 'bands' && this.def.style !== 'ribbon', nb = Math.max(1, Math.round(c.pdensity));
    for (let i = 0; i <= n; i++) {
      const t = i / n, al = clamp(c.alpha * (1 - c.fade * t), 0, 1);
      if (bake && Math.floor(t * nb * 2 - 0.001) % 2 === 1) this.cols[i] = hsla(ph, ps.s, clamp(ps.l + c.plight, 3, 97), al);
      else this.cols[i] = hsla(h, sl.s, clamp(sl.l + c.light + c.grad * t, 3, 97), al);
    }
    const lm = clamp(sl.l + c.light + c.grad * 0.5, 3, 97);
    this.edgeCol = hsla(h, sl.s, Math.max(2, lm - 24), clamp(c.alpha * 0.8, 0, 1));
    this.shineCol = hsla(h, Math.max(0, sl.s - 30), Math.min(97, lm + 30), clamp(c.alpha * 0.28, 0, 1));
    this.patCol = hsla(ph, ps.s, clamp(ps.l + c.plight, 3, 97), clamp(c.alpha, 0, 1));
    this.webCol = hsla(h, sl.s, Math.min(95, lm + 8), clamp(c.alpha * 0.42, 0, 1));
  }

  update(time: number): void {
    const d = this.def, m = d.motion, n = this.n, x = this.x, y = this.y, ox = this.ox, oy = this.oy;
    const ang = this.ang, rad = this.rad;
    const w = TAU * m.freq * time + this.phase;
    let fixed: number | null = null;

    this.pulse = m.type === 'pulse' || m.type === 'breathe' ? m.amp * (0.5 + 0.5 * Math.sin(w)) : 0;

    if (this.parent) {
      const p = this.parent, k = this.at, pa = p.ang[k];
      let px = p.x[k], py = p.y[k];
      fixed = pa + this.rel;
      if (this.edge) {
        const pr = p.rad[k] * (1 + p.pulse * (p.pulseU ? 1 : k / p.n)) * this.edge;
        if (this.radial) {
          // ring: pushed outward along its own direction (starfish arms on the disc rim)
          px += Math.cos(fixed) * pr;
          py += Math.sin(fixed) * pr;
        } else {
          px -= Math.sin(pa) * pr;
          py += Math.cos(pa) * pr;
        }
      }
      ox[0] = x[0]; oy[0] = y[0];
      x[0] = px; y[0] = py;
    } else if (this.anchor !== undefined) {
      // rooted in the sea floor (kelp, coral): the base keeps its direction
      fixed = this.anchor;
    }
    if (fixed !== null) {
      if (m.type === 'wave') fixed += m.amp * Math.sin(w) * this.flip;
      else if (m.type === 'row') fixed += m.amp * rowCurve(w) * this.flip;
      else if (m.type === 'flutter') fixed += m.amp * (0.6 * Math.sin(w) + 0.4 * Math.sin(w * 2.7 + 1.3)) * this.flip;
    }

    const drag = d.drag, grav = d.gravity + this.sink, amax = this.amax, keep = 1 - d.spring;
    const lens = this.lens, bends = this.bends, soak = 0.2 + 0.4 * d.flex;
    const extra = m.type === 'curl' ? ((m.amp * (0.5 + 0.5 * Math.sin(w)) * this.flip) / n) * 2 : 0;
    const und = m.type === 'undulate' ? m.amp * 0.5 : 0, wk = (TAU * m.wave) / n;
    let minx = x[0] - rad[0], maxx = x[0] + rad[0], miny = y[0] - rad[0], maxy = y[0] + rad[0];

    for (let i = 1; i <= n; i++) {
      let px2 = x[i], py2 = y[i];
      const vx = (px2 - ox[i]) * drag, vy = (py2 - oy[i]) * drag;
      ox[i] = px2; oy[i] = py2;
      px2 += vx; py2 += vy + grav;

      let a = Math.atan2(py2 - y[i - 1], px2 - x[i - 1]);
      if (i === 1) {
        if (fixed !== null) a = fixed;
      } else {
        // shape memory: pulled toward the rest bend, never further than amax from it
        const tgt = bends[i] + extra + (und ? und * Math.sin(w - i * wk) : 0);
        let dd = wrapAngle(a - ang[i - 1]) - tgt;
        if (dd > amax) dd = amax;
        else if (dd < -amax) dd = -amax;
        a = ang[i - 1] + tgt + dd * keep;
      }
      ang[i] = a;
      const nx2 = x[i - 1] + Math.cos(a) * lens[i], ny2 = y[i - 1] + Math.sin(a) * lens[i];
      // like deltaScale in whip.js: part of the correction is not turned into speed,
      // otherwise long soft chains fold into zig-zags
      ox[i] += (nx2 - px2) * soak;
      oy[i] += (ny2 - py2) * soak;
      x[i] = nx2; y[i] = ny2;

      const r = rad[i] * (1 + this.pulse);
      if (nx2 - r < minx) minx = nx2 - r;
      if (nx2 + r > maxx) maxx = nx2 + r;
      if (ny2 - r < miny) miny = ny2 - r;
      if (ny2 + r > maxy) maxy = ny2 + r;
    }
    ang[0] = ang[1];
    const b = this.box;
    b[0] = minx; b[1] = miny; b[2] = maxx; b[3] = maxy;

    for (const c of this.children) c.update(time);
  }

  walk(fn: (s: Seg) => void): void {
    fn(this);
    for (const c of this.children) c.walk(fn);
  }
}

export interface CreatureOptions { dir?: number; phase?: number; scale?: number; anchor?: number; }

export class Creature {
  spec: Spec;
  pal: PaletteSlot[];
  phase: number;
  vx = 0;
  vy = 0;
  list: Seg[] = [];
  box: Box;
  root: Seg;
  dartT = 0;
  dartWait = 1;

  constructor(sp: Spec, x: number, y: number, o: CreatureOptions = {}) {
    this.spec = sp;
    this.pal = palette(sp.palette);
    this.phase = o.phase === undefined ? rand(0, TAU) : o.phase;
    this.box = [x, y, x, y];
    const slot = { ...ROOT_SLOT, phase: this.phase };
    this.root = new Seg(sp.body, null, null, slot, 1, (o.scale || 1) * (sp.size || 1), x, y, o.dir === undefined ? Math.PI / 2 : o.dir, this);
    if (o.anchor !== undefined) this.root.anchor = o.anchor;
    this.refresh();
  }

  refresh(): void {
    this.list.length = 0;
    this.root.walk((s) => this.list.push(s));
  }

  update(time: number, dvx: number, dvy: number, accel: number, minY?: number): void {
    this.vx += (dvx - this.vx) * accel;
    this.vy += (dvy - this.vy) * accel;
    const r = this.root;
    r.ox[0] = r.x[0]; r.oy[0] = r.y[0];
    r.x[0] += this.vx; r.y[0] += this.vy;
    if (minY !== undefined && r.y[0] < minY) { r.y[0] = minY; if (this.vy < 0) this.vy *= -0.3; }
    r.update(time);
    const b = this.box, l = this.list;
    b[0] = b[1] = Infinity; b[2] = b[3] = -Infinity;
    for (let i = 0; i < l.length; i++) {
      const wb = l[i].box;
      if (wb[0] < b[0]) b[0] = wb[0];
      if (wb[1] < b[1]) b[1] = wb[1];
      if (wb[2] > b[2]) b[2] = wb[2];
      if (wb[3] > b[3]) b[3] = wb[3];
    }
  }

  heading(): number { return this.root.ang[1] + Math.PI; }

  /** move every node at once (teleport, spawn) */
  translate(dx: number, dy: number): void {
    for (const s of this.list) {
      for (let i = 0; i <= s.n; i++) { s.x[i] += dx; s.ox[i] += dx; s.y[i] += dy; s.oy[i] += dy; }
      s.box[0] += dx; s.box[2] += dx; s.box[1] += dy; s.box[3] += dy;
    }
    this.box[0] += dx; this.box[2] += dx; this.box[1] += dy; this.box[3] += dy;
  }
}

/** speed multiplier given by the way the species swims */
export function swimFactor(cr: Creature, t: number): number {
  const s = cr.spec.swim;
  if (s.mode === 'pulse') {
    const m = cr.root.def.motion, f = m.type === 'pulse' ? m.freq : s.freq;
    const c = -Math.cos(TAU * f * t + cr.phase); // the bell contracts
    return 0.2 + 2.2 * (c > 0 ? c * c : 0);
  }
  if (s.mode === 'dart') {
    cr.dartT -= STEP;
    if (cr.dartT < -cr.dartWait) { cr.dartT = 0.22; cr.dartWait = rand(0.5, 1.6); }
    return cr.dartT > 0 ? 3 : 0.45;
  }
  return 1;
}

/** let a freshly built creature settle in its rest pose before it is shown */
export function settle(cr: Creature, steps = 420): void {
  for (let t = 0; t < steps; t++) cr.update(t * STEP, 0, 0, 1);
  for (const s of cr.list) for (let i = 0; i <= s.n; i++) { s.ox[i] = s.x[i]; s.oy[i] = s.y[i]; }
}
