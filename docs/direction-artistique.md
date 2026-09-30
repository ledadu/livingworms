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

- les reliefs composés (arches, grottes, failles, surplombs, piliers) ;
- le premier plan sombre et flou ;
- les décors propres à la Carcasse, le Glacier, le Jardin de méduses et la Fosse (ils ont aujourd'hui un décor provisoire tiré de l'existant) ;
- le puits de lumière de la Remontée.

### Le premier plan

Entre l'œil et le plan de nage (`src/monde/foreground.ts`) : des silhouettes sombres et floues, plus proches de l'œil que tout le reste, donc qui défilent plus vite (la perspective s'en charge : environ deux fois la vitesse du plan de nage).

- **Ce qu'on y voit** : ce qui pousse dans le chapitre (kelp, herbes, coraux, gorgones, tubes, tiges), plus des roches, en groupes et en clairières. Moins dense là où le noir se referme.
- **Sombre et flou** : chaque silhouette est cuite une fois, petite et floutée, d'une seule couleur (l'eau autour, très assombrie), puis agrandie ; elle ondule doucement depuis son pied.
- **Le plan de nage reste lisible** : les silhouettes montent du bas de l'écran (ou de leur sol quand il est visible) et s'effacent presque en approchant du nageur.
- **Coût** : quelques images par trame, en WebGL comme en canvas. Couche `front` de `monde.skip` pour la comparer.

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

## Le son

Tout est généré dans le code, sans fichier audio (Web Audio API, voir [decisions.md](decisions.md#technique)).

- **Une ambiance musicale par chapitre** : nappes et harmoniques qui changent avec la profondeur.
- **Le chant** : chaque note a son timbre ; joué en entier, il forme une mélodie.
- **Les bruits** : des bulles, le courant, des cris lointains de baleine.
- Proposition pour les nouveaux chapitres : la Grotte résonne (réverbération longue, gouttes), le Glacier craque et tinte (glace qui se fend, cristaux).
