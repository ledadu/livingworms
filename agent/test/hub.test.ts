import '../../test/env.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  agentCounts,
  anchor,
  decideAlone,
  docPath,
  FLOWS,
  flowGeometry,
  hubMap,
  jsonBody,
  MAP_SIZE,
  NODE_SIZE,
  NODES,
  nodeLinks,
  nodeStates,
  pageExists,
  pendingQuestions,
  releaseSummary,
  roadmapBacklog,
  roadmapSync,
  unreadFeedback,
  roundedPath,
  ZONES,
} from '../hub.mjs';
import { metricsPlayers } from '../../test/fixture.config.mjs';

const NOW = 1_800_000_000_000;

describe('hub map', () => {
  const inside = (node: { x: number; y: number }, [x, y, w, h]: number[]) =>
    node.x >= x && node.y >= y && node.x + NODE_SIZE.w <= x + w && node.y + NODE_SIZE.h <= y + h;

  it('keeps every node inside its zone and the zones inside the map', () => {
    for (const node of NODES) {
      const zone = ZONES.find((z) => z.id === node.zone);
      expect(zone, node.id).toBeTruthy();
      expect(inside(node, zone!.box), node.id).toBe(true);
    }
    for (const zone of ZONES) {
      const [x, y, w, h] = zone.box;
      expect(x >= 0 && y >= 0 && x + w <= MAP_SIZE.width && y + h <= MAP_SIZE.height, zone.id).toBe(true);
    }
  });

  it('never overlaps two nodes or two zones', () => {
    const overlap = (a: number[], b: number[]) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
    const boxes = NODES.map((n) => [n.x, n.y, NODE_SIZE.w, NODE_SIZE.h]);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!), `${NODES[i]!.id} ${NODES[j]!.id}`).toBe(false);
    for (let i = 0; i < ZONES.length; i++) for (let j = i + 1; j < ZONES.length; j++) expect(overlap(ZONES[i]!.box, ZONES[j]!.box)).toBe(false);
  });

  it('gives every node a unique id, an icon, a role and a link', () => {
    expect(new Set(NODES.map((n) => n.id)).size).toBe(NODES.length);
    for (const node of NODES) {
      expect(node.icon && node.name && node.role && node.href, node.id).toBeTruthy();
      expect(node.role.length, node.id).toBeGreaterThan(20);
    }
  });

  it('tells the whole cycle, from the roadmap back to the roadmap', () => {
    const cycle = FLOWS.filter((flow) => !flow.side);
    expect(cycle[0]!.from).toBe('roadmap');
    expect(cycle[cycle.length - 1]!.to).toBe('roadmap');
    for (let i = 1; i < cycle.length; i++) expect(cycle[i]!.from, `step ${i + 1}`).toBe(cycle[i - 1]!.to);
    // Every zone takes part in it.
    const zones = new Set(cycle.flatMap((flow) => [flow.from, flow.to]).map((id) => NODES.find((n) => n.id === id)!.zone));
    expect([...zones].sort()).toEqual(ZONES.map((z) => z.id).sort());
  });

  it('numbers the steps of the cycle and draws every flow', () => {
    const map = hubMap();
    expect(map.flows.filter((f) => f.step).map((f) => f.step)).toEqual(FLOWS.filter((f) => !f.side).map((_, i) => i + 1));
    for (const flow of map.flows) {
      expect(flow.d).toMatch(/^M[\d.]+,[\d.]+ /);
      expect(flow.d).not.toContain('NaN');
      expect(flow.at.x).toBeGreaterThanOrEqual(0);
      expect(flow.at.x).toBeLessThanOrEqual(MAP_SIZE.width);
    }
    // The map sent to the page does not carry the fallback documents.
    expect(map.nodes.every((node: object) => !('doc' in node))).toBe(true);
  });

  it('leaves a node by the side facing its target', () => {
    const node = { x: 100, y: 100 };
    expect(anchor(node, [600, 132]).side).toBe('right');
    expect(anchor(node, [-300, 132]).side).toBe('left');
    expect(anchor(node, [186, 400]).side).toBe('bottom');
    expect(anchor(node, [150, 0]).side).toBe('top');
    expect(anchor(node, [0, 0], 'right', 0.25)).toEqual({ x: 100 + NODE_SIZE.w, y: 100 + NODE_SIZE.h * 0.25, side: 'right' });
  });

  it('joins the two nodes of a flow and rounds the corners of a detour', () => {
    const geometry = flowGeometry({ from: 'tasks', to: 'agents' });
    const tasks = NODES.find((n) => n.id === 'tasks')!;
    const agents = NODES.find((n) => n.id === 'agents')!;
    expect(geometry.d.startsWith(`M${tasks.x + NODE_SIZE.w},`)).toBe(true);
    expect(geometry.d.endsWith(`${agents.x},${agents.y + NODE_SIZE.h / 2}`)).toBe(true);
    expect(roundedPath([[0, 0], [100, 0], [100, 100]], 10)).toBe('M0,0 L90,0 Q100,0 100,10 L100,100');
    expect(() => flowGeometry({ from: 'nowhere', to: 'agents' })).toThrow();
  });
});

describe('hub readings', () => {
  it('counts the agents like the worktrees page', () => {
    const counts = agentCounts(
      [
        { AGENT_NAME: 'a', progress: { finished: true, updated: NOW - 1000 }, commits: [1, 2], report: 'x' },
        { AGENT_NAME: 'b', progress: { finished: false, updated: NOW - 60_000 }, commits: [1] },
        { AGENT_NAME: 'c', activity: NOW - 3_600_000, commits: [] },
        { AGENT_NAME: 'd', hasReport: true, dirty: [], activity: NOW - 3_600_000 },
        { AGENT_NAME: 'e', AGENT_ARCHIVED: '2026-09-28', progress: { finished: true } },
      ],
      NOW,
    );
    expect(counts).toEqual({ total: 5, working: 1, calm: 1, done: 2, archived: 1, commits: 3, reports: 2 });
    expect(agentCounts(null, NOW).total).toBe(0);
  });

  it('sums the creatures of /metrics', () => {
    const text = '# HELP game_players Creatures\ngame_players{world="w1"} 2\ngame_players{world="w2"} 3\ngame_players_max 9\n';
    expect(metricsPlayers(text)).toBe(5);
    expect(metricsPlayers('nothing here')).toBeNull();
    expect(metricsPlayers(undefined)).toBeNull();
  });

  it('reads the pending questions whatever the shape of /api/questions', () => {
    expect(pendingQuestions(3)).toBe(3);
    expect(pendingQuestions({ pending: 2 })).toBe(2);
    expect(pendingQuestions({ pending: [{}, {}] })).toBe(2);
    expect(pendingQuestions([{ status: 'open' }, { status: 'answered' }, { answer: 'oui' }, {}])).toBe(2);
    expect(pendingQuestions({ questions: [{ state: 'pending' }, { state: 'resolved' }] })).toBe(1);
    expect(pendingQuestions({ hello: 'world' })).toBeNull();
    expect(pendingQuestions(null)).toBeNull();
    expect(decideAlone({ decideAlone: true })).toBe(true);
    expect(decideAlone({ autonomous: false })).toBe(false);
    expect(decideAlone([])).toBeNull();
    // The shape of questions-routes.mjs.
    const api = { questions: [], pending: 1, unread: 2, byAgent: {}, settings: { autonomous: true, agents: {} } };
    expect(pendingQuestions(api)).toBe(1);
    expect(unreadFeedback(api)).toBe(2);
    expect(decideAlone(api)).toBe(true);
    expect(unreadFeedback(null)).toBe(0);
  });

  it('counts the backlog tasks still to do, outside « Livré »', () => {
    const backlog = '# Backlog\n## Beta\n### Un\n> ⚪ à faire\n### Deux\n> 🔵 en cours · agent x\n### Trois\ntexte\n## Livré\n### Quatre\n> 🟢 livré · v0.2.0 · agent y\n';
    expect(roadmapBacklog(backlog)).toBe(2);
    expect(roadmapBacklog('# Rien')).toBeNull();
  });

  it('reads the roadmap sync of /api/roadmap', () => {
    expect(roadmapSync({ items: [1, 2, 3], pending: { added: ['a'], modified: ['b', 'c'], removed: [] }, queue: [1] })).toEqual({ items: 3, changed: 3, queued: 1 });
    expect(roadmapSync({ items: [], queue: { tasks: [1, 2] } })).toEqual({ items: 0, changed: 0, queued: 2 });
    expect(roadmapSync({ hello: 1 })).toBeNull();
    expect(nodeStates({ roadmap: 4, sync: { items: 4, changed: 2, queued: 0 } }, NOW).roadmap).toMatchObject({ level: 'warn', text: '2 changements à confier', badge: 2 });
    expect(nodeStates({ roadmap: 4, sync: { items: 4, changed: 0, queued: 0 } }, NOW).roadmap.text).toBe('4 chantiers à faire');
  });

  it('counts the version branches, their fixes to report and the test servers', () => {
    expect(nodeStates({ branches: { count: 2, toReport: 3, servers: 1 } }, NOW).branches).toMatchObject({ level: 'warn', text: '2 branches · 3 correctifs à reporter · 1 serveur de test', badge: 3 });
    expect(nodeStates({ branches: { count: 1, toReport: 0, servers: 0 } }, NOW).branches).toMatchObject({ level: 'up', text: '1 branche' });
    expect(nodeStates({ branches: { count: 0, toReport: 0, servers: 0 } }, NOW).branches.text).toBe('aucune branche de version');
  });

  it('tells a page that exists from the fallback of the dashboard', () => {
    const fallback = '<title>Agents Allèle</title>';
    expect(pageExists({ ok: true, status: 200, body: fallback }, fallback)).toBe(false);
    expect(pageExists({ ok: true, status: 200, body: '<title>Questions</title>' }, fallback)).toBe(true);
    // A tab of the worktrees page (same body) exists when its API answers.
    expect(pageExists({ ok: true, status: 200, body: fallback }, fallback, { pending: 0 })).toBe(true);
    expect(pageExists({ ok: false, status: 0 }, fallback)).toBe(false);
    expect(jsonBody({ ok: true, status: 200, type: 'application/json', body: '{"a":1}' })).toEqual({ a: 1 });
    expect(jsonBody({ ok: true, status: 200, type: 'text/html', body: '{"a":1}' })).toBeNull();
    expect(jsonBody({ ok: true, status: 200, type: 'application/json', body: '{' })).toBeNull();
  });

  it('sums up the releases: entries to file, generations in preparation, published ones', () => {
    const entry = (slug: string, type = 'new') => ({ slug, type });
    const summary = releaseSummary({
      current: '0.1.0',
      next: '0.2.0',
      unreleased: { entries: [entry('a'), entry('b'), entry('c')] },
      released: [{ version: '0.1.0', date: '2026-09-01', entries: [] }],
      plan: { versions: [{ version: '0.2.0', entries: ['a'], problems: [] }, { version: '0.3.0', entries: ['b'], problems: ['x'] }] },
      errors: [],
    });
    expect(summary).toMatchObject({ unreleased: 3, pending: 1, released: 1, latest: '0.1.0', latestDate: '2026-09-01', errors: 0 });
    expect(summary.planned).toEqual([
      { version: '0.2.0', generation: 'Génération 0.2', entries: 1, problems: 0 },
      { version: '0.3.0', generation: 'Génération 0.3', entries: 1, problems: 1 },
    ]);
  });
});

describe('hub states', () => {
  const changes = { current: '0.1.0', next: '0.2.0', unreleased: 2, pending: 1, planned: [{ version: '0.2.0', generation: 'Génération 0.2', entries: 4, problems: 0 }], released: 0, latest: null, latestDate: null, errors: 0 };

  it('gives every node a state, even with nothing to read', () => {
    const states = nodeStates({}, NOW);
    for (const node of NODES) expect(states[node.id], node.id).toMatchObject({ level: expect.any(String), text: expect.any(String) });
    expect(states.grafana.level).toBe('down');
    expect(states.questions.level).toBe('soon');
  });

  it('reads the probes, the agents, the releases and the questions', () => {
    const states = nodeStates(
      {
        probes: { client: { ok: true }, metrics: { ok: true, body: 'game_players{world="a"} 4\n' }, grafana: { ok: false } },
        agents: { total: 5, working: 2, calm: 0, done: 2, archived: 1, commits: 12, reports: 3 },
        changes,
        backlog: { sha: 'abc1234', time: NOW - 120_000, subject: 'Merge', ahead: 7 },
        roadmap: 12,
        questions: { pending: 3, decideAlone: true },
        pages: { questions: true },
      },
      NOW,
    );
    expect(states.client).toEqual({ level: 'up', text: 'en ligne' });
    expect(states.server).toMatchObject({ level: 'up', text: 'en ligne · 4 créatures', badge: 4 });
    expect(states.grafana.text).toContain('make ops-up');
    expect(states.agents).toMatchObject({ level: 'busy', text: '2 au travail · 2 terminés · 1 archivé', badge: 2 });
    expect(states.tasks.text).toBe('4 chantiers en cours');
    expect(states.journal.text).toBe('12 commits · 3 rapports');
    expect(states.generation).toMatchObject({ level: 'busy', text: 'Génération 0.2 · 4 entrées' });
    expect(states.pending).toMatchObject({ level: 'warn', badge: 1 });
    expect(states.released.text).toContain('aucune');
    expect(states.integration.text).toBe('abc1234 · il y a 2 min');
    expect(states.integration.detail).toContain('7 commits d’avance sur main');
    expect(states.roadmap.text).toBe('12 chantiers à faire');
    expect(states.questions).toMatchObject({ level: 'warn', text: '3 questions en attente · décide seul', badge: 3 });
  });

  it('shows a calm questions node when none is pending', () => {
    expect(nodeStates({ questions: { pending: 0 }, pages: { questions: true } }, NOW).questions).toEqual({ level: 'up', text: 'aucune question en attente' });
    expect(nodeStates({ questions: { pending: 0, unread: 1 }, pages: { questions: true } }, NOW).questions).toMatchObject({ level: 'warn', text: '1 retour à lire' });
  });

  it('falls back on the backlog document while /roadmap is not there', () => {
    expect(nodeLinks({ roadmap: false }).roadmap).toBe('/doc/docs/backlog.md');
    expect(nodeLinks({ roadmap: true }).roadmap).toBe('/roadmap');
    expect(nodeLinks({}).agents).toBe('/agents');
  });
});

describe('hub documents', () => {
  const roots: string[] = [];
  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it('serves the files of the checkout, never outside it nor its hidden, data or secret files', () => {
    const root = mkdtempSync(join(tmpdir(), 'hub-'));
    roots.push(root);
    expect(docPath(root, 'docs/roadmap.md')).toBe(join(root, 'docs/roadmap.md'));
    expect(docPath(root, 'docs/compte-rendu/2026-09-28%20backlog.md')).toBe(join(root, 'docs/compte-rendu/2026-09-28 backlog.md'));
    expect(docPath(root, '../etc/passwd')).toBeNull();
    expect(docPath(root, 'docs/../../x')).toBeNull();
    expect(docPath(root, '%2e%2e/x')).toBeNull();
    expect(docPath(root, '.git/config')).toBeNull();
    expect(docPath(root, '.env.agent')).toBeNull();
    expect(docPath(root, 'server/data/game.db')).toBeNull();
    expect(docPath(root, 'ops/secrets/metrics-token')).toBeNull();
    expect(docPath(root, 'node_modules/x/README.md')).toBeNull();
    expect(docPath(root, '%E0%A4%A')).toBeNull();
    expect(docPath(root, '')).toBeNull();
  });
});
