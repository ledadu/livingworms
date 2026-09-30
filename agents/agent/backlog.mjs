// The backlog (paths.backlog of agents.config.mjs, docs/backlog.md by default) as the list of tasks of the agents: one task per `###` heading, grouped by `##`, each
// with a status line right under its heading that the system keeps up to date and the user may read and edit:
//
//   ### Nouvelles pièces : corps, habits et accessoires
//   > 🔵 en cours · agent ajouter-autre-piece
//
// States: ⚪ à faire, 🟣 en file, 🔵 en cours, 🟠 fusionné, 🟢 livré (with its generation), and ⏸ en pause, which only
// the user sets and the system never touches. syncBacklog() derives each state from the facts (queue, registry,
// changes/ of the main checkout), rewrites only the status lines that changed and moves the delivered tasks down to
// « ## Livré » (paths.delivered). Everything else of the file is the user's text, left as it is. Parsing and formatting are pure.
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { choicesIn, filesIn, hash, readQueue, slugify } from './roadmap.mjs';
import { project } from '../config.mjs';

export const STATES = {
  todo: { icon: '⚪', label: 'à faire', status: 'new' },
  queued: { icon: '🟣', label: 'en file', status: 'active' },
  active: { icon: '🔵', label: 'en cours', status: 'active' },
  merged: { icon: '🟠', label: 'fusionné', status: 'archived' },
  done: { icon: '🟢', label: 'livré', status: 'done' },
  paused: { icon: '⏸', label: 'en pause', status: 'paused' },
};
const BY_WORD = Object.fromEntries(Object.entries(STATES).flatMap(([state, { icon, label }]) => [[icon, state], [label, state]]));
export const DELIVERED = project.paths.delivered;

const HEADING = /^(#{2,3})\s+(.+?)\s*#*\s*$/;
const STATUS_LINE = /^>\s*(.*)$/;

/** « 🔵 en cours · agent a, b » -> { state, generation, agents }, or null when the line is not a status. */
export function parseStatus(line) {
  const match = STATUS_LINE.exec(String(line ?? '').trim());
  if (!match) return null;
  const parts = match[1].split('·').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const head = parts[0];
  const state = BY_WORD[[...head][0]] ?? BY_WORD[head.replace(/^\S+\s+/, '')] ?? BY_WORD[head];
  if (!state) return null;
  let generation = null;
  let agents = [];
  for (const part of parts.slice(1)) {
    const agent = /^agents?\s+(.+)$/.exec(part);
    if (agent) agents = agent[1].split(/[,\s]+/).filter(Boolean);
    else if (/^v\d+\.\d+(\.\d+)?$/.test(part)) generation = part;
  }
  return { state, generation, agents };
}

/** The status line of a state: « > 🟢 livré · v0.2.1 · agent petits-truc-faire ». */
export function formatStatus({ state, generation = null, agents = [] }) {
  const { icon, label } = STATES[state] ?? STATES.todo;
  return `> ${[`${icon} ${label}`, generation, agents.length ? `agent${agents.length > 1 ? 's' : ''} ${agents.join(', ')}` : null].filter(Boolean).join(' · ')}`;
}

/**
 * The tasks of a backlog in Markdown, in reading order, with the `##` groups as items of kind « section » before their
 * tasks (the shape the Roadmap page of the dashboard reads). A task: id (slug of its title, unique), title, section,
 * line (1-based), start/end (0-based lines of its block), statusLine (0-based, or null), state, generation, agents,
 * text (its block without the status line), choices and files.
 */
export function parseBacklog(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const heads = [];
  let inFence = false;
  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const heading = !inFence && HEADING.exec(line);
    if (heading) heads.push({ level: heading[1].length, title: heading[2].trim(), start: index });
  });
  const items = [];
  const used = new Set();
  const unique = (title) => {
    const base = slugify(title) || 'sans-titre';
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  let section = null;
  heads.forEach((head, index) => {
    const end = heads[index + 1]?.start ?? lines.length;
    if (head.level === 2) {
      section = { id: unique(`section ${head.title}`), kind: 'section', title: head.title, section: head.title, parent: null, line: head.start + 1, start: head.start, end, text: lines.slice(head.start, end).join('\n').trimEnd(), choices: [], files: [] };
      items.push(section);
      return;
    }
    const next = lines.slice(head.start + 1, end).findIndex((line) => line.trim());
    const statusAt = next >= 0 ? head.start + 1 + next : null;
    const status = statusAt !== null ? parseStatus(lines[statusAt]) : null;
    const body = lines.slice(head.start, end).filter((_, i) => head.start + i !== (status ? statusAt : -1));
    const text = body.join('\n').trimEnd();
    items.push({
      id: unique(head.title),
      kind: 'task',
      title: head.title,
      section: section?.title ?? '',
      parent: section?.id ?? null,
      line: head.start + 1,
      start: head.start,
      end,
      statusLine: status ? statusAt : null,
      state: status?.state ?? 'todo',
      generation: status?.generation ?? null,
      agents: status?.agents ?? [],
      text,
      choices: choicesIn(text),
      files: filesIn(text),
    });
  });
  return items;
}

/** The items with what the Roadmap page shows: status (new, active, archived, done, paused), label, agent, refs. */
export function withLabels(items) {
  return items.map((item) => {
    if (item.kind !== 'task') return { ...item, status: 'section', label: '', agent: null, refs: [], inherited: false };
    const { status, label } = STATES[item.state] ?? STATES.todo;
    return {
      ...item,
      status,
      label: item.state === 'done' && item.generation ? `${label} (${project.release.word} ${item.generation})` : label,
      agent: item.agents.join(', ') || null,
      refs: item.agents.map((name) => ({ kind: 'agent', name })),
      inherited: false,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Facts and synchronisation

/** What the system knows of the agents: queue entries, registry (worktrees, archived), entries in changes/. */
export function readFacts({ root, registry }) {
  const queue = (() => {
    try {
      return readQueue(join(registry, 'queue'));
    } catch {
      return [];
    }
  })();
  const agents = new Map();
  try {
    for (const file of readdirSync(registry)) {
      if (!file.endsWith('.env')) continue;
      const env = readFileSync(join(registry, file), 'utf8');
      if (/^AGENT_KIND=release$/m.test(env)) continue;
      agents.set(file.slice(0, -4), { archived: /^AGENT_ARCHIVED=/m.test(env) });
    }
  } catch {}
  const released = new Map(); // agent -> newest generation
  const unreleased = new Set();
  const changes = join(root, 'changes');
  try {
    for (const folder of readdirSync(changes)) {
      const dir = join(changes, folder);
      if (!statSync(dir).isDirectory()) continue;
      for (const name of readdirSync(dir)) {
        if (!statSync(join(dir, name)).isDirectory()) continue;
        if (folder === 'unreleased') unreleased.add(name);
        else if (/^v\d/.test(folder) && (!released.has(name) || compareVersions(folder, released.get(name)) > 0)) released.set(name, folder);
      }
    }
  } catch {}
  return { queue, agents, released, unreleased };
}

function compareVersions(a, b) {
  const parts = (v) => v.replace(/^v/, '').split('.').map(Number);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

const RANK = { todo: 0, queued: 1, active: 2, merged: 3, done: 4 };

/**
 * The state a task should show, from its agents (its status line, or the queue entry made for it): the least advanced
 * of them, since the task is done only when all its agents are. A paused task, or one with no agent, keeps its line.
 */
export function stateOf(task, facts) {
  if (task.state === 'paused') return null;
  const fromQueue = facts.queue.filter((entry) => entry.id === task.id && entry.status !== 'cancelled').map((entry) => entry.name);
  const agents = [...new Set([...task.agents, ...fromQueue])];
  if (!agents.length) return null;
  let state = null;
  let generation = null;
  for (const name of agents) {
    const entry = facts.queue.find((one) => one.name === name && one.status !== 'cancelled');
    const one = facts.released.has(name) ? 'done'
      : facts.unreleased.has(name) || facts.agents.get(name)?.archived ? 'merged'
      : entry?.status === 'queued' ? 'queued'
      : facts.agents.has(name) || entry ? 'active'
      : task.state === 'todo' ? 'todo' : task.state;
    // Released: its newest generation; otherwise a task already delivered keeps the one its line gives.
    const version = facts.released.get(name) ?? (one === 'done' ? task.generation : null);
    if (one === 'done' && version && (!generation || compareVersions(version, generation) > 0)) generation = version;
    if (state === null || RANK[one] < RANK[state]) state = one;
  }
  return { state, generation: state === 'done' ? generation : null, agents };
}

/**
 * The backlog brought up to date: each task's status line from the facts, and the delivered tasks moved to the top of
 * « ## Livré » (created at the end when missing). Returns { markdown, changes: [{ id, title, from, to }] }.
 */
export function syncMarkdown(markdown, facts) {
  let lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const changes = [];
  const tasks = parseBacklog(lines.join('\n')).filter((item) => item.kind === 'task');
  // From the bottom up, so that the line numbers above stay valid.
  for (const task of [...tasks].reverse()) {
    const next = stateOf(task, facts);
    if (!next) continue;
    const line = formatStatus(next);
    const current = task.statusLine !== null ? lines[task.statusLine] : null;
    if (current?.trim() === line) continue;
    changes.push({ id: task.id, title: task.title, from: task.state, to: next.state });
    if (task.statusLine !== null) lines[task.statusLine] = line;
    else lines.splice(task.start + 1, 0, line);
  }
  // The delivered tasks outside « Livré » go down there, newest first, in the order of the file.
  const items = parseBacklog(lines.join('\n'));
  const delivered = items.find((item) => item.kind === 'section' && item.title === DELIVERED);
  const moving = items.filter((item) => item.kind === 'task' && item.state === 'done' && item.section !== DELIVERED);
  if (moving.length) {
    const blocks = moving.map((task) => {
      const block = lines.slice(task.start, task.end);
      while (block.length && !block[block.length - 1].trim()) block.pop();
      return block;
    });
    for (const task of [...moving].reverse()) lines.splice(task.start, task.end - task.start);
    let at = delivered ? parseBacklog(lines.join('\n')).find((item) => item.kind === 'section' && item.title === DELIVERED) : null;
    if (!at) {
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      lines.push('', `## ${DELIVERED}`, '', 'Les chantiers publiés, du plus récent au plus ancien.', '');
      at = parseBacklog(lines.join('\n')).find((item) => item.kind === 'section' && item.title === DELIVERED);
    }
    // Right after the intro of « Livré »: before its first task.
    const firstTask = parseBacklog(lines.join('\n')).find((item) => item.kind === 'task' && item.section === DELIVERED);
    let insert = firstTask ? firstTask.start : lines.length;
    if (!firstTask) {
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      lines.push('');
      insert = lines.length;
    }
    const chunk = blocks.flatMap((block) => [...block, '']);
    lines.splice(insert, 0, ...chunk);
    for (const task of moving) if (!changes.some((change) => change.id === task.id)) changes.push({ id: task.id, title: task.title, from: 'done', to: 'done', moved: true });
  }
  // Untouched when nothing changed: the user's own spacing stays as it is.
  if (!changes.length) return { markdown, changes };
  let out = lines.join('\n');
  if (moving.length) out = out.replace(/\n{3,}/g, '\n\n');
  if (!out.endsWith('\n')) out += '\n';
  return { markdown: out, changes };
}

/** syncMarkdown on the file itself, written only when something changed (atomically). */
export function syncBacklog({ file, root, registry }) {
  if (!existsSync(file)) return { changes: [] };
  const before = readFileSync(file, 'utf8');
  const { markdown, changes } = syncMarkdown(before, readFacts({ root, registry }));
  if (markdown !== before) {
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, markdown);
    renameSync(temp, file);
  }
  return { changes };
}

/**
 * Sets the status line of one task by hand (the queue of the Roadmap page, the orchestrator): links it to an agent.
 * Returns true when the task was found.
 */
export function setTaskStatus({ file, id, state, agents = [], generation = null }) {
  if (!existsSync(file)) return false;
  const markdown = readFileSync(file, 'utf8');
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const task = parseBacklog(lines.join('\n')).find((item) => item.kind === 'task' && item.id === id);
  if (!task) return false;
  const line = formatStatus({ state, agents: [...new Set([...agents])], generation });
  if (task.statusLine !== null) lines[task.statusLine] = line;
  else lines.splice(task.start + 1, 0, line);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, lines.join('\n'));
  renameSync(temp, file);
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Command line, for the orchestrator:
//   node agent/backlog.mjs sync                 status lines from the facts, delivered tasks moved down
//   node agent/backlog.mjs list                 the tasks and their state
//   node agent/backlog.mjs link <id> <agent>    ties a task to an agent launched by hand (« 🔵 en cours »)
if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const { execFileSync } = await import('node:child_process');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const common = execFileSync('git', ['-C', here, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim();
  const root = process.env.AGENTS_ROADMAP_ROOT || dirname(resolve(here, common));
  const registry = process.env.AGENTS_REGISTRY || join(resolve(here, common), 'agents');
  const file = join(root, project.paths.backlog);
  const [command = 'list', ...args] = process.argv.slice(2);
  if (command === 'sync') {
    const { changes } = syncBacklog({ file, root, registry });
    console.log(changes.length ? changes.map((c) => `${c.title} : ${c.moved ? `descendu dans ${DELIVERED}` : `${STATES[c.from].label} -> ${STATES[c.to].label}`}`).join('\n') : 'backlog : à jour');
  } else if (command === 'list') {
    for (const task of parseBacklog(readFileSync(file, 'utf8')).filter((item) => item.kind === 'task')) {
      console.log(`${STATES[task.state].icon} ${task.id.padEnd(44)} ${task.agents.join(', ')}`);
    }
  } else if (command === 'link') {
    const [id, ...agents] = args;
    const task = parseBacklog(readFileSync(file, 'utf8')).find((item) => item.kind === 'task' && item.id === id);
    if (!task || !agents.length) {
      console.error(task ? 'usage : backlog.mjs link <id> <agent>…' : `backlog : pas de chantier ${id} (voir backlog.mjs list)`);
      process.exit(1);
    }
    setTaskStatus({ file, id, state: 'active', agents: [...new Set([...task.agents, ...agents])] });
    syncBacklog({ file, root, registry });
    console.log(`backlog : ${task.title} -> ${agents.join(', ')}`);
  } else {
    console.error('usage : backlog.mjs sync | list | link <id> <agent>…');
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Editing from the Backlog page: one task at a time, its status line kept by the system.

/** A fingerprint of a task's text: an edit made on an older version is refused rather than overwriting it. */
export function taskVersion(task) {
  return hash(`${task.title}\n${task.text}`);
}

// A task's text as written from the page: its own `###` title first, no `##` or other `###` inside (they would make
// other groups or tasks), no status line (the system's).
function checkTaskText(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').trim().split('\n');
  if (!/^###\s+\S/.test(lines[0] ?? '')) throw new Error('le texte doit commencer par son titre : « ### Titre »');
  let inFence = false;
  for (const line of lines.slice(1)) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && /^#{2,3}\s/.test(line)) throw new Error(`un seul titre ### par chantier ; pour découper, utilise #### (« ${line.trim()} »)`);
  }
  if (lines[1] && parseStatus(lines[1])) lines.splice(1, 1);
  return lines;
}

/** The backlog with one task's block replaced by `text` (its status line kept); throws when `version` is stale. */
export function replaceTask(markdown, id, text, version) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const task = parseBacklog(lines.join('\n')).find((item) => item.kind === 'task' && item.id === id);
  if (!task) throw Object.assign(new Error(`pas de chantier ${id}`), { code: 404 });
  if (version && version !== taskVersion(task)) throw Object.assign(new Error('le chantier a changé entre-temps (fichier modifié ailleurs) : recharge-le avant d’enregistrer'), { code: 409 });
  const [title, ...body] = checkTaskText(text);
  const status = task.statusLine !== null ? [lines[task.statusLine]] : [];
  let end = task.end;
  while (end > task.start + 1 && !lines[end - 1].trim()) end--;
  const block = [title, ...status, ...(body.length && body[0].trim() ? [''] : []), ...body];
  while (block.length && !block[block.length - 1].trim()) block.pop();
  lines.splice(task.start, end - task.start, ...block);
  return lines.join('\n');
}

/** The backlog with a new task (⚪ à faire) at the end of the group `section`, or of the file's first group. */
export function addTask(markdown, section, text) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const [title, ...body] = checkTaskText(text);
  const items = parseBacklog(lines.join('\n'));
  const group = items.find((item) => item.kind === 'section' && item.title === section && item.title !== DELIVERED)
    ?? items.find((item) => item.kind === 'section' && item.title !== DELIVERED);
  if (!group) throw new Error('aucun groupe ## où ranger le chantier');
  const last = items.filter((item) => item.section === group.title).at(-1) ?? group;
  let at = last.end;
  while (at > last.start + 1 && !lines[at - 1].trim()) at--;
  const block = ['', title, formatStatus({ state: 'todo' }), ...(body.length && body[0].trim() ? [''] : []), ...body];
  while (block.length && !block[block.length - 1].trim()) block.pop();
  lines.splice(at, 0, ...block);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** replaceTask / addTask on the file, written atomically. Returns the task as it now reads. */
export function writeTask({ file, id = null, section = null, text, version = null }) {
  const markdown = readFileSync(file, 'utf8');
  const next = id ? replaceTask(markdown, id, text, version) : addTask(markdown, section, text);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, next.endsWith('\n') ? next : `${next}\n`);
  renameSync(temp, file);
  const title = checkTaskText(text)[0].replace(/^###\s+/, '').trim();
  return parseBacklog(next).find((item) => item.kind === 'task' && item.title === title) ?? null;
}
