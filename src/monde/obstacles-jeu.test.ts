import { describe, expect, it } from 'vitest';
import type { Spec } from '../engine';
import { SPECIES, firstAncestor } from '../content/species';
import { GATES, WORLD_END, newLimits, pass, travel } from './limites';
import { OBSTACLE } from './obstacles';
import { createKeys } from './obstacles-jeu';

const gate = (c: string) => GATES.find((g) => g.chapter === c)!.x;

describe('the key obstacles in the game', () => {
  it('stops the larva at the current of the Récif, and lets a fish through to the kelp', () => {
    let body: Spec = firstAncestor();
    const l = newLimits(), keys = createKeys(l, () => body);
    expect(keys.bounds()[1]).toBe(gate('recif'));
    body = SPECIES.poissonClown();
    expect(keys.bounds()[1]).toBe(gate('foret'));
    // gone past, an obstacle stays crossed, even for a body without its key
    pass(l, gate('recif') + 10);
    body = firstAncestor();
    expect(keys.bounds()[1]).toBe(gate('foret'));
  });

  it('holds back only near an obstacle, and gently once it is open', () => {
    const l = newLimits(), keys = createKeys(l, () => firstAncestor()), g = gate('recif');
    expect(keys.steer(g - 3000, 2, 0)).toEqual([2, 0]);
    expect(keys.steer(g - 20, 2.6, 0)[0]).toBeLessThan(0);
    keys.force = ['pulsation'];
    expect(keys.near(g - 20)?.open).toBe(true);
    expect(keys.steer(g - 20, 2.6, 0)[0]).toBeGreaterThan(1.5);
  });

  it('closes the dark before the galerie of the Grotte, until a lantern or a thin body', () => {
    const l = newLimits(), keys = createKeys(l, () => firstAncestor()), g = gate('grotte');
    travel(l, g - 200);
    expect(keys.dark(g - 20)).toBeGreaterThan(0.9);
    expect(keys.dark(g - OBSTACLE.grotte!.soft - 10)).toBe(0);
    keys.force = ['lanterne'];
    expect(keys.dark(g - 20)).toBe(0);
  });

  it('tells the words of an obstacle once, when the swimmer presses into it', () => {
    const l = newLimits(), keys = createKeys(l, () => firstAncestor()), g = gate('recif'), told: string[] = [];
    let quiet = true;
    keys.onBarred = (c) => { if (quiet) return false; told.push(c); return true; };
    keys.update(g - OBSTACLE.recif!.soft + 50);
    keys.update(g - 50);
    expect(told).toEqual([]);
    quiet = false;
    keys.update(g - 50); keys.update(g - 40);
    expect(told).toEqual(['recif']);
  });

  it('keeps the end of the world at the bottom of the Fosse, even with a lantern', () => {
    const l = newLimits(), keys = createKeys(l, () => SPECIES.baudroie());
    keys.force = ['nageoires', 'pinces', 'lanterne', 'carapace', 'pulsation'];
    expect(keys.bounds()[1]).toBe(WORLD_END);
  });
});
