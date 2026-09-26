// Touch: one finger guides (the animal swims toward it), two fingers pinch to
// zoom. Mouse: hold to guide, wheel to zoom. Keyboard: arrows / WASD.

export interface Pt { x: number; y: number; sx: number; sy: number; t: number; held?: boolean; }

export class Input {
  follow: Pt | null = null;
  keys = new Set<string>();
  zoomMul = 1;
  onTap: ((x: number, y: number) => void) | null = null;
  private pts = new Map<number, Pt>();
  private pinch: { d: number; z: number } | null = null;

  constructor(el: HTMLElement, private minZoom = 0.55, private maxZoom = 2.4) {
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture?.(e.pointerId); this.pointer('down', e); });
    el.addEventListener('pointermove', (e) => this.pointer('move', e));
    el.addEventListener('pointerup', (e) => this.pointer('up', e));
    el.addEventListener('pointercancel', (e) => this.pointer('up', e));
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.setZoom(this.zoomMul * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.pts.clear(); this.follow = null; this.pinch = null; });
  }

  setZoom(z: number): void { this.zoomMul = Math.max(this.minZoom, Math.min(this.maxZoom, z)); }

  /** keyboard direction, or null */
  keyDir(): { x: number; y: number } | null {
    const k = this.keys;
    const x = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') || k.has('q') ? 1 : 0);
    const y = (k.has('arrowdown') || k.has('s') ? 1 : 0) - (k.has('arrowup') || k.has('w') || k.has('z') ? 1 : 0);
    return x || y ? { x, y } : null;
  }

  private pointer(type: 'down' | 'move' | 'up', e: PointerEvent): void {
    const pts = this.pts;
    if (type === 'down') {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    } else if (type === 'move') {
      const p = pts.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
    } else {
      const p = pts.get(e.pointerId);
      if (p && !this.pinch && Math.hypot(p.x - p.sx, p.y - p.sy) < 12 && performance.now() - p.t < 300) this.onTap?.(p.x, p.y);
      pts.delete(e.pointerId);
    }
    const all = [...pts.values()];
    if (all.length >= 2) {
      const [a, b] = all, dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      if (!this.pinch) this.pinch = { d: dist, z: this.zoomMul };
      this.setZoom((this.pinch.z * dist) / this.pinch.d);
      this.follow = null;
    } else if (all.length === 1) {
      const one = all[0];
      // after a pinch, the remaining finger must move before it guides again
      if (this.pinch) { this.pinch = null; one.sx = one.x; one.sy = one.y; one.held = true; }
      if (!one.held || Math.hypot(one.x - one.sx, one.y - one.sy) > 12) { one.held = false; this.follow = one; }
    } else {
      this.follow = null;
      this.pinch = null;
    }
  }
}
