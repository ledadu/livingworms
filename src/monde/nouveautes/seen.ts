import type { WhatsNew } from './data';

// What this browser remembers of the « Nouveautés »: the last published version it showed. The panel opens by itself
// once for a newer one. A first visit starts with the sea, not with the news: it only remembers the current version,
// unless the game was already played here before the panel existed. A blocked storage never opens it by itself.
export interface SeenMemory {
  version: string | null;
}

export const STORAGE_KEY = 'lignee.nouveautes';

export function compareVersions(a: string, b: string): number {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}

// The newest published version: the one whose novelty opens the panel (never the one in preparation).
export function newestPublished(data: Pick<WhatsNew, 'releases'>): string | null {
  let newest: string | null = null;
  for (const release of data.releases) {
    if (!release.unreleased && release.version && (!newest || compareVersions(release.version, newest) > 0)) newest = release.version;
  }
  return newest;
}

export function shouldAutoOpen(data: Pick<WhatsNew, 'releases'>, memory: SeenMemory, playedBefore: boolean): boolean {
  const newest = newestPublished(data);
  if (!newest) return false;
  return memory.version === null ? playedBefore : compareVersions(newest, memory.version) > 0;
}

export function markSeen(memory: SeenMemory, data: Pick<WhatsNew, 'releases'>): SeenMemory {
  const newest = newestPublished(data);
  if (!newest || (memory.version && compareVersions(newest, memory.version) <= 0)) return memory;
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
