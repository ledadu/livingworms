import '../../test/env.mjs';
import { describe, expect, it } from 'vitest';
import { planPush } from '../push.mjs';

describe('push plan', () => {
  it('pushes what is new or ahead, leaves what is the same or diverged', () => {
    const history: Record<string, string[]> = { b2: ['b1'], m2: ['m1'] };
    const isAncestor = (a: string, b: string) => (history[b] ?? []).includes(a);
    const remote = new Map([['refs/heads/backlog', 'b1'], ['refs/heads/master', 'x9'], ['refs/tags/v0.1.0', 't1']]);
    const plan = planPush([
      { ref: 'refs/heads/backlog', local: 'b2' },
      { ref: 'refs/heads/master', local: 'm2', label: 'master (à v0.2.0)' },
      { ref: 'refs/tags/v0.1.0', local: 't1' },
      { ref: 'refs/tags/v0.2.0', local: 't2' },
    ], remote, isAncestor);
    expect(plan.map((one) => `${one.label}:${one.action}`)).toEqual(['backlog:update', 'master (à v0.2.0):diverged', 'v0.1.0:same', 'v0.2.0:new']);
  });
});
