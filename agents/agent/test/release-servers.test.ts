import '../../test/env.mjs';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { agentCounts } from '../hub.mjs';
import { createServers, isReleaseServer, serverName, splitRegistry } from '../release-servers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const bases: string[] = [];
afterEach(() => {
  for (const base of bases.splice(0)) rmSync(base, { recursive: true, force: true });
});

const git = (root: string, ...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function readEnv(file: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^(\w+)=(.*)$/.exec(line);
    if (match) values[match[1]!] = match[2]!;
  }
  return values;
}

// A throwaway repository with its own copy of agent.sh and config.mjs (so its registry is its own .git/agents), a tag
// v0.2.0 and
// release/0.2 one fix ahead.
function repository() {
  const base = mkdtempSync(join(tmpdir(), 'agents-servers-'));
  bases.push(base);
  const root = join(base, 'repo');
  mkdirSync(join(root, 'agents/agent'), { recursive: true });
  copyFileSync(join(here, '../agent.sh'), join(root, 'agents/agent/agent.sh'));
  copyFileSync(join(here, '../../config.mjs'), join(root, 'agents/config.mjs'));
  writeFileSync(join(root, 'game.txt'), '0.2\n');
  git(root, 'init', '-q');
  for (const [key, value] of [['commit.gpgsign', 'false'], ['tag.gpgsign', 'false'], ['user.email', 'test@agents.test'], ['user.name', 'Test']]) git(root, 'config', key!, value!);
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'start');
  git(root, 'tag', '-a', 'v0.2.0', '-m', 'Génération 0.2');
  git(root, 'branch', 'release/0.2');
  const registry = join(root, '.git/agents');
  const servers = createServers({ root, registry, readEnv, agentScript: join(root, 'agents/agent/agent.sh') });
  return { root, registry, servers };
}

describe('the test servers of versions', () => {
  it('names a server after its version', () => {
    expect([serverName('release/0.2'), serverName('v0.2.1'), serverName('0.3'), serverName('backlog')]).toEqual(['v0-2', 'v0-2-1', 'v0-3', null]);
  });

  it('keeps them apart from the agents, and out of the agents counted on the home page', () => {
    const envs = [{ AGENT_NAME: 'nid' }, { AGENT_NAME: 'v0-2', AGENT_KIND: 'release', AGENT_REF: 'release/0.2' }];
    const { agents, servers } = splitRegistry(envs);
    expect(agents.map((env) => env.AGENT_NAME)).toEqual(['nid']);
    expect(servers.map((env) => env.AGENT_NAME)).toEqual(['v0-2']);
    expect(isReleaseServer(envs[1])).toBe(true);
    expect(agentCounts(agents).total).toBe(1);
  });

  it('makes a worktree of the version marked in the registry, refreshes it when the branch moves, and removes it', async () => {
    const { root, registry, servers } = repository();
    const made = await servers.start('release/0.2', { up: false });
    expect(made).toMatchObject({ ok: true, name: 'v0-2' });
    const env = readEnv(join(registry, 'v0-2.env'));
    expect(env).toMatchObject({ AGENT_KIND: 'release', AGENT_REF: 'release/0.2', AGENT_BRANCH: 'serve/v0-2' });
    expect(readFileSync(join(env.AGENT_DIR!, 'game.txt'), 'utf8')).toBe('0.2\n');
    // release/0.2 stays free for the temporary worktrees of branches.mjs.
    expect(git(root, 'worktree', 'list')).not.toContain('[release/0.2]');

    const [listed] = await servers.list();
    expect(listed).toMatchObject({ name: 'v0-2', ref: 'release/0.2', exists: true, stale: false, server: false });

    const dir = join(dirname(root), 'fix');
    git(root, 'worktree', 'add', '-q', dir, 'release/0.2');
    writeFileSync(join(dir, 'game.txt'), '0.2.1\n');
    git(dir, 'commit', '-q', '-am', 'fix: 0.2.1');
    git(root, 'worktree', 'remove', dir);
    expect((await servers.list())[0]).toMatchObject({ stale: true });
    expect(await servers.refresh('v0-2')).toMatchObject({ ok: true });
    expect(readFileSync(join(env.AGENT_DIR!, 'game.txt'), 'utf8')).toBe('0.2.1\n');
    expect((await servers.list())[0]).toMatchObject({ stale: false });

    expect(await servers.start('backlog')).toMatchObject({ ok: false });
    expect(await servers.remove('v0-2')).toMatchObject({ ok: true });
    expect(existsSync(join(registry, 'v0-2.env'))).toBe(false);
    expect(existsSync(env.AGENT_DIR!)).toBe(false);
    expect(git(root, 'branch', '--list', 'serve/*')).toBe('');
  }, 30_000);
});
