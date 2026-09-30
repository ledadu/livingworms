import '../../test/env.mjs';
import { describe, expect, it } from 'vitest';
import { parseGoal } from '../goal.mjs';
import { buildPrompt } from '../roadmap.mjs';

describe('parseGoal', () => {
  it('reads the task, its place in the roadmap, the choices and the checks of a Roadmap page prompt', () => {
    const prompt = buildPrompt(
      { name: 'pieces', base: 'backlog', section: 'Backlog', line: 362, text: "### Ajouter d'autres pièces\ntrois styles : sympa, cute\n## corps\nyeux, oreilles", choices: ['Pièces décoratives seulement'] },
      { mainRoot: '/repo', worktrees: '/wt' },
    );
    const goal = parseGoal(prompt);
    expect(goal).toMatchObject({ title: "Ajouter d'autres pièces", where: '« Backlog », ligne 362', base: 'backlog', choices: ['Pièces décoratives seulement'] });
    // A « ## » heading copied from the roadmap stays in the task.
    expect(goal?.text).toBe('trois styles : sympa, cute\n## corps\nyeux, oreilles');
    expect(goal?.checks[0]).toMatch(/captures/);
  });

  it('takes the title after « ## Chantier : » in an orchestrator prompt, and skips an empty choice list', () => {
    const goal = parseGoal("Tu es l'agent `x`.\nWorktree : /wt/x\n\n## Chantier : démarrer un agent depuis le tableau de bord\n\nÀ faire :\n1. une route\n\n## Choix déjà faits par l’utilisateur\n\n- Aucun : tranche.");
    expect(goal).toMatchObject({ title: 'démarrer un agent depuis le tableau de bord', where: null, choices: [] });
    expect(goal?.text).toBe('À faire :\n1. une route');
  });

  it('reads the point or the section of a « Chantier : » line in a free prompt', () => {
    expect(parseGoal("Tu es l'agent `r`.\nChantier : backlog de docs/roadmap.md, « ### Bugs » → **Rais de soleil** : cinq cylindres.")).toMatchObject({ title: 'Rais de soleil', where: 'Backlog › Bugs' });
    expect(parseGoal('Chantier : backlog de docs/roadmap.md, « ### Déplacement », deux points :\n- un')).toMatchObject({ title: 'Déplacement (deux points)', where: 'Backlog' });
  });

  it('takes the first sentence under a generic heading', () => {
    expect(parseGoal("Tu es l'agent `h`.\n\n## Besoin (mots de l'utilisateur)\n« Fais une page centrale. Il y a trop de trucs »")?.title).toBe('« Fais une page centrale');
    expect(parseGoal(`## Contexte\n${'mot '.repeat(60)}`)?.title).toMatch(/…$/);
  });

  it('falls back on the first lines of a free prompt, and on null without one', () => {
    expect(parseGoal("Tu es l'agent `y`.\nCorrige le saut des créatures.\nPuis teste.")).toMatchObject({ title: 'Corrige le saut des créatures', text: 'Corrige le saut des créatures.\nPuis teste.' });
    expect(parseGoal('')).toBeNull();
    expect(parseGoal(undefined)).toBeNull();
  });
});
