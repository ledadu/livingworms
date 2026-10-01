// The loading screen (#chargement, in index.html): painted by the page itself before any script runs, lifted once the
// world has drawn its first frames, so that the sea shows up already moving.

/** frames the world draws under the screen before it fades (the first ones are the slowest) */
export const FRAMES_BEFORE = 3;

/** called once the game is set up and its frame loop started */
export function leverRideau(doc: Document = document): void {
  const el = doc.getElementById('chargement');
  if (!el) return;
  let n = 0;
  const wait = (): void => {
    if (++n < FRAMES_BEFORE) { requestAnimationFrame(wait); return; }
    el.classList.add('fin');
    const gone = (): void => el.remove();
    el.addEventListener('transitionend', gone, { once: true });
    setTimeout(gone, 1500);
  };
  requestAnimationFrame(wait);
}
