// 3D prototype: the creatures swim in a vertical plane (z = 0) like in Hydra,
// the world around it is 3D: sea floor, reef wall behind, kelp in front and
// behind, the surface above. The camera faces the plane, slightly from above.

import * as THREE from 'three';
import { Creature, Flow, STEP, TAU, clamp, eachGlow, rand, rng, swimFactor, type Spec } from '../engine';
import { SPECIES } from '../content';
import { firstAncestor } from '../game/game';
import { Input } from '../game/input';
import { CreatureMesh, creatureMaterials } from './mesh';
import {
  BOUNDS, Kelp, WATER, causticTexture, floorAt, glowTexture, makeMeadow, makePlankton, makeRays, makeRocks,
  makeSargassum, makeSurface, makeTerrain, noise2, shared, type Rock
} from './world';
import './style.css';

// ----- settings (kept between visits) ----- //

const settings = { angle: 15, dist: 300 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('lignee3d-side') || '{}')); } catch { /* private mode */ }
const save = () => { try { localStorage.setItem('lignee3d-side', JSON.stringify(settings)); } catch { /* ignore */ } };

// ----- renderer ----- //

const canvas = document.getElementById('sea') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
let quality = 1;
const camera = new THREE.PerspectiveCamera(45, 1, 2, 5000);
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
  for (let k = 0; k < 900 && kelps.length < 90; k++) {
    const x = -600 + R() * 2900, z = -520 + R() * 640;
    // kelp grows in patches; some stand right in the swimming plane
    if (noise2(x / 320, z / 200, 51) < 0.55 || (Math.abs(x) < 220 && Math.abs(z) < 60)) continue;
    const kp = new Kelp(x, z, (-floorAt(x, z) - 4) * (0.55 + R() * 0.45), R, kelpMat);
    kelps.push(kp);
    scene.add(kp.mesh);
  }
}

// ----- creatures ----- //

const mats = creatureMaterials();
interface Actor {
  cr: Creature; mesh: CreatureMesh; kind: 'player' | 'swim' | 'floor' | 'sib';
  /** depth of its own vertical plane (swimmers), or where it lies (floor) */
  z: number; hx: number; hy: number; tx: number; ty: number; next: number;
}
const actors: Actor[] = [];

/** x, y are engine coordinates: y grows downward from the surface */
function addActor(sp: Spec, x: number, y: number, kind: Actor['kind'], scale = 1, z = 0): Actor {
  const cr = new Creature(sp, x, y, { dir: rand(0, TAU), scale });
  for (let i = 0; i < 60; i++) cr.update(i * STEP, 0, 0, 0.1);
  const mesh = new CreatureMesh(cr, mats, kind !== 'floor');
  if (kind === 'floor') mesh.y = floorAt(x, y) + 2;
  else mesh.group.position.z = z;
  scene.add(mesh.group);
  const a: Actor = { cr, mesh, kind, z, hx: x, hy: y, tx: x, ty: y, next: 0 };
  actors.push(a);
  return a;
}

const player = addActor(firstAncestor(), 0, 70, 'player', 1);
{
  const R = rng(3);
  for (let i = 0; i < 6; i++) addActor(firstAncestor(), rand(-160, 160), rand(40, 160), 'sib', 0.45 + R() * 0.15, rand(-40, 30));
  const swim: [string, number][] = [['meduse', 0], ['meduse', -140], ['hippocampe', -60], ['ctenophore', -200], ['poissonClown', 0], ['krill', 20], ['meduse', -320], ['anguille', -90], ['calmar', -260]];
  for (const [id, z] of swim) addActor(SPECIES[id](), rand(-500, 2200), rand(40, 220), 'swim', 1, z);
  // floor crawlers lie on the sand, in front of and behind the plane
  const floor = ['crevette', 'crevette', 'etoile', 'nudibranche', 'crabe', 'crevette', 'ophiure', 'verPlat', 'etoile', 'crabe'];
  for (const id of floor) addActor(SPECIES[id](), rand(-400, 2200), rand(-300, 120), 'floor', 1);
  // company near the start
  addActor(SPECIES.meduse(), 120, 60, 'swim', 1, -30);
  addActor(SPECIES.crevette(), -40, 60, 'floor', 0.8);
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
  const near = (a: Actor) => Math.abs(a.cr.root.x[0] - px) < 900;
  for (const a of actors) if (a.kind !== 'floor' && Math.abs(a.z) < 45 && near(a)) flow.add(a.cr);
  for (const a of actors) {
    if (a.kind === 'player' || !near(a)) continue;
    const c = a.cr, cr = c.root, x = cr.x[0], y = cr.y[0];
    if (a.kind === 'sib') {
      // siblings drift around the player, loosely
      if (t > a.next) { a.next = t + rand(1.5, 4); a.tx = rand(-70, 70); a.ty = rand(-50, 50); }
      const gx = px + a.tx - x, gy = py + a.ty - y, g = Math.hypot(gx, gy) || 1, d = Math.hypot(px - x, py - y);
      const sp = d > 260 ? 1.8 : 0.9 * Math.min(1, g / 60);
      c.update(t, (gx / g) * sp, (gy / g) * sp, 0.04);
      collide(c, a.z, rocks);
    } else {
      if (t > a.next || Math.hypot(a.tx - x, a.ty - y) < 20) {
        a.next = t + rand(3, 8);
        a.tx = a.hx + rand(-260, 260);
        a.ty = a.kind === 'floor' ? a.hy + rand(-120, 120) : clamp(a.hy + rand(-120, 120), 30, -floorAt(a.tx, a.z) - 40);
      }
      let dx = a.tx - x, dy = a.ty - y;
      if (a.kind === 'swim' && Math.abs(a.z) < 60) {
        const qx = x - px, qy = y - py, q = Math.hypot(qx, qy);
        if (q < 60) { dx += (qx / (q + 1)) * 200; dy += (qy / (q + 1)) * 200; }
      }
      const d = Math.hypot(dx, dy) || 1, sp = c.spec.swim.speed * 0.45 * swimFactor(c, t) * Math.min(1, d / 60);
      c.update(t, (dx / d) * sp, (dy / d) * sp, 0.05);
      if (a.kind === 'floor') a.mesh.y += (floorAt(cr.x[0], cr.y[0]) + 2 - a.mesh.y) * 0.1;
      else collide(c, a.z, rocks);
    }
  }
  for (const a of actors) if (a.kind !== 'floor' && Math.abs(a.z) < 45 && near(a)) flow.apply(a.cr, { push: 0.3, wake: 0.02, body: a.kind === 'player' ? 0.008 : 0.01 });

  // fish school: boids in the plane, scatter around the player
  let cx = 0, cz = 0, ax = 0, az = 0;
  for (let i = 0; i < FISH; i++) { cx += fish.x[i]; cz += fish.z[i]; ax += fish.vx[i]; az += fish.vz[i]; }
  cx /= FISH; cz /= FISH; ax /= FISH; az /= FISH;
  const gx = 500 + Math.sin(t * 0.05) * 900, gz = 150 + Math.cos(t * 0.07) * 70;
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

  // kelp near the player bends away from whoever swims through
  const pushers = [{ x: px, y: -py, z: 0, r: 12 }];
  for (const a of actors) if (a.kind !== 'player' && a.kind !== 'floor' && Math.abs(a.cr.root.x[0] - px) < 400) pushers.push({ x: a.cr.root.x[0], y: -a.cr.root.y[0], z: a.z, r: 7 });
  for (let i = 0; i < FISH; i += 3) if (Math.abs(fish.x[i] - px) < 400) pushers.push({ x: fish.x[i], y: -fish.z[i], z: fish.yo[i], r: 5 });
  for (const k of kelps) if (Math.abs(k.base.x - px) < 600) k.update(pushers, t);
  shared.player.value.set(px, -py, 0);
}

// ----- drawing ----- //

const dummy = new THREE.Object3D();
const underCol = new THREE.Color(), tmpC = new THREE.Color();

function render(): void {
  const r = player.cr.root, px = r.x[0], py = r.y[0];
  for (const a of actors) {
    const vis = Math.abs(a.cr.root.x[0] - px) < 1000;
    a.mesh.group.visible = vis;
    if (vis) a.mesh.sync(t);
  }
  // camera: in front of the plane, a little above, looking slightly down
  const dist = 300 / input.zoomMul, ang = (settings.angle * Math.PI) / 180;
  camTarget.x += (px + player.cr.vx * 16 - camTarget.x) * 0.08;
  camTarget.y += (-py - player.cr.vy * 16 - camTarget.y) * 0.08;
  camTarget.z = 0;
  const ty = Math.min(camTarget.y, -40);
  camera.position.set(camTarget.x, Math.min(-10, ty + Math.sin(ang) * dist), Math.cos(ang) * dist);
  camera.lookAt(camTarget.x, ty, 0);

  // above or below the surface
  const under = camera.position.y < 0;
  const depth = Math.max(0, -camTarget.y - 60);
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
    dummy.position.set(fish.x[i], -fish.z[i], fish.yo[i]);
    dummy.rotation.set(0, Math.sin(fish.ph[i]) * 0.3, -a);
    dummy.updateMatrix();
    fishMesh.setMatrixAt(i, dummy.matrix);
  }
  fishMesh.instanceMatrix.needsUpdate = true;

  // glows
  let g = 0;
  for (const a of actors) {
    if (!a.mesh.group.visible) continue;
    const flat = a.kind === 'floor', y0 = a.mesh.y, z0 = a.z;
    eachGlow(a.cr.list, (x, ey, _size, hue, al) => {
      if (g >= GLOWS) return;
      if (flat) glowPos.set([x, y0 + 1, ey], g * 3); else glowPos.set([x, -ey, z0 + 1], g * 3);
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
(window as unknown as { lignee3d: unknown }).lignee3d = { settings, player, camera, stats, actors, teleport: (x: number, y: number) => { player.cr.translate(x - player.cr.root.x[0], y - player.cr.root.y[0]); camTarget.set(x, -y, 0); } };

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
