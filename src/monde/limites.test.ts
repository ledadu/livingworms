import { describe, expect, it } from 'vitest';
import { BIOMES, X1, biomeIndex, chapterIndex, presence, span } from './biomes';
import { GATES, SOFT, WORLD_END, WORLD_START, holdBack, newLimits, pass, reach, travel, travelShown } from './limites';

describe('the ends of the world', () => {
  it('starts in the Nurserie and ends at the bottom of the Fosse, out of the light of the Remontée', () => {
    expect(biomeIndex(WORLD_START)).toBe(chapterIndex('nurserie'));
    expect(biomeIndex(WORLD_END)).toBe(chapterIndex('fosse'));
    expect(presence(WORLD_END, chapterIndex('remontee'))).toBe(0);
    expect(reach(newLimits())).toEqual([WORLD_START, WORLD_END]);
  });

  it('has one obstacle at the end of each chapter that has one, in the order of the descent', () => {
    expect(GATES.map((g) => g.chapter)).toEqual(['recif', 'foret', 'grotte', 'sources', 'glacier', 'jardin', 'fosse']);
    for (const g of GATES) expect(g.x).toBe(Math.min(span(g.chapter)[1], WORLD_END));
    for (let i = 1; i < GATES.length; i++) expect(GATES[i].x).toBeGreaterThan(GATES[i - 1].x);
  });

  it('stops the swimmer at the first obstacle it may not cross, and not at the ones it has crossed', () => {
    const l = newLimits(), closed = (c: string) => c !== 'foret' && c !== 'sources';
    const forest = GATES.find((g) => g.chapter === 'foret')!.x;
    expect(reach(l, closed)).toEqual([WORLD_START, forest]);
    pass(l, forest + 10);
    expect(l.crossed.has('recif') && l.crossed.has('foret')).toBe(true);
    expect(reach(l, closed)[1]).toBe(GATES.find((g) => g.chapter === 'sources')!.x);
    // the bottom of the world is never gone past by swimming
    pass(l, WORLD_END + 100);
    expect(l.crossed.has('fosse')).toBe(false);
  });

  it('opens the whole map to the travel of the tests past the end', () => {
    const l = newLimits();
    travel(l, BIOMES[chapterIndex('glacier')].x0 + 100);
    expect([...l.crossed]).toEqual(['recif', 'foret', 'grotte', 'sources']);
    expect(l.beyond).toBe(false);
    travel(l, BIOMES[chapterIndex('remontee')].x0 + 100);
    expect(l.beyond).toBe(true);
    expect(reach(l)).toEqual([WORLD_START, X1 - 200]);
  });

  it('holds the swimmer back near a border, gently, and lets it swim away', () => {
    const b: [number, number] = [0, 10000];
    expect(holdBack(5000, 2.6, b)).toBe(2.6);
    expect(holdBack(10000 - SOFT / 2, 2.6, b)).toBeLessThan(2.6);
    expect(holdBack(10000, 2.6, b)).toBeLessThan(0);
    expect(holdBack(10000 - SOFT / 2, -2.6, b)).toBeLessThan(-2.6);
    expect(holdBack(0, -2.6, b)).toBeGreaterThan(0);
  });

  it('shows the travel of the settings panel with ?dev only', () => {
    expect(travelShown('')).toBe(false);
    expect(travelShown('?lod=0')).toBe(false);
    expect(travelShown('?dev')).toBe(true);
  });
});
