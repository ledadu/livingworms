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
- des rayons, des caustiques, la surface vue de dessous, le plancton et la neige marine ;
- des bancs de poissons qui s'écartent du nageur, et de grands visiteurs lointains (tortue, raie manta, requin-baleine, calmar, dragon abyssal) ;
- les 10 chapitres dans l'ordre de la trame, chacun avec sa palette (tableau ci-dessous) : voir [chapitres.md](chapitres.md#dans-le-monde) ;
- un rendu WebGL2 avec niveaux de détail et budget par image, et le canvas en repli.

Il manque, pour le plan :

- le premier plan sombre et flou ;
- les décors propres à la Carcasse, le Glacier, le Jardin de méduses et la Fosse (ils ont aujourd'hui un décor provisoire tiré de l'existant) ;
- le puits de lumière de la Remontée.

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
- Le passage du Jardin de méduses à la Fosse, puis de la Fosse à la Remontée, se fait en fondu sur les frontières.

## Le son

Tout est généré dans le code, sans fichier audio (Web Audio API, voir [decisions.md](decisions.md#technique)).

- **Une ambiance musicale par chapitre** : nappes et harmoniques qui changent avec la profondeur.
- **Le chant** : chaque note a son timbre ; joué en entier, il forme une mélodie.
- **Les bruits** : des bulles, le courant, des cris lointains de baleine.
- Proposition pour les nouveaux chapitres : la Grotte résonne (réverbération longue, gouttes), le Glacier craque et tinte (glace qui se fend, cristaux).
