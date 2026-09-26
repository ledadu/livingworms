// A creature of the whip engine, drawn in 3D. The physics stays in the
// horizontal plane (engine x, y → world x, z); each whip becomes a tube whose
// cross-section is an ellipse: wide and flat for bodies, a thin membrane for
// fins, a fine round tube for filaments. Fins and cilia also beat up and down
// so that the stroke reads from above.

import * as THREE from 'three';
import { Creature, TAU, hash, isMirrored, type Seg } from '../engine';

type RGBA = [number, number, number, number];

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

/** "hsla(h,s%,l%,a)" → linear-ish rgba floats */
export function parseHsla(c: string): RGBA {
  const m = c.match(/-?[\d.]+/g);
  if (!m) return [1, 1, 1, 1];
  const [r, g, b] = hslToRgb(+m[0], +m[1], +m[2]);
  // three works in linear space: approximate sRGB → linear
  return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2), m[3] === undefined ? 1 : +m[3]];
}

type Layer = 0 | 1 | 2; // opaque, translucent, additive

interface Part {
  s: Seg;
  layer: Layer;
  M: number;          // vertices around
  sub: number;        // rings per link (smooth curves)
  thick: number;      // height / width of the section
  minR: number;
  flap: number;       // vertical beat amplitude (fins, cilia)
  lift: number;       // resting height offset
  v0: number;         // first vertex in its layer
  cols: Float32Array; // rgba per vertex
}

interface LayerBuf {
  parts: Part[];
  nv: number;
  geo: THREE.BufferGeometry;
  mesh: THREE.Mesh;
  pos: Float32Array;
  nor: Float32Array;
}

const sphere = new THREE.SphereGeometry(1, 14, 10);
const white = new THREE.MeshBasicMaterial({ color: 0xfbf6ec });
const black = new THREE.MeshBasicMaterial({ color: 0x05080f });
const eyeRim = new THREE.MeshBasicMaterial({ color: 0x0a0e18, side: THREE.BackSide });

/** ink: a slightly inflated copy drawn inside out, in a dark tone of each part's colour */
export const ink = { width: { value: 0.7 } };
function inkMaterial(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  m.customProgramCacheKey = () => 'ink';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uInk = ink.width;
    sh.vertexShader = 'uniform float uInk;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 inkMv = modelViewMatrix * vec4(position, 1.0);
      transformed += normalize(normal) * uInk * clamp(-inkMv.z / 300.0, 0.4, 3.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 0.22;');
  };
  return m;
}
const inkMat = inkMaterial();

export interface MeshOptions {
  /** swims in a vertical plane facing the camera (true), or lies flat on the floor */
  vertical?: boolean;
  /** rings per link: 3 for creatures, less for plants */
  sub?: number;
  outline?: boolean;
}

function classify(s: Seg): { M: number; thick: number; minR: number; flap: number } {
  const d = s.def, role = d.role;
  if (d.style === 'line') return { M: 4, thick: 1, minR: 0.35, flap: role === 'cilia' ? 0.5 : 0 };
  if (d.style === 'eye' || d.style === 'disc') return { M: 8, thick: 0.9, minR: 0.3, flap: 0 };
  if (!s.parent) {
    // bodies: a jelly bell is a dome, the rest are flattened
    return { M: 12, thick: d.shape === 'bell' ? 0.75 : d.style === 'plates' ? 0.7 : 0.6, minR: 0.3, flap: 0 };
  }
  if (role === 'fin') return { M: 8, thick: 0.13, minR: 0.2, flap: 0.35 };
  if (role === 'cilia') return { M: 6, thick: 0.25, minR: 0.2, flap: 0.6 };
  if (d.shape === 'leaf' || d.shape === 'frill') return { M: 8, thick: 0.2, minR: 0.2, flap: 0.15 };
  return { M: 6, thick: 0.8, minR: 0.3, flap: 0.05 };
}

export class CreatureMesh {
  cr: Creature;
  /** place and turn the creature with this one */
  root = new THREE.Group();
  group = new THREE.Group();
  /** height of the creature's plane */
  y = 0;
  /** turn about the vertical axis through the head (eases back to 0 after a turn-around) */
  yaw = 0;
  private layers: LayerBuf[] = [];
  private eyes: THREE.Mesh[] = [];
  private tips: { s: Seg; w: THREE.Mesh; p: THREE.Mesh }[] = [];

  /**
   * vertical: the creature swims in a vertical plane facing the camera (engine y
   * points down); otherwise it lies flat (floor crawlers), engine y along +z.
   */
  constructor(cr: Creature, mats: THREE.Material[], o: MeshOptions = {}) {
    this.cr = cr;
    const vertical = o.vertical !== false, outline = o.outline !== false;
    this.root.add(this.group);
    if (vertical) this.group.rotation.x = Math.PI / 2;
    const parts: Part[][] = [[], [], []];
    for (const s of cr.list) {
      const c = classify(s), d = s.def;
      const cols = s.cols.map(parseHsla);
      const alpha = cols[0][3];
      const layer: Layer = d.color.add ? 2 : alpha < 0.8 || d.color.fade > 0.3 ? 1 : 0;
      const sub = o.sub ? Math.min(o.sub, d.style === 'line' ? 1 : 3) : d.style === 'line' ? (s.n > 12 ? 1 : 2) : s.n > 20 ? 2 : 3, S = s.n * sub;
      const nv = (S + 1) * c.M + 2;
      const col = new Float32Array(nv * 4);
      const pat = parseHsla(s.patCol), edge = parseHsla(s.edgeCol);
      const nb = Math.max(1, Math.round(d.color.pdensity));
      for (let i = 0; i <= S; i++) {
        const t = i / S, band = d.color.pattern === 'bands' && Math.floor(t * nb * 2 - 0.001) % 2 === 1;
        const u = t * s.n, i0 = Math.floor(u), i1 = Math.min(s.n, i0 + 1), f = u - i0, c0 = cols[i0], c1 = cols[i1];
        const lerped: RGBA = [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f, c0[3] + (c1[3] - c0[3]) * f];
        for (let j = 0; j < c.M; j++) {
          const th = (j / c.M) * TAU, up = Math.sin(th), sd = Math.cos(th);
          let rgba: RGBA = lerped;
          const p = d.color.pattern;
          if (band) rgba = pat;
          else if (p === 'stripe' && up > 0.75) rgba = pat;
          else if (p === 'edge' && Math.abs(sd) > 0.85) rgba = pat;
          else if ((p === 'spots' || p === 'ocelli') && up > 0 && hash(i * 31 + j, s.k + 7) < 0.18) rgba = pat;
          // drawn look: flat colour, a soft roll toward the edges, a pale sheen
          // along one flank (the 2D shine), no lighting at all
          let dim = 0.8 + 0.2 * Math.max(0, up);
          if (!vertical && up < -0.3) dim *= 0.7;
          const k = (i * c.M + j) * 4;
          col[k] = rgba[0] * dim; col[k + 1] = rgba[1] * dim; col[k + 2] = rgba[2] * dim; col[k + 3] = rgba[3];
          if (c.M >= 8 && up > 0.35 && sd > 0.1 && sd < 0.75 && d.style !== 'line') {
            col[k] += (1 - col[k]) * 0.3; col[k + 1] += (1 - col[k + 1]) * 0.3; col[k + 2] += (1 - col[k + 2]) * 0.3;
          }
          if (d.style === 'plates' && Math.floor(i / sub) % 2 && up > 0) { col[k] *= 0.8; col[k + 1] *= 0.8; col[k + 2] *= 0.8; }
          void edge;
        }
      }
      // caps
      for (const [vi, ci] of [[nv - 2, 0], [nv - 1, s.n]]) col.set(cols[ci], vi * 4);
      // in profile the far copy of a pair sits behind the body, the near one in front
      const pr = s.parent ? s.parent.maxRad : 0;
      const lift = !s.parent ? 0
        : cr.profile && s.far ? -(pr * 0.55 + 0.6)
          : cr.profile && s.att && isMirrored(s.att) ? pr * 0.45 + 0.4
            : (s.att?.front ? 0.4 : -0.4) * Math.min(3, s.depth);
      parts[layer].push({ s, layer, ...c, sub, lift, v0: 0, cols: col });
      if (d.style === 'eye') {
        const w = new THREE.Mesh(sphere, white), p = new THREE.Mesh(sphere, black);
        this.group.add(w, p);
        this.tips.push({ s, w, p });
      }
    }
    for (let L = 0; L < 3; L++) {
      const list = parts[L];
      if (!list.length) continue;
      let nv = 0;
      const idx: number[] = [];
      for (const p of list) {
        p.v0 = nv;
        const n = p.s.n * p.sub, M = p.M;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < M; j++) {
            const a = nv + i * M + j, b = nv + i * M + ((j + 1) % M), c = a + M, d = b + M;
            idx.push(a, c, b, b, c, d);
          }
        }
        const c0 = nv + (n + 1) * M, c1 = c0 + 1;
        for (let j = 0; j < M; j++) {
          idx.push(c0, nv + ((j + 1) % M), nv + j);
          idx.push(c1, nv + n * M + j, nv + n * M + ((j + 1) % M));
        }
        nv += (n + 1) * M + 2;
      }
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 4);
      for (const p of list) col.set(p.cols, p.v0 * 4);
      // additive parts: both faces of a membrane add up, keep them soft
      if (L === 2) for (let k = 0; k < col.length; k += 4) { col[k] *= 0.45; col[k + 1] *= 0.45; col[k + 2] *= 0.45; }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, mats[L]);
      mesh.frustumCulled = false;
      mesh.renderOrder = L;
      this.group.add(mesh);
      if (outline && L === 0) {
        const o2 = new THREE.Mesh(geo, inkMat);
        o2.frustumCulled = false;
        this.group.add(o2);
      }
      this.layers.push({ parts: list, nv, geo, mesh, pos, nor });
    }
    if (cr.spec.eyes.on) {
      for (let k = 0; k < (cr.profile ? 1 : 2); k++) {
        const w = new THREE.Mesh(sphere, white), p = new THREE.Mesh(sphere, black), rim = new THREE.Mesh(sphere, eyeRim), hl = new THREE.Mesh(sphere, white);
        this.group.add(w, p, rim, hl);
        this.eyes.push(w, p, rim, hl);
      }
    }
  }

  /** rebuild vertex positions from the chains */
  sync(time: number): void {
    const Y = this.y, hx = this.cr.root.x[0];
    this.root.position.x = hx;
    this.group.position.x = -hx;
    this.root.rotation.y = this.yaw;
    for (const L of this.layers) {
      const pos = L.pos, nor = L.nor;
      for (const p of L.parts) {
        const s = p.s, n = s.n, M = p.M, x = s.x, z = s.y, ang = s.ang, rad = s.rad, pl = s.pulse;
        const m = s.def.motion, w = TAU * (m.freq || 1) * time * 1.2 + s.phase;
        const flapAmp = p.flap * s.len * n * 0.12;
        let v = p.v0;
        const S = n * p.sub;
        for (let q = 0; q <= S; q++) {
          const u = q / p.sub, i = Math.min(n - 1, Math.floor(u)), f = q === S ? 1 : u - i;
          // Catmull-Rom through the chain nodes
          const i0 = Math.max(0, i - 1), i2 = i + 1, i3 = Math.min(n, i + 2);
          const f2 = f * f, f3 = f2 * f;
          const b0 = -0.5 * f3 + f2 - 0.5 * f, b1 = 1.5 * f3 - 2.5 * f2 + 1, b2 = -1.5 * f3 + 2 * f2 + 0.5 * f, b3 = 0.5 * f3 - 0.5 * f2;
          const X = x[i0] * b0 + x[i] * b1 + x[i2] * b2 + x[i3] * b3;
          const Z = z[i0] * b0 + z[i] * b1 + z[i2] * b2 + z[i3] * b3;
          const d0 = -1.5 * f2 + 2 * f - 0.5, d1 = 4.5 * f2 - 5 * f, d2 = -4.5 * f2 + 4 * f + 0.5, d3 = 1.5 * f2 - f;
          let tx = x[i0] * d0 + x[i] * d1 + x[i2] * d2 + x[i3] * d3, tz = z[i0] * d0 + z[i] * d1 + z[i2] * d2 + z[i3] * d3;
          if (Math.abs(tx) + Math.abs(tz) < 1e-5) { tx = Math.cos(ang[Math.max(1, i2)]); tz = Math.sin(ang[Math.max(1, i2)]); }
          const tl = Math.hypot(tx, tz), sx = -tz / tl, sz = tx / tl;
          const rr = rad[i] + (rad[i2] - rad[i]) * f, t = u / n;
          const r = Math.max(p.minR, rr * (1 + pl * (s.pulseU ? 1 : t)));
          const W = r, T = r * p.thick * (s.def.shape === 'bell' ? 1 + pl * 1.5 : 1);
          const cy = Y + p.lift + (flapAmp ? Math.sin(w - t * 2.2) * flapAmp * t * s.side : 0)
            + (s.def.shape === 'bell' && !s.parent ? T * 0.6 * (1 - t) : 0);
          for (let j = 0; j < M; j++) {
            const th = (j / M) * TAU, c = Math.cos(th), sn = Math.sin(th);
            const k = v * 3;
            pos[k] = X + sx * c * W;
            pos[k + 1] = cy + sn * T;
            pos[k + 2] = Z + sz * c * W;
            let nx = c * T, ny = sn * W;
            const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
            nor[k] = sx * nx; nor[k + 1] = ny; nor[k + 2] = sz * nx;
            v++;
          }
        }
        // caps: pushed a little outward along the chain
        const a0 = ang[1], an = ang[n];
        let k = v * 3;
        pos[k] = x[0] - Math.cos(a0) * rad[0] * 0.5; pos[k + 1] = Y + p.lift; pos[k + 2] = z[0] - Math.sin(a0) * rad[0] * 0.5;
        nor[k] = -Math.cos(a0); nor[k + 1] = 0; nor[k + 2] = -Math.sin(a0);
        k += 3;
        pos[k] = x[n] + Math.cos(an) * rad[n] * 0.5; pos[k + 1] = pos[(v - 1) * 3 + 1]; pos[k + 2] = z[n] + Math.sin(an) * rad[n] * 0.5;
        nor[k] = Math.cos(an); nor[k + 1] = 0; nor[k + 2] = Math.sin(an);
      }
      L.geo.attributes.position.needsUpdate = true;
      L.geo.attributes.normal.needsUpdate = true;
    }
    for (const e of this.tips) {
      const s = e.s, n = s.n, r = Math.max(0.6, s.rad[n] * 1.1);
      e.w.position.set(s.x[n], Y + 0.5, s.y[n]); e.w.scale.setScalar(r);
      e.p.position.set(s.x[n] + Math.cos(s.ang[n]) * r * 0.45, Y + 0.5 + r * 0.55, s.y[n] + Math.sin(s.ang[n]) * r * 0.45);
      e.p.scale.setScalar(r * 0.55);
    }
    if (this.eyes.length) {
      const e = this.cr.spec.eyes, cr = this.cr, r = cr.root, h = cr.heading(), rad = r.rad[0];
      const fx = Math.cos(h), fz = Math.sin(h);
      if (cr.profile) {
        // one eye on the near side, a little toward the back, looking ahead
        const side = cr.facing >= 0 ? 1 : -1, bx = -side * Math.sin(h), bz = side * Math.cos(h);
        const er = Math.max(1, rad * 0.36 * e.size);
        const ex = r.x[0] + fx * rad * (e.fwd + 0.1) + bx * rad * 0.22, ez = r.y[0] + fz * rad * (e.fwd + 0.1) + bz * rad * 0.22;
        const ey = Y + rad * 0.5;
        this.eyes[0].position.set(ex, ey, ez); this.eyes[0].scale.set(er, er * 0.6, er);
        this.eyes[1].position.set(ex + fx * er * 0.32, ey + er * 0.45, ez + fz * er * 0.32); this.eyes[1].scale.setScalar(er * 0.55);
        this.eyes[2].position.set(ex, ey, ez); this.eyes[2].scale.set(er * 1.18, er * 0.7, er * 1.18);
        this.eyes[3].position.set(ex + fx * er * 0.12 - bx * er * 0.2, ey + er * 0.75, ez + fz * er * 0.12 - bz * er * 0.2); this.eyes[3].scale.setScalar(er * 0.2);
      } else {
        const px = -fz, pz = fx, er = Math.max(0.8, rad * 0.27 * e.size);
        for (let sd = 0; sd < 2; sd++) {
          const sg = sd ? 1 : -1;
          const ex = r.x[0] + fx * rad * e.fwd + px * rad * e.spread * sg;
          const ez = r.y[0] + fz * rad * e.fwd + pz * rad * e.spread * sg;
          const ey = Y + rad * 0.45;
          const e0 = sd * 4;
          this.eyes[e0].position.set(ex, ey, ez);
          this.eyes[e0].scale.setScalar(er);
          this.eyes[e0 + 1].position.set(ex + fx * er * 0.35, ey + er * 0.55, ez + fz * er * 0.35);
          this.eyes[e0 + 1].scale.setScalar(er * 0.55);
          this.eyes[e0 + 2].position.set(ex, ey, ez);
          this.eyes[e0 + 2].scale.setScalar(er * 1.18);
          this.eyes[e0 + 3].position.set(ex, ey + er * 0.8, ez);
          this.eyes[e0 + 3].scale.setScalar(er * 0.2);
        }
      }
    }
  }

  dispose(): void {
    for (const L of this.layers) L.geo.dispose();
    this.root.removeFromParent();
  }
}

/** a three-step light ramp: flat, drawn-looking shading */
export function toonRamp(): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** the three shared materials: opaque, translucent, additive */
export function creatureMaterials(): THREE.Material[] {
  // unlit: the colours are the 2D drawing's own
  const opaque = new THREE.MeshBasicMaterial({ vertexColors: true });
  const trans = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const add = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  return [opaque, trans, add];
}
