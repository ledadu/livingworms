// What happens around the agents, as events for the notifications (notify.mjs): a snapshot of the facts every few
// seconds (runs, questions, refused accepts, accepted tasks, merge train, versions, chats of the backlog), compared with
// the previous one. readFacts reads the files, diffFacts is pure.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { unseen } from './task-chat.mjs';
import { join } from 'node:path';
import { runState } from './launch.mjs';
import { readTrain } from './merge-train.mjs';
import { listQuestions } from './questions.mjs';
import { readQueue } from './roadmap.mjs';

const list = (dir, filter = () => true) => {
  try {
    return readdirSync(dir).filter(filter);
  } catch {
    return [];
  }
};
const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/** The facts the events come from. `registry`: .git/agents; `runsRegistry`: where runs/ and queue/ are; `root`: the main checkout. */
export function readFacts({ registry, runsRegistry = registry, root }) {
  const runs = {};
  for (const name of list(join(runsRegistry, 'runs'))) {
    const run = runState(runsRegistry, name);
    if (run) runs[name] = { state: run.state, code: run.code, startedAt: run.startedAt ?? null };
  }
  const queue = {};
  try {
    for (const entry of readQueue(join(runsRegistry, 'queue'))) queue[entry.name] = { status: entry.status, title: entry.title ?? entry.name, launchedAt: entry.launchedAt ?? null };
  } catch {}
  const questions = {};
  for (const question of listQuestions(registry, { status: 'pending' })) questions[question.id] = { type: question.type, agent: question.agent, title: question.title };
  const refusals = {};
  const archived = [];
  for (const file of list(registry, (one) => one.endsWith('.accept.log') || one.endsWith('.env'))) {
    const text = readFileSync(join(registry, file), 'utf8');
    if (file.endsWith('.accept.log')) {
      const lines = text.trim().split('\n').filter(Boolean);
      refusals[file.slice(0, -'.accept.log'.length)] = { count: lines.length, last: lines.at(-1)?.split('\t').slice(2).join('\t') ?? '' };
    } else if (/^AGENT_ARCHIVED=/m.test(text) && !/^AGENT_KIND=release$/m.test(text)) archived.push(file.slice(0, -4));
  }
  const train = readTrain(registry);
  const versions = list(join(root, 'changes'), (one) => /^v\d/.test(one) && statSync(join(root, 'changes', one)).isDirectory());
  const chats = {};
  for (const file of list(join(registry, 'chats'), (one) => one.endsWith('.json'))) {
    const chat = readJson(join(registry, 'chats', file));
    if (!chat) continue;
    const last = [...(chat.messages ?? [])].reverse().find((message) => message.role === 'assistant');
    const fresh = unseen(chat);
    chats[file.slice(0, -5)] = { pending: Boolean(chat.pending), count: chat.messages?.length ?? 0, title: chat.title ?? '', mode: chat.mode ?? 'task', error: Boolean(last?.error), answerAt: last?.at ?? null, subtasks: fresh.subtasks, proposals: fresh.proposals, seen: !fresh.answers };
  }
  return {
    runs,
    queue,
    questions,
    refusals,
    archived: archived.sort(),
    train: train ? { startedAt: train.startedAt ?? train.createdAt ?? null, finishedAt: train.finishedAt ?? null, items: (train.items ?? []).map((item) => ({ name: item.name, state: item.state, message: item.message ?? '' })) } : null,
    versions: versions.sort(),
    chats,
  };
}

const RUN_END = { done: 'agent-done', error: 'agent-error', lost: 'agent-error' };

/** The events between two snapshots (none the first time: `previous` null). */
export function diffFacts(previous, next) {
  if (!previous) return [];
  const events = [];
  for (const [name, run] of Object.entries(next.runs)) {
    const before = previous.runs[name];
    // A new run (launched or resumed: another start), or the same one that ended.
    const started = run.state === 'running' && (!before || before.state !== 'running' || before.startedAt !== run.startedAt);
    if (started) events.push({ type: 'agent-launched', agent: name, key: run.startedAt, title: `${name} a démarré`, body: next.queue[name]?.title ?? '', url: `/agents#${name}` });
    if (before?.state === 'running' && RUN_END[run.state]) {
      const type = RUN_END[run.state];
      events.push(type === 'agent-done'
        ? { type, agent: name, key: run.startedAt, title: `${name} a fini`, body: `${next.queue[name]?.title ?? ''}\nPrêt à tester et à accepter.`.trim(), url: `/agents#${name}` }
        : { type, agent: name, key: run.startedAt, title: `${name} s’est arrêté en erreur`, body: run.state === 'lost' ? 'Son processus a disparu.' : `Code de sortie ${run.code}.`, url: `/run/${name}` });
    }
  }
  for (const [id, question] of Object.entries(next.questions)) {
    if (previous.questions[id]) continue;
    const feedback = question.type === 'feedback';
    events.push({ type: feedback ? 'feedback' : 'question', agent: question.agent, key: id, title: feedback ? `Un mot de ${question.agent}` : `${question.agent} te pose une question`, body: question.title, url: '/questions' });
  }
  for (const [name, refusal] of Object.entries(next.refusals)) {
    if (refusal.count > (previous.refusals[name]?.count ?? 0)) events.push({ type: 'accept-refused', agent: name, key: `${name}-${refusal.count}`, title: `« Accepter » a refusé ${name}`, body: refusal.last.slice(0, 200), url: `/agents#${name}` });
  }
  for (const name of next.archived) {
    if (!previous.archived.includes(name)) events.push({ type: 'accepted', agent: name, key: name, title: `${name} acceptée`, body: 'Fusionnée : elle passe dans « À publier ».', url: '/versions?tab=pending' });
  }
  if (next.train?.finishedAt && next.train.finishedAt !== previous.train?.finishedAt) {
    const done = next.train.items.filter((item) => item.state === 'accepted').map((item) => item.name);
    const failed = next.train.items.filter((item) => item.state === 'failed');
    events.push({ type: 'merge-train', key: next.train.finishedAt, title: `Fusion en série finie : ${done.length} acceptée${done.length > 1 ? 's' : ''}${failed.length ? `, ${failed.length} en échec` : ''}`,
      body: [...done.map((name) => `✓ ${name}`), ...failed.map((item) => `✕ ${item.name} : ${item.message}`)].join('\n').slice(0, 400), url: '/agents' });
  }
  for (const version of next.versions) {
    if (!previous.versions.includes(version)) events.push({ type: 'version', key: version, title: `Version ${version} publiée`, body: 'Son tag est posé (sans push).', url: '/versions?tab=released' });
  }
  // A new answer of Claude in a chat of the backlog, not seen yet: told once, whenever it came (the facts are kept
  // across restarts of the dashboard, see watchEvents).
  for (const [key, chat] of Object.entries(next.chats)) {
    const before = previous.chats[key];
    if (!chat.answerAt || chat.seen || chat.answerAt === before?.answerAt) continue;
    const id = key.replace(/--sous-taches$/, '');
    const what = chat.error ? 'erreur : renvoie ton message' : [chat.subtasks ? `${chat.subtasks} sous-tâche${chat.subtasks > 1 ? 's' : ''} proposée${chat.subtasks > 1 ? 's' : ''}, à créer` : '', chat.proposals ? 'une nouvelle version du texte, à appliquer' : ''].filter(Boolean).join(' · ');
    events.push({ type: 'chat', key: `${key}-${chat.answerAt}`, title: `${chat.mode === 'subtasks' ? '🧩' : '💬'} Claude a répondu : ${chat.title}`, body: what || 'Sa réponse t’attend.', url: `/roadmap/v1?open=${id}&mode=${chat.mode === 'subtasks' ? 'subtasks' : 'chat'}` });
  }
  return events;
}

/** Watches the facts every `everyMs` and hands each event to `notify`; then lets held notifications go (`tick`). */
export function watchEvents({ registry, runsRegistry = registry, root, notifier, everyMs = 10_000, log = console }) {
  // The last facts seen are kept on disk: what happens while the dashboard is down is told when it comes back.
  const stateFile = join(registry, 'push', 'last-facts.json');
  let previous = readJson(stateFile);
  let busy = false;
  const step = async () => {
    if (busy) return;
    busy = true;
    try {
      const next = readFacts({ registry, runsRegistry, root });
      for (const event of diffFacts(previous, next)) await notifier.notify(event);
      previous = next;
      try {
        mkdirSync(join(registry, 'push'), { recursive: true });
        writeFileSync(`${stateFile}.tmp`, JSON.stringify(next));
        renameSync(`${stateFile}.tmp`, stateFile);
      } catch {}
      await notifier.tick();
    } catch (error) {
      log.error?.(`notify: ${error.message}`);
    } finally {
      busy = false;
    }
  };
  step();
  return setInterval(step, everyMs).unref();
}

export const hasDevices = (registry) => existsSync(join(registry, 'push', 'devices.json'));
