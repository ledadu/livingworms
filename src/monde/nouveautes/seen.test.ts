import { describe, expect, it } from 'vitest';
import type { WhatsNewRelease } from './data';
import { STORAGE_KEY, compareVersions, loadSeen, markSeen, newestPublished, playedBefore, saveSeen, shouldAutoOpen, storageKeys } from './seen';

const release = (version: string | null, unreleased = false): WhatsNewRelease =>
  ({ version, generation: '', unreleased, date: null, title: null, intro: '', entries: [] });
const data = (...releases: WhatsNewRelease[]) => ({ releases });

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe('which version is new', () => {
  it('compares versions number by number', () => {
    expect(compareVersions('0.10.0', '0.9.3')).toBeGreaterThan(0);
    expect(compareVersions('0.2.0', '0.2.1')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('takes the newest published version, never the one in preparation', () => {
    expect(newestPublished(data(release('0.3.0', true), release('0.2.0'), release('0.1.0')))).toBe('0.2.0');
    expect(newestPublished(data(release('0.1.0'), release('0.2.0')))).toBe('0.2.0');
    expect(newestPublished(data(release('0.3.0', true)))).toBeNull();
    expect(newestPublished(data())).toBeNull();
  });

  it('opens by itself for a published version newer than the last one seen', () => {
    const d = data(release('0.3.0', true), release('0.2.0'));
    expect(shouldAutoOpen(d, { version: '0.1.0' }, true)).toBe(true);
    expect(shouldAutoOpen(d, { version: '0.2.0' }, true)).toBe(false);
    expect(shouldAutoOpen(d, { version: '0.2.1' }, true)).toBe(false);
    // the version in preparation alone never opens it
    expect(shouldAutoOpen(data(release('0.3.0', true)), { version: '0.2.0' }, true)).toBe(false);
  });

  it('greets a first visit with the sea, a player from before the panel with the news', () => {
    const d = data(release('0.2.0'));
    expect(shouldAutoOpen(d, { version: null }, false)).toBe(false);
    expect(shouldAutoOpen(d, { version: null }, true)).toBe(true);
  });

  it('remembers the newest published version once shown, and never goes back', () => {
    const d = data(release('0.3.0', true), release('0.2.0'));
    expect(markSeen({ version: null }, d)).toEqual({ version: '0.2.0' });
    expect(markSeen({ version: '0.1.0' }, d)).toEqual({ version: '0.2.0' });
    const later = { version: '0.4.0' };
    expect(markSeen(later, d)).toBe(later);
  });

  it('opens once after a new version: shown, remembered, then quiet until the next one', () => {
    const storage = fakeStorage({ 'lignee.monde': '{}', [STORAGE_KEY]: JSON.stringify({ version: '0.1.0' }) });
    const d = data(release('0.2.0'), release('0.1.0'));
    let memory = loadSeen(storage);
    expect(shouldAutoOpen(d, memory, playedBefore(storageKeys(storage)))).toBe(true);
    saveSeen(storage, (memory = markSeen(memory, d)));
    expect(shouldAutoOpen(d, loadSeen(storage), true)).toBe(false);
    expect(shouldAutoOpen(data(release('0.3.0'), ...d.releases), loadSeen(storage), true)).toBe(true);
  });
});

describe('the memory of the browser', () => {
  it('knows a player from what the game already stored', () => {
    expect(playedBefore(['lignee.monde'])).toBe(true);
    expect(playedBefore(['lignee.player', 'autre'])).toBe(true);
    expect(playedBefore([STORAGE_KEY, 'allele.whatsNew'])).toBe(false);
    expect(playedBefore([])).toBe(false);
  });

  it('reads what it wrote, and forgets what it cannot read', () => {
    const storage = fakeStorage();
    expect(loadSeen(storage)).toEqual({ version: null });
    saveSeen(storage, { version: '0.2.0' });
    expect(loadSeen(storage)).toEqual({ version: '0.2.0' });
    expect(loadSeen(fakeStorage({ [STORAGE_KEY]: '{oops' }))).toEqual({ version: null });
    expect(loadSeen(fakeStorage({ [STORAGE_KEY]: '{"version":2}' }))).toEqual({ version: null });
    expect(loadSeen(null)).toEqual({ version: null });
    expect(() => saveSeen(null, { version: '0.2.0' })).not.toThrow();
  });
});

describe('nightlies', () => {
  it('sorts a nightly before its stable, by date then number, and remembers a renumbered version as its nightly', () => {
    expect(compareVersions('0.1.0-nightly.20261002.1', '0.1.0-nightly.20260930.4')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0-nightly.20261002.2', '0.1.0-nightly.20261002.1')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0', '0.1.0-nightly.20261002.9')).toBeGreaterThan(0);
    expect(compareVersions('0.2.0-nightly.20261005.1', '0.1.0')).toBeGreaterThan(0);
    // A browser that saw « 0.9 » before the renumbering has seen the nightly of 2 October, not more.
    const now = data(release('0.1.0-nightly.20261002.1'), release('0.1.0-nightly.20260930.1'));
    expect(shouldAutoOpen(now, { version: '0.9.0' }, true)).toBe(false);
    expect(shouldAutoOpen(data(release('0.1.0-nightly.20261003.1'), ...now.releases), { version: '0.9.0' }, true)).toBe(true);
    expect(markSeen({ version: '0.9.0' }, now)).toEqual({ version: '0.1.0-nightly.20261002.1' });
  });
});

