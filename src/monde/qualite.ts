// When frames are late, the game gives up some quality (main.ts, every 60
// frames): the water stills, then the animals take coarser levels of detail,
// and last the resolution drops. A lower resolution only spares the GPU: when
// the time is spent by the processor (the simulation, the drawing of the
// shapes), it would blur the image for nothing.

/** the frames (avg ms between two) wait on the GPU, not on the processor that spent `cpu` ms on each */
export function gpuBound(avg: number, cpu: number): boolean {
  return cpu < avg * 0.75;
}
