# Backlog

Les chantiers de La Lignée, dans l'ordre des étapes de la [feuille de route](roadmap.md). Un chantier par titre `###`, groupé sous un `##`. La ligne `>` sous un titre donne son état ; le tableau de bord des agents la tient à jour (voir `agents/docs/agents.md`, section Backlog). Sans ligne, un chantier est à faire.

Les documents de conception : [vision](vision.md), [chapitres](chapitres.md), [mécaniques](mecaniques.md), [direction artistique et son](direction-artistique.md), [décisions](decisions.md).

## Étape 1 — Décors

### Les 10 chapitres dans le monde

Refaire la carte du monde (`src/monde/biomes.ts`) pour suivre la trame : la Nurserie, le Récif, la Forêt, la Grotte, la Carcasse, les Sources, le Glacier, le Jardin de méduses, la Fosse, et le fond d'où part la Remontée. Aujourd'hui : 6 biomes dans un autre ordre (la Forêt de kelp avant le Récif, puis le Tombant, le Crépuscule, les Abysses).

- Pour chaque chapitre : son étendue, sa profondeur, sa palette ([direction-artistique.md](direction-artistique.md#une-palette-par-chapitre)), sa faune avec les partenaires de [chapitres.md](chapitres.md), ses plantes et décors.
- Les chapitres dont le décor propre n'existe pas encore (Grotte, Carcasse, Glacier, Jardin, Fosse) reçoivent d'abord un décor provisoire tiré de l'existant ; leur vrai décor est un chantier à part.
- Fini quand on traverse les 10 chapitres dans l'ordre, chacun avec son titre, sa palette et sa faune.

### Reliefs composés : arches, grottes, failles, surplombs, piliers

Donner à chaque chapitre sa forme de terrain au lieu d'un fond qui ondule seulement ([direction-artistique.md](direction-artistique.md#les-décors)). Le moteur de terrain est dans `src/monde/world.ts` et `floorAt` (`src/monde/biomes.ts`).

- Des formes qui passent devant et derrière le plan de nage (une arche qu'on traverse, un pilier qui cache).
- Les collisions du nageur avec ces formes (aujourd'hui : le fond et les rochers ronds, `collide` dans `src/monde/main.ts`).
- Fini quand au moins trois types de relief existent et que deux chapitres en ont un qui les distingue.

### Premier plan sombre et flou

Un plan entre la caméra et le nageur, sombre et flou, qui défile plus vite que le reste : algues, roches, coraux en silhouette. Il donne de la profondeur sans gêner la lecture du plan de nage (le laisser clair autour du nageur).

### Le décor de la Carcasse

Le squelette d'une baleine devenu oasis : côtes et vertèbres couchées sur le fond, vers, crabes, poissons, lumière sur les os ([chapitres.md](chapitres.md)). Les « fresques naturelles » (coquilles, motifs) sont posées ici ; elles serviront de traces à l'étape 4.

### Le décor de la Grotte

Voûtes, piliers, galeries, rais de lumière par des puits, puis le noir ([chapitres.md](chapitres.md)). Dépend des reliefs composés.

### Le décor du Glacier

Parois de glace bleue, aiguilles de givre autour d'une langue d'eau froide qui plonge, cristaux en suspension ([chapitres.md](chapitres.md)).

### Le Jardin de méduses : sans fond, des milliers de méduses

Plus de fond visible ; des milliers de méduses qui pulsent et s'éclairent, des siphonophores géants. Les méduses lointaines sont bon marché (images ou points animés), seules les proches sont des créatures simulées. Le budget par image doit tenir sur téléphone (`?bench`).

### La Fosse : noir total et ta propre lumière

Le noir complet, sauf la lumière du nageur (et de ce qui brille), de grandes silhouettes qui passent, la neige marine. Aujourd'hui les Abysses assombrissent déjà l'écran ; la Fosse va plus loin : on ne voit que ce que sa lumière éclaire.

## Étape 2 — Structure

### Un monde fini, du début à la fin

Le monde commence à la surface de la Nurserie et finit au fond de la Fosse ; on ne peut pas aller plus loin qu'un obstacle non franchi (en attendant l'étape 3, un obstacle se franchit librement). Le voyage vers les biomes du panneau de réglages reste pour les tests, caché aux joueurs.

### Les textes narratifs : ouvertures et adieux

L'affichage des textes : lettres fines, apparition lente, deux à quatre lignes, au début de chaque chapitre et au moment de l'adieu ([chapitres.md](chapitres.md#les-textes)). Les textes eux-mêmes viennent de [chapitres.md](chapitres.md) (données, pas dans le code de l'affichage). Remplace le titre de biome actuel (`showChapter`, `src/monde/main.ts`).

### Les transitions entre chapitres

Le passage d'un chapitre à l'autre : la lumière, la couleur de l'eau et la faune qui changent progressivement, le texte d'ouverture qui arrive au bon moment.

### La sauvegarde automatique

Sauver la partie à chaque naissance dans le stockage du navigateur : chapitre, créature jouée, et plus tard la lignée entière. Reprendre là où on en était à l'ouverture de la page. Aujourd'hui seule la créature est gardée (`lignee.player`).

### L'Atelier hors de l'histoire

Cacher le bouton de l'Atelier (✎) pendant l'histoire ; le rendre dans la « Balade libre », débloquée après la fin ([décisions](decisions.md)). Garder un moyen de l'ouvrir pour le développement (paramètre d'URL).

## Étape 3 — Hérédité

### Les traits du corps

Déduire les traits d'une espèce de son arbre de parties (table de [mecaniques.md](mecaniques.md#lhérédité--les-traits)) : une fonction pure, testée, qui dit quels traits a une créature. Seuils à définir pour le corps fin, la carapace, la pulsation.

### Les obstacles-clés

Un obstacle par chapitre, qui barre la descente tant qu'on n'a pas l'un des traits qui le franchissent ([chapitres.md](chapitres.md#vue-densemble)). Aucun dégât (zéro danger) : l'obstacle repousse, ralentit ou cache le chemin. Chaque obstacle a au moins deux traits qui le franchissent.

### Les espèces compatibles et leur lueur

Marquer les partenaires de chaque chapitre ; ils brillent doucement quand on s'approche. S'assurer que chaque chapitre propose les partenaires qui apportent les traits de son obstacle (on ne peut jamais se bloquer).

### La parade

Environ 20 secondes de nage synchronisée avec le partenaire : le suivre sans le perdre, passer dans son sillage, tourner avec lui. Sans échec possible ; une qualité de 0 à 1 qui passe à la portée ([mecaniques.md](mecaniques.md#la-parade)).

### La portée : 4 enfants, en choisir un

4 œufs éclosent ; 4 enfants générés par la fusion du parent et du partenaire (`fuse`, `src/content/generate.ts`), environ 60 % du parent et 40 % du partenaire, plus fidèles aux traits voulus quand la parade est réussie. L'écran montre ce que chacun a hérité. On en choisit un, qu'on joue ensuite.

### L'adieu au parent

Le moment où l'on quitte le parent : le texte d'adieu, l'enfant qui s'éloigne, le parent qui reste. Il doit toucher ([vision](vision.md#les-trois-piliers)).

## Étape 4 — Lignée

### L'arbre de la lignée

Un écran accessible à tout moment : le portrait de chaque ancêtre (`snapshot3`), son nom, le partenaire, le lieu de naissance. On peut nommer chaque génération.

### Les ancêtres restent dans le monde

Chaque parent quitté reste là où on l'a quitté, et y nage quand on revient en arrière.

### Les traces de la lignée

Plus bas, des traces des générations passées : une carcasse de parent devenue récif, une mue, des œufs non éclos.

### La lignée rivale de la Carcasse

À la Carcasse, une autre lignée, aux choix différents : une créature étrange, cousine lointaine, générée à partir d'autres partenaires.

## Étape 5 — Chant et fin

### Le chant : une note par chapitre

Chaque génération apprend la note de son chapitre ; un bouton en bas ouvre un cercle de notes à tracer du doigt. Certains animaux répondent et ouvrent un passage. Nombre de notes : voir la question 3 des [décisions](decisions.md#questions-ouvertes).

### Les lumières qui répondent dans la Fosse

On joue les notes apprises et, une à une, des lumières répondent dans le noir : les ancêtres des autres lignées.

### La Remontée

Le puits de lumière au fond, le retournement, puis la remontée : la créature finale joue le chant complet, tous les ancêtres apparaissent et remontent en formation, chaque chapitre s'illumine au passage, la lignée perce la surface et une larve naît ([chapitres.md](chapitres.md)).

### Le générique et l'image souvenir

L'arbre complet de la lignée en générique, puis en image téléchargeable (sauf dans le lien Artifact).

## Étape 6 — Son et finitions

### La musique générée

Une ambiance par chapitre, générée avec la Web Audio API (nappes, harmoniques), sans fichier audio ([decisions.md](decisions.md#technique)). Le chant et ses timbres.

### Les bruitages

Bulles, courant, cris lointains de baleine ; la résonance de la Grotte, les craquements du Glacier.

### La performance sur téléphone

Tenir un rythme fluide sur un téléphone moyen dans tous les chapitres, notamment le Jardin de méduses (des milliers de méduses) et la Fosse (la lumière du nageur). Mesurer avec `?bench` et sur un vrai téléphone.

### La Balade libre

Après la fin : le monde entier ouvert, l'Atelier disponible, sans histoire.
