import { describe, expect, it } from 'vitest';
import { STEP } from '../engine';
import { SPECIES } from '../content';
import { Creature3 } from '../engine3/creature3';
import { DANCES, FADE, type Accent } from '../engine3/dance';
import { AMBIENCES } from './musique';
import { BEATS, beatOf } from './danse';
import { faceTo, initDanse } from './danse-jeu';

const make = (id: string, x = 0) => new Creature3(SPECIES[id](), x, 300, 0, { phase: 1, dir: { x: 1, y: 0, z: 0 } });

describe('the dances in the world', () => {
  it('lay their steps over a body, sound the strong beats, and let go of it at the end', () => {
    const heard: Accent[] = [], cr = make('poissonClown');
    const g = initDanse({ accent: (k) => heard.push(k) });
    expect(g.play(cr, 'twist', { beat: 0.5 })).toBe(true);
    expect(cr.groove).not.toBe(null);
    expect(g.of(cr)).toBe('twist');
    let t = 0, moved = false;
    for (; t < DANCES.twist.beats * 0.5 + 2; t += STEP) {
      g.step(t);
      if (cr.groove && (cr.groove.roll || cr.groove.pitch)) moved = true;
      cr.steer(t, 0, 0, 0, 0.05);
    }
    expect(moved).toBe(true);
    expect(cr.groove).toBe(null);
    expect(g.of(cr)).toBe(null);
    expect(heard).toEqual(['down', 'beat', 'down', 'beat', 'pose']);
  });

  it('dances for two: the other answers, without a sound of its own, the two turned to each other', () => {
    const heard: Accent[] = [], a = make('crabe', 0), b = make('crabe', 120);
    const g = initDanse({ accent: (k) => heard.push(k) });
    g.play(a, 'crabe', { with: b, beat: 0.5 });
    expect(g.playing.map((p) => p.role).sort()).toEqual([0, 1]);
    expect(Math.cos(a.yawGoal)).toBeGreaterThan(0);
    expect(Math.cos(b.yawGoal)).toBeLessThan(0);
    for (let t = 0; t < (DANCES.crabe.beats + FADE) * 0.5 + 0.2; t += STEP) g.step(t);
    expect(heard.filter((k) => k === 'pose')).toHaveLength(1);
    expect(a.groove).toBe(null);
    expect(b.groove).toBe(null);
  });

  it('holds an animal of the world where it is, never the swimmer', () => {
    const swimmer = make('poissonClown'), fish = make('koi', 200);
    const g = initDanse({ swimmer: () => swimmer, accent: () => {} });
    g.play({ cr: fish }, 'disco');
    g.play(swimmer, 'disco');
    expect(g.holds(fish)).toBe(true);
    expect(g.holds(swimmer)).toBe(false);
    g.stop(fish);
    expect(fish.groove).toBe(null);
    expect(g.holds(fish)).toBe(false);
  });

  it('gives way to whatever takes the body', () => {
    const cr = make('meduse'), g = initDanse({ accent: () => {} });
    g.play(cr, 'vague');
    g.step(0.1);
    cr.groove = null;
    g.step(0.2);
    expect(g.playing).toHaveLength(0);
  });

  it('dances on the beat of each chapter\'s music', () => {
    for (const a of Object.values(AMBIENCES)) {
      const b = beatOf(a.motif.step);
      expect(b).toBeGreaterThanOrEqual(BEATS[0]);
      expect(b).toBeLessThanOrEqual(BEATS[1]);
      // the pace of its notes, taken or divided a whole number of times, unless held within the tempi of a dance
      const k = b / a.motif.step, whole = [1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4].some((n) => Math.abs(k - n) < 1e-9);
      expect(whole || b === BEATS[0] || b === BEATS[1]).toBe(true);
    }
  });

  it('turns a body to face one way as its swim would', () => {
    const fish = make('poissonClown'), crab = make('crabe'), bell = make('meduse');
    faceTo(fish, -1); expect(fish.yawGoal).toBeCloseTo(Math.PI);
    faceTo(crab, 1); expect(Math.cos(crab.yawGoal)).toBeGreaterThan(0.5);
    const y = bell.yawGoal; faceTo(bell, -1); expect(bell.yawGoal).toBe(y);
  });
});
