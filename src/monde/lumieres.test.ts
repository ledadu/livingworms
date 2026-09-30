import { describe, expect, it } from 'vitest';
import doc from '../../docs/chapitres.md?raw';
import { stats } from '../engine';
import { SPECIES, firstAncestor } from '../content/species';
import { traitsOf } from '../content/traits';
import { crosses } from './obstacles';
import { PARTNERS } from './partenaires';
import { parseChapterTexts, textsOf } from './textes';
import {
  DELAY, DESCENT, ECHO, FAR, GAP, RING, SETTLED, answerAt, farAlong, roomAlong, answerGlow, answerGoal, answerLight, answered, dirOf,
  otherAncestor, parseAnswerText, partnerIn, ringOf, seedOf, spotOf, startWalk, walkStep, walked
} from './lumieres';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('the notes of the descent', () => {
  it('one per chapter of the descent, the Remontée has none', () => {
    expect(DESCENT).toEqual(['nurserie', 'recif', 'foret', 'grotte', 'carcasse', 'sources', 'glacier', 'jardin', 'fosse']);
  });
});

describe('the ancestors of the other lineages', () => {
  it('a first larva of another colour answers the note of the Nurserie', () => {
    const w = otherAncestor('nurserie', 11);
    expect(w.partners).toEqual([]);
    expect(w.spec.body.shape).toBe(firstAncestor().body.shape);
    expect(w.spec.palette.hue).not.toBe(firstAncestor().palette.hue);
  });

  it('came down with a partner of each chapter on its way, one that crosses its obstacle', () => {
    const w = otherAncestor('glacier', 5);
    expect(w.partners).toHaveLength(DESCENT.indexOf('glacier'));
    w.partners.forEach((id, i) => {
      const c = DESCENT[i];
      expect(PARTNERS[c].map((q) => q.id)).toContain(id);
      expect(crosses(c, traitsOf(SPECIES[id]()))).toBe(true);
    });
  });

  it('is the generation that learned the note: it crosses every obstacle before it', () => {
    const w = otherAncestor('jardin', 3), tr = traitsOf(w.spec);
    // it crossed the Glacier, the last obstacle before the Jardin
    expect(crosses('glacier', tr)).toBe(true);
  });

  it('light enough for a phone', () => {
    for (const note of ['sources', 'fosse'] as const) expect(stats(otherAncestor(note, 17).spec).chains).toBeLessThanOrEqual(170);
  });

  it('the same game, the same ancestors; another note, another lineage', () => {
    const a = otherAncestor('grotte', seedOf('grotte', 42)), b = otherAncestor('grotte', seedOf('grotte', 42));
    expect(JSON.stringify(a.spec)).toBe(JSON.stringify(b.spec));
    expect(seedOf('grotte', 42)).not.toBe(seedOf('foret', 42));
    expect(seedOf('grotte', 42)).not.toBe(seedOf('grotte', 43));
  });

  it('comes down one birth at a time, so that the game spreads them over its steps', () => {
    const w = startWalk('grotte', 9);
    let n = 0;
    while (!walked(w)) { walkStep(w); n++; }
    expect(n).toBe(3);
    walkStep(w);
    expect(w.at).toBe(3);
    expect(JSON.stringify(w.spec)).toBe(JSON.stringify(otherAncestor('grotte', 9).spec));
  });

  it('chooses a partner that brings a key of the obstacle, anyone where there is none', () => {
    for (let i = 0; i < 20; i++) {
      const R = () => i / 20;
      expect(['poissonClown', 'poissonLion', 'hippocampe', 'meduseBoite']).toContain(partnerIn('recif', R));
      expect(['homard', 'dragonFeuillu']).toContain(partnerIn('foret', R));
      expect(['plumeau', 'crabe']).toContain(partnerIn('carcasse', R));
    }
  });
});

describe('the answers, one by one', () => {
  it('an answer comes after a silence, and never right on the one before', () => {
    expect(answerAt(10, -99)).toBe(10 + DELAY);
    expect(answerAt(10, 10 + DELAY)).toBe(10 + DELAY + GAP);
    // notes sung quickly: the answers still come one by one
    let last = -99;
    const starts = [0, 0.2, 0.4].map((t) => (last = answerAt(t, last)));
    expect(starts[1] - starts[0]).toBeCloseTo(GAP);
    expect(starts[2] - starts[1]).toBeCloseTo(GAP);
  });

  it('they come from above and from the sides, never from below, each from its own direction', () => {
    const dirs = Array.from({ length: 9 }, (_, k) => dirOf(k));
    for (const d of dirs) { expect(d.y).toBeLessThan(0.2); expect(Math.hypot(d.x, d.y)).toBeCloseTo(1); }
    for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) expect(dist(dirs[i], dirs[j])).toBeGreaterThan(0.3);
  });

  it('far away, but on the screen: less far on the sides of a phone held upright', () => {
    // a wide screen, the swimmer in its middle, one css px per world px
    expect(roomAlong(640, 400, { x: 1, y: 0 }, 1280, 800, 1)).toBe(640);
    expect(roomAlong(640, 400, { x: 0, y: -1 }, 1280, 800, 1)).toBe(400);
    expect(roomAlong(640, 400, { x: 0, y: -1 }, 1280, 800, 2)).toBe(200);
    expect(farAlong(roomAlong(640, 400, { x: 1, y: 0 }, 1280, 800, 1))).toBe(FAR);
    // a phone: the sides are near, the answer still comes from beyond its place beside us
    const side = farAlong(roomAlong(200, 430, { x: -1, y: 0 }, 400, 860, 1)), up = farAlong(roomAlong(200, 430, { x: 0, y: -1 }, 400, 860, 1));
    expect(side).toBeLessThan(up);
    expect(side).toBeGreaterThan(RING + 100);
  });

  it('far away, it flashes three times, then shines steadily', () => {
    expect(answerLight(-0.5, 0)).toBe(0);
    const at = (s: number) => answerLight(s, 0);
    expect(at(0.08)).toBeGreaterThan(0.5);
    expect(at(0.5)).toBeLessThan(at(0.88));
    expect(at(1.68)).toBeGreaterThan(0.5);
    expect(at(6)).toBeGreaterThan(0.3);
    expect(at(6)).toBeLessThan(0.6);
  });

  it('a note sung again, and the crossing of the dark, make it flash again', () => {
    expect(answerLight(10, 0, 0, 0.1)).toBeGreaterThan(answerLight(10, 0) + 0.3);
    expect(answerLight(10, 0, 0, -1, 0.1)).toBeGreaterThan(answerLight(10, 0) + 0.5);
    // the bloom runs along them
    expect(answerLight(10, 0, 4, -1, 0.1)).toBeLessThan(answerLight(10, 0, 0, -1, 0.1));
  });

  it('stays far away while it answers, then comes to its place beside us and keeps it', () => {
    const swimmer = { x: 0, y: 0 }, far = { x: dirOf(2).x * FAR, y: dirOf(2).y * FAR };
    const still = answerGoal(far, far, spotOf(2, swimmer, 0), swimmer, 0.5);
    expect(Math.hypot(still.x, still.y)).toBeLessThan(0.1);
    let me = { ...far };
    for (let i = 0; i < 1200; i++) {
      const v = answerGoal(me, far, spotOf(2, swimmer, i / 60), swimmer, ECHO + i / 60);
      me = { x: me.x + v.x, y: me.y + v.y };
    }
    expect(dist(me, spotOf(2, swimmer, 1200 / 60))).toBeLessThan(SETTLED);
    expect(dist(me, swimmer)).toBeGreaterThan(RING - 40);
  });

  it('never swims onto us', () => {
    const v = answerGoal({ x: 30, y: 0 }, { x: 500, y: 0 }, { x: -170, y: 0 }, { x: 0, y: 0 }, 10);
    expect(v.x).toBeGreaterThan(0);
  });

  it('their places around us are apart', () => {
    const s = { x: 0, y: 0 }, spots = Array.from({ length: 9 }, (_, k) => spotOf(k, s, 0));
    for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) expect(dist(spots[i], spots[j])).toBeGreaterThan(60);
    expect(ringOf(0)).toBe(RING);
  });

  it('each one near us adds to our light; far away, nothing', () => {
    expect(answerGlow(FAR + 10)).toBe(0);
    expect(answerGlow(RING)).toBeGreaterThan(40);
    expect(answerGlow(300)).toBeGreaterThan(answerGlow(450));
  });

  it('the song crosses the dark once every note learned has had its answer beside us', () => {
    expect(answered([], new Set())).toBe(false);
    expect(answered(['nurserie', 'recif'], new Set(['nurserie']))).toBe(false);
    expect(answered(['nurserie', 'recif'], new Set(['recif', 'nurserie', 'foret']))).toBe(true);
  });
});

describe('the words', () => {
  it('the lineage speaks once every note has had its answer, from the design document', () => {
    const lines = parseAnswerText(doc);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(lines.join(' ')).toMatch(/répondu/);
  });

  it('those words are no other text of the Fosse', () => {
    const fosse = textsOf(parseChapterTexts(doc), 'La Fosse', 8)!;
    const words = parseAnswerText(doc).join(' ');
    for (const k of ['opening', 'obstacle', 'farewell'] as const) expect(fosse[k]?.join(' ')).not.toBe(words);
  });

  it('only under La Fosse', () => {
    expect(parseAnswerText('## 8. Le Jardin\n\nLes lumières qui répondent :\n\n> Non.\n')).toEqual([]);
    expect(parseAnswerText('## 9. La Fosse\n\nLes lumières qui répondent (plus tard) :\n\n> Oui. Encore.\n\n## 10. Fin\n')).toEqual(['Oui.', 'Encore.']);
  });
});
