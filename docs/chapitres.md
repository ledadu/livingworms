# La trame : 10 chapitres

La descente de la surface au fond de la fosse, puis la remontée. Chapitres du [plan v1](plan-v1.md), avec la **Grotte** et le **Glacier** ajoutés ([décisions](decisions.md)). Tout ce qui est marqué *proposition* reste à valider.

Les profondeurs sont indicatives : le monde est une descente continue, pas une carte réaliste.

## Le passage d'un chapitre à l'autre

- La lumière, la couleur de l'eau, le sable et la roche passent d'un chapitre au suivant sur une bande de 1 400 px autour de la frontière (`moodAt`, `BLEND` dans `biomes.ts`).
- Les plantes, les décors et les animaux se mêlent sur la même bande : un animal d'un chapitre peut vivre jusqu'à 700 px au-delà de sa frontière, de moins en moins à mesure que l'autre lumière gagne (`faunaX`, `transitions.ts`).
- Le titre d'ouverture attend que la nouvelle lumière ait gagné à 85 % (environ 500 px après la frontière), et ne revient pas quand on fait l'aller-retour sur une frontière (`ChapterWatch`). Un saut (voyage, nouvelle partie) l'annonce tout de suite.

## Les textes

- Ils s'affichent en lettres fines, lentement, au début de chaque chapitre (ouverture) et au moment de l'adieu.
- Deux à quatre lignes au maximum.
- La voix est celle de la lignée, un « nous », comme si les ancêtres parlaient.
- **Dans le jeu** (`src/monde/textes.ts`, affichage dans `narration.ts`) : les textes sont lus dans ce document même, au build. Sous le titre `## N. Nom` d'un chapitre, la citation (`> …`) qui suit une ligne « Ouverture : », « Adieu … : », « Le retournement : » (l'ouverture de la Remontée) ou « Texte final : » ou « Devant l'obstacle : » (dit la première fois que l'obstacle du chapitre nous retient) devient ce texte ; pour en changer un, il suffit de l'écrire ici. Une phrase par ligne ; une phrase seule et longue se coupe à la virgule la plus proche de son milieu ; quatre lignes au plus. L'ouverture s'écrit la première fois qu'on entre dans le chapitre, ligne après ligne, sous son nom en petites capitales, puis s'efface ; en y revenant, seul le nom passe. Elle attend qu'aucun panneau (Nouveautés, Atelier) ne couvre la mer. L'adieu se dit pendant la scène de l'adieu au parent ([mécaniques](mecaniques.md#ladieu)) ; tant qu'il est à l'écran, une ouverture attend qu'il s'efface et rien d'autre ne se dit.
- « La rencontre : » donne le texte dit la première fois qu'on croise la cousine de la lignée rivale, à la Carcasse (voir le chapitre 5).

## Vue d'ensemble

| # | Chapitre | Profondeur | Obstacle | Traits qui le franchissent | Note |
| --- | --- | --- | --- | --- | --- |
| 1 | La Nurserie | 0–40 m | aucun (apprentissage) | — | l'éclat |
| 2 | Le Récif | 40–90 m | courant de passe | nageoires, pulsation | le battement |
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
- **Partenaires** : poisson-clown, rascasse volante, hippocampe (`poissonClown`, `poissonLion`, `hippocampe`), qui ont des nageoires, et une méduse-boîte (`meduseBoite`), qui vit dans les récifs et apporte la pulsation.
- **Moment fort** : une tortue passe au-dessus, immense, et projette son ombre.
- **Note** : « le battement ».

Ouverture :

> Ici, tout le monde a une maison. Nous n'en avions pas. Alors nous sommes devenus de ceux qui passent.

Devant l'obstacle :

> Le courant de la passe nous renvoyait vers le récif. Il fallait des nageoires pour le remonter, ou battre comme les méduses.

Adieu (proposition) :

> Tu nous as appris à passer sans nous retourner. Pour toi, une seule fois, nous nous sommes retournés.

## 3. La Forêt (90–200 m)

- **Décor** : kelp géant jusqu'à la surface, lumière verte filtrée, épaisseur, silence.
- **Obstacle** : un mur d'algues trop dense ; il faut des pinces, ou un corps fin.
- **Partenaires** : dragon de mer feuillu, seiche, homard (`dragonFeuillu`, `seiche`, `homard`).
- **Moment fort** : se cacher dans le kelp pendant qu'un grand prédateur passe. Il ne touche jamais (zéro danger) : la tension vient de sa taille et de sa lenteur.
- **Note** : « le frôlement ».

Ouverture :

> La forêt ne pousse pas vers le fond. Elle pousse vers ce qu'elle a quitté.

Devant l'obstacle :

> Les algues se serraient en un mur. Il fallait des pinces pour l'ouvrir, ou un corps assez fin pour s'y glisser.

Adieu (proposition) :

> Tu resteras dans la lumière verte. Nous descendons. Comme la forêt, nous pousserons toujours un peu vers toi.

## 4. La Grotte (200–250 m) *— nouveau chapitre, tout est proposition*

- **Décor** : sous la forêt, la falaise s'ouvre sur un réseau de galeries. Voûtes, piliers, stalactites de calcaire, rais de lumière qui tombent par des puits. Plus loin, le noir complet où brillent quelques animaux.
- **Obstacle** : une galerie étroite et noire qui mène plus bas ; il faut un corps fin pour s'y glisser, ou une lanterne pour trouver le passage large.
- **Partenaires** : anguille (corps fin), serpent cilié, et un cténophore égaré, qui apporte la lumière (`anguille`, `serpentCilie`, `ctenophore`).
- **Moment fort** : tout le banc de poissons qui te suivait fait demi-tour à l'entrée ; tu entres seul, et ta propre nage se met à résonner.
- **Note** : « l'écho ».
- **Dans le jeu** (`src/monde/grotte.ts`, dessin dans `grotte-draw.ts`) : une voûte ocre s'ouvre en arche dans la falaise et se referme sur le sol au fond. Des stalactites y pendent, des stalagmites poussent du sol, des piliers se dressent hors du plan de nage, et le jour tombe en rais par des puits. Aux deux tiers de la grotte, la lumière renonce : le noir se referme autour de nous, et seules brillent de petites vies accrochées à la roche. Les bancs de poissons font demi-tour à l'entrée, le kelp ne pousse pas sous la voûte, et rien ne passe à travers la voûte. La grotte suit l'étendue du chapitre `grotte` de la carte (de x = 10 850 à 13 450, les entrées comprises) ; si la carte n'en avait plus, elle se replierait sur la fin de la Forêt.

Ouverture :

> Il y avait sous la forêt un chemin que la lumière ne prenait pas. Nous l'avons pris pour elle.

Devant l'obstacle :

> La galerie s'enfonçait dans un noir sans bord. Il fallait un corps fin pour s'y faufiler, ou une lueur pour voir le passage.

Adieu (proposition) :

> Tu resteras à l'entrée, là où il fait encore un peu jour. Nous emportons le reste.

## 5. La Carcasse (250 m)

- **Décor** : le squelette d'une baleine devenu oasis : vers, crabes, poissons, lumière sur les os.
- **Pas d'obstacle** : c'est le chapitre du souvenir. En explorant la carcasse, tu découvres des fresques naturelles (coquilles, motifs) et les premiers indices sur la fin : d'autres lignées sont passées avant toi.
- **Partenaires** : ver plumeau, crabe (`plumeau`, `crabe`).
- **Moment fort** : une lignée « rivale » est là, avec des choix différents des tiens. Une créature étrange, cousine lointaine.
- **Note** : « le souvenir ».
- **Dans le monde** (`src/monde/carcasse.ts`) : le squelette couché sur le fond, tête à gauche, sur 1 200 px environ. Crâne, deux mâchoires, colonne en quatre tronçons qui suivent le sable, treize paires de côtes (debout, brisées ou tombées), nageoires ; tapis blancs et jaunes de bactéries, duvet rouge des vers mangeurs d'os. Un rai de lumière pâle tombe sur les côtes, les os luisent un peu dans le noir. Crabes, vers plumeaux, ophiures, crevettes, homard, anguilles et un banc de poissons argentés y vivent. Les os sont derrière le plan de nage : on nage devant et entre eux.
- **Les fresques naturelles** : trois, des coquilles posées en motif sur les os plats, listées dans `CARCASSE.fresques` (`id`, `motif`, position) pour servir de traces à l'étape 4 : une **spirale** sur l'omoplate (debout derrière les côtes), des **anneaux** sur le crâne, des **rayons** sur une vertèbre de la queue roulée à l'écart. Des tas de coquilles sont semés autour.
- **La lignée rivale** (`src/monde/rivale.ts`, dans le monde par `rivale-jeu.ts`) : une autre lignée est partie de la même larve que nous, mais a fait d'autres rencontres. Dans chaque chapitre avant la Carcasse, elle a choisi un partenaire (`PARTNERS`) qui franchit l'obstacle avec le trait que notre corps n'a pas : si nous avons des nageoires, elle a battu comme la méduse-boîte ; si nous avons des pinces, elle s'est faite fine comme le dragon feuillu ; à la Nurserie, un partenaire presque au hasard. Elle ne prend jamais le partenaire que notre lignée a eu dans ce chapitre (la sauvegarde le garde depuis l'arbre de la lignée, `ourPartners`), sauf s'il est le seul à franchir l'obstacle. Ses portées sont faites par `brood`, comme les nôtres, et elle a gardé chaque fois l'enfant qui franchit l'obstacle, le plus loin de son parent : une créature étrange, de notre génération, dont le nom commence comme le nôtre.
  - Elle est faite la première fois qu'on entre dans la Carcasse, à partir de la créature de notre lignée qui y est arrivée (celle qui y a donné naissance ou plus bas, sinon celle qu'on joue) et de nos partenaires : c'est la même cousine à chaque visite, sans rien de plus dans la sauvegarde, même quand l'arbre de la lignée renomme notre créature (`cousinSeed` ne lit pas son nom).
  - Seule, elle va et vient le long du squelette. Quand on approche (560 px), une lueur de sa couleur s'allume, jamais l'or des partenaires ; elle se tourne vers nous et vient nager à côté, un peu au-dessus. Elle nous suit autour des os, sans jamais nous toucher, et y retourne quand on s'en éloigne (760 px). Ce n'est pas une partenaire : elle ne danse pas.
  - La première fois qu'on la croise (320 px), le texte de « La rencontre » (ci-dessous) se dit, dès qu'aucun autre texte n'est à l'écran.
  - Pour les tests : `monde.rivale` (`rival` : sa définition et les partenaires qu'elle a choisis ; `cr`, `met`, `make()`).

Ouverture :

> Même finie, elle nourrit. Nous avons compris ce jour-là que rien ne s'arrête vraiment.

La rencontre (la première fois qu'on croise la cousine de la lignée rivale) :

> D'autres étaient partis de la même lumière que nous. Ils avaient fait d'autres rencontres, pris d'autres corps. Nous nous sommes reconnus quand même.

Adieu (proposition) :

> Tu restes près des grands os, là où rien ne se perd. Ce que tu nous as donné, nous l'emportons.

## 6. Les Sources (280–340 m)

- **Décor** : cheminées fumantes, eau trouble et chaude, vers tubicoles rouges, crevettes blanches.
- **Obstacle** : un couloir brûlant ; il faut une carapace, ou des cils pour passer par la vase.
- **Partenaires** : ver de feu, crevette-mante, homard (`verDeFeu`, `crevetteMante`, `homard`), qui ont une carapace, et le serpent cilié (`serpentCilie`), qui apporte les cils : le ver de feu a des soies, pas des cils.
- **Moment fort** : une éruption illumine toute la vallée en orange.
- **Note** : « la braise ».

Ouverture :

> Ici, la chaleur ne vient pas du ciel. Elle monte d'en dessous, comme une promesse.

Devant l'obstacle :

> L'eau brûlait et nous faisait reculer. Il fallait une carapace pour la supporter, ou des cils pour passer par la vase.

Adieu (proposition) :

> Tu restes près des feux du fond. Nous emportons un peu de ta chaleur, pour le froid qui vient.

## 7. Le Glacier (340–400 m) *— nouveau chapitre, tout est proposition*

- **Décor** : juste après la chaleur des Sources, une langue d'eau glacée et salée descend d'une banquise lointaine et plonge vers le fond. Parois de glace bleue, aiguilles de givre qui poussent autour du courant froid, cristaux en suspension, lumière froide et diffuse.
  - Fait (`src/monde/glacier.ts`) : le courant froid, un ruban laiteux qui tombe d'en haut puis coule sur le fond en suivant la pente ; des falaises et des blocs de glace bleue en arrière-plan (crête éclairée, cannelures, fissures, stalactites sous les corniches) ; des touffes d'aiguilles de givre sur les deux rives du courant ; des cristaux qui scintillent autour de soi. Il se place dans l'étendue du chapitre `glacier` de la carte, par-dessus son décor provisoire (blocs, éponges pâles, suintements).
- **Obstacle** : l'eau glacée fige ce qu'elle touche et ralentit tout. Il faut une carapace, qui protège du froid, ou des filaments pour se laisser emporter par le courant froid qui plonge.
- **Partenaires** : ange de mer, krill, et une méduse des eaux froides (`clione`, `krill`, `chrysaora`). L'ange de mer et le krill vivent vraiment dans les eaux polaires.
- **Moment fort** : une aiguille de glace descend lentement le long du courant et fige tout sur son passage ; on la regarde tomber, puis on plonge dans le chemin qu'elle a ouvert.
- **Note** : « le givre ».

Ouverture :

> Le froid est venu d'un monde que nous ne verrions jamais. Il descendait, lui aussi.

Devant l'obstacle :

> Le froid figeait tout ce qu'il touchait. Il fallait une carapace contre lui, ou des filaments pour s'y laisser porter.

Adieu (proposition) :

> Le froid descend encore, et nous avec lui. Toi, tu restes au bord de la glace. Nous n'aurons pas froid : tu viens un peu avec nous.

## 8. Le Jardin de méduses (400–500 m)

- **Décor** : plus de fond visible, des milliers de méduses qui pulsent et s'éclairent, des siphonophores géants.
- **Obstacle** : le vide, sans fond où s'appuyer, avec de lents courants verticaux. Il faut la pulsation, ou des filaments pour se laisser porter.
- **Partenaires** : méduse lune, cténophore, siphonophore (`meduse`, `ctenophore`, `siphonophore`).
- **Moment fort** : la migration verticale, quand tout le jardin monte en même temps pendant que toi, tu descends.
- **Note** : « la pulsation ».

Ouverture :

> Ceux qui vivent ici n'ont jamais touché le sol. Ils nous ont appris à ne plus en avoir besoin.

Devant l'obstacle :

> Plus rien sous nous, rien où s'appuyer. Il fallait battre comme les méduses, ou des filaments pour se laisser porter.

Adieu (proposition) :

> Tu restes parmi les lumières qui ne touchent jamais le sol. Nous, nous nous laissons tomber, sans peur. C'est toi qui nous l'as appris.

## 9. La Fosse (500–650 m)

- **Décor** : noir total, seulement ta propre lumière. Des silhouettes immenses passent. La neige marine tombe.
- **Obstacle** : le noir et le silence. Il faut une lanterne, ou le chant pour faire répondre les créatures lumineuses.
- **Partenaires** : baudroie, dragon abyssal, nautile (`baudroie`, `dragonAbyssal`, `nautile`).
- **Moment fort** : tu joues les notes déjà apprises et, une à une, des lumières répondent dans le noir, celles des ancêtres des autres lignées.
- **Note** : « le silence ».
- **Les lumières qui répondent** (`src/monde/lumieres.ts`, pures et testées ; dans le jeu `lumieres-jeu.ts`, dessin `lumieres-draw.ts`) :
  - Dans la Fosse, chaque note apprise qu'on chante fait répondre une lumière, une à une : après un silence (1,1 s), et jamais moins de 1,8 s après la précédente, même si l'on chante vite. Les notes apprises : une par chapitre de la descente où l'on est entré, jusqu'à la Fosse ; le chant les tiendra lui-même.
  - Chaque lumière est **l'ancêtre d'une autre lignée**, celui qui a appris cette note. Cette lignée part d'une première larve d'une autre couleur que la nôtre. Dans chaque chapitre, elle a choisi un partenaire qui franchit l'obstacle et gardé un enfant qui le franchit, jusqu'au chapitre de la note.
    - Chaque note a sa lignée, la même d'une visite à l'autre tant que notre lignée ne change pas.
    - La note de la Carcasse fait exception : si on l'a croisée, c'est la cousine de la lignée rivale qui répond (voir le chapitre 5).
    - Ces lignées se font en approchant de la Fosse, une naissance par pas de simulation, pour ne jamais faire attendre une image.
  - La lumière répond de loin, au bord de ce qu'on voit : 520 px au plus, moins sur les côtés d'un téléphone tenu droit. Elle vient d'au-dessus ou des côtés, jamais d'en dessous.
    - D'abord trois éclats de sa couleur ; puis elle vient, sans se presser, nager à sa place autour de nous (de 170 à 226 px, en trois rangs), et nous suit dans la Fosse.
    - Son corps se voit par sa propre lumière, teinté de sa couleur, par-dessus le noir.
  - Rechanter une note qui a déjà répondu fait briller sa lumière de nouveau.
  - Chaque lumière arrivée près de nous ajoute à notre lumière : ensemble, elles éclairent autour de nous plus qu'une lanterne.
  - Quand chaque note apprise a eu sa lumière et que toutes sont arrivées, **le chant a franchi le noir** :
    - l'obstacle de la Fosse s'ouvre (le noir ne se referme plus devant sa borne) ;
    - toutes les lumières brillent ensemble, en vague ;
    - la lignée dit « Les lumières qui répondent » (ci-dessous).
    - Le fond reste la fin du monde tant que la Remontée n'est pas là.
  - Pour les tests : on chante avec le chant (son bouton et son cercle de notes) ; sans lui, `monde.lumieres.sing()` chante toutes les notes apprises, une toutes les 0,9 s, et `monde.lumieres.hear('recif')` une seule. `monde.lumieres.answers` et `done` disent où on en est, `onDone(f)` est appelé quand le chant a franchi le noir, et `monde.skip.add('answer')` cache les lumières.

Ouverture :

> Nous n'avions jamais été aussi loin de la lumière. Nous n'avions jamais autant brillé.

Devant l'obstacle :

> Le noir, et rien pour lui répondre. Il nous faudrait une lumière à nous, ou un chant.

Les lumières qui répondent (quand chaque note apprise a eu sa réponse, *proposition*) :

> Nous avons chanté ce que chacun de nous avait appris. Dans le noir, d'autres lignées ont répondu. Le silence n'était pas vide.

Adieu (proposition) :

> Tu as porté la lumière plus bas que personne. Laisse-la-nous. Nous reviendrons te la montrer.

## 10. La Remontée (du fond à la surface)

- **Au fond** : pas de trésor, mais un puits de lumière : la surface, vue de tout en bas, à la verticale.

Le retournement :

> Nous pensions descendre pour arriver quelque part. Nous descendions pour devenir assez forts pour revenir.

- **La remontée** : ta créature finale joue le chant complet. Tous tes ancêtres apparaissent, de la larve à la dernière génération, et remontent avec toi, en formation. Chaque biome traversé en sens inverse s'illumine à ton passage.
- **Dernière image** : ta lignée perce la surface. Tu vois la larve du chapitre 1 naître, et le cycle recommence.

Texte final :

> Nous sommes remontés. Pas un seul d'entre nous n'avait fait tout le chemin. Et pourtant, nous l'avions fait ensemble.

**Générique** : l'arbre complet de ta lignée, génération par génération.

## Les traces de la lignée

Plus bas dans la descente, ce que les générations passées ont laissé ([mécaniques](mecaniques.md#les-ancêtres)). La première fois qu'on s'en approche, la lignée dit l'un de ces textes, sous le nom de l'ancêtre (*propositions*) :

Les œufs non éclos :

> Des œufs, les tiens, que le courant a portés jusqu'ici. Ils n'ont jamais éclos. Nous vivons aussi pour eux.

La mue :

> Ta forme exacte, vide et claire. Tu l'avais quittée pour grandir. Nous aussi, nous laissons derrière nous ce qui nous serre.

La carcasse devenue récif :

> Ton corps est descendu jusqu'ici, et la vie s'y est posée. Toi qui n'avais pas de maison, tu en es une. Rien de nous ne se perd.

## Dans le monde

La carte du Grand Monde (`src/monde/biomes.ts`) suit la trame : les 10 chapitres se succèdent le long de x, de x = −800 à x = 30 000, et le fond descend de l'un à l'autre. Chaque chapitre a son identifiant (`ChapterId`), son étendue (`span(id)`), sa palette, son relief, ses plantes, sa faune (les partenaires d'abord) et ses grands visiteurs. La jauge de profondeur lit la profondeur du chapitre sur son fond : en pleine eau, plus haut, elle affiche moins.

| # | Chapitre | x | Fond | Décor aujourd'hui | Visiteurs |
| --- | --- | --- | --- | --- | --- |
| 1 | La Nurserie | −800 à 3 400 | 30–40 m | herbiers, sargasses sous la surface, rayons et caustiques | raie manta |
| 2 | Le Récif | 3 400 à 7 000 | 40–90 m | coraux, gorgones, coraux mous, rochers encroûtés | tortue, au-dessus du récif |
| 3 | La Forêt | 7 000 à 10 600 | 90–200 m | kelp géant, épave | requin-baleine, lent, au loin |
| 4 | La Grotte | 10 600 à 13 600 | 200–250 m | la falaise s'ouvre en arche : voûte ocre, stalactites, stalagmites, piliers, rais de jour par des puits, puis le noir et les lueurs de la roche ; blocs ocre, éponges | — |
| 5 | La Carcasse | 13 600 à 15 800 | 250–280 m | le squelette d'une baleine couché sur une plaine de sédiment ivoire, un rai de lumière, trois fresques de coquilles (voir le chapitre 5) | — |
| 6 | Les Sources | 15 800 à 19 000 | 280–340 m | fumeurs noirs, riftias, fumée et bulles | — |
| 7 | Le Glacier | 19 000 à 22 000 | 340–400 m | *provisoire* : fond de glace pâle, blocs de glace bleue, éponges blanches, suintements froids, cristaux qui tombent | calmar géant |
| 8 | Le Jardin de méduses | 22 000 à 25 200 | 400–500 m (pleine eau) | sans fond (`abyss`) : des milliers de méduses lointaines qui pulsent, montent et s'éclairent par vagues, siphonophores géants au loin (`jardin.ts`) ; la vie reste en pleine eau | siphonophore géant |
| 9 | La Fosse | 25 200 à 28 400 | 500–650 m | le noir total sauf sa propre lumière, les lueurs, la neige marine dans la lumière ; décor du fond *provisoire* | dragon abyssal, calmar (géants, en silhouettes) |
| 10 | La Remontée | 28 400 à 30 000 | 650 m et plus | le fond, d'où part la Remontée (le puits de lumière est à faire) | — |

### Les bornes du monde

Le monde qu'on joue commence à la surface de la Nurserie (x = −600) et finit au fond de la Fosse (x = 27 600, avant que la lumière de la Remontée n'arrive) : `src/monde/limites.ts`. Chaque chapitre qui a un obstacle barre la descente à sa fin (le Récif, la Forêt, la Grotte, les Sources, le Glacier, le Jardin) ; celui de la Fosse garde le fond, et le franchir ouvrira la Remontée. Près d'une borne, l'eau retient le nageur sur 420 px et un léger courant le repousse : rien ne heurte ni ne blesse. Un obstacle franchi le reste (on peut remonter et redescendre), même pour un enfant qui n'a plus le trait. Qui franchit quoi : voir « Les obstacles-clés » ci-dessous.

Le voyage du panneau de réglages (⚙) sert aux tests : il n'apparaît qu'avec `?dev` dans l'adresse. Voyager (le panneau, `monde.gotoBiome`, `monde.teleport`) compte comme franchis les obstacles d'avant l'arrivée ; au-delà du fond de la Fosse, toute la carte s'ouvre jusqu'au rechargement.

### Les obstacles-clés

Chaque obstacle barre la descente tant que le corps qu'on joue n'a pas l'un des traits de la [vue d'ensemble](#vue-densemble) (`src/monde/obstacles.ts`, dans le jeu `obstacles-jeu.ts`, dessin `obstacles-draw.ts`). Rien ne blesse : l'obstacle retient à sa façon, de plus en plus fort à mesure qu'on s'en approche (sur 700 à 900 px), jusqu'à la borne.

| Chapitre | Obstacle | Il… | Ce qu'on voit | Traits |
| --- | --- | --- | --- | --- |
| Le Récif | le courant de passe | repousse | des traînées d'eau claire qui filent vers le récif | nageoires, pulsation |
| La Forêt | le mur d'algues | ralentit | un rideau de kelp serré, plus sombre que la forêt | pinces, corps fin |
| La Grotte | la galerie noire | cache le chemin | le noir se referme tout à fait devant la galerie | corps fin, lanterne |
| Les Sources | le couloir brûlant | repousse | une eau orangée qui tremble et monte | carapace, cils |
| Le Glacier | l'eau glacée | ralentit (aussi de haut en bas) | une brume blanche et froide | carapace, filaments |
| Le Jardin | le vide | repousse | des fils de courant qui montent sans fin | pulsation, filaments |
| La Fosse | le noir et le silence | cache le chemin | le noir complet | lanterne, chant |

- **Avec le trait**, l'obstacle se sent encore un peu (le courant tire, l'eau épaisse freine) mais on passe ; le noir ne se referme plus.
- **La première fois qu'un obstacle retient** (à mi-chemin de son approche), la lignée dit ce qu'il aurait fallu : la citation « Devant l'obstacle : » du chapitre, dans ce document.
- **La Fosse** garde la fin du monde : même avec une lanterne, on n'y va pas plus loin tant que la Remontée n'existe pas. Le chant n'est pas un trait du corps : il ouvre l'obstacle de la Fosse quand chaque note apprise a eu sa lumière (voir « Les lumières qui répondent », chapitre 9).
- **Les traits du corps** sont lus sur l'arbre de parties (`traitsOf`). En attendant la fonction des traits de l'étape 3, `obstacles-traits.ts` en donne une version approchée, avec les mêmes noms. La larve de départ n'a aucun trait : sans naissance, elle s'arrête au courant du Récif.
- **Pour les tests** : `monde.keys.traits` (les traits du corps joué), `monde.keys.force = ['nageoires']` (jouer comme si on les avait, `null` pour revenir), `monde.becomes(…)`.

## À écrire

- Les adieux des chapitres 2 à 9 sont des propositions (le plan v1 n'avait que celui de la Nurserie) : à relire et à valider.
- Les textes de la Grotte et du Glacier, s'ils ne conviennent pas.
