// The « Branches » tab of the versions pages (branches.js): the version branches release/X.Y of the repository the
// dashboard runs from (or CHANGES_ROOT) and the test servers of versions. Plugged in dashboard.mjs by one line.
//
//   GET  /api/branches                     every release/*, the X.Y.0 published without one, the tags, the servers
//   POST /api/branches/<action>            create, publish, integrate, report, rebase, delete (branches.mjs)
//   POST /api/branches/serve|refresh|stop|remove   the test servers (release-servers.mjs)
//
// Throwaway setups for testing: CHANGES_ROOT (the repository), AGENTS_REGISTRY and AGENTS_AGENT_SH (the registry
// and agent.sh of that repository).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createBranch, deleteBranch, integrate, listReleaseBranches, missingBranches, publishPatch, rebaseRelease, reportFixes } from '../release/branches.mjs';
import { releaseName } from '../release/changes.mjs';
import { createServers } from './release-servers.mjs';
import { projectRoot, renderText } from '../config.mjs';

export function branchesRoutes({ registry, readEnv, here, root = process.env.CHANGES_ROOT ? resolve(process.env.CHANGES_ROOT) : projectRoot }) {
  const servers = createServers({
    root,
    registry: process.env.AGENTS_REGISTRY || registry,
    readEnv,
    agentScript: process.env.AGENTS_AGENT_SH || join(here, 'agent.sh'),
  });

  async function state() {
    const list = await servers.list();
    let branches = [];
    let error = null;
    try {
      branches = listReleaseBranches(root);
    } catch (caught) {
      error = caught.message;
    }
    const tags = [...new Set(branches.flatMap((branch) => branch.tags))];
    return {
      root,
      branches: branches.map((branch) => ({ ...branch, servers: list.filter((server) => server.ref === branch.branch) })),
      missing: missingBranches(root),
      tagServers: list.filter((server) => !server.ref?.startsWith('release/')),
      servers: list.length,
      tags,
      error,
    };
  }

  const line = (body) => String(body.line ?? '');
  const actions = {
    create: (body) => {
      const result = createBranch(root, `${line(body)}.0`);
      return { message: result.created ? `${result.branch} créée depuis v${line(body)}.0` : `${result.branch} existe déjà` };
    },
    publish: (body) => {
      const result = publishPatch(root, line(body), { version: body.version || undefined, title: body.title ?? '', intro: body.intro ?? '' });
      return { ...result, message: `${releaseName(result.version)} publiée sur ${result.branch} : commit ${result.commit}, tag ${result.tag} (pas de push)` };
    },
    integrate: (body) => integrate(root, line(body), String(body.ref ?? '').trim()),
    report: (body) => reportFixes(root, line(body), { shas: Array.isArray(body.shas) ? body.shas.map(String) : undefined, advance: body.advance !== false }),
    rebase: (body) => rebaseRelease(root, line(body), { onto: body.onto ? String(body.onto).trim() : undefined, force: body.force === true }),
    delete: (body) => deleteBranch(root, line(body)),
  };

  const json = (response, value) => {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(value));
  };

  function readJson(request) {
    return new Promise((done) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        try {
          done(JSON.parse(body || '{}'));
        } catch {
          done({});
        }
      });
    });
  }

  return async function handle(request, response, path) {
    if (path === '/branches.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      response.end(renderText(readFileSync(join(here, 'branches.js'), 'utf8')));
      return true;
    }
    if (path === '/api/branches') return json(response, await state()), true;
    const match = /^\/api\/branches\/([a-z]+)$/.exec(path);
    if (!match || request.method !== 'POST') return false;
    const body = await readJson(request);
    const action = match[1];
    try {
      if (action === 'serve') return json(response, await servers.start(String(body.ref ?? ''))), true;
      if (['refresh', 'stop', 'remove'].includes(action)) return json(response, await servers[action](String(body.name ?? ''))), true;
      if (!actions[action]) return json(response, { ok: false, error: `action inconnue ${action}` }), true;
      return json(response, { ok: true, ...actions[action](body) }), true;
    } catch (error) {
      return json(response, { ok: false, error: error.message, rewritten: error.rewritten }), true;
    }
  };
}
