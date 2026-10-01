// The voice of the song (docs/direction-artistique.md, « Le son »): each note its own timbre, made in the code with
// the Web Audio API, no sound file and no library. Oscillators and their partials, a trembling, a vibrato, a breath
// of filtered noise, an echo, all through the reverb of the page (son.ts), as much of it as the chapter's space
// asks; the music steps back under each note. The browser only lets sound start after a touch or a key: until then
// the notes are silent.

import type { ChapterId } from './biomes';
import { CLEAR, type Heard } from './ecoute';
import { release, son } from './son';

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
  /** how loud, so that the nine notes sound alike in strength, on a phone's speaker too */
  level?: number;
}

const TIMBRE: Record<string, Timbre> = {
  // a bell of light, clear and short
  nurserie: { wave: 'sine', partials: [[1, 1], [2.76, 0.32], [5.4, 0.14], [8.93, 0.06]], attack: 0.005, decay: 2, level: 1.15 },
  // a beating, like fins
  recif: { wave: 'triangle', partials: [[1, 1], [2, 0.25]], attack: 0.02, decay: 1.5, trem: [7, 0.85], level: 2 },
  // a brush of leaves: soft, with a breath
  foret: { wave: 'sine', partials: [[1, 1], [3, 0.1]], attack: 0.22, decay: 1.6, breath: 0.6, level: 0.9 },
  // a round note that comes back from the walls
  grotte: { wave: 'sine', partials: [[1, 1], [2, 0.22], [3, 0.08]], attack: 0.01, decay: 0.9, echo: [0.32, 0.5], level: 1.25 },
  // warm, two voices close together
  carcasse: { wave: 'triangle', partials: [[1, 1], [1.004, 0.8], [2, 0.15]], attack: 0.12, decay: 2.4, lp: 3, level: 0.77 },
  // an ember: a bright buzz, damped, crackling
  sources: { wave: 'sawtooth', partials: [[1, 1], [0.5, 0.3]], attack: 0.03, decay: 1.3, lp: 2.4, breath: 0.25, level: 1.5 },
  // glass: a bright sparkle
  glacier: { wave: 'sine', partials: [[1, 1], [4.2, 0.18], [6.8, 0.06]], attack: 0.003, decay: 1.8, fm: [3.5, 2.2], level: 0.9 },
  // a swell, slow to come, wavering
  jardin: { wave: 'sine', partials: [[1, 1], [2, 0.2]], attack: 0.35, decay: 2.2, vib: [5, 16], trem: [1.6, 0.35], level: 0.9 },
  // almost nothing: a deep breath
  fosse: { wave: 'sine', partials: [[1, 0.55], [0.5, 0.3], [1.5, 0.06]], attack: 0.5, decay: 3, breath: 0.12, lp: 1.6 }
};

/** how a note is sung: `gain` 0..1, `pan` -1 (left) .. 1, `octave` up or down; `far`, from an animal away (ecoute.ts) */
export interface NoteOpts { gain?: number; pan?: number; octave?: number; far?: Pick<Heard, 'cut' | 'wet'> }

export interface Voice {
  /** a note of a chapter now */
  note(chapter: ChapterId, freq: number, o?: NoteOpts): void;
  /** true once the browser lets it sound */
  readonly awake: boolean;
}

export function createVoice(): Voice {
  const s = son();
  function note(chapter: ChapterId, freq: number, o: NoteOpts = {}): void {
    const g = s.graph;
    if (!g || !s.awake) return;
    sound(g.c, g.voice, g.noise, chapter, freq, o, g.voiceFar);
    if ((o.gain ?? 1) >= 0.5) s.duck();
  }
  return { note, get awake() { return s.awake; } };
}

/**
 * A note of a chapter into `dest`, at the context's current time (an OfflineAudioContext renders it for the tests); a
 * far one duller, and a share of it into `wetTo` (only the reverb).
 */
export function sound(c: BaseAudioContext, dest: AudioNode, noise: AudioBuffer | null, chapter: ChapterId, freq: number, o: NoteOpts = {}, wetTo?: AudioNode): void {
  const tb = TIMBRE[chapter];
  if (!tb) return;
  const f = freq * Math.pow(2, o.octave ?? 0), t0 = c.currentTime + 0.01, end = t0 + tb.attack + tb.decay * 1.6;
  const env = c.createGain();
  // what the note is made of, let go once it has rung out (its echo a little later)
  const made: AudioNode[] = [env], echo: AudioNode[] = [];
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime((o.gain ?? 1) * 0.3 * (tb.level ?? 1), t0 + tb.attack);
  env.gain.setTargetAtTime(0, t0 + tb.attack, tb.decay / 3.5);
  let tail: AudioNode = env;
  if (o.far && o.far.cut < CLEAR) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.far.cut;
    lp.Q.value = 0.5;
    tail.connect(lp);
    tail = lp;
    echo.push(lp);
  }
  if (c.createStereoPanner && o.pan) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    tail.connect(p);
    tail = p;
    echo.push(p);
  }
  tail.connect(dest);
  if (wetTo && o.far && o.far.wet > 0.01) {
    const w = c.createGain();
    w.gain.value = o.far.wet;
    tail.connect(w).connect(wetTo);
    echo.push(w);
  }
  let into: AudioNode = env;
  if (tb.lp) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * tb.lp * 2, t0);
    lp.frequency.exponentialRampToValueAtTime(f * tb.lp, t0 + tb.attack + 0.3);
    lp.connect(env);
    into = lp;
    made.push(lp);
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
    made.push(g, lfo, depth);
  }
  if (tb.echo) {
    const dl = c.createDelay(1), fb = c.createGain();
    dl.delayTime.value = tb.echo[0];
    fb.gain.value = tb.echo[1];
    env.connect(dl).connect(fb).connect(dl);
    fb.connect(tail === env ? dest : tail);
    echo.push(dl, fb);
  }
  const oscs: OscillatorNode[] = [];
  for (const [ratio, g] of tb.partials) {
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = ratio === 1 ? tb.wave : 'sine';
    osc.frequency.value = f * ratio;
    gain.gain.value = g;
    osc.connect(gain).connect(into);
    oscs.push(osc);
    made.push(osc, gain);
  }
  if (tb.vib) {
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = tb.vib[0];
    depth.gain.value = tb.vib[1];
    lfo.connect(depth);
    for (const osc of oscs) depth.connect(osc.detune);
    lfo.start(t0); lfo.stop(end);
    made.push(lfo, depth);
  }
  if (tb.fm) {
    const mod = c.createOscillator(), depth = c.createGain();
    mod.frequency.value = f * tb.fm[0];
    depth.gain.setValueAtTime(f * tb.fm[1], t0);
    depth.gain.exponentialRampToValueAtTime(f * 0.05, t0 + 0.6);
    mod.connect(depth).connect(oscs[0].frequency);
    mod.start(t0); mod.stop(end);
    made.push(mod, depth);
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
    made.push(src, bp, g);
  }
  for (const osc of oscs) { osc.start(t0); osc.stop(end); }
  release(oscs[0], made, () => setTimeout(() => { for (const n of echo) n.disconnect(); }, tb.echo ? 4000 : 0));
}
