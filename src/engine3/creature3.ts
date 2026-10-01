// The whip engine in three axes. Same species definitions (defs.ts), same
// parameters, but every link of every chain has a direction in space:
//  - a body can swing in the horizontal plane (yaw), in the vertical plane
//    (pitch), and its limbs turn with it;
//  - each chain keeps a bend plane (its normal is `nb`): curl, waves, rows and
//    flutter rotate about that axis, exactly as they did about the screen axis
//    in 2D;
//  - a body's bend plane is always the vertical one through its own tangent
//    (like a dolphin or a fish), so that it undulates whichever way it faces.
//
// World axes: x right, y DOWN (the surface is y = 0), z away from the eye.

import type { AttDef, NodeDef, PaletteSlot, Spec, SwimDef, SwimMode } from '../engine/types';
import { ROOT_SLOT, SHAPES, expand, onRim, palette, rimOf, type Slot } from '../engine/defs';
import { STEP, TAU, clamp, hsla, lerp, rand, wrapAngle } from '../engine/util';

// ----- tiny vector helpers on scalars (no allocation in the hot path) ----- //

interface V { x: number; y: number; z: number; }
const v3 = (x = 0, y = 0, z = 0): V => ({ x, y, z });

function norm(v: V): V {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  v.x /= l; v.y /= l; v.z /= l;
  return v;
}

/** v rotated about the unit axis k by ang (Rodrigues), written into out */
function rotate(v: V, k: V, ang: number, out: V): V {
  const c = Math.cos(ang), s = Math.sin(ang), d = (k.x * v.x + k.y * v.y + k.z * v.z) * (1 - c);
  const cx = k.y * v.z - k.z * v.y, cy = k.z * v.x - k.x * v.z, cz = k.x * v.y - k.y * v.x;
  out.x = v.x * c + cx * s + k.x * d;
  out.y = v.y * c + cy * s + k.y * d;
  out.z = v.z * c + cz * s + k.z * d;
  return out;
}

const DOWN: V = v3(0, 1, 0);

/** the belly axis (`down`, the body's own down) made perpendicular to t; if t is (nearly) along it, use `fallback` */
function belly(t: V, down: V, out: V, fallback: V): V {
  const d = t.x * down.x + t.y * down.y + t.z * down.z;
  out.x = down.x - t.x * d; out.y = down.y - t.y * d; out.z = down.z - t.z * d;
  const l = Math.hypot(out.x, out.y, out.z);
  if (l < 0.2) {
    const f = fallback, fd = f.x * t.x + f.y * t.y + f.z * t.z;
    out.x = f.x - t.x * fd; out.y = f.y - t.y * fd; out.z = f.z - t.z * fd;
  }
  return norm(out);
}

const cross = (a: V, b: V, out: V): V => {
  out.x = a.y * b.z - a.z * b.y; out.y = a.z * b.x - a.x * b.z; out.z = a.x * b.y - a.y * b.x;
  return out;
};

// ----- how a part is mounted on its parent (real 3D placement of the 2D angles) ----- //

/** roll of the mount plane, by role: 0 = sideways, +pi/2 = straight down, negative = up */
function rollOf(d: NodeDef): number {
  switch (d.role) {
    case 'fin': return 0.7;
    case 'whip': return 0.55;
    case 'sting': return 0.5;
    case 'light': return 0.5;
    case 'jaw': return 0.5;
    case 'sense': return -0.45;
    case 'cilia': return 1.2;
    default:
      if (d.style === 'eye') return -0.7;
      if (d.style === 'line') return 1.1;
      return 0.9;
  }
}

/** flat blades (fins, leaves, frills) are thin along their bend axis; the rest are round tubes */
export type Kind = 'body' | 'flat' | 'round';

function kindOf(s: { def: NodeDef; parent: unknown }): Kind {
  const d = s.def;
  if (!s.parent) return 'body';
  if (d.style === 'line' || d.style === 'disc' || d.style === 'eye') return 'round';
  if (d.role === 'fin' || d.shape === 'leaf' || d.shape === 'frill') return 'flat';
  return 'round';
}

function thickOf(kind: Kind, d: NodeDef): number {
  if (kind === 'flat') return 0.16;
  if (kind === 'body') return d.shape === 'bell' ? 0.85 : d.style === 'plates' ? 0.8 : 0.72;
  return 1;
}

export class Seg3 {
  def: NodeDef;
  att: AttDef | null;
  parent: Seg3 | null;
  creature: Creature3;
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
  /** hanging from the rim of a bell (see rimOf), or not */
  rim: { u: number; back: number; open: number } | null = null;
  flip: number;
  scale: number;
  len: number;
  amax: number;
  bend: number;
  pulse = 0;
  pulseU: boolean;
  sink = 0;
  cut = false;
  kind: Kind;
  thick: number;
  roll: number;
  /** bend axis of this chain (unit) */
  nb: V = v3(0, 0, 1);
  /** first link fixed to this direction (plants rooted in the sea floor) */
  anchor: V | null = null;
  /** the way the head points: the first link runs the opposite way (animals with a driven heading) */
  headDir: V | null = null;
  x: Float32Array; y: Float32Array; z: Float32Array;
  ox: Float32Array; oy: Float32Array; oz: Float32Array;
  /** direction of link i (from node i-1 to node i); index 0 repeats index 1 */
  dx: Float32Array; dy: Float32Array; dz: Float32Array;
  rad: Float32Array; lens: Float32Array; bends: Float32Array;
  maxRad = 0;
  hue = 0;
  cols: string[] = [];
  edgeCol = ''; shineCol = ''; patCol = ''; webCol = '';
  children: Seg3[] = [];
  // scratch
  private t = v3(); private b = v3(); private l = v3(); private m = v3(); private dir = v3(); private tg = v3(); private tmp = v3();
  private lastNb = v3(0, 0, 1);

  constructor(def: NodeDef, a: AttDef | null, parent: Seg3 | null, slot: Slot, flip: number, scale: number,
    pos: V, dir: V, nb: V, creature: Creature3) {
    const n = Math.max(1, def.links);
    this.def = def; this.att = a; this.parent = parent; this.creature = creature;
    this.depth = parent ? parent.depth + 1 : 0;
    this.n = n;
    this.at = parent ? Math.min(slot.at, parent.n) : 0;
    const pf = parent ? parent.flip : 1;
    this.rel = slot.angle * pf;
    this.edge = slot.edge * pf;
    this.phase = slot.phase; this.k = slot.k; this.side = slot.side;
    this.hueOff = slot.hue || 0; this.radial = slot.radial;
    this.flip = flip; this.scale = scale;
    this.len = def.len * scale;
    this.amax = 0.03 + def.flex * 2.6;
    this.bend = (def.curl * flip) / n;
    this.kind = kindOf(this);
    this.thick = thickOf(this.kind, def);
    this.roll = rollOf(def);
    this.nb = { x: nb.x, y: nb.y, z: nb.z };
    const N = n + 1;
    this.x = new Float32Array(N); this.y = new Float32Array(N); this.z = new Float32Array(N);
    this.ox = new Float32Array(N); this.oy = new Float32Array(N); this.oz = new Float32Array(N);
    this.dx = new Float32Array(N); this.dy = new Float32Array(N); this.dz = new Float32Array(N);
    this.rad = new Float32Array(N); this.lens = new Float32Array(N); this.bends = new Float32Array(N);
    const lt = def.lenTo === undefined ? 1 : def.lenTo;
    for (let i = 1; i <= n; i++) this.lens[i] = this.len * lerp(1, lt, n > 1 ? (i - 1) / (n - 1) : 0);
    this.pulseU = def.motion.type === 'breathe';
    const cb = def.curlBias || 0;
    for (let i = 2; i <= n; i++) this.bends[i] = this.bend * (1 + cb * (n > 2 ? ((i - 2) / (n - 2)) * 2 - 1 : 0));
    const shape = SHAPES[def.shape] || SHAPES.worm, w = def.width * scale;
    for (let i = 0; i <= n; i++) {
      this.rad[i] = Math.max(0.15, shape(w, i / n));
      if (this.rad[i] > this.maxRad) this.maxRad = this.rad[i];
    }
    // the rest pose
    const d = { x: dir.x, y: dir.y, z: dir.z }, o = v3();
    this.x[0] = this.ox[0] = pos.x; this.y[0] = this.oy[0] = pos.y; this.z[0] = this.oz[0] = pos.z;
    for (let i = 1; i <= n; i++) {
      if (i > 1) { rotate(d, this.nb, this.bends[i], o); d.x = o.x; d.y = o.y; d.z = o.z; }
      this.dx[i] = d.x; this.dy[i] = d.y; this.dz[i] = d.z;
      this.x[i] = this.ox[i] = this.x[i - 1] + d.x * this.lens[i];
      this.y[i] = this.oy[i] = this.y[i - 1] + d.y * this.lens[i];
      this.z[i] = this.oz[i] = this.z[i - 1] + d.z * this.lens[i];
    }
    this.dx[0] = this.dx[1]; this.dy[0] = this.dy[1]; this.dz[0] = this.dz[1];
    this.paint(creature.pal);
    for (const child of def.attach) this.instantiate(child);
  }

  /**
   * The mount of a child at node `at` of this chain: its first direction, its
   * bend axis and the direction it leans toward (for the offset from the axis).
   * `side` = which side the copy is on, `ang` = the 2D angle of the slot.
   */
  mountFor(child: NodeDef, slot: Slot, at: number, dirOut: V, nbOut: V, mOut: V): void {
    const i = Math.max(1, at), t = this.t;
    t.x = this.dx[i]; t.y = this.dy[i]; t.z = this.dz[i];
    if (this.creature.planar) {
      // the whole creature lives in one plane (plants): the 2D rules, in that plane
      const m = cross(this.nb, t, mOut); norm(m);
      const ang = slot.angle * this.flip;
      dirOut.x = t.x * Math.cos(ang) + m.x * Math.sin(ang);
      dirOut.y = t.y * Math.cos(ang) + m.y * Math.sin(ang);
      dirOut.z = t.z * Math.cos(ang) + m.z * Math.sin(ang);
      nbOut.x = this.nb.x; nbOut.y = this.nb.y; nbOut.z = this.nb.z;
      return;
    }
    const b = belly(t, this.creature.down, this.b, this.creature.side), l = cross(t, b, this.l);
    norm(l);
    const roll = rollOf(child);
    const ang = slot.angle;
    if (slot.radial) {
      // a ring lies flat, in the horizontal plane through the node; on a body that points straight up or down it keeps its heading
      const ra = slot.angle, cr = this.creature, fa = cr.mode === 'bell' ? 0 : cr.yaw + Math.PI;
      const hx = t.x, hz = t.z, hl = Math.hypot(hx, hz);
      const e1x = hl > 0.3 ? hx / hl : Math.cos(fa), e1z = hl > 0.3 ? hz / hl : Math.sin(fa);
      dirOut.x = e1x * Math.cos(ra) - e1z * Math.sin(ra);
      dirOut.z = e1z * Math.cos(ra) + e1x * Math.sin(ra);
      dirOut.y = 0.05;
      norm(dirOut);
      mOut.x = dirOut.x; mOut.y = 0; mOut.z = dirOut.z;
      // bends lift the arms
      cross(dirOut, DOWN, nbOut); norm(nbOut);
      return;
    }
    const sg = ang < -1e-4 ? -1 : ang > 1e-4 ? 1 : slot.side;
    // a copy leans to its own side and along the roll of its part
    mOut.x = sg * Math.cos(roll) * l.x + Math.sin(roll) * b.x;
    mOut.y = sg * Math.cos(roll) * l.y + Math.sin(roll) * b.y;
    mOut.z = sg * Math.cos(roll) * l.z + Math.sin(roll) * b.z;
    norm(mOut);
    const ca = Math.cos(ang), sa = Math.abs(Math.sin(ang));
    dirOut.x = t.x * ca + mOut.x * sa; dirOut.y = t.y * ca + mOut.y * sa; dirOut.z = t.z * ca + mOut.z * sa;
    norm(dirOut);
    cross(t, mOut, nbOut); norm(nbOut);
    // (the caller falls back to the parent's axis if this is degenerate)
  }

  /**
   * Arms that pull (octopus): set all round the body at node `at`, like the
   * ribs of an umbrella, each `open` radians away from the axis of the body.
   * Writes the first direction, the bend axis and the lean of the arm.
   */
  ringMount(at: number, k: number, count: number, open: number, dirOut: V, nbOut: V, mOut: V): void {
    const i = Math.max(1, at), t = this.t;
    t.x = this.dx[i]; t.y = this.dy[i]; t.z = this.dz[i];
    const b = belly(t, this.creature.down, this.b, this.creature.side), l = cross(t, b, this.l);
    norm(l);
    const phi = (TAU * (k + 0.5)) / count, c = Math.cos(phi), s = Math.sin(phi);
    mOut.x = c * l.x + s * b.x; mOut.y = c * l.y + s * b.y; mOut.z = c * l.z + s * b.z;
    const co = Math.cos(open), so = Math.sin(open);
    dirOut.x = t.x * co + mOut.x * so; dirOut.y = t.y * co + mOut.y * so; dirOut.z = t.z * co + mOut.z * so;
    norm(dirOut);
    // bending about this axis turns the arm outward (away from the body)
    cross(t, mOut, nbOut); norm(nbOut);
  }

  /**
   * A copy hanging from the rim of a bell (see rimOf). Its frame is the axis of
   * the bell and the direction across it as the eye sees it, not the belly:
   * the copies stay on both sides whichever way the bell leans or last swam.
   */
  rimMount(at: number, u: number, back: number, open: number, dirOut: V, nbOut: V, mOut: V): void {
    const i = Math.max(1, at), t = this.t, e = this.l, g = this.b;
    t.x = this.dx[i]; t.y = this.dy[i]; t.z = this.dz[i];
    // across the axis on screen (the eye looks along z); the bell seen from below or above: across its belly
    e.x = -t.y; e.y = t.x; e.z = 0;
    if (Math.hypot(e.x, e.y) < 0.2) cross(t, belly(t, this.creature.down, g, this.creature.side), e);
    norm(e);
    // behind the axis, away from the eye
    cross(t, e, g); norm(g);
    const s = Math.sqrt(Math.max(0, 1 - u * u)) * back;
    mOut.x = u * e.x + s * g.x; mOut.y = u * e.y + s * g.y; mOut.z = u * e.z + s * g.z;
    const co = Math.cos(open), so = Math.sin(open);
    dirOut.x = t.x * co + mOut.x * so; dirOut.y = t.y * co + mOut.y * so; dirOut.z = t.z * co + mOut.z * so;
    norm(dirOut);
    cross(t, mOut, nbOut); norm(nbOut);
  }

  instantiate(a: AttDef): void {
    const dir = v3(), nb = v3(), m = v3();
    const rim = !this.creature.planar && onRim(this.def, a);
    for (const s0 of expand(a, this.n)) {
      const at = s0.at, r = rim ? rimOf(a, s0.k) : null;
      // on the rim, every copy is as far out as the fan's ends
      const s = r ? { ...s0, edge: a.edge } : s0;
      if (r) this.rimMount(at, r.u, r.back, r.open, dir, nb, m);
      else this.mountFor(a.node, s, at, dir, nb, m);
      // base position: pushed toward the side it leans to, by edge * radius
      const pr = this.rad[at] * Math.abs(s.edge);
      const p = { x: this.x[at] + m.x * pr, y: this.y[at] + m.y * pr, z: this.z[at] + m.z * pr };
      // in a free-form creature mirrored copies are already on their own side: no flip
      const flip = this.creature.planar ? this.flip * s.side : 1;
      const c = new Seg3(a.node, a, this, s, flip, this.scale * s.scale, p, dir, nb, this.creature);
      c.rim = r;
      this.children.push(c);
    }
  }

  paint(pal: PaletteSlot[]): void {
    const c = this.def.color, sl = pal[c.slot] || pal[0], n = this.n;
    const h = (((sl.h + c.shift + this.hueOff) % 360) + 360) % 360;
    const ps = pal[c.pslot] || pal[3], ph = (((ps.h + c.shift + this.hueOff) % 360) + 360) % 360;
    this.hue = h;
    this.cols = [];
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
    const d = this.def, m = d.motion, n = this.n, x = this.x, y = this.y, z = this.z, ox = this.ox, oy = this.oy, oz = this.oz;
    const cr = this.creature;
    // a part with a drive moves on the rhythm of the animal, with the stroke of its drive; the others on their own
    const drv = d.drive;
    let type: string = m.type, w = TAU * m.freq * time + this.phase;
    if (drv && drv !== 'none') {
      type = DRIVE_MOTION[drv];
      w = TAU * cr.spec.swim.freq * time + cr.phase + this.phase + (drv === 'walk' ? (this.k % 2) * Math.PI + (this.side < 0 ? Math.PI : 0) : 0);
    }
    this.pulse = type === 'pulse' || type === 'breathe' ? m.amp * (0.5 + 0.5 * Math.sin(w)) : 0;
    // the body of an animal pulled by its arms fills while they open and empties on the stroke
    if (!this.parent && cr.drivers.length && cr.mode === 'jet') this.pulse = m.amp * (0.3 + 0.7 * cr.open);
    const pull = drv === 'pull' && !cr.planar && !!this.parent && !!this.att;

    let fixed: V | null = null;
    if (this.parent) {
      const p = this.parent, k = this.at;
      if (pull) {
        // swimming: open slowly, close at once (the stroke); walking: wide open, each arm stepping in turn
        const hi = 0.35 + m.amp * 0.9;
        const open = cr.mode === 'crawl' ? hi * 0.75 + 0.3 * Math.sin(w + this.k * Math.PI) : 0.12 + (hi - 0.12) * openOf(w);
        p.ringMount(k, this.k, this.att!.count, open, this.dir, this.nb, this.m);
      } else if (this.rim) p.rimMount(k, this.rim.u, this.rim.back, this.rim.open, this.dir, this.nb, this.m);
      else p.mountFor(d, { at: k, angle: this.rel / (p.flip || 1), scale: 1, phase: 0, side: this.side, edge: this.edge, k: this.k, hue: 0, radial: this.radial }, k, this.dir, this.nb, this.m);
      if (Math.hypot(this.nb.x, this.nb.y, this.nb.z) < 0.5) { this.nb.x = p.nb.x; this.nb.y = p.nb.y; this.nb.z = p.nb.z; }
      const pr = p.rad[k] * (1 + p.pulse * (p.pulseU ? 1 : k / p.n)) * Math.abs(this.edge);
      ox[0] = x[0]; oy[0] = y[0]; oz[0] = z[0];
      x[0] = p.x[k] + this.m.x * pr; y[0] = p.y[k] + this.m.y * pr; z[0] = p.z[k] + this.m.z * pr;
      fixed = this.dir;
      const fl = cr.planar ? this.flip : 1;
      let ang = 0;
      if (type === 'wave') ang = m.amp * Math.sin(w) * fl;
      else if (type === 'row') ang = m.amp * rowCurve(w) * fl;
      else if (type === 'flutter') ang = m.amp * (0.6 * Math.sin(w) + 0.4 * Math.sin(w * 2.7 + 1.3)) * fl;
      if (ang) rotate(this.dir, this.nb, ang, this.tg), fixed = this.tg;
    } else if (this.headDir) {
      this.tg.x = -this.headDir.x; this.tg.y = -this.headDir.y; this.tg.z = -this.headDir.z;
      fixed = this.tg;
    } else if (this.anchor) {
      fixed = this.anchor;
    }

    const drag = d.drag, grav = d.gravity + this.sink, amax = this.amax, keep = 1 - d.spring;
    const bends = this.bends, lens = this.lens, soak = 0.2 + 0.4 * d.flex, F = cr.planar ? this.flip : 1;
    // curl: arms open and close; recoil: they trail straight behind on every jet stroke and relax between
    const power = cr.stroke;
    const extra = pull ? (((cr.mode === 'crawl' ? 0.35 : 0.6 * openOf(w)) * m.amp) / n) * 2
      : type === 'curl' ? ((m.amp * (0.5 + 0.5 * Math.sin(w)) * (1 - 0.8 * cr.stroke) * F) / n) * 2
      : type === 'recoil' ? (((m.amp * (1 - power) + 0.3 * Math.sin(w)) * F) / n) * 2 : 0;
    const und = type === 'undulate' ? m.amp * 0.5 : 0, wk = (TAU * m.wave) / n;
    const a = this.tmp, tgt = this.t, prev = this.b, nbi = this.l;
    let mnx = x[0], mxx = x[0], mny = y[0], mxy = y[0], mnz = z[0], mxz = z[0];
    const dyn = !this.parent && !this.anchor && !cr.planar;

    for (let i = 1; i <= n; i++) {
      let px2 = x[i], py2 = y[i], pz2 = z[i];
      const vx = (px2 - ox[i]) * drag, vy = (py2 - oy[i]) * drag, vz = (pz2 - oz[i]) * drag;
      ox[i] = px2; oy[i] = py2; oz[i] = pz2;
      px2 += vx; py2 += vy + grav; pz2 += vz;

      a.x = px2 - x[i - 1]; a.y = py2 - y[i - 1]; a.z = pz2 - z[i - 1];
      norm(a);
      if (i === 1) {
        if (fixed) { a.x = fixed.x; a.y = fixed.y; a.z = fixed.z; }
      } else {
        prev.x = this.dx[i - 1]; prev.y = this.dy[i - 1]; prev.z = this.dz[i - 1];
        // a body bends in its own vertical plane, the one through its tangent and its own down (tilted with its pitch)
        if (dyn) {
          cross(prev, cr.down, nbi);
          if (Math.hypot(nbi.x, nbi.y, nbi.z) < 0.25) { nbi.x = this.lastNb.x; nbi.y = this.lastNb.y; nbi.z = this.lastNb.z; }
          else norm(nbi);
          this.lastNb.x = nbi.x; this.lastNb.y = nbi.y; this.lastNb.z = nbi.z;
        } else { nbi.x = this.nb.x; nbi.y = this.nb.y; nbi.z = this.nb.z; }
        rotate(prev, nbi, bends[i] * (dyn ? this.flip : 1) + extra + (und ? und * Math.sin(w - i * wk) : 0), tgt);
        // shape memory: pulled toward the rest bend, never further than amax from it
        let dot = a.x * tgt.x + a.y * tgt.y + a.z * tgt.z;
        dot = dot > 1 ? 1 : dot < -1 ? -1 : dot;
        const th = Math.acos(dot);
        if (th > amax) {
          const f = amax / th;
          a.x = tgt.x + (a.x - tgt.x) * f; a.y = tgt.y + (a.y - tgt.y) * f; a.z = tgt.z + (a.z - tgt.z) * f;
        }
        a.x = tgt.x + (a.x - tgt.x) * keep; a.y = tgt.y + (a.y - tgt.y) * keep; a.z = tgt.z + (a.z - tgt.z) * keep;
        norm(a);
      }
      this.dx[i] = a.x; this.dy[i] = a.y; this.dz[i] = a.z;
      const nx2 = x[i - 1] + a.x * lens[i], ny2 = y[i - 1] + a.y * lens[i], nz2 = z[i - 1] + a.z * lens[i];
      // like deltaScale in whip.js: part of the correction is not turned into speed
      ox[i] += (nx2 - px2) * soak; oy[i] += (ny2 - py2) * soak; oz[i] += (nz2 - pz2) * soak;
      x[i] = nx2; y[i] = ny2; z[i] = nz2;
      if (nx2 < mnx) mnx = nx2; else if (nx2 > mxx) mxx = nx2;
      if (ny2 < mny) mny = ny2; else if (ny2 > mxy) mxy = ny2;
      if (nz2 < mnz) mnz = nz2; else if (nz2 > mxz) mxz = nz2;
    }
    this.dx[0] = this.dx[1]; this.dy[0] = this.dy[1]; this.dz[0] = this.dz[1];
    const r = this.maxRad * (1 + this.pulse);
    const b = this.box;
    b[0] = mnx - r; b[1] = mny - r; b[2] = mnz - r; b[3] = mxx + r; b[4] = mxy + r; b[5] = mxz + r;
    for (const c of this.children) c.update(time);
  }

  box: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];

  walk(fn: (s: Seg3) => void): void {
    fn(this);
    for (const c of this.children) c.walk(fn);
  }
}

/**
 * The beat of arms that pull, at phase w: a quick stroke (the first 30 % of the
 * beat) that closes them and pushes, then a slow opening that does not.
 * openOf = how open they are (0..1), thrustOf = how hard they push (0..1).
 */
function openOf(w: number): number {
  return (rowCurve(w) + 1) / 2;
}
function thrustOf(w: number): number {
  const f = (((w / TAU) % 1) + 1) % 1;
  return f < 0.3 ? Math.sin((Math.PI * f) / 0.3) : 0;
}

/** the motion that goes with each drive */
const DRIVE_MOTION: Record<string, string> = { pull: 'none', paddle: 'row', walk: 'row', ripple: 'wave' };

function rowCurve(w: number): number {
  const f = (((w / TAU) % 1) + 1) % 1;
  if (f < 0.3) { const u = f / 0.3; return 1 - 2 * u * u * (3 - 2 * u); }
  const u = (f - 0.3) / 0.7;
  return -1 + 2 * u * u * (3 - 2 * u);
}

export interface Creature3Options {
  /** first direction of the body (unit); default: heading right */
  dir?: V;
  phase?: number;
  scale?: number;
  /** rooted in the sea floor: direction of the first link, and azimuth of its plane */
  anchor?: { dir: V; plane: number };
}

export class Creature3 {
  spec: Spec;
  pal: PaletteSlot[];
  phase: number;
  vx = 0; vy = 0; vz = 0;
  list: Seg3[] = [];
  box: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  root: Seg3;
  dartT = 0;
  dartWait = 1;
  /** all in one plane (plants): the 2D rules; false: free 3D (animals) */
  planar: boolean;
  /** which way the belly faces when a part runs along the body's own down (last horizontal direction) */
  side: V = v3(0, 0, 1);
  /**
   * The body's own down: the world's down for a level body, tilted with its
   * pitch (forward when the head points straight up), so that the belly, the
   * bend plane and the limbs turn with the body all the way to the vertical.
   * A bell keeps the world's down.
   */
  down: V = v3(0, 1, 0);
  /**
   * Heading of the head. yaw is the angle about the vertical axis: 0 faces
   * right, +-pi faces left, and a half turn between them goes one way round or
   * the other, at random (see turnError): through pi/2, its back to the eye,
   * or through -pi/2, its face to the eye. pitch is the nose up/down (positive = down).
   */
  yaw = 0; pitch = 0; yawGoal = 0; private yawVel = 0; private pitchVel = 0;
  /** the half turn under way: which way round (+1: yaw grows, -1: it falls, 0: none), toward which goal */
  private turnWay = 0; private turnGoal = 0;
  /** how quickly the heading follows (rad/s of a critically damped spring): about 0.35 s for a half turn */
  turnW = 13;
  private heading3 = v3(1, 0, 0);
  /** how it moves: the species' own, or 'crawl' while a walker is on the floor (see ground) */
  mode: SwimMode;
  /** the time of its own gait (crawl): runs fast when it moves and slowly when it stands, so the legs only step when it goes */
  clock = 0;
  /** how high the lowest point of a walker is above the floor (stand); a walker that has met no floor is in open water */
  gap = Infinity;
  /** a walker told to go up: the floor lets it go */
  private rising = false;
  /** power stroke of a jet or of a bell, 0..1: the parts that answer to it (recoil) read it */
  stroke = 0;
  /** how open the pulling arms are (0..1) */
  open = 0;
  private leanX = 0; private leanZ = 0; private leanVX = 0; private leanVZ = 0;
  /** jet: the arms lead (parachute) */
  private rear = false;
  /** the parts that push the animal along (drive pull), read for the power of its jets */
  drivers: Seg3[] = [];

  constructor(sp: Spec, x: number, y: number, z: number, o: Creature3Options = {}) {
    this.spec = sp;
    this.mode = sp.swim.mode;
    this.pal = palette(sp.palette);
    this.phase = o.phase === undefined ? rand(0, TAU) : o.phase;
    this.planar = !!o.anchor;
    const slot = { ...ROOT_SLOT, phase: this.phase };
    let dir = o.dir || v3(-1, 0, 0), nb = v3(0, 0, 1);
    if (o.anchor) {
      dir = { ...o.anchor.dir };
      const a = o.anchor.plane;
      nb = v3(-Math.sin(a), 0, Math.cos(a));
    } else {
      // the body starts as a chain running behind the head: dir is the way the head points, links run the opposite way
      dir = v3(-dir.x, -dir.y, -dir.z);
      cross(dir, DOWN, nb); if (Math.hypot(nb.x, nb.y, nb.z) < 0.2) nb = v3(0, 0, 1); else norm(nb);
    }
    if (!o.anchor && o.dir) { this.yaw = this.yawGoal = o.dir.x >= 0 ? 0 : Math.PI; }
    this.root = new Seg3(sp.body, null, null, slot, 1, (o.scale || 1) * (sp.size || 1), v3(x, y, z), dir, nb, this);
    if (o.anchor) this.root.anchor = { ...dir };
    this.refresh();
  }

  refresh(): void {
    this.list.length = 0;
    this.root.walk((s) => this.list.push(s));
    this.drivers = this.list.filter((s) => s.def.drive === 'pull');
  }

  update(time: number, dvx: number, dvy: number, dvz: number, accel: number): void {
    this.vx += (dvx - this.vx) * accel;
    this.vy += (dvy - this.vy) * accel;
    this.vz += (dvz - this.vz) * accel;
    const r = this.root;
    r.ox[0] = r.x[0]; r.oy[0] = r.y[0]; r.oz[0] = r.z[0];
    r.x[0] += this.vx; r.y[0] += this.vy; r.z[0] += this.vz;
    // remember which side the belly faces when swimming straight up or down
    const hl = Math.hypot(this.vx, this.vz);
    if (hl > 0.4) { this.side.x = this.vz / hl; this.side.z = -this.vx / hl; }
    r.update(time);
    const b = this.box;
    b[0] = b[1] = b[2] = Infinity; b[3] = b[4] = b[5] = -Infinity;
    for (const s of this.list) {
      const c = s.box;
      if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[2] < b[2]) b[2] = c[2];
      if (c[3] > b[3]) b[3] = c[3]; if (c[4] > b[4]) b[4] = c[4]; if (c[5] > b[5]) b[5] = c[5];
    }
  }

  /**
   * Swim toward the direction (dvx, dvy) at that speed. The head turns toward
   * it with a spring, so a change of direction is a smooth swing of the whole
   * animal (through the depth for a right/left turn), never a jump. `dvz` is an
   * extra pull along z (to return to its plane); the speed drops while turning.
   */
  steer(time: number, dvx: number, dvy: number, dvz: number, accel: number): void {
    switch (this.mode) {
      case 'bell': this.steerBell(time, dvx, dvy, dvz, accel); break;
      case 'jet': this.steerJet(time, dvx, dvy, dvz, accel); break;
      case 'crawl': this.steerCrawl(time, dvx, dvy, dvz, accel); break;
      default: this.steerGlide(time, dvx, dvy, dvz, accel);
    }
  }

  /** put a walker on the floor or in the water: an octopus (swim.walk) walks on the floor, and jets in the water */
  ground(on: boolean): void {
    if (this.spec.swim.mode === 'crawl') return;
    this.mode = on && this.spec.swim.walk ? 'crawl' : this.spec.swim.mode;
  }

  /**
   * Walkers stand on the floor (at height floorY) by the lowest point of their
   * body, the legs, not by their root; an octopus (swim.walk) walks when it
   * touches the floor and swims again when it leaves it. Call after steer.
   */
  stand(floorY: number): void {
    if (this.mode !== 'crawl' && !this.spec.swim.walk) return;
    const gap = floorY - this.box[4];
    this.gap = gap;
    if (this.mode !== 'crawl') { if (gap < 6) this.ground(true); }
    else if (this.spec.swim.walk && gap > 14) this.ground(false);
    // it follows the floor and never goes through it, but lets go of it when it swims up
    if (this.mode === 'crawl' && gap < 40 && (gap < 0 || !this.rising)) this.root.y[0] += gap * (gap < 0 ? 0.4 : 0.15);
  }

  /** the power stroke (0..1) of the pulse of the trunk at this time */
  private beat(time: number): number {
    // the arms that pull are what pushes: the power is theirs, on their own phases
    if (this.drivers.length) {
      const f = this.spec.swim.freq;
      let sum = 0, op = 0;
      for (const s of this.drivers) { const w = TAU * f * time + this.phase + s.phase; sum += thrustOf(w); op += openOf(w); }
      this.open = op / this.drivers.length;
      return sum / this.drivers.length;
    }
    const m = this.root.def.motion, f = m.type === 'pulse' || m.type === 'breathe' ? m.freq : this.spec.swim.freq;
    const c = -Math.cos(TAU * f * time + this.phase);
    return c > 0 ? c * c : 0;
  }

  /** spring on an angle (critically damped): returns the new value, the velocity is written in vel[0] */
  private spring(x: number, goal: number, vel: number, w: number): [number, number] {
    vel += (w * w * (goal - x) - 2 * w * vel) * STEP;
    return [x + vel * STEP, vel];
  }

  /**
   * The yaw follows yawGoal on a spring. A half turn started at rest (from
   * right to left, or back) draws which way round it goes and keeps to it until
   * it is past the side, unless it is told somewhere else; one started while
   * turning goes the shortest way. Returns the angle left to turn.
   */
  private turnYaw(w: number): number {
    if (this.turnWay && Math.abs(wrapAngle(this.yawGoal - this.turnGoal)) > 1) this.turnWay = 0;
    if (!this.turnWay && Math.abs(this.yawVel) < 1 && Math.abs(wrapAngle(this.yawGoal - this.yaw)) > HALF_TURN) {
      this.turnWay = Math.random() < 0.5 ? 1 : -1;
      this.turnGoal = this.yawGoal;
    }
    const err = turnError(this.yaw, this.yawGoal, this.turnWay);
    if (Math.abs(err) < HALF_TURN) this.turnWay = 0;
    this.yawVel += (w * w * err - 2 * w * this.yawVel) * STEP;
    this.yaw = wrapAngle(this.yaw + this.yawVel * STEP);
    return err;
  }

  private aim(h: V, pitch: number, yaw: number): void {
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    h.x = cp * cy; h.y = sp; h.z = cp * sy;
    // the belly turns with the pitch: d(heading)/d(pitch)
    const d = this.down;
    d.x = -sp * cy; d.y = cp; d.z = -sp * sy;
    this.root.headDir = h;
  }

  /**
   * A bell (jellyfish): the axis is nearly vertical, bell up, and never turns
   * from left to right: there is no profile. It pushes itself along its axis at
   * every contraction and drifts between two; to go sideways it leans that way, to
   * go down it only lets itself sink; no pulse is wasted when it is idle.
   */
  private steerBell(time: number, dvx: number, dvy: number, dvz: number, accel: number): void {
    const sp = Math.hypot(dvx, dvy), base = this.spec.swim.speed * 0.3;
    this.stroke = this.beat(time);
    const hx = sp > 0.05 ? dvx / sp : 0;
    const want = sp > 0.05 ? sp * clamp(1 - (Math.max(0, dvy) / sp) * 1.6, 0, 1) : base;
    // lean toward where it goes (about 45 degrees at most), and toward its plane in depth
    const gx = clamp(hx * 0.9 * Math.min(1, sp * 1.2), -0.75, 0.75), gz = clamp(dvz * 0.6, -0.4, 0.4);
    [this.leanX, this.leanVX] = this.spring(this.leanX, gx, this.leanVX, 5);
    [this.leanZ, this.leanVZ] = this.spring(this.leanZ, gz, this.leanVZ, 5);
    const h = this.heading3;
    h.x = Math.sin(this.leanX); h.z = Math.sin(this.leanZ);
    h.y = -Math.sqrt(Math.max(0.05, 1 - h.x * h.x - h.z * h.z));
    norm(h);
    this.root.headDir = h;
    const push = want * (0.1 + 3.6 * this.stroke);
    // it sinks a little (and faster when it has to go down)
    const sink = 0.16 + clamp(dvy, 0, 1.2) * 0.35;
    this.update(time, h.x * push, h.y * push + sink, h.z * push + dvz * 0.5, accel);
  }

  /**
   * A jet swimmer (octopus, squid): it moves mantle first, the arms trailing
   * behind, and shoots forward at every contraction, then coasts. It turns
   * a little toward the eye (3/4 view, never a flat profile) and may go straight
   * up or down; going down it turns round and falls arms first, like a parachute.
   */
  private steerJet(time: number, dvx: number, dvy: number, dvz: number, accel: number): void {
    const sp = Math.hypot(dvx, dvy);
    this.stroke = this.beat(time);
    let pitchGoal = 0;
    if (sp > 0.05) {
      if (dvy > 0.6 * sp) this.rear = true; else if (dvy < 0.25 * sp) this.rear = false;
      const p = clamp(Math.atan2(dvy, Math.max(Math.abs(dvx), 0.12)), -1.45, 1.45);
      pitchGoal = this.rear ? -p : p;
      if (Math.abs(dvx) > 0.2 * sp) this.yawGoal = (dvx > 0) !== this.rear ? 0.3 : Math.PI - 0.3;
    }
    const w = this.turnW * 0.7;
    this.turnYaw(w);
    [this.pitch, this.pitchVel] = this.spring(this.pitch, pitchGoal, this.pitchVel, w * 0.8);
    const h = this.heading3;
    this.aim(h, this.pitch, this.yaw);
    const align = Math.max(0, Math.cos(this.yawGoal - this.yaw)) * Math.max(0, Math.cos(pitchGoal - this.pitch));
    const speed = sp * (this.drivers.length ? 0.15 + 4.2 * this.stroke : 0.1 + 3.6 * this.stroke) * (0.2 + 0.8 * align) * (this.rear ? -0.7 : 1);
    this.update(time, h.x * speed, h.y * speed, dvz, accel);
  }

  /**
   * Walking on the floor: the animal turns on the spot toward where it goes,
   * all the way round (through the depth, toward the eye as well), seen in
   * 3/4. Its own clock, and so its gait, runs with its speed. `swim.posture` is
   * the pitch of its head end (an octopus stands its mantle up) and `swim.rear`
   * makes the tail end lead (arms first). Told to go up it swims, its legs
   * paddling and its head toward where it goes, up to straight up; off the
   * floor it may dive, head first, and levels out before it lands.
   */
  private steerCrawl(_time: number, dvx: number, dvy: number, dvz: number, accel: number): void {
    const sw = this.spec.swim, moving = Math.hypot(dvx, dvz * 3) > 0.05;
    if (moving) {
      // toward the eye a little, so that the legs show
      const gz = dvz * 3 - 0.6 * Math.abs(dvx);
      this.yawGoal = Math.atan2(gz, dvx) + (sw.rear ? Math.PI : 0);
    }
    const w = this.turnW * 0.6;
    const err = this.turnYaw(w);
    const face = Math.max(0, Math.cos(err));
    const vx = dvx * (0.15 + 0.85 * face), vz = dvz * 0.5;
    // a walker only leaves the floor when it is told to go up; otherwise it falls back and follows the floor
    const vy = crawlRise(dvy, this.gap);
    this.rising = vy < 0;
    [this.pitch, this.pitchVel] = this.spring(this.pitch, crawlPitch(vx, dvy, this.gap, sw), this.pitchVel, w);
    this.aim(this.heading3, this.pitch, this.yaw);
    // the legs step with its speed on the floor, and paddle with it in the water
    const sp = this.gap > AFLOAT ? Math.hypot(this.vx, this.vy, this.vz) : Math.hypot(this.vx, this.vz);
    this.clock += STEP * (0.1 + Math.min(1.8, sp * 1.1));
    this.update(this.clock, vx, vy, vz, accel);
  }

  private steerGlide(time: number, dvx: number, dvy: number, dvz: number, accel: number): void {
    const sp = Math.hypot(dvx, dvy);
    let pitchGoal = 0;
    if (sp > 0.05) {
      if (Math.abs(dvx) > 0.2 * sp) this.yawGoal = dvx > 0 ? 0 : Math.PI;
      pitchGoal = clamp(Math.atan2(dvy, Math.max(Math.abs(dvx), 0.15)), -PITCH_MAX, PITCH_MAX);
      // an upright swimmer (seahorse) keeps its head up and only leans a little
      if (this.spec.swim.posture !== undefined) pitchGoal = this.spec.swim.posture + pitchGoal * 0.25;
    }
    else if (this.spec.swim.posture !== undefined) pitchGoal = this.spec.swim.posture;
    const w = this.turnW;
    this.turnYaw(w);
    this.pitchVel += (w * 0.8 * w * 0.8 * (pitchGoal - this.pitch) - 2 * w * 0.8 * this.pitchVel) * STEP;
    this.pitch += this.pitchVel * STEP;
    const h = this.heading3;
    this.aim(h, this.pitch, this.yaw);
    const align = Math.max(0, Math.cos(this.yawGoal - this.yaw));
    const speed = sp * (0.25 + 0.75 * align);
    // an upright body does not go where its head points: it goes where it is told
    if (this.spec.swim.posture !== undefined) this.update(time, dvx * (0.25 + 0.75 * align), dvy, dvz, accel);
    else this.update(time, h.x * speed, h.y * speed, h.z * speed + dvz, accel);
  }

  /** direction the head points */
  heading(out: V): V {
    const r = this.root;
    out.x = -r.dx[1]; out.y = -r.dy[1]; out.z = -r.dz[1];
    return out;
  }

  /** move every node at once (teleport, spawn) */
  translate(dx: number, dy: number, dz: number): void {
    for (const s of this.list) {
      for (let i = 0; i <= s.n; i++) {
        s.x[i] += dx; s.ox[i] += dx; s.y[i] += dy; s.oy[i] += dy; s.z[i] += dz; s.oz[i] += dz;
      }
    }
  }
}

/** a change of heading larger than this (a little more than a quarter turn) is a half turn, which may go either way round */
export const HALF_TURN = 1.6;

/** the steepest a swimmer points its head (rad, about 86 degrees): nearly straight up or down */
export const PITCH_MAX = 1.5;

/** a walker whose legs are higher than this above the floor is in the water */
export const AFLOAT = 14;

/**
 * The vertical speed of a walker told dvy, `gap` above the floor: it rises when
 * told to go up, dives when told to go down in open water, and otherwise sinks
 * slowly back to the floor.
 */
export function crawlRise(dvy: number, gap: number): number {
  if (dvy < -0.3) return dvy;
  return gap > AFLOAT ? Math.max(0.5, dvy) : 0.5;
}

/**
 * The pitch a walker aims for, told (vx, dvy), `gap` above the floor: its
 * posture on the floor and while it sinks back; when it swims, its head toward
 * where it goes, up to PITCH_MAX. Diving, it levels out over the last 120 px,
 * to land on its legs. An animal that swims its own way once off the floor (an
 * octopus jets) keeps its posture.
 */
export function crawlPitch(vx: number, dvy: number, gap: number, sw: SwimDef): number {
  const up = dvy < -0.3, dive = !up && gap > AFLOAT && dvy > 0.5;
  if (sw.mode !== 'crawl' || (!up && !dive)) return sw.posture || 0;
  const p = clamp(Math.atan2(dvy, Math.max(Math.abs(vx), 0.15)), -PITCH_MAX, PITCH_MAX);
  return dive ? p * clamp((gap - AFLOAT) / 120, 0, 1) : p;
}

/**
 * The angle to turn from yaw to goal: the shortest, or, when a half turn is
 * under way (way = +1 or -1), the one that goes that way round.
 */
export function turnError(yaw: number, goal: number, way: number): number {
  const e = wrapAngle(goal - yaw);
  return way && e * way < 0 ? e + way * TAU : e;
}

/** speed multiplier given by the way the species swims */
export function swimFactor3(cr: Creature3, t: number): number {
  // the bells, jets and walkers shape their own speed
  if (cr.mode === 'bell' || cr.mode === 'jet' || cr.mode === 'crawl') return 1;
  const s = cr.spec.swim;
  if (s.mode === 'pulse') {
    const m = cr.root.def.motion, f = m.type === 'pulse' ? m.freq : s.freq;
    const c = -Math.cos(TAU * f * t + cr.phase);
    return 0.2 + 2.2 * (c > 0 ? c * c : 0);
  }
  if (s.mode === 'dart') {
    cr.dartT -= STEP;
    if (cr.dartT < -cr.dartWait) { cr.dartT = 0.22; cr.dartWait = rand(0.5, 1.6); }
    return cr.dartT > 0 ? 3 : 0.45;
  }
  return 1;
}

/** let a freshly built creature settle in its rest pose */
export function settle3(cr: Creature3, steps = 420): void {
  for (let t = 0; t < steps; t++) cr.update(t * STEP, 0, 0, 0, 1);
  for (const s of cr.list) for (let i = 0; i <= s.n; i++) { s.ox[i] = s.x[i]; s.oy[i] = s.y[i]; s.oz[i] = s.z[i]; }
}
