# La Lignée

Une larve naît à la surface. Le courant l'emporte vers le fond. Elle n'arrivera jamais en bas, mais ses enfants, oui.

Un jeu de navigateur, sur téléphone d'abord : tu joues une lignée de créatures marines, génération après génération, de la surface au fond de la fosse, puis la remontée. Les créatures sont faites de fouets (chaînes de Verlet) en 2.5D. Tout est dans [docs/](docs/README.md) : la [vision](docs/vision.md), les [chapitres](docs/chapitres.md), les [mécaniques](docs/mecaniques.md), la [feuille de route](docs/roadmap.md) et le [backlog](docs/backlog.md).

## Lancer

```bash
npm install
make dev      # le jeu avec rechargement à chaud, http://localhost:5180
make check    # typecheck et tests
make play     # la page jouable en un seul fichier : play/lignee-monde.html
make help     # toutes les commandes, dont celles des agents
```

## Le code

- `src/engine/` : les définitions d'espèces et le dessin d'une partie.
- `src/engine3/` : le moteur de fouets 3D (simulation, locomotions, eau, perspective, rendu canvas et WebGL2, portraits).
- `src/content/` : le bestiaire (parties, 43 espèces, catalogue, générateur, fusion).
- `src/editor/` : l'Atelier, l'éditeur d'espèces.
- `src/monde/` : le jeu (boucle, biomes, décors, plantes, lumière, banc de performance `?bench`).

Détails dans la [consigne des agents](docs/agents.md#architecture).

## Les agents

Le dossier `agents/` est le cadriciel [game-agents](https://github.com/ledadu/game-agents), monté en git subtree : une équipe d'agents Claude Code avance en parallèle sur le backlog, chacun dans son worktree, avec un tableau de bord.

```bash
make agent-dashboard          # le tableau de bord, http://localhost:8200
make agent-new NAME=x         # un agent à la main : worktree ../livingworms.worktrees/x, branche agent/x
```

Dans Claude Code : `/agent-team`. Mettre à jour le cadriciel : `git subtree pull --prefix=agents https://github.com/ledadu/game-agents.git main --squash`.

Les premiers prototypes (les démos whip.js, Hydra, le jeu 2D, les pages 2.5D et Three.js) sont dans l'historique git.
