// Cleans up the agents that are over: their worktree (agent.sh rm: servers stopped, ports and database freed, registry
// entry gone), their branch (git branch -d, merged), their claude run folder and their queue entry. What is kept: the
// entries in changes/ (history and « À publier »), the backlog lines, and every agent still under way.
//
// An agent is cleaned only when all of these hold: archived (accepted, or rebased and archived), not a release test
// server, no claude process running, no uncommitted file in its worktree, and its branch merged into the base branch.
// Called by publish (the agents of a published generation), by the dashboard (« 🧹 Nettoyer les terminés ») and by
// `make agent-clean` (DRY=1 to only list).
//
//   node agent/clean.mjs [--dry-run] [--base <integration branch>] [name…]
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runState } from './launch.mjs';
import { readQueue, removeQueueEntry } from './roadmap.mjs';
import { project } from '../config.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
const gitOk = (cwd, ...args) => {
  try {
    git(cwd, ...args);
    return true;
  } catch {
    return false;
  }
};

function readEnv(file) {
  const env = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

export function defaultPaths() {
  const common = resolve(here, git(here, 'rev-parse', '--git-common-dir'));
  return { mainRoot: dirname(common), registry: process.env.AGENTS_REGISTRY || join(common, 'agents') };
}

/** Every agent of the registry with whether it can be cleaned, and why not. `names` limits the list. */
export function cleanCandidates({ mainRoot, registry, base = project.branches.integration, names = null }) {
  let files = [];
  try {
    files = readdirSync(registry).filter((file) => file.endsWith('.env'));
  } catch {}
  const out = [];
  for (const file of files) {
    const name = file.slice(0, -4);
    if (names && !names.includes(name)) continue;
    const env = readEnv(join(registry, file));
    const branch = env.AGENT_BRANCH || `agent/${name}`;
    const reasons = [];
    if (env.AGENT_KIND === 'release') reasons.push('serveur de test d’une version');
    if (!env.AGENT_ARCHIVED) reasons.push('pas archivé (pas encore accepté)');
    if (runState(registry, name)?.state === 'running') reasons.push('claude tourne encore');
    const exists = Boolean(env.AGENT_DIR) && existsSync(env.AGENT_DIR);
    if (exists && gitOk(env.AGENT_DIR, 'rev-parse') && git(env.AGENT_DIR, 'status', '--porcelain')) reasons.push('fichiers non commités');
    const hasBranch = gitOk(mainRoot, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`);
    if (hasBranch && !gitOk(mainRoot, 'merge-base', '--is-ancestor', branch, base)) reasons.push(`pas fusionné dans ${base}`);
    out.push({ name, branch: hasBranch ? branch : null, dir: exists ? env.AGENT_DIR : null, ok: reasons.length === 0, reasons });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Cleans the cleanable agents (all, or those named): worktree, branch, run folder, queue entry. Returns what was done
 * and what was skipped. `agentSh` and `runsRegistry` are for tests.
 */
export function cleanAgents({ mainRoot, registry, base = project.branches.integration, names = null, dryRun = false, agentSh = process.env.AGENTS_AGENT_SH || join(here, 'agent.sh') }) {
  const candidates = cleanCandidates({ mainRoot, registry, base, names });
  const cleaned = [];
  const skipped = candidates.filter((one) => !one.ok);
  const errors = [];
  for (const agent of candidates.filter((one) => one.ok)) {
    if (dryRun) {
      cleaned.push(agent);
      continue;
    }
    try {
      execFileSync(agentSh, ['rm', agent.name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
      if (agent.branch) git(mainRoot, 'branch', '-d', agent.branch);
      rmSync(join(registry, 'runs', agent.name), { recursive: true, force: true });
      rmSync(join(registry, `${agent.name}.accept.log`), { force: true });
      const queueDir = join(registry, 'queue');
      if (readQueue(queueDir).some((entry) => entry.name === agent.name)) removeQueueEntry(queueDir, agent.name);
      cleaned.push(agent);
    } catch (error) {
      errors.push({ name: agent.name, error: String(error.stderr || error.message).trim().split('\n').pop() });
    }
  }
  return { cleaned, skipped, errors };
}

/** Branches agent/* left without an agent (their worktree removed before), merged into the base: deleted too. */
export function orphanBranches({ mainRoot, registry, base = project.branches.integration }) {
  const known = new Set(existsSync(registry) ? readdirSync(registry).filter((f) => f.endsWith('.env')).map((f) => readEnv(join(registry, f)).AGENT_BRANCH) : []);
  const branches = git(mainRoot, 'branch', '--format=%(refname:short)', '--list', 'agent/*').split('\n').filter(Boolean);
  return branches.filter((branch) => !known.has(branch) && gitOk(mainRoot, 'merge-base', '--is-ancestor', branch, base));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const baseAt = args.indexOf('--base');
  const base = baseAt >= 0 ? args[baseAt + 1] : project.branches.integration;
  const names = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--base');
  const { mainRoot, registry } = defaultPaths();
  const { cleaned, skipped, errors } = cleanAgents({ mainRoot, registry, base, names: names.length ? names : null, dryRun });
  const orphans = orphanBranches({ mainRoot, registry, base });
  if (!dryRun) for (const branch of orphans) git(mainRoot, 'branch', '-d', branch);
  console.log(`${dryRun ? 'À nettoyer' : 'Nettoyés'} (${cleaned.length}) : ${cleaned.map((one) => one.name).join(', ') || 'aucun'}`);
  if (orphans.length) console.log(`Branches orphelines fusionnées ${dryRun ? 'à supprimer' : 'supprimées'} : ${orphans.join(', ')}`);
  for (const one of skipped) console.log(`  gardé ${one.name} : ${one.reasons.join(', ')}`);
  for (const one of errors) console.error(`  ✖ ${one.name} : ${one.error}`);
  if (errors.length) process.exit(1);
}
