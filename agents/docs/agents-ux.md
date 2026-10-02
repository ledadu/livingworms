# Refonte de la page Agents

Même démarche que pour la page Backlog ([backlog-ux.md](backlog-ux.md)) : la nouvelle page ([`agents-v2.html`](../agent/agents-v2.html)) est sur **`/agents`**, l'ancienne reste sur **`/agents/v1`** (et sert toujours `/versions`, avec ses onglets À publier, versions, Publiées, Branches).

## Le constat (ancienne page, octobre 2026)

1. **Des cartes immenses**, environ 900 px chacune : l'objectif, les livrables, « En ce moment », les serveurs, le diffstat, l'effort et le modèle, jusqu'à 11 boutons, le fil des outils, les commits, quatre journaux repliés. Tout a le même poids.
2. **« En ce moment » en très gros… sur un chemin brut** (`/home/…/.agent/look/duo-meduses.jpg`) ou une commande shell : le plus visible est le moins lisible.
3. **Des boutons ambigus** : « ■ Arrêter » (son jeu) à côté de « ■ Arrêter l'agent » ; « Rebase », « Accepter », « Corriger les conflits », « Nouvel ordre », « Relancer l'agent » à la suite, visibles ou non selon l'état.
4. **« te demande » sur toutes les cartes**, même sans question : c'est le mode (l'agent te posera ses choix), pas une demande.
5. **Les onglets mélangent agents et versions** (En cours, À publier, Version 0.8, Publiées, Branches).
6. **L'en-tête porte les actions de toute l'équipe** (Rebaser les terminées, Pousser, Nettoyer, la base du rebase) au même niveau que l'état.
7. **La fusion en série occupe un bandeau permanent**, même quand rien n'est à fusionner.
8. **Sur téléphone**, l'en-tête prend un écran et la page déborde en largeur.

## La nouvelle page

- **En tête, des filtres avec leurs nombres** : Actifs, À accepter, Au travail, En erreur, En pause, Acceptées, et les Questions (vers `/questions`). À droite, « Décider seuls » (les agents prennent l'option recommandée, ou te posent leurs choix) et **Équipe ⋯** : rafraîchir le backlog, rebaser les finies (et sur quelle base), pousser sur GitHub (avec le plan avant), nettoyer les finies (avec la liste avant), les versions, l'ancienne page.
- **« Ce qui t'attend »** : une ligne par chose qui demande ton geste, la plus urgente d'abord. Une question (Répondre), un agent arrêté en erreur (↻ Relancer, Sortie), un agent qui a fini (▶ Tester, ✓ Accepter, 🔀 Mettre à jour s'il est en retard sur sa base, 🛠 Faire corriger si « Accepter » l'a refusé). Sinon : « Rien ne t'attend ».
- **Une carte par agent**, de la couleur de son état (bandeau du haut) : l'état, le nom, depuis quand ; **le titre de son chantier** (lien vers le backlog) ; **ce qu'il dit** (son dernier message, ses mots plutôt que ses outils), et dessous ce qu'il fait, en clair (« lit duo-tango.jpg », « lance Merge backlog into the branch ») ; ses livrables en pastilles (commits, rapport, entrée, captures, en retard, fichiers non commités, son jeu qui tourne, ses questions) ; **une ou deux actions selon son état**, et ⋯ pour le reste. Une carte finie a « en série » pour la fusion en série.
- **Le tiroir d'un agent** (clic sur la carte, ou `/agents#<nom>`, où mènent les notifications) : tout le reste, à la demande. Ses actions, ce qu'il dit, ses livrables ; **Lui parler** (un nouvel ordre, son effort et son modèle pour le prochain lancement) ; **ce qu'il a fait**, en clair, le plus récent d'abord ; ses commits ; ses fichiers non commités ; son jeu (ouvrir, arrêter, ses journaux) ; son chantier en entier.
- **Le menu ⋯ d'un agent** : tout voir, la sortie de claude, commits et rapport, tester ou ouvrir sa version, arrêter son jeu, nouvel ordre, relancer, arrêter l'agent, accepter, mettre à jour avec sa base, rebaser, remettre en cours.
- **Tout accepter, l'une après l'autre** (la fusion en série, refaite) :
  - **Le geste** : dès que deux tâches au moins sont finies, « ✓ Tout accepter… (N) » à côté de « Ce qui t'attend ». Plus de petite case « en série » sur chaque carte.
  - **Avant de lancer**, une fenêtre : ce qui va se passer (dans cet ordre ; sur un conflit, l'agent fusionne sa base et le règle, 2 essais au plus ; une tâche qui échoue est laissée de côté), puis chaque tâche avec une case (la garder dans la série), son numéro, ↑ ↓ pour changer l'ordre, et **son risque** : « ✓ rien en commun : sans conflit attendu », « ⚠ N fichiers aussi changés sur backlog », « ⚠ après X : main.ts, mecaniques.md » (les fichiers qu'elle partage avec une tâche fusionnée avant elle), et les commits de sa base à rattraper. Les risques se recalculent quand l'ordre change. **L'ordre conseillé** (les moins risquées d'abord) est proposé à l'ouverture, et « Revenir à l'ordre conseillé » le remet. Le bas dit combien pourraient demander une correction. Route : `GET /api/merge-train/preview?names=a,b` ([`merge-train.mjs`](../agent/merge-train.mjs) `previewTrain`, `suggestOrder`, testés : les fichiers changés par chaque branche depuis sa base, comparés à ceux de sa base et des autres).
  - **Pendant la série**, un panneau en tête de page : une barre de progression, « N sur M », et une étape par tâche (○ en attente, ⟳ fusion…, 🔀 règle un conflit, avec « l'agent fusionne backlog et règle le conflit (essai 1 sur 2), puis la fusion reprend » et « Voir ce qu'il fait », ✓ acceptée, ✕ échec avec sa raison et « Ouvrir l'agent », – sautée). Quand le dépôt principal bloque, il le dit (« règle ça, la file reprend toute seule »). « + Ajouter les finies » ajoute les tâches finies entre-temps, « ■ Arrêter après celle en cours » saute le reste. Une tâche de la série n'a plus de bouton « Accepter » ailleurs sur la page.
  - **À la fin**, le bilan (« 2 acceptées · 1 en échec ») reste affiché avec chaque étape, jusqu'à « ✕ Fermer ».
- **Les acceptées** sont repliées sous la grille (« ✓ 10 acceptées… ▸ »), et ont leur filtre.
- **Les versions** (À publier, Version X, Publiées, Branches) restent sur `/versions`, l'ancienne page, en attendant leur propre refonte.

## Reste à faire

- La page Versions, refaite de la même façon.
- Le rapport d'un agent lisible dans son tiroir (aujourd'hui : « Commits et rapport », dans le Journal).
- Les questions d'un agent dans son tiroir, avec leur réponse sur place.

## La navigation : le parcours, plus des onglets

Retour : la rangée d'onglets (Accueil, Agents, Journal, Versions, Backlog, Questions, 🔔) n'est ni ergonomique ni structurée, alors que la carte de l'écosystème (l'accueil) raconte bien le cycle. La navigation de toutes les pages reprend donc ce cycle ([`nav.js`](../agent/nav.js), servi en `/nav.js`, inclus par chaque page ; il remplace l'ancienne rangée `nav.site`, qui reste si le script échoue).

- **Quatre étapes, dans l'ordre, avec leurs compteurs vivants** : **① 📋 Backlog** (« 9 à faire · 31 nouveaux », `/roadmap`) → **② 🤖 Agents** (« 2 au travail · 1 en file », `/agents`) → **③ ✋ À valider** (« 1 à accepter · 1 en erreur », `/agents?f=review`) → **④ 📦 Publier** (« 3 à ranger · Version 0.8 : 10 », `/versions`). Chaque étape a sa couleur (celles des zones de la carte), l'étape courante est surlignée, une pastille compte ce qui demande un geste et bat quand il y en a.
- **« 📥 Pour toi »** : un panneau qui rassemble tout ce qui attend l'utilisateur : questions, agents en erreur, travaux à tester et accepter (avec leur dernier mot), entrées à ranger dans une version ; chaque ligne mène où agir. À côté : 🕘 Journal, ❓ Questions (avec leur nombre), 🔔 Notifications. Le nom du projet ramène à la carte.
- **Sur téléphone**, les quatre étapes deviennent une barre d'onglets en bas de l'écran (avec leurs pastilles), le haut garde Pour toi, Journal, Questions et 🔔.
- **Les compteurs** viennent de `GET /api/nav` ([`workflow.mjs`](../agent/workflow.mjs) `navState`, `agentStage`, testés) et de `/api/versions`, relus toutes les 10 s quand la page est visible. La page Agents tient l'étape courante à jour quand on change de filtre (`?f=review` ↔ « À valider »).
