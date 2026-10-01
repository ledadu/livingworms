// The button to mate (docs/mecaniques.md, « La parade »): once we have danced a while with a partner, « S'accoupler »
// shows above it and follows it; a touch, a click, or Entrée / Espace starts the dance for two (parade-jeu.ts).
import './accoupler.css';

export function initAccoupler(go: () => void) {
  const button = document.createElement('button');
  button.id = 'mateBtn';
  button.type = 'button';
  button.textContent = 'S’accoupler';
  button.setAttribute('aria-label', 'S’accoupler (Entrée)');
  document.body.append(button);
  let shown = false;
  // the touch stays with the button: it does not guide the swimmer
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchmove']) button.addEventListener(ev, (x) => x.stopPropagation());
  button.addEventListener('click', () => { if (shown) go(); });
  document.addEventListener('keydown', (e) => {
    if (!shown || e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
    const at = document.activeElement;
    if (at && at !== document.body && at !== button && (at as HTMLElement).closest('input, textarea, select, button, [role="button"]')) return;
    e.preventDefault();
    go();
  });

  return {
    get shown() { return shown; },
    /** shows it centred on x, its bottom at y (px on the screen), or hides it */
    place(at: { x: number; y: number } | null): void {
      if (!at) { if (shown) { shown = false; button.classList.remove('show'); } return; }
      if (!shown) { shown = true; button.classList.add('show'); }
      const x = Math.min(window.innerWidth - 70, Math.max(70, at.x)), y = Math.min(window.innerHeight - 90, Math.max(64, at.y));
      button.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  };
}
