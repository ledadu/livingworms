// The brood: four children fused from the parent and the partner (docs/mecaniques.md, « La portée »).
// Each child comes from fuse() in 'mix' mode with a partner share around 0.4 (about 60 % of the parent, 40 % of the
// partner), then the limbs the parade was for are handed out: the better the parade, the more children carry them,
// but always at least one, so that a brood never loses what the lineage came for. Every limb of a child keeps where it
// came from, for the screen that shows what each one inherited.

import { att, clone, rng, spec, stats, type AttDef, type Spec } from '../engine';
import { fuse } from './generate';

export type Origin = 'parent' | 'partner';

export interface Child {
  spec: Spec;
  /** the partner's share given to fuse() */
  share: number;
  /** whose body it mostly has (shape, style, motion, colour, way of swimming) */
  body: Origin;
  /** the parts it inherited, by name, without repeats */
  fromParent: string[];
  fromPartner: string[];
}

export interface BroodOptions {
  /** how well the parade went, 0 to 1 */
  quality?: number;
  seed?: number;
  /** the partner's limbs the lineage wants (default: those of a kind, role, the parent does not have) */
  wanted?: (limb: AttDef) => boolean;
}

export const BROOD = 4;
/** the partner's share of each child, around 40 % (shuffled by the seed) */
export const SHARES = [0.3, 0.37, 0.43, 0.5];
const MAX_CHAINS = 170;

const key = (a: AttDef) => JSON.stringify(att(clone(a)));
const uniq = (names: string[]) => [...new Set(names)];

/** how many of the four children carry each wanted limb: 1 after a poor parade, 3 after a perfect one */
export function carriers(quality: number): number {
  return 1 + Math.round(Math.max(0, Math.min(1, quality)) * (BROOD - 2));
}

/** the four children of a brood; same parent, partner and options = same brood */
export function brood(parent: Spec, partner: Spec, o: BroodOptions = {}): Child[] {
  const seed = o.seed ?? Math.floor(Math.random() * 0xfffffff), R = rng(seed);
  const A = spec(clone(parent)), B = spec(clone(partner));
  const fromA = new Set(A.body.attach.map(key)), limbsB = B.body.attach.map((a) => ({ a, k: key(a) }));
  const rolesA = new Set(A.body.attach.map((a) => a.node.role));
  const wanted = limbsB.filter(({ a }) => (o.wanted ? o.wanted(a) : !rolesA.has(a.node.role)));
  const wantedKeys = new Set(wanted.map((w) => w.k));

  const shares = SHARES.slice();
  for (let i = shares.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [shares[i], shares[j]] = [shares[j], shares[i]]; }
  const names = childNames(A.name, B.name);
  const kids = shares.map((share, i) => {
    const sp = fuse(A, B, { mode: 'mix', share, palette: 'mix', seed: seed + 1 + i * 7919 });
    sp.name = names[i];
    return { share, sp };
  });

  // the wanted limbs go to the children closest to the partner first
  const need = carriers(o.quality ?? 0.5);
  const byShare = kids.slice().sort((x, y) => y.share - x.share);
  for (const w of wanted) {
    let have = kids.filter((c) => c.sp.body.attach.some((l) => key(l) === w.k)).length;
    for (const c of byShare) {
      if (have >= need) break;
      if (c.sp.body.attach.some((l) => key(l) === w.k)) continue;
      c.sp.body.attach.push(att(clone(w.a)));
      have++;
    }
  }
  // every child is a child of both: a limb from the one it lacks
  for (const c of kids) {
    const keys = c.sp.body.attach.map(key), body = bodyOrigin(c.sp, A, B);
    if (body === 'parent' && limbsB.length && !limbsB.some((b) => keys.includes(b.k))) c.sp.body.attach.push(att(clone(limbsB[Math.floor(R() * limbsB.length)].a)));
    if (body === 'partner' && A.body.attach.length && !keys.some((k) => fromA.has(k))) c.sp.body.attach.push(att(clone(A.body.attach[Math.floor(R() * A.body.attach.length)])));
  }
  // light enough for a phone: other limbs go first
  for (const c of kids) {
    let guard = 0;
    while (stats(c.sp).chains > MAX_CHAINS && guard++ < 12) {
      const drop = c.sp.body.attach.map((l, i) => ({ l, i })).filter(({ l }) => !wantedKeys.has(key(l)));
      if (!drop.length || c.sp.body.attach.length < 2) break;
      c.sp.body.attach.splice(drop[Math.floor(R() * drop.length)].i, 1);
    }
  }

  return kids.map(({ share, sp }) => {
    const fromParent: string[] = [], fromPartner: string[] = [];
    for (const l of sp.body.attach) {
      const k = key(l);
      if (fromA.has(k)) fromParent.push(l.node.name);
      else if (limbsB.some((b) => b.k === k)) fromPartner.push(l.node.name);
    }
    // fuse() copies the whole body of the closest one: the name goes with the body it mostly has
    const body = bodyOrigin(sp, A, B);
    sp.body.name = (body === 'parent' ? A : B).body.name;
    return { spec: sp, share, body, fromParent: uniq(fromParent), fromPartner: uniq(fromPartner) };
  });
}

/** four different names, each the start of the parent's name and the end of the partner's */
export function childNames(a: string, b: string): string[] {
  const wa = a.split(/[\s-]/)[0], wb = b.split(/[\s-]/)[0];
  const ka = Math.max(2, Math.round(wa.length * 0.5)), kb = Math.max(1, Math.floor(wb.length * 0.4));
  const names: string[] = [];
  for (const [da, db] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [0, 2], [2, 1], [1, 2], [2, 2], [-1, 0]]) {
    const n = wa.slice(0, Math.min(wa.length, ka + da)) + wb.slice(Math.min(wb.length - 1, kb + db));
    const name = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
    if (!names.includes(name)) names.push(name);
    if (names.length === BROOD) return names;
  }
  while (names.length < BROOD) names.push(names[0] + ' ' + 'IVX'.charAt(names.length - 1));
  return names;
}

/** whose body a child has: the features where parent and partner differ, counted */
function bodyOrigin(c: Spec, a: Spec, b: Spec): Origin {
  const j = JSON.stringify;
  const feats: [unknown, unknown, unknown][] = [
    [c.body.shape, a.body.shape, b.body.shape], [c.body.style, a.body.style, b.body.style],
    [j(c.body.motion), j(a.body.motion), j(b.body.motion)], [j(c.body.color), j(a.body.color), j(b.body.color)],
    [c.swim.mode, a.swim.mode, b.swim.mode]
  ];
  let fromA = 0, fromB = 0;
  for (const [x, y, z] of feats) if (y !== z) { if (x === y) fromA++; else if (x === z) fromB++; }
  return fromB > fromA ? 'partner' : 'parent';
}
