// The sound in the settings panel (index.html, « Son »): the volume of the music and of the song, kept in the
// browser's storage (son.ts). A word says when one is off; no figures.

import { son, type Volumes } from './son';

const SLIDERS: [string, keyof Volumes, string][] = [['musicVol', 'musique', 'coupée'], ['chantVol', 'chant', 'coupé']];

export function initReglagesSon(): void {
  const s = son();
  for (const [id, k, off] of SLIDERS) {
    const input = document.getElementById(id) as HTMLInputElement | null, out = document.getElementById(id + 'Val');
    if (!input) continue;
    const show = () => { if (out) out.textContent = s.volumes[k] > 0 ? '' : off; };
    input.value = String(Math.round(s.volumes[k] * 100));
    show();
    input.addEventListener('input', () => { s.setVolume(k, +input.value / 100); show(); });
  }
}
