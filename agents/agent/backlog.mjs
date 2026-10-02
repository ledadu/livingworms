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
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { choicesIn, filesIn, hash, readQueue, slugify } from './roadmap.mjs';
import { project } from '../config.mjs';
import { compareVersions as compareReleases } from '../release/changes.mjs';

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
// A sub-task's link to its parent task, right under its status line: « > ↳ après « Titre de la tâche mère » », then
// its options: « · auto » (launched by itself, by its own agent, once its parent is merged), « · effort xhigh »,
// « · modèle opus » (the settings of that launch).
const AFTER_LINE = /^>\s*↳\s*après\s*«\s*(.+?)\s*»\s*((?:·.*)?)$/;

/** « > ↳ après « Titre » · auto · effort high » -> { title, auto, effort, model }, or null. */
export function parseAfterLine(line) {
  const match = AFTER_LINE.exec(String(line ?? '').trim());
  if (!match) return null;
  const out = { title: match[1], auto: false, effort: null, model: null };
  for (const part of match[2].split('·').map((one) => one.trim()).filter(Boolean)) {
    if (part === 'auto') out.auto = true;
    const effort = /^effort\s+(\S+)$/.exec(part);
    if (effort) out.effort = effort[1];
    const model = /^mod[eè]le\s+(\S+)$/.exec(part);
    if (model) out.model = model[1];
  }
  return out;
}

/** « > ↳ après « Titre » » -> « Titre », or null. */
export function parseAfter(line) {
  return parseAfterLine(line)?.title ?? null;
}

/** The line that makes a task a sub-task of the task titled `title`, with its options. */
export function formatAfter(title, { auto = false, effort = null, model = null } = {}) {
  return `> ↳ après « ${title} »${auto ? ' · auto' : ''}${auto && effort ? ` · effort ${effort}` : ''}${auto && model ? ` · modèle ${model}` : ''}`;
}

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
    else if (/^v\d+\.\d+(\.\d+)?(-nightly\.\d{8}\.\d+)?$/.test(part)) generation = part;
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
    // The sub-task line: the first non-blank line after the status line (or in its place).
    let afterAt = status ? statusAt + 1 : statusAt;
    while (afterAt !== null && afterAt < end && !lines[afterAt].trim()) afterAt++;
    const afterLink = afterAt !== null && afterAt < end ? parseAfterLine(lines[afterAt]) : null;
    const afterTitle = afterLink?.title ?? null;
    if (!afterTitle) afterAt = null;
    const body = lines.slice(head.start, end).filter((_, i) => head.start + i !== (status ? statusAt : -1) && head.start + i !== afterAt);
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
      afterLine: afterAt,
      afterTitle,
      after: null,
      auto: afterLink?.auto ? { effort: afterLink.effort, model: afterLink.model } : null,
      state: status?.state ?? 'todo',
      generation: status?.generation ?? null,
      agents: status?.agents ?? [],
      text,
      choices: choicesIn(text),
      files: filesIn(text),
    });
  });
  // The parent of a sub-task: the task with that title (else that id); none for a missing one or a loop.
  const tasks = items.filter((item) => item.kind === 'task');
  for (const task of tasks) {
    if (!task.afterTitle) continue;
    const parent = tasks.find((other) => other.title === task.afterTitle) ?? tasks.find((other) => other.id === slugify(task.afterTitle));
    if (parent && parent !== task) task.after = parent.id;
  }
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    const seen = new Set([task.id]);
    for (let up = byId.get(task.after); up; up = byId.get(up.after)) {
      if (seen.has(up.id)) {
        task.after = null;
        break;
      }
      seen.add(up.id);
    }
  }
  return items;
}

/** A task's sub-tasks, then theirs, in the order of the file (depth-first). */
export function subtasksOf(items, id) {
  const out = [];
  const walk = (parent) => {
    for (const item of items) {
      if (item.kind !== 'task' || item.after !== parent || out.includes(item)) continue;
      out.push(item);
      walk(item.id);
    }
  };
  walk(id);
  return out;
}

/** The sub-tasks a task's agent does after it: those still to do, but not an « auto » one (its own agent) nor its own. */
export function foldedSubtasks(items, id) {
  const out = [];
  const walk = (parent) => {
    for (const item of items) {
      if (item.kind !== 'task' || item.after !== parent || item.auto || out.includes(item)) continue;
      if (item.state === 'todo') out.push(item);
      walk(item.id);
    }
  };
  walk(id);
  return out;
}

/** How deep a task sits under its parents (0: not a sub-task). */
export function depthOf(items, task) {
  const byId = new Map(items.map((item) => [item.id, item]));
  let depth = 0;
  for (let up = byId.get(task.after); up && depth < 20; up = byId.get(up.after)) depth++;
  return depth;
}

/**
 * The backlog with task `id` made a sub-task of task `after` (null: no longer a sub-task). Its block moves right
 * after its parent and the parent's other sub-tasks, in the parent's group; its sub-task line follows its status line.
 */
export function setAfter(markdown, id, after) {
  let lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  let items = parseBacklog(lines.join('\n'));
  const task = items.find((item) => item.kind === 'task' && item.id === id);
  if (!task) throw Object.assign(new Error(`pas de chantier ${id}`), { code: 404 });
  const options = task.afterLine !== null ? parseAfterLine(lines[task.afterLine]) : null;
  if (task.afterLine !== null) {
    lines.splice(task.afterLine, 1);
    items = parseBacklog(lines.join('\n'));
  }
  if (!after) return lines.join('\n');
  const parent = items.find((item) => item.kind === 'task' && item.id === after);
  if (!parent) throw Object.assign(new Error(`pas de chantier ${after}`), { code: 404 });
  if (parent.id === id || subtasksOf(items, id).some((item) => item.id === after)) throw new Error('une tâche ne peut pas devenir la sous-tâche d’elle-même ou de ses propres sous-tâches');
  // Out with the block and its own sub-tasks' (they go along), then in again after the parent's family.
  const moving = [items.find((item) => item.id === id), ...subtasksOf(items, id)];
  const blocks = moving.map((item) => {
    const block = lines.slice(item.start, item.end);
    while (block.length && !block[block.length - 1].trim()) block.pop();
    return block;
  });
  for (const item of [...moving].sort((a, b) => b.start - a.start)) lines.splice(item.start, item.end - item.start);
  items = parseBacklog(lines.join('\n'));
  const family = [items.find((item) => item.id === after), ...subtasksOf(items, after)];
  const last = family.reduce((a, b) => (b.end > a.end ? b : a));
  let at = last.end;
  while (at > last.start + 1 && !lines[at - 1].trim()) at--;
  const [block] = blocks;
  const status = block.findIndex((line, i) => i > 0 && parseStatus(line));
  block.splice(status > 0 ? status + 1 : 1, 0, formatAfter(parent.title, options ?? {}));
  lines.splice(at, 0, ...blocks.flatMap((one) => ['', ...one]), '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** The backlog with sub-task `id` launched by itself once its parent is merged (`auto`: { effort, model }), or no more (null). */
export function setAuto(markdown, id, auto) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const task = parseBacklog(lines.join('\n')).find((item) => item.kind === 'task' && item.id === id);
  if (!task) throw Object.assign(new Error(`pas de chantier ${id}`), { code: 404 });
  if (task.afterLine === null || !task.after) throw new Error('seule une sous-tâche se lance d’elle-même, à la fin de sa tâche mère');
  lines[task.afterLine] = formatAfter(task.afterTitle, auto ? { auto: true, effort: auto.effort ?? null, model: auto.model ?? null } : {});
  return lines.join('\n');
}

/** setAuto on the file, written atomically. */
export function writeAuto({ file, id, auto }) {
  const next = setAuto(readFileSync(file, 'utf8'), id, auto);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, next);
  renameSync(temp, file);
  return parseBacklog(next).find((item) => item.kind === 'task' && item.id === id) ?? null;
}

/**
 * The sub-tasks to launch now by themselves: `auto`, still to do, not queued, whose parent is merged or delivered.
 * `queued`: the ids of the tasks already in the queue.
 */
export function dueAuto(items, queued = new Set()) {
  const byId = new Map(items.filter((item) => item.kind === 'task').map((item) => [item.id, item]));
  return [...byId.values()].filter((task) => task.auto && task.state === 'todo' && !queued.has(task.id)
    && ['merged', 'done'].includes(byId.get(task.after)?.state));
}

/** setAfter on the file, written atomically. */
export function writeAfter({ file, id, after }) {
  const next = setAfter(readFileSync(file, 'utf8'), id, after);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, next.endsWith('\n') ? next : `${next}\n`);
  renameSync(temp, file);
  return parseBacklog(next).find((item) => item.kind === 'task' && item.id === id) ?? null;
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

// Older first: X.Y.Z, its nightlies before it (release/changes.mjs, which the folders v<version> follow).
const compareVersions = (a, b) => compareReleases(String(a).replace(/^v/, ''), String(b).replace(/^v/, ''));

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
 * Commits the backlog alone (its status lines, as the dashboard keeps them), whatever else is staged or changed in
 * the checkout, when it differs from HEAD and `root` is on `branch`. Returns true when a commit was made.
 */
export function commitBacklog({ root, file, branch, message = 'backlog as the dashboard keeps it' }) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    if (branch && git('symbolic-ref', '--short', 'HEAD') !== branch) return false;
    const path = relative(root, file);
    if (!git('status', '--porcelain', '--', path)) return false;
    const trailer = project.coAuthoredBy ? `\n\n${project.coAuthoredBy}` : '';
    git('commit', '--quiet', '--no-verify', '-m', `${message}${trailer}`, '--only', '--', path);
    return true;
  } catch {
    return false;
  }
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
  if (lines[1] && parseAfter(lines[1])) lines.splice(1, 1);
  return lines;
}

/** The backlog with one task's block replaced by `text` (its status line kept); throws when `version` is stale. */
export function replaceTask(markdown, id, text, version) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const task = parseBacklog(lines.join('\n')).find((item) => item.kind === 'task' && item.id === id);
  if (!task) throw Object.assign(new Error(`pas de chantier ${id}`), { code: 404 });
  if (version && version !== taskVersion(task)) throw Object.assign(new Error('le chantier a changé entre-temps (fichier modifié ailleurs) : recharge-le avant d’enregistrer'), { code: 409 });
  const [title, ...body] = checkTaskText(text);
  const status = [task.statusLine, task.afterLine].filter((at) => at !== null).map((at) => lines[at]);
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
