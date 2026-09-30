// The voice of the song (docs/direction-artistique.md, « Le son »): each note its own timbre, made in the code with
// the Web Audio API, no sound file and no library. Oscillators and their partials, a trembling, a vibrato, a breath
// of filtered noise, an echo, all through one reverb generated here. The browser only lets sound start after a
// touch or a key: until then the notes are silent.

import type { ChapterId } from './biomes';

interface Timbre {
  wave: OscillatorType;
  /** [ratio to the note, loudness] */
  partials: [number, number][];
  /** rise and fall of the note (s) */
  attack: number; decay: number;
  /** a trembling of the loudness: [Hz, depth 0..1] */
  trem?: [number, number];
  /** a wavering of the pitch: [Hz, cents] */
  vib?: [number, number];
  /** a breath of noise around the note, this loud */
  breath?: number;
  /** an echo: [delay (s), feedback] */
  echo?: [number, number];
  /** a bright frequency modulation: [ratio, depth] */
  fm?: [number, number];
  /** a low-pass above the note, at this many times its pitch */
  lp?: number;
}

const TIMBRE: Record<string, Timbre> = {
  // a bell of light, clear and short
  nurserie: { wave: 'sine', partials: [[1, 1], [2.76, 0.32], [5.4, 0.14], [8.93, 0.06]], attack: 0.005, decay: 2 },
  // a beating, like fins
  recif: { wave: 'triangle', partials: [[1, 1], [2, 0.25]], attack: 0.02, decay: 1.5, trem: [7, 0.85] },
  // a brush of leaves: soft, with a breath
  foret: { wave: 'sine', partials: [[1, 1], [3, 0.1]], attack: 0.22, decay: 1.6, breath: 0.6 },
  // a round note that comes back from the walls
  grotte: { wave: 'sine', partials: [[1, 1], [2, 0.22], [3, 0.08]], attack: 0.01, decay: 0.9, echo: [0.32, 0.5] },
  // warm, two voices close together
  carcasse: { wave: 'triangle', partials: [[1, 1], [1.004, 0.8], [2, 0.15]], attack: 0.12, decay: 2.4, lp: 3 },
  // an ember: a bright buzz, damped, crackling
  sources: { wave: 'sawtooth', partials: [[1, 1], [0.5, 0.3]], attack: 0.03, decay: 1.3, lp: 2.4, breath: 0.25 },
  // glass: a bright sparkle
  glacier: { wave: 'sine', partials: [[1, 1], [4.2, 0.18], [6.8, 0.06]], attack: 0.003, decay: 1.8, fm: [3.5, 2.2] },
  // a swell, slow to come, wavering
  jardin: { wave: 'sine', partials: [[1, 1], [2, 0.2]], attack: 0.35, decay: 2.2, vib: [5, 16], trem: [1.6, 0.35] },
  // almost nothing: a deep breath
  fosse: { wave: 'sine', partials: [[1, 0.55], [0.5, 0.3], [1.5, 0.06]], attack: 0.5, decay: 3, breath: 0.12, lp: 1.6 }
};

export interface Voice {
  /** a note of a chapter now: `gain` 0..1, `pan` -1 (left) .. 1, `octave` up or down */
  note(chapter: ChapterId, freq: number, o?: { gain?: number; pan?: number; octave?: number }): void;
  /** true once the browser lets it sound */
  readonly awake: boolean;
}

type AC = typeof AudioContext;

export function createVoice(): Voice {
  let ac: AudioContext | null = null, out: AudioNode | null = null, noise: AudioBuffer | null = null;

  function wake(): void {
    if (!ac) {
      const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext);
      if (!Ctor) return;
      try { ac = new Ctor(); } catch { return; }
      build(ac);
    }
    if (ac.state === 'suspended') void ac.resume().catch(() => { /* waits for the next touch */ });
    if (ac.state === 'running') for (const ev of EVENTS) window.removeEventListener(ev, wake, true);
  }
  // the gestures that let a page sound (a touch counts when the finger lifts)
  const EVENTS = ['pointerup', 'touchend', 'keydown', 'click'];
  for (const ev of EVENTS) window.addEventListener(ev, wake, true);

  function build(c: AudioContext): void {
    const master = c.createGain();
    master.gain.value = 0.55;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master.connect(comp).connect(c.destination);
    // a reverb from a decaying noise, a little longer on the right
    const len = Math.floor(c.sampleRate * 2.8), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6 + ch * 0.3);
    }
    const rev = c.createConvolver(), wet = c.createGain(), mix = c.createGain();
    rev.buffer = ir;
    wet.gain.value = 0.42;
    mix.connect(master);
    mix.connect(rev).connect(wet).connect(master);
    out = mix;
    noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const n = noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
  }

  function note(chapter: ChapterId, freq: number, o: { gain?: number; pan?: number; octave?: number } = {}): void {
    if (ac && out && ac.state === 'running') sound(ac, out, noise, chapter, freq, o);
  }

  return { note, get awake() { return ac?.state === 'running'; } };
}

/** a note of a chapter into `dest`, at the context's current time (an OfflineAudioContext renders it for the tests) */
export function sound(c: BaseAudioContext, dest: AudioNode, noise: AudioBuffer | null, chapter: ChapterId, freq: number, o: { gain?: number; pan?: number; octave?: number } = {}): void {
  const tb = TIMBRE[chapter];
  if (!tb) return;
  const f = freq * Math.pow(2, o.octave ?? 0), t0 = c.currentTime + 0.01, end = t0 + tb.attack + tb.decay * 1.6;
  const env = c.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime((o.gain ?? 1) * 0.3, t0 + tb.attack);
  env.gain.setTargetAtTime(0, t0 + tb.attack, tb.decay / 3.5);
  let tail: AudioNode = env;
  if (c.createStereoPanner && o.pan) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    env.connect(p);
    tail = p;
  }
  tail.connect(dest);
  let into: AudioNode = env;
  if (tb.lp) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * tb.lp * 2, t0);
    lp.frequency.exponentialRampToValueAtTime(f * tb.lp, t0 + tb.attack + 0.3);
    lp.connect(env);
    into = lp;
  }
  if (tb.trem) {
    const g = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
    g.gain.value = 1 - tb.trem[1] / 2;
    depth.gain.value = tb.trem[1] / 2;
    lfo.frequency.value = tb.trem[0];
    lfo.connect(depth).connect(g.gain);
    g.connect(into);
    into = g;
    lfo.start(t0); lfo.stop(end);
  }
  if (tb.echo) {
    const dl = c.createDelay(1), fb = c.createGain();
    dl.delayTime.value = tb.echo[0];
    fb.gain.value = tb.echo[1];
    env.connect(dl).connect(fb).connect(dl);
    fb.connect(tail === env ? dest : tail);
  }
  const oscs: OscillatorNode[] = [];
  for (const [ratio, g] of tb.partials) {
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = ratio === 1 ? tb.wave : 'sine';
    osc.frequency.value = f * ratio;
    gain.gain.value = g;
    osc.connect(gain).connect(into);
    oscs.push(osc);
  }
  if (tb.vib) {
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = tb.vib[0];
    depth.gain.value = tb.vib[1];
    lfo.connect(depth);
    for (const osc of oscs) depth.connect(osc.detune);
    lfo.start(t0); lfo.stop(end);
  }
  if (tb.fm) {
    const mod = c.createOscillator(), depth = c.createGain();
    mod.frequency.value = f * tb.fm[0];
    depth.gain.setValueAtTime(f * tb.fm[1], t0);
    depth.gain.exponentialRampToValueAtTime(f * 0.05, t0 + 0.6);
    mod.connect(depth).connect(oscs[0].frequency);
    mod.start(t0); mod.stop(end);
  }
  if (tb.breath && noise) {
    const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noise;
    src.loop = true;
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    bp.Q.value = 3;
    g.gain.value = tb.breath;
    src.connect(bp).connect(g).connect(into);
    src.start(t0); src.stop(end);
  }
  for (const osc of oscs) { osc.start(t0); osc.stop(end); }
}
