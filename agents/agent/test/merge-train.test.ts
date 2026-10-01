import '../../test/env.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearTrain, MAX_FIXES, readTrain, startTrain, stepTrain, stopTrain } from '../merge-train.mjs';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function registry() {
  const dir = mkdtempSync(join(tmpdir(), 'agents-train-'));
  folders.push(dir);
  return dir;
}

type Answer = { ok: boolean; conflict?: boolean; fixable?: boolean; message?: string; error?: string };

// A fake dashboard: accept answers from a script per agent, fix records its calls, runs are set by hand.
function fakes(script: Record<string, Answer[]>) {
  const calls: string[] = [];
  const runs: Record<string, string> = {};
  return {
    calls,
    runs,
    deps: {
      accept: async (name: string) => (calls.push(`accept ${name}`), script[name].shift() ?? { ok: false, error: 'plus de réponse' }),
      fix: async (name: string, result?: Answer) => (calls.push(`fix ${name}${result?.fixable ? ' (accept)' : ''}`), (runs[name] = 'running'), { ok: true }),
      runState: (name: string) => (runs[name] ? { state: runs[name] } : null),
      now: () => '2026-09-30T12:00:00.000Z',
    },
  };
}

const states = (dir: string) => readTrain(dir).items.map((item: { name: string; state: string }) => `${item.name}:${item.state}`);

describe('merge train', () => {
  it('accepts the agents one after the other', async () => {
    const dir = registry();
    const { calls, deps } = fakes({ a: [{ ok: true, message: 'fusionnée' }], b: [{ ok: true }] });
    startTrain(dir, ['a', 'b']);
    await stepTrain(dir, deps);
    expect(states(dir)).toEqual(['a:accepted', 'b:waiting']);
    await stepTrain(dir, deps);
    expect(states(dir)).toEqual(['a:accepted', 'b:accepted']);
    expect(readTrain(dir).finishedAt).toBeTruthy();
    expect(calls).toEqual(['accept a', 'accept b']);
  });

  it('on a conflict, has the agent fix it, waits for it, accepts it again, then goes on', async () => {
    const dir = registry();
    const { calls, runs, deps } = fakes({ a: [{ ok: false, conflict: true }, { ok: true }], b: [{ ok: true }] });
    startTrain(dir, ['a', 'b']);
    await stepTrain(dir, deps);
    expect(states(dir)).toEqual(['a:fixing', 'b:waiting']);
    await stepTrain(dir, deps); // still running: nothing moves
    expect(states(dir)).toEqual(['a:fixing', 'b:waiting']);
    runs.a = 'done';
    await stepTrain(dir, deps);
    expect(states(dir)).toEqual(['a:accepted', 'b:waiting']);
    await stepTrain(dir, deps);
    expect(calls).toEqual(['accept a', 'fix a', 'accept a', 'accept b']);
    expect(states(dir)).toEqual(['a:accepted', 'b:accepted']);
  });

  it('has the agent fix a refusal on its side (files left uncommitted), then accepts it again', async () => {
    const dir = registry();
    const { calls, runs, deps } = fakes({ a: [{ ok: false, fixable: true, error: 'fichiers non commités' }, { ok: true }] });
    startTrain(dir, ['a']);
    await stepTrain(dir, deps);
    expect(readTrain(dir).items[0]).toMatchObject({ state: 'fixing', message: expect.stringContaining('fichiers non commités') });
    runs.a = 'done';
    await stepTrain(dir, deps);
    expect(calls).toEqual(['accept a', 'fix a (accept)', 'accept a']);
    expect(states(dir)).toEqual(['a:accepted']);
  });

  it('fails an agent whose fix stopped, or that still conflicts after the last fix, and goes on', async () => {
    const dir = registry();
    const conflict = { ok: false, conflict: true };
    const { runs, deps } = fakes({ a: [conflict], b: Array(MAX_FIXES + 1).fill(conflict), c: [{ ok: false, error: 'fichiers non commités' }] });
    startTrain(dir, ['a', 'b', 'c']);
    await stepTrain(dir, deps);
    runs.a = 'error';
    await stepTrain(dir, deps);
    expect(readTrain(dir).items[0]).toMatchObject({ state: 'failed', message: expect.stringContaining('error') });
    for (let fix = 0; fix < MAX_FIXES; fix++) {
      await stepTrain(dir, deps);
      runs.b = 'done';
    }
    await stepTrain(dir, deps);
    expect(readTrain(dir).items[1]).toMatchObject({ state: 'failed', fixes: MAX_FIXES });
    await stepTrain(dir, deps);
    expect(readTrain(dir).items[2]).toMatchObject({ state: 'failed', message: 'fichiers non commités' });
    expect(readTrain(dir).finishedAt).toBeTruthy();
  });

  it('adds to a train under way, skips the rest when stopped, and is cleared once over', async () => {
    const dir = registry();
    const { deps } = fakes({ a: [{ ok: true }], b: [] });
    startTrain(dir, ['a']);
    startTrain(dir, ['a', 'b']);
    expect(states(dir)).toEqual(['a:waiting', 'b:waiting']);
    expect(() => clearTrain(dir)).toThrow(/en cours/);
    await stepTrain(dir, deps);
    stopTrain(dir);
    expect(states(dir)).toEqual(['a:accepted', 'b:skipped']);
    expect(await stepTrain(dir, deps)).toMatchObject({ stopped: true });
    clearTrain(dir);
    expect(readTrain(dir)).toBeNull();
    expect(() => startTrain(dir, ['../x'])).toThrow(/invalide/);
  });

  it('waits, without failing anyone, while the main checkout blocks the merge, then goes on', async () => {
    const dir = registry();
    const blocked = { ok: false, blocked: true, error: 'des changements sont indexés dans le dépôt principal' };
    const { calls, deps } = fakes({ a: [blocked, blocked, { ok: true }], b: [{ ok: true }] });
    startTrain(dir, ['a', 'b']);
    await stepTrain(dir, deps);
    await stepTrain(dir, deps);
    expect(states(dir)).toEqual(['a:waiting', 'b:waiting']);
    expect(readTrain(dir).blocked).toMatch(/indexés/);
    await stepTrain(dir, deps);
    await stepTrain(dir, deps);
    expect(states(dir)).toEqual(['a:accepted', 'b:accepted']);
    expect(readTrain(dir).blocked).toBeNull();
    expect(calls).toEqual(['accept a', 'accept a', 'accept a', 'accept b']);
  });

  it('keeps the result of an accept that ends after the train was stopped', async () => {
    const dir = registry();
    const { deps } = fakes({});
    startTrain(dir, ['a', 'b']);
    await stepTrain(dir, { ...deps, accept: async () => (stopTrain(dir), { ok: true, message: 'fusionnée' }) });
    expect(states(dir)).toEqual(['a:accepted', 'b:skipped']);
    expect(readTrain(dir).finishedAt).toBeTruthy();
  });
});
