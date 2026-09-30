import { describe, expect, it } from 'vitest';
import doc from '../../docs/chapitres.md?raw';
import { stats } from '../engine';
import { SPECIES } from '../content/species';
import { TRAITS, traitsOf } from '../content/traits';
import { KEYS } from './obstacles';
import { GLOW_HUE, PARTNERS } from './partenaires';
import { parseChapterTexts, textsOf } from './textes';
import {
  BEFORE, FLARE, KEEP, LEASH, NOTICE, arrivedAt, cousinGoal, cousinHue, cousinLight, hashOf, rivalChoices, rivalLineage
} from './rivale';

const traits = (id: string) => traitsOf(SPECIES[id]());
const noTies = () => 0.5;
const choice = (ours: string[], chapter: string) => rivalChoices(ours, traits, noTies).find((s) => s.chapter === chapter)!;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('the rival lineage of the Carcasse', () => {
  it('went through every chapter before the Carcasse, a partner of each', () => {
    expect(BEFORE).toEqual(['nurserie', 'recif', 'foret', 'grotte']);
    for (const s of rivalChoices([], traits, noTies)) expect(PARTNERS[s.chapter].map((q) => q.id)).toContain(s.partner);
  });

  it('crossed each obstacle the other way: with the trait our body lacks', () => {
    expect(traits(choice(['nageoires'], 'recif').partner)).toContain('pulsation');
    expect(traits(choice(['pulsation'], 'recif').partner)).toContain('nageoires');
    expect(choice(['nageoires'], 'recif').wanted).toEqual(['pulsation']);
    expect(traits(choice(['pinces'], 'foret').partner)).toContain('corpsFin');
    expect(traits(choice(['corpsFin'], 'foret').partner)).toContain('pinces');
    expect(traits(choice(['corpsFin'], 'grotte').partner)).toContain('lanterne');
    expect(choice(['lanterne'], 'grotte').wanted).toEqual(['corpsFin']);
  });

  it('always chose a partner that crosses the obstacle, whatever our body has', () => {
    for (let mask = 0; mask < 1 << TRAITS.length; mask++) {
      const ours = TRAITS.filter((_, i) => mask & (1 << i));
      for (const s of rivalChoices(ours, traits, Math.random)) {
        const keys = KEYS[s.chapter];
        if (keys) expect(traits(s.partner).some((t) => keys.includes(t as never)), `${ours} ${s.chapter}`).toBe(true);
      }
    }
  });

  it('is the same cousin for the same body, and one light enough for a phone', () => {
    const a = rivalLineage(['nageoires', 'pinces', 'corpsFin'], 42), b = rivalLineage(['nageoires', 'pinces', 'corpsFin'], 42);
    expect(JSON.stringify(a.spec)).toBe(JSON.stringify(b.spec));
    expect(a.steps.map((s) => s.chapter)).toEqual(BEFORE);
    for (const seed of [1, 2, 3, 42]) expect(stats(rivalLineage([], seed).spec).chains).toBeLessThanOrEqual(170);
  });

  it('is a distant cousin: something of the first larva in its name, and a body unlike ours', () => {
    const ours = ['nageoires', 'pinces', 'corpsFin'];
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = rivalLineage(ours, seed);
      expect(r.spec.name).toMatch(/^Pr/);
      expect(traitsOf(r.spec).some((t) => !ours.includes(t)), `seed ${seed}`).toBe(true);
    }
  });

  it('comes from the creature of ours that reached the Carcasse, which does not change afterwards', () => {
    const born = (chapter: string, creature: string) => ({ chapter, creature });
    expect(arrivedAt([], 'played')).toBe('played');
    expect(arrivedAt([born('nurserie', 'a'), born('recif', 'b')], 'played')).toBe('played');
    expect(arrivedAt([born('grotte', 'a'), born('carcasse', 'b'), born('sources', 'c')], 'played')).toBe('b');
    // no birth at the Carcasse: the one that gave birth further down went through it
    expect(arrivedAt([born('grotte', 'a'), born('sources', 'c')], 'played')).toBe('c');
    expect(hashOf('Premiphore:lanterne')).toBe(hashOf('Premiphore:lanterne'));
    expect(hashOf('Premiphore:lanterne')).not.toBe(hashOf('Premiphore:cils'));
  });

  it('has its words of the meeting in chapitres.md', () => {
    const c = textsOf(parseChapterTexts(doc), 'La Carcasse', 4)!;
    expect(c.meeting?.length).toBeGreaterThanOrEqual(2);
    expect(c.meeting?.length).toBeLessThanOrEqual(4);
    expect(c.meeting?.[0]).toMatch(/même lumière/);
  });
});

describe('the cousin among the bones', () => {
  const home = { x: 1000, y: 500 };

  it('goes up and down the skeleton when we are away', () => {
    const me = { x: 1600, y: 500 }, v = cousinGoal(me, home, { x: 5000, y: 500 }, 0, 0, 400);
    expect(v.x).toBeLessThan(0);
    expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(0.71);
  });

  it('comes to swim beside us when we come near, never onto us', () => {
    let me = { x: 1300, y: 520 };
    const swimmer = { x: 1000, y: 520 };
    expect(cousinGoal(me, home, swimmer, 0).x).toBeLessThan(0);
    for (let k = 0; k < 600; k++) { const v = cousinGoal(me, home, swimmer, k / 60); me = { x: me.x + v.x, y: me.y + v.y }; }
    expect(dist(me, swimmer)).toBeGreaterThan(KEEP * 0.8);
    expect(dist(me, swimmer)).toBeLessThan(KEEP * 1.5);
    // too close: it moves away
    const v = cousinGoal({ x: 1040, y: 520 }, home, swimmer, 0);
    expect(v.x).toBeGreaterThan(0);
  });

  it('lets us go when we swim too far from its bones', () => {
    const me = { x: home.x + LEASH, y: 500 }, swimmer = { x: home.x + LEASH + 200, y: 500 };
    expect(cousinGoal(me, home, swimmer, 0, 0, 0).x).toBeLessThan(0);
  });

  it('lights up when it notices us, then breathes while we are near', () => {
    expect(cousinLight(NOTICE + 50, -1, 0)).toBe(0);
    expect(cousinLight(NOTICE + 50, 0.4, 0)).toBeGreaterThan(0.4);
    expect(cousinLight(NOTICE + 50, FLARE + 1, 0)).toBe(0);
    const near = cousinLight(KEEP, FLARE + 1, 0);
    expect(near).toBeGreaterThan(0.1);
    expect(near).toBeLessThan(0.4);
  });

  it('never glows in the gold of the partners', () => {
    for (let h = 0; h < 360; h += 5) {
      const off = Math.abs(((cousinHue(h) - GLOW_HUE + 540) % 360) - 180);
      expect(off, `hue ${h}`).toBeGreaterThanOrEqual(35);
    }
    expect(cousinHue(200)).toBe(200);
  });
});
