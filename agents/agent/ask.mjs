#!/usr/bin/env node
// An agent asks the user, through the dashboard (/questions): a choice, a validation, or a strategic feedback.
// A choice or validation waits for the answer (or goes on with the recommended option when « Décider seul » is on or
// the deadline passes); a feedback never waits. See `node agent/ask.mjs --help`.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createQuestion,
  DEFAULT_WAIT_MS,
  formatAnswer,
  listQuestions,
  MAX_WAIT_MS,
  readQuestion,
  registryDir,
  waitForAnswer,
  withdrawQuestion,
} from './questions.mjs';
import { askPath } from '../config.mjs';

const HELP = `Questions de l'agent à l'utilisateur (tableau de bord, page /questions).

  node ${askPath} choice --title "Quelle forme pour X ?" --context "…" \\
      --option "Option A :: pourquoi, coût" --option "*Option B :: la recommandée" --impact "…"
  node ${askPath} validation --title "Je supprime l'ancien format ?" --context "…" [--recommend no]
  node ${askPath} feedback --title "Le chantier touche aussi Y" --context "…" [--severity info|important|critical]
  node ${askPath} --resume <id>       reprend l'attente d'une question
  node ${askPath} --withdraw <id> [--reason "…"]
  node ${askPath} --list              mes questions

Options : --task "tâche en cours"  --wait <s> (attente de cet appel, 300 par défaut, 540 au plus)
          --timeout <min> (délai global, puis option recommandée ; réglage du tableau de bord par défaut)
          --agent <nom> (sinon lu dans .env.agent)   --recommended <n> (numéro de l'option recommandée, sinon « * » ou la 1re)
Lancer avec l'outil Bash et timeout 600000. La réponse s'imprime en lignes « clé: valeur » ; « next: » dit quoi faire.`;

function parse(argv) {
  const args = { options: [], _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      args._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (key === 'help' || key === 'list') {
      args[key] = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined) throw new Error(`valeur manquante pour ${arg}`);
    if (key === 'option') args.options.push(value);
    else args[key] = value;
  }
  return args;
}

// « *Label :: description » : a leading star marks the recommended option.
function option(spec) {
  const recommended = spec.startsWith('*');
  const [label, ...rest] = spec.replace(/^\*\s*/, '').split('::');
  return { label: label.trim(), description: rest.join('::').trim(), recommended };
}

function agentName(args) {
  if (args.agent) return args.agent;
  if (process.env.AGENT_NAME) return process.env.AGENT_NAME;
  let top = process.cwd();
  try {
    top = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {}
  const file = join(top, '.env.agent');
  if (!existsSync(file)) return '';
  return /^AGENT_NAME=(.*)$/m.exec(readFileSync(file, 'utf8'))?.[1]?.trim() ?? '';
}

function waitMs(args) {
  if (args.wait === undefined) return DEFAULT_WAIT_MS;
  const seconds = Number(args.wait);
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`--wait invalide : ${args.wait}`);
  return Math.min(seconds * 1000, MAX_WAIT_MS);
}

async function main() {
  const args = parse(process.argv.slice(2));
  if (args.help || (!args._.length && !args.resume && !args.withdraw && !args.list)) {
    console.log(HELP);
    return 0;
  }
  const root = registryDir();
  if (args.list) {
    const agent = agentName(args);
    for (const question of listQuestions(root, agent ? { agent } : {})) console.log(`${question.id}\t${question.type}\t${question.status}\t${question.title}`);
    return 0;
  }
  if (args.withdraw) {
    console.log(formatAnswer(withdrawQuestion(root, args.withdraw, { reason: args.reason })));
    return 0;
  }
  let question;
  if (args.resume) {
    question = readQuestion(root, args.resume);
    if (!question) throw new Error(`question inconnue : ${args.resume}`);
  } else {
    const type = args._[0];
    question = createQuestion(
      root,
      {
        type,
        agent: agentName(args),
        task: args.task,
        title: args.title,
        context: args.context,
        impact: args.impact,
        severity: args.severity,
        options: args.options.map(option),
        recommended: args.recommended !== undefined ? Number(args.recommended) - 1 : args.recommend,
      },
      { timeoutMinutes: args.timeout },
    );
    if (question.status === 'pending' && question.type !== 'feedback') {
      // First, so that the id survives even if the shell tool cuts the wait.
      console.log(`question ${question.id} posée sur le tableau de bord ; attente de la réponse…`);
    }
  }
  const settled = await waitForAnswer(root, question.id, { waitMs: waitMs(args) });
  console.log(formatAnswer(settled));
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`ask: ${error.message}`);
    process.exit(2);
  },
);
