# La Fosse : noir total et ta propre lumière

## Livré

- **La Fosse** : d'abord un 7ᵉ biome après les Abysses ; depuis la fusion, le 9ᵉ chapitre de la carte des 10 chapitres (voir « Fusion »).
- **Le noir total** : `pitchOf(dark)` passe de 0 (Abysses, `dark` 0.86, inchangées) à 1 (Fosse, `dark` 1), en fondu sur la frontière. `darkStops` remplace les trois anneaux codés en dur du noir (canvas et WebGL) : à 0 ils sont identiques à avant, à 1 seul le cercle de la lumière du nageur reste clair, tout le reste est noir (opacité 1).
- **Ta propre lumière** : `glowOf` additionne les lueurs des parties du nageur (comme `eachGlow3` les dessine), une lanterne (`role: light`) comptant triple ; `lightReach` en fait un rayon : ~45 px sans rien qui brille (poisson-clown), ~115 px pour la larve, ~145 px pour la baudroie, ~245 px pour le cténophore.
- **Ce qui brille** reste visible par-dessus le noir (lueurs des animaux, poissons-lanternes : le code existant, dessiné après le noir).
- **La neige marine** ne se voit que dans la lumière, blanche, plus forte près du nageur (`snowLit`) ; hors de la lumière, plus rien.
- **Les grandes silhouettes** : un dragon abyssal (×7) et un calmar géant (×9) passent au loin ; dans le noir ils sont dessinés après lui (`fosse-draw.ts`, `drawShape`) : un corps noir devant une faible lueur bleu électrique, et leurs photophores atténués.
- Tests : `src/monde/fosse.test.ts` (place et profondeur de la Fosse, fondu, portée de la lumière, anneaux du noir, neige, lanterne).
- Doc : section « La Fosse : le noir total » dans `docs/direction-artistique.md`.
- Pour le voir : ⚙ → « Fosse », ou `monde.gotoBiome(8)` ; `monde.becomes(SPECIES.baudroie())` puis `SPECIES.poissonClown()` pour comparer les lumières. `monde.fosse` donne `pitch`, `reach`, `glow`.

![Les Abysses, avant : sombres mais jamais noires](img/abysses-avant.jpg)
![La Fosse avec la larve : sa lumière, la neige, le calmar géant en silhouette](img/fosse-larve.jpg)
![Sans rien qui brille (poisson-clown) : on se voit à peine](img/fosse-sans-lumiere.jpg)
![La baudroie et sa lanterne](img/fosse-baudroie.jpg)
![Deux silhouettes qui passent](img/fosse-silhouettes.jpg)
![La frontière : le noir se referme en fondu](img/frontiere.jpg)

60 images/s sur le Chrome Windows (WebGL), vérifié aussi en canvas (`?gl=0`).

## Fusion avec `backlog` (après les 10 chapitres et le premier plan)

- La carte des 10 chapitres a sa propre Fosse (9ᵉ chapitre, x 25 200 → 28 400, avant la Remontée) : mon biome `FOSSE` de fin de carte est **retiré** de `fosse.ts`, les règles du noir s'appliquent à la leur. J'y ai mis `dark: 1` (au lieu de 0.93 : seul chapitre au-delà de 0.88, donc seul en noir total), ajouté cténophores et siphonophores (ce qui brille) à sa faune, et ses deux visiteurs deviennent géants (dragon abyssal ×7, calmar ×9) pour les silhouettes.
- Les visiteurs sont désormais décrits par chapitre (`visitors` dans `biomes.ts`) : ma liste de `main.ts` a cédé la place à la leur.
- `foreground.test.ts` (premier plan) visait encore les anciens biomes `kelp` et `abysses`, absents de la nouvelle carte : remplacés par `foret` et `fosse` (le test échouait sur `backlog` même).
- Tests de la Fosse réécrits sur `span('fosse')` et `chapterIndex`. Docs : `chapitres.md` (ligne de la Fosse dans « Dans le monde »), `direction-artistique.md` (la section suit la nouvelle carte).

![La Fosse dans la carte des 10 chapitres](img/fosse-dix-chapitres.jpg)

### Deuxième fusion (décors de la Grotte et de la Carcasse)

- `src/monde/main.ts` en conflit à trois endroits, les deux côtés gardés : imports (`fosse` et `grotte`), le noir (`dk` prend le maximum du noir du chapitre et de celui de la Grotte, `caveDark`, puis la lumière du nageur de la Fosse est calculée comme avant), `window.monde` (`carcasse` et `fosse`).
- Les deux noirs restent indépendants : le noir total ne dépend que du `dark` du chapitre (Grotte 0.62), la Grotte garde le sien.
- Doc : la section de la Fosse cite le noir de la Grotte.

### Troisième fusion (décor du Glacier)

- `src/monde/main.ts` : un seul conflit, les imports ; gardés tous les deux (`fosse`, `fosse-draw` et `glacier`). Les cristaux du Glacier se dessinent après le noir comme mes silhouettes, dans leur chapitre seulement : rien à régler de plus.

## Choix retenus

Aucune question posée sur le tableau de bord ; tout est tranché seul (option recommandée).

| Question | Choix retenu | Pourquoi |
| --- | --- | --- |
| Où est la Fosse ? | Un 7ᵉ biome après les Abysses, défini dans `fosse.ts` et ajouté en fin de `BIOMES` | La carte n'avait pas de Fosse ; on la voit tout de suite ; le chantier des 10 chapitres peut la déplacer d'une ligne |
| Comment déclencher le noir total ? | Par la valeur `dark` de l'ambiance (> 0.88), sans nouveau champ | Le fondu entre biomes existe déjà pour `dark` ; rien à changer dans `Mood` ni `moodAt` |
| Quelle lumière pour le nageur ? | Calculée depuis ses lueurs, lanterne ×3 | Rattache la lumière au corps (l'hérédité, la lanterne de la vision) sans nouvelle donnée d'espèce |
| Les grandes silhouettes ? | Des visiteurs géants dessinés en noir devant une faible lueur bleue, après le noir | Une forme noire sur du noir ne se voit pas ; le contre-jour bleu électrique suit la palette du chapitre |
| La neige marine ? | Visible seulement dans la lumière, en blanc | « On ne voit que ce que sa lumière éclaire » |

## Options non retenues

- **Où est la Fosse**
  - Pousser les Abysses plus loin (noircir la fin des Abysses) : pas de biome à gérer, mais pas de Fosse ni de nom à l'écran.
  - Attendre le chantier des 10 chapitres : aucun conflit, mais rien à montrer.
  - Un champ `fosse` sur chaque biome, activé par l'autre chantier : propre, mais invisible tant que la carte n'est pas refaite.
- **Déclencher le noir total**
  - Un nouveau champ `pitch` dans `Biome`/`Mood` : plus explicite ; touche `moodAt` et le type `Mood`, fichiers que l'autre chantier refait.
  - Par la profondeur (y) : indépendant de la carte, mais toucherait aussi les Abysses les plus basses.
- **Lumière du nageur**
  - Rayon fixe : simple, mais la lanterne ne servirait à rien.
  - Un trait « lanterne » dans la spec des espèces : plus lisible pour l'hérédité ; touche le bestiaire et le moteur (fichiers partagés).
  - Lumière qui grandit avec le temps passé dans la Fosse (les yeux s'habituent) : joli, à ajouter plus tard.
- **Silhouettes**
  - Les dessiner avant le noir, simplement assombries : disparaissent complètement.
  - Silhouettes à contour lumineux (liseré bleu) : plus lisibles, mais demandent un rendu de contour (coût GL et canvas).
  - Des ombres qui passent devant les lueurs des autres animaux seulement : subtil, peu visible sur téléphone.
- **Neige marine**
  - Garder la neige partout, atténuée : moins noir.
  - Neige qui scintille aussi autour des animaux lumineux : plus riche, un calcul de distance par flocon et par lueur.

## Reste à faire / limites

- L'obstacle du chapitre (« il faut une lanterne ou le chant ») n'est pas branché : la lumière est seulement visuelle, rien ne bloque le passage.
- Le chant et les lumières des ancêtres qui répondent (moment fort) : autre chantier.
- La larve a déjà ~115 px de lumière (ses bouts lumineux) : on pourra réduire son rayon pour que la lanterne compte plus.
- Le décor du fond de la Fosse reste celui, provisoire, du chantier des chapitres (les profondeurs 500–650 m y sont réglées).
- Les silhouettes sont toujours là (deux visiteurs en va-et-vient) ; un passage rare et lent serait plus fort.

## Risques de fusion

- `src/monde/biomes.ts` : seulement l'entrée `fosse` (`dark: 1`, deux espèces de plus, visiteurs géants).
- `src/monde/main.ts` : imports (à côté de `grotte` et `glacier`), anneaux du noir par `darkStops` (canvas et WebGL), `drawShapes()` après le noir, `drawMotes` (neige dans la lumière), `fosse` dans `window.monde`.
- `src/monde/foreground.test.ts` : deux identifiants de chapitre.
- Nouveaux : `src/monde/fosse.ts`, `fosse-draw.ts`, `fosse.test.ts` ; docs `direction-artistique.md`, `chapitres.md`.
