import '../../test/env.mjs';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildPrompt,
  choicesIn,
  diffSnapshots,
  enqueue,
  filesIn,
  markQueue,
  matchStatus,
  parseRoadmap,
  proposeName,
  readQueue,
  readSnapshot,
  readSources,
  refreshSnapshot,
  removeQueueEntry,
  resolveFiles,
  slugify,
  snapshotOf,
  statusLabel,
} from '../roadmap.mjs';
import { briefPath } from '../../config.mjs';
import { readSettings } from '../settings.mjs';

const run = promisify(execFile);
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function temp() {
  const folder = mkdtempSync(join(tmpdir(), 'roadmap-test-'));
  folders.push(folder);
  return folder;
}

// An excerpt of docs/roadmap.md as it was on 2026-09-28 (the file itself is edited live, so it is copied here).
const REAL = `# Roadmap et parking

## Première beta

Choix du 2026-09-27. La beta agrandit le terrain de jeu : trois mondes de 1 km de côté reliés par des portails.

### Étape B3 bis : coopération

Mise en œuvre le 2026-09-27 : voir [Coopération](gameplay/multiplayer.md#coopération).

**Livrables**

- XP de groupe, partagée entre les créatures qui ont frappé l'ennemi.

### Étape B4 : grottes et donjons

**Livrables**

- Biome intérieur : grottes avec plafond, éclairage propre et caméra qui voit à travers.

## Backlog

Relevé le 2026-09-28 : bugs, ajustements et chantiers à étudier.

### Bugs

- **Rais de soleil de la Forêt profonde** : cinq cylindres placés autour de la cible de la caméra (\`weather.ts\`), donc ils bougent avec elle.

### Éditeur

- **Palette rangée** (choix du 2026-09-28 : par partie du corps) : l'onglet « Base » disparaît.
  - **Membres** : membres, pieds, mains (locomotion, préhension) ;
  - **Tête** : yeux, gueule, cornes et antennes ;
- **Iconographie** : une icône par groupe et par sous-groupe.

### Nid (à étudier)

- **Construction** : à l'arrivée dans un monde, un emplacement vide à l'endroit prévu.
- **Machines d'analyse des différents mondes** (choix du 2026-09-28) : elles tournent en parallèle et chacune analyse plus vite les échantillons de son monde.

### Observabilité admin

Choix du 2026-09-28 : une page admin maison **et** Prometheus + Grafana, qui lisent la même source de vérité.

- **Source unique** : un module \`telemetry\` du serveur.
`;

describe('parseRoadmap', () => {
  const items = parseRoadmap(REAL);
  const byId = new Map(items.map((item) => [item.id, item]));

  it('finds sections, steps, subsections and top-level bold bullets, in reading order', () => {
    expect(items.map((item) => [item.kind, item.id])).toEqual([
      ['section', 'premiere-beta'],
      ['step', 'etape-b3-bis-cooperation'],
      ['step', 'etape-b4-grottes-et-donjons'],
      ['section', 'backlog'],
      ['subsection', 'bugs'],
      ['item', 'rais-de-soleil-de-la-foret-profonde'],
      ['subsection', 'editeur'],
      ['item', 'palette-rangee'],
      ['item', 'iconographie'],
      ['subsection', 'nid-a-etudier'],
      ['item', 'construction'],
      ['item', 'machines-d-analyse-des-differents-mondes'],
      ['subsection', 'observabilite-admin'],
      ['item', 'source-unique'],
    ]);
    expect(byId.get('palette-rangee')).toMatchObject({ section: 'Backlog', parent: 'editeur', title: 'Palette rangée' });
  });

  it('keeps the exact text: a bullet with its nested lines, a heading up to the next one of its level', () => {
    expect(byId.get('palette-rangee')!.text).toBe(
      [
        '- **Palette rangée** (choix du 2026-09-28 : par partie du corps) : l\'onglet « Base » disparaît.',
        '  - **Membres** : membres, pieds, mains (locomotion, préhension) ;',
        '  - **Tête** : yeux, gueule, cornes et antennes ;',
      ].join('\n'),
    );
    const step = byId.get('etape-b4-grottes-et-donjons')!.text;
    expect(step.startsWith('### Étape B4 : grottes et donjons')).toBe(true);
    expect(step).toContain('caméra qui voit à travers.');
    expect(step).not.toContain('## Backlog');
    expect(byId.get('backlog')!.text).toContain('- **Source unique**');
  });

  it('reads the choices already made, the files cited and the « Mise en œuvre » mark', () => {
    expect(byId.get('palette-rangee')!.choices).toEqual(['Choix du 2026-09-28 : par partie du corps']);
    expect(byId.get('machines-d-analyse-des-differents-mondes')!.choices).toEqual([
      'Choix du 2026-09-28 : elles tournent en parallèle et chacune analyse plus vite les échantillons de son monde',
    ]);
    expect(byId.get('observabilite-admin')!.choices).toEqual([
      'Choix du 2026-09-28 : une page admin maison et Prometheus + Grafana, qui lisent la même source de vérité',
    ]);
    expect(byId.get('premiere-beta')!.choices[0]).toMatch(/^Choix du 2026-09-27 : La beta agrandit le terrain de jeu/);
    // A heading's choices are its own, not those of its bullets.
    expect(byId.get('editeur')!.choices).toEqual([]);
    expect(byId.get('rais-de-soleil-de-la-foret-profonde')!.files).toEqual(['weather.ts']);
    expect(byId.get('etape-b3-bis-cooperation')).toMatchObject({ done: '2026-09-27', files: ['docs/gameplay/multiplayer.md'] });
    expect(byId.get('etape-b4-grottes-et-donjons')!.done).toBeNull();
  });

  it('gives unique ids to repeated titles, and ignores headings inside code fences', () => {
    const items = parseRoadmap('## A\n\n### Combat\n\n## B\n\n### Combat\n\n```\n## Pas un titre\n```\n');
    expect(items.map((item) => item.id)).toEqual(['a', 'combat', 'b', 'b--combat']);
  });

  it('ends a bullet at a paragraph that follows a blank line', () => {
    const [, item] = parseRoadmap('### X\n\n- **Un** : texte\n  suite\n\nParagraphe à part.\n');
    expect(item!.text).toBe('- **Un** : texte\n  suite');
  });
});

describe('small helpers', () => {
  it('slugifies French titles', () => {
    expect(slugify('Nid (à étudier)')).toBe('nid-a-etudier');
    expect(slugify('Cœur de phénix')).toBe('coeur-de-phenix');
  });

  it('extracts the choices in their three shapes', () => {
    expect(choicesIn('- **A** (choix du 2026-09-28 : rouge) : texte')).toEqual(['Choix du 2026-09-28 : rouge']);
    expect(choicesIn('Choix du 2026-09-27. On garde tout.')).toEqual(['Choix du 2026-09-27 : On garde tout']);
    expect(choicesIn('Rien ici.')).toEqual([]);
  });

  it('finds cited files and resolves bare names in the repository', () => {
    expect(filesIn('Voir [x](gameplay/worlds.md#a), `data/worlds/*.json`, `weather.ts`, `telemetry` et [web](https://a.b).')).toEqual([
      'docs/gameplay/worlds.md',
      'data/worlds/*.json',
      'weather.ts',
    ]);
    expect(resolveFiles(['weather.ts', 'docs/a.md'], ['apps/client/src/weather.ts', 'docs/a.md'])).toEqual(['apps/client/src/weather.ts', 'docs/a.md']);
  });

  it('proposes short, free agent names', () => {
    expect(proposeName('Rais de soleil de la Forêt profonde')).toBe('rais-soleil-foret');
    expect(proposeName('Étape B4 : grottes et donjons')).toBe('b4-grottes-donjons');
    expect(proposeName('Nid', new Set(['nid']))).toBe('nid-2');
  });
});

describe('matchStatus', () => {
  const items = parseRoadmap(`## Étapes

### Étape 7 : intégration, slots et effets

### Étape 8 : maison

Mise en œuvre le 2026-09-26.

## Backlog

### Déplacement

- **Allures** : texte.
- **Ralentissement dans l'eau** : texte.
- **Téléportation** : texte.

### Nid (à étudier)

- **Construction** : texte.

### Chat et émotes

### Motifs du corps

### Gènes aquatiques
`);
  const sources = {
    agents: [
      { name: 'allures', archived: true, base: '' },
      { name: 'nid', archived: false, base: '' },
      { name: 'integration', archived: false, base: '' },
    ],
    entries: [
      { slug: 'allures', generation: 'unreleased', heading: 'Allures et déplacement par bonds' },
      { slug: 'eau-pas', generation: 'unreleased', heading: "Eau et pas : ralentissement dans l'eau, pas selon le sol" },
      { slug: 'chat-emotes', generation: 'v0.3.0', heading: 'Chat et émotes' },
      { slug: 'chat-emotes-2', generation: 'v0.4.0', heading: 'Chat : canaux' },
      { slug: 'equilibrage', generation: 'unreleased', heading: 'Équilibrage : revue des gènes' },
    ],
    reports: [{ file: 'docs/compte-rendu/x.md', text: '| **Motifs du corps** | livré |' }],
    queue: [{ name: 'aqua', id: 'genes-aquatiques-2', status: 'queued' }],
  };
  const matched = new Map(matchStatus(items, sources).map((item) => [item.id, item]));
  const status = (id: string) => statusLabel(matched.get(id)!);

  it('ties tasks to agents, entries, generations and compte-rendu mentions', () => {
    expect(status('allures')).toBe('archivé'); // archived agent
    expect(matched.get('allures')!.agent).toBe('allures');
    expect(status('ralentissement-dans-l-eau')).toBe('en cours'); // in the heading of an unreleased report
    expect(status('nid-a-etudier')).toBe('en cours'); // agent at work
    expect(status('chat-et-emotes')).toBe('livré (génération v0.4.0)'); // the newest generation
    expect(status('motifs-du-corps')).toBe('en cours'); // named in a compte-rendu
    expect(status('etape-8-maison')).toBe('livré'); // « Mise en œuvre » in the roadmap
    expect(status('teleportation')).toBe('nouveau');
  });

  it('avoids loose matches: a single word of a long title, a word lost in a report heading', () => {
    expect(status('etape-7-integration-slots-et-effets')).toBe('nouveau');
    expect(status('genes-aquatiques')).toBe('nouveau');
  });

  it('ties a queued task to its roadmap item by id, whatever its name', () => {
    const [item] = matchStatus(parseRoadmap('## Beta\n\n### Gènes aquatiques\n'), { ...sources, queue: [{ name: 'aqua', id: 'genes-aquatiques', status: 'queued' }] }).slice(1);
    expect(item).toMatchObject({ status: 'active', agent: 'aqua' });
  });

  it('lets a bullet inherit the status of its heading, never of its ## section', () => {
    expect(matched.get('construction')).toMatchObject({ status: 'active', inherited: true, agent: 'nid' });
    // « Déplacement » is only a word of the allures report heading: too loose to pass on.
    expect(matched.get('deplacement')!.status).toBe('archived');
    expect(matched.get('teleportation')).toMatchObject({ status: 'new', inherited: false });
  });

  it('reads its sources from a checkout and a registry', () => {
    const root = temp();
    const registry = join(root, '.git/agents');
    mkdirSync(registry, { recursive: true });
    writeFileSync(join(registry, 'nid.env'), 'AGENT_NAME=nid\nAGENT_BASE=abc\nAGENT_ARCHIVED=2026-09-28\n');
    writeFileSync(join(registry, 'roadmap-snapshot.json'), '{}');
    mkdirSync(join(root, 'changes/unreleased/nid'), { recursive: true });
    writeFileSync(join(root, 'changes/unreleased/nid/report.md'), '# Nid (à étudier)\n\n## Livré\n');
    mkdirSync(join(root, 'changes/v0.3.0/chat'), { recursive: true });
    writeFileSync(join(root, 'changes/README.md'), '');
    mkdirSync(join(root, 'docs/compte-rendu'), { recursive: true });
    writeFileSync(join(root, 'docs/compte-rendu/a.md'), 'texte');
    const sources = readSources({ root, registry });
    expect(sources.agents).toEqual([{ name: 'nid', archived: true, base: 'abc' }]);
    expect(sources.entries).toEqual([
      { slug: 'nid', generation: 'unreleased', heading: 'Nid (à étudier)' },
      { slug: 'chat', generation: 'v0.3.0', heading: '' },
    ]);
    expect(sources.reports).toEqual([{ file: 'docs/compte-rendu/a.md', text: 'texte' }]);
    expect(sources.queue).toEqual([]);
  });
});

describe('snapshots', () => {
  it('tells new, modified and removed tasks apart', () => {
    const before = parseRoadmap('## A\n\n- **Un** : texte\n- **Deux** : texte\n');
    const after = parseRoadmap('## A\n\n- **Un** : texte changé\n- **Trois** : texte\n');
    const snapshot = snapshotOf(before, '2026-09-28T10:00:00.000Z');
    expect(diffSnapshots(snapshot, after)).toEqual({
      since: '2026-09-28T10:00:00.000Z',
      added: ['trois'],
      modified: ['a', 'un'],
      removed: [{ id: 'deux', title: 'Deux', section: 'A' }],
    });
    expect(diffSnapshots(null, before).added).toEqual(['a', 'un', 'deux']);
  });

  it('saves a snapshot with the diff it made, and nothing changes on a second refresh', () => {
    const file = join(temp(), 'agents/roadmap-snapshot.json');
    const items = parseRoadmap('## A\n\n- **Un** : texte\n');
    expect(refreshSnapshot(file, items, 't1').added).toEqual(['a', 'un']);
    const second = refreshSnapshot(file, items, 't2');
    expect(second).toEqual({ since: 't1', added: [], modified: [], removed: [] });
    expect(readSnapshot(file)).toMatchObject({ takenAt: 't2', lastDiff: { at: 't2', since: 't1' } });
  });
});

describe('buildPrompt', () => {
  it('follows the template of the orchestration doc, with the parent choices and the neighbours', () => {
    const items = parseRoadmap(REAL);
    const task = { ...items.find((item) => item.id === 'source-unique')!, name: 'telemetrie', base: 'backlog' };
    const prompt = buildPrompt(task, {
      items,
      neighbours: [{ name: 'grottes', title: 'Étape B4 : grottes et donjons' }],
      active: [{ name: 'nid' }],
      mainRoot: '/depot',
      worktrees: '/depot.worktrees',
      teamSize: 2,
    });
    expect(prompt).toContain(`Tu es l'agent \`telemetrie\`. Lis d'abord la consigne commune /depot/${briefPath}`);
    expect(prompt).toContain('2 agents en parallèle, worktrees /depot.worktrees, dépôt principal /depot');
    expect(prompt).toContain('Worktree : /depot.worktrees/telemetrie (branche agent/telemetrie, partie de backlog)');
    expect(prompt).toContain('« Backlog › Observabilité admin »');
    expect(prompt).toContain('- **Source unique** : un module `telemetry` du serveur.');
    expect(prompt).toContain('- Choix du 2026-09-28 : une page admin maison et Prometheus + Grafana');
    expect(prompt).toContain('- `grottes` : Étape B4 : grottes et donjons (lancé en même temps)');
    expect(prompt).toContain('- `nid` : en cours');
    expect(prompt).toContain('{{CO_AUTHORED_BY}}');
    expect(prompt).toContain('git merge backlog');
  });
});

describe('buildPrompt with sub-tasks', () => {
  it('gives the parent\'s agent its sub-tasks after it, in order, with their choices', () => {
    const task = { id: 'sons', kind: 'task', title: 'De vrais sons', section: 'Son', parent: null, line: 3, text: '### De vrais sons\n\nDes enregistrements.', choices: [], files: [], name: 'sons', base: 'backlog',
      subtasks: [{ id: 'credits', line: 9, text: '### Les crédits des sons\n\nLes auteurs.', choices: ['Choix : dans le générique'], files: [] }] };
    const prompt = buildPrompt(task, { mainRoot: '/depot', worktrees: '/depot.worktrees' });
    expect(prompt).toContain('## Puis ses sous-tâches, dans l’ordre');
    expect(prompt).toContain('### Sous-tâche 1 (ligne 9)\n\n#### Les crédits des sons\n\nLes auteurs.');
    expect(prompt).toContain('- Choix : dans le générique');
    expect(prompt.indexOf('Des enregistrements.')).toBeLessThan(prompt.indexOf('Sous-tâche 1'));
  });
});

describe('queue', () => {
  it('creates the worktree then the entry, and refuses bad or taken names', async () => {
    const registry = join(temp(), 'agents');
    const queueDir = join(registry, 'queue');
    mkdirSync(registry, { recursive: true });
    writeFileSync(join(registry, 'nid.env'), 'AGENT_NAME=nid\n');
    const created: string[] = [];
    const createWorktree = async (name: string, base: string) => {
      if (name === 'casse') throw new Error('fatal: a branch named agent/casse already exists');
      created.push(`${name}@${base}`);
    };
    const results = await enqueue(
      [
        { id: 'a', name: 'rais', base: 'backlog', title: 'Rais', prompt: 'P1' },
        { id: 'b', name: 'Rais Soleil', title: 'x', prompt: '' },
        { id: 'c', name: 'nid', title: 'Nid', prompt: '' },
        { id: 'd', name: 'rais', title: 'Encore', prompt: '' },
        { id: 'e', name: 'casse', title: 'Casse', prompt: '' },
        { id: 'f', name: 'x', base: 'main; rm -rf', title: 'x', prompt: '' },
      ],
      { queueDir, registry, createWorktree, now: () => '2026-09-28T12:00:00.000Z' },
    );
    expect(results.map((result) => result.ok)).toEqual([true, false, false, false, false, false]);
    expect(results[4]!.error).toMatch(/worktree non créé : fatal: a branch named/);
    expect(created).toEqual(['rais@backlog']);
    expect(JSON.parse(readFileSync(join(queueDir, 'rais.json'), 'utf8'))).toEqual({
      name: 'rais',
      title: 'Rais',
      prompt: 'P1',
      base: 'backlog',
      id: 'a',
      createdAt: '2026-09-28T12:00:00.000Z',
      status: 'queued',
    });
  });

  it('records the effort and model of a queued task in its agent’s registry file, and refuses unknown ones', async () => {
    const registry = join(temp(), 'agents');
    const queueDir = join(registry, 'queue');
    mkdirSync(registry, { recursive: true });
    // agent.sh new writes the registry file; the fake does the same.
    const createWorktree = async (name: string) => writeFileSync(join(registry, `${name}.env`), `AGENT_NAME=${name}\n`);
    const results = await enqueue(
      [
        { id: 'a', name: 'grotte', title: 'Grotte', prompt: 'P', effort: 'xhigh', model: 'opus' },
        { id: 'b', name: 'typo', title: 'Typo', prompt: 'P', effort: 'low' },
        { id: 'c', name: 'defaut', title: 'Défaut', prompt: 'P' },
        { id: 'd', name: 'trop', title: 'Trop', prompt: 'P', effort: 'ultra' },
      ],
      { queueDir, registry, createWorktree },
    );
    expect(results.map((result) => result.ok)).toEqual([true, true, true, false]);
    expect(results[3]!.error).toMatch(/effort inconnu « ultra »/);
    expect(existsSync(join(registry, 'trop.env'))).toBe(false);
    expect(readSettings(registry, 'grotte')).toEqual({ effort: 'xhigh', model: 'opus' });
    expect(readSettings(registry, 'typo')).toEqual({ effort: 'low', model: null });
    expect(readSettings(registry, 'defaut')).toEqual({ effort: null, model: null });
    expect(JSON.parse(readFileSync(join(queueDir, 'grotte.json'), 'utf8'))).toMatchObject({ effort: 'xhigh', model: 'opus' });
    expect(JSON.parse(readFileSync(join(queueDir, 'defaut.json'), 'utf8'))).not.toHaveProperty('effort');
  });

  it('marks, lists and removes entries', () => {
    const queueDir = join(temp(), 'queue');
    mkdirSync(queueDir);
    writeFileSync(join(queueDir, 'b.json'), JSON.stringify({ name: 'b', createdAt: '2', status: 'queued' }));
    writeFileSync(join(queueDir, 'a.json'), JSON.stringify({ name: 'a', createdAt: '1', status: 'queued' }));
    writeFileSync(join(queueDir, 'broken.json'), '{');
    expect(readQueue(queueDir).map((entry) => entry.name)).toEqual(['a', 'b']);
    expect(markQueue(queueDir, 'a', 'launched', 'now')).toMatchObject({ status: 'launched', launchedAt: 'now' });
    expect(() => markQueue(queueDir, 'a', 'perdu')).toThrow(/statut inconnu/);
    expect(() => markQueue(queueDir, 'zz', 'done')).toThrow(/pas de tâche/);
    expect(removeQueueEntry(queueDir, 'b')).toBe(true);
    expect(removeQueueEntry(queueDir, '../x')).toBe(false);
    expect(readQueue(queueDir).map((entry) => [entry.name, entry.status])).toEqual([['a', 'launched']]);
  });

  it('queue.mjs wait returns the queued entries once one shows up', async () => {
    const registry = temp();
    const env = { ...process.env, AGENTS_REGISTRY: registry };
    const script = join(__dirname, '../queue.mjs');
    const waiting = run('node', [script, 'wait', '--timeout', '20'], { env });
    await new Promise((done) => setTimeout(done, 300));
    mkdirSync(join(registry, 'queue'));
    writeFileSync(join(registry, 'queue/rais.json'), JSON.stringify({ name: 'rais', title: 'Rais', base: 'backlog', createdAt: '1', status: 'queued' }));
    const { stdout } = await waiting;
    expect(JSON.parse(stdout).map((entry: { name: string }) => entry.name)).toEqual(['rais']);
    expect(JSON.parse(stdout)[0]).toMatchObject({ effort: null, model: null, agentType: 'general-purpose' });
    await run('node', [script, 'mark', 'rais', 'launched'], { env });
    const { stdout: listed } = await run('node', [script, 'list'], { env });
    expect(listed).toMatch(/^launched\s+rais\s+backlog\s+-\/-/);
    // The agent's settings as they are now, and the agent type the orchestrator launches it with.
    writeFileSync(join(registry, 'rais.env'), 'AGENT_NAME=rais\nAGENT_EFFORT=xhigh\nAGENT_MODEL=sonnet\n');
    const { stdout: json } = await run('node', [script, 'list', '--json'], { env });
    expect(JSON.parse(json)[0]).toMatchObject({ effort: 'xhigh', model: 'sonnet', agentType: 'chantier-xhigh' });
  });
});
