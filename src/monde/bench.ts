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
import { Gfx } from '../engine3/gfx';
import { paint3 } from '../engine3/paint-gl';
import { makeCanvas } from './sprites';
import { arrival, chapterIndex } from './biomes';
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
  lod: { zoom: string; mode: string; fps: number; cpu: Summary; perStep: Summary; levels: number[] }[];
  species: { id: string; nodes: number; stepUs: number; drawUs: number; paths: number[] }[];
}

let running = false;

/**
 * Fidelity of the WebGL painter: every species in one pose, drawn by the
 * canvas (draw3) and by WebGL (paint3) at three levels of detail, side by
 * side; the mean difference of the pixels (0..255) for each. ?bench=compare
 */
export async function compareSpecies(out: HTMLElement): Promise<void> {
  out.hidden = false;
  out.innerHTML = '<p class="busy">Canvas / WebGL : chaque espèce…</p>';
  const w = 240, h = 170, ids = Object.keys(SPECIES);
  const a = makeCanvas(w, h), ga = a.getContext('2d', { willReadFrequently: true })!;
  const b = makeCanvas(w, h), gl = b.getContext('webgl2', { antialias: true, alpha: false, depth: true, preserveDrawingBuffer: true })!;
  const gfx = new Gfx(gl);
  gfx.resize(w, h);
  const bb = makeCanvas(w, h), gb = bb.getContext('2d', { willReadFrequently: true })!;
  const sheet = makeCanvas(w * 2 * 3, h * ids.length), gs = sheet.getContext('2d')!;
  const bg = [0.22, 0.42, 0.52];
  const diffs: { id: string; d: number[] }[] = [];
  ids.forEach((id, row) => {
    const cr = new Creature3(SPECIES[id](), 0, 0, 0, { dir: { x: 1, y: 0, z: 0 }, scale: 1, phase: 1 });
    for (let i = 0; i < 90; i++) cr.steer(i * STEP, 1.2, 0.3 * Math.sin(i * 0.1), 0, 0.1);
    const box = cr.box, sizes = [200, 80, 30], d: number[] = [];
    for (let lv = 0; lv < 3; lv++) {
      const k = sizes[lv] / Math.max(1, box[3] - box[0], box[4] - box[1]);
      const view = new Ortho(k, w / 2 - ((box[0] + box[3]) / 2) * k, h / 2 - ((box[1] + box[4]) / 2) * k);
      ga.setTransform(1, 0, 0, 1, 0, 0);
      ga.fillStyle = `rgb(${bg.map((v) => Math.round(v * 255)).join(',')})`;
      ga.fillRect(0, 0, w, h);
      draw3(ga, cr, view, { ink: true, water: 0.5, lod: lv });
      gfx.begin(bg[0], bg[1], bg[2]);
      gfx.setTransform(1, 0, 0, 1, 0, 0);
      paint3(gfx, cr, view, { ink: true, water: 0.5, lod: lv }, true);
      gfx.end();
      gb.drawImage(b, 0, 0);
      const pa = ga.getImageData(0, 0, w, h).data, pb = gb.getImageData(0, 0, w, h).data;
      let sum = 0, n = 0;
      for (let i = 0; i < pa.length; i += 4) {
        const e = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
        // only where something is drawn in one of them
        const bgA = Math.abs(pa[i] - bg[0] * 255) + Math.abs(pa[i + 1] - bg[1] * 255) + Math.abs(pa[i + 2] - bg[2] * 255);
        const bgB = Math.abs(pb[i] - bg[0] * 255) + Math.abs(pb[i + 1] - bg[1] * 255) + Math.abs(pb[i + 2] - bg[2] * 255);
        if (bgA > 6 || bgB > 6) { sum += e / 3; n++; }
      }
      d.push(n ? sum / n : 0);
      gs.drawImage(a, lv * w * 2, row * h);
      gs.drawImage(b, lv * w * 2 + w, row * h);
    }
    diffs.push({ id, d });
  });
  diffs.sort((x, y) => y.d[0] - x.d[0]);
  (window as unknown as { __cmp: unknown }).__cmp = { diffs, sheet: sheet.toDataURL('image/png') };
  out.innerHTML = `<button class="close" aria-label="Fermer">×</button><h2>Canvas / WebGL</h2>
    <p class="note">Écart moyen des pixels dessinés (0–255), niveaux 0 / 1 / 2 ; à gauche le canvas, à droite WebGL.</p>
    <div class="scroll"><table><tr><th>espèce</th><th>N0</th><th>N1</th><th>N2</th></tr>${diffs.map((x) => `<tr><td>${x.id}</td>${x.d.map((v) => `<td>${v.toFixed(1)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  const img = new Image();
  img.src = sheet.toDataURL('image/png');
  img.style.maxWidth = '100%';
  out.append(img);
  out.querySelector('.close')!.addEventListener('click', () => { out.hidden = true; });
  console.log('COMPARE_DONE');
}

export async function runBench(api: A, out: HTMLElement): Promise<BenchResult | null> {
  if (running) return null;
  running = true;
  out.hidden = false;
  const say = (s: string) => { out.innerHTML = `<p class="busy">${s}</p>`; };
  const keep = { farEvery: api.opts.farEvery, lock: api.lockQuality.v, x: api.player.cr.root.x[0], y: api.player.cr.root.y[0] };
  const keepBias = api.bias, keepZoom = api.input.zoomMul;
  api.lockQuality.v = true;
  api.setQuality(1);
  api.setBias(1);
  // reading a pixel back forces the rasterisation into the measure (useful with a software canvas), but repeated
  // read-backs make Chrome move a GPU canvas to the CPU: only on demand (?bench=flush)
  api.opts.flush = new URLSearchParams(location.search).get('bench') === 'flush';
  const res: BenchResult = {
    when: new Date().toISOString(), ua: navigator.userAgent, screen: api.size, dpr: api.dpr, tour: [], load: [], farBake: [], lod: [], species: []
  };

  // ?bench=tour: the tour only; ?bench=lod: the levels of detail only (quick before / after)
  const only = new URLSearchParams(location.search).get('bench') || '';

  // 1. the tour
  for (let i = 0; i < api.biomes.length && only !== 'lod' && only !== 'species'; i++) {
    const b = api.biomes[i];
    say(`Tour du monde : ${b.name}…`);
    api.gotoBiome(i);
    const { x, y } = arrival(i);
    api.auto.on = true; api.auto.x = x + 900; api.auto.y = y;
    await frames(api, 90);
    const rec = newRec();
    let near = 0, live = 0, plants = 0, items = 0, n = 0;
    const tick = setInterval(() => { near += api.counts.near; live += api.counts.live; plants += api.counts.plants; items += api.counts.items; n++; }, 100);
    await frames(api, 240, rec);
    clearInterval(tick);
    res.tour.push({ biome: b.name, near: Math.round(near / n), live: Math.round(live / n), plants: Math.round(plants / n), items: Math.round(items / n), ...brief(rec) });
  }

  // 2. the load, on the reef
  if (only !== 'tour' && only !== 'lod' && only !== 'species') {
    api.gotoBiome(chapterIndex('recif'));
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
  }

  if (only !== 'tour' && only !== 'species') {
    // levels of detail against the zoom, in the kelp forest (the heaviest place)
    api.gotoBiome(chapterIndex('foret'));
    for (const [zoom, z] of [['éloigné', 0.5], ['normal', 1], ['rapproché', 2.2]] as const) {
      api.input.zoomMul = z;
      for (const [mode, lod] of [['sans LOD', false], ['LOD', true]] as const) {
        say(`Zoom ${zoom}, ${mode}…`);
        api.opts.lod = lod;
        await frames(api, 45);
        const rec = newRec(), lv = [0, 0, 0, 0];
        let n = 0;
        const tick = setInterval(() => { for (let k = 0; k < 4; k++) lv[k] += api.lodCount[k]; n++; }, 100);
        await frames(api, 150, rec);
        clearInterval(tick);
        res.lod.push({ zoom, mode, fps: 1000 / sum(rec.dt).avg, cpu: sum(rec.cpu), perStep: sum(rec.perStep), levels: lv.map((v) => Math.round(v / (n || 1))) });
      }
    }
    api.opts.lod = true;
    api.input.zoomMul = keepZoom;
    api.setBias(keepBias);
  }

  if (only !== 'tour' && only !== 'lod') {
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
      // paths drawn at each level of detail (what an accelerated canvas pays for)
      const paths: number[] = [];
      let np = 0;
      const own = g as unknown as { fill?: (...a: unknown[]) => void; stroke?: (...a: unknown[]) => void };
      const P2 = CanvasRenderingContext2D.prototype as unknown as { fill: (...a: unknown[]) => void; stroke: (...a: unknown[]) => void };
      own.fill = function (this: unknown, ...a: unknown[]) { np++; P2.fill.apply(this, a); };
      own.stroke = function (this: unknown, ...a: unknown[]) { np++; P2.stroke.apply(this, a); };
      // each level at a size where it is used (its larger side: 200, 80, 25 px)
      for (let lv = 0; lv < 3; lv++) {
        const q = [200, 80, 25][lv] / Math.max(1, b[3] - b[0], b[4] - b[1]);
        np = 0;
        draw3(g, cr, new Ortho(q, 200 - ((b[0] + b[3]) / 2) * q, 150 - ((b[1] + b[4]) / 2) * q), { ink: true, water: 0.5, lod: lv });
        paths.push(np);
      }
      delete own.fill; delete own.stroke;
      res.species.push({ id, nodes, stepUs, drawUs, paths });
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
  const lod = r.lod.map((b) => `<tr><td>${b.zoom}</td><td>${b.mode}</td><td>${f0(b.fps)}</td><td>${f1(b.cpu.avg)}</td><td>${f1(b.perStep.avg)}</td><td>${b.levels.join(' / ')}</td></tr>`).join('');
  const far = r.farBake.map((b) => `<tr><td>toutes les ${b.farEvery}</td><td>${f1(b.cpu.avg)}</td><td>${f1(b.render.avg)}</td></tr>`).join('');
  const sp = r.species.slice(0, 12).map((s) => `<tr><td>${s.id}</td><td>${s.nodes}</td><td>${f0(s.stepUs)}</td><td>${f0(s.drawUs)}</td><td>${s.paths.join(' / ')}</td></tr>`).join('');
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
    <h3>Niveaux de détail et zoom (forêt de kelp)</h3>
    <div class="scroll"><table><tr><th>zoom</th><th></th><th>img/s</th><th>processeur</th><th>simu/pas</th><th>N0 / N1 / N2 / imposteurs</th></tr>${lod}</table></div>
    <h3>Moteur seul — les 12 espèces les plus chères</h3>
    <div class="scroll"><table><tr><th>espèce</th><th>nœuds</th><th>µs / pas</th><th>µs / dessin</th><th>tracés N0 / N1 / N2</th></tr>${sp}</table></div>`;
  out.querySelector('.close')!.addEventListener('click', () => { out.hidden = true; });
}
