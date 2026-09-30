import { describe, expect, it } from 'vitest';
import { spec } from './defs';
import { stats } from './tools';

describe('stats', () => {
  it('counts every copy of every part', () => {
    const sp = spec({
      body: {
        links: 4,
        attach: [
          { pattern: 'pair', node: { links: 2 } },
          { pattern: 'fan', count: 3, mirror: false, node: { links: 3, attach: [{ pattern: 'single', node: { links: 1 } }] } },
        ],
      },
    });
    // body + 2 of the pair + 3 of the fan + one child on each of them
    expect(stats(sp)).toEqual({ chains: 9, nodes: 5 + 2 * 3 + 3 * 4 + 3 * 2, depth: 3 });
  });
});
