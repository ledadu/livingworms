#!/usr/bin/env node
// The team (team.mjs) as an MCP server, for the agents: the same as `team.mjs`, as tools Claude Code finds by itself.
// Stdio transport (one JSON-RPC message per line), no dependency. The dashboard gives it to every agent it starts
// (launch.mjs, --mcp-config): the agent's name comes in AGENT_NAME, the registry in AGENT_REGISTRY.
import { createInterface } from 'node:readline';
import { agents, context, format, inbox, openQuestions, related, say, task, tasks, who } from './team.mjs';

export const TOOLS = [
  { name: 'taches', description: "Les tâches du backlog, à jour : état, agent, sous-tâches (↳), ⚡ auto. « all » : les livrées aussi.", inputSchema: { type: 'object', properties: { all: { type: 'boolean' } } },
    run: (ctx, args) => format('tasks', tasks(ctx, { all: Boolean(args.all) })) },
  { name: 'tache', description: "Le texte entier d'une tâche du backlog (par son id ou un mot de son titre), avec sa tâche mère et ses sous-tâches.", inputSchema: { type: 'object', properties: { tache: { type: 'string' } }, required: ['tache'] },
    run: (ctx, args) => format('task', task(ctx, args.tache)) },
  { name: 'agents', description: "Les autres agents : leur état (au travail, fini, en erreur…), leur tâche, les fichiers qu'ils changent.", inputSchema: { type: 'object', properties: {} },
    run: (ctx) => format('agents', agents(ctx)) },
  { name: 'lies', description: "Ce qui touche ton travail : les agents qui changent les mêmes fichiers que toi (et lesquels), ta tâche mère et tes sous-tâches, les tâches qui nomment tes fichiers. À regarder au début, et avant de toucher un fichier partagé.", inputSchema: { type: 'object', properties: {} },
    run: (ctx) => format('related', related(ctx)) },
  { name: 'qui', description: "Qui d'autre change ce fichier (commité sur sa branche, ou pas encore).", inputSchema: { type: 'object', properties: { fichier: { type: 'string' } }, required: ['fichier'] },
    run: (ctx, args) => format('who', who(ctx, args.fichier)) },
  { name: 'ecrire', description: "Écrire à un autre agent (son nom) ou à tous (« tous ») : prévenir d'un changement dans un fichier partagé, d'une fonction renommée, d'un choix qui le concerne. Court et concret.", inputSchema: { type: 'object', properties: { a: { type: 'string', description: "nom de l'agent, ou « tous »" }, message: { type: 'string' }, fichier: { type: 'string', description: 'le fichier concerné, s’il y en a un' } }, required: ['a', 'message'] },
    run: (ctx, args) => format('say', say(ctx, args.a, args.message, { about: args.fichier ?? null })) },
  { name: 'messages', description: "Tes messages des autres agents (et de l'utilisateur) non lus ; « all » : tous. À regarder aux étapes clés de ton chantier.", inputSchema: { type: 'object', properties: { all: { type: 'boolean' } } },
    run: (ctx, args) => format('inbox', inbox(ctx, { all: Boolean(args.all) })) },
  { name: 'questions', description: "Les questions des agents en attente de réponse de l'utilisateur.", inputSchema: { type: 'object', properties: {} },
    run: (ctx) => format('questions', openQuestions(ctx)) },
];

/** Answers one JSON-RPC message (null for a notification). */
export function handle(message, ctx) {
  const { id, method, params = {} } = message;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, text) => ({ jsonrpc: '2.0', id, error: { code, message: text } });
  if (id === undefined || id === null) return null;
  if (method === 'initialize') return reply({ protocolVersion: params.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'equipe', version: '1.0.0' },
    instructions: "L'équipe d'agents : les tâches du backlog à jour, les autres agents et leurs fichiers, et des messages entre agents. Regarde « lies » au début de ton chantier et avant de toucher un fichier partagé ; « messages » aux étapes clés ; « ecrire » pour prévenir un agent concerné." });
  if (method === 'ping') return reply({});
  if (method === 'tools/list') return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  if (method === 'tools/call') {
    const tool = TOOLS.find((one) => one.name === params.name);
    if (!tool) return fail(-32602, `outil inconnu ${params.name}`);
    try {
      return reply({ content: [{ type: 'text', text: tool.run(ctx, params.arguments ?? {}) || '(rien)' }] });
    } catch (error) {
      return reply({ content: [{ type: 'text', text: `erreur : ${error.message}` }], isError: true });
    }
  }
  return fail(-32601, `méthode inconnue ${method}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ctx = context();
  const lines = createInterface({ input: process.stdin });
  lines.on('line', (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalide' } })}\n`);
      return;
    }
    const answer = handle(message, ctx);
    if (answer) process.stdout.write(`${JSON.stringify(answer)}\n`);
  });
}
