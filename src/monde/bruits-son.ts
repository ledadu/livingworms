// The noises of the sea in the game (bruits.ts), played with the Web Audio API into the noises' bus of son.ts. Two
// loops of noise feed the beds that are there all along (the water, the waves overhead, the rush along the body, the
// rumble of the chimneys, the low notes of the galleries); a clock schedules the noises that come now and then
// (bubbles, drops, ice, crystals, whales) a little ahead of time. Under the vault of the Grotte, everything also goes
// through the echo of its walls. Where a recording is ready (enregistrements-son.ts), it plays instead of the sound
// made in the code: the water, the waves overhead, the bubbles, the ice, the whales. On a live context (the game) or an
// offline one (the report).

import { clamp, rng } from '../engine';
import { arrival, biomeMid, chapterIndex, floorAt, metres, type ChapterId } from './biomes';
import {
  CAVE_ECHO, CAVE_MODES, bedAt, burst, caveAt, crack, drips, farWhale, heard, hushIn, noiseLoop, roarAt, rushOf, surfAt,
  swellAt, tinkle, voiceOf, call, waitFor, wavesAt, type Bubble, type Unit
} from './bruits';
import { cueGain, type Cue, type RecName } from './enregistrements';
import { NO_RECORDINGS, recordings, type Rec, type Recordings } from './enregistrements-son';
import type { Moment } from './musique';
import { buildGraph, release, son, type Graph } from './son';

/** how far ahead the noises are scheduled, and how often the clock looks (s) */
const AHEAD = 0.4, TICK = 0.1;
/** how many noises may sound at once (beyond, the next ones wait their turn) */
const MAX_VOICES = 28;

/** the levels of the beds, as they come into the noises' bus */
const LEVEL = { water: 0.3, surf: 1.2, rush: 0.6, roar: 0.8, modes: 0.8, echo: 0.25, bubble: 0.5, drip: 0.65, click: 1.2, groan: 0.3, boom: 0.9, tinkle: 0.14, cry: 0.5, far: 0.5 };
/** the levels of the recordings, so that each sits where the sound it replaces did */
const REC = { water: 0.5, surf: 0.5, bubble: 0.6, ice: 2.5, whale: 1.3 };

export type Noise = 'bubbles' | 'drips' | 'cracks' | 'tinkles' | 'whales' | 'springs' | 'cries';

/** a place that bubbles: a seep in the sand, a chimney of the Sources */
export interface Spring { kind: string; x: number; z: number; }

/** where the swimmer listens from, and what goes on there */
export interface Here {
  x: number; y: number;
  /** how fast the swimmer goes (px a step), and the current that pushes it (0..1) */
  speed: number; current: number;
  /** what the story is at */
  moment: Moment;
  /** whether the noises sound at all (their volume) */
  on: boolean;
}

export function bruitsEngine(G: Graph, springs: readonly Spring[] = [], seed = 1, recs: Recordings = recordings(G.c)) {
  const c = G.c, r = rng(seed);
  const out = c.createGain();
  out.gain.value = 0;
  out.connect(G.fx);

  // the echo of the walls of the Grotte: a few delays fed back into themselves and a little into each other (wired to
  // the bus only under the vault: out of it, nothing of it is computed)
  const caveIn = c.createGain();
  caveIn.gain.value = 0;
  const taps = CAVE_ECHO.delays.map((s) => {
    const dl = c.createDelay(1), lp = c.createBiquadFilter(), fb = c.createGain();
    dl.delayTime.value = s;
    lp.type = 'lowpass';
    lp.frequency.value = CAVE_ECHO.lp;
    fb.gain.value = CAVE_ECHO.feedback;
    caveIn.connect(dl);
    dl.connect(lp).connect(fb).connect(dl);
    return { dl, fb, lp };
  });
  taps.forEach((t, i) => {
    const x = c.createGain();
    x.gain.value = CAVE_ECHO.cross;
    t.fb.connect(x).connect(taps[(i + 1) % taps.length].dl);
  });

  function loop(kind: 'pink' | 'brown', seconds: number): AudioBuffer {
    const d = noiseLoop(kind, Math.round(c.sampleRate * seconds), rng(seed * 31 + seconds)), b = c.createBuffer(1, d.length, c.sampleRate);
    b.getChannelData(0).set(d);
    return b;
  }
  const brown = loop('brown', 5.3), pink = loop('pink', 4.1);

  function gain(v = 0): GainNode { const g = c.createGain(); g.gain.value = v; return g; }
  function filter(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const b = c.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  // ----- the beds ----- //

  interface Beds {
    srcs: AudioBufferSourceNode[]; nodes: AudioNode[];
    water: GainNode; waterCut: BiquadFilterNode; surf: GainNode; surfBand: BiquadFilterNode; hi: AudioBufferSourceNode; rush: GainNode; rushBand: BiquadFilterNode; roar: GainNode; modes: GainNode;
    /** the narrow bands of the galleries, wired only under their vault (with the echo of their walls) */
    lo: AudioBufferSourceNode; bands: BiquadFilterNode[]; cave: boolean;
    /** the recordings of the water and of the waves, once ready, and when they came (the noise they replace then lets go) */
    rec: Partial<Record<'water' | 'surf', { g: GainNode; lp: BiquadFilterNode; since: number; head: AudioNode; from: AudioNode }>>;
  }
  let beds: Beds | null = null;

  function startBeds(now: number): Beds {
    const lo = c.createBufferSource(), hi = c.createBufferSource();
    lo.buffer = brown; hi.buffer = pink;
    lo.loop = hi.loop = true;
    const waterCut = filter('lowpass', 600), water = gain(), surfBand = filter('bandpass', 650, 0.6), surf = gain();
    const rushBand = filter('bandpass', 400, 1.1), rush = gain(), roarCut = filter('lowpass', 150), roar = gain(), modes = gain();
    lo.connect(waterCut).connect(water).connect(out);
    lo.connect(roarCut).connect(roar).connect(out);
    hi.connect(surfBand).connect(surf).connect(out);
    hi.connect(rushBand).connect(rush).connect(out);
    const nodes: AudioNode[] = [lo, hi, waterCut, water, surfBand, surf, rushBand, rush, roarCut, roar, modes];
    // the galleries ring: the water's breath through a few narrow bands at their low notes
    const bands = CAVE_MODES.map((f) => {
      const b = filter('bandpass', f, 22);
      b.connect(modes);
      nodes.push(b);
      return b;
    });
    modes.connect(out);
    lo.start(now); hi.start(now);
    return { srcs: [lo, hi], nodes, water, waterCut, surf, rush, rushBand, roar, modes, lo, bands, cave: false, rec: {}, hi, surfBand };
  }

  /** a recording looped into a bed, from anywhere in it, through a low-pass, in place of the noise `from` -> `head` */
  function recBed(b: Beds, k: 'water' | 'surf', rec: Rec, from: AudioNode, head: AudioNode): void {
    const s = c.createBufferSource(), lp = filter('lowpass', 2000), g = gain();
    s.buffer = rec.buffer;
    s.loop = true;
    s.connect(lp).connect(g).connect(out);
    s.start(now, r() * rec.buffer.duration);
    b.srcs.push(s);
    b.nodes.push(s, lp, g);
    b.rec[k] = { g, lp, since: now, head, from };
  }

  /** the beds the recordings play: each takes the place of its noise, which fades out, then lets go */
  function recBeds(b: Beds, t: number): void {
    const w = recs.get('eau'), s = recs.get('ressac');
    if (w && !b.rec.water) recBed(b, 'water', w, b.lo, b.waterCut);
    if (s && !b.rec.surf) recBed(b, 'surf', s, b.hi, b.surfBand);
    for (const q of Object.values(b.rec)) if (q && q.since >= 0 && t - q.since > 3) {
      q.from.disconnect(q.head);
      q.since = -1;
    }
  }

  /** under the vault of the Grotte (or out of it): its bands and the echo of its walls wired in (or let go) */
  function underVault(b: Beds, on: boolean): void {
    if (on === b.cave) return;
    b.cave = on;
    for (const f of b.bands) if (on) b.lo.connect(f); else b.lo.disconnect(f);
    for (const q of taps) if (on) q.lp.connect(G.fx); else q.lp.disconnect(G.fx);
    if (on) out.connect(caveIn); else out.disconnect(caveIn);
  }

  function stopBeds(b: Beds, now: number): void {
    underVault(b, false);
    for (const s of b.srcs) try { s.stop(now + 0.3); } catch { /* not started */ }
    release(b.srcs[0], b.nodes);
    for (const g of [b.water, b.surf, b.rush, b.roar, b.modes]) was.delete(g.gain);
    was.delete(b.waterCut.frequency); was.delete(b.rushBand.frequency);
    for (const q of Object.values(b.rec)) if (q) { was.delete(q.g.gain); was.delete(q.lp.frequency); }
  }

  /**
   * A parameter moved toward v at each step of the clock, only when it changes enough. A filter's frequency jumps
   * there instead: one that glides costs several times more, as long as it lives (docs/direction-artistique.md).
   */
  const was = new Map<AudioParam, number>();
  function glide(p: AudioParam, v: number, now: number, tc = 0.25, eps = 0.004, jump = false): void {
    const w = was.get(p);
    if (w !== undefined && Math.abs(w - v) <= eps * Math.max(1, Math.abs(w))) return;
    was.set(p, v);
    if (jump) p.setValueAtTime(v, now); else p.setTargetAtTime(v, now, tc);
  }

  // ----- the noises now and then ----- //

  let voices = 0;
  const played: Record<Noise, number> = { bubbles: 0, drips: 0, cracks: 0, tinkles: 0, whales: 0, springs: 0, cries: 0 };
  /** how many noises of each recording have been heard */
  const heardRec: Record<RecName, number> = { eau: 0, ressac: 0, bulles: 0, glace: 0, baleines: 0 };

  /**
   * A noise's way out: from a side, muffled by its distance, into the noises' bus; `wet`, a share of it that only goes
   * to the reverb (a far noise), `dry` how much of it does not. Its nodes are let go once it has ended.
   */
  function way(h: { pan: number; cut: number }, t: number, end: number, made: AudioNode[], wet = 0, dry = 1): AudioNode {
    // (a low-pass only where it cuts something)
    const head: AudioNode = h.cut < 9000 ? filter('lowpass', h.cut, 0.5) : gain(1);
    let tail: AudioNode = head;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = h.pan;
      head.connect(p);
      tail = p;
      made.push(p);
    }
    if (dry < 1) { const g = gain(dry); tail.connect(g).connect(out); made.push(g); } else tail.connect(out);
    if (wet > 0) { const g = gain(wet); tail.connect(g).connect(G.far); made.push(g); }
    made.push(head);
    voices++;
    // a silent source that ends with the noise
    const s = c.createConstantSource();
    s.offset.value = 0;
    s.connect(head);
    s.start(t); s.stop(end);
    release(s, made, () => { s.disconnect(); voices--; });
    return head;
  }

  /**
   * A noise of a recording (one of its cues, `q`), at t, at this rate (its pitch and its pace), into `into`, faded in
   * and out over these times (s). Its end (s).
   */
  function recCue(rec: Rec, q: Cue, t: number, g: number, rate: number, into: AudioNode, made: AudioNode[], fin = 0.004, fout = 0.06): number {
    const s = c.createBufferSource(), env = gain(), len = q.len / rate, k = g * cueGain(q);
    s.buffer = rec.buffer;
    s.playbackRate.value = rate;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(k, t + fin);
    env.gain.setValueAtTime(k, t + Math.max(fin, len - fout));
    env.gain.linearRampToValueAtTime(0, t + len);
    s.connect(env).connect(into);
    s.start(t, q.at, q.len);
    made.push(s, env);
    heardRec[rec.name]++;
    return t + len;
  }
  /** a recording that holds several noises, if it is ready, and one of them at random */
  function recOf(name: RecName): { rec: Rec; q: Cue } | null {
    const rec = recs.get(name);
    return rec?.cues.length ? { rec, q: rec.cues[Math.floor(r() * rec.cues.length)] } : null;
  }

  function bubbles(list: Bubble[], t: number, h: { g: number; pan: number; cut: number }, level: number): void {
    const real = recOf('bulles');
    if (real) {
      // a puff of the recording, pitched by the size of the bubbles it stands for (a big one lower and slower)
      const f = list.reduce((a, b) => a + b.f0, 0) / list.length, rate = clamp(Math.sqrt(f / 2400), 0.75, 1.3), made: AudioNode[] = [];
      recCue(real.rec, real.q, t, h.g * level * REC.bubble, rate, way(h, t, t + real.q.len / rate + 0.1, made), made);
      return;
    }
    const made: AudioNode[] = [], end = t + list[list.length - 1].at + 0.4, into = way(h, t, end, made);
    for (const b of list) {
      const o = c.createOscillator(), env = c.createGain(), t0 = t + b.at;
      o.frequency.setValueAtTime(b.f0, t0);
      o.frequency.exponentialRampToValueAtTime(b.f1, t0 + b.len);
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(b.g * h.g * level * LEVEL.bubble, t0 + 0.004);
      env.gain.setTargetAtTime(0, t0 + 0.006, b.len / 3);
      o.connect(env).connect(into);
      o.start(t0); o.stop(t0 + b.len * 2 + 0.05);
      made.push(o, env);
    }
  }

  function drip(t: number, level: number): void {
    const h = heard((r() * 2 - 1) * 600, -100 - 250 * r(), 300 * r()), list = drips(r), made: AudioNode[] = [];
    const into = way(h, t, t + 0.8, made);
    for (const d of list) {
      const o = c.createOscillator(), env = c.createGain(), t0 = t + d.at;
      o.frequency.setValueAtTime(d.f0, t0);
      o.frequency.exponentialRampToValueAtTime(d.f1, t0 + d.rise);
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(d.g * h.g * level * LEVEL.drip, t0 + 0.002);
      env.gain.setTargetAtTime(0, t0 + 0.004, d.fade / 3);
      o.connect(env).connect(into);
      o.start(t0); o.stop(t0 + d.rise + d.fade * 2 + 0.05);
      made.push(o, env);
    }
    played.drips++;
  }

  function ice(t: number, level: number): void {
    const k = crack(r), h = heard((r() * 2 - 1) * 1400, (r() - 0.6) * 500, 300 + 1300 * r()), made: AudioNode[] = [];
    const last = k.clicks[k.clicks.length - 1].at, end = t + Math.max(last + 0.2, k.groan?.len ?? 0, k.boom ? k.boom.at + 2 : 0) + 0.1;
    const real = recOf('glace');
    if (real) {
      // the ice of the recording, each crack a little higher or lower
      const rate = 0.85 + 0.3 * r(), made2: AudioNode[] = [];
      recCue(real.rec, real.q, t, h.g * level * REC.ice, rate, way({ pan: h.pan, cut: Math.max(h.cut, 3000) }, t, t + real.q.len / rate + 0.1, made2, 0.6), made2, 0.004, 0.25);
      played.cracks++;
      return;
    }
    const into = way({ pan: h.pan, cut: Math.max(h.cut, 3000) }, t, end, made, 0.6), g = h.g * level;
    // the clicks: one burst of noise, its band and its loudness set click by click
    const src = c.createBufferSource(), band = filter('bandpass', k.clicks[0].f, k.clicks[0].q), env = gain();
    src.buffer = G.noise;
    src.loop = true;
    src.connect(band).connect(env).connect(into);
    for (const q of k.clicks) {
      const t0 = t + q.at;
      band.frequency.setValueAtTime(q.f, t0);
      band.Q.setValueAtTime(q.q, t0);
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(q.g * g * LEVEL.click, t0 + 0.001);
      env.gain.setTargetAtTime(0, t0 + 0.0015, q.len / 3);
    }
    src.start(t, r() * 0.5); src.stop(t + last + 0.1);
    made.push(src, band, env);
    if (k.groan) {
      const o = c.createOscillator(), lp = filter('lowpass', 380, 2), eg = gain(), n = k.groan.f.length;
      o.type = 'sawtooth';
      k.groan.f.forEach((f, i) => (i ? o.frequency.linearRampToValueAtTime(f, t + (k.groan!.len * i) / (n - 1)) : o.frequency.setValueAtTime(f, t)));
      eg.gain.setValueAtTime(0, t);
      eg.gain.linearRampToValueAtTime(g * LEVEL.groan, t + 0.25);
      eg.gain.setTargetAtTime(0, t + k.groan.len - 0.3, 0.1);
      o.connect(lp).connect(eg).connect(into);
      o.start(t); o.stop(t + k.groan.len + 0.2);
      made.push(o, lp, eg);
    }
    if (k.boom) {
      const o = c.createOscillator(), eg = gain(), t0 = t + k.boom.at;
      o.frequency.setValueAtTime(k.boom.f, t0);
      o.frequency.exponentialRampToValueAtTime(k.boom.f * 0.6, t0 + 1.2);
      eg.gain.setValueAtTime(0, t0);
      eg.gain.linearRampToValueAtTime(g * LEVEL.boom, t0 + 0.02);
      eg.gain.setTargetAtTime(0, t0 + 0.03, 0.4);
      o.connect(eg).connect(into);
      o.start(t0); o.stop(t0 + 2);
      made.push(o, eg);
    }
    played.cracks++;
  }

  function crystals(t: number, level: number): void {
    const h = heard((r() * 2 - 1) * 400, (r() * 2 - 1) * 200, 200 * r()), made: AudioNode[] = [], list = tinkle(r);
    const into = way(h, t, t + list[list.length - 1].at + 0.8, made);
    for (const n of list) for (const [k, g, fade] of [[1, 1, 0.12], [2.76, 0.25, 0.05]]) {
      const o = c.createOscillator(), env = gain(), t0 = t + n.at;
      o.frequency.value = n.f * k;
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(n.g * g * h.g * level * LEVEL.tinkle, t0 + 0.002);
      env.gain.setTargetAtTime(0, t0 + 0.003, fade);
      o.connect(env).connect(into);
      o.start(t0); o.stop(t0 + fade * 6);
      made.push(o, env);
    }
    played.tinkles++;
  }

  /** a whale's cries, from (dx, dy, dz) off the swimmer; `loud` how much louder than a whale unseen */
  function whale(units: Unit[], t: number, dx: number, dy: number, dz: number, level: number, loud: number, voice = 100, apart = 0): void {
    const h = heard(dx, dy, dz), made: AudioNode[] = [], last = units[units.length - 1];
    if (recs.get('baleines')?.cues.length) {
      // as many calls of the recording, pitched by the voice: one after the other, or `apart` (the second a little lower)
      const rate = clamp(Math.sqrt(voice / 100), 0.7, 1.4), list = units.map((u, i) => ({ ...recOf('baleines')!, g: u.g, rate: rate * (i && apart ? 0.94 : 1), at: 0 }));
      let at = 0, end = t;
      for (const [i, x] of list.entries()) {
        x.at = apart ? i * apart : at;
        at += x.q.len / x.rate + 0.4 + 1.6 * r();
        end = Math.max(end, t + x.at + x.q.len / x.rate);
      }
      const into = way({ pan: h.pan, cut: Math.min(h.cut, 2400) }, t, end + 0.1, made, 1, Math.min(1, h.g * 2));
      for (const x of list) recCue(x.rec, x.q, t + x.at, x.g * level * loud * REC.whale, x.rate, into, made, 0.15, 0.5);
      return;
    }
    const into = way({ pan: h.pan, cut: Math.min(h.cut, 1600) }, t, t + last.at + last.len + 0.8, made, 1, Math.min(1, h.g * 2));
    for (const u of units) {
      const o = c.createOscillator(), fm = filter('bandpass', u.pts[0][1] * u.formant, 1.4), env = gain(), t0 = t + u.at;
      o.type = u.wave;
      u.pts.forEach(([s, f], i) => (i ? o.frequency.linearRampToValueAtTime(f, t0 + s * u.len) : o.frequency.setValueAtTime(f, t0)));
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(u.g * level * loud, t0 + Math.min(0.35, u.len * 0.3));
      env.gain.setTargetAtTime(0, t0 + u.len * 0.75, u.len * 0.12);
      o.connect(fm).connect(env).connect(into);
      o.start(t0); o.stop(t0 + u.len + 0.3);
      made.push(o, fm, env);
    }
  }

  // ----- the clock ----- //

  const next: Record<'bubbles' | 'drips' | 'cracks' | 'tinkles' | 'whales', number> = { bubbles: Infinity, drips: Infinity, cracks: Infinity, tinkles: Infinity, whales: Infinity };
  const springNext = new Map<Spring, number>();
  /** the noise of a kind at t, at this level */
  const PLAY: Record<keyof typeof next, (t: number, level: number, here: Here) => void> = {
    bubbles(t, level, here) {
      const m = metres(here.y), dy = (r() - 0.4) * 500;
      bubbles(burst(r, 4), t, heard((r() * 2 - 1) * 700, m < 20 ? -here.y * r() : dy, 900 * r()), level);
      played.bubbles++;
    },
    drips: (t, level) => drip(t, level),
    cracks: (t, level) => ice(t, level),
    tinkles: (t, level) => crystals(t, level),
    whales(t, level) {
      const w = farWhale(r);
      whale(w.units, t, w.dx, 0, w.dz, level, LEVEL.far, w.voice);
      played.whales++;
    }
  };

  let level = 0, now = 0;
  /** the rates of the noises now and then, at x (a second) */
  function rates(here: Here): Record<keyof typeof next, number> {
    const b = bedAt(here.x), surf = surfAt(metres(here.y));
    return { bubbles: b.bubbles + surf * 0.5, drips: b.drips, cracks: b.cracks / 60, tinkles: b.tinkles, whales: b.whales / 60 };
  }

  /** the noises at `now` for the swimmer where `here` says */
  function tick(t: number, here: Here): void {
    now = t;
    const on = here.on;
    level = on ? hushIn(here.moment) : 0;
    glide(out.gain, level, t, 0.6);
    if (!on) {
      if (beds) { stopBeds(beds, t); beds = null; }
      for (const k of Object.keys(next) as (keyof typeof next)[]) next[k] = Infinity;
      springNext.clear();
      return;
    }
    beds ??= startBeds(t);
    const b = bedAt(here.x), m = metres(here.y), cave = caveAt(here.x), rush = rushOf(here.speed, here.current);
    let nearVent = Infinity;
    for (const s of springs) if (s.kind === 'vent') nearVent = Math.min(nearVent, Math.hypot(s.x - here.x, floorAt(s.x, s.z) - here.y, s.z * 0.6));
    recBeds(beds, t);
    const rw = beds.rec.water, rs = beds.rec.surf, surf = surfAt(m);
    glide(beds.water.gain, rw ? 0 : b.water * LEVEL.water * swellAt(t), t, 0.5);
    glide(beds.waterCut.frequency, b.lp, t, 0, 0.02, true);
    glide(beds.surf.gain, rs ? 0 : surf * wavesAt(t) * LEVEL.surf, t, 0.4);
    // (the recordings breathe and break on their own; the deeper, the duller)
    if (rw) { glide(rw.g.gain, b.water * REC.water, t, 0.5); glide(rw.lp.frequency, b.lp * 2.5, t, 0, 0.02, true); }
    if (rs) { glide(rs.g.gain, surf * REC.surf, t, 0.4); glide(rs.lp.frequency, 900 + 5000 * surf, t, 0, 0.03, true); }
    glide(beds.rush.gain, rush.g * LEVEL.rush, t, 0.12);
    glide(beds.rushBand.frequency, rush.f, t, 0, 0.03, true);
    glide(beds.roar.gain, roarAt(nearVent) * LEVEL.roar, t, 0.5);
    underVault(beds, cave > 0.001);
    glide(beds.modes.gain, cave * LEVEL.modes * swellAt(t + 3), t, 0.6);
    glide(caveIn.gain, cave * LEVEL.echo, t, 0.6);
    glide(G.fxSend.gain, b.space + cave * 0.2, t, 1);
    // the noises now and then, each at its pace here (those missed while the page was held up are let go, not all
    // played at once)
    const rt = rates(here);
    for (const k of Object.keys(next) as (keyof typeof next)[]) {
      if (rt[k] <= 1e-6) { next[k] = Infinity; continue; }
      if (!Number.isFinite(next[k]) || next[k] < t - TICK) next[k] = t + waitFor(r, rt[k]);
      while (next[k] < t + AHEAD) {
        if (voices < MAX_VOICES) PLAY[k](Math.max(next[k], t + 0.02), level, here);
        next[k] += waitFor(r, rt[k]);
      }
    }
    // the seeps and the chimneys near the swimmer bubble
    for (const s of springs) {
      const fy = floorAt(s.x, s.z), dx = s.x - here.x, dy = fy - here.y;
      if (Math.abs(dx) > 1300) { springNext.delete(s); continue; }
      const pace = s.kind === 'vent' ? 1.4 : 0.9;
      let at = springNext.get(s) ?? t + waitFor(r, pace);
      if (at < t - TICK) at = t + waitFor(r, pace);
      while (at < t + AHEAD) {
        if (voices < MAX_VOICES) { bubbles(burst(r, 6, s.kind === 'vent' ? 1.3 : 1), Math.max(at, t + 0.02), heard(dx, dy, s.z), level); played.springs++; }
        at += waitFor(r, pace);
      }
      springNext.set(s, at);
    }
  }

  return {
    tick,
    /** a big animal seen far away cries: its two cries, as its two waves leave (ondes-jeu.ts) */
    cry(dx: number, dy: number, dz: number, size: number): void {
      if (level <= 0) return;
      const v = voiceOf(size);
      whale(call(r, v, 2, 1.6), now + 0.05, dx, dy, dz, level, LEVEL.cry, v, 1.6);
      played.cries++;
    },
    /** a noise now, whatever the place (the tests, the report) */
    play(k: keyof typeof next, here: Here): void { PLAY[k](now + 0.05, Math.max(level, 1), here); },
    /** how many noises sound now, and how many of each have been heard (tests) */
    get voices() { return voices; },
    played, heardRec,
    /** the recordings that play now in the beds (tests) */
    get recorded() { return beds ? (Object.keys(beds.rec) as ('water' | 'surf')[]) : []; },
    /** the beds now (tests) */
    get beds() {
      if (!beds) return null;
      const v = (g: GainNode) => +(was.get(g.gain) ?? 0).toFixed(3);
      return { water: v(beds.water), surf: v(beds.surf), rush: v(beds.rush), roar: v(beds.roar), modes: v(beds.modes), cave: +(was.get(caveIn.gain) ?? 0).toFixed(3) };
    }
  };
}

export type BruitsEngine = ReturnType<typeof bruitsEngine>;

/**
 * The noises of chapter `id`, `seconds` long, at its middle and mid water (or at x, y), rendered offline with the
 * music or alone (the report): what is heard there, with `noises` played at their times.
 */
export async function renderBruits(id: ChapterId, seconds: number, o: {
  x?: number; y?: number; speed?: number; current?: number; springs?: Spring[]; music?: boolean;
  noises?: [number, 'bubbles' | 'drips' | 'cracks' | 'tinkles' | 'whales' | 'cry'][]; rate?: number; seed?: number;
  /** with the recordings (they are decoded first), or only the sounds made in the code */
  recordings?: boolean;
} = {}): Promise<AudioBuffer> {
  const rate = o.rate ?? 44100, c = new OfflineAudioContext(2, Math.round(seconds * rate), rate), G = buildGraph(c), i = chapterIndex(id);
  G.fade.gain.value = o.music ? 1 : 0;
  const recs = o.recordings === false ? NO_RECORDINGS : recordings(c);
  await recs.ready;
  const x = o.x ?? biomeMid(i), y = o.y ?? arrival(i).y, eng = bruitsEngine(G, o.springs ?? [], o.seed ?? 1, recs);
  const here: Here = { x, y, speed: o.speed ?? 0, current: o.current ?? 0, moment: null, on: true };
  const todo = [...(o.noises ?? [])].sort((a, b) => a[0] - b[0]);
  // the clock runs on the timeline of the offline context: it is suspended at each step, scheduled, then resumed
  for (let t = 0; t < seconds; t += TICK) {
    const at = t;
    void c.suspend(at).then(() => {
      eng.tick(at, here);
      while (todo.length && todo[0][0] <= at + 1e-6) {
        const [, k] = todo.shift()!;
        if (k === 'cry') eng.cry(-400, -300, 1500, 3); else eng.play(k, here);
      }
      void c.resume();
    });
  }
  return c.startRendering();
}

export interface BruitsDeps {
  /** where the swimmer listens from */
  where(): { x: number; y: number };
  /** the current that pushes the swimmer there (0..1) */
  current?(): number;
  /** the moment of the story, if any (a farewell, a parade) */
  moment?(): Moment;
  /** the seeps and the chimneys of the world */
  springs: readonly Spring[];
}

/** the noises of the game, once the page may sound */
export function initBruits(d: BruitsDeps) {
  const s = son();
  let eng: BruitsEngine | null = null;
  const here: Here = { x: 0, y: 0, speed: 0, current: 0, moment: null, on: true };
  let lastT = -1;
  s.onWake((G) => {
    const e = (eng = bruitsEngine(G, d.springs.filter((q) => q.kind === 'vent' || q.kind === 'seep'), (Math.random() * 2 ** 31) >>> 0));
    const step = () => {
      if (G.c.state !== 'running') return;
      const p = d.where(), t = G.c.currentTime;
      // how fast it went since the last look, in px a step of the world (60 a second), however it moved (swimming,
      // carried by the Remontée); a jump (a teleport) is not a speed
      const v = lastT >= 0 && t > lastT ? Math.hypot(p.x - here.x, p.y - here.y) / ((t - lastT) * 60) : 0;
      here.speed = v < 30 ? here.speed + (v - here.speed) * 0.5 : 0;
      here.x = p.x; here.y = p.y; lastT = t;
      here.current = d.current?.() ?? 0;
      here.moment = d.moment?.() ?? null;
      here.on = s.volumes.bruits > 0;
      e.tick(t, here);
    };
    step();
    setInterval(step, TICK * 1000);
  });
  return {
    /** a big animal far away cries, (dx, dy, dz) off the swimmer, this big (its scale) */
    cry(dx: number, dy: number, dz: number, size: number): void { eng?.cry(dx, dy, dz, size); },
    /** a noise now (tests) */
    play(k: 'bubbles' | 'drips' | 'cracks' | 'tinkles' | 'whales'): void { eng?.play(k, here); },
    get voices() { return eng?.voices ?? 0; },
    get played() { return eng?.played ?? null; },
    get beds() { return eng?.beds ?? null; },
    /** the noises of the recordings heard so far, and the beds they play (tests) */
    get heardRec() { return eng?.heardRec ?? null; },
    get recorded() { return eng?.recorded ?? []; }
  };
}

export type Bruits = ReturnType<typeof initBruits>;
