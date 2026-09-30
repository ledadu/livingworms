// Live view of the agent worktrees: node agent/dashboard.mjs [port], default 7800.
// No dependency: reads the registry in .git/agents and asks git about each worktree.
import { execFile, spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createHub } from './hub.mjs';
import { versionsRoutes } from './versions.mjs';
import { handleQuestions } from './questions-routes.mjs';
import { roadmapRoutes } from './roadmap-routes.mjs';
import { branchesRoutes } from './branches-routes.mjs';
import { isReleaseServer } from './release-servers.mjs';
import { mergeOrder, orderTask, runState, sessionTranscript } from './launch.mjs';
import { cleanAgents, orphanBranches } from './clean.mjs';
import { parseGoal } from './goal.mjs';
import { syncBacklog } from './backlog.mjs';
import { UNRELEASED } from '../release/changes.mjs';
import { markQueue, readQueue } from './roadmap.mjs';
import { briefPath, project, renderPage, renderText } from '../config.mjs';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2]) || 7800;

async function git(cwd, ...args) {
  try {
    const { stdout } = await run('git', ['-C', cwd, ...args], { maxBuffer: 4 * 1024 * 1024 });
    return stdout.trim();
  } catch {
    return '';
  }
}

// The git directory shared by every worktree, relative to this folder when git answers with a relative path.
const commonDir = resolve(here, await git(here, 'rev-parse', '--git-common-dir'));
const mainRoot = dirname(commonDir);
const registry = join(commonDir, 'agents');
// Where the runs launched from the Roadmap page live (launch.mjs): the registry of the roadmap routes.
const runsRegistry = process.env.AGENTS_REGISTRY || registry;

// An agent's report: <changes>/unreleased/<name>/report.md.
const reportFolder = (dir, name) => join(dir, project.paths.changes, UNRELEASED, name);
const reportFile = (dir, name) => join(reportFolder(dir, name), 'report.md');
const { main: MAIN, integration: INTEGRATION } = project.branches;

function readEnv(file) {
  const values = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^(\w+)=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function portOpen(portNumber) {
  return new Promise((resolve) => {
    const socket = createConnection({ port: portNumber, host: '127.0.0.1' });
    socket.setTimeout(400);
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => (socket.destroy(), resolve(false)));
  });
}

function tail(file, lines) {
  try {
    return readFileSync(file, 'utf8').split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
}

// Newest modification among the tracked or new files of the worktree, a sign of activity.
async function lastActivity(dir) {
  const files = (await git(dir, 'ls-files', '-m', '-o', '--exclude-standard')).split('\n').filter(Boolean);
  let newest = 0;
  for (const file of files.slice(0, 500)) {
    try {
      newest = Math.max(newest, statSync(join(dir, file)).mtimeMs);
    } catch {}
  }
  const commitTime = Number(await git(dir, 'log', '-1', '--format=%ct')) * 1000;
  return Math.max(newest, commitTime || 0);
}

// What the agent is there for: its task in the queue of the Roadmap page, or else the first message of its transcript.
function goalOf(name, transcriptPrompt) {
  let entry = null;
  try {
    entry = readQueue(join(runsRegistry, 'queue')).find((one) => one.name === name && one.status !== 'cancelled');
  } catch {}
  const goal = parseGoal(entry?.prompt ?? transcriptPrompt);
  if (!goal) return entry ? { title: entry.title, where: null, base: entry.base ?? null, text: '', choices: [], checks: [] } : null;
  if (entry?.title && (!goal.title || goal.title.length < 3)) goal.title = entry.title;
  return { ...goal, base: entry?.base ?? goal.base, text: goal.text.slice(0, 6000) };
}

// Where the agent stands against what the brief asks of it: commits, report, player entry, captures, and the branch it
// goes back to merged in (the brief asks for `git merge <base>`; AGENT_BASE is only the commit it started from).
async function deliverables(env, commits, report, baseBranch) {
  const folder = reportFolder(env.AGENT_DIR, env.AGENT_NAME);
  let captures = 0;
  try {
    captures = readdirSync(join(folder, 'img')).filter((file) => /\.(jpe?g|png|webp|gif)$/i.test(file)).length;
  } catch {}
  const base = baseBranch || (/^[0-9a-f]{40}$/.test(env.AGENT_BASE) ? null : env.AGENT_BASE);
  const behind = base ? (await git(env.AGENT_DIR, 'rev-list', '--count', `HEAD..${base}`)) : '';
  return { commits, report, entry: existsSync(join(folder, 'entry.md')), captures, behind: behind === '' ? null : Number(behind), base };
}

// An agent's own commits: along its branch (--first-parent), without the merges. The brief has it merge its base before
// its final answer (« git merge backlog »): the commits that merge brings in are the other agents', not its own.
const OWN_COMMITS = ['--first-parent', '--no-merges'];

// « 4 files changed, 157 insertions(+), 5 deletions(-) » over the agent's own commits (git log --numstat --format=).
function ownDiffstat(numstat) {
  const files = new Set();
  let added = 0;
  let removed = 0;
  for (const line of String(numstat ?? '').split('\n')) {
    const [plus, minus, path] = line.split('\t');
    if (!path) continue;
    files.add(path);
    added += Number(plus) || 0;
    removed += Number(minus) || 0;
  }
  if (!files.size) return '';
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  return `${plural(files.size, 'file')} changed, ${plural(added, 'insertion')}(+), ${plural(removed, 'deletion')}(-)`;
}

async function agentState(env) {
  const dir = env.AGENT_DIR;
  const exists = existsSync(dir);
  const [server, client] = await Promise.all([portOpen(Number(env.SERVER_PORT)), portOpen(Number(env.CLIENT_PORT))]);
  if (!exists) return { ...env, exists, server, client };
  const [log, status, numstat, activity] = await Promise.all([
    git(dir, 'log', ...OWN_COMMITS, '--format=%h\t%ct\t%s', `${env.AGENT_BASE}..HEAD`),
    git(dir, 'status', '--porcelain'),
    git(dir, 'log', ...OWN_COMMITS, '--numstat', '--format=', `${env.AGENT_BASE}..HEAD`),
    lastActivity(dir),
  ]);
  const diffstat = ownDiffstat(numstat);
  const commits = log
    ? log.split('\n').map((line) => {
        const [sha, time, subject] = line.split('\t');
        return { sha, time: Number(time) * 1000, subject };
      })
    : [];
  const report = reportFile(dir, env.AGENT_NAME);
  const { prompt, ...steps } = progress(env.AGENT_NAME, 6);
  const goal = goalOf(env.AGENT_NAME, prompt);
  return {
    progress: steps,
    goal,
    deliverables: await deliverables(env, commits.length, existsSync(report), goal?.base),
    run: runState(runsRegistry, env.AGENT_NAME),
    ...env,
    exists,
    server,
    client,
    commits,
    dirty: status ? status.split('\n') : [],
    diffstat,
    activity,
    report: existsSync(report) ? readFileSync(report, 'utf8') : null,
    serverLog: tail(join(dir, '.agent/server.log'), 25),
    clientLog: tail(join(dir, '.agent/client.log'), 25),
  };
}

// Computed in the background, one pass after the other: a request gets the latest snapshot at once, however slow git
// is on a machine loaded by a dozen agents.
let latest = null;
let firstSnapshot = null;
async function snapshotLoop() {
  for (;;) {
    try {
      latest = await snapshot();
    } catch (error) {
      console.error(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
firstSnapshot = new Promise((resolve) => {
  const wait = () => (latest ? resolve() : setTimeout(wait, 100));
  wait();
});
snapshotLoop();

// The status lines of the backlog follow the agents (queued, launched, merged, published) without the Roadmap page
// being open: backlog.mjs rewrites only the lines that changed.
const backlogRoot = process.env.AGENTS_ROADMAP_ROOT || mainRoot;
const backlogFile = join(backlogRoot, project.paths.backlog);
setInterval(() => {
  try {
    const { changes } = syncBacklog({ file: backlogFile, root: backlogRoot, registry: runsRegistry });
    for (const change of changes) console.log(`backlog: ${change.title} ${change.moved ? `-> ${project.paths.delivered}` : `${change.from} -> ${change.to}`}`);
  } catch (error) {
    console.error(`backlog: ${error.message}`);
  }
}, 30_000).unref();

async function snapshot() {
  let files = [];
  try {
    files = readdirSync(registry).filter((file) => file.endsWith('.env'));
  } catch {}
  // The test servers of versions (AGENT_KIND=release) belong to the « Branches » tab, not to the agents at work.
  const envs = files.map((file) => readEnv(join(registry, file)));
  const agents = await Promise.all(envs.filter((env) => !isReleaseServer(env)).map(agentState));
  agents.sort((a, b) => Number(a.AGENT_SLOT) - Number(b.AGENT_SLOT));
  return { now: Date.now(), main: mainRoot, agents, releaseServers: envs.filter(isReleaseServer).length };
}

// Every commit of every agent since its base, newest first, with its message body and the files it touched.
async function commits() {
  let files = [];
  try {
    files = readdirSync(registry).filter((file) => file.endsWith('.env'));
  } catch {}
  const all = [];
  await Promise.all(
    files.map(async (file) => {
      const env = readEnv(join(registry, file));
      if (!existsSync(env.AGENT_DIR) || isReleaseServer(env)) return;
      const raw = await git(env.AGENT_DIR, 'log', ...OWN_COMMITS, '--numstat', '--format=%x1e%H%x1f%h%x1f%ct%x1f%an%x1f%s%x1f%b%x1f', `${env.AGENT_BASE}..HEAD`);
      for (const record of raw.split('\x1e').filter((part) => part.trim())) {
        const [hash, sha, time, author, subject, body, numstat = ''] = record.split('\x1f');
        const changes = numstat
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [added, removed, path] = line.split('\t');
            return { added: Number(added) || 0, removed: Number(removed) || 0, path };
          });
        all.push({ agent: env.AGENT_NAME, hash, sha, time: Number(time) * 1000, author, subject, body: body.trim(), changes });
      }
    }),
  );
  return all.sort((a, b) => b.time - a.time);
}

async function reports() {
  let files = [];
  try {
    files = readdirSync(registry).filter((file) => file.endsWith('.env'));
  } catch {}
  return files
    .map((file) => readEnv(join(registry, file)))
    .filter((env) => !isReleaseServer(env))
    .map((env) => {
      const path = reportFile(env.AGENT_DIR, env.AGENT_NAME);
      if (!existsSync(path)) return { agent: env.AGENT_NAME, slot: Number(env.AGENT_SLOT), text: null };
      return { agent: env.AGENT_NAME, slot: Number(env.AGENT_SLOT), text: readFileSync(path, 'utf8'), time: statSync(path).mtimeMs };
    })
    .sort((a, b) => a.slot - b.slot);
}

// Progress of the Claude agents working in the worktrees: their transcripts (JSONL, one per subagent) under
// ~/.claude/projects/*/*/subagents/, tied to an agent by the worktree path in their first message. Newest one wins.
// An agent launched from the Roadmap page (launch.mjs) is a session of its own, with a known id: its transcript is
// ~/.claude/projects/<encoded worktree>/<session>.jsonl, and it wins over its own subagents.
const transcriptRoot = process.env.AGENT_TRANSCRIPTS || join(homedir(), '.claude/projects');
const transcriptOwners = new Map(); // file -> agent name, or '' when it names no worktree

function transcriptFiles() {
  const files = [];
  const list = (dir) => {
    try {
      return readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
  };
  for (const project of list(transcriptRoot)) {
    if (!project.isDirectory()) continue;
    for (const session of list(join(transcriptRoot, project.name))) {
      if (!session.isDirectory()) continue;
      const folder = join(transcriptRoot, project.name, session.name, 'subagents');
      for (const file of list(folder)) if (file.name.endsWith('.jsonl')) files.push(join(folder, file.name));
    }
  }
  return files;
}

function transcriptOwner(file, names) {
  if (transcriptOwners.has(file)) return transcriptOwners.get(file);
  let owner = '';
  try {
    const handle = openSync(file, 'r');
    const head = Buffer.alloc(64 * 1024);
    const read = readSync(handle, head, 0, head.length, 0);
    closeSync(handle);
    const firstLine = head.subarray(0, read).toString('utf8').split('\n', 1)[0];
    const content = JSON.parse(firstLine).message?.content;
    const text = typeof content === 'string' ? content : JSON.stringify(content ?? '');
    const match = /\.worktrees\/([a-z0-9-]+)/.exec(text);
    owner = match && names.has(match[1]) ? match[1] : '';
  } catch {
    return ''; // first line still being written: try again next pass
  }
  transcriptOwners.set(file, owner);
  return owner;
}

function transcriptOf(name) {
  const own = sessionTranscript(transcriptRoot, runState(runsRegistry, name)?.sessionId);
  if (own) return { file: own, mtime: statSync(own).mtimeMs };
  const names = new Set(readdirSync(registry).filter((f) => f.endsWith('.env')).map((f) => f.slice(0, -4)));
  let best = null;
  for (const file of transcriptFiles()) {
    if (transcriptOwner(file, names) !== name) continue;
    const mtime = statSync(file).mtimeMs;
    if (!best || mtime > best.mtime) best = { file, mtime };
  }
  return best;
}

const shorten = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// One line per step: what the agent said, the tools it called (with their description), the messages it received.
function toolLabel(tool) {
  const input = tool.input ?? {};
  const detail = input.description || input.file_path || input.pattern || input.command || input.prompt || input.query || '';
  return `${tool.name}${detail ? ' · ' + shorten(String(detail).replace(/\s+/g, ' '), 160) : ''}`;
}

// Transcripts only grow: each one is read from where the previous pass stopped, and its events are kept.
const parsedTranscripts = new Map(); // file -> { offset, rest, events, finished }

function progress(name, limit = 80) {
  const transcript = transcriptOf(name);
  if (!transcript) return { events: [], finished: false, updated: 0 };
  const state = readTranscript(transcript.file);
  return { prompt: state.prompt, events: state.events.slice(-limit), total: state.events.length, finished: state.finished, updated: transcript.mtime };
}

function readTranscript(file) {
  let state = parsedTranscripts.get(file);
  if (!state) {
    state = { offset: 0, rest: '', events: [], finished: false };
    parsedTranscripts.set(file, state);
  }
  const size = statSync(file).size;
  if (size < state.offset) Object.assign(state, { offset: 0, rest: '', events: [], finished: false });
  if (size === state.offset) return state;
  const handle = openSync(file, 'r');
  const chunk = Buffer.alloc(size - state.offset);
  readSync(handle, chunk, 0, chunk.length, state.offset);
  closeSync(handle);
  state.offset = size;
  const lines = (state.rest + chunk.toString('utf8')).split('\n');
  state.rest = lines.pop() ?? '';
  for (const line of lines) if (line) readEntry(line, state);
  // Keep memory bounded: the full journal shows the last 400 steps.
  if (state.events.length > 1000) state.events.splice(0, state.events.length - 400);
  return state;
}

// Notes of the agent runtime itself (reminders, resumptions), not messages of the orchestrator.
function isHarnessNote(text) {
  const trimmed = text.trim();
  return /^\[[a-z-]+\]/.test(trimmed) || /^Your response above was cut off/.test(trimmed) || /^<system-reminder>/.test(trimmed);
}

function readEntry(line, state) {
  const { events } = state;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return;
  }
  const time = Date.parse(entry.timestamp) || 0;
  const content = entry.message?.content;
  if (entry.type === 'assistant' && Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'text' && part.text.trim()) {
        const text = part.text.trim();
        // A failed call to the model ends the agent's turn with this text: an interruption, not something it said.
        events.push({ time, kind: /^API Error\b/.test(text) ? 'error' : 'say', text: shorten(text, 600) });
      }
      if (part.type === 'tool_use') events.push({ time, kind: 'tool', text: toolLabel(part) });
    }
    state.finished = entry.message.stop_reason === 'end_turn';
  } else if (entry.type === 'user') {
    // The first words the agent received are its prompt, and so its goal.
    if (state.prompt === undefined) {
      const text = typeof content === 'string' ? content : Array.isArray(content) ? content.filter((part) => part.type === 'text').map((part) => part.text).join('\n') : '';
      if (text.trim() && !isHarnessNote(text)) state.prompt = text;
    }
    if (typeof content === 'string') {
      if (!isHarnessNote(content)) events.push({ time, kind: 'in', text: shorten(content.trim(), 300) });
      state.finished = false;
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === 'tool_result' && part.is_error) {
          const text = Array.isArray(part.content) ? part.content.map((c) => c.text ?? '').join(' ') : String(part.content ?? '');
          events.push({ time, kind: 'error', text: shorten(text.trim(), 300) });
        }
        if (part.type === 'text' && part.text.trim() && !isHarnessNote(part.text)) events.push({ time, kind: 'in', text: shorten(part.text.trim(), 300) });
      }
      if (content.some((part) => part.type === 'text')) state.finished = false;
    }
  }
}

// « pull --rebase » of an agent's branch on a base (the main branch by default): the base is first brought up to date from origin
// when it can fast-forward, then the branch is replayed on it. Refused while files are being edited; a conflict aborts
// the rebase and names the files, so the worktree is never left half-rebased.
// Archives an agent (or brings it back): a line AGENT_ARCHIVED=<date> in its registry file; the dashboard files it
// under « Tâches archivées ».
function setArchived(name, archived) {
  const envFile = join(registry, `${name}.env`);
  if (!existsSync(envFile)) return { ok: false, error: `agent inconnu ${name}` };
  const text = readFileSync(envFile, 'utf8').replace(/^AGENT_ARCHIVED=.*\n?/m, '');
  writeFileSync(envFile, archived ? `${text.replace(/\n?$/, '\n')}AGENT_ARCHIVED=${new Date().toISOString()}\n` : text);
  return { ok: true };
}

// The branch an agent's work goes back to: its task in the queue, « partie de <base> » in its prompt, else the
// integration branch.
function baseBranchOf(name) {
  const { prompt } = progress(name, 1);
  return goalOf(name, prompt)?.base || INTEGRATION;
}

// « ✓ Accepter » : the agent's branch merged (--no-ff) into its base branch in the main checkout, which must be on
// that branch; then the task is archived, so that its entry shows under « À publier », its queue entry done and its
// backlog line merged. A conflict aborts the merge and names the files; the main checkout is never left mid-merge.
async function acceptAgent(name) {
  const envFile = join(registry, `${name}.env`);
  if (!existsSync(envFile)) return { ok: false, error: `agent inconnu ${name}` };
  const env = readEnv(envFile);
  if (runState(runsRegistry, name)?.state === 'running') return { ok: false, error: 'l’agent tourne encore : attends qu’il ait fini, ou arrête-le' };
  if (existsSync(env.AGENT_DIR) && (await git(env.AGENT_DIR, 'status', '--porcelain'))) return { ok: false, error: 'fichiers non commités dans son worktree : l’agent n’a pas fini' };
  const base = baseBranchOf(name);
  const current = await git(mainRoot, 'symbolic-ref', '--short', 'HEAD');
  if (current !== base) return { ok: false, error: `le dépôt principal est sur ${current || 'un commit détaché'}, pas sur ${base} : passe-le sur ${base} pour accepter` };
  const branch = env.AGENT_BRANCH || `${project.branches.agent}${name}`;
  const merged = await run('git', ['-C', mainRoot, 'merge-base', '--is-ancestor', branch, base]).then(() => true, () => false);
  let message = `Déjà fusionnée dans ${base}.`;
  if (!merged) {
    try {
      await run('git', ['-C', mainRoot, 'merge', '--no-ff', '--no-edit', branch], { timeout: 120_000 });
      message = `Fusionnée dans ${base} (${(await git(mainRoot, 'rev-parse', '--short', 'HEAD'))}).`;
    } catch (error) {
      const conflicts = await git(mainRoot, 'diff', '--name-only', '--diff-filter=U');
      if (conflicts) await run('git', ['-C', mainRoot, 'merge', '--abort']).catch(() => {});
      const detail = conflicts ? `conflit, fusion annulée : ${conflicts.split('\n').join(', ')}. Donne-lui l’ordre de fusionner ${base} et de régler le conflit.`
        : String(error.stderr || error.message).trim().split('\n').slice(0, 3).join(' ');
      if (conflicts) return { ok: false, conflict: true, error: `conflit, fusion annulée : ${conflicts.split('\n').join(', ')}. Clique « 🔀 Corriger les conflits » : l’agent fusionne ${base} et les règle, puis accepte à nouveau.` };
      return { ok: false, error: detail };
    }
  }
  setArchived(name, true);
  await agentCommand('down', name);
  try {
    const entry = readQueue(join(runsRegistry, 'queue')).find((one) => one.name === name);
    if (entry && entry.status !== 'done') markQueue(join(runsRegistry, 'queue'), name, 'done');
  } catch {}
  try {
    syncBacklog({ file: backlogFile, root: backlogRoot, registry: runsRegistry });
  } catch {}
  return { ok: true, message: `${message} Tâche acceptée : elle passe dans « À publier ».` };
}

// « ✎ Nouvel ordre » : the agent goes on with its task (launch.mjs orderTask); an accepted task comes back under way.
function orderAgent(name, order) {
  const envFile = join(registry, `${name}.env`);
  if (!existsSync(envFile)) return { ok: false, error: `agent inconnu ${name}` };
  const env = readEnv(envFile);
  const { prompt } = progress(name, 1);
  const goal = goalOf(name, prompt);
  const base = goal?.base || INTEGRATION;
  const intro = `Tu es l'agent \`${name}\`. Lis d'abord la consigne commune ${join(mainRoot, briefPath)} et respecte-la strictement (commits terminés par \`${project.coAuthoredBy}\`)${project.brief ? `, puis la consigne du projet, \`${project.brief}\` dans ton worktree` : ''}.
Worktree : ${env.AGENT_DIR} (branche ${env.AGENT_BRANCH}, partie de ${base}). Ton chantier est fait : relis ton rapport \`${project.paths.changes}/${UNRELEASED}/${name}/report.md\` et \`git log\` pour reprendre le fil.

## Chantier : ${goal?.title ?? name}

${goal?.text ?? ''}`;
  try {
    const started = orderTask({ registry: runsRegistry, name, order, intro, base, worktree: env.AGENT_DIR });
    if (env.AGENT_ARCHIVED) setArchived(name, false);
    return { ok: true, message: `Ordre envoyé à ${name} (pid ${started.pid}${started.resumes ? ', même session' : ''}).` };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function rebaseAgent(name, base = MAIN, archive = false) {
  const envFile = join(registry, `${name}.env`);
  if (!existsSync(envFile)) return { ok: false, error: `agent inconnu ${name}` };
  const env = readEnv(envFile);
  const dir = env.AGENT_DIR;
  if (!/^[\w./-]+$/.test(base)) return { ok: false, error: `base invalide ${base}` };
  if (await git(dir, 'status', '--porcelain')) return { ok: false, error: 'fichiers en cours : l’agent travaille, rebase refusé' };
  const before = await git(dir, 'rev-parse', 'HEAD');
  let fetched = '';
  try {
    await run('git', ['-C', mainRoot, 'fetch', '--quiet', 'origin', `${base}:${base}`], { timeout: 60_000 });
    fetched = `${base} mis à jour depuis origin. `;
  } catch {
    // Offline, no such remote branch, or the local base is ahead: rebase on the local base as it is.
  }
  try {
    await run('git', ['-C', dir, 'rebase', base], { timeout: 120_000 });
  } catch (error) {
    const conflicts = await git(dir, 'diff', '--name-only', '--diff-filter=U');
    await run('git', ['-C', dir, 'rebase', '--abort']).catch(() => {});
    return { ok: false, error: conflicts ? `conflit, rebase annulé : ${conflicts.split('\n').join(', ')}` : String(error.stderr || error.message).trim().split('\n').slice(-2).join(' ') };
  }
  const after = await git(dir, 'rev-parse', 'HEAD');
  const baseSha = await git(dir, 'rev-parse', base);
  // The commits of the agent are now counted from the new base (unchanged when nothing was replayed).
  for (const file of before === after ? [] : [envFile, join(dir, '.env.agent')]) {
    if (existsSync(file)) writeFileSync(file, readFileSync(file, 'utf8').replace(/^AGENT_BASE=.*$/m, `AGENT_BASE=${baseSha}`));
  }
  if (archive) setArchived(name, true);
  const done = before === after ? `${fetched}Déjà à jour sur ${base}.` : `${fetched}Rebasé sur ${base}.`;
  return { ok: true, archived: archive, message: archive ? `${done} Tâche archivée.` : done };
}

// agent.sh up/down. Settles when the script exits, not when its output closes: the server and client it detaches may
// keep a copy of the pipe open.
function agentCommand(action, name) {
  return new Promise((resolve) => {
    const child = spawn(join(here, 'agent.sh'), [action, name], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    const timer = setTimeout(() => child.kill(), 300_000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      child.stdout.destroy();
      child.stderr.destroy();
      resolve({ code, output: output.trim() });
    });
  });
}

// Re-read on each request, so an edit of the pages shows without restarting.
const pageFile = (name) => {
  const text = readFileSync(join(here, name), 'utf8');
  return name.endsWith('.html') ? renderPage(text) : name.endsWith('.js') ? renderText(text) : text;
};

const versions = versionsRoutes({ registry, readEnv, pageFile });
const roadmap = roadmapRoutes({ mainRoot, registry, here });
// The « Branches » tab (branches-routes.mjs): the version branches release/X.Y and the test servers of versions.
const branches = branchesRoutes({ registry, readEnv, here });
// The home page, a map of the whole ecosystem (hub.mjs): /, /api/hub, /doc/…; the worktrees page moves to /agents.
const hub = createHub({ port, root: mainRoot, snapshot: () => latest, page: pageFile });

createServer((request, response) => {
  handle(request, response).catch((error) => {
    console.error(error);
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(String(error.stack || error));
  });
}).listen(port, () => console.log(`agents dashboard: http://localhost:${port}`));

async function handle(request, response) {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (await handleQuestions(request, response, registry)) return;
  if (await hub.route(path, request, response)) return;
  const json = (value) => {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  const progressOf = /^\/api\/progress\/([a-z0-9-]+)$/.exec(path);
  if (progressOf) return json(progress(progressOf[1], 400));
  if (path === '/api/commits') return json(await commits());
  if (path === '/api/reports') return json(await reports());
  // Starts or stops an agent's server and client (agent.sh up/down, which wait until the ports answer or close).
  const control = /^\/api\/(up|down)\/([a-z0-9-]+)$/.exec(path);
  if (control && request.method === 'POST') {
    const [, action, name] = control;
    if (!existsSync(join(registry, `${name}.env`))) return json({ ok: false, error: `unknown agent ${name}` });
    const { code, output } = await agentCommand(action, name);
    const env = readEnv(join(registry, `${name}.env`));
    return json(code === 0 ? { ok: true, url: `http://localhost:${env.CLIENT_PORT}`, log: output } : { ok: false, error: output });
  }
  const rebase = /^\/api\/rebase\/([a-z0-9-]+)$/.exec(path);
  if (rebase && request.method === 'POST') {
    const params = new URL(request.url ?? '/', 'http://localhost').searchParams;
    const result = await rebaseAgent(rebase[1], params.get('base') || MAIN, params.get('archive') === '1');
    latest = await snapshot();
    return json(result);
  }
  // « 🧹 Nettoyer les terminés » : ?dry=1 lists, then the same without it cleans (clean.mjs).
  if (path === '/api/clean' && request.method === 'POST') {
    const dryRun = new URL(request.url ?? '/', 'http://localhost').searchParams.get('dry') === '1';
    try {
      const result = cleanAgents({ mainRoot, registry: runsRegistry, dryRun });
      const orphans = orphanBranches({ mainRoot, registry: runsRegistry });
      if (!dryRun) for (const branch of orphans) await run('git', ['-C', mainRoot, 'branch', '-d', branch]).catch(() => {});
      if (!dryRun) latest = await snapshot();
      return json({ ok: result.errors.length === 0, dryRun, cleaned: result.cleaned.map((one) => one.name), orphans, errors: result.errors });
    } catch (error) {
      return json({ ok: false, error: error.message });
    }
  }
  const accept = /^\/api\/accept\/([a-z0-9-]+)$/.exec(path);
  if (accept && request.method === 'POST') {
    const result = await acceptAgent(accept[1]);
    latest = await snapshot();
    return json(result);
  }
  // « 🔀 Corriger les conflits » : the agent merges its base and settles the conflicts itself (a new order).
  const fix = /^\/api\/fix-conflicts\/([a-z0-9-]+)$/.exec(path);
  if (fix && request.method === 'POST') {
    const result = orderAgent(fix[1], mergeOrder(baseBranchOf(fix[1])));
    latest = await snapshot();
    return json(result.ok ? { ...result, message: `${fix[1]} fusionne ${baseBranchOf(fix[1])} et règle les conflits.` } : result);
  }
  const order = /^\/api\/order\/([a-z0-9-]+)$/.exec(path);
  if (order && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) body += chunk;
    let text = '';
    try {
      text = JSON.parse(body || '{}').order ?? '';
    } catch {}
    const result = orderAgent(order[1], text);
    latest = await snapshot();
    return json(result);
  }
  const archive = /^\/api\/(archive|unarchive)\/([a-z0-9-]+)$/.exec(path);
  if (archive && request.method === 'POST') {
    const result = setArchived(archive[2], archive[1] === 'archive');
    latest = await snapshot();
    return json(result);
  }
  const tryAgent = /^\/try\/([a-z0-9-]+)$/.exec(path);
  if (tryAgent) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(pageFile('try.html').replaceAll('__AGENT__', tryAgent[1]));
    return;
  }
  // Files next to a report (its images), from the folder of the agent's report only.
  const file = /^\/files\/([a-z0-9-]+)\/(.+)$/.exec(path);
  if (file) {
    const envFile = join(registry, `${file[1]}.env`);
    const folder = existsSync(envFile) ? dirname(reportFile(readEnv(envFile).AGENT_DIR, file[1])) : '';
    const target = folder && resolve(folder, decodeURIComponent(file[2]));
    if (!target || !target.startsWith(folder + '/') || !existsSync(target)) {
      response.writeHead(404);
      response.end();
      return;
    }
    const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', md: 'text/plain; charset=utf-8' };
    response.writeHead(200, { 'content-type': types[target.split('.').pop().toLowerCase()] ?? 'application/octet-stream' });
    response.end(readFileSync(target));
    return;
  }
  // The versions tabs (versions.mjs): entries to publish, generations in preparation, published ones.
  if (await versions(request, response, path)) return;
  if (await branches(request, response, path)) return;
  // The roadmap page (roadmap-routes.mjs): its tasks, their status, and the queue for the orchestrator.
  if (await roadmap(request, response, path)) return;
  if (path === '/journal') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(pageFile('journal.html'));
    return;
  }
  if (path === '/api/agents') {
    await firstSnapshot;
    const body = JSON.stringify(latest);
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(body);
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(pageFile('dashboard.html'));
}

