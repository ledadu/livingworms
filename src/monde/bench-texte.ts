// What the bench (?bench) says of each chapter, and its results as a few lines
// of text, to copy from a phone and send.

/** how a chapter runs, by its frames per second: smooth from 50, playable from 30 */
export type Verdict = 'fluide' | 'correct' | 'lent';
export function verdict(fps: number): Verdict {
  return fps >= 50 ? 'fluide' : fps >= 30 ? 'correct' : 'lent';
}

interface Stat { avg: number; p95: number; }
export interface TourLine {
  biome: string; fps: number; cpu: Stat; perStep: Stat; render: Stat; gpu: Stat | null; near: number; quality: number; bias: number;
}
export interface BenchHead { when: string; ua: string; screen: number[]; dpr: number; gpuName: string; mode: string; }

const f1 = (v: number) => v.toFixed(1), f0 = (v: number) => v.toFixed(0);

/** the results as text: the device, then a line per chapter (and per load of animals, if measured) */
export function benchText(r: BenchHead & { tour: TourLine[]; load?: { extra: number; near: number; fps: number; cpu: Stat }[] }): string {
  const lines = [
    `La Lignée — test de performance (${r.mode}) — ${r.when}`,
    r.ua,
    `écran ${r.screen[0]}×${r.screen[1]}, image ${r.screen[2]}×${r.screen[3]} (×${f1(r.dpr)})${r.gpuName ? ' — ' + r.gpuName : ''}`,
    'chapitre | img/s | ms/image (p95) | simu/pas | dessin | GPU | animaux | résolution | biais | verdict'
  ];
  for (const b of r.tour) {
    lines.push([b.biome, f0(b.fps), `${f1(b.cpu.avg)} (${f1(b.cpu.p95)})`, f1(b.perStep.avg), f1(b.render.avg), b.gpu ? f1(b.gpu.avg) : '–',
      String(b.near), `${Math.round(b.quality * 100)} %`, f1(b.bias), verdict(b.fps)].join(' | '));
  }
  if (r.load?.length) {
    lines.push('charge (Récif) | animaux proches | img/s | ms/image');
    for (const b of r.load) lines.push([`+${b.extra}`, String(b.near), f0(b.fps), f1(b.cpu.avg)].join(' | '));
  }
  return lines.join('\n');
}
