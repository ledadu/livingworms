import { describe, expect, it } from 'vitest';
import { BALADE_KEY, applyAtelierAccess, atelierAvailable, baladeUnlocked, unlockBalade } from './atelier-access';

function memory(): Pick<Storage, 'getItem' | 'setItem'> {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe('the Atelier outside the story', () => {
  it('is hidden during the story', () => {
    expect(atelierAvailable('', false)).toBe(false);
    expect(atelierAvailable('?bench', false)).toBe(false);
  });
  it('opens with ?atelier or ?dev, for development', () => {
    expect(atelierAvailable('?dev', false)).toBe(true);
    expect(atelierAvailable('?atelier', false)).toBe(true);
    expect(atelierAvailable('?lod=0&atelier=1', false)).toBe(true);
  });
  it('keeps the flag of a story finished in this browser', () => {
    const s = memory();
    expect(baladeUnlocked(s)).toBe(false);
    unlockBalade(s);
    expect(s.getItem(BALADE_KEY)).toBe('1');
    expect(baladeUnlocked(s)).toBe(true);
    expect(atelierAvailable('', baladeUnlocked(s))).toBe(true);
  });
  it('stays hidden when the storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(baladeUnlocked(blocked)).toBe(false);
    expect(() => unlockBalade(blocked)).not.toThrow();
    expect(baladeUnlocked(null)).toBe(false);
  });
  it('shows or hides the button', () => {
    const button = { hidden: false } as HTMLElement;
    expect(applyAtelierAccess(button, false, '')).toBe(false);
    expect(button.hidden).toBe(true);
    expect(applyAtelierAccess(button, false, '?atelier')).toBe(true);
    expect(button.hidden).toBe(false);
    applyAtelierAccess(button, false, '');
    expect(applyAtelierAccess(button, true, '')).toBe(true);
    expect(button.hidden).toBe(false);
  });
});
