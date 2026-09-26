# HYDRA — la lignée des abysses

Jeu mobile (Android / navigateur) construit sur la technologie de fouets de `whip.js` :
chaque créature est un **arbre de fouets** (chaînes verlet avec angle max, sous-fouets
accrochés aux nœuds, easings pour la forme du corps).

## Jouer

- Ouvrir `hydra/index.html` servi en HTTP(S) (GitHub Pages, `python3 -m http.server`…).
- Sur Android (Chrome) : menu ⋮ → **Ajouter à l'écran d'accueil** → le jeu se lance en plein écran et fonctionne hors ligne.

## Principe

- **Pouce gauche** : joystick flottant pour nager.
- **Pouce droit** : toucher = foncer, glisser = choisir la direction.
- Les dégâts dépendent de la **vitesse relative** du bout des membres : un changement de direction brusque fait claquer les tentacules.
- **Couper un nœud coupe tout son sous-arbre** : le membre tranché dérive, on le dévore pour absorber son **gène** (le sous-arbre complet, avec ses propres branches).
- **Greffe** : toucher un gène puis un point d'ancrage doré, sur le corps (paire symétrique) ou au bout d'un membre (profondeur max 4 niveaux).
- Plus on descend, plus il fait sombre et plus les arbres ennemis sont profonds. Les **lanternes** élargissent la vision, les **nageoires** accélèrent, les **cils** régénèrent, les **pinces** augmentent la portée de la bouche, les **dards** font mal au moindre contact.

## Atelier des espèces (éditeur)

Bouton **Atelier des espèces** sur l'écran titre. Une espèce est un arbre de parties ;
chaque partie est un fouet (`engine.js`) et porte des **accroches** :

| Motif | Usage |
|---|---|
| **Seul** | une partie unique (rostre, lanterne, dard au bout d'un membre) |
| **Paire** | copie miroir gauche/droite (antennes, nageoires, yeux) |
| **Éventail** | plusieurs copies autour d'un même nœud, réparties sur la largeur du parent (filaments de méduse, bras de calmar, queue de crevette) |
| **Série** | copies réparties le long du parent, avec dégradé de taille, d'angle et de rythme (pattes, pléopodes, cils, cérates) |

Les positions sont en **fraction du parent** (0 % = tête, 100 % = bout) : une structure reste propre quand on change le nombre de maillons.

Chaque partie a :
- **Forme** : rendu (ruban lissé, plaques de carapace, trait, perles, œil), profil de largeur (easings de `whip.js` normalisés + cloche, fuseau, carapace, volant, massue, bulbe…), maillons, longueur, largeur.
- **Souplesse** : souplesse (angle max entre maillons), **mémoire de forme** et **courbure de repos** (une antenne reste arquée, une patte garde son genou), glisse dans l'eau, poids.
- **Mouvement** : battement, rame (coup rapide / retour lent), pulsation (ombrelle), ondulation (vague le long du corps), enroulement. Le « décalage de rythme » d'une série crée une vague métachronale.
- **Couleur** : une des 4 teintes de la **palette harmonieuse** de l'espèce (analogue, complément, triade…), nuance, dégradé, opacité, fondu, lueur, lumière additive.
- **Rôle en jeu** : fouet, dard, pince, nageoire, cils, lanterne, antenne, décor.

L'aquarium permet de voir l'espèce nager (circuit, guidée au doigt, ou en pose de repos), d'afficher le squelette et de **toucher une partie pour la sélectionner**. Modèles fournis : anguille, méduse, crevette, calmar, baudroie, nudibranche, ver plumeau, larve, serpent cilié, hydre. « Jouer » lance une partie avec ton espèce ; les espèces s'exportent / s'importent en JSON.

En jeu, une greffe s'ajoute à la **définition** de la partie : toutes ses copies symétriques la reçoivent.

Au clavier/souris : la tête suit la souris (comme `whip.html`), clic ou espace pour foncer, WASD/flèches, Échap pour pause.
