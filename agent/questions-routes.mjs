// Routes of the agents' questions in the dashboard (dashboard.mjs): the page /questions, the badge script, and the API.
//
//   GET  /api/questions[?agent=&type=&status=]   { questions, pending, unread, byAgent, settings }
//   POST /api/questions/<id>/answer              { option?, approved?, comment? }
//   POST /api/questions/<id>/read                { comment? }
//   POST /api/questions/<id>/withdraw            { reason? }
//   GET  /api/questions/settings, POST           { autonomous?, timeoutMinutes?, agents?: { <name>: boolean | null } }
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerQuestion, counts, expireStale, listQuestions, markRead, readSettings, withdrawQuestion, writeSettings } from './questions.mjs';
import { renderPage } from '../config.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) reject(new Error('corps trop grand'));
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON invalide'));
      }
    });
    request.on('error', reject);
  });
}

function send(response, status, value, type = 'application/json') {
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  response.end(type === 'application/json' ? JSON.stringify(value) : value);
}

/**
 * Handles the request when it is about questions and returns true; false otherwise. `registry` is the dashboard's
 * .git/agents; AGENT_REGISTRY replaces it for a throwaway registry.
 */
export async function handleQuestions(request, response, registry) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const root = process.env.AGENT_REGISTRY || registry;
  if (path === '/questions') {
    send(response, 200, renderPage(readFileSync(join(here, 'questions.html'), 'utf8')), 'text/html; charset=utf-8');
    return true;
  }
  if (path === '/questions-badge.js') {
    send(response, 200, readFileSync(join(here, 'questions-badge.js'), 'utf8'), 'text/javascript; charset=utf-8');
    return true;
  }
  if (!path.startsWith('/api/questions')) return false;
  try {
    if (path === '/api/questions/settings') {
      const settings = request.method === 'POST' ? writeSettings(root, await readBody(request)) : readSettings(root);
      send(response, 200, settings);
      return true;
    }
    if (path === '/api/questions' && request.method === 'GET') {
      expireStale(root);
      const all = listQuestions(root);
      const filter = Object.fromEntries(['agent', 'type', 'status'].map((key) => [key, url.searchParams.get(key)]).filter(([, value]) => value));
      const questions = all.filter((q) => Object.entries(filter).every(([key, value]) => q[key] === value));
      send(response, 200, { now: Date.now(), questions, ...counts(all), settings: readSettings(root) });
      return true;
    }
    const action = /^\/api\/questions\/([a-z0-9-]+)\/(answer|read|withdraw)$/.exec(path);
    if (action && request.method === 'POST') {
      const [, id, verb] = action;
      const body = await readBody(request);
      const question =
        verb === 'answer' ? answerQuestion(root, id, body) : verb === 'read' ? markRead(root, id, body) : withdrawQuestion(root, id, body);
      send(response, 200, { ok: true, question });
      return true;
    }
    send(response, 404, { ok: false, error: 'route inconnue' });
  } catch (error) {
    send(response, 400, { ok: false, error: error.message });
  }
  return true;
}
