# Direction artistique et son

À quoi ressemble et comment sonne La Lignée. Repris du [plan v1](plan-v1.md), avec la Grotte et le Glacier (propositions) et ce qui existe déjà dans le monde.

## Les décors

- **Plusieurs plans de profondeur** : fond lointain flou et bleuté, plan intermédiaire (rochers, arches), plan de jeu, premier plan sombre et flou qui défile vite.
- **Des reliefs composés** : arches, grottes, failles, surplombs, piliers. Chaque chapitre a sa forme de terrain.
- **Une végétation dense** : des centaines d'algues, de coraux et d'éponges. Les lointaines sont simplifiées, et seules les proches sont simulées et réagissent à ton passage.
- **La lumière** : des rayons mobiles, les reflets de la surface sur le fond, la couleur qui change avec la profondeur et la bioluminescence dans le noir.
- **La vie d'ambiance** : des bancs de milliers de petits poissons (des points animés) qui s'écartent, du plancton, de la neige marine, de grandes silhouettes qui passent au loin.

### Ce qui existe déjà

Le Grand Monde (`src/monde/`) a déjà :

- une vraie profondeur en perspective 2.5D, avec des plans à toutes les distances et le brouillard de l'eau (`fogOf`, `waterAt`) ;
- un fond, des rochers, des plantes simulées de près et figées en images au loin, des décors (épave, cheminées) ;
- une flore variée dans chaque chapitre : anémones, coraux, coquillages, vers et éponges des profondeurs, en bosquets, dont certains se rétractent quand on approche et d'autres luisent dans le noir (voir « La flore des chapitres ») ;
- des rayons, des caustiques, la surface vue de dessous, le plancton et la neige marine ;
- des bancs de poissons qui s'écartent du nageur, et de grands visiteurs lointains (tortue, raie manta, requin-baleine, calmar, dragon abyssal) ;
- des animaux qui vivent leur vie autour de nous, seuls, à deux ou en groupe, et pas seulement en se déplaçant (voir [La vie des animaux](#la-vie-des-animaux)) ;
- des animaux qui se retournent en vrai volume, tantôt par le dos (la tête part vers le fond), tantôt de face (elle vient vers nous) : le sens de chaque demi-tour est tiré au sort, pour le nageur comme pour les autres, qu'ils nagent, filent par jets ou marchent (`turnYaw` dans `src/engine3/creature3.ts`) ;
- des animaux qui nagent à la verticale, tête en haut ou en bas, toutes espèces confondues : le ventre, les nageoires et la courbure du corps tournent avec lui jusqu'à la verticale, sans bascule soudaine (`down`, le bas du corps, dans `src/engine3/creature3.ts`). Les marcheurs (crevettes, crabes, homards, vers, étoiles) quittent le fond quand on les fait monter, tête vers où ils vont et pattes qui rament ; lâchés, ils retombent doucement à plat sur leurs pattes ; poussés vers le bas en pleine eau, ils plongent tête la première et se remettent à plat avant de toucher le fond (`crawlRise`, `crawlPitch`). Seules les méduses gardent leur cloche droite, et l'hippocampe sa tête en haut ;
- des méduses dont les filaments, les bras oraux et les pédalies pendent tout autour du bord de la cloche, en cône : vus de côté, ils s'étalent comme l'éventail dessiné dans l'Atelier, et restent symétriques quelle que soit la façon dont la cloche penche ou a nagé (`onRim` et `rimOf` dans `src/engine/defs.ts`, `rimMount` dans `creature3.ts`) ; de loin, quand le niveau de détail en retire une partie, ce sont des paires symétriques qui partent (`thinnedOut`), et les variations d'un éventail centré vont elles aussi par paires ;
- les 10 chapitres dans l'ordre de la trame, chacun avec sa palette (tableau ci-dessous) : voir [chapitres.md](chapitres.md#dans-le-monde) ;
- l'eau qui se déforme : les ondes du chant et des cris, l'eau chaude et froide qui tremble, la surface qui ondule (voir [plus bas](#leau-qui-se-déforme)) ;
- un rendu WebGL2 avec niveaux de détail et budget par image, et le canvas en repli.

Il manque, pour le plan :

- le premier plan sombre et flou ;
- le décor propre à la Fosse (elle a aujourd'hui un décor provisoire tiré de l'existant).

### Le premier plan

Entre l'œil et le plan de nage (`src/monde/foreground.ts`) : des silhouettes sombres et floues, plus proches de l'œil que tout le reste, donc qui défilent plus vite (la perspective s'en charge : environ deux fois la vitesse du plan de nage).

- **Ce qu'on y voit** : ce qui pousse dans le chapitre (kelp, herbes, coraux, gorgones, tubes, tiges), plus des roches, en groupes et en clairières. Moins dense là où le noir se referme.
- **Sombre et flou** : chaque silhouette est cuite une fois, petite et floutée, d'une seule couleur (l'eau autour, très assombrie), puis agrandie ; elle ondule doucement depuis son pied.
- **Le plan de nage reste lisible** : les silhouettes montent du bas de l'écran (ou de leur sol quand il est visible) et s'effacent presque en approchant du nageur.
- **Coût** : quelques images par trame, en WebGL comme en canvas. Couche `front` de `monde.skip` pour la comparer.

### Les reliefs composés

Les formes de terrain qu'une ligne de fond ne sait pas faire (`src/monde/relief.ts`, dessin dans `relief-draw.ts`) :

- **Quatre types** : les **piliers** (colonnes de roche empilée) ; les **arches**, vues de face au loin ou posées en travers du plan de nage (un pied devant, un pied derrière, la voûte au-dessus du nageur) ; les **surplombs**, une corniche au-dessus d'un creux où s'abriter ; les **failles**, des tranchées creusées dans le fond lui-même, de l'avant jusqu'au loin, où l'on peut plonger.
- **Devant, en travers et derrière le plan de nage** : chaque relief est un volume en vraie perspective (des facettes éclairées d'en haut, un contour d'encre, le brouillard de l'eau), trié tranche par tranche avec le reste de la scène. On passe derrière le pied avant d'une arche, sous sa voûte, devant son pied arrière ; un pilier du premier rang cache le nageur un instant. Ce qui vient trop près de l'œil s'efface.
- **Solides** : le nageur et les animaux butent sur la coupe du relief à leur profondeur, et glissent le long. Les failles sont dans le fond (`floorAt`), donc déjà solides. Le plan de nage n'est jamais fermé : on passe dessus ou dessous.
- **La vie dessus** : une plante dont le pied tombe dans un relief pousse sur son sommet, un rocher n'y est pas posé. Là où le chapitre est couvert de vie (`encrust`), des plaques de polypes couvrent le haut des reliefs : les arches du Récif.
- **Par chapitre** (`PLANS`, par id de chapitre) : la Nurserie reste ouverte (quelques arches au loin) ; le Récif a ses arches à traverser ; la Forêt ses piliers, comme une cathédrale ; la Carcasse repose dans un creux de surplombs ; les Sources ont des colonnes de basalte au loin ; le Glacier des corniches de glace entre ses falaises ; la Fosse ses failles, qu'on ne voit que dans sa propre lumière. La Grotte a sa propre voûte (`grotte.ts`), le Jardin n'a pas de fond.
- **Coût** : une fraction de milliseconde par image en WebGL, quelques millisecondes en canvas (le repli). Couche `relief` de `monde.skip` pour comparer.

### Le Jardin de méduses

Réalisé dans `src/monde/jardin.ts` (chapitre `jardin` de `biomes.ts`, entre le Glacier et la Fosse) :

- **Sans fond** : le champ `abyss` d'un biome fait tomber le fond hors de vue (`floorAt`) ; les animaux de pleine eau gardent leur profondeur d'avant (`openFloor`, relevée de `lift`), comme l'arrivée (`arrival`).
- **Des milliers de méduses lointaines**, bon marché : une image par méduse, tirée d'un petit atlas (trois teintes, quatre temps de pulsation, un point lumineux pour les plus petites), en neuf plans de profondeur entre lesquels passent les animaux simulés. Le champ se répète autour de la caméra : il n'a de bord ni en haut, ni en bas, ni sur les côtés. Sa densité suit le champ `jellies` des biomes et s'éclaircit aux frontières.
- **Elles pulsent et montent** : chaque battement les soulève un peu, et le jardin entier monte lentement.
- **Elles s'éclairent par vagues** : toutes les quelques secondes, une onde de lumière part d'un point et traverse le jardin.
- **Des siphonophores géants** : de longues chaînes lumineuses au loin, avec leurs cloches nageuses en tête et une lumière qui court le long du corps.
- **Les proches** sont les créatures simulées de la faune du biome (méduse lune, cténophore, siphonophore, chrysaora, cuboméduse, hydre, clione) et un siphonophore géant simulé qui passe au loin (visiteur du chapitre).

### La flore des chapitres

Au-delà des plantes de chaque biome (kelp, posidonies, coraux, gorgones, éponges…), une vie fixée au fond s'ajoute en bosquets (`src/monde/flore.ts`, posée après les plantes de `world.ts`, qui poussent donc toujours au même endroit) :

| Chapitre | Ce qu'on y croise |
| --- | --- |
| La Nurserie | champs de couteaux plantés dans le sable, raisins de mer, padines en éventail, méduses à l'envers posées sur le sable, cérianthes, anémones à bulles |
| Le Récif | coraux cerveaux et coraux étoilés, acropores tables, coraux corne de cerf, bénitiers au manteau bleu, anémones à bulles, vers arbres de Noël, ascidies, cérianthes |
| La Forêt | anémones plumeuses blanches, ascidies, étoiles-paniers, cérianthes, couteaux |
| La Grotte | ascidies, anémones plumeuses, vers arbres de Noël, coraux bambous |
| La Carcasse | cérianthes, anémones plumeuses, étoiles-paniers, corbeilles de Vénus, coraux bambous, éponges ping-pong |
| Les Sources | coraux bambous, anémones plumeuses pâles |
| Le Glacier | anémones plumeuses pâles, corbeilles de Vénus, étoiles-paniers, éponges harpes, coraux bambous |
| La Fosse | éponges harpes, éponges ping-pong, corbeilles de Vénus, coraux bambous |
| La Remontée | éponges harpes, éponges ping-pong, coraux bambous |

- **Chaque espèce est un arbre de fouets** comme les plantes (`FLORE`, une définition par espèce, tirée d'une graine) : elle repousse toujours la même. Les formes larges (acropore, bénitier, harpe…) se tournent presque vers l'œil pour ne pas être vues par la tranche (`face`) ; le corail cerveau pousse de son sommet vers le sol, pour que son dôme pose à plat (`top`).
- **Les timides** (couteaux, cérianthes, vers arbres de Noël) se rétractent d'un coup quand le nageur passe à moins de 60 unités, et ressortent lentement après 2,5 s de calme : le couteau s'enfonce dans le sable, la cérianthe rentre ses tentacules dans son tube, le ver replie ses deux panaches (`shy`, `shyStep`). Seuls ceux du plan de nage (simulés) le font.
- **Les lueurs** : les perles de l'éponge harpe, les sphères de l'éponge ping-pong et les polypes du corail bambou luisent, à peine en eau claire, nettement dans le noir, chacun respirant à son rythme (`floreLights`, avec les lumières du monde). On ne les trouve que dans les chapitres sombres.
- **Coût** : la plupart sont figées en images (`rigid`), seules les timides et la méduse à l'envers (qui bat) sont simulées dans le plan de nage. Quelques dixièmes de milliseconde par image en plus sur un ordinateur.

### La vie des animaux

Autour du nageur, de temps en temps, un animal libre commence une petite scène, seul ou avec ceux qui sont près de lui (`src/monde/vie.ts` pour les scènes, `vie-jeu.ts` pour leur place dans le monde, `vie-draw.ts` pour ce qu'elles laissent dans l'eau). Les autres continuent d'errer comme avant : environ la moitié des animaux proches font quelque chose à un moment donné.

- **Seul** : il **fouille** le sable, museau dedans, picore, avance de quelques pixels et recommence ; chaque coup de museau soulève un petit nuage de limon. Il **se repose**, presque immobile au-dessus du fond, tourné un peu vers nous : son corps bat plus lentement et ses couleurs pâlissent. Il vient **nous regarder**, s'arrête à quelques longueurs, se tourne vers nous et nous suit un peu tant qu'on nage doucement (un chasseur reste plus loin) ; deux à la fois au plus. Il **gobe** du plancton : des grains apparaissent juste devant lui, il fonce dessus et ils disparaissent.
- **À deux** (de la même espèce) : ils **tournent l'un autour de l'autre** en profondeur, parés de couleurs plus vives ; ils **jouent à se poursuivre**, l'un file ici et là, l'autre le suit de près sans jamais le toucher, puis ils échangent les rôles ; ils **vont côte à côte**, l'un à côté de l'autre en profondeur, au même rythme ; ils **se saluent**, face à face, nez à nez, un petit coup de museau ou deux, puis repartent chacun de son côté.
- **La station de nettoyage** (deux espèces) : un poisson assez grand descend au-dessus d'une crevette, s'immobilise, pâlit et se tourne vers nous ; la crevette nage jusqu'à lui et picore sous sa tête et le long de son ventre, puis redescend.
- **En groupe** (de trois à six de la même espèce) : une **petite troupe** suit son meneur, en chevron décalé en profondeur (les méduses en rond autour de la leur) ; les marcheurs avancent **en file indienne** sur le fond, chacun juste derrière celui qui le précède, comme les langoustes, et le meneur soulève un peu de poussière.
- **Le festin** : toutes les 40 à 70 secondes (la première fois peu après l'arrivée), un nuage de nourriture tombe un peu devant le nageur ; jusqu'à six animaux proches, de toutes espèces, viennent : les nageurs happent les flocons pendant leur chute, les marcheurs attendent qu'ils se posent, et chaque bouchée sur le fond soulève du sable. Le festin finit quand tout est mangé.
- **Le corps suit** : une scène ne fait pas que déplacer l'animal. Elle lui donne un cap à prendre quand il bouge à peine (se tourner vers nous, face à l'autre), un plan en profondeur (tourner l'un autour de l'autre, aller côte à côte), le tempo de son corps (chaque animal a son propre décalage sur l'horloge de la mer : plus lent au repos, plus vif au jeu), ses couleurs (repeintes en trois temps, plus vives ou plus pâles, et qui reviennent de même), et un marcheur peut nager un moment (la crevette du nettoyage). Un nageur garde le rythme de son espèce (par saccades, par pulsations).
- **Le nageur** : personne ne nage à travers lui, et les jeux sur place se tiennent à l'écart. **S'il fonce** sur une scène, ses animaux s'égaillent et la scène finit ; s'il approche doucement, il peut regarder de tout près. **Quand il chante**, toutes les scènes s'arrêtent et aucune ne commence pendant dix secondes : la mer écoute, et les animaux qui répondent viennent vers lui.
- **Ce qui n'y entre pas** : le nageur et ses sœurs, les ancêtres (laissés au monde ou qui remontent), la cousine de la Carcasse, les lumières de la Fosse, les animaux de la surface ; un partenaire que la parade emmène quitte sa scène. Pendant une parade, un adieu ou la Remontée, personne ne vient regarder le nageur et rien ne tombe.
- **Coût** : rien de mesurable (60 images par seconde avec ou sans, simulation à 2,3–2,6 ms dans les deux cas au Récif). Pour comparer : `monde.vie.on = false` ; pour les tests, `monde.vie.acts` (les scènes en cours), `monde.vie.seen` (combien de chaque depuis l'ouverture), `monde.vie.start(id, animaux)`, `monde.vie.feast(monde.actors)`, `monde.vie.hush()`, et la couche `vie` de `monde.skip`.

## Une palette par chapitre

| Chapitre | Palette |
| --- | --- |
| La Nurserie | turquoise et or |
| Le Récif | corail et bleu |
| La Forêt | vert et ambre |
| La Grotte | ocre et bleu d'encre, rais de jour dans le noir *(proposition)* |
| La Carcasse | ivoire et bleu nuit |
| Les Sources | orange et brun |
| Le Glacier | bleu glacier et blanc nacré *(proposition)* |
| Le Jardin de méduses | violet et rose |
| La Fosse | noir et bleu électrique |
| La Remontée | tout s'éclaire |

## La Fosse : le noir total

Les chapitres profonds (Sources, Remontée) assombrissent l'écran sans jamais le noircir, la Grotte a son propre noir au fond des galeries (`caveDark`, `grotte.ts`) ; la Fosse (`src/monde/fosse.ts`, `dark: 1`, le seul chapitre au-delà de 0.88) ferme tout : on ne voit que ce que sa propre lumière éclaire.

- **Sa lumière** : un cercle clair autour du nageur, dont la taille vient de ce qu'il porte de lumineux (les lueurs de ses parties, une lanterne comptant triple). Sans rien qui brille, on se voit à peine ; avec une lanterne ou un corps de cténophore, le fond apparaît autour de soi.
- **Ce qui brille** reste visible au loin, par-dessus le noir : animaux lumineux, poissons-lanternes.
- **La neige marine** ne se voit que dans la lumière, blanche, plus forte près du nageur.
- **Les grandes silhouettes** (un dragon abyssal ×7 et un calmar géant ×9, les visiteurs du chapitre) passent au loin : des corps noirs devant une faible lueur bleu électrique, avec leurs propres photophores.
- **Les lumières qui répondent au chant** (`lumieres-jeu.ts`) : chacune a la couleur de sa lignée, jamais l'or des partenaires. Elle répond par trois éclats au loin, au bord de l'écran, puis vient nager autour de nous. Son corps, teinté de sa couleur, est dessiné par-dessus le noir, comme s'il s'éclairait lui-même.
- Le passage du Jardin de méduses à la Fosse, puis de la Fosse à la Remontée, se fait en fondu sur les frontières.

## La Remontée : tout s'éclaire

Réalisé dans `src/monde/remontee.ts` (dessin `remontee-draw.ts`, voir [chapitres.md](chapitres.md#10-la-remontée-du-fond-à-la-surface)) :

- **Le puits de lumière** : une colonne dorée un peu derrière le plan de nage, du haut de l'écran jusqu'au sable, plus vive au milieu, qui s'élargit en bas et frémit lentement ; une flaque de lumière sur le sable, des grains de lumière qui montent. Autour de lui, l'eau s'éclaircit et le noir s'ouvre.
- **Un chapitre illuminé** (`litMood`) : son eau plus claire et un peu plus dans sa couleur (le bleu électrique de la Fosse, le violet du Jardin, l'orange des Sources), le noir levé, une grande lueur dorée qui tombe d'en haut et des rais dorés, obliques, tout autour de la lignée. Le décor lointain reste dans la couleur de l'eau d'avant : il se découpe, un peu plus sombre, sur l'eau claire.
- **Le chant** : des anneaux de points de lumière qui s'ouvrent autour du nageur, de la couleur de chaque note ; un éclat doré à l'arrivée de chaque ancêtre, puis un halo doré qui respire autour de lui.
- **La surface** : un éclat blanc et doré couvre l'écran puis s'efface (une couche CSS, `#remonteeFlash`) ; un œuf de lumière bat parmi la lignée et éclot.
- **Coût** : quelques formes ajoutées par image (la colonne, une dizaine de rais), et des lumières ; la lignée compte une dizaine de créatures en plus, dessinées comme les autres.

## L'eau qui se déforme

Réalisé dans `src/monde/ondes.ts` (les formes), `ondes-gl.ts` (la lentille) et `ondes-jeu.ts` (le jeu) : l'eau plie la lumière de ce qui est derrière elle.

- **Les ondes du chant** : chaque note chantée part du nageur en un anneau qui s'élargit avec l'anneau de lumière de la note, un peu plus loin que lui ; le décor ondule à son passage, plus clair là où l'onde rassemble la lumière, plus sombre là où elle l'étale, et ses crêtes prennent la couleur de la note. Les animaux qui répondent ont leur propre anneau, à leur taille ; une note apprise en fait un plus large et plus lent ; le chant complet de la Remontée, un par note.
- **Les cris au loin** : de temps en temps (30 à 75 s), un grand visiteur qu'on voit (raie manta, tortue, requin-baleine, calmar, siphonophore, dragon abyssal) crie : deux longues ondes lentes partent de lui et traversent la scène, et on l'entend crier au loin avec elles (voir « Les bruits » plus bas).
- **Les lumières de la Fosse** : chaque éclat d'une lumière qui répond, ses échos et le moment où toutes brillent ensemble font une onde de sa couleur ; dans le noir, on ne voit que ses crêtes, des anneaux de lumière.
- **L'eau chaude et l'eau froide** : au-dessus des cheminées des Sources, une colonne d'eau chaude tremble et monte en s'élargissant ; le couloir brûlant tremble de bas en haut, plus fort près de son passage ; l'eau glacée du Glacier ondule lentement en descendant ; le courant de la passe du Récif file vers l'arrière. Par bouffées, avec de fines stries de lumière là où l'eau resserre l'image.
- **La surface** vue d'en dessous ondule sous ses vagues.
- **Ce qui ne bouge pas** : le nageur et ce qui nage près de lui restent nets (seul ce qui est derrière le plan de nage se déforme), comme le premier plan, les textes et les boutons. Si l'appareil demande moins d'animations (`prefers-reduced-motion`), l'eau qui tremble en permanence reste calme ; les ondes du chant restent.

La lentille, en deux passes d'un même shader WebGL2, sur les seules régions de l'écran où l'eau se plie :

- **Plier** : au milieu de l'image, une fois peint ce qui est derrière le plan de nage, ces régions sont recopiées dans une texture (un blit, qui garde l'antialiasing de l'écran) puis redessinées, chaque pixel déplacé.
- **Briller** : à la fin de l'image, la lumière des crêtes des anneaux s'ajoute par-dessus tout, le noir de la Fosse compris.
- **Rien à plier, rien à faire** : sans onde ni eau qui tremble à l'écran, l'image coûte ce qu'elle coûtait. En canvas 2D (le repli), l'eau reste immobile.
- **Coût** (Intel Iris Xe, 1280 × 800, temps GPU de l'image entière) : environ 1 ms pour la surface ou deux anneaux, 1,7 ms au-dessus des cheminées, 2,3 ms dans le couloir brûlant, dont une moitié pour la copie. Quand les images prennent du retard, l'eau qui tremble en permanence (surface, cheminées, obstacles) s'arrête la première, avant le détail des animaux, et revient 30 s plus tard (puis deux fois plus tard à chaque nouvel arrêt) ; les anneaux restent.
- **Pour comparer** : couche `ondes` de `monde.skip` ; `?ondes=0` coupe tout. Avec `?dev`, le panneau ⚙ a une section « Eau » : une onde, un cri au loin, le champ de vagues, l'eau qui ondule.

**Le champ de vagues** (une expérience, `?ondes=champ`, `ondes-champ.ts`) : l'équation des ondes sur une grille posée sur le plan de nage autour du nageur, ancrée dans le monde. Les animaux qui nagent dans le plan y laissent un sillage, le chant y lâche une onde ; les vagues se croisent, s'additionnent, rebondissent sur le fond et la surface, s'éteignent. Plus vivant que les anneaux, mais il plie tout l'écran dès qu'on nage (un peu moins de 1 ms de calcul par image, et la lentille sur tout l'écran) et ses ondes ne suivent pas l'anneau de lumière des notes.

## L'écran de chargement

Le jeu tient en une page d'un mégaoctet et plus, longue à arriver et à démarrer sur un téléphone. Pour qu'on ne voie jamais une page blanche :

- **Tout de suite** : un écran dessiné par la page elle-même, en HTML et CSS, sans attendre aucun script (`index.html`, `#chargement`). La mer bleu profond, trois rayons de lumière, quelques grains de neige marine qui remontent, la larve, « La Lignée » et « Nous nous éveillons… ».
- **Il s'anime** pendant que le jeu se charge : la larve ondule, les rayons oscillent, les grains montent, la phrase respire. Rien que des transformations et des fondus, que le navigateur anime même quand le script du jeu l'occupe ; immobile si le système demande moins d'animations.
- **Il s'efface** en fondu, en avançant un peu vers nous, une fois que le monde a dessiné ses trois premières images (`src/monde/chargement.ts`).
- **À la publication**, les scripts de la page (le jeu, les Nouveautés) passent à la fin (`src/monde/chargement-page.ts`) : l'écran s'affiche avec les premiers kilo-octets. Les polices ne retiennent plus le premier affichage (sans réseau, elles le bloquaient).
- **Mesure** (Chrome, téléphone simulé : réseau 4 Mbit/s, processeur 4 fois plus lent) : le premier affichage passe de 2,9 s (une page blanche, puis un bleu vide jusqu'à 9 s) à 0,7 s ; le jeu démarre au même moment qu'avant.

## Le son

Tout est généré dans le code, sans fichier audio (Web Audio API, voir [decisions.md](decisions.md#technique)).

- **Un seul son pour la page** (`src/monde/son.ts`) : un contexte audio, éveillé par le premier toucher ou la première touche (le navigateur ne laisse sonner une page qu'après : avant, tout est muet), endormi quand la page est cachée. La musique, le chant et les bruits ont chacun leur bus et leur volume, et partagent une réverbération faite dans le code : une réponse de 2,4 s, quelques échos proches puis un bruit qui s'éteint en s'assombrissant. Elle est en mono (une convolution coûte moitié moins que deux), le son sec garde ses côtés. Un compresseur doux en sortie.
- **Une ambiance musicale par chapitre** : nappes et harmoniques qui changent avec la profondeur. La partition est dans `src/monde/musique.ts` (pure et testée), `musique-son.ts` la joue.
  - **Quatre voix par chapitre** :
    - un **bourdon** grave qui respire ;
    - des **nappes** : des accords qui enflent et s'effacent l'un sous l'autre, chaque note doublée de deux voix un peu désaccordées, sous un filtre qui balaie lentement ;
    - les **harmoniques** de sa fondamentale, qui vont et viennent, une moitié à gauche, l'autre à droite ;
    - quelques **notes** çà et là, en courtes phrases.
  - **Tout est en ré majeur**, la tonalité du chant, et les notes éparses restent sur sa gamme pentatonique : ce qu'on chante tombe toujours juste sur la musique.
  - **Les chapitres se mêlent aux frontières** comme la lumière (`presence`, la même bande de 1 400 px), à puissance égale : la musique ne creuse ni ne gonfle au passage. Un chapitre quitté se tait, puis ses voix sont libérées 6 s plus tard.
  - **L'eau étouffe la musique** à mesure qu'on descend : un filtre dont la coupure suit la profondeur, de 16 kHz à la surface à 5,5 kHz au fond de la Fosse.
  - **Dans la Remontée**, chaque chapitre éclairé par la lignée qui remonte (`remontee.litAt`) s'éclaire aussi en musique : l'ambiance de la Remontée monte par-dessus la sienne, qui s'efface à moitié, et l'eau cesse d'étouffer le son.
  - **Les moments** : pendant l'adieu, la musique baisse et ne garde que ses accords, pour laisser les mots ; pendant une parade, ses notes viennent deux fois plus souvent.

| Chapitre | Ambiance | Bourdon et nappes | Notes çà et là |
| --- | --- | --- | --- |
| La Nurserie | la lumière : haut, ouvert | ré et la ; accords clairs (ré, sol, si mineur, la), voix douces | des cloches de lumière, tout en haut |
| Le Récif | la ville de corail : plus chaud, plus coloré | sol ; accords de sol, la, fa dièse mineur, si mineur | de petites figures pincées sur l'accord, qui battent comme des nageoires |
| La Forêt | la cathédrale d'algues : un orgue lent, en mi dorien | mi grave, voix creuses ; la lumière respire dans le filtre | des maillets de bois, rares |
| La Grotte | les galeries : sombre, clairsemé, la réverbération la plus forte | si très grave ; accords minces et lents | des gouttes qui reviennent des parois en écho |
| La Carcasse | le souvenir : tendre, deux voix proches | sol ; accords de sol, ré, mi mineur, la | les quatre premières notes du chant, une octave plus bas |
| Les Sources | la chaleur : un bourdon brûlant | ré ; accords sur une pédale de ré, voix désaccordées comme l'eau chaude qui frémit | des braises de notes graves |
| Le Glacier | le froid : quartes et quintes, minces et immobiles | si très grave ; voix de verre (des octaves) | des cristaux qui tintent, tout en haut |
| Le Jardin de méduses | flotter : accords amples | la ; le bourdon pulse comme le jardin (toutes les 3 s) | des souffles lents |
| La Fosse | le noir et le silence : presque rien | ré grave ; un accord de loin en loin | une note bleue, lointaine, en écho |
| La Remontée | tout s'éclaire | ré, la, ré ; accords qui montent (ré, la, si mineur, sol) | le chant qui remonte, note après note |

- **Le chant** : chaque note a son timbre ; joué en entier, il forme une mélodie.
  - Dans le jeu (`src/monde/chant-son.ts`) : des oscillateurs et leurs harmoniques, sur la réverbération de la page. L'éclat est une cloche claire, le battement bat comme des nageoires, le frôlement souffle, l'écho revient des parois, le souvenir est chaud et doublé, la braise grésille, le givre scintille comme du verre, la pulsation enfle et ondule, le silence est un souffle grave. Les notes descendent avec les chapitres (la gamme pentatonique de ré), et les animaux qui répondent reprennent la note une octave plus haut.
  - Les neuf notes ont la même force, sur un haut-parleur de téléphone aussi (à 2 dB près) : le chant complet est une seule mélodie.
  - Le chant sonne dans l'espace du chapitre (sa part de réverbération, longue dans la Grotte, courte au Récif), et la musique recule un peu sous chaque note chantée.
- **Les niveaux** : la musique se tient vers −27 dB (la Fosse vers −33 dB), une note chantée vers −20 dB (crête vers −10 dB) ; sous le chant, la musique recule encore de 5 dB. Le fond des bruits se tient 8 à 11 dB sous la musique (vers −35 dB, la Fosse vers −42 dB) ; un bruit isolé monte en crête vers −30 dB (une bulle) à −20 dB (le cri d'un grand visiteur).
- **Les réglages** : le panneau ⚙ a une section « Son », Musique, Chant et Bruits, de muet à un peu plus fort que le mélange voulu (le réglage de départ), gardés dans le stockage du navigateur (`lignee.son`). Un mot dit quand l'un est coupé, sans chiffres. La musique coupée libère aussi ses voix, les bruits coupés leurs fonds, pour la batterie.
- **Le coût**, mesuré hors ligne dans le Chrome d'un ordinateur : une ambiance se calcule 26 à 36 fois plus vite que le temps réel, une frontière (deux chapitres) 20 à 25 fois. La réverbération en est la plus grosse part. Les modulations à la cadence du son (un filtre ou une hauteur que fait bouger un oscillateur) coûtent cher : le balayage des filtres avance par pas de l'horloge de la musique (0,2 s), sans modulation de hauteur. De même, un filtre dont la fréquence glisse (`setTargetAtTime`) coûte dans Chrome trois à cinq fois un filtre immobile, et pour toujours : les filtres des bruits sautent d'une valeur à l'autre (`setValueAtTime`). Les bruits ajoutent 15 % (la Fosse) à 30 % (la Nurserie, ses bulles et ses baleines) au coût de la musique ; musique et bruits ensemble se calculent encore 17 fois plus vite que le temps réel.
- **Les bruits** : ce que fait la mer autour de nous, faits eux aussi dans le code (du bruit filtré et des oscillateurs). Ce que sonne chaque chapitre et la forme de chaque bruit sont dans `src/monde/bruits.ts` (pur et testé), `bruits-son.ts` les joue dans leur bus, à côté de ceux de la musique et du chant (`son.ts`). Une horloge de 0,1 s règle les fonds et programme les bruits un peu à l'avance ; ceux qu'une page retenue a manqués sont laissés, pas joués d'un coup.
  - **Les fonds**, tout le temps, faits de deux boucles de bruit (brun et rose) :
    - **l'eau** respire autour de nous : un bruit grave, plus sourd à mesure qu'on descend, qui enfle et retombe lentement ;
    - **les vagues** au-dessus de nous, près de la surface : un ressac qui va et vient, éteint sous 60 m ;
    - **l'eau qui file le long du corps** quand on nage : rien au repos, un souffle qui monte et s'éclaircit avec la vitesse, que la lignée nage ou que le courant de la Remontée l'emporte ;
    - **le courant** d'un obstacle qui pousse (la passe du Récif, le couloir brûlant des Sources, le vide du Jardin) : le même souffle, fort tant qu'il barre le passage, un murmure une fois franchi ;
    - **le grondement** des cheminées des Sources, à moins de 900 px de l'une d'elles.
  - **Les bruits çà et là**, chacun à son rythme, au hasard (de loin en loin, jamais réguliers), de quelque part autour de nous : à gauche ou à droite, plus sourds et plus faibles de loin.
    - **Les bulles** : chacune sonne à la hauteur de sa taille (une petite aigu, une grosse grave) et monte en partant, par petites salves. Elles viennent des suintements et des cheminées proches (là où on les voit monter), plus souvent près de la surface, et çà et là.
    - **Les baleines au loin** : de temps en temps, des cris longs, gémissements, montées et plaintes, très loin, presque tout dans la réverbération. Chaque grand visiteur qu'on voit crier (raie manta, tortue, requin-baleine, calmar, siphonophore, dragon abyssal) crie deux fois, avec ses deux ondes, d'autant plus grave qu'il est grand.
    - **La Grotte résonne** : sous la voûte seulement, les galeries chantent quelques notes graves à elles (le souffle de l'eau à travers des bandes étroites), et tout ce qu'on entend, notre nage comprise, revient des parois (trois échos qui se renvoient le son) ; des gouttes tombent de la voûte, une note qui monte, parfois suivie d'une plus petite. Ces échos ne sont calculés que sous la voûte.
    - **Le Glacier craque** : au loin, la glace se fend en une suite de petits claquements qui se pressent, parfois après un long grincement grave, parfois suivis d'un coup sourd ; de près, des cristaux tintent, sur les notes du chant, tout en haut.
  - Pendant l'adieu, les bruits baissent de moitié, pour laisser les mots.

| Chapitre | Fond | Bruits çà et là |
| --- | --- | --- |
| La Nurserie | l'eau claire ; les vagues près de la surface | des bulles ; des baleines au loin (souvent) |
| Le Récif | l'eau ; le courant de la passe | des bulles (souvent) ; des baleines |
| La Forêt | l'eau, plus sourde | des bulles ; des baleines, plus rares |
| La Grotte | les notes graves des galeries, l'écho des parois | des gouttes ; aucune baleine |
| La Carcasse | l'eau, sourde | des baleines au loin, au-dessus de la carcasse (souvent) |
| Les Sources | le grondement des cheminées ; le couloir brûlant | les bulles des cheminées |
| Le Glacier | l'eau, froide et mince | la glace qui craque au loin, les cristaux qui tintent |
| Le Jardin de méduses | l'eau, feutrée ; le vide qui pousse | presque rien |
| La Fosse | presque rien | une baleine, de très loin, rarement |
| La Remontée | l'eau qui s'ouvre ; le courant qui emporte | des bulles ; des baleines |
