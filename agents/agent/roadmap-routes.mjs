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
import { STATES, depthOf, dueAuto, foldedSubtasks, parseBacklog, setTaskStatus, subtasksOf, syncBacklog, taskVersion, withLabels, writeAfter, writeAuto, writeTask } from './backlog.mjs';
import { askAboutTask, chatKey, clearChat, hasChat, markApplied, markCreated, readChat } from './task-chat.mjs';
import { renameSync as renameFile } from 'node:fs';
import { launchTask, resumeTask, runDir, runLog, runLogFrom, runState, stopTask } from './launch.mjs';
import { EFFORTS, project, renderPage } from '../config.mjs';
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
        item.depth = depthOf(items, item);
        item.subtaskCount = subtasksOf(items, item.id).length;
        const chat = hasChat(registry, item.id) ? readChat(registry, item.id) : null;
        item.chat = chat?.messages.length ? { count: chat.messages.length, pending: chat.pending } : null;
        const subChat = hasChat(registry, chatKey(item.id, 'subtasks')) ? readChat(registry, chatKey(item.id, 'subtasks')) : null;
        item.subChat = subChat?.messages.length ? { count: subChat.messages.length, pending: subChat.pending } : null;
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
    // A sub-task chosen with its parent (or an ancestor) goes with it: the parent's agent does it after (an « auto »
    // one has its own agent, launched once the parent is merged).
    const ids = new Set(tasks.map((task) => task.id));
    const folded = (id) => {
      for (let item = byId.get(id), up = byId.get(item?.after); up; item = up, up = byId.get(up.after)) {
        if (item.auto) return false;
        if (ids.has(up.id)) return true;
      }
      return false;
    };
    const chosen = tasks.filter((task) => byId.has(task.id) && !folded(task.id)).map((task) => ({
      ...byId.get(task.id),
      name: task.name,
      base: task.base || project.branches.integration,
      subtasks: foldedSubtasks(items, task.id),
    }));
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

  // Queues tasks ({ id, name, base, prompt?, effort?, model? }): their worktrees, queue entries and status lines. One
  // call at a time may create worktrees.
  function enqueueTasks(tasks) {
    const job = queuing.then(async () => {
      const { prompts: generated, chosen: all } = await prompts(tasks);
      // A sub-task waits for its parent: it goes with the parent's agent, or alone once the parent is merged.
      const byId = new Map(current().items.map((item) => [item.id, item]));
      const refused = [];
      const chosen = all.filter((task) => {
        const parent = byId.get(task.after);
        if (!parent || parent.state === 'merged' || parent.state === 'done') return true;
        refused.push({ name: task.name, ok: false, error: `sous-tâche de « ${parent.title} » (${STATES[parent.state]?.label ?? parent.state}) : elle part avec sa tâche mère (coche-la), ou seule une fois celle-ci fusionnée` });
        return false;
      });
      const edited = new Map(tasks.map((task) => [task.id, task.prompt]));
      const asked = new Map(tasks.map((task) => [task.id, task]));
      const ready = chosen.map((task) => ({ id: task.id, name: task.name, base: task.base, title: task.title, prompt: edited.get(task.id) || generated[task.id], effort: asked.get(task.id)?.effort, model: asked.get(task.id)?.model }));
      const results = [...refused, ...(await enqueue(ready, { queueDir, registry, createWorktree: (name, base) => agentCommand(['new', name, base]) }))];
      // The task now names its agent in the backlog: « > 🟣 en file · agent <name> ».
      for (const task of ready) {
        const result = results.find?.((one) => one.name === task.name);
        if (result && result.ok === false) continue;
        const item = chosen.find((one) => one.id === task.id);
        setTaskStatus({ file: roadmapFile, id: task.id, state: 'queued', agents: [...(item?.agents ?? []), task.name] });
        for (const sub of item?.subtasks ?? []) setTaskStatus({ file: roadmapFile, id: sub.id, state: 'queued', agents: [...sub.agents, task.name] });
      }
      return results;
    });
    queuing = job.catch(() => {});
    return job;
  }

  // « ↳ … · auto » : a sub-task launched by itself, by its own agent, once its parent is merged (checked every 20 s).
  let autoBusy = false;
  async function autoLaunch() {
    if (autoBusy) return;
    autoBusy = true;
    try {
      const { items, queue } = current();
      const queued = new Set(queue.filter((entry) => entry.status !== 'cancelled').map((entry) => entry.id));
      for (const task of dueAuto(items, queued)) {
        const name = task.proposedName ?? proposeName(task.title);
        const results = await enqueueTasks([{ id: task.id, name, base: project.branches.integration, effort: task.auto.effort ?? undefined, model: task.auto.model ?? undefined }]);
        const result = results.find((one) => one.name === name);
        if (result?.ok === false) {
          console.error(`auto ${task.id}: ${result.error}`);
          continue;
        }
        try {
          launchTask({ registry, queueDir, name });
          console.log(`auto: ${name} lancée (${task.title}), sa tâche mère est fusionnée`);
        } catch (error) {
          console.error(`auto ${name}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`auto: ${error.message}`);
    } finally {
      autoBusy = false;
    }
  }
  if (!process.env.AGENTS_NO_AUTO) setInterval(autoLaunch, 20_000).unref();

  /** Handles the request when it is one of the roadmap's; returns false otherwise. */
  return async function handleRoadmap(request, response, path) {
    const json = (value, status = 200) => {
      response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify(value));
    };
    const post = request.method === 'POST';
    // The Backlog page (roadmap-v2.html); the old one stays on /roadmap/v1 for editing and the chats, for now.
    if (path === '/roadmap/v2') {
      response.writeHead(302, { location: '/roadmap' });
      response.end();
      return true;
    }
    if (path === '/roadmap/v1') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderPage(readFileSync(join(here, 'roadmap.html'), 'utf8')));
      return true;
    }
    if (path === '/roadmap') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(renderPage(readFileSync(join(here, 'roadmap-v2.html'), 'utf8')));
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
    // Drag and drop on the Backlog page: a task becomes the sub-task of another ({ after: id }), or no more ({ after: null }).
    const afterRoute = /^\/api\/backlog\/after\/([a-z0-9-]+)$/.exec(path);
    if (afterRoute && post) {
      const { after = null } = await readBody(request);
      try {
        writeAfter({ file: roadmapFile, id: afterRoute[1], after });
        return json(state({ ok: true })), true;
      } catch (error) {
        return json({ ok: false, error: error.message }, error.code ?? 400), true;
      }
    }
    // « ⚡ auto » on a sub-task: { auto: true, effort, model } or { auto: false }.
    const autoRoute = /^\/api\/backlog\/auto\/([a-z0-9-]+)$/.exec(path);
    if (autoRoute && post) {
      const { auto = false, effort = null, model = null } = await readBody(request);
      try {
        writeAuto({ file: roadmapFile, id: autoRoute[1], auto: auto ? { effort, model } : null });
        if (auto) setTimeout(autoLaunch, 100);
        return json(state({ ok: true })), true;
      } catch (error) {
        return json({ ok: false, error: error.message }, error.code ?? 400), true;
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
    const chatRoute = /^\/api\/backlog\/chat\/([a-z0-9-]+)(?:\/(apply|clear|subtask))?$/.exec(path);
    if (chatRoute) {
      const [, id, action] = chatRoute;
      // ?mode=subtasks : the thread about the task's sub-tasks (🧩), else its own (💬).
      const mode = new URL(request.url ?? '/', 'http://localhost').searchParams.get('mode') === 'subtasks' ? 'subtasks' : 'task';
      const key = chatKey(id, mode);
      if (!post) return json(readChat(registry, key)), true;
      const body = await readBody(request);
      try {
        if (action === 'clear') return json({ ok: true, chat: clearChat(registry, key) }), true;
        if (action === 'apply') {
          const chat = readChat(registry, key);
          const proposal = chat.messages[body.index]?.proposal;
          if (!proposal) return json({ ok: false, error: 'pas de proposition à ce message' }), true;
          const task = writeTask({ file: roadmapFile, id, text: proposal, version: body.version });
          let newId = task?.id ?? id;
          markApplied(registry, key, body.index);
          // A new title is a new id: the threads follow the task.
          if (newId !== id) {
            for (const one of ['task', 'subtasks']) {
              const from = join(registry, 'chats', `${chatKey(id, one)}.json`);
              if (existsSync(from) && !hasChat(registry, chatKey(newId, one))) renameFile(from, join(registry, 'chats', `${chatKey(newId, one)}.json`));
            }
            if (!hasChat(registry, chatKey(newId, mode))) newId = id;
          }
          return json({ ok: true, id: newId, version: task ? taskVersion(task) : null, chat: readChat(registry, chatKey(newId, mode)), ...state() }), true;
        }
        if (action === 'subtask') {
          // « Créer la sous-tâche » : a ```sous-tache block of the thread becomes a task under this one.
          const chat = readChat(registry, key);
          const text = chat.messages[body.index]?.subtasks?.[body.sub];
          if (!text) return json({ ok: false, error: 'pas de sous-tâche à ce message' }), true;
          if (chat.messages[body.index].created?.[body.sub]) return json({ ok: false, error: 'sous-tâche déjà créée' }), true;
          const parent = taskOf(id);
          if (!parent) return json({ ok: false, error: `pas de chantier ${id}` }), true;
          const created = writeTask({ file: roadmapFile, section: parent.section, text });
          if (!created) return json({ ok: false, error: 'sous-tâche non créée' }), true;
          writeAfter({ file: roadmapFile, id: created.id, after: id });
          return json({ ok: true, created: created.id, chat: markCreated(registry, key, body.index, body.sub, created.id), ...state() }), true;
        }
        const task = taskOf(id);
        if (!task) return json({ ok: false, error: `pas de chantier ${id}` }), true;
        const items = withLabels(parseBacklog(readFileSync(roadmapFile, 'utf8')));
        const subtasks = subtasksOf(items, id).map((sub) => ({ title: sub.title, state: sub.state, label: sub.label, auto: Boolean(sub.auto) }));
        const effort = body.effort === undefined ? null : body.effort && EFFORTS.includes(body.effort) ? body.effort : '';
        return json({ ok: true, chat: askAboutTask({ registry, root, task, message: body.message, mode, subtasks, effort }) }), true;
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
      return json({ results: await enqueueTasks(tasks), queue: queueWithRuns() }), true;
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
