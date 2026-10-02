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
- **La fusion en série** : on coche « en série » sur les cartes finies, une barre apparaît en bas (« 2 à accepter en série », ✓ Accepter en série) ; pendant la file, un bandeau montre chaque tâche (en attente, fusion…, règle ses conflits, acceptée, échec) avec ■ Arrêter, puis ✕ Fermer.
- **Les acceptées** sont repliées sous la grille (« ✓ 10 acceptées… ▸ »), et ont leur filtre.
- **Les versions** (À publier, Version X, Publiées, Branches) restent sur `/versions`, l'ancienne page, en attendant leur propre refonte.

## Reste à faire

- La page Versions, refaite de la même façon.
- Le rapport d'un agent lisible dans son tiroir (aujourd'hui : « Commits et rapport », dans le Journal).
- Les questions d'un agent dans son tiroir, avec leur réponse sur place.
