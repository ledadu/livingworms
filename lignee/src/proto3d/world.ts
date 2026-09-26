// The 3D sea for the prototype: a lagoon (the Nurserie) that ends in a
// drop-off, with sand, rocks, a sea-grass meadow, kelp, sargassum rafts at the
// surface, light shafts, plankton and the surface itself.

import * as THREE from 'three';
import { TAU, clamp, lerp, rng } from '../engine';
import { causticTile } from '../game/bake';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ----- 2D value noise ----- //

function h2(x: number, y: number, s: number): number {
  let v = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x: number, y: number, s = 1): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export const BOUNDS = { x0: -900, x1: 4300, z0: -1000, z1: 520 };
export const DROP_X = 2400;

/** the rise of the reef wall behind the swimming plane (0 in front) */
function backWall(x: number, z: number): number {
  const t = smooth(clamp((-z - 220) / 380, 0, 1));
  return t * (150 + noise2(x / 180, 7, 61) * 170 + (noise2(x / 45, z / 45, 62) - 0.5) * 30);
}

/** height of the sea floor (y up, surface at 0); the swimmer's plane is z = 0 */
export function floorAt(x: number, z: number): number {
  const drop = smooth(clamp((x - DROP_X) / 520, 0, 1));
  const lagoon = -250 + (noise2(x / 260, z / 260, 3) - 0.5) * 60 + (noise2(x / 70, z / 70, 4) - 0.5) * 10;
  const deep = -820 + (noise2(x / 300, z / 300, 5) - 0.5) * 120;
  const edge = Math.max(0, -x - 600) * 0.6;
  return Math.min(-6, lerp(lagoon, deep, drop) + backWall(x, z) * (1 - drop * 0.5) + edge);
}

// ----- palette ----- //

export const WATER = {
  shallow: new THREE.Color('#2fc4c9'),
  deep: new THREE.Color('#0a3a55'),
  sky: new THREE.Color('#dff8ff'),
  sand: new THREE.Color('#d8c08a'),
  sandDark: new THREE.Color('#9c8458'),
  rock: new THREE.Color('#7b7266'),
  moss: new THREE.Color('#6f8f3a')
};

// ----- caustics: injected into lit materials ----- //

export const shared = {
  time: { value: 0 },
  caustic: { value: null as THREE.Texture | null },
  player: { value: new THREE.Vector3() }
};

export function withCaustics<T extends THREE.Material>(m: T, strength = 1): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.uniforms.uCaustic = shared.caustic;
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uTime; uniform sampler2D uCaustic; varying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      vec2 cuv = vWPos.xz / 95.0;
      float c1 = texture2D(uCaustic, cuv * 1.0 + vec2(uTime * 0.035, uTime * 0.02)).a;
      float c2 = texture2D(uCaustic, cuv * 1.37 + vec2(-uTime * 0.028, uTime * 0.031)).a;
      float caus = min(c1, c2) * 2.2 + c1 * c2 * 1.5;
      float depthFade = exp(vWPos.y / 260.0);
      outgoingLight += vec3(1.0, 0.98, 0.85) * caus * ${strength.toFixed(2)} * depthFade * 0.22;
      #include <opaque_fragment>`);
  };
  return m;
}

// ----- terrain ----- //

export function makeTerrain(): THREE.Mesh {
  const W = BOUNDS.x1 - BOUNDS.x0, D = BOUNDS.z1 - BOUNDS.z0, step = 9;
  const nx = Math.round(W / step), nz = Math.round(D / step);
  const geo = new THREE.PlaneGeometry(W, D, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate(BOUNDS.x0 + W / 2, 0, BOUNDS.z0 + D / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute, n = pos.count;
  const col = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = floorAt(x, z);
    pos.setY(i, y);
    // ripples, crossed by patches of darker sand and rock
    const warp = noise2(x / 90, z / 90, 9) * 6;
    const rip = 0.5 + 0.5 * Math.sin((x * 0.55 + z * 0.2) / 3.2 + warp);
    const patch = noise2(x / 140, z / 140, 11);
    c.copy(WATER.sand).lerp(WATER.sandDark, 0.25 + rip * 0.25 + patch * 0.3);
    const rocky = Math.max(smooth(clamp((x - DROP_X + 60) / 300, 0, 1)), smooth(clamp((-z - 260) / 200, 0, 1)) * 0.9);
    c.lerp(WATER.rock, rocky * 0.8);
    if (patch > 0.68 && rocky < 0.3) c.lerp(WATER.moss, (patch - 0.68) * 2);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 1);
  return new THREE.Mesh(geo, mat);
}

// ----- rocks ----- //

export interface Rock { x: number; z: number; r: number; top: number; cy: number; }

export function makeRocks(): { mesh: THREE.Mesh; rocks: Rock[] } {
  const R = rng(77), geos: THREE.BufferGeometry[] = [], rocks: Rock[] = [];
  const c = new THREE.Color();
  for (let k = 0; k < 150; k++) {
    const x = BOUNDS.x0 + 200 + R() * (BOUNDS.x1 - BOUNDS.x0 - 400), z = -800 + R() * 1000;
    if (Math.abs(x) < 200 && Math.abs(z) < 120) continue;
    const big = x > DROP_X - 100 ? 1.8 : 1;
    const r = (10 + R() * 26) * big * (R() < 0.12 ? 2.2 : 1);
    const g0 = new THREE.IcosahedronGeometry(r, 4);
    g0.deleteAttribute('normal'); g0.deleteAttribute('uv');
    const g = mergeVertices(g0);
    const p = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3), seed = Math.floor(R() * 1000);
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const d = 1 + (noise2(vx / 9 + seed, vz / 9 + vy / 9, 21) - 0.5) * 0.5 + (noise2(vx / 3 + seed, vy / 3, 22) - 0.5) * 0.12;
      p.setXYZ(i, vx * d, vy * d * 0.62, vz * d);
      const up = vy / r;
      c.copy(WATER.rock).multiplyScalar(0.75 + noise2(vx / 4 + seed, vz / 4, 23) * 0.5);
      if (up > 0.35 && x < DROP_X) c.lerp(WATER.moss, (up - 0.35) * 1.4);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const y = floorAt(x, z);
    g.translate(x, y + r * 0.2, z);
    g.computeVertexNormals();
    geos.push(g);
    rocks.push({ x, z, r, top: y + r * 0.82, cy: y + r * 0.2 });
  }
  const merged = mergeGeometries(geos);
  const mesh = new THREE.Mesh(merged, withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.8));
  return { mesh, rocks };
}

/** minimal merge (positions, normals, colors, indices) */
function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let v = 0, i = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array as Float32Array, v * 3);
    nor.set(g.attributes.normal.array as Float32Array, v * 3);
    col.set(g.attributes.color.array as Float32Array, v * 3);
    const n = g.attributes.position.count;
    if (g.index) { const a = g.index.array; for (let k = 0; k < a.length; k++) idx[i++] = a[k] + v; }
    else for (let k = 0; k < n; k++) idx[i++] = v + k;
    v += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// ----- sea grass: thousands of blades bent in the vertex shader ----- //

export function makeMeadow(rocks: Rock[]): THREE.Mesh {
  const R = rng(5), SEG = 4;
  const pos: number[] = [], root: number[] = [], tt: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new THREE.Color(), base = new THREE.Color('#5f8a2c'), tip = new THREE.Color('#b9c95a');
  let v = 0, blades = 0;
  for (let tries = 0; tries < 80000 && blades < 12000; tries++) {
    const x = -700 + R() * (DROP_X + 500), z = -500 + R() * 800;
    const m = noise2(x / 230, z / 230, 31);
    if (m < 0.5 || R() > (m - 0.5) * 3) continue;
    if (rocks.some((r) => Math.hypot(r.x - x, r.z - z) < r.r * 0.9)) continue;
    const y = floorAt(x, z), h = 10 + R() * 18 + (m - 0.5) * 30, w = 1.1 + R() * 0.8, a = R() * TAU;
    const lean = (R() - 0.5) * 0.6;
    const ca = Math.cos(a), sa = Math.sin(a);
    const shade = 0.75 + R() * 0.4;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG, ww = w * (1 - t * 0.85);
      for (const sd of [-1, 1]) {
        pos.push(x + ca * ww * sd + lean * t * h * sa, y + t * h, z + sa * ww * sd - lean * t * h * ca);
        root.push(x, y, z, h);
        tt.push(t);
        c.copy(base).lerp(tip, t).multiplyScalar(shade);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let k = 0; k < SEG; k++) {
      const a0 = v + k * 2;
      idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
    }
    v += (SEG + 1) * 2;
    blades++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aRoot', new THREE.Float32BufferAttribute(root, 4));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.uniforms.uPlayer = shared.player;
    sh.vertexShader = 'uniform float uTime; uniform vec3 uPlayer; attribute vec4 aRoot; attribute float aT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 mid = aRoot.xyz + vec3(0.0, aRoot.w * 0.6, 0.0);
      vec3 d3 = mid - uPlayer;
      float dist = length(d3) + 0.001;
      float reach = 30.0 + aRoot.w;
      float near = clamp(1.0 - dist / reach, 0.0, 1.0);
      float bend = aT * aT;
      vec2 dh = d3.xz + vec2(0.001, 0.0);
      vec2 push = normalize(dh) * near * near * aRoot.w * 0.9;
      vec2 sway = vec2(sin(uTime * 0.6 + aRoot.x * 0.03), cos(uTime * 0.45 + aRoot.z * 0.03)) * 1.2;
      transformed.xz += (push + sway) * bend;
      transformed.y -= length(push) * bend * 0.45;`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ----- kelp: vertical verlet chains pushed by swimmers ----- //

export class Kelp {
  n: number;
  px: Float32Array; py: Float32Array; pz: Float32Array;
  ox: Float32Array; oy: Float32Array; oz: Float32Array;
  seg: number;
  base: THREE.Vector3;
  geo: THREE.BufferGeometry;
  mesh: THREE.Mesh;
  leaves: { at: number; a: number; len: number; w: number }[] = [];
  private pos: Float32Array;

  constructor(x: number, z: number, height: number, R: () => number, mat: THREE.Material) {
    const y = floorAt(x, z);
    this.base = new THREE.Vector3(x, y, z);
    this.n = Math.max(6, Math.round(height / 9));
    this.seg = height / this.n;
    const N = this.n + 1;
    this.px = new Float32Array(N); this.py = new Float32Array(N); this.pz = new Float32Array(N);
    this.ox = new Float32Array(N); this.oy = new Float32Array(N); this.oz = new Float32Array(N);
    const lean = (R() - 0.5) * 0.4, la = R() * TAU;
    for (let i = 0; i < N; i++) {
      const t = i / this.n;
      this.px[i] = this.ox[i] = x + Math.cos(la) * lean * t * height;
      this.py[i] = this.oy[i] = y + t * height;
      this.pz[i] = this.oz[i] = z + Math.sin(la) * lean * t * height;
    }
    for (let i = 2; i <= this.n; i++) {
      this.leaves.push({ at: i, a: (i % 2 ? 1 : -1) * (0.9 + R() * 0.5) + R() * 0.4, len: 14 + R() * 10, w: 4 + R() * 3 });
    }
    // stipe: 4-sided tube; leaves: 3 quads each
    const nStipe = N * 4, nLeaf = this.leaves.length * 8;
    this.pos = new Float32Array((nStipe + nLeaf) * 3);
    const col = new Float32Array((nStipe + nLeaf) * 3), idx: number[] = [];
    const stipe = new THREE.Color('#8a7a2e'), leaf = new THREE.Color('#9aa83a'), leafTip = new THREE.Color('#c9b85a');
    for (let i = 0; i < N; i++) for (let j = 0; j < 4; j++) col.set([stipe.r, stipe.g, stipe.b], (i * 4 + j) * 3);
    for (let i = 0; i < this.n; i++) for (let j = 0; j < 4; j++) {
      const a = i * 4 + j, b = i * 4 + ((j + 1) % 4);
      idx.push(a, a + 4, b, b, a + 4, b + 4);
    }
    const c = new THREE.Color();
    this.leaves.forEach((_, k) => {
      const v0 = nStipe + k * 8;
      for (let q = 0; q < 4; q++) {
        c.copy(leaf).lerp(leafTip, q / 3).multiplyScalar(0.8 + ((k * 37) % 10) / 25);
        col.set([c.r, c.g, c.b], (v0 + q * 2) * 3);
        col.set([c.r, c.g, c.b], (v0 + q * 2 + 1) * 3);
      }
      for (let q = 0; q < 3; q++) { const a = v0 + q * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.sync(0);
  }

  update(pushers: { x: number; y: number; z: number; r: number }[], t: number): void {
    const n = this.n, px = this.px, py = this.py, pz = this.pz, ox = this.ox, oy = this.oy, oz = this.oz;
    const cur = Math.sin(t * 0.3 + this.base.x * 0.01) * 0.004;
    for (let i = 1; i <= n; i++) {
      const vx = (px[i] - ox[i]) * 0.9, vy = (py[i] - oy[i]) * 0.9, vz = (pz[i] - oz[i]) * 0.9;
      ox[i] = px[i]; oy[i] = py[i]; oz[i] = pz[i];
      px[i] += vx + cur; py[i] += vy + 0.06; pz[i] += vz;
      if (py[i] > -2) py[i] = -2;
      for (const p of pushers) {
        const dx = px[i] - p.x, dy = py[i] - p.y, dz = pz[i] - p.z, d2 = dx * dx + dy * dy + dz * dz, R = p.r + 6;
        if (d2 < R * R) { const d = Math.sqrt(d2) + 0.01, k = ((R - d) / d) * 0.5; px[i] += dx * k; pz[i] += dz * k; py[i] += dy * k * 0.3; }
      }
    }
    // length constraints, a few passes
    for (let it = 0; it < 3; it++) {
      px[0] = this.base.x; py[0] = this.base.y; pz[0] = this.base.z;
      for (let i = 1; i <= n; i++) {
        const dx = px[i] - px[i - 1], dy = py[i] - py[i - 1], dz = pz[i] - pz[i - 1];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, k = (d - this.seg) / d;
        if (i > 1) { px[i - 1] += dx * k * 0.5; py[i - 1] += dy * k * 0.5; pz[i - 1] += dz * k * 0.5; px[i] -= dx * k * 0.5; py[i] -= dy * k * 0.5; pz[i] -= dz * k * 0.5; }
        else { px[i] -= dx * k; py[i] -= dy * k; pz[i] -= dz * k; }
      }
    }
    this.sync(t);
  }

  sync(t: number): void {
    const pos = this.pos, n = this.n, r = 1.3;
    for (let i = 0; i <= n; i++) {
      const rr = r * (1 - (i / n) * 0.4);
      const o = [[rr, 0], [0, rr], [-rr, 0], [0, -rr]];
      for (let j = 0; j < 4; j++) pos.set([this.px[i] + o[j][0], this.py[i], this.pz[i] + o[j][1]], (i * 4 + j) * 3);
    }
    const v00 = (n + 1) * 4;
    this.leaves.forEach((L, k) => {
      const i = L.at, a = L.a + Math.sin(t * 0.7 + k) * 0.08;
      const dx = Math.cos(a), dz = Math.sin(a);
      // leaves float up and out, slightly droopy
      for (let q = 0; q < 4; q++) {
        const u = q / 3, w = L.w * Math.sin(Math.PI * (0.15 + u * 0.85)) * 0.5 + 0.3;
        const cx = this.px[i] + dx * L.len * u, cz = this.pz[i] + dz * L.len * u, cy = this.py[i] + L.len * u * 0.35 - u * u * 3;
        pos.set([cx - dz * w, cy, cz + dx * w], (v00 + k * 8 + q * 2) * 3);
        pos.set([cx + dz * w, cy, cz - dx * w], (v00 + k * 8 + q * 2 + 1) * 3);
      }
    });
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

// ----- sargassum rafts floating at the surface ----- //

export function makeSargassum(): THREE.Mesh {
  const R = rng(9), geos: THREE.BufferGeometry[] = [];
  const gold = new THREE.Color('#c9a23c'), brown = new THREE.Color('#8a6a22');
  for (let k = 0; k < 26; k++) {
    const cx = -500 + R() * 2600, cz = -600 + R() * 800;
    const n = 20 + Math.floor(R() * 40);
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * (30 + R() * 30);
      const bladder = R() < 0.35;
      const g = new THREE.SphereGeometry(1, 8, 5);
      if (bladder) g.scale(1.3 + R(), 1.3, 1.3 + R());
      else { g.scale(3.5 + R() * 3, 0.35, 1.2 + R() * 0.8); g.rotateZ((R() - 0.5) * 0.5); g.rotateY(R() * TAU); }
      g.translate(cx + Math.cos(a) * d, -1.5 - R() * 3, cz + Math.sin(a) * d);
      const p = g.attributes.position, col = new Float32Array(p.count * 3), c = gold.clone().lerp(brown, R());
      for (let v = 0; v < p.count; v++) col.set([c.r, c.g, c.b], v * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(g);
    }
  }
  const m = mergeGeometries(geos);
  return new THREE.Mesh(m, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

// ----- light shafts ----- //

export function makeRays(): THREE.Group {
  const g = new THREE.Group(), R = rng(13);
  for (let k = 0; k < 34; k++) {
    const len = 700, w = 18 + R() * 40;
    const geo = new THREE.PlaneGeometry(w, len, 4, 6);
    const col = new Float32Array(geo.attributes.position.count * 4);
    for (let i = 0; i < geo.attributes.position.count; i++) {
      const y = geo.attributes.position.getY(i), t = (y + len / 2) / len;
      const across = 1 - Math.abs(geo.attributes.position.getX(i)) / (w / 2);
      col.set([1, 0.98, 0.85, 0.2 * t * t * across * across], i * 4);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.translate(0, -len / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(-600 + R() * 3600, 0, -700 + R() * 700);
    m.rotation.set(0.12, (R() - 0.5) * 0.6, 0.3);
    m.userData.phase = R() * TAU;
    g.add(m);
  }
  return g;
}

// ----- plankton around the camera ----- //

export function makePlankton(n = 700): THREE.Points {
  const pos = new Float32Array(n * 3), R = rng(17);
  for (let i = 0; i < n; i++) pos.set([R() * 600 - 300, -R() * 300, R() * 600 - 300], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xfff6d8, size: 2.4, map: glowTexture(), transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

// ----- the surface: seen from above (glints, transparency) and from below (bright, Snell's window) ----- //

export function makeSurface(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(BOUNDS.x1 - BOUNDS.x0 + 2000, BOUNDS.z1 - BOUNDS.z0 + 2000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate((BOUNDS.x0 + BOUNDS.x1) / 2, 0, (BOUNDS.z0 + BOUNDS.z1) / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: shared.time, uShallow: { value: WATER.shallow }, uSky: { value: WATER.sky } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uShallow; uniform vec3 uSky; varying vec3 vW;
      vec2 wav(vec2 p, float t){
        return vec2(sin(p.x*0.045 + t*1.3) + sin(p.y*0.061 - t*1.1)*0.6 + sin((p.x+p.y)*0.13 + t*2.1)*0.25,
                    cos(p.y*0.05 + t*1.2) + cos(p.x*0.07 - t*0.9)*0.6 + cos((p.x-p.y)*0.11 + t*1.8)*0.25);
      }
      void main(){
        vec2 g = wav(vW.xz, uTime) * 0.12;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vW);
        if (gl_FrontFacing) {
          // from above: fresnel reflection of the sky, sun glints, see-through water
          float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          vec3 sun = normalize(vec3(0.35, 1.0, 0.25));
          float spec = pow(max(dot(reflect(-sun, n), v), 0.0), 400.0);
          float sparkle = step(0.985, fract(sin(dot(floor(vW.xz * 0.5), vec2(12.9898, 78.233))) * 43758.5453)) * step(0.6, abs(g.x + g.y) * 4.0);
          vec3 c = mix(uShallow, uSky, 0.2 + fr * 0.6) + (spec + sparkle * 0.6) * 0.8;
          gl_FragColor = vec4(c, 0.05 + fr * 0.45 + spec * 0.5 + sparkle * 0.3);
        } else {
          // from below: bright ceiling, brightest in the window above the eye
          // Snell's window: bright straight up, a mirror of the deep at grazing angles
          float win = smoothstep(0.45, 0.95, abs(dot(n, v)));
          // bright ripples of light on the underside of the waves
          vec2 q = vW.xz * 0.05 + g * 6.0;
          float lines = pow(abs(sin(q.x + sin(q.y * 1.3 + uTime * 0.8))), 12.0) + pow(abs(sin(q.y * 1.1 - uTime * 0.6 + sin(q.x))), 12.0);
          vec3 base = mix(uShallow * 1.05, uSky, 0.3 + win * 0.6);
          vec3 c = base + uSky * lines * 0.35;
          gl_FragColor = vec4(c, 0.92);
        }
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 5;
  return m;
}

// ----- glow sprites ----- //

export function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!, rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function causticTexture(): THREE.Texture {
  const t = new THREE.CanvasTexture(causticTile(256, 7, 5));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
