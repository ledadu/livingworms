// « ⇪ Pousser sur GitHub » : sends the project's branches to its remote, never forced. What goes:
// - the integration branch (the work merged so far);
// - the main branch, at the last published version (its tag vX.Y.Z on the integration branch): the remote's main
//   moves forward to what the players have, never further, never back;
// - the version branches release/X.Y and the version tags vX.Y.Z.
// A ref whose remote copy is not an ancestor of the local one (someone pushed elsewhere) is skipped, and said so.
//
//   node release/push.mjs [--dry]      prints the plan, then pushes (not with --dry)
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { project } from '../config.mjs';
import { repoRoot } from './changes.mjs';

export const REMOTE = project.remote ?? 'origin';
const TAG = /^v\d+\.\d+\.\d+$/;

const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (root, ...args) => {
  try {
    return git(root, ...args);
  } catch {
    return null;
  }
};

/**
 * What to do with each ref (pure): { ref, local, remote, action } with action new, update, same or diverged.
 * `refs`: [{ ref: 'refs/heads/x', local: sha }]; `remote`: Map ref -> sha; `isAncestor(a, b)`: a is in b's history.
 */
export function planPush(refs, remote, isAncestor) {
  return refs.map(({ ref, local, label }) => {
    const there = remote.get(ref) ?? null;
    const action = !there ? 'new' : there === local ? 'same' : isAncestor(there, local) ? 'update' : 'diverged';
    return { ref, label: label ?? ref.replace(/^refs\/(heads|tags)\//, ''), local, remote: there, action };
  });
}

/** The newest version tag on the integration branch, or null. */
function lastRelease(root) {
  const tags = (tryGit(root, 'tag', '--merged', project.branches.integration, '--list', 'v*', '--sort=-v:refname') ?? '').split('\n').filter((tag) => TAG.test(tag));
  return tags[0] ?? null;
}

/** The plan against the remote as it is now (git ls-remote). */
export function pushPlan(root = repoRoot) {
  const { main, integration } = project.branches;
  const refs = [];
  const head = (branch) => tryGit(root, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}^{commit}`);
  if (head(integration)) refs.push({ ref: `refs/heads/${integration}`, local: head(integration) });
  const release = lastRelease(root);
  if (release) refs.push({ ref: `refs/heads/${main}`, local: git(root, 'rev-parse', `${release}^{commit}`), label: `${main} (à ${release})` });
  for (const branch of (tryGit(root, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/release/') ?? '').split('\n').filter(Boolean)) refs.push({ ref: `refs/heads/${branch}`, local: head(branch) });
  for (const tag of (tryGit(root, 'tag', '--list', 'v*') ?? '').split('\n').filter((one) => TAG.test(one))) refs.push({ ref: `refs/tags/${tag}`, local: git(root, 'rev-parse', `refs/tags/${tag}`) });
  const remote = new Map();
  for (const line of git(root, 'ls-remote', REMOTE).split('\n').filter(Boolean)) {
    const [sha, ref] = line.split('\t');
    if (!ref.endsWith('^{}')) remote.set(ref, sha);
  }
  // A remote commit we do not have cannot be in our history: diverged.
  const isAncestor = (a, b) => tryGit(root, 'merge-base', '--is-ancestor', a, b) !== null;
  return { remote: REMOTE, release, refs: planPush(refs, remote, isAncestor) };
}

/** Pushes what the plan says (new and update), nothing forced; the local main branch follows when it can. */
export function push(root = repoRoot) {
  const plan = pushPlan(root);
  const send = plan.refs.filter((one) => one.action === 'new' || one.action === 'update');
  if (send.length) git(root, 'push', '--porcelain', REMOTE, ...send.map((one) => `${one.local}:${one.ref}`));
  // The local main branch moves forward too (never checked out in the main checkout: an update of its ref).
  const { main } = project.branches;
  const mainRef = plan.refs.find((one) => one.ref === `refs/heads/${main}`);
  const current = tryGit(root, 'rev-parse', '--verify', '--quiet', `refs/heads/${main}`);
  if (mainRef && current && current !== mainRef.local && tryGit(root, 'merge-base', '--is-ancestor', current, mainRef.local) !== null && tryGit(root, 'symbolic-ref', '--short', 'HEAD') !== main) {
    git(root, 'update-ref', `refs/heads/${main}`, mainRef.local, current);
  }
  return { ...plan, pushed: send.map((one) => one.label), skipped: plan.refs.filter((one) => one.action === 'diverged').map((one) => one.label) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry');
  const plan = pushPlan();
  for (const one of plan.refs) console.log(`${one.action.padEnd(8)} ${one.label}`);
  if (!dry) {
    const result = push();
    console.log(`poussé sur ${result.remote} : ${result.pushed.join(', ') || 'rien'}${result.skipped.length ? ` · divergé, laissé : ${result.skipped.join(', ')}` : ''}`);
  }
}
