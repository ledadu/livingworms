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
| **Série** | copies réparties le long du parent, avec dégradé de taille, d'angle et de rythme (pattes, pléopodes, cils, cérates) ; option **alterner** gauche/droite (algues, dragon de mer feuillu) |
| **Anneau** | copies réparties sur 360° autour d'un nœud (étoile de mer, oursin, anémone, ophiure) |

Sur un éventail, une série ou un anneau : **membrane** tendue entre copies voisines (nageoires à rayons, bras palmés, collerette de seiche), **variation naturelle** (chaque copie diffère un peu, toujours de la même façon) et **arc-en-ciel** (décalage de teinte d'une copie à l'autre, cténophore).

Les positions sont en **fraction du parent** (0 % = tête, 100 % = bout) : une structure reste propre quand on change le nombre de maillons.

Chaque partie a :
- **Forme** : rendu (ruban lissé, plaques de carapace, trait, perles, œil), profil de largeur (easings de `whip.js` normalisés + cloche, fuseau, carapace, volant, massue, bulbe…), maillons, longueur, largeur.
- **Forme** (suite) : maillons qui raccourcissent vers le bout (spirale logarithmique du nautile).
- **Souplesse** : souplesse (angle max entre maillons), **mémoire de forme**, **courbure de repos** et sa **répartition** (pliée à la base ou enroulée au bout, queue d'hippocampe), glisse dans l'eau, poids.
- **Mouvement** : battement, rame (coup rapide / retour lent), frémissement, pulsation (ombrelle), respiration, ondulation (vague le long du corps), enroulement. Le « décalage de rythme » d'une série crée une vague métachronale.
- **Couleur** : une des 4 teintes de la **palette harmonieuse** de l'espèce (analogue, complément, triade…), nuance, dégradé, opacité, fondu, lueur, lumière additive, et **motif** : bandes, taches, ligne, ocelles, liseré.
- **Rôle en jeu** : fouet, dard, pince, nageoire, cils, lanterne, antenne, décor.

L'aquarium permet de voir l'espèce nager (circuit, guidée au doigt, ou en pose de repos), de passer en **Nuit** pour juger la bioluminescence, d'afficher le squelette et de **toucher une partie pour la sélectionner**.

Outils : copier / couper / coller une partie (même le tronc entier, qui devient un membre ailleurs), **Mes parties** (bibliothèque de parties réutilisables), **créature au hasard** (un corps + une partie de tête + des parties latérales + une queue, palette harmonieuse), **croisement** de deux espèces, variations, annuler / rétablir, export / import JSON. « Jouer » lance une partie avec ton espèce.

**Bestiaire** (`bestiary.js`, 43 espèces rangées par famille) — poissons : anguille, poisson-clown, carpe koï, hippocampe, combattant, rascasse volante, raie manta, requin-baleine, dragon de mer feuillu, grand gosier, baudroie · méduses & cie : méduse lune, méduse ortie, méduse-boîte, anémone, cténophore, galère portugaise, siphonophore · crustacés : crevette, krill, copépode, crabe, homard bleu, crevette-mante · mollusques : calmar, poulpe, seiche, nautile, ange de mer, nudibranche · vers : larve, ver plumeau, ver de feu, ver plat, serpent cilié · échinodermes : étoile de mer, ophiure, oursin · autres : axolotl, tortue de mer, tardigrade · chimères : hydre, dragon abyssal. En jeu, chaque espèce apparaît à partir d'une certaine profondeur.

En jeu, une greffe s'ajoute à la **définition** de la partie : toutes ses copies symétriques la reçoivent.

Au clavier/souris : la tête suit la souris (comme `whip.html`), clic ou espace pour foncer, WASD/flèches, Échap pour pause.
