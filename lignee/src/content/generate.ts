// Generator: seeded, by family and mood, and fusion of two species.
// Same seed + same settings = same creature. Every family is a small recipe:
// a body, then head / side / tail parts, then nesting and light depending on
// complexity and bioluminescence.

import {
  att, clamp, clone, lerp, rng, spec, stats,
  type AttDef, type AttInput, type ColorDef, type NodeDef, type NodeInput, type PaletteDef, type Spec, type SwimDef, type Ai, type EyesDef
} from '../engine';
import { part } from './parts';

export function newSeed(): number { return Math.floor(Math.random() * 0xfffffff); }

export interface GenerateOptions { archetype?: string; mood?: string; complexity?: number; glow?: number; seed?: number; }
export interface FuseOptions { mode?: string; share?: number; palette?: 'mix' | 'a' | 'b'; seed?: number; }
type Body = NodeInput & { color: Partial<ColorDef>; attach?: AttInput[] };
// ----- generator: seeded, by family and mood ----- //
// Same seed + same settings = same creature. Every family is a small recipe:
// a body, then head / side / tail parts, then nesting and light depending on
// complexity and bioluminescence.

export const FAMILIES: [string, string][] = [
  ['any', 'Au hasard'], ['fish', 'Poisson'], ['jelly', 'Méduse'], ['crustacean', 'Crustacé'],
  ['cephalopod', 'Céphalopode'], ['worm', 'Ver'], ['radial', 'Radiaire'], ['chimera', 'Chimère']
];
export const MOODS: [string, string][] = [['any', 'Au hasard'], ['reef', 'Récif'], ['abyss', 'Abysses'], ['pastel', 'Pastel'], ['mono', 'Mono'], ['wild', 'Sauvage']];

const SYL1 = ['Aby', 'Lumi', 'Cten', 'Hydr', 'Noct', 'Vitr', 'Spir', 'Thal', 'Myr', 'Pel', 'Bathy', 'Cor', 'Aur', 'Sel', 'Pyro', 'Glau', 'Nere', 'Opal', 'Zeph', 'Cala'];
const SYL2 = ['ella', 'opsis', 'ura', 'ax', 'ina', 'ops', 'aria', 'onia', 'eus', 'ix', 'ida', 'oma', 'ellus', 'ides'];
const EPITHET: Record<string, string> = { reef: 'corallina', abyss: 'abyssalis', pastel: 'pallida', mono: 'unicolor', wild: 'mirabilis' };

export function generate(opt: GenerateOptions = {}): Spec {
  const o = { archetype: 'any', mood: 'any', complexity: 0.5, glow: 0.3, ...opt, seed: opt.seed ?? newSeed() };
  var R = rng(o.seed);
  function r(a: number, b: number): number { return a + R() * (b - a); }
  function ri(a: number, b: number): number { return Math.floor(r(a, b + 1)); }
  function pk<T>(list: T[]): T { return list[Math.floor(R() * list.length)]; }
  function chance(p: number): boolean { return R() < p; }

  var arch = o.archetype === 'any' ? pk(['fish', 'fish', 'jelly', 'crustacean', 'cephalopod', 'worm', 'radial', 'chimera']) : o.archetype;
  var mood = o.mood === 'any' ? pk(['reef', 'abyss', 'pastel', 'mono', 'wild']) : o.mood;
  var c = o.complexity, g = o.glow;

  const pal = ({
    reef:   { hue: ri(0, 359), harmony: pk(['triad', 'complement', 'split'] as const), sat: ri(75, 95), light: ri(50, 60) },
    abyss:  { hue: ri(190, 310), harmony: pk(['split', 'complement', 'analog'] as const), sat: ri(45, 70), light: ri(18, 32) },
    pastel: { hue: ri(0, 359), harmony: pk(['analog', 'triad'] as const), sat: ri(30, 50), light: ri(70, 82) },
    mono:   { hue: ri(0, 359), harmony: 'mono' as const, sat: ri(60, 85), light: ri(45, 60) },
    wild:   { hue: ri(0, 359), harmony: pk(['analog', 'complement', 'triad', 'split', 'mono'] as const), sat: ri(40, 95), light: ri(25, 70) }
  } as Record<string, PaletteDef>)[mood];
  if (mood === 'abyss') g = Math.min(1, g + 0.35);
  var translucent = mood === 'pastel' || arch === 'jelly';

  // helpers
  function P(id: string, nodeOver?: NodeInput | null, attOver?: AttInput | null): AttDef { return part(id, nodeOver, attOver); }
  function motif(col: Partial<ColorDef>): Partial<ColorDef> {
    if (!chance(0.35 + c * 0.3)) return col;
    col.pattern = pk(['bands', 'spots', 'stripe', 'ocelli', 'edge'] as const);
    col.pslot = ri(1, 3);
    col.pdensity = ri(3, 10);
    col.pscale = r(0.7, 1.6);
    col.plight = mood === 'abyss' ? ri(10, 30) : ri(-10, 20);
    return col;
  }
  function glowTip(a: AttDef): AttDef {
    if (chance(g)) a.node.color.glow = 'tip';
    return a;
  }
  // with complexity, parts grow sub-parts at their tip
  function nest(a: AttDef, depth = 1): AttDef {
    var role = a.node.role;
    if (depth > 2 || !chance(c * 0.55)) return a;
    let sub: string;
    if (role === 'whip') sub = pk(['dard', 'cils', 'dard']);
    else if (role === 'sense') sub = pk(['cils', 'photophore']);
    else if (a.node.name === 'Feuille') sub = 'feuille';
    else return a;
    var s = P(sub, sub === 'feuille' ? { name: 'Foliole', links: 3, width: 2 } : null, sub === 'feuille' ? { at: 0.4, to: 1, count: 2 } : null);
    if (sub === 'cils') { s.at = 0.3; s.to = 1; s.count = ri(3, 6); s.edge = 0; }
    a.node.attach.push(nest(glowTip(s), depth + 1));
    return a;
  }
  function jit(a: AttDef): AttDef { if (chance(0.4)) a.jitter = r(0.15, 0.6); return a; }
  function slot(a: AttDef): AttDef { if (chance(0.35)) a.node.color.slot = ri(0, 3); return a; }

  let body!: Body, swim!: Partial<SwimDef>, ai!: Ai;
  const attach: AttInput[] = [], eyes: Partial<EyesDef> = { on: false, size: r(0.6, 1.1) };

  function makeFish() {
    body = { name: 'Corps', links: ri(7, 14), len: r(4.5, 7), width: r(5, 9), shape: pk(['spindle', 'tadpole', 'worm', 'sansueBigHead']), style: 'ribbon',
      flex: r(0.15, 0.35), spring: r(0.1, 0.25), drag: 0.8, color: motif({ slot: 0, grad: ri(-15, 10) }),
      motion: { type: 'undulate', amp: r(0.06, 0.12), freq: r(0.7, 1.4) } };
    attach.push(slot(P(pk(['nageoire', 'rayons', 'nageoire']), null, { at: r(0.15, 0.35) })));
    var tail = pk(['caudale', 'voile', 'lobes', 'caudale']);
    if (tail === 'lobes') attach.push(P('nageoire', { name: 'Lobe caudal', links: 4, width: r(2.5, 4), curl: 0.3, motion: { type: 'none' } }, { at: 1, angle: r(0.3, 0.6), edge: 0 }));
    else attach.push(jit(P(tail, { color: { slot: ri(0, 2) } }, { count: ri(4, 9) })));
    if (chance(0.3)) attach.push(P('barbillon'));
    if (chance(c * 0.6)) attach.push(jit(P(pk(['feuille', 'rayons']), { color: { slot: ri(1, 3) } },
      { pattern: 'series', at: 0.1, to: 0.6, count: ri(4, 8), angle: 0.9, alternate: true, web: 0, mirror: false })));
    if (chance(g * 0.7)) attach.push(P('photophore', null, { count: ri(3, 7) }));
    if (chance(g * 0.5)) attach.push(P('lanterne'));
    eyes.on = true;
    swim = { mode: 'steady', speed: r(1.2, 2.4) };
    ai = pk<Ai>(['prey', 'prey', 'hunter']);
  }
  function makeJelly() {
    body = { name: 'Ombrelle', links: ri(4, 5), len: r(3.5, 5), width: r(9, 14), shape: 'bell', style: 'ribbon', flex: 0.05, spring: 0.6, drag: 0.8,
      color: motif({ slot: 0, alpha: r(0.35, 0.7), add: chance(0.7), glow: chance(g + 0.2) ? 'body' : 'none' }),
      motion: { type: 'pulse', amp: r(0.14, 0.24), freq: r(0.5, 1.1) } };
    var fil = P('filament', { links: ri(14, 28), color: { slot: ri(1, 3), glow: chance(g) ? 'tip' : 'none' } }, { count: ri(6, 10 + Math.round(c * 8)), spread: r(0.9, 1.5) });
    if (chance(0.3)) {
      // box jelly: pedalia carrying bundles of filaments
      fil.count = 3; fil.spread = 0.3; fil.edge = 0.4; fil.at = 1;
      attach.push({ node: { name: 'Pédalie', links: 2, len: 2.5, width: 1.6, shape: 'leaf', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 0, alpha: 0.5, add: true }, attach: [fil] },
        pattern: 'fan', at: 1, count: 4, spread: 1.4, edge: 1, angle: 0 });
    } else attach.push(jit(fil));
    if (chance(0.65)) attach.push(P('brasOral', { links: ri(10, 18), color: { slot: ri(1, 2) } }, { count: ri(3, 5) }));
    if (chance(c * 0.4)) attach.push(P('couronne', { links: 4, width: 1, color: { slot: 3 } }, { at: 1, count: ri(8, 14), scale: 0.5 }));
    swim = { mode: 'bell', speed: r(1, 2), freq: body.motion!.freq };
    ai = 'drifter';
  }
  function makeCrustacean() {
    body = { name: 'Carapace', links: ri(9, 13), len: r(5, 6.5), width: r(5, 7.5), shape: 'carapace', style: 'plates', flex: 0.14, spring: 0.3, drag: 0.8,
      color: motif({ slot: 0, grad: ri(-10, 5) }) };
    attach.push(P('antenne', { links: ri(14, 26), color: { slot: ri(1, 3) } }, { angle: r(2.5, 2.9) }));
    if (chance(0.6)) attach.push(P('antenne', { name: 'Antennule', links: ri(6, 10), curl: 1, width: 0.4, color: { slot: 3 } }, { at: 0.02, angle: 2.3 }));
    attach.push(P('oeil', null, { at: 0.05, angle: 2.2, edge: 0.75 }));
    if (chance(0.5)) attach.push(P('rostre'));
    if (chance(0.5)) attach.push(P('pinceHomard', { width: r(2.6, 3.8) }));
    attach.push(jit(P(pk(['patte', 'patteMarche']), null, { count: ri(3, 5) })));
    attach.push(P('pleopode', { color: { slot: ri(1, 3) } }, { count: ri(3, 6) }));
    attach.push(P('eventail', { color: { slot: ri(0, 2) } }));
    if (chance(g * 0.7)) attach.push(P('photophore', null, { count: ri(3, 5), at: 0.2, to: 0.7 }));
    swim = { mode: 'crawl', speed: r(1.2, 1.8) };
    ai = pk<Ai>(['prey', 'hunter']);
  }
  function makeCephalopod() {
    body = { name: 'Manteau', links: ri(5, 9), len: r(5, 7), width: r(7, 10), shape: pk(['spindle', 'bloby']), style: 'ribbon', flex: 0.1, spring: 0.4, drag: 0.8,
      color: motif({ slot: 0, grad: ri(0, 12) }), motion: { type: 'breathe', amp: 0.07, freq: r(0.4, 0.8) } };
    attach.push(P('oeil', { links: 1, len: 1.5, width: r(1.8, 2.5), color: { slot: ri(1, 3) } }, { at: 0.85, angle: 1.57, edge: 0.9, front: true }));
    var arms = P('bras', { links: ri(8, 14), color: motif({ slot: 0 }) }, { count: ri(6, 10), spread: r(0.7, 1.4), web: chance(0.4) ? r(0.15, 0.35) : 0 });
    attach.push(nest(arms));
    if (chance(0.6)) attach.push(glowTip(P('massue', { links: ri(10, 16) })));
    attach.push(chance(0.5) ? P('collerette', { color: { slot: 0, alpha: 0.7, light: 10 } }) : P('nageoire', { width: r(3.5, 5.5), links: 4, color: { slot: 0, alpha: 0.8 } }, { at: 0.05, angle: 2.3, edge: 0.6 }));
    swim = { mode: 'jet', speed: r(1.5, 2.4), freq: r(0.5, 0.9), walk: chance(0.5), rear: true, posture: -0.9 };
    ai = 'hunter';
  }
  function makeWorm() {
    body = { name: 'Corps', links: ri(16, 26), len: r(4, 6), width: r(3, 5.5), shape: pk(['worm', 'sansueBigHead', 'spindle']), style: pk(['plates', 'ribbon'] as const),
      flex: r(0.25, 0.4), spring: r(0.05, 0.12), drag: 0.8, color: motif({ slot: 0, grad: ri(-12, 12) }),
      motion: { type: 'undulate', amp: r(0.06, 0.12), freq: r(0.6, 1.1) } };
    attach.push(jit(P(pk(['parapode', 'cils', 'cerates', 'feuille', 'pleopode']), null, { count: ri(6, 10 + Math.round(c * 6)) })));
    var head = pk(['radiole', 'antenne', 'barbillon', 'rhino']);
    if (head === 'rhino') attach.push(P('antenne', { name: 'Rhinophore', links: 4, len: 3, width: 1.4, style: 'ribbon', curl: -0.4, color: { slot: 2 } }, { at: 0.02, angle: 2.7 }));
    else attach.push(nest(P(head, null, head === 'radiole' ? { count: ri(4, 7) } : null)));
    if (chance(0.3)) attach.push(glowTip(P('dard')));
    eyes.on = chance(0.4);
    swim = { mode: 'steady', speed: r(0.8, 1.6) };
    ai = pk<Ai>(['prey', 'drifter']);
  }
  function makeRadial() {
    body = { name: 'Disque', links: 1, len: 2, width: r(5, 9), shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5, color: motif({ slot: 0 }) };
    var first = pk(['brasEtoile', 'couronne', 'epines']);
    var r1 = P(first, { color: motif({ slot: ri(0, 1) }) }, { count: first === 'brasEtoile' ? ri(5, 8) : ri(10, 22) });
    if (first === 'brasEtoile' && chance(0.5)) { r1.node.links = ri(10, 14); r1.node.width = r(1.2, 2); r1.node.flex = 0.45; r1.node.motion = { type: 'curl', amp: 1.4, freq: 0.5, wave: 1 }; }
    attach.push(jit(r1));
    if (chance(0.5 + c * 0.3)) {
      var second = pk(['couronne', 'epines']);
      attach.push(jit(P(second, { links: 4, color: { slot: ri(2, 3) } }, { count: ri(8, 14), scale: 0.6, edge: 0.4, angle: Math.PI / 12 })));
    }
    swim = { mode: 'steady', speed: r(0.3, 0.7) };
    ai = pk<Ai>(['prey', 'drifter']);
  }

  const build: Record<string, () => void> = { fish: makeFish, jelly: makeJelly, crustacean: makeCrustacean, cephalopod: makeCephalopod, worm: makeWorm, radial: makeRadial };
  if (arch === 'chimera') {
    // a body from one family, limbs borrowed from the others
    build[pk(['fish', 'worm', 'cephalopod', 'crustacean'])]();
    var extra = ri(1, 2 + Math.round(c * 2));
    for (var k = 0; k < extra; k++) {
      var id = pk(['tentacule', 'aile', 'rayons', 'feuille', 'cerates', 'bras', 'pinceHomard', 'lanterne', 'voile', 'branchie', 'collerette']);
      attach.push(nest(slot(jit(P(id)))));
    }
    if (chance(0.5)) attach.push(glowTip(P('dard', { width: 2.4 })));
    ai = 'hunter';
    eyes.on = chance(0.7);
  } else {
    build[arch]();
  }
  attach.forEach((a) => { if (a.node && a.node.role === 'whip') nest(a as AttDef); });
  if (translucent && arch !== 'jelly') { body.color.alpha = r(0.6, 0.85); }
  body.attach = attach;

  var name = pk(SYL1) + pk(SYL2);
  var ep = g > 0.65 ? 'lucens' : EPITHET[mood];
  if (ep && chance(0.7)) name += ' ' + ep;
  const sp = spec({ name: name, size: r(0.8, 1.25), palette: pal, swim: swim, ai: ai, eyes: eyes, body: body,
    gen: { seed: o.seed, archetype: arch, mood: mood, complexity: c, glow: o.glow } });
  // keep generated species light enough for a phone
  var guard = 0;
  while (stats(sp).chains > 150 && sp.body.attach.length > 1 && guard++ < 10) sp.body.attach.pop();
  return sp;
}

export function randomSpecies(): Spec { return generate({}); }

// ----- fusion ----- //
// modes: mix (bodies blended, limbs of both), bodyA / bodyB (one body, limbs
// from the other), chimera (every limb of both), graft (B becomes a limb of A)

export const FUSIONS: [string, string, string][] = [
  ['mix', 'Mélange', 'Les deux corps se mélangent, chaque membre vient de l\'un ou de l\'autre.'],
  ['bodyA', 'Corps de A', 'Garde le corps de A et lui donne des membres de B.'],
  ['bodyB', 'Corps de B', 'Garde le corps de B et lui donne des membres de A.'],
  ['chimera', 'Chimère', 'Le corps de A porte tous les membres des deux espèces.'],
  ['graft', 'Greffe', 'B tout entier devient une paire de membres de A.']
];

const NUM_KEYS: ('links' | 'len' | 'width' | 'flex' | 'spring' | 'curl' | 'curlBias' | 'drag' | 'lenTo' | 'gravity')[] = ['links', 'len', 'width', 'flex', 'spring', 'curl', 'curlBias', 'drag', 'lenTo', 'gravity'];

function blendName(a: string, b: string, share: number, R?: () => number): string {
  var wa = a.split(' ')[0], wb = b.split(' ')[0], j = R ? Math.floor(R() * 3) - 1 : 0;
  var cutA = Math.max(2, Math.round(wa.length * (1 - share * 0.6) * 0.6) + j), cutB = clamp(Math.round(wb.length * 0.5) - j, 1, wb.length - 1);
  var n = wa.slice(0, cutA) + wb.slice(cutB);
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

export function fuse(a: Spec, b: Spec, opt: FuseOptions = {}): Spec {
  const o = { mode: 'mix', share: 0.5, palette: 'mix', ...opt, seed: opt.seed ?? newSeed() };
  var R = rng(o.seed), sh = clamp(o.share, 0, 1);
  function takeB(p: number): boolean { return R() < p; }
  const A = spec(clone(a)), B = spec(clone(b));
  let out: Spec;
  var limbsA = A.body.attach, limbsB = B.body.attach;

  if (o.mode === 'bodyB') {
    out = spec(clone(B));
    out.body.attach = limbsB.filter(function () { return R() < 0.35; })
      .concat(limbsA.filter(function () { return R() < 1 - sh * 0.5; }));
  } else if (o.mode === 'bodyA' || o.mode === 'chimera' || o.mode === 'graft') {
    out = spec(clone(A));
    if (o.mode === 'bodyA') {
      out.body.attach = limbsA.filter(function () { return R() < 0.35 + (1 - sh) * 0.5; })
        .concat(limbsB.filter(function () { return R() < 0.3 + sh * 0.7; }));
    } else if (o.mode === 'chimera') {
      out.body.attach = limbsA.concat(limbsB.map(function (x) { const y = att(clone(x)); y.scale *= 0.6 + sh * 0.6; return y; }));
    } else {
      var bodyB = clone(B.body);
      bodyB.role = 'whip';
      out.body.attach = limbsA.concat([att({ node: bodyB, pattern: 'pair', at: clamp(sh, 0.05, 0.95), angle: 1.1 + R() * 0.8, edge: 0.7, scale: 0.35 + R() * 0.3 })]);
    }
  } else {
    // mix: numbers blended, style and shape from one or the other, limbs from both
    out = spec(clone(sh < 0.5 ? A : B));
    NUM_KEYS.forEach(function (k) {
      const v = lerp(A.body[k] || 0, B.body[k] || 0, sh);
      (out.body as NodeDef)[k] = k === 'links' ? Math.max(1, Math.round(v)) : v;
    });
    out.body.shape = takeB(sh) ? B.body.shape : A.body.shape;
    out.body.style = takeB(sh) ? B.body.style : A.body.style;
    out.body.motion = clone(takeB(sh) ? B.body.motion : A.body.motion);
    out.body.color = clone(takeB(sh) ? B.body.color : A.body.color);
    out.swim = clone(takeB(sh) ? B.swim : A.swim);
    out.body.attach = limbsA.filter(function () { return R() < 1 - sh * 0.8; })
      .concat(limbsB.filter(function () { return R() < 0.2 + sh * 0.8; }));
    out.size = lerp(A.size || 1, B.size || 1, sh);
  }
  if (!out.body.attach.length) out.body.attach = (limbsB.length ? limbsB : limbsA).slice(0, 1);
  out.body.attach = out.body.attach.map(function (x) { return att(clone(x)); });

  // palette
  if (o.palette === 'b') out.palette = clone(B.palette);
  else if (o.palette === 'a') out.palette = clone(A.palette);
  else {
    var dh = ((B.palette.hue - A.palette.hue + 540) % 360) - 180;
    out.palette = {
      hue: Math.round((A.palette.hue + dh * sh + 360) % 360),
      harmony: sh < 0.5 ? A.palette.harmony : B.palette.harmony,
      sat: Math.round(lerp(A.palette.sat, B.palette.sat, sh)),
      light: Math.round(lerp(A.palette.light, B.palette.light, sh))
    };
  }
  out.name = blendName(A.name, B.name, sh, R);
  out.gen = null;
  out = spec(out);
  var guard = 0;
  while (stats(out).chains > 170 && out.body.attach.length > 1 && guard++ < 12) out.body.attach.splice(Math.floor(R() * out.body.attach.length), 1);
  return out;
}

export function cross(a: Spec, b: Spec): Spec { return fuse(a, b, { mode: 'bodyA', share: 0.5 }); }
