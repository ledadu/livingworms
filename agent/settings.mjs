// The effort and the model of each agent: two lines of its registry file, AGENT_EFFORT and AGENT_MODEL. They are set
// when its task is queued (Backlog page), from its card (Agents page) or by agent.sh new (EFFORT=, MODEL=), and read
// by every start of claude for it (launch.mjs: --effort, --model) and by the orchestrator (queue.mjs prints them; the
// agent types chantier-<effort> of claude-agents/ carry the effort). Unset, the project's defaults apply
// (defaults.effort, defaults.model of agents.config.mjs), and without those Claude Code's own.
//
// For the tasks being chosen, an effort is proposed at once from the text (suggestEffort), and Claude may propose an
// effort and a model for each (proposeSettings: one claude -p call, no tools).
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EFFORTS, project } from '../config.mjs';
import { claudeBin } from './launch.mjs';

export { EFFORTS };
const MODEL = /^[a-z0-9][a-z0-9.[\]-]{0,63}$/i;
const LINES = { effort: 'AGENT_EFFORT', model: 'AGENT_MODEL' };

/** The settings as given (empty or « défaut » meaning none), checked: { effort, model }, null for none. */
export function checkSettings({ effort = null, model = null } = {}) {
  const clean = (value) => (value === undefined || value === null || String(value).trim() === '' || value === 'default' ? null : String(value).trim());
  const out = { effort: clean(effort), model: clean(model) };
  if (out.effort && !EFFORTS.includes(out.effort)) throw new Error(`effort inconnu « ${out.effort} » : ${EFFORTS.join(', ')}`);
  if (out.model && !MODEL.test(out.model)) throw new Error(`modèle invalide « ${out.model} »`);
  return out;
}

const envFile = (registry, name) => join(registry, `${name}.env`);

/** The agent's own settings, from its registry file: { effort, model }, null when unset. */
export function readSettings(registry, name) {
  const file = envFile(registry, name);
  if (!existsSync(file)) return { effort: null, model: null };
  const text = readFileSync(file, 'utf8');
  const line = (key) => new RegExp(`^${key}=(.*)$`, 'm').exec(text)?.[1]?.trim() || null;
  return { effort: line(LINES.effort), model: line(LINES.model) };
}

/** Sets the agent's own settings (a missing key is left as it is, null removes it). Returns them. */
export function writeSettings(registry, name, settings) {
  const file = envFile(registry, name);
  if (!existsSync(file)) throw new Error(`agent inconnu ${name}`);
  const given = checkSettings({ ...readSettings(registry, name), ...settings });
  let text = readFileSync(file, 'utf8');
  for (const [key, line] of Object.entries(LINES)) {
    text = text.replace(new RegExp(`^${line}=.*\\n?`, 'm'), '');
    if (given[key]) text = `${text.replace(/\n?$/, '\n')}${line}=${given[key]}\n`;
  }
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, file);
  return given;
}

/** What a start of claude uses for the agent: its own settings, else the project's defaults, else none. */
export function effectiveSettings(registry, name, defaults = project.defaults) {
  const own = readSettings(registry, name);
  return { effort: own.effort ?? defaults?.effort ?? null, model: own.model ?? defaults?.model ?? null };
}

/** The arguments of claude for these settings. */
export const settingsArgs = ({ effort, model } = {}) => [...(effort ? ['--effort', effort] : []), ...(model ? ['--model', model] : [])];

/** The agent type the orchestrator launches a task with: chantier-<effort> (claude-agents/), else general-purpose. */
export const agentType = (effort) => (effort && EFFORTS.includes(effort) ? `chantier-${effort}` : 'general-purpose');

// --- Proposals -------------------------------------------------------------------------------------------------------

const HEAVY = /\b(architecture|refonte|refondre|migration|migrer|protocole|s[ée]curit[ée]|anti-?triche|multijoueur|synchronis|r[ée]seau|performances?|moteur|persistance|base de donn[ée]es)\b/i;
const LIGHT = /\b(typo|faute|libell[ée]|texte|wording|couleur|renomm|traduction|coquille|ic[ôo]ne)\b/i;

/**
 * An effort for a task of the backlog, from its text alone: low for a small wording or colour change, medium for a
 * short task, xhigh for a long one or one that touches the structure (architecture, protocol, security, performance),
 * high otherwise; never max, which stays a deliberate choice. { effort, why }.
 */
export function suggestEffort(task) {
  const text = String(task?.text ?? '');
  const size = text.replace(/\s+/g, ' ').length;
  const steps = text.split('\n').filter((line) => /^\s*(####|[-*]\s+\*\*|\d+\.\s)/.test(line)).length;
  const files = task?.files?.length ?? 0;
  if (size > 3000 || steps >= 6 || (HEAVY.test(text) && size > 600)) return { effort: 'xhigh', why: HEAVY.test(text) ? 'touche la structure du jeu' : 'chantier long, en plusieurs étapes' };
  if (size < 400 && steps <= 1 && files <= 1 && LIGHT.test(text)) return { effort: 'low', why: 'petite retouche' };
  if (size < 900 && steps <= 2 && files <= 3) return { effort: 'medium', why: 'chantier court et circonscrit' };
  return { effort: 'high', why: 'chantier ordinaire' };
}

/** What Claude reads to propose settings: the tasks, the levels and the models, and the JSON expected back. */
export function proposalPrompt(tasks, { models = project.models } = {}) {
  const blocks = tasks.map((task) => `### ${task.id}\n\n${String(task.text ?? '').slice(0, 4000)}`).join('\n\n');
  return `Tu choisis, pour chaque chantier ci-dessous du backlog de ${project.name} (${project.pitch}), l'**effort** de réflexion et le **modèle** de l'agent de code qui le mènera seul dans son worktree (tests, captures, rapport compris).

- Efforts : low (retouche triviale), medium (chantier court et clair), high (chantier ordinaire), xhigh (long, ambigu, ou qui touche l'architecture, le protocole, la sécurité, les performances), max (exceptionnel : très risqué ou très difficile). Ne dépense pas pour rien : le moins cher qui suffit.
- Modèles : ${models.join(', ')}. Laisse null quand le modèle par défaut convient ; propose un modèle plus léger pour une tâche simple, le plus fort pour une tâche difficile.

Réponds uniquement par un bloc \`\`\`json contenant un tableau, un objet par chantier : {"id": "<id après ###>", "effort": "<niveau>", "model": "<modèle ou null>", "why": "<raison en quelques mots>"}.

${blocks}`;
}

/** The proposals of Claude's answer: id -> { effort, model, why }, invalid ones left out. */
export function parseProposals(text, ids) {
  const block = /```json\s*([\s\S]*?)```/.exec(String(text ?? ''))?.[1] ?? String(text ?? '');
  let list;
  try {
    list = JSON.parse(block.trim());
  } catch {
    const array = /\[[\s\S]*\]/.exec(block)?.[0];
    try {
      list = JSON.parse(array ?? 'null');
    } catch {
      list = null;
    }
  }
  const out = {};
  for (const one of Array.isArray(list) ? list : []) {
    if (!one || !ids.includes(one.id)) continue;
    try {
      const settings = checkSettings({ effort: one.effort, model: one.model === 'null' ? null : one.model });
      out[one.id] = { ...settings, why: String(one.why ?? '').slice(0, 200) };
    } catch {}
  }
  return out;
}

/**
 * Asks Claude for the settings of these tasks ({ id, text }): one claude -p call without tools, in `root`. Resolves
 * to id -> { effort, model, why }; rejects with the error of claude.
 */
export function proposeSettings({ tasks, root, env = process.env, model = project.suggestModel, timeoutMs = 180_000 }) {
  if (!tasks.length) return Promise.resolve({});
  const childEnv = { ...env };
  delete childEnv.CLAUDECODE;
  delete childEnv.CLAUDE_CODE_ENTRYPOINT;
  const args = ['-p', '--tools', '', '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--output-format', 'json', ...(model ? ['--model', model] : [])];
  return new Promise((resolve, reject) => {
    const child = spawn(claudeBin(env), args, { cwd: root, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.on('error', (error) => (clearTimeout(timer), reject(new Error(`claude introuvable : ${error.message}`))));
    child.on('close', (code) => {
      clearTimeout(timer);
      let result = null;
      try {
        result = JSON.parse(stdout.trim().split('\n').filter(Boolean).at(-1) ?? '');
      } catch {}
      if (!result || result.is_error || !result.result) {
        reject(new Error((result?.result || stderr || stdout || `claude s'est arrêté (code ${code})`).toString().trim().slice(0, 500)));
        return;
      }
      resolve(parseProposals(result.result, tasks.map((task) => task.id)));
    });
    child.stdin.end(proposalPrompt(tasks));
  });
}
