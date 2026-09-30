# La lignée rivale de la Carcasse

## Livré

À la Carcasse, une **cousine** : la créature d'une autre lignée, partie de la même larve que nous (`firstAncestor`), mais qui a choisi d'autres partenaires dans chacun des quatre chapitres d'avant (Nurserie, Récif, Forêt, Grotte).

- **Ses choix** (`rivalChoices`, `src/monde/rivale.ts`, pur et testé) : dans un chapitre à obstacle, elle prend un partenaire du chapitre (`PARTNERS`) qui apporte un trait qui le franchit (`KEYS`), d'abord le trait que **notre** corps n'a pas : si nous avons des nageoires, elle a pris la méduse-boîte (pulsation) ; des pinces, le dragon feuillu (corps fin) ; un corps fin, le cténophore (lanterne). Ensuite, le partenaire qui apporte le plus de traits que nous n'avons pas. À la Nurserie (sans obstacle), presque au hasard. Elle a toujours pu franchir chaque obstacle (testé pour les 256 combinaisons de traits).
- **Ses générations** (`rivalLineage`) : quatre portées faites par `brood` (`src/content/portee.ts`), comme les nôtres, parade réussie à 0,8 ; elle garde chaque fois l'enfant qui franchit l'obstacle et porte le trait voulu, et parmi eux le plus loin de son parent. Le résultat est une créature étrange, de notre génération, dont le nom commence comme le nôtre (« Prem… »). Environ 12 ms dans le navigateur, une seule fois.
- **D'où elle vient** : de la créature de notre lignée qui est arrivée à la Carcasse (`arrivedAt` : le premier ancêtre qui a donné naissance à la Carcasse ou plus bas, sinon celle qu'on joue). Graine : un hachage de son nom et de ses traits. C'est la même cousine à chaque visite et après un rechargement, **sans rien ajouter à la sauvegarde**.
- **Dans le monde** (`src/monde/rivale-jeu.ts`) : elle est faite la première fois qu'on entre dans la Carcasse (ou qu'on y revient des Sources), au-dessus des côtes, à peu près à notre taille (agrandie jusqu'à 1,8 fois si elle est bien plus petite que nous). Seule, elle va et vient le long du squelette. À 560 px, elle nous remarque : une lueur de sa couleur s'allume d'un coup puis respire (jamais l'or des partenaires, `cousinHue`). Elle vient nager à côté de nous, un peu au-dessus, et nous suit autour des os sans jamais nous toucher (elle s'écarte sous 90 px), puis y retourne quand on s'en éloigne (760 px de chez elle). Pendant une parade ou un adieu, elle nous laisse (`aside`). Ce n'est pas une partenaire : elle ne danse pas.
- **Le texte de la rencontre** : la première fois qu'on la croise (320 px), dès qu'aucun autre texte n'est à l'écran (ouverture, adieu, panneau) : « D'autres étaient partis de la même lumière que nous. / Ils avaient fait d'autres rencontres, pris d'autres corps. / Nous nous sommes reconnus quand même. » Écrit dans `docs/chapitres.md` sous le libellé « La rencontre : » (nouveau type de texte `meeting` dans `textes.ts`).
- **Pour le voir** : `?dev`, voyage à la Carcasse (panneau ⚙), puis nager vers le milieu du squelette. Console : `monde.rivale.rival` (sa définition, les partenaires choisis et les enfants gardés), `monde.rivale.cr`, `monde.rivale.met`, `monde.rivale.make()`.
- Tests : `src/monde/rivale.test.ts` (12). Doc : `docs/chapitres.md`, chapitre 5 (« La lignée rivale ») et « Les textes ».

![La rencontre : la cousine (à gauche) et nous, les mots de la lignée](img/rencontre.jpg)
![Au-dessus des côtes : la cousine (en haut à droite) vient nous rejoindre](img/cotes.jpg)
![Deux parties : notre créature et sa cousine, avec les partenaires de chacune](img/portraits.jpg)

## Choix retenus

Aucune question posée à l'utilisateur (le chantier ne demandait aucun choix structurant). Un retour (feedback) signale un test qui échoue déjà sur la base (voir « Reste à faire »).

| Question | Choix retenu | Pourquoi |
| --- | --- | --- |
| Ce qui rend ses choix « différents » | Les traits de notre corps : elle franchit chaque obstacle avec l'autre trait | La sauvegarde ne garde pas nos partenaires ; nos traits disent comment nous avons franchi, et c'est ce qui se voit |
| Comment elle est faite | La même chaîne que la nôtre : `firstAncestor` puis `brood` avec les partenaires des chapitres | Une vraie cousine (même larve, mêmes règles d'hérédité), pas une espèce dessinée à part |
| Combien de créatures | Une seule, de notre génération | Lisible et léger ; « la cousine » répond au « nous » |
| Quand elle est faite | À l'entrée de la Carcasse, depuis la créature arrivée là | Avant, la créature qu'on joue n'est pas encore celle qui arrive |
| Garder la même cousine | Recalculée à partir de la lignée déjà sauvée (hachage), rien de nouveau dans la sauvegarde | Pas de changement de format durable ; `partie.ts`, que les voisins touchent, reste tel quel |
| Son comportement | Elle vient nager à côté de nous, sans toucher, puis retourne à ses os | Une reconnaissance, pas une rivalité : zéro danger, rien à gagner ni à perdre |
| Comment la repérer | Une lueur de sa propre couleur quand elle nous remarque | Les partenaires ont l'or : on ne confond pas ; dans le noir de la Carcasse elle reste visible |
| Sa taille | Au moins 90 % de la nôtre environ (agrandie jusqu'à 1,8 fois) | Les fusions donnent parfois une créature minuscule, qu'on ne remarquait pas |
| Un texte | « La rencontre », lu dans `chapitres.md` comme les autres | Le texte est la seule vraie interface ; il dit « d'autres choix » sans chiffre |
| Elle et la parade / l'adieu | Elle s'écarte pendant | Ces deux moments sont les nôtres |

## Options non retenues

- **Ce qui la rend différente** : garder nos partenaires dans la sauvegarde et prendre les autres — plus exact, mais change le format de `lignee.partie`, que l'arbre de la lignée va sans doute changer lui-même (à reprendre quand il aura le partenaire de chaque ancêtre) ; tirer ses partenaires au hasard — simple, mais elle pourrait avoir fait exactement nos choix ; lui donner les traits qui nous manquent sans passer par des partenaires — moins cohérent avec l'hérédité.
- **Comment elle est faite** : une espèce du bestiaire dessinée à la main — plus belle et maîtrisée, mais toujours la même et sans lien avec nous ; `generate()` avec la famille « chimère » — étrange, mais pas cousine ; `fuse` en mode « chimère » avec tous les partenaires d'un coup — trop chargée pour un téléphone.
- **Combien** : toute sa lignée (ses quatre ancêtres, là où chacun a été quitté) — riche, mais coûte des acteurs et empiète sur « Les ancêtres restent dans le monde » ; la cousine et son parent — lisible comme « une lignée », mais son parent devrait être resté à la Grotte ; un petit groupe de sœurs — plus vivant, plus de coût.
- **Quand** : au chargement de la page — la créature n'est pas encore celle qui arrive ; à l'entrée de la Grotte — on peut encore y changer de corps.
- **Garder la même** : enregistrer sa définition dans la sauvegarde — robuste même si l'Atelier change notre corps, mais nouveau format durable ; la refaire à chaque session depuis la créature jouée — change après chaque naissance plus bas.
- **Comportement** : une rivale qui danse avec nos partenaires sous nos yeux (sa propre parade) — fort, mais demande une deuxième parade dans `parade-jeu.ts` ; une partenaire qu'on peut courtiser — mélangerait deux lignées, tentant pour plus tard, mais « rivale » dit le contraire ; une cousine qui fuit — lisible comme « rivale » mais triste et moins mémorable ; qui nous imite (miroir de nos gestes) — à essayer ensuite, demande de lire notre vitesse.
- **Repérage** : aucune lueur — plus sobre, mais on passe à côté dans le noir ; l'or des partenaires — ferait croire qu'on peut danser avec elle ; des lueurs qui montent comme pour la parade — plus de dessin pour peu de différence.
- **Taille** : telle que la fusion la donne — parfois un point à l'écran ; exactement la nôtre — force trop les grandes.
- **Texte** : aucun — le moment passerait inaperçu ; son nom à l'écran — contraire à « pas d'interface », il ira plutôt dans l'arbre de la lignée.

## Reste à faire / limites

- **Test déjà rouge sur la base** : `src/monde/nouveautes/plugin.test.ts` (« embeds the published versions only… ») échoue sur `backlog` 783f9a2 sans aucun changement (les images de la 0.4.0 prennent le budget de 400 Ko, les entrées de la 0.2.0 n'ont plus leur image). Signalé au tableau de bord ; `make check` est rouge pour cette seule raison.
- La « différence » se lit sur nos traits au moment d'arriver : si notre lignée a perdu un trait en route, la cousine peut avoir fait le même choix que nous dans ce chapitre-là. Avec le partenaire de chaque ancêtre dans la sauvegarde (chantier de l'arbre), `rivalChoices` pourra écarter nos vrais partenaires.
- Si l'Atelier change notre créature avant la Carcasse, la cousine suit ce corps-là (sans Atelier dans l'histoire, cela ne concerne que les tests).
- Le texte de la rencontre est une proposition, à relire avec les autres textes.
- À faire ensuite : la cousine dans l'arbre de la lignée (une branche à part), sa lignée revue à la Remontée, ou une trace d'elle plus bas (chantier des traces).

## Risques de fusion

- `src/monde/main.ts` (branchements courts) : un import ; `'rival'` ajouté à `Actor.kind` ; `rivale.step(…)` après `parade.step` dans `update()` ; une branche `a.kind === 'rival'` avant celle du parent dans la boucle des acteurs ; `rivale.lights(…)` après `parade.lights` dans `render()` ; la création `initRivale({…})` juste avant `// ----- loop -----` ; `rivale` dans `api`. Conflit probable avec « Les ancêtres restent dans le monde » sur `Actor.kind` et la boucle des acteurs : garder les deux branches.
- `src/monde/textes.ts` : un type de texte de plus (`meeting`) et son libellé ; additif.
- `docs/chapitres.md` : une ligne dans « Les textes », un paragraphe et le texte « La rencontre » au chapitre 5 ; additif.
- Nouveaux fichiers : `src/monde/rivale.ts`, `rivale-jeu.ts`, `rivale.test.ts`.
