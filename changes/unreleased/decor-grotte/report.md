# Le décor de la Grotte

## Livré

- **`src/monde/grotte.ts`** (géométrie pure, testée dans `grotte.test.ts`) : l'étendue de la grotte (`caveSpan`), la voûte (`ceilAt(x, z)` : haute au-dessus du plan de nage, elle descend jusqu'au sol au fond, z = 1600, et s'ouvre en arche aux deux entrées), la couverture (`caveCover`), l'obscurité (`caveDark` : salles tamisées, puis le noir à partir des deux tiers, qui dure jusqu'après la sortie), les piliers (jamais dans le plan de nage), les puits (seulement au-dessus des salles éclairées) et les lueurs du noir.
- **`src/monde/grotte-draw.ts`** (dessin, WebGL et Canvas 2D) : la voûte en rangées comme le sol, avec les stalactites ; les stalagmites ; les piliers (trois bandes, lumière, face, ombre) ; les rais de jour (additifs, avec le trou lumineux dans la voûte et une flaque au sol) ; un voile sombre sur le fond de la grotte ; le noir resserré autour du nageur ; les lueurs de la roche (bleues et vertes, qui respirent, dessinées après le noir).
- **Branchements dans `main.ts`** (quelques lignes) : les éléments de la grotte vont dans la liste triée par profondeur ; pas de rais de surface ni de caustiques sous la voûte ; l'obscurité de la grotte entre dans `dk` (lueurs des animaux plus fortes, plancton qui scintille) ; les créatures ne traversent pas la voûte (`collide`) ; les bancs de poissons font demi-tour à l'entrée (`caveRepel`) et restent sous la voûte ; le kelp et les sargasses ne poussent pas sous la voûte (`caveKeeps`).
- **Où la voir** : dans le chapitre `grotte` de la nouvelle carte (x de 10 600 à 13 600), la voûte court de x = 10 850 à 13 450 (`monde.gotoBiome(3)`, ou `monde.teleport(11750, 1220)` pour les salles). Si la carte perdait ce chapitre, la grotte se replierait sur la fin de la Forêt (x de 7300 à 10 400).
- Mesures (Chrome Windows, 1280 × 760) : 60 img/s en WebGL dans les salles et dans le noir ; 28 img/s en Canvas 2D (`?gl=0`) dans les salles, contre 50 dehors.
- Doc : section de la Grotte dans `docs/chapitres.md`.

![L'entrée : la falaise s'ouvre en arche au bout de la Forêt](img/entree.jpg)
![Les salles : voûte, stalactites, piliers, rais de jour par les puits](img/salles.jpg)
![Les galeries qui se resserrent](img/galerie.jpg)
![Le noir : un halo autour du nageur, les lueurs de la roche](img/noir.jpg)

## Fusion avec `backlog` (après la carte des 10 chapitres et le premier plan sombre)

- Conflits dans `src/monde/main.ts` seulement : les imports (`grotte`, `grotte-draw` et `foreground`, tous gardés) et la déclaration des plantes (`makePlants(vents).filter(caveKeeps)` suivi de `const front = makeFront()`, les deux gardés).
- La grotte suit maintenant le vrai chapitre `grotte` : sa palette ocre et encre, son fond qui descend, et son `dark` (0,62) s'ajoutent au décor. Les salles sont plus sombres que dans le kelp. Le repli, qui tombait dans le Récif sur la nouvelle carte, vise la fin de la Forêt.
- Le premier plan sombre passe devant la grotte sans conflit (ses silhouettes d'éponges et de rochers sont plus basses que la voûte).
- `src/monde/foreground.test.ts` (de `backlog`) cherchait les biomes `kelp` et `abysses`, qui n'existent plus sur la nouvelle carte : remplacés par `foret` et `fosse`, avec la même intention (le kelp pousse dans la Forêt ; le premier plan s'éclaircit dans le noir). Ce test échouait aussi sur `backlog`.
- Mon test typé : `id: 'grotte' as const` (l'`id` est devenu un `ChapterId`).
- Docs : le tableau des chapitres de `docs/chapitres.md` décrit le vrai décor de la Grotte au lieu du provisoire, et `docs/direction-artistique.md` ne la compte plus parmi les décors à faire.
- Captures refaites dans le vrai chapitre ; 60 img/s en WebGL dans les salles, la galerie et le noir.

## Choix retenus

Aucune question posée à l'utilisateur ; tout est tranché seul (option recommandée).

| Question | Choix retenu | Pourquoi |
| --- | --- | --- |
| Où placer la grotte | Le biome `grotte` de la carte (sinon, en repli, la fin de la Forêt) | Additif, sans toucher `biomes.ts` (refait par `10-chapitres-monde`) ; la Grotte vient après la Forêt dans la trame |
| Comment dessiner la voûte | Des rangées de roche comme le sol, du bord de la voûte au haut de l'écran, triées avec le reste | Même peintre que le sol, même coût, marche en WebGL et en Canvas ; la perspective donne la voûte vue d'en dessous |
| Stalactites, piliers : images cuites ou géométrie | Géométrie (triangles, bandes) | Pas de cuisson ni de mémoire d'images, pas de brouillard à recuire ; quelques centaines de triangles |
| Comment faire le noir | Un noir propre à la grotte, plus serré que celui des abysses, et `dk` relevé | Le noir des abysses est une vignette large : il ne donne pas « le noir complet » ; les lueurs passent par-dessus |
| Le fond de la grotte | Un voile d'encre sur ce qui est derrière z = 520, et le brouillard de la roche vers l'encre | Sans lui, le sol lointain (dessiné par `main.ts`) prend la couleur de l'eau libre et la grotte paraît ouverte |
| La voûte bloque-t-elle la nage | Oui, doucement (`collide`, comme le sol) | Une voûte qu'on traverse ne se lit pas comme une voûte ; zéro danger : on glisse dessous |
| Le banc qui fait demi-tour (moment fort) | Une poussée vers l'entrée la plus proche pour les bancs | Une ligne, et le chapitre le demande |
| Les plantes hautes sous la voûte | Retirées (kelp, sargasses) | Elles perçaient la voûte |

## Options non retenues

- **Place avant la carte** : ajouter moi-même un biome `grotte` à `biomes.ts` (conflit certain avec `10-chapitres-monde`) ; ne rien montrer tant que la carte manque (rien à voir ni à capturer) ; un paramètre d'URL `?grotte` (caché, peu utile).
- **Voûte** : un grand sprite de falaise cuit (détaillé mais figé, lourd en mémoire, perspective fausse quand on se déplace) ; un masque (clip) sur toute la scène (cher en Canvas, compliqué en WebGL).
- **Stalactites et piliers en images cuites** comme les rochers : plus de détail (strates, coulures), mais recuisson au changement de distance et mémoire.
- **Noir** : n'utiliser que `dk` de `main.ts` (trop clair, voir le texte) ; un noir plein écran (on ne voit plus le nageur) ; la vraie lanterne du joueur (chantier `fosse-noir-total`).
- **Fond** : modifier `drawRow` de `main.ts` pour assombrir le sol sous la voûte (plus juste, mais touche le code partagé et le chantier des reliefs).
- **Voûte** : purement décorative (on passerait à travers).
- **Plantes** : les raccourcir sous la voûte (touche `world.ts`, partagé) plutôt que les retirer.

## Reste à faire / limites

- La **galerie étroite** (l'obstacle : corps fin ou lanterne) n'est qu'un resserrement de la voûte (au plus bas 70 % de la hauteur des salles) : la règle d'obstacle est un autre chantier.
- Si les **reliefs composés** ajoutent leurs propres grottes ou surplombs, harmoniser : `ceilAt` pourrait devenir l'un d'eux, ou s'appuyer sur leur module.
- La **résonance** (son) de la Grotte est un chantier du son.
- Les poissons des bancs dont le foyer est dans la grotte sont repoussés vers les entrées : voulu (on entre seul), mais le biome `grotte` ne devra pas compter sur des bancs.
- Le noir continue 520 px après la sortie, sur le début de la Carcasse (plus profonde, déjà sombre).
- Canvas 2D : 28 img/s dans la grotte (dégradés de la voûte) ; le WebGL, par défaut, reste à 60.

## Risques de fusion

- `src/monde/main.ts` : deux imports, un `.filter(caveKeeps)` sur les plantes, deux lignes dans `Shoal.update`, deux lignes dans `collide`, `open` pour les caustiques et les rais, un appel `pushCave(...)` avant le tri, `dk` enveloppé dans un `Math.max(…, caveDark(cam.x))`. Conflits possibles avec `premier-plan-sombre`, `fosse-noir-total` (le calcul de `dk`), `reliefs-composes-arches` (`collide`, le sol).
- `docs/chapitres.md` : un paragraphe « Dans le jeu » dans la section de la Grotte, et sa ligne du tableau des chapitres ; `docs/direction-artistique.md` : une ligne.
- `src/monde/foreground.test.ts` : deux identifiants de biome mis à jour.
- Nouveaux fichiers : `src/monde/grotte.ts`, `grotte-draw.ts`, `grotte.test.ts`.
