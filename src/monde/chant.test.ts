import { describe, expect, it } from 'vitest';
import doc from '../../docs/chapitres.md?raw';
import { BIOMES } from './biomes';
import { GAP, MAX_NOTES, NOTES, NOTE_CHAPTERS, answersTo, extend, learnedNotes, noteOf, notesOfGeneration, parseNoteNames, ringSpots, spotsAlong, wordsOf, type Listener } from './chant';

const ORDER = BIOMES.map((b) => b.id);

describe('the notes of the song', () => {
  it('has one note per chapter of the descent, nine, in the order of the map', () => {
    expect(NOTES).toHaveLength(9);
    expect(NOTE_CHAPTERS).toEqual(ORDER.slice(0, 9));
    expect(noteOf('remontee')).toBeUndefined();
  });

  it('reads their names in chapitres.md', () => {
    const names = parseNoteNames(doc);
    expect(names.get(1)).toBe('l’éclat');
    expect(names.get(4)).toBe('l’écho');
    expect(names.get(9)).toBe('le silence');
    expect(NOTES.map((n) => n.name)).toEqual(['l’éclat', 'le battement', 'le frôlement', 'l’écho', 'le souvenir', 'la braise', 'le givre', 'la pulsation', 'le silence']);
  });

  it('goes down in pitch as the chapters go down, each with its own colour and shape', () => {
    for (let i = 1; i < NOTES.length; i++) expect(NOTES[i].freq).toBeLessThan(NOTES[i - 1].freq);
    expect(new Set(NOTES.map((n) => n.glyph)).size).toBe(9);
    expect(new Set(NOTES.map((n) => n.hue)).size).toBe(9);
  });

  it('says the notes of a generation in words', () => {
    expect(wordsOf(['l’éclat'])).toBe('l’éclat');
    expect(wordsOf(['l’éclat', 'le battement'])).toBe('l’éclat et le battement');
    expect(wordsOf(['a', 'b', 'c'])).toBe('a, b et c');
    expect(wordsOf([])).toBe('');
  });
});

describe('learning the notes', () => {
  it('knows the notes learned, in the order of the descent', () => {
    expect(learnedNotes({ chapter: 'nurserie', notes: [] }, ORDER)).toEqual([]);
    expect(learnedNotes({ chapter: 'grotte', notes: [{ chapter: 'grotte' }, { chapter: 'nurserie' }, { chapter: 'recif' }, { chapter: 'foret' }] }, ORDER))
      .toEqual(['nurserie', 'recif', 'foret', 'grotte']);
  });

  it('gives a game saved before the song the notes of the chapters it went through', () => {
    expect(learnedNotes({ chapter: 'foret' }, ORDER)).toEqual(['nurserie', 'recif']);
    expect(learnedNotes({ chapter: 'foret', notes: [{ chapter: 'foret', gen: 3 }] }, ORDER)).toEqual(['nurserie', 'recif', 'foret']);
    expect(learnedNotes({ chapter: 'remontee' }, ORDER)).toHaveLength(9);
  });

  it('says which notes each generation learned', () => {
    const p = { notes: [{ chapter: 'nurserie', gen: 1 }, { chapter: 'recif', gen: 2 }, { chapter: 'foret', gen: 2 }, { chapter: 'grotte' }] };
    expect(notesOfGeneration(p, 1)).toEqual(['l’éclat']);
    expect(notesOfGeneration(p, 2)).toEqual(['le battement', 'le frôlement']);
    expect(notesOfGeneration(p, 3)).toEqual([]);
    expect(notesOfGeneration({}, 1)).toEqual([]);
  });
});

describe('tracing the song on the circle', () => {
  const spots = ringSpots(200, 200, 100);

  it('places the notes clockwise from the top', () => {
    expect(spots).toHaveLength(9);
    expect(spots[0].x).toBeCloseTo(200);
    expect(spots[0].y).toBeCloseTo(100);
    expect(spots[2].x).toBeGreaterThan(200);
    expect(spots[7].x).toBeLessThan(200);
  });

  it('finds the notes a finger goes through, in order, even between two of its moves', () => {
    expect(spotsAlong(spots, spots[1].x, spots[1].y, spots[1].x + 1, spots[1].y, 20)).toEqual([1]);
    expect(spotsAlong(spots, 200, 200, 210, 210, 20)).toEqual([]);
    // from note 0 straight across to note 5 or so: 0 first, then what lies on the way
    const way = spotsAlong(spots, spots[0].x, spots[0].y - 5, spots[1].x + 3, spots[1].y + 1, 20);
    expect(way).toEqual([0, 1]);
    expect(spotsAlong(spots, spots[1].x, spots[1].y, spots[0].x, spots[0].y, 20)).toEqual([1, 0]);
  });

  it('goes on only with notes learned, never twice in a row, and not forever', () => {
    const known = (i: number) => i !== 4, song: number[] = [];
    expect(extend(song, 0, known)).toBe(true);
    expect(extend(song, 0, known)).toBe(false);
    expect(extend(song, 4, known)).toBe(false);
    expect(extend(song, 1, known)).toBe(true);
    expect(extend(song, 0, known)).toBe(true);
    expect(song).toEqual([0, 1, 0]);
    while (song.length < MAX_NOTES) extend(song, song.length % 2 ? 2 : 3, known);
    expect(extend(song, 5, known)).toBe(false);
    expect(song).toHaveLength(MAX_NOTES);
  });
});

describe('the animals that answer', () => {
  const at = (x: number, chapter: number, glows = false, z = 0): Listener => ({ x, y: 0, z, chapter, glows });

  it('answers the note of its own chapter, when that note reaches it', () => {
    const a = answersTo([0, 1], { x: 0, y: 0 }, [at(200, 1), at(300, 2), at(100, 0)]);
    expect(a.map((x) => x.who)).toEqual([2, 0]);
    expect(a[0].k).toBe(0);
    expect(a[1].k).toBe(1);
    expect(a[1].at).toBeGreaterThan(GAP);
  });

  it('lets what shines answer any song, from its first note', () => {
    expect(answersTo([3], { x: 0, y: 0 }, [at(200, 8, true), at(150, 8)])).toEqual([expect.objectContaining({ who: 0, k: 0 })]);
  });

  it('is heard only so far, and the nearest answer first', () => {
    const ls = [at(2000, 0), at(100, 0, false, 900), ...Array.from({ length: 12 }, (_, i) => at(50 + i * 40, 0))];
    const a = answersTo([0], { x: 0, y: 0 }, ls, 760, 8);
    expect(a).toHaveLength(8);
    expect(a.map((x) => x.who)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    for (let i = 1; i < a.length; i++) expect(a[i].at).toBeGreaterThanOrEqual(a[i - 1].at);
  });
});
