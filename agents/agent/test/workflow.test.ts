import '../../test/env.mjs';
import { describe, expect, it } from 'vitest';
import { agentStage, navState } from '../workflow.mjs';

const now = Date.parse('2026-10-02T12:00:00Z');
const agent = (name: string, extra: Record<string, unknown> = {}) => ({ AGENT_NAME: name, goal: { title: `Tâche ${name}` }, progress: { events: [] }, dirty: [], ...extra });

describe('workflow', () => {
  it('puts each agent at its stage', () => {
    expect(agentStage(agent('a', { run: { state: 'running' } }), null, now)).toBe('working');
    expect(agentStage(agent('a', { run: { state: 'done' } }), null, now)).toBe('review');
    expect(agentStage(agent('a', { run: { state: 'lost' } }), null, now)).toBe('error');
    expect(agentStage(agent('a', { AGENT_ARCHIVED: 'x', run: { state: 'done' } }), null, now)).toBe('merged');
    expect(agentStage(agent('a'), { status: 'queued' }, now)).toBe('queued');
    // An interim report (« > 🚧 En cours ») is not a finished agent.
    expect(agentStage(agent('a', { report: '# x\n> 🚧 En cours : la suite', reportInterim: true, activity: now - 3600_000 }), null, now)).toBe('idle');
    expect(agentStage(agent('a', { report: '# x', activity: now - 3600_000 }), null, now)).toBe('review');
  });

  it('counts the stages and lists what waits for the user', () => {
    const state = navState({
      now,
      agents: [agent('a', { run: { state: 'running' } }), agent('b', { run: { state: 'done' }, progress: { events: [{ kind: 'say', text: 'Fini.\nDétails' }] } }), agent('c', { run: { state: 'error' } })],
      queue: [{ name: 'd', status: 'queued', title: 'Tâche d' }],
      tasks: [{ state: 'todo' }, { state: 'todo' }, { state: 'active' }],
      news: 3,
      questions: [{ type: 'choice', agent: 'a', title: 'Quel format ?' }],
    });
    expect(state.backlog).toEqual({ todo: 2, news: 3 });
    expect(state.agents).toEqual({ working: 1, queued: 1, idle: 0 });
    expect(state.validate).toEqual({ review: 1, error: 1 });
    expect(state.forYou.map((one: { kind: string; agent: string }) => `${one.kind}:${one.agent}`)).toEqual(['question:a', 'error:c', 'review:b']);
    expect(state.forYou[2]).toMatchObject({ detail: 'Fini.', url: '/agents#b' });
  });
});
