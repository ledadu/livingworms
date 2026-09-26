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

Au clavier/souris : la tête suit la souris (comme `whip.html`), clic ou espace pour foncer, WASD/flèches, Échap pour pause.
