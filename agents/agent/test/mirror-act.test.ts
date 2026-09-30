import '../../test/env.mjs';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRequest, recordAction, summarize, toRoute } from '../mirror-act.mjs';

const ask = (request: object) => toRoute(parseRequest(`miroir · une action\n${JSON.stringify(request)}`));

describe('the actions of the mirror page', () => {
  it('reads the action of a comment, and a plain « miroir » as a refresh', () => {
    expect(parseRequest('miroir · Fusionner grotte\n{"id":"abc123","action":"accept","label":"Fusionner grotte","args":{"name":"grotte"}}')).toEqual({ id: 'abc123', action: 'accept', label: 'Fusionner grotte', args: { name: 'grotte' } });
    expect(parseRequest('miroir')).toMatchObject({ action: 'refresh', id: null });
    expect(() => parseRequest('bonjour')).toThrow(/pas d’action/);
    expect(() => parseRequest('{"action":"rm -rf"}')).toThrow(/action inconnue/);
    expect(() => parseRequest('{"action":"toString"}')).toThrow(/action inconnue/);
    expect(() => parseRequest('{"action":"up","id":"../x"}')).toThrow(/identifiant/);
    expect(() => parseRequest('{"action": up}')).toThrow(/JSON/);
  });

  it('sends each action to the dashboard route of the same button, arguments checked', () => {
    expect(ask({ action: 'refresh' })).toBeNull();
    expect(ask({ action: 'accept', args: { name: 'decor-grotte' } })).toEqual({ path: '/api/accept/decor-grotte' });
    expect(ask({ action: 'rebase', args: { name: 'grotte' } })).toEqual({ path: '/api/rebase/grotte', query: { base: 'backlog' } });
    expect(ask({ action: 'settings', args: { name: 'grotte', effort: 'high', model: 'sonnet' } })).toMatchObject({ body: { effort: 'high', model: 'sonnet' } });
    expect(ask({ action: 'answer', args: { id: 'q1', option: 1, comment: 'ok' } })).toEqual({ path: '/api/questions/q1/answer', body: { option: 1, comment: 'ok' } });
    expect(ask({ action: 'answer', args: { id: 'q2', approved: false } })).toMatchObject({ body: { option: null, approved: false } });
    expect(ask({ action: 'enqueue', args: { tasks: [{ id: 'la-parade', name: 'parade', effort: 'xhigh' }] } })).toEqual({
      path: '/api/roadmap/enqueue',
      body: { tasks: [{ id: 'la-parade', name: 'parade', base: 'backlog', effort: 'xhigh', model: null }] },
    });
    expect(ask({ action: 'publish', args: { version: '0.2.0' } })).toEqual({ path: '/api/publish', body: { version: '0.2.0', branch: true } });
  });

  it('refuses what no button could send', () => {
    for (const bad of [
      { action: 'accept', args: { name: '../../etc' } },
      { action: 'up', args: { name: 'a b' } },
      { action: 'rebase', args: { name: 'x', base: 'main; rm' } },
      { action: 'settings', args: { name: 'x', effort: 'turbo' } },
      { action: 'answer', args: { id: 'q1', option: -1 } },
      { action: 'enqueue', args: { tasks: [] } },
      { action: 'order', args: { name: 'x', order: '   ' } },
      { action: 'publish', args: { version: 'latest' } },
    ]) expect(() => ask(bad)).toThrow();
  });

  it('tells what happened in one line, and keeps the last results', () => {
    expect(summarize({ ok: true, message: 'Fusionnée.' })).toEqual({ ok: true, message: 'Fusionnée.' });
    expect(summarize({ ok: false, error: 'l’agent tourne encore' })).toEqual({ ok: false, message: 'l’agent tourne encore' });
    expect(summarize({ results: [{ name: 'a', ok: true }, { name: 'b', ok: false, error: 'pris' }] })).toEqual({ ok: false, message: 'a : ok · b : pris' });
    expect(summarize({ ok: true, question: {} })).toEqual({ ok: true, message: 'réponse enregistrée' });
    const file = join(mkdtempSync(join(tmpdir(), 'mirror-act-')), 'actions.json');
    for (let i = 0; i < 15; i++) recordAction({ id: `id${i}xxxx`, ok: true, message: 'fait' }, file);
    const kept = JSON.parse(readFileSync(file, 'utf8'));
    expect(kept).toHaveLength(12);
    expect(kept.at(-1).id).toBe('id14xxxx');
  });
});
