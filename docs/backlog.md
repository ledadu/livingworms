# Backlog

Les chantiers de La Lignée, dans l'ordre des étapes de la [feuille de route](roadmap.md). Un chantier par titre `###`, groupé sous un `##`. La ligne `>` sous un titre donne son état ; le tableau de bord des agents la tient à jour (voir `agents/docs/agents.md`, section Backlog). Sans ligne, un chantier est à faire.

Les documents de conception : [vision](vision.md), [chapitres](chapitres.md), [mécaniques](mecaniques.md), [direction artistique et son](direction-artistique.md), [décisions](decisions.md).

## Étape 1 — Décors

## Étape 2 — Structure

## Étape 3 — Hérédité

## Étape 4 — Lignée

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
> 🔵 en cours · agent chargement

Sur les chargement du jeu j'ai un page blanchya ec quelques éléments html, c'est trd laid. Et va met un bon petit moment sur le tel.
Ajoute une jolie oage de chargemydu jeux aui arrive très vite quitte a quelle soit instantané fixe ouis s'anime avent que le jeu soit lancé.

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
> 🔵 en cours · agent musiques-qui-changent

L'ambiance de chaque chapitre est un peu répétitive quand on y reste. La faire évoluer dans le temps : des sections qui se succèdent (variations d'accords, de voix, de densité, de registre), des moments plus calmes et plus pleins, des motifs qui ne reviennent pas à l'identique, tout en gardant le caractère de chaque chapitre (tableau de `docs/direction-artistique.md`), le ré majeur et l'accord avec le chant. La partition reste pure et testée (`musique.ts`).

### De vrais sons pour l'ambiance
> 🔵 en cours · agent vrais-sons-ambiance

Certains bruits sonnent trop électroniques. Garder le son généré là où il est bien, mais ajouter de vrais enregistrements pour l'ambiance (eau, bulles, ressac, glace, cris lointains de baleine…), pris dans une banque de sons libres de droit (Freesound en CC0 ou CC-BY, ou équivalent). Revoir la décision « sans fichier audio » de `docs/decisions.md` et la mettre à jour : poids des fichiers (formats compressés, courts, en boucle), chargement sans bloquer le jeu, mise en cache, joués à travers la distance des sons. Garder pour chaque son sa source, son auteur et sa licence (un fichier de crédits à côté des sons).

### Les crédits des sons
> 🔵 en cours · agent vrais-sons-ambiance
> ↳ après « De vrais sons pour l'ambiance »

Même pour des sons libres de droit, nommer les personnes qui les ont publiés : une section « Sons » dans les crédits du jeu (le générique, et une page ou un panneau consultable depuis les réglages), avec pour chaque son son titre, son auteur, sa licence et un lien vers la source. Lue depuis le fichier de crédits du chantier des vrais sons ; un test vérifie que chaque fichier audio du jeu y a sa ligne.

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
