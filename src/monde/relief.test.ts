import { beforeAll, describe, expect, it } from 'vitest';
import { BIOMES, X1, biomeIndex, floorAt } from './biomes';
import { arch, carve, cutAt, faultList, groundAt, initReliefs, overhang, pillar, pushOut, reliefs, solidAt, triangulate, within, type Relief } from './relief';

const flat = () => 500;

/** the normals of the quads point away from `inner` (a point inside the solid) */
function outward(r: Relief, inner: (f: number) => [number, number, number]): number {
  let ok = 0;
  const nf = r.quads.length / 4;
  for (let f = 0; f < nf; f++) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 4; k++) { const v = r.quads[f * 4 + k] * 3; cx += r.p[v] / 4; cy += r.p[v + 1] / 4; cz += r.p[v + 2] / 4; }
    const [ix, iy, iz] = inner(f);
    if (r.n[f * 3] * (cx - ix) + r.n[f * 3 + 1] * (cy - iy) + r.n[f * 3 + 2] * (cz - iz) > 0) ok++;
  }
  return ok / nf;
}

describe('the meshes', () => {
  it('cuts a concave polygon into triangles that cover it exactly', () => {
    // an L
    const xy = [0, 0, 40, 0, 40, 10, 10, 10, 10, 30, 0, 30];
    const t = triangulate(xy, 6);
    expect(t.length).toBe(12);
    let area = 0;
    for (let k = 0; k < t.length; k += 3) {
      const [a, b, c] = [t[k], t[k + 1], t[k + 2]];
      area += Math.abs((xy[b * 2] - xy[a * 2]) * (xy[c * 2 + 1] - xy[a * 2 + 1]) - (xy[b * 2 + 1] - xy[a * 2 + 1]) * (xy[c * 2] - xy[a * 2])) / 2;
    }
    expect(area).toBeCloseTo(40 * 10 + 10 * 20, 5);
  });

  it('turns every face of a pillar outward, and stands it on the floor', () => {
    const r = pillar(100, 0, 300, 40, flat, 0, 7);
    expect(outward(r, (f) => [100, r.p[r.quads[f * 4] * 3 + 1], 0])).toBeGreaterThan(0.95);
    expect(r.y1).toBeCloseTo(504, 0);
    expect(r.y0).toBeLessThan(500 - 300);
  });

  it('turns the faces of an arch outward, around its curve', () => {
    const r = arch(0, -150, 200, 150, 280, 28, 36, flat, 0, 11);
    // the nearest point of the curve is inside: the middle of the face's two rings
    const nu = r.nu, ring = (j: number) => { let x = 0, y = 0, z = 0; for (let i = 0; i < nu; i++) { x += r.p[(j * nu + i) * 3] / nu; y += r.p[(j * nu + i) * 3 + 1] / nu; z += r.p[(j * nu + i) * 3 + 2] / nu; } return [x, y, z]; };
    expect(outward(r, (f) => { const j = Math.floor(f / nu), a = ring(j), b = ring(j + 1); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] as [number, number, number]; })).toBeGreaterThan(0.95);
  });

  it('cuts an arch across the swimming plane into a vault with room under it', () => {
    const r = arch(0, -150, 200, 150, 280, 28, 36, flat, 0, 11);
    const c = cutAt(r, 0);
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < c.length; i += 2) { y0 = Math.min(y0, c[i]); y1 = Math.max(y1, c[i]); }
    expect(c.length).toBeGreaterThan(0);
    // overhead, well clear of the floor, and nothing of it down at the swimmer's height
    expect(500 - y1).toBeGreaterThan(150);
    let x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < c.length; i += 2) { x0 = Math.min(x0, c[i]); x1 = Math.max(x1, c[i]); }
    expect(within(r, (x0 + x1) / 2, 420, 0)).toBe(false);
    expect(within(r, (x0 + x1) / 2, (y0 + y1) / 2, 0)).toBe(true);
  });

  it('keeps a hollow under the shelf of an overhang', () => {
    const r = overhang(0, -60, 300, 280, 150, 200, 70, 1, flat, 0, 5);
    // under the shelf (its foot is 150 wide around x = 0, the shelf reaches 200 further right): rock overhead, water below
    const under = [...Array(40).keys()].map((k) => 500 - 300 + k * 4).filter((y) => within(r, 150, y, 0));
    expect(under.length).toBeGreaterThan(8);
    expect(Math.max(...under)).toBeLessThan(500 - 130);
    expect(within(r, 150, 440, 0)).toBe(false);
    expect(within(r, 0, 400, 0)).toBe(true);
    expect(within(r, 150, 150, 0)).toBe(false);
    expect(r.cap!.length).toBe((r.nu - 2) * 3);
    expect(r.marks!.length).toBeGreaterThan(0);
  });
});

describe('the reliefs of the world', () => {
  beforeAll(() => initReliefs(BIOMES, X1, floorAt));

  it('gives the chapters at least three kinds of relief, and sets chapters apart by them', () => {
    const kinds = new Set<string>(reliefs.map((r) => r.kind));
    if (faultList().length) kinds.add('faille');
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    // what stands in the swimming plane (or opens under it) in each chapter
    const own = new Map<string, Set<string>>();
    for (const r of reliefs) if (r.z0 < 0 && r.z1 > 0) { const id = BIOMES[biomeIndex(r.x)].id; own.set(id, (own.get(id) || new Set()).add(r.kind)); }
    for (const f of faultList()) { const id = BIOMES[biomeIndex(f.x)].id; own.set(id, (own.get(id) || new Set()).add('faille')); }
    const alone = [...own.values()].filter((s) => s.size === 1).map((s) => [...s][0]);
    expect(new Set(alone).size).toBeGreaterThanOrEqual(2);
  });

  it('lays the same world every time', () => {
    const a = reliefs.map((r) => `${r.kind}${Math.round(r.x)}`).join();
    initReliefs(BIOMES, X1, floorAt);
    expect(reliefs.map((r) => `${r.kind}${Math.round(r.x)}`).join()).toBe(a);
  });

  it('never closes the swimming plane: over or under every relief in it, there is room to pass', () => {
    for (const r of reliefs) {
      if (!(r.z0 < 0 && r.z1 > 0)) continue;
      for (let x = r.x0; x <= r.x1; x += 8) {
        const fy = floorAt(x, 0);
        let run = 0, best = 0;
        for (let y = 20; y < fy - 10; y += 4) { run = solidAt(x, y, 0) ? 0 : run + 4; best = Math.max(best, run); }
        expect(best, `${r.kind} at x ${Math.round(x)}`).toBeGreaterThan(90);
      }
    }
  });

  it('carves the faults in the floor, and nothing elsewhere', () => {
    const f = faultList()[0];
    expect(f).toBeDefined();
    expect(carve(f.x, 0)).toBeGreaterThan(f.d * 0.5);
    expect(carve(f.x + f.w * 1.2, 0)).toBe(0);
    expect(carve(BIOMES[1].x0 + 500, 0)).toBe(0);
  });

  it('pushes a swimmer out of a relief, onto its surface', () => {
    const r = reliefs.find((q) => q.kind === 'pilier' && q.z0 < 0 && q.z1 > 0)!;
    const y = (r.y0 + r.y1) / 2;
    const hit = pushOut(r.x, y, 0, 10)!;
    expect(hit).not.toBeNull();
    expect(solidAt(hit.x, hit.y, 0)).toBe(false);
    expect(pushOut(hit.x + hit.nx * 2, hit.y + hit.ny * 2, 0, 10)).toBeNull();
    // behind the swimming plane, the same pillar is not in the way
    expect(pushOut(r.x, y, r.z1 + 20, 10)).toBeNull();
  });

  it('lets what grows at the foot of a pillar grow on its top instead', () => {
    const r = reliefs.find((q) => q.kind === 'pilier' && q.z0 < 0 && q.z1 > 0)!;
    const fy = floorAt(r.x, r.z), top = groundAt(r.x, r.z, fy);
    expect(top).toBeLessThan(fy - 80);
    expect(Math.abs(top - r.y0)).toBeLessThan(60);
    // beside it, the floor
    expect(groundAt(r.x1 + 30, r.z, 480)).toBe(480);
  });
});
