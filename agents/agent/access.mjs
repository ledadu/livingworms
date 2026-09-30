// Who may use the dashboard. It launches agents, merges, publishes and removes worktrees, so a request that does not
// come from the machine itself must carry its token: once in the URL (?token=…), which sets a cookie and redirects to
// the same page without it, then by that cookie (or an Authorization: Bearer header).
//
// A request is local when it comes from the loopback address, names a local host, and went through no proxy. A proxy
// such as `tailscale serve` also connects from the loopback (on WSL, through the Windows localhost relay), but it adds
// its headers and keeps the public host name: such a request is remote.
//
// The token: AGENTS_DASHBOARD_TOKEN, else <registry>/dashboard-token, made at the first start (32 random bytes, hex).
// `node agent/access.mjs` prints it.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const COOKIE = 'agents_token';
const PROXY_HEADERS = ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'forwarded', 'x-real-ip', 'tailscale-user-login', 'tailscale-user-name'];
const LOOPBACK = /^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** Whether the request comes from the machine itself (no token needed). */
export function isLocal(request) {
  const address = request.socket?.remoteAddress ?? '';
  if (!LOOPBACK.test(address)) return false;
  if (PROXY_HEADERS.some((name) => request.headers?.[name] !== undefined)) return false;
  return LOCAL_HOST.test(String(request.headers?.host ?? 'localhost'));
}

/** The token of the dashboard: the environment's, else the one kept in the registry, made the first time. */
export function dashboardToken(registry, env = process.env) {
  if (env.AGENTS_DASHBOARD_TOKEN) return env.AGENTS_DASHBOARD_TOKEN;
  const file = join(registry, 'dashboard-token');
  if (existsSync(file)) {
    const kept = readFileSync(file, 'utf8').trim();
    if (kept) return kept;
  }
  mkdirSync(registry, { recursive: true });
  const token = randomBytes(32).toString('hex');
  writeFileSync(file, `${token}\n`, { mode: 0o600 });
  return token;
}

const same = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

function cookie(request, name) {
  for (const part of String(request.headers?.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

/**
 * What to do with a request: { ok: true } to go on, { redirect, cookie } when it brings the right token in its URL
 * (set the cookie, go to the same URL without the token), or { ok: false } to refuse it.
 */
export function checkAccess(request, token) {
  if (isLocal(request)) return { ok: true };
  const url = new URL(request.url ?? '/', 'http://dashboard');
  const given = url.searchParams.get('token');
  if (given !== null) {
    if (!same(given, token)) return { ok: false };
    url.searchParams.delete('token');
    const secure = request.headers?.['x-forwarded-proto'] === 'https' || Boolean(request.headers?.['tailscale-user-login']);
    return {
      redirect: `${url.pathname}${url.search}`,
      cookie: `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${90 * 24 * 3600}${secure ? '; Secure' : ''}`,
    };
  }
  const bearer = /^Bearer\s+(.+)$/i.exec(String(request.headers?.authorization ?? ''))?.[1];
  return { ok: same(cookie(request, COOKIE), token) || same(bearer, token) };
}

/** Answers a request the access check did not let through; true when it did so. */
export function guard(request, response, token) {
  const access = checkAccess(request, token);
  if (access.ok) return false;
  if (access.redirect) {
    response.writeHead(302, { location: access.redirect, 'set-cookie': access.cookie, 'cache-control': 'no-store' });
    response.end();
    return true;
  }
  const api = /^\/api\//.test(new URL(request.url ?? '/', 'http://dashboard').pathname);
  response.writeHead(401, { 'content-type': api ? 'application/json' : 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  response.end(api ? JSON.stringify({ ok: false, error: 'accès refusé : jeton du tableau de bord requis' })
    : '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Accès refusé</title><body style="font:16px system-ui;background:#111418;color:#e6e9ee;padding:24px"><h1>Accès refusé</h1><p>Ce tableau de bord demande son jeton quand on n’est pas sur la machine : ouvre l’adresse avec <code>?token=…</code> une fois (le jeton : <code>make agent-dashboard-token</code> sur la machine).</p>');
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const common = execFileSync('git', ['-C', here, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim();
  console.log(dashboardToken(process.env.AGENTS_REGISTRY || join(resolve(here, common), 'agents')));
}
