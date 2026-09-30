// The settings of the project that uses this framework: its agents.config.mjs, at the root of the repository this folder
// sits in (or the file AGENTS_CONFIG names), merged over the defaults below. Every project-specific value the scripts
// need (names, branches, paths, dev commands and ports, data to copy, release vocabulary, nodes of the hub map) comes
// from here, so that the same folder serves any game.
//
//   node agents/config.mjs            prints the merged settings (JSON)
//   node agents/config.mjs shell      prints the variables agent.sh evaluates
//
// No dependency: the dashboard, the release scripts, a Vite config and the tests import it as it is.
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const frameworkDir = dirname(fileURLToPath(import.meta.url));
// The checkout this folder belongs to (the main one or an agent's worktree): the folder is mounted at its root.
export const projectRoot = resolve(frameworkDir, '..');
export const configFile = process.env.AGENTS_CONFIG ? resolve(process.env.AGENTS_CONFIG) : join(projectRoot, 'agents.config.mjs');

export const DEFAULTS = {
  // Shown in the page titles and the prompts.
  name: 'Projet',
  // What the project is, in a few words, for the prompts (« le backlog de <name>, <pitch> »).
  pitch: 'un jeu',
  branches: {
    // The stable branch, and the one the agents' work is merged into before a release.
    main: 'main',
    integration: 'backlog',
    // Each agent works on <agent><name>; a test server of a version on <serve><name>.
    agent: 'agent/',
    serve: 'serve/',
  },
  paths: {
    // One task per ### heading, grouped by ##, a status line under each (backlog.mjs).
    backlog: 'docs/backlog.md',
    // The heading of the backlog group the delivered tasks move to.
    delivered: 'Livré',
    roadmap: 'docs/roadmap.md',
    // Dated reports of the team (the newest one is linked from the hub).
    reports: 'docs/compte-rendu',
    // Entry point of the design docs (hub node « Mindmap »).
    mindmap: 'docs/README.md',
    // Where an agent reads the design of what it builds (prompts).
    design: ['docs/*'],
    changes: 'changes',
    changelog: 'CHANGELOG.md',
    // The package.json files a release sets the version of (globs of one level: dir/*/package.json).
    packages: ['package.json', 'apps/*/package.json', 'packages/*/package.json'],
  },
  // The two processes an agent runs in its worktree. Each command gets PORT (the server's), SERVER_PORT and CLIENT_PORT;
  // the ports of agent n are portBase + n (the dashboard itself uses 7800).
  services: {
    server: { command: 'npm run dev:server', portBase: 7800 },
    client: { command: 'npm run dev:client', portBase: 5300 },
  },
  // What a new worktree gets from the main checkout: SQLite databases (copied consistently while the server writes to
  // them) and plain files or folders; paths relative to the root.
  seed: { sqlite: [], copy: [] },
  // agent.sh check / test, run in the worktree.
  check: { typecheck: 'npm run typecheck --silent', test: 'npx vitest run' },
  // Where the main checkout's dev servers run, for the prompts (« ne touche pas le dépôt principal, où tourne … »).
  devServers: 'le serveur de dev de l’utilisateur',
  // The instructions of this project for its agents, appended to the common brief (agent/brief.md): a path from the root.
  brief: null,
  // The trailer of the agents' commits.
  coAuthoredBy: 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>',
  // Screenshots in the Windows Chrome from WSL (agent.sh shot / chrome).
  browser: {
    chrome: '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    // Windows path of the profile of the debuggable Chrome (default: agents-chrome in the Windows temporary folder).
    profile: null,
    // playwright-core for the screenshots (default: the project's node_modules; PLAYWRIGHT_CORE overrides).
    playwrightCore: null,
  },
  release: {
    // A release is a « version » (feminine noun in the sentences: « la version 0.3 »).
    word: 'version',
    // The title of the changelog and of the « what's new » page.
    title: 'Nouveautés',
    // Under « ## <unreleased> » in the changelog.
    unreleased: 'À venir',
    // The line under the title of the changelog (default: « Le changelog de <name>, version après version… »).
    changelogIntro: null,
    types: {
      new: { label: 'Nouveautés', badge: '✨ Nouveauté' },
      improved: { label: 'Améliorations', badge: '🔧 Amélioration' },
      fixed: { label: 'Corrections', badge: '🩹 Correction' },
    },
    // Who reads the entries (« ce qui change pour <reader> »).
    reader: 'les joueurs',
    audiences: { players: 'joueurs', admins: 'admins', developers: 'développeurs' },
  },
  // Links of the /doc pages' header: { icon, label, path } (path from the root).
  docs: null,
  // The home map of the dashboard (hub.mjs). The framework draws the documentation, the team and the releases; the
  // project adds its own zones (the bottom row, y ≥ 406, is free), nodes, flows and live readings.
  hub: {
    zones: [],
    // { id, zone, icon, name, x, y, href, role, probe?: url answered when up }
    nodes: [],
    // { from, to, label, side?, fromSide?, toSide?, fromAt?, toAt?, via? }: the main ones continue the numbered cycle.
    flows: [],
    // Extra readings: { id: { url, body?: true } }; the nodes' probes are read too.
    probes: {},
    // ({ probes, states, now }) => { <node id>: { level, text, badge? } } to refine the states of the project's nodes.
    states: null,
    // ({ probes }) => [{ icon, value, text, href }]: figures shown under the map.
    figures: null,
    // A DNA strand behind the map.
    helix: false,
  },
};

const isPlain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

// Plain objects merge key by key; anything else (arrays, functions, strings) replaces.
export function merge(base, extra) {
  if (!isPlain(base) || !isPlain(extra)) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) out[key] = merge(base[key], value);
  return out;
}

async function load() {
  if (!existsSync(configFile)) return {};
  const module = await import(pathToFileURL(configFile).href);
  return module.default ?? {};
}

export const project = merge(DEFAULTS, await load());

// « Version 0.2 » for 0.2.0, « Version 0.2.1 » for a patch, « Prochaine version » without one.
export function releaseName(version) {
  const word = capitalize(project.release.word);
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(version ?? '').trim());
  if (!match) return `Prochaine ${project.release.word}`;
  const [, major, minor, patch] = match;
  return `${word} ${major}.${minor}${Number(patch) ? `.${patch}` : ''}`;
}

export const capitalize = (text) => String(text).charAt(0).toUpperCase() + String(text).slice(1);

// The common brief, as a path from the root of the checkout (agents/agent/brief.md when the folder is agents/).
export const briefPath = relative(projectRoot, join(frameworkDir, 'agent/brief.md'));
// The command an agent runs to ask the user something (agent/ask.mjs), from the root of its worktree.
export const askPath = relative(projectRoot, join(frameworkDir, 'agent/ask.mjs'));

// What the pages of the dashboard know of the project: window.PROJECT.
export function clientSettings() {
  const { name, pitch, branches, paths, release, services } = project;
  return {
    name,
    pitch,
    branches,
    paths: { backlog: paths.backlog, roadmap: paths.roadmap, changes: paths.changes, changelog: paths.changelog },
    release: { ...release, Word: capitalize(release.word) },
    docs: docLinks(),
    ports: { server: services.server.portBase, client: services.client.portBase },
  };
}

// The header links of the /doc pages: the project's, or the framework's documents and the project's main ones.
export function docLinks() {
  if (project.docs) return project.docs;
  const own = (file) => relative(projectRoot, join(frameworkDir, file));
  return [
    { icon: '🧠', label: 'Mindmap', path: project.paths.mindmap },
    { icon: '📋', label: 'Backlog', path: project.paths.backlog },
    { icon: '🗺️', label: 'Roadmap', path: project.paths.roadmap },
    { icon: '📝', label: 'Compte rendu', path: `${project.paths.reports}/` },
    { icon: '🎼', label: 'Orchestration', path: own('docs/orchestration.md') },
    { icon: '🤖', label: 'Agents en parallèle', path: own('docs/agents.md') },
    { icon: '🧩', label: 'Consigne des agents', path: briefPath },
    ...(project.brief ? [{ icon: '🧪', label: `Agents dans ${project.name}`, path: project.brief }] : []),
    { icon: '🧬', label: 'Changements et versions', path: own('docs/changes.md') },
    { icon: '📦', label: 'Changelog', path: project.paths.changelog },
    { icon: '🏠', label: 'README', path: 'README.md' },
  ];
}

// The words of the project in place of these markers, in the pages and scripts of the dashboard.
export function markers() {
  return {
    __PROJECT__: project.name,
    __MAIN__: project.branches.main,
    __INTEGRATION__: project.branches.integration,
    __BACKLOG__: project.paths.backlog,
    __CHANGES__: project.paths.changes,
    __RELEASE_TITLE__: project.release.title,
    __RELEASE__: project.release.word,
    __Release__: capitalize(project.release.word),
    __READER__: project.release.reader,
  };
}

// A script of the dashboard with the project's words (as they are: they sit in strings and templates).
export function renderText(text) {
  let out = text;
  for (const [marker, value] of Object.entries(markers())) out = out.replaceAll(marker, value);
  return out;
}

// A page of the dashboard with the project's words (escaped) and window.PROJECT before </head>.
export function renderPage(html) {
  const escape = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  let out = html;
  for (const [marker, value] of Object.entries(markers())) out = out.replaceAll(marker, escape(value));
  const settings = JSON.stringify(clientSettings()).replace(/</g, '\\u003c');
  return out.replace('</head>', `<script>window.PROJECT = ${settings};</script>\n</head>`);
}

// The variables of agent.sh, quoted for the shell.
export function shellVariables() {
  const quote = (value) => `'${String(value ?? '').replaceAll("'", `'\\''`)}'`;
  const { services, seed, check, browser, branches } = project;
  const lines = {
    PROJECT_NAME: project.name,
    SERVER_COMMAND: services.server.command,
    CLIENT_COMMAND: services.client.command,
    SERVER_PORT_BASE: services.server.portBase,
    CLIENT_PORT_BASE: services.client.portBase,
    TYPECHECK_COMMAND: check.typecheck,
    TEST_COMMAND: check.test,
    MAIN_BRANCH: branches.main,
    AGENT_BRANCH_PREFIX: branches.agent,
    CHROME_EXE: browser.chrome,
    CHROME_PROFILE: browser.profile ?? '',
    PLAYWRIGHT_CORE_DEFAULT: browser.playwrightCore ?? '',
  };
  const arrays = { SEED_SQLITE: seed.sqlite, SEED_COPY: seed.copy };
  return [
    ...Object.entries(lines).map(([key, value]) => `${key}=${quote(value)}`),
    ...Object.entries(arrays).map(([key, values]) => `${key}=(${values.map(quote).join(' ')})`),
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'shell') console.log(shellVariables());
  else console.log(JSON.stringify(project, (key, value) => (typeof value === 'function' ? `[function ${key}]` : value), 2));
}
