import '../../test/env.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { agents, context, conversation, inbox, related, run, say, task, tasks, who } from '../team.mjs';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

// A main checkout with a backlog, and two agents whose branches change files of their own and one in common.
function team() {
  const root = mkdtempSync(join(tmpdir(), 'agents-team-'));
  folders.push(root);
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('symbolic-ref', 'HEAD', 'refs/heads/backlog');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  mkdirSync(join(root, 'docs'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'docs/backlog.md'), '# Backlog\n\n## Jeu\n\n### Danse\n> 🔵 en cours · agent danse\n\nDans `src/main.ts`.\n\n### Parents qui dansent\n> ⚪ à faire\n> ↳ après « Danse »\n\nSuite.\n\n### Amis\n> 🔵 en cours · agent amis\n\nAmis.\n');
  writeFileSync(join(root, 'src/main.ts'), 'a\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  const registry = join(root, '.git', 'agents');
  mkdirSync(registry);
  for (const [name, files] of [['danse', ['src/main.ts', 'src/danse.ts']], ['amis', ['src/main.ts', 'src/amis.ts']]] as const) {
    git('checkout', '-q', '-b', `agent/${name}`, base);
    for (const file of files) writeFileSync(join(root, file), `${name}\n`);
    git('add', '.');
    git('commit', '-q', '-m', name);
    writeFileSync(join(registry, `${name}.env`), `AGENT_NAME=${name}\nAGENT_BRANCH=agent/${name}\nAGENT_BASE=${base}\n`);
  }
  git('checkout', '-q', 'backlog');
  const env = { AGENT_REGISTRY: registry, AGENT_NAME: 'danse' } as NodeJS.ProcessEnv;
  return { root, registry, env, ctx: context({ cwd: root, env }) };
}

describe('team', () => {
  it('lists the tasks as they stand, and one task in full', () => {
    const { ctx } = team();
    expect(tasks(ctx).map((one) => `${one.title}<${one.after ?? ''}`)).toEqual(['Danse<', 'Parents qui dansent<danse', 'Amis<']);
    expect(task(ctx, 'danse')).toMatchObject({ title: 'Danse', subtasks: ['Parents qui dansent'] });
  });

  it('knows each agent\'s own files, who shares a file, and what is related to my work', () => {
    const { ctx } = team();
    expect(agents(ctx).find((one) => one.name === 'amis')).toMatchObject({ state: 'en pause', task: { title: 'Amis' }, files: ['src/amis.ts', 'src/main.ts'] });
    expect(who(ctx, 'src/main.ts')).toEqual([{ name: 'amis', state: 'en pause', task: 'Amis', files: ['src/main.ts'] }]);
    expect(who(ctx, 'src/danse.ts')).toEqual([]);
    const mine = related(ctx);
    expect(mine.sharing).toEqual([{ name: 'amis', state: 'en pause', task: 'Amis', files: ['src/main.ts'] }]);
    expect(mine.family).toMatchObject([{ title: 'Parents qui dansent', relation: 'sous-tâche' }]);
  });

  it('carries messages between agents, read once, and to everyone', () => {
    const { ctx, env, root } = team();
    say(ctx, 'amis', 'Je touche main.ts : je garde ta fonction, j’ajoute la mienne à côté.', { about: 'src/main.ts' });
    const amis = context({ cwd: root, env: { ...env, AGENT_NAME: 'amis' } });
    expect(inbox(amis)).toMatchObject([{ from: 'danse', to: 'amis', about: 'src/main.ts' }]);
    expect(inbox(amis)).toEqual([]);
    expect(inbox(amis, { all: true })).toHaveLength(1);
    say(amis, 'tous', 'Je merge backlog dans 5 min.');
    expect(inbox(ctx).map((one) => one.text)).toEqual(['Je merge backlog dans 5 min.']);
    expect(conversation(ctx, 'amis').map((one) => `${one.from}>${one.to}`)).toEqual(['danse>amis', 'amis>tous']);
    expect(() => say(ctx, 'personne', 'x')).toThrow(/inconnu/);
    expect(run(['say', 'amis', 'salut', '--json'], { cwd: root, env })).toMatchObject({ command: 'say', json: true, result: { delivered: ['amis'] } });
  });
});
