import '../../test/env.mjs';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { commitBacklog, formatStatus, parseBacklog, parseStatus, setTaskStatus, stateOf, syncBacklog, syncMarkdown, withLabels } from '../backlog.mjs';

const BACKLOG = `# Backlog

Intro.

## Nouveaux chantiers

### Nouvelles pièces
> ⚪ à faire

Texte.

#### Corps
- yeux

### Menu admin
> 🔵 en cours · agent petits

Icônes.

### Sans état
Juste du texte.

### En pause
> ⏸ en pause · agent vieux

## Livré

Les chantiers publiés.

### Ancien
> 🟢 livré · v0.1.0 · agent ancien
`;

const facts = (extra: Partial<{ queue: unknown[]; agents: Map<string, { archived: boolean }>; released: Map<string, string>; unreleased: Set<string> }> = {}) => ({
  queue: [],
  agents: new Map(),
  released: new Map(),
  unreleased: new Set(),
  ...extra,
});

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe('status lines', () => {
  it('reads and writes the state, the generation and the agents', () => {
    expect(parseStatus('> 🟢 livré · v0.2.1 · agents a, b')).toEqual({ state: 'done', generation: 'v0.2.1', agents: ['a', 'b'] });
    expect(parseStatus('> en cours · agent x')).toEqual({ state: 'active', generation: null, agents: ['x'] });
    expect(parseStatus('> une citation ordinaire')).toBeNull();
    expect(formatStatus({ state: 'merged', agents: ['x'] })).toBe('> 🟠 fusionné · agent x');
    expect(formatStatus({ state: 'done', generation: 'v0.3.0', agents: ['x', 'y'] })).toBe('> 🟢 livré · v0.3.0 · agents x, y');
  });
});

describe('parseBacklog', () => {
  it('makes one task per ### heading, #### included, with its state and its section', () => {
    const items = parseBacklog(BACKLOG);
    const tasks = items.filter((item) => item.kind === 'task');
    expect(tasks.map((task) => [task.id, task.state, task.section])).toEqual([
      ['nouvelles-pieces', 'todo', 'Nouveaux chantiers'],
      ['menu-admin', 'active', 'Nouveaux chantiers'],
      ['sans-etat', 'todo', 'Nouveaux chantiers'],
      ['en-pause', 'paused', 'Nouveaux chantiers'],
      ['ancien', 'done', 'Livré'],
    ]);
    // The text of a task keeps its sub-headings, not its status line.
    expect(tasks[0].text).toBe('### Nouvelles pièces\n\nTexte.\n\n#### Corps\n- yeux');
    expect(withLabels(items).find((item) => item.id === 'ancien')).toMatchObject({ status: 'done', label: 'livré (génération v0.1.0)', agent: 'ancien' });
  });
});

describe('syncMarkdown', () => {
  it('leaves the file untouched when the facts agree with it', () => {
    const { markdown, changes } = syncMarkdown(BACKLOG, facts({ agents: new Map([['petits', { archived: false }]]), released: new Map([['ancien', 'v0.1.0']]) }));
    expect(changes).toEqual([]);
    expect(markdown).toBe(BACKLOG);
  });

  it('follows an agent from the queue to its merge, never touches a paused task, and moves a delivered one down', () => {
    const queued = syncMarkdown(BACKLOG, facts({ queue: [{ id: 'sans-etat', name: 'neuf', status: 'queued' }], agents: new Map([['petits', { archived: false }]]) }));
    expect(queued.markdown).toContain('### Sans état\n> 🟣 en file · agent neuf\nJuste du texte.');
    const merged = syncMarkdown(queued.markdown, facts({ unreleased: new Set(['petits', 'neuf']), agents: new Map([['vieux', { archived: false }]]) }));
    expect(merged.markdown).toContain('### Menu admin\n> 🟠 fusionné · agent petits');
    expect(merged.markdown).toContain('> ⏸ en pause · agent vieux');
    const released = syncMarkdown(merged.markdown, facts({ released: new Map([['petits', 'v0.2.0'], ['ancien', 'v0.1.0']]), unreleased: new Set(['neuf']) }));
    const tasks = parseBacklog(released.markdown).filter((item) => item.kind === 'task');
    expect(tasks.map((task) => task.id)).toEqual(['nouvelles-pieces', 'sans-etat', 'en-pause', 'menu-admin', 'ancien']);
    expect(tasks.find((task) => task.id === 'menu-admin')).toMatchObject({ section: 'Livré', state: 'done', generation: 'v0.2.0', text: '### Menu admin\n\nIcônes.' });
    expect(released.changes.map((change) => [change.id, change.to])).toEqual([['menu-admin', 'done']]);
  });

  it('waits for every agent of a task before calling it delivered', () => {
    const two = BACKLOG.replace('> 🔵 en cours · agent petits', '> 🔵 en cours · agents petits, grands');
    const { markdown } = syncMarkdown(two, facts({ released: new Map([['petits', 'v0.2.0'], ['ancien', 'v0.1.0']]), agents: new Map([['grands', { archived: false }]]) }));
    expect(markdown).toContain('### Menu admin\n> 🔵 en cours · agents petits, grands');
    expect(stateOf(parseBacklog(two).find((item) => item.id === 'sans-etat') as never, facts())).toBeNull();
  });
});

describe('on disk', () => {
  it('sets a status line by hand and syncs the file from the registry and changes/', () => {
    const root = mkdtempSync(join(tmpdir(), 'agents-backlog-'));
    folders.push(root);
    const registry = join(root, 'registry');
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(registry, { recursive: true });
    mkdirSync(join(root, 'changes', 'v0.1.0', 'ancien'), { recursive: true });
    const file = join(root, 'docs', 'backlog.md');
    writeFileSync(file, BACKLOG);
    expect(setTaskStatus({ file, id: 'nouvelles-pieces', state: 'queued', agents: ['pieces'] })).toBe(true);
    expect(setTaskStatus({ file, id: 'inconnue', state: 'queued' })).toBe(false);
    writeFileSync(join(registry, 'pieces.env'), 'AGENT_NAME=pieces\n');
    writeFileSync(join(registry, 'petits.env'), 'AGENT_NAME=petits\nAGENT_ARCHIVED=2026-09-29\n');
    const { changes } = syncBacklog({ file, root, registry });
    expect(changes.map((change) => [change.id, change.to]).sort()).toEqual([['menu-admin', 'merged'], ['nouvelles-pieces', 'active']]);
    expect(readFileSync(file, 'utf8')).toContain('### Nouvelles pièces\n> 🔵 en cours · agent pieces');
  });
});

describe('editing a task', () => {
  it('replaces its block and keeps its status line, refusing a stale version or a heading of another level', async () => {
    const { replaceTask, addTask, taskVersion } = await import('../backlog.mjs');
    const task = parseBacklog(BACKLOG).find((item) => item.id === 'menu-admin') as never;
    const next = replaceTask(BACKLOG, 'menu-admin', '### Menu admin en jeu\n\nIcônes et tuiles.\n\n#### Détails\n- portails', taskVersion(task));
    expect(next).toContain('### Menu admin en jeu\n> 🔵 en cours · agent petits\n\nIcônes et tuiles.\n\n#### Détails\n- portails\n\n### Sans état');
    expect(() => replaceTask(next, 'menu-admin-en-jeu', '### Menu admin en jeu\nx', taskVersion(task))).toThrow(/a changé/);
    expect(() => replaceTask(BACKLOG, 'menu-admin', 'Menu admin\nx')).toThrow(/titre/);
    expect(() => replaceTask(BACKLOG, 'menu-admin', '### Menu\n## Groupe')).toThrow(/####/);
    // A status line typed in the text is not a second one.
    expect(replaceTask(BACKLOG, 'sans-etat', '### Sans état\n> 🟢 livré\nTexte.')).toContain('### Sans état\n\nTexte.\n\n### En pause');
    const added = addTask(BACKLOG, 'Nouveaux chantiers', '### Tout neuf\n\nÀ faire.');
    expect(added).toContain('> ⏸ en pause · agent vieux\n\n### Tout neuf\n> ⚪ à faire\n\nÀ faire.\n\n## Livré');
    expect(parseBacklog(added).find((item) => item.id === 'tout-neuf')).toMatchObject({ section: 'Nouveaux chantiers', state: 'todo' });
  });
});

describe('commitBacklog', () => {
  const repo = () => {
    const root = mkdtempSync(join(tmpdir(), 'backlog-commit-'));
    const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
    git('init', '-q');
    git('symbolic-ref', 'HEAD', 'refs/heads/backlog');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    mkdirSync(join(root, 'docs'));
    writeFileSync(join(root, 'docs/backlog.md'), BACKLOG);
    writeFileSync(join(root, 'other.txt'), 'a');
    git('add', '.');
    git('commit', '-q', '-m', 'init');
    return { root, git, file: join(root, 'docs/backlog.md') };
  };

  it('commits the backlog alone, leaving the rest of the checkout as it is', () => {
    const { root, git, file } = repo();
    expect(commitBacklog({ root, file, branch: 'backlog' })).toBe(false);
    writeFileSync(file, BACKLOG.replace('⚪ à faire', '🟠 fusionné · agent x'));
    writeFileSync(join(root, 'other.txt'), 'b');
    git('add', 'other.txt');
    expect(commitBacklog({ root, file, branch: 'backlog', message: 'sync' })).toBe(true);
    expect(git('log', '-1', '--format=%s')).toBe('sync');
    expect(git('show', '--name-only', '--format=', 'HEAD')).toBe('docs/backlog.md');
    expect(git('status', '--porcelain')).toBe('M  other.txt');
    rmSync(root, { recursive: true, force: true });
  });

  it('does nothing on another branch', () => {
    const { root, file } = repo();
    writeFileSync(file, `${BACKLOG}\nplus`);
    expect(commitBacklog({ root, file, branch: 'master' })).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });
});
