// The Atelier is outside the story: heredity is the only way to change while playing. Its button (✎) comes back in
// the « Balade libre », after the end (balade.ts); `?atelier` or `?dev` in the address shows it anyway, for development.
// The browser also keeps a flag of a story finished: the games finished before the Balade was saved are read with it.

export const BALADE_KEY = 'lignee.balade';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function store(): Store | null {
  try { return localStorage; } catch { return null; }
}

export function baladeUnlocked(storage: Store | null = store()): boolean {
  try { return storage?.getItem(BALADE_KEY) === '1'; } catch { return false; }
}

// Called at the end of the story.
export function unlockBalade(storage: Store | null = store()): void {
  try { storage?.setItem(BALADE_KEY, '1'); } catch { /* private mode */ }
}

export function atelierAvailable(search: string, unlocked: boolean): boolean {
  const params = new URLSearchParams(search);
  return unlocked || params.has('atelier') || params.has('dev');
}

// Shows or hides the button, in the Balade (`free`) or not; returns whether it is shown.
export function applyAtelierAccess(button: HTMLElement | null, free: boolean, search = location.search): boolean {
  const shown = atelierAvailable(search, free);
  if (button) button.hidden = !shown;
  return shown;
}
