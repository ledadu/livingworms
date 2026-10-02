// Steered by the player (docs/mecaniques.md, « Piloter »): whatever its way of swimming, the swimmer goes where it
// is told, at an even pace. Its body keeps its own gait (a bell beats and leans, a jet pulses and turns its mantle, a
// walker steps and paddles): only the jerks of the strokes are smoothed out of its course. The animals of the sea
// are not steered, and keep them.

/** how much faster a piloted bell or jet goes on its stroke than between two: a gentle surge, not a jerk */
export const SURGE = 0.2;

/**
 * The pace of a piloted bell or jet at this power stroke (0..1, a quarter on average over a beat): 1 - SURGE
 * between two strokes, up to 1 + 3 SURGE at the height of one, about 1 over a beat.
 */
export function surge(stroke: number): number {
  return 1 + SURGE * (4 * stroke - 1);
}

/** a piloted bell left alone hovers where it is: a little up on each beat, a little down between two, nowhere over a beat */
export function hover(stroke: number): number {
  return 0.5 * (0.25 - stroke);
}

/** a piloted jet turning round goes a little slower (align: 1 facing its way, 0 across it), never as slow as a free one */
export function turnPace(align: number): number {
  return 0.7 + 0.3 * align;
}
