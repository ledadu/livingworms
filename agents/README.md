# game-agents

Une équipe d'agents Claude Code qui avancent **en parallèle** sur le backlog d'un jeu, chacun isolé dans son worktree git. Le dossier fournit aussi le tableau de bord pour les suivre, et le circuit qui transforme leur travail en versions publiées. Né dans le jeu [Allèle](https://github.com/ledadu/allele), où il a mené jusqu'à 12 chantiers de front, il se branche sur n'importe quel jeu web (un serveur et un client de dev, Node, git).

- **Worktrees isolés** : une branche, une paire de ports, une copie des données de dev et des journaux par agent ([`agent/agent.sh`](agent/agent.sh), `make agent-*`).
- **Effort et modèle par agent** : choisis à la mise en file, proposés d'après le texte du chantier ou par Claude, modifiables sur la carte, appliqués à chaque lancement ([docs/agents.md](docs/agents.md#effort-et-modèle-dun-agent)).
- **Tableau de bord** (http://localhost:7800) :
  - la carte de l'écosystème et les cartes des agents en direct ;
  - le journal des commits et des rapports ;
  - le backlog éditable, discuté avec Claude, mis en file puis lancé sans orchestrateur ;
  - les questions des agents à l'utilisateur ;
  - les versions à publier et les branches de version.
- **À distance** : le tableau de bord demande un jeton à tout accès qui ne vient pas de la machine ; avec Tailscale, il s'ouvre depuis un téléphone sans rien exposer sur Internet ([docs/agents.md](docs/agents.md#depuis-une-autre-machine)).
- **Miroir sur claude.ai** : une page Artifact privée, en lecture seule, qui montre le dernier état envoyé depuis la machine, pour quand celle-ci n'est pas joignable ([docs/agents.md](docs/agents.md#miroir-sur-claudeai)).
- **Orchestration** : le mode d'emploi d'une session Claude Code qui découpe, lance, suit, intègre et publie ([docs/orchestration.md](docs/orchestration.md)), repris par le skill [`/agent-team`](skills/agent-team/SKILL.md).
- **Changements et versions** : une entrée par tâche livrée, un changelog, des versions planifiées, publiées avec un tag, et leurs branches de correctifs ([docs/changes.md](docs/changes.md)). Le jeu en tire son « Quoi de neuf » (`whatsNew()`).

Aucune dépendance à l'exécution : Node 22 ou plus (`node:sqlite` pour copier les bases), git, bash, et le CLI `claude` pour les lancements depuis le tableau de bord. Les captures d'écran visent le Chrome Windows depuis WSL (CDP sur 9222, `playwright-core`) ; le reste marche partout. L'interface et les docs sont en français.

## Brancher un jeu

Le dossier se monte à la racine du jeu, sous le nom `agents/`, en **git subtree** : ses fichiers font partie du dépôt du jeu, les worktrees des agents les ont donc sans rien de plus, et les changements se renvoient ici.

```bash
git subtree add --prefix=agents https://github.com/ledadu/game-agents.git main --squash
cp agents/agents.config.example.mjs agents.config.mjs     # puis l'adapter au jeu
```

1. **`agents.config.mjs`** à la racine : nom, branches, chemins, commandes du serveur et du client d'un agent, données à copier, vérifications, consigne propre au jeu, vocabulaire des versions, nœuds du jeu sur la carte. Les valeurs par défaut et leur rôle sont dans [`config.mjs`](config.mjs), un exemple commenté dans [`agents.config.example.mjs`](agents.config.example.mjs). `node agents/config.mjs` affiche le résultat.
2. **Les commandes du jeu** lisent leurs ports : le serveur `PORT` (ou `SERVER_PORT`), le client `CLIENT_PORT`, et le client parle au serveur sur `SERVER_PORT`. Un port pris doit être une erreur, pas un repli sur le suivant.
3. **`Makefile`** : `include agents/agents.mk`, avec une cible `help` qui liste `$(MAKEFILE_LIST)` (voir l'en-tête d'[`agents.mk`](agents.mk)).
4. **`.gitignore`** : `.agent/` et `.env.agent` (fichiers d'un worktree d'agent), et les données de dev copiées (`seed`).
5. **Tests** : la config vitest du jeu inclut `agents/**/test/**/*.test.ts`. Ces tests lisent leur propre config ([`test/fixture.config.mjs`](test/fixture.config.mjs)), pas celle du jeu.
6. **Skill et agents** : `ln -s ../../agents/skills/agent-team .claude/skills/agent-team`, et les agents de l'orchestrateur : `mkdir -p .claude/agents && for f in agents/claude-agents/*.md; do ln -s ../../$f .claude/agents/; done`.
7. **Consigne du jeu** : le fichier `brief` de la config. On y met l'architecture, les fichiers partagés sensibles, les comptes de test, les outils de dev, et les ports du serveur de dev de l'utilisateur, à ne pas toucher.
8. **Backlog** : `docs/backlog.md`, un chantier par titre `###` groupé sous des `##` ([docs/agents.md](docs/agents.md#backlog)).

Puis `make agent-dashboard`, et `/agent-team` dans Claude Code.

## Faire évoluer le cadriciel

On le modifie depuis le jeu qui l'utilise, par des commits qui ne touchent que `agents/`. On le renvoie ensuite ici, puis on le reprend dans les autres jeux :

```bash
git subtree push --prefix=agents https://github.com/ledadu/game-agents.git main
git subtree pull --prefix=agents https://github.com/ledadu/game-agents.git main --squash
```

Seul, le dossier se teste avec `npm install && npm test`. Tout ce qui dépend d'un jeu passe par `config.mjs` : aucun fichier de code du cadriciel ne nomme un jeu, un chemin de jeu ou une commande de jeu (les docs citent Allèle en exemple).

## Contenu

| Chemin | Rôle |
| --- | --- |
| [`config.mjs`](config.mjs) | Réglages du jeu fusionnés sur les valeurs par défaut ; mots des pages ; variables d'`agent.sh` |
| [`agents.mk`](agents.mk) | Les commandes `make` |
| [`agent/`](agent/) | `agent.sh` (worktrees), le tableau de bord (`dashboard.mjs` et ses pages), le backlog, la file, les lancements (`launch.mjs`), les questions (`ask.mjs`), la consigne commune (`brief.md`) |
| [`release/`](release/) | Moteur des changements (`changes.mjs`), publication (`publish.mjs`), branches de version (`branches.mjs`) |
| [`docs/`](docs/) | [Orchestration](docs/orchestration.md), [agents en parallèle](docs/agents.md), [changements et versions](docs/changes.md) |
| [`skills/agent-team/`](skills/agent-team/SKILL.md) | Le skill Claude Code de l'orchestrateur |
| [`claude-agents/`](claude-agents/) | Les agents `chantier-low` … `chantier-max` (un par effort) que l'orchestrateur lance |
| [`test/`](test/) | Config de test et tests de `config.mjs` (ceux des modules sont dans `agent/test/` et `release/test/`) |
