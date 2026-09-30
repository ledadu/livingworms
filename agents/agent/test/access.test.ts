import '../../test/env.mjs';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkAccess, COOKIE, dashboardToken, guard, isLocal } from '../access.mjs';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

const TOKEN = 'a'.repeat(64);
const request = (address: string, headers: Record<string, string> = {}, url = '/') => ({ socket: { remoteAddress: address }, headers: { host: 'localhost:7800', ...headers }, url });

describe('who may use the dashboard', () => {
  it('lets the machine itself in, not a proxy nor another address', () => {
    expect(isLocal(request('127.0.0.1'))).toBe(true);
    expect(isLocal(request('::ffff:127.0.0.1', { host: '127.0.0.1:7800' }))).toBe(true);
    expect(isLocal(request('::1', { host: '[::1]:7800' }))).toBe(true);
    // tailscale serve connects from the loopback, but adds its headers and keeps the public host name.
    expect(isLocal(request('127.0.0.1', { 'tailscale-user-login': 'me@example.com' }))).toBe(false);
    expect(isLocal(request('127.0.0.1', { 'x-forwarded-for': '100.64.0.2' }))).toBe(false);
    expect(isLocal(request('127.0.0.1', { host: 'pc.tail1234.ts.net' }))).toBe(false);
    expect(isLocal(request('172.19.0.1'))).toBe(false);
    expect(isLocal(request('100.64.0.2'))).toBe(false);
  });

  it('keeps its token in the registry, made once, unless the environment gives one', () => {
    const registry = mkdtempSync(join(tmpdir(), 'agents-access-'));
    folders.push(registry);
    const made = dashboardToken(registry, {});
    expect(made).toMatch(/^[0-9a-f]{64}$/);
    expect(dashboardToken(registry, {})).toBe(made);
    expect(readFileSync(join(registry, 'dashboard-token'), 'utf8').trim()).toBe(made);
    expect(statSync(join(registry, 'dashboard-token')).mode & 0o077).toBe(0);
    expect(dashboardToken(registry, { AGENTS_DASHBOARD_TOKEN: 'secret' })).toBe('secret');
  });

  it('takes the token once in the URL, then by its cookie or a bearer header', () => {
    const remote = { 'tailscale-user-login': 'me@example.com', host: 'pc.tail1234.ts.net' };
    const first = checkAccess(request('127.0.0.1', remote, `/agents?tab=pending&token=${TOKEN}`), TOKEN);
    expect(first.redirect).toBe('/agents?tab=pending');
    expect(first.cookie).toContain(`${COOKIE}=${TOKEN}; Path=/; HttpOnly; SameSite=Lax`);
    expect(first.cookie).toContain('Secure');
    expect(checkAccess(request('127.0.0.1', remote, '/agents?token=wrong'), TOKEN)).toEqual({ ok: false });
    expect(checkAccess(request('127.0.0.1', remote, '/agents'), TOKEN)).toEqual({ ok: false });
    expect(checkAccess(request('127.0.0.1', { ...remote, cookie: `theme=dark; ${COOKIE}=${TOKEN}` }, '/api/agents'), TOKEN)).toEqual({ ok: true });
    expect(checkAccess(request('100.64.0.2', { authorization: `Bearer ${TOKEN}` }, '/api/agents'), TOKEN)).toEqual({ ok: true });
    expect(checkAccess(request('127.0.0.1', {}, '/agents'), TOKEN)).toEqual({ ok: true });
  });

  it('refuses in JSON for the API and in a page otherwise, and redirects with the cookie', () => {
    const answer = () => {
      const out = { status: 0, headers: {} as Record<string, string>, body: '' };
      return { out, response: { writeHead: (status: number, headers: Record<string, string>) => Object.assign(out, { status, headers }), end: (body = '') => (out.body = body) } };
    };
    const api = answer();
    expect(guard(request('100.64.0.2', {}, '/api/up/nid'), api.response, TOKEN)).toBe(true);
    expect(api.out.status).toBe(401);
    expect(JSON.parse(api.out.body)).toMatchObject({ ok: false });
    const page = answer();
    guard(request('100.64.0.2', {}, '/'), page.response, TOKEN);
    expect(page.out.body).toContain('Accès refusé');
    const redirect = answer();
    expect(guard(request('100.64.0.2', {}, `/?token=${TOKEN}`), redirect.response, TOKEN)).toBe(true);
    expect(redirect.out).toMatchObject({ status: 302, headers: { location: '/' } });
    expect(guard(request('127.0.0.1', {}, '/'), answer().response, TOKEN)).toBe(false);
  });
});
