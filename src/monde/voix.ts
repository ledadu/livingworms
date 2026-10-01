// What the sound engine can afford (docs/direction-artistique.md, « Le son », « Le coût »): how many notes of the song
// ring at once, which ones are let go for a new one (the faintest), and whether the device struggles to keep up (it
// then lightens what can be). Pure and tested; chant-son.ts, bruits-son.ts and son.ts use it.

/** how many notes of the song may ring at once, and when the device struggles */
export const MAX_NOTES = 12, MAX_NOTES_STRAINED = 6;
/** how many noises may sound at once, and when the device struggles */
export const MAX_NOISES = 28, MAX_NOISES_STRAINED = 14;

/** a note that rings: since when, until when (s); how loud at its peak, reached after `attack` s, then its fade (s) */
export interface Ringing { t0: number; end: number; peak: number; attack: number; fade: number; }

/** how loud a note rings at `now`, about */
export function loudness(n: Ringing, now: number): number {
  const u = now - n.t0;
  if (u >= n.end - n.t0) return 0;
  return u < n.attack ? n.peak * Math.max(0, u / n.attack) : n.peak * Math.exp(-(u - n.attack) / n.fade);
}

/**
 * The notes to let go now so that a new one fits under `cap`: the faintest now (what the ear misses least), often
 * the oldest or an animal's answer far away. A note still rising is kept. Those that have rung out do not count.
 */
export function toSteal<T extends Ringing>(live: readonly T[], now: number, cap: number): T[] {
  const ringing = live.filter((n) => n.end > now), over = ringing.length - Math.max(0, cap - 1);
  if (over <= 0) return [];
  const rank = (n: T) => (now - n.t0 < n.attack ? Infinity : loudness(n, now));
  return [...ringing].sort((a, b) => rank(a) - rank(b) || a.t0 - b.t0).slice(0, over);
}

/**
 * Partials that are all whole multiples of the lowest (sines): one oscillator can ring them all at once with a wave of
 * its own, one node instead of two for each. The ratio of that lowest one and the loudness of each harmonic (by rank,
 * 0 for none), or null.
 */
export function harmonicsOf(partials: readonly (readonly [number, number])[]): { base: number; amps: number[] } | null {
  if (!partials.length) return null;
  const base = Math.min(...partials.map(([r]) => r)), amps: number[] = [0];
  for (const [r, g] of partials) {
    const k = Math.round(r / base);
    if (k < 1 || k > 32 || Math.abs(r / base - k) > 1e-6) return null;
    while (amps.length <= k) amps.push(0);
    amps[k] += g;
  }
  return { base, amps };
}

/** how long the sound stays light after the device last failed to keep up (s) */
export const STRAIN_HOLD = 90;

/**
 * Whether the device struggles: the sound went silent for want of time (the underruns the browser counts), lately.
 * Light from the first one, for STRAIN_HOLD s after the last.
 */
export class Strain {
  private seen = -1;
  private last = -Infinity;
  /** what the browser counts at `now` (s): its underruns so far */
  feel(underruns: number, now: number): void {
    if (this.seen >= 0 && underruns > this.seen) this.last = now;
    this.seen = underruns;
  }
  on(now: number): boolean { return now - this.last < STRAIN_HOLD; }
}
