// agents.config.mjs, at the root of the game: what the agents framework (the agents/ folder) needs to know of it.
// Copy this file there and keep only what differs from the defaults (agents/config.mjs lists them all);
// `node agents/config.mjs` prints the merged result.
const GAME = { client: 'http://localhost:5173', server: 'http://localhost:3000' };

export default {
  name: 'Mon jeu',
  pitch: 'un jeu de plateforme en ligne',

  // main: the stable branch; integration: where the orchestrator merges the agents' branches before a release.
  branches: { main: 'main', integration: 'backlog' },

  paths: {
    backlog: 'docs/backlog.md',
    roadmap: 'docs/roadmap.md',
    design: ['docs/*'],
    // The package.json files a release sets the version of.
    packages: ['package.json'],
  },

  // What an agent runs in its worktree: each command gets PORT and SERVER_PORT (the server's port) and CLIENT_PORT, and
  // must listen on them. Agent n gets portBase + n.
  services: {
    server: { command: 'npm run dev:server', portBase: 7800 },
    client: { command: 'npm run dev:client', portBase: 5300 },
  },

  // Dev data copied from the main checkout into each new worktree (git-ignored paths).
  seed: { sqlite: ['server/data/game.db'], copy: [] },

  check: { typecheck: 'npm run typecheck --silent', test: 'npx vitest run' },

  // The effort and model of an agent whose task sets none (each task may have its own: Backlog page, agent's card,
  // make agent-new EFFORT=… MODEL=…); null leaves Claude Code's.
  defaults: { effort: null, model: null },

  // The instructions of this game for its agents (architecture, shared files, test accounts, dev tools), read after
  // the common brief (agents/agent/brief.md).
  brief: 'docs/agents.md',

  // The words of the releases, in the changelog, the dashboard and the game's « what's new ».
  release: {
    word: 'version',
    title: 'Nouveautés',
    types: {
      new: { label: 'Nouveautés', badge: '✨ Nouveauté' },
      improved: { label: 'Améliorations', badge: '🔧 Amélioration' },
      fixed: { label: 'Corrections', badge: '🩹 Correction' },
    },
    reader: 'les joueurs',
  },

  // The game on the home map of the dashboard: the bottom row (y ≥ 406) is free; the framework's zones are docs,
  // team and release (see BASE_ZONES, BASE_NODES in agents/agent/hub.mjs).
  hub: {
    zones: [{ id: 'game', label: 'Jeu', color: '#4cc38a', box: [470, 406, 420, 250] }],
    nodes: [
      { id: 'client', zone: 'game', icon: '🎮', name: 'Le jeu', x: 492, y: 458, href: GAME.client, probe: GAME.client,
        role: 'Le client du jeu en dev, celui du dépôt principal.' },
      { id: 'server', zone: 'game', icon: '🖥️', name: 'Serveur', x: 492, y: 560, href: GAME.server, probe: `${GAME.server}/health`,
        role: 'Le serveur de jeu en dev, celui du dépôt principal.' },
    ],
    // The cycle goes on from the published releases to the players, and back to the backlog.
    flows: [
      { from: 'released', to: 'client', label: 'joueurs' },
      { from: 'client', to: 'server', label: 'joue', fromAt: 0.5, toAt: 0.5 },
      { from: 'server', to: 'roadmap', label: 'retours', fromSide: 'left', toSide: 'top', via: [[14, 592], [14, 74], [340, 74]] },
    ],
    // Refine the states of the game's nodes from the probes (body: true on a node keeps its answer):
    // states: ({ probes }) => ({ server: { level: 'up', text: 'en ligne · 3 joueurs', badge: 3 } }),
    // figures: ({ probes }) => [{ icon: '🎮', value: 3, text: 'joueurs connectés', href: GAME.client }],
  },
};
