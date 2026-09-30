// The versions tabs of the agents' dashboard (dashboard.mjs): the entries to publish, the generations in preparation
// (changes/planned.json) and the published ones, read and written in the changes/ of the repository the dashboard runs
// from (the main one on port 7800), or of CHANGES_ROOT, a throwaway copy for tests. Only the publication commits.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assignEntries,
  assignEntry,
  assignedTo,
  changelog,
  releaseName,
  loadChanges,
  planVersion,
  previewRelease,
  proposeVersion,
  TYPE_BADGES,
  unplanVersion,
  UNRELEASED,
  whatsNew,
} from '../release/changes.mjs';
import { publish, publishProblems } from '../release/publish.mjs';
import { cleanAgents, defaultPaths } from './clean.mjs';
import { isReleaseServer } from './release-servers.mjs';
import { project, projectRoot } from '../config.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// The request handler of the versions routes; it answers true when the path was one of them.
export function versionsRoutes({ registry, readEnv, pageFile, changesRoot = process.env.CHANGES_ROOT ? resolve(process.env.CHANGES_ROOT) : projectRoot }) {
  const FILE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', md: 'text/plain; charset=utf-8' };

  function sendFile(response, folder, relativePath) {
    let target = '';
    try {
      target = folder && resolve(folder, decodeURIComponent(relativePath));
    } catch {}
    if (!target || !target.startsWith(folder + '/') || !existsSync(target) || !statSync(target).isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': FILE_TYPES[target.split('.').pop().toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(readFileSync(target));
  }

  function readJson(request) {
    return new Promise((resolve) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch {
          resolve({});
        }
      });
    });
  }

  function registryAgents() {
    try {
      return readdirSync(registry)
        .filter((file) => file.endsWith('.env'))
        .map((file) => readEnv(join(registry, file)))
        .filter((env) => !isReleaseServer(env));
    } catch {
      return [];
    }
  }

  // Everything the versions tabs show, read again on each request: changes/ may be edited by hand or by a merge.
  function versionsState() {
    const changes = loadChanges(changesRoot);
    const agents = new Map(registryAgents().map((env) => [env.AGENT_NAME, env]));
    const agentOf = (slug) => {
      const env = agents.get(slug);
      return env ? { name: slug, branch: env.AGENT_BRANCH, archived: Boolean(env.AGENT_ARCHIVED) } : null;
    };
    const view = (entry, folder) => ({
      slug: entry.slug,
      folder,
      type: entry.type ?? null,
      badge: TYPE_BADGES[entry.type] ?? null,
      title: entry.title ?? null,
      pitch: entry.pitch ?? null,
      audience: entry.audience ?? null,
      image: entry.featured?.[0] && existsSync(join(entry.dir, entry.featured[0])) ? `/changes/${folder}/${entry.slug}/${entry.featured[0]}` : null,
      report: entry.report ? `/report/${folder}/${entry.slug}` : null,
      errors: entry.errors,
      agent: agentOf(entry.slug),
    });
    const unreleased = changes.unreleased.entries.map((entry) => ({ ...view(entry, UNRELEASED), assigned: assignedTo(changes, entry.slug), propose: proposeVersion(changes, [entry]) }));
    // To publish: the unassigned entries, except those of a task still under way, and the archived tasks with no entry.
    const pending = unreleased.filter((entry) => !entry.assigned && (!entry.agent || entry.agent.archived));
    for (const env of agents.values()) {
      if (!env.AGENT_ARCHIVED || unreleased.some((entry) => entry.slug === env.AGENT_NAME)) continue;
      if (changes.released.some((release) => release.entries.some((entry) => entry.slug === env.AGENT_NAME))) continue;
      const onBranch = existsSync(join(env.AGENT_DIR ?? '', 'changes', UNRELEASED, env.AGENT_NAME, 'entry.md'));
      pending.push({ slug: env.AGENT_NAME, missing: true, onBranch, agent: agentOf(env.AGENT_NAME), errors: [] });
    }
    const planned = changes.plan.versions.map((plannedVersion) => {
      const preview = previewRelease(changes, { version: plannedVersion.version });
      const frozen = whatsNew(preview, { base: '/changes/' }).releases.find((release) => release.version === plannedVersion.version && !release.unreleased);
      const unreleasedBase = `/changes/${UNRELEASED}/`;
      const fix = (text) => String(text).replaceAll(`/changes/v${plannedVersion.version}/`, unreleasedBase);
      const log = changelog(preview);
      const start = log.indexOf(`## ${releaseName(plannedVersion.version)} (v${plannedVersion.version}`);
      const end = start < 0 ? -1 : log.indexOf('\n## ', start + 1);
      let problems = [...plannedVersion.problems];
      try {
        problems = [...new Set([...problems, ...publishProblems(changesRoot, plannedVersion.version, { changes })])];
      } catch (error) {
        problems.push(error.message);
      }
      return {
        version: plannedVersion.version,
        generation: releaseName(plannedVersion.version),
        title: plannedVersion.title,
        intro: plannedVersion.intro,
        entries: plannedVersion.entries.map((slug) => unreleased.find((entry) => entry.slug === slug) ?? { slug, missing: true, errors: [`absente de ${project.paths.changes}/unreleased`], agent: agentOf(slug) }),
        problems,
        changelog: start < 0 ? '' : log.slice(start, end < 0 ? undefined : end).trim(),
        whatsNew: frozen ? { ...frozen, entries: frozen.entries.map((entry) => ({ ...entry, images: entry.images.map(fix), body: fix(entry.body) })) } : null,
      };
    });
    const tags = new Set(gitSync(changesRoot, 'tag', '--list', 'v*').split('\n'));
    const released = changes.released.map((release) => ({
      version: release.version,
      generation: releaseName(release.version),
      date: release.date,
      title: release.title,
      intro: release.intro,
      tag: tags.has(`v${release.version}`) ? `v${release.version}` : null,
      entries: release.entries.map((entry) => view(entry, `v${release.version}`)),
    }));
    return {
      root: changesRoot,
      current: changes.current,
      proposal: proposeVersion(changes),
      badges: TYPE_BADGES,
      pending,
      planned,
      released,
      errors: changes.plan.errors,
    };
  }

  function gitSync(cwd, ...args) {
    try {
      return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  }

  // Writes to changes/ of the repository (planned.json), never committed, except the publication itself.
  async function planAction(action, body) {
    const version = typeof body.version === 'string' ? body.version.trim() : '';
    try {
      if (action === 'assign') {
        assignEntry(changesRoot, String(body.slug ?? ''), version || null);
        return { ok: true, message: version ? `${body.slug} → ${releaseName(version)}` : `${body.slug} : retirée de sa ${project.release.word}` };
      }
      if (action === 'assign-many') {
        const slugs = Array.isArray(body.slugs) ? body.slugs.map(String) : [];
        const target = assignEntries(changesRoot, slugs, version || null);
        return { ok: true, version: target, message: `${slugs.length} entrée(s) → ${releaseName(target)}` };
      }
      if (action === 'plan') {
        const to = typeof body.to === 'string' ? body.to.trim() : undefined;
        planVersion(changesRoot, version, { to, title: body.title, intro: body.intro });
        return { ok: true, version: to || version };
      }
      if (action === 'unplan') {
        unplanVersion(changesRoot, version);
        return { ok: true };
      }
      if (action === 'publish') {
        const result = publish(changesRoot, { version, branch: body.branch !== false });
        const started = result.releaseBranch?.created ? `, branche ${result.releaseBranch.branch} créée` : '';
        // The agents of the generation are over: their worktrees, branches and runs go (clean.mjs keeps any not done).
        let cleaned = '';
        try {
          const done = cleanAgents({ ...defaultPaths(), names: result.slugs }).cleaned.map((one) => one.name);
          if (done.length) cleaned = ` · ${done.length} worktree${done.length > 1 ? 's' : ''} nettoyé${done.length > 1 ? 's' : ''} (${done.join(', ')})`;
        } catch (error) {
          cleaned = ` · nettoyage des worktrees non fait : ${error.message}`;
        }
        return { ok: true, ...result, message: `${releaseName(result.version)} publiée : commit ${result.commit}, tag ${result.tag}${started} (pas de push)${cleaned}` };
      }
    } catch (error) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: `action inconnue ${action}` };
  }

  const json = (response, value) => {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  const page = (response, type, text) => {
    response.writeHead(200, { 'content-type': type });
    response.end(text);
  };

  return async function handle(request, response, path) {
    const change = /^\/changes\/(.+)$/.exec(path);
    if (change) return sendFile(response, join(changesRoot, 'changes'), change[1]), true;
    const report = /^\/report\/([\w.-]+)\/([a-z0-9-]+)$/.exec(path);
    if (report) return page(response, 'text/html; charset=utf-8', pageFile('report.html').replaceAll('__FOLDER__', report[1]).replaceAll('__SLUG__', report[2])), true;
    if (path === '/versions') return page(response, 'text/html; charset=utf-8', pageFile('dashboard.html')), true;
    const asset = { '/markdown.js': 'text/javascript', '/versions.js': 'text/javascript', '/versions.css': 'text/css' }[path];
    if (asset) return page(response, `${asset}; charset=utf-8`, pageFile(path.slice(1))), true;
    if (path === '/api/versions') return json(response, versionsState()), true;
    const action = /^\/api\/(assign|assign-many|plan|unplan|publish)$/.exec(path);
    if (action && request.method === 'POST') return json(response, await planAction(action[1], await readJson(request))), true;
    return false;
  };
}
