---
name: agent-team
description: Lance une équipe fraîche d'agents en parallèle sur le backlog du jeu (un worktree, une branche, des ports et des données par agent), suit leur travail sur le tableau de bord, intègre leurs branches et publie les nouveautés. À utiliser quand l'utilisateur veut confier une roadmap, un backlog ou une liste de chantiers à plusieurs agents.
---

# Équipe d'agents sur un backlog

Suis [agents/docs/orchestration.md](../../docs/orchestration.md) : c'est la référence, ce skill n'en est que la liste de contrôle. Les réglages du jeu (branches, chemins, consigne propre) sont dans `agents.config.mjs` à la racine ; `node agents/config.mjs` les affiche. Réponds en français.

1. **Lire** le backlog (`paths.backlog`, `docs/backlog.md` par défaut ; la roadmap ne donne que le cap) ou la partie que l'utilisateur désigne. Relever les choix déjà faits (dates « choix du … »).
2. **Découper** en chantiers indépendants (≈ 12 au plus sur 8 cœurs), en regroupant ce qui touche les mêmes fichiers. Présenter le découpage à l'utilisateur en une table (agent, chantier, fichiers exposés) ; les choix de conception ouverts sont tranchés par les agents avec l'option recommandée, sauf si l'utilisateur veut choisir (alors : propositions, puis AskUserQuestion).
3. **Préparer** : `git checkout -b <intégration>` ; `make agent-new NAME=<chantier> BASE=<intégration>` pour chacun ; copier `agents/agent/brief.md` dans le scratchpad en remplaçant les `{{…}}` ; `make agent-dashboard` en arrière-plan et l'ouvrir dans le Chrome Windows (`make agent-chrome`, puis chrome.exe … http://localhost:7800).
4. **Lancer** tous les agents dans un même message (`Agent`, `general-purpose`, `run_in_background: true`), prompt court : nom, brief commun, consigne du projet (`brief` de la config), worktree, extrait exact du chantier, choix déjà faits, code clé, voisins. Noter l'identifiant de chaque agent, et relier chaque chantier à son agent : `make backlog-link TASK=<id> NAME=<agent>`. Si l'utilisateur a mis des tâches en file depuis la page Backlog du tableau de bord : `make agent-queue-wait` en tâche de fond, puis lancer les prompts reçus (`{{CO_AUTHORED_BY}}` remplacé) et `node agents/agent/queue.mjs mark <nom> launched` (voir « Depuis l'interface » dans orchestration.md).
5. **Suivre** : une nouvelle consigne → `SendMessage` à chaque agent concerné + ajout au brief ; un agent « interrompu » → `SendMessage` pour qu'il reprenne.
6. **Intégrer** chaque agent dès qu'il a fini : `git merge --no-ff --no-edit agent/<chantier>`, conflits réglés vite (le serveur de dev de l'utilisateur tourne sur l'arbre), typecheck, commit avec des chemins précis (jamais les fichiers en cours de l'utilisateur).
7. **Clore** : `make changes-check`, suite de tests complète quand la machine est calme, compte rendu (livré, à valider, toutes les options non retenues), `make release` si l'utilisateur le veut, `make agent-clean` (ou `make agent-rm NAME=…`) pour les worktrees fusionnés.

Le système d'agents lui-même (`agents/`, `agents.config.mjs`) ne se confie jamais à un agent : l'orchestrateur le modifie seul.
