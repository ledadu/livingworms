// The actions of the mirror on claude.ai (mirror.html). The page cannot reach this machine: each of its buttons posts
// a comment sent to Claude, with one action as JSON. The Claude Code session watching the page saves the comment's
// text to a file and runs this script, which checks the action against ACTIONS, sends it to the dashboard's own
// route (a local request: no token), keeps its result (<registry>/mirror-actions.json) and takes a new snapshot for
// the page (mirror.mjs). Claude then sends the snapshot to the page as usual (ArtifactData set on mirror/state).
//
// Nothing else runs: an action missing from ACTIONS, or an argument outside its pattern, is refused, so a comment
// can only do what a button of the dashboard does.
//
//   node agent/mirror-act.mjs [--port 7800] --file comment.txt     (or the comment's text on stdin)
//   prints the result, then the path of the new snapshot
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EFFORTS, project } from '../config.mjs';
import { readActions, registryDir, takeSnapshot } from './mirror.mjs';

const NAME = /^[a-z0-9-]{1,120}$/;
const BRANCH = /^[\w./-]{1,100}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const REQUEST_ID = /^[a-z0-9]{6,40}$/;

const fail = (message) => {
  throw new Error(message);
};
const name = (value, what = 'nom') => (typeof value === 'string' && NAME.test(value) ? value : fail(`${what} invalide : ${value}`));
const branch = (value) => (typeof value === 'string' && BRANCH.test(value) ? value : fail(`branche invalide : ${value}`));
const version = (value) => (typeof value === 'string' && VERSION.test(value.trim()) ? value.trim() : fail(`version invalide : ${value}`));
const text = (value, max = 4000) => (value === undefined || value === null ? '' : typeof value === 'string' ? value.slice(0, max) : fail('texte attendu'));
const required = (value, what) => (value.trim() ? value : fail(`${what} manquant`));
const bool = (value) => (typeof value === 'boolean' ? value : fail('oui ou non attendu'));
const effort = (value) => (value === undefined || value === null || value === '' ? null : EFFORTS.includes(value) ? value : fail(`effort invalide : ${value}`));
const model = (value) => (value === undefined || value === null || value === '' ? null : (project.models ?? []).includes(value) ? value : fail(`modèle invalide : ${value}`));

/**
 * What each action of the page does: the dashboard route it calls (always POST), its query and body. Built from
 * the page's arguments, each checked; the dashboard checks its part again.
 */
export const ACTIONS = {
  // Nothing but a new snapshot (« ↻ Rafraîchir »).
  refresh: () => null,

  // An agent's card.
  up: (a) => ({ path: `/api/up/${name(a.name)}` }),
  down: (a) => ({ path: `/api/down/${name(a.name)}` }),
  accept: (a) => ({ path: `/api/accept/${name(a.name)}` }),
  rebase: (a) => ({ path: `/api/rebase/${name(a.name)}`, query: { base: branch(a.base ?? project.branches.integration), ...(a.archive ? { archive: '1' } : {}) } }),
  fixConflicts: (a) => ({ path: `/api/fix-conflicts/${name(a.name)}` }),
  order: (a) => ({ path: `/api/order/${name(a.name)}`, body: { order: required(text(a.order), 'ordre') } }),
  settings: (a) => ({ path: `/api/settings/${name(a.name)}`, body: { effort: effort(a.effort), model: model(a.model) } }),
  archive: (a) => ({ path: `/api/archive/${name(a.name)}` }),
  unarchive: (a) => ({ path: `/api/unarchive/${name(a.name)}` }),
  clean: (a) => ({ path: '/api/clean', query: a.dry ? { dry: '1' } : {} }),

  // Questions and feedback.
  answer: (a) => {
    const option = a.option === undefined || a.option === null ? null : Number.isInteger(a.option) && a.option >= 0 ? a.option : fail(`option invalide : ${a.option}`);
    return { path: `/api/questions/${name(a.id, 'question')}/answer`, body: { option, ...(a.approved === undefined ? {} : { approved: bool(a.approved) }), comment: text(a.comment) } };
  },
  read: (a) => ({ path: `/api/questions/${name(a.id, 'question')}/read`, body: { comment: text(a.comment) } }),
  autonomous: (a) => ({ path: '/api/questions/settings', body: { autonomous: bool(a.on) } }),

  // The queue and the backlog.
  enqueue: (a) => {
    const tasks = Array.isArray(a.tasks) && a.tasks.length && a.tasks.length <= 20 ? a.tasks : fail('de 1 à 20 chantiers attendus');
    return {
      path: '/api/roadmap/enqueue',
      body: { tasks: tasks.map((task) => ({ id: name(task.id, 'chantier'), name: name(task.name, 'agent'), base: branch(task.base ?? project.branches.integration), effort: effort(task.effort), model: model(task.model) })) },
    };
  },
  launch: (a) => ({ path: `/api/queue/${name(a.name)}/launch` }),
  launchAll: () => ({ path: '/api/queue/launch-all' }),
  stop: (a) => ({ path: `/api/queue/${name(a.name)}/stop` }),
  resume: (a) => ({ path: `/api/queue/${name(a.name)}/resume`, body: { message: text(a.message) } }),
  cancel: (a) => ({ path: `/api/queue/${name(a.name)}/cancel`, query: a.worktree ? { worktree: '1' } : {} }),
  forget: (a) => ({ path: `/api/queue/${name(a.name)}/forget` }),
  newTask: (a) => ({ path: '/api/backlog/new', body: { section: required(text(a.section, 200), 'groupe'), text: required(text(a.text), 'texte') } }),

  // Versions.
  assign: (a) => ({ path: '/api/assign', body: { slug: name(a.slug, 'entrée'), version: a.version ? version(a.version) : '' } }),
  assignMany: (a) => ({ path: '/api/assign-many', body: { slugs: (Array.isArray(a.slugs) ? a.slugs : fail('entrées attendues')).map((slug) => name(slug, 'entrée')), version: a.version ? version(a.version) : '' } }),
  plan: (a) => ({ path: '/api/plan', body: { version: version(a.version), title: text(a.title, 200), intro: text(a.intro, 1000) } }),
  unplan: (a) => ({ path: '/api/unplan', body: { version: version(a.version) } }),
  publish: (a) => ({ path: '/api/publish', body: { version: version(a.version), branch: a.branch !== false } }),
};

/** The action of a comment of the page: its JSON object (the last {...} of the text), checked. */
export function parseRequest(comment) {
  const body = String(comment ?? '');
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < start) {
    // a plain « miroir » typed by hand is a refresh
    if (/\bmiroir\b/i.test(body)) return { id: null, action: 'refresh', label: 'Rafraîchir', args: {} };
    fail('pas d’action dans ce commentaire');
  }
  let request;
  try {
    request = JSON.parse(body.slice(start, end + 1));
  } catch {
    fail('action illisible (JSON invalide)');
  }
  if (!request || typeof request !== 'object' || Array.isArray(request)) fail('action illisible');
  const action = typeof request.action === 'string' && Object.hasOwn(ACTIONS, request.action) ? request.action : fail(`action inconnue : ${request.action}`);
  const id = request.id === undefined || request.id === null ? null : typeof request.id === 'string' && REQUEST_ID.test(request.id) ? request.id : fail('identifiant de demande invalide');
  return { id, action, label: text(request.label, 120) || action, args: request.args && typeof request.args === 'object' && !Array.isArray(request.args) ? request.args : {} };
}

/** The dashboard request of an action: { path, query, body } or null (nothing to call). */
export function toRoute({ action, args }) {
  return ACTIONS[action](args);
}

/** One line from the dashboard's answer: ok, and what happened (or why not). */
export function summarize(answer) {
  if (!answer || typeof answer !== 'object') return { ok: false, message: 'réponse vide du tableau de bord' };
  const results = Array.isArray(answer.results) ? answer.results : null;
  const failed = results?.filter((one) => one && one.ok === false) ?? [];
  const ok = answer.ok !== false && failed.length === 0;
  const message =
    answer.message ||
    answer.error ||
    (results ? results.map((one) => `${one.name ?? '?'} : ${one.ok === false ? one.error ?? 'refusé' : 'ok'}`).join(' · ') : '') ||
    (Array.isArray(answer.cleaned) ? `${answer.dryRun ? 'à nettoyer' : 'nettoyés'} : ${answer.cleaned.join(', ') || 'aucun'}` : '') ||
    (answer.question ? 'réponse enregistrée' : '') ||
    (ok ? 'fait' : 'refusé');
  return { ok, message: String(message) };
}

/** Keeps the result of an action for the next snapshots (the last 12). */
export function recordAction(entry, file = join(registryDir(), 'mirror-actions.json')) {
  const list = [...readActions(file), entry].slice(-12);
  writeFileSync(file, JSON.stringify(list, null, 2));
  return list;
}

async function call(port, { path, query = {}, body }) {
  const url = new URL(path, `http://127.0.0.1:${port}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const type = response.headers.get('content-type') ?? '';
  return type.includes('json') ? response.json() : { ok: response.ok, message: (await response.text()).slice(0, 300) };
}

async function main() {
  const args = process.argv.slice(2);
  const option = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const port = Number(option('--port')) || 7800;
  const file = option('--file');
  const comment = file ? readFileSync(resolve(file), 'utf8') : readFileSync(0, 'utf8');
  let request;
  let result;
  try {
    request = parseRequest(comment);
    const route = toRoute(request);
    result = route ? summarize(await call(port, route)) : { ok: true, message: 'instantané rafraîchi' };
  } catch (error) {
    result = { ok: false, message: error.message };
  }
  recordAction({ id: request?.id ?? null, action: request?.action ?? null, label: request?.label ?? 'Action', ...result, at: new Date().toISOString() });
  console.log(`${result.ok ? '✓' : '✗'} ${request?.label ?? 'Action'} : ${result.message}`);
  try {
    const { out, size } = await takeSnapshot({ port });
    console.log(`${out} ${Math.round(size / 1024)} Kio`);
  } catch (error) {
    console.error(`mirror: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
