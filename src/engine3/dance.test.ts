import { describe, expect, it } from 'vitest';
import { SPECIES } from '../content/species';
import { STEP } from '../engine/util';
import { Creature3, settle3 } from './creature3';
import { DANCES, DANCE_IDS, EASE_IN, FADE, MOVES, accentAt, done, kitOf, perform, pick, type Choreo, type DanceId } from './dance';
import { ARM, FIN, FRILL, LEG, LIMBS, ROW, THREAD, TRUNK, newGroove, slot, type Groove } from './groove';

/** a fish, a crab, a jellyfish, a worm with no limbs, an octopus */
const BODIES = ['poissonClown', 'crabe', 'meduse', 'larve', 'poulpe'];

const make = (id: string) => {
  const cr = new Creature3(SPECIES[id](), 0, 0, 0, { phase: 1, dir: { x: 1, y: 0, z: 0 } });
  settle3(cr, 60);
  return cr;
};

/** the dance played on a creature (role 0) for its whole length, at 0.5 s a beat; each step: f(creature, beat) */
function play(cr: Creature3, d: Choreo, f: (cr: Creature3, b: number) => void = () => {}, role: 0 | 1 = 0): void {
  const k = kitOf(cr), g = newGroove();
  cr.groove = g;
  for (let t = 0; ; t += STEP) {
    const b = t / 0.5;
    if (done(d, b)) break;
    perform(g, d, role, b, k);
    cr.steer(t, 0, 0, 0, 0.05);
    f(cr, b);
  }
  cr.groove = null;
}

/** the largest gap between the length of a link and its rest length, over the whole creature */
function stretch(cr: Creature3): number {
  let most = 0;
  for (const s of cr.list) for (let i = 1; i <= s.n; i++) {
    const l = Math.hypot(s.x[i] - s.x[i - 1], s.y[i] - s.y[i - 1], s.z[i] - s.z[i - 1]);
    most = Math.max(most, Math.abs(l - s.lens[i]) / s.lens[i]);
  }
  return most;
}

const values = (g: Groove) => [...g.bend, g.x, g.y, g.pitch, g.roll, ...g.swing, ...g.raise, ...g.curl];

describe('the groove laid over the swim', () => {
  it('changes nothing when it is empty', () => {
    for (const id of BODIES) {
      const a = make(id), b = make(id);
      b.groove = newGroove();
      for (let i = 0; i < 120; i++) { a.steer(i * STEP, 0.6, 0.1, 0, 0.05); b.steer(i * STEP, 0.6, 0.1, 0, 0.05); }
      for (let s = 0; s < a.list.length; s++) {
        expect(b.list[s].x[a.list[s].n]).toBeCloseTo(a.list[s].x[a.list[s].n], 9);
        expect(b.list[s].y[a.list[s].n]).toBeCloseTo(a.list[s].y[a.list[s].n], 9);
      }
    }
  });

  it('moves the body without breaking its chains, and lets go of it at the end', () => {
    for (const id of BODIES) for (const dance of ['twist', 'canards'] as DanceId[]) {
      const cr = make(id), still = make(id);
      let most = 0, moved = 0;
      play(cr, DANCES[dance], (c, b) => {
        most = Math.max(most, stretch(c));
        // the same body, swimming the same way without the dance
        still.steer(b * 0.5, 0, 0, 0, 0.05);
        for (let s = 0; s < c.list.length; s++) {
          const p = c.list[s], q = still.list[s];
          moved = Math.max(moved, Math.hypot(p.x[p.n] - p.x[0] - (q.x[q.n] - q.x[0]), p.y[p.n] - p.y[0] - (q.y[q.n] - q.y[0])));
        }
      });
      expect(most, `${id} ${dance}`).toBeLessThan(0.02);
      expect(moved, `${id} ${dance}`).toBeGreaterThan(4);
      expect(cr.gx).toBe(0);
      for (const s of cr.list) for (let i = 0; i <= s.n; i++) expect(Number.isFinite(s.x[i] + s.y[i] + s.z[i])).toBe(true);
    }
  });
});

describe('what a body has', () => {
  it('tells its limbs apart, and does with what it has', () => {
    const kit = (id: string) => kitOf(make(id));
    expect(kit('crabe').limbs[LEG]).toBeGreaterThan(0);
    expect(kit('poissonClown').limbs[FIN]).toBeGreaterThan(0);
    expect(kit('poulpe').limbs[ARM]).toBeGreaterThan(0);
    // a jellyfish with no legs steps with its threads; a crab claps with its claws, a fish with its fins
    expect(pick(kit('meduse'), [LEG, FIN, THREAD, ARM])).toBe(THREAD);
    expect(pick(kit('crabe'), [ARM, FIN])).toBe(ARM);
    expect(pick(kit('poissonClown'), [ARM, FIN])).toBe(FIN);
    // a starfish dances with its arms, a larva with no limbs with its trunk
    expect(pick(kit('etoile'), [LEG, FRILL])).toBe(FRILL);
    expect(kit('larve').limbs.every((l) => l === 0)).toBe(true);
    expect(pick(kit('larve'), [LEG, FIN, ARM, THREAD, FRILL])).toBe(-1);
  });

  it('makes a body with no limbs wiggle its trunk instead, and a bell sway', () => {
    const g = newGroove(), worm = kitOf(make('larve')), bell = kitOf(make('meduse'));
    perform(g, DANCES.canards, 0, 2.3, worm);
    expect(Math.max(...g.bend.map(Math.abs))).toBeGreaterThan(0.3);
    expect(Math.max(...g.swing.map(Math.abs), ...g.raise.map(Math.abs))).toBe(0);
    perform(g, DANCES.twist, 0, 1.3, bell);
    expect(Math.abs(g.pitch)).toBeGreaterThan(0.05);
  });
});

describe('the steps', () => {
  it('each write something into the groove, on a fish and on a crab', () => {
    for (const id of ['poissonClown', 'crabe']) {
      const k = kitOf(make(id));
      for (const m of Object.keys(MOVES) as (keyof typeof MOVES)[]) {
        const d: Choreo = { ...DANCES.twist, steps: [{ n: 4, a: [[m, 1, 0, 1]] }], beats: 4, at: [0] };
        const g = newGroove();
        let most = 0;
        for (let b = 0.3; b < 3.7; b += 0.1) { perform(g, d, 0, b, k); most = Math.max(most, ...values(g).map(Math.abs), Math.abs(g.yaw)); }
        expect(most, `${id} ${m}`).toBeGreaterThan(0.05);
      }
    }
  });
});

describe('the dances', () => {
  it('end on a pose both dancers hold together, and bring the body back where it swims', () => {
    for (const id of Object.keys(DANCES) as DanceId[]) {
      const d = DANCES[id], last = d.steps[d.steps.length - 1];
      expect(d.beats).toBe(d.steps.reduce((s, b) => s + b.n, 0));
      expect(d.beats).toBeGreaterThanOrEqual(4);
      expect(typeof last.b === 'object' && !Array.isArray(last.b)).toBe(false);
      const g = newGroove(), k = kitOf(make('crabe'));
      for (const role of [0, 1] as const) {
        perform(g, d, role, d.beats - 0.01, k);
        expect(Math.abs(g.x), `${id} ${role}`).toBeLessThan(1);
      }
    }
  });

  it('have the two dancers answer each other: mirrored or in canon somewhere', () => {
    for (const id of DANCE_IDS) {
      const d = DANCES[id];
      expect(d.steps.some((s) => s.b === 'mirror' || Array.isArray(s.b) || (typeof s.b === 'object' && 'canon' in s.b)), id).toBe(true);
    }
  });

  it('mirror: the other side, the other way', () => {
    const k = kitOf(make('crabe')), a = newGroove(), b = newGroove();
    // the first bar of the disco is mirrored
    perform(a, DANCES.disco, 0, 1.4, k);
    perform(b, DANCES.disco, 1, 1.4, k);
    expect(b.roll).toBeCloseTo(-a.roll, 6);
    expect(b.pitch).toBeCloseTo(a.pitch, 6);
    for (let p = 0; p < ROW; p++) expect(b.raise[slot(ARM, 0, p)]).toBeCloseTo(a.raise[slot(ARM, 1, p)], 6);
  });

  it('canon: the second does what the first did some beats before', () => {
    const k = kitOf(make('poissonClown')), a = newGroove(), b = newGroove();
    // the first bar of the wave: one beat later
    perform(a, DANCES.vague, 0, 1.6, k);
    perform(b, DANCES.vague, 1, 2.6, k);
    for (let p = 0; p < TRUNK; p++) expect(b.bend[p]).toBeCloseTo(a.bend[p], 6);
    for (let i = 0; i < LIMBS.length * 2 * ROW; i++) expect(b.swing[i]).toBeCloseTo(a.swing[i], 6);
    // at the very start, the second waits
    perform(b, DANCES.vague, 1, 0.8, k);
    expect(values(b).every((v) => v === 0)).toBe(true);
  });

  it('never jump from one step to the next', () => {
    for (const id of Object.keys(DANCES) as DanceId[]) for (const body of ['poissonClown', 'meduse']) {
      const d = DANCES[id], k = kitOf(make(body)), g = newGroove();
      for (const role of [0, 1] as const) {
        let prev: number[] | null = null, prevYaw = 0, prevPitch = 0, most = 0;
        // (a whole turn of a spin, or of a bell's somersault, is no turn)
        const turn = (a: number, b: number) => { const d = Math.abs(a - b) % (Math.PI * 2); return Math.min(d, Math.PI * 2 - d); };
        for (let b = 0; b < d.beats + FADE; b += 1 / 160) {
          perform(g, d, role, b, k);
          const v = values(g).filter((_, i) => i !== TRUNK + 2);
          if (prev) most = Math.max(most, ...v.map((x, i) => Math.abs(x - prev![i]) / (i < TRUNK ? 2 : i < TRUNK + 2 ? 12 : 1)), turn(g.yaw, prevYaw), turn(g.pitch, prevPitch));
          prev = v; prevYaw = g.yaw; prevPitch = g.pitch;
        }
        expect(most, `${id} ${body} ${role}`).toBeLessThan(0.3);
      }
    }
  });

  it('come in softly and let go after the pose', () => {
    const k = kitOf(make('poissonClown')), g = newGroove(), d = DANCES.twist;
    perform(g, d, 0, 0, k);
    expect(values(g).every((v) => v === 0)).toBe(true);
    perform(g, d, 0, EASE_IN + 0.5, k);
    expect(values(g).some((v) => v !== 0)).toBe(true);
    perform(g, d, 0, d.beats + FADE, k);
    expect(values(g).every((v) => v === 0)).toBe(true);
    expect(done(d, d.beats + FADE)).toBe(true);
    expect(done(d, d.beats)).toBe(false);
  });

  it('sound their strong beats: the first of a bar, the third of four, the last pose', () => {
    const at = (d: Choreo) => Array.from({ length: d.beats + 2 }, (_, n) => accentAt(d, n - 1 - 1e-3, n - 1 + 1e-3));
    const tw = at(DANCES.twist);
    expect(tw.slice(1, 12)).toEqual(['down', null, 'beat', null, 'down', null, 'beat', null, 'pose', null, null]);
    const va = at(DANCES.valse);
    expect(va.slice(1, 13)).toEqual(['down', null, null, 'down', null, null, 'down', null, null, 'pose', null, null]);
    // once only
    expect(accentAt(DANCES.twist, 4.01, 4.2)).toBe(null);
  });
});
