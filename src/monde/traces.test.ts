import { describe, expect, it } from 'vitest';
import doc from '../../docs/chapitres.md?raw';
import { BIOMES, chapterIndex, span, type ChapterId } from './biomes';
import { FOSSE_BOTTOM, GATES, SOFT } from './limites';
import { MAX_LINES } from './textes';
import { BELOW, KINDS, parseTraceTexts, placeBelow, traceKind, tracesOf, worldPlaces, type Place } from './traces';

const places = worldPlaces();
const at = (id: ChapterId) => places.findIndex((p) => p.id === id);
/** one birth in each chapter, from the Nurserie down to the given one */
const lineage = (to: ChapterId) => BIOMES.slice(0, chapterIndex(to) + 1).map((b) => ({ chapter: b.id }));

describe('les traces de la lignée', () => {
  it('lies in the chapters one can swim to, down to the Fosse, before their obstacle', () => {
    expect(places.map((p) => p.id)).toEqual(BIOMES.filter((b) => b.x0 < FOSSE_BOTTOM).map((b) => b.id));
    expect(places[places.length - 1].id).toBe('fosse');
    for (const p of places) {
      const [a, b] = span(p.id), gate = GATES.find((g) => g.chapter === p.id);
      expect(p.x0, p.id).toBeGreaterThan(a);
      expect(p.x1, p.id).toBeLessThan(Math.min(b, gate ? gate.x - SOFT : b, FOSSE_BOTTOM - SOFT));
      expect(p.x1 - p.x0, p.id).toBeGreaterThan(600);
    }
    expect(places[at('jardin')].floor).toBe(false);
    expect(places.filter((p) => !p.floor).map((p) => p.id)).toEqual(['jardin']);
  });

  it('lies two chapters below the one where the ancestor gave birth, never in its own', () => {
    expect(placeBelow(places, at('nurserie'))).toBe(at('nurserie') + BELOW);
    expect(placeBelow(places, at('recif'))).toBe(at('grotte'));
    expect(placeBelow(places, at('grotte'))).toBe(at('sources'));
    for (let i = 0; i < places.length; i++) {
      const k = placeBelow(places, i);
      if (k >= 0) expect(k).toBeGreaterThan(i);
    }
    // nothing lies below the bottom of the Fosse
    expect(placeBelow(places, at('fosse'))).toBe(-1);
    expect(placeBelow(places, -1)).toBe(-1);
  });

  it('falls through the Jardin, which has no floor, down to the Fosse', () => {
    expect(placeBelow(places, at('sources'))).toBe(at('fosse'));
    expect(placeBelow(places, at('glacier'))).toBe(at('fosse'));
    expect(placeBelow(places, at('jardin'))).toBe(at('fosse'));
    for (const t of tracesOf(lineage('fosse'), places)) expect(t.chapter).not.toBe('jardin');
  });

  it('gives nothing before the first birth, one trace per ancestor after', () => {
    expect(tracesOf([], places)).toEqual([]);
    const all = tracesOf(lineage('glacier'), places);
    expect(all.map((t) => t.gen)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // the first trace is met in the Forêt, the first lineage's eggs
    expect(all[0]).toMatchObject({ gen: 0, kind: 'oeufs', chapter: 'foret' });
    // an ancestor from an unknown chapter (an old save) leaves none
    expect(tracesOf([{ chapter: 'ailleurs' }], places)).toEqual([]);
  });

  it('takes turns: eggs, a moult, a reef, so that three generations show all three', () => {
    expect(KINDS.map((_, i) => traceKind(i))).toEqual(['oeufs', 'mue', 'recif']);
    expect(traceKind(3)).toBe('oeufs');
    const kinds = tracesOf(lineage('foret'), places).map((t) => t.kind);
    expect(new Set(kinds)).toEqual(new Set(KINDS));
    // the body of the third generation rests at the Carcasse, by the whale
    expect(tracesOf(lineage('foret'), places)[2]).toMatchObject({ kind: 'recif', chapter: 'carcasse' });
  });

  it('puts each trace in its chapter, just behind the swimming plane, apart from the others', () => {
    const all = tracesOf(lineage('fosse').concat(lineage('fosse')), places);
    for (const t of all) {
      const p = places.find((q) => q.id === t.chapter)!;
      expect(t.x, `${t.gen}`).toBeGreaterThanOrEqual(p.x0 - 1);
      expect(t.x, `${t.gen}`).toBeLessThanOrEqual(p.x1 + 1);
      // in front of the bones of the Carcasse (its nearest lie at 26)
      expect(t.z).toBeGreaterThan(5);
      expect(t.z).toBeLessThan(25);
    }
    for (const a of all) for (const b of all) if (a !== b && a.chapter === b.chapter) expect(Math.abs(a.x - b.x)).toBeGreaterThan(40);
  });

  it('keeps a trace where it was when the lineage grows', () => {
    const before = tracesOf(lineage('grotte'), places), after = tracesOf(lineage('fosse'), places);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(JSON.stringify(tracesOf(lineage('fosse'), places))).toBe(JSON.stringify(after));
  });

  it('keeps each trace where it was when an ancestor is renamed, or saved with its partner and its place', () => {
    const plain = lineage('glacier');
    const full = plain.map((a, i) => ({ ...a, creature: { name: i === 1 ? 'Nommée' : 'x' }, partner: { id: 'crabe', name: 'Crabe' }, at: { x: 400, y: 300 } }));
    expect(tracesOf(full, places)).toEqual(tracesOf(plain, places));
  });

  it('moves along a little where a relief stands', () => {
    const one: Place[] = [{ id: 'nurserie', x0: 0, x1: 1000, floor: true }, { id: 'recif', x0: 1000, x1: 2000, floor: true }, { id: 'foret', x0: 2000, x1: 3000, floor: true }];
    const [plain] = tracesOf([{ chapter: 'nurserie' }], one);
    const [moved] = tracesOf([{ chapter: 'nurserie' }], one, (x) => Math.abs(x - plain.x) > 100);
    expect(plain.x).toBe(2450);
    expect(Math.abs(moved.x - plain.x)).toBeGreaterThan(100);
    expect(Math.abs(moved.x - plain.x)).toBeLessThan(400);
  });
});

describe('les mots devant les traces', () => {
  const texts = parseTraceTexts(doc);

  it('reads a text for every kind in chapitres.md, in two to four lines', () => {
    for (const k of KINDS) {
      expect(texts[k]?.length, k).toBeGreaterThanOrEqual(2);
      expect(texts[k]!.length, k).toBeLessThanOrEqual(MAX_LINES);
    }
    expect(texts.oeufs?.[0]).toMatch(/^Des œufs, les tiens/);
    expect(texts.recif?.[texts.recif.length - 1]).toBe('Rien de nous ne se perd.');
  });

  it('reads only its own section', () => {
    const md = '## 1. La Nurserie\n\nLa mue :\n\n> Pas celle-ci.\n\n## Les traces de la lignée\n\nLa mue :\n\n> Une. Deux.\n\n## Dans le monde\n\nLes œufs non éclos :\n\n> Non plus.\n';
    expect(parseTraceTexts(md)).toEqual({ mue: ['Une.', 'Deux.'] });
  });
});
