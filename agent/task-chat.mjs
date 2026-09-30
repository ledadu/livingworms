// A conversation with Claude about one task of the backlog (Backlog page, 💬): to improve, refine or correct it. Each
// task has its own thread, <registry>/chats/<id>.json, and its own claude session (resumed turn after turn). Claude
// runs in the main checkout with read-only tools (Read, Grep, Glob; everything else denied), so that it can check the
// code a task talks about, and never writes: a new version of the task comes back as a proposal, in a ```tache block,
// that the user applies (or not) from the page.
//
// AGENTS_CLAUDE_BIN: the executable (tests use a fake one).
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { claudeBin } from './launch.mjs';
import { project } from '../config.mjs';

export const CHAT_TOOLS = ['Read', 'Grep', 'Glob'];
const chatDir = (registry) => join(registry, 'chats');
const chatFile = (registry, id) => join(chatDir(registry), `${id}.json`);

export function readChat(registry, id) {
  try {
    return JSON.parse(readFileSync(chatFile(registry, id), 'utf8'));
  } catch {
    return { id, sessionId: null, pending: false, messages: [] };
  }
}

function writeChat(registry, chat) {
  mkdirSync(chatDir(registry), { recursive: true });
  const file = chatFile(registry, chat.id);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(chat, null, 2)}\n`);
  renameSync(temp, file);
}

/** The arguments of one turn: a new session the first time, then the same one resumed; read-only tools. */
export function chatArgs({ sessionId, resume }) {
  return ['-p', resume ? '--resume' : '--session-id', sessionId, '--tools', CHAT_TOOLS.join(','), '--allowedTools', CHAT_TOOLS.join(','),
    '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--output-format', 'json'];
}

/** What Claude reads on a turn: the role and the rules on the first one, the task as it stands now on every one. */
export function chatPrompt({ task, message, first, root }) {
  const current = `Le chantier tel qu'il est maintenant dans ${project.paths.backlog} (groupe « ${task.section} ») :\n\n\`\`\`markdown\n${task.text}\n\`\`\``;
  if (!first) return `${current}\n\nMessage de l'utilisateur :\n\n${message}`;
  return `Tu aides l'utilisateur à améliorer, affiner ou corriger **un chantier** du backlog de ${project.name}, ${project.pitch} (dépôt : ${root}). Le backlog (${project.paths.backlog}) liste les chantiers confiés à des agents de code ; la roadmap (${project.paths.roadmap}) donne le cap, les docs de conception sont dans ${project.paths.design.join(', ')}. Tu peux lire et chercher dans le dépôt (Read, Grep, Glob) pour vérifier ce qui existe déjà et citer les bons fichiers ; tu ne modifies rien.

Réponds en français, court et concret : questions pour lever les ambiguïtés, découpage, critères de sortie vérifiables, risques, fichiers concernés. Un chantier doit pouvoir être confié tel quel à un agent qui ne connaît que lui.

Quand tu proposes une nouvelle version du chantier, donne-la **en entier** dans un bloc \`\`\`tache (et un seul par réponse) : elle commence par son titre « ### … », sans ligne d'état (« > … »), avec des sous-titres #### ou des puces si besoin, jamais de titre ## ou d'autre ###. L'utilisateur l'appliquera lui-même ; hors de ce bloc, explique en quelques lignes ce que tu as changé.

${current}

Message de l'utilisateur :

${message}`;
}

/** The answer split into its text and its proposal (the last ```tache block), if any. */
export function splitAnswer(text) {
  const blocks = [...String(text ?? '').matchAll(/```tache[^\n]*\n([\s\S]*?)```/g)];
  if (!blocks.length) return { text: String(text ?? '').trim(), proposal: null };
  const proposal = blocks.at(-1)[1].trim();
  const rest = String(text).replace(/```tache[^\n]*\n[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return { text: rest, proposal };
}

/**
 * Starts one turn about a task: the user's message is recorded at once, Claude answers in the background (the page
 * polls readChat until `pending` is false). Refused while a turn is under way.
 */
export function askAboutTask({ registry, root, task, message, env = process.env, now = () => new Date().toISOString(), timeoutMs = 300_000 }) {
  const text = String(message ?? '').trim();
  if (!text) throw new Error('message vide');
  const chat = readChat(registry, task.id);
  if (chat.pending) throw new Error('Claude répond encore au message précédent');
  const first = !chat.sessionId;
  chat.sessionId ??= randomUUID();
  chat.title = task.title;
  chat.pending = true;
  chat.messages.push({ role: 'user', text, at: now() });
  writeChat(registry, chat);

  const childEnv = { ...env };
  delete childEnv.CLAUDECODE;
  delete childEnv.CLAUDE_CODE_ENTRYPOINT;
  const child = spawn(claudeBin(env), chatArgs({ sessionId: chat.sessionId, resume: !first }), { cwd: root, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
  const finish = (answer) => {
    clearTimeout(timer);
    const latest = readChat(registry, task.id);
    latest.pending = false;
    latest.messages.push({ role: 'assistant', at: now(), ...answer });
    writeChat(registry, latest);
  };
  child.on('error', (error) => finish({ text: '', error: `claude introuvable : ${error.message}` }));
  child.on('close', (code) => {
    let result = null;
    try {
      result = JSON.parse(stdout.trim().split('\n').filter(Boolean).at(-1) ?? '');
    } catch {}
    if (!result || result.is_error || code !== 0 && !result.result) {
      finish({ text: '', error: (result?.result || stderr || stdout || `claude s'est arrêté (code ${code})`).toString().trim().slice(0, 2000) });
      return;
    }
    finish({ ...splitAnswer(result.result), cost: result.total_cost_usd ?? null });
  });
  child.stdin.end(chatPrompt({ task, message: text, first, root }));
  return readChat(registry, task.id);
}

/** Marks a proposal as applied (the page shows it so), or forgets the whole thread. */
export function markApplied(registry, id, index, now = () => new Date().toISOString()) {
  const chat = readChat(registry, id);
  if (chat.messages[index]?.proposal) chat.messages[index].appliedAt = now();
  writeChat(registry, chat);
  return chat;
}

export function clearChat(registry, id) {
  const chat = readChat(registry, id);
  if (chat.pending) throw new Error('Claude répond encore');
  writeChat(registry, { id, sessionId: null, pending: false, messages: [] });
  return readChat(registry, id);
}

export const hasChat = (registry, id) => existsSync(chatFile(registry, id));
