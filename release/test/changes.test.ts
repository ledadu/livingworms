import '../../test/env.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assignEntry,
  assignedTo,
  changelog,
  checkPlannedVersion,
  checkVersion,
  releaseName,
  loadChanges,
  nextVersion,
  parseFrontMatter,
  planVersion,
  previewRelease,
  proposeVersion,
  release,
  unplanVersion,
  whatsNew,
} from '../changes.mjs';
import { publish, publishBlocker, publishProblems } from '../publish.mjs';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function write(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function entry(fields: Record<string, string | string[]>, body = 'Tu peux maintenant voler.'): string {
  const lines = Object.entries(fields).map(([key, value]) => (Array.isArray(value) ? `${key}:\n${value.map((item) => `  - ${item}`).join('\n')}` : `${key}: ${value}`));
  return `---\n${lines.join('\n')}\n---\n${body}\n`;
}

// A small repository: two packages, one published generation and three unreleased entries.
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'agents-changes-'));
  roots.push(root);
  write(root, 'package.json', '{\n  "name": "game",\n  "version": "0.2.0"\n}\n');
  write(root, 'apps/client/package.json', '{\n  "name": "@allele/client",\n  "version": "0.2.0"\n}\n');
  write(root, 'changes/v0.2.0/release.md', '---\ndate: 2026-09-01\ntitle: "Les ailes # enfin"\n---\nUne génération qui décolle.\n');
  write(root, 'changes/v0.2.0/ailes/entry.md', entry({ type: 'new', title: 'Des ailes', pitch: 'Envole-toi !' }));
  write(root, 'changes/unreleased/nid/entry.md', entry({ type: 'new', title: 'Un nid', pitch: 'Bâtis ton nid !', images: ['img/nid.jpg', 'img/hutte.jpg'] }, 'Regarde : ![la hutte](img/hutte.jpg) et [le site](https://allele.test).'));
  write(root, 'changes/unreleased/nid/img/nid.jpg', 'jpg');
  write(root, 'changes/unreleased/nid/img/hutte.jpg', 'jpg');
  write(root, 'changes/unreleased/nid/report.md', '# Nid\n');
  write(root, 'changes/unreleased/soleil/entry.md', entry({ type: 'fixed', title: 'Du soleil', pitch: 'Les rayons tiennent en place.' }));
  write(root, 'changes/unreleased/outils/entry.md', entry({ type: 'improved', title: 'Des outils', pitch: 'Pour les devs.', audience: 'developers' }));
  return root;
}

describe('the entries', () => {
  it('reads the front matter: values, lists, quotes and comments', () => {
    const { data, body, hasFrontMatter } = parseFrontMatter('---\ntype: new   # a comment\ntitle: "Un # dans le titre"\nimages:\n  - img/a.jpg\n  - img/b.jpg\n---\nLe texte.\n');
    expect(hasFrontMatter).toBe(true);
    expect(data).toEqual({ type: 'new', title: 'Un # dans le titre', images: ['img/a.jpg', 'img/b.jpg'] });
    expect(body).toBe('Le texte.');
    expect(parseFrontMatter('Pas d’en-tête').hasFrontMatter).toBe(false);
  });

  it('loads the generations, newest first, and sorts the entries by type', () => {
    const changes = loadChanges(fixture());
    expect(changes.errors).toEqual([]);
    expect(changes.current).toBe('0.2.0');
    expect(changes.released.map((r) => [r.version, r.date, r.title, r.intro])).toEqual([['0.2.0', '2026-09-01', 'Les ailes # enfin', 'Une génération qui décolle.']]);
    expect(changes.unreleased.entries.map((e) => e.slug)).toEqual(['nid', 'outils', 'soleil']);
    expect(changes.unreleased.entries[0]?.report).toBe(true);
  });

  it('refuses an entry without its fields, text or images', () => {
    const root = fixture();
    write(root, 'changes/unreleased/vide/entry.md', entry({ type: 'nouveau', audience: 'tous', images: ['img/absente.jpg'] }, '![x](img/perdue.jpg)'));
    write(root, 'changes/unreleased/Mauvais_Nom/report.md', '');
    const errors = loadChanges(root).errors;
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/unreleased\/vide : type « nouveau »/),
        'unreleased/vide : title manquant',
        'unreleased/vide : pitch manquant',
        expect.stringMatching(/unreleased\/vide : audience « tous »/),
        'unreleased/vide : image introuvable : img/absente.jpg',
        'unreleased/vide : image introuvable dans le texte : img/perdue.jpg',
        expect.stringMatching(/Mauvais_Nom : nom de dossier invalide/),
        'unreleased/Mauvais_Nom : entry.md manquant',
      ]),
    );
    write(root, 'changes/unreleased/muet/entry.md', entry({ type: 'new', title: 'T', pitch: 'P' }, ''));
    expect(loadChanges(root).errors).toContain('unreleased/muet : texte pour les joueurs manquant, sous l’en-tête');
  });
});

describe('the versions', () => {
  it('bumps the minor for a feature or an improvement, the patch for fixes alone', () => {
    const fixed = { type: 'fixed' } as never;
    const improved = { type: 'improved' } as never;
    expect(nextVersion('0.2.0', [fixed, improved])).toBe('0.3.0');
    expect(nextVersion('0.3.0', [fixed])).toBe('0.3.1');
    expect(nextVersion('0.3.1', [])).toBeNull();
    expect(releaseName('0.2.0')).toBe('Génération 0.2');
    expect(releaseName('0.3.1')).toBe('Génération 0.3.1');
    expect(releaseName(null)).toBe('Prochaine génération');
  });

  it('checks a proposed version against the last published one', () => {
    const changes = loadChanges(fixture());
    expect(changes.next).toBe('0.3.0');
    expect(checkVersion(changes, '0.3.0')).toBeNull();
    expect(checkVersion(changes, '1.0.0')).toBeNull();
    expect(checkVersion(changes, '0.2.0')).toMatch(/après 0.2.0/);
    expect(checkVersion(changes, '0.3')).toMatch(/invalide/);
  });
});

describe('the outputs', () => {
  it('gives the « Nouvelles mutations » with the image URLs under the base, unreleased only on request', () => {
    const changes = loadChanges(fixture());
    const published = whatsNew(changes, { base: '/x/' });
    expect(published.releases.map((r) => r.generation)).toEqual(['Génération 0.2']);
    const all = whatsNew(changes, { base: '/x/', includeUnreleased: true });
    const [incubating] = all.releases;
    expect(incubating).toMatchObject({ version: '0.3.0', generation: 'Génération 0.3', unreleased: true });
    const nest = incubating?.entries[0];
    expect(nest).toMatchObject({ id: 'unreleased/nid', type: 'new', images: ['/x/unreleased/nid/img/nid.jpg', '/x/unreleased/nid/img/hutte.jpg'] });
    expect(nest?.body).toBe('Regarde : ![la hutte](/x/unreleased/nid/img/hutte.jpg) et [le site](https://allele.test).');
    expect(all.badges.fixed).toBe('🩹 ADN réparé');
  });

  it('writes the changelog, the incubating generation first', () => {
    const text = changelog(loadChanges(fixture()));
    expect(text).toMatch(/^# Nouvelles mutations/);
    expect(text.indexOf('## En incubation : Génération 0.3 (v0.3.0)')).toBeLessThan(text.indexOf('## Génération 0.2 (v0.2.0, 2026-09-01)'));
    expect(text).toContain('- **Un nid** : Bâtis ton nid ! — [rapport](changes/unreleased/nid/report.md)');
    expect(text).toContain('- **Des outils** _(développeurs)_ : Pour les devs.');
    expect(text).toContain('### 🩹 ADN réparé');
  });

  it('previews a release without touching the disk', () => {
    const root = fixture();
    const preview = previewRelease(loadChanges(root), { version: '0.3.0', date: '2026-10-01', title: 'Le nid', intro: 'Bienvenue.' });
    expect(preview.unreleased.entries).toEqual([]);
    expect(preview.released.map((r) => r.version)).toEqual(['0.3.0', '0.2.0']);
    expect(changelog(preview)).toContain('## Génération 0.3 (v0.3.0, 2026-10-01)\n\n**Le nid**\n\nBienvenue.');
    expect(existsSync(join(root, 'changes/unreleased/nid'))).toBe(true);
  });
});

describe('a release', () => {
  it('freezes the unreleased entries, bumps the packages and writes the changelog', () => {
    const root = fixture();
    const result = release(root, undefined, { date: '2026-10-01', title: 'Le # nid', intro: 'Bienvenue.' });
    expect(result).toEqual({
      version: '0.3.0',
      title: 'Le # nid',
      slugs: ['nid', 'outils', 'soleil'],
      paths: ['changes/v0.3.0', 'changes/unreleased/nid', 'changes/unreleased/outils', 'changes/unreleased/soleil', 'CHANGELOG.md', 'package.json', 'apps/client/package.json'],
    });
    expect(existsSync(join(root, 'changes/v0.3.0/nid/img/hutte.jpg'))).toBe(true);
    expect(existsSync(join(root, 'changes/unreleased/nid'))).toBe(false);
    expect(JSON.parse(readFileSync(join(root, 'apps/client/package.json'), 'utf8')).version).toBe('0.3.0');
    const changes = loadChanges(root);
    expect(changes.released[0]).toMatchObject({ version: '0.3.0', date: '2026-10-01', title: 'Le # nid', intro: 'Bienvenue.' });
    expect(changes.current).toBe('0.3.0');
    expect(readFileSync(join(root, 'CHANGELOG.md'), 'utf8')).toContain('## Génération 0.3 (v0.3.0, 2026-10-01)');
    expect(() => release(root)).toThrow(/rien à publier/);
  });

  it('refuses invalid entries and a version not after the last one', () => {
    const root = fixture();
    expect(() => release(root, '0.2.0')).toThrow(/après 0.2.0/);
    write(root, 'changes/unreleased/casse/entry.md', 'rien');
    expect(() => release(root)).toThrow(/entrée invalide unreleased\/casse/);
  });
});

describe('the planned generations', () => {
  const plan = (root: string) => JSON.parse(readFileSync(join(root, 'changes/planned.json'), 'utf8'));

  it('assigns entries to a generation, moves them and takes them back, in changes/planned.json', () => {
    const root = fixture();
    expect(existsSync(join(root, 'changes/planned.json'))).toBe(false);
    assignEntry(root, 'nid', '0.3.0');
    assignEntry(root, 'soleil', '0.3.0');
    assignEntry(root, 'outils', '0.4.0');
    let changes = loadChanges(root);
    expect(changes.plan.errors).toEqual([]);
    expect(changes.plan.versions.map((v) => [v.version, v.entries])).toEqual([['0.3.0', ['nid', 'soleil']], ['0.4.0', ['outils']]]);
    expect(assignedTo(changes, 'soleil')).toBe('0.3.0');
    assignEntry(root, 'soleil', '0.4.0');
    assignEntry(root, 'nid', null);
    changes = loadChanges(root);
    expect(changes.plan.versions.map((v) => [v.version, v.entries])).toEqual([['0.3.0', []], ['0.4.0', ['outils', 'soleil']]]);
    expect(assignedTo(changes, 'nid')).toBeNull();
    planVersion(root, '0.4.0', { to: '0.3.5', title: 'Le soleil', intro: 'Bonjour.' });
    unplanVersion(root, '0.3.0');
    expect(plan(root)).toEqual({ versions: [{ version: '0.3.5', title: 'Le soleil', intro: 'Bonjour.', entries: ['outils', 'soleil'] }] });
    unplanVersion(root, '0.3.5');
    expect(existsSync(join(root, 'changes/planned.json'))).toBe(false);
  });

  it('refuses a version already published or planned, and an unknown entry', () => {
    const root = fixture();
    expect(() => assignEntry(root, 'nid', '0.2.0')).toThrow(/après 0.2.0/);
    expect(() => assignEntry(root, 'ailes', '0.3.0')).toThrow(/pas dans changes\/unreleased/);
    planVersion(root, '0.3.0');
    expect(() => planVersion(root, '0.4.0', {}) && planVersion(root, '0.4.0', { to: '0.3.0' })).toThrow(/déjà en préparation/);
    expect(checkPlannedVersion(loadChanges(root), '0.3.0', '0.3.0')).toBeNull();
    expect(checkPlannedVersion(loadChanges(root), '0.3')).toMatch(/invalide/);
  });

  it('proposes the number after the published and planned generations', () => {
    const root = fixture();
    let changes = loadChanges(root);
    expect(proposeVersion(changes)).toBe('0.3.0');
    assignEntry(root, 'nid', '0.3.0');
    changes = loadChanges(root);
    const soleil = changes.unreleased.entries.find((e) => e.slug === 'soleil');
    expect(proposeVersion(changes, [soleil!])).toBe('0.3.1');
    expect(proposeVersion(changes)).toBe('0.4.0');
  });

  it('reports the problems of a stale plan', () => {
    const root = fixture();
    write(root, 'changes/planned.json', JSON.stringify({ versions: [{ version: '0.2.0', entries: ['nid', 'perdu'] }, { version: '0.3.0', entries: ['nid'] }] }));
    const { plan: checked } = loadChanges(root);
    expect(checked.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/0.2.0 : 0.2.0 doit venir après/),
        'planned.json 0.2.0 : perdu n\'est pas dans changes/unreleased',
        'planned.json 0.3.0 : nid est aussi dans la 0.2.0',
      ]),
    );
    write(root, 'changes/planned.json', '{ cassé');
    expect(loadChanges(root).plan.errors[0]).toMatch(/illisible/);
  });

  it('previews one planned generation, the other entries staying unreleased', () => {
    const root = fixture();
    assignEntry(root, 'nid', '0.3.0');
    planVersion(root, '0.3.0', { title: 'Le nid', intro: 'Bienvenue.' });
    write(root, 'changes/unreleased/casse/entry.md', 'rien');
    assignEntry(root, 'casse', '0.3.0');
    const preview = previewRelease(loadChanges(root), { version: '0.3.0', date: '2026-10-01' });
    expect(preview.released[0]).toMatchObject({ version: '0.3.0', title: 'Le nid', intro: 'Bienvenue.' });
    expect(preview.released[0]?.entries.map((e) => e.slug)).toEqual(['nid']);
    expect(preview.unreleased.entries.map((e) => e.slug)).toEqual(['outils', 'soleil', 'casse']);
    expect(preview.next).toBe('0.4.0');
    expect(preview.plan.versions).toEqual([]);
    expect(changelog(preview)).toContain('## Génération 0.3 (v0.3.0, 2026-10-01)\n\n**Le nid**');
  });

  it('releases the entries of a planned generation only, and takes them out of the plan', () => {
    const root = fixture();
    assignEntry(root, 'nid', '0.3.0');
    assignEntry(root, 'outils', '0.3.0');
    assignEntry(root, 'soleil', '0.3.1');
    planVersion(root, '0.3.0', { title: 'Le nid' });
    const result = release(root, '0.3.0', { date: '2026-10-01' });
    expect(result).toMatchObject({ version: '0.3.0', title: 'Le nid', slugs: ['nid', 'outils'] });
    expect(result.paths).toEqual(['changes/v0.3.0', 'changes/unreleased/nid', 'changes/unreleased/outils', 'changes/planned.json', 'CHANGELOG.md', 'package.json', 'apps/client/package.json']);
    expect(existsSync(join(root, 'changes/v0.3.0/nid/entry.md'))).toBe(true);
    expect(existsSync(join(root, 'changes/unreleased/soleil/entry.md'))).toBe(true);
    expect(plan(root)).toEqual({ versions: [{ version: '0.3.1', title: '', intro: '', entries: ['soleil'] }] });
    expect(loadChanges(root).plan.errors).toEqual([]);
  });

  it('refuses a planned generation with no entry or an invalid one, whatever the other entries', () => {
    const root = fixture();
    planVersion(root, '0.3.0');
    expect(() => release(root, '0.3.0')).toThrow(/aucune entrée affectée/);
    write(root, 'changes/unreleased/casse/entry.md', 'rien');
    assignEntry(root, 'nid', '0.3.0');
    expect(release(root, '0.3.0').slugs).toEqual(['nid']);
    assignEntry(root, 'casse', '0.4.0');
    expect(() => release(root, '0.4.0')).toThrow(/entrée invalide unreleased\/casse/);
    expect(() => release(root, '0.5.0', { slugs: ['absente'] })).toThrow(/absente/);
  });
});

describe('publishing', () => {
  const git = (root: string, ...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  function repository(): string {
    const root = fixture();
    git(root, 'init', '-q');
    git(root, 'config', 'commit.gpgsign', 'false');
    git(root, 'config', 'tag.gpgsign', 'false');
    git(root, 'config', 'user.email', 'test@agents.test');
    git(root, 'config', 'user.name', 'Test');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'start');
    return root;
  }

  it('commits the paths of the release only, and tags it', () => {
    const root = repository();
    write(root, 'docs/roadmap.md', 'en cours');
    write(root, 'package-lock.json', 'modifié');
    const result = publish(root, { title: 'Le nid', trailer: 'Co-Authored-By: Test <t@agents.test>' });
    expect(result).toMatchObject({ version: '0.3.0', tag: 'v0.3.0' });
    expect(git(root, 'log', '-1', '--format=%B')).toBe('release: génération 0.3.0\n\nLe nid\n\nCo-Authored-By: Test <t@agents.test>');
    expect(git(root, 'describe', '--tags')).toBe('v0.3.0');
    expect(git(root, 'status', '--porcelain')).toBe('?? docs/\n?? package-lock.json');
    expect(git(root, 'show', '--name-status', '--format=', 'HEAD')).toContain('changes/v0.3.0/nid/img/nid.jpg');
  });

  it('refuses while something is staged, a merge is running or the tag exists', () => {
    const root = repository();
    write(root, 'docs/roadmap.md', 'en cours');
    git(root, 'add', 'docs/roadmap.md');
    expect(publishBlocker(root, '0.3.0')).toMatch(/index/);
    expect(() => publish(root)).toThrow(/index/);
    git(root, 'reset', '-q');
    writeFileSync(join(root, '.git/MERGE_HEAD'), git(root, 'rev-parse', 'HEAD'));
    expect(publishBlocker(root, '0.3.0')).toMatch(/fusion/);
    rmSync(join(root, '.git/MERGE_HEAD'));
    git(root, 'tag', 'v0.3.0');
    expect(publishBlocker(root, '0.3.0')).toMatch(/tag v0.3.0/);
    expect(existsSync(join(root, 'changes/unreleased/nid'))).toBe(true);
  });

  it('publishes a planned generation: its entries and the plan only, the other entries and edits left alone', () => {
    const root = repository();
    assignEntry(root, 'nid', '0.3.0');
    assignEntry(root, 'soleil', '0.3.1');
    planVersion(root, '0.3.0', { title: 'Le nid' });
    write(root, 'changes/unreleased/outils/entry.md', entry({ type: 'improved', title: 'Des outils', pitch: 'Pour les devs, retouché.', audience: 'developers' }));
    write(root, 'changes/unreleased/brouillon/entry.md', 'pas prêt');
    const result = publish(root, { version: '0.3.0', date: '2026-10-01' });
    expect(result).toMatchObject({ version: '0.3.0', slugs: ['nid'], tag: 'v0.3.0' });
    expect(git(root, 'log', '-1', '--format=%B')).toBe('release: génération 0.3.0\n\nLe nid');
    const committed = git(root, 'show', '--name-status', '--format=', 'HEAD');
    expect(committed).toContain('changes/planned.json');
    expect(committed).toMatch(/R100\tchanges\/unreleased\/nid\/entry.md\tchanges\/v0.3.0\/nid\/entry.md|D\tchanges\/unreleased\/nid\/entry.md/);
    expect(committed).not.toContain('outils');
    expect(committed).not.toContain('soleil');
    expect(git(root, 'status', '--porcelain').split('\n')).toEqual(['M changes/unreleased/outils/entry.md', '?? changes/unreleased/brouillon/']);
    expect(JSON.parse(git(root, 'show', 'HEAD:changes/planned.json'))).toEqual({ versions: [{ version: '0.3.1', title: '', intro: '', entries: ['soleil'] }] });
  });

  it('lists every problem before publishing, and publishes nothing then', () => {
    const root = repository();
    planVersion(root, '0.3.0');
    expect(publishProblems(root, '0.3.0')).toEqual([expect.stringMatching(/aucune entrée affectée/)]);
    write(root, 'changes/unreleased/casse/entry.md', 'rien');
    assignEntry(root, 'casse', '0.3.0');
    writeFileSync(join(root, '.git/MERGE_HEAD'), git(root, 'rev-parse', 'HEAD'));
    const problems = publishProblems(root, '0.3.0');
    expect(problems[0]).toMatch(/entrée invalide unreleased\/casse/);
    expect(problems.at(-1)).toMatch(/fusion/);
    expect(() => publish(root, { version: '0.3.0' })).toThrow(/fusion/);
    expect(git(root, 'tag')).toBe('');
    expect(existsSync(join(root, 'changes/v0.3.0'))).toBe(false);
  });
});
