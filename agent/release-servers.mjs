// Test servers of a version: a worktree of release/X.Y (or of a tag) made by agent.sh like an agent's, with its own
// ports and copy of the database, marked AGENT_KIND=release in the registry so that it shows in the « Branches » tab
// and not among the agents at work. Its branch is serve/<name> (v0-2 for release/0.2, v0-2-1 for v0.2.1), reset to the
// version it serves when it is refreshed.
import { execFile, spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
export const SERVE_PREFIX = 'serve/';

// The worktree name of a version: release/0.2 → v0-2, v0.2.1 → v0-2-1; null for anything else.
export function serverName(ref) {
  const match = /^(?:release\/)?v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(ref ?? '').trim());
  return match ? `v${match[1]}-${match[2]}${match[3] !== undefined ? `-${match[3]}` : ''}` : null;
}

export const isReleaseServer = (env) => env?.AGENT_KIND === 'release';

// The registry files, split into the agents and the test servers of versions.
export function splitRegistry(envs) {
  return { agents: envs.filter((env) => !isReleaseServer(env)), servers: envs.filter(isReleaseServer) };
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.setTimeout(400);
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => (socket.destroy(), resolve(false)));
  });
}

async function git(cwd, ...args) {
  const { stdout } = await run('git', ['-C', cwd, ...args], { maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}
const gitTry = (cwd, ...args) => git(cwd, ...args).catch(() => null);

// root: the repository whose branches are served; agentScript: agent.sh (of that repository, for its registry).
export function createServers({ root, registry, readEnv, agentScript }) {
  function script(args, extraEnv = {}) {
    return new Promise((resolve) => {
      const child = spawn(agentScript, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...extraEnv } });
      let output = '';
      child.stdout.on('data', (chunk) => (output += chunk));
      child.stderr.on('data', (chunk) => (output += chunk));
      const timer = setTimeout(() => child.kill(), 300_000);
      // On exit, not on close: the server and client it detaches may keep the pipe open.
      child.on('exit', (code) => {
        clearTimeout(timer);
        child.stdout.destroy();
        child.stderr.destroy();
        resolve({ code, output: output.trim() });
      });
    });
  }

  function envs() {
    try {
      return readdirSync(registry)
        .filter((file) => file.endsWith('.env'))
        .map((file) => readEnv(join(registry, file)));
    } catch {
      return [];
    }
  }

  const server = (name) => envs().find((env) => env.AGENT_NAME === name && isReleaseServer(env)) ?? null;

  async function list() {
    return Promise.all(
      splitRegistry(envs()).servers.map(async (env) => {
        const [up, client, head, target] = await Promise.all([
          portOpen(Number(env.SERVER_PORT)),
          portOpen(Number(env.CLIENT_PORT)),
          existsSync(env.AGENT_DIR ?? '') ? gitTry(env.AGENT_DIR, 'rev-parse', 'HEAD') : null,
          gitTry(root, 'rev-parse', `${env.AGENT_REF}^{commit}`),
        ]);
        return {
          name: env.AGENT_NAME,
          ref: env.AGENT_REF,
          branch: env.AGENT_BRANCH,
          dir: env.AGENT_DIR,
          exists: head !== null,
          server: up,
          client,
          serverPort: Number(env.SERVER_PORT),
          clientPort: Number(env.CLIENT_PORT),
          url: `http://localhost:${env.CLIENT_PORT}`,
          head: head?.slice(0, 7) ?? null,
          // The version moved on since the worktree was made or refreshed.
          stale: Boolean(head && target && head !== target),
        };
      }),
    );
  }

  // Resets the worktree to the version it serves (its own branch serve/<name>; refused while files are edited).
  async function refresh(name) {
    const env = server(name);
    if (!env) return { ok: false, error: `pas de serveur de version ${name}` };
    if (await gitTry(env.AGENT_DIR, 'status', '--porcelain', '--untracked-files=no')) return { ok: false, error: `fichiers modifiés dans ${env.AGENT_DIR} : actualisation refusée` };
    const target = await gitTry(root, 'rev-parse', `${env.AGENT_REF}^{commit}`);
    if (!target) return { ok: false, error: `${env.AGENT_REF} n'existe plus` };
    await git(env.AGENT_DIR, 'reset', '-q', '--hard', target);
    return { ok: true, message: `${name} actualisé sur ${env.AGENT_REF} (${target.slice(0, 7)})` };
  }

  // Makes the worktree when needed, then starts its server and client (agent.sh up waits until they answer).
  async function start(ref, { up = true } = {}) {
    const name = serverName(ref);
    if (!name || !/^(release\/\d+\.\d+|v\d+\.\d+\.\d+)$/.test(ref)) return { ok: false, error: `version invalide « ${ref} » : release/X.Y ou vX.Y.Z` };
    const target = await gitTry(root, 'rev-parse', `${ref}^{commit}`);
    if (!target) return { ok: false, error: `${ref} n'existe pas` };
    let env = envs().find((candidate) => candidate.AGENT_NAME === name);
    if (env && !isReleaseServer(env)) return { ok: false, error: `${name} est déjà le nom d'un agent` };
    if (!env) {
      const made = await script(['new', name, target], { AGENT_KIND: 'release', AGENT_REF: ref, AGENTS_BRANCH_PREFIX: SERVE_PREFIX });
      if (made.code !== 0) return { ok: false, error: made.output.split('\n').slice(-3).join(' ') };
      env = server(name);
      // A serve/<name> branch left by an earlier server is reused by agent.sh: bring it to the version.
      await gitTry(env.AGENT_DIR, 'reset', '-q', '--hard', target);
    }
    if (!up) return { ok: true, name, url: `http://localhost:${env.CLIENT_PORT}` };
    const started = await script(['up', name]);
    return started.code === 0 ? { ok: true, name, url: `http://localhost:${env.CLIENT_PORT}`, message: `serveur ${name} lancé` } : { ok: false, error: started.output.split('\n').slice(-3).join(' ') };
  }

  async function stop(name) {
    if (!server(name)) return { ok: false, error: `pas de serveur de version ${name}` };
    const result = await script(['down', name]);
    return result.code === 0 ? { ok: true, message: `${name} arrêté` } : { ok: false, error: result.output };
  }

  // Stops it, removes the worktree and its branch serve/<name>.
  async function remove(name) {
    const env = server(name);
    if (!env) return { ok: false, error: `pas de serveur de version ${name}` };
    const result = await script(['rm', name, '--force']);
    if (result.code !== 0) return { ok: false, error: result.output };
    if (env.AGENT_BRANCH?.startsWith(SERVE_PREFIX)) await gitTry(root, 'branch', '-D', env.AGENT_BRANCH);
    return { ok: true, message: `serveur ${name} supprimé` };
  }

  return { list, start, stop, refresh, remove };
}
