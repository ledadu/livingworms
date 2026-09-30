// Questions of the agents to the user: choices to make, validations, strategic feedback.
//
// One JSON file per question in <registry>/questions/<id>.json, the registry being .git/agents of the main repository
// (shared by every worktree), or AGENT_REGISTRY for a throwaway one. The switch « Décider seul » lives in
// <registry>/settings.json: { autonomous, timeoutMinutes, agents: { <name>: { autonomous } } }.
// No dependency; the clock is passed in so the tests drive it.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { askPath } from '../config.mjs';

export const TYPES = ['choice', 'validation', 'feedback'];
export const STATUSES = ['pending', 'answered', 'auto', 'expired', 'withdrawn'];
export const SEVERITIES = ['info', 'important', 'critical'];

export const DEFAULT_SETTINGS = { autonomous: true, timeoutMinutes: 30, agents: {} };
// One call of ask.mjs waits at most this long, to fit in one call of the agent's shell tool (10 min).
export const MAX_WAIT_MS = 9 * 60 * 1000;
export const DEFAULT_WAIT_MS = 5 * 60 * 1000;
// A pending question past its deadline that no ask.mjs settled (the agent stopped waiting) is marked expired after this.
export const EXPIRY_GRACE_MS = 10 * 60 * 1000;

/** The registry: AGENT_REGISTRY, else .git/agents of the repository that holds `cwd` (shared by all its worktrees). */
export function registryDir(cwd = process.cwd(), env = process.env) {
  if (env.AGENT_REGISTRY) return resolve(env.AGENT_REGISTRY);
  const common = execFileSync('git', ['-C', cwd, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim();
  return join(resolve(cwd, common), 'agents');
}

export const questionsDir = (root) => join(root, 'questions');
const questionFile = (root, id) => {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`identifiant de question invalide : ${id}`);
  return join(questionsDir(root), `${id}.json`);
};

// Write then rename: a reader (the dashboard, a waiting ask.mjs) never sees half a file.
function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, file);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const iso = (ms) => new Date(ms).toISOString();
const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

// --- Settings -----------------------------------------------------------------------------------------------------

export function readSettings(root) {
  const stored = readJson(join(root, 'settings.json')) ?? {};
  return { ...DEFAULT_SETTINGS, ...stored, agents: { ...(stored.agents ?? {}) } };
}

/**
 * Changes the settings. `patch.agents[name]` set to null removes that agent's override (it follows the global switch
 * again); a boolean sets it.
 */
export function writeSettings(root, patch) {
  const settings = readSettings(root);
  if (typeof patch.autonomous === 'boolean') settings.autonomous = patch.autonomous;
  if (Number.isFinite(patch.timeoutMinutes) && patch.timeoutMinutes > 0) settings.timeoutMinutes = patch.timeoutMinutes;
  for (const [name, value] of Object.entries(patch.agents ?? {})) {
    const autonomous = typeof value === 'object' && value !== null ? value.autonomous : value;
    if (typeof autonomous === 'boolean') settings.agents[name] = { autonomous };
    else delete settings.agents[name];
  }
  writeJson(join(root, 'settings.json'), settings);
  return settings;
}

/** Whether the agent decides alone: its own override, else the global switch (true by default, as before). */
export function isAutonomous(settings, agent) {
  const own = settings.agents?.[agent]?.autonomous;
  return typeof own === 'boolean' ? own : settings.autonomous !== false;
}

// --- Questions ----------------------------------------------------------------------------------------------------

/** Checks and normalises what an agent asks; throws a message meant for the agent when something is missing. */
export function normalizeInput(input) {
  const type = text(input.type);
  if (!TYPES.includes(type)) throw new Error(`type inconnu « ${type} » : choice, validation ou feedback`);
  const agent = text(input.agent);
  if (!/^[a-z0-9-]+$/.test(agent)) throw new Error('nom d’agent manquant ou invalide (lu dans .env.agent, ou --agent)');
  const title = text(input.title);
  if (!title) throw new Error('--title manquant : la question en une phrase');
  const question = { type, agent, task: text(input.task), title, context: text(input.context), impact: text(input.impact) };
  if (type === 'choice') {
    const options = (input.options ?? []).map((option) =>
      typeof option === 'string' ? { label: option.trim() } : { label: text(option.label), description: text(option.description), recommended: Boolean(option.recommended) },
    );
    if (options.length < 2 || options.some((option) => !option.label)) throw new Error('un choix demande au moins deux options, chacune avec un libellé');
    let recommended = options.findIndex((option) => option.recommended);
    if (Number.isInteger(input.recommended)) recommended = input.recommended;
    if (recommended < 0 || recommended >= options.length) recommended = 0;
    // The recommended option comes first, so that the answer « 1 » and the eye both land on it.
    const ordered = [options[recommended], ...options.filter((_, index) => index !== recommended)];
    question.options = ordered.map((option, index) => ({ label: option.label, description: option.description ?? '', recommended: index === 0 }));
  }
  if (type === 'validation') question.recommended = input.recommended === false || text(input.recommended) === 'no' ? 'no' : 'yes';
  if (type === 'feedback') {
    const severity = text(input.severity) || 'info';
    if (!SEVERITIES.includes(severity)) throw new Error(`gravité inconnue « ${severity} » : ${SEVERITIES.join(', ')}`);
    question.severity = severity;
  }
  return question;
}

function newId(agent, now) {
  return `${agent}-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Records a question. A choice or validation gets a deadline (`timeoutMinutes`, else the settings'); past it, the agent
 * goes on with the recommended option. When the agent decides alone, the question is recorded already settled (auto).
 */
export function createQuestion(root, input, { now = Date.now(), timeoutMinutes } = {}) {
  const fields = normalizeInput(input);
  const settings = readSettings(root);
  const minutes = Number(timeoutMinutes) > 0 ? Number(timeoutMinutes) : settings.timeoutMinutes;
  const question = {
    id: newId(fields.agent, now),
    ...fields,
    status: 'pending',
    createdAt: iso(now),
    updatedAt: iso(now),
    ...(fields.type === 'feedback' ? {} : { expiresAt: iso(now + minutes * 60_000) }),
    answer: null,
  };
  writeJson(questionFile(root, question.id), question);
  if (fields.type !== 'feedback' && isAutonomous(settings, fields.agent)) return decideAlone(root, question.id, 'autonomous', { now });
  return question;
}

export function readQuestion(root, id) {
  return readJson(questionFile(root, id));
}

/** Every question, newest first, optionally filtered by agent, type and status. */
export function listQuestions(root, { agent, type, status } = {}) {
  let files = [];
  try {
    files = readdirSync(questionsDir(root)).filter((file) => file.endsWith('.json'));
  } catch {}
  return files
    .map((file) => readJson(join(questionsDir(root), file)))
    .filter((q) => q && (!agent || q.agent === agent) && (!type || q.type === type) && (!status || q.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function update(root, id, change, { now = Date.now(), onlyPending = true } = {}) {
  const question = readQuestion(root, id);
  if (!question) throw new Error(`question inconnue : ${id}`);
  if (onlyPending && question.status !== 'pending') throw new Error(`question déjà close (${question.status}) : ${id}`);
  const next = { ...question, ...change(question), updatedAt: iso(now) };
  writeJson(questionFile(root, id), next);
  return next;
}

/**
 * The user's answer. A choice takes `option` (index in the options, recommended first) and/or a free `comment`; a
 * validation takes `approved` (true / false) and an optional `comment`.
 */
export function answerQuestion(root, id, { option, approved, comment } = {}, { now = Date.now() } = {}) {
  return update(
    root,
    id,
    (question) => {
      if (question.type === 'feedback') throw new Error('un retour stratégique n’attend pas de réponse : marque-le lu');
      const note = text(comment);
      if (question.type === 'choice') {
        const index = option === undefined || option === null || option === '' ? null : Number(option);
        if (index !== null && !(Number.isInteger(index) && index >= 0 && index < question.options.length)) throw new Error(`option invalide : ${option}`);
        if (index === null && !note) throw new Error('choisis une option ou écris une réponse');
        return { status: 'answered', answer: { by: 'user', option: index, label: index === null ? null : question.options[index].label, comment: note, at: iso(now) } };
      }
      if (typeof approved !== 'boolean') throw new Error('réponds oui ou non');
      return { status: 'answered', answer: { by: 'user', approved, comment: note, at: iso(now) } };
    },
    { now },
  );
}

/** The recommended answer, chosen without the user: `reason` is autonomous (switch on) or timeout (deadline passed). */
export function decideAlone(root, id, reason, { now = Date.now(), status = 'auto' } = {}) {
  return update(root, id, (question) => ({ status, answer: { by: 'auto', reason, ...recommendedAnswer(question), comment: '', at: iso(now) } }), { now });
}

export function recommendedAnswer(question) {
  if (question.type === 'choice') return { option: 0, label: question.options[0].label };
  if (question.type === 'validation') return { approved: question.recommended !== 'no' };
  return {};
}

/** A strategic feedback has been read by the user; `comment` is an optional reply the agent may read later. */
export function markRead(root, id, { comment, now = Date.now() } = {}) {
  return update(root, id, (question) => {
    if (question.type !== 'feedback') throw new Error('seul un retour stratégique se marque lu');
    return { status: 'answered', answer: { by: 'user', read: true, comment: text(comment), at: iso(now) } };
  }, { now });
}

/** The agent (or the user) withdraws a question that no longer stands. */
export function withdrawQuestion(root, id, { reason, now = Date.now() } = {}) {
  return update(root, id, () => ({ status: 'withdrawn', answer: { by: 'withdrawn', comment: text(reason), at: iso(now) } }), { now });
}

/**
 * Marks as expired the pending choices and validations past their deadline plus a grace period: nobody waits for
 * them any more (the agent went on or stopped). Returns the ones it changed.
 */
export function expireStale(root, { now = Date.now(), graceMs = EXPIRY_GRACE_MS } = {}) {
  const changed = [];
  for (const question of listQuestions(root, { status: 'pending' })) {
    if (question.type === 'feedback' || !question.expiresAt) continue;
    if (Date.parse(question.expiresAt) + graceMs > now) continue;
    changed.push(decideAlone(root, question.id, 'timeout', { now, status: 'expired' }));
  }
  return changed;
}

/** Counters for the dashboard: pending choices and validations, unread feedback, per agent too. */
export function counts(questions) {
  const byAgent = {};
  let pending = 0;
  let unread = 0;
  for (const question of questions) {
    if (question.status !== 'pending') continue;
    const own = (byAgent[question.agent] ??= { pending: 0, unread: 0 });
    const key = question.type === 'feedback' ? 'unread' : 'pending';
    own[key]++;
    if (key === 'unread') unread++;
    else pending++;
  }
  return { pending, unread, byAgent };
}

/**
 * Waits until the question is settled, for at most `waitMs`: by the user, by the switch « Décider seul » turned on
 * meanwhile, or by its deadline (then the recommended option, marked auto). Returns the question, still pending when
 * this call's wait ran out first.
 */
export async function waitForAnswer(root, id, { waitMs = DEFAULT_WAIT_MS, pollMs = 1000, clock = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const until = clock() + Math.min(Math.max(0, waitMs), MAX_WAIT_MS);
  for (;;) {
    const question = readQuestion(root, id);
    if (!question) throw new Error(`question inconnue : ${id}`);
    if (question.status !== 'pending' || question.type === 'feedback') return question;
    const now = clock();
    try {
      if (isAutonomous(readSettings(root), question.agent)) return decideAlone(root, id, 'autonomous', { now });
      if (question.expiresAt && now >= Date.parse(question.expiresAt)) return decideAlone(root, id, 'timeout', { now });
    } catch {
      continue; // answered by the user in the meantime: read it again
    }
    if (now >= until) return question;
    await sleep(Math.min(pollMs, Math.max(1, until - now)));
  }
}

/** The answer as the agent reads it on stdout: `key: value` lines, then what to do. */
export function formatAnswer(question) {
  const lines = [`id: ${question.id}`, `type: ${question.type}`, `status: ${question.status}`];
  const answer = question.answer ?? {};
  const resume = `node ${askPath} --resume ${question.id}`;
  if (question.type === 'feedback') {
    lines.push(question.status === 'answered' ? `read: yes${answer.comment ? `\ncomment: ${answer.comment}` : ''}` : 'read: no');
    lines.push('next: retour enregistré, continue ton travail (rien à attendre).');
    return lines.join('\n');
  }
  if (question.status === 'pending') {
    lines.push(`expires: ${question.expiresAt}`);
    lines.push(`next: pas encore de réponse. Relance l'attente : ${resume} (outil Bash, timeout 600000). Tu peux avancer sur autre chose entre deux attentes.`);
    return lines.join('\n');
  }
  if (question.status === 'withdrawn') {
    lines.push(`next: question retirée${answer.comment ? ` (${answer.comment})` : ''} ; décide toi-même avec l'option recommandée.`);
    return lines.join('\n');
  }
  lines.push(`by: ${answer.by === 'auto' ? `auto (${answer.reason === 'timeout' ? 'délai dépassé' : 'mode « Décider seul »'})` : 'user'}`);
  if (question.type === 'choice') {
    lines.push(answer.option === null || answer.option === undefined ? 'choice: (réponse libre)' : `choice: ${answer.option + 1}. ${answer.label}`);
  } else {
    lines.push(`approved: ${answer.approved ? 'yes' : 'no'}`);
  }
  if (answer.comment) lines.push(`comment: ${answer.comment}`);
  if (answer.by === 'auto') {
    const why = answer.reason === 'timeout' ? "personne n'a répondu à temps" : 'mode « Décider seul »';
    lines.push(`next: ${why} : applique l'option recommandée, comme avant, et note-le dans ton rapport (choix retenu « auto »).`);
  }
  else if (question.type === 'choice') lines.push(`next: l'utilisateur a tranché : applique ${answer.label ? `« ${answer.label} »` : 'sa réponse'}${answer.comment ? ' en tenant compte de son commentaire' : ''}, et note-le dans ton rapport.`);
  else lines.push(`next: l'utilisateur ${answer.approved ? 'valide' : 'refuse'}${answer.comment ? ' (voir son commentaire)' : ''} : agis en conséquence et note-le dans ton rapport.`);
  return lines.join('\n');
}

export function questionExists(root, id) {
  try {
    return existsSync(questionFile(root, id));
  } catch {
    return false;
  }
}
