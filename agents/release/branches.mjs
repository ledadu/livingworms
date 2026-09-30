// The version branches: release/X.Y starts at the tag vX.Y.0 when that generation is published
// (publish.mjs); the fixes of a generation are committed there and published as X.Y.1, X.Y.2… from that branch, then
// reported to the integration branch. See docs/changes.md « Branches de version ».
//
//   node release/branches.mjs list                               every release/* and where it stands
//   node release/branches.mjs create <x.y.z>                     release/X.Y at the tag vX.Y.0
//   node release/branches.mjs publish <x.y> [x.y.z]              publishes the fixes of release/X.Y (TITLE, INTRO)
//   node release/branches.mjs integrate <x.y> <ref>              merges a fix branch into release/X.Y
//   node release/branches.mjs report <x.y> [sha…] [--no-advance] reports its fixes to backlog (cherry-pick -x)
//   node release/branches.mjs rebase <x.y> [onto] [--force]      replays release/X.Y on onto (default its tag)
//   node release/branches.mjs delete <x.y>                       deletes the branch (its commit is printed)
//
// Every change of a branch happens in a temporary worktree: never in the working tree of the main checkout, where the
// user edits files and runs the dev server. No push; the main and integration branches only ever move forward
// (fast-forward).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANGES_DIR, compareVersions, releaseName, loadChanges, parseFrontMatter, parseVersion, repoRoot, TYPE_BADGES, UNRELEASED, writeChangelog, writePlan } from './changes.mjs';
import { project } from '../config.mjs';
import { createReleaseBranch, publish } from './publish.mjs';

export const PREFIX = 'release/';
// The branch the fixes are reported to.
export const INTEGRATION = project.branches.integration;
export const MAIN = project.branches.main;

// --- Pure ------------------------------------------------------------------------------------------------------------

// The line X.Y of release/X.Y, X.Y, vX.Y.Z or X.Y.Z; null otherwise.
export function lineOf(text) {
  const match = /^(?:release\/)?v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(text ?? '').trim());
  return match ? `${Number(match[1])}.${Number(match[2])}` : null;
}

export const branchOfLine = (line) => `${PREFIX}${line}`;

// The published versions of a line, oldest first, from the tag names.
export function lineTags(tags, line) {
  return tags
    .map((tag) => /^v(\d+\.\d+\.\d+)$/.exec(tag.trim())?.[1])
    .filter((version) => version && lineOf(version) === line)
    .sort(compareVersions);
}

// The next fix of a line: X.Y.(latest + 1).
export function nextPatch(tags, line) {
  const patches = lineTags(tags, line).map((version) => parseVersion(version)[2]);
  return `${line}.${Math.max(0, ...patches) + 1}`;
}

// `git cherry -v <upstream> <branch>`: `+ sha subject` for a commit missing from upstream, `-` for one it has already.
export function parseCherry(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => /^([+-]) ([0-9a-f]{7,40}) ?(.*)$/.exec(line.trim()))
    .filter(Boolean)
    .map(([, sign, sha, subject]) => ({ sha, subject, applied: sign === '-' }));
}

// The version of a publication commit (publish.mjs: « release: <word> X.Y.Z », whatever the word was), or null.
export function releaseVersionOf(subject) {
  return /^release: \S+ (\d+\.\d+\.\d+)\b/.exec(String(subject ?? ''))?.[1] ?? null;
}

// The commits a log says were cherry-picked with -x.
export function pickedShas(log) {
  return [...String(log ?? '').matchAll(/\(cherry picked from commit ([0-9a-f]{7,40})\)/g)].map((match) => match[1]);
}

// --- git ---------------------------------------------------------------------------------------------------------------

function git(root, ...args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }).trim();
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim();
    throw Object.assign(new Error(detail || `git ${args[0]} a échoué`), { git: true });
  }
}

function gitTry(root, ...args) {
  try {
    return git(root, ...args);
  } catch {
    return null;
  }
}

const refExists = (root, ref) => gitTry(root, 'rev-parse', '-q', '--verify', `${ref}^{commit}`) !== null;
const isAncestor = (root, ancestor, ref) => gitTry(root, 'merge-base', '--is-ancestor', ancestor, ref) !== null;
const conflictFiles = (dir) => (gitTry(dir, 'diff', '--name-only', '--diff-filter=U') ?? '').split('\n').filter(Boolean);

// The worktrees of the repository and the branch each one has checked out.
export function worktrees(root) {
  const list = [];
  let current = null;
  for (const line of (gitTry(root, 'worktree', 'list', '--porcelain') ?? '').split('\n')) {
    if (line.startsWith('worktree ')) list.push((current = { path: line.slice(9), branch: null, head: null }));
    else if (current && line.startsWith('HEAD ')) current.head = line.slice(5);
    else if (current && line.startsWith('branch ')) current.branch = line.slice(7).replace(/^refs\/heads\//, '');
  }
  return list;
}

export const checkedOutAt = (root, branch) => worktrees(root).find((tree) => tree.branch === branch)?.path ?? null;

// Runs `work(dir)` in a temporary worktree on `branch` (or detached at `detach`), removed afterwards whatever happens.
export function withWorktree(root, { branch, detach }, work) {
  const dir = mkdtempSync(join(tmpdir(), 'agents-release-'));
  try {
    git(root, 'worktree', 'add', '-q', ...(detach ? ['--detach', dir, detach] : [dir, branch]));
    return work(dir);
  } finally {
    gitTry(root, 'worktree', 'remove', '--force', dir);
    rmSync(dir, { recursive: true, force: true });
    gitTry(root, 'worktree', 'prune');
  }
}

function requireBranch(root, line) {
  if (!line) throw new Error('ligne de version invalide : attendu X.Y (release/X.Y)');
  const branch = branchOfLine(line);
  if (!refExists(root, `refs/heads/${branch}`)) throw new Error(`pas de branche ${branch}`);
  return branch;
}

const tagsOf = (root) => (gitTry(root, 'tag', '--list', 'v*') ?? '').split('\n').filter(Boolean);

// The task folders of changes/unreleased at `ref` (none when the folder is absent).
function unreleasedAt(root, ref) {
  return (gitTry(root, 'ls-tree', '--name-only', `${ref}:${CHANGES_DIR}/${UNRELEASED}`) ?? '').split('\n').filter((name) => name && !name.includes('.'));
}

// The fixes to publish on a release branch: the entries added to changes/unreleased since the tag vX.Y.0 (those
// already there came from backlog and were not part of the generation), with their type and title.
export function patchEntries(root, branch, baseTag) {
  const before = new Set(baseTag ? unreleasedAt(root, baseTag) : []);
  return unreleasedAt(root, branch)
    .filter((slug) => !before.has(slug))
    .map((slug) => {
      const text = gitTry(root, 'show', `${branch}:${CHANGES_DIR}/${UNRELEASED}/${slug}/entry.md`);
      const data = text === null ? {} : parseFrontMatter(text).data;
      return { slug, type: data.type ?? null, title: data.title ?? null, badge: TYPE_BADGES[data.type] ?? null, missing: text === null };
    });
}

// --- Reading -----------------------------------------------------------------------------------------------------------

// One release/X.Y: its tags, where it stands against backlog and main, its fixes not reported yet, what to publish.
export function describeBranch(root, branch, { integration = INTEGRATION, main = MAIN, tags = tagsOf(root), trees = worktrees(root), picked } = {}) {
  const line = lineOf(branch);
  const versions = lineTags(tags, line);
  const baseTag = versions.includes(`${line}.0`) ? `v${line}.0` : null;
  const reachable = versions.filter((version) => isAncestor(root, `v${version}`, branch));
  const tag = reachable.length ? `v${reachable[reachable.length - 1]}` : null;
  const latest = versions.length ? `v${versions[versions.length - 1]}` : null;
  const against = (other) => {
    if (!refExists(root, other)) return null;
    const [behind, ahead] = (gitTry(root, 'rev-list', '--left-right', '--count', `${other}...${branch}`) ?? '0\t0').split(/\s+/).map(Number);
    return { ref: other, ahead, behind };
  };
  const [sha, short, time, subject] = (gitTry(root, 'log', '-1', '--format=%H%x1f%h%x1f%ct%x1f%s', branch) ?? '').split('\x1f');
  const hasIntegration = refExists(root, integration);
  const pickedSet = picked ?? new Set(pickedShas(hasIntegration ? gitTry(root, 'log', '--format=%B', '--grep=cherry picked from', integration) : ''));
  const carried = (version) => hasIntegration && gitTry(root, 'cat-file', '-e', `${integration}:${CHANGES_DIR}/v${version}/release.md`) !== null;
  const cherry = hasIntegration ? parseCherry(gitTry(root, 'cherry', '-v', integration, branch, ...(baseTag && isAncestor(root, baseTag, branch) ? [baseTag] : []))) : [];
  const fixes = cherry.map((commit) => {
    const release = releaseVersionOf(commit.subject);
    return { ...commit, short: commit.sha.slice(0, 7), release, reported: commit.applied || pickedSet.has(commit.sha) || Boolean(release && carried(release)) };
  });
  const entries = patchEntries(root, branch, baseTag);
  const next = nextPatch(tags, line);
  const problems = [];
  if (!entries.length) problems.push(`aucune correction à publier : ajoute une entrée « fixed » dans ${CHANGES_DIR}/${UNRELEASED}/ avec le correctif`);
  for (const entry of entries) {
    if (entry.missing) problems.push(`${entry.slug} : entry.md manquant`);
    else if (entry.type !== 'fixed') problems.push(`${entry.slug} est de type « ${entry.type} » : une branche de version ne publie que des corrections (fixed)`);
  }
  if (!baseTag) problems.push(`pas de tag v${line}.0 : la branche ne part pas d'une ${project.release.word} publiée`);
  const checkedOut = trees.find((tree) => tree.branch === branch)?.path ?? null;
  return {
    branch,
    line,
    generation: releaseName(`${line}.0`),
    baseTag,
    tag,
    latest,
    tags: versions.map((version) => `v${version}`),
    // Diverged: the branch no longer holds its generation, or a fix of its line was published elsewhere.
    diverged: !baseTag || !isAncestor(root, baseTag, branch),
    strayTag: latest && latest !== tag ? latest : null,
    exact: Boolean(tag && gitTry(root, 'rev-parse', `${tag}^{commit}`) === sha),
    unpublished: tag ? Number(gitTry(root, 'rev-list', '--count', `${tag}..${branch}`) ?? 0) : null,
    integration: against(integration),
    main: against(main),
    last: sha ? { sha, short, time: Number(time) * 1000, subject } : null,
    fixes,
    toReport: fixes.filter((fix) => !fix.reported).length,
    patch: { version: next, generation: releaseName(next), entries, problems },
    checkedOut,
  };
}

// Every release/* branch, by line, newest first.
export function listReleaseBranches(root, options = {}) {
  const integration = options.integration ?? INTEGRATION;
  const tags = tagsOf(root);
  const trees = worktrees(root);
  const picked = new Set(pickedShas(refExists(root, integration) ? gitTry(root, 'log', '--format=%B', '--grep=cherry picked from', integration) : ''));
  return (gitTry(root, 'for-each-ref', '--format=%(refname:short)', `refs/heads/${PREFIX}`) ?? '')
    .split('\n')
    .filter((branch) => lineOf(branch) && branch === branchOfLine(lineOf(branch)))
    .sort((a, b) => compareVersions(`${lineOf(b)}.0`, `${lineOf(a)}.0`))
    .map((branch) => describeBranch(root, branch, { ...options, integration, tags, trees, picked }));
}

// The generations X.Y.0 published with no release/X.Y branch yet.
export function missingBranches(root) {
  const branches = new Set((gitTry(root, 'for-each-ref', '--format=%(refname:short)', `refs/heads/${PREFIX}`) ?? '').split('\n'));
  return tagsOf(root)
    .map((tag) => /^v(\d+\.\d+)\.0$/.exec(tag)?.[1])
    .filter((line) => line && !branches.has(branchOfLine(line)))
    .sort((a, b) => compareVersions(`${b}.0`, `${a}.0`));
}

// --- Actions -------------------------------------------------------------------------------------------------------------

export function createBranch(root, version) {
  const line = lineOf(version);
  if (!line) throw new Error(`version invalide « ${version} »`);
  if (!refExists(root, `refs/tags/v${line}.0`)) throw new Error(`pas de tag v${line}.0 : publie d'abord la ${releaseName(`${line}.0`)}`);
  return createReleaseBranch(root, `${line}.0`);
}

// Publishes the fixes of release/X.Y as X.Y.Z (the next one by default), in a temporary worktree on that branch: the
// entries added since vX.Y.0 are frozen, committed on the branch and tagged. No push.
export function publishPatch(root, line, { version, title = '', intro = '', date, trailer = '' } = {}) {
  const branch = requireBranch(root, line);
  const where = checkedOutAt(root, branch);
  if (where) throw new Error(`${branch} est extraite dans ${where} : publie depuis ce dossier (make release VERSION=…) ou libère la branche`);
  const target = version || nextPatch(tagsOf(root), line);
  const parsed = parseVersion(target);
  if (!parsed || lineOf(target) !== line || parsed[2] === 0) throw new Error(`${target} n'est pas un correctif de la ${line} (attendu ${line}.Z, Z > 0)`);
  const state = describeBranch(root, branch);
  if (state.patch.problems.length) throw new Error(state.patch.problems.join('\n'));
  const result = withWorktree(root, { branch }, (dir) =>
    publish(dir, { version: target, slugs: state.patch.entries.map((entry) => entry.slug), title, intro, date, trailer, branch: false }),
  );
  return { ...result, branch };
}

// Brings a fix branch into release/X.Y (fast-forward when possible, else a merge commit), in a temporary worktree.
// Refused when `ref` holds commits of backlog that the version does not have: it was started from backlog.
export function integrate(root, line, ref, { integration = INTEGRATION, trailer = '' } = {}) {
  const branch = requireBranch(root, line);
  if (!/^[\w./-]+$/.test(ref ?? '') || !refExists(root, ref)) throw new Error(`référence inconnue « ${ref ?? ''} »`);
  const where = checkedOutAt(root, branch);
  if (where) throw new Error(`${branch} est extraite dans ${where} : fusionne depuis ce dossier`);
  const incoming = Number(gitTry(root, 'rev-list', '--count', `${branch}..${ref}`) ?? 0);
  if (!incoming) return { branch, merged: 0, message: `${ref} est déjà dans ${branch}` };
  if (refExists(root, integration)) {
    const fromIntegration = incoming - Number(gitTry(root, 'rev-list', '--count', `${branch}..${ref}`, '--not', integration) ?? 0);
    if (fromIntegration > 0) {
      throw new Error(`${ref} apporte ${fromIntegration} commit(s) de ${integration} absents de ${branch} : elle part de ${integration}. Rebase-la d'abord : git rebase --onto ${branch} ${integration} ${ref}`);
    }
  }
  withWorktree(root, { branch }, (dir) => {
    try {
      git(dir, 'merge', '--no-edit', '-q', '-m', `Merge ${ref} into ${branch}${trailer ? `\n\n${trailer}` : ''}`, ref);
    } catch (error) {
      const files = conflictFiles(dir);
      gitTry(dir, 'merge', '--abort');
      throw new Error(files.length ? `conflit, fusion annulée : ${files.join(', ')}` : error.message);
    }
  });
  return { branch, merged: incoming, message: `${ref} intégrée dans ${branch} (${incoming} commit(s))` };
}

// Carries a generation published on a release branch into the tree `dir`: its folder changes/vX.Y.Z, its entries taken
// out of changes/unreleased and of the plan, CHANGELOG.md regenerated; one commit.
function carryRelease(dir, sha, version, message) {
  git(dir, 'checkout', sha, '--', `${CHANGES_DIR}/v${version}`);
  const slugs = readdirSync(join(dir, 'changes', `v${version}`), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  for (const slug of slugs) if (existsSync(join(dir, CHANGES_DIR, UNRELEASED, slug))) git(dir, 'rm', '-r', '-q', '--', `${CHANGES_DIR}/${UNRELEASED}/${slug}`);
  const changes = loadChanges(dir);
  const plan = changes.plan.versions.map(({ problems, ...planned }) => planned);
  if (plan.some((planned) => planned.entries.some((slug) => slugs.includes(slug)))) {
    writePlan(dir, plan.map((planned) => ({ ...planned, entries: planned.entries.filter((slug) => !slugs.includes(slug)) })));
    git(dir, 'add', '-A', '--', `${CHANGES_DIR}/planned.json`);
  }
  writeChangelog(dir);
  git(dir, 'add', '--', project.paths.changelog);
  git(dir, 'commit', '-q', '-m', message);
}

// Reports fixes of release/X.Y to `onto` (backlog): the chosen commits (default: every one not reported yet), oldest
// first, cherry-picked with -x in a temporary worktree; a publication commit carries its generation (changes/vX.Y.Z and
// the changelog) instead. A conflict aborts everything and names the files. Then `onto` moves forward: its ref when no
// worktree has it, else a fast-forward merge there (refused by git if it would touch a file being edited); with
// `advance: false`, or when that fast-forward is refused, the result waits on a branch report/X.Y-<time>.
export function reportFixes(root, line, { shas, onto = INTEGRATION, advance = true, trailer = '' } = {}) {
  const branch = requireBranch(root, line);
  if (!/^[\w./-]+$/.test(onto) || !refExists(root, `refs/heads/${onto}`)) throw new Error(`branche inconnue « ${onto} »`);
  if (onto.startsWith(PREFIX)) throw new Error(`on reporte les correctifs vers ${INTEGRATION}, pas vers une autre branche de version`);
  const state = describeBranch(root, branch, { integration: onto });
  const chosen = shas?.length ? state.fixes.filter((fix) => shas.some((sha) => fix.sha.startsWith(sha))) : state.fixes.filter((fix) => !fix.reported);
  if (!chosen.length) throw new Error(`rien à reporter de ${branch} vers ${onto}`);
  const before = git(root, 'rev-parse', `refs/heads/${onto}`);
  const skipped = [];
  const after = withWorktree(root, { detach: before }, (dir) => {
    for (const fix of chosen) {
      if (fix.release) {
        carryRelease(dir, fix.sha, fix.release, `release: report de la ${releaseName(fix.release)} depuis ${branch}${trailer ? `\n\n${trailer}` : ''}`);
        continue;
      }
      try {
        git(dir, 'cherry-pick', '-x', fix.sha);
      } catch (error) {
        const files = conflictFiles(dir);
        if (!files.length && /empty/i.test(error.message)) {
          // Already in onto under another form.
          gitTry(dir, 'cherry-pick', '--skip');
          skipped.push(fix.short);
          continue;
        }
        gitTry(dir, 'cherry-pick', '--abort');
        throw new Error(files.length ? `conflit en reportant ${fix.short} « ${fix.subject} » : ${files.join(', ')}. Rien n'a été reporté.` : error.message);
      }
    }
    return git(dir, 'rev-parse', 'HEAD');
  });
  const reported = chosen.length - skipped.length;
  if (after === before) return { onto, reported: 0, skipped, message: `rien de nouveau : ${onto} a déjà ces correctifs` };
  const park = () => {
    const name = `report/${line}-${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')}`;
    git(root, 'branch', name, after);
    return name;
  };
  if (!advance) {
    const parked = park();
    return { onto, reported, skipped, parked, message: `${reported} correctif(s) prêts sur ${parked} : git merge --ff-only ${parked} depuis ${onto}` };
  }
  const where = checkedOutAt(root, onto);
  if (!where) {
    git(root, 'update-ref', `refs/heads/${onto}`, after, before);
    return { onto, reported, skipped, commit: after.slice(0, 7), message: `${reported} correctif(s) reporté(s) sur ${onto}` };
  }
  try {
    git(where, 'merge', '--ff-only', '-q', after);
  } catch (error) {
    const parked = park();
    return { onto, reported, skipped, parked, message: `${onto} n'a pas pu avancer dans ${where} (${error.message.split('\n')[0]}) : les correctifs attendent sur ${parked}` };
  }
  return { onto, reported, skipped, commit: after.slice(0, 7), message: `${reported} correctif(s) reporté(s) sur ${onto}` };
}

// Replays release/X.Y on `onto` (default: the latest tag of its line), in a temporary worktree. A conflict aborts the
// rebase and names the files. Refused when published fixes would be rewritten (their tags would stay on the old
// commits), unless `force`.
export function rebaseRelease(root, line, { onto, force = false } = {}) {
  const branch = requireBranch(root, line);
  const versions = lineTags(tagsOf(root), line);
  const base = onto || (versions.length ? `v${versions[versions.length - 1]}` : null);
  if (!base || !/^[\w./-]+$/.test(base) || !refExists(root, base)) throw new Error(`base inconnue « ${base ?? ''} »`);
  const where = checkedOutAt(root, branch);
  if (where) throw new Error(`${branch} est extraite dans ${where} : arrête ou supprime d'abord ce worktree`);
  const rewritten = versions.filter((version) => isAncestor(root, `v${version}`, branch) && !isAncestor(root, `v${version}`, base));
  if (rewritten.length && !force) {
    throw Object.assign(new Error(`le rebase réécrirait des correctifs publiés (${rewritten.map((v) => `v${v}`).join(', ')}) : leurs tags resteraient sur les anciens commits. Confirme pour forcer.`), { rewritten });
  }
  const before = git(root, 'rev-parse', branch);
  withWorktree(root, { branch }, (dir) => {
    try {
      git(dir, 'rebase', '-q', base);
    } catch (error) {
      const files = conflictFiles(dir);
      gitTry(dir, 'rebase', '--abort');
      throw new Error(files.length ? `conflit, rebase annulé : ${files.join(', ')}` : error.message);
    }
  });
  const after = git(root, 'rev-parse', branch);
  return { branch, before, after, changed: before !== after, message: before === after ? `${branch} est déjà sur ${base}` : `${branch} rebasée sur ${base} (ancien sommet ${before.slice(0, 7)})` };
}

export function deleteBranch(root, line) {
  const branch = requireBranch(root, line);
  const where = checkedOutAt(root, branch);
  if (where) throw new Error(`${branch} est extraite dans ${where} : supprime d'abord ce worktree (serveur de test)`);
  const sha = git(root, 'rev-parse', branch);
  git(root, 'branch', '-D', branch);
  return { branch, sha, message: `${branch} supprimée (elle pointait sur ${sha.slice(0, 7)} : git branch ${branch} ${sha.slice(0, 7)} pour la recréer)` };
}

// --- CLI -----------------------------------------------------------------------------------------------------------------

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.env.CHANGES_ROOT ? resolve(process.env.CHANGES_ROOT) : repoRoot;
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));
  const [command = 'list', first, ...rest] = args.filter((arg) => !arg.startsWith('--'));
  try {
    if (command === 'list') {
      const branches = listReleaseBranches(root);
      if (!branches.length) console.log('Aucune branche de version (release/X.Y).');
      for (const state of branches) {
        const vs = (side) => (side ? `${side.ref} +${side.ahead}/-${side.behind}` : '');
        console.log(`${state.branch}  ${state.tag ?? 'sans tag'}${state.diverged ? ' (divergée)' : ''}  ${vs(state.integration)}  ${vs(state.main)}  ${state.last?.short ?? ''} ${state.last?.subject ?? ''}`);
        for (const fix of state.fixes.filter((fix) => !fix.reported)) console.log(`  à reporter : ${fix.short} ${fix.subject}`);
        if (state.patch.entries.length) console.log(`  à publier en ${state.patch.version} : ${state.patch.entries.map((entry) => entry.slug).join(', ')}`);
      }
      for (const line of missingBranches(root)) console.log(`(v${line}.0 publiée sans branche : branches.mjs create ${line}.0)`);
    } else if (command === 'create') {
      const result = createBranch(root, first);
      console.log(result.created ? `✔ ${result.branch} créée` : `${result.branch} existe déjà`);
    } else if (command === 'publish') {
      const result = publishPatch(root, lineOf(first), { version: rest[0], title: process.env.TITLE ?? '', intro: process.env.INTRO ?? '' });
      console.log(`✔ ${releaseName(result.version)} publiée sur ${result.branch} : commit ${result.commit}, tag ${result.tag} (pas de push)`);
    } else if (command === 'integrate') {
      console.log(`✔ ${integrate(root, lineOf(first), rest[0]).message}`);
    } else if (command === 'report') {
      console.log(`✔ ${reportFixes(root, lineOf(first), { shas: rest, advance: !flags.has('--no-advance') }).message}`);
    } else if (command === 'rebase') {
      console.log(`✔ ${rebaseRelease(root, lineOf(first), { onto: rest[0], force: flags.has('--force') }).message}`);
    } else if (command === 'delete') {
      console.log(`✔ ${deleteBranch(root, lineOf(first)).message}`);
    } else {
      throw new Error(`commande inconnue « ${command} » (list, create, publish, integrate, report, rebase, delete)`);
    }
  } catch (error) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
}
