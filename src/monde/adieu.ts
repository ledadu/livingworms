// The farewell to the parent (docs/mecaniques.md, « L'adieu »): the child is born beside it and turns
// around it once, the words of the lineage come, then the child swims away down the story while the
// parent goes a little way with it, stops, and watches it go. The parent stays there afterwards, and
// turns to look at us when we come back. Pure: positions in, wished velocities and camera out.

export interface Pt { x: number; y: number }

/** the moments of the scene (s from its start) */
export const T = {
  /** the words of the lineage begin */
  words: 1.2,
  /** the child sets off */
  leave: 3,
  /** the parent has stopped following */
  stop: 5.6,
  /** the swimmer is ours again at the latest */
  end: 11
};
/** the swimmer is ours again as soon as the child is this far */
export const APART = 720;
/** how far the child sets off for, and how much deeper */
const AWAY = 1000, DEEPER = 160;

export interface Shot {
  /** wished velocities of the child (the swimmer) and of the parent */
  child: Pt;
  parent: Pt;
  /** where the camera looks, the width of water it wants to show there (px), and how much it takes over from the player's own view (0..1) */
  focus: Pt;
  span: number;
  close: number;
}

const smooth = (a: number, b: number, v: number) => {
  const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** a velocity toward `to` at `speed`, slowing down in the last `ease` px */
function toward(from: Pt, to: Pt, speed: number, ease = 60): Pt {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1, s = speed * Math.min(1, d / ease);
  return { x: (dx / d) * s, y: (dy / d) * s };
}
/** barely moving, but facing `to` (the engine turns the head toward the wished velocity) */
function face(from: Pt, to: Pt): Pt {
  const v = toward(from, to, 0.35, 1);
  return { x: v.x, y: v.y * 0.3 };
}

export class Farewell {
  /** where the parent was left, and where the child heads for */
  readonly home: Pt;
  readonly away: Pt;
  private size: number;
  private turn: number;
  /** the width of water that shows the two together */
  private frame: number;

  /** dir: +1 when the story goes on to the right (always, today), -1 otherwise; size: the parent's length (px) */
  constructor(parent: Pt, dir = 1, floor = Infinity, size = 40) {
    this.home = { ...parent };
    this.frame = 260 + size * 2;
    this.size = size;
    this.away = { x: parent.x + dir * AWAY, y: Math.min(parent.y + DEEPER, floor - 90) };
    this.turn = dir;
  }

  /** the scene at s seconds from its start, or null when it is over (the swimmer is ours again) */
  at(s: number, parent: Pt, child: Pt): Shot | null {
    const d = Math.hypot(child.x - parent.x, child.y - parent.y);
    if (s >= T.end || (s > T.leave && d > APART)) return null;
    let cv: Pt, pv: Pt;
    if (s < T.leave) {
      // together: the child turns once around the parent, which follows it with its head
      const a = Math.PI * (0.5 - (2 * s) / T.leave) * this.turn;
      cv = toward(child, { x: parent.x + Math.cos(a) * 70, y: parent.y + Math.sin(a) * 42 }, 1.3, 30);
      pv = face(parent, child);
    } else {
      // apart: the child goes, faster and faster; the parent goes with it a little, then stops and watches
      const u = smooth(T.leave, T.leave + 3, s);
      cv = toward(child, this.away, lerp(0.9, 2.4, u));
      const w = 1 - smooth(T.leave + 0.6, T.stop, s);
      pv = w > 0.05 ? toward(parent, child, 0.9 * w, 200) : face(parent, child);
    }
    // the camera: close on the two, wider as they part, then back with the child
    const mid = { x: (parent.x + child.x) / 2, y: (parent.y + child.y) / 2 };
    const k = smooth(380, 820, d);
    return {
      child: cv, parent: pv,
      focus: { x: lerp(mid.x, child.x, k), y: lerp(mid.y, child.y, k) },
      span: Math.max(this.frame, d + this.size * 2 + 240),
      close: smooth(0, 2, s) * (1 - smooth(520, APART + 60, d))
    };
  }
}

/**
 * A parent left behind: it keeps near where it was left, drifting slowly, and when we come
 * back it turns to us and comes a little way to meet us (never onto us).
 */
export function stayGoal(parent: Pt, home: Pt, swimmer: Pt, time: number, seed = 0): Pt {
  const dx = swimmer.x - parent.x, dy = swimmer.y - parent.y, d = Math.hypot(dx, dy);
  const off = Math.hypot(parent.x - home.x, parent.y - home.y);
  if (d < 520 && off < 260) return d < 150 ? face(parent, swimmer) : toward(parent, swimmer, 0.7, 120);
  const drift = { x: home.x + Math.sin(time * 0.21 + seed) * 90, y: home.y + Math.cos(time * 0.29 + seed * 1.7) * 45 };
  return toward(parent, drift, 0.55, 80);
}
