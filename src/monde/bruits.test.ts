import { describe, expect, it } from 'vitest';
import { rng } from '../engine';
import { BIOMES, biomeMid, chapterIndex } from './biomes';
import {
  BEDS, CAVE_ECHO, bedAt, bubble, burst, call, caveAt, crack, currentNear, currentOf, drips, farWhale, heard, hushIn, noiseLoop,
  roarAt, rushOf, surfAt, swellAt, tinkle, train, trainsOf, bubblingAt, springTrains, voiceOf, waitFor, wavesAt
} from './bruits';
import { CAVE_A, CAVE_B } from './grotte';
import { inPenta } from './musique';

const mid = (id: (typeof BIOMES)[number]['id']) => biomeMid(chapterIndex(id));

describe('what each chapter sounds like', () => {
  it('every chapter of the map has its bed, every level a number in its range', () => {
    for (const b of BIOMES) {
      const bed = BEDS[b.id];
      expect(bed).toBeDefined();
      for (const k of ['water', 'space'] as const) expect(bed[k]).toBeGreaterThanOrEqual(0), expect(bed[k]).toBeLessThanOrEqual(1);
      expect(bed.lp).toBeGreaterThan(100);
    }
  });

  it('drops fall only in the Grotte, the ice cracks only in the Glacier, no whale reaches the galleries', () => {
    for (const b of BIOMES) {
      expect(BEDS[b.id].drips > 0).toBe(b.id === 'grotte');
      expect(BEDS[b.id].cracks > 0).toBe(b.id === 'glacier');
    }
    expect(BEDS.grotte.whales).toBe(0);
    expect(BEDS.grotte.space).toBe(Math.max(...BIOMES.map((b) => BEDS[b.id].space)));
  });

  it('in the middle of a chapter, its own bed; at a border, between the two', () => {
    for (const b of BIOMES) expect(bedAt(mid(b.id)).water).toBeCloseTo(BEDS[b.id].water, 5);
    const g = chapterIndex('glacier'), x = BIOMES[g].x0, here = bedAt(x), before = BEDS[BIOMES[g - 1].id];
    expect(here.cracks).toBeGreaterThan(0);
    expect(here.cracks).toBeLessThan(BEDS.glacier.cracks);
    expect(here.water).toBeGreaterThanOrEqual(Math.min(before.water, BEDS.glacier.water));
    expect(here.water).toBeLessThanOrEqual(Math.max(before.water, BEDS.glacier.water));
  });

  it('the walls of the Grotte are heard under its vault only', () => {
    expect(caveAt(CAVE_A - 100)).toBe(0);
    expect(caveAt((CAVE_A + CAVE_B) / 2)).toBe(1);
    expect(caveAt(mid('nurserie'))).toBe(0);
  });
});

describe('the beds', () => {
  it('the waves overhead fade as the water deepens and are gone below 60 m', () => {
    expect(surfAt(0)).toBe(1);
    expect(surfAt(10)).toBeLessThan(surfAt(2));
    expect(surfAt(60)).toBe(0);
    expect(surfAt(400)).toBe(0);
  });

  it('the waves and the swell of the water come and go, never silent, never past 1', () => {
    let lo = 1, hi = 0, slo = 1, shi = 0;
    for (let t = 0; t < 120; t += 0.1) {
      lo = Math.min(lo, wavesAt(t)); hi = Math.max(hi, wavesAt(t));
      slo = Math.min(slo, swellAt(t)); shi = Math.max(shi, swellAt(t));
    }
    expect(lo).toBeGreaterThanOrEqual(0.25);
    expect(hi).toBeLessThanOrEqual(1);
    expect(hi - lo).toBeGreaterThan(0.4);
    expect(slo).toBeGreaterThanOrEqual(0.75);
    expect(shi).toBeLessThanOrEqual(1);
  });

  it('the rush of the water: nothing at rest, louder and higher as the swimmer goes faster, a current heard too', () => {
    expect(rushOf(0).g).toBe(0);
    expect(rushOf(0.25).g).toBe(0);
    expect(rushOf(2.6).g).toBeGreaterThan(0);
    expect(rushOf(6).g).toBeGreaterThan(rushOf(2.6).g);
    expect(rushOf(6).f).toBeGreaterThan(rushOf(2.6).f);
    expect(rushOf(50).g).toBe(1);
    expect(rushOf(0, 1).g).toBeGreaterThan(0.5);
  });

  it('a current that bars the way is strong; once crossed, a murmur', () => {
    expect(currentOf(0, false)).toBe(0);
    expect(currentOf(1, false)).toBe(1);
    expect(currentOf(1, true)).toBeLessThan(0.5);
    expect(currentOf(0.5, false)).toBeLessThan(currentOf(0.9, false));
    const pass = { gate: 5000, open: false, o: { hold: 'push', soft: 900 } };
    expect(currentNear(pass, 5000)).toBe(1);
    expect(currentNear(pass, 4100)).toBe(0);
    expect(currentNear({ ...pass, o: { hold: 'slow', soft: 900 } }, 5000)).toBe(0);
    expect(currentNear(null, 5000)).toBe(0);
  });

  it('the chimneys rumble near, not far', () => {
    expect(roarAt(0)).toBe(1);
    expect(roarAt(400)).toBeLessThan(1);
    expect(roarAt(900)).toBe(0);
    expect(roarAt(Infinity)).toBe(0);
  });

  it('the noises step back for the words of a farewell', () => {
    expect(hushIn(null)).toBe(1);
    expect(hushIn('parade')).toBe(1);
    expect(hushIn('adieu')).toBeLessThan(1);
  });
});

describe('where a noise comes from', () => {
  it('near: loud, bright, in front; far: quiet and dull; from its side', () => {
    const near = heard(0, 0), far = heard(0, 0, 3000);
    expect(near.g).toBe(1);
    expect(near.pan).toBe(0);
    expect(far.g).toBeLessThan(0.3);
    expect(far.cut).toBeLessThan(near.cut / 2);
    expect(heard(-600, 0).pan).toBeLessThan(0);
    expect(heard(5000, 0).pan).toBeLessThanOrEqual(0.85);
  });

  it('a noise that comes n times a second comes about n times a second, never for a rate of nothing', () => {
    const r = rng(3);
    let s = 0;
    for (let i = 0; i < 2000; i++) s += waitFor(r, 2);
    expect(s / 2000).toBeGreaterThan(0.4);
    expect(s / 2000).toBeLessThan(0.6);
    expect(waitFor(r, 0)).toBe(Infinity);
  });
});

describe('the shape of the noises', () => {
  it('a bubble rings high when small, low when big, and rises as it leaves', () => {
    const r = rng(5), all = Array.from({ length: 200 }, () => bubble(r));
    for (const b of all) {
      expect(b.f1).toBeGreaterThan(b.f0);
      expect(b.f0).toBeGreaterThan(600);
      expect(b.f0).toBeLessThan(6000);
      expect(b.len).toBeGreaterThan(0.03);
    }
    const lo = all.reduce((a, b) => (b.f0 < a.f0 ? b : a)), hi = all.reduce((a, b) => (b.f0 > a.f0 ? b : a));
    expect(lo.len).toBeGreaterThan(hi.len);
    expect(bubble(rng(9), 0, 1.3).f0).toBeLessThan(bubble(rng(9)).f0);
  });

  it('a burst: a few bubbles one after the other', () => {
    const r = rng(7);
    for (let i = 0; i < 30; i++) {
      const b = burst(r, 6);
      expect(b.length).toBeGreaterThanOrEqual(1);
      expect(b.length).toBeLessThanOrEqual(6);
      for (let k = 1; k < b.length; k++) expect(b[k].at).toBeGreaterThan(b[k - 1].at);
    }
  });

  it('a drop rises into its plink; sometimes a smaller one after it', () => {
    const r = rng(2);
    let two = 0;
    for (let i = 0; i < 100; i++) {
      const d = drips(r);
      expect(d[0].f1).toBeGreaterThan(d[0].f0);
      if (d.length > 1) { two++; expect(d[1].at).toBeGreaterThan(0); expect(d[1].g).toBeLessThan(d[0].g); }
    }
    expect(two).toBeGreaterThan(10);
    expect(two).toBeLessThan(90);
  });

  it('the walls of the Grotte answer without ringing forever', () => {
    expect(CAVE_ECHO.feedback + CAVE_ECHO.cross).toBeLessThan(1);
  });

  it('the ice cracks in a run of clicks, now and then after a groan or before a boom', () => {
    const r = rng(11);
    let groans = 0, booms = 0;
    for (let i = 0; i < 200; i++) {
      const k = crack(r);
      expect(k.clicks.length).toBeGreaterThanOrEqual(4);
      for (let q = 1; q < k.clicks.length; q++) expect(k.clicks[q].at).toBeGreaterThan(k.clicks[q - 1].at);
      for (const c of k.clicks) expect(c.g).toBeGreaterThan(0), expect(c.len).toBeLessThan(0.02);
      if (k.groan) { groans++; expect(k.clicks[0].at).toBeGreaterThan(0); }
      if (k.boom) { booms++; expect(k.boom.at).toBeGreaterThan(k.clicks[k.clicks.length - 1].at); }
    }
    expect(groans).toBeGreaterThan(20);
    expect(booms).toBeGreaterThan(5);
    expect(booms).toBeLessThan(groans);
  });

  it('the crystals tinkle on the notes of the song, high up', () => {
    const r = rng(4);
    for (let i = 0; i < 50; i++) for (const n of tinkle(r)) {
      const midi = 69 + 12 * Math.log2(n.f / 440);
      expect(inPenta(Math.round(midi))).toBe(true);
      expect(midi).toBeGreaterThanOrEqual(96 - 1e-6);
    }
  });

  it('the bigger the animal, the lower its voice', () => {
    expect(voiceOf(2.4)).toBeGreaterThan(voiceOf(4));
    expect(voiceOf(4)).toBeGreaterThan(voiceOf(9));
    expect(voiceOf(100)).toBeGreaterThanOrEqual(55);
    expect(voiceOf(0)).toBeLessThanOrEqual(220);
  });

  it('a big animal seen cries twice, 1.6 s apart as its waves, the second lower; a whale unseen sings a few, far', () => {
    const r = rng(8);
    for (let i = 0; i < 40; i++) {
      const u = call(r, 120, 2, 1.6);
      expect(u.map((q) => q.at)).toEqual([0, 1.6]);
      expect(u[1].g).toBeLessThan(u[0].g + 0.3);
      for (const q of u) for (const [s, f] of q.pts) expect(s).toBeGreaterThanOrEqual(0), expect(s).toBeLessThanOrEqual(1), expect(f).toBeGreaterThan(30);
      const w = farWhale(r);
      expect(w.units.length).toBeGreaterThanOrEqual(2);
      expect(w.dz).toBeGreaterThan(2000);
      for (let k = 1; k < w.units.length; k++) expect(w.units[k].at).toBeGreaterThan(w.units[k - 1].at + w.units[k - 1].len);
    }
  });
});

describe('the noise itself', () => {
  for (const kind of ['white', 'pink', 'brown'] as const) it(`a loop of ${kind} noise: its peak at 1, centred, without a click at the loop`, () => {
    const d = noiseLoop(kind, 20000, rng(1));
    let peak = 0, mean = 0, step = 0;
    for (let i = 0; i < d.length; i++) {
      peak = Math.max(peak, Math.abs(d[i]));
      mean += d[i];
      if (i) step = Math.max(step, Math.abs(d[i] - d[i - 1]));
    }
    expect(d.length).toBe(18000);
    expect(peak).toBeCloseTo(1, 5);
    expect(Math.abs(mean / d.length)).toBeLessThan(1e-6);
    // the jump from the end back to the start is no bigger than a step inside it
    expect(Math.abs(d[d.length - 1] - d[0])).toBeLessThanOrEqual(step + 1e-6);
  });

  it('a brown noise rumbles: its steps are small beside a white noise', () => {
    const w = noiseLoop('white', 8000, rng(2)), b = noiseLoop('brown', 8000, rng(2));
    const rough = (d: Float32Array) => { let s = 0; for (let i = 1; i < d.length; i++) s += Math.abs(d[i] - d[i - 1]); return s / d.length; };
    expect(rough(b)).toBeLessThan(rough(w) / 5);
  });
});

describe('the trains of bubbles', () => {
  it('long and short, silences between; a chimney bubbles longer and more often than a seep', () => {
    const r = rng(4), share = (kind: 'seep' | 'vent') => {
      let on = 0, off = 0, short = 0, long = 0;
      for (let i = 0; i < 400; i++) {
        const t = train(r, kind);
        expect(t.len).toBeGreaterThan(0);
        expect(t.rest).toBeGreaterThan(1);
        expect(t.pace).toBeGreaterThan(1);
        on += t.len; off += t.rest;
        if (t.len < 1.2) short++;
        if (t.len > 2.5) long++;
      }
      expect(short).toBeGreaterThan(20);
      expect(long).toBeGreaterThan(20);
      return on / (on + off);
    };
    const seep = share('seep'), vent = share('vent');
    expect(seep).toBeLessThan(0.35);
    expect(vent).toBeGreaterThan(seep);
  });

  it('here and there: a short train, from one burst to a few', () => {
    const r = rng(6);
    for (let i = 0; i < 100; i++) {
      const t = train(r, 'free');
      expect(t.len).toBeLessThanOrEqual(1.6);
      expect(t.len * t.pace).toBeLessThan(6);
    }
  });

  it('a seep or a chimney keeps its trains, the same for the sound and the eye, and they come back', () => {
    const tr = trainsOf(42, 'vent');
    expect(tr.on.length).toBeGreaterThan(5);
    for (let k = 1; k < tr.on.length; k++) expect(tr.on[k][0]).toBeGreaterThan(tr.on[k - 1][1] + 1);
    const [a, b, pace] = tr.on[2];
    expect(bubblingAt(tr, (a + b) / 2)).toBe(pace);
    expect(bubblingAt(tr, (a + b) / 2 + tr.period * 3)).toBe(pace);
    expect(bubblingAt(tr, b + 0.5)).toBe(0);
    expect(springTrains(42, 'vent')).toBe(springTrains(42, 'vent'));
    expect(springTrains(42, 'vent')).toEqual(tr);
    expect(trainsOf(43, 'vent')).not.toEqual(tr);
  });
});
