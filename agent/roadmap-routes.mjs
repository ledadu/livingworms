// The « Roadmap » page of the agents dashboard (/roadmap) and its API: reads the backlog of the main checkout (one
// task per ### heading, a status line under each, kept up to date by backlog.mjs), formerly docs/roadmap.md,
// shows its tasks with their status, and queues the chosen ones for the orchestrator (.git/agents/queue/), or launches
// them itself (« ▶ Lancer », launch.mjs). Plugged in dashboard.mjs by one line; everything else lives here, in
// roadmap.mjs and launch.mjs.
//
// Throwaway setups for testing: AGENTS_ROADMAP_ROOT (the checkout whose docs/roadmap.md, changes/ and docs/compte-rendu/
// are read), AGENTS_REGISTRY (registry, queue and snapshot folder), AGENTS_AGENT_SH (the script that creates and
// removes worktrees), AGENTS_WORKTREES (where the prompts say the worktrees are).
import { execFile, spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import {
  buildPrompt,
  diffSnapshots,
  enqueue,
  NAME_PATTERN,
  proposeName,
  readQueue,
  readSnapshot,
  readSources,
  refreshSnapshot,
  removeQueueEntry,
} from './roadmap.mjs';
import { parseBacklog, setTaskStatus, syncBacklog, taskVersion, withLabels, writeTask } from './backlog.mjs';
import { askAboutTask, clearChat, hasChat, markApplied, readChat } from './task-chat.mjs';
import { renameSync as renameFile } from 'node:fs';
import { launchTask, resumeTask, runDir, runLog, runLogFrom, runState, stopTask } from './launch.mjs';
import { project, renderPage } from '../config.mjs';
import { proposeSettings, readSettings, suggestEffort } from './settings.mjs';

const run = promisify(execFile);

export function roadmapRoutes({ mainRoot, registry: defaultRegistry, here }) {
  const root = process.env.AGENTS_ROADMAP_ROOT || mainRoot;
  const registry = process.env.AGENTS_REGISTRY || defaultRegistry;
  const agentScript = process.env.AGENTS_AGENT_SH || join(here, 'agent.sh');
  const worktrees = process.env.AGENTS_WORKTREES || join(dirname(mainRoot), `${basename(mainRoot)}.worktrees`);
  const roadmapFile = join(root, project.paths.backlog);
  const queueDir = join(registry, 'queue');
  const snapshotFile = join(registry, 'roadmap-snapshot.json');
  // The queue with the state of the runs started from the dashboard (running, done, error, stopped, lost).
  // Each with the agent's own effort and model as they are now (its card may have changed them since it was queued).
  const queueWithRuns = () =>
    readQueue(queueDir).map((entry) => {
      const withSettings = existsSync(join(registry, `${entry.name}.env`)) ? { ...entry, ...readSettings(registry, entry.name) } : entry;
      return entry.launchedBy === 'dashboard' ? { ...withSettings, run: runState(registry, entry.name) } : withSettings;
    });

  // Tracked files of the main checkout, to find the files a task cites by their bare name.
  let fileIndex = { at: 0, files: [] };
  async function files() {
    if (Date.now() - fileIndex.at > 60_000) {
      try {
        const { stdout } = await run('git', ['-C', root, 'ls-files'], { maxBuffer: 16 * 1024 * 1024 });
        fileIndex = { at: Date.now(), files: stdout.split('\n').filter(Boolean) };
      } catch {
        fileIndex = { at: Date.now(), files: [] };
      }
    }
    return fileIndex.files;
  }

  function current() {
    // The status lines follow the facts (queue, registry, changes/) before each read.
    try {
      syncBacklog({ file: roadmapFile, root, registry });
    } catch (error) {
      console.error(`backlog: ${error.message}`);
    }
    const markdown = readFileSync(roadmapFile, 'utf8');
    const sources = readSources({ root, registry });
    const items = withLabels(parseBacklog(markdown));
    const queue = readQueue(queueDir);
    const taken = new Set([...sources.agents.map((agent) => agent.name), ...queue.map((entry) => entry.name)]);
    for (const item of items) {
      if (item.kind === 'task') {
        item.version = taskVersion(item);
        const chat = hasChat(registry, item.id) ? readChat(registry, item.id) : null;
        item.chat = chat?.messages.length ? { count: chat.messages.length, pending: chat.pending } : null;
      }
      if (item.kind !== 'task' || item.status !== 'new') continue;
      item.proposedName = proposeName(item.title, taken);
      item.suggested = suggestEffort(item);
      taken.add(item.proposedName);
    }
    return { items, sources, queue };
  }

  function state(extra = {}) {
    const { items, sources, queue } = current();
    const snapshot = readSnapshot(snapshotFile);
    return {
      file: roadmapFile,
      modified: statSync(roadmapFile).mtimeMs,
      items,
      pending: diffSnapshots(snapshot, items),
      lastDiff: snapshot?.lastDiff ?? null,
      snapshotAt: snapshot?.takenAt ?? null,
      queue: queueWithRuns(),
      active: sources.agents.filter((agent) => !agent.archived).map((agent) => agent.name),
      ...extra,
    };
  }

  async function prompts(tasks) {
    const { items, sources } = current();
    const byId = new Map(items.map((item) => [item.id, item]));
    const chosen = tasks.filter((task) => byId.has(task.id)).map((task) => ({ ...byId.get(task.id), name: task.name, base: task.base || project.branches.integration }));
    const active = sources.agents.filter((agent) => !agent.archived).map((agent) => ({ name: agent.name }));
    const fileIndex = await files();
    const out = {};
    for (const task of chosen) {
      const neighbours = chosen.filter((other) => other.id !== task.id).map((other) => ({ name: other.name, title: other.title }));
      out[task.id] = buildPrompt(task, { items, neighbours, active, mainRoot, worktrees, teamSize: chosen.length, fileIndex, source: project.paths.backlog });
    }
    return { prompts: out, chosen };
  }

  function agentCommand(args) {
    return new Promise((resolve, reject) => {
      const child = spawn(agentScript, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', (chunk) => (output += chunk));
      child.stderr.on('data', (chunk) => (output += chunk));
      const timer = setTimeout(() => child.kill(), 300_000);
      child.on('error', reject);
      child.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(output);
        else reject(new Error(output || `agent.sh ${args.join(' ')} : code ${code}`));
      });
    });
  }

  const readBody = (request) =>
    new Promise((resolve) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch {
          resolve({});
        }
      });
    });

  // One request at a time may create worktrees.
  let queuing = Promise.resolve();

  /** Handles the request when it is one of the roadmap's; returns false otherwise. */
  return async function handleRoadmap(request, response, path) {
    const json = (value, status = 200) => {
      response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify(value));
    };
    const post = request.method === 'POST';
    if (path === '/roadmap') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderPage(readFileSync(join(here, 'roadmap.html'), 'utf8')));
      return true;
    }
    // The output of a run, rendered (run.html reads /api/queue/<name>/log?from=… and parses the stream-json).
    if (/^\/run\/[a-z0-9-]+$/.test(path)) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(renderPage(readFileSync(join(here, 'run.html'), 'utf8')));
      return true;
    }
    if (path === '/api/roadmap') return json(state()), true;

    // --- Editing a task, and talking it over with Claude (task-chat.mjs).
    const taskOf = (id) => parseBacklog(readFileSync(roadmapFile, 'utf8')).find((item) => item.kind === 'task' && item.id === id);
    const backlogTask = /^\/api\/backlog\/task\/([a-z0-9-]+)$/.exec(path);
    if (backlogTask) {
      const id = backlogTask[1];
      if (!post) {
        const task = taskOf(id);
        return json(task ? { ok: true, task: { id, title: task.title, section: task.section, text: task.text, version: taskVersion(task) }, chat: readChat(registry, id) } : { ok: false, error: `pas de chantier ${id}` }), true;
      }
      const { text, version } = await readBody(request);
      try {
        const task = writeTask({ file: roadmapFile, id, text, version });
        // A new title is a new id: the thread follows the task.
        if (task && task.id !== id && hasChat(registry, id) && !hasChat(registry, task.id)) renameFile(join(registry, 'chats', `${id}.json`), join(registry, 'chats', `${task.id}.json`));
        return json({ ok: true, id: task?.id ?? id, version: task ? taskVersion(task) : null, ...state() }), true;
      } catch (error) {
        return json({ ok: false, conflict: error.code === 409, error: error.message }), true;
      }
    }
    if (path === '/api/backlog/new' && post) {
      const { section, text } = await readBody(request);
      try {
        const task = writeTask({ file: roadmapFile, section, text });
        return json({ ok: true, id: task?.id, ...state() }), true;
      } catch (error) {
        return json({ ok: false, error: error.message }), true;
      }
    }
    const chatRoute = /^\/api\/backlog\/chat\/([a-z0-9-]+)(?:\/(apply|clear))?$/.exec(path);
    if (chatRoute) {
      const [, id, action] = chatRoute;
      if (!post) return json(readChat(registry, id)), true;
      const body = await readBody(request);
      try {
        if (action === 'clear') return json({ ok: true, chat: clearChat(registry, id) }), true;
        if (action === 'apply') {
          const chat = readChat(registry, id);
          const proposal = chat.messages[body.index]?.proposal;
          if (!proposal) return json({ ok: false, error: 'pas de proposition à ce message' }), true;
          const task = writeTask({ file: roadmapFile, id, text: proposal, version: body.version });
          let newId = task?.id ?? id;
          markApplied(registry, id, body.index);
          if (newId !== id && !hasChat(registry, newId)) renameFile(join(registry, 'chats', `${id}.json`), join(registry, 'chats', `${newId}.json`));
          else newId = hasChat(registry, newId) && newId !== id ? id : newId;
          return json({ ok: true, id: newId, version: task ? taskVersion(task) : null, chat: readChat(registry, newId), ...state() }), true;
        }
        const task = taskOf(id);
        if (!task) return json({ ok: false, error: `pas de chantier ${id}` }), true;
        return json({ ok: true, chat: askAboutTask({ registry, root, task, message: body.message }) }), true;
      } catch (error) {
        return json({ ok: false, conflict: error.code === 409, error: error.message }), true;
      }
    }
    if (path === '/api/roadmap/refresh' && post) {
      const { items } = current();
      const diff = refreshSnapshot(snapshotFile, items);
      return json(state({ refreshed: diff })), true;
    }
    if (path === '/api/roadmap/prompts' && post) {
      const { tasks = [] } = await readBody(request);
      return json((await prompts(tasks)).prompts), true;
    }
    if (path === '/api/roadmap/enqueue' && post) {
      const { tasks = [] } = await readBody(request);
      const job = queuing.then(async () => {
        const { prompts: generated, chosen } = await prompts(tasks);
        const edited = new Map(tasks.map((task) => [task.id, task.prompt]));
        const asked = new Map(tasks.map((task) => [task.id, task]));
        const ready = chosen.map((task) => ({ id: task.id, name: task.name, base: task.base, title: task.title, prompt: edited.get(task.id) || generated[task.id], effort: asked.get(task.id)?.effort, model: asked.get(task.id)?.model }));
        const results = await enqueue(ready, { queueDir, registry, createWorktree: (name, base) => agentCommand(['new', name, base]) });
        // The task now names its agent in the backlog: « > 🟣 en file · agent <name> ».
        for (const task of ready) {
          const result = results.find?.((one) => one.name === task.name);
          if (result && result.ok === false) continue;
          const item = chosen.find((one) => one.id === task.id);
          setTaskStatus({ file: roadmapFile, id: task.id, state: 'queued', agents: [...(item?.agents ?? []), task.name] });
        }
        return results;
      });
      queuing = job.catch(() => {});
      return json({ results: await job, queue: queueWithRuns() }), true;
    }
    // « ✨ Proposer » : Claude proposes an effort and a model for each chosen task (settings.mjs, one call, no tools).
    if (path === '/api/roadmap/propose' && post) {
      const { ids = [] } = await readBody(request);
      const tasks = current().items.filter((item) => item.kind === 'task' && ids.includes(item.id)).map((item) => ({ id: item.id, text: item.text }));
      try {
        return json({ ok: true, proposals: await proposeSettings({ tasks, root }) }), true;
      } catch (error) {
        return json({ ok: false, error: error.message }), true;
      }
    }
    if (path === '/api/queue') return json(queueWithRuns()), true;
    // Launches the claude CLI on one queued task, or on all of them (launch.mjs); a task already launched is refused.
    if (path === '/api/queue/launch-all' && post) {
      const results = readQueue(queueDir)
        .filter((entry) => entry.status === 'queued')
        .map((entry) => {
          try {
            launchTask({ registry, queueDir, name: entry.name });
            return { name: entry.name, ok: true };
          } catch (error) {
            return { name: entry.name, ok: false, error: error.message };
          }
        });
      return json({ ok: results.every((one) => one.ok), results, queue: queueWithRuns() }), true;
    }
    const runAction = /^\/api\/queue\/([a-z0-9-]+)\/(launch|stop|resume|log|prompt)$/.exec(path);
    if (runAction && NAME_PATTERN.test(runAction[1])) {
      const [, name, action] = runAction;
      if (action === 'prompt') {
        const file = join(runDir(registry, name), 'prompt.md');
        response.writeHead(existsSync(file) ? 200 : 404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        response.end(existsSync(file) ? readFileSync(file, 'utf8') : '');
        return true;
      }
      if (action === 'log') {
        const from = new URL(request.url ?? '/', 'http://localhost').searchParams.get('from');
        if (from !== null) {
          const { text, next } = runLogFrom(registry, name, Number(from) || 0);
          response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-log-next': String(next) });
          response.end(text);
          return true;
        }
        response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        response.end(runLog(registry, name));
        return true;
      }
      if (!post) return false;
      try {
        const { message: note = '' } = action === 'resume' ? await readBody(request).catch(() => ({})) : {};
        const run = action === 'launch' ? launchTask({ registry, queueDir, name })
          : action === 'resume' ? resumeTask({ registry, name, message: note })
          : stopTask({ registry, name });
        const message = action === 'launch' ? `${name} lancée (pid ${run.pid}).` : action === 'resume' ? `${name} relancée (pid ${run.pid}), même session.` : `${name} arrêtée.`;
        return json({ ok: true, message, run, queue: queueWithRuns() }), true;
      } catch (error) {
        return json({ ok: false, error: error.message }), true;
      }
    }
    // Cancels a queued task (and removes its worktree when asked), or forgets a launched or finished one.
    const cancel = /^\/api\/queue\/([a-z0-9-]+)\/(cancel|forget)$/.exec(path);
    if (cancel && post) {
      const [, name, action] = cancel;
      const entry = readQueue(queueDir).find((one) => one.name === name);
      if (!entry || !NAME_PATTERN.test(name)) return json({ ok: false, error: `pas de tâche ${name} dans la file` }), true;
      if (action === 'cancel' && entry.status !== 'queued') return json({ ok: false, error: entry.launchedBy === 'dashboard' ? 'déjà lancée depuis le tableau de bord' : 'déjà lancée : l’orchestrateur l’a prise' }), true;
      if (runState(registry, name)?.state === 'running') return json({ ok: false, error: 'l’agent tourne encore : arrête-le d’abord' }), true;
      removeQueueEntry(queueDir, name);
      // A cancelled task is to do again, unless another agent works on it.
      if (action === 'cancel' && entry.id) {
        const task = parseBacklog(readFileSync(roadmapFile, 'utf8')).find((item) => item.kind === 'task' && item.id === entry.id);
        const others = (task?.agents ?? []).filter((agent) => agent !== name);
        if (task) setTaskStatus({ file: roadmapFile, id: entry.id, state: others.length ? task.state : 'todo', agents: others, generation: task.generation });
      }
      let message = action === 'cancel' ? 'Tâche annulée.' : 'Retirée de la liste.';
      if (new URL(request.url ?? '/', 'http://localhost').searchParams.get('worktree') === '1' && existsSync(join(registry, `${name}.env`))) {
        try {
          await agentCommand(['rm', name]);
          message += ' Worktree retiré (la branche reste).';
        } catch (error) {
          return json({ ok: false, error: `entrée retirée, mais pas le worktree : ${String(error.message).trim().split('\n').pop()}` }), true;
        }
      }
      return json({ ok: true, message, queue: queueWithRuns() }), true;
    }
    return false;
  };
}
