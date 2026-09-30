// A snapshot of the dashboard for its mirror on claude.ai (mirror.html, a private Artifact page), readable from a
// phone where the dashboard itself is out of reach. It asks the dashboard running on this machine (a local request:
// no token) and writes one compact JSON document: the agents and what they do now, the questions waiting for the
// user, the queue and the backlog, the releases, and what the page needs to act (ids, proposed names, the efforts
// and models; the page's actions come back through mirror-act.mjs, whose results the snapshot carries too). Claude
// then sends the file as it is to the page's database (the ArtifactData tool, `set` with `file_path`, document
// mirror/state), so the snapshot never goes through a conversation.
//
//   node agent/mirror.mjs [out.json] [--port 7800]   default out: <registry>/mirror.json; prints its path and size
//
// Nothing here writes to the dashboard. Prompts, logs, reports and paths stay out of the snapshot.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EFFORTS, project } from '../config.mjs';

const ACTIVE_MS = 5 * 60 * 1000;
const cut = (text, max) => {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

/** An agent's state as its card shows it: working, calm, done, error, stopped, lost or archived. */
export function agentStatus(agent, now) {
  if (agent.AGENT_ARCHIVED) return 'archived';
  const run = agent.run?.state;
  if (run === 'running') return 'working';
  if (run === 'error' || run === 'lost' || run === 'stopped') return run === 'error' ? 'error' : run;
  const steps = agent.progress ?? {};
  const lastMove = Math.max(agent.activity || 0, steps.updated || 0);
  const recent = lastMove > 0 && now - lastMove < ACTIVE_MS;
  if (steps.finished || (agent.report && (agent.dirty?.length ?? 0) === 0 && !recent)) return 'done';
  return recent ? 'working' : 'calm';
}

/** The snapshot, from the answers of the dashboard's API (pure: tested with made-up answers). */
export function buildSnapshot({ agents = {}, questions = {}, roadmap = {}, versions = {}, hub = {}, actions = [] }, now = Date.now()) {
  const list = (agents.agents ?? []).map((agent) => {
    const events = agent.progress?.events ?? [];
    const last = events[events.length - 1];
    return {
      name: agent.AGENT_NAME,
      branch: agent.AGENT_BRANCH ?? null,
      status: agentStatus(agent, now),
      goal: cut(agent.goal?.title, 160) || null,
      where: cut(agent.goal?.where, 120) || null,
      task: last ? cut(last.text, 280) : null,
      events: events.slice(-6).map((event) => ({ time: event.time ?? null, kind: event.kind, text: cut(event.text, 200) })),
      effort: agent.settings?.effort ?? null,
      model: agent.settings?.model ?? null,
      run: agent.run ? { state: agent.run.state, code: agent.run.code ?? null } : null,
      commits: agent.commits?.length ?? 0,
      lastCommit: agent.commits?.[0] ? cut(agent.commits[0].subject, 140) : null,
      dirty: agent.dirty?.length ?? 0,
      diffstat: agent.diffstat || null,
      activity: agent.activity || null,
      deliverables: agent.deliverables
        ? { report: Boolean(agent.deliverables.report), entry: Boolean(agent.deliverables.entry), captures: agent.deliverables.captures ?? 0, behind: agent.deliverables.behind ?? null, base: agent.deliverables.base ?? null }
        : null,
    };
  });
  const order = { working: 0, error: 1, lost: 1, stopped: 2, calm: 3, done: 4, archived: 5 };
  list.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.name).localeCompare(String(b.name)));

  const waiting = (questions.questions ?? []).filter((question) => question.status === 'pending');
  const items = (roadmap.items ?? []).filter((item) => item.kind === 'task');
  const count = (status) => items.filter((item) => item.status === status).length;
  const released = versions.released ?? [];

  const sections = (roadmap.items ?? []).filter((item) => item.kind === 'section' && item.title !== project.paths.delivered).map((item) => cut(item.title, 120));

  return {
    version: 2,
    project: project.name,
    word: project.release.word,
    takenAt: new Date(now).toISOString(),
    // What the page's controls offer (mirror-act.mjs checks them again).
    options: { efforts: EFFORTS, models: project.models ?? [], integration: project.branches.integration, main: project.branches.main },
    // The last actions asked from the page, newest first: the page matches its requests by id.
    actions: actions.slice(-8).reverse().map((one) => ({ id: one.id, label: cut(one.label, 120), ok: Boolean(one.ok), message: cut(one.message, 300), at: one.at ?? null })),
    summary: {
      working: list.filter((agent) => agent.status === 'working').length,
      agents: list.filter((agent) => agent.status !== 'archived').length,
      questions: waiting.filter((question) => question.type !== 'feedback').length,
      unread: questions.unread ?? 0,
      queued: (roadmap.queue ?? []).filter((entry) => entry.status === 'queued').length,
      pending: (versions.pending ?? []).length,
      integration: hub.summary?.backlog ? { sha: hub.summary.backlog.sha, subject: cut(hub.summary.backlog.subject, 120), time: hub.summary.backlog.time, ahead: hub.summary.backlog.ahead } : null,
      figures: (hub.summary?.figures ?? []).map((figure) => ({ icon: figure.icon ?? '', value: figure.value, text: cut(figure.text, 60) })),
    },
    agents: list,
    questions: {
      autonomous: questions.settings?.autonomous ?? null,
      waiting: waiting.map((question) => ({
        id: question.id,
        agent: question.agent,
        type: question.type,
        title: cut(question.title, 200),
        context: cut(question.context, 600),
        impact: cut(question.impact, 300) || null,
        severity: question.severity ?? null,
        options: (question.options ?? []).map((option) => ({ label: cut(option.label ?? option, 160), why: cut(option.description ?? option.why, 200) || null, recommended: Boolean(option.recommended) })),
        createdAt: question.createdAt ?? null,
      })),
    },
    queue: (roadmap.queue ?? []).map((entry) => ({
      name: entry.name,
      id: entry.id ?? null,
      title: cut(entry.title, 160),
      status: entry.status,
      run: entry.run?.state ?? null,
      effort: entry.effort ?? null,
      model: entry.model ?? null,
      createdAt: entry.createdAt ?? null,
    })),
    backlog: {
      counts: { todo: count('new'), active: count('active'), merged: count('archived'), done: count('done'), paused: count('paused') },
      active: items.filter((item) => item.status === 'active' || item.status === 'archived').map((item) => ({ id: item.id ?? null, title: cut(item.title, 140), label: item.label, agent: item.agent ?? null })),
      todo: items.filter((item) => item.status === 'new').slice(0, 60).map((item) => ({ id: item.id ?? null, title: cut(item.title, 140), section: item.section, name: item.proposedName ?? null, effort: item.suggested?.effort ?? null })),
      sections,
    },
    versions: {
      current: versions.current ?? null,
      proposal: versions.proposal ?? null,
      pending: (versions.pending ?? []).map((entry) => ({ slug: entry.slug, type: entry.type ?? null, title: cut(entry.title ?? entry.slug, 140) })),
      planned: (versions.planned ?? []).map((planned) => ({ version: planned.version, name: planned.generation ?? null, title: cut(planned.title, 140) || null, entries: (planned.entries ?? []).map((entry) => cut(entry.title ?? entry.slug ?? entry, 120)) })),
      released: released.slice(0, 3).map((release) => ({ version: release.version, name: release.generation ?? null, date: release.date ?? null, title: cut(release.title, 140) || null, entries: release.entries?.length ?? 0 })),
    },
  };
}

/** Where the agents' registry lives (.git/agents of the main checkout), from this folder or a worktree's. */
export function registryDir() {
  const here = dirname(fileURLToPath(import.meta.url));
  const common = execFileSync('git', ['-C', here, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim();
  return join(resolve(here, common), 'agents');
}

/** The results of the page's last actions (mirror-act.mjs), oldest first. */
export function readActions(file = join(registryDir(), 'mirror-actions.json')) {
  try {
    const list = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Asks the dashboard running on `port` and writes the snapshot to `out`; throws when the dashboard does not answer. */
export async function takeSnapshot({ port = 7800, out = join(registryDir(), 'mirror.json') } = {}) {
  const get = async (path) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    if (!response.ok) throw new Error(`${path} : ${response.status}`);
    return response.json();
  };
  let answers;
  try {
    const [agents, questions, roadmap, versions, hub] = await Promise.all(['/api/agents', '/api/questions', '/api/roadmap', '/api/versions', '/api/hub?state=1'].map(get));
    answers = { agents, questions, roadmap, versions, hub, actions: readActions() };
  } catch (error) {
    throw new Error(`le tableau de bord ne répond pas sur ${port} (${error.message}) ; make agent-dashboard`);
  }
  const text = JSON.stringify(buildSnapshot(answers));
  writeFileSync(out, text);
  return { out, size: text.length };
}

async function main() {
  const args = process.argv.slice(2);
  const portAt = args.indexOf('--port');
  const port = portAt >= 0 ? Number(args[portAt + 1]) : 7800;
  const target = args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--port');
  try {
    const { out, size } = await takeSnapshot({ port, ...(target ? { out: resolve(target) } : {}) });
    console.log(`${out} ${Math.round(size / 1024)} Kio`);
  } catch (error) {
    console.error(`mirror: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
