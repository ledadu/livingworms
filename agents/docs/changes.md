# Changements et versions

Chaque tâche livrée laisse dans `changes/` du projet une **entrée** : ce qu'on raconte aux joueurs (les nouveautés), le rapport technique complet et ses images. Le moteur ([`release/changes.mjs`](../release/changes.mjs), sans dépendance) en tire le `CHANGELOG.md`, les onglets de versions du tableau de bord des agents et, par `whatsNew()`, les données d'un panneau « Quoi de neuf » dans le jeu.

Les mots viennent de `release` dans `agents.config.mjs` : une publication est une « version » par défaut (Allèle dit « génération »), les trois types d'entrées s'appellent Nouveautés, Améliorations et Corrections (Mutations, Adaptations et ADN réparé dans Allèle), et le titre du changelog est « Nouveautés ». Le dossier (`paths.changes`), le changelog (`paths.changelog`) et les `package.json` mis à jour à la publication (`paths.packages`) s'y règlent aussi.

```
changes/
  planned.json                 les versions en préparation : quelles entrées de unreleased/ chacune publiera
  unreleased/                  les entrées pas encore publiées
    <tâche>/
      entry.md                 l’entrée pour les joueurs (en-tête + texte)
      report.md                le rapport technique : livré, choix retenus, options non retenues, limites
      img/*.jpg                captures (JPEG, ou SVG pour un graphique)
  v0.2.0/                      une version publiée, figée
    release.md                 titre, date et mot d'intro de la version
    <tâche>/…
```

## `entry.md`

```markdown
---
type: new                      # new (nouveauté) | improved (amélioration) | fixed (correction)
title: Des rais de soleil qui tiennent en place
pitch: Les rayons percent enfin la canopée de la Forêt profonde, et ils ne suivent plus ta caméra !
audience: players              # players | admins | developers
images:
  - img/apres-near.jpg         # la première est l'image à la une
  - img/apres-far.jpg
---
Deux à six phrases pour les joueurs : ce qui change pour eux, comment en profiter (touche, menu, endroit du monde).
```

Le moteur refuse une entrée sans `type`, `title`, `pitch` ou texte, ou dont une image manque (`make changes-check`, aussi vérifié par les tests). `make changes-new NAME=…` la commence.

## Le ton

Chaque projet décrit le sien dans son `changes/README.md` (le modèle d'entrée y renvoie). Par défaut :

- **Enthousiaste et sympa**, mais sincère : on se réjouit de ce qui est vraiment mieux, sans promettre ce qui n'existe pas.
- **Tutoiement**, phrases courtes, le joueur au centre (« tu peux maintenant… »).
- **Concret** : ce que ça change en jeu, où le voir, quelle touche. Pas de jargon technique (shader, worktree, SQLite…) dans l'entrée : il va dans `report.md`.
- **Une accroche qui donne envie**, un emoji au plus, placé au début ou à la fin.
- Une **correction** se raconte aussi avec le sourire : ce qui gênait, et que c'est réglé.
- Les entrées `admins` et `developers` restent dans le changelog, mais n'ont pas leur place dans un panneau pour les joueurs.

## Versions

SemVer 0.x : `0.MINEUR.CORRECTIF`. Une version qui contient au moins une nouveauté ou amélioration monte le mineur (0.2.0 → 0.3.0), une version de corrections seules le correctif (0.3.0 → 0.3.1). Le moteur propose le numéro suivant.

```bash
make changes-new NAME=ma-tache   # crée changes/unreleased/ma-tache/ avec un entry.md à remplir
make changes-check               # vérifie les entrées
make whats-new                   # régénère CHANGELOG.md
make release                     # fige tout unreleased/ dans la version proposée (TITLE=…, INTRO=…), met à jour les package.json, commit et tag
                                 # (commit « release: <mot> X.Y.Z », par exemple « release: version 0.4.0 »)
make release VERSION=0.4.0       # publie la version 0.4.0 : ses seules entrées si elle est planifiée, sinon tout unreleased/
                                 # une X.Y.0 ouvre la branche release/X.Y (NO_BRANCH=1 pour ne pas le faire)
make release-branches            # les branches de version release/X.Y et leurs correctifs à reporter
make release-patch LINE=0.2      # publie les correctifs de release/0.2 (0.2.1…) depuis cette branche
node agents/release/changes.mjs plan                  # les versions en préparation et les entrées sans version
node agents/release/changes.mjs assign nid 0.4.0      # affecte une entrée (- pour la retirer)
```

`make release` ([`release/publish.mjs`](../release/publish.mjs)) ne commite que les chemins de la publication : le reste de l'arbre de travail peut avoir des modifications en cours. Il refuse pendant une fusion, un rebase ou un cherry-pick, si l'index contient déjà quelque chose, si le tag existe, ou si une entrée publiée est invalide. Pas de push.

## Versions en préparation : `planned.json`

Une tâche terminée n'est pas forcément publiée dans la version suivante : on **affecte** chaque entrée à une version en préparation, depuis le tableau de bord des agents (onglets « À publier » et « Version X.Y », voir [agents.md](agents.md#tableau-de-bord)) ou avec `changes.mjs assign`.

```json
{
  "versions": [
    { "version": "0.3.0", "title": "La forêt s'éveille", "intro": "Des nids et du soleil !", "entries": ["nid", "rais-soleil"] }
  ]
}
```

- Dans « À publier », on peut aussi **cocher** des entrées (ou « Tout sélectionner ») puis « Affecter la sélection », « Publier la sélection » ou « Tout publier » dans une version en préparation ou une nouvelle (numéro proposé par le moteur, `assignEntries`) : l'onglet de la version montre l'aperçu et la validation, puis la même publication que son bouton est proposée. Une entrée invalide ne peut pas être cochée.
- Les entrées restent dans `unreleased/` jusqu'à la publication de leur version ; une entrée absente du fichier attend d'être affectée.
- Le numéro d'une version planifiée doit venir après la dernière publiée et ne pas l'être déjà ; `make changes-check` signale aussi une entrée affectée qui n'existe plus ou qui l'est deux fois.
- Publier une version (`make release VERSION=…` ou le bouton du tableau de bord) ne fige que **ses** entrées ; seules elles doivent être valides. Le commit ne prend que leurs chemins, `planned.json` (sans la version publiée), `CHANGELOG.md` et les `package.json`, puis un tag annoté `vX.Y.Z` est posé, sans push. Les écritures du tableau de bord dans `planned.json` ne sont commitées qu'à ce moment-là.

## Branches de version

Une version **X.Y.0** publiée ouvre sa branche **`release/X.Y`**, posée sur le tag `vX.Y.0` (bouton « Publier » du tableau de bord, case « créer la branche de version » ; `make release` aussi, sauf `NO_BRANCH=1`). Les correctifs de cette version s'y font et s'y publient (X.Y.1, X.Y.2…), puis sont **reportés** sur `backlog`. Chaque branche peut avoir ses **serveurs de test**. Le moteur est [`release/branches.mjs`](../release/branches.mjs) (testé dans `release/test/branches.test.ts`) ; l'onglet **« Branches »** du tableau de bord le montre (voir [agents.md](agents.md#branches-de-version)).

1. **Correctif** : `make agent-new NAME=fix-x BASE=release/0.2`, le correctif et son entrée `fixed` (`make changes-new NAME=fix-x`, `type: fixed`), commit sur `agent/fix-x`.
2. **Intégrer** la branche dans `release/0.2` : bouton « Intégrer » ou `node agents/release/branches.mjs integrate 0.2 agent/fix-x` (fast-forward ou commit de fusion). Refusé si la branche part de `backlog` : elle apporterait des nouveautés de la version suivante.
3. **Publier** : « Publier la Version 0.2.1 » ou `make release-patch LINE=0.2`. Seules les entrées ajoutées dans `changes/unreleased/` depuis `v0.2.0` sont publiées, et toutes doivent être `fixed`. Le commit et le tag `v0.2.1` sont posés **sur la branche**, dans un worktree temporaire.
4. **Reporter** vers `backlog` : « Reporter vers backlog » ou `branches.mjs report 0.2 [sha…]`. Chaque commit est cherry-pické avec `-x` dans un worktree temporaire. Le commit de publication, lui, apporte `changes/v0.2.1/`, retire ses entrées de `changes/unreleased/` et de `planned.json` et régénère `CHANGELOG.md` (les `package.json` gardent la version de `backlog`). Un conflit annule tout et donne la liste des fichiers. Ensuite `backlog` avance en fast-forward : par sa référence si aucun worktree ne l'a, sinon par `git merge --ff-only` dans le worktree qui l'a (le dépôt principal), que git refuse si un fichier du correctif y est en cours de modification. Dans ce cas, ou avec `--no-advance`, le résultat attend sur une branche `report/0.2-<date>`.

- **État** : `make release-branches` (ou l'onglet) donne pour chaque `release/*` son tag, ses commits d'avance et de retard sur `backlog` et `main`, les correctifs absents de `backlog` (`git cherry`, plus les commits déjà cherry-pickés avec `-x` et les versions déjà reportées) et le dernier commit. Une branche est **divergée** si elle ne contient plus son tag `vX.Y.0`.
- **Rebaser** : `branches.mjs rebase 0.2 [base]` rejoue la branche sur son dernier tag (par défaut) ou sur une base choisie, dans un worktree temporaire. En cas de conflit, le rebase est annulé et les fichiers sont listés. Si des correctifs déjà publiés seraient réécrits (leurs tags resteraient sur les anciens commits), il faut forcer (`--force`, ou confirmer dans l'onglet).
- **Supprimer** : `branches.mjs delete 0.2`. Refusé tant qu'un worktree l'a extraite ; les tags restent, et le message donne la commande pour la recréer.
- **Jamais** de push depuis ces commandes, jamais de réécriture de `main` ni de `backlog` (ils ne font qu'avancer), jamais rien dans l'arbre de travail du dépôt principal hors de ce fast-forward.
- **Pousser sur GitHub** : le bouton **⇪ Pousser sur GitHub** de la page Agents (ou `node agents/release/push.mjs [--dry]`, [`push.mjs`](../release/push.mjs)) montre d'abord le plan, puis envoie au dépôt distant (`origin`) `backlog`, `main` placé à la dernière version publiée (son tag), les branches `release/*` et les tags `vX.Y.Z`. Jamais forcé : une référence dont la copie distante n'est pas dans l'historique local est laissée, et le plan le dit.

## Dans le jeu

Le moteur ne dessine rien : le jeu montre ses nouveautés comme il l'entend, à partir de `whatsNew(loadChanges(), { base, includeUnreleased })`, un JSON sans dépendance (titre, libellés et badges des types, et pour chaque version publiée, et au besoin celle en préparation, ses entrées valides avec leurs images réécrites sous `base`). Les types TypeScript sont dans [`release/changes.d.mts`](../release/changes.d.mts).

Par exemple, Allèle a un plugin Vite qui sert `/whats-new/whats-new.json` et les images de `changes/` en dev, avec la version en préparation pour se relire. Au `vite build`, il écrit dans `dist/whats-new/` le JSON des seules versions publiées et leurs images. Un panneau du jeu et une page publique le lisent.
