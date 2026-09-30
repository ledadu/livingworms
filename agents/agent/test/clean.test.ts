import '../../test/env.mjs';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanAgents, cleanCandidates, orphanBranches } from '../clean.mjs';
import { readQueue, writeQueueEntry } from '../roadmap.mjs';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

// A repository on backlog, and agents: done (archived, merged), busy (not archived), ahead (archived, not merged),
// dirty (archived, merged, a file in progress), plus an orphan branch merged.
function setup() {
  const base = mkdtempSync(join(tmpdir(), 'agents-clean-'));
  folders.push(base);
  const main = join(base, 'main');
  const registry = join(base, 'registry');
  mkdirSync(main);
  mkdirSync(registry);
  git(main, 'init', '-q');
  git(main, 'symbolic-ref', 'HEAD', 'refs/heads/backlog');
  git(main, 'config', 'user.email', 't@t');
  git(main, 'config', 'user.name', 't');
  writeFileSync(join(main, 'a.txt'), 'a\n');
  git(main, 'add', '.');
  git(main, 'commit', '-qm', 'init');
  for (const name of ['done', 'busy', 'ahead', 'dirty']) {
    const dir = join(base, 'wt', name);
    git(main, 'worktree', 'add', '-q', '-b', `agent/${name}`, dir);
    writeFileSync(join(registry, `${name}.env`), `AGENT_NAME=${name}\nAGENT_BRANCH=agent/${name}\nAGENT_DIR=${dir}\n${name === 'busy' ? '' : 'AGENT_ARCHIVED=2026-09-30\n'}`);
  }
  writeFileSync(join(base, 'wt', 'ahead', 'b.txt'), 'b\n');
  git(join(base, 'wt', 'ahead'), 'add', '.');
  git(join(base, 'wt', 'ahead'), 'commit', '-qm', 'ahead');
  writeFileSync(join(base, 'wt', 'dirty', 'c.txt'), 'c\n');
  git(main, 'branch', 'agent/orphan');
  writeQueueEntry(join(registry, 'queue'), { name: 'done', title: 'x', prompt: 'x', base: 'backlog', id: null, createdAt: '2026-09-30', status: 'done' });
  mkdirSync(join(registry, 'runs', 'done'), { recursive: true });
  // A fake agent.sh rm: the worktree and the registry entry go.
  const agentSh = join(base, 'agent.sh');
  writeFileSync(agentSh, `#!/bin/sh\ngit -C "${main}" worktree remove --force "${base}/wt/$2" && rm -f "${registry}/$2.env"\n`);
  chmodSync(agentSh, 0o755);
  return { base, main, registry, agentSh };
}

describe('clean', () => {
  it('cleans only the archived, merged, clean and stopped agents, with their branch, run and queue entry', () => {
    const { base, main, registry, agentSh } = setup();
    const reasons = Object.fromEntries(cleanCandidates({ mainRoot: main, registry }).map((one) => [one.name, one.reasons]));
    expect(reasons).toEqual({ ahead: ['pas fusionné dans backlog'], busy: ['pas archivé (pas encore accepté)'], dirty: ['fichiers non commités'], done: [] });
    expect(cleanAgents({ mainRoot: main, registry, agentSh, dryRun: true }).cleaned.map((one) => one.name)).toEqual(['done']);
    expect(existsSync(join(base, 'wt', 'done'))).toBe(true);
    const { cleaned, errors } = cleanAgents({ mainRoot: main, registry, agentSh });
    expect(errors).toEqual([]);
    expect(cleaned.map((one) => one.name)).toEqual(['done']);
    expect(existsSync(join(base, 'wt', 'done'))).toBe(false);
    expect(git(main, 'branch', '--list', 'agent/done')).toBe('');
    expect(existsSync(join(registry, 'runs', 'done'))).toBe(false);
    expect(readQueue(join(registry, 'queue'))).toEqual([]);
    for (const kept of ['busy', 'ahead', 'dirty']) expect(existsSync(join(base, 'wt', kept))).toBe(true);
    expect(orphanBranches({ mainRoot: main, registry })).toEqual(['agent/orphan']);
  });

  it('limits itself to the agents named (those of a published generation)', () => {
    const { main, registry, agentSh } = setup();
    expect(cleanAgents({ mainRoot: main, registry, agentSh, names: ['busy', 'ahead'], dryRun: true }).cleaned).toEqual([]);
  });
});
