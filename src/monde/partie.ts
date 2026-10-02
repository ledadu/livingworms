// The game this browser remembers: the chapter reached, the creature played and, once there are births, the lineage
// before it. Saved at each birth and at each new chapter, read back when the page opens: the swimmer comes back at the
// start of that chapter. Chapters are kept by id, so the save outlives a change of the map.

export const PARTIE_KEY = 'lignee.partie';
/** the creature alone, as the game kept it before the saved game existed */
export const LEGACY_PLAYER_KEY = 'lignee.player';

/** a creature as stored: the JSON of its species definition */
export type SavedCreature = Record<string, unknown>;

/** the partner of a birth: its species id in the bestiary ('' when it is not one) and its name */
export interface Mate { id: string; name: string }

/** where a parent was left: x counted from the start of its chapter (so that it outlives a change of the map), y the depth (px) */
export interface Place { x: number; y: number }

export interface Ancestor {
  creature: SavedCreature;
  /** the chapter where it gave birth */
  chapter: string;
  /** with whom (saves before the lineage tree have none) */
  partner?: Mate;
  /** where it was left in that chapter (ancetres.ts); missing in the games saved before */
  at?: Place;
  /** instead of a child, the lineage went back here to the form of an earlier ancestor: its index (retour.ts) */
  back?: number;
}

/** a note of the song learned (chant.ts): the chapter it belongs to, and the generation that learned it (1: the first) */
export interface LearnedNote { chapter: string; gen?: number }

/** the free swim after the end of the story (balade.ts): the chapter where we swim, and the creature played there (null:
 * the one the story ended with, which stays in `creature`) */
export interface Balade { chapter: string; creature: SavedCreature | null }

/** a friend that followed a generation (amis.ts): its species id in the bestiary, the generation it followed (1: the
 * first) and, once that generation is over, the chapter and the place where it stayed */
export interface Friend { id: string; gen: number; chapter?: string; at?: Place }

export interface Partie {
  v: 1;
  chapter: string;
  creature: SavedCreature | null;
  /** the generations before the one played, the oldest first */
  lineage: Ancestor[];
  /** the notes of the song learned, in the order they were (games saved before the song have none) */
  notes?: LearnedNote[];
  /** once the story is over: the Balade libre */
  balade?: Balade;
  /** the friends of the generations, the oldest first (games saved before the friends have none) */
  friends?: Friend[];
  savedAt: number;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function newPartie(chapter: string): Partie {
  return { v: 1, chapter, creature: null, lineage: [], savedAt: 0 };
}

const isObject = (o: unknown): o is SavedCreature => typeof o === 'object' && o !== null && !Array.isArray(o);

const isFriend = (f: unknown): f is Friend => isObject(f) && typeof f.id === 'string' && f.id !== '' && typeof f.gen === 'number'
  && (f.chapter === undefined || typeof f.chapter === 'string') && (f.at === undefined || (isObject(f.at) && Number.isFinite(f.at.x) && Number.isFinite(f.at.y)));

/** a saved game read back, or null; an unknown chapter becomes the first one */
export function parsePartie(json: string | null, chapters: readonly string[]): Partie | null {
  if (!json || !chapters.length) return null;
  let o: unknown;
  try { o = JSON.parse(json); } catch { return null; }
  if (!isObject(o) || o.v !== 1) return null;
  const chapter = typeof o.chapter === 'string' && chapters.includes(o.chapter) ? o.chapter : chapters[0];
  const lineage = Array.isArray(o.lineage)
    ? o.lineage.filter((a): a is Ancestor => isObject(a) && isObject(a.creature) && typeof a.chapter === 'string')
    : [];
  const notes = Array.isArray(o.notes) ? o.notes.filter((n): n is LearnedNote => isObject(n) && typeof n.chapter === 'string') : undefined;
  const friends = Array.isArray(o.friends) ? o.friends.filter(isFriend) : undefined;
  const b = o.balade;
  const balade = isObject(b) ? { chapter: typeof b.chapter === 'string' && chapters.includes(b.chapter) ? b.chapter : chapters[0], creature: isObject(b.creature) ? b.creature : null } : undefined;
  return {
    v: 1, chapter, lineage,
    creature: isObject(o.creature) ? o.creature : null,
    ...(notes && { notes }),
    ...(balade && { balade }),
    ...(friends && { friends }),
    savedAt: typeof o.savedAt === 'number' ? o.savedAt : 0
  };
}

/** the saved game, else the creature kept alone by an older version (at the first chapter), else a new game */
export function loadPartie(store: Store | null, chapters: readonly string[]): Partie {
  const fresh = newPartie(chapters[0]);
  if (!store) return fresh;
  try {
    const saved = parsePartie(store.getItem(PARTIE_KEY), chapters);
    if (saved) return saved;
    const legacy = JSON.parse(store.getItem(LEGACY_PLAYER_KEY) || 'null') as unknown;
    return isObject(legacy) ? { ...fresh, creature: legacy } : fresh;
  } catch {
    return fresh;
  }
}

export function savePartie(store: Store | null, p: Partie, now = Date.now()): void {
  p.savedAt = now;
  try { store?.setItem(PARTIE_KEY, JSON.stringify(p)); } catch { /* full or blocked: the game goes on unsaved */ }
}

/** forget the game (and the creature kept by older versions) */
export function clearPartie(store: Store | null): void {
  try { store?.removeItem(PARTIE_KEY); store?.removeItem(LEGACY_PLAYER_KEY); } catch { /* blocked */ }
}

/** a birth: the parent joins the lineage where it gave birth (with this partner, and was left at this place), and the child is played from now on */
export function birth(p: Partie, child: SavedCreature, chapter: string, partner?: Mate, at?: Place): Partie {
  const lineage = p.creature ? [...p.lineage, { creature: p.creature, chapter, ...(partner && { partner }), ...(at && { at }) }] : p.lineage;
  return { ...p, chapter, creature: child, lineage };
}

/** an ancestor renamed (the i-th generation, the oldest first); the one played is renamed with its creature */
export function renameAncestor(p: Partie, i: number, name: string): Partie {
  const a = p.lineage[i];
  if (!a) return p;
  const lineage = p.lineage.slice();
  lineage[i] = { ...a, creature: { ...a.creature, name } };
  return { ...p, lineage };
}

/** the creature changes without a birth (the Atelier): the lineage stays as it is */
export function replaceCreature(p: Partie, creature: SavedCreature): Partie {
  return { ...p, creature };
}

/** the note of a chapter learned by the generation played (once: a note learned stays with its first generation) */
export function learnNote(p: Partie, chapter: string): Partie {
  if (p.notes?.some((n) => n.chapter === chapter)) return p;
  return { ...p, notes: [...(p.notes ?? []), { chapter, gen: p.lineage.length + 1 }] };
}

/** a new chapter reached; true when it changed. Given the chapters in the order of the story, only a deeper one
 * counts: swimming back to the ancestors does not bring the game back */
export function reachChapter(p: Partie, chapter: string, order?: readonly string[]): boolean {
  if (p.chapter === chapter || (order && order.indexOf(chapter) < order.indexOf(p.chapter))) return false;
  p.chapter = chapter;
  return true;
}

/** localStorage, or null when the browser blocks it */
export function openStore(): Store | null {
  try { localStorage.getItem(PARTIE_KEY); return localStorage; } catch { return null; }
}

/** the generation played now (1: the first) */
export const generation = (p: Partie) => p.lineage.length + 1;

/** an animal of this species follows the generation played: one friend per generation, the first one stays */
export function befriend(p: Partie, id: string): Partie {
  const gen = generation(p);
  if (!id || p.friends?.some((f) => f.gen === gen)) return p;
  return { ...p, friends: [...(p.friends ?? []), { id, gen }] };
}

/** the friend of that generation stays in this chapter, at this place (its generation is over) */
export function friendStays(p: Partie, gen: number, chapter: string, at: Place): Partie {
  const i = p.friends?.findIndex((f) => f.gen === gen && !f.at) ?? -1;
  if (i < 0) return p;
  const friends = p.friends!.slice();
  friends[i] = { ...friends[i], chapter, at };
  return { ...p, friends };
}

/** the k-th ancestor was left at another place of its chapter (its parents swam with the child a while, amis.ts) */
export function placeAncestor(p: Partie, k: number, at: Place): Partie {
  const a = p.lineage[k];
  if (!a) return p;
  const lineage = p.lineage.slice();
  lineage[k] = { ...a, at };
  return { ...p, lineage };
}
