import { describe, expect, it } from 'vitest';
import { CARCASSE, WHALE_LENGTH, boneLight, carcasseDwellers, carcasseLayout, underCarcasse } from './carcasse';

describe('la Carcasse', () => {
  it('lays the same skeleton every time', () => {
    expect(JSON.stringify(carcasseLayout(5000))).toBe(JSON.stringify(carcasseLayout(5000)));
  });

  it('has a skull, two jaws, the spine and thirteen pairs of ribs', () => {
    const { pieces } = carcasseLayout(0), n = (p: string) => pieces.filter((d) => d.part === p).length;
    expect(n('skull')).toBe(1);
    expect(n('jaw')).toBe(2);
    expect(n('spine')).toBe(4);
    expect(n('rib')).toBe(26);
    expect(pieces.every((d) => d.kind === 'bone')).toBe(true);
  });

  it('keeps the swimming plane clear: bones lie behind it, nothing big in front', () => {
    for (const d of carcasseLayout(0).pieces) {
      expect(d.z).toBeGreaterThanOrEqual(10);
      if (d.part !== 'shells') expect(Math.abs(d.x)).toBeLessThan(WHALE_LENGTH);
    }
  });

  it('lists three frescoes with their own motif, each on a bone', () => {
    const { pieces, fresques } = carcasseLayout(0);
    expect(new Set(fresques.map((f) => f.motif)).size).toBe(3);
    expect(new Set(fresques.map((f) => f.id)).size).toBe(3);
    for (const f of fresques) expect(pieces.some((d) => Math.abs(d.x - f.x) < 80 && d.z === f.z)).toBe(true);
  });

  it('is lived in, and lit', () => {
    const who = carcasseDwellers();
    expect(who.some(([id]) => id === 'crabe')).toBe(true);
    expect(who.some(([id]) => id === 'plumeau')).toBe(true);
    for (const [, , x] of who) expect(Math.abs(x - CARCASSE.x)).toBeLessThan(WHALE_LENGTH);
    expect(CARCASSE.pieces.filter((d) => boneLight(d)).length).toBeGreaterThan(3);
  });

  it('keeps big rocks off the bones', () => {
    expect(underCarcasse(CARCASSE.x, 90)).toBe(true);
    expect(underCarcasse(CARCASSE.x + 3000, 90)).toBe(false);
  });
});
