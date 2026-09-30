// The project the framework's tests run against, whatever project the folder is mounted in: a browser game whose
// releases are « générations », with a game server, its /metrics and a Grafana on the map of the hub.
const GAME = { client: 'http://localhost:5173', server: 'http://localhost:8787', grafana: 'http://localhost:3000' };

// Creatures in the worlds: the sum of the game_players gauge of /metrics.
export function metricsPlayers(text) {
  if (typeof text !== 'string') return null;
  let total = null;
  for (const line of text.split('\n')) {
    const match = /^game_players(?:\{[^}]*\})?\s+([\d.eE+-]+)\s*$/.exec(line);
    if (match) total = (total ?? 0) + Number(match[1]);
  }
  return total;
}

export default {
  name: 'Jeu de test',
  pitch: 'un jeu de navigateur',
  services: {
    server: { command: 'npm run dev:server', portBase: 7800 },
    client: { command: 'npm run dev:client', portBase: 5300 },
  },
  paths: { design: ['docs/gameplay/*', 'docs/technical/*'] },
  release: {
    word: 'génération',
    title: 'Nouvelles mutations',
    unreleased: 'En incubation',
    types: {
      new: { label: 'Mutations', badge: '🧬 Mutation' },
      improved: { label: 'Adaptations', badge: '🌿 Adaptation' },
      fixed: { label: 'ADN réparé', badge: '🩹 ADN réparé' },
    },
    reader: 'les joueurs',
  },
  hub: {
    zones: [
      { id: 'game', label: 'Jeu', color: '#4cc38a', box: [470, 406, 420, 250] },
      { id: 'ops', label: 'Supervision', color: '#ef6b6b', box: [28, 406, 420, 250] },
    ],
    nodes: [
      { id: 'client', zone: 'game', icon: '🎮', name: 'Le jeu', x: 492, y: 458, href: GAME.client, probe: GAME.client, role: 'Le client du jeu, là où jouent les joueurs.' },
      { id: 'server', zone: 'game', icon: '🖥️', name: 'Serveur de jeu', x: 492, y: 560, href: `${GAME.server}/admin`, role: 'Le serveur de jeu, autoritaire et observé.' },
      { id: 'metrics', zone: 'ops', icon: '📈', name: '/metrics', x: 254, y: 458, href: `${GAME.server}/metrics`, probe: `${GAME.server}/metrics`, body: true, role: 'Les mesures du serveur au format Prometheus.' },
      { id: 'grafana', zone: 'ops', icon: '📊', name: 'Grafana', x: 50, y: 560, href: GAME.grafana, probe: `${GAME.grafana}/api/health`, down: 'hors ligne · make ops-up', role: 'Les graphes du serveur, depuis ses mesures.' },
    ],
    flows: [
      { from: 'released', to: 'client', label: 'joueurs' },
      { from: 'client', to: 'server', label: 'joue', fromAt: 0.5, toAt: 0.5 },
      { from: 'server', to: 'metrics', label: 'télémétrie', fromSide: 'left', fromAt: 0.3 },
      { from: 'metrics', to: 'grafana', label: 'graphes' },
      { from: 'grafana', to: 'roadmap', label: 'retours', fromSide: 'left', toSide: 'top', via: [[14, 592], [14, 74], [340, 74]] },
    ],
    states({ probes }) {
      const players = metricsPlayers(probes.metrics?.body);
      if (!probes.metrics?.ok) return { server: { level: 'down', text: 'hors ligne' } };
      return { server: { level: 'up', text: players === null ? 'en ligne' : `en ligne · ${players} créature${players === 1 ? '' : 's'}`, badge: players || undefined } };
    },
  },
};
