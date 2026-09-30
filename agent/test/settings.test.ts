import '../../test/env.mjs';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  agentType,
  checkSettings,
  EFFORTS,
  effectiveSettings,
  parseProposals,
  proposalPrompt,
  proposeSettings,
  readSettings,
  settingsArgs,
  suggestEffort,
  writeSettings,
} from '../settings.mjs';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function registry() {
  const base = mkdtempSync(join(tmpdir(), 'agents-settings-'));
  folders.push(base);
  writeFileSync(join(base, 'nid.env'), 'AGENT_NAME=nid\nAGENT_SLOT=1\n');
  return base;
}

describe('the settings of an agent', () => {
  it('checks them: known efforts, plain model names, empty or « default » for none', () => {
    expect(EFFORTS).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(checkSettings({ effort: 'xhigh', model: 'claude-opus-5-5' })).toEqual({ effort: 'xhigh', model: 'claude-opus-5-5' });
    expect(checkSettings({ effort: '', model: 'default' })).toEqual({ effort: null, model: null });
    expect(checkSettings({ model: 'claude-sonnet-5-5[1m]' }).model).toBe('claude-sonnet-5-5[1m]');
    expect(() => checkSettings({ effort: 'ultra' })).toThrow(/effort inconnu/);
    expect(() => checkSettings({ model: 'opus; rm -rf /' })).toThrow(/modèle invalide/);
  });

  it('keeps them in the agent’s registry file, the other lines untouched', () => {
    const dir = registry();
    expect(readSettings(dir, 'nid')).toEqual({ effort: null, model: null });
    expect(writeSettings(dir, 'nid', { effort: 'high', model: 'sonnet' })).toEqual({ effort: 'high', model: 'sonnet' });
    expect(writeSettings(dir, 'nid', { effort: 'low' })).toEqual({ effort: 'low', model: 'sonnet' });
    expect(readFileSync(join(dir, 'nid.env'), 'utf8')).toBe('AGENT_NAME=nid\nAGENT_SLOT=1\nAGENT_EFFORT=low\nAGENT_MODEL=sonnet\n');
    writeSettings(dir, 'nid', { effort: null, model: null });
    expect(readFileSync(join(dir, 'nid.env'), 'utf8')).toBe('AGENT_NAME=nid\nAGENT_SLOT=1\n');
    expect(() => writeSettings(dir, 'absent', { effort: 'low' })).toThrow(/agent inconnu/);
    expect(() => writeSettings(dir, 'nid', { effort: 'ultra' })).toThrow(/effort inconnu/);
  });

  it('falls back on the project’s defaults, then on Claude Code’s', () => {
    const dir = registry();
    expect(effectiveSettings(dir, 'nid', { effort: null, model: null })).toEqual({ effort: null, model: null });
    expect(effectiveSettings(dir, 'nid', { effort: 'high', model: 'opus' })).toEqual({ effort: 'high', model: 'opus' });
    writeSettings(dir, 'nid', { effort: 'medium' });
    expect(effectiveSettings(dir, 'nid', { effort: 'high', model: 'opus' })).toEqual({ effort: 'medium', model: 'opus' });
  });

  it('gives the arguments of claude and the agent type of the orchestrator', () => {
    expect(settingsArgs({ effort: 'max', model: 'opus' })).toEqual(['--effort', 'max', '--model', 'opus']);
    expect(settingsArgs({ effort: null, model: null })).toEqual([]);
    expect(agentType('xhigh')).toBe('chantier-xhigh');
    expect(agentType(null)).toBe('general-purpose');
    expect(agentType('ultra')).toBe('general-purpose');
  });
});

describe('the proposals', () => {
  it('proposes an effort from the text of a task, never max', () => {
    expect(suggestEffort({ text: '### Typo\n\nCorriger une faute dans le libellé du menu.' }).effort).toBe('low');
    expect(suggestEffort({ text: '### Couleur des pierres\n\nLa couleur des pierres des grottes un peu plus sombre.' }).effort).toBe('low');
    expect(suggestEffort({ text: '### Torches\n\nLes joueurs peuvent poser une torche au sol dans les grottes ; elle éclaire autour d’elle.' })).toEqual({ effort: 'medium', why: 'chantier court et circonscrit' });
    expect(suggestEffort({ text: `### Donjons\n\n${'Des salles reliées, des ennemis, un trésor. '.repeat(30)}` }).effort).toBe('high');
    expect(suggestEffort({ text: `### Protocole\n\nRefonte du protocole réseau entre client et serveur. ${'Messages, versions, compatibilité. '.repeat(20)}` })).toEqual({ effort: 'xhigh', why: 'touche la structure du jeu' });
    const steps = Array.from({ length: 7 }, (_, i) => `#### Étape ${i + 1}\n\nUn peu de texte.`).join('\n\n');
    expect(suggestEffort({ text: `### Grand chantier\n\n${steps}` }).effort).toBe('xhigh');
  });

  it('asks Claude with the tasks, the levels and the models, and reads its JSON back', () => {
    const prompt = proposalPrompt([{ id: 'grotte', text: '### Grotte\n\nUne grotte.' }], { models: ['opus', 'sonnet'] });
    expect(prompt).toContain('### grotte');
    expect(prompt).toContain('Modèles : opus, sonnet');
    expect(prompt).toContain('```json');
    const answer = 'Voici :\n```json\n[{"id":"grotte","effort":"high","model":null,"why":"ordinaire"},{"id":"x","effort":"low"},{"id":"typo","effort":"ultra"},{"id":"nid","effort":"low","model":"haiku","why":"retouche"}]\n```';
    expect(parseProposals(answer, ['grotte', 'typo', 'nid'])).toEqual({
      grotte: { effort: 'high', model: null, why: 'ordinaire' },
      nid: { effort: 'low', model: 'haiku', why: 'retouche' },
    });
    expect(parseProposals('pas de json', ['grotte'])).toEqual({});
  });

  it('runs one claude call without tools and resolves to the proposals', async () => {
    const base = mkdtempSync(join(tmpdir(), 'agents-propose-'));
    folders.push(base);
    const bin = join(base, 'claude');
    // A fake claude: notes its arguments and stdin, answers like --output-format json.
    writeFileSync(bin, `#!/bin/sh\nprintf '%s\\n' "$@" >"$FAKE_DIR/args"\ncat >"$FAKE_DIR/stdin"\nprintf '%s\\n' "$FAKE_ANSWER"\n`);
    chmodSync(bin, 0o755);
    const result = JSON.stringify({ type: 'result', is_error: false, result: '```json\n[{"id":"grotte","effort":"xhigh","model":"opus","why":"architecture"}]\n```' });
    const env = { PATH: process.env.PATH ?? '', AGENTS_CLAUDE_BIN: bin, FAKE_DIR: base, FAKE_ANSWER: result, CLAUDECODE: '1' };
    const proposals = await proposeSettings({ tasks: [{ id: 'grotte', text: '### Grotte' }], root: base, env, model: 'sonnet' });
    expect(proposals).toEqual({ grotte: { effort: 'xhigh', model: 'opus', why: 'architecture' } });
    const args = readFileSync(join(base, 'args'), 'utf8').split('\n');
    expect(args.slice(0, 3)).toEqual(['-p', '--tools', '']);
    expect(args.join(' ')).toContain('--model sonnet');
    expect(readFileSync(join(base, 'stdin'), 'utf8')).toContain('### grotte');

    const failing = { ...env, FAKE_ANSWER: JSON.stringify({ type: 'result', is_error: true, result: 'quota dépassé' }) };
    await expect(proposeSettings({ tasks: [{ id: 'grotte', text: '' }], root: base, env: failing })).rejects.toThrow(/quota dépassé/);
    mkdirSync(join(base, 'empty'));
    expect(await proposeSettings({ tasks: [], root: base, env })).toEqual({});
  });
});
