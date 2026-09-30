import { describe, expect, it } from 'vitest';
import { SPECIES } from '../content/species';
import { BIOMES, span } from './biomes';
import { GATES, WORLD_END, WORLD_START } from './limites';
import { GLOW_FAR, GLOW_NEAR, PARTNERS, PER_PARTNER, marksPartner, meetRange, partnerGlow, partnerSpawns, uncovered } from './partenaires';

// Until content/traits.ts (traits-corps) and obstacles.ts (obstacles-cles) are merged:
// the traits traitsOf gives the partners, and the traits that cross each obstacle.
const TRAITS: Record<string, string[]> = {
  copepode: ['nageoires', 'lanterne', 'carapace', 'cils'], larve: [],
  poissonClown: ['nageoires'], poissonLion: ['nageoires'], hippocampe: ['nageoires', 'carapace'], meduseBoite: ['lanterne', 'pulsation', 'filaments'],
  dragonFeuillu: ['corpsFin'], seiche: ['nageoires', 'filaments'], homard: ['nageoires', 'pinces', 'carapace'],
  anguille: ['nageoires', 'corpsFin', 'filaments'], serpentCilie: ['corpsFin', 'cils'], ctenophore: ['lanterne', 'filaments', 'cils'],
  plumeau: ['corpsFin', 'carapace', 'filaments'], crabe: ['pinces', 'carapace'],
  verDeFeu: ['corpsFin', 'carapace'], crevetteMante: ['nageoires', 'pinces', 'carapace'],
  clione: ['nageoires', 'lanterne'], krill: ['nageoires', 'lanterne', 'carapace'], chrysaora: ['pulsation', 'filaments'],
  meduse: ['lanterne', 'pulsation', 'filaments'], siphonophore: ['nageoires', 'lanterne', 'corpsFin', 'pulsation', 'filaments'],
  baudroie: ['nageoires', 'lanterne'], dragonAbyssal: ['nageoires', 'lanterne', 'corpsFin'], nautile: ['carapace', 'filaments']
};
const KEYS: Record<string, string[]> = {
  recif: ['nageoires', 'pulsation'], foret: ['pinces', 'corpsFin'], grotte: ['corpsFin', 'lanterne'],
  sources: ['carapace', 'cils'], glacier: ['carapace', 'filaments'], jardin: ['pulsation', 'filaments'], fosse: ['lanterne', 'chant']
};

describe('the partners of each chapter', () => {
  it('are species of the bestiary', () => {
    for (const b of BIOMES) for (const q of PARTNERS[b.id]) expect(SPECIES[q.id], `${b.id}: ${q.id}`).toBeTypeOf('function');
  });

  it('every chapter but the Remontée has at least two', () => {
    for (const b of BIOMES) if (b.id !== 'remontee') expect(PARTNERS[b.id].length, b.id).toBeGreaterThanOrEqual(2);
  });

  it('bring every body trait that crosses the obstacle of their chapter: the descent never gets stuck', () => {
    for (const [ch, keys] of Object.entries(KEYS)) expect(uncovered(ch as keyof typeof PARTNERS, keys, (id) => TRAITS[id] || []), ch).toEqual([]);
  });

  it('tells which traits no partner brings', () => {
    expect(uncovered('foret', ['pinces', 'pulsation', 'chant'], (id) => TRAITS[id] || [])).toEqual(['pulsation']);
  });

  it('live where the swimmer can meet them, short of the obstacle', () => {
    BIOMES.forEach((b, bi) => {
      if (!PARTNERS[b.id].length) return;
      const [a, c] = meetRange(bi), gate = GATES.find((g) => g.chapter === b.id);
      expect(a, b.id).toBeGreaterThanOrEqual(Math.max(WORLD_START, span(b.id)[0]));
      expect(c, b.id).toBeLessThanOrEqual(Math.min(WORLD_END, gate ? gate.x : Infinity));
      expect(c - a, b.id).toBeGreaterThan(1000);
    });
  });

  it('are placed in the plane so that each chapter has enough of each, spread along it', () => {
    let s = 1;
    const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const all = partnerSpawns(R);
    BIOMES.forEach((b, bi) => {
      const mine = all.filter(([i]) => i === bi), [a, c] = meetRange(bi);
      expect(mine.length, b.id).toBe(PARTNERS[b.id].length * PER_PARTNER);
      for (const [, q, x] of mine) {
        expect(x).toBeGreaterThanOrEqual(a);
        expect(x).toBeLessThanOrEqual(c);
        expect(marksPartner(bi, q.id, x, 0)).toBe(true);
      }
    });
    // the fauna already holds some: only the rest is added
    expect(partnerSpawns(R, (_, id) => (id === 'homard' ? 5 : 1)).filter(([, q]) => q.id === 'homard')).toEqual([]);
    expect(partnerSpawns(R, () => 1).length).toBe(all.length / 2);
  });

  it('only in the swimming plane and for their own chapter', () => {
    const bi = BIOMES.findIndex((b) => b.id === 'foret'), x = (meetRange(bi)[0] + meetRange(bi)[1]) / 2;
    expect(marksPartner(bi, 'homard', x, 0)).toBe(true);
    expect(marksPartner(bi, 'homard', x, 260)).toBe(false);
    expect(marksPartner(bi, 'poulpe', x, 0)).toBe(false);
    expect(marksPartner(bi + 1, 'homard', x, 0)).toBe(false);
  });
});

describe('the glow of a partner', () => {
  it('is dark far away and rises as the swimmer comes near', () => {
    expect(partnerGlow(GLOW_FAR + 10, 0, 0)).toBe(0);
    const far = partnerGlow((GLOW_FAR + GLOW_NEAR) / 2, 0, 0), near = partnerGlow(GLOW_NEAR, 0, 0);
    expect(far).toBeGreaterThan(0);
    expect(near).toBeGreaterThan(far);
    expect(partnerGlow(0, 0, 0)).toBe(near);
  });

  it('breathes softly, never goes out up close', () => {
    let lo = 1, hi = 0;
    for (let t = 0; t < 10; t += 0.05) { const g = partnerGlow(50, t, 1); lo = Math.min(lo, g); hi = Math.max(hi, g); }
    expect(lo).toBeGreaterThan(0.35);
    expect(hi).toBeLessThanOrEqual(1);
    expect(hi - lo).toBeGreaterThan(0.2);
  });
});
