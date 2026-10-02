import type { WhatsNew } from './data';

// What this browser remembers of the « Nouveautés »: the last published version it showed. The panel opens by itself
// once for a newer one. A first visit starts with the sea, not with the news: it only remembers the current version,
// unless the game was already played here before the panel existed. A blocked storage never opens it by itself.
export interface SeenMemory {
  version: string | null;
}

export const STORAGE_KEY = 'lignee.nouveautes';

// The versions before the nightlies (0.2.0 to 0.9.0, published from 2026-09-30 to 2026-10-02) became the nightlies on
// the way to 0.1.0: a browser that remembers one of them remembers its nightly.
export const RENUMBERED: Record<string, string> = {
  '0.2.0': '0.1.0-nightly.20260930.1',
  '0.3.0': '0.1.0-nightly.20260930.2',
  '0.4.0': '0.1.0-nightly.20260930.3',
  '0.5.0': '0.1.0-nightly.20260930.4',
  '0.6.0': '0.1.0-nightly.20261001.1',
  '0.7.0': '0.1.0-nightly.20261001.2',
  '0.9.0': '0.1.0-nightly.20261002.1',
};

// X.Y.Z, or a nightly X.Y.Z-nightly.AAAAMMJJ.N that comes before X.Y.Z (by date, then number): as the framework sorts
// them (agents/release/changes.mjs).
const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-nightly\.(\d{8})\.(\d+))?$/;
export function compareVersions(a: string, b: string): number {
  const [x, y] = [VERSION.exec(a), VERSION.exec(b)];
  if (!x || !y) return x ? 1 : y ? -1 : 0;
  for (let i = 1; i <= 3; i++) if (Number(x[i]) !== Number(y[i])) return Number(x[i]) - Number(y[i]);
  if (!x[4] || !y[4]) return (x[4] ? -1 : 0) - (y[4] ? -1 : 0);
  return x[4].localeCompare(y[4]) || Number(x[5]) - Number(y[5]);
}

// The newest published version: the one whose novelty opens the panel (never the one in preparation).
export function newestPublished(data: Pick<WhatsNew, 'releases'>): string | null {
  let newest: string | null = null;
  for (const release of data.releases) {
    if (!release.unreleased && release.version && (!newest || compareVersions(release.version, newest) > 0)) newest = release.version;
  }
  return newest;
}

// The version a browser remembers, under its current number: one gone from the published ones that was renumbered.
export function remembered(memory: SeenMemory, data: Pick<WhatsNew, 'releases'>): string | null {
  const version = memory.version;
  // Only once the published versions are the nightlies (the renumbering is in): before, 0.2.0 is still 0.2.0.
  const renumbered = data.releases.some((release) => /-nightly\./.test(release.version ?? ''));
  if (!version || !renumbered || !RENUMBERED[version] || data.releases.some((release) => release.version === version)) return version;
  return RENUMBERED[version];
}

export function shouldAutoOpen(data: Pick<WhatsNew, 'releases'>, memory: SeenMemory, playedBefore: boolean): boolean {
  const newest = newestPublished(data);
  if (!newest) return false;
  const seen = remembered(memory, data);
  return seen === null ? playedBefore : compareVersions(newest, seen) > 0;
}

export function markSeen(memory: SeenMemory, data: Pick<WhatsNew, 'releases'>): SeenMemory {
  const newest = newestPublished(data);
  const seen = remembered(memory, data);
  if (!newest || (seen && compareVersions(newest, seen) <= 0)) return seen === memory.version ? memory : { version: seen };
  return { version: newest };
}

// Whether the game left something in this storage (its settings, the creature played, the Atelier…).
export function playedBefore(keys: Iterable<string>): boolean {
  for (const key of keys) if (key.startsWith('lignee.') && key !== STORAGE_KEY) return true;
  return false;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>;

// localStorage, or null when the browser blocks it (a sandboxed frame, some private windows).
export function openStorage(): Store | null {
  try {
    localStorage.getItem(STORAGE_KEY);
    return localStorage;
  } catch {
    return null;
  }
}

export function storageKeys(storage: Store): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null) keys.push(key);
  }
  return keys;
}

export function loadSeen(storage: Store | null): SeenMemory {
  try {
    const stored = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null') as Partial<SeenMemory> | null;
    return { version: typeof stored?.version === 'string' ? stored.version : null };
  } catch {
    return { version: null };
  }
}

export function saveSeen(storage: Store | null, memory: SeenMemory): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // full or blocked: nothing remembered
  }
}
