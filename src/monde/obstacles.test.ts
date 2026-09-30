import { describe, expect, it } from 'vitest';
import doc from '../../docs/chapitres.md?raw';
import { SPECIES, firstAncestor } from '../content/species';
import { BIOMES, type ChapterId } from './biomes';
import { OBSTACLES } from './limites';
import { KEYS, OBSTACLE, crossWith, crosses, feel, keyOf } from './obstacles';
import { traitsOf } from './obstacles-traits';
import { MAX_LINES, parseChapterTexts, textsOf } from './textes';

/** the overview table of chapitres.md: chapter name → the traits of its obstacle */
function overview(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const line of doc.split('\n')) {
    const c = line.split('|').map((s) => s.trim());
    if (c.length < 7 || !/^\d+$/.test(c[1])) continue;
    const name = c[2].replace(/\*.*\*/, '').trim(), keys = c[5] === '—' ? [] : c[5].split(',').map((s) => s.trim());
    if (!out.has(name)) out.set(name, keys);
  }
  return out;
}
const ID: Record<string, string> = { 'corps fin': 'corpsFin' };

describe('the key obstacles', () => {
  it('has one obstacle for each chapter that bars the way, each crossed by at least two traits', () => {
    expect(Object.keys(OBSTACLE).sort()).toEqual([...OBSTACLES].sort());
    for (const c of OBSTACLES) {
      expect(new Set(OBSTACLE[c]!.keys).size, c).toBeGreaterThanOrEqual(2);
      expect(KEYS[c]).toEqual(OBSTACLE[c]!.keys);
    }
  });

  it('follows the overview of chapitres.md', () => {
    const table = overview();
    for (const c of OBSTACLES) {
      const name = BIOMES.find((b) => b.id === c)!.name;
      expect((table.get(name) ?? []).map((k) => ID[k] ?? k), name).toEqual(OBSTACLE[c]!.keys);
    }
  });

  it('has the words the lineage says in front of each obstacle, in chapitres.md', () => {
    const all = parseChapterTexts(doc);
    for (const c of OBSTACLES) {
      const i = BIOMES.findIndex((b) => b.id === c), lines = textsOf(all, BIOMES[i].name, i)?.obstacle;
      expect(lines?.length, c).toBeGreaterThanOrEqual(2);
      expect(lines!.length).toBeLessThanOrEqual(MAX_LINES);
    }
  });

  it('lets through a body that has one of the keys, and nobody else', () => {
    expect(crosses('recif', ['nageoires'])).toBe(true);
    expect(crosses('recif', ['pulsation', 'cils'])).toBe(true);
    expect(crosses('recif', ['pinces', 'carapace'])).toBe(false);
    expect(crosses('nurserie', [])).toBe(true);
    const can = crossWith(['carapace']);
    expect((['recif', 'foret', 'grotte', 'sources', 'glacier', 'jardin', 'fosse'] as ChapterId[]).filter(can)).toEqual(['sources', 'glacier']);
    expect(keyOf('foret', ['nageoires', 'corpsFin'])).toBe('corpsFin');
    expect(keyOf('foret', ['nageoires'])).toBe(null);
  });

  it('bars the larva of the start, and the partners of the chapters open the way', () => {
    expect(traitsOf(firstAncestor())).toEqual([]);
    expect(crosses('recif', traitsOf(SPECIES.poissonClown()))).toBe(true);
    expect(crosses('foret', traitsOf(SPECIES.homard()))).toBe(true);
    expect(crosses('grotte', traitsOf(SPECIES.anguille()))).toBe(true);
    expect(crosses('sources', traitsOf(SPECIES.crevetteMante()))).toBe(true);
    expect(crosses('glacier', traitsOf(SPECIES.chrysaora()))).toBe(true);
    expect(crosses('jardin', traitsOf(SPECIES.meduse()))).toBe(true);
    expect(crosses('fosse', traitsOf(SPECIES.baudroie()))).toBe(true);
  });
});

describe('how an obstacle holds the swimmer back, without harm', () => {
  const at = (c: ChapterId, u: number) => 10000 - OBSTACLE[c]!.soft * (1 - u);
  const swim = (c: ChapterId, u: number, open: boolean, dvy = 0) => feel(OBSTACLE[c]!, 10000, at(c, u), 2.6, dvy, open);

  it('does nothing out of its reach', () => {
    expect(feel(OBSTACLE.recif!, 10000, 10000 - 2000, 2.6, 1, false)).toEqual([2.6, 1]);
  });

  it('carries back, slows down or turns back a swimmer without the key, more the closer it gets', () => {
    for (const c of OBSTACLES) {
      expect(swim(c, 0.3, false)[0], c).toBeLessThan(2.6);
      expect(swim(c, 0.9, false)[0], c).toBeLessThan(swim(c, 0.3, false)[0]);
    }
    // at the obstacle, the current and the dark turn back even full swimming
    for (const c of ['recif', 'sources', 'jardin', 'grotte', 'fosse'] as ChapterId[]) expect(swim(c, 1, false)[0], c).toBeLessThan(0);
    // the thick water slows every stroke, up and down too
    expect(Math.abs(swim('glacier', 0.8, false, 2)[1])).toBeLessThan(1.2);
  });

  it('is only felt with a key: the swimmer goes on forward', () => {
    for (const c of OBSTACLES) expect(swim(c, 1, true)[0], c).toBeGreaterThan(1.5);
  });
});
