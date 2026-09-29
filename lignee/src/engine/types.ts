// Species definitions: a species is a tree of parts. Each part is a whip
// (a verlet chain with an angle limit) and carries attachments that place
// copies of child parts on it with a pattern.

export type Role = 'body' | 'whip' | 'sting' | 'jaw' | 'fin' | 'cilia' | 'light' | 'sense' | 'deco';
export type Style = 'ribbon' | 'plates' | 'line' | 'disc' | 'eye';
export type MotionType = 'none' | 'wave' | 'row' | 'flutter' | 'pulse' | 'breathe' | 'undulate' | 'curl' | 'recoil';
export type Pattern = 'single' | 'pair' | 'fan' | 'series' | 'ring';
export type Motif = 'none' | 'bands' | 'spots' | 'stripe' | 'ocelli' | 'edge';
export type Glow = 'none' | 'tip' | 'body';
export type Harmony = 'analog' | 'complement' | 'triad' | 'split' | 'mono';
/**
 * How the animal gets about (3D engine; the 2D one treats the new ones as steady):
 *  - steady / pulse / dart: it glides head first, in profile, like a fish;
 *  - bell: a jellyfish, bell up, that pushes itself up in pulses, leans to go
 *    sideways and only sinks to go down, with no left/right profile;
 *  - jet: mantle first by jets, the arms trailing; arms first (parachute) when it goes down;
 *  - crawl: walks on the floor, in the 3/4 view, in any direction, legs moving only when it moves.
 */
export type SwimMode = 'steady' | 'pulse' | 'dart' | 'bell' | 'jet' | 'crawl';
export type Ai = 'hunter' | 'prey' | 'drifter';

export interface ColorDef {
  slot: number; shift: number; light: number; grad: number; alpha: number; fade: number;
  glow: Glow; add: boolean;
  pattern: Motif; pslot: number; plight: number; pdensity: number; pscale: number;
}

export interface MotionDef { type: MotionType; amp: number; freq: number; wave: number; }

export interface NodeDef {
  name: string; role: Role;
  links: number; len: number; width: number; shape: string; style: Style;
  flex: number; spring: number; curl: number; curlBias: number; drag: number; gravity: number; lenTo: number;
  color: ColorDef; motion: MotionDef; attach: AttDef[];
}

export interface AttDef {
  pattern: Pattern; at: number; to: number; count: number;
  angle: number; angleTo: number | null; spread: number; edge: number;
  scale: number; scaleTo: number; phaseStep: number;
  mirror: boolean; front: boolean; alternate: boolean;
  jitter: number; web: number; hueStep: number;
  node: NodeDef;
}

export interface PaletteDef { hue: number; harmony: Harmony; sat: number; light: number; }
export interface SwimDef {
  mode: SwimMode; speed: number; freq: number;
  /** walks on the floor when it is on it (a jet swimmer like the octopus) */
  walk?: boolean;
  /** the tail end leads (arms first) when it crawls */
  rear?: boolean;
  /** pitch of the head end (rad, negative = raised): when it crawls, and for a glider that swims upright, like a seahorse */
  posture?: number;
  /** largest pitch of a glider (rad, default 1.2): a manta or a turtle stays nearly level */
  pitchMax?: number;
}
export interface EyesDef { on: boolean; size: number; spread: number; fwd: number; }
export interface GenInfo { seed: number; archetype: string; mood: string; complexity: number; glow: number; }

export interface Spec {
  v: 2; name: string; size: number;
  palette: PaletteDef; swim: SwimDef; ai: Ai; eyes: EyesDef;
  body: NodeDef; gen?: GenInfo | null;
}

// loose inputs: every field optional, filled with defaults by node() / att() / spec()
export type NodeInput = Partial<Omit<NodeDef, 'color' | 'motion' | 'attach'>> & {
  color?: Partial<ColorDef>; motion?: Partial<MotionDef>; attach?: AttInput[];
};
export type AttInput = Partial<Omit<AttDef, 'node'>> & { node?: NodeInput };
export type SpecInput = Partial<Omit<Spec, 'body' | 'palette' | 'swim' | 'eyes' | 'v'>> & {
  palette?: Partial<PaletteDef>; swim?: Partial<SwimDef>; eyes?: Partial<EyesDef>; body?: NodeInput;
};

export interface PaletteSlot { h: number; s: number; l: number; }

export type Box = [number, number, number, number];
