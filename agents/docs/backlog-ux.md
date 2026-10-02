# Refonte de la page Backlog

La page Backlog (`/roadmap`) a grandi par couches (sous-tâches, ⚡ auto, 💬, 🧩, effort par défaut, file des agents) et ne se lit plus. Ce document fait le constat, pose les principes de la nouvelle page et ce qu'il reste à trancher. Une **maquette fonctionnelle**, sur les vraies données et les vraies actions, tourne à côté de l'ancienne page : **`/roadmap/v2`** ([`roadmap-v2.html`](../agent/roadmap-v2.html)).

## Le constat (page actuelle, octobre 2026)

Mesuré sur la page réelle : 19 lignes affichées, 13 entrées dans la file des agents dont 10 terminées, une page de 5 200 px de haut sur téléphone.

1. **La file des agents est envahie par le passé.** 10 tâches terminées sur 13, chacune avec 4 boutons (Sortie, Carte, Relancer, Retirer) : ce qui travaille vraiment se perd dessous.
2. **« Tâches choisies » occupe le coin le plus précieux, même vide.** Le choix est un moment (je coche, je règle, je lance), pas une zone permanente.
3. **Le bandeau des changements est un mur de liens.** « 32 nouveaux : … » sur dix lignes, en tête de page, et sur téléphone avant tout le reste.
4. **Chaque ligne porte 6 à 7 contrôles** (case, ▸ texte, ↳, ✎, 🧩, 💬, ⚡) et deux pastilles (« ajouté », « à faire ») : à la fin, tout a le même poids et rien ne ressort.
5. **L'état normal est affiché partout.** « à faire » sur chaque ligne alors que c'est le cas le plus courant : l'œil ne trouve plus les exceptions (en cours, en file).
6. **Les chaînes de sous-tâches s'enfoncent.** Cinq niveaux de retrait mangent la largeur, alors qu'une chaîne est le plus souvent une suite : 1, puis 2, puis 3.
7. **Pas de recherche**, et le seul filtre est un menu déroulant à trois choix.
8. **Le détail d'un chantier passe par une fenêtre modale** qui cache tout : on ne peut pas lire un chantier en regardant la liste.
9. **Sur téléphone**, la page est une longue pile : en-tête sur quatre lignes, le mur des changements, puis les chantiers, puis la file loin en bas.

## Les principes

- **Montrer les exceptions, taire la règle.** Un chantier à faire n'a pas de pastille ; en file, en cours, fusionné en ont une, de couleur.
- **Le passé dans un coin.** Les agents terminés et les chantiers livrés existent, mais repliés : « ✓ 10 terminés ▸ ».
- **Une action principale visible, le reste derrière ⋯.** Sur un chantier : le choisir (la case) et l'ouvrir (un clic) ; tout le reste dans son menu ou sa fiche.
- **Le choix est une barre qui apparaît**, en bas, seulement quand on coche : combien, quel effort, quel modèle, « Mettre en file et lancer ».
- **Lire sans quitter la liste** : la fiche d'un chantier s'ouvre à côté (plein écran sur téléphone, avec « ← Retour »).
- **Une chaîne se lit comme une suite** : la tâche mère, puis ses étapes numérotées sur une ligne, avec une barre de progression.
- **Le téléphone d'abord** : une colonne, deux onglets (Chantiers, Agents), la barre de choix en bas, rien qui déborde.

## La nouvelle page (maquette `/roadmap/v2`)

- **En-tête sur deux lignes** : la navigation, puis la recherche (`/` pour y aller), les filtres en segments avec leurs nombres (À faire 16 · En cours 3 · Fusionnés 12 · Livrés 43 · Tout), « ● 31 nouveaux » (une pastille qui filtre, au lieu du mur), Liste / Tableau, et ⟳.
- **La liste par groupe** (`##`), repliable, avec « 7 à faire · 1 en cours · 6 fusionnés ».
- **Une carte par chantier** : la case, le titre, une ligne de méta (état si ce n'est pas « à faire », l'agent, ⚡ auto, 💬 n, 🧩 n, un point s'il est nouveau) et ⋯. La case reste discrète tant qu'on ne survole pas ou qu'on n'a rien choisi.
- **Les chaînes** : la mère en carte, « chaîne de 6 » et une barre (une case par étape, colorée par état), puis les étapes numérotées. Une étape qui ne suit pas la précédente le dit (« après « Manger : … » »).
- **Le menu ⋯** : ouvrir, choisir, modifier ou discuter, ⚡ lancer d'elle-même, ne plus être une sous-tâche, « Sous-tâche de… ».
- **La fiche** (à droite, ou en plein écran sur téléphone) : titre, groupe et ligne, mère et suite de la chaîne (cliquables), état, agent, « Choisir », le texte mis en forme.
- **Le panneau Agents** : au travail (avec leur durée, Sortie, ■), en attente (▶ Lancer, « Lancer les N »), en erreur, puis **« ✓ 10 terminés ▸ » replié dans un coin** (son ouverture est retenue).
- **La barre de choix** : « 2 choisis + 9 sous-tâches », effort et modèle par défaut (les mêmes que l'ancienne page), « Revoir les prompts ▴ » qui déplie chaque tâche (nom d'agent, base, prompt), « Vider », « Mettre en file », « Mettre en file et lancer ▶ ».
- **La vue Tableau** : quatre colonnes, À faire, En file, En cours, Fusionnés ; une sous-tâche y dit sa place (« ↳ 3/6 »).
- La page ne se redessine que si quelque chose a changé (la relecture toutes les 5 s garde le survol et le défilement).

## Le lien avec les agents (deuxième version de la maquette)

Retours : « on ne voit pas assez visuellement les tâches qui ont un agent, et dans quel état il est » ; « le lien avec l'agent manque de travail » ; le panneau Agents doit être un résumé qui renvoie à la page Agents, avec les fonctions en raccourci.

- **L'état vivant de l'agent** est lu sur `/api/agents` (comme la page Agents) : **en file**, **au travail** (son processus tourne, ou il a bougé depuis moins de 10 min), **fini · à accepter**, **en erreur**, **acceptée**, **en pause**.
- **Une carte avec un agent vivant ressort** : une bordure de la couleur de son état (bleu au travail, avec un point qui bat ; orange à accepter ; rouge en erreur ; jaune en file), un fond teinté, et une **bande** sous le titre : l'état, le nom de l'agent, **ce qu'il fait en ce moment** (son dernier outil, ou son dernier mot quand il a fini), ses commits, depuis combien de temps, et ses **raccourcis** : Sortie, ■ arrêter, ▶ Tester (ou Ouvrir si son jeu tourne), ✓ Accepter, ↻ Relancer. Une tâche acceptée garde seulement une pastille « acceptée » et le nom de l'agent.
- **La fiche** montre la même bande, puis les livrables (commits, rapport, entrée, captures, à jour avec sa base) et un lien vers sa carte sur la page Agents.
- **Le panneau Agents devient un résumé** : les nombres (« 2 au travail · 1 fini · à accepter »), les agents vivants (les erreurs et les « à accepter » d'abord), chacun avec son chantier (cliquable) et ses raccourcis, les autres repliés, et « Page Agents → ».
- **Le Tableau suit les agents** : À faire, En file, **Au travail**, **À accepter**, Acceptées. Il prend toute la largeur ; la fiche s'y ouvre en tiroir.

## Le glisser-déposer

À la souris, on glisse dès que la carte a bougé de quelques pixels ; au doigt, par un **appui long** (350 ms, une petite vibration), et la page ne défile plus jusqu'au dépôt. Une étiquette suit le pointeur et dit ce que fera le dépôt.

- **Liste** : déposer un chantier **sur un autre** en fait une étape de sa chaîne (« Étape de « … » ») ; **sur le titre d'un groupe**, il n'est plus une sous-tâche. Refusé sur lui-même, sur ses propres étapes ou sur un chantier livré.
- **Tableau** : d'« À faire » vers « En file », il est mis en file (avec l'effort et le modèle par défaut) ; vers « Au travail », mis en file et lancé ; d'« En file » vers « Au travail », lancé ; d'« À accepter » vers « Acceptées », accepté (avec confirmation). Le reste est refusé, et l'étiquette le dit.

## Ce qui reste dans l'ancienne page, pour l'instant

Le temps de la maquette, « ✎ Modifier · 💬 · 🧩 » renvoie à `/roadmap` : l'édition du texte, les deux discussions avec Claude, l'ajout d'un chantier (« + chantier ») et le glisser-déposer des sous-tâches. La refonte les ramène dans la fiche.

## La refonte complète : ce que je propose

1. **La fiche devient l'endroit de travail** : le texte modifiable sur place (aperçu et Markdown), les deux discussions en onglets (💬 Le chantier, 🧩 Sous-tâches), les propositions de Claude en différences, « Créer la sous-tâche » qui l'ajoute aussitôt à la chaîne affichée.
2. **Créer un chantier** depuis la liste (« + » sur un groupe) dans la fiche, vide, prête à écrire ou à discuter.
3. **Glisser-déposer** (fait dans la maquette, voir plus haut) ; reste à **réordonner** les étapes d'une chaîne et les chantiers d'un groupe.
4. **Une priorité** explicite (un ordre dans le groupe, ou une marque « prioritaire »), au lieu d'un mot dans le texte.
5. **Des raccourcis** : `/` chercher, `j`/`k` descendre et monter, `x` choisir, `Entrée` ouvrir, `Échap` fermer.
6. **Le panneau Agents** : un résumé avec raccourcis qui renvoie à la page Agents (décidé, fait dans la maquette).
7. **Remplacer `/roadmap`** quand la maquette fait tout : l'ancienne page reste un temps sous `/roadmap/v1`.

## À trancher

- **Liste ou Tableau par défaut ?** La liste montre les chaînes et l'ordre du backlog ; le tableau montre le flux des agents. Proposition : la liste, le tableau en second.
- **Les livrés** : un filtre (comme dans la maquette) ou une page à part (« Livré », par version) ?
- **La priorité** : un ordre manuel par glisser-déposer, ou une simple marque ?
