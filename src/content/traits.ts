// The traits of a creature, read from its tree of parts (docs/mecaniques.md,
// « L'hérédité : les traits »). A trait is never given apart: it comes from a
// part one can see, so it is found by the role, style and shape of the parts,
// never by their names (the species rename them freely). A bud (NodeDef.bud,
// the first larva's sketched parts) brings no trait.

import { SHAPES, expand, lerp, type NodeDef, type Spec } from '../engine';

export type Trait = 'nageoires' | 'lanterne' | 'pinces' | 'corpsFin' | 'carapace' | 'pulsation' | 'filaments' | 'cils';

export const TRAITS: Trait[] = ['nageoires', 'lanterne', 'pinces', 'corpsFin', 'carapace', 'pulsation', 'filaments', 'cils'];

export const TRAIT_LABELS: Record<Trait, string> = {
  nageoires: 'Nageoires',
  lanterne: 'Lanterne',
  pinces: 'Pinces',
  corpsFin: 'Corps fin',
  carapace: 'Carapace',
  pulsation: 'Pulsation',
  filaments: 'Filaments',
  cils: 'Cils'
};

/** the thresholds of the traits that come from the whole body rather than from one part */
export const TRAIT_THRESHOLDS = {
  /** corps fin: length of the trunk over its largest radius (the eel is at 19, the axolotl at 12) */
  slender: 15,
  /** carapace: share of the surface of the animal in plates */
  plated: 0.4,
  /** pulsation: amplitude of the pulse of the trunk (the jellyfish beat at 0.16 and more, the squid mantle at 0.1) */
  pulse: 0.15,
  /** filaments: a long supple strand, in links and in flex */
  strandLinks: 8,
  strandFlex: 0.3
};

export interface BodyMeasures {
  /** length of the trunk over its largest radius */
  slender: number;
  /** share of the surface of the animal (every copy of every part) drawn in plates, 0 → 1 */
  plated: number;
  /** amplitude of the pulse of the trunk, 0 if it does not pulse */
  pulse: number;
}

// length and largest radius of one chain, as the 3D engine lays it out (Seg3)
function chain(d: NodeDef, scale: number): { len: number; rad: number; area: number } {
  const n = Math.max(1, d.links), lt = d.lenTo === undefined ? 1 : d.lenTo;
  const shape = SHAPES[d.shape] || SHAPES.worm, w = d.width * scale;
  const radAt = (i: number) => Math.max(0.15, shape(w, i / n));
  let len = 0, rad = radAt(0), area = 0;
  for (let i = 1; i <= n; i++) {
    const l = d.len * scale * lerp(1, lt, n > 1 ? (i - 1) / (n - 1) : 0), r = radAt(i);
    len += l; area += l * (radAt(i - 1) + r); rad = Math.max(rad, r);
  }
  return { len, rad, area };
}

export function bodyMeasures(sp: Spec): BodyMeasures {
  const trunk = chain(sp.body, 1);
  let all = 0, plates = 0;
  const visit = (d: NodeDef, scale: number) => {
    const c = chain(d, scale);
    all += c.area;
    if (d.style === 'plates') plates += c.area;
    const n = Math.max(1, d.links);
    for (const a of d.attach) for (const s of expand(a, n)) visit(a.node, scale * s.scale);
  };
  visit(sp.body, 1);
  const m = sp.body.motion;
  return {
    slender: trunk.len / trunk.rad,
    plated: all > 0 ? plates / all : 0,
    pulse: m.type === 'pulse' ? m.amp : 0
  };
}

function isStrand(d: NodeDef): boolean {
  return (d.role === 'whip' || d.role === 'sting' || d.role === 'deco') &&
    d.links >= TRAIT_THRESHOLDS.strandLinks && d.flex >= TRAIT_THRESHOLDS.strandFlex;
}

/** the traits of a creature of this species, in the order of TRAITS */
export function traitsOf(sp: Spec): Trait[] {
  const has = new Set<Trait>();
  const visit = (d: NodeDef, isBody: boolean) => {
    if (d.bud) {
      for (const a of d.attach) visit(a.node, false);
      return;
    }
    if (d.color.glow !== 'none' || d.role === 'light') has.add('lanterne');
    if (!isBody) {
      if (d.role === 'fin') has.add('nageoires');
      if (d.role === 'jaw' && d.style === 'plates') has.add('pinces');
      if (d.role === 'cilia') has.add('cils');
      if (isStrand(d)) has.add('filaments');
    }
    for (const a of d.attach) visit(a.node, false);
  };
  visit(sp.body, true);
  const m = bodyMeasures(sp), T = TRAIT_THRESHOLDS;
  if (m.slender >= T.slender) has.add('corpsFin');
  if (m.plated >= T.plated) has.add('carapace');
  if (sp.swim.mode === 'bell' || m.pulse >= T.pulse) has.add('pulsation');
  return TRAITS.filter((t) => has.has(t));
}

export function hasTrait(sp: Spec, t: Trait): boolean {
  return traitsOf(sp).includes(t);
}
