import { describe, expect, it } from 'vitest';
import { BIOMES, floorAt, openFloor, biomeMid } from './biomes';
import { SLABS, WAVE_LIFE, WAVE_SPEED, flash, periodX, periodY, pulse, wrap } from './jardin';

describe('the jellyfish garden', () => {
  it('wraps the field around the camera', () => {
    for (const v of [-5000, -1, 0, 333, 9999]) {
      const w = wrap(v, 1000, 800);
      expect(w).toBeGreaterThanOrEqual(600);
      expect(w).toBeLessThan(1400);
      expect(Math.abs(((w - v) / 800) - Math.round((w - v) / 800))).toBeLessThan(1e-9);
    }
  });

  it('repeats the field wider than the widest view sees', () => {
    // widest view: zoomed out (camera 2000 away), landscape, 44° of field over the height
    for (const z of SLABS) {
      const d = z + 2000, halfW = d * Math.tan((22 * Math.PI) / 180) * (16 / 9), halfH = d * Math.tan((26 * Math.PI) / 180);
      expect(periodX(z) / 2).toBeGreaterThan(halfW);
      expect(periodY(z) / 2).toBeGreaterThan(halfH);
    }
  });

  it('pulses: frames in order, and each beat lifts the bell a little more', () => {
    const frames = [0, 0.05, 0.2, 0.35, 0.6].map((c) => pulse(3 + c).frame);
    expect(frames).toEqual([1, 1, 2, 3, 0]);
    let last = -Infinity;
    for (let c = 0; c < 4; c += 0.01) { const l = pulse(c).lift; expect(l).toBeGreaterThanOrEqual(last - 1e-9); last = l; }
    expect(pulse(5.9).lift).toBeCloseTo(6);
  });

  it('lights a jelly when the wave reaches it, then fades', () => {
    expect(flash(WAVE_SPEED * 2, 2)).toBeGreaterThan(0.7);
    expect(flash(WAVE_SPEED * 4, 0.5)).toBeLessThan(0.01);
    expect(flash(0, WAVE_LIFE + 1)).toBe(0);
    expect(flash(WAVE_SPEED * 6, 6)).toBeLessThan(flash(WAVE_SPEED * 2, 2));
  });

  it('has no floor in sight, but its animals keep to mid water', () => {
    const i = BIOMES.findIndex((b) => b.id === 'jardin'), x = biomeMid(i);
    expect(i).toBeGreaterThan(0);
    expect(BIOMES[i + 1].id).toBe('fosse');
    expect(floorAt(x, 0) - openFloor(x, 0)).toBeGreaterThan(2500);
    // the neighbours keep their floor (the fall slopes over a long stretch, only a little of it reaches their heart)
    expect(floorAt(biomeMid(i + 1), 0) - openFloor(biomeMid(i + 1), 0)).toBeLessThan(150);
    expect(floorAt(biomeMid(i - 1), 0) - openFloor(biomeMid(i - 1), 0)).toBeLessThan(150);
  });
});
