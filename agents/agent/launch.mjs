// Launches a queued task without the orchestrator: the « ▶ Lancer » button of the dashboard's Roadmap page starts the
// `claude` CLI, non-interactive (-p), in the task's worktree, detached so that it outlives the dashboard. Everything of a
// run lives in <registry>/runs/<name>/: prompt.md (its stdin), claude.log (stream-json output), run.json (pid, session,
// command) and exit (the exit code, written by the wrapping shell when claude ends). « ↻ Relancer » resumes the same
// session (--resume, same id, so the same transcript) with resume.md on stdin, its output appended to claude.log.
//
// AGENTS_CLAUDE_BIN: the executable (tests use a fake one); AGENTS_CLAUDE_PERMISSION_MODE: auto by default;
// AGENTS_CO_AUTHORED_BY: the line that replaces {{CO_AUTHORED_BY}} in the prompt.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markQueue, NAME_PATTERN, readQueue } from './roadmap.mjs';
import { effectiveSettings, settingsArgs } from './settings.mjs';
import { askPath, project } from '../config.mjs';

export const CO_AUTHORED_BY = project.coAuthoredBy;

export function claudeBin(env = process.env) {
  if (env.AGENTS_CLAUDE_BIN) return env.AGENTS_CLAUDE_BIN;
  const local = join(homedir(), '.local/bin/claude');
  return existsSync(local) ? local : 'claude';
}

/**
 * The arguments of a run: prompt on stdin, a known session id (to find its transcript), no question asked, the
 * agent's effort and model (settings.mjs) when it has some. A resume continues that session under the same id (no
 * --fork-session).
 */
export function claudeArgs({ sessionId, permissionMode = 'auto', resume = false, effort = null, model = null, name = null }) {
  return ['-p', resume ? '--resume' : '--session-id', sessionId, '--permission-mode', permissionMode, '--permission-prompts', 'none', ...settingsArgs({ effort, model }), ...teamArgs(name), '--output-format', 'stream-json', '--verbose'];
}

/**
 * The team's MCP server (team-mcp.mjs) for an agent: the backlog's tasks, the other agents and their files, messages
 * between agents, as tools (mcp__equipe__…), allowed without asking. AGENTS_NO_TEAM_MCP=1 leaves it out.
 */
export function teamArgs(name, env = process.env) {
  if (!name || env.AGENTS_NO_TEAM_MCP) return [];
  const server = { command: process.execPath, args: [join(dirname(fileURLToPath(import.meta.url)), 'team-mcp.mjs')], env: { AGENT_NAME: name } };
  return ['--mcp-config', JSON.stringify({ mcpServers: { equipe: server } }), '--allowedTools', 'mcp__equipe'];
}

export const runDir = (registry, name) => join(registry, 'runs', name);

function writeJson(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temp, file);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Start time of a process (field 22 of /proc/<pid>/stat), so that a pid reused by another process is not taken for
// the run. Null when /proc cannot tell.
function startTime(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19] ?? null;
  } catch {
    return null;
  }
}

function alive(run) {
  if (!run?.pid) return false;
  try {
    process.kill(run.pid, 0);
  } catch (error) {
    if (error.code !== 'EPERM') return false;
  }
  const started = startTime(run.pid);
  return !run.startTime || !started || started === run.startTime;
}

/**
 * Where a run stands: running, done (exit 0), error (other code), stopped (by the Stop button) or lost (the process
 * vanished without an exit code: machine restarted, killed by hand). Null when the task was never launched from here.
 */
export function runState(registry, name) {
  const dir = runDir(registry, name);
  const run = readJson(join(dir, 'run.json'));
  if (!run) return null;
  const exitText = existsSync(join(dir, 'exit')) ? readFileSync(join(dir, 'exit'), 'utf8').trim() : '';
  const code = exitText === '' ? null : Number(exitText);
  const state = run.stoppedAt ? 'stopped' : code !== null ? (code === 0 ? 'done' : 'error') : alive(run) ? 'running' : 'lost';
  return { ...run, state, code, log: join(dir, 'claude.log') };
}

// The claim of a queued task is exclusive (a lock file created with O_EXCL): the dashboard and `queue.mjs mark …
// launched` of the orchestrator cannot both take it.
export function claimQueue(queueDir, name, extra = {}, now = new Date().toISOString()) {
  if (!NAME_PATTERN.test(name ?? '')) throw new Error(`nom invalide ${name}`);
  mkdirSync(queueDir, { recursive: true });
  const lock = join(queueDir, `${name}.lock`);
  let handle;
  try {
    handle = openSync(lock, 'wx');
  } catch {
    throw new Error(`${name} est déjà en cours de lancement`);
  }
  try {
    const entry = readQueue(queueDir).find((one) => one.name === name);
    if (!entry) throw new Error(`pas de tâche ${name} dans la file`);
    if (entry.status !== 'queued') throw new Error(`${name} n’est plus en attente (${entry.status}${entry.launchedBy === 'dashboard' ? ', lancée depuis le tableau de bord' : ''})`);
    markQueue(queueDir, name, 'launched', now);
    const file = join(queueDir, `${name}.json`);
    const marked = { ...JSON.parse(readFileSync(file, 'utf8')), ...extra };
    writeJson(file, marked);
    return marked;
  } finally {
    closeSync(handle);
    rmSync(lock, { force: true });
  }
}

/**
 * Launches a queued task: claims it, writes its prompt, then starts `sh -c '<claude> … <prompt.md; echo $? >exit'` in
 * the worktree, in its own process group, detached. Returns the run.
 */
export function launchTask({ registry, queueDir = join(registry, 'queue'), name, env = process.env, now = () => new Date().toISOString() }) {
  const entry = readQueue(queueDir).find((one) => one.name === name);
  if (!entry) throw new Error(`pas de tâche ${name} dans la file`);
  if (entry.status !== 'queued') throw new Error(`${name} n’est plus en attente (${entry.status})`);
  const envFile = join(registry, `${name}.env`);
  const worktree = existsSync(envFile) ? /^AGENT_DIR=(.*)$/m.exec(readFileSync(envFile, 'utf8'))?.[1] : undefined;
  if (!worktree || !existsSync(worktree)) throw new Error(`worktree de ${name} introuvable`);

  const sessionId = randomUUID();
  const permissionMode = env.AGENTS_CLAUDE_PERMISSION_MODE || 'auto';
  claimQueue(queueDir, name, { launchedBy: 'dashboard', sessionId }, now());

  const dir = runDir(registry, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const prompt = String(entry.prompt ?? '').replaceAll('{{CO_AUTHORED_BY}}', env.AGENTS_CO_AUTHORED_BY || CO_AUTHORED_BY);
  writeFileSync(join(dir, 'prompt.md'), prompt);
  const settings = effectiveSettings(registry, name);
  const run = startClaude({ dir, worktree, stdin: 'prompt.md', args: claudeArgs({ sessionId, permissionMode, ...settings, name }), env });
  writeJson(join(dir, 'run.json'), { name, ...run, sessionId, cwd: worktree, permissionMode, ...settings, startedAt: now() });
  return runState(registry, name);
}

// Starts `sh -c '<claude> … <stdin; echo $? >exit'` in the worktree, in its own process group, detached, its output
// appended to claude.log.
function startClaude({ dir, worktree, stdin, args, env }) {
  const bin = claudeBin(env);
  const log = openSync(join(dir, 'claude.log'), 'a');
  // A dashboard started from a Claude Code session must not make claude believe it is nested in it.
  const childEnv = { ...env, AGENTS_RUN_DIR: dir, AGENTS_RUN_STDIN: stdin };
  delete childEnv.CLAUDECODE;
  delete childEnv.CLAUDE_CODE_ENTRYPOINT;
  let child;
  try {
    child = spawn('/bin/sh', ['-c', '"$@" <"$AGENTS_RUN_DIR/$AGENTS_RUN_STDIN"; code=$?; echo $code >"$AGENTS_RUN_DIR/exit.tmp" && mv "$AGENTS_RUN_DIR/exit.tmp" "$AGENTS_RUN_DIR/exit"', 'sh', bin, ...args], {
      cwd: worktree,
      env: childEnv,
      detached: true,
      stdio: ['ignore', log, log],
    });
  } finally {
    closeSync(log);
  }
  child.on('error', () => {});
  child.unref();
  return { pid: child.pid, pgid: child.pid, startTime: startTime(child.pid), bin, args };
}

export const RESUME_PROMPT = `Ta session a été interrompue (coupure réseau, erreur d'API ou arrêt) : reprends ton chantier où tu en étais.
Vérifie d'abord \`git status\`, \`git log\` et ce qui tourne encore (serveurs de ton worktree), puis termine le travail, le rapport et les commits comme le demande ta consigne.`;

/**
 * Resumes a run that no longer works (error, stopped, lost, or even done): the same session with --resume, a note
 * (and the user's words, if any) on stdin. The previous exit code and stop are cleared; resumes are counted.
 */
export function resumeTask({ registry, name, message = '', prompt = null, env = process.env, now = () => new Date().toISOString() }) {
  const dir = runDir(registry, name);
  const previous = readJson(join(dir, 'run.json'));
  if (!previous?.sessionId) throw new Error(`${name} n’a pas été lancée depuis le tableau de bord`);
  const state = runState(registry, name);
  if (state.state === 'running') throw new Error(`${name} tourne encore`);
  if (!previous.cwd || !existsSync(previous.cwd)) throw new Error(`worktree de ${name} introuvable`);
  const permissionMode = env.AGENTS_CLAUDE_PERMISSION_MODE || previous.permissionMode || 'auto';
  rmSync(join(dir, 'exit'), { force: true });
  const note = String(message ?? '').trim();
  writeFileSync(join(dir, 'resume.md'), prompt ?? (note ? `${RESUME_PROMPT}\n\nMessage de l'utilisateur : ${note}` : RESUME_PROMPT));
  // The agent's settings as they are now: its card may have changed them since the last start.
  const settings = effectiveSettings(registry, name);
  const run = startClaude({ dir, worktree: previous.cwd, stdin: 'resume.md', args: claudeArgs({ sessionId: previous.sessionId, permissionMode, resume: true, ...settings, name }), env });
  const { stoppedAt, ...kept } = previous;
  const resumes = [...(previous.resumes ?? []), { at: now(), after: state.state, code: state.code, ...settings }];
  writeJson(join(dir, 'run.json'), { ...kept, ...run, permissionMode, ...settings, resumedAt: now(), resumes });
  return runState(registry, name);
}

/** The order of « 🔀 Corriger les conflits »: bring the base in, both sides kept, checked and committed. */
export function mergeOrder(base = project.branches.integration) {
  return `Ta branche est en retard sur \`${base}\` et ne se fusionne plus proprement : d'autres agents y ont fusionné leur travail entre-temps. Fusionne-la maintenant dans ta branche (\`git merge ${base}\`) et règle chaque conflit :

- garde **les deux côtés** : le travail arrivé sur \`${base}\` et le tien ; quand ils touchent la même ligne (une liste, un import, un appel), combine-les ;
- ne retire rien qui vienne de \`${base}\` sans raison, et relis aussi les fichiers fusionnés sans conflit qui touchent ton chantier (une fonction renommée, un paramètre ajouté) ;
- dans les docs et les tableaux (catalogues, compteurs), recalcule les chiffres d'après les lignes au lieu de choisir un côté ;
- si un conflit demande un vrai choix de conception, pose la question par le tableau de bord (\`${askPath}\`).

Puis \`npm run typecheck\`, la suite de tests (\`make check\`) et commite la fusion. Ta réponse finale liste les fichiers en conflit et comment tu les as réglés.`;
}

/**
 * The order of « 🛠 Faire corriger par l'agent »: « Accepter » refused the agent's branch for a reason on its side (files
 * left uncommitted, a merge git refused…); `error` is that refusal, `log` the file that keeps every refusal.
 */
export function acceptOrder(error, { base = project.branches.integration, log = null } = {}) {
  return `« ✓ Accepter » a refusé ta branche, avec cette erreur :

> ${String(error).trim().replace(/\n/g, '\n> ')}
${log ? `\nToutes les erreurs d'acceptation de ta tâche sont dans \`${log}\`.\n` : ''}
Corrige ce qui la cause, de ton côté : par exemple des fichiers non commités (ton rapport, ton entrée, tes captures dans \`img/\` : commite-les s'ils font partie du chantier, après avoir vérifié que l'entrée ne cite que des images qui existent ; supprime-les sinon), ou une fusion que git refuse. Puis \`git merge ${base}\`, \`make check\`, et vérifie que \`git status --porcelain\` est vide. Ta réponse finale dit ce qui bloquait et ce que tu as fait.`;
}

/** What an agent receives with a new order once its task is over: the order, then what its brief still asks. */
export function orderPrompt(order, { name, base = project.branches.integration }) {
  return `Nouvel ordre de l'utilisateur, pour peaufiner ou prolonger ton chantier :

${String(order).trim()}

Travaille comme le demande ta consigne : dans ton worktree, commits en anglais, rapport \`${project.paths.changes}/unreleased/${name}/report.md\` et entrée mis à jour (ce que cet ordre a changé), captures si ça se voit, \`git merge ${base}\` puis \`make check\` avant ta réponse finale (10 lignes max).`;
}

/**
 * Gives an agent whose task is over a new order. A session launched from here is resumed (same id, same history);
 * any other agent (launched by the orchestrator) gets a session of its own in its worktree, with its goal restated:
 * `intro` is the start of that prompt. Returns the run.
 */
export function orderTask({ registry, name, order, intro = '', base = project.branches.integration, worktree, env = process.env, now = () => new Date().toISOString() }) {
  if (!String(order ?? '').trim()) throw new Error('ordre vide');
  const state = runState(registry, name);
  if (state?.state === 'running') throw new Error(`${name} tourne encore`);
  const prompt = orderPrompt(order, { name, base });
  if (state?.sessionId) return resumeTask({ registry, name, prompt, env, now });
  if (!worktree || !existsSync(worktree)) throw new Error(`worktree de ${name} introuvable`);
  const dir = runDir(registry, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const sessionId = randomUUID();
  const permissionMode = env.AGENTS_CLAUDE_PERMISSION_MODE || 'auto';
  writeFileSync(join(dir, 'prompt.md'), `${intro ? `${intro.trim()}\n\n` : ''}${prompt}`);
  const settings = effectiveSettings(registry, name);
  const run = startClaude({ dir, worktree, stdin: 'prompt.md', args: claudeArgs({ sessionId, permissionMode, ...settings, name }), env });
  writeJson(join(dir, 'run.json'), { name, ...run, sessionId, cwd: worktree, permissionMode, ...settings, startedAt: now(), orderedAt: now() });
  return runState(registry, name);
}

/** Stops a run: SIGTERM to its whole process group, SIGKILL a few seconds later if it still stands. */
export function stopTask({ registry, name, now = () => new Date().toISOString(), graceMs = 5000 }) {
  const dir = runDir(registry, name);
  const run = readJson(join(dir, 'run.json'));
  if (!run) throw new Error(`${name} n’a pas été lancée depuis le tableau de bord`);
  const state = runState(registry, name);
  if (state.state !== 'running') throw new Error(`${name} ne tourne pas (${state.state})`);
  writeJson(join(dir, 'run.json'), { ...run, stoppedAt: now() });
  const signal = (sig) => {
    try {
      process.kill(-run.pgid, sig);
    } catch {}
  };
  signal('SIGTERM');
  setTimeout(() => alive(run) && signal('SIGKILL'), graceMs).unref();
  return runState(registry, name);
}

/** The last lines of a run's output. */
export function runLog(registry, name, lines = 200) {
  try {
    return readFileSync(join(runDir(registry, name), 'claude.log'), 'utf8').split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
}

/**
 * The output of a run from a byte offset, cut after its last complete line: { text, next }, next being the offset to
 * ask for on the following call (the run page polls it while the agent works).
 */
export function runLogFrom(registry, name, from = 0) {
  let buffer;
  try {
    buffer = readFileSync(join(runDir(registry, name), 'claude.log'));
  } catch {
    return { text: '', next: 0 };
  }
  const start = Math.min(Math.max(0, from), buffer.length);
  const end = buffer.lastIndexOf(0x0a) + 1;
  if (end <= start) return { text: '', next: start };
  return { text: buffer.subarray(start, end).toString('utf8'), next: end };
}

/**
 * The transcript of a session launched from the dashboard: ~/.claude/projects/<encoded worktree path>/<session>.jsonl.
 * Looked up in every project folder, so the encoding of the path does not matter. Null until claude has written it.
 */
export function sessionTranscript(transcriptRoot, sessionId) {
  if (!sessionId || !/^[0-9a-f-]+$/i.test(sessionId)) return null;
  let projects = [];
  try {
    projects = readdirSync(transcriptRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const file = join(transcriptRoot, project.name, `${sessionId}.jsonl`);
    if (existsSync(file)) return file;
  }
  return null;
}
