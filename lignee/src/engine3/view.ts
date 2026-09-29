// Our own little 3D: a camera with a position, a pitch and a perspective,
// projecting world points onto the 2D canvas. World axes: x to the right,
// y DOWN (like the whip engine, the surface is y = 0), z away from the eye.
// The swimming plane is z = 0.

export interface Proj { x: number; y: number; s: number; d: number; }

/** what the renderer needs from a camera */
export interface Projector {
  project(x: number, y: number, z: number, out: Proj): Proj;
  axis(vx: number, vy: number, vz: number, s: number, out: { x: number; y: number }): void;
  /** unit vector from a world point toward the eye */
  toward(x: number, y: number, z: number, out: { x: number; y: number; z: number }): void;
}

/** a flat projection with no perspective (for baking sprites): res px per unit */
export class Ortho implements Projector {
  constructor(public res: number, public ox = 0, public oy = 0) {}
  project(x: number, y: number, z: number, out: Proj): Proj {
    out.x = this.ox + x * this.res; out.y = this.oy + y * this.res; out.s = this.res; out.d = 1000 + z;
    return out;
  }
  axis(vx: number, vy: number, _vz: number, s: number, out: { x: number; y: number }): void { out.x = vx * s; out.y = vy * s; }
  toward(_x: number, _y: number, _z: number, out: { x: number; y: number; z: number }): void { out.x = 0; out.y = 0; out.z = -1; }
}

export class View implements Projector {
  W = 0; H = 0;
  /** focal length in css px */
  f = 1;
  /** camera position */
  cx = 0; cy = 0; cz = -900;
  /** looking down by this angle (radians) */
  pitch = 0.17;
  private cp = 1; private sp = 0;

  resize(W: number, H: number, fovDeg = 50): void {
    this.W = W; this.H = H;
    this.f = H / 2 / Math.tan((fovDeg * Math.PI) / 360);
  }

  /** place the camera at `dist` from the target, raised by the pitch */
  aim(tx: number, ty: number, dist: number, pitch: number): void {
    this.pitch = pitch;
    this.cp = Math.cos(pitch); this.sp = Math.sin(pitch);
    this.cx = tx;
    this.cy = ty - dist * this.sp;
    this.cz = -dist * this.cp;
  }

  /** depth along the view axis (what perspective divides by) */
  depth(y: number, z: number): number {
    return (z - this.cz) * this.cp + (y - this.cy) * this.sp;
  }

  project(x: number, y: number, z: number, out: Proj): Proj {
    const rx = x - this.cx, ry = y - this.cy, rz = z - this.cz;
    const zc = rz * this.cp + ry * this.sp, yc = ry * this.cp - rz * this.sp;
    const d = Math.max(1, zc), s = this.f / d;
    out.x = this.W / 2 + rx * s;
    out.y = this.H / 2 + yc * s;
    out.s = s;
    out.d = d;
    return out;
  }

  /** screen displacement of a world vector at a place whose perspective scale is s */
  axis(vx: number, vy: number, vz: number, s: number, out: { x: number; y: number }): void {
    out.x = vx * s;
    out.y = (vy * this.cp - vz * this.sp) * s;
  }

  toward(x: number, y: number, z: number, out: { x: number; y: number; z: number }): void {
    const dx = this.cx - x, dy = this.cy - y, dz = this.cz - z, l = Math.hypot(dx, dy, dz) || 1;
    out.x = dx / l; out.y = dy / l; out.z = dz / l;
  }

  /** the point of the plane z = zp under a screen position */
  unproject(sx: number, sy: number, zp: number): { x: number; y: number } | null {
    const xn = (sx - this.W / 2) / this.f, yn = (sy - this.H / 2) / this.f;
    const dz = this.cp - yn * this.sp;
    if (dz <= 0.001) return null;
    const t = (zp - this.cz) / dz;
    return { x: this.cx + xn * t, y: this.cy + t * (yn * this.cp + this.sp) };
  }

  /** world x range seen at depth z (with a margin) */
  xRange(z: number, margin = 60): [number, number] {
    const d = Math.max(1, (z - this.cz) * this.cp);
    const half = ((this.W / 2) * d) / this.f + margin;
    return [this.cx - half, this.cx + half];
  }
}
