import '../../test/env.mjs';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { askAboutTask, chatArgs, chatKey, chatPrompt, clearChat, markApplied, markCreated, readChat, splitAnswer } from '../task-chat.mjs';

// A fake `claude`: notes its arguments and stdin, answers like `claude -p --output-format json` (FAKE_ANSWER).
const FAKE = `#!/bin/sh
printf '%s\\n' "$@" >>"$FAKE_DIR/args"
cat >>"$FAKE_DIR/stdin"
echo "---" >>"$FAKE_DIR/stdin"
node -e 'console.log(JSON.stringify({ type: "result", is_error: false, result: process.env.FAKE_ANSWER, total_cost_usd: 0.01 }))'
`;

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'agents-chat-'));
  folders.push(base);
  const bin = join(base, 'claude');
  writeFileSync(bin, FAKE);
  chmodSync(bin, 0o755);
  return { base, registry: join(base, 'registry'), bin };
}

async function until(check: () => boolean, ms = 5000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timeout');
    await new Promise((done) => setTimeout(done, 25));
  }
}

const task = { id: 'nid', title: 'Nid', section: 'Suites', text: '### Nid\n\nGérer les machines à distance.' };

describe('task chat', () => {
  it('splits an answer into its text and its last proposal', () => {
    expect(splitAnswer('Voici.\n\n```tache\n### Nid\n\nMieux.\n```\n\nJ’ai précisé.')).toEqual({ text: 'Voici.\n\nJ’ai précisé.', proposal: '### Nid\n\nMieux.' });
    expect(splitAnswer('Juste une question ?')).toEqual({ text: 'Juste une question ?', proposal: null });
  });

  it('splits out the proposed sub-tasks, each a task of its own, in order', () => {
    const answer = 'Deux idées.\n\n```sous-tache\n### Les œufs\n\nPondre.\n```\n\n```sous-tâche\n### Les nids\n\nBâtir.\n```\n\n```sous-tache\npas de titre\n```';
    expect(splitAnswer(answer)).toEqual({ text: 'Deux idées.', proposal: null, subtasks: ['### Les œufs\n\nPondre.', '### Les nids\n\nBâtir.'] });
  });

  it('tells Claude how to propose sub-tasks, and which ones the task has, in both threads', () => {
    const subtasks = [{ title: 'Les œufs', state: 'todo', label: 'à faire', auto: true }];
    const own = chatPrompt({ task, message: 'Découpe-le', first: true, root: '/repo', subtasks });
    expect(own).toContain('```sous-tache');
    expect(own).toContain('Ne mets jamais une sous-tâche dans le texte du chantier');
    expect(own).toContain('« Les œufs » (à faire, lancée d’elle-même');
    const brainstorm = chatPrompt({ task, message: 'Idées ?', first: true, root: '/repo', mode: 'subtasks' });
    expect(brainstorm).toContain('découper un chantier en sous-tâches');
    expect(brainstorm).toContain('pas encore de sous-tâche');
    expect(chatKey('nid', 'subtasks')).toBe('nid--sous-taches');
    expect(chatKey('nid')).toBe('nid');
  });

  it('gives Claude read-only tools, and the task as it stands on every turn', () => {
    expect(chatArgs({ sessionId: 's', resume: false })).toEqual(['-p', '--session-id', 's', '--tools', 'Read,Grep,Glob', '--allowedTools', 'Read,Grep,Glob', '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--output-format', 'json']);
    expect(chatArgs({ sessionId: 's', resume: true }).slice(0, 3)).toEqual(['-p', '--resume', 's']);
    const first = chatPrompt({ task, message: 'Découpe-le', first: true, root: '/repo' });
    expect(first).toContain('```tache');
    expect(first).toContain('### Nid\n\nGérer les machines à distance.');
    expect(chatPrompt({ task, message: 'Et après ?', first: false, root: '/repo' })).not.toContain('```tache');
  });

  it('records a turn, answers in the background, resumes the same session, marks and clears', async () => {
    const { base, registry, bin } = setup();
    const env = { PATH: process.env.PATH ?? '', AGENTS_CLAUDE_BIN: bin, FAKE_DIR: base, FAKE_ANSWER: 'Proposé.\n\n```tache\n### Nid\n\nMachines gérées de loin.\n```' };
    const started = askAboutTask({ registry, root: base, task, message: 'Précise-le', env });
    expect(started).toMatchObject({ pending: true, messages: [{ role: 'user', text: 'Précise-le' }] });
    expect(() => askAboutTask({ registry, root: base, task, message: 'encore', env })).toThrow(/répond encore/);
    await until(() => !readChat(registry, 'nid').pending);
    const chat = readChat(registry, 'nid');
    expect(chat.messages[1]).toMatchObject({ role: 'assistant', text: 'Proposé.', proposal: '### Nid\n\nMachines gérées de loin.', cost: 0.01 });
    askAboutTask({ registry, root: base, task, message: 'Merci', env });
    await until(() => !readChat(registry, 'nid').pending);
    const args = readFileSync(join(base, 'args'), 'utf8').split('\n');
    expect(args.filter((arg) => arg === chat.sessionId)).toHaveLength(2);
    expect(args).toContain('--resume');
    expect(markApplied(registry, 'nid', 1).messages[1].appliedAt).toBeTruthy();
    expect(clearChat(registry, 'nid').messages).toEqual([]);
    expect(() => askAboutTask({ registry, root: base, task, message: '  ', env })).toThrow(/vide/);
  });

  it('keeps the error of a failed turn', async () => {
    const { base, registry } = setup();
    askAboutTask({ registry, root: base, task, message: 'Allô', env: { PATH: process.env.PATH ?? '', AGENTS_CLAUDE_BIN: join(base, 'absent') } });
    await until(() => !readChat(registry, 'nid').pending);
    expect(readChat(registry, 'nid').messages[1].error).toBeTruthy();
  });
});
