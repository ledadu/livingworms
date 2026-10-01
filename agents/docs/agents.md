# Agents en parallèle

L'outillage ci-dessous sert l'[orchestration d'une équipe d'agents](orchestration.md) (le déroulé complet, du découpage de la roadmap à la publication).

Plusieurs agents (ou développeurs) travaillent en même temps sans se gêner : chacun a son **worktree git** sur sa **branche**, ses **ports**, ses **copies des données de dev** et ses **journaux**. Tout passe par [`agent/agent.sh`](../agent/agent.sh), repris par [`agents.mk`](../agents.mk), inclus dans le `Makefile` du projet (`make help`). Ce que le système doit savoir du jeu (commandes, ports, données, chemins, vocabulaire) vient de son `agents.config.mjs` (voir le [README](../README.md)).

Les noms ci-dessous sont ceux par défaut : branche principale `main`, branche d'intégration `backlog` (où l'on fusionne le travail des agents avant une publication), backlog `docs/backlog.md`, dossier `changes/`, et le mot « version » pour une publication (« génération » dans un jeu qui le veut). Chacun se change dans `agents.config.mjs`.

## Cycle de vie

```bash
make agent-new NAME=rais-soleil          # ../<projet>.worktrees/rais-soleil, branche agent/rais-soleil, depuis HEAD (BASE=... sinon)
cd ../<projet>.worktrees/rais-soleil
make up                                  # serveur et client en arrière-plan, attend qu'ils répondent
make url                                 # http://localhost:53xx
make check                               # typecheck puis tests, dans ce worktree
make logs / make agent-logs-client       # journaux du serveur / de Vite (.agent/*.log)
make shot                                # capture dans le Chrome Windows (.agent/shot.png)
make down
make agent-list                          # depuis n'importe quel checkout : tous les agents, ports, état, commits
make agent-rm NAME=rais-soleil           # supprime le worktree et libère les ports ; la branche reste
```

Dans un worktree d'agent, `NAME` se déduit de son `.env.agent`. Depuis le dépôt principal, on le passe : `make agent-up NAME=x`.

## Isolation

- **Branche** : `agent/<nom>` (`branches.agent`), créée depuis `BASE` (HEAD par défaut). Le registre des agents vit dans `.git/agents/`, commun à tous les worktrees.
- **Ports** : l'emplacement `n` (1 à 99, le premier libre) donne le serveur `services.server.portBase + n` et le client `services.client.portBase + n` (7800 et 5300 par défaut). Ces plages évitent celles que Windows réserve pour Hyper-V (`netsh interface ipv4 show excludedportrange protocol=tcp`), que le relais localhost de WSL ne transmet pas au Chrome Windows.
- **Contrat des commandes** : `services.server.command` et `services.client.command` sont lancées dans le worktree avec `PORT` et `SERVER_PORT` (le port du serveur) et `CLIENT_PORT` ; elles doivent écouter sur ces ports (un port pris doit être une erreur, pas un repli sur le suivant). `agent.sh up` attend que les deux ports répondent.
- **Données** : les chemins de `seed` copiés du dépôt principal à la création : `seed.sqlite`, des bases SQLite copiées de façon cohérente (`VACUUM INTO`, même serveur lancé), et `seed.copy`, des fichiers ou dossiers copiés tels quels. Ils doivent être ignorés par git.
- **Dépendances** : les `node_modules` du dépôt principal copiés en liens physiques (instantané, sans disque) ; les liens des workspaces npm sont relatifs et pointent dans le worktree. Après un `npm install` dans le dépôt principal, recréer l'agent ou lancer `npm install` dans son worktree.
- **Vérifications** : `make check` lance `check.typecheck` puis `check.test` dans le worktree ; `make agent-test FILTER=…` la seconde avec le filtre.
- **Processus** : chaque serveur et client tourne dans sa propre session ; `make down` arrête tout le groupe.

## Navigateur

`make shot` ouvre un onglet dans le Chrome Windows (GPU réel), piloté par CDP sur le port 9222 avec le `node.exe` de Windows, le capture puis le ferme : plusieurs agents partagent le même navigateur. `make agent-chrome` le lance s'il ne l'est pas. Les erreurs de la page sont affichées après la capture.

## Tableau de bord

`make agent-dashboard` (http://localhost:7800, [`agent/dashboard.mjs`](../agent/dashboard.mjs)) sert l'accueil de tout l'écosystème, suit les agents du registre `.git/agents/` et porte le workflow de publication des versions. Toutes ses pages partagent la même barre : **Accueil · Agents · Journal · Versions · Roadmap · Questions**.

### Depuis une autre machine

Le tableau de bord lance des agents, fusionne, publie et retire des worktrees : toute requête qui ne vient pas de la machine elle-même doit porter son **jeton** ([`access.mjs`](../agent/access.mjs), testé). Une requête est locale quand elle vient de l'adresse de bouclage, vise `localhost` et n'est passée par aucun mandataire. Un relais comme `tailscale serve` se connecte lui aussi depuis le bouclage (Tailscale sous WSL ou sous Windows), mais il ajoute ses en-têtes et garde le nom public : il est traité comme distant.

- **Le jeton** : `make agent-dashboard-token` (fichier `.git/agents/dashboard-token`, créé au premier démarrage, lisible par toi seul ; `AGENTS_DASHBOARD_TOKEN` le remplace). On ouvre une fois l'adresse avec `?token=<jeton>` : un cookie (`HttpOnly`, `SameSite=Lax`, 90 jours) le garde et l'adresse se nettoie. L'API accepte aussi `Authorization: Bearer <jeton>`. Sans jeton : 401. Pour le changer, supprimer le fichier et relancer le tableau de bord.
- **Avec Tailscale** (un réseau privé entre tes appareils, rien de public) :
  1. Installer Tailscale sur la machine et sur le téléphone, avec le même compte. Sous WSL, il s'installe **dans le WSL** (droits `sudo` du WSL, aucun droit admin Windows) : `curl -fsSL https://tailscale.com/install.sh | sh`, puis `sudo tailscale up --accept-dns=false` (sans ce drapeau, Tailscale réécrit `/etc/resolv.conf` du WSL). Le WSL apparaît alors comme une machine à part du réseau.
  2. Sur la machine : `sudo tailscale serve --bg <port du tableau de bord>`. La première fois, Tailscale demande d'activer HTTPS pour le réseau (dans sa console web).
  3. Sur le téléphone : ouvrir une fois `https://<machine>.<réseau>.ts.net/?token=<jeton>`.

  `tailscale serve status` montre ce qui est servi, `sudo tailscale serve --https=443 off` l'arrête.
- **Limites** : les liens vers les serveurs de dev (le jeu d'un agent, « Tester cette version ») pointent vers `localhost` et ne s'ouvrent pas à distance. La machine doit rester allumée, sans veille ; sous WSL, le WSL aussi : Windows l'arrête quand plus aucun terminal ni VS Code n'y est ouvert.

### Accueil : la carte de l'écosystème

La page `/` ([`hub.html`](../agent/hub.html), agrégation dans [`hub.mjs`](../agent/hub.mjs)) dessine en SVG, sans dépendance, tout ce qui entoure le jeu. Le cadriciel pose trois zones, **Documentation**, **Équipe d'agents** et **Versions et publication**, et des flux numérotés qui racontent le cycle d'une nouveauté : backlog → tâches → agents → branches → intégration → version → publiées. Le projet complète la carte par `hub` dans son `agents.config.mjs` : ses zones (la rangée du bas, `y ≥ 406`, est libre), ses nœuds (le jeu, son serveur, sa supervision…), ses flux (qui prolongent le cycle, par exemple jusqu'aux joueurs puis de la télémétrie vers le backlog), ses lectures en direct et, s'il le veut, une double hélice (`hub.helix`).

- **Chaque nœud** porte son état en direct : agents au travail, terminés et archivés, entrées à ranger et version en préparation (moteur [`changes.mjs`](../release/changes.mjs)), questions en attente et retours à lire (`/api/questions`), changements du backlog à confier (`/api/roadmap`), dernier commit de la branche d'intégration. Un nœud du projet avec une `probe` (une URL) est « en ligne » quand elle répond (texte `down` sinon) ; `hub.states({ probes, states, now })` affine ces états (par exemple le nombre de joueurs lu sur `/metrics`, avec `body: true` sur le nœud pour garder la réponse), `hub.figures({ probes })` ajoute des chiffres au bandeau. Un badge chiffré signale ce qui attend.
- **Survol** : le rôle du nœud et son état détaillé ; **clic** : sa page (celles du projet dans un nouvel onglet ; `/agents`, `/journal`, `/versions?tab=pending|released`, `/roadmap`, `/questions` sur place). Une page du tableau de bord qui n'existe pas encore renvoie à son document (la roadmap) ou s'affiche « bientôt » (les questions).
- **Documents** : `/doc/<chemin>` montre un fichier du dépôt principal, le Markdown mis en forme par le même rendu que le journal ([`doc.html`](../agent/doc.html) et `markdown.js`), les liens relatifs suivis ; `?raw=1` donne la source. Les dossiers cachés, `data`, `secrets`, `dist` et `node_modules` sont refusés.
- **`/api/hub`** : la carte (une fois ; `?state=1` pour l'état seul) et l'état de chaque nœud. Les sondes ont un délai court (0,7 s) et l'état est gardé 4 s : une requête reçoit tout de suite la dernière valeur pendant que la suivante se calcule. La page le relit toutes les 5 s sans se recharger.
- **Téléphone** : sous 820 px, la carte devient une liste de cartes par zone. Les animations (flux, hélice) s'arrêtent avec `prefers-reduced-motion`.
- Pour ajouter un nœud au cadriciel : une ligne dans `BASE_NODES` (zone, position, lien, rôle) et son état dans `nodeStates()` ; les tests (`agent/test/hub.test.ts`, sur la config de test `test/fixture.config.mjs`) vérifient que les nœuds restent dans leur zone sans se chevaucher et que le cycle se referme. Un projet ajoute les siens dans sa config, et gagne à les tester de même (`buildMap(config.hub)`).

### Agents et versions

La page des worktrees ([`dashboard.html`](../agent/dashboard.html)), autrefois sur `/`, est sur `/agents` ; `/versions` l'ouvre sur les onglets de versions et `?tab=active|pending|released|v:x.y.z` choisit l'onglet. Ses onglets (le choix est retenu d'une visite à l'autre) :

- **En cours** : une carte par agent non archivé, mise à jour en place toutes les 4 s (**objectif**, tâche du moment en grand, couleur d'état, fil d'avancement, commits, journaux ; tester, arrêter, rebaser). Une tâche terminée qu'on rebase est **archivée** (ligne `AGENT_ARCHIVED=` de `.git/agents/<nom>.env`) et quitte cet onglet.
  - **🧹 Nettoyer les terminés** (en-tête), `make agent-clean` (`DRY=1` pour la liste) et **automatiquement à la publication** d'une version (tableau de bord ou `make release`, `NO_CLEAN=1` pour s'en passer) : [`clean.mjs`](../agent/clean.mjs) retire les agents **finis**, c'est-à-dire archivés (acceptés), arrêtés, sans fichier en cours et dont la branche est fusionnée dans `backlog`. Pour chacun : son worktree (`agent.sh rm` : serveurs arrêtés, ports et base libérés), sa branche (`git branch -d`), ses sorties de claude (`.git/agents/runs/<nom>`) et sa tâche de file, ainsi que les branches `agent/*` orphelines déjà fusionnées. Restent les entrées de `changes/` (historique, « À publier ») et le backlog. Un agent au travail, non accepté ou non fusionné, et les serveurs de test d'une version ne sont jamais touchés.
  - **Commits** d'un agent (carte, compte de l'en-tête, Journal, `agent.sh list`) : ses commits à lui seulement, le long de sa branche sans les fusions (`git log --first-parent --no-merges <AGENT_BASE>..HEAD`) ; le `git merge backlog` que demande la consigne y ferait sinon entrer ceux des autres. Même règle pour « N files changed », calculé sur ces commits.
  - **✓ Accepter** (sur une tâche terminée, avec des commits) : fusionne `agent/<nom>` (`--no-ff`) dans sa branche de base (celle de sa tâche de file ou « partie de … » de sa consigne, `backlog` sinon) **dans le dépôt principal**, qui doit être sur cette branche ; puis archive la tâche, arrête ses serveurs, marque sa tâche de file `done` et synchronise le backlog (🟠 fusionné) ; ce fichier seul est commité aussitôt ([`backlog.mjs`](../agent/backlog.mjs) `commitBacklog`, avant la fusion aussi, pour qu'elle ne bute jamais sur ses lignes d'état) : elle apparaît dans **« À publier »**. Refusé tant que l'agent tourne ou a des fichiers non commités ; un conflit annule la fusion et nomme les fichiers (donner alors l'ordre à l'agent de fusionner sa base).
  - **Erreurs d'acceptation** : chaque refus de « ✓ Accepter » s'ajoute à `.git/agents/<nom>.accept.log` (date, type : `agent`, `conflit` ou `dépôt principal`, message) et au journal du tableau de bord. Un refus du côté de l'agent (fichiers non commités, nommés dans le message ; fusion que git refuse) fait paraître **🛠 Faire corriger par l'agent** : l'agent reçoit la dernière erreur et le chemin du journal ([`launch.mjs`](../agent/launch.mjs) `acceptOrder`), corrige, commite, puis on accepte à nouveau. La fusion en série fait de même, au plus 2 fois par agent. `make agent-clean` efface ce journal avec l'agent.
  - **🔀 Corriger les conflits** (sur un agent qui ne travaille plus, en retard sur sa base, ou dont « Accepter » a buté sur un conflit) : un nouvel ordre ([`launch.mjs`](../agent/launch.mjs) `mergeOrder`) pour que l'agent fusionne sa base dans **sa** branche et règle lui-même les conflits : garder les deux côtés, combiner les lignes touchées des deux côtés, recalculer les compteurs des docs, poser une question par le tableau de bord si un conflit demande un choix, puis `npm run typecheck`, `make check` et commit. Ensuite **✓ Accepter** fusionne sans conflit.
  - **🔀 Fusion en série** (bandeau au-dessus des cartes de « En cours ») : on coche **à fusionner** sur les tâches terminées que « ✓ Accepter » prendrait (ou « Cocher les terminées »), puis **✓ Accepter et corriger en série**. Le tableau de bord les traite une par une, dans l'ordre des cartes ([`merge-train.mjs`](../agent/merge-train.mjs), état dans `.git/agents/merge-train.json`, qui survit à un redémarrage) : il accepte la tâche ; sur un conflit, il donne à l'agent l'ordre de **🔀 Corriger les conflits**, attend qu'il ait fini, puis l'accepte à nouveau avant de passer à la suivante, qui fusionne donc sur une base déjà à jour. Au plus 2 corrections par agent ; un agent qui s'arrête en erreur, reste en conflit ou a des fichiers non commités est marqué en échec et la file continue. Le bandeau montre l'état de chaque tâche (en attente, fusion, règle ses conflits, acceptée, échec, sautée) ; **■ Arrêter la file** saute celles pas encore traitées (un agent en train de corriger finit seul), **✕ Fermer** efface une file terminée. On peut ajouter des tâches à une file en cours.
  - **Effort et modèle** (sous les chiffres de la carte) : deux menus, enregistrés aussitôt, qui valent pour le **prochain** lancement de claude pour cet agent (▶ Lancer, ↻ Relancer, ✎ Nouvel ordre, 🔀 Corriger les conflits), pas pour un processus déjà en cours ; la carte le dit quand l'agent tourne avec d'autres réglages. Voir [Effort et modèle](#effort-et-modèle-dun-agent).
  - **✎ Nouvel ordre** (dès que l'agent ne travaille plus) : un champ dans la carte, jamais redessiné par le rafraîchissement ; l'ordre part à l'agent ([`launch.mjs`](../agent/launch.mjs) `orderTask`) avec le rappel de sa consigne (commits, rapport et entrée mis à jour, `git merge <base>`, `make check`). Un agent lancé depuis le tableau de bord reprend **sa session** (`--resume`) ; un agent lancé par l'orchestrateur reçoit une session à lui dans son worktree, avec son objectif redit. Une tâche acceptée revient alors dans « En cours ».
  - **🎯 Objectif** ([`goal.mjs`](../agent/goal.mjs)) : le chantier de l'agent, lu dans sa consigne. Elle vient de la tâche de la file (page Roadmap) ou, à défaut, du premier message de son historique. On y trouve le titre, la place dans la roadmap (« Backlog », ligne 358, ou Backlog › Bugs) et, dépliable, le texte du chantier, les choix déjà faits et « À vérifier ». Une consigne libre de l'orchestrateur donne son point (« → **…** »), sa section (« ### … ») ou la première phrase sous « Contexte » / « Besoin ». Dessous, les **livrables** que demande la consigne, cochés ou non : commits, `report.md`, `entry.md`, captures dans `img/`, et la branche de retour fusionnée (« à jour avec backlog » ou « N commits de backlog à fusionner » ; `AGENT_BASE` n'est que le commit de départ).
- **À publier** : les entrées de `changes/unreleased/` qui ne sont dans aucune version (celles d'une tâche encore en cours exceptées), avec leur type, titre, accroche, image à la une, validité et rapport ; un menu **« Affecter à… »** les range dans une version en préparation ou une nouvelle (numéro proposé). Une tâche archivée sans entrée le dit, et précise si l'entrée n'existe encore que sur sa branche.
  **Sélection** : une case par entrée valide (une entrée invalide est marquée ✕, non publiable) et « Tout sélectionner » ; puis, dans une version choisie (une nouvelle au numéro proposé, ou une en préparation), **« Affecter la sélection »**, **« Publier la sélection »** ou **« Tout publier »**. Les deux dernières rangent les entrées, ouvrent l'onglet de la version (aperçu, validation) et demandent confirmation avant la même publication que son bouton.
- **Une vue par version en préparation** : ses tâches (déplacer, retirer), son numéro (vérifié), son titre et son mot d'intro, sa validation, l'aperçu des « Nouveautés » et du `CHANGELOG.md`, et **« Publier la Version X.Y »** (avec confirmation) : seules ses entrées sont publiées, par un commit de leurs seuls chemins et un tag annoté, sans push.
- **Publiées** : chaque version de `changes/vX.Y.Z/`, avec sa date, son tag, ses entrées et leurs rapports (`/report/<dossier>/<tâche>`).
- **Branches** : les branches de version `release/X.Y` et leurs serveurs de test (voir plus bas).

Les onglets de versions lisent et écrivent le `changes/` du dépôt d'où tourne le tableau de bord (le principal sur 7800) ; l'affectation vit dans `changes/planned.json` (voir [changes.md](changes.md)) et n'est commitée qu'avec la publication. Pour essayer une modification du tableau de bord sans toucher au dépôt principal : `CHANGES_ROOT=<copie jetable> node agents/agent/dashboard.mjs 7898` depuis son worktree (le registre des agents reste le commun).

### Branches de version

L'onglet **Branches** (`/versions?tab=branches`, [`branches.js`](../agent/branches.js), API [`branches-routes.mjs`](../agent/branches-routes.mjs), moteur [`release/branches.mjs`](../release/branches.mjs)) suit le modèle « une branche `release/X.Y` par version » décrit dans [changes.md](changes.md#branches-de-version) :

- **Une carte par `release/X.Y`** : son tag (et les commits depuis), « divergée » si elle ne contient plus `vX.Y.0`, un tag de la ligne publié hors de la branche, ses commits d'avance et de retard sur `backlog` et `main`, et son dernier commit.
- **Correctifs absents de `backlog`** : cochés par défaut, puis **« Reporter vers backlog »** (cherry-pick `-x` dans un worktree temporaire ; un commit de publication apporte sa version et le changelog), avec ou sans avancer `backlog`.
- **Correction à publier** : les entrées ajoutées depuis `vX.Y.0`, le numéro proposé (X.Y.Z suivant) et **« Publier la Version X.Y.Z »**, qui publie sur la branche dans un worktree temporaire.
- **Intégrer une branche de correctif** (partie de `release/X.Y`), **Rebaser…** (sur son dernier tag ou une base saisie ; conflit : rebase annulé et fichiers listés ; correctifs publiés réécrits : confirmation pour forcer), **Supprimer la branche** (avec confirmation).
- Une version X.Y.0 publiée sans branche propose **« Créer release/X.Y »**.
- **Serveurs de test** : « ▶ Lancer un serveur X.Y » crée avec `agent.sh new` un worktree `v0-2` (branche `serve/v0-2`, ses ports, sa copie de la base) posé sur `release/X.Y`, le démarre (`agent.sh up`) et ouvre son client. « Ouvrir », « Actualiser » (remet le worktree sur la branche quand elle a avancé), « Arrêter » et 🗑 (supprime worktree et branche `serve/…`). « Serveurs sur un tag » fait de même depuis un tag (`v0-2-1`). Ces worktrees sont marqués `AGENT_KIND=release` et `AGENT_REF=<branche ou tag>` dans le registre ([`release-servers.mjs`](../agent/release-servers.mjs)) : ils n'apparaissent ni dans « En cours », ni dans le journal, ni dans les agents comptés par l'accueil, qui les compte à part sur son nœud **Branches de version** (branches, correctifs à reporter, serveurs de test).

Les écritures passent toutes par des worktrees temporaires, jamais par l'arbre de travail du dépôt principal, sauf le fast-forward de `backlog` après un report. Aucun push. Pour essayer sans rien toucher : un clone jetable, puis `CHANGES_ROOT=<clone> AGENTS_AGENT_SH=<clone>/agents/agent/agent.sh AGENTS_REGISTRY=<clone>/.git/agents node agents/agent/dashboard.mjs 7894` depuis son worktree (les serveurs de test demandent alors des `node_modules` dans le clone, en liens physiques).

### Backlog

Les chantiers vivent dans `docs/backlog.md` (`paths.backlog`), la seule source du tableau de bord ; `docs/roadmap.md` ne donne que le cap (vision, étapes livrées, parking) et le système ne la lit plus. Le fichier se modifie à la main comme n'importe quel document ; le système n'y réécrit que les **lignes d'état** ([`backlog.mjs`](../agent/backlog.mjs), pur et testé) :

```markdown
## Nouveaux chantiers

### Nouvelles pièces : corps, habits et accessoires
> 🔵 en cours · agent pieces-corps

Texte libre ; un chantier se découpe en titres #### ou en puces en gras.
```

- **Chantier** : un titre `###`, jusqu'au titre `###` ou `##` suivant ; les `##` sont des groupes. Identifiant : le slug du titre.
- **État** : la ligne `> …` juste sous le titre : ⚪ à faire, 🟣 en file, 🔵 en cours, 🟠 fusionné, 🟢 livré (avec sa version), suivis du ou des agents. Sans ligne, un chantier est à faire. **⏸ en pause** est posé par l'utilisateur et jamais touché.
- **Synchronisation** (`syncBacklog`, à chaque lecture de la page, toutes les 30 s dans le tableau de bord, `make backlog SYNC=1`) : l'état découle des faits pour chaque agent de la ligne (ou de la tâche de file faite pour ce chantier) : en file (file `queued`), en cours (worktree dans le registre, ou lancé), fusionné (dossier `changes/unreleased/<agent>/` dans le dépôt principal, ou agent archivé), livré (dossier `changes/vX.Y.Z/<agent>/`). Un chantier à plusieurs agents prend l'état du moins avancé. Seules les lignes qui changent sont réécrites ; un chantier livré descend en tête de **« ## Livré »**, en bas du fichier.
- **Sous-tâches** : une seconde ligne `> ↳ après « Titre de la tâche mère »`, sous la ligne d'état, fait d'un chantier la sous-tâche d'un autre ([`backlog.mjs`](../agent/backlog.mjs) `setAfter`, `subtasksOf`). Son bloc se range juste après sa mère (et les autres sous-tâches de celle-ci) ; une mère introuvable ou une boucle l'ignore. Une sous-tâche part **avec l'agent de sa mère** : cocher la mère met ses sous-tâches encore à faire dans le même prompt, après elle (« Puis ses sous-tâches, dans l'ordre » : la mère commitée d'abord, puis chacune avec ses commits ; un rapport et une entrée pour le tout), et leur ligne d'état prend le même agent. Seule, une sous-tâche n'est mise en file qu'une fois sa mère fusionnée ou livrée.
- **Relier à la main** un chantier à un agent lancé par l'orchestrateur : `make backlog-link TASK=<id> NAME=<agent>` (`make backlog` liste les identifiants).

### Page Backlog

La page **Backlog** (`/roadmap`, bouton « ⟳ Rafraîchir le backlog » en en-tête du tableau de bord ; [`roadmap-routes.mjs`](../agent/roadmap-routes.mjs), [`roadmap.html`](../agent/roadmap.html)) relit `docs/backlog.md` **du dépôt principal**, synchronise ses états et montre ses chantiers par groupe, avec leur état et leur agent. La consigne générée cite le chantier en entier (sous-titres compris) avec sa ligne dans `docs/backlog.md` ([`roadmap.mjs`](../agent/roadmap.mjs) `buildPrompt`).

- **✎ Modifier** un chantier : son texte Markdown (titre `###` compris) dans une fenêtre ; **Enregistrer** (ou Ctrl+S) réécrit son bloc dans `docs/backlog.md` en gardant sa ligne d'état ([`backlog.mjs`](../agent/backlog.mjs) `writeTask`). Refusé si le chantier a changé entre-temps (fichier modifié ailleurs, empreinte `version`), s'il manque le titre `###`, ou s'il contient un autre titre `##`/`###` (découper avec `####`). **+ chantier** sur un groupe en ajoute un, ⚪ à faire, à la fin du groupe.
- **💬 En discuter avec Claude** ([`task-chat.mjs`](../agent/task-chat.mjs)) : à droite de l'éditeur, une conversation par chantier, gardée dans `.git/agents/chats/<id>.json` et reprise d'un tour à l'autre (même session `claude`). Claude tourne dans le dépôt principal en **lecture seule** (`--tools Read,Grep,Glob`, `--permission-mode dontAsk` : tout le reste refusé) pour vérifier le code dont parle le chantier ; il reçoit le texte du chantier tel qu'il est à chaque tour. Une nouvelle version lui est demandée dans un bloc ```tache : la page la montre **en différences** avec deux boutons, **Appliquer** (écrite dans le backlog, marquée « appliquée ») et **↙ Dans l'éditeur** (à retoucher avant d'enregistrer). Rien n'est écrit sans ce clic. Les modifications non enregistrées de l'éditeur sont enregistrées avant l'envoi d'un message. Routes : `GET|POST /api/backlog/task/<id>`, `POST /api/backlog/new`, `GET|POST /api/backlog/chat/<id>`, `…/apply`, `…/clear`.
- **Rafraîchir** retient l'état de chaque chantier (titre et empreinte du texte) dans `.git/agents/roadmap-snapshot.json` : la page montre les chantiers **ajoutés, modifiés et retirés** depuis le dernier rafraîchissement, puis ceux du dernier rafraîchissement.
- **Sous-tâches sur la page** : glisser une ligne sur un autre chantier en fait sa sous-tâche, la glisser sur le titre de son groupe la détache ; au doigt, le bouton **↳** de la ligne ouvre un menu (« sous-tâche de… », « plus une sous-tâche »). La sous-tâche s'affiche en retrait sous sa mère, qui montre « +N sous-tâches ». Route : `POST /api/backlog/after/<id>` (`{ after: <id> | null }`).
- **Par défaut** (en tête des tâches choisies) : l'effort et le modèle que prend chaque chantier coché, gardés dans le navigateur (`roadmap.defaults`) ; sans eux, l'effort proposé d'après le texte. Les changer met à jour les tâches déjà cochées, sauf celles réglées à la main ou par ✨ Claude.
- **Choisir** : une case par chantier nouveau ; pour chacun un nom d'agent proposé, une base (`backlog`), son **effort** et son **modèle** (voir [Effort et modèle](#effort-et-modèle-dun-agent)) et le **prompt** généré selon le modèle d'[orchestration](orchestration.md#2-lancer), modifiable.
- **Mettre en file** : pour chaque tâche, `agent.sh new <nom> <base>`, l'effort et le modèle écrits dans son fichier du registre, puis `.git/agents/queue/<nom>.json` (`{ name, title, prompt, base, id, effort?, model?, createdAt, status: "queued" }`), et la ligne d'état du chantier devient `> 🟣 en file · agent <nom>` ; l'annuler la remet à ⚪ à faire. La file s'affiche à côté : en attente (annulable, avec ou sans retrait du worktree), lancée, terminée.
- **▶ Lancer** (sur chaque tâche en attente, et **▶ Lancer tout** dès qu'il y en a deux) : démarre l'agent tout de suite, **sans orchestrateur** (voir ci-dessous). La tâche passe `launched` (`launchedBy: "dashboard"`, `sessionId`) et affiche l'état de son processus : **au travail**, **terminé** (code 0), **en erreur (code N)**, **arrêté** ou **processus disparu** (plus de processus ni de code de sortie : machine redémarrée, processus tué à la main). **■ Arrêter** tue le processus et tout son groupe ; **↻ Relancer** (dès que l'agent ne tourne plus : erreur, arrêt, processus disparu, ou même terminé) reprend **la même session** (`claude -p --resume <session>`, sans `--fork-session` : même identifiant, même historique, même carte) avec une consigne de reprise (`resume.md` : vérifier `git status`, puis finir le chantier), sa sortie ajoutée à `claude.log` ; chaque reprise est notée dans `run.json` (`resumes`) ; **Sortie** ouvre `/run/<nom>` (voir ci-dessous) ; une tâche qui tourne ne peut pas être retirée.

L'orchestrateur consomme la file avec [`queue.mjs`](../agent/queue.mjs) (`make agent-queue-wait`, `make agent-queue`), voir [Lancer depuis l'interface](orchestration.md#depuis-linterface). Pour essayer la page sans toucher au vrai registre : `AGENTS_REGISTRY=<registre jetable> AGENTS_AGENT_SH=<agent.sh d'un dépôt jetable> AGENTS_WORKTREES=<dossier jetable> node agents/agent/dashboard.mjs 7896` (et `AGENTS_ROADMAP_ROOT` pour lire le `docs/backlog.md` d'un autre dépôt ; `AGENTS_CLAUDE_BIN=<faux claude>` et `AGENT_TRANSCRIPTS=<dossier jetable>` pour essayer « ▶ Lancer » sans démarrer le vrai CLI).

#### Lancer sans orchestrateur

[`launch.mjs`](../agent/launch.mjs) (testé avec un faux `claude` : [`launch.test.ts`](../agent/test/launch.test.ts)) démarre, dans le worktree de la tâche (`cwd`) :

```sh
sh -c '"$@" <prompt.md; echo $? >exit' sh claude -p --session-id <uuid> --permission-mode auto --permission-prompts none --output-format stream-json --verbose
```

- **Effort et modèle** : ceux de l'agent (`--effort`, `--model`), relus à chaque démarrage, reprise comprise, et notés dans `run.json` ; aucun des deux par défaut.
- **Prompt** : celui de la tâche, `{{CO_AUTHORED_BY}}` remplacé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (`AGENTS_CO_AUTHORED_BY` pour une autre ligne), passé sur l'entrée standard (pas dans la liste des processus).
- **Permissions** : `--permission-mode auto` : le classifieur du mode automatique accepte seul les éditions et les commandes ordinaires et refuse les actions risquées ; `--permission-prompts none` refuse d'office ce qui demanderait une confirmation, au lieu d'attendre une réponse que personne ne donnera. `AGENTS_CLAUDE_PERMISSION_MODE` en choisit un autre : `bypassPermissions` (aucune vérification : réservé à une machine jetable), `acceptEdits` (éditions seulement : Bash refusé, l'agent ne peut ni tester ni commiter), `dontAsk` (seulement ce que les réglages autorisent déjà).
- **Détaché** : son propre groupe de processus (`setsid`), survit à un redémarrage du tableau de bord. Tout est dans `.git/agents/runs/<nom>/` : `prompt.md`, `claude.log` (sortie `stream-json`), `run.json` (pid, heure de départ du processus pour ne pas confondre un pid réutilisé, session, commande, mode) et `exit` (code de sortie, écrit par le `sh` qui l'enveloppe). **■ Arrêter** envoie `SIGTERM` au groupe, puis `SIGKILL` 5 s plus tard s'il tient encore.
- **Carte vivante** sur la page Agents : la session a un identifiant connu, son historique est `~/.claude/projects/<chemin du worktree encodé>/<session>.jsonl` ; le tableau de bord le lit en priorité pour cet agent (les historiques de sous-agents, `*/subagents/*.jsonl`, restent lus pour les autres). La carte montre aussi l'état du processus (erreur avec son code, arrêté, disparu), un bouton **■ Arrêter l'agent** et un bouton **↻ Relancer l'agent** (après une coupure réseau ou une erreur d'API, par exemple) et un lien **Sortie claude**.
- **Sortie** (`/run/<nom>`, [`run.html`](../agent/run.html)) : le flux `stream-json` de `claude` mis en forme et suivi en direct (lu par morceaux, `/api/queue/<nom>/log?from=<octet>`, en-tête `x-log-next`). En tête, la consigne donnée à l'agent (`/api/queue/<nom>/prompt`). Puis ses messages en Markdown, ses réflexions repliées, et une carte par appel d'outil : commande `Bash`, fichier lu, différences d'un `Edit`, liste de tâches, consigne d'un sous-agent, dont les messages s'affichent en retrait sous l'appel. Chaque carte montre son résultat, ou son erreur en rouge, et coupe les sorties longues avec un bouton « tout afficher ». La barre donne l'état, la durée, le nombre d'outils et d'erreurs, et des filtres (réflexions, événements système, outils dépliés, suivre). Le compte rendu final (durée, tours, coût) ferme la page. **↻ Relancer** y demande un mot facultatif pour l'agent, ajouté à la consigne de reprise ; une reprise s'affiche « ↻ session reprise ». **Brut** donne le flux tel quel.
- **Exécutable** : `AGENTS_CLAUDE_BIN`, sinon `~/.local/bin/claude`, sinon `claude` du `PATH`. Les variables `CLAUDECODE` d'une session Claude Code qui aurait démarré le tableau de bord ne sont pas transmises.
- **Une seule fois** : la prise d'une tâche est exclusive (verrou `.git/agents/queue/<nom>.lock` créé avec `O_EXCL`), partagée avec `queue.mjs mark <nom> launched` de l'orchestrateur, qui échoue désormais sur une tâche qui n'est plus en attente. Une tâche lancée d'ici ne sort donc plus de `queue.mjs wait`.

## Effort et modèle d'un agent

Chaque agent peut avoir son **effort** (`low`, `medium`, `high`, `xhigh`, `max` : la réflexion que Claude s'accorde) et son **modèle** (`opus`, `sonnet`, `fable`, `haiku`, ou un identifiant complet). Sans choix, `defaults.effort` et `defaults.model` d'`agents.config.mjs` s'appliquent, et s'ils sont vides, ceux de Claude Code (aucun `--effort` ni `--model`). Le module [`settings.mjs`](../agent/settings.mjs) (testé) tient tout cela.

- **Où ils vivent** : deux lignes du fichier de l'agent dans le registre, `AGENT_EFFORT=` et `AGENT_MODEL=` (`.git/agents/<nom>.env`).
- **Où on les choisit** :
  - sur la page **Backlog**, pour chaque tâche cochée, avant « Mettre en file » ;
  - sur la **carte** de l'agent, pour son prochain lancement ;
  - en ligne de commande : `make agent-new NAME=x EFFORT=xhigh MODEL=sonnet`.
- **Proposition** : cocher une tâche pré-remplit son effort d'après son texte (`suggestEffort`), avec la raison affichée à côté des menus :
  - `low` pour une petite retouche (texte, couleur…) ;
  - `medium` pour un chantier court ;
  - `xhigh` pour un chantier long ou qui touche la structure (architecture, protocole, sécurité, performances) ;
  - `high` sinon ; jamais `max`, qui reste un choix délibéré.

  **✨ Proposer avec Claude** demande un effort et un modèle pour chaque tâche cochée où tu n'as rien choisi toi-même : un seul appel `claude -p` sans outils (`--tools ''`), avec le modèle `suggestModel` de la config (`sonnet` par défaut), pour environ deux centimes. La raison de Claude s'affiche ; tu changes ce qui ne te va pas.
- **Qui les applique** :
  - le tableau de bord, à chaque démarrage de `claude` (`--effort`, `--model`) ;
  - l'orchestrateur, avec l'agent `chantier-<effort>` et le paramètre `model` de l'outil `Agent`, que `queue.mjs` lui donne (`agentType`, `effort`, `model`) ; voir [orchestration](orchestration.md#depuis-linterface). Les définitions `chantier-low` … `chantier-max` sont dans [`claude-agents/`](../claude-agents/), liées dans `.claude/agents/` du projet.

## Questions à l'utilisateur

Un agent pose un choix, une validation ou un retour stratégique avec `node agents/agent/ask.mjs` (ou `make agent-ask ARGS='…'`) ; l'utilisateur répond sur la page `/questions` du tableau de bord, et l'interrupteur « Décider seul » (activé par défaut) laisse les agents trancher avec l'option recommandée. Détails : [Questions et retours](orchestration.md#questions-et-retours). Pour essayer sans toucher au vrai registre : `AGENT_REGISTRY=<dossier jetable> node agents/agent/dashboard.mjs 7895`.
