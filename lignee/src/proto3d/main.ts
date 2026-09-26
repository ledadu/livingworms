// 3D prototype: the lagoon of the Nurserie seen from above, the larva and a
// few animals as 3D whips, a camera that plunges toward the creature.

import * as THREE from 'three';
import { Creature, Flow, STEP, TAU, clamp, eachGlow, rand, rng, swimFactor, type Spec } from '../engine';
import { SPECIES } from '../content';
import { firstAncestor } from '../game/game';
import { Input } from '../game/input';
import { CreatureMesh, creatureMaterials } from './mesh';
import {
  BOUNDS, Kelp, WATER, causticTexture, floorAt, glowTexture, makeMeadow, makePlankton, makeRays, makeRocks,
  makeSargassum, makeSurface, makeTerrain, noise2, planeAt, shared, type Rock
} from './world';
import './style.css';

// ----- settings (kept between visits) ----- //

const settings = { angle: 72, dist: 260 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('lignee3d') || '{}')); } catch { /* private mode */ }
const save = () => { try { localStorage.setItem('lignee3d', JSON.stringify(settings)); } catch { /* ignore */ } };

// ----- renderer ----- //

const canvas = document.getElementById('sea') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
let quality = 1;
const camera = new THREE.PerspectiveCamera(45, 1, 2, 4000);
function resize(): void {
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1) * quality);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  camera.aspect = window.innerWidth / window.innerHeight;
  // portrait phones: widen the view a little
  camera.fov = camera.aspect < 1 ? 55 : 42;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(WATER.deep.getHex(), 0.002);
shared.caustic.value = causticTexture();

const hemi = new THREE.HemisphereLight(WATER.sky, new THREE.Color('#8a7a52'), 1.0);
const sun = new THREE.DirectionalLight(new THREE.Color('#fff4d6'), 1.9);
sun.position.set(0.35, 1, 0.25);
scene.add(hemi, sun);

// ----- world ----- //

scene.add(makeTerrain());
const { mesh: rockMesh, rocks } = makeRocks();
scene.add(rockMesh);
scene.add(makeMeadow(rocks));
scene.add(makeSargassum());
const rays = makeRays();
scene.add(rays);
const plankton = makePlankton();
const planktonBase = Float32Array.from(plankton.geometry.attributes.position.array as Float32Array);
scene.add(plankton);
const surface = makeSurface();
scene.add(surface);

const kelpMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const kelps: Kelp[] = [];
{
  const R = rng(41);
  for (let k = 0; k < 400 && kelps.length < 70; k++) {
    const x = -600 + R() * 2000, z = -900 + R() * 1800;
    // kelp grows in patches on the rocks' side of the lagoon
    if (noise2(x / 300, z / 300, 51) < 0.58 || Math.hypot(x, z) < 140) continue;
    const kp = new Kelp(x, z, -floorAt(x, z) - 4 + R() * 6, R, kelpMat);
    kelps.push(kp);
    scene.add(kp.mesh);
  }
}

// ----- creatures ----- //

const mats = creatureMaterials();
interface Actor { cr: Creature; mesh: CreatureMesh; kind: 'player' | 'swim' | 'floor' | 'sib'; hx: number; hz: number; tx: number; tz: number; next: number; }
const actors: Actor[] = [];

function addActor(sp: Spec, x: number, z: number, kind: Actor['kind'], scale = 1): Actor {
  const cr = new Creature(sp, x, z, { dir: rand(0, TAU), scale });
  for (let i = 0; i < 60; i++) cr.update(i * STEP, 0, 0, 0.1);
  const mesh = new CreatureMesh(cr, mats);
  mesh.y = kind === 'floor' ? floorAt(x, z) + 3 : planeAt(x, z) + (kind === 'swim' ? 8 : 0);
  scene.add(mesh.group);
  const a: Actor = { cr, mesh, kind, hx: x, hz: z, tx: x, tz: z, next: 0 };
  actors.push(a);
  return a;
}

const player = addActor(firstAncestor(), 0, 0, 'player', 1);
player.mesh.y = planeAt(0, 0);
{
  const R = rng(3);
  for (let i = 0; i < 6; i++) addActor(firstAncestor(), rand(-160, 160), rand(-160, 160), 'sib', 0.45 + R() * 0.15);
  const swim = ['meduse', 'meduse', 'hippocampe', 'ctenophore', 'poissonClown', 'krill', 'meduse'];
  const floor = ['crevette', 'crevette', 'etoile', 'nudibranche', 'crabe', 'crevette', 'ophiure', 'verPlat'];
  for (let i = 0; i < swim.length; i++) addActor(SPECIES[swim[i]](), rand(-600, 1300), rand(-600, 600), 'swim', 1);
  for (let i = 0; i < floor.length; i++) addActor(SPECIES[floor[i]](), rand(-400, 1200), rand(-500, 500), 'floor', 1);
  // one close to the start so the first view has company
  addActor(SPECIES.meduse(), 90, -110, 'swim', 1);
  addActor(SPECIES.crevette(), -90, 110, 'floor', 0.8);
}

// ----- a school of small fish (instanced) ----- //

const FISH = 60;
const fishGeo = (() => {
  const g = new THREE.SphereGeometry(1, 8, 6);
  g.scale(3.2, 0.9, 1.1);
  const tail = new THREE.ConeGeometry(1.1, 2.4, 4);
  tail.rotateZ(Math.PI / 2); tail.translate(-3.8, 0, 0);
  const m = new THREE.BufferGeometry();
  const a = g.toNonIndexed(), b = tail.toNonIndexed();
  const pos = new Float32Array(a.attributes.position.count * 3 + b.attributes.position.count * 3);
  pos.set(a.attributes.position.array as Float32Array, 0);
  pos.set(b.attributes.position.array as Float32Array, a.attributes.position.count * 3);
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.computeVertexNormals();
  return m;
})();
const fishMesh = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ color: 0xc8d8e0, metalness: 0.5, roughness: 0.3 }), FISH);
fishMesh.frustumCulled = false;
scene.add(fishMesh);
const fish = { x: new Float32Array(FISH), z: new Float32Array(FISH), vx: new Float32Array(FISH), vz: new Float32Array(FISH), yo: new Float32Array(FISH), ph: new Float32Array(FISH) };
for (let i = 0; i < FISH; i++) { fish.x[i] = 300 + rand(-60, 60); fish.z[i] = -200 + rand(-60, 60); fish.vx[i] = rand(-1, 1); fish.vz[i] = rand(-1, 1); fish.yo[i] = rand(-6, 6); fish.ph[i] = rand(0, TAU); }

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
input.zoomMul = 260 / settings.dist;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();

function fingerTarget(sx: number, sy: number): THREE.Vector3 | null {
  ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  plane.constant = -player.mesh.y;
  return ray.ray.intersectPlane(plane, hit);
}

// ----- simulation ----- //

const flow = new Flow(32);
let t = 0;
const camTarget = new THREE.Vector3(0, player.mesh.y, 0);

function collideRocks(cr: Creature, y: number, rocks: Rock[]): void {
  const r = cr.root;
  for (const k of rocks) {
    if (k.top < y - 4) continue;
    const dx = r.x[0] - k.x, dz = r.y[0] - k.z, d = Math.hypot(dx, dz), m = k.r * 0.95 + r.rad[0];
    if (d < m && d > 0.01) { r.x[0] = k.x + (dx / d) * m; r.y[0] = k.z + (dz / d) * m; }
  }
}

function update(): void {
  t += STEP;
  shared.time.value = t;
  const p = player.cr, r = p.root;

  // the player swims toward the finger
  const f = input.follow, kd = input.keyDir();
  if (f) {
    const w = fingerTarget(f.x, f.y);
    if (w) {
      const dx = w.x - r.x[0], dz = w.z - r.y[0], d = Math.hypot(dx, dz) || 1, sp = 2.6 * Math.min(1, d / 70);
      p.update(t, (dx / d) * sp, (dz / d) * sp, 0.08);
    } else p.update(t, 0, 0, 0.03);
  } else if (kd) {
    const d = Math.hypot(kd.x, kd.y);
    p.update(t, (kd.x / d) * 2.6, (kd.y / d) * 2.6, 0.08);
  } else p.update(t, 0, 0, 0.03);
  r.x[0] = clamp(r.x[0], BOUNDS.x0 + 80, BOUNDS.x1 - 80);
  r.y[0] = clamp(r.y[0], BOUNDS.z0 + 80, BOUNDS.z1 - 80);
  player.mesh.y += (planeAt(r.x[0], r.y[0]) - player.mesh.y) * 0.02;
  collideRocks(p, player.mesh.y, rocks);
  const px = r.x[0], pz = r.y[0], py = player.mesh.y;

  // the others
  flow.clear();
  for (const a of actors) if (Math.abs(a.cr.root.x[0] - px) < 700 && Math.abs(a.cr.root.y[0] - pz) < 700) flow.add(a.cr);
  for (const a of actors) {
    if (a.kind === 'player') continue;
    const c = a.cr, cr = c.root, x = cr.x[0], z = cr.y[0];
    if (Math.abs(x - px) > 900 || Math.abs(z - pz) > 900) continue;
    if (a.kind === 'sib') {
      // siblings drift around the player, loosely
      const dx = px - x, dz = pz - z, d = Math.hypot(dx, dz) || 1;
      if (t > a.next) { a.next = t + rand(1.5, 4); a.tx = rand(-60, 60); a.tz = rand(-60, 60); }
      const gx = px + a.tx - x, gz = pz + a.tz - z, g = Math.hypot(gx, gz) || 1;
      const sp = d > 240 ? 1.8 : d < 30 ? 0.3 : 0.9 * Math.min(1, g / 60);
      c.update(t, (gx / g) * sp, (gz / g) * sp, 0.04);
      a.mesh.y = py + Math.sin(t * 0.7 + a.hx) * 4;
    } else {
      if (t > a.next || Math.hypot(a.tx - x, a.tz - z) < 20) { a.next = t + rand(3, 8); a.tx = a.hx + rand(-240, 240); a.tz = a.hz + rand(-240, 240); }
      let dx = a.tx - x, dz = a.tz - z;
      const qx = x - px, qz = z - pz, q = Math.hypot(qx, qz);
      if (a.kind === 'swim' && q < 60) { dx += (qx / (q + 1)) * 200; dz += (qz / (q + 1)) * 200; }
      const d = Math.hypot(dx, dz) || 1, sp = c.spec.swim.speed * 0.45 * swimFactor(c, t) * Math.min(1, d / 60);
      c.update(t, (dx / d) * sp, (dz / d) * sp, 0.05);
      const target = a.kind === 'floor' ? floorAt(x, z) + 3 : Math.max(planeAt(x, z) + 8, -60);
      a.mesh.y += (target - a.mesh.y) * 0.05;
    }
  }
  for (const a of actors) if (Math.abs(a.cr.root.x[0] - px) < 700 && Math.abs(a.cr.root.y[0] - pz) < 700) flow.apply(a.cr, { push: 0.3, wake: 0.02, body: a.kind === 'player' ? 0.008 : 0.01 });

  // fish school: boids in the plane, scatter around the player
  let cx = 0, cz = 0, ax = 0, az = 0;
  for (let i = 0; i < FISH; i++) { cx += fish.x[i]; cz += fish.z[i]; ax += fish.vx[i]; az += fish.vz[i]; }
  cx /= FISH; cz /= FISH; ax /= FISH; az /= FISH;
  const gx = 400 + Math.sin(t * 0.05) * 700, gz = Math.cos(t * 0.07) * 500;
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
    const dx = fish.x[i] - px, dz = fish.z[i] - pz, d2 = dx * dx + dz * dz;
    if (d2 < 100 * 100) { const d = Math.sqrt(d2) + 0.1, k = (1 - d / 100) * 0.9; fx += (dx / d) * k; fz += (dz / d) * k; }
    let vx = fish.vx[i] + fx, vz = fish.vz[i] + fz;
    const m = Math.hypot(vx, vz), mx = 2.1;
    if (m > mx) { vx *= mx / m; vz *= mx / m; } else if (m < 0.7) { vx *= 0.7 / (m || 1); vz *= 0.7 / (m || 1); }
    fish.vx[i] = vx; fish.vz[i] = vz; fish.x[i] += vx; fish.z[i] += vz; fish.ph[i] += 0.3 + m * 0.2;
  }

  // kelp near the player bends away from whoever swims through
  const pushers = [{ x: px, y: py, z: pz, r: 10 }];
  for (const a of actors) if (a.kind !== 'player' && Math.abs(a.cr.root.x[0] - px) < 300) pushers.push({ x: a.cr.root.x[0], y: a.mesh.y, z: a.cr.root.y[0], r: 6 });
  for (const k of kelps) if (Math.abs(k.base.x - px) < 500 && Math.abs(k.base.z - pz) < 500) k.update(pushers, t);
  shared.player.value.set(px, py, pz);
}

// ----- drawing ----- //

const dummy = new THREE.Object3D();
const underCol = new THREE.Color(), tmpC = new THREE.Color();

function render(): void {
  const r = player.cr.root, px = r.x[0], pz = r.y[0], py = player.mesh.y;
  for (const a of actors) {
    const vis = Math.abs(a.cr.root.x[0] - px) < 800 && Math.abs(a.cr.root.y[0] - pz) < 800;
    a.mesh.group.visible = vis;
    if (vis) a.mesh.sync(t);
  }
  // camera: plunging toward the creature, a little ahead of where it swims
  const dist = 260 / input.zoomMul, ang = (settings.angle * Math.PI) / 180;
  camTarget.x += (px + player.cr.vx * 14 - camTarget.x) * 0.08;
  camTarget.z += (pz + player.cr.vy * 14 - camTarget.z) * 0.08;
  camTarget.y += (py - camTarget.y) * 0.08;
  camera.position.set(camTarget.x, camTarget.y + Math.sin(ang) * dist, camTarget.z + Math.cos(ang) * dist);
  camera.lookAt(camTarget);

  // above or below the surface
  const under = camera.position.y < 0;
  const depth = Math.max(0, -camTarget.y);
  underCol.copy(WATER.shallow).lerp(WATER.deep, clamp(depth / 500, 0, 0.9));
  const fog = scene.fog as THREE.FogExp2;
  if (under) { fog.color.copy(underCol); fog.density = 0.0024 + depth * 0.000002; scene.background = underCol; }
  else { tmpC.copy(WATER.shallow).lerp(WATER.deep, 0.2); fog.color.copy(tmpC); fog.density = 0.0021 + depth * 0.000003; scene.background = WATER.sky; }
  hemi.intensity = 0.35 + 0.65 * Math.exp(-depth / 500);
  sun.intensity = 1.7 * Math.exp(-depth / 450);

  for (const m of rays.children) {
    const u = m as THREE.Mesh;
    (u.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.45 * Math.sin(t * 0.25 + u.userData.phase);
  }
  // plankton follows the camera target in a wrapped box
  const pp = plankton.geometry.attributes.position as THREE.BufferAttribute, pa = pp.array as Float32Array;
  for (let i = 0; i < pa.length; i += 3) {
    const bx = planktonBase[i], bz = planktonBase[i + 2];
    pa[i] = camTarget.x + ((((bx - camTarget.x + t * 2) % 600) + 900) % 600) - 300;
    pa[i + 1] = Math.min(-1, camTarget.y + planktonBase[i + 1] + 150 + Math.sin(t * 0.3 + i) * 3);
    pa[i + 2] = camTarget.z + ((((bz - camTarget.z) % 600) + 900) % 600) - 300;
  }
  pp.needsUpdate = true;

  // fish
  for (let i = 0; i < FISH; i++) {
    const a = Math.atan2(fish.vz[i], fish.vx[i]);
    dummy.position.set(fish.x[i], planeAt(fish.x[i], fish.z[i]) + 10 + fish.yo[i], fish.z[i]);
    dummy.rotation.set(0, -a + Math.sin(fish.ph[i]) * 0.25, 0);
    dummy.updateMatrix();
    fishMesh.setMatrixAt(i, dummy.matrix);
  }
  fishMesh.instanceMatrix.needsUpdate = true;

  // glows
  let g = 0;
  for (const a of actors) {
    if (!a.mesh.group.visible) continue;
    const y = a.mesh.y;
    eachGlow(a.cr.list, (x, z, _size, hue, al) => {
      if (g >= GLOWS) return;
      glowPos.set([x, y + 1, z], g * 3);
      tmpC.setHSL(hue / 360, 0.9, 0.6).multiplyScalar(al * 0.8);
      glowCol.set([tmpC.r, tmpC.g, tmpC.b], g * 3);
      g++;
    });
  }
  glowGeo.setDrawRange(0, g);
  glowGeo.attributes.position.needsUpdate = true;
  glowGeo.attributes.color.needsUpdate = true;

  renderer.render(scene, camera);
}

// ----- loop with adaptive resolution ----- //

let last = performance.now(), acc = 0, fn = 0, fsum = 0;
const stats = { fps: 0 };
(window as unknown as { lignee3d: unknown }).lignee3d = { settings, player, camera, stats, actors, teleport: (x: number, z: number) => { player.cr.translate(x - player.cr.root.x[0], z - player.cr.root.y[0]); player.mesh.y = planeAt(x, z); camTarget.set(x, player.mesh.y, z); } };

function frame(now: number): void {
  const dt = now - last;
  last = now;
  acc += Math.min(0.1, dt / 1000);
  let steps = 0;
  while (acc >= STEP && steps < 3) { update(); acc -= STEP; steps++; }
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
const showVals = () => { angleOut.textContent = settings.angle + '°'; distOut.textContent = Math.round(260 / input.zoomMul) + ''; };
showVals();
gear.addEventListener('click', () => { panel.hidden = !panel.hidden; });
angleIn.addEventListener('input', () => { settings.angle = +angleIn.value; showVals(); save(); });
distIn.addEventListener('input', () => { input.zoomMul = 260 / +distIn.value; settings.dist = +distIn.value; showVals(); save(); });
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-angle]')) {
  b.addEventListener('click', () => { settings.angle = +b.dataset.angle!; angleIn.value = b.dataset.angle!; showVals(); save(); });
}
// pinch changes the distance: keep the slider in step
setInterval(() => { const d = Math.round(260 / input.zoomMul); if (+distIn.value !== d) { distIn.value = String(d); settings.dist = d; showVals(); save(); } }, 400);
for (const el of [panel, gear]) {
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
}

const hint = document.getElementById('hint')!;
setTimeout(() => hint.classList.add('gone'), 6000);
document.addEventListener('touchmove', (e) => { if (!(e.target as HTMLElement).closest('#panel')) e.preventDefault(); }, { passive: false });

requestAnimationFrame(frame);
