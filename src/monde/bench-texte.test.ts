import { describe, expect, it } from 'vitest';
import { benchText, verdict, type TourLine } from './bench-texte';

const stat = (avg: number) => ({ avg, p95: avg * 1.5 });
const line = (biome: string, fps: number, gpu: number | null): TourLine => ({
  biome, fps, cpu: stat(1000 / fps), perStep: stat(2), render: stat(5), gpu: gpu === null ? null : stat(gpu), near: 12, quality: 0.85, bias: 1.3
});

describe('the verdict of a chapter', () => {
  it('is smooth from 50 frames a second, playable from 30, slow below', () => {
    expect(verdict(60)).toBe('fluide');
    expect(verdict(50)).toBe('fluide');
    expect(verdict(49.9)).toBe('correct');
    expect(verdict(30)).toBe('correct');
    expect(verdict(29)).toBe('lent');
  });
});

describe('the results as text', () => {
  it('says the device, then one line per chapter with its verdict', () => {
    const txt = benchText({
      when: '2026-10-01T10:00:00Z', ua: 'Mozilla/5.0 (Linux; Android 14)', screen: [412, 870, 618, 1305], dpr: 1.5, gpuName: 'Adreno 619', mode: 'tour',
      tour: [line('La Nurserie', 58, 4.2), line('Le Jardin de méduses', 24, null)]
    });
    const rows = txt.split('\n');
    expect(rows[1]).toContain('Android');
    expect(rows[2]).toContain('412×870');
    expect(rows[2]).toContain('Adreno 619');
    const nurserie = rows.find((l) => l.startsWith('La Nurserie'))!, jardin = rows.find((l) => l.startsWith('Le Jardin'))!;
    expect(nurserie.split(' | ')).toHaveLength(10);
    expect(nurserie).toContain('fluide');
    expect(nurserie).toContain('85 %');
    // no time of the GPU where the browser does not give it
    expect(jardin.split(' | ')[5]).toBe('–');
    expect(jardin).toContain('lent');
  });

  it('adds the load of animals when it was measured', () => {
    const txt = benchText({
      when: '', ua: '', screen: [1, 1, 1, 1], dpr: 1, gpuName: '', mode: 'complet', tour: [],
      load: [{ extra: 50, near: 70, fps: 41, cpu: stat(20) }]
    });
    expect(txt).toContain('+50 | 70 | 41 | 20.0');
  });
});
