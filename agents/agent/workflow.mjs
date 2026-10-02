// The workflow of the dashboard, as its navigation shows it on every page (nav.js): four stages, Backlog → Agents →
// À valider → Publier, each with its live counts, and « Pour toi », what waits for the user's gesture. Pure: the
// dashboard hands it its facts (/api/nav).

const RECENT_MS = 10 * 60_000;

/**
 * Where an agent stands: queued, working, review (over, its work waits for « Accepter »), error, merged (accepted),
 * idle. `agent`: an agent of the dashboard's snapshot; `entry`: its queue entry, if any.
 */
export function agentStage(agent, entry = null, now = Date.now()) {
  const run = agent.run ?? entry?.run ?? null;
  const events = agent.progress?.events ?? [];
  const recent = agent.activity && now - agent.activity < RECENT_MS;
  if (entry?.status === 'queued') return 'queued';
  if (agent.AGENT_ARCHIVED) return 'merged';
  if (run?.state === 'running') return 'working';
  if (run?.state === 'error' || run?.state === 'lost') return 'error';
  if (events.at(-1)?.kind === 'error' && /API Error/.test(events.at(-1).text ?? '')) return 'error';
  if (run?.state === 'done' || agent.progress?.finished || (agent.report && !agent.reportInterim && !agent.dirty?.length && !recent)) return 'review';
  return recent ? 'working' : 'idle';
}

/**
 * The counts of each stage and the list of what waits for the user. `agents`: the snapshot's; `queue`: the queue
 * entries; `tasks`: the backlog's tasks with their state; `news`: the tasks new or changed since the last refresh;
 * `questions`: the pending ones.
 */
export function navState({ agents = [], queue = [], tasks = [], news = 0, questions = [], now = Date.now() }) {
  const staged = agents.map((agent) => {
    const name = agent.AGENT_NAME;
    const entry = queue.find((one) => one.name === name) ?? null;
    return { name, stage: agentStage(agent, entry, now), title: agent.goal?.title || entry?.title || name, said: [...(agent.progress?.events ?? [])].reverse().find((e) => e.kind === 'say')?.text?.split('\n')[0] ?? '' };
  });
  for (const entry of queue) if (entry.status === 'queued' && !staged.some((one) => one.name === entry.name)) staged.push({ name: entry.name, stage: 'queued', title: entry.title ?? entry.name, said: '' });
  const count = (stage) => staged.filter((one) => one.stage === stage).length;
  const forYou = [
    ...questions.map((q) => ({ kind: q.type === 'feedback' ? 'feedback' : 'question', agent: q.agent, title: q.title, url: '/questions' })),
    ...staged.filter((one) => one.stage === 'error').map((one) => ({ kind: 'error', agent: one.name, title: one.title, url: `/agents#${one.name}` })),
    ...staged.filter((one) => one.stage === 'review').map((one) => ({ kind: 'review', agent: one.name, title: one.title, detail: one.said, url: `/agents#${one.name}` })),
  ];
  return {
    backlog: { todo: tasks.filter((task) => task.state === 'todo').length, news },
    agents: { working: count('working'), queued: count('queued'), idle: count('idle') },
    validate: { review: count('review'), error: count('error') },
    forYou,
  };
}
