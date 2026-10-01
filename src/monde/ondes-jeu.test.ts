import { describe, expect, it } from 'vitest';
import type { Creature3 } from '../engine3/creature3';
import { View } from '../engine3/view';
import { RINGS, callGap } from './ondes';
import { initOndes, type OndesDeps } from './ondes-jeu';

/** a creature reduced to what the water sees of it: its nodes, its size, its speed */
function body(x: number, y: number, z = 0, rad = 6, n = 5): Creature3 {
  const f = (v: number) => new Float32Array(n).fill(v);
  return { root: { x: f(x), y: f(y), z: f(z), rad: f(rad) }, vx: 0, vy: 0 } as unknown as Creature3;
}

function setup(o: Partial<OndesDeps> = {}) {
  const view = new View();
  view.resize(1000, 700);
  view.aim(0, 300, 900, 0.12);
  const answers: { cr: Creature3 | null; start: number; echo: number; hue: number }[] = [];
  let bloomed = false;
  const ondes = initOndes({
    gx: null, view, vents: [], floorAt: () => 2000, ceilAt: () => -Infinity, swimmer: () => body(0, 300), visitors: [], skip: new Set(),
    answers: () => answers, bloomed: () => bloomed, stirring: () => [], ...o
  });
  return { ondes, view, answers, bloom: () => { bloomed = true; } };
}

describe('the water that bends, in the game', () => {
  it('sends a wave with each note, in its colour; an answer as wide as the animal', () => {
    const { ondes } = setup();
    ondes.step(10, 0, 300);
    ondes.sung('song', body(0, 300), 'recif');
    ondes.sung('answer', body(200, 280, 70, 4), 'recif');
    ondes.sung('answer', body(-200, 280, 70, 20), 'recif');
    const [song, small, big] = ondes.rings;
    expect(song).toMatchObject({ kind: 'song', x: 0, y: 300, t0: 10, size: RINGS.song.size });
    // the coral of the Récif, a little paler
    expect(song.rgb[0]).toBeGreaterThan(song.rgb[2]);
    expect(Math.min(...song.rgb)).toBeGreaterThanOrEqual(0.25);
    expect(big.size).toBeGreaterThan(small.size);
    expect(small.z).toBe(70);
  });

  it('lets the big animals cry now and then, when they can be seen, twice in a row', () => {
    const seen = body(100, 260, 1400), hidden = body(40000, 260, 1400);
    const { ondes } = setup({ visitors: [{ cr: seen }, { cr: hidden }] });
    const calls = () => ondes.rings.filter((r) => r.kind === 'call');
    let t = 0;
    ondes.step(t, 0, 300);
    const first = 4 + callGap(0, -1) * 0.25;
    for (; t < first - 0.1; t += 0.5) ondes.step(t, 0, 300);
    expect(calls()).toHaveLength(0);
    for (; t < first + 0.6; t += 0.5) ondes.step(t, 0, 300);
    expect(calls()).toHaveLength(2);
    const [a, b] = calls();
    expect(a.x).toBe(100);
    expect(b.t0 - a.t0).toBeCloseTo(1.6);
    expect(b.size).toBeLessThan(a.size);
    // not again before its next gap (the first cry has died out by then)
    const at = a.t0;
    for (; t < at + callGap(0, 0) - 0.6; t += 0.5) ondes.step(t, 0, 300);
    expect(calls().filter((r) => r.t0 > at + 2)).toHaveLength(0);
    for (; t < at + callGap(0, 0) + 0.6; t += 0.5) ondes.step(t, 0, 300);
    expect(calls().filter((r) => r.t0 > at + 2).length).toBeGreaterThan(0);
    expect(calls().every((r) => r.x === 100)).toBe(true);
  });

  it('flashes a wave from the lights of the Fosse, three times as they answer, then at each echo and at the bloom', () => {
    const { ondes, answers, bloom } = setup();
    const a = { cr: null as Creature3 | null, start: 5, echo: -1, hue: 200 };
    answers.push(a);
    const lights = () => ondes.rings.filter((r) => r.kind === 'light').length;
    let t = 0;
    for (; t < 5; t += 0.1) ondes.step(t, 0, 300);
    expect(lights()).toBe(0);
    a.cr = body(300, 200);
    for (; t < 7; t += 0.1) ondes.step(t, 0, 300);
    expect(lights()).toBe(3);
    a.echo = t;
    ondes.step(t + 0.1, 0, 300);
    ondes.step(t + 0.2, 0, 300);
    expect(lights()).toBe(4);
    bloom();
    ondes.step(t + 0.3, 0, 300);
    ondes.step(t + 0.4, 0, 300);
    expect(lights()).toBe(5);
    // in its own colour: a blue light, a blue wave
    const w = ondes.rings.find((r) => r.kind === 'light')!;
    expect(w.rgb[2]).toBeGreaterThan(w.rgb[0]);
  });

  it('drops the rings gone, even with nothing to draw them (the 2D canvas)', () => {
    const { ondes } = setup();
    // nothing shimmers on the 2D canvas: nothing to still when the frames are late
    expect(ondes.ease()).toBe(false);
    ondes.step(0, 0, 300);
    for (let k = 0; k < 50; k++) ondes.sung('song', body(0, 300), 'nurserie');
    expect(ondes.rings).toHaveLength(50);
    ondes.step(RINGS.song.dur + 0.1, 0, 300);
    expect(ondes.rings).toHaveLength(0);
  });

  it('in the field of waves, drops the song into the water, and the swimmers stir it', () => {
    const swimmer = body(0, 300);
    const { ondes } = setup({ stirring: () => [swimmer] });
    ondes.mode = 'champ';
    ondes.step(0, 0, 300);
    expect(ondes.field).not.toBeNull();
    ondes.sung('song', swimmer, 'nurserie');
    expect(ondes.rings).toHaveLength(0);
    expect(ondes.field!.at(0, 300)).toBeLessThan(0);
    // the far cries stay rings: they are not in the swimming plane
    ondes.ring('call', 100, 200, 1400);
    expect(ondes.rings).toHaveLength(1);
    // a swimmer that moves leaves a wake
    const quiet = setup({ stirring: () => [swimmer] }).ondes;
    quiet.mode = 'champ';
    quiet.step(0, 0, 300);
    (swimmer as { vx: number }).vx = 2;
    quiet.step(1 / 60, 0, 300);
    expect(quiet.field!.at(0, 300)).toBeLessThan(0);
    ondes.mode = 'anneaux';
    ondes.step(1, 0, 300);
    expect(ondes.field).toBeNull();
  });
});
