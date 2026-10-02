# Backlog

Les chantiers de La Lignée, dans l'ordre des étapes de la [feuille de route](roadmap.md). Un chantier par titre `###`, groupé sous un `##`. La ligne `>` sous un titre donne son état ; le tableau de bord des agents la tient à jour (voir `agents/docs/agents.md`, section Backlog). Sans ligne, un chantier est à faire.

Les documents de conception : [vision](vision.md), [chapitres](chapitres.md), [mécaniques](mecaniques.md), [direction artistique et son](direction-artistique.md), [décisions](decisions.md).

## Étape 1 — Décors

## Étape 2 — Structure

## Étape 3 — Hérédité

## Étape 4 — Lignée

### Les parents au-dessus de la portée
> 🟠 fusionné · agent parents-dessus-portee

Prioritaire, petit. Dans l'écran de la portée (le choix entre les 4 enfants, `src/monde/portee-ecran.ts`), montrer **les deux parents en image** au-dessus des enfants : le parent (la créature jouée) et le partenaire, chacun avec son portrait (`snapshot3`, comme les enfants) et son nom, côte à côte, un peu plus petits que les enfants, avec un signe doux qui les relie (un « + », un fil de lumière dorée). On voit ainsi d'un coup d'œil d'où vient ce que chaque enfant a hérité (« de Première : … / de Méduse lune : … »). Garder l'écran lisible sur téléphone (petite hauteur : les parents plus petits, ou en bandeau) ; une capture avant/après dans le rapport.

### Le moteur de danse : des pas chorégraphiés pour tous les corps
> 🔵 en cours · agent moteur-danse

Prioritaire. Pendant l'accouplement, la danse à deux (`src/monde/danse.ts`, « La parade » de `docs/mecaniques.md`) ne fait que déplacer les deux danseurs (se tourner autour, s'enrouler, la spirale, se frôler, le balancement). Garder ces rondes, et ajouter de **vraies danses** : les corps eux-mêmes bougent, se dandinent, font des mouvements spéciaux chorégraphiés, drôles et sympathiques, qui rappellent des danses connues.

- **Un moteur de danse** (dans `src/engine3/`, pur et testé) : des **pas** décrits une fois, sur ce que tout squelette a, et pas sur une espèce : le tronc (se tortiller, onduler, se cambrer, se rouler en boule), la tête (hocher, secouer, tourner), la queue (frétiller, battre la mesure), les membres par rôle et par côté (nageoires, pattes, bras, tentacules, filaments : lever, agiter, faire la vague de l'avant à l'arrière, alterner gauche et droite), le corps entier (rebondir, pivoter, se dandiner d'un côté à l'autre, une pirouette). Un pas se pose par-dessus la nage de la créature (`creature3.ts`), sans casser ses chaînes ; ce qu'un corps n'a pas, il le saute ou le remplace (une méduse sans pattes agite ses filaments, un ver se tortille plus fort).
- **Des chorégraphies** : des suites de pas sur un tempo, avec des temps forts, des gestes en miroir ou en canon entre les deux danseurs (l'un fait, l'autre répond), et une pose finale. Des danses qui rappellent quelque chose, avec humour et douceur : le twist, la vague, le pas de crabe de côté, le moonwalk (à reculons au fond), le tango (l'un fait plonger l'autre), la valse (tourner à deux), un disco (un membre pointé vers le haut puis vers le bas), une danse des canards (battre des nageoires, frétiller de la queue)…
- **Dans la danse à deux** : une ronde ou deux comme aujourd'hui, et une ou deux vraies danses, tirées selon les deux corps (un marcheur danse au fond, deux méduses ondulent ensemble) ; jamais la même suite d'une fois à l'autre. Sur le tempo de la musique du chapitre si possible (son horloge), en ré majeur, avec un petit accent sonore sur les temps forts.
- **Ouvert** : le moteur est fait pour servir ailleurs (les petits jeux des animaux, un animal qui danse quand on chante, les nouveau-nés qui sortent de l'œuf, la Balade libre) ; un `monde.danse.play(animal, 'twist')` pour l'essayer, et dans `?dev` une liste pour jouer chaque danse sur la créature jouée.
- Coût tenu sur téléphone (le moteur ajuste quelques paramètres par image, pas de simulation en plus). Captures ou courtes séquences de chaque danse sur plusieurs corps (poisson, crabe, méduse, ver, poulpe) dans le rapport ; mettre à jour « La parade » dans `docs/mecaniques.md`.

### Les parents dansent au-dessus de la portée
> ⚪ à faire
> ↳ après « Le moteur de danse : des pas chorégraphiés pour tous les corps »

Quand les deux chantiers sont fusionnés (« Les parents au-dessus de la portée » et le moteur de danse) : dans l'écran de la portée, les deux parents ne sont plus de simples portraits figés, ils **dansent** au-dessus des enfants, avec le moteur de danse. Une danse joyeuse, en duo (en miroir ou en canon), qui change à chaque portée selon leurs deux corps, en boucle douce pendant qu'on choisit ; les parents restent petits et ne prennent pas le regard aux enfants. Garder l'écran fluide sur téléphone (deux petites créatures animées, pas plus) et l'animation coupée si l'utilisateur préfère moins de mouvement (`prefers-reduced-motion` : portraits figés comme avant). Une courte séquence ou des captures dans le rapport.

### Grandir jusqu'à la maturité
> ⚪ à faire

Nouveau concept : chaque créature naît ou apparaît **petite** et doit **grandir jusqu'à la maturité** avant de pouvoir faire des enfants. Pour grandir, elle mange (voir les sous-tâches). Aujourd'hui un enfant sort de son œuf à 30 % de sa taille et grandit tout seul en 7 s (`engine3/grow.ts`, « La ponte » de `docs/mecaniques.md`) : la croissance devient une étape de jeu.

- La créature jouée grandit à chaque bouchée, sans à-coup (`grow.ts`), jusqu'à sa taille adulte ; on voit où elle en est sans chiffre (sa taille, et un signe doux quand elle est mûre : une lueur, ses couleurs qui s'affirment).
- Tant qu'elle n'est pas mûre, un partenaire ne danse pas avec elle : il la remarque, mais lui fait comprendre qu'elle est trop jeune (et la lignée le dit une fois) ; la parade et l'accouplement ne s'ouvrent qu'à maturité.
- Le rythme doit rester plaisant : quelques minutes de jeu par génération au plus, jamais une corvée ; la nourriture se trouve facilement là où l'on nage. Le régler pour la première génération (la larve) comme pour les suivantes.
- Les autres créatures (frères et sœurs, ancêtres, animaux de la mer) peuvent naître petites et grandir aussi, sans que ça coûte en performance.
- La sauvegarde garde la taille atteinte. Mettre à jour `docs/mecaniques.md` (une section « Grandir ») et les tests.

### Manger : la nourriture végétale
> ⚪ à faire
> ↳ après « Grandir jusqu'à la maturité »

La première nourriture, végétale : de petites choses à manger sur les algues et les plantes du décor (bourgeons, grains, fruits d'algue, filaments tendres…), qu'on cueille en passant dessus ou en les touchant de la bouche. Une bouchée fait grandir un peu ; ce qui a été mangé repousse lentement. Visible sans être criard, de la couleur de chaque chapitre, et présent dans tous les chapitres où il y a des plantes (dans le Jardin de méduses et la Fosse, voir la sous-tâche suivante). Une petite animation de bouchée (la créature avale, un éclat doux) et un petit son.

### Manger : le plancton et les polypes
> ⚪ à faire
> ↳ après « Manger : la nourriture végétale »

D'autres nourritures, « un peu vivantes » : des nuages de **plancton** qui dérivent dans l'eau (on les traverse pour les gober, comme les poissons qui gobent déjà du plancton), et les **polypes** des coraux qu'on peut picorer (ils se rétractent un moment, comme les timides de la flore). C'est la nourriture des chapitres sans plantes (le Jardin de méduses, la Fosse, où le plancton luit dans le noir). Chaque nourriture peut faire grandir plus ou moins ; à voir si certaines espèces préfèrent l'une ou l'autre selon leur corps (bouche, tentacules, filaments).

### La chasse douce
> ⚪ à faire
> ↳ après « Manger : le plancton et les polypes »

Manger d'autres êtres vivants, en restant un jeu gentil : de tout petits animaux (minuscules crevettes, vers, larves) qui détalent quand on approche. Les attraper demande un peu de vitesse et d'adresse (l'accélération de « La nage : accélération et élan » aide, sans être indispensable) ; on les gobe d'un coup, sans sang ni combat, et il en revient toujours. Ils nourrissent plus que le végétal. Aucun échec : une proie qui s'échappe, on en trouve une autre. C'est aussi un premier pas vers le jeu plus combatif qui suivra (poursuivre, viser, accélérer).

### Le régime selon le corps
> ⚪ à faire
> ↳ après « La chasse douce »

Ce qu'on mange dépend de ce qu'on est devenu : une bouche de chasseur grandit mieux avec des proies, des filaments ou des tentacules avec le plancton, une bouche de brouteur avec le végétal (lu des traits du corps, `src/content/traits.ts`). Toute créature peut tout manger, mais pas avec le même profit : l'hérédité prend du sens, sans jamais bloquer. La lignée le dit à la naissance d'une forme qui change de régime, et les nourritures qui lui conviennent le mieux luisent un peu plus pour elle.

### Le chant qui fait des choses
> ⚪ à faire
> ↳ après « Manger : la nourriture végétale »

Le chant ouvre déjà des passages et fait répondre des animaux ; il peut faire plus, pour donner envie de chanter partout : faire éclore des fleurs, allumer le plancton autour de nous, calmer un grand animal qui passe, réveiller un banc qui se met à danser, faire tomber un fruit d'algue (une bouchée). Chaque note a son effet, simple et joli ; rien n'est obligatoire.

### L'enfant reste près de ses frères
> 🟠 fusionné · agent enfant-reste-pres

Quand on a choisi son enfant et que les œufs éclosent, l'enfant part aujourd'hui à toute vitesse, très loin (la sortie de l'adieu, `src/monde/adieu.ts`, « de plus en plus vite » jusqu'à ~700 px) : on ne voit plus ses frères et sœurs. Il doit seulement s'écarter un peu, sans hâte, pour qu'on les voie encore autour de lui, puis on reprend la main tout de suite et c'est nous qui partons à notre rythme. Les trois autres restent là et vivent leur vie. Garder l'émotion de l'adieu (le texte, le parent qui le regarde) sans l'éloigner de la portée ; mettre à jour « L'adieu » dans `docs/mecaniques.md`.

### Déclencher l'accouplement, puis une danse à deux
> 🟠 fusionné · agent declencher-accouplement

L'approche d'un partenaire reste comme aujourd'hui : on vient près de lui, il nous remarque, on le suit et on prépare la rencontre (la parade, `src/monde/parade.ts`, `parade-jeu.ts`). Mais l'accouplement ne s'enchaîne plus tout seul : c'est nous qui le déclenchons, par un geste à nous (un bouton « S'accoupler » qui apparaît près du partenaire quand on est prêt, ou un geste tactile équivalent, aussi au clavier). Une fois déclenchée, une **danse à deux automatique**, qu'on regarde sans rien faire (quelques secondes) : les deux espèces se tournent autour, se font face, s'enroulent, montent en spirale, se frôlent, avec de petits gestes sympas et doux qui varient d'une fois à l'autre et selon les deux espèces (un marcheur et un nageur ne dansent pas pareil), portée par la lueur de l'accouplement et l'eau de la parade. Puis la ponte des œufs, comme aujourd'hui.

À trancher (proposer, poser la question par le tableau de bord si besoin) : quand le bouton apparaît (dès qu'on est près, ou après un moment à suivre le partenaire), ce que devient la qualité de la parade, qui règle les traits des enfants (la mesurer pendant l'approche, avant le déclenchement), et si on peut toujours partir avant de déclencher. Mettre à jour « La parade » et « La ponte » dans `docs/mecaniques.md`, et les tests (`monde.parade`).

### Revenir à une espèce antérieure de la lignée
> 🟠 fusionné · agent revenir-espece

Une espèce choisie peut déplaire : un déplacement pénible, un aspect qui ne nous va pas. On doit pouvoir revenir à une espèce antérieure dans l'arbre des espèces (`src/monde/arbre-ecran.ts`) et la rejouer, sans que ce soit punitif : c'est un jeu, ça doit rester plaisant. À trancher (proposer, et poser la question par le tableau de bord si besoin) : jusqu'où on peut remonter (les ancêtres de notre lignée, peut-être aussi leurs frères et sœurs), où on reprend (là où on est, dans le chapitre courant), ce qui arrive si cette espèce ne franchit pas l'obstacle du chapitre (on la garde quand même, les indices se réveillent), et comment la lignée et la sauvegarde l'enregistrent (`partie.born`, l'arbre, le générique : un retour à un ancêtre, pas une nouvelle naissance effacée). Un geste simple depuis l'arbre (« Reprendre cette espèce »), avec confirmation, et une petite scène de transition plutôt qu'une coupure.

### chargement 
> 🟠 fusionné · agent chargement

Sur les chargement du jeu j'ai un page blanchya ec quelques éléments html, c'est trd laid. Et va met un bon petit moment sur le tel.
Ajoute une jolie oage de chargemydu jeux aui arrive très vite quitte a quelle soit instantané fixe ouis s'anime avent que le jeu soit lancé.

### deplacement relou
> 🟠 fusionné · agent deplacement-relou

je viens de faire des enfants avec une meduse et l'lenfant choisi est incortolable il a une facons de se deplacer qui ne suis pas bien la souris et fait des deplacement avec acoups. a mon avis ca vien du mode de deplacement croisé qui est tres utile qaut cela n'est pas piloté par le joeur.
il faut que toute les creature puisse etre piloté facilement par le joeur, par cntre ne case pas les systeme de deplacement, il faut surtout que quand c'est un jouer qui pilota ca soir simple a piloté par le joeur.

## Étape 5 — Chant et fin

## Étape 6 — Son et finitions

### La croix de l'arbre des espèces hors de vue
> 🟠 fusionné · agent croix-arbre-especes

Bug : dans l'arbre des espèces déjà rencontrées (`src/monde/arbre-ecran.ts`), la croix « × » qui ferme le panneau défile avec la liste. Une fois qu'on est descendu, on ne peut plus fermer : il faut remonter tout en haut de l'arbre pour la retrouver. La croix doit rester visible et cliquable où qu'on soit dans la liste, sur téléphone comme sur ordinateur (pouce, petite largeur) ; Échap et le clic hors du panneau continuent de fermer.

### La distance des sons
> 🟠 fusionné · agent distance-sons

Le moteur de son tient compte de la distance et de la position de ce qui sonne : un animal, une bulle, une cheminée près du nageur s'entend plus fort et plus net, loin il est plus faible, plus sourd (filtre) et plus réverbéré, à gauche ou à droite selon sa place à l'écran. Les bulles sont trop présentes aujourd'hui : moins fortes de loin, et une durée d'émission qui varie (des trains de bulles plus ou moins longs, des silences entre). Respecter le budget du chantier des coupures (pas un panoramique 3D coûteux par bruit).

### Les coupures du son sur téléphone
> 🟠 fusionné · agent distance-sons
> ↳ après « La distance des sons »

Sur téléphone, quand on chante beaucoup de notes à la suite, le son coupe ; on entend aussi d'autres petites coupures de temps en temps. Optimiser le moteur de son (`son.ts`, `chant-son.ts`, `musique-son.ts`, `bruits-son.ts`) pour qu'il ne décroche plus : mesurer sur un vrai téléphone ce qui coûte (nombre de voix et de nœuds vivants pendant un chant soutenu, réverbération, filtres qui glissent), plafonner les voix du chant et voler les plus anciennes, libérer les nœuds finis, alléger ce qui peut l'être quand l'appareil peine. Le mélange ne doit pas changer à l'oreille. À faire avant les autres chantiers du son, qui en ajoutent.

### Des musiques qui changent
> 🟠 fusionné · agent musiques-qui-changent

L'ambiance de chaque chapitre est un peu répétitive quand on y reste. La faire évoluer dans le temps : des sections qui se succèdent (variations d'accords, de voix, de densité, de registre), des moments plus calmes et plus pleins, des motifs qui ne reviennent pas à l'identique, tout en gardant le caractère de chaque chapitre (tableau de `docs/direction-artistique.md`), le ré majeur et l'accord avec le chant. La partition reste pure et testée (`musique.ts`).

### De vrais sons pour l'ambiance
> 🟠 fusionné · agent vrais-sons-ambiance

Certains bruits sonnent trop électroniques. Garder le son généré là où il est bien, mais ajouter de vrais enregistrements pour l'ambiance (eau, bulles, ressac, glace, cris lointains de baleine…), pris dans une banque de sons libres de droit (Freesound en CC0 ou CC-BY, ou équivalent). Revoir la décision « sans fichier audio » de `docs/decisions.md` et la mettre à jour : poids des fichiers (formats compressés, courts, en boucle), chargement sans bloquer le jeu, mise en cache, joués à travers la distance des sons. Garder pour chaque son sa source, son auteur et sa licence (un fichier de crédits à côté des sons).

### Les crédits des sons
> 🟠 fusionné · agent vrais-sons-ambiance
> ↳ après « De vrais sons pour l'ambiance »

Même pour des sons libres de droit, nommer les personnes qui les ont publiés : une section « Sons » dans les crédits du jeu (le générique, et une page ou un panneau consultable depuis les réglages), avec pour chaque son son titre, son auteur, sa licence et un lien vers la source. Lue depuis le fichier de crédits du chantier des vrais sons ; un test vérifie que chaque fichier audio du jeu y a sa ligne.

## Étape 7 — Nager et jouer avec la mer

Le jeu reste doux, sans échec ni score. Cette partie prépare aussi la suite : l'animal façonné ici sera repris dans un jeu plus combatif, il lui faut une vraie nage et une fiche qui le décrit. Du corps aux aptitudes et aux capacités, pour les deux jeux : [animal.md](animal.md).

### Les aptitudes de l'animal
> ⚪ à faire

Un module pur et testé, `src/content/aptitudes.ts`, qui calcule d'après le corps (le `Spec`) ses **mesures** (taille, masse, poussée, blindage, prise, sens…), ses **huit aptitudes** de 0 à 1 (vitesse, accélération, agilité, endurance, robustesse, force, perception, discrétion) et ses **capacités** (élan, jet, planer, bond, se faufiler, éclair, pincer, piquer, se blinder, fouiller), selon [animal.md](animal.md). Les formules sont simples et réglées sur le bestiaire (l'anguille, le crabe, la méduse, la larve comme repères), avec des compromis venus de la physique : aucun animal n'est le meilleur partout. Un jeune a les aptitudes de sa taille (la maturité). Un test calcule le profil de tout le bestiaire et de croisements au hasard, et vérifie qu'aucun ne domine. Les traits d'aujourd'hui restent lus comme avant (les obstacles n'en dépendent que par eux). Rien ne change dans le jeu ; « La nage » peut ensuite lire vitesse, accélération, agilité et endurance.

### La nage : accélération et élan
> ⚪ à faire
> ↳ après « Les aptitudes de l'animal »

Une meilleure façon de se déplacer pour la créature jouée : une **accélération** (un geste simple : double toucher, ou maintenir ; une touche au clavier) qui donne un élan rapide, puis se recharge seule ; de l'**élan et de l'inertie** (on glisse après l'accélération, les virages se prennent en courbe) sans perdre la facilité de pilotage gagnée avec « deplacement relou » (`src/engine3/pilot.ts`). La force et la durée de l'élan viennent du corps (nageoires, cloche, jet, pattes). Agréable sur téléphone comme à la souris ; le corps garde son allure (un poisson bat plus vite de la queue, une cloche pulse plus fort). Voir [animal.md](animal.md).

### Le profil de l'animal
> ⚪ à faire
> ↳ après « La nage : accélération et élan »

Les aptitudes, sans aucun chiffre : un profil **qualitatif, beau, et du thème du jeu** (choix de l'utilisateur). Proposition dans [animal.md](animal.md#le-profil-de-lanimal) : une « rose des sables vivante » à huit branches, une par aptitude, chacune une chose de la mer qui la dit sans mot (un trait de courant, une bulle, une spirale de nageoire, une vague, une plaque, une pince, une lueur, une ombre), plus longue et plus lumineuse quand l'aptitude est forte, dans les couleurs de la créature, qui ondule au rythme de sa nage et s'ouvre à maturité. Dans l'arbre des espèces, côte à côte dans l'écran de la portée pour comparer les enfants, et sur la fiche exportée. Proposer deux ou trois esquisses (captures) et faire choisir par le tableau de bord avant de finir.

### Les capacités de nage par corps
> ⚪ à faire
> ↳ après « Le profil de l'animal »

Chaque manière de nager a sa capacité, qui donne envie de choisir une espèce pour elle : un **jet** qui fuse loin d'un coup, une **cloche** qui plane et descend lentement, un **marcheur** qui bondit depuis le fond, un **poisson** vif dans les virages, une **anguille** qui se glisse dans les passages étroits. Déclenchées par le même geste que l'accélération, selon le corps. Elles peuvent servir aux obstacles des chapitres (sans en devenir la seule clé), et se voient dans l'écran de la portée (ce qu'un enfant saura faire). Voir [animal.md](animal.md).

### La fiche de l'animal
> ⚪ à faire
> ↳ après « Les capacités de nage par corps »

Ce que le jeu doux façonne, c'est un animal, qui sera repris dans un jeu plus combatif : il lui faut une **fiche** propre, lisible par un autre programme. Son corps (l'espèce et ses pièces, comme aujourd'hui), ses traits, et des **mesures calculées d'après son corps** : vitesse, accélération, agilité, endurance, taille, régime, capacités. Pas de chiffres dans le jeu doux (ou très discrets, dans l'arbre des espèces) ; un format versionné et documenté (`docs/`), exportable (un fichier ou un lien depuis l'arbre de la lignée), testé. Le jeu suivant est en temps réel, seul ou en coopération contre des créatures ; l'animal y continuera d'évoluer (la lignée continue, les symbioses, les mues, les mutations : voir [animal.md](animal.md#évoluer-encore-dans-le-jeu-combatif), la fiche doit pouvoir les porter) et le joueur y choisira ses capacités actives : la fiche porte donc toute la lignée et toutes les capacités possibles. Proposer le format et poser la question par le tableau de bord pour ce que le jeu suivant devra en lire. Voir [animal.md](animal.md).

### Le courant à surfer
> ⚪ à faire

Des courants dans la mer où l'on se laisse porter pour aller vite : visibles (des stries, des bulles, du plancton qui file), avec leur son, qui mènent d'un coin à un autre d'un chapitre ou vers un endroit caché. On y entre, on file, on en sort quand on veut. Un plaisir simple, qui fait aussi sentir la vitesse avant la nouvelle nage.

### Les petits jeux des animaux
> ⚪ à faire

Des animaux qui jouent avec nous, sans enjeu : un poisson qui joue à chat (il nous touche et file, on le rattrape, il recommence), un banc qui nous accepte si l'on nage à son rythme et nous emmène vers un coin caché, un poulpe qui se cache et qu'il faut trouver. Ça prolonge les scènes des animaux (« action des annimaux dans la nature »). Une petite récompense douce à la fin (une bouchée, un trésor, une lueur), jamais d'échec.

### Les trésors de la lignée
> ⚪ à faire

Des choses rares à trouver dans chaque chapitre : une perle, une coquille ancienne, une fleur qui ne s'ouvre que si l'on chante, un fossile dans la Carcasse, un cristal dans le Glacier. Un **carnet** les garde (ouvert depuis les réglages ou l'arbre), avec un mot de la lignée sur chacun ; ceux qu'on n'a pas encore trouvés y sont des silhouettes. Gardé dans la sauvegarde. On collectionne, rien ne presse.

### Les amis qui suivent
> ⚪ à faire

Un petit animal qu'on a nourri, aidé ou avec qui on a joué nous suit un moment, et peut-être d'un chapitre à l'autre : un compagnon de la génération, qui nage autour de nous, chante avec nous, nous montre parfois un trésor ou une nourriture. Il reste dans le monde quand on change de génération, comme les ancêtres.

### Le portrait de la génération
> ⚪ à faire

Un instant photo à tout moment (un bouton discret) : la créature jouée, cadrée joliment dans son décor, avec ses amis autour. Les portraits vont dans l'**album de la lignée**, une page par génération, consultable depuis l'arbre et repris dans le générique (`generique-image.ts`). Téléchargeables comme l'image souvenir.

- Le bouton prend l'image du monde seule, sans l'interface. Elle est cadrée sur la créature jouée (centrée, à une taille lisible, sans être coupée par les bords) et élargie juste assez pour inclure les amis proches.
- Réutiliser ce que fait déjà l'image souvenir (`generique-ecran.ts` : `toBlob` en JPEG, `downloadsBlocked`, `souvenirFileName`) : le portrait se télécharge là où le souvenir se télécharge, et pas ailleurs.
- L'album garde les portraits d'une partie à l'autre, avec la sauvegarde de la lignée. Le nombre de portraits gardés par génération est plafonné, pour que la sauvegarde ne grossisse pas sans limite.
- Le générique reprend au moins un portrait par génération quand il y en a un.

### Le shoot automatique des beaux moments
> ⚪ à faire
> ↳ après « Le portrait de la génération »

En plus du bouton, le jeu prend tout seul, de temps en temps, une photo d'un beau moment. Il le fait sans prévenir, avec seulement un signe très discret (un petit éclat au bord de l'écran). Ces photos vont dans l'album avec les portraits manuels, marquées « prise par la mer ». Le joueur peut les retirer.

Une **note de beauté** est calculée régulièrement (pas à chaque image : quelques fois par seconde suffisent). Elle combine les critères suivants :
- **Événement en cours** (poids fort) : danse ou parade, ponte, éclosion, retrouvailles avec un ami, première entrée dans un nouveau biome, rencontre d'une créature rare ou d'un grand animal.
- **Composition** : la créature jouée est entièrement visible, ni minuscule ni coupée, et aucun obstacle ne la masque.
- **Compagnie** : des amis sont proches et visibles dans le cadre. La note monte avec leur nombre, puis plafonne.
- **Lumière et décor** : la scène n'est pas trop sombre. Le décor est notable (lueurs, bancs, grotte, glacier, surface).
- **Calme du mouvement** : vitesse modérée, pas de fuite ni de virage brusque, pour que l'image ne soit pas illisible.
- **Nouveauté** : la note baisse si une photo semblable existe déjà dans la génération (même biome, même événement, mêmes amis).

Le **tirage est semi-aléatoire**. Au-dessus d'un seuil, la probabilité de déclencher grandit avec la note. Deux photos auto sont séparées d'un délai minimal, et leur nombre est plafonné par génération (3 par défaut). Un événement fort qui dure (une danse) donne au plus une photo, prise près de son sommet.

#### Critères de sortie

- La note de beauté est une fonction pure. Elle reçoit un état décrit (événement, position et taille à l'écran, amis, luminosité, vitesse, photos déjà prises) et rend une note. Elle a des tests unitaires : une danse avec des amis bien cadrée bat une nage seule dans le noir, et un doublon perd sa note.
- Le tirage prend un aléa injecté, donc il est reproductible en test. Les tests vérifient le délai minimal, le plafond par génération et la photo unique par événement long.
- La capture ne provoque pas d'à-coup visible. Elle est faite juste après un rendu (attention au canvas WebGL sans `preserveDrawingBuffer`), et l'encodage se fait hors du chemin chaud.
- Les photos auto et manuelles apparaissent dans l'album, sur la bonne page de génération. Le marquage « prise par la mer » est visible, et le retrait fonctionne.
- La sauvegarde reste bornée en taille : plafond par génération, JPEG compressé, définition réduite pour les vignettes.

#### Risques

- Le coût de la capture et de l'encodage sur les petites machines.
- Une note mal réglée qui déclenche trop souvent ou jamais. Exposer les seuils comme constantes faciles à régler.
- La taille de la sauvegarde si les images sont stockées en pleine définition.

## Autour du jeu

## Livré

Les chantiers publiés, du plus récent au plus ancien.

### Les bruitages
> 🟢 livré · v0.7.0 · agent bruitages

Bulles, courant, cris lointains de baleine ; la résonance de la Grotte, les craquements du Glacier.

### La performance sur téléphone
> 🟢 livré · v0.7.0 · agent performance-telephone

Tenir un rythme fluide sur un téléphone moyen dans tous les chapitres, notamment le Jardin de méduses (des milliers de méduses) et la Fosse (la lumière du nageur). Mesurer avec `?bench` et sur un vrai téléphone.

### La Balade libre
> 🟢 livré · v0.7.0 · agent balade-libre

Après la fin : le monde entier ouvert, l'Atelier disponible, sans histoire.

### arbre des creature
> 🟢 livré · v0.7.0 · agent arbre-creature

il faut animer les creaure dans l'arbre et pourquoi pas des animation pas tres communa par rapport au jeux, peut etre plus rigolote plus amusante.. assez douces.

### action des annimaux dans la nature
> 🟢 livré · v0.7.0 · agent action-annimaux-nature

trouve des type d'animation accrochable anotre moteur de creature, pour leur faire des truc , seule, a 2, a plusieurs, rend les espace plus realiste de vie, pas seulemnt des deplacement d'animaux

### Le chant : une note par chapitre
> 🟢 livré · v0.6.0 · agent chant-note-chapitre

Chaque génération apprend la note de son chapitre ; un bouton en bas ouvre un cercle de notes à tracer du doigt. Certains animaux répondent et ouvrent un passage. Nombre de notes : voir la question 3 des [décisions](decisions.md#questions-ouvertes).

### Les lumières qui répondent dans la Fosse
> 🟢 livré · v0.6.0 · agent lumieres-qui-repondent

On joue les notes apprises et, une à une, des lumières répondent dans le noir : les ancêtres des autres lignées.

### La Remontée
> 🟢 livré · v0.6.0 · agent remontee

Le puits de lumière au fond, le retournement, puis la remontée : la créature finale joue le chant complet, tous les ancêtres apparaissent et remontent en formation, chaque chapitre s'illumine au passage, la lignée perce la surface et une larve naît ([chapitres.md](chapitres.md)).

### Le générique et l'image souvenir
> 🟢 livré · v0.6.0 · agent generique-image-souvenir

L'arbre complet de la lignée en générique, puis en image téléchargeable (sauf dans le lien Artifact).

### lueur de l'accouplement
> 🟢 livré · v0.6.0 · agent lueur-accouplement

Il faut que cela soit moin eblouisant et ajuter plein d'autre effets qui ne sont pas forcement les meme a chaque fois , un peu de random et peut etre aussi en fonction des genes des accouplé?

### Titre du chantier
> 🟢 livré · v0.6.0 · agent titre-chantier

quand les bestiole se retourne mettre de l'aleatoire sur le sens, elle pevent se retouné en passant par le dos ou en passant de face...

### Titre du chantier
> 🟢 livré · v0.6.0 · agent titre-chantier-2

le forcage de changement pour passer dans un mode et vachement intrusif, et pas du tout smooth..
le moment ou on est obligé d'accepter un oeuf!! on pourrait pas diriger le joueur plus.. et meme si il refuse alors il doit encore s'accouple et peut etre luis donner des indice pour qu'il trouve la bonne bestionle avec qui il doit faire l'enfant..

### La musique générée
> 🟢 livré · v0.6.0 · agent musique-generee

Une ambiance par chapitre, générée avec la Web Audio API (nappes, harmoniques), sans fichier audio ([decisions.md](decisions.md#technique)). Le chant et ses timbres.

### deplacement des crevette et autres
> 🟢 livré · v0.6.0 · agent deplacement-crevette

j'ai remarque que les crevettes on un deplacement rigolot et sympa au sol, un peu rapide mais bien cool. par contre dés quelle nage elle reste horizonale, on dois poivoir nager vertical i l y a pade de raison, et pour toutes le especes.

### tentacule/filements des meduses
> 🟢 livré · v0.6.0 · agent tentacule-filements

il manque des filement au meduses, j'ai reparqué que certaine les filement ne sont sue d'un coté, ca doit etre tjs symetrique!

### animation plus organique
> 🟢 livré · v0.6.0 · agent animation-plus-organique

les animation d'accouplement sont un peu trop simple, je veux des truc plus organique
on peut peut etre aller voir sur des aloritme ultra simplifier de mecanique de fluide ou oune truc qui ramene a la nature la physice de la matiere..

### flore
> 🟢 livré · v0.6.0 · agent flore

ajoute encore plus de diversité de flore, anemones, corails, couteau et autre belle extrordinaire creatures

### tests
> 🟢 livré · v0.6.0 · agent tests

des test echoues ?
que doit en faire mettre ajour les test ? corriger l'application? ou autre ?

### experimenter des effet de deformation eau
> 🟢 livré · v0.6.0 · agent experimenter-effet

tester avec shader ou autres systgeme de calcul pour des effet de deformation dans l'eau
des effet de vagues aussi pourquoi pas genre momen de cris/cant d'animaux

### L'arbre de la lignée
> 🟢 livré · v0.5.0 · agent arbre-lignee

Un écran accessible à tout moment : le portrait de chaque ancêtre (`snapshot3`), son nom, le partenaire, le lieu de naissance. On peut nommer chaque génération.

### Les ancêtres restent dans le monde
> 🟢 livré · v0.5.0 · agent ancetres-restent-monde

Chaque parent quitté reste là où on l'a quitté, et y nage quand on revient en arrière.

### Les traces de la lignée
> 🟢 livré · v0.5.0 · agent traces-lignee

Plus bas, des traces des générations passées : une carcasse de parent devenue récif, une mue, des œufs non éclos.

### La lignée rivale de la Carcasse
> 🟢 livré · v0.5.0 · agent lignee-rivale-carcasse

À la Carcasse, une autre lignée, aux choix différents : une créature étrange, cousine lointaine, générée à partir d'autres partenaires.

### Les traits du corps
> 🟢 livré · v0.4.0 · agent traits-corps

Déduire les traits d'une espèce de son arbre de parties (table de [mecaniques.md](mecaniques.md#lhérédité--les-traits)) : une fonction pure, testée, qui dit quels traits a une créature. Seuils à définir pour le corps fin, la carapace, la pulsation.

### Les obstacles-clés
> 🟢 livré · v0.4.0 · agent obstacles-cles

Un obstacle par chapitre, qui barre la descente tant qu'on n'a pas l'un des traits qui le franchissent ([chapitres.md](chapitres.md#vue-densemble)). Aucun dégât (zéro danger) : l'obstacle repousse, ralentit ou cache le chemin. Chaque obstacle a au moins deux traits qui le franchissent.

### Les espèces compatibles et leur lueur
> 🟢 livré · v0.4.0 · agent especes-compatibles-leur

Marquer les partenaires de chaque chapitre ; ils brillent doucement quand on s'approche. S'assurer que chaque chapitre propose les partenaires qui apportent les traits de son obstacle (on ne peut jamais se bloquer).

### La parade
> 🟢 livré · v0.4.0 · agent parade

Environ 20 secondes de nage synchronisée avec le partenaire : le suivre sans le perdre, passer dans son sillage, tourner avec lui. Sans échec possible ; une qualité de 0 à 1 qui passe à la portée ([mecaniques.md](mecaniques.md#la-parade)).

### La portée : 4 enfants, en choisir un
> 🟢 livré · v0.4.0 · agent portee-4-enfants

4 œufs éclosent ; 4 enfants générés par la fusion du parent et du partenaire (`fuse`, `src/content/generate.ts`), environ 60 % du parent et 40 % du partenaire, plus fidèles aux traits voulus quand la parade est réussie. L'écran montre ce que chacun a hérité. On en choisit un, qu'on joue ensuite.

### L'adieu au parent
> 🟢 livré · v0.4.0 · agent adieu-parent

Le moment où l'on quitte le parent : le texte d'adieu, l'enfant qui s'éloigne, le parent qui reste. Il doit toucher ([vision](vision.md#les-trois-piliers)).

### Un monde fini, du début à la fin
> 🟢 livré · v0.3.0 · agent monde-fini-debut

Le monde commence à la surface de la Nurserie et finit au fond de la Fosse ; on ne peut pas aller plus loin qu'un obstacle non franchi (en attendant l'étape 3, un obstacle se franchit librement). Le voyage vers les biomes du panneau de réglages reste pour les tests, caché aux joueurs.

### Les textes narratifs : ouvertures et adieux
> 🟢 livré · v0.3.0 · agent textes-narratifs

L'affichage des textes : lettres fines, apparition lente, deux à quatre lignes, au début de chaque chapitre et au moment de l'adieu ([chapitres.md](chapitres.md#les-textes)). Les textes eux-mêmes viennent de [chapitres.md](chapitres.md) (données, pas dans le code de l'affichage). Remplace le titre de biome actuel (`showChapter`, `src/monde/main.ts`).

### Les transitions entre chapitres
> 🟢 livré · v0.3.0 · agent transitions-entre

Le passage d'un chapitre à l'autre : la lumière, la couleur de l'eau et la faune qui changent progressivement, le texte d'ouverture qui arrive au bon moment.

### La sauvegarde automatique
> 🟢 livré · v0.3.0 · agent sauvegarde-automatique

Sauver la partie à chaque naissance dans le stockage du navigateur : chapitre, créature jouée, et plus tard la lignée entière. Reprendre là où on en était à l'ouverture de la page. Aujourd'hui seule la créature est gardée (`lignee.player`).

### L'Atelier hors de l'histoire
> 🟢 livré · v0.3.0 · agent atelier-hors-histoire

Cacher le bouton de l'Atelier (✎) pendant l'histoire ; le rendre dans la « Balade libre », débloquée après la fin ([décisions](decisions.md)). Garder un moyen de l'ouvrir pour le développement (paramètre d'URL).

### Les nouveautés dans le jeu
> 🟢 livré · v0.3.0 · agent nouveautes-jeu

Montrer dans le jeu ce que racontent les entrées de `changes/` : chaque version publiée, avec ses nouveautés, leurs captures et leur texte. Aujourd'hui elles n'existent que dans `CHANGELOG.md` et le tableau de bord des agents, alors que la version 0.2 est publiée (8 nouveautés). Le cadriciel fournit les données sans rien dessiner : `whatsNew(loadChanges(), { base, includeUnreleased })` (`agents/release/changes.mjs`, types dans `changes.d.mts`, voir `agents/docs/changes.md`, section « Dans le jeu »).

- **Le modèle** : Allèle fait déjà tout ça (`/home/ldadu/Allèle/apps/client`).
  - `whatsNewPlugin.ts` : un plugin Vite qui sert `/whats-new/whats-new.json` et les images de `changes/` en dev, avec la version en préparation, et qui n'écrit au build que les versions publiées.
  - `src/whatsNew/` : `panel.ts`, `layout.ts`, `markdown.ts`, `seen.ts`, `types.ts`, `page.ts`.
  - Reprendre ce qui sert, dans le ton de La Lignée ; `tree.ts` est propre à Allèle.
- **Le panneau** : « Nouveautés », ouvert par un bouton discret à côté de ✎ et ⚙.
  - Il s'ouvre tout seul une fois quand une version publiée est plus récente que la dernière vue (stockage du navigateur).
  - Il se lit sur téléphone d'abord : captures en grand, texte court, et une version à la fois, la plus récente en tête.
- **La contrainte du fichier unique** : la page jouable (`play/lignee-monde.html`, `npm run play`) est un seul fichier, sans serveur, ouvert aussi par `file://` et dans le lien Artifact. Les versions publiées et leurs images doivent y être embarquées sans l'alourdir de plusieurs Mo. Par exemple : la première image de chaque entrée, réduite et en JPEG, ou un autre choix mesuré et justifié dans le rapport.
- **En dev** (`make dev`) : la version en préparation apparaît aussi, marquée comme telle, pour se relire avant de publier.
- **Tests** : la logique pure (quelle version est nouvelle, mise en forme des entrées) dans `src/**/*.test.ts`.
- **Fini quand** :
  - la version 0.2 s'affiche avec ses 8 nouveautés et leurs images, en dev et dans la page jouable reconstruite ;
  - le panneau s'ouvre tout seul une seule fois après une nouvelle version ;
  - le bouton le rouvre à tout moment.

### Les 10 chapitres dans le monde
> 🟢 livré · v0.2.0 · agent 10-chapitres-monde

Refaire la carte du monde (`src/monde/biomes.ts`) pour suivre la trame : la Nurserie, le Récif, la Forêt, la Grotte, la Carcasse, les Sources, le Glacier, le Jardin de méduses, la Fosse, et le fond d'où part la Remontée. Aujourd'hui : 6 biomes dans un autre ordre (la Forêt de kelp avant le Récif, puis le Tombant, le Crépuscule, les Abysses).

- Pour chaque chapitre : son étendue, sa profondeur, sa palette ([direction-artistique.md](direction-artistique.md#une-palette-par-chapitre)), sa faune avec les partenaires de [chapitres.md](chapitres.md), ses plantes et décors.
- Les chapitres dont le décor propre n'existe pas encore (Grotte, Carcasse, Glacier, Jardin, Fosse) reçoivent d'abord un décor provisoire tiré de l'existant ; leur vrai décor est un chantier à part.
- Fini quand on traverse les 10 chapitres dans l'ordre, chacun avec son titre, sa palette et sa faune.

### Reliefs composés : arches, grottes, failles, surplombs, piliers
> 🟢 livré · v0.2.0 · agent reliefs-composes-arches

Donner à chaque chapitre sa forme de terrain au lieu d'un fond qui ondule seulement ([direction-artistique.md](direction-artistique.md#les-décors)). Le moteur de terrain est dans `src/monde/world.ts` et `floorAt` (`src/monde/biomes.ts`).

- Des formes qui passent devant et derrière le plan de nage (une arche qu'on traverse, un pilier qui cache).
- Les collisions du nageur avec ces formes (aujourd'hui : le fond et les rochers ronds, `collide` dans `src/monde/main.ts`).
- Fini quand au moins trois types de relief existent et que deux chapitres en ont un qui les distingue.

### Premier plan sombre et flou
> 🟢 livré · v0.2.0 · agent premier-plan-sombre

Un plan entre la caméra et le nageur, sombre et flou, qui défile plus vite que le reste : algues, roches, coraux en silhouette. Il donne de la profondeur sans gêner la lecture du plan de nage (le laisser clair autour du nageur).

### Le décor de la Carcasse
> 🟢 livré · v0.2.0 · agent decor-carcasse

Le squelette d'une baleine devenu oasis : côtes et vertèbres couchées sur le fond, vers, crabes, poissons, lumière sur les os ([chapitres.md](chapitres.md)). Les « fresques naturelles » (coquilles, motifs) sont posées ici ; elles serviront de traces à l'étape 4.

### Le décor de la Grotte
> 🟢 livré · v0.2.0 · agent decor-grotte

Voûtes, piliers, galeries, rais de lumière par des puits, puis le noir ([chapitres.md](chapitres.md)). Dépend des reliefs composés.

### Le décor du Glacier
> 🟢 livré · v0.2.0 · agent decor-glacier

Parois de glace bleue, aiguilles de givre autour d'une langue d'eau froide qui plonge, cristaux en suspension ([chapitres.md](chapitres.md)).

### Le Jardin de méduses : sans fond, des milliers de méduses
> 🟢 livré · v0.2.0 · agent jardin-meduses-sans

Plus de fond visible ; des milliers de méduses qui pulsent et s'éclairent, des siphonophores géants. Les méduses lointaines sont bon marché (images ou points animés), seules les proches sont des créatures simulées. Le budget par image doit tenir sur téléphone (`?bench`).

### La Fosse : noir total et ta propre lumière
> 🟢 livré · v0.2.0 · agent fosse-noir-total

Le noir complet, sauf la lumière du nageur (et de ce qui brille), de grandes silhouettes qui passent, la neige marine. Aujourd'hui les Abysses assombrissent déjà l'écran ; la Fosse va plus loin : on ne voit que ce que sa lumière éclaire.
