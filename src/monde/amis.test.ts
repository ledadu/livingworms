import { describe, expect, it } from 'vitest';
import doc from '../../docs/mecaniques.md?raw';
import { rng } from '../engine';
import {
  AHEAD, CALM, FULL, HURRY, MAX_LEN, RUSH, SONG, bondStep, followGoal, friendLight, friendly, homeGoal, leadGoal,
  parseFriendTexts, pickShow, showOver, spotOf, type Moment, type Swimmer
} from './amis';
import { befriend, friendStays, generation, newPartie, parsePartie, placeAncestor, type Partie } from './partie';

/** the bond after `s` seconds of the same moment, weighed four times a second as the game does */
function tie(m: Moment, s: number, from = 0): number {
  let b = from;
  for (let k = 0; k < s * 4; k++) b = bondStep(b, m, 0.25);
  return b;
}
const still: Swimmer = { x: 0, y: 200, vx: 0, vy: 0, len: 40 };

describe('the bond', () => {
  it('ties in about ten seconds beside an animal that came to look at us, while we stay calm', () => {
    const m = { act: 'curieux', d: 150, speed: CALM * 0.5 };
    expect(tie(m, 6)).toBeLessThan(FULL);
    expect(tie(m, 12)).toBeGreaterThanOrEqual(FULL);
  });
  it('ties more slowly over a feast, and more slowly still beside another scene', () => {
    const at = (act: string) => tie({ act, d: 150, speed: 0.5 }, 10);
    expect(at('festin')).toBeLessThan(at('curieux'));
    expect(at('repos')).toBeLessThan(at('festin'));
    expect(at('repos')).toBeGreaterThan(0);
  });
  it('does not tie with an animal going about its life, nor when we swim fast or stay far', () => {
    expect(tie({ act: null, d: 100, speed: 0.5 }, 30)).toBe(0);
    expect(tie({ act: 'curieux', d: 150, speed: CALM + 0.3 }, 30)).toBe(0);
    expect(tie({ act: 'curieux', d: 500, speed: 0.5 }, 30)).toBe(0);
  });
  it('comes undone when we rush at it, and fades far away', () => {
    expect(tie({ act: 'curieux', d: 100, speed: RUSH + 0.3 }, 3, FULL - 1)).toBe(0);
    const far = tie({ act: null, d: 900, speed: 0.5 }, 5, 5);
    expect(far).toBeLessThan(5);
    expect(far).toBeGreaterThan(0);
  });
  it('an answer to our song is a good part of the way', () => {
    expect(SONG).toBeLessThan(FULL);
    expect(SONG * 3).toBeGreaterThanOrEqual(FULL);
  });
});

describe('who may become a friend', () => {
  const fish = { kind: 'swim', gait: 'glide', len: 60, speed: 1.5, partner: false };
  it('a little swimmer of the open water, quick enough to follow', () => {
    expect(friendly(fish)).toBe(true);
  });
  it('not a walker, a bell or a jet, not a partner, not a big or slow one, not one the game holds', () => {
    expect(friendly({ ...fish, kind: 'floor' })).toBe(false);
    expect(friendly({ ...fish, kind: 'parent' })).toBe(false);
    expect(friendly({ ...fish, gait: 'bell' })).toBe(false);
    expect(friendly({ ...fish, gait: 'jet' })).toBe(false);
    expect(friendly({ ...fish, partner: true })).toBe(false);
    expect(friendly({ ...fish, len: MAX_LEN + 1 })).toBe(false);
    expect(friendly({ ...fish, speed: 0.4 })).toBe(false);
  });
});

describe('following', () => {
  it('circles us at a little distance while we stay, further while a scene needs the room', () => {
    for (let t = 0; t < 20; t += 1.3) {
      const p = spotOf(still, t, 1), d = Math.hypot(p.x - still.x, p.y - still.y);
      expect(d).toBeGreaterThan(50);
      expect(d).toBeLessThan(130);
    }
    const a = spotOf(still, 0, 0, true);
    expect(Math.hypot(a.x - still.x, a.y - still.y)).toBeGreaterThan(200);
  });
  it('keeps beside and a little behind us while we swim', () => {
    const s = { ...still, vx: 2.4 }, p = spotOf(s, 3, 1);
    expect(p.x).toBeLessThan(s.x);
    expect(Math.abs(p.y - s.y)).toBeGreaterThan(40);
  });
  it('hurries faster than we swim when it falls behind, and slows down at its spot', () => {
    const behind = followGoal({ x: -HURRY - 300, y: 200 }, { x: -80, y: 200 }, still);
    expect(Math.hypot(behind.x, behind.y)).toBeGreaterThan(2.6);
    const there = followGoal({ x: -80, y: 200 }, { x: -78, y: 200 }, still);
    expect(Math.hypot(there.x, there.y)).toBeLessThan(0.1);
  });
  it('an old friend keeps to its place', () => {
    const home = { x: 1000, y: 300 };
    const back = homeGoal({ x: 1400, y: 300 }, home, 0, 0);
    expect(back.x).toBeLessThan(0);
  });
});

describe('showing', () => {
  it('leads to the nearest trace not seen yet, else to a spot ahead where food will fall', () => {
    const R = rng(3), s = { ...still, vx: 2 };
    const traces = [{ x: 900, y: 600, seen: false }, { x: 300, y: 600, seen: true }, { x: 5000, y: 600, seen: false }];
    const show = pickShow(s, traces, 10, R);
    expect(show.kind).toBe('trace');
    expect(show.to.x).toBe(900);
    const food = pickShow(s, traces.filter((q) => q.x !== 900), 10, R);
    expect(food.kind).toBe('food');
    expect(food.to.x).toBeGreaterThan(s.x + 300);
  });
  it('waits for us, turned our way, when it gets too far ahead', () => {
    const show = { kind: 'food' as const, to: { x: 2000, y: 200 }, t0: 0, done: false };
    const v = leadGoal({ x: AHEAD + 50, y: 200 }, show, still);
    expect(v.x).toBeLessThan(0);
    const go = leadGoal({ x: 100, y: 200 }, show, still);
    expect(go.x).toBeGreaterThan(1);
  });
  it('is over when we reach the spot, or after a while', () => {
    const show = { kind: 'food' as const, to: { x: 400, y: 200 }, t0: 0, done: false };
    expect(showOver(show, still, 5)).toEqual({ over: false, reached: false });
    expect(showOver(show, { x: 350, y: 200 }, 5)).toEqual({ over: true, reached: true });
    expect(showOver(show, still, 60).over).toBe(true);
  });
});

describe('its light', () => {
  it('flashes when it becomes a friend, then breathes faintly near us, and is out far away', () => {
    expect(friendLight(0.4, 100, 0)).toBeGreaterThan(0.8);
    expect(friendLight(10, 100, 0)).toBeLessThan(0.3);
    expect(friendLight(10, 100, 0)).toBeGreaterThan(0);
    expect(friendLight(10, 100, 0, true)).toBeGreaterThan(friendLight(10, 100, 0));
    expect(friendLight(10, 800, 0)).toBe(0);
  });
});

describe('the words', () => {
  it('reads both texts from the design document', () => {
    const t = parseFriendTexts(doc);
    expect(t.ami?.length).toBeGreaterThan(0);
    expect(t.retrouvailles?.length).toBeGreaterThan(0);
  });
  it('reads only the quotes of its own section', () => {
    const md = '## Autre\n\nUn ami :\n\n> Pas celui-ci.\n\n## Les amis qui suivent\n\nUn ami :\n\n> Le bon.\n\nRetrouvailles :\n\n> Encore.\n';
    expect(parseFriendTexts(md)).toEqual({ ami: ['Le bon.'], retrouvailles: ['Encore.'] });
  });
});

describe('the friends in the saved game', () => {
  const withLineage = (n: number): Partie => ({ ...newPartie('recif'), creature: { name: 'x' }, lineage: Array.from({ length: n }, () => ({ creature: { name: 'p' }, chapter: 'nurserie' })) });
  it('one friend per generation, the first one stays', () => {
    let p = befriend(withLineage(1), 'poissonClown');
    expect(p.friends).toEqual([{ id: 'poissonClown', gen: 2 }]);
    expect(befriend(p, 'hippocampe')).toBe(p);
    expect(befriend(p, '')).toBe(p);
    p = befriend({ ...p, lineage: [...p.lineage, p.lineage[0]] }, 'hippocampe');
    expect(p.friends?.map((f) => f.gen)).toEqual([2, 3]);
    expect(generation(p)).toBe(3);
  });
  it('a friend whose generation is over keeps its chapter and its place', () => {
    const p = friendStays(befriend(withLineage(0), 'larve'), 1, 'nurserie', { x: 120, y: 300 });
    expect(p.friends).toEqual([{ id: 'larve', gen: 1, chapter: 'nurserie', at: { x: 120, y: 300 } }]);
    expect(friendStays(p, 1, 'recif', { x: 0, y: 0 })).toBe(p);
  });
  it('is read back, and broken entries are left out', () => {
    const json = JSON.stringify({ ...newPartie('recif'), friends: [{ id: 'larve', gen: 1, chapter: 'nurserie', at: { x: 1, y: 2 } }, { id: 'krill', gen: 2 }, { id: '', gen: 3 }, { gen: 4 }, { id: 'x', gen: 5, at: { x: 'a' } }] });
    expect(parsePartie(json, ['nurserie', 'recif'])?.friends).toEqual([{ id: 'larve', gen: 1, chapter: 'nurserie', at: { x: 1, y: 2 } }, { id: 'krill', gen: 2 }]);
    expect(parsePartie(JSON.stringify(newPartie('recif')), ['recif'])?.friends).toBeUndefined();
  });
});

describe('the parents who swam with their child', () => {
  it('the ancestor keeps the place where it stayed, the others are left as they are', () => {
    const p: Partie = { ...newPartie('recif'), lineage: [{ creature: { name: 'a' }, chapter: 'nurserie', at: { x: 10, y: 20 } }, { creature: { name: 'b' }, chapter: 'recif' }] };
    const q = placeAncestor(p, 1, { x: 400, y: 300 });
    expect(q.lineage[1].at).toEqual({ x: 400, y: 300 });
    expect(q.lineage[0]).toBe(p.lineage[0]);
    expect(placeAncestor(p, 5, { x: 0, y: 0 })).toBe(p);
  });
});
