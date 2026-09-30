import '../../test/env.mjs';
import { describe, expect, it } from 'vitest';
import { agentStatus, buildSnapshot } from '../mirror.mjs';

const NOW = Date.parse('2026-09-30T10:00:00Z');

describe('the mirror of the dashboard', () => {
  it('reads an agent’s state like its card', () => {
    expect(agentStatus({ run: { state: 'running' } }, NOW)).toBe('working');
    expect(agentStatus({ run: { state: 'error' } }, NOW)).toBe('error');
    expect(agentStatus({ AGENT_ARCHIVED: '2026', run: { state: 'running' } }, NOW)).toBe('archived');
    expect(agentStatus({ activity: NOW - 60_000 }, NOW)).toBe('working');
    expect(agentStatus({ activity: NOW - 3_600_000 }, NOW)).toBe('calm');
    expect(agentStatus({ report: '# R', dirty: [], activity: NOW - 3_600_000 }, NOW)).toBe('done');
    expect(agentStatus({ progress: { finished: true } }, NOW)).toBe('done');
  });

  it('keeps what a phone needs, cut short, and leaves prompts, logs and paths out', () => {
    const snap = buildSnapshot(
      {
        agents: {
          agents: [
            { AGENT_NAME: 'calme', AGENT_DIR: '/secret/calme', activity: NOW - 3_600_000, commits: [], dirty: [] },
            {
              AGENT_NAME: 'grotte', AGENT_BRANCH: 'agent/grotte', AGENT_DIR: '/secret/grotte', run: { state: 'running', code: null, pid: 12 },
              settings: { effort: 'xhigh', model: 'opus' }, goal: { title: 'Grottes', where: 'Backlog' }, report: 'x'.repeat(5000), serverLog: 'log',
              progress: { events: Array.from({ length: 9 }, (_, i) => ({ time: i, kind: 'tool', text: `étape ${i} ${'y'.repeat(300)}` })) },
              commits: [{ subject: 'feat: caves' }], dirty: ['a'], deliverables: { report: true, entry: false, captures: 2, behind: 0, base: 'backlog' },
            },
          ],
        },
        questions: { unread: 1, settings: { autonomous: false }, questions: [
          { id: 'q1', type: 'choice', agent: 'grotte', title: 'Forme ?', context: 'c', status: 'pending', options: [{ label: 'A', description: 'pourquoi', recommended: true }, { label: 'B', recommended: false }] },
          { id: 'q2', type: 'feedback', agent: 'grotte', title: 'Info', status: 'pending' },
          { id: 'q3', type: 'choice', agent: 'grotte', title: 'Vieille', status: 'answered' },
        ] },
        roadmap: { queue: [{ name: 'grotte', title: 'Grottes', status: 'launched', prompt: 'SECRET PROMPT', effort: 'xhigh', run: { state: 'running' } }], items: [
          { kind: 'section', title: 'S' },
          { kind: 'task', title: 'Grottes', status: 'active', label: 'en cours', agent: 'grotte', section: 'S' },
          { kind: 'task', title: 'Nids', status: 'new', label: 'à faire', section: 'S' },
          { kind: 'task', title: 'Vieux', status: 'done', label: 'livré', section: 'Livré' },
        ] },
        versions: { current: '0.3.0', proposal: '0.4.0', pending: [{ slug: 'nid', type: 'new', title: 'Des nids' }], planned: [], released: [{ version: '0.3.0', generation: 'Génération 0.3', date: '2026-09-30', entries: [1, 2] }] },
        hub: { summary: { backlog: { sha: 'abc', subject: 'Merge', time: NOW, ahead: 3 }, figures: [{ icon: '🎮', value: 4, text: 'créatures' }] } },
      },
      NOW,
    );
    expect(snap.project).toBe('Jeu de test');
    expect(snap.word).toBe('génération');
    expect(snap.summary).toMatchObject({ working: 1, agents: 2, questions: 1, unread: 1, queued: 0, pending: 1, figures: [{ value: 4 }] });
    expect(snap.agents.map((agent: { name: string }) => agent.name)).toEqual(['grotte', 'calme']);
    const grotte = snap.agents[0];
    expect(grotte).toMatchObject({ status: 'working', effort: 'xhigh', model: 'opus', commits: 1, dirty: 1, lastCommit: 'feat: caves', deliverables: { report: true, captures: 2, behind: 0 } });
    expect(grotte.events).toHaveLength(6);
    expect(grotte.task.length).toBeLessThanOrEqual(280);
    expect(snap.questions.waiting.map((question: { id: string }) => question.id)).toEqual(['q1', 'q2']);
    expect(snap.questions.waiting[0].options).toEqual([{ label: 'A', why: 'pourquoi', recommended: true }, { label: 'B', why: null, recommended: false }]);
    expect(snap.backlog.counts).toEqual({ todo: 1, active: 1, merged: 0, done: 1, paused: 0 });
    expect(snap.versions.released[0]).toMatchObject({ name: 'Génération 0.3', entries: 2 });
    const text = JSON.stringify(snap);
    for (const secret of ['/secret/', 'SECRET PROMPT', 'xxxxx', '"log"']) expect(text).not.toContain(secret);
  });
});
