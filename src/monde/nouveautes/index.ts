import { readData } from './data';
import { versionsOf } from './layout';
import { NouveautesPanel } from './panel';
import { loadSeen, markSeen, openStorage, playedBefore, saveSeen, shouldAutoOpen, storageKeys } from './seen';
import './style.css';

// The « Nouveautés » in the game: a discreet button beside ⚙ opens the panel at any time; it also opens by itself,
// once, when a published version is newer than the last one shown here (seen.ts).
const AUTO_OPEN_MS = 1800;

// canAutoOpen: whether the game can be covered now (not in the Atelier, not during a bench).
export function initNouveautes(canAutoOpen: () => boolean = () => true): NouveautesPanel | null {
  const data = readData();
  if (!data) return null;
  const storage = openStorage();
  let memory = loadSeen(storage);
  const versions = versionsOf(data);
  const panel = new NouveautesPanel(data.title || 'Nouveautés', versions, () => {
    memory = markSeen(memory, data);
    saveSeen(storage, memory);
  });
  const button = document.createElement('button');
  button.id = 'nvBtn';
  button.type = 'button';
  button.textContent = '✦';
  button.title = 'Nouveautés';
  button.setAttribute('aria-label', 'Nouveautés du jeu');
  button.addEventListener('click', () => (panel.isOpen ? panel.hide() : panel.open(button)));
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) button.addEventListener(ev, (e) => e.stopPropagation());
  document.getElementById('gear')?.after(button);
  document.body.append(panel.root);

  // (a browser driven by a test or a bench keeps the news for later)
  const automated = navigator.webdriver || new URLSearchParams(location.search).has('bench');
  if (storage && shouldAutoOpen(data, memory, playedBefore(storageKeys(storage)))) {
    // on the version that is new, even in dev where the one in preparation comes first
    const published = Math.max(0, versions.findIndex((version) => !version.unreleased));
    if (!automated) setTimeout(() => { if (canAutoOpen()) panel.open(null, published); }, AUTO_OPEN_MS);
  } else if (storage && memory.version === null) {
    // a first visit: the next version will be the new one
    memory = markSeen(memory, data);
    saveSeen(storage, memory);
  }
  return panel;
}
