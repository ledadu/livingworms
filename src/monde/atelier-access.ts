// The Atelier is outside the story: heredity is the only way to change while playing. Its button (✎) comes back in
// the « Balade libre », unlocked after the end; `?atelier` in the address shows it anyway, for development.

export const BALADE_KEY = 'lignee.balade';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function store(): Store | null {
  try { return localStorage; } catch { return null; }
}

export function baladeUnlocked(storage: Store | null = store()): boolean {
  try { return storage?.getItem(BALADE_KEY) === '1'; } catch { return false; }
}

// Called at the end of the story (the Balade libre is then open for good in this browser).
export function unlockBalade(storage: Store | null = store()): void {
  try { storage?.setItem(BALADE_KEY, '1'); } catch { /* private mode */ }
}

export function atelierAvailable(search: string, unlocked: boolean): boolean {
  return unlocked || new URLSearchParams(search).has('atelier');
}

// Shows or hides the button; returns whether it is shown.
export function applyAtelierAccess(button: HTMLElement | null, search = location.search, storage: Store | null = store()): boolean {
  const shown = atelierAvailable(search, baladeUnlocked(storage));
  if (button) button.hidden = !shown;
  return shown;
}
