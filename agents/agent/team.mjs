#!/usr/bin/env node
// The team, as an agent sees it: the tasks of the backlog as they stand now, the other agents and what they are doing,
// the files it shares with them, and messages between agents. An agent runs it from its worktree (`node
// agents/agent/team.mjs --help`), or through the MCP server team-mcp.mjs, which gives the same as tools.
//
// Everything is read from the shared registry (.git/agents) and the main checkout: no dashboard needed. Messages live
// in <registry>/messages/<agent>.jsonl (one line each), what an agent has read in <registry>/messages/<agent>.read.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseBacklog, withLabels } from './backlog.mjs';
import { runState } from './launch.mjs';
import { readQueue } from './roadmap.mjs';
import { listQuestions, registryDir } from './questions.mjs';
import { project } from '../config.mjs';

const NAME = /^[a-z0-9-]+$/;
const git = (cwd, ...args) => {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 8 * 1024 * 1024 }).trim();
  } catch {
    return '';
  }
};
const readEnv = (file) => {
  const out = {};
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = /^([A-Z_]+)=(.*)$/.exec(line);
      if (match) out[match[1]] = match[2];
    }
  } catch {}
  return out;
};

/** Where the team lives: the registry, the main checkout, and who is asking (AGENT_NAME, else .env.agent of the worktree). */
export function context({ cwd = process.cwd(), env = process.env } = {}) {
  const registry = registryDir(cwd, env);
  const mainRoot = dirname(dirname(registry));
  let me = env.AGENT_NAME ?? '';
  if (!me) {
    const top = git(cwd, 'rev-parse', '--show-toplevel');
    me = top ? readEnv(join(top, '.env.agent')).AGENT_NAME ?? '' : '';
  }
  return { registry, runsRegistry: env.AGENTS_REGISTRY || registry, mainRoot, me: NAME.test(me) ? me : null };
}

// ---------------------------------------------------------------------------------------------------------------
// The tasks

/** The tasks of the backlog of the main checkout, as they stand now (`all`: the delivered ones too). */
export function tasks(ctx, { all = false } = {}) {
  const file = join(ctx.mainRoot, project.paths.backlog);
  if (!existsSync(file)) return [];
  const items = withLabels(parseBacklog(readFileSync(file, 'utf8'))).filter((item) => item.kind === 'task' && (all || item.state !== 'done'));
  return items.map((item) => ({ id: item.id, title: item.title, section: item.section, state: item.state, label: item.label, agents: item.agents, after: item.after, auto: Boolean(item.auto), line: item.line, files: item.files }));
}

/** One task, its whole text: by id, or by (part of) its title. */
export function task(ctx, query) {
  const file = join(ctx.mainRoot, project.paths.backlog);
  const items = withLabels(parseBacklog(readFileSync(file, 'utf8'))).filter((item) => item.kind === 'task');
  const q = String(query ?? '').toLowerCase();
  const found = items.find((item) => item.id === q) ?? items.find((item) => item.title.toLowerCase().includes(q));
  if (!found) throw new Error(`pas de tâche « ${query} »`);
  const sub = items.filter((item) => item.after === found.id).map((item) => item.title);
  return { id: found.id, title: found.title, section: found.section, state: found.label, agents: found.agents, after: found.after, subtasks: sub, text: found.text };
}

// ---------------------------------------------------------------------------------------------------------------
// The agents

/**
 * The files an agent changed itself: those of its own commits (along its branch, without the merges, which would bring
 * in everyone's work from its base), and those its worktree has not committed yet.
 */
function filesOf(ctx, env) {
  const branch = env.AGENT_BRANCH;
  const base = env.AGENT_BASE;
  const committed = branch && base ? git(ctx.mainRoot, 'log', '--first-parent', '--no-merges', '--name-only', '--format=', `${base}..${branch}`).split('\n').filter(Boolean) : [];
  const dirty = env.AGENT_DIR && existsSync(env.AGENT_DIR) ? git(env.AGENT_DIR, 'status', '--porcelain').split('\n').filter(Boolean).map((line) => line.slice(3)) : [];
  return [...new Set([...committed, ...dirty])];
}

/** The other agents (and this one): name, state, task, last words, files changed. `withFiles` costs a few git calls. */
export function agents(ctx, { withFiles = true, archived = false } = {}) {
  const queue = (() => {
    try {
      return readQueue(join(ctx.runsRegistry, 'queue'));
    } catch {
      return [];
    }
  })();
  const backlog = tasks(ctx, { all: true });
  const out = [];
  for (const file of readdirSync(ctx.registry).filter((one) => one.endsWith('.env'))) {
    const env = readEnv(join(ctx.registry, file));
    if (env.AGENT_KIND === 'release' || !env.AGENT_NAME) continue;
    if (env.AGENT_ARCHIVED && !archived) continue;
    const name = env.AGENT_NAME;
    const entry = queue.find((one) => one.name === name);
    const run = runState(ctx.runsRegistry, name);
    const state = env.AGENT_ARCHIVED ? 'acceptée' : entry?.status === 'queued' ? 'en file' : run?.state === 'running' ? 'au travail'
      : run?.state === 'done' ? 'fini, à accepter' : run?.state === 'error' || run?.state === 'lost' ? 'en erreur' : 'en pause';
    const taskOf = backlog.find((one) => one.agents?.includes(name)) ?? (entry?.id ? backlog.find((one) => one.id === entry.id) : null);
    out.push({
      name,
      me: name === ctx.me,
      state,
      task: taskOf ? { id: taskOf.id, title: taskOf.title } : entry ? { id: entry.id, title: entry.title } : null,
      branch: env.AGENT_BRANCH,
      worktree: env.AGENT_DIR,
      ports: { server: env.SERVER_PORT, client: env.CLIENT_PORT },
      ...(withFiles ? { files: filesOf(ctx, env) } : {}),
    });
  }
  return out;
}

/** Who else changes this file (committed on their branch, or not yet). */
export function who(ctx, path) {
  const wanted = String(path).replace(/^\.\//, '');
  return agents(ctx).filter((agent) => !agent.me && agent.files.some((file) => file === wanted || file.endsWith(`/${wanted}`) || wanted.endsWith(`/${file}`)))
    .map((agent) => ({ name: agent.name, state: agent.state, task: agent.task?.title ?? null, files: agent.files.filter((file) => file === wanted || file.endsWith(`/${wanted}`) || wanted.endsWith(`/${file}`)) }));
}

/**
 * What is related to this agent's work: the agents that change the same files (and which), its parent task and
 * sub-tasks with their agents, and the tasks of the backlog that name one of its files.
 */
export function related(ctx) {
  if (!ctx.me) throw new Error('qui es-tu ? (AGENT_NAME, ou .env.agent dans ton worktree)');
  const all = agents(ctx);
  const mine = all.find((agent) => agent.me);
  const files = new Set(mine?.files ?? []);
  const sharing = all.filter((agent) => !agent.me).map((agent) => ({ name: agent.name, state: agent.state, task: agent.task?.title ?? null, files: agent.files.filter((file) => files.has(file)) })).filter((agent) => agent.files.length);
  const backlog = tasks(ctx, { all: true });
  const myTask = mine?.task ? backlog.find((one) => one.id === mine.task.id) : null;
  const family = myTask ? backlog.filter((one) => one.id === myTask.after || one.after === myTask.id).map((one) => ({ id: one.id, title: one.title, state: one.label, agents: one.agents, relation: one.id === myTask.after ? 'tâche mère' : 'sous-tâche' })) : [];
  const base = (file) => file.split('/').pop();
  const naming = backlog.filter((one) => one.id !== myTask?.id && one.state !== 'done' && (one.files ?? []).some((file) => [...files].some((mineFile) => mineFile === file || base(mineFile) === base(file))))
    .map((one) => ({ id: one.id, title: one.title, state: one.label, agents: one.agents }));
  return { me: ctx.me, task: myTask ? { id: myTask.id, title: myTask.title } : null, files: [...files], sharing, family, naming };
}

// ---------------------------------------------------------------------------------------------------------------
// Messages between agents

const messagesDir = (ctx) => join(ctx.registry, 'messages');
const box = (ctx, name) => join(messagesDir(ctx), `${name}.jsonl`);
const readMark = (ctx, name) => new Set(existsSync(join(messagesDir(ctx), `${name}.read`)) ? readFileSync(join(messagesDir(ctx), `${name}.read`), 'utf8').split('\n').filter(Boolean) : []);
const readBox = (ctx, name) => (existsSync(box(ctx, name)) ? readFileSync(box(ctx, name), 'utf8').split('\n').filter(Boolean).map((line) => {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}).filter(Boolean) : []);

/** Writes to an agent (or « tous »: every other agent not accepted yet). `from`: an agent, or « utilisateur ». */
export function say(ctx, to, text, { from = ctx.me, about = null, now = new Date().toISOString() } = {}) {
  const body = String(text ?? '').trim();
  if (!body) throw new Error('message vide');
  if (!from) throw new Error('qui écrit ? (AGENT_NAME, ou .env.agent dans ton worktree)');
  const everyone = agents(ctx, { withFiles: false }).map((agent) => agent.name);
  const targets = to === 'tous' || to === 'all' ? everyone.filter((name) => name !== from) : [to];
  for (const name of targets) if (!NAME.test(name) || !existsSync(join(ctx.registry, `${name}.env`))) throw new Error(`agent inconnu ${name}`);
  mkdirSync(messagesDir(ctx), { recursive: true });
  const message = { id: randomUUID().slice(0, 8), from, to: to === 'all' ? 'tous' : to, text: body.slice(0, 4000), about, at: now };
  for (const name of targets) appendFileSync(box(ctx, name), `${JSON.stringify(message)}\n`);
  return { ...message, delivered: targets };
}

/** The messages to an agent (`all`: the read ones too); `mark`: they count as read once returned. */
export function inbox(ctx, { name = ctx.me, all = false, mark = true } = {}) {
  if (!name) throw new Error('qui es-tu ? (AGENT_NAME, ou .env.agent dans ton worktree)');
  const read = readMark(ctx, name);
  const messages = readBox(ctx, name).map((message) => ({ ...message, read: read.has(message.id) }));
  const shown = all ? messages : messages.filter((message) => !message.read);
  if (mark && shown.some((message) => !message.read)) {
    mkdirSync(messagesDir(ctx), { recursive: true });
    writeFileSync(join(messagesDir(ctx), `${name}.read`), [...new Set([...read, ...shown.map((message) => message.id)])].join('\n') + '\n');
  }
  return shown;
}

/** Every message, for the dashboard: to and from an agent (or all of them), newest last. */
export function conversation(ctx, name = null) {
  if (!existsSync(messagesDir(ctx))) return [];
  const seen = new Map();
  for (const file of readdirSync(messagesDir(ctx)).filter((one) => one.endsWith('.jsonl'))) {
    const owner = file.slice(0, -'.jsonl'.length);
    const read = readMark(ctx, owner);
    for (const message of readBox(ctx, owner)) {
      if (name && message.from !== name && owner !== name) continue;
      const key = `${message.id}`;
      const one = seen.get(key) ?? { ...message, readBy: [] };
      if (read.has(message.id)) one.readBy.push(owner);
      seen.set(key, one);
    }
  }
  return [...seen.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/** Pending questions to the user, so that an agent knows what the others wait for. */
export const openQuestions = (ctx) => listQuestions(ctx.registry, { status: 'pending' }).map((question) => ({ id: question.id, agent: question.agent, type: question.type, title: question.title }));

// ---------------------------------------------------------------------------------------------------------------
// The command line

const HELP = `L'équipe, vue par un agent (depuis ton worktree) : node agents/agent/team.mjs <commande>
  tasks [--all]            les tâches du backlog, à jour (état, agent, sous-tâches) ; --all : les livrées aussi
  task <id|mot du titre>   le texte entier d'une tâche, sa mère et ses sous-tâches
  agents                   les autres agents : état, tâche, fichiers qu'ils changent
  related                  ce qui touche ton travail : agents sur les mêmes fichiers, ta tâche mère et tes sous-tâches,
                           les tâches qui nomment tes fichiers
  who <fichier>            qui d'autre change ce fichier (commité ou pas encore)
  say <agent|tous> "…" [--about <fichier>]   écrire à un agent (ou à tous)
  inbox [--all]            tes messages non lus (--all : tous) ; ils comptent comme lus
  questions                les questions en attente de réponse de l'utilisateur
Options : --json (sortie brute)   --agent <nom> (sinon AGENT_NAME ou .env.agent)`;

/** A result as the text an agent reads (the command line, and the MCP tools). */
export function format(command, result) {
  const out = [];
  const line = (text) => out.push(text);
  if (command === 'tasks') for (const one of result) line(`${one.after ? '  ↳ ' : ''}${one.title} [${one.label}]${one.agents?.length ? ` · agent ${one.agents.join(', ')}` : ''}${one.auto ? ' · ⚡ auto' : ''} · ${one.id}`);
  else if (command === 'task') line(`# ${result.title} [${result.state}] · ${result.section}${result.agents?.length ? ` · agent ${result.agents.join(', ')}` : ''}\n${result.after ? `↳ après ${result.after}\n` : ''}${result.subtasks.length ? `sous-tâches : ${result.subtasks.join(' → ')}\n` : ''}\n${result.text}`);
  else if (command === 'agents') for (const one of result) line(`${one.me ? '* ' : ''}${one.name} · ${one.state} · ${one.task?.title ?? '—'} · ${one.files?.length ?? 0} fichiers${one.files?.length ? ` (${[...one.files].sort((a, b) => a.startsWith('changes/') - b.startsWith('changes/')).slice(0, 6).join(', ')}${one.files.length > 6 ? '…' : ''})` : ''}`);
  else if (command === 'related') {
    line(`toi : ${result.me}${result.task ? ` · ${result.task.title}` : ''} · ${result.files.length} fichiers changés`);
    line(result.sharing.length ? 'mêmes fichiers que toi :' : 'aucun autre agent ne change tes fichiers.');
    for (const one of result.sharing) line(`  ${one.name} (${one.state}${one.task ? `, ${one.task}` : ''}) : ${one.files.join(', ')}`);
    for (const one of result.family) line(`${one.relation} : ${one.title} [${one.state}]${one.agents?.length ? ` · agent ${one.agents.join(', ')}` : ''}`);
    if (result.naming.length) line('tâches qui nomment tes fichiers :');
    for (const one of result.naming) line(`  ${one.title} [${one.state}]${one.agents?.length ? ` · agent ${one.agents.join(', ')}` : ''}`);
  } else if (command === 'who') {
    if (!result.length) line('personne d’autre ne change ce fichier.');
    for (const one of result) line(`${one.name} (${one.state}${one.task ? `, ${one.task}` : ''}) : ${one.files.join(', ')}`);
  } else if (command === 'say') line(`envoyé à ${result.delivered.join(', ')} (${result.id})`);
  else if (command === 'inbox') {
    if (!result.length) line('aucun message.');
    for (const one of result) line(`[${one.at.slice(0, 16).replace('T', ' ')}] ${one.from} → ${one.to}${one.about ? ` (sur ${one.about})` : ''} : ${one.text}`);
  } else if (command === 'questions') {
    if (!result.length) line('aucune question en attente.');
    for (const one of result) line(`${one.agent} · ${one.type} · ${one.title}`);
  }
  return out.join('\n');
}

export { HELP };

export function run(argv, { cwd = process.cwd(), env = process.env } = {}) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) args._.push(argv[i]);
    else if (['--json', '--all', '--help'].includes(argv[i])) args[argv[i].slice(2)] = true;
    else args[argv[i].slice(2)] = argv[++i];
  }
  const [command, ...rest] = args._;
  if (args.help || !command) return { help: HELP };
  const ctx = context({ cwd, env: args.agent ? { ...env, AGENT_NAME: args.agent } : env });
  const result = command === 'tasks' ? tasks(ctx, { all: args.all })
    : command === 'task' ? task(ctx, rest.join(' '))
    : command === 'agents' ? agents(ctx)
    : command === 'related' ? related(ctx)
    : command === 'who' ? who(ctx, rest[0])
    : command === 'say' ? say(ctx, rest[0], rest.slice(1).join(' '), { about: args.about ?? null })
    : command === 'inbox' ? inbox(ctx, { all: args.all })
    : command === 'questions' ? openQuestions(ctx)
    : null;
  if (result === null) throw new Error(`commande inconnue « ${command} » (--help)`);
  return { command, result, json: args.json };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // A reader that stops early (| head) is not an error.
  process.stdout.on('error', (error) => error.code === 'EPIPE' && process.exit(0));
  try {
    const out = run(process.argv.slice(2));
    if (out.help) console.log(out.help);
    else if (out.json) console.log(JSON.stringify(out.result, null, 2));
    else console.log(format(out.command, out.result));
  } catch (error) {
    console.error(`team : ${error.message}`);
    process.exit(1);
  }
}
