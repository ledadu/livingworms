# La performance sur téléphone

Le jeu se joue d'abord sur téléphone (voir la [vision](vision.md)) : il doit rester fluide sur un téléphone moyen, dans tous les chapitres. Ce document dit ce qu'on vise, comment on mesure, ce que coûte une image et les règles que le jeu suit pour tenir son budget. Le rendu lui-même est décrit dans les [décisions](decisions.md) (WebGL2 maison, canvas en repli, niveaux de détail).

## Ce qu'on vise

- **Fluide** : 50 images par seconde ou plus. **Jouable** : de 30 à 50. **Lent** : moins de 30 (le banc le dit pour chaque chapitre).
- Un téléphone moyen fait environ deux fois et demie moins de calcul qu'un ordinateur portable récent ; un téléphone modeste, quatre fois moins. Sur ordinateur, on les imite en bridant le processeur de Chrome (outils de développement, ou `Emulation.setCPUThrottlingRate` par le protocole de débogage) avec une fenêtre de 412 × 870 px et une densité de 2,6 : le banc de ce document a été mesuré ainsi.
- Le processeur graphique d'un téléphone ne se bride pas de la même façon : on lit son temps quand le navigateur le donne (voir plus bas), et le jeu baisse sa résolution s'il le faut.

## Mesurer

- `?bench` : le banc complet (tour des chapitres, charge d'animaux au Récif, niveaux de détail, moteur seul espèce par espèce). `?bench=tour` : le tour seul, la qualité tenue entière, pour comparer avant et après. `?bench=jeu` : le tour avec la qualité qui s'adapte, comme en jouant ; la colonne « résolution » dit où elle s'est posée. Le bouton « Lancer le test de performance » des réglages fait le tour comme en jeu (le banc complet avec `?dev`).
- Le banc mesure toujours à la distance du jeu (900), quel que soit le zoom choisi par le joueur (un zoom rapproché grossit tout ce qui est dessiné).
- Pour chaque chapitre : images par seconde et verdict (fluide, correct, lent), temps de processeur par image (moyenne et 95 %), simulation par pas, dessin, temps du processeur graphique quand le navigateur le donne (`EXT_disjoint_timer_query_webgl2` : Chrome sur ordinateur, certains téléphones ; `chrono-gpu.ts`), animaux proches, plantes, objets.
- **Sur un vrai téléphone** : dans les réglages, toucher « Lancer le test de performance » (ou ouvrir la page publiée avec `?bench=jeu`, `?bench=tour`), attendre la fin du tour (deux à quatre minutes), toucher « Copier le résultat » et coller le texte dans un message (`bench-texte.ts`). Sans presse-papiers (adresse non sécurisée), le texte reste sélectionné dans la zone du bas.
- Le fil principal du navigateur est partagé : sur une machine où d'autres pages travaillent en même temps (plusieurs agents, plusieurs fenêtres), les images par seconde varient beaucoup d'une mesure à l'autre. Pour comparer deux versions, on alterne les mesures (A, B, A, B) et on lit d'abord le temps de processeur par pas et par image.

## Ce que coûte une image

Une image fait jusqu'à trois pas de simulation (1/60 s chacun) puis le dessin.

- **La simulation** : les animaux proches (le moteur de fouets, `creature3.ts`), l'eau entre les corps (`flow.ts`), les plantes vivantes, les visiteurs, les bancs, la vie des animaux (`vie-jeu.ts`). Sur un téléphone lent, plus une image est longue, plus elle doit rattraper de pas : c'est ce poste qu'il faut tenir en premier.
- **Le dessin, côté processeur** : les corps en triangles (`paint-gl.ts`), les décors, les sprites ; puis l'envoi au processeur graphique (`gfx.ts`).
- **Le dessin, côté processeur graphique** : les couches qui couvrent l'écran (l'eau, le fond, les rayons, le noir de la Fosse, l'eau qui ondule), les lueurs additives, les méduses du Jardin.

## Les règles

- **Hors champ, rien ne bouge** (`hors-champ.ts`) : un animal qui flâne, ou une plante qui ondule, n'est simulé que s'il est à l'écran ou à moins de 300 px de ses bords, à sa propre profondeur. Avant, tout était simulé à 1 100 px autour du nageur, alors qu'un téléphone tenu droit en voit environ 200 de chaque côté. Hors de vue, l'animal attend où il est et reprend quand il revient dans le champ. Restent toujours simulés près du nageur : la fratrie, les parents, la rivale, les lumières qui répondent, les ancêtres de la Remontée, le partenaire d'une parade et les animaux pris dans une scène de la vie (`vie-jeu.ts`) ; les visiteurs aussi (ils passent au loin même quand on ne bouge pas).
- **Le moteur sans `Math.hypot`** : dans les boucles du moteur, les longueurs passent par `len2` et `len3` (`src/engine/util.ts`), dix fois moins chères que `Math.hypot`.
- **L'eau ne regarde que ce qui se touche** (`flow.ts`) : une grille plate rangée une fois par pas ; un corps hors de portée de tous les autres est laissé tel quel, et dans un corps seuls les nœuds qui peuvent toucher un autre sont examinés. Les poussées sont les mêmes, au bit près (`flow.test.ts`).
- **Un envoi par image** (`gfx.ts`) : les sommets de toute l'image partent en une fois, puis un appel de dessin par suite de formes qui partagent une texture. Le dessin additif (les lueurs) garde le même mélange : ses sommets laissent un alpha nul, ce qui ajoute leur couleur ; passer d'une lueur à un corps ne coupe plus rien.
- **Les plantes poussent dans un budget** : 3 ms par image au plus pour faire pousser les plantes qui approchent, quel que soit le nombre de pas de l'image.
- **La qualité s'adapte** (`main.ts`, toutes les 60 images) : quand les images sont en retard, l'eau cesse d'onduler d'abord, puis les animaux passent à des niveaux de détail plus grossiers (le biais), puis la résolution baisse, jusqu'à 55 %. Elle remonte quand les images sont en avance. La densité de pixels est plafonnée à 1,5.

## Mesures

Voir le rapport du chantier « La performance sur téléphone » (`changes/`) pour les mesures avant et après, chapitre par chapitre.
