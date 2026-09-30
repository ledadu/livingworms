import '../../test/env.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteBranch,
  describeBranch,
  integrate,
  lineOf,
  lineTags,
  listReleaseBranches,
  missingBranches,
  nextPatch,
  parseCherry,
  pickedShas,
  publishPatch,
  rebaseRelease,
  releaseVersionOf,
  reportFixes,
  worktrees,
} from '../branches.mjs';
import { assignEntries, loadChanges } from '../changes.mjs';
import { publish } from '../publish.mjs';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const git = (root: string, ...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function write(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

const entry = (type: string, title: string) => `---\ntype: ${type}\ntitle: ${title}\npitch: ${title} !\n---\nTu vas voir.\n`;

// A repository checked out on backlog (like the main one), with main at the start, the game code in game.txt and two
// unreleased entries: nid (published in 0.2.0) and plus-tard (left for later).
function repository(): string {
  const base = mkdtempSync(join(tmpdir(), 'agents-branches-'));
  roots.push(base);
  const root = join(base, 'repo');
  mkdirSync(root);
  git(root, 'init', '-q');
  git(root, 'symbolic-ref', 'HEAD', 'refs/heads/backlog');
  for (const [key, value] of [['commit.gpgsign', 'false'], ['tag.gpgsign', 'false'], ['user.email', 'test@agents.test'], ['user.name', 'Test']]) git(root, 'config', key!, value!);
  write(root, 'package.json', '{\n  "name": "game",\n  "version": "0.1.0"\n}\n');
  write(root, 'game.txt', 'ligne 1\nligne 2\nligne 3\n');
  write(root, 'changes/unreleased/nid/entry.md', entry('new', 'Un nid'));
  write(root, 'changes/unreleased/plus-tard/entry.md', entry('improved', 'Plus tard'));
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'start');
  git(root, 'branch', 'main');
  return root;
}

// Commits on `branch` from a throwaway worktree, as a developer or an agent would (in the main tree when it has it).
function commitOn(root: string, branch: string, files: Record<string, string>, message: string, create?: string): void {
  if (!create && git(root, 'rev-parse', '--abbrev-ref', 'HEAD') === branch) {
    for (const [path, text] of Object.entries(files)) write(root, path, text);
    git(root, 'add', '--', ...Object.keys(files));
    git(root, 'commit', '-q', '-m', message);
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'agents-branches-wt-'));
  roots.push(dir);
  git(root, 'worktree', 'add', '-q', ...(create ? ['-b', branch, dir, create] : [dir, branch]));
  for (const [path, text] of Object.entries(files)) write(dir, path, text);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', message);
  git(root, 'worktree', 'remove', '--force', dir);
}

function publishedRepository(): string {
  const root = repository();
  publish(root, { version: '0.2.0', slugs: ['nid'], date: '2026-10-01' });
  return root;
}

// A fix of 0.2 on its own branch, integrated into release/0.2.
function withFix(root: string): void {
  commitOn(root, 'fix/bug', { 'game.txt': 'ligne 1 corrigée\nligne 2\nligne 3\n', 'changes/unreleased/bug/entry.md': entry('fixed', 'Plus de bug') }, 'fix: the bug', 'release/0.2');
  integrate(root, '0.2', 'fix/bug');
}

describe('the pure helpers', () => {
  it('reads lines, tags and the next fix', () => {
    expect([lineOf('release/0.2'), lineOf('v0.2.1'), lineOf('0.3'), lineOf('backlog')]).toEqual(['0.2', '0.2', '0.3', null]);
    expect(lineTags(['v0.2.0', 'v0.3.0', 'v0.2.10', 'v0.2.2', 'x'], '0.2')).toEqual(['0.2.0', '0.2.2', '0.2.10']);
    expect(nextPatch(['v0.2.0', 'v0.2.1'], '0.2')).toBe('0.2.2');
    expect(nextPatch(['v0.2.0'], '0.2')).toBe('0.2.1');
  });

  it('parses git cherry, the publication commits and the cherry-pick trailers', () => {
    expect(parseCherry('+ abc1234 fix: a\n- def5678 fix: b\n')).toEqual([
      { sha: 'abc1234', subject: 'fix: a', applied: false },
      { sha: 'def5678', subject: 'fix: b', applied: true },
    ]);
    expect(releaseVersionOf('release: génération 0.2.1')).toBe('0.2.1');
    expect(releaseVersionOf('fix: release: génération')).toBeNull();
    expect(pickedShas('fix\n\n(cherry picked from commit 0123456789abcdef0123456789abcdef01234567)')).toEqual(['0123456789abcdef0123456789abcdef01234567']);
  });
});

describe('the version branches', () => {
  it('starts release/X.Y at the tag when X.Y.0 is published, not otherwise', () => {
    const root = publishedRepository();
    expect(git(root, 'rev-parse', 'release/0.2')).toBe(git(root, 'rev-parse', 'v0.2.0^{commit}'));
    expect(git(root, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('backlog');
    const [branch] = listReleaseBranches(root);
    expect(branch).toMatchObject({ branch: 'release/0.2', tag: 'v0.2.0', exact: true, diverged: false, toReport: 0, integration: { ahead: 0, behind: 0 } });
    expect(branch!.patch.entries).toEqual([]);

    const other = repository();
    const result = publish(other, { version: '0.2.0', slugs: ['nid'], branch: false });
    expect(result.releaseBranch).toBeNull();
    expect(git(other, 'branch', '--list', 'release/*')).toBe('');
    expect(missingBranches(other)).toEqual(['0.2']);
  });

  it('publishes a fix from its branch, in a temporary worktree, and leaves backlog alone', () => {
    const root = publishedRepository();
    write(root, 'docs/en-cours.md', 'le travail de l’utilisateur');
    withFix(root);
    const before = git(root, 'rev-parse', 'backlog');
    const state = describeBranch(root, 'release/0.2');
    // plus-tard was left unreleased at the tag: only the entry added on the branch is published.
    expect(state.patch).toMatchObject({ version: '0.2.1', problems: [] });
    expect(state.patch.entries.map((e: { slug: string }) => e.slug)).toEqual(['bug']);
    expect(state.toReport).toBe(1);

    const result = publishPatch(root, '0.2', { date: '2026-10-02' });
    expect(result).toMatchObject({ version: '0.2.1', tag: 'v0.2.1', branch: 'release/0.2', releaseBranch: null });
    expect(git(root, 'rev-parse', 'release/0.2')).toBe(git(root, 'rev-parse', 'v0.2.1^{commit}'));
    expect(git(root, 'show', 'release/0.2:package.json')).toContain('"version": "0.2.1"');
    expect(git(root, 'ls-tree', '--name-only', 'release/0.2:changes/v0.2.1')).toBe('bug\nrelease.md');
    expect(git(root, 'ls-tree', '--name-only', 'release/0.2:changes/unreleased')).toBe('plus-tard');
    // Nothing moved on backlog nor in the main working tree, and no worktree is left behind.
    expect(git(root, 'rev-parse', 'backlog')).toBe(before);
    expect(git(root, 'status', '--porcelain')).toBe('?? docs/');
    expect(worktrees(root)).toHaveLength(1);
    expect(describeBranch(root, 'release/0.2').patch.entries).toEqual([]);
  });

  it('refuses to publish anything but fixes, or with nothing to publish', () => {
    const root = publishedRepository();
    expect(() => publishPatch(root, '0.2')).toThrow(/aucune correction/);
    commitOn(root, 'release/0.2', { 'changes/unreleased/neuf/entry.md': entry('new', 'Du neuf') }, 'feat: new');
    expect(() => publishPatch(root, '0.2')).toThrow(/que des corrections/);
    expect(() => publishPatch(root, '0.2', { version: '0.3.1' })).toThrow(/pas un correctif de la 0.2/);
  });

  it('refuses to integrate a fix branch started from backlog', () => {
    const root = publishedRepository();
    commitOn(root, 'backlog', { 'autre.txt': 'backlog' }, 'feat: later work');
    commitOn(root, 'fix/wrong', { 'game.txt': 'x\n' }, 'fix: from backlog', 'backlog');
    expect(() => integrate(root, '0.2', 'fix/wrong')).toThrow(/part de backlog/);
    expect(git(root, 'rev-parse', 'release/0.2')).toBe(git(root, 'rev-parse', 'v0.2.0^{commit}'));
  });

  it('reports the fixes and the generation to a diverged backlog checked out in the main tree', () => {
    const root = publishedRepository();
    withFix(root);
    publishPatch(root, '0.2', { date: '2026-10-02' });
    // backlog moves on meanwhile, and the user edits a file of their own.
    git(root, 'checkout', '-q', 'backlog');
    write(root, 'autre.txt', 'backlog avance\n');
    git(root, 'add', 'autre.txt');
    git(root, 'commit', '-q', '-m', 'feat: later work');
    write(root, 'docs/en-cours.md', 'en cours');
    const state = describeBranch(root, 'release/0.2');
    expect(state.integration).toMatchObject({ ahead: 2, behind: 1 });
    expect(state.fixes.map((f: { subject: string; release: string | null }) => [f.subject, f.release])).toEqual([
      ['fix: the bug', null],
      ['release: génération 0.2.1', '0.2.1'],
    ]);

    const result = reportFixes(root, '0.2');
    expect(result).toMatchObject({ onto: 'backlog', reported: 2 });
    expect(readFileSync(join(root, 'game.txt'), 'utf8')).toBe('ligne 1 corrigée\nligne 2\nligne 3\n');
    expect(existsSync(join(root, 'changes/v0.2.1/bug/entry.md'))).toBe(true);
    expect(existsSync(join(root, 'changes/unreleased/bug'))).toBe(false);
    expect(readFileSync(join(root, 'CHANGELOG.md'), 'utf8')).toContain('Génération 0.2.1');
    expect(git(root, 'log', '-1', '--format=%s')).toBe('release: report de la Génération 0.2.1 depuis release/0.2');
    expect(git(root, 'log', '--format=%B', '-2')).toContain('cherry picked from commit');
    // backlog only moved forward; the user's file is untouched; the version stays that of backlog.
    expect(git(root, 'merge-base', '--is-ancestor', 'HEAD~2', 'HEAD')).toBe('');
    expect(git(root, 'status', '--porcelain')).toBe('?? docs/');
    expect(loadChanges(root).released.map((r: { version: string }) => r.version)).toEqual(['0.2.1', '0.2.0']);
    expect(describeBranch(root, 'release/0.2').toReport).toBe(0);
    expect(() => reportFixes(root, '0.2')).toThrow(/rien à reporter/);
  });

  it('moves a backlog that no worktree has by its ref, or parks the fixes on a branch', () => {
    const root = publishedRepository();
    withFix(root);
    git(root, 'checkout', '-q', 'main');
    const parked = reportFixes(root, '0.2', { advance: false });
    expect(parked.parked).toMatch(/^report\/0\.2-/);
    expect(git(root, 'log', '-1', '--format=%s', parked.parked)).toBe('fix: the bug');
    const before = git(root, 'rev-parse', 'backlog');
    const moved = reportFixes(root, '0.2');
    expect(git(root, 'rev-parse', 'backlog~1')).toBe(before);
    expect(moved.reported).toBe(1);
    expect(git(root, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  });

  it('cancels a report that conflicts, and leaves backlog as it was', () => {
    const root = publishedRepository();
    withFix(root);
    git(root, 'checkout', '-q', 'main');
    commitOn(root, 'backlog', { 'game.txt': 'ligne 1 réécrite sur backlog\nligne 2\nligne 3\n' }, 'feat: rewrite');
    const before = git(root, 'rev-parse', 'backlog');
    expect(() => reportFixes(root, '0.2')).toThrow(/conflit en reportant .* game\.txt/);
    expect(git(root, 'rev-parse', 'backlog')).toBe(before);
    expect(worktrees(root)).toHaveLength(1);
  });

  it('rebases a version branch with and without conflict, never over its published fixes unless forced', () => {
    const root = publishedRepository();
    withFix(root);
    publishPatch(root, '0.2', { date: '2026-10-02' });
    commitOn(root, 'release/0.2', { 'notes.txt': 'une note\n' }, 'fix: a note');
    commitOn(root, 'backlog', { 'autre.txt': 'backlog avance\n' }, 'feat: later work');
    // Already on its latest tag: nothing to replay.
    expect(rebaseRelease(root, '0.2')).toMatchObject({ changed: false });
    // On backlog: it would rewrite v0.2.1.
    expect(() => rebaseRelease(root, '0.2', { onto: 'backlog' })).toThrow(/v0\.2\.1/);
    const forced = rebaseRelease(root, '0.2', { onto: 'backlog', force: true });
    expect(forced.changed).toBe(true);
    expect(git(root, 'merge-base', '--is-ancestor', 'backlog', 'release/0.2')).toBe('');
    expect(git(root, 'show', 'release/0.2:notes.txt')).toBe('une note');

    // A conflict: the rebase is aborted, the branch and the worktrees stay as they were.
    commitOn(root, 'release/0.2', { 'game.txt': 'version 0.2\n' }, 'fix: game on 0.2');
    commitOn(root, 'backlog', { 'game.txt': 'version backlog\n' }, 'feat: game on backlog');
    const tip = git(root, 'rev-parse', 'release/0.2');
    expect(() => rebaseRelease(root, '0.2', { onto: 'backlog', force: true })).toThrow(/conflit, rebase annulé : game\.txt/);
    expect(git(root, 'rev-parse', 'release/0.2')).toBe(tip);
    expect(worktrees(root)).toHaveLength(1);
    expect(git(root, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('backlog');
  });

  it('sees a diverged branch, and deletes a branch that no worktree holds', () => {
    const root = publishedRepository();
    git(root, 'branch', '-f', 'release/0.2', 'main');
    expect(describeBranch(root, 'release/0.2')).toMatchObject({ diverged: true, tag: null, strayTag: 'v0.2.0' });
    const dir = join(mkdtempSync(join(tmpdir(), 'agents-branches-wt-')), 'x');
    roots.push(dirname(dir));
    git(root, 'worktree', 'add', '-q', dir, 'release/0.2');
    expect(() => deleteBranch(root, '0.2')).toThrow(/extraite dans/);
    git(root, 'worktree', 'remove', '--force', dir);
    expect(deleteBranch(root, '0.2').message).toMatch(/supprimée/);
    expect(listReleaseBranches(root)).toEqual([]);
  });
});

describe('a grouped publication', () => {
  it('assigns a selection to the generation proposed for it, refuses invalid entries, then publishes it', () => {
    const root = repository();
    write(root, 'changes/unreleased/casse/entry.md', '---\ntype: new\n---\n');
    expect(() => assignEntries(root, ['nid', 'casse'], null)).toThrow(/invalides, non publiables : casse/);
    expect(loadChanges(root).plan.versions).toEqual([]);
    const version = assignEntries(root, ['nid', 'plus-tard'], null);
    expect(version).toBe('0.2.0');
    rmSync(join(root, 'changes/unreleased/casse'), { recursive: true });
    const result = publish(root, { version });
    expect(result.slugs.sort()).toEqual(['nid', 'plus-tard']);
    expect(result.releaseBranch).toEqual({ branch: 'release/0.2', created: true });
    expect(git(root, 'show', 'HEAD:package.json')).toContain('"version": "0.2.0"');
  });
});
