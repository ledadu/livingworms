# Orchestration d'une équipe d'agents

Comment une session Claude Code (l'**orchestrateur**) confie un backlog à une équipe d'agents qui travaillent **en parallèle**, chacun isolé, puis intègre leur travail et le raconte aux joueurs. Rodé le 2026-09-28 sur le jeu Allèle : 12 chantiers menés de front, puis fusionnés dans une branche d'intégration. L'outillage d'isolation est décrit dans [Agents en parallèle](agents.md), les entrées et les versions dans [Changements et versions](changes.md).

Pour relancer une équipe : le skill `/agent-team` ([`skills/agent-team/`](../skills/agent-team/SKILL.md), relié dans `.claude/skills/` du projet) reprend ce document pas à pas.

## Rôles

- **Utilisateur** : donne la roadmap et tranche les choix de conception qui lui reviennent. Il suit l'équipe sur le tableau de bord et teste les versions.
- **Orchestrateur**, la session principale :
  - découpe la roadmap en chantiers et prépare les worktrees ;
  - lance les agents et leur transmet les consignes en cours de route ;
  - fusionne leurs branches, règle les conflits et vérifie l'ensemble ;
  - tient le compte rendu à jour.
  - fait **lui-même** tout changement du système d'agents (ce dossier : `agent/`, `release/`, tableau de bord, file, brief), et ce que le projet lui réserve aussi (son administration, par exemple) : ces chantiers ne sont jamais confiés à un sous-agent ni mis en file.
- **Agents** (sous-agents `general-purpose`, en arrière-plan) : un par chantier. Chacun travaille dans son worktree, fait ses choix seul (l'option recommandée) ou soumet les choix structurants à l'utilisateur par le tableau de bord (voir « Questions et retours »), teste, commite et rend un rapport, des captures et une entrée pour les joueurs.

## Déroulé

### 1. Préparer

1. **Branche d'intégration** : `git checkout -b <intégration>` depuis la branche de travail (ici `backlog`). Tout ce que fait l'orchestrateur y est commité, et chaque agent part de ce point.
2. **Découper** le backlog en chantiers **indépendants**, un par agent. Regrouper ce qui touche les mêmes fichiers (dans Allèle : allures et bonds, ou eau et sons de pas), et séparer ce qui peut avancer seul. Au-delà d'environ 12 agents sur 8 cœurs, la charge fait échouer les tests par dépassement de délai.
3. **Choix de conception** : ceux que l'utilisateur a déjà faits vont dans le prompt de l'agent. Les autres, l'agent les tranche lui-même avec l'option recommandée, et liste toutes les autres dans son rapport ; les plus structurants, il peut les poser à l'utilisateur (`ask.mjs`), qui répond sur le tableau de bord si « Décider seul » est désactivé.
4. **Worktrees** : `make agent-new NAME=<chantier> BASE=<intégration>` pour chacun. Chaque agent reçoit sa branche `agent/<chantier>`, ses ports, sa copie de la base et ses `node_modules`.
5. **Consigne commune** : copier [`agent/brief.md`](../agent/brief.md) dans le scratchpad de la session en remplaçant les `{{…}}` ; elle renvoie à la consigne propre au projet (`brief` de sa config).
6. **Tableau de bord** : `make agent-dashboard`, puis ouvrir http://localhost:7800 dans le Chrome Windows. Son accueil est la **carte de l'écosystème** : l'équipe, les versions, les docs et ce que le projet y ajoute (le jeu, sa supervision), avec l'état de chacun et un clic pour y aller.

### 2. Lancer

Un appel `Agent` par chantier, **tous dans le même message** pour qu'ils partent ensemble, en arrière-plan (`run_in_background: true`). Le type d'agent porte l'**effort** : `subagent_type: chantier-<effort>` (`chantier-low` … `chantier-max`, définis dans [`claude-agents/`](../claude-agents/)) quand la tâche en a un, `general-purpose` sinon ; le **modèle**, s'il y en a un, passe par le paramètre `model` de l'outil (`opus`, `sonnet`, `fable`, `haiku`). Préparés à la main, les worktrees les prennent avec `make agent-new NAME=… EFFORT=… MODEL=…`, et l'utilisateur peut les changer sur la carte. Le prompt tient en quelques lignes :

```text
Tu es l'agent `<chantier>`. Lis d'abord la consigne commune : <chemin du brief> et respecte-la strictement.
Worktree : <worktrees>/<chantier> (branche agent/<chantier>).

Chantier : <extrait exact de docs/backlog.md>.
<Choix déjà faits par l'utilisateur.> <Code clé : fichiers et docs à lire.> <Voisins : quels autres agents touchent
quels fichiers, et comment rester additif.> <Ce qui doit être vérifié en jeu.>
```

Noter l'identifiant de chaque agent (il sert à lui écrire). Les agents s'adressent par cet identifiant avec `SendMessage`.

#### Depuis l'interface

L'utilisateur peut aussi préparer les chantiers lui-même : page **Backlog** du tableau de bord (bouton « ⟳ Rafraîchir le backlog », voir [Agents en parallèle](agents.md#roadmap)). Il coche les chantiers nouveaux, ajuste noms, bases et prompts, puis **« Mettre en file »** : chaque worktree est créé et la tâche écrite dans `.git/agents/queue/<nom>.json`, au statut `queued`. Ensuite, deux façons de lancer :

- **▶ Lancer** sur la page (ou **▶ Lancer tout**) : le tableau de bord démarre lui-même le CLI `claude -p` dans le worktree, en mode de permissions `auto`, détaché, et suit son processus (au travail, terminé, en erreur, arrêté ; bouton **■ Arrêter**). Pas besoin d'orchestrateur : voir [Lancer sans orchestrateur](agents.md#lancer-sans-orchestrateur). L'agent n'a alors personne à qui répondre : ses questions passent par `ask.mjs`, sa réponse finale reste dans sa sortie (lien **Sortie**), et l'intégration de sa branche reste à faire (par l'orchestrateur ou à la main).
- **Par l'orchestrateur**, pour les tâches restées en attente :

1. Lancer `make agent-queue-wait` (ou `node agents/agent/queue.mjs wait`) **en tâche de fond** (`run_in_background: true`). La commande attend qu'une tâche soit en file, imprime les tâches `queued` en JSON puis se termine, ce qui réveille l'orchestrateur.
2. `node agents/agent/queue.mjs mark <nom> launched` pour chacune (la page l'affiche « lancée par l'orchestrateur »). Cette commande prend la tâche de façon exclusive : si elle échoue (« lancée depuis le tableau de bord »), l'utilisateur l'a lancée entre-temps avec « ▶ Lancer » : ne pas la lancer une seconde fois.
3. Pour chaque tâche prise : remplacer `{{CO_AUTHORED_BY}}` du `prompt` par la ligne `Co-Authored-By` de la session, écrire le brief commun si besoin, puis un appel `Agent` avec ce prompt, `subagent_type` = son `agentType` et, s'il y en a un, `model` = son `model` (tous dans le même message, comme ci-dessus). `wait` et `list --json` donnent `effort`, `model` et `agentType` tels qu'ils sont au moment de la lecture (la carte a pu les changer). Le worktree existe déjà : pas de `make agent-new`. Relancer ensuite l'attente de l'étape 1.
4. À la fusion : `node agents/agent/queue.mjs mark <nom> done`. `make agent-queue` liste la file ; `make agent-queue MARK="<nom> done"` change un statut.

Une tâche annulée depuis la page disparaît de la file (et son worktree, si l'utilisateur l'a demandé) : une tâche absente de la sortie de `wait` ne se lance pas.

### 3. Suivre

- **Accueil** (http://localhost:7800) : la carte de tout l'écosystème et du cycle d'une nouveauté. D'un coup d'œil : agents au travail, entrées à ranger, version en préparation, questions en attente, dernier commit de `backlog`, et l'état des nœuds du projet (jeu, supervision…) ([agents.md](agents.md#accueil--la-carte-de-lécosystème)).
- **Agents** (`/agents`) :
  - une carte par agent, avec son **objectif** (le chantier lu dans sa consigne, et ses livrables cochés : commits, rapport, entrée joueur, captures, base fusionnée), sa **tâche du moment en grand** et une couleur selon son état : bleu au travail, ambre calme, vert terminé, rouge erreur ou interrompu ;
  - ses 6 dernières étapes, lues dans l'historique d'exécution de l'agent ;
  - ses commits, ses fichiers en cours et ses journaux ;
  - des boutons pour **tester sa version** (démarre son serveur et ouvre son client), l'**arrêter** (tant que la tâche n'est pas terminée) et le **rebaser** sur `main` ou sur `backlog`, un par un ou tous à la suite.
- **Journal** (`/journal`) : tous les commits et les rapports mis en forme, avec leurs images et un bouton de test.
- **Backlog** (`/roadmap`) : les chantiers de `docs/backlog.md` et leur état, ce qui a changé depuis le dernier rafraîchissement, et la file des tâches préparées par l'utilisateur (voir « Depuis l'interface »).
- **Onglets de versions** : « À publier », une vue par version en préparation, « Publiées » et « Branches » (voir [Raconter et publier](#5-raconter-et-publier) et [agents.md](agents.md#tableau-de-bord)).
- **Questions** (`/questions`) : les choix, validations et retours stratégiques des agents (voir plus bas).
- **Consigne en cours de route** : `SendMessage` à chaque agent concerné, puis la même règle ajoutée au brief pour les prochains.
- **Agent interrompu** (erreur d'API, coupure réseau : « interrompu » en rouge sur le tableau de bord) : `SendMessage` à son identifiant (« reprends où tu en étais, vérifie `git status` »). Son historique est conservé.

### 4. Intégrer

À chaque agent terminé, sans attendre les autres (l'utilisateur peut aussi le faire lui-même avec **✓ Accepter** sur la carte, qui fusionne, archive et envoie dans « À publier », ou demander une retouche avec **✎ Nouvel ordre**) :

1. `git merge --no-ff --no-edit agent/<chantier>` dans la branche d'intégration.
2. Régler les conflits. Ceux qu'on a rencontrés :
   - **Ajouts en fin de fichier** (feuilles de style, exports d'un `index.ts`, imports) : garder les deux côtés.
   - **Deux changements d'une même ligne** (une entrée de catalogue modifiée des deux côtés) : combiner les deux changements dans la ligne.
   - **Point d'extension d'un autre chantier** (une option qui s'ajoutait sous la page au lieu d'aller dans le rail des menus) : la ranger au bon endroit.
3. `npm run typecheck` après chaque fusion. La suite de tests complète se lance quand la machine est calme : sous la charge de l'équipe, les tests de version dépassent leur délai.
4. Commiter en ajoutant **des chemins précis** (`git add src changes …`) : l'utilisateur a souvent des modifications en cours (par exemple `docs/backlog.md`) qu'il ne faut pas embarquer.
   Un agent lancé à la main se relie à son chantier par `make backlog-link TASK=<id> NAME=<agent>` : sa ligne d'état suit ensuite toute seule (en cours, fusionné, livré, puis descente dans « Livré »).
5. Le serveur de dev de l'utilisateur tourne sur l'arbre principal : chaque fusion le recharge, et des marqueurs de conflit le cassent jusqu'à leur résolution. Il faut donc régler les conflits vite.

### 5. Raconter et publier

- Chaque chantier laisse `changes/unreleased/<chantier>/` : `entry.md` (l'entrée pour les joueurs), `report.md` (le rapport technique) et `img/`. `make changes-check` valide l'ensemble.
- **Compte rendu** : à partir des rapports, un document qui reprend ce qui a été livré, ce qu'il faut valider, et **tous les choix non retenus**, pour que l'utilisateur puisse changer d'avis.
- **Planifier** : dans le tableau de bord, une tâche rebasée et archivée passe dans **« À publier »**. On l'affecte à une version en préparation (ou à une nouvelle, au numéro proposé par le moteur) ; chaque version a son onglet, où l'on règle son numéro, son titre et son mot d'intro, et où l'on voit l'aperçu du changelog et des « Nouveautés ». L'affectation est écrite dans `changes/planned.json` du dépôt principal, sans commit.
- **Publication** : « Publier la Version X.Y » dans son onglet, ou `make release VERSION=X.Y.Z`, fige **les seules entrées affectées** à cette version dans `changes/vX.Y.Z/`, met à jour les versions, génère `CHANGELOG.md`, commite ces seuls chemins (avec `planned.json`) et pose un tag annoté, sans push. Les autres entrées restent dans `unreleased/`. `make release` sans version planifiée publie tout `unreleased/`. Refus si une fusion est en cours, si l'index contient déjà quelque chose, si la version ou une des entrées publiées est invalide. Le jeu affiche alors les « Nouveautés ».
- **Publication groupée** : dans « À publier », cocher des entrées (ou « Tout sélectionner ») puis « Publier la sélection » ou « Tout publier » : la version est créée ou complétée, son onglet montre l'aperçu et la validation, puis la même publication est proposée. Une entrée invalide ne peut pas être cochée.
- **Branche de version** : publier une version X.Y.0 ouvre `release/X.Y` au tag (case décochable ; `make release NO_BRANCH=1`). Ses correctifs : un agent sur `BASE=release/X.Y` (`make agent-new NAME=fix-x BASE=release/0.2`) avec une entrée `fixed`, puis dans l'onglet **Branches** « Intégrer », « Publier la Version X.Y.Z » (tag sur la branche, dans un worktree temporaire) et « Reporter vers backlog » (cherry-pick `-x`, puis fast-forward de `backlog`). Un **serveur de test** par version (« ▶ Lancer un serveur X.Y ») permet de faire tourner une version publiée à côté de `backlog`. Détails : [changes.md](changes.md#branches-de-version).
- **Ménage** : `make agent-rm NAME=<chantier>` pour chaque worktree fusionné. Les branches restent.

## Questions et retours

Un sous-agent en arrière-plan ne peut pas poser de question interactive. Il passe par le tableau de bord :

- **L'agent** lance `node agents/agent/ask.mjs choice|validation|feedback …` (ou `make agent-ask ARGS='…'`) depuis son worktree ; son nom vient de `.env.agent`. Un **choix** (options, la recommandée en premier) ou une **validation** (oui / non) attend la réponse, jusqu'à 5 min par appel (9 au plus, pour tenir dans l'outil Bash), puis `--resume <id>` reprend l'attente. Un **retour stratégique** (avec sa gravité) n'attend jamais. La réponse s'imprime en lignes `clé: valeur`, avec `next:` qui dit quoi faire.
- **L'interrupteur « Décider seul »** (en-tête du tableau de bord et de `/questions`) est **activé par défaut** : chaque question est enregistrée puis tranchée tout de suite avec l'option recommandée (statut `auto`), comme avant. Désactivé, les agents attendent la réponse ; passé le délai global (30 min par défaut, réglable dans `/questions`, `--timeout <min>` par question), ils prennent l'option recommandée (`auto`, « délai dépassé »). Chaque agent peut avoir son propre réglage (bouton « 🤖 décide seul / 🙋 te demande » de sa carte, ou la liste « Qui décide seul ? »). Activer l'interrupteur pendant qu'un agent attend le libère aussitôt.
- **L'utilisateur** voit un compteur rose dans l'en-tête, « ❓ 1 question en attente » sur la carte de l'agent, le nombre dans le titre de l'onglet (« (2) Agents <projet> ») et, s'il l'autorise (🔔), une notification du navigateur. La page `/questions` montre les questions en attente (contexte, impact, options avec la recommandée mise en avant, réponse libre ou commentaire, « Retirer »), le fil des retours avec « ✓ Lu », et l'historique filtrable par agent, type et statut.
- **Statuts** : `pending` (en attente, ou retour non lu), `answered` (répondu, ou retour lu), `auto` (décidé seul ou délai dépassé), `expired` (délai dépassé de plus de 10 min sans qu'aucun agent n'attende plus), `withdrawn` (retirée par l'agent ou l'utilisateur).
- **Stockage** : un fichier JSON par question dans `.git/agents/questions/`, réglages dans `.git/agents/settings.json` (`autonomous`, `timeoutMinutes`, `agents.<nom>.autonomous`), communs à tous les worktrees. Code : [`agent/questions.mjs`](../agent/questions.mjs) (cœur testé, `agent/test/questions.test.ts`), `ask.mjs`, `questions-routes.mjs` (API `/api/questions`), `questions.html`, `questions-badge.js`. `AGENT_REGISTRY=<dossier jetable>` remplace le registre, pour les tests et pour essayer le tableau de bord.
- **L'orchestrateur** reprend dans son compte rendu les choix tranchés par l'utilisateur et ceux décidés `auto`.

## Pièges rencontrés, et leur parade

| Symptôme | Cause | Parade |
| --- | --- | --- |
| Le Chrome Windows n'atteint pas le client d'un agent | Windows réserve des plages de ports pour Hyper-V (5174–5273…), que le relais localhost de WSL ne transmet pas | Ports des agents : 7801+ et 5301+ (`netsh interface ipv4 show excludedportrange protocol=tcp`) |
| Le jeu d'un agent se fige | Plusieurs agents dans les onglets d'une même fenêtre : l'onglet au second plan est ralenti | Une **fenêtre** par agent (`window.cjs`) ; `make agent-chrome` lance Chrome avec les options qui empêchent de ralentir les fenêtres cachées |
| `make agent-up NAME=x` vise un autre agent | Le shell exporte déjà une variable `NAME` | Le Makefile ne lit `NAME` que sur la ligne de commande |
| Tests en échec, différents d'un passage à l'autre | Charge de 40 à 60 sur 8 cœurs avec 12 agents | Relancer les fichiers seuls ; suite complète quand la machine est calme |
| Le serveur d'un agent met plusieurs minutes à s'ouvrir | Sa préparation (dans Allèle, la génération des mondes) sous la charge | Attente de 240 s (`AGENT_UP_TIMEOUT`) |
| Agent arrêté au milieu de son travail | Coupure réseau ou erreur d'API | Tableau de bord en rouge « interrompu », puis `SendMessage` pour qu'il reprenne |
| Un agent ne peut pas écrire un fichier | Refus de l'outil d'écriture pour ce sous-agent | Il transmet le contenu dans sa réponse ; l'orchestrateur écrit le fichier |
| Un commit de l'orchestrateur embarque le travail de l'utilisateur | `git add docs` trop large | Ajouter des chemins précis ; sinon `git restore --staged` puis `git commit --amend` |
| Le tableau de bord met 12 s à répondre | git et les historiques d'exécution relus à chaque requête sous la charge | État calculé en tâche de fond ; historiques relus seulement depuis la dernière lecture |
