// Performance tests of the 2.5D engine in the big world, run inside the page
// (button in the panel, or ?bench in the address). Three parts:
//  1. the tour: the swimmer crosses each biome; time per frame of the
//     simulation, of the drawing, and of the rasterisation (one pixel read
//     back forces the canvas to finish its work);
//  2. the load: more and more animals around the swimmer on the reef;
//  3. the engine alone: every species, simulated and drawn in isolation.
// The result is shown in a table and left in window.__bench.

import { STEP } from '../engine';
import { SPECIES } from '../content';
import { Creature3 } from '../engine3/creature3';
import { draw3 } from '../engine3/render3';
import { Ortho } from '../engine3/view';
import { makeCanvas } from '../game/bake';
import { biomeMid, floorAt } from './biomes';
import type { FrameSample, api as Api } from './main';

type A = typeof Api;

export interface Summary { avg: number; p50: number; p95: number; max: number; }
const sum = (v: number[]): Summary => {
  const s = v.slice().sort((a, b) => a - b), q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0;
  return { avg: v.reduce((a, b) => a + b, 0) / (v.length || 1), p50: q(0.5), p95: q(0.95), max: s[s.length - 1] || 0 };
};

interface Rec { cpu: number[]; update: number[]; render: number[]; flush: number[]; dt: number[]; perStep: number[]; }
function frames(api: A, n: number, rec?: Rec): Promise<void> {
  return new Promise((done) => {
    let k = 0;
    api.setFrameHook((s: FrameSample) => {
      if (rec) {
        rec.cpu.push(s.update + s.render + s.flush); rec.update.push(s.update); rec.render.push(s.render); rec.flush.push(s.flush); rec.dt.push(s.dt);
        if (s.steps) rec.perStep.push(s.update / s.steps);
      }
      if (++k >= n) { api.setFrameHook(null); done(); }
    });
  });
}
const newRec = (): Rec => ({ cpu: [], update: [], render: [], flush: [], dt: [], perStep: [] });
const brief = (r: Rec) => ({
  cpu: sum(r.cpu), update: sum(r.update), perStep: sum(r.perStep), render: sum(r.render), flush: sum(r.flush),
  fps: 1000 / sum(r.dt).avg, over16: r.cpu.filter((c) => c > 16.7).length / (r.cpu.length || 1)
});

export interface BenchResult {
  when: string; ua: string; screen: number[]; dpr: number;
  tour: ({ biome: string; near: number; live: number; plants: number; items: number } & ReturnType<typeof brief>)[];
  load: ({ extra: number; near: number } & ReturnType<typeof brief>)[];
  farBake: { farEvery: number; cpu: Summary; render: Summary }[];
  lod: { level: number; fps: number; cpu: Summary }[];
  species: { id: string; nodes: number; stepUs: number; drawUs: number }[];
}

let running = false;

export async function runBench(api: A, out: HTMLElement): Promise<BenchResult | null> {
  if (running) return null;
  running = true;
  out.hidden = false;
  const say = (s: string) => { out.innerHTML = `<p class="busy">${s}</p>`; };
  const keep = { farEvery: api.opts.farEvery, lock: api.lockQuality.v, x: api.player.cr.root.x[0], y: api.player.cr.root.y[0] };
  const keepLod = api.lod;
  api.lockQuality.v = true;
  api.setQuality(1);
  api.setLod(0);
  // reading a pixel back forces the rasterisation into the measure (useful with a software canvas), but repeated
  // read-backs make Chrome move a GPU canvas to the CPU: only on demand (?bench=flush)
  api.opts.flush = new URLSearchParams(location.search).get('bench') === 'flush';
  const res: BenchResult = {
    when: new Date().toISOString(), ua: navigator.userAgent, screen: api.size, dpr: api.dpr, tour: [], load: [], farBake: [], lod: [], species: []
  };

  // 1. the tour
  for (let i = 0; i < api.biomes.length; i++) {
    const b = api.biomes[i];
    say(`Tour du monde : ${b.name}…`);
    api.gotoBiome(i);
    const x = biomeMid(i), y = Math.max(120, floorAt(x, 0) - 260);
    api.auto.on = true; api.auto.x = x + 900; api.auto.y = y;
    await frames(api, 90);
    const rec = newRec();
    let near = 0, live = 0, plants = 0, items = 0, n = 0;
    const tick = setInterval(() => { near += api.counts.near; live += api.counts.live; plants += api.counts.plants; items += api.counts.items; n++; }, 100);
    await frames(api, 240, rec);
    clearInterval(tick);
    res.tour.push({ biome: b.name, near: Math.round(near / n), live: Math.round(live / n), plants: Math.round(plants / n), items: Math.round(items / n), ...brief(rec) });
  }

  // ?bench=tour: the tour only (a quick before / after)
  const tourOnly = new URLSearchParams(location.search).get('bench') === 'tour';

  // 2. the load, on the reef
  if (!tourOnly) {
    api.gotoBiome(2);
    api.auto.on = false;
    for (const extra of [0, 25, 50, 100, 200]) {
      say(`Charge : ${extra} animaux en plus autour de la larve…`);
      api.clearCrowd();
      api.spawnCrowd(extra, 7);
      await frames(api, 40);
      const rec = newRec();
      let near = 0, n = 0;
      const tick = setInterval(() => { near += api.counts.near; n++; }, 100);
      await frames(api, 150, rec);
      clearInterval(tick);
      res.load.push({ extra, near: Math.round(near / n), ...brief(rec) });
    }
    // far animals baked every frame or every few frames (with the biggest crowd)
    for (const every of [1, 3]) {
      say(`Images des animaux lointains : une fois toutes les ${every} images…`);
      api.opts.farEvery = every;
      await frames(api, 30);
      const rec = newRec();
      await frames(api, 150, rec);
      res.farBake.push({ farEvery: every, cpu: sum(rec.cpu), render: sum(rec.render) });
    }
    api.clearCrowd();
    api.opts.farEvery = keep.farEvery;

    // levels of detail, in the kelp forest (the heaviest place)
    api.gotoBiome(1);
    for (let k = 0; k < 3; k++) {
      say(`Niveau de détail ${k}…`);
      api.setLod(k);
      await frames(api, 40);
      const rec = newRec();
      await frames(api, 150, rec);
      res.lod.push({ level: k, fps: 1000 / sum(rec.dt).avg, cpu: sum(rec.cpu) });
    }
    api.setLod(keepLod);

    // 3. the engine alone, species by species (the world is paused: one clean measure)
    say('Moteur seul : chaque espèce…');
    await frames(api, 2);
    const c = makeCanvas(400, 300), g = c.getContext('2d')!;
    // warm up (the first draws on a new canvas pay for setting it up)
    { const w = new Creature3(SPECIES.crevette(), 200, 150, 0, { dir: { x: 1, y: 0, z: 0 } }); for (let i = 0; i < 30; i++) draw3(g, w, new Ortho(1)); g.getImageData(0, 0, 1, 1); }
    for (const id of Object.keys(SPECIES)) {
      const cr = new Creature3(SPECIES[id](), 0, 0, 0, { dir: { x: 1, y: 0, z: 0 }, scale: 1 });
      let nodes = 0;
      for (const s of cr.list) nodes += s.n + 1;
      for (let i = 0; i < 30; i++) cr.steer(i * STEP, 1, 0.2, 0, 0.1);
      const N = 300;
      let t0 = performance.now();
      for (let i = 0; i < N; i++) cr.steer((30 + i) * STEP, i % 120 < 60 ? 1.5 : -1.5, Math.sin(i * 0.05), 0, 0.1);
      const stepUs = ((performance.now() - t0) / N) * 1000;
      const b = cr.box, k = Math.min(1.5, 360 / Math.max(1, b[3] - b[0], b[4] - b[1])), view = new Ortho(k, 200 - ((b[0] + b[3]) / 2) * k, 150 - ((b[1] + b[4]) / 2) * k);
      const D = 60;
      g.getImageData(0, 0, 1, 1);
      t0 = performance.now();
      for (let i = 0; i < D; i++) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 400, 300); draw3(g, cr, view, { ink: true, water: 0.5 }); }
      g.getImageData(0, 0, 1, 1);
      const drawUs = ((performance.now() - t0) / D) * 1000;
      res.species.push({ id, nodes, stepUs, drawUs });
      await new Promise((r) => setTimeout(r, 0));
    }
    res.species.sort((a, b) => b.stepUs + b.drawUs - (a.stepUs + a.drawUs));
  }

  api.opts.flush = false;
  api.lockQuality.v = keep.lock;
  api.teleport(keep.x, keep.y);
  (window as unknown as { __bench: BenchResult }).__bench = res;
  show(res, out);
  running = false;
  console.log('BENCH_DONE');
  return res;
}

const f1 = (v: number) => v.toFixed(1), f0 = (v: number) => v.toFixed(0);

function show(r: BenchResult, out: HTMLElement): void {
  const tour = r.tour.map((b) => `<tr><td>${b.biome}</td><td>${f0(b.fps)}</td><td>${f1(b.cpu.avg)}</td><td>${f1(b.cpu.p95)}</td><td>${f1(b.perStep.avg)}</td><td>${f1(b.render.avg)}</td><td>${f1(b.flush.avg)}</td><td>${b.near}</td><td>${b.plants}</td><td>${b.items}</td></tr>`).join('');
  const load = r.load.map((b) => `<tr><td>+${b.extra}</td><td>${b.near}</td><td>${f0(b.fps)}</td><td>${f1(b.cpu.avg)}</td><td>${f1(b.cpu.p95)}</td><td>${f1(b.perStep.avg)}</td><td>${f1(b.render.avg)}</td><td>${f1(b.flush.avg)}</td></tr>`).join('');
  const lod = r.lod.map((b) => `<tr><td>niveau ${b.level}</td><td>${f0(b.fps)}</td><td>${f1(b.cpu.avg)}</td></tr>`).join('');
  const far = r.farBake.map((b) => `<tr><td>toutes les ${b.farEvery}</td><td>${f1(b.cpu.avg)}</td><td>${f1(b.render.avg)}</td></tr>`).join('');
  const sp = r.species.slice(0, 12).map((s) => `<tr><td>${s.id}</td><td>${s.nodes}</td><td>${f0(s.stepUs)}</td><td>${f0(s.drawUs)}</td></tr>`).join('');
  out.innerHTML = `
    <button class="close" aria-label="Fermer">×</button>
    <h2>Performance</h2>
    <p class="note">${r.screen[0]}×${r.screen[1]} css px, canvas ${r.screen[2]}×${r.screen[3]}. Temps en ms par image (processeur : simulation + dessin + rastérisation).</p>
    <h3>Tour du monde</h3>
    <div class="scroll"><table><tr><th>Biome</th><th>img/s</th><th>moy.</th><th>p95</th><th>simu/pas</th><th>dessin</th><th>raster</th><th>animaux</th><th>plantes</th><th>objets</th></tr>${tour}</table></div>
    <h3>Charge (Récif)</h3>
    <div class="scroll"><table><tr><th>ajout</th><th>proches</th><th>img/s</th><th>moy.</th><th>p95</th><th>simu/pas</th><th>dessin</th><th>raster</th></tr>${load}</table></div>
    <h3>Animaux lointains re-cuits…</h3>
    <div class="scroll"><table><tr><th></th><th>moy.</th><th>dessin</th></tr>${far}</table></div>
    <h3>Niveaux de détail (forêt de kelp)</h3>
    <div class="scroll"><table><tr><th></th><th>img/s</th><th>processeur</th></tr>${lod}</table></div>
    <h3>Moteur seul — les 12 espèces les plus chères</h3>
    <div class="scroll"><table><tr><th>espèce</th><th>nœuds</th><th>µs / pas</th><th>µs / dessin</th></tr>${sp}</table></div>`;
  out.querySelector('.close')!.addEventListener('click', () => { out.hidden = true; });
}
