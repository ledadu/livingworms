#!/usr/bin/env node
// The queue of tasks prepared on the « Roadmap » page of the dashboard, for the orchestrator (the main Claude Code
// session) to launch: .git/agents/queue/<name>.json { name, title, prompt, base, createdAt, status }.
//
//   node agent/queue.mjs wait [--timeout <s>]   blocks until an entry is « queued », prints those entries (JSON)
//                                                        and exits: run it in the background, its exit wakes you up
//   node agent/queue.mjs list [--json]           every entry and its status
//   node agent/queue.mjs mark <name> launched|done|cancelled
//
// « mark … launched » claims the task: it fails when the task is no longer queued, for instance launched meanwhile with
// the « ▶ Lancer » button of the dashboard (launch.mjs), which then runs it itself. Such a task never leaves `wait`.
//
// AGENTS_REGISTRY points at another registry (tests).
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claimQueue } from './launch.mjs';
import { markQueue, readQueue } from './roadmap.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function registry() {
  if (process.env.AGENTS_REGISTRY) return process.env.AGENTS_REGISTRY;
  const common = execFileSync('git', ['-C', here, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim();
  return join(resolve(here, common), 'agents');
}

const queueDir = join(registry(), 'queue');
const [command = 'list', ...args] = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

if (command === 'wait') {
  const timeout = Number(option('--timeout') ?? 0) * 1000;
  const started = Date.now();
  for (;;) {
    const queued = readQueue(queueDir).filter((entry) => entry.status === 'queued');
    if (queued.length) {
      console.log(JSON.stringify(queued, null, 2));
      process.exit(0);
    }
    if (timeout && Date.now() - started > timeout) {
      console.error('queue: nothing queued before the timeout');
      process.exit(2);
    }
    await new Promise((done) => setTimeout(done, 1000));
  }
} else if (command === 'list') {
  const entries = readQueue(queueDir);
  if (args.includes('--json')) console.log(JSON.stringify(entries, null, 2));
  else if (!entries.length) console.log('queue: empty');
  else for (const entry of entries) console.log(`${entry.status.padEnd(9)} ${entry.name.padEnd(24)} ${entry.base.padEnd(10)} ${entry.createdAt}  ${entry.title}`);
} else if (command === 'mark') {
  const [name, status] = args;
  try {
    const entry = status === 'launched' ? claimQueue(queueDir, name, { launchedBy: 'orchestrator' }) : markQueue(queueDir, name, status);
    console.log(`queue: ${entry.name} ${entry.status}`);
  } catch (error) {
    console.error(`queue: ${error.message}`);
    process.exit(1);
  }
} else {
  console.error('usage: queue.mjs wait [--timeout s] | list [--json] | mark <name> launched|done|cancelled');
  process.exit(2);
}
