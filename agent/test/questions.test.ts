import '../../test/env.mjs';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  answerQuestion,
  counts,
  createQuestion,
  decideAlone,
  expireStale,
  formatAnswer,
  isAutonomous,
  listQuestions,
  markRead,
  normalizeInput,
  readQuestion,
  readSettings,
  waitForAnswer,
  withdrawQuestion,
  writeSettings,
} from '../questions.mjs';

const run = promisify(execFile);
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

// A throwaway registry, asking the user (the default is to decide alone).
function registry(autonomous = false): string {
  const root = mkdtempSync(join(tmpdir(), 'agents-questions-'));
  roots.push(root);
  writeSettings(root, { autonomous });
  return root;
}

const T0 = Date.parse('2026-09-28T10:00:00Z');
const choice = { type: 'choice', agent: 'nid', title: 'Quelle forme ?', context: 'ctx', impact: 'tout', options: [{ label: 'A' }, { label: 'B', recommended: true }, { label: 'C' }] };

describe('input', () => {
  it('puts the recommended option first', () => {
    const q = normalizeInput(choice);
    expect(q.options.map((o: { label: string }) => o.label)).toEqual(['B', 'A', 'C']);
    expect(q.options[0].recommended).toBe(true);
    expect(normalizeInput({ ...choice, options: ['x', 'y'] }).options[0]).toMatchObject({ label: 'x', recommended: true });
  });

  it('refuses what an agent forgot', () => {
    expect(() => normalizeInput({ ...choice, type: 'poll' })).toThrow(/type inconnu/);
    expect(() => normalizeInput({ ...choice, title: '' })).toThrow(/--title/);
    expect(() => normalizeInput({ ...choice, options: [{ label: 'seul' }] })).toThrow(/deux options/);
    expect(() => normalizeInput({ ...choice, agent: '' })).toThrow(/agent/);
    expect(() => normalizeInput({ type: 'feedback', agent: 'nid', title: 'x', severity: 'grave' })).toThrow(/gravité/);
  });
});

describe('lifecycle', () => {
  it('creates, lists, answers a choice', () => {
    const root = registry();
    const q = createQuestion(root, choice, { now: T0 });
    expect(q).toMatchObject({ status: 'pending', agent: 'nid', createdAt: '2026-09-28T10:00:00.000Z', expiresAt: '2026-09-28T10:30:00.000Z' });
    expect(listQuestions(root, { status: 'pending' }).map((x: { id: string }) => x.id)).toEqual([q.id]);
    const answered = answerQuestion(root, q.id, { option: 2, comment: 'plus simple' }, { now: T0 + 1000 });
    expect(answered.status).toBe('answered');
    expect(answered.answer).toMatchObject({ by: 'user', option: 2, label: 'C', comment: 'plus simple' });
    expect(() => answerQuestion(root, q.id, { option: 0 })).toThrow(/déjà close/);
    expect(formatAnswer(answered)).toMatch(/choice: 3\. C[\s\S]*comment: plus simple/);
  });

  it('accepts a free answer, refuses an empty one', () => {
    const root = registry();
    const q = createQuestion(root, choice);
    expect(() => answerQuestion(root, q.id, {})).toThrow(/choisis/);
    expect(() => answerQuestion(root, q.id, { option: 9 })).toThrow(/option invalide/);
    expect(answerQuestion(root, q.id, { comment: 'autre chose' }).answer).toMatchObject({ option: null, comment: 'autre chose' });
  });

  it('validates yes or no', () => {
    const root = registry();
    const q = createQuestion(root, { type: 'validation', agent: 'nid', title: 'Je supprime ?', recommended: 'no' });
    expect(q.recommended).toBe('no');
    expect(() => answerQuestion(root, q.id, { comment: 'bof' })).toThrow(/oui ou non/);
    expect(formatAnswer(answerQuestion(root, q.id, { approved: true }))).toMatch(/approved: yes/);
  });

  it('feedback never waits, and is marked read', async () => {
    const root = registry();
    const q = createQuestion(root, { type: 'feedback', agent: 'nid', title: 'Attention', severity: 'critical' });
    expect(q).toMatchObject({ status: 'pending', severity: 'critical' });
    expect(q.expiresAt).toBeUndefined();
    expect((await waitForAnswer(root, q.id, { waitMs: 60_000 })).status).toBe('pending');
    expect(counts(listQuestions(root))).toEqual({ pending: 0, unread: 1, byAgent: { nid: { pending: 0, unread: 1 } } });
    expect(() => answerQuestion(root, q.id, { option: 0 })).toThrow(/marque-le lu/);
    expect(markRead(root, q.id).answer).toMatchObject({ read: true });
    expect(counts(listQuestions(root)).unread).toBe(0);
  });

  it('withdraws', () => {
    const root = registry();
    const q = createQuestion(root, choice);
    expect(withdrawQuestion(root, q.id, { reason: 'plus besoin' })).toMatchObject({ status: 'withdrawn' });
    expect(formatAnswer(readQuestion(root, q.id))).toMatch(/retirée \(plus besoin\)/);
  });

  it('filters and counts per agent', () => {
    const root = registry();
    createQuestion(root, choice, { now: T0 });
    createQuestion(root, { ...choice, agent: 'eau' }, { now: T0 + 1 });
    createQuestion(root, { type: 'feedback', agent: 'eau', title: 'x' }, { now: T0 + 2 });
    expect(listQuestions(root, { agent: 'eau' })).toHaveLength(2);
    expect(listQuestions(root, { type: 'choice' })).toHaveLength(2);
    expect(listQuestions(root)[0].type).toBe('feedback'); // newest first
    expect(counts(listQuestions(root)).byAgent).toEqual({ nid: { pending: 1, unread: 0 }, eau: { pending: 1, unread: 1 } });
  });
});

describe('autonomous mode', () => {
  it('is on by default: the recommended option at once, recorded as auto', () => {
    const root = mkdtempSync(join(tmpdir(), 'agents-questions-'));
    roots.push(root);
    expect(readSettings(root).autonomous).toBe(true);
    const q = createQuestion(root, choice);
    expect(q.status).toBe('auto');
    expect(q.answer).toMatchObject({ by: 'auto', reason: 'autonomous', option: 0, label: 'B' });
    expect(formatAnswer(q)).toMatch(/Décider seul[\s\S]*option recommandée/);
    const v = createQuestion(root, { type: 'validation', agent: 'nid', title: 'ok ?', recommended: 'no' });
    expect(v.answer.approved).toBe(false);
  });

  it('can be overridden per agent', () => {
    const root = registry(true);
    writeSettings(root, { agents: { nid: false } });
    expect(isAutonomous(readSettings(root), 'nid')).toBe(false);
    expect(isAutonomous(readSettings(root), 'eau')).toBe(true);
    expect(createQuestion(root, choice).status).toBe('pending');
    expect(createQuestion(root, { ...choice, agent: 'eau' }).status).toBe('auto');
    writeSettings(root, { agents: { nid: null }, autonomous: false });
    expect(readSettings(root).agents).toEqual({});
    writeSettings(root, { agents: { eau: true } });
    expect(isAutonomous(readSettings(root), 'eau')).toBe(true);
    expect(isAutonomous(readSettings(root), 'nid')).toBe(false);
  });

  it('turned on while an agent waits settles its question', async () => {
    const root = registry();
    const q = createQuestion(root, choice, { now: T0 });
    let now = T0;
    const settled = await waitForAnswer(root, q.id, {
      waitMs: 60_000,
      clock: () => now,
      sleep: async (ms: number) => {
        now += ms;
        if (now > T0 + 5000) writeSettings(root, { autonomous: true });
      },
    });
    expect(settled).toMatchObject({ status: 'auto', answer: { reason: 'autonomous' } });
  });
});

describe('waiting', () => {
  it('returns the user answer given meanwhile', async () => {
    const root = registry();
    const q = createQuestion(root, choice, { now: T0 });
    let now = T0;
    const settled = await waitForAnswer(root, q.id, {
      clock: () => now,
      sleep: async (ms: number) => {
        now += ms;
        if (now === T0 + 3000) answerQuestion(root, q.id, { option: 1 });
      },
    });
    expect(settled.answer).toMatchObject({ by: 'user', label: 'A' });
  });

  it('gives back a pending question when this call wait runs out, at most 9 minutes', async () => {
    const root = registry();
    const q = createQuestion(root, choice, { now: T0, timeoutMinutes: 60 });
    let now = T0;
    const settled = await waitForAnswer(root, q.id, { waitMs: 3_600_000, pollMs: 10_000, clock: () => now, sleep: async (ms: number) => void (now += ms) });
    expect(settled.status).toBe('pending');
    expect(now - T0).toBe(9 * 60_000);
    expect(formatAnswer(settled)).toMatch(/--resume/);
  });

  it('goes on with the recommended option past the deadline', async () => {
    const root = registry();
    const q = createQuestion(root, choice, { now: T0, timeoutMinutes: 2 });
    let now = T0;
    const settled = await waitForAnswer(root, q.id, { waitMs: 300_000, pollMs: 10_000, clock: () => now, sleep: async (ms: number) => void (now += ms) });
    expect(settled).toMatchObject({ status: 'auto', answer: { by: 'auto', reason: 'timeout', label: 'B' } });
    expect(now - T0).toBe(120_000);
    expect(formatAnswer(settled)).toMatch(/à temps/);
  });
});

describe('expiry', () => {
  it('marks as expired the questions nobody waits for any more', () => {
    const root = registry();
    const old = createQuestion(root, choice, { now: T0, timeoutMinutes: 5 });
    const fresh = createQuestion(root, choice, { now: T0, timeoutMinutes: 60 });
    const feedback = createQuestion(root, { type: 'feedback', agent: 'nid', title: 'x' }, { now: T0 });
    expect(expireStale(root, { now: T0 + 10 * 60_000, graceMs: 60_000 }).map((q: { id: string }) => q.id)).toEqual([old.id]);
    expect(readQuestion(root, old.id)).toMatchObject({ status: 'expired', answer: { by: 'auto', label: 'B' } });
    expect(readQuestion(root, fresh.id).status).toBe('pending');
    expect(readQuestion(root, feedback.id).status).toBe('pending');
    expect(() => decideAlone(root, old.id, 'timeout')).toThrow(/déjà close/);
  });
});

describe('ask.mjs', () => {
  const ask = (root: string, ...args: string[]) =>
    run('node', [join(__dirname, '../ask.mjs'), ...args], { env: { ...process.env, AGENT_REGISTRY: root, AGENT_NAME: 'nid' } });

  it('asks, then resumes and gets the answer', async () => {
    const root = registry();
    const first = await ask(root, 'choice', '--title', 'Forme ?', '--option', 'A :: simple', '--option', '*B :: riche', '--wait', '0');
    const id = /^id: (\S+)$/m.exec(first.stdout)![1];
    expect(first.stdout).toMatch(/status: pending/);
    expect(readQuestion(root, id).options[0]).toMatchObject({ label: 'B', description: 'riche', recommended: true });
    answerQuestion(root, id, { option: 1, comment: 'garde simple' });
    const second = await ask(root, '--resume', id);
    expect(second.stdout).toMatch(/status: answered[\s\S]*choice: 2\. A[\s\S]*comment: garde simple/);
  });

  it('answers at once in autonomous mode, never blocks on feedback, reports errors', async () => {
    const root = registry(true);
    expect((await ask(root, 'validation', '--title', 'OK ?')).stdout).toMatch(/status: auto[\s\S]*approved: yes/);
    writeSettings(root, { autonomous: false });
    expect((await ask(root, 'feedback', '--title', 'Info', '--severity', 'important')).stdout).toMatch(/type: feedback[\s\S]*rien à attendre/);
    await expect(ask(root, 'choice', '--title', 'x')).rejects.toMatchObject({ code: 2 });
  });

  it('lists and withdraws', async () => {
    const root = registry();
    const q = createQuestion(root, choice);
    expect((await ask(root, '--list')).stdout).toContain(q.id);
    expect((await ask(root, '--withdraw', q.id, '--reason', 'caduque')).stdout).toMatch(/status: withdrawn/);
  });
});

describe('dashboard routes', () => {
  it('lists, counts, answers and switches over HTTP', async () => {
    const root = registry();
    const { handleQuestions } = await import('../questions-routes.mjs');
    const { createServer } = await import('node:http');
    const server = createServer((request, response) => {
      handleQuestions(request, response, root).then((handled: boolean) => {
        if (!handled) (response.writeHead(404), response.end());
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const post = (path: string, body: unknown) => fetch(base + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
    try {
      const q = createQuestion(root, choice);
      createQuestion(root, { type: 'feedback', agent: 'eau', title: 'x' });
      const list = await (await fetch(`${base}/api/questions`)).json();
      expect(list).toMatchObject({ pending: 1, unread: 1, settings: { autonomous: false } });
      expect((await (await fetch(`${base}/api/questions?agent=eau`)).json()).questions).toHaveLength(1);
      expect(await post(`/api/questions/${q.id}/answer`, { option: 0 })).toMatchObject({ ok: true, question: { status: 'answered' } });
      expect(await post(`/api/questions/${q.id}/answer`, { option: 0 })).toMatchObject({ ok: false });
      expect(await post('/api/questions/settings', { autonomous: true, agents: { nid: false } })).toMatchObject({ autonomous: true, agents: { nid: { autonomous: false } } });
      expect((await fetch(`${base}/questions`)).headers.get('content-type')).toMatch(/html/);
      expect((await fetch(`${base}/elsewhere`)).status).toBe(404);
    } finally {
      server.close();
    }
  });
});
