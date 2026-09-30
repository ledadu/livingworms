// The goal of an agent, read from its prompt: the one written by the Roadmap page (buildPrompt in roadmap.mjs) or by the
// orchestrator (docs/orchestration.md « Lancer »). Both carry a « ## Chantier … » section, followed by the
// choices already made, the key code, the neighbours and what to check. Shown on the agent's card (dashboard.html).

// The sections that close the task's text. Anything else, even a « ## » heading copied from the roadmap, belongs to it.
const AFTER = /^##\s+(Choix déjà faits|Code clé|Voisins|À vérifier|Consigne|Rapport)\b/i;

const clean = (line) => line.replace(/^#+\s*/, '').replace(/\s*:\s*$/, '').trim();

const shortTitle = (title) => (title.length > 140 ? `${title.slice(0, 139).trimEnd()}…` : title);

const firstSentence = (text) => {
  const plain = text.replace(/\*\*|`/g, '').trim();
  const cut = /^(.{12,}?)(?:[.:;](?:\s|$)| — )/.exec(plain);
  return (cut ? cut[1] : plain).trim();
};

// The title of a free prompt. A line « Chantier : backlog de docs/roadmap.md, « ### Section » → **Point** : … » gives
// the point, or else the section; a generic heading (« Contexte », « Besoin … », « Mission ») gives the first sentence
// under it; else the first line.
function freeTitle(lines) {
  const chantier = lines.find((line) => /^\s*Chantier\s*:/i.test(line));
  if (chantier) {
    const where = /roadmap/.test(chantier) ? (/backlog/i.test(chantier) ? 'Backlog' : 'Roadmap') : null;
    const point = /→\s*\*\*(.+?)\*\*/.exec(chantier)?.[1];
    const section = /«\s*#+\s*(.+?)\s*»\s*(?:[,:]\s*([^(—.;]*))?/.exec(chantier);
    if (point) return { title: point, where: section ? `${where ?? 'Roadmap'} › ${section[1]}` : where };
    const detail = section?.[2]?.replace(/\s*:\s*$/, '').trim();
    if (section) return { title: section[1] + (detail ? ` (${detail})` : ''), where };
    return { title: firstSentence(chantier.replace(/^\s*Chantier\s*:\s*/i, '')), where };
  }
  const index = lines.findIndex((line) => line.trim());
  if (index < 0) return { title: '', where: null };
  if (/^#+\s/.test(lines[index]) && /^#+\s*(Contexte|Besoin|Le besoin|Mission|Situation|Demande)\b/i.test(lines[index])) {
    const next = lines.slice(index + 1).find((line) => line.trim() && !/^#+\s/.test(line));
    if (next) return { title: firstSentence(next.replace(/^\s*[-*>]\s*/, '')), where: null };
  }
  const first = clean(lines[index]);
  return { title: /^(Mission|Contexte)\b/i.test(first) ? firstSentence(lines.slice(index + 1).find((line) => line.trim()) ?? first) : firstSentence(first), where: null };
}

/**
 * { title, where, base, text, choices, checks } from a prompt, or null when it has no text. `where` is the place in
 * the roadmap (« Backlog », ligne 358) when the prompt says it; `base` the branch the work goes back to (« partie de
 * backlog »); `text` the task itself in Markdown; `checks` the bullets of « À vérifier ».
 */
export function parseGoal(prompt) {
  const source = String(prompt ?? '').replace(/\r/g, '');
  if (!source.trim()) return null;
  const lines = source.split('\n');
  const start = lines.findIndex((line) => /^##\s+Chantier\b/i.test(line));
  const section = (name) => {
    const at = lines.findIndex((line) => new RegExp(`^##\\s+${name}`, 'i').test(line));
    if (at < 0) return [];
    const out = [];
    for (let i = at + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) {
      const bullet = /^\s*[-*]\s+(.*)$/.exec(lines[i]);
      if (bullet) out.push(bullet[1].trim());
    }
    return out;
  };
  const choices = section('Choix déjà faits').filter((choice) => !/^Aucun\b/.test(choice));
  const checks = section('À vérifier');
  const base = /partie de ([\w./-]+?)\)/.exec(source)?.[1] ?? null;

  if (start < 0) {
    // A free prompt: its first lines past the « Tu es l'agent … » and « Worktree : … » preamble.
    const body = lines.filter((line) => !/^(Tu es l.agent|Worktree\s*:|Lis d.abord)/.test(line.trim())).join('\n').trim();
    const { title, where } = freeTitle(body.split('\n'));
    return { title: shortTitle(title), where, base, text: body, choices, checks };
  }

  const header = lines[start].replace(/^##\s+Chantier\s*/i, '');
  const where = /\((.*)\)/.exec(header)?.[1]?.replace(/^extrait exact de docs\/[\w-]+\.md,\s*/, '') ?? null;
  const inline = /^[:—-]\s*(.+)$/.exec(header.replace(/\(.*\)/, '').trim())?.[1];
  const body = [];
  for (let i = start + 1; i < lines.length && !AFTER.test(lines[i]); i++) body.push(lines[i]);
  let text = body.join('\n').trim();
  let title = inline?.trim();
  if (!title) {
    const heading = /^#{2,4}\s+(.+)$/m.exec(text);
    const firstLine = text.split('\n').find((line) => line.trim()) ?? '';
    title = clean(heading && text.indexOf(heading[0]) === text.indexOf(firstLine) ? heading[1] : firstLine);
    // The title heading is not repeated in the text.
    if (heading && text.startsWith(heading[0])) text = text.slice(heading[0].length).trim();
  }
  return { title: shortTitle(title), where, base, text, choices, checks };
}
