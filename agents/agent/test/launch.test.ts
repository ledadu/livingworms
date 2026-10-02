import '../../test/env.mjs';
import { execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { CO_AUTHORED_BY, claimQueue, teamArgs, launchTask, mergeOrder, orderPrompt, orderTask, RESUME_PROMPT, resumeTask, runDir, runLog, runLogFrom, runState, sessionTranscript, stopTask } from '../launch.mjs';
import { readQueue, writeQueueEntry } from '../roadmap.mjs';
import { writeSettings } from '../settings.mjs';
import { roadmapRoutes } from '../roadmap-routes.mjs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const folders: string[] = [];
const pids: number[] = [];
afterEach(() => {
  for (const pid of pids.splice(0)) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {}
  }
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

// A fake `claude`: notes its arguments, directory and stdin, then sleeps (FAKE_SLEEP, in a child process, to check that
// the whole group is stopped) and exits with FAKE_CODE. The real CLI is never started.
const FAKE = `#!/bin/sh
out="$AGENTS_RUN_DIR/fake"
printf '%s\\n' "$@" >"$out.args"
pwd >"$out.cwd"
echo "\${CLAUDECODE:-unset}" >"$out.nested"
cat >"$out.stdin"
echo "fake claude running"
if [ -n "$FAKE_SLEEP" ]; then sleep "$FAKE_SLEEP" & echo $! >"$out.child"; wait; fi
exit "\${FAKE_CODE:-0}"
`;

function setup(name = 'essai') {
  const base = mkdtempSync(join(tmpdir(), 'agents-launch-'));
  folders.push(base);
  const registry = join(base, 'registry');
  const worktree = join(base, 'worktrees', name);
  mkdirSync(worktree, { recursive: true });
  mkdirSync(registry, { recursive: true });
  writeFileSync(join(registry, `${name}.env`), `AGENT_NAME=${name}\nAGENT_DIR=${worktree}\n`);
  const bin = join(base, 'claude');
  writeFileSync(bin, FAKE);
  chmodSync(bin, 0o755);
  const queueDir = join(registry, 'queue');
  writeQueueEntry(queueDir, { name, title: 'Essai', prompt: 'Travaille. Commits terminés par `{{CO_AUTHORED_BY}}`.', base: 'backlog', id: null, createdAt: '2026-09-29T10:00:00.000Z', status: 'queued' });
  return { base, registry, worktree, bin, queueDir, name };
}

async function until(check: () => boolean, ms = 5000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timeout');
    await new Promise((done) => setTimeout(done, 25));
  }
}

const envFor = (bin: string, extra: Record<string, string> = {}) => ({ PATH: process.env.PATH ?? '', AGENTS_CLAUDE_BIN: bin, CLAUDECODE: '1', ...extra });

describe('launchTask', () => {
  it('starts the CLI in the worktree with the prompt on stdin, and records the run until it ends', async () => {
    const { registry, worktree, bin, queueDir, name } = setup();
    const started = launchTask({ registry, name, env: envFor(bin) });
    pids.push(started.pid);
    expect(started.state === 'running' || started.state === 'done').toBe(true);
    const entry = readQueue(queueDir)[0];
    expect(entry).toMatchObject({ status: 'launched', launchedBy: 'dashboard', sessionId: started.sessionId });
    expect(entry.launchedAt).toBeTruthy();

    await until(() => runState(registry, name)?.state === 'done');
    const dir = runDir(registry, name);
    const args = readFileSync(join(dir, 'fake.args'), 'utf8').trim().split('\n');
    // The team's MCP server comes with every run (team-mcp.mjs), under the agent's name.
    expect(args).toEqual(['-p', '--session-id', started.sessionId, '--permission-mode', 'auto', '--permission-prompts', 'none', ...teamArgs(name), '--output-format', 'stream-json', '--verbose']);
    expect(JSON.parse(teamArgs(name)[1]).mcpServers.equipe).toMatchObject({ args: [expect.stringMatching(/team-mcp\.mjs$/)], env: { AGENT_NAME: name } });
    expect(readFileSync(join(dir, 'fake.cwd'), 'utf8').trim()).toBe(worktree);
    expect(readFileSync(join(dir, 'fake.stdin'), 'utf8')).toBe(`Travaille. Commits terminés par \`${CO_AUTHORED_BY}\`.`);
    expect(readFileSync(join(dir, 'fake.nested'), 'utf8').trim()).toBe('unset');
    expect(runState(registry, name)).toMatchObject({ state: 'done', code: 0 });
    expect(runLog(registry, name)).toContain('fake claude running');
  });

  it('resumes the same session after an error, with a note on stdin, and appends to the output', async () => {
    const { registry, bin, name } = setup();
    const started = launchTask({ registry, name, env: envFor(bin, { FAKE_CODE: '1' }) });
    pids.push(started.pid);
    await until(() => runState(registry, name)?.state === 'error');
    const resumed = resumeTask({ registry, name, message: 'le réseau est revenu', env: envFor(bin) });
    pids.push(resumed.pid);
    await until(() => runState(registry, name)?.state === 'done');
    const dir = runDir(registry, name);
    const args = readFileSync(join(dir, 'fake.args'), 'utf8').trim().split('\n');
    expect(args.slice(0, 3)).toEqual(['-p', '--resume', started.sessionId]);
    expect(args).not.toContain('--fork-session');
    expect(readFileSync(join(dir, 'fake.stdin'), 'utf8')).toBe(`${RESUME_PROMPT}\n\nMessage de l'utilisateur : le réseau est revenu`);
    expect(readFileSync(join(dir, 'prompt.md'), 'utf8')).toContain('Travaille.');
    expect(runLog(registry, name).match(/fake claude running/g)).toHaveLength(2);
    expect(runState(registry, name)).toMatchObject({ state: 'done', code: 0, sessionId: started.sessionId, resumes: [{ after: 'error', code: 1 }] });
  });

  it('passes the agent’s effort and model, and a resume takes them as they are now', async () => {
    const { registry, bin, name } = setup();
    writeSettings(registry, name, { effort: 'xhigh', model: 'sonnet' });
    const started = launchTask({ registry, name, env: envFor(bin, { FAKE_CODE: '1' }) });
    pids.push(started.pid);
    await until(() => runState(registry, name)?.state === 'error');
    const dir = runDir(registry, name);
    const first = readFileSync(join(dir, 'fake.args'), 'utf8').trim().split('\n');
    expect(first).toEqual(['-p', '--session-id', started.sessionId, '--permission-mode', 'auto', '--permission-prompts', 'none', '--effort', 'xhigh', '--model', 'sonnet', ...teamArgs(name), '--output-format', 'stream-json', '--verbose']);
    expect(runState(registry, name)).toMatchObject({ effort: 'xhigh', model: 'sonnet' });

    // Changed on the card: the resume uses the new effort and no model of its own.
    writeSettings(registry, name, { effort: 'max', model: null });
    const resumed = resumeTask({ registry, name, env: envFor(bin) });
    pids.push(resumed.pid);
    await until(() => runState(registry, name)?.state === 'done');
    const args = readFileSync(join(dir, 'fake.args'), 'utf8').trim().split('\n');
    expect(args.slice(0, 3)).toEqual(['-p', '--resume', started.sessionId]);
    expect(args.join(' ')).toContain('--effort max');
    expect(args).not.toContain('--model');
    expect(runState(registry, name)).toMatchObject({ effort: 'max', model: null, resumes: [{ after: 'error', effort: 'max' }] });
  });

  it('refuses to resume a run that still works, or one never launched from here', async () => {
    const { registry, bin, name } = setup();
    expect(() => resumeTask({ registry, name, env: envFor(bin) })).toThrow(/pas été lancée/);
    const started = launchTask({ registry, name, env: envFor(bin, { FAKE_SLEEP: '5' }) });
    pids.push(started.pid);
    await until(() => runState(registry, name)?.state === 'running');
    expect(() => resumeTask({ registry, name, env: envFor(bin) })).toThrow(/tourne encore/);
    stopTask({ registry, name, graceMs: 50 });
    await until(() => runState(registry, name)?.state === 'stopped');
    const resumed = resumeTask({ registry, name, env: envFor(bin) });
    pids.push(resumed.pid);
    expect(resumed.stoppedAt).toBeUndefined();
    await until(() => runState(registry, name)?.state === 'done');
  });

  it('gives a new order in the same session to an agent launched from here', async () => {
    const { registry, bin, name } = setup();
    const started = launchTask({ registry, name, env: envFor(bin) });
    pids.push(started.pid);
    await until(() => runState(registry, name)?.state === 'done');
    const ordered = orderTask({ registry, name, order: 'Ajoute une capture de nuit.', env: envFor(bin) });
    pids.push(ordered.pid);
    await until(() => runState(registry, name)?.state === 'done');
    const dir = runDir(registry, name);
    expect(readFileSync(join(dir, 'fake.args'), 'utf8').trim().split('\n').slice(0, 3)).toEqual(['-p', '--resume', started.sessionId]);
    expect(readFileSync(join(dir, 'fake.stdin'), 'utf8')).toBe(orderPrompt('Ajoute une capture de nuit.', { name }));
    expect(readFileSync(join(dir, 'fake.stdin'), 'utf8')).toMatch(/changes\/unreleased\/essai\/report\.md/);
  });

  it('orders a merge of the base that keeps both sides, then checks and commits', () => {
    const order = mergeOrder('backlog');
    expect(order).toContain('`git merge backlog`');
    expect(order).toMatch(/les deux côtés/);
    expect(order).toContain('make check');
    expect(mergeOrder('main')).toContain('`git merge main`');
  });

  it('starts a session of its own, goal restated, for an agent the orchestrator launched', async () => {
    const { registry, worktree, bin, name } = setup();
    expect(() => orderTask({ registry, name, order: '  ', worktree, env: envFor(bin) })).toThrow(/vide/);
    const started = orderTask({ registry, name, order: 'Peaufine les couleurs.', intro: "Tu es l'agent `essai`.\n\n## Chantier : essai", base: 'main', worktree, env: envFor(bin) });
    pids.push(started.pid);
    await until(() => runState(registry, name)?.state === 'done');
    const dir = runDir(registry, name);
    expect(readFileSync(join(dir, 'fake.args'), 'utf8').trim().split('\n').slice(0, 3)).toEqual(['-p', '--session-id', started.sessionId]);
    const stdin = readFileSync(join(dir, 'fake.stdin'), 'utf8');
    expect(stdin.startsWith("Tu es l'agent `essai`.\n\n## Chantier : essai\n\nNouvel ordre")).toBe(true);
    expect(stdin).toContain('Peaufine les couleurs.');
    expect(stdin).toContain('git merge main');
    expect(readFileSync(join(dir, 'fake.cwd'), 'utf8').trim()).toBe(worktree);
  });

  it('reads the output from an offset, by whole lines only', () => {
    const { registry, name } = setup();
    mkdirSync(runDir(registry, name), { recursive: true });
    const log = join(runDir(registry, name), 'claude.log');
    expect(runLogFrom(registry, name, 0)).toEqual({ text: '', next: 0 });
    writeFileSync(log, '{"type":"é"}\n{"type":"b"');
    const first = runLogFrom(registry, name, 0);
    expect(first.text).toBe('{"type":"é"}\n');
    expect(runLogFrom(registry, name, first.next)).toEqual({ text: '', next: first.next });
    writeFileSync(log, '{"type":"é"}\n{"type":"b"}\n');
    expect(runLogFrom(registry, name, first.next)).toEqual({ text: '{"type":"b"}\n', next: Buffer.byteLength('{"type":"é"}\n{"type":"b"}\n') });
  });

  it('reports a failing exit code, and takes the permission mode from the environment', async () => {
    const { registry, bin, name } = setup();
    const started = launchTask({ registry, name, env: envFor(bin, { FAKE_CODE: '3', AGENTS_CLAUDE_PERMISSION_MODE: 'bypassPermissions' }) });
    pids.push(started.pid);
    await until(() => runState(registry, name)?.state === 'error');
    expect(runState(registry, name)).toMatchObject({ code: 3, permissionMode: 'bypassPermissions' });
  });

  it('never launches a task twice, and the orchestrator can no longer claim it', async () => {
    const { registry, bin, queueDir, name } = setup();
    pids.push(launchTask({ registry, name, env: envFor(bin, { FAKE_SLEEP: '5' }) }).pid);
    expect(() => launchTask({ registry, name, env: envFor(bin) })).toThrow(/plus en attente/);
    expect(() => claimQueue(queueDir, name, { launchedBy: 'orchestrator' })).toThrow(/tableau de bord/);
  });

  it('refuses a task whose worktree is missing, and leaves it queued', () => {
    const { registry, bin, queueDir, name, worktree } = setup();
    rmSync(worktree, { recursive: true });
    expect(() => launchTask({ registry, name, env: envFor(bin) })).toThrow(/worktree/);
    expect(readQueue(queueDir)[0].status).toBe('queued');
  });
});

describe('stopTask', () => {
  it('kills the whole process group and marks the run stopped', async () => {
    const { registry, bin, name } = setup();
    const started = launchTask({ registry, name, env: envFor(bin, { FAKE_SLEEP: '30' }) });
    pids.push(started.pid);
    const childFile = join(runDir(registry, name), 'fake.child');
    await until(() => existsSync(childFile) && readFileSync(childFile, 'utf8').trim() !== '');
    const child = Number(readFileSync(childFile, 'utf8'));
    expect(runState(registry, name)?.state).toBe('running');

    stopTask({ registry, name, graceMs: 200 });
    const gone = (pid: number) => {
      try {
        process.kill(pid, 0);
        return false;
      } catch {
        return true;
      }
    };
    await until(() => gone(started.pid) && gone(child));
    expect(runState(registry, name)?.state).toBe('stopped');
    expect(() => stopTask({ registry, name })).toThrow(/ne tourne pas/);
  });

  it('calls a run whose process vanished without an exit code lost', () => {
    const { registry, name } = setup();
    mkdirSync(runDir(registry, name), { recursive: true });
    writeFileSync(join(runDir(registry, name), 'run.json'), JSON.stringify({ name, pid: 2 ** 22 + 12345, pgid: 2 ** 22 + 12345, sessionId: 'x' }));
    expect(runState(registry, name)?.state).toBe('lost');
    expect(runState(registry, 'autre')).toBeNull();
  });
});

describe('sessionTranscript', () => {
  it('finds the transcript of a session in any project folder', () => {
    const { base } = setup();
    const root = join(base, 'projects');
    const id = '0f8e5b1c-1111-4222-8333-444455556666';
    mkdirSync(join(root, '-home-x-All-le-worktrees-essai'), { recursive: true });
    mkdirSync(join(root, '-home-x-other', 'session', 'subagents'), { recursive: true });
    writeFileSync(join(root, '-home-x-All-le-worktrees-essai', `${id}.jsonl`), '{}\n');
    expect(sessionTranscript(root, id)).toBe(join(root, '-home-x-All-le-worktrees-essai', `${id}.jsonl`));
    expect(sessionTranscript(root, '0f8e5b1c-0000-4222-8333-444455556666')).toBeNull();
    expect(sessionTranscript(root, '../../etc/passwd')).toBeNull();
    expect(sessionTranscript(join(base, 'nowhere'), id)).toBeNull();
  });
});

describe('queue.mjs', () => {
  const queueScript = join(here, '../queue.mjs');

  it('does not hand a task launched from the dashboard to the orchestrator', async () => {
    const { registry, bin, name } = setup();
    pids.push(launchTask({ registry, name, env: envFor(bin, { FAKE_SLEEP: '5' }) }).pid);
    const env = { ...process.env, AGENTS_REGISTRY: registry };
    await expect(run('node', [queueScript, 'wait', '--timeout', '1'], { env })).rejects.toMatchObject({ code: 2 });
    await expect(run('node', [queueScript, 'mark', name, 'launched'], { env })).rejects.toMatchObject({ stderr: expect.stringContaining('tableau de bord') });
  });

  it('lets the orchestrator claim a queued task, once', async () => {
    const { registry, queueDir, name } = setup();
    const env = { ...process.env, AGENTS_REGISTRY: registry };
    const { stdout } = await run('node', [queueScript, 'mark', name, 'launched'], { env });
    expect(stdout).toContain('launched');
    expect(readQueue(queueDir)[0]).toMatchObject({ status: 'launched', launchedBy: 'orchestrator' });
    await expect(run('node', [queueScript, 'mark', name, 'launched'], { env })).rejects.toMatchObject({ code: 1 });
  });
});

describe('dashboard routes', () => {
  it('launch, show the run in the queue, refuse a second launch and a cancel, then stop', async () => {
    const { base, registry, bin, name } = setup();
    const previous = { ...process.env };
    Object.assign(process.env, { AGENTS_CLAUDE_BIN: bin, FAKE_SLEEP: '30' });
    delete process.env.AGENTS_REGISTRY;
    const handle = roadmapRoutes({ mainRoot: base, registry, here: join(here, '..') });
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      handle(request, response, path).then((done: boolean) => done || (response.writeHead(404), response.end()));
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = async (path: string) => (await fetch(url + path, { method: 'POST' })).json();
    try {
      const launched = await post(`/api/queue/${name}/launch`);
      expect(launched.ok).toBe(true);
      pids.push(launched.run.pid);
      const queue = await (await fetch(`${url}/api/queue`)).json();
      expect(queue[0]).toMatchObject({ status: 'launched', launchedBy: 'dashboard', run: { state: 'running' } });
      expect((await post(`/api/queue/${name}/launch`)).ok).toBe(false);
      expect((await post('/api/queue/launch-all')).results).toEqual([]);
      expect((await post(`/api/queue/${name}/forget`)).error).toMatch(/arrête/);
      expect((await post(`/api/queue/${name}/stop`)).ok).toBe(true);
      expect(await (await fetch(`${url}/api/queue/${name}/log`)).text()).toContain('fake claude running');
    } finally {
      server.close();
      for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
      Object.assign(process.env, previous);
    }
  });

  it('launches an « auto » sub-task by itself, with its own agent, once its parent is merged', async () => {
    const { base, registry, bin } = setup('mere');
    mkdirSync(join(base, 'docs'), { recursive: true });
    mkdirSync(join(base, 'changes/unreleased/mere'), { recursive: true });
    writeFileSync(join(base, 'docs/backlog.md'), '# Backlog\n\n## Son\n\n### Mère\n> 🟠 fusionné · agent mere\n\nTexte.\n\n### Fille\n> ⚪ à faire\n> ↳ après « Mère »\n\nLa suite.\n');
    // A fake agent.sh: `new <name> <base>` makes the worktree and its registry file.
    const agentSh = join(base, 'agent.sh');
    writeFileSync(agentSh, `#!/bin/sh\n[ "$1" = new ] || exit 0\nmkdir -p "${base}/worktrees/$2"\nprintf 'AGENT_NAME=%s\\nAGENT_DIR=%s\\n' "$2" "${base}/worktrees/$2" >"${registry}/$2.env"\n`);
    chmodSync(agentSh, 0o755);
    const previous = { ...process.env };
    Object.assign(process.env, { AGENTS_CLAUDE_BIN: bin, AGENTS_AGENT_SH: agentSh, AGENTS_NO_AUTO: '1' });
    delete process.env.AGENTS_REGISTRY;
    const handle = roadmapRoutes({ mainRoot: base, registry, here: join(here, '..') });
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      handle(request, response, path).then((done: boolean) => done || (response.writeHead(404), response.end()));
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const set = await (await fetch(`${url}/api/backlog/auto/fille`, { method: 'POST', body: JSON.stringify({ auto: true, effort: 'high' }) })).json();
      expect(set.ok).toBe(true);
      expect(readFileSync(join(base, 'docs/backlog.md'), 'utf8')).toContain('> ↳ après « Mère » · auto · effort high');
      let queue: { name: string; status: string; effort?: string; run?: { pid: number } }[] = [];
      await until(() => existsSync(join(registry, 'queue', 'fille.json')) && JSON.parse(readFileSync(join(registry, 'queue', 'fille.json'), 'utf8')).status === 'launched', 8000);
      queue = await (await fetch(`${url}/api/queue`)).json();
      const entry = queue.find((one) => one.name === 'fille')!;
      expect(entry).toMatchObject({ status: 'launched', effort: 'high' });
      if (entry.run?.pid) pids.push(entry.run.pid);
      expect(readFileSync(join(base, 'docs/backlog.md'), 'utf8')).toMatch(/### Fille\n> 🟣 en file · agent fille|### Fille\n> 🔵 en cours · agent fille/);
    } finally {
      server.close();
      for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
      Object.assign(process.env, previous);
    }
  });

  it('creates a sub-task proposed in the 🧩 thread, under its parent, once', async () => {
    const { base, registry } = setup('mere');
    mkdirSync(join(base, 'docs'), { recursive: true });
    writeFileSync(join(base, 'docs/backlog.md'), '# Backlog\n\n## Son\n\n### Mère\n> ⚪ à faire\n\nTexte.\n\n### Autre\n> ⚪ à faire\n\nRien.\n');
    mkdirSync(join(registry, 'chats'), { recursive: true });
    writeFileSync(join(registry, 'chats', 'mere--sous-taches.json'), JSON.stringify({ id: 'mere--sous-taches', sessionId: 's', pending: false, mode: 'subtasks',
      messages: [{ role: 'user', text: 'Idées ?' }, { role: 'assistant', text: 'Une.', proposal: null, subtasks: ['### Fille\n\nLa suite.'] }] }));
    const previous = { ...process.env };
    Object.assign(process.env, { AGENTS_NO_AUTO: '1' });
    delete process.env.AGENTS_REGISTRY;
    const handle = roadmapRoutes({ mainRoot: base, registry, here: join(here, '..') });
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      handle(request, response, path).then((done: boolean) => done || (response.writeHead(404), response.end()));
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = async (path: string, body: object) => (await fetch(url + path, { method: 'POST', body: JSON.stringify(body) })).json();
    try {
      const created = await post('/api/backlog/chat/mere/subtask?mode=subtasks', { index: 1, sub: 0 });
      expect(created).toMatchObject({ ok: true, created: 'fille' });
      expect(created.chat.messages[1].created[0].id).toBe('fille');
      const backlog = readFileSync(join(base, 'docs/backlog.md'), 'utf8');
      expect(backlog).toContain('### Mère\n> ⚪ à faire\n\nTexte.\n\n### Fille\n> ⚪ à faire\n> ↳ après « Mère »\n\nLa suite.\n\n### Autre');
      expect((await post('/api/backlog/chat/mere/subtask?mode=subtasks', { index: 1, sub: 0 })).error).toMatch(/déjà/);
      const state = await (await fetch(`${url}/api/roadmap`)).json();
      expect(state.items.find((item: { id: string }) => item.id === 'mere')).toMatchObject({ subtaskCount: 1, subChat: { count: 2 } });
    } finally {
      server.close();
      for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
      Object.assign(process.env, previous);
    }
  });
});
