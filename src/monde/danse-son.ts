// The little sounds of a dance (danse-jeu.ts): on its strong beats, a soft note of D major struck like a wooden key,
// into the music (its volume is the music's); on its last pose, the chord of D rolled upward. Web Audio API.

import type { Accent } from '../engine3/dance';
import { hz } from './musique';
import { release, son } from './son';

/** the notes of each accent (MIDI), all in D major: D on the first beat of a bar, A on the third, the chord of D on
 * the last pose */
export const ACCENT_NOTES: Record<Accent, number[]> = { down: [74], beat: [69], pose: [62, 66, 69, 74] };
/** how loud, as the notes of the music (musique.ts, motif.gain) */
const GAIN: Record<Accent, number> = { down: 0.07, beat: 0.05, pose: 0.045 };

export function initDanseSon() {
  const s = son();
  return {
    /** an accent now, from where the dance is on the screen (pan, -1..1) */
    accent(kind: Accent, pan = 0): void {
      const G = s.graph;
      if (!G || !s.awake || s.strained) return;
      const t = G.c.currentTime + 0.01;
      ACCENT_NOTES[kind].forEach((m, i) => key(G.c, G.music, hz(m), t + i * 0.06, GAIN[kind], pan));
    }
  };
}

/** a struck key: its note and a little of its fourth partial, quick to come and to fade */
function key(c: BaseAudioContext, out: AudioNode, f: number, t: number, gain: number, pan: number): void {
  const env = c.createGain(), made: AudioNode[] = [env];
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + 0.005);
  env.gain.setTargetAtTime(0, t + 0.005, 0.22);
  let tail: AudioNode = env;
  if (c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    env.connect(p);
    tail = p;
    made.push(p);
  }
  tail.connect(out);
  const oscs = ([[1, 1], [3.93, 0.12]] as const).map(([ratio, g]) => {
    const o = c.createOscillator(), og = c.createGain();
    o.frequency.value = f * ratio;
    og.gain.value = g;
    o.connect(og).connect(env);
    o.start(t);
    o.stop(t + 1.4);
    made.push(o, og);
    return o;
  });
  release(oscs[0], made);
}
