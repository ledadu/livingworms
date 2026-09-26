// 3D version, drawn like the 2D one: the creatures swim in profile in
// vertical planes (the player's is z = 0), the plants are the 2D whips set at
// different depths, toon shading and ink outlines, the 2D chapter palettes.
// The camera faces the plane, slightly from above.

import * as THREE from 'three';
import { Creature, Flow, STEP, TAU, clamp, eachGlow, rand, rng, seedOf, settle, swimFactor, type Spec } from '../engine';
import { SPECIES } from '../content';
import { firstAncestor } from '../game/game';
import { Input } from '../game/input';
import { waterAt } from '../game/palette';
import { plantSpec } from '../game/plants';
import { toonRamp } from './mesh';
import { Card, cardGeometry } from './card';
import {
  BOUNDS, REEF_X, causticTexture, col3, floorAt, glowTexture, makeMeadow, makePlankton, makeRays, makeRocks,
  makeSurface, makeTerrain, mood3, noise2, reefT, shared, type Rock
} from './world';
import './style.css';

// ----- settings (kept between visits) ----- //

const settings = { angle: 15, dist: 300 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('lignee3d-side') || '{}')); } catch { /* private mode */ }
const save = () => { try { localStorage.setItem('lignee3d-side', JSON.stringify(settings)); } catch { /* ignore */ } };

// ----- renderer ----- //

const canvas = document.getElementById('sea') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
let quality = 1;
const camera = new THREE.PerspectiveCamera(45, 1, 2, 5000);
function resize(): void {
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1) * quality);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = camera.aspect < 1 ? 55 : 42;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1c7f95, 0.002);
shared.caustic.value = causticTexture();

const hemi = new THREE.HemisphereLight(0xe8fbff, 0x6f6448, 1.1);
const sun = new THREE.DirectionalLight(0xfff4d6, 1.8);
sun.position.set(-0.3, 1, 0.6);
scene.add(hemi, sun);

// ----- world ----- //

scene.add(makeTerrain());
const { mesh: rockMesh, rocks } = makeRocks();
scene.add(rockMesh);
scene.add(makeMeadow(rocks));
const rays = makeRays();
scene.add(rays);
const plankton = makePlankton();
const planktonBase = Float32Array.from(plankton.geometry.attributes.position.array as Float32Array);
scene.add(plankton);
const surface = makeSurface();
scene.add(surface);


// ----- plants: the 2D whips, each in its own vertical plane ----- //

interface Plant { cr: Creature; card: Card; z: number; live: boolean; }
const plants: Plant[] = [];
{
  const R = rng(41);
  const add = (kind: string, x: number, z: number) => {
    const hanging = kind === 'sargasse';
    const y = hanging ? 3 + R() * 4 : -floorAt(x, z) + 3;
    const dir = hanging ? Math.PI / 2 : -Math.PI / 2;
    const tilt = kind === 'kelp' || kind === 'posidonie' || hanging ? 0 : (R() - 0.5) * 0.35;
    const scale = kind === 'kelp' ? 1 + R() * 0.6 : 0.8 + R() * 0.5;
    const sp: Spec = plantSpec(kind, rng(seedOf(Math.round(x), Math.round(z))));
    const cr = new Creature(sp, x, y, { dir: dir + tilt, anchor: dir + tilt, phase: R() * TAU, scale });
    if (kind === 'anemone') for (const sg of cr.list) sg.def.motion.amp *= 0.3;
    settle(cr, kind === 'kelp' || hanging ? 260 : 120);
    const card = new Card(cr, z, cardGeometry);
    scene.add(card.mesh);
    plants.push({ cr, card, z, live: Math.abs(z) < 50 });
  };
  for (let x = -700; x < BOUNDS.x1 - 300; x += 18 + R() * 30) {
    const z = -460 + R() * 560, reef = reefT(x);
    const g = floorAt(x, z);
    if (reef < 0.5) {
      const meadow = noise2(x / 230, z / 230, 31);
      const k = R();
      if (noise2(x / 320, z / 200, 51) > 0.56 && k < 0.5 && z < 30) add('kelp', x, z);
      else if (meadow > 0.55 && k < 0.6) add('posidonie', x, z);
      else if (k < 0.08) add('anemone', x, z);
    } else {
      const k = R();
      if (k < 0.28) add('coral', x, z);
      else if (k < 0.42) add('fan', x, z);
      else if (k < 0.56) add('softcoral', x, z);
      else if (k < 0.66) add('anemone', x, z);
      else if (k < 0.74) add('tubes', x, z);
      else if (k < 0.78 && g < -150) add('seapen', x, z);
      else if (k < 0.82 && z < 30) add('kelp', x, z);
    }
  }
  // sargassum rafts hanging from the surface over the lagoon
  for (let x = -600; x < REEF_X; x += 16 + R() * 26) {
    const raft = noise2(x / 500, 3, 71) - 0.4 + (x < 800 ? 0.3 : 0);
    if (raft > 0 && R() < raft * 1.1) add('sargasse', x, -300 + R() * 360);
  }
}

// ----- animals: all in profile ----- //

interface Actor {
  cr: Creature; card: Card; kind: 'player' | 'swim' | 'floor' | 'sib' | 'far';
  z: number; hx: number; hy: number; tx: number; ty: number; next: number;
}
const actors: Actor[] = [];

/** x, y are engine coordinates: y grows downward from the surface */
function addActor(sp: Spec, x: number, y: number, kind: Actor['kind'], scale = 1, z = 0): Actor {
  const cr = new Creature(sp, x, y, { dir: Math.random() < 0.5 ? 0 : Math.PI, scale, profile: true });
  for (let i = 0; i < 60; i++) cr.update(i * STEP, 0, 0, 0.1);
  const card = new Card(cr, z, cardGeometry);
  scene.add(card.mesh);
  const a: Actor = { cr, card, kind, z, hx: x, hy: y, tx: x, ty: y, next: 0 };
  actors.push(a);
  return a;
}

const player = addActor(firstAncestor(), 0, 70, 'player', 1);
{
  const R = rng(3);
  for (let i = 0; i < 4; i++) addActor(firstAncestor(), rand(-160, 160), rand(40, 160), 'sib', 0.45 + R() * 0.15, rand(-40, 30));
  const lagoon: [string, number][] = [['meduse', 0], ['meduse', -140], ['hippocampe', -60], ['ctenophore', -200], ['krill', 20], ['meduse', -320], ['copepode', -40], ['larve', -90]];
  for (const [id, z] of lagoon) addActor(SPECIES[id](), rand(-500, REEF_X - 200), rand(40, 200), 'swim', id === 'meduse' ? 0.8 : 1, z);
  const reef: [string, number][] = [['poissonClown', 0], ['poissonClown', -80], ['koi', -150], ['hippocampe', -40], ['anguille', -220], ['calmar', -300], ['poissonLion', -120]];
  for (const [id, z] of reef) addActor(SPECIES[id](), rand(REEF_X + 100, BOUNDS.x1 - 500), rand(40, 150), 'swim', 1, z);
  const floor: [string, number][] = [['crevette', 0], ['crevette', -60], ['crabe', -30], ['nudibranche', 10], ['etoile', -120], ['verPlat', -20], ['crabe', -200], ['homard', -90]];
  for (const [id, z] of floor) {
    const x = rand(-400, BOUNDS.x1 - 600);
    addActor(SPECIES[id](), x, -floorAt(x, z) - 10, 'floor', 1, z);
  }
  // company near the start
  addActor(SPECIES.meduse(), 120, 60, 'swim', 0.8, -30);
  addActor(SPECIES.crevette(), -60, -floorAt(-60, 0) - 10, 'floor', 0.9, 0);
  // large animals passing far behind
  addActor(SPECIES.tortue(), 400, 120, 'far', 2.2, -620);
  addActor(SPECIES.manta(), REEF_X + 800, 90, 'far', 2, -650);
}

// ----- school of small fish (instanced, toon + ink) ----- //

const FISH = 60;
const fishGeo = (() => {
  const g = new THREE.SphereGeometry(1, 10, 6);
  g.scale(3.2, 1.1, 0.8);
  const tail = new THREE.ConeGeometry(1.2, 2.4, 4);
  tail.rotateZ(Math.PI / 2); tail.translate(-3.8, 0, 0);
  const a = g.toNonIndexed(), b = tail.toNonIndexed();
  const pos = new Float32Array(a.attributes.position.count * 3 + b.attributes.position.count * 3);
  pos.set(a.attributes.position.array as Float32Array, 0);
  pos.set(b.attributes.position.array as Float32Array, a.attributes.position.count * 3);
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.computeVertexNormals();
  return m;
})();
const fishMesh = new THREE.InstancedMesh(fishGeo, new THREE.MeshToonMaterial({ color: col3({ h: 200, s: 45, l: 70 }), gradientMap: toonRamp() }), FISH);
fishMesh.frustumCulled = false;
scene.add(fishMesh);
// fish.z holds the engine y (depth below the surface) of each fish; yo its own plane
const fish = { x: new Float32Array(FISH), z: new Float32Array(FISH), vx: new Float32Array(FISH), vz: new Float32Array(FISH), yo: new Float32Array(FISH), ph: new Float32Array(FISH) };
for (let i = 0; i < FISH; i++) { fish.x[i] = 300 + rand(-60, 60); fish.z[i] = 120 + rand(-40, 40); fish.vx[i] = rand(-1, 1); fish.vz[i] = rand(-1, 1); fish.yo[i] = -70 + rand(-25, 25); fish.ph[i] = rand(0, TAU); }

// ----- glows ----- //

const GLOWS = 400;
const glowGeo = new THREE.BufferGeometry();
const glowPos = new Float32Array(GLOWS * 3), glowCol = new Float32Array(GLOWS * 3);
glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3).setUsage(THREE.DynamicDrawUsage));
glowGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3).setUsage(THREE.DynamicDrawUsage));
const glows = new THREE.Points(glowGeo, new THREE.PointsMaterial({ size: 16, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
glows.frustumCulled = false;
scene.add(glows);

// ----- controls ----- //

const input = new Input(canvas, 0.35, 3);
input.zoomMul = 300 / settings.dist;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();

function fingerTarget(sx: number, sy: number): THREE.Vector3 | null {
  ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(plane, hit);
}

// ----- simulation ----- //

const flow = new Flow(32);
let t = 0;
const camTarget = new THREE.Vector3(0, -70, 0);
let frameNo = 0;

/** keep a swimmer (engine coords, plane z) out of the rocks that cut its plane, and above the floor */
function collide(cr: Creature, z: number, rocks: Rock[]): void {
  const r = cr.root, rad = r.rad[0] + 2;
  for (const k of rocks) {
    const dz = Math.abs(k.z - z);
    if (dz >= k.r || Math.abs(k.x - r.x[0]) > k.r + 40) continue;
    const rs = Math.sqrt(k.r * k.r - dz * dz) * 0.85, cy = -k.cy;
    const dx = r.x[0] - k.x, dy = (r.y[0] - cy) / 0.7, d = Math.hypot(dx, dy), m = rs + rad;
    if (d < m && d > 0.01) { r.x[0] = k.x + (dx / d) * m; r.y[0] = cy + (dy / d) * m * 0.7; }
  }
  const fy = -floorAt(r.x[0], z) - rad;
  if (r.y[0] > fy) { r.y[0] = fy; if (cr.vy > 0) cr.vy *= -0.3; }
  if (r.y[0] < 6) { r.y[0] = 6; if (cr.vy < 0) cr.vy *= -0.3; }
}

function update(): void {
  t += STEP;
  shared.time.value = t;
  const p = player.cr, r = p.root;

  // the player swims toward the finger (engine y = -world y)
  const f = input.follow, kd = input.keyDir();
  if (f) {
    const w = fingerTarget(f.x, f.y);
    if (w) {
      const dx = w.x - r.x[0], dy = -w.y - r.y[0], d = Math.hypot(dx, dy) || 1, sp = 2.6 * Math.min(1, d / 70);
      p.update(t, (dx / d) * sp, (dy / d) * sp, 0.08);
    } else p.update(t, 0, 0, 0.03);
  } else if (kd) {
    const d = Math.hypot(kd.x, kd.y);
    p.update(t, (kd.x / d) * 2.6, (kd.y / d) * 2.6, 0.08);
  } else p.update(t, 0, 0, 0.03);
  r.x[0] = clamp(r.x[0], BOUNDS.x0 + 150, BOUNDS.x1 - 150);
  collide(p, 0, rocks);
  const px = r.x[0], py = r.y[0];

  // the others
  flow.clear();
  const near = (x: number) => Math.abs(x - px) < 900;
  for (const a of actors) if (Math.abs(a.z) < 45 && near(a.cr.root.x[0])) flow.add(a.cr);
  for (const a of actors) {
    if (a.kind === 'player' || (a.kind !== 'far' && !near(a.cr.root.x[0]))) continue;
    const c = a.cr, cr = c.root, x = cr.x[0], y = cr.y[0];
    if (a.kind === 'sib') {
      // siblings drift around the player, loosely
      if (t > a.next) { a.next = t + rand(1.5, 4); a.tx = rand(-70, 70); a.ty = rand(-50, 50); }
      const gx = px + a.tx - x, gy = py + a.ty - y, g = Math.hypot(gx, gy) || 1, d = Math.hypot(px - x, py - y);
      const sp = d > 260 ? 1.8 : 0.9 * Math.min(1, g / 60);
      c.update(t, (gx / g) * sp, (gy / g) * sp, 0.04);
      collide(c, a.z, rocks);
      continue;
    }
    if (a.kind === 'far') {
      // cruises slowly back and forth, far behind
      if (x > a.hx + 1400) a.tx = -1; else if (x < a.hx - 200) a.tx = 1; else if (!a.tx || Math.abs(a.tx) > 1) a.tx = 1;
      c.update(t, a.tx * 0.5 * swimFactor(c, t), (a.hy - y) * 0.01, 0.02);
      continue;
    }
    if (t > a.next || Math.hypot(a.tx - x, a.ty - y) < 20) {
      a.next = t + rand(3, 8);
      a.tx = a.hx + rand(-260, 260);
      a.ty = a.kind === 'floor' ? -floorAt(a.tx, a.z) - 8 : clamp(a.hy + rand(-120, 120), 30, -floorAt(a.tx, a.z) - 40);
    }
    let dx = a.tx - x, dy = a.ty - y;
    if (a.kind === 'swim' && Math.abs(a.z) < 60) {
      const qx = x - px, qy = y - py, q = Math.hypot(qx, qy);
      if (q < 60) { dx += (qx / (q + 1)) * 200; dy += (qy / (q + 1)) * 200; }
    }
    const d = Math.hypot(dx, dy) || 1, sp = c.spec.swim.speed * 0.45 * swimFactor(c, t) * Math.min(1, d / 60);
    c.update(t, (dx / d) * sp, (dy / d) * sp, 0.05);
    collide(c, a.z, rocks);
  }
  // plants in the swimming plane are pushed by the water too
  for (const pl of plants) if (pl.live && near(pl.cr.root.x[0])) { pl.cr.update(t, 0, 0, 1); flow.apply(pl.cr, { push: 0.25, wake: 0.04, reach: 18 }); }
  for (const a of actors) if (Math.abs(a.z) < 45 && near(a.cr.root.x[0])) flow.apply(a.cr, { push: 0.3, wake: 0.02, body: a.kind === 'player' ? 0.008 : 0.01 });

  // fish school: boids in a vertical plane behind, scatter around the player
  let cx = 0, cz = 0, ax = 0, az = 0;
  for (let i = 0; i < FISH; i++) { cx += fish.x[i]; cz += fish.z[i]; ax += fish.vx[i]; az += fish.vz[i]; }
  cx /= FISH; cz /= FISH; ax /= FISH; az /= FISH;
  const gx = 500 + Math.sin(t * 0.05) * 1400, gz = 150 + Math.cos(t * 0.07) * 70;
  for (let i = 0; i < FISH; i++) {
    let fx = (cx - fish.x[i]) * 0.002 + (ax - fish.vx[i]) * 0.05 + (gx - cx) * 0.0005;
    let fz = (cz - fish.z[i]) * 0.002 + (az - fish.vz[i]) * 0.05 + (gz - cz) * 0.0005;
    for (let j = 0; j < FISH; j++) {
      if (j === i) continue;
      const dx = fish.x[i] - fish.x[j], dz = fish.z[i] - fish.z[j];
      if (dx > 9 || dx < -9 || dz > 9 || dz < -9) continue;
      const d2 = dx * dx + dz * dz + 0.01;
      fx += (dx / d2) * 1.2; fz += (dz / d2) * 1.2;
    }
    const dx = fish.x[i] - px, dz = fish.z[i] - py, d2 = dx * dx + dz * dz;
    if (d2 < 100 * 100) { const d = Math.sqrt(d2) + 0.1, k = (1 - d / 100) * 0.9; fx += (dx / d) * k; fz += (dz / d) * k; }
    let vx = fish.vx[i] + fx, vz = fish.vz[i] + fz;
    const m = Math.hypot(vx, vz), mx = 2.1;
    if (m > mx) { vx *= mx / m; vz *= mx / m; } else if (m < 0.7) { vx *= 0.7 / (m || 1); vz *= 0.7 / (m || 1); }
    fish.vx[i] = vx; fish.vz[i] = vz * 0.95; fish.x[i] += vx; fish.z[i] = clamp(fish.z[i] + fish.vz[i], 20, -floorAt(fish.x[i], fish.yo[i]) - 30); fish.ph[i] += 0.3 + m * 0.2;
  }
  shared.player.value.set(px, -py, 0);
}

// ----- drawing ----- //

const dummy = new THREE.Object3D();
const tmpC = new THREE.Color(), deepC = new THREE.Color(), topC = new THREE.Color();

const perf = { render: 0, update: 0, cards: 0 };
function render(): void {
  const r0 = performance.now();
  const r = player.cr.root, px = r.x[0], py = r.y[0];
  // camera: in front of the plane, a little above, looking slightly down
  const dist = 300 / input.zoomMul, ang = (settings.angle * Math.PI) / 180;
  camTarget.x += (px + player.cr.vx * 16 - camTarget.x) * 0.08;
  camTarget.y += (-py - player.cr.vy * 16 - camTarget.y) * 0.08;
  camTarget.z = 0;
  const ty = Math.min(camTarget.y, -40);
  camera.position.set(camTarget.x, Math.min(-10, ty + Math.sin(ang) * dist), Math.cos(ang) * dist);
  camera.lookAt(camTarget.x, ty, 0);

  // cards: drawn by the 2D renderer at the resolution their plane gets on screen
  const pxH = window.innerHeight * renderer.getPixelRatio() / (2 * Math.tan((camera.fov * Math.PI) / 360));
  const kAt = (z: number) => clamp(pxH / Math.max(40, camera.position.z - z), 0.3, 4);
  frameNo++;
  const c0 = performance.now();
  actors.forEach((a, i) => {
    const dx = Math.abs(a.cr.root.x[0] - camTarget.x);
    if (a.kind !== 'far' && dx > 900) { a.card.sleep(); return; }
    // close to the player: every frame; further away or behind: one frame in three
    const every = a.kind === 'player' || (dx < 450 && Math.abs(a.z) < 80) ? 1 : 3;
    if (!a.card.alive || (frameNo + i) % every === 0) a.card.paint(kAt(a.z));
  });
  plants.forEach((pl, i) => {
    const dx = Math.abs(pl.cr.root.x[0] - camTarget.x);
    if (dx > 1300) { pl.card.sleep(); return; }
    const k = kAt(pl.z) * 0.75;
    // still plants are drawn once; the ones in the swimming plane only when the water moved them
    if (!pl.card.alive || Math.abs(k - pl.card.drawnK) / pl.card.drawnK > 0.35) pl.card.paint(k);
    else if (pl.live && dx < 600 && (frameNo + i) % 2 === 0 && pl.card.moved()) pl.card.paint(k);
  });
  perf.cards = perf.cards * 0.9 + (performance.now() - c0) * 0.1;

  // water colour from the chapter palette, darker with depth
  const m = mood3(camTarget.x), depth = Math.max(0, -camTarget.y);
  const w = waterAt(m, depth * 1.4);
  deepC.copy(col3(w));
  topC.copy(col3(m.top, 6));
  const fog = scene.fog as THREE.FogExp2;
  fog.color.copy(deepC);
  fog.density = 0.0013;
  scene.background = deepC;
  const sm = surface.material as THREE.ShaderMaterial;
  (sm.uniforms.uShallow.value as THREE.Color).copy(topC);
  (sm.uniforms.uSky.value as THREE.Color).copy(col3(m.sky));
  (sm.uniforms.uFog.value as THREE.Color).copy(deepC);
  hemi.intensity = 0.55 + 0.6 * Math.exp(-depth / 500);
  sun.intensity = 1.8 * Math.exp(-depth / 600);

  for (const u of rays.children) {
    ((u as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = m.rays * (0.55 + 0.45 * Math.sin(t * 0.25 + u.userData.phase));
  }
  // plankton follows the camera target in a wrapped box
  const pp = plankton.geometry.attributes.position as THREE.BufferAttribute, pa = pp.array as Float32Array;
  for (let i = 0; i < pa.length; i += 3) {
    const bx = planktonBase[i], bz = planktonBase[i + 2];
    pa[i] = camTarget.x + ((((bx - camTarget.x + t * 2) % 600) + 900) % 600) - 300;
    pa[i + 1] = Math.min(-1, camTarget.y + planktonBase[i + 1] + 150 + Math.sin(t * 0.3 + i) * 3);
    pa[i + 2] = ((((bz + 300) % 600) + 600) % 600) - 400;
  }
  pp.needsUpdate = true;

  // fish
  for (let i = 0; i < FISH; i++) {
    const a = Math.atan2(-fish.vz[i], fish.vx[i]);
    dummy.position.set(fish.x[i], -fish.z[i], fish.yo[i]);
    dummy.rotation.set(0, Math.sin(fish.ph[i]) * 0.3, a);
    dummy.updateMatrix();
    fishMesh.setMatrixAt(i, dummy.matrix);
  }
  fishMesh.instanceMatrix.needsUpdate = true;

  // glows
  let g = 0;
  for (const a of actors) {
    if (!a.card.mesh.visible) continue;
    const z0 = a.z;
    eachGlow(a.cr.list, (x, ey, _size, hue, al) => {
      if (g >= GLOWS) return;
      glowPos.set([x, -ey, z0 + 2], g * 3);
      tmpC.setHSL(hue / 360, 0.9, 0.6).multiplyScalar(al * 0.8);
      glowCol.set([tmpC.r, tmpC.g, tmpC.b], g * 3);
      g++;
    });
  }
  glowGeo.setDrawRange(0, g);
  glowGeo.attributes.position.needsUpdate = true;
  glowGeo.attributes.color.needsUpdate = true;

  renderer.render(scene, camera);
  perf.render = perf.render * 0.9 + (performance.now() - r0) * 0.1;
}

// ----- loop with adaptive resolution ----- //

let last = performance.now(), acc = 0, fn = 0, fsum = 0;
const stats = { fps: 0 };
(window as unknown as { lignee3d: unknown }).lignee3d = {
  settings, player, camera, stats, actors, plants, perf, renderer,
  teleport: (x: number, y: number) => { player.cr.translate(x - player.cr.root.x[0], y - player.cr.root.y[0]); camTarget.set(x, -y, 0); },
  spawn: (id: string, dx: number, dy: number) => addActor(SPECIES[id](), player.cr.root.x[0] + dx, player.cr.root.y[0] + dy, 'swim', 1, 0)
};

function frame(now: number): void {
  const dt = now - last;
  last = now;
  acc += Math.min(0.1, dt / 1000);
  let steps = 0;
  const u0 = performance.now();
  while (acc >= STEP && steps < 3) { update(); acc -= STEP; steps++; }
  perf.update = perf.update * 0.9 + (performance.now() - u0) * 0.1;
  if (steps === 3) acc = 0;
  render();
  fn++; fsum += dt;
  if (fn >= 90) {
    const avg = fsum / fn;
    stats.fps = 1000 / avg;
    if (avg > 21 && quality > 0.5) { quality *= 0.85; resize(); } else if (avg < 15 && quality < 1) { quality = Math.min(1, quality / 0.9); resize(); }
    fn = 0; fsum = 0;
    fpsEl.textContent = stats.fps.toFixed(0) + ' img/s';
  }
  requestAnimationFrame(frame);
}

// ----- settings panel ----- //

const panel = document.getElementById('panel')!, gear = document.getElementById('gear')!;
const angleIn = document.getElementById('angle') as HTMLInputElement, angleOut = document.getElementById('angleVal')!;
const distIn = document.getElementById('dist') as HTMLInputElement, distOut = document.getElementById('distVal')!;
const fpsEl = document.getElementById('fps')!;
angleIn.value = String(settings.angle); distIn.value = String(Math.round(settings.dist));
const showVals = () => { angleOut.textContent = settings.angle + '°'; distOut.textContent = Math.round(300 / input.zoomMul) + ''; };
showVals();
gear.addEventListener('click', () => { panel.hidden = !panel.hidden; });
angleIn.addEventListener('input', () => { settings.angle = +angleIn.value; showVals(); save(); });
distIn.addEventListener('input', () => { input.zoomMul = 300 / +distIn.value; settings.dist = +distIn.value; showVals(); save(); });
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-angle]')) {
  b.addEventListener('click', () => { settings.angle = +b.dataset.angle!; angleIn.value = b.dataset.angle!; showVals(); save(); });
}
// pinch changes the distance: keep the slider in step
setInterval(() => { const d = Math.round(300 / input.zoomMul); if (+distIn.value !== d) { distIn.value = String(d); settings.dist = d; showVals(); save(); } }, 400);
for (const el of [panel, gear]) {
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
}

const hint = document.getElementById('hint')!;
setTimeout(() => hint.classList.add('gone'), 6000);
document.addEventListener('touchmove', (e) => { if (!(e.target as HTMLElement).closest('#panel')) e.preventDefault(); }, { passive: false });

requestAnimationFrame(frame);
