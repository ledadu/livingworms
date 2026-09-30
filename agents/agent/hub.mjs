// The home page of the agents' dashboard: a map of the project's ecosystem (the documentation, the team of agents, the
// releases, and whatever the project adds: the game, its supervision…), with the live state of each node. dashboard.mjs
// registers its routes:
//
//   /            the map (hub.html)
//   /agents      the worktrees page (dashboard.html), formerly at /
//   /api/hub     the map (once, ?state=1 to skip it) and the live state of every node, cached a few seconds
//   /doc/<path>  a file of the main checkout: Markdown rendered by doc.html (?raw=1 for the source), other files as text
//
// The layout and the aggregation are pure functions, tested in agent/test/hub.test.ts; the probes never block a request
// for more than their short timeout, and a request is answered from the cache while it is refreshed. The project's
// zones, nodes, flows and readings come from its agents.config.mjs (hub), see config.mjs.
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { listReleaseBranches } from '../release/branches.mjs';
import { loadChanges, UNRELEASED } from '../release/changes.mjs';
import { briefPath, capitalize, frameworkDir, project, projectRoot, releaseName } from '../config.mjs';
import { parseBacklog } from './backlog.mjs';

const run = promisify(execFile);

// --- The map ------------------------------------------------------------------------------------------------------------

export const MAP_SIZE = { width: 1280, height: 690 };
export const NODE_SIZE = { w: 172, h: 64 };

const word = project.release.word;
const Word = capitalize(word);
// A document of this folder, as a path of the checkout for /doc.
const own = (file) => relative(projectRoot, join(frameworkDir, file));

// Top row: what is planned and built; bottom row (the project's zones): what is played and watched. The releases run
// down the right side, from the integration branch to the players.
export const BASE_ZONES = [
  { id: 'docs', label: 'Documentation', color: '#c8b6ff', box: [28, 44, 420, 250] },
  { id: 'team', label: 'Équipe d’agents', color: '#7aa7ff', box: [470, 44, 420, 250] },
  { id: 'release', label: 'Versions et publication', color: '#e5b454', box: [912, 44, 340, 612] },
];

// href: where a click goes. doc: the file shown by /doc when the page does not exist (yet) on this dashboard.
export const BASE_NODES = [
  { id: 'mindmap', zone: 'docs', icon: '🧠', name: 'Mindmap', x: 50, y: 96, href: `/doc/${project.paths.mindmap}`,
    role: 'Le point d’entrée de la conception : chaque sujet du projet et ses liens.' },
  { id: 'roadmap', zone: 'docs', icon: '📋', name: 'Backlog', x: 254, y: 96, href: '/roadmap', doc: `/doc/${project.paths.backlog}`,
    role: `Le backlog (${project.paths.backlog}) : les chantiers confiés aux agents, avec leur état tenu à jour ; la roadmap donne le cap.` },
  { id: 'report', zone: 'docs', icon: '📝', name: 'Compte rendu', x: 50, y: 198, href: `/doc/${project.paths.reports}/`,
    role: 'Ce que l’équipe a livré, les choix à valider et toutes les options écartées.' },
  { id: 'orchestration', zone: 'docs', icon: '🎼', name: 'Orchestration', x: 254, y: 198, href: `/doc/${own('docs/orchestration.md')}`,
    role: 'Le mode d’emploi d’une équipe d’agents : préparer, lancer, suivre, intégrer, publier.' },

  { id: 'tasks', zone: 'team', icon: '🧩', name: 'Tâches', x: 492, y: 96, href: `/doc/${briefPath}`,
    role: 'Le backlog découpé en chantiers indépendants, un par agent, avec la consigne commune.' },
  { id: 'agents', zone: 'team', icon: '🤖', name: 'Agents', x: 696, y: 96, href: '/agents',
    role: 'Un worktree, une branche et des ports par agent : sa tâche du moment, ses commits, sa version à tester.' },
  { id: 'questions', zone: 'team', icon: '💬', name: 'Questions', x: 492, y: 198, href: '/questions',
    role: 'Les questions et retours stratégiques des agents, et l’interrupteur « Décider seul ».' },
  { id: 'journal', zone: 'team', icon: '📜', name: 'Journal', x: 696, y: 198, href: '/journal',
    role: 'Tous les commits des branches d’agents et leurs rapports mis en forme.' },

  { id: 'integration', zone: 'release', icon: '🌿', name: 'Intégration', x: 996, y: 96, href: '/journal',
    role: `La branche ${project.branches.integration}, où l’orchestrateur fusionne les branches des agents et vérifie l’ensemble.` },
  { id: 'pending', zone: 'release', icon: '📥', name: 'À publier', x: 996, y: 198, href: '/versions?tab=pending',
    role: `Les entrées « ${project.release.title} » des tâches terminées, pas encore rangées dans une ${word}.` },
  { id: 'branches', zone: 'release', icon: '🌳', name: 'Branches de version', x: 1060, y: 328, href: '/versions?tab=branches',
    role: `Les branches release/X.Y : les correctifs d’une ${word} publiée, leur report vers ${project.branches.integration} et les serveurs de test par version.` },
  { id: 'generation', zone: 'release', icon: '🧬', name: Word, x: 996, y: 458, href: '/versions',
    role: `Les ${word}s en préparation : leurs entrées, l’aperçu et le bouton Publier.` },
  { id: 'released', zone: 'release', icon: '📦', name: 'Publiées', x: 996, y: 560, href: '/versions?tab=released',
    role: `Les ${word}s publiées (tag, versions, ${project.paths.changelog}), celles que ${project.release.reader} voient.` },
];

// The life cycle, in order (the project's own steps follow it), then the side flows. via: corners of a path that goes
// around the nodes.
export const BASE_FLOWS = [
  { from: 'roadmap', to: 'tasks', label: 'découpe', fromAt: 0.35, toAt: 0.35 },
  { from: 'tasks', to: 'agents', label: 'lance' },
  { from: 'agents', to: 'journal', label: 'branches' },
  { from: 'journal', to: 'integration', label: 'fusion' },
  { from: 'integration', to: 'pending', label: 'entrées' },
  { from: 'pending', to: 'generation', label: 'range', fromAt: 0.12, toAt: 0.12 },
  { from: 'generation', to: 'released', label: 'publie' },
];
export const BASE_SIDE_FLOWS = [
  { from: 'agents', to: 'questions', label: 'questions', side: true, fromSide: 'bottom', fromAt: 0.2, toSide: 'top', toAt: 0.7 },
  { from: 'questions', to: 'roadmap', label: 'décisions', side: true, fromSide: 'left', toSide: 'right', toAt: 0.75 },
  { from: 'released', to: 'branches', label: 'correctifs', side: true, fromSide: 'right', fromAt: 0.5, toSide: 'right', toAt: 0.5, via: [[1240, 592], [1240, 360]] },
];

// The whole map for a project's hub settings: the framework's zones, nodes and flows, then the project's.
export function buildMap(hub = project.hub) {
  const flows = hub.flows ?? [];
  return {
    zones: [...BASE_ZONES, ...(hub.zones ?? [])],
    nodes: [...BASE_NODES, ...(hub.nodes ?? [])],
    flows: [...BASE_FLOWS, ...flows.filter((flow) => !flow.side), ...BASE_SIDE_FLOWS, ...flows.filter((flow) => flow.side)],
  };
}

export const { zones: ZONES, nodes: NODES, flows: FLOWS } = buildMap();

const center = (node) => [node.x + NODE_SIZE.w / 2, node.y + NODE_SIZE.h / 2];

// The point where a flow leaves or enters a node: on `side` at `at` (0 to 1 along it), by default the middle of the side
// facing (tx, ty). Beside when the cards do not overlap horizontally, otherwise above or below.
export function anchor(node, [tx, ty], side = null, at = 0.5) {
  const [cx, cy] = center(node);
  const dx = tx - cx;
  const dy = ty - cy;
  const chosen = side ?? (Math.abs(dx) >= NODE_SIZE.w ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top');
  if (chosen === 'right' || chosen === 'left') return { x: chosen === 'right' ? node.x + NODE_SIZE.w : node.x, y: node.y + NODE_SIZE.h * at, side: chosen };
  return { x: node.x + NODE_SIZE.w * at, y: chosen === 'bottom' ? node.y + NODE_SIZE.h : node.y, side: chosen };
}

const round = (value) => Math.round(value * 10) / 10;
const OUT = { right: [1, 0], left: [-1, 0], bottom: [0, 1], top: [0, -1] };

// A polyline with rounded corners, for the flows that go around the map.
export function roundedPath(points, radius = 18) {
  let d = `M${round(points[0][0])},${round(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const inLength = Math.hypot(x - px, y - py) || 1;
    const outLength = Math.hypot(nx - x, ny - y) || 1;
    const r = Math.min(radius, inLength / 2, outLength / 2);
    const a = [x - ((x - px) / inLength) * r, y - ((y - py) / inLength) * r];
    const b = [x + ((nx - x) / outLength) * r, y + ((ny - y) / outLength) * r];
    d += ` L${round(a[0])},${round(a[1])} Q${round(x)},${round(y)} ${round(b[0])},${round(b[1])}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L${round(lx)},${round(ly)}`;
}

// The SVG path of a flow, the place of its step number and label (at), and its straight length.
export function flowGeometry(flow, nodes = NODES) {
  const from = nodes.find((node) => node.id === flow.from);
  const to = nodes.find((node) => node.id === flow.to);
  if (!from || !to) throw new Error(`flow ${flow.from} → ${flow.to}: unknown node`);
  if (flow.via?.length) {
    const start = anchor(from, flow.via[0], flow.fromSide, flow.fromAt);
    const end = anchor(to, flow.via[flow.via.length - 1], flow.toSide, flow.toAt);
    const points = [[start.x, start.y], ...flow.via, [end.x, end.y]];
    // The label on the longest straight part.
    let best = 0;
    let at = [0, 0];
    for (let i = 1; i < points.length; i++) {
      const length = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      if (length > best) [best, at] = [length, [(points[i][0] + points[i - 1][0]) / 2, (points[i][1] + points[i - 1][1]) / 2]];
    }
    return { d: roundedPath(points), at: { x: round(at[0]), y: round(at[1]) }, length: Math.round(points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0)) };
  }
  const start = anchor(from, center(to), flow.fromSide, flow.fromAt);
  const end = anchor(to, center(from), flow.toSide, flow.toAt);
  const pull = Math.max(24, Math.hypot(end.x - start.x, end.y - start.y) * 0.4);
  const c1 = [start.x + OUT[start.side][0] * pull, start.y + OUT[start.side][1] * pull];
  const c2 = [end.x + OUT[end.side][0] * pull, end.y + OUT[end.side][1] * pull];
  // Middle of the cubic Bézier (t = 0.5).
  const mid = [(start.x + 3 * c1[0] + 3 * c2[0] + end.x) / 8, (start.y + 3 * c1[1] + 3 * c2[1] + end.y) / 8];
  return {
    d: `M${round(start.x)},${round(start.y)} C${round(c1[0])},${round(c1[1])} ${round(c2[0])},${round(c2[1])} ${round(end.x)},${round(end.y)}`,
    at: { x: round(mid[0]), y: round(mid[1]) },
    length: Math.round(Math.hypot(end.x - start.x, end.y - start.y)),
  };
}

// Everything the page needs to draw the map, computed once.
export function hubMap({ zones, nodes, flows } = buildMap(), hub = project.hub) {
  return {
    ...MAP_SIZE,
    node: NODE_SIZE,
    zones: zones.map(({ box: [x, y, w, h], ...zone }) => ({ ...zone, x, y, w, h })),
    nodes: nodes.map(({ doc, probe, body, down, ...node }) => node),
    flows: flows.map((flow, index) => ({ from: flow.from, to: flow.to, label: flow.label, side: Boolean(flow.side), step: flow.side ? null : index + 1, ...flowGeometry(flow, nodes) })),
    helix: hub.helix || null,
    // The order of the zones on a phone: the team and the releases first, the documentation last.
    order: ['team', 'release', ...(hub.zones ?? []).map((zone) => zone.id), 'docs'],
  };
}

// --- Aggregation (pure) --------------------------------------------------------------------------------------------------

const ACTIVE_MS = 5 * 60 * 1000;

// The same reading as the worktrees page: archived, done (finished transcript, or a report and a clean tree with no
// recent move), at work (a move in the last 5 minutes), otherwise calm.
export function agentCounts(agents, now = Date.now()) {
  const counts = { total: 0, working: 0, calm: 0, done: 0, archived: 0, commits: 0, reports: 0 };
  for (const agent of agents ?? []) {
    counts.total++;
    counts.commits += agent.commits?.length ?? 0;
    if (agent.report || agent.hasReport) counts.reports++;
    if (agent.AGENT_ARCHIVED) {
      counts.archived++;
      continue;
    }
    const lastMove = Math.max(agent.activity || 0, agent.progress?.updated || 0);
    const recent = lastMove > 0 && now - lastMove < ACTIVE_MS;
    const done = agent.progress?.finished || ((agent.report || agent.hasReport) && (agent.dirty?.length ?? 0) === 0 && !recent);
    if (done) counts.done++;
    else if (recent) counts.working++;
    else counts.calm++;
  }
  return counts;
}

const CLOSED = new Set(['answered', 'resolved', 'closed', 'done', 'decided', 'dismissed', 'archived']);

// Pending questions of /api/questions, whatever its exact shape: a number, { pending }, a list, or { questions: [...] }.
// null when the answer is not about questions (the endpoint does not exist yet).
export function pendingQuestions(body) {
  if (typeof body === 'number') return body;
  if (!body || typeof body !== 'object') return null;
  if (!Array.isArray(body)) {
    if (typeof body.pending === 'number') return body.pending;
    if (Array.isArray(body.pending)) return body.pending.length;
    const list = body.questions ?? body.items;
    return Array.isArray(list) ? pendingQuestions(list) : null;
  }
  return body.filter((question) => {
    if (!question || typeof question !== 'object') return true;
    if (question.answer || question.answeredAt || question.resolved || question.answered) return false;
    return !CLOSED.has(String(question.status ?? question.state ?? '').toLowerCase());
  }).length;
}

// The « Décider seul » switch, when /api/questions tells it.
export function decideAlone(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  for (const key of ['decideAlone', 'autonomous', 'auto', 'decideSeul']) if (typeof body[key] === 'boolean') return body[key];
  return body.settings ? decideAlone(body.settings) : null;
}

// Unread feedback of the agents (/api/questions of questions-routes.mjs), or 0.
export function unreadFeedback(body) {
  return body && typeof body === 'object' && typeof body.unread === 'number' ? body.unread : 0;
}

// The roadmap as /api/roadmap (roadmap-routes.mjs) sees it: its items, those added or changed since the last
// snapshot, the tasks queued for the orchestrator. null when it does not answer.
export function roadmapSync(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.items)) return null;
  const size = (value) => (Array.isArray(value) ? value.length : 0);
  const queue = body.queue;
  return {
    items: body.items.length,
    changed: size(body.pending?.added) + size(body.pending?.modified),
    queued: Array.isArray(queue) ? queue.length : size(queue?.tasks ?? queue?.items),
  };
}

// The tasks of the backlog still to do (⚪ à faire, or no status line), outside the delivered ones; null without a backlog.
export function roadmapBacklog(text) {
  if (typeof text !== 'string') return null;
  const tasks = parseBacklog(text).filter((item) => item.kind === 'task');
  if (!tasks.length) return null;
  return tasks.filter((task) => task.state === 'todo' && task.section !== project.paths.delivered).length;
}

// A route that does not exist answers with the worktrees page (the same body as a made-up path): such a page is « not
// there yet », unless its API answers in JSON (a page may also be a tab of the worktrees page, like /versions).
export function pageExists(answer, fallbackBody, apiBody = null) {
  if (apiBody !== null && apiBody !== undefined) return true;
  if (!answer?.ok || answer.status >= 400) return false;
  return typeof answer.body === 'string' && answer.body !== fallbackBody;
}

// The parsed JSON of a probe answer, or null.
export function jsonBody(answer) {
  if (!answer?.ok || answer.status >= 400 || !/json/.test(answer.type ?? '')) return null;
  try {
    return JSON.parse(answer.body);
  } catch {
    return null;
  }
}

// A path of the main checkout that /doc may serve: no dot folder or file, no data, secrets or dependencies.
export function docPath(root, requested) {
  let rel;
  try {
    rel = decodeURIComponent(requested).replace(/^\/+/, '');
  } catch {
    return null;
  }
  if (!rel || rel.includes('\0')) return null;
  const target = resolve(root, rel);
  const inside = relative(root, target);
  if (!inside || inside.startsWith('..') || resolve(root, inside) !== target) return null;
  const parts = inside.split(sep);
  if (parts.some((part) => part.startsWith('.') || ['node_modules', 'data', 'secrets', 'dist'].includes(part))) return null;
  return target;
}

export function ago(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 48 * 3600) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

// The releases as the hub tells them, from loadChanges() of release/changes.mjs: entries waiting for a release, the
// releases in preparation (planned.json) and the published ones.
export function releaseSummary(changes) {
  const planned = changes.plan?.versions ?? [];
  const assigned = new Set(planned.flatMap((version) => version.entries));
  return {
    current: changes.current,
    next: changes.next,
    unreleased: changes.unreleased.entries.length,
    pending: changes.unreleased.entries.filter((entry) => !assigned.has(entry.slug)).length,
    planned: planned.map((version) => ({ version: version.version, generation: releaseName(version.version), entries: version.entries.length, problems: version.problems?.length ?? 0 })),
    released: changes.released.length,
    latest: changes.released[0]?.version ?? null,
    latestDate: changes.released[0]?.date ?? null,
    errors: changes.errors.length,
  };
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The live state of every node from the raw readings. level: up (green), busy (blue), warn (amber), down (grey, off),
// soon (not built yet), info (neutral). text: one short line; badge: a number on the node.
export function nodeStates(input, now = Date.now(), { nodes = NODES, hub = project.hub } = {}) {
  const { probes = {}, agents = null, changes = null, backlog = null, roadmap = null, questions = null, pages = {}, docs = {}, branches = null } = input;
  const online = (probe, up, down = 'hors ligne') => (probe?.ok ? { level: 'up', text: up } : { level: 'down', text: down });
  const states = {};

  states.mindmap = { level: 'info', text: docs.mindmap ?? 'la carte des sujets' };
  states.roadmap = roadmap === null ? { level: 'info', text: project.paths.backlog } : { level: 'info', text: `${plural(roadmap, 'chantier')} à faire` };
  if (input.sync?.changed) states.roadmap = { level: 'warn', text: `${plural(input.sync.changed, 'changement')} à confier`, badge: input.sync.changed };
  else if (input.sync?.queued) states.roadmap = { level: 'busy', text: `${plural(input.sync.queued, 'tâche')} en file`, badge: input.sync.queued };
  states.report = { level: 'info', text: docs.report ?? 'aucun compte rendu' };
  states.orchestration = { level: 'info', text: 'le mode d’emploi de l’équipe' };

  if (agents) {
    const active = agents.total - agents.archived;
    states.tasks = { level: 'info', text: `${plural(active, 'chantier')} en cours`, badge: active || undefined };
    const parts = [`${agents.working} au travail`, `${plural(agents.done, 'terminé')}`];
    if (agents.archived) parts.push(`${plural(agents.archived, 'archivé')}`);
    states.agents = { level: agents.working ? 'busy' : agents.total ? 'up' : 'info', text: parts.join(' · '), badge: agents.working || undefined };
    states.journal = { level: 'info', text: `${plural(agents.commits, 'commit')} · ${plural(agents.reports, 'rapport')}` };
  } else {
    states.tasks = { level: 'info', text: 'lecture du registre…' };
    states.agents = { level: 'info', text: 'lecture du registre…' };
    states.journal = { level: 'info', text: 'commits et rapports' };
  }

  if (!pages.questions && questions?.pending == null) states.questions = { level: 'soon', text: 'bientôt' };
  else if (questions?.pending == null) states.questions = { level: 'info', text: 'questions des agents' };
  else {
    const mode = questions.decideAlone === true ? ' · décide seul' : '';
    const unread = questions.unread ? ` · ${plural(questions.unread, 'retour')} à lire` : '';
    states.questions = questions.pending
      ? { level: 'warn', text: `${plural(questions.pending, 'question')} en attente${unread}${mode}`, badge: questions.pending }
      : questions.unread
        ? { level: 'warn', text: `${plural(questions.unread, 'retour')} à lire${mode}`, badge: questions.unread }
        : { level: 'up', text: `aucune question en attente${mode}` };
  }

  states.integration = backlog
    ? { level: 'info', text: `${backlog.sha} · ${ago(backlog.time, now)}`, detail: `${backlog.subject}${backlog.ahead ? ` (${plural(backlog.ahead, 'commit')} d’avance sur ${project.branches.main})` : ''}` }
    : { level: 'down', text: 'branche introuvable' };

  if (changes) {
    states.pending = changes.pending
      ? { level: 'warn', text: `${plural(changes.pending, 'entrée')} à ranger`, badge: changes.pending }
      : { level: 'up', text: 'tout est rangé' };
    const [first, ...others] = changes.planned;
    if (!first) states.generation = { level: 'info', text: changes.next ? `aucune en cours · v${changes.next} proposée` : 'aucune en préparation' };
    else {
      const problems = changes.planned.reduce((sum, planned) => sum + planned.problems, 0);
      states.generation = {
        level: problems ? 'warn' : 'busy',
        text: `${first.generation} · ${plural(first.entries, 'entrée')}${others.length ? ` · +${others.length}` : ''}${problems ? ` · ${plural(problems, 'problème')}` : ''}`,
        badge: first.entries || undefined,
      };
    }
    if (changes.errors) states.pending = { level: 'warn', text: `${plural(changes.errors, 'erreur')} dans ${project.paths.changes}/`, badge: changes.errors };
    states.released = changes.latest
      ? { level: 'up', text: `${releaseName(changes.latest)}${changes.latestDate ? ` · ${changes.latestDate}` : ''}`, badge: changes.released > 1 ? changes.released : undefined }
      : { level: 'info', text: `aucune encore · v${changes.current}` };
  } else {
    states.pending = { level: 'info', text: `lecture de ${project.paths.changes}/…` };
    states.generation = { level: 'info', text: `lecture de ${project.paths.changes}/…` };
    states.released = { level: 'info', text: `lecture de ${project.paths.changes}/…` };
  }

  // The version branches release/X.Y (release/branches.mjs) and the test servers of versions.
  if (!branches) states.branches = { level: 'info', text: 'release/X.Y' };
  else {
    const servers = branches.servers ? ` · ${plural(branches.servers, 'serveur')} de test` : '';
    states.branches = branches.count
      ? { level: branches.toReport ? 'warn' : 'up', text: `${plural(branches.count, 'branche')}${branches.toReport ? ` · ${plural(branches.toReport, 'correctif')} à reporter` : ''}${servers}`, badge: branches.toReport || undefined }
      : { level: 'info', text: `aucune branche de version${servers}` };
  }

  // The project's nodes: online or not by their probe, then as the project reads them (hub.states).
  for (const node of nodes) {
    if (states[node.id]) continue;
    states[node.id] = node.probe ? online(probes[node.id], 'en ligne', node.down) : { level: 'info', text: node.text ?? '' };
  }
  if (typeof hub.states === 'function') Object.assign(states, hub.states({ probes, states, now }) ?? {});
  return states;
}

// Where each node leads now: a page of the dashboard that is not there yet falls back on its document.
export function nodeLinks(pages, nodes = NODES) {
  const links = {};
  for (const node of nodes) {
    const page = node.href.replace(/^\//, '');
    links[node.id] = node.doc && pages[page] === false ? node.doc : node.href;
  }
  return links;
}

// --- Readings (impure) ---------------------------------------------------------------------------------------------------

// GET with a short timeout: { ok, status, body } (body kept for small text answers), never throws.
export function probe(url, { timeout = 700, keepBody = false } = {}) {
  return new Promise((resolveProbe) => {
    let settled = false;
    const done = (value) => {
      if (!settled) (settled = true), resolveProbe(value);
    };
    let req;
    try {
      req = httpRequest(url, { method: 'GET', timeout, headers: { accept: '*/*' } }, (response) => {
        const status = response.statusCode ?? 0;
        if (!keepBody) {
          response.resume();
          return done({ ok: status > 0 && status < 500, status });
        }
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
          if (body.length > 512 * 1024) response.destroy();
        });
        response.on('end', () => done({ ok: status > 0 && status < 500, status, body, type: response.headers['content-type'] ?? '' }));
        response.on('error', () => done({ ok: false, status }));
      });
    } catch {
      return done({ ok: false, status: 0 });
    }
    req.on('timeout', () => (req.destroy(), done({ ok: false, status: 0 })));
    req.on('error', () => done({ ok: false, status: 0 }));
    req.end();
    setTimeout(() => done({ ok: false, status: 0 }), timeout + 300).unref?.();
  });
}

async function git(cwd, ...args) {
  try {
    const { stdout } = await run('git', ['-C', cwd, ...args], { timeout: 3000 });
    return stdout.trim();
  } catch {
    return '';
  }
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

// The newest document of the reports folder, by name (they start with their date).
async function latestReport(root) {
  const { readdirSync } = await import('node:fs');
  try {
    return readdirSync(join(root, project.paths.reports)).filter((file) => file.endsWith('.md')).sort().pop() ?? null;
  } catch {
    return null;
  }
}

const TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8', '.pdf': 'application/pdf',
};

export function createHub({ port, root, snapshot, page, ttl = 4000 }) {
  const self = `http://127.0.0.1:${port}`;
  const map = hubMap();
  const integration = project.branches.integration;
  let cache = null; // { time, value }
  let pending = null;

  // The project's readings: the probe of each of its nodes, then its extra ones (hub.probes).
  const targets = [
    ...NODES.filter((node) => node.probe).map((node) => [node.id, { url: node.probe, body: node.body }]),
    ...Object.entries(project.hub.probes ?? {}).map(([id, value]) => [id, typeof value === 'string' ? { url: value } : value]),
  ];

  async function read() {
    const keep = { keepBody: true };
    const readings = Promise.all(targets.map(([, target]) => probe(target.url, { keepBody: Boolean(target.body) })));
    const [fallback, questionsApi, questionsPage, roadmapApi, roadmapPage] = await Promise.all([
      probe(`${self}/__hub-missing__`, keep),
      probe(`${self}/api/questions`, keep),
      probe(`${self}/questions`, keep),
      probe(`${self}/api/roadmap`, keep),
      probe(`${self}/roadmap`, keep),
    ]);
    const probes = Object.fromEntries((await readings).map((answer, index) => [targets[index][0], answer]));
    const questionsBody = jsonBody(questionsApi);
    const pages = {
      questions: pageExists(questionsPage, fallback.body, questionsBody),
      roadmap: pageExists(roadmapPage, fallback.body, jsonBody(roadmapApi)),
    };
    const questions = { pending: pendingQuestions(questionsBody), unread: unreadFeedback(questionsBody), decideAlone: decideAlone(questionsBody) };
    const sync = roadmapSync(jsonBody(roadmapApi));

    const snap = snapshot();
    const agents = snap
      ? agentCounts(
          snap.agents.map((agent) => ({
            ...agent,
            hasReport: existsSync(join(agent.AGENT_DIR ?? '', project.paths.changes, UNRELEASED, agent.AGENT_NAME ?? '', 'report.md')),
          })),
          snap.now,
        )
      : null;

    let changes = null;
    try {
      changes = releaseSummary(loadChanges(root));
    } catch {}

    const [log, ahead] = await Promise.all([git(root, 'log', '-1', '--format=%h%x1f%ct%x1f%s', integration), git(root, 'rev-list', '--count', `${project.branches.main}..${integration}`)]);
    const [sha, time, subject] = log.split('\x1f');
    const backlog = log ? { sha, time: Number(time) * 1000, subject, ahead: Number(ahead) || 0 } : null;

    // The version branches, as the « Branches » tab tells them (fixes not reported to the integration branch yet).
    let releaseBranches = [];
    try {
      releaseBranches = listReleaseBranches(root);
    } catch {}
    const toReport = releaseBranches.reduce((sum, branch) => sum + branch.toReport, 0);
    const branches = { count: releaseBranches.length, toReport, servers: snap?.releaseServers ?? 0 };

    const reportName = await latestReport(root);
    const docs = { report: reportName ? reportName.replace(/\.md$/, '') : null };
    const now = Date.now();
    const state = nodeStates(
      { probes, agents, changes, backlog, roadmap: roadmapBacklog(readText(join(root, project.paths.backlog))), sync, questions, pages, docs, branches },
      now,
    );
    const links = nodeLinks(pages);
    if (reportName) links.report = `/doc/${project.paths.reports}/${encodeURIComponent(reportName)}`;
    return {
      now,
      state,
      links,
      pages,
      summary: {
        agents,
        generation: changes?.planned[0]?.generation ?? null,
        entries: changes?.planned[0]?.entries ?? 0,
        pending: changes?.pending ?? 0,
        backlog,
        questions: questions.pending,
        figures: typeof project.hub.figures === 'function' ? project.hub.figures({ probes }) ?? [] : [],
      },
    };
  }

  // The cached value at once when there is one (refreshed behind when stale); the first request waits for the readings.
  function state() {
    const fresh = cache && Date.now() - cache.time < ttl;
    if (!fresh && !pending) {
      pending = read()
        .then((value) => (cache = { time: Date.now(), value }))
        .catch((error) => console.error('hub', error))
        .finally(() => (pending = null));
    }
    return cache ? Promise.resolve(cache.value) : pending.then(() => cache?.value ?? { now: Date.now(), state: {}, links: {}, pages: {}, summary: {} });
  }

  function send(response, status, type, body) {
    response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    response.end(body);
  }

  async function serveDoc(requested, raw, response) {
    const target = docPath(root, requested);
    if (!target || !existsSync(target)) return send(response, 404, 'text/plain; charset=utf-8', 'Document introuvable');
    if (statSync(target).isDirectory()) {
      // A folder: its README, or its newest Markdown file (the reports are named by date).
      const { readdirSync } = await import('node:fs');
      const files = readdirSync(target).filter((file) => file.endsWith('.md')).sort();
      const pick = files.includes('README.md') ? 'README.md' : files.pop();
      if (!pick) return send(response, 404, 'text/plain; charset=utf-8', 'Dossier vide');
      response.writeHead(302, { location: `/doc/${relative(root, join(target, pick)).split(sep).map(encodeURIComponent).join('/')}` });
      return response.end();
    }
    if (statSync(target).size > 4 * 1024 * 1024) return send(response, 413, 'text/plain; charset=utf-8', 'Fichier trop gros');
    const extension = extname(target).toLowerCase();
    if (extension === '.md' && !raw) {
      const rel = relative(root, target).split(sep).join('/');
      return send(response, 200, 'text/html; charset=utf-8', page('doc.html').replaceAll('__DOC__', rel.replace(/[<>&"']/g, '')));
    }
    if (TYPES[extension]) return send(response, 200, TYPES[extension], readFileSync(target));
    return send(response, 200, 'text/plain; charset=utf-8', readFileSync(target));
  }

  // true when the request was answered.
  async function route(path, request, response) {
    if (path === '/' || path === '/index.html' || path === '/hub') {
      send(response, 200, 'text/html; charset=utf-8', page('hub.html'));
      return true;
    }
    if (path === '/agents') {
      send(response, 200, 'text/html; charset=utf-8', page('dashboard.html'));
      return true;
    }
    if (path === '/api/hub') {
      const onlyState = new URL(request.url ?? '/', 'http://localhost').searchParams.get('state') === '1';
      const value = await state();
      send(response, 200, 'application/json', JSON.stringify(onlyState ? value : { map, ...value }));
      return true;
    }
    if (path.startsWith('/doc/')) {
      const raw = new URL(request.url ?? '/', 'http://localhost').searchParams.get('raw') === '1';
      await serveDoc(path.slice('/doc/'.length), raw, response);
      return true;
    }
    return false;
  }

  return { route, state };
}
