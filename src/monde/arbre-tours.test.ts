import { describe, expect, it } from 'vitest';
import {
  MAX_BUSY, PHOTO_FLASH, REPERTOIRE, REST, TOURS, gaitOf, nextTour, olaAt, olaDuration, photoAfter, photoTour, poseOf, restBetween, rollFit,
  type Gait, type TourId
} from './arbre-tours';

const GAITS: Gait[] = ['glide', 'bell', 'jet', 'crawl'];
const IDS = Object.keys(TOURS) as TourId[];

/** how far the drawing is from rest: offset, roll (a whole turn is rest), squash */
function away(p: ReturnType<typeof poseOf>): number {
  return Math.max(Math.abs(p.dx), Math.abs(p.dy), Math.abs(Math.sin(p.roll)), 1 - Math.cos(p.roll), Math.abs(p.sx - 1), Math.abs(p.sy - 1));
}

describe('the tricks of the living portraits', () => {
  it('start and end at rest, so that a portrait never jumps', () => {
    for (const id of IDS) for (const g of GAITS) {
      expect(away(TOURS[id].pose(0, g)), `${id} ${g} at 0`).toBeLessThan(0.01);
      expect(away(TOURS[id].pose(0.999, g)), `${id} ${g} at the end`).toBeLessThan(0.02);
      expect(poseOf(id, 1, g)).toEqual(REST);
    }
  });

  it('stay gentle: the drawing moves smoothly, keeps its size, and only leaves its medallion to peek', () => {
    for (const id of IDS) for (const g of GAITS) {
      let prev = TOURS[id].pose(0, g);
      for (let k = 1; k <= 400; k++) {
        const p = TOURS[id].pose(k / 400, g);
        expect(p.sx, id).toBeGreaterThan(0.75); expect(p.sx, id).toBeLessThan(1.25);
        expect(p.sy, id).toBeGreaterThan(0.75); expect(p.sy, id).toBeLessThan(1.25);
        expect(p.tempo, id).toBeGreaterThan(0.2); expect(p.tempo, id).toBeLessThan(3.5);
        if (id !== 'coucou') expect(Math.abs(p.dx) + Math.abs(p.dy), id).toBeLessThan(0.35);
        // no jump, except the peekaboo crossing over while it is out of sight
        const jump = Math.abs(p.dx - prev.dx) > 0.5;
        if (jump) expect(id).toBe('coucou');
        else expect(Math.abs(p.dy - prev.dy) + Math.abs(p.roll - prev.roll), `${id} ${g} at ${k / 400}`).toBeLessThan(0.1);
        prev = p;
      }
    }
  });

  it('the somersault is a whole turn, and the peekaboo goes out of sight', () => {
    expect(TOURS.culbute.pose(0.9, 'glide').roll).toBeCloseTo(-2 * Math.PI, 5);
    expect(Math.max(...[0.3, 0.35, 0.4].map((u) => Math.abs(TOURS.coucou.pose(u, 'glide').dx)))).toBeGreaterThan(1);
  });

  it('the photo, the bubbles and the pirouette turn the animal; a bell, which has no side, sways instead', () => {
    expect(TOURS.pose.pose(0.5, 'glide').yaw).toBeCloseTo(-Math.PI / 2);
    expect(TOURS.bulles.pose(0.5, 'crawl').yaw).toBeLessThan(0);
    expect(TOURS.toupie.pose(0.5, 'jet').yaw).toBeLessThan(-1);
    expect(TOURS.toupie.pose(0.5, 'bell').yaw).toBeUndefined();
    expect(TOURS.bulles.pose(0.5, 'bell').yaw).toBeUndefined();
    expect(REPERTOIRE.bell).not.toContain('pose');
  });

  it('bubbles leave during the trick', () => {
    for (const id of IDS) for (const [u, r] of TOURS[id].puffs ?? []) {
      expect(u).toBeGreaterThan(0); expect(u).toBeLessThan(1);
      expect(r).toBeGreaterThan(0);
    }
  });
});

describe('which trick, and when', () => {
  it('a portrait plays one of its own, never the same twice in a row', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const g of GAITS) {
      let last: TourId | null = null;
      const seen = new Set<TourId>();
      for (let k = 0; k < 300; k++) {
        const t = nextTour(g, last, rnd);
        expect(REPERTOIRE[g]).toContain(t);
        expect(t).not.toBe(last);
        seen.add(t);
        last = t;
      }
      expect(seen.size).toBe(REPERTOIRE[g].length);
    }
    expect(nextTour('glide', null, () => 0.999999)).toBe(REPERTOIRE.glide[REPERTOIRE.glide.length - 1]);
  });

  it('the giggle and the wave come only from outside', () => {
    for (const g of GAITS) { expect(REPERTOIRE[g]).not.toContain('rire'); expect(REPERTOIRE[g]).not.toContain('vague'); }
  });

  it('rests a few seconds between two, with few at once', () => {
    expect(restBetween(() => 0)).toBeGreaterThanOrEqual(4);
    expect(restBetween(() => 1)).toBeLessThanOrEqual(15);
    expect(MAX_BUSY).toBeGreaterThanOrEqual(1);
    expect(MAX_BUSY).toBeLessThanOrEqual(3);
  });

  it('the family photo comes soon after the tree opens, then now and then; the flash when they all face us', () => {
    expect(photoAfter(true, () => 1)).toBeLessThan(photoAfter(false, () => 0));
    expect(photoAfter(true, () => 0)).toBeGreaterThan(olaDuration(1000) + 2);
    expect(photoTour('glide')).toBe('pose');
    expect(photoTour('crawl')).toBe('pose');
    expect(photoTour('bell')).toBe('vague');
    const u = PHOTO_FLASH / TOURS.pose.dur;
    expect(TOURS.pose.pose(u, 'glide').yaw).toBeCloseTo(-Math.PI / 2);
  });

  it('knows the gait of a species', () => {
    expect(gaitOf('bell')).toBe('bell');
    expect(gaitOf('crawl')).toBe('crawl');
    expect(gaitOf('jet')).toBe('jet');
    for (const m of ['steady', 'pulse', 'dart']) expect(gaitOf(m)).toBe('glide');
  });
});

describe('the light down the thread', () => {
  it('reaches each medallion in turn, from the first to the last', () => {
    const dur = olaDuration(7);
    expect(olaAt(100, 100, 900, dur)).toBe(0);
    expect(olaAt(900, 100, 900, dur)).toBe(dur);
    expect(olaAt(500, 100, 900, dur)).toBeCloseTo(dur / 2);
    expect(olaAt(300, 100, 900, dur)).toBeLessThan(olaAt(400, 100, 900, dur));
    // a single medallion: at once
    expect(olaAt(50, 50, 50, dur)).toBe(0);
  });

  it('is quick for a short lineage and never long for a long one', () => {
    expect(olaDuration(1)).toBeGreaterThanOrEqual(1);
    expect(olaDuration(5)).toBeLessThan(olaDuration(10));
    expect(olaDuration(200)).toBeLessThanOrEqual(4.5);
  });
});

describe('a portrait rolled', () => {
  it('shrinks just enough to stay in its medallion', () => {
    expect(rollFit(100, 40, 108, 80, 0)).toBe(1);
    for (let a = 0; a <= 2 * Math.PI; a += 0.1) {
      const f = rollFit(100, 40, 108, 80, a), c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
      const k = Math.min(108 / 100, 80 / 40);
      expect(f).toBeLessThanOrEqual(1);
      expect((c * 100 + s * 40) * k * f).toBeLessThanOrEqual(108 + 1e-6);
      expect((s * 100 + c * 40) * k * f).toBeLessThanOrEqual(80 + 1e-6);
    }
    // a square one turned by an eighth of a turn needs the most
    expect(rollFit(50, 50, 80, 80, Math.PI / 4)).toBeCloseTo(Math.SQRT1_2);
    expect(rollFit(50, 50, 80, 80, Math.PI / 2)).toBeCloseTo(1);
  });
});
