// The roadmap as a list of candidate tasks for the agents: parses a roadmap in Markdown into sections,
// steps and bold bullets, ties each one to what already exists (agents of the registry, entries of changes/, the
// compte-rendu documents), keeps a snapshot to show what changed since the last refresh, builds the prompt of a new
// agent (template of docs/orchestration.md, « Lancer ») and keeps the queue of tasks the orchestrator
// launches (.git/agents/queue/<name>.json). The parsing, matching, diff and prompt are pure; the rest takes its folders
// as arguments, so tests run on throwaway ones.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { briefPath, project } from '../config.mjs';
import { checkSettings, writeSettings } from './settings.mjs';

// ---------------------------------------------------------------------------------------------------------------
// Words

/** Lower case, no accents, ligatures spelled out. */
export function normalize(text) {
  return String(text ?? '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'Oe')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'Ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** A stable identifier: « Rais de soleil de la Forêt profonde » -> rais-de-soleil-de-la-foret-profonde. */
export function slugify(text) {
  return normalize(text)
    .replace(/\*\*|`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const STOPWORDS = new Set(
  'a au aux avec ce ces d dans de des du en et l la le les ou par pour sa se ses sur un une the of and to etude etudier'.split(' '),
);

/** The significant words of a title, as a set. */
export function tokens(text) {
  return new Set(
    normalize(text)
      .split(/[^a-z0-9]+/)
      .filter((word) => word && !STOPWORDS.has(word)),
  );
}

const subset = (small, big) => small.size > 0 && [...small].every((word) => big.has(word));

// A short 32-bit FNV-1a hash of a text, enough to tell whether an item changed.
export function hash(text) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------------------------------------------
// Parsing

const HEADING = /^(#{2,3})\s+(.+?)\s*#*\s*$/;
// A top-level bullet that starts in bold: « - **Titre** (choix du …) : texte ».
const BOLD_BULLET = /^[-*]\s+\*\*(.+?)\*\*/;
const STEP = /^[ÉE]tape\s+([A-Z]?\d+(?:\s+bis)?)\b/i;

/**
 * The candidate tasks of a roadmap in Markdown, in reading order. Each one: id (a slug, unique), kind (section: ##,
 * subsection: ###, step: « ### Étape Bx », item: bold bullet), title, text (the exact lines), section (its ## title),
 * parent (id), choices (the « choix du … » made by the user), files (paths cited), done (« Mise en œuvre le … »).
 */
export function parseRoadmap(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const items = [];
  const open = []; // headings not closed yet: { item, level }
  let inFence = false;
  let bullet = null; // the bold bullet being read
  const closeBullet = (end) => {
    if (bullet) bullet.end = end;
    bullet = null;
  };
  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const heading = !inFence && HEADING.exec(line);
    if (heading) {
      closeBullet(index);
      const level = heading[1].length;
      while (open.length && open[open.length - 1].level >= level) open.pop().item.end = index;
      const title = heading[2].trim();
      const parent = open[open.length - 1]?.item;
      const item = {
        kind: level === 2 ? 'section' : STEP.test(title) ? 'step' : 'subsection',
        level,
        title,
        start: index,
        end: lines.length,
        parent: parent ?? null,
      };
      items.push(item);
      open.push({ item, level });
      return;
    }
    if (inFence) return;
    const bold = BOLD_BULLET.exec(line);
    if (bold) {
      closeBullet(index);
      const parent = open[open.length - 1]?.item ?? null;
      bullet = { kind: 'item', level: 4, title: bold[1].replace(/\s*:\s*$/, '').trim(), start: index, end: lines.length, parent };
      items.push(bullet);
      return;
    }
    // A bullet ends at the next top-level line that is not its continuation: another bullet, or text after a blank line.
    if (bullet && line.trim() && !/^\s/.test(line) && (/^[-*]\s/.test(line) || !lines[index - 1]?.trim())) closeBullet(index);
  });
  closeBullet(lines.length);
  for (const { item } of open) item.end = Math.min(item.end, lines.length);

  const used = new Set();
  for (const item of items) {
    let id = slugify(item.title) || 'sans-titre';
    if (used.has(id) && item.parent) id = `${item.parent.id}--${id}`;
    for (let n = 2; used.has(id); n++) id = `${slugify(item.title)}-${n}`;
    used.add(id);
    item.id = id;
  }
  return items.map((item) => {
    const text = lines.slice(item.start, item.end).join('\n').replace(/\s+$/, '');
    let section = item;
    while (section.parent) section = section.parent;
    // A heading's own words: up to its first child heading or bullet, the rest belongs to the children.
    const firstChild = items.find((other) => other.parent === item);
    const ownText = lines.slice(item.start, firstChild ? firstChild.start : item.end).join('\n');
    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      section: section.title,
      parent: item.parent?.id ?? null,
      line: item.start + 1,
      text,
      choices: choicesIn(ownText),
      files: filesIn(ownText),
      done: /Mise en (?:œ|oe)uvre le (\d{4}-\d{2}-\d{2})/.exec(ownText)?.[1] ?? null,
    };
  });
}

/** The design choices already made by the user: « (choix du 2026-09-28 : par partie du corps) », « Choix du … : …. ». */
export function choicesIn(text) {
  const choices = [];
  const pattern = /(\()?\b[Cc]hoix du (\d{4}-\d{2}-\d{2})/g;
  let match;
  while ((match = pattern.exec(text))) {
    const from = match.index + (match[1] ? 1 : 0);
    const rest = text.slice(from);
    const end = match[1] ? rest.indexOf(')') : rest.search(/\.(\s|$)|\n/);
    let choice = (end < 0 ? rest : rest.slice(0, end)).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    if (/^choix du \S+$/i.test(choice)) {
      // Only a date: the choice is what follows, the rest of the bullet or the next sentence.
      const after = rest.slice(end < 0 ? rest.length : end + 1).replace(/^\s*:?\s*/, '');
      const sentence = after.split(/\.(?:\s|$)|\n\s*\n/)[0].replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
      if (sentence) choice = `${choice} : ${sentence}`;
    }
    choices.push(choice.charAt(0).toUpperCase() + choice.slice(1));
  }
  return choices;
}

/** Files cited: links to the docs (relative to docs/) and code spans that look like paths. */
export function filesIn(text) {
  const files = new Set();
  for (const [, target] of text.matchAll(/\]\(([^)\s]+?)(?:#[^)]*)?\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue;
    files.add(join('docs', target).replace(/\\/g, '/'));
  }
  for (const [, code] of text.matchAll(/`([^`\s]+)`/g)) {
    if (/\.(ts|tsx|mjs|cjs|js|json|md|css|html|sh|glsl|yml|yaml)$/.test(code) || (code.includes('/') && /\.\w+$/.test(code))) files.add(code);
  }
  return [...files];
}

// ---------------------------------------------------------------------------------------------------------------
// What already exists

function readEnv(file) {
  const values = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^(\w+)=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const list = (dir) => {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
};

/**
 * Everything a task can be tied to: the agents of the registry (name, archived), the entries of changes/ (unreleased
 * or published generation, with the heading of their report), the compte-rendu documents and the queue.
 */
export function readSources({ root, registry }) {
  const agents = list(registry)
    .filter((file) => file.endsWith('.env'))
    .map((file) => {
      const env = readEnv(join(registry, file));
      return { name: env.AGENT_NAME || file.slice(0, -4), archived: Boolean(env.AGENT_ARCHIVED), base: env.AGENT_BASE ?? '' };
    });
  const entries = [];
  for (const generation of list(join(root, 'changes'))) {
    if (generation !== 'unreleased' && !/^v\d+\.\d+\.\d+$/.test(generation)) continue;
    for (const slug of list(join(root, 'changes', generation))) {
      const dir = join(root, 'changes', generation, slug);
      if (!statSync(dir).isDirectory()) continue;
      let heading = '';
      try {
        heading = /^#\s+(.+)$/m.exec(readFileSync(join(dir, 'report.md'), 'utf8'))?.[1] ?? '';
      } catch {}
      entries.push({ slug, generation, heading });
    }
  }
  const reports = list(join(root, project.paths.reports))
    .filter((file) => file.endsWith('.md'))
    .map((file) => ({ file: `${project.paths.reports}/${file}`, text: readFileSync(join(root, project.paths.reports, file), 'utf8') }));
  // Tasks queued from the roadmap page keep the id of their roadmap item.
  const queue = readQueue(join(registry, 'queue')).map((entry) => ({ name: entry.name, id: entry.id ?? null, status: entry.status }));
  return { agents, entries, reports, queue };
}

const STATUS_RANK = { new: 0, active: 1, archived: 2, done: 3 };

/**
 * The status of each task: « new » (nothing yet), « active » (an agent at work, an unreleased entry, a mention in a
 * compte-rendu), « archived » (its agent was archived), « done » (published in a generation, or marked « Mise en
 * œuvre » in the roadmap). A task tied to nothing takes the status of its parent heading when that one is tied by
 * name (an agent, an entry): « inherited », it can still be chosen, since it may be a bullet added afterwards.
 */
export function matchStatus(items, sources) {
  const agents = sources.agents.map((agent) => ({ ...agent, words: tokens(agent.name.replace(/-/g, ' ')) }));
  const archivedAgents = new Set(sources.agents.filter((agent) => agent.archived).map((agent) => agent.name));
  const entries = sources.entries.map((entry) => ({
    ...entry,
    words: tokens(entry.slug.replace(/-/g, ' ')),
    headingWords: tokens(entry.heading),
    leadWords: tokens(entry.heading.split(/[:(]/)[0]),
  }));
  const reports = sources.reports.map((report) => ({ ...report, flat: normalize(report.text).replace(/\s+/g, ' ') }));
  const byId = new Map();
  const result = items.map((item) => {
    const words = tokens(item.title);
    const slug = slugify(item.title);
    // Same slug, the title within the name (« Combat » for combat-zones), or the name covering half the title at least
    // (rais-soleil for « Rais de soleil de la Forêt profonde », not integration for « Étape 7 : intégration, slots… »).
    const close = (name, own) => name === slug || subset(words, own) || (subset(own, words) && own.size * 2 >= words.size);
    // Within the heading of a report: several words, or the single one in its lead (« Biomes » in « Biomes : … »).
    const inHeading = (entry) => subset(words, entry.headingWords) && (words.size > 1 || subset(words, entry.leadWords));
    const refs = [];
    let status = 'new';
    let generation = null;
    let agent = null;
    let named = false;
    const raise = (next, ref) => {
      refs.push(ref);
      if (STATUS_RANK[next] > STATUS_RANK[status]) status = next;
    };
    for (const candidate of agents) {
      if (!close(candidate.name, candidate.words)) continue;
      agent ??= candidate.name;
      named = true;
      raise(candidate.archived ? 'archived' : 'active', { kind: 'agent', name: candidate.name, archived: candidate.archived });
    }
    for (const entry of entries) {
      const byName = close(entry.slug, entry.words);
      if (!byName && !inHeading(entry)) continue;
      named ||= byName;
      const released = entry.generation !== 'unreleased';
      if (released && (!generation || entry.generation > generation)) generation = entry.generation;
      // An unreleased entry whose agent was archived: merged, waiting for its generation.
      const state = released ? 'done' : archivedAgents.has(entry.slug) ? 'archived' : 'active';
      agent ??= archivedAgents.has(entry.slug) || sources.agents.some((a) => a.name === entry.slug) ? entry.slug : null;
      raise(state, { kind: 'entry', path: `${project.paths.changes}/${entry.generation}/${entry.slug}`, generation: entry.generation });
    }
    for (const entry of sources.queue ?? []) {
      if (entry.id !== item.id || entry.status === 'cancelled') continue;
      agent ??= entry.name;
      named = true;
      raise(archivedAgents.has(entry.name) ? 'archived' : 'active', { kind: 'queue', name: entry.name, status: entry.status });
    }
    const flatTitle = normalize(item.title).replace(/\s+/g, ' ');
    for (const report of reports) {
      // Only a task named as such: in bold, in a table cell or a heading of the compte-rendu.
      const named = [`**${flatTitle}**`, `| ${flatTitle} |`, `# ${flatTitle}`].some((form) => report.flat.includes(form));
      if (item.kind !== 'section' && named) raise('active', { kind: 'report', path: report.file });
    }
    if (item.done) raise('done', { kind: 'roadmap', date: item.done });
    // Tied by a name (agent or entry), not only by words of a report heading: strong enough to pass on to its bullets.
    const strong = named || refs.some((ref) => ref.kind === 'roadmap');
    const matched = { ...item, status, generation, agent, refs, inherited: false, strong };
    byId.set(item.id, matched);
    return matched;
  });
  for (const item of result) {
    const parent = item.parent && byId.get(item.parent);
    if (item.status === 'new' && parent && parent.strong && parent.status !== 'new' && parent.kind !== 'section') {
      Object.assign(item, { status: parent.status, generation: parent.generation, agent: parent.agent, inherited: true });
    }
  }
  return result;
}

export const STATUS_LABELS = { new: 'nouveau', active: 'en cours', archived: 'archivé', done: 'livré' };

/** « livré (version v0.3.0) », « en cours », … */
export function statusLabel(item) {
  if (item.status === 'done') return item.generation ? `livré (${project.release.word} ${item.generation})` : 'livré';
  return STATUS_LABELS[item.status] ?? item.status;
}

// ---------------------------------------------------------------------------------------------------------------
// Snapshots

/** What a refresh remembers of each task: its title, its place and a hash of its text. */
export function snapshotOf(items, takenAt = new Date().toISOString()) {
  const entries = {};
  for (const item of items) entries[item.id] = { title: item.title, section: item.section, hash: hash(item.text) };
  return { takenAt, items: entries };
}

/** New, modified and removed tasks since a snapshot (all new when there is none). */
export function diffSnapshots(previous, items) {
  const before = previous?.items ?? {};
  const added = [];
  const modified = [];
  const seen = new Set();
  for (const item of items) {
    seen.add(item.id);
    const old = before[item.id];
    if (!old) added.push(item.id);
    else if (old.hash !== hash(item.text)) modified.push(item.id);
  }
  const removed = Object.entries(before)
    .filter(([id]) => !seen.has(id))
    .map(([id, old]) => ({ id, title: old.title, section: old.section }));
  return { since: previous?.takenAt ?? null, added, modified, removed };
}

export function readSnapshot(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Saves the snapshot of the tasks, with the diff it made against the previous one; returns that diff. */
export function refreshSnapshot(file, items, takenAt = new Date().toISOString()) {
  const previous = readSnapshot(file);
  const diff = diffSnapshots(previous, items);
  writeJson(file, { ...snapshotOf(items, takenAt), lastDiff: { ...diff, at: takenAt } });
  return diff;
}

// ---------------------------------------------------------------------------------------------------------------
// Prompts

/** A short agent name from a title: its first significant words, at most 24 characters, not already taken. */
export function proposeName(title, taken = new Set()) {
  const words = [...tokens(title)].filter((word) => word !== 'etape');
  let name = '';
  for (const word of words) {
    const next = name ? `${name}-${word}` : word;
    if (next.length > 24 && name) break;
    name = next.slice(0, 24);
    if (name.split('-').length >= 3) break;
  }
  name ||= 'tache';
  let unique = name;
  for (let n = 2; taken.has(unique); n++) unique = `${name}-${n}`;
  return unique;
}

export const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Where a cited file is: itself when it exists in the repository, else the tracked files with that name. */
export function resolveFiles(files, fileIndex = []) {
  const known = new Set(fileIndex);
  const out = [];
  for (const file of files) {
    if (!fileIndex.length || known.has(file)) out.push(file);
    else if (!file.includes('*')) {
      const found = fileIndex.filter((path) => path.endsWith(`/${file}`)).slice(0, 3);
      out.push(...(found.length ? found : [file]));
    } else out.push(file);
  }
  return [...new Set(out)];
}

/**
 * The prompt of a new agent, after the template of docs/orchestration.md (« Lancer »). `task`: a matched item
 * with name and base; `items`: all of them (for the parent's choices and files); `neighbours`: the other tasks queued at
 * the same time and the agents at work ({ name, title }). `{{CO_AUTHORED_BY}}` is left for the orchestrator.
 */
export function buildPrompt(task, { items = [], neighbours = [], active = [], mainRoot, worktrees, teamSize = 1, fileIndex = [], source = project.paths.backlog }) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const parent = task.parent ? byId.get(task.parent) : null;
  const choices = [...(parent?.choices ?? []), ...(task.choices ?? []), ...(task.subtasks ?? []).flatMap((sub) => sub.choices ?? [])];
  const files = resolveFiles([...(task.files ?? []), ...(task.subtasks ?? []).flatMap((sub) => sub.files ?? []), ...(parent?.files ?? [])], fileIndex);
  const where = parent && parent.title !== task.section ? `${task.section} › ${parent.title}` : task.section;
  const lines = [
    `Tu es l'agent \`${task.name}\`. Lis d'abord la consigne commune ${join(mainRoot, briefPath)} (les {{…}} : ${teamSize} agent${teamSize > 1 ? 's' : ''} en parallèle, worktrees ${worktrees}, dépôt principal ${mainRoot} ; commits terminés par \`{{CO_AUTHORED_BY}}\`) et respecte-la strictement${project.brief ? `, puis la consigne du projet, \`${project.brief}\` dans ton worktree` : ''}.`,
    `Worktree : ${worktrees}/${task.name} (branche ${project.branches.agent}${task.name}, partie de ${task.base}). Rapport dans \`${project.paths.changes}/unreleased/${task.name}/\` (report.md, img/, entry.md).`,
    '',
    `## Chantier (extrait exact de ${source}, « ${where} », ligne ${task.line})`,
    '',
    task.text,
    '',
    ...(task.subtasks?.length ? [
      '## Puis ses sous-tâches, dans l’ordre',
      '',
      `Elles dépendent du chantier ci-dessus et te reviennent aussi. Termine et commite d’abord le chantier, puis chaque sous-tâche à son tour (ses propres commits) ; ton rapport et ton entrée couvrent le tout.`,
      '',
      ...task.subtasks.flatMap((sub, index) => [`### Sous-tâche ${index + 1} (ligne ${sub.line})`, '', sub.text.replace(/^###\s+/, '#### '), '']),
    ] : []),
    '## Choix déjà faits par l’utilisateur',
    '',
    ...(choices.length ? choices.map((choice) => `- ${choice}`) : ['- Aucun : tranche chaque question avec l’option recommandée et liste les autres dans ton rapport.']),
    '',
    '## Code clé',
    '',
    ...(files.length ? files.map((file) => `- \`${file}\``) : []),
    `- Cherche le code concerné à partir des mots du chantier ; lis les docs de conception liées (${project.paths.design.map((path) => `\`${path}\``).join(', ')}).`,
    '',
    '## Voisins',
    '',
    ...neighbours.map((other) => `- \`${other.name}\` : ${other.title} (lancé en même temps)`),
    ...active.map((other) => `- \`${other.name}\` : en cours`),
    ...(neighbours.length || active.length ? [] : ['- Aucun autre agent annoncé.']),
    '- Reste additif sur les fichiers partagés (nouveaux modules, branchements courts) pour que les fusions restent simples.',
    '',
    '## À vérifier',
    '',
    '- Ce qui se voit, en jeu ou dans la page concernée, avec des captures JPEG dans `img/`.',
    '- Avant ta réponse finale : `git merge ' + task.base + '` dans ton worktree (garde les deux côtés), `make check`. Réponse finale : 10 lignes max.',
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------------------------
// Queue

function writeJson(file, value) {
  mkdirSync(join(file, '..'), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temp, file);
}

export const QUEUE_STATUSES = ['queued', 'launched', 'done', 'cancelled'];

/** Every entry of the queue folder, oldest first. */
export function readQueue(dir) {
  return list(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      try {
        return JSON.parse(readFileSync(join(dir, file), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.name.localeCompare(b.name));
}

export function writeQueueEntry(dir, entry) {
  if (!NAME_PATTERN.test(entry.name)) throw new Error(`nom invalide ${entry.name}`);
  writeJson(join(dir, `${entry.name}.json`), entry);
  return entry;
}

/** Changes the status of an entry (launched, done, cancelled), with the time of the change. */
export function markQueue(dir, name, status, now = new Date().toISOString()) {
  if (!QUEUE_STATUSES.includes(status)) throw new Error(`statut inconnu ${status} (${QUEUE_STATUSES.join(', ')})`);
  const file = join(dir, `${name}.json`);
  if (!NAME_PATTERN.test(name) || !existsSync(file)) throw new Error(`pas de tâche ${name} dans la file`);
  const entry = { ...JSON.parse(readFileSync(file, 'utf8')), status, [`${status}At`]: now };
  writeJson(file, entry);
  return entry;
}

export function removeQueueEntry(dir, name) {
  const file = join(dir, `${name}.json`);
  if (!NAME_PATTERN.test(name) || !existsSync(file)) return false;
  rmSync(file);
  return true;
}

/**
 * Queues tasks, one after the other: checks the name and the settings, creates the worktree (`createWorktree(name,
 * base)`, which rejects on failure: agent.sh new), records the effort and model in the agent's registry file
 * (settings.mjs), then writes the entry. Returns one result per task; a failure stops nothing else.
 */
export async function enqueue(tasks, { queueDir, registry, createWorktree, now = () => new Date().toISOString() }) {
  const results = [];
  const names = new Set();
  for (const task of tasks) {
    const { name, base = project.branches.integration, title, prompt } = task;
    let settings;
    try {
      settings = checkSettings({ effort: task.effort, model: task.model });
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
      continue;
    }
    const fail = (error) => results.push({ name, ok: false, error });
    if (!NAME_PATTERN.test(name ?? '')) {
      fail(`nom invalide « ${name} » : minuscules, chiffres et tirets`);
      continue;
    }
    if (!/^[\w./-]+$/.test(base)) {
      fail(`base invalide « ${base} »`);
      continue;
    }
    if (names.has(name) || existsSync(join(registry, `${name}.env`)) || existsSync(join(queueDir, `${name}.json`))) {
      fail(`un agent ou une tâche s’appelle déjà ${name}`);
      continue;
    }
    names.add(name);
    try {
      await createWorktree(name, base);
    } catch (error) {
      fail(`worktree non créé : ${String(error?.message ?? error).trim().split('\n').slice(-3).join(' ')}`);
      continue;
    }
    if (existsSync(join(registry, `${name}.env`))) writeSettings(registry, name, settings);
    const own = Object.fromEntries(Object.entries(settings).filter(([, value]) => value));
    const entry = writeQueueEntry(queueDir, { name, title, prompt, base, id: task.id ?? null, ...own, createdAt: now(), status: 'queued' });
    results.push({ name, ok: true, entry });
  }
  return results;
}
