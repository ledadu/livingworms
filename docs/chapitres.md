# La trame : 10 chapitres

La descente de la surface au fond de la fosse, puis la remontée. Chapitres du [plan v1](plan-v1.md), avec la **Grotte** et le **Glacier** ajoutés ([décisions](decisions.md)). Tout ce qui est marqué *proposition* reste à valider.

Les profondeurs sont indicatives : le monde est une descente continue, pas une carte réaliste.

## Les textes

- Ils s'affichent en lettres fines, lentement, au début de chaque chapitre (ouverture) et au moment de l'adieu.
- Deux à quatre lignes au maximum.
- La voix est celle de la lignée, un « nous », comme si les ancêtres parlaient.

## Vue d'ensemble

| # | Chapitre | Profondeur | Obstacle | Traits qui le franchissent | Note |
| --- | --- | --- | --- | --- | --- |
| 1 | La Nurserie | 0–40 m | aucun (apprentissage) | — | l'éclat |
| 2 | Le Récif | 40–90 m | courant de passe | nageoires | le battement |
| 3 | La Forêt | 90–200 m | mur d'algues dense | pinces, corps fin | le frôlement |
| 4 | La Grotte *(nouveau)* | 200–250 m | galerie étroite et noire | corps fin, lanterne | l'écho *(proposition)* |
| 5 | La Carcasse | 250 m | aucun (souvenir) | — | le souvenir |
| 6 | Les Sources | 280–340 m | couloir brûlant | carapace, cils | la braise |
| 7 | Le Glacier *(nouveau)* | 340–400 m | eau glacée qui fige et qui plonge | carapace, filaments | le givre *(proposition)* |
| 8 | Le Jardin de méduses | 400–500 m | le vide, sans fond | pulsation, filaments | la pulsation |
| 9 | La Fosse | 500–650 m | le noir et le silence | lanterne, chant | le silence |
| 10 | La Remontée | du fond à la surface | — | le chant complet | — |

Chaque obstacle a au moins deux traits qui le franchissent (règle du plan). Le Récif n'en a qu'un dans le plan v1 : un second est à trouver (proposition : la pulsation, pour passer par-dessus le courant).

## 1. La Nurserie (surface, 0–40 m)

- **Décor** : lumière vive, plancton en suspension, reflets de la surface, bancs de larves.
- **Génération 1** : une larve simple, sans trait (`firstAncestor`, `src/content/species.ts`).
- **Obstacle** : aucun, c'est l'apprentissage. Suivre la lumière, nager, observer.
- **Partenaire** : un copépode ou une larve d'une autre espèce (`copepode`, `larve`).
- **Moment fort** : un banc de milliers de larves qui descend avec toi.
- **Note du chant** : « l'éclat ».

Ouverture :

> Au commencement, il y avait la lumière, et nous étions si petits qu'elle nous traversait.

Adieu :

> Tu ne descendras pas plus bas. Mais ce que tu étais, lui, continue.

## 2. Le Récif (40–90 m)

- **Décor** : coraux ramifiés, gorgones, anémones avec poissons-clowns, sable clair.
- **Obstacle** : un courant de passe entre deux barrières de corail ; il faut des nageoires.
- **Partenaires** : poisson-clown, rascasse volante, hippocampe (`poissonClown`, `poissonLion`, `hippocampe`).
- **Moment fort** : une tortue passe au-dessus, immense, et projette son ombre.
- **Note** : « le battement ».

Ouverture :

> Ici, tout le monde a une maison. Nous n'en avions pas. Alors nous sommes devenus de ceux qui passent.

## 3. La Forêt (90–200 m)

- **Décor** : kelp géant jusqu'à la surface, lumière verte filtrée, épaisseur, silence.
- **Obstacle** : un mur d'algues trop dense ; il faut des pinces, ou un corps fin.
- **Partenaires** : dragon de mer feuillu, seiche, homard (`dragonFeuillu`, `seiche`, `homard`).
- **Moment fort** : se cacher dans le kelp pendant qu'un grand prédateur passe. Il ne touche jamais (zéro danger) : la tension vient de sa taille et de sa lenteur.
- **Note** : « le frôlement ».

Ouverture :

> La forêt ne pousse pas vers le fond. Elle pousse vers ce qu'elle a quitté.

## 4. La Grotte (200–250 m) *— nouveau chapitre, tout est proposition*

- **Décor** : sous la forêt, la falaise s'ouvre sur un réseau de galeries. Voûtes, piliers, stalactites de calcaire, rais de lumière qui tombent par des puits. Plus loin, le noir complet où brillent quelques animaux.
- **Obstacle** : une galerie étroite et noire qui mène plus bas ; il faut un corps fin pour s'y glisser, ou une lanterne pour trouver le passage large.
- **Partenaires** : anguille (corps fin), serpent cilié, et un cténophore égaré, qui apporte la lumière (`anguille`, `serpentCilie`, `ctenophore`).
- **Moment fort** : tout le banc de poissons qui te suivait fait demi-tour à l'entrée ; tu entres seul, et ta propre nage se met à résonner.
- **Note** : « l'écho ».

Ouverture :

> Il y avait sous la forêt un chemin que la lumière ne prenait pas. Nous l'avons pris pour elle.

Adieu (proposition, les autres adieux sont à écrire) :

> Tu resteras à l'entrée, là où il fait encore un peu jour. Nous emportons le reste.

## 5. La Carcasse (250 m)

- **Décor** : le squelette d'une baleine devenu oasis : vers, crabes, poissons, lumière sur les os.
- **Pas d'obstacle** : c'est le chapitre du souvenir. En explorant la carcasse, tu découvres des fresques naturelles (coquilles, motifs) et les premiers indices sur la fin : d'autres lignées sont passées avant toi.
- **Partenaires** : ver plumeau, crabe (`plumeau`, `crabe`).
- **Moment fort** : une lignée « rivale » est là, avec des choix différents des tiens. Une créature étrange, cousine lointaine.
- **Note** : « le souvenir ».

Ouverture :

> Même finie, elle nourrit. Nous avons compris ce jour-là que rien ne s'arrête vraiment.

## 6. Les Sources (280–340 m)

- **Décor** : cheminées fumantes, eau trouble et chaude, vers tubicoles rouges, crevettes blanches.
- **Obstacle** : un couloir brûlant ; il faut une carapace, ou des cils pour passer par la vase.
- **Partenaires** : ver de feu, crevette-mante, homard (`verDeFeu`, `crevetteMante`, `homard`).
- **Moment fort** : une éruption illumine toute la vallée en orange.
- **Note** : « la braise ».

Ouverture :

> Ici, la chaleur ne vient pas du ciel. Elle monte d'en dessous, comme une promesse.

## 7. Le Glacier (340–400 m) *— nouveau chapitre, tout est proposition*

- **Décor** : juste après la chaleur des Sources, une langue d'eau glacée et salée descend d'une banquise lointaine et plonge vers le fond. Parois de glace bleue, aiguilles de givre qui poussent autour du courant froid, cristaux en suspension, lumière froide et diffuse.
- **Obstacle** : l'eau glacée fige ce qu'elle touche et ralentit tout. Il faut une carapace, qui protège du froid, ou des filaments pour se laisser emporter par le courant froid qui plonge.
- **Partenaires** : ange de mer, krill, et une méduse des eaux froides (`clione`, `krill`, `chrysaora`). L'ange de mer et le krill vivent vraiment dans les eaux polaires.
- **Moment fort** : une aiguille de glace descend lentement le long du courant et fige tout sur son passage ; on la regarde tomber, puis on plonge dans le chemin qu'elle a ouvert.
- **Note** : « le givre ».

Ouverture :

> Le froid est venu d'un monde que nous ne verrions jamais. Il descendait, lui aussi.

## 8. Le Jardin de méduses (400–500 m)

- **Décor** : plus de fond visible, des milliers de méduses qui pulsent et s'éclairent, des siphonophores géants.
- **Obstacle** : le vide, sans fond où s'appuyer, avec de lents courants verticaux. Il faut la pulsation, ou des filaments pour se laisser porter.
- **Partenaires** : méduse lune, cténophore, siphonophore (`meduse`, `ctenophore`, `siphonophore`).
- **Moment fort** : la migration verticale, quand tout le jardin monte en même temps pendant que toi, tu descends.
- **Note** : « la pulsation ».

Ouverture :

> Ceux qui vivent ici n'ont jamais touché le sol. Ils nous ont appris à ne plus en avoir besoin.

## 9. La Fosse (500–650 m)

- **Décor** : noir total, seulement ta propre lumière. Des silhouettes immenses passent. La neige marine tombe.
- **Obstacle** : le noir et le silence. Il faut une lanterne, ou le chant pour faire répondre les créatures lumineuses.
- **Partenaires** : baudroie, dragon abyssal, nautile (`baudroie`, `dragonAbyssal`, `nautile`).
- **Moment fort** : tu joues les notes déjà apprises et, une à une, des lumières répondent dans le noir, celles des ancêtres des autres lignées.
- **Note** : « le silence ».

Ouverture :

> Nous n'avions jamais été aussi loin de la lumière. Nous n'avions jamais autant brillé.

## 10. La Remontée (du fond à la surface)

- **Au fond** : pas de trésor, mais un puits de lumière : la surface, vue de tout en bas, à la verticale.

Le retournement :

> Nous pensions descendre pour arriver quelque part. Nous descendions pour devenir assez forts pour revenir.

- **La remontée** : ta créature finale joue le chant complet. Tous tes ancêtres apparaissent, de la larve à la dernière génération, et remontent avec toi, en formation. Chaque biome traversé en sens inverse s'illumine à ton passage.
- **Dernière image** : ta lignée perce la surface. Tu vois la larve du chapitre 1 naître, et le cycle recommence.

Texte final :

> Nous sommes remontés. Pas un seul d'entre nous n'avait fait tout le chemin. Et pourtant, nous l'avions fait ensemble.

**Générique** : l'arbre complet de ta lignée, génération par génération.

## Dans le monde

La carte du Grand Monde (`src/monde/biomes.ts`) suit la trame : les 10 chapitres se succèdent le long de x, de x = −800 à x = 30 000, et le fond descend de l'un à l'autre. Chaque chapitre a son identifiant (`ChapterId`), son étendue (`span(id)`), sa palette, son relief, ses plantes, sa faune (les partenaires d'abord) et ses grands visiteurs. La jauge de profondeur lit la profondeur du chapitre sur son fond : en pleine eau, plus haut, elle affiche moins.

| # | Chapitre | x | Fond | Décor aujourd'hui | Visiteurs |
| --- | --- | --- | --- | --- | --- |
| 1 | La Nurserie | −800 à 3 400 | 30–40 m | herbiers, sargasses sous la surface, rayons et caustiques | raie manta |
| 2 | Le Récif | 3 400 à 7 000 | 40–90 m | coraux, gorgones, coraux mous, rochers encroûtés | tortue, au-dessus du récif |
| 3 | La Forêt | 7 000 à 10 600 | 90–200 m | kelp géant, épave | requin-baleine, lent, au loin |
| 4 | La Grotte | 10 600 à 13 600 | 200–250 m | *provisoire* : la falaise sous le kelp, un chaos de blocs ocre, éponges, lueurs | — |
| 5 | La Carcasse | 13 600 à 15 800 | 250–280 m | *provisoire* : la baleine couchée sur une plaine de sédiment ivoire | — |
| 6 | Les Sources | 15 800 à 19 000 | 280–340 m | fumeurs noirs, riftias, fumée et bulles | — |
| 7 | Le Glacier | 19 000 à 22 000 | 340–400 m | *provisoire* : fond de glace pâle, blocs de glace bleue, éponges blanches, suintements froids, cristaux qui tombent | calmar géant |
| 8 | Le Jardin de méduses | 22 000 à 25 200 | 400–500 m (pleine eau) | *provisoire* : le fond tombe hors de vue, méduses partout, la vie reste en pleine eau | siphonophore géant |
| 9 | La Fosse | 25 200 à 28 400 | 500–650 m | le noir total sauf sa propre lumière, les lueurs, la neige marine dans la lumière ; décor du fond *provisoire* | dragon abyssal, calmar (géants, en silhouettes) |
| 10 | La Remontée | 28 400 à 30 000 | 650 m et plus | le fond, d'où part la Remontée (le puits de lumière est à faire) | — |

## À écrire

- Les adieux des chapitres 2 à 9 (le plan v1 n'a que celui de la Nurserie ; celui de la Grotte est une proposition).
- Les textes de la Grotte et du Glacier, s'ils ne conviennent pas.
