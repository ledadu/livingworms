import { describe, expect, it } from 'vitest';
import doc from '../../docs/chapitres.md?raw';
import { SPECIES, firstAncestor } from '../content/species';
import { traitsOf } from '../content/traits';
import { BIOMES, type ChapterId } from './biomes';
import { GUIDE_FAR, GUIDE_NEAR, MOTE_SPEED, SAMPLE, awake, bestPartners, bodyKeys, broodCrosses, moteVelocity, rightPartners, target } from './indices';
import { PARTNERS } from './partenaires';
import { OBSTACLE, crosses } from './obstacles';
import { MAX_LINES, parseChapterTexts, textsOf } from './textes';

const traits = (id: string) => traitsOf(SPECIES[id]());
const withObstacle = Object.keys(OBSTACLE) as ChapterId[];

describe('the right partners', () => {
  it('are, in every chapter with an obstacle, at least one, and each crosses it', () => {
    for (const c of withObstacle) {
      const right = rightPartners(c, traits);
      expect(right.length, c).toBeGreaterThan(0);
      for (const id of right) expect(crosses(c, traits(id)), `${c}: ${id}`).toBe(true);
    }
  });

  it('leave out the partners that would not help', () => {
    expect(rightPartners('foret', traits)).toEqual(['dragonFeuillu', 'homard']);
    expect(rightPartners('glacier', traits)).not.toContain('clione');
    expect(rightPartners('fosse', traits)).not.toContain('nautile');
  });

  it('are none where there is no obstacle, and the song is no body trait', () => {
    expect(bodyKeys('nurserie')).toEqual([]);
    expect(rightPartners('carcasse', traits)).toEqual([]);
    expect(bodyKeys('fosse')).toEqual(['lanterne']);
  });
});

describe('the partners rated by their broods', () => {
  const larva = firstAncestor();
  const rate = (c: ChapterId, id: string) => SAMPLE.filter((s) => broodCrosses(larva, SPECIES[id](), c, s)).length / SAMPLE.length;

  it('know that a trait of the trunk is not always handed down: the eel is thin, its children with the larva are not', () => {
    expect(traits('anguille')).toContain('corpsFin');
    expect(rate('grotte', 'anguille')).toBe(0);
    expect(rate('grotte', 'serpentCilie')).toBeGreaterThanOrEqual(0.5);
  });

  it('leave, in every chapter with an obstacle, someone whose broods cross it: the descent never gets stuck', () => {
    for (const c of withObstacle) expect(Math.max(...PARTNERS[c].map((q) => rate(c, q.id))), c).toBeGreaterThanOrEqual(0.5);
  });

  it('lead to those whose broods mostly cross, else to any that did, else to those with the trait', () => {
    expect(bestPartners(new Map([['a', 1], ['b', 0.25], ['c', 0]]), ['c'])).toEqual(['a']);
    expect(bestPartners(new Map([['a', 0], ['b', 0.25]]), ['a'])).toEqual(['b']);
    expect(bestPartners(new Map([['a', 0]]), ['a'])).toEqual(['a']);
  });
});

describe('the thread of lights', () => {
  const me = { x: 0, y: 0 };

  it('leads to the nearest right partner along the way', () => {
    expect(target(me, [{ x: 2000, y: 50 }, { x: -900, y: 0 }], null)).toEqual({ x: -900, y: 0 });
  });

  it('leads to our eggs first, when they call', () => {
    expect(target(me, [{ x: -900, y: 0 }], { x: 1200, y: 0 })).toEqual({ x: 1200, y: 0, eggs: true });
  });

  it('stops once the one we are led to is near enough to be seen, and leads nowhere without anyone', () => {
    expect(target(me, [{ x: GUIDE_NEAR - 50, y: 0 }], null)).toBeNull();
    expect(target(me, [{ x: GUIDE_FAR + 100, y: 0 }], null)).toBeNull();
    expect(target(me, [], null)).toBeNull();
  });

  it('wakes only once the obstacle has held us back, and while we cannot cross it', () => {
    expect(awake(false, false, ['nageoires'])).toBe(false);
    expect(awake(true, false, ['nageoires'])).toBe(true);
    expect(awake(true, true, ['nageoires'])).toBe(false);
    expect(awake(true, false, [])).toBe(false);
  });

  it('flies its lights toward where it leads, swaying, no faster than we swim', () => {
    for (let age = 0; age < 2.4; age += 0.3) {
      const v = moteVelocity(me, { x: 1000, y: 0 }, age, 1);
      expect(v.x).toBeGreaterThan(0);
      expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(Math.hypot(MOTE_SPEED, 0.8) + 1e-9);
    }
  });
});

describe('the words of the hints', () => {
  const all = parseChapterTexts(doc);

  it('are in chapitres.md for every chapter with an obstacle, two to four lines', () => {
    for (const c of withObstacle) {
      const i = BIOMES.findIndex((b) => b.id === c), lines = textsOf(all, BIOMES[i].name, i)?.hint;
      expect(lines?.length, c).toBeGreaterThanOrEqual(2);
      expect(lines!.length, c).toBeLessThanOrEqual(MAX_LINES);
    }
  });

  it('name a partner that would help', () => {
    for (const c of withObstacle) {
      const i = BIOMES.findIndex((b) => b.id === c), text = textsOf(all, BIOMES[i].name, i)!.hint!.join(' ').toLowerCase();
      const names = rightPartners(c, traits).map((id) => SPECIES[id]().name.toLowerCase());
      // « Les poissons du récif » stands for the clownfish, the lionfish and the seahorse
      expect(names.some((n) => text.includes(n) || text.includes(n.split(' ')[0])) || text.includes('poissons'), c).toBe(true);
    }
  });
});
