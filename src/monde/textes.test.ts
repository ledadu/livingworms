import { describe, expect, it } from 'vitest';
import doc from '../../docs/chapitres.md?raw';
import { BIOMES } from './biomes';
import { MAX_LINES, holdTime, parseChapterTexts, textsOf, toLines } from './textes';

const all = parseChapterTexts(doc);

describe('les textes de la lignée', () => {
  it('finds an opening for every chapter of the map, in chapitres.md', () => {
    for (const [i, b] of BIOMES.entries()) {
      const c = textsOf(all, b.name, i);
      expect(c?.num, b.name).toBe(i + 1);
      expect(c?.opening?.length, b.name).toBeGreaterThan(0);
    }
  });

  it('shows every text in two to four lines', () => {
    for (const c of all) for (const k of ['opening', 'farewell', 'final', 'balade'] as const) {
      const lines = c[k];
      if (!lines) continue;
      expect(lines.length, `${c.title} ${k}`).toBeGreaterThanOrEqual(2);
      expect(lines.length).toBeLessThanOrEqual(MAX_LINES);
    }
  });

  it('reads the farewells, the turn and the final words', () => {
    const nurserie = textsOf(all, 'La Nurserie', 0)!, remontee = textsOf(all, 'La Remontée', 9)!;
    expect(nurserie.farewell).toEqual(['Tu ne descendras pas plus bas.', 'Mais ce que tu étais, lui, continue.']);
    expect(textsOf(all, 'La Grotte', 3)!.farewell?.[0]).toMatch(/^Tu resteras à l’entrée/);
    expect(remontee.opening?.[0]).toMatch(/^Nous pensions descendre/);
    expect(remontee.final?.[0]).toBe('Nous sommes remontés.');
    expect(textsOf(all, 'Le Récif', 1)!.farewell?.[0]).toMatch(/^Tu nous as appris/);
  });

  it('reads the words of the Balade libre at the end of the Remontée, and only there', () => {
    expect(textsOf(all, 'La Remontée', 9)!.balade?.length).toBeGreaterThan(0);
    expect(all.filter((c) => c.balade)).toHaveLength(1);
  });

  it('breaks a lone long sentence at the comma nearest its middle', () => {
    expect(toLines('Au commencement, il y avait la lumière, et nous étions si petits qu\'elle nous traversait.')).toEqual([
      'Au commencement, il y avait la lumière,', 'et nous étions si petits qu’elle nous traversait.'
    ]);
    expect(toLines('Nous.')).toEqual(['Nous.']);
  });

  it('keeps at most four lines, and takes the quote that follows its label only', () => {
    expect(toLines('Un. Deux. Trois. Quatre. Cinq.')).toEqual(['Un.', 'Deux.', 'Trois.', 'Quatre. Cinq.']);
    const md = '## 1. Ici\n\n> pas un texte\n\nOuverture :\n\n> Première ligne.\n> Seconde ligne.\n\n- Note\n\n> ignorée\n\n## Dans le monde\n\nAdieu :\n\n> hors chapitre';
    expect(parseChapterTexts(md)).toEqual([{ num: 1, title: 'Ici', opening: ['Première ligne.', 'Seconde ligne.'] }]);
  });

  it('leaves time to read', () => {
    expect(holdTime(['Nous.'])).toBe(3500);
    expect(holdTime(textsOf(all, 'La Nurserie', 0)!.opening!)).toBeGreaterThan(4000);
  });
});
