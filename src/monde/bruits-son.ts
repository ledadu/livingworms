// The noises of the sea in the game (bruits.ts), played with the Web Audio API into the noises' bus of son.ts. Two
// loops of noise feed the beds that are there all along (the water, the waves overhead, the rush along the body, the
// rumble of the chimneys, the low notes of the galleries); a clock schedules the noises that come now and then
// (bubbles, drops, ice, crystals, whales) a little ahead of time. Under the vault of the Grotte, everything also goes
// through the echo of its walls. On a live context (the game) or an offline one (the report).

import { rng } from '../engine';
import { arrival, biomeMid, chapterIndex, floorAt, metres, type ChapterId } from './biomes';
import {
  CAVE_ECHO, CAVE_MODES, bedAt, burst, caveAt, crack, drips, farWhale, heard, hushIn, noiseLoop, roarAt, rushOf, surfAt,
  springTrains, bubblingAt, swellAt, tinkle, train, voiceOf, call, waitFor, wavesAt, type Bubble, type Unit
} from './bruits';
import { CLEAR, REACH, type Heard } from './ecoute';
import type { Moment } from './musique';
import { buildGraph, release, son, type Graph } from './son';

/** how far ahead the noises are scheduled, and how often the clock looks (s) */
const AHEAD = 0.4, TICK = 0.1;
/** how many noises may sound at once (beyond, the next ones wait their turn) */
const MAX_VOICES = 28;

/** the levels of the beds, as they come into the noises' bus */
const LEVEL = { water: 0.3, surf: 1.2, rush: 0.6, roar: 0.8, modes: 0.8, echo: 0.25, bubble: 0.5, drip: 0.65, click: 1.2, groan: 0.3, boom: 0.9, tinkle: 0.14, cry: 0.5, far: 0.5 };

export type Noise = 'bubbles' | 'drips' | 'cracks' | 'tinkles' | 'whales' | 'springs' | 'cries';

/** a place that bubbles: a seep in the sand, a chimney of the Sources (its seed sets its trains of bubbles) */
export interface Spring { kind: string; x: number; z: number; seed?: number; }

/** where the swimmer listens from, and what goes on there */
export interface Here {
  x: number; y: number;
  /** how fast the swimmer goes (px a step), and the current that pushes it (0..1) */
  speed: number; current: number;
  /** what the story is at */
  moment: Moment;
  /** whether the noises sound at all (their volume) */
  on: boolean;
  /** the clock of the page (s) at the time of the sound, which the trains of bubbles follow (the bubbles one sees too) */
  wall?: number;
}

/** where a point of the world is on the screen, -1 (left edge) .. 1 (right edge) */
export type PanAt = (x: number, y: number, z: number) => number;

export function bruitsEngine(G: Graph, springs: readonly Spring[] = [], seed = 1, panAt?: PanAt) {
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
    water: GainNode; waterCut: BiquadFilterNode; surf: GainNode; rush: GainNode; rushBand: BiquadFilterNode; roar: GainNode; modes: GainNode;
    /** the side the rumble of the chimneys comes from (none without a stereo panner) */
    side: AudioParam | null;
    /** the narrow bands of the galleries, wired only under their vault (with the echo of their walls) */
    lo: AudioBufferSourceNode; bands: BiquadFilterNode[]; cave: boolean;
  }
  let beds: Beds | null = null;

  function startBeds(now: number): Beds {
    const lo = c.createBufferSource(), hi = c.createBufferSource();
    lo.buffer = brown; hi.buffer = pink;
    lo.loop = hi.loop = true;
    const waterCut = filter('lowpass', 600), water = gain(), surfBand = filter('bandpass', 650, 0.6), surf = gain();
    const rushBand = filter('bandpass', 400, 1.1), rush = gain(), roarCut = filter('lowpass', 150), roar = gain(), modes = gain();
    // the rumble comes from the side of the nearest chimney
    const roarPan: AudioNode = c.createStereoPanner?.() ?? gain(1);
    lo.connect(waterCut).connect(water).connect(out);
    lo.connect(roarCut).connect(roar).connect(roarPan).connect(out);
    hi.connect(surfBand).connect(surf).connect(out);
    hi.connect(rushBand).connect(rush).connect(out);
    const nodes: AudioNode[] = [lo, hi, waterCut, water, surfBand, surf, rushBand, rush, roarCut, roar, roarPan, modes];
    // the galleries ring: the water's breath through a few narrow bands at their low notes
    const bands = CAVE_MODES.map((f) => {
      const b = filter('bandpass', f, 22);
      b.connect(modes);
      nodes.push(b);
      return b;
    });
    modes.connect(out);
    lo.start(now); hi.start(now);
    const side = 'pan' in roarPan ? (roarPan as StereoPannerNode).pan : null;
    return { srcs: [lo, hi], nodes, water, waterCut, surf, rush, rushBand, roar, side, modes, lo, bands, cave: false };
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
    if (b.side) was.delete(b.side);
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

  /** the swimmer, where it was at the last look */
  let ear: Here | null = null;
  /** what the swimmer hears of a noise `dx`, `dy`, `dz` off it (ecoute.ts), from where it is on the screen */
  function at(dx: number, dy: number, dz: number, reach: number = REACH.mid): Heard {
    return heard(dx, dy, dz, reach, panAt && ear ? panAt(ear.x + dx, ear.y + dy, dz) : undefined);
  }

  /**
   * A noise's way out: from a side, muffled by its distance, into the noises' bus; `wet`, a share of it that only goes
   * to the reverb (more of it far away), `dry` how much of it does not. Its nodes are let go once it has ended.
   */
  function way(h: { pan: number; cut: number; wet?: number }, t: number, end: number, made: AudioNode[], wet = h.wet ?? 0, dry = 1): AudioNode {
    // (a low-pass only where it cuts something, a panner only off the middle)
    const head: AudioNode = h.cut < CLEAR ? filter('lowpass', h.cut, 0.5) : gain(1);
    let tail: AudioNode = head;
    if (c.createStereoPanner && Math.abs(h.pan) > 0.02) {
      const p = c.createStereoPanner();
      p.pan.value = h.pan;
      head.connect(p);
      tail = p;
      made.push(p);
    }
    if (dry < 1) { const g = gain(dry); tail.connect(g).connect(out); made.push(g); } else tail.connect(out);
    if (wet > 0.01) { const g = gain(wet); tail.connect(g).connect(G.far); made.push(g); }
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

  function bubbles(list: Bubble[], t: number, h: { g: number; pan: number; cut: number }, level: number): void {
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
    const h = at((r() * 2 - 1) * 600, -100 - 250 * r(), 300 * r()), list = drips(r), made: AudioNode[] = [];
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
    const k = crack(r), h = at((r() * 2 - 1) * 1400, (r() - 0.6) * 500, 300 + 1300 * r(), REACH.big), made: AudioNode[] = [];
    const last = k.clicks[k.clicks.length - 1].at, end = t + Math.max(last + 0.2, k.groan?.len ?? 0, k.boom ? k.boom.at + 2 : 0) + 0.1;
    const into = way({ pan: h.pan, cut: Math.max(h.cut, 3000) }, t, end, made, Math.max(0.6, h.wet)), g = h.g * level;
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
    const h = at((r() * 2 - 1) * 400, (r() * 2 - 1) * 200, 200 * r(), REACH.small), made: AudioNode[] = [], list = tinkle(r);
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
  function whale(units: Unit[], t: number, dx: number, dy: number, dz: number, level: number, loud: number): void {
    const h = at(dx, dy, dz), made: AudioNode[] = [], last = units[units.length - 1];
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
  /** a train of bubbles here and there, from one place: its next burst at `at`, until `until` */
  interface Loose { at: number; until: number; pace: number; dx: number; dy: number; dz: number; }
  let loose: Loose[] = [];
  /** the next burst of each seep and chimney near the swimmer */
  const springNext = new Map<Spring, number>();
  /** the noise of a kind at t, at this level */
  const PLAY: Record<keyof typeof next, (t: number, level: number, here: Here) => void> = {
    // a train of bubbles somewhere around, from one place
    bubbles(t, _level, here) {
      const m = metres(here.y), dy = (r() - 0.4) * 500, tr = train(r, 'free');
      loose.push({ at: t, until: t + tr.len, pace: tr.pace, dx: (r() * 2 - 1) * 700, dy: m < 20 ? -here.y * r() : dy, dz: 900 * r() });
    },
    drips: (t, level) => drip(t, level),
    cracks: (t, level) => ice(t, level),
    tinkles: (t, level) => crystals(t, level),
    whales(t, level) {
      const w = farWhale(r);
      whale(w.units, t, w.dx, 0, w.dz, level, LEVEL.far);
      played.whales++;
    }
  };

  let level = 0, now = 0;
  /** the rates of the noises now and then, at x (a second) */
  function rates(here: Here): Record<keyof typeof next, number> {
    const b = bedAt(here.x), surf = surfAt(metres(here.y));
    // (the bubbles: trains of two or three bursts, a little fewer bursts than one by one)
    return { bubbles: (b.bubbles + surf * 0.5) / 3, drips: b.drips, cracks: b.cracks / 60, tinkles: b.tinkles, whales: b.whales / 60 };
  }

  /** the noises at `now` for the swimmer where `here` says */
  function tick(t: number, here: Here): void {
    now = t;
    ear = here;
    const on = here.on;
    level = on ? hushIn(here.moment) : 0;
    glide(out.gain, level, t, 0.6);
    if (!on) {
      if (beds) { stopBeds(beds, t); beds = null; }
      for (const k of Object.keys(next) as (keyof typeof next)[]) next[k] = Infinity;
      springNext.clear();
      loose = [];
      return;
    }
    beds ??= startBeds(t);
    const b = bedAt(here.x), m = metres(here.y), cave = caveAt(here.x), rush = rushOf(here.speed, here.current);
    let nearVent = Infinity, vent: Spring | null = null;
    for (const s of springs) {
      if (s.kind !== 'vent') continue;
      const d = Math.hypot(s.x - here.x, floorAt(s.x, s.z) - here.y, s.z * 0.6);
      if (d < nearVent) { nearVent = d; vent = s; }
    }
    glide(beds.water.gain, b.water * LEVEL.water * swellAt(t), t, 0.5);
    glide(beds.waterCut.frequency, b.lp, t, 0, 0.02, true);
    glide(beds.surf.gain, surfAt(m) * wavesAt(t) * LEVEL.surf, t, 0.4);
    glide(beds.rush.gain, rush.g * LEVEL.rush, t, 0.12);
    glide(beds.rushBand.frequency, rush.f, t, 0, 0.03, true);
    glide(beds.roar.gain, roarAt(nearVent) * LEVEL.roar, t, 0.5);
    if (vent && beds.side) glide(beds.side, at(vent.x - here.x, floorAt(vent.x, vent.z) - here.y, vent.z).pan * 0.7, t, 0, 0.05, true);
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
    // the trains of bubbles here and there, while they last
    loose = loose.filter((q) => {
      if (q.at < t - TICK) return false;
      for (; q.at < t + AHEAD && q.at <= q.until; q.at += (0.5 + r()) / q.pace) {
        if (voices < MAX_VOICES) { bubbles(burst(r, 4), Math.max(q.at, t + 0.02), at(q.dx, q.dy, q.dz, REACH.small), level); played.bubbles++; }
      }
      return q.at <= q.until;
    });
    // the seeps and the chimneys near the swimmer bubble, in their trains, silences between
    const wall = (here.wall ?? t) - t;
    for (const s of springs) {
      const dx = s.x - here.x, dy = floorAt(s.x, s.z) - here.y, vent = s.kind === 'vent';
      if (Math.abs(dx) > 1000) { springNext.delete(s); continue; }
      const tr = springTrains(s.seed ?? Math.round(s.x), vent ? 'vent' : 'seep');
      let q = springNext.get(s) ?? t;
      if (q < t - TICK) q = t;
      while (q < t + AHEAD) {
        const pace = bubblingAt(tr, q + wall);
        if (!pace) { q += TICK; continue; }
        if (voices < MAX_VOICES) { bubbles(burst(r, vent ? 6 : 4, vent ? 1.3 : 1), Math.max(q, t + 0.02), at(dx, dy, s.z, REACH.small), level); played.springs++; }
        q += (0.5 + r()) / pace;
      }
      springNext.set(s, q);
    }
  }

  return {
    tick,
    /** a big animal seen far away cries: its two cries, as its two waves leave (ondes-jeu.ts) */
    cry(dx: number, dy: number, dz: number, size: number): void {
      if (level <= 0) return;
      whale(call(r, voiceOf(size), 2, 1.6), now + 0.05, dx, dy, dz, level, LEVEL.cry);
      played.cries++;
    },
    /** a noise now, whatever the place (the tests, the report) */
    play(k: keyof typeof next, here: Here): void { PLAY[k](now + 0.05, Math.max(level, 1), here); },
    /** how many noises sound now, and how many of each have been heard (tests) */
    get voices() { return voices; },
    played,
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
} = {}): Promise<AudioBuffer> {
  const rate = o.rate ?? 44100, c = new OfflineAudioContext(2, Math.round(seconds * rate), rate), G = buildGraph(c), i = chapterIndex(id);
  G.fade.gain.value = o.music ? 1 : 0;
  const x = o.x ?? biomeMid(i), y = o.y ?? arrival(i).y, eng = bruitsEngine(G, o.springs ?? [], o.seed ?? 1);
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
  /** where a point of the world is on the screen (its side), if known */
  pan?: PanAt;
}

/** the noises of the game, once the page may sound */
export function initBruits(d: BruitsDeps) {
  const s = son();
  let eng: BruitsEngine | null = null;
  const here: Here = { x: 0, y: 0, speed: 0, current: 0, moment: null, on: true };
  let lastT = -1;
  s.onWake((G) => {
    const e = (eng = bruitsEngine(G, d.springs.filter((q) => q.kind === 'vent' || q.kind === 'seep'), (Math.random() * 2 ** 31) >>> 0, d.pan));
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
      here.wall = performance.now() / 1000;
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
    get beds() { return eng?.beds ?? null; }
  };
}

export type Bruits = ReturnType<typeof initBruits>;
