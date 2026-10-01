// The music in the game (musique.ts), played with the Web Audio API into the music bus of son.ts. Each chapter heard
// is a group of voices: its drone, its harmonics, its chords and its notes, faded in and out with the blend of the
// chapters at the swimmer's place; a chapter left behind is let go after a while. Each goes by in sections
// (musique-forme.ts), changed at its chords. A clock schedules what comes a little ahead of time, on a live context
// (the game) or an offline one (the tests and the report).

import { lerp, rng } from '../engine';
import { BIOMES, arrival, biomeMid, metres } from './biomes';
import { BY_INDEX, MOMENTS, WAVES, harmLevels, hz, lengthIn, mixAt, motifGap, muffle, sweepAt, type Ambience, type Moment, type Played, type Tone, type Wave } from './musique';
import { nextSection, palette, pathChord, shifted, vary, voice, type Section } from './musique-forme';
import { buildGraph, release, son, type Graph } from './son';

/** how far ahead the notes are scheduled, and how often the clock looks (s) */
const AHEAD = 1.2, TICK = 0.2;
/** how far the brightness of the chords goes towards its section's at each look of the clock (about 4 s) */
const BRIGHTEN = 1 - Math.exp(-TICK / 4);
/** how long the voices of a chapter left behind are kept, in case the swimmer comes back (s) */
const LINGER = 6;

/** the short notes: their partials [ratio, loudness], how fast they rise, fade (time constant) and end (s) */
const TONES: Record<Tone, { partials: [number, number][]; attack: number; fade: number; len: number }> = {
  bell: { partials: [[1, 1], [2.76, 0.28], [5.4, 0.1]], attack: 0.004, fade: 0.8, len: 4.5 },
  mallet: { partials: [[1, 1], [2, 0.16], [3, 0.05]], attack: 0.012, fade: 0.38, len: 2.6 },
  pluck: { partials: [[1, 1], [3.93, 0.22]], attack: 0.003, fade: 0.24, len: 1.6 },
  glass: { partials: [[1, 1], [4.2, 0.14], [6.8, 0.05]], attack: 0.002, fade: 0.55, len: 3.2 },
  drop: { partials: [[1, 1], [2, 0.18]], attack: 0.002, fade: 0.2, len: 1.4 },
  swell: { partials: [[1, 1], [2, 0.14]], attack: 1.3, fade: 1.3, len: 7.5 }
};

interface Group {
  i: number; a: Ambience; r: () => number;
  out: GainNode; padCut: BiquadFilterNode; echo: AudioNode | null;
  /** where its chords' low-pass is in its sweep */
  phase: number;
  /** its own nodes, and the sources playing with when each ends; the slow wave of its drone, there all along */
  nodes: AudioNode[]; srcs: Map<AudioScheduledSourceNode, number>; breath: OscillatorNode | null;
  harm: GainNode[];
  chord: number; chordAt: number; motifAt: number; harmAt: number;
  /** how loud it is asked to be, and since when it is silent */
  g: number; leftAt: number;
  /** the section playing, how many chords it has left, the chord before the last, its last phrase, its drone's gain */
  sec: Section | null; left: number; before: number; last: Played[] | null; dg: GainNode | null;
  /** how bright its chords are now, on the way to the section's */
  bright: number;
}

/** an ambience as made, without sections (to compare) */
const FLAT: Section = { kind: 'chant', chords: Infinity, drone: 1, pad: 1, harm: 1, notes: 1, bright: 1, voicing: 'tel', path: 'suite', octave: 0 };

/** `form`: the ambiences go by in sections (off: each as made, all along, to compare) */
export function musicEngine(G: Graph, seed = 1, form = true) {
  const c = G.c, groups = new Map<number, Group>(), periodic = new Map<Wave, PeriodicWave>();
  let opened = 0, was: Moment = null;

  function wave(w: Wave): PeriodicWave {
    let p = periodic.get(w);
    if (!p) {
      const im = Float32Array.from(WAVES[w]);
      periodic.set(w, (p = c.createPeriodicWave(new Float32Array(im.length), im)));
    }
    return p;
  }

  function source(gr: Group, o: AudioScheduledSourceNode, t0: number, t1: number): void {
    o.start(t0);
    if (Number.isFinite(t1)) o.stop(t1);
    gr.srcs.set(o, t1);
  }

  /** a slow wave of `rate` Hz, `depth` wide, into a parameter */
  function lfo(gr: Group, rate: number, depth: number, into: AudioParam, t: number): OscillatorNode {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g).connect(into);
    gr.nodes.push(o, g);
    source(gr, o, t, Infinity);
    return o;
  }

  function open(i: number, now: number): Group {
    const a = BY_INDEX[i], r = rng((seed * 7919 + i * 104729 + ++opened * 1299709) >>> 0);
    const out = c.createGain(), padCut = c.createBiquadFilter();
    out.gain.value = 0;
    out.connect(G.music);
    padCut.type = 'lowpass';
    padCut.frequency.value = a.pad.lp;
    padCut.Q.value = 0.7;
    padCut.connect(out);
    const gr: Group = {
      i, a, r, out, padCut, echo: null, phase: r() * Math.PI * 2, nodes: [out, padCut], srcs: new Map(), breath: null, harm: [],
      chord: -1, chordAt: now + 0.05, motifAt: now + lengthIn(r, a.motif.every) * 0.6, harmAt: now, g: 0, leftAt: now,
      sec: null, left: 0, before: -1, last: null, dg: null, bright: 1
    };
    // the drone, breathing
    const dg = c.createGain(), dcut = c.createBiquadFilter();
    dg.gain.value = a.drone.gain;
    gr.dg = dg;
    dcut.type = 'lowpass';
    dcut.frequency.value = a.drone.lp;
    dcut.connect(dg).connect(out);
    gr.nodes.push(dg, dcut);
    gr.breath = lfo(gr, a.drone.breathe, a.drone.gain * 0.4, dg.gain, now);
    for (const m of a.drone.notes) {
      const o = c.createOscillator();
      o.setPeriodicWave(wave(a.drone.wave));
      o.frequency.value = hz(m);
      o.connect(dcut);
      gr.nodes.push(o);
      source(gr, o, now, Infinity);
    }
    // the harmonics of the root, one side and the other
    const sides = [-0.45, 0.45].map((pan) => {
      const g = c.createGain();
      g.gain.value = a.harm.gain;
      if (c.createStereoPanner) {
        const p = c.createStereoPanner();
        p.pan.value = pan;
        g.connect(p).connect(out);
        gr.nodes.push(p);
      } else g.connect(out);
      gr.nodes.push(g);
      return g;
    });
    gr.harm = a.harm.partials.map((k, q) => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = hz(a.harm.root) * k;
      g.gain.value = 0;
      o.connect(g).connect(sides[q % 2]);
      gr.nodes.push(o, g);
      source(gr, o, now, Infinity);
      return g;
    });
    // an echo for the notes that come back from the walls
    if (a.motif.echo) {
      const dl = c.createDelay(2), fb = c.createGain(), damp = c.createBiquadFilter();
      dl.delayTime.value = a.motif.echo[0];
      fb.gain.value = a.motif.echo[1];
      damp.type = 'lowpass';
      damp.frequency.value = 2600;
      dl.connect(damp).connect(fb).connect(dl);
      damp.connect(out);
      gr.echo = dl;
      gr.nodes.push(dl, fb, damp);
    }
    return gr;
  }

  /** a chapter let go: its sources stop, and its nodes come off the music once they have (on an offline context too) */
  function close(gr: Group, now: number): void {
    for (const s of gr.srcs.keys()) try { s.stop(now + 0.05); } catch { /* not started */ }
    if (gr.breath) release(gr.breath, gr.nodes);
    groups.delete(gr.i);
  }

  /** the time until the next phrase of a group, in its section and the moment */
  const gap = (gr: Group, moment: Moment) => motifGap(gr.a.motif.every, gr.r, moment) / (gr.sec?.notes ?? 1);

  /** a new section of a group at t: its voices lean their own way, its phrases begin afresh */
  function section(gr: Group, t: number): void {
    const s = (gr.sec = form ? nextSection(gr.a.chapter, gr.sec?.kind ?? null, gr.r) : FLAT), p = gr.a.pad;
    gr.left = s.chords;
    gr.last = null;
    gr.dg?.gain.setTargetAtTime(gr.a.drone.gain * s.drone, t, p.attack / 2);
    gr.motifAt = Math.min(gr.motifAt, t + gap(gr, was));
    gr.harmAt = Math.min(gr.harmAt, t);
  }

  /** the next chord of a group at t, swelling under the one before (one envelope for all its notes) */
  function chord(gr: Group, t: number): void {
    if (gr.left <= 0) section(gr, t);
    gr.left--;
    const sec = gr.sec ?? FLAT, p = gr.a.pad, prev = gr.chord, k = (gr.chord = pathChord(sec.path, p.chords.length, prev, gr.before, gr.r));
    gr.before = prev;
    const len = lengthIn(gr.r, p.len), notes = voice(p.chords[k], sec.voicing, palette(gr.a));
    const g = p.gain * sec.pad * Math.sqrt(4 / notes.length), end = t + len + p.release * 1.25, env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(g, t + p.attack);
    env.gain.setValueAtTime(g, t + len);
    env.gain.setTargetAtTime(0, t + len, p.release / 3.5);
    env.connect(gr.padCut);
    const oscs: OscillatorNode[] = [];
    for (const m of notes) for (const d of p.detune >= 1 ? [-p.detune / 2, p.detune / 2] : [0]) {
      const o = c.createOscillator();
      o.setPeriodicWave(wave(p.wave));
      o.frequency.value = hz(m);
      o.detune.value = d;
      o.connect(env);
      source(gr, o, t, end);
      oscs.push(o);
    }
    if (oscs.length) release(oscs[0], [env, ...oscs]);
    gr.chordAt = t + len;
  }

  /** a short note of a group's motif */
  function tone(gr: Group, kind: Tone, f: number, t: number, gain: number, pan: number): void {
    const tn = TONES[kind], end = t + tn.len, env = c.createGain(), made: AudioNode[] = [env];
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + tn.attack);
    env.gain.setTargetAtTime(0, t + tn.attack, tn.fade);
    let tail: AudioNode = env;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      env.connect(p);
      tail = p;
      made.push(p);
    }
    tail.connect(gr.out);
    if (gr.echo) tail.connect(gr.echo);
    const oscs = tn.partials.map(([ratio, g]) => {
      const o = c.createOscillator(), og = c.createGain();
      o.frequency.value = f * ratio;
      og.gain.value = g;
      o.connect(og).connect(env);
      made.push(o, og);
      return o;
    });
    // a drop rises into its note; glass rings with a bright modulation that dies away
    if (kind === 'drop') for (const o of oscs) {
      const f0 = o.frequency.value;
      o.frequency.setValueAtTime(f0 * 0.78, t);
      o.frequency.exponentialRampToValueAtTime(f0, t + 0.06);
    }
    const srcs: AudioScheduledSourceNode[] = [...oscs];
    if (kind === 'glass') {
      const mod = c.createOscillator(), depth = c.createGain();
      mod.frequency.value = f * 3.5;
      depth.gain.setValueAtTime(f * 2, t);
      depth.gain.exponentialRampToValueAtTime(f * 0.04, t + 0.5);
      mod.connect(depth).connect(oscs[0].frequency);
      made.push(mod, depth);
      srcs.push(mod);
    }
    for (const s of srcs) source(gr, s, t, end);
    release(srcs[0], made);
  }

  /** a phrase of a group's motif: the last one changed, or a new one at the start of a section */
  function motif(gr: Group, t: number, moment: Moment): void {
    const m = shifted(gr.a.motif, gr.sec?.octave ?? 0), chord = gr.a.pad.chords[Math.max(0, gr.chord)];
    const notes = (gr.last = vary(gr.last ?? [], m, chord, gr.r)), pan = (gr.r() * 2 - 1) * 0.6;
    for (const n of notes) tone(gr, m.tone, hz(n.midi), t + n.at, m.gain * (0.75 + 0.25 * gr.r()), pan + (gr.r() - 0.5) * 0.3);
    gr.motifAt = t + (notes.length ? notes[notes.length - 1].at : 0) + gap(gr, moment);
  }

  function harmonics(gr: Group, t: number): void {
    const lv = harmLevels(gr.harm.length, gr.r), every = gr.a.harm.every, k = gr.sec?.harm ?? 1;
    gr.harm.forEach((g, q) => g.gain.setTargetAtTime(lv[q] * k, t, every * 0.35));
    gr.harmAt = t + every * (0.7 + 0.6 * gr.r());
  }

  function level(gr: Group, g: number, now: number): void {
    if (Math.abs(g - gr.g) < 0.002) return;
    if (g === 0) gr.leftAt = now;
    gr.g = g;
    gr.out.gain.setTargetAtTime(g, now, 0.5);
  }

  let cut = 0, send = -1, vsend = -1;
  /**
   * The music at `now` for a swimmer at (x, y): the chapters heard there, how much of them goes to the reverb, how
   * muffled the water is; then what each plays in the next moment. `bright` (0..1) lights it up: the water opens and
   * the ambience of the Remontée rises over the chapter, which steps back under it. A moment of the story changes how
   * loud it plays and how often its notes come. Off (its volume at nothing), every voice is let go.
   */
  function tick(now: number, x: number, y: number, bright = 0, on = true, moment: Moment = null): void {
    const mix = on ? mixAt(x) : [], mo = moment ? MOMENTS[moment].level : 1;
    if (moment !== was) {
      // a phrase held back comes again soon after the moment; a dance does not wait for the next one
      for (const gr of groups.values()) gr.motifAt = Math.min(gr.motifAt, now + gap(gr, moment));
      was = moment;
    }
    if (on && bright > 0) {
      const k = BIOMES.length - 1;
      for (const q of mix) if (q.i !== k) q.g *= 1 - 0.45 * bright;
      const m = mix.find((q) => q.i === k);
      if (m) m.g = Math.max(m.g, bright * 0.8); else mix.push({ i: k, g: bright * 0.8 });
    }
    let s = 0, vs = 0, sum = 0;
    for (const { i, g } of mix) {
      let gr = groups.get(i);
      if (!gr) groups.set(i, (gr = open(i, now)));
      level(gr, g * gr.a.level * mo, now);
      s += g * gr.a.space; vs += g * gr.a.voiceSpace; sum += g;
    }
    for (const gr of [...groups.values()]) {
      if (mix.some((q) => q.i === gr.i)) continue;
      level(gr, 0, now);
      if (now - gr.leftAt > LINGER) close(gr, now);
    }
    if (sum > 0 && Math.abs(s / sum - send) > 0.01) G.musicSend.gain.setTargetAtTime((send = s / sum), now, 1.2);
    if (sum > 0 && Math.abs(vs / sum - vsend) > 0.01) G.voiceSend.gain.setTargetAtTime((vsend = vs / sum), now, 1.2);
    const f = lerp(muffle(metres(y)), 18000, bright);
    // (by steps of the clock: a filter moved at the rate of the sound costs much more)
    if (Math.abs(f - cut) > 40) G.musicCut.frequency.setValueAtTime((cut = f), now);
    for (const gr of groups.values()) {
      if (gr.g <= 0) continue;
      // (the brightness of a section comes in over a few seconds)
      gr.bright += ((gr.sec?.bright ?? 1) - gr.bright) * BRIGHTEN;
      gr.padCut.frequency.setValueAtTime(sweepAt(gr.a.pad, now, gr.phase) * gr.bright, now);
      while (gr.chordAt < now + AHEAD) chord(gr, Math.max(gr.chordAt, now + 0.05));
      if (!moment || MOMENTS[moment].notes > 0) while (gr.motifAt < now + AHEAD) motif(gr, Math.max(gr.motifAt, now + 0.05), moment);
      while (gr.harmAt < now + AHEAD) harmonics(gr, Math.max(gr.harmAt, now));
      for (const [src, end] of gr.srcs) if (end < now) gr.srcs.delete(src);
    }
  }

  return {
    tick,
    /** the chapters playing and how loud (0..1), and how many sources sound (tests) */
    get heard() { return [...groups.values()].filter((g) => g.g > 0).map((g) => ({ chapter: g.a.chapter, g: +g.g.toFixed(3), section: g.sec?.kind ?? null })); },
    get sources() { let n = 0; for (const g of groups.values()) n += g.srcs.size; return n; }
  };
}

export type MusicEngine = ReturnType<typeof musicEngine>;

/** the music of chapter i alone, `seconds` long, at its middle and mid water, rendered offline (tests, report) */
export async function renderAmbience(i: number, seconds: number, rate = 44100, seed = 1, form = true): Promise<AudioBuffer> {
  const c = new OfflineAudioContext(2, Math.round(seconds * rate), rate), G = buildGraph(c);
  G.fade.gain.value = 1;
  const eng = musicEngine(G, seed, form), x = biomeMid(i), y = arrival(i).y;
  for (let t = 0; t < seconds; t += TICK) eng.tick(t, x, y);
  return c.startRendering();
}

export interface MusiqueDeps {
  /** where the swimmer listens from */
  where(): { x: number; y: number };
  /** how much the music lights up (the Remontée), 0..1 */
  bright?(): number;
  /** the moment of the story, if any (a farewell, a parade) */
  moment?(): Moment;
}

/** the music of the game, once the page may sound */
export function initMusique(d: MusiqueDeps) {
  const s = son();
  let eng: MusicEngine | null = null;
  const buf = new Float32Array(2048);
  s.onWake((G) => {
    const e = (eng = musicEngine(G, (Math.random() * 2 ** 31) >>> 0));
    const step = () => {
      if (G.c.state !== 'running') return;
      const p = d.where();
      e.tick(G.c.currentTime, p.x, p.y, d.bright?.() ?? 0, s.volumes.musique > 0, d.moment?.() ?? null);
    };
    step();
    setInterval(step, TICK * 1000);
  });
  return {
    get awake() { return s.awake; },
    /** the chapters heard and how loud (tests) */
    get heard() { return eng?.heard ?? []; },
    get sources() { return eng?.sources ?? 0; },
    /** how loud the page sounds now, RMS (tests) */
    level(): number {
      const m = s.graph?.meter;
      if (!m) return 0;
      m.getFloatTimeDomainData(buf);
      let q = 0;
      for (const v of buf) q += v * v;
      return Math.sqrt(q / buf.length);
    },
    get volumes() { return s.volumes; },
    setVolume: s.setVolume,
    /** the sound of the page and its nodes (tests) */
    son: s
  };
}

export type Musique = ReturnType<typeof initMusique>;
