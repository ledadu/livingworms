// What the agents framework (agents/, see agents/README.md) needs to know of La Lignée. Only what differs from the
// defaults of agents/config.mjs; `node agents/config.mjs` prints the merged settings.
const GAME = { client: 'http://localhost:5180' };

export default {
  name: 'La Lignée',
  pitch: 'un jeu de navigateur où l’on joue une lignée de créatures marines, de la surface au fond de la fosse',

  branches: { main: 'master', integration: 'backlog' },

  paths: {
    design: ['docs/*'],
    packages: ['package.json'],
  },

  // The game has no server: the « server » of an agent serves the built single file (vite preview, what gets
  // published), its « client » the dev build with hot reload. Ports away from Allèle's (7800/5300, dashboard 7800),
  // whose agents may run at the same time: agent n gets 8200 + n and 5600 + n, the dashboard 8200 (Makefile).
  services: {
    server: { command: 'npm run dev:server', portBase: 8200 },
    client: { command: 'npm run dev:client', portBase: 5600 },
  },

  check: { typecheck: 'npm run typecheck --silent', test: 'npx vitest run' },
  brief: 'docs/agents.md',
  devServers: `le serveur de dev de l’utilisateur (npm run dev, ${GAME.client})`,

  // Dated nightlies on the way to a stable published when we decide (release/changes.mjs).
  release: { reader: 'les joueurs', nightly: true },

  hub: {
    zones: [{ id: 'game', label: 'Jeu', color: '#4cc38a', box: [470, 406, 420, 250] }],
    nodes: [
      { id: 'client', zone: 'game', icon: '🐚', name: 'La Lignée', x: 492, y: 458, href: GAME.client, probe: GAME.client,
        role: 'Le jeu en dev, celui du dépôt principal (npm run dev).' },
    ],
    flows: [
      { from: 'released', to: 'client', label: 'joueurs' },
      { from: 'client', to: 'roadmap', label: 'retours', fromSide: 'left', toSide: 'top', via: [[14, 480], [14, 74], [340, 74]] },
    ],
  },
};
