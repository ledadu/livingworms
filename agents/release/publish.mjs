// Publishes a release: freezes its entries (changes.mjs `release`: those assigned to it in changes/planned.json, or
// every unreleased entry when it is not planned), then commits only the paths it changed and tags the commit. Never
// `git add -A`: the working tree may hold other work in progress.
//
//   node release/publish.mjs [x.y.z] [--no-branch]   TITLE="…" INTRO="…" optional; used by `make release`
//
// A generation X.Y.0 also starts its version branch release/X.Y at its tag (not with --no-branch or NO_BRANCH=1): its
// fixes X.Y.Z are published from there (release/branches.mjs, docs/changes.md « Branches de version »).
//
// The agents' dashboard (« Publier la Version X.Y ») calls `publish` with the same checks.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isNightly, readPlan, redate, releaseName, loadChanges, parseVersion, release, repoRoot, selectRelease, writePlan } from './changes.mjs';
import { project } from '../config.mjs';

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitOk(root, ...args) {
  try {
    git(root, ...args);
    return true;
  } catch {
    return false;
  }
}

// Why the repository cannot take a release commit now, or null.
export function publishBlocker(root, version) {
  let gitDir;
  try {
    gitDir = resolve(root, git(root, 'rev-parse', '--git-dir'));
  } catch {
    return `${root} n'est pas un dépôt git`;
  }
  const busy = { MERGE_HEAD: 'une fusion', CHERRY_PICK_HEAD: 'un cherry-pick', REVERT_HEAD: 'un revert', 'rebase-merge': 'un rebase', 'rebase-apply': 'un rebase' };
  for (const [file, what] of Object.entries(busy)) {
    if (existsSync(join(gitDir, file))) return `${what} est en cours : termine-la ou annule-la d'abord`;
  }
  if (!gitOk(root, 'diff', '--cached', '--quiet')) return "l'index contient déjà des changements : commite-les ou retire-les (git restore --staged) d'abord";
  if (version && gitOk(root, 'rev-parse', '-q', '--verify', `refs/tags/v${version}`)) return `le tag v${version} existe déjà`;
  return null;
}

// Everything that stops a publication, for the dashboard: nothing to publish, an invalid entry among those published, a
// bad version, git. `slugs` limits the publication to these entries (default: the plan of `version`, or all).
export function publishProblems(root, version, { slugs, changes = loadChanges(root) } = {}) {
  const selection = selectRelease(changes, { version: version || undefined, slugs });
  const problems = [...selection.problems];
  const blocker = publishBlocker(root, selection.version);
  if (blocker) problems.push(blocker);
  return problems;
}

// The version branch of a generation: release/X.Y for X.Y.Z.
export function releaseBranchOf(version) {
  const parsed = parseVersion(version);
  return parsed ? `release/${parsed[0]}.${parsed[1]}` : null;
}

// Starts release/X.Y at the tag vX.Y.0, unless it exists. Only a ref is written: no working tree is touched.
export function createReleaseBranch(root, version) {
  const branch = releaseBranchOf(version);
  if (!branch) throw new Error(`version invalide « ${version} »`);
  if (gitOk(root, 'rev-parse', '-q', '--verify', `refs/heads/${branch}`)) return { branch, created: false };
  const [major, minor] = parseVersion(version);
  git(root, 'branch', branch, `v${major}.${minor}.0^{commit}`);
  return { branch, created: true };
}

// Freezes, commits `release: <word> X.Y.Z` (with `trailer` as its last lines) and tags vX.Y.Z. No push. A generation
// X.Y.0 then starts release/X.Y at its tag, unless `branch` is false.
export function publish(root = repoRoot, { version, slugs, title = '', intro = '', date, trailer = '', branch = true } = {}) {
  // A nightly planned on another day is published under today's date: the planned one is renamed first.
  if (version && isNightly(version)) {
    const dated = redate(loadChanges(root), version, date);
    if (dated !== version) {
      const plan = readPlan(root);
      const planned = plan.versions.find((one) => one.version === version);
      if (planned) writePlan(root, plan.versions.map((one) => (one === planned ? { ...one, version: dated } : one)));
      version = dated;
    }
  }
  const problems = publishProblems(root, version, { slugs });
  if (problems.length) throw new Error(problems.join('\n'));
  const frozen = release(root, version || undefined, { slugs, title, intro, ...(date ? { date } : {}) });
  const target = frozen.version;
  // A path gone from the disk is staged as a deletion only if git knew it.
  const paths = frozen.paths.filter((path) => existsSync(join(root, path)) || git(root, 'ls-files', '--', path));
  try {
    git(root, 'add', '--', ...paths);
    const message = `release: ${project.release.word} ${target}${frozen.title ? `\n\n${frozen.title}` : ''}${trailer ? `\n\n${trailer}` : ''}`;
    git(root, 'commit', '-q', '-m', message);
  } catch (error) {
    gitOk(root, 'reset', '-q', '--', ...paths);
    throw new Error(`${project.release.word} ${target} figée sur le disque mais pas commitée (${String(error.stderr || error.message).trim()}) : commite ${paths.join(' ')} à la main`);
  }
  git(root, 'tag', '-a', `v${target}`, '-m', releaseName(target));
  // Only a stable X.Y.0 starts its version branch (for its fixes); a nightly has none: the next nightly fixes it.
  const releaseBranch = branch && !isNightly(target) && parseVersion(target)[2] === 0 ? createReleaseBranch(root, target) : null;
  return { version: target, slugs: frozen.slugs, commit: git(root, 'rev-parse', '--short', 'HEAD'), tag: `v${target}`, paths, releaseBranch };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const noBranch = args.includes('--no-branch') || ['1', 'true', 'yes'].includes(String(process.env.NO_BRANCH ?? '').toLowerCase());
    const version = args.find((arg) => !arg.startsWith('--'));
    const result = publish(repoRoot, { version: version || undefined, title: process.env.TITLE ?? '', intro: process.env.INTRO ?? '', branch: !noBranch });
    const started = result.releaseBranch?.created ? `, branche ${result.releaseBranch.branch} créée` : '';
    console.log(`✔ ${releaseName(result.version)} publiée : commit ${result.commit}, tag ${result.tag}${started} (pas de push)`);
    // The agents of the release are over: their worktrees, branches and runs go (agent/clean.mjs).
    if (!['1', 'true', 'yes'].includes(String(process.env.NO_CLEAN ?? '').toLowerCase())) {
      try {
        const { cleanAgents, defaultPaths } = await import('../agent/clean.mjs');
        const done = cleanAgents({ ...defaultPaths(), names: result.slugs }).cleaned.map((one) => one.name);
        if (done.length) console.log(`✔ worktrees nettoyés : ${done.join(', ')}`);
      } catch (error) {
        console.error(`(nettoyage des worktrees non fait : ${error.message})`);
      }
    }
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
}
