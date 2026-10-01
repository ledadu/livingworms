# Les mécaniques

Comment on joue : la boucle d'un chapitre, la reproduction, l'hérédité, le chant, la lignée. Repris du [plan v1](plan-v1.md) avec les [décisions](decisions.md) (zéro danger, 10 chapitres). Les liens vers le code disent sur quoi chaque mécanique peut s'appuyer ; ce qui n'existe pas encore est marqué « à construire ».

## La boucle d'un chapitre

```
Arriver dans un nouveau biome (texte d'ouverture)
   → Explorer, observer la vie locale
   → Trouver l'OBSTACLE qui bloque la descente
   → Découvrir quelle ESPÈCE locale sait le franchir (les INDICES y mènent)
   → La rejoindre, nager avec elle : la PARADE
   → La PONTE : ses œufs dans l'eau, qu'on ouvre quand on veut
   → La PORTÉE : choisir 1 enfant parmi 4, ou plus tard
   → L'ADIEU au parent (texte)
   → L'enfant franchit l'obstacle → chapitre suivant
```

La Nurserie et la Carcasse n'ont pas d'obstacle : on y trouve quand même un partenaire, et la boucle continue.

## La reproduction (le cœur du jeu)

### Les espèces compatibles

- Dans chaque biome, une ou deux espèces compatibles (la liste par chapitre est dans [chapitres.md](chapitres.md)).
- Elles émettent une lueur quand tu es proche.
- **Dans le jeu** (`src/monde/partenaires.ts`) : `PARTNERS` donne les partenaires de chaque chapitre. Un animal d'une de ces espèces est un partenaire (`actor.partner`, l'index du chapitre) s'il vit dans le plan de nage, là où on peut le rejoindre : dans son chapitre, avant la retenue de son obstacle (`meetRange`). Chaque chapitre en a au moins deux de chaque espèce (`PER_PARTNER`), répartis sur sa longueur, en plus de sa faune.
- **La lueur** : un halo doré (`GLOW_HUE`) autour du milieu du corps, qui naît à 650 px du nageur, est plein à 160 px, et respire lentement (`partnerGlow`). Un peu plus fort en eau claire, où une lumière ajoutée se voit moins. `monde.partners()` les liste ; `monde.skip.add('partner')` éteint leur lueur (captures avant / après).
- **On ne se bloque jamais** : les partenaires d'un chapitre apportent, par leur corps, chacun des traits qui franchissent son obstacle (`uncovered`, testé contre les traits de chaque espèce). Le chant de la Fosse n'est pas un trait du corps (voir « Le chant »).

### La parade

- Un moment de nage synchronisée : tu suis ou imites le partenaire (le suivre sans le perdre, passer dans son sillage, tourner avec lui), puis **c'est toi qui déclenches l'accouplement** (« S'accoupler »), et les deux dansent seuls quelques secondes avant la ponte.
- **Sans échec possible**, seulement plus ou moins réussie, et sans limite de temps : le partenaire danse tant qu'on ne s'est ni accouplé ni éloigné.
- La qualité de la parade influence la portée : bien réussie, les enfants héritent davantage des traits voulus.
- **Le début** : on reste un moment (2 s) à moins de 130 d'un partenaire (`actor.partner`, voir « Les espèces compatibles ») ; il nous remarque (quelques lueurs montent de lui), puis mène la danse. Rester près de lui, c'est dire oui : le frôler en passant ne suffit pas. Rien ne commence pendant qu'un texte est à l'écran ou que la portée est ouverte.
- **La quitter** : tant qu'on n'a pas déclenché l'accouplement, on peut toujours s'en aller. À plus de 520 de lui pendant 2,5 s (`LEAVE_FAR`, `LEAVE_TIME`, `away`), il nous laisse partir, avec quelques lueurs, et retourne à sa vie : pas d'œufs, rien ne s'ouvre plus tard. Revenir rester près de lui, c'est recommencer. Le suivre de loin ne compte pas pour un départ : la danse ne l'écarte jamais de plus de 480 (son grand huit).
- **La danse** : le partenaire dessine un grand huit (240 × 95 de demi-axes) autour de l'endroit de la rencontre, en partant du côté opposé à nous, pour qu'on se retrouve derrière lui. Il avance à son aise (selon sa vitesse de nage), attend quand il prend du retard et ralentit quand on s'éloigne : on peut toujours le rattraper. Un marcheur (crabe, homard) fait l'aller-retour sur le fond.
- **La qualité**, mesurée à chaque instant pendant la parade, avant le déclenchement, puis moyennée sur ses 12 dernières secondes (`QUALITY_SPAN` : une moyenne simple au début, puis glissante, pour qu'un début raté se rattrape en dansant encore) : **le suivre** (près de lui : plein jusqu'à 120, nul au-delà de 360, 40 %), **son sillage** (passer là où il était il y a 0,3 à 1,5 s, 30 %), **tourner avec lui** (aller dans la même direction que lui, 30 %). Le suivre du doigt donne environ 0,95 ; rester à côté sans bouger, 0,3 à 0,4 ; s'en aller, presque 0.
- **Prêts** (`ready`) : au bout de 4 s au moins (`READY_MIN`), une fois qu'on a bien dansé l'équivalent de 3,2 s parfaites (`READY_GOOD`), ou au bout de 10 s quoi qu'on fasse (`READY_MAX`). Bien le suivre fait venir ce moment vers 4 à 5 s ; rester à côté sans bouger, vers 9 à 10 s. Le partenaire appelle alors une fois (quelques lueurs montent de lui).
- **Le déclenchement** : prêts, et à moins de 230 du partenaire (`READY_NEAR`), un bouton « S'accoupler » apparaît au-dessus de lui et le suit (`accoupler.ts`) ; on le touche, on le clique, ou Entrée / Espace au clavier. Il s'efface quand on s'éloigne, ou quand un texte, la portée, l'arbre ou le chant passent devant. La qualité est alors fixée : la danse à deux ne la change pas.
- **La danse à deux** (`danse.ts`) : on ne pilote plus, on regarde ; la caméra se rapproche des deux, puis revient. Environ 8 à 10 s, quatre figures : une ouverture (ils se tournent autour ; un nageur et un marcheur : le nageur passe en arc au-dessus du marcheur), deux figures tirées au hasard, et **face à face** pour finir, de plus en plus près, en se saluant de la tête. Les figures du milieu : **s'enrouler** (de plus en plus près, de plus en plus vite), **la spirale** (en tournant, ils montent ensemble, de 70 à 110), **se frôler** (ils échangent leurs places en se croisant de près), **le balancement** (côte à côte, l'un monte quand l'autre descend ; deux marcheurs font un pas de côté ensemble). Le sens, la durée de chaque figure et leur choix changent d'une fois à l'autre, et selon les deux espèces : un marcheur reste au fond (et fait de plus petits pas), donc pas de spirale avec lui ; deux marcheurs se balancent plus volontiers ; une méduse dérive plus lentement (×1,15). Les deux sillages brillent et l'eau s'allume sous les deux corps tout du long.
- **Ce qu'on voit** (pas de chiffres) : son sillage brille de ses couleurs ; le nôtre s'allume des mêmes couleurs quand on danse en rythme ; à la fin de la danse à deux, une figure de lumière entre les deux danseurs, d'autant plus riche que la parade était belle. Ces lumières changent d'une parade à l'autre (voir « La lueur de l'accouplement »). La danse remue l'eau, qui s'allume sous les corps et porte ces lumières (voir « L'eau de la parade »).
- **Le résultat** : `monde.parade.last` (`partner` : l'id de l'espèce, `spec` : sa définition, `chapter`, `at` : où la figure de lumière a fermé la danse, entre les deux danseurs, `quality` de 0 à 1, `parts` : les trois mesures), et `monde.parade.onEnd(f)` appelé à la fin de chaque danse à deux (pas quand on quitte la parade). Le jeu y pond les œufs, dans la figure de lumière (voir « La ponte »).
- Dans le code : les règles dans `src/monde/parade.ts` et la danse à deux dans `danse.ts` (pures, testées), le jeu dans `src/monde/parade-jeu.ts`, le bouton dans `accoupler.ts`. Seuls les animaux marqués partenaires dansent. Pour les tests : `monde.parade.start(animal, monde.player.cr)`, `monde.parade.state` (`ready`, `canMate`, `dance` : `time`, `length`, `figures`), `monde.parade.mate()` (comme le bouton ; `mate(true)` même avant d'être prêts), `monde.parade.dancing`, `monde.parade.finish()` (finit tout de suite, sans la danse à deux), `monde.parade.leave()`, `monde.parade.quiet = () => false`.

### La lueur de l'accouplement

Les lumières de la parade ne sont jamais tout à fait les mêmes : chacune tire les siennes des gènes des deux danseurs, avec un peu de hasard. Elles restent douces : jamais de tache blanche qui cache les créatures.

- **Les gènes d'un danseur** (`genesOf`) : ses couleurs (celles de ses parties lumineuses d'abord, puis les deux premières de sa palette), ses traits (`traitsOf`), sa façon de nager (`swim.mode`), s'il a des parties qui brillent, et sa symétrie (le nombre de bras d'une étoile, de tentacules d'une cloche, de 3 à 8).
- **La lumière d'une parade** (`lueurOf`), tirée à son début :
  - **ses couleurs** : celle du partenaire d'abord, puis la nôtre, puis les autres des deux, un peu nuancées ;
  - **le sillage** : poussière (les lueurs qui montent doucement), bulles, étincelles, ruban (une ligne qui dessine le huit), volutes, pouls (des anneaux qui partent du partenaire) ou lucioles qui clignotent ;
  - **la figure finale** : corolle (des pétales, autant que sa symétrie), spirale (deux bras, sa couleur et la nôtre), pluie de lumière, lucioles, anneaux qui s'élargissent, hélice (deux brins qui montent en tournant) ou fontaine ;
  - parfois (une fois sur deux), **un écho** : une seconde figure, plus petite, tirée de nos seuls gènes ;
  - le sens où tout tourne, la taille des lumières et leur rythme (plus vif chez ceux qui nagent par jets ou par élans).
- **Les gènes pèsent sans décider** : chaque sillage et chaque figure a ses gènes (`WAKES`, `BURSTS`) ; chacun de ces gènes compte double chez le partenaire, simple chez nous, et le hasard fait le reste. Une méduse appelle les anneaux et le pouls ; un crabe, la fontaine et les étincelles ; une lanterne, les lucioles ; un corps fin, le ruban et l'hélice. La figure de la parade précédente revient rarement (son poids tombe à 15 %).
- **La richesse, pas l'éclat** : une parade réussie donne une figure avec plus de lumières, jamais plus forte (de ×0,5 à ×1,5 lumières).
- **Jamais éblouissant** : chaque lumière a au plus 0,7 d'opacité ; là où elles se rassemblent, celles d'une même case de 32 px ne dépassent pas 1,8 à elles toutes (`CELL_CAP`) et se partagent leur force. Les figures s'étalent sur 100 à 150 px autour des danseurs. Pendant la danse et juste après, le halo doré du partenaire baisse à 30 % : ses lumières parlent pour lui. En eau claire, où une lumière ajoutée se voit moins, elles brillent un peu plus (jusqu'à ×1,5), sans dépasser ces deux limites.
- **Portées par l'eau** : ces lueurs dérivent avec l'eau que la danse remue (voir « L'eau de la parade »).
- Dans le code : `src/monde/lueur.ts` (pur, testé), branché dans `parade-jeu.ts`. Pour les captures : `monde.parade.forceLight({ wake, burst, echo })` impose la lumière de la parade suivante ; `monde.parade.light` donne celle de la parade en cours, ou de la dernière.

### L'eau de la parade

La danse se fait dans l'eau, et l'eau s'en souvient : une nappe de mer de 640 × 400 px autour du grand huit, simulée comme un vrai fluide, le plus simple qui soit (les « stable fluids » de Jos Stam : la vitesse de l'eau sur une grille de 80 × 50 cases de 8 px, portée par elle-même et gardée sans divergence, pour que ce qu'on pousse tourne autour au lieu de s'empiler : une poussée fait deux tourbillons, un jet un champignon). Deux encres y nagent, la lumière du partenaire et la nôtre, portées « à la MacCormack » pour garder leurs volutes fines.

- **Les corps remuent l'eau** : le tronc et le bout des membres des deux danseurs entraînent l'eau (jamais plus vite qu'eux) et l'allument là où ils la bousculent, comme le plancton d'une nuit d'été : de la couleur du partenaire, et de la nôtre à mesure qu'on danse en rythme (`sync`). À chaque coup de queue, un poisson lâche une bouffée du côté qu'elle vient de balayer, un peu en arrière ; une cloche ou un manteau pousse un jet derrière lui à chaque battement ; un marcheur soulève le fond de temps en temps (`remous.ts`, `beat`). Après la danse, les deux continuent de remuer l'eau sans l'allumer, jusqu'à ce qu'elle se calme.
- **La figure finale** devient un mouvement d'eau (`waterFigure`) : la corolle, des jets le long de chaque bras depuis une source au milieu ; la spirale, un tourbillon qui enroule deux bras de lumière ; les anneaux, l'eau qui jaillit du centre par battements et qui se fripe ; la fontaine, un jet qui monte et retombe (sa lumière coule) ; la pluie, des gouttes qui se roulent en champignons ; l'hélice, un jet montant qui se balance ; les lucioles, des étincelles avec chacune son remous. Une belle parade donne plus de lumière et un peu plus de place, jamais plus de force. Son écho, plus petit, un peu après.
- **Ce qu'on voit** : dans le noir, une lumière ajoutée à l'eau, aux couleurs des deux (`INK_PEAK`, 0,34 d'opacité au plus, jamais de tache blanche) ; en eau claire, où une lumière ajoutée tourne au blanc, un nuage de couleur posé sur l'eau, comme un frai qui trouble la mer ; entre les deux, un mélange des deux. Les lueurs de la parade (`lueur.ts`) et les œufs (« La ponte ») sont portés par ce courant.
- **Coût** : l'eau avance d'un pas de jeu sur deux (0,6 à 0,9 ms par pas sur un ordinateur), ses pixels ne sont refaits que quand elle a bougé, et elle s'endort dès que plus rien n'y bouge ni n'y brille : hors parade, elle ne coûte rien.
- Dans le code : `src/monde/fluide.ts` (le fluide et ses encres, pur, testé), `remous.ts` (les battements et les figures, purs, testés), `parade-eau.ts` (le branchement et le dessin), appelé par `parade-jeu.ts`. Pour les tests : `monde.parade.water` (`fluid`, `place(x, y)`, `colours(h1, h2)`, `figure(lueur, at, qualité)`, `gust(…)`, `flow(x, y)`) ; `monde.skip.add('ink')` éteint sa lumière.

### La ponte

Rien n'est imposé : la portée ne se jette plus sur la mer à la fin de la danse à deux.

- **Après la danse à deux** : la ponte suit l'accouplement que l'on a déclenché (voir « La parade ») ; elle ne vient jamais d'une parade qu'on n'a pas menée jusque-là.

- **Les œufs dans l'eau** : quatre œufs d'or pâle, chacun avec son enfant lové dedans (c'est son corps, dessiné petit : on le reconnaît, comme sur les traces de la lignée), sont pondus un à un (toutes les 0,3 s) là où la danse à deux a fini, face à face, dans sa figure de lumière, entre les deux danseurs. Ce sont des choses de l'eau (`oeufs.ts`) : le courant de la danse les emporte un peu, leur gelée les tient ensemble et les ramène autour de l'endroit de la ponte, ils se balancent chacun à sa façon, s'étirent quand ils bougent et se rarrondissent au repos ; ils luisent doucement (on les voit aussi dans le noir).
- **Les faire éclore** : on reste près d'eux (à moins de 110, 1,6 s, après les 1,6 s de la figure de lumière) ; ils tremblent et brillent de plus en plus, puis la portée s'ouvre. C'est le même geste que pour un partenaire : rester près, c'est dire oui. Si l'on s'en va, rien ne s'ouvre.
- **Plus tard** : l'écran de la portée a un bouton « Plus tard : les œufs t'attendront ici » (ou Échap). Les œufs restent où ils sont ; pour rouvrir la portée, il faut s'en éloigner (180) puis revenir rester près d'eux. Ce sont les mêmes quatre enfants (la même graine de `brood`).
- **L'éclosion** : une fois la portée décidée (un enfant choisi, ou « Les laisser éclore »), les œufs éclosent là où ils sont, l'un après l'autre, l'enfant choisi d'abord : l'œuf s'étire, tremble, se fend en deux, et l'enfant en sort, petit (30 % de sa taille), puis grandit jusqu'à sa taille en 7 s (`engine3/grow.ts`, qui agrandit une créature vivante sans à-coup) ; les deux moitiés de la coquille s'écartent et s'effacent. L'enfant choisi est joué dès sa sortie : la scène de l'adieu commence à son œuf. Les autres vivent là, près du parent ; sans choix, les quatre. En sortant, les nouveau-nés remuent et allument un peu l'eau de la danse.
- **Une ponte à la fois** : une nouvelle parade fait éclore les œufs de l'ancienne (ses quatre enfants vivent là où ils étaient pondus) et pond les siens. Les œufs ne sont pas gardés dans la sauvegarde : un rechargement les efface.
- Dans le code : les règles de l'attente dans `src/monde/ponte.ts` (pures, testées), les œufs dans `oeufs.ts` (purs, testés), leur dessin dans `oeufs-draw.ts`, le jeu dans `ponte-jeu.ts`. Pour les tests : `monde.ponte.clutch` (`x`, `y`, `eggs`, `kids`, `hold`, `armed`, `crosses`), `monde.ponte.open()`, `monde.ponte.hatch(i)` (−1 : sans choix), `monde.ponte.hatching`, `monde.ponte.newborns`, `monde.portee.hatchAll()`, `monde.portee.later()`. `monde.openPortee(partenaire, qualité)` pond les œufs à côté du nageur et ouvre leur portée tout de suite.

### La portée

- 4 œufs éclosent, avec 4 enfants générés par la fusion du parent et du partenaire.
- L'écran montre ce que chacun a hérité du parent et du partenaire.
- Tu choisis 1 enfant parmi 4 : c'est lui que tu joues ensuite.
- Dans le code : `brood` (`src/content/portee.ts`) fait les 4 enfants avec `fuse` en mode « mélange », une part du partenaire de 30, 37, 43 et 50 % (40 % en moyenne), et note d'où vient chaque membre et à qui ressemble le corps. Chaque enfant reçoit au moins un membre du côté qui ne lui a pas donné son corps.
- Les **traits voulus** sont ceux qui franchissent l'obstacle du chapitre (`KEYS`, `src/monde/obstacles.ts`) ; sans obstacle, ceux du partenaire que le parent n'a pas. Les membres du partenaire qui les apportent (`limbTraits`, lu avec `traitsOf` de `src/content/traits.ts`) vont à 1 enfant après une parade ratée, 2 à mi-chemin, 3 après une parade parfaite (`carriers`) : jamais à aucun, jamais aux 4, pour qu'il reste un choix.
- L'écran (`src/monde/portee-ecran.ts`) : quatre œufs qui tremblent puis fondent, chacun sur son portrait (`snapshot3`), son nom (le début du nom du parent, la fin de celui du partenaire) « de Première : Corps, Cil… / de Méduse lune : Filament… », puis ses traits, en or ceux qui franchissent l'obstacle du chapitre. Sous le titre, une ligne le dit (`broodNote`) : « Les traits en or franchissent le mur d'algues. », ou, quand aucun enfant ne passerait, « Aucun ne franchira le mur d'algues : tu peux laisser les œufs et chercher un autre partenaire. ». On touche un enfant, puis « Continuer avec … » : son œuf éclot le premier, il devient la créature jouée dès sa sortie, et le parent rejoint la lignée de la sauvegarde (`partie.born`) ; les trois autres éclosent après lui et vivent là. Ou « Les laisser éclore : ils vivront ici » : les quatre sortent de leurs œufs et vivent là, on reste le parent et on cherche un autre partenaire (les indices s'éveillent si aucun ne franchissait). Ou « Plus tard » (voir « La ponte »).
- Pour l'ouvrir : `monde.openPortee(partenaire, qualité)` (un id du bestiaire ou une espèce, qualité de 0 à 1), ou, avec `?dev`, le bouton « Une portée avec un partenaire d'ici » du panneau ⚙ (un partenaire du chapitre, `PARTNERS`). Après une parade, ce sont ses œufs qui l'ouvrent, avec sa qualité (« La ponte »).

### Les indices

Le jeu guide vers le bon partenaire, sans flèche ni chiffre, dans la voix de la lignée et par la lumière (`src/monde/indices.ts`, pures et testées ; jeu `indices-jeu.ts`).

- **Quand** : les indices d'un chapitre s'éveillent la première fois que son obstacle nous retient (là où il dit ses mots, à mi-chemin de son approche), ou quand on laisse pour plus tard une portée dont aucun enfant ne le franchirait. Ils se taisent dès que le corps joué le franchit.
- **Les mots** : quand on ressort de la portée de l'obstacle, la lignée dit qui avait ce qu'il fallait : la citation « L'indice : » du chapitre, dans [chapitres.md](chapitres.md), une fois par chapitre et par visite, dès qu'aucun autre texte n'est à l'écran.
- **Le fil de lumière** : tant qu'on ne peut pas franchir, toutes les 3,4 s, huit petites lueurs dorées (l'or des partenaires) partent du nageur et filent vers le partenaire le plus proche qui ferait l'affaire, à la vitesse de la nage, en ondulant ; elles s'éteignent au bout de 2,4 s. Des œufs pondus qu'on n'a pas encore ouverts, ou dont un enfant franchirait, passent avant. À moins de 420 de lui, le fil s'arrête et ce partenaire appelle : deux lueurs montent de lui toutes les 1,5 s. Rien pendant une parade, la portée ou l'adieu.
- **Le bon partenaire** : un partenaire qui a le trait ne le transmet pas toujours, car le corps fin, la pulsation et la carapace tiennent au tronc, et un enfant peut garder le nôtre (l'anguille est fine, ses enfants avec la larve ne le sont jamais). Le fil mène donc aux partenaires dont quatre portées d'essai avec la créature jouée (`SAMPLE`, qualité 0,5) ont le plus souvent un enfant qui franchit ; ces portées se calculent une par pas de jeu (1 à 3 ms), la première fois ; en attendant, ceux qui ont le trait.
- **Pour les tests** : `monde.indices.felt` et `told` (les chapitres éveillés, ceux dont l'indice est dit), `monde.indices.lead` (où mène le fil), `monde.indices.right(chapitre)`, `monde.skip.add('guide')` (sans le fil).

### L'adieu

- Un texte de deux à quatre lignes, dans la voix du « nous » (voir [chapitres.md](chapitres.md)).
- Le parent reste dans le monde, là où tu l'as quitté (voir « Les ancêtres »).
- **Dans le jeu** (`src/monde/adieu.ts`, branché par `adieu-jeu.ts` et `farewell` dans `main.ts`) : une scène de 7 à 9 secondes, sans rien à faire.
  - L'enfant sort de son œuf, petit, et grandit pendant la scène (voir « La ponte ») ; il fait une fois le tour du parent, pendant que le parent le suit de la tête. La caméra se rapproche des deux, les bords de la mer s'assombrissent et les boutons s'effacent (`adieu.css`).
  - Le texte d'adieu du chapitre arrive (une ouverture de chapitre attend qu'il s'efface).
  - L'enfant s'écarte un peu, sans hâte, vers la suite de la descente (300 px visés, au pas) ; ses frères et sœurs, sortis de leurs œufs juste après lui, restent autour et vivent leur vie là où ils sont nés. Le parent se penche un peu vers lui, s'arrête et le regarde. La caméra rend la vue peu à peu, autour de l'enfant, le parent encore dans le cadre.
  - On reprend la main dès que l'enfant est à 170 px du parent (`APART`), ou au bout de 9 s ; le texte finit de s'effacer pendant qu'on nage, et c'est nous qui partons, à notre rythme.
  - Le parent nous regarde partir sans nous suivre, tant qu'on est à moins de 520 px (`GONE`, `watchGoal`). Ensuite il reste là où on l'a quitté, d'une visite à l'autre (voir « Les ancêtres ») : il y dérive doucement, et quand on revient il se tourne vers nous et vient un peu à notre rencontre, jusqu'à 90 px de nous (`ROOM`). Les larves-sœurs de la première génération restent avec lui.
  - La naissance est enregistrée dans la partie (`partie.born`).
  - Pour l'essayer : `monde.farewell(enfant)` ; sans enfant, un enfant d'essai est fait par `fuse` avec la première espèce du chapitre. En jeu, le choix d'un enfant de la portée la lance ; la parade ne commence pas pendant la scène, et aucun autre texte (celui d'un obstacle, une ouverture) ne passe par-dessus l'adieu.

## L'hérédité : les traits

Chaque partie du corps apporte un trait utile, qui sert aussi de clé pour franchir les obstacles.

| Trait | Vient de… | Permet | Dans le code (`traitsOf`, `src/content/traits.ts`) |
| --- | --- | --- | --- |
| Nageoires | poissons, raie | Remonter un courant fort | une partie de rôle `fin` : `nageoire`, `caudale`, `rayons`, `aile`, `collerette`, mais aussi les pléopodes et l'éventail des crustacés |
| Lanterne / photophores | baudroie, cténophore | Voir dans le noir, attirer, ouvrir des passages sombres | une partie de rôle `light` (`lanterne`, `photophore`), ou toute lueur (`color.glow`), tronc compris |
| Pinces | crabe, homard | Écarter des algues denses, briser du corail mort | une partie de rôle `jaw` en `plates` (`pince`, `pinceHomard`, patte ravisseuse) ; pas la tête de la tortue |
| Corps fin (ver) | vers, anguille | Passer dans les failles étroites | tronc dont la longueur fait au moins **15 fois** son plus grand rayon (anguille 19, axolotl 12) |
| Carapace / plaques | crustacés, nautile | Supporter la chaleur des sources, le froid, la pression | au moins **40 %** de la surface de l'animal (chaque copie de chaque partie) en `plates` : le crabe l'a par ses pattes et ses pinces |
| Pulsation (ombrelle) | méduses | Monter ou descendre verticalement, flotter dans les zones sans fond | nage `bell`, ou tronc en mouvement `pulse` d'ampleur au moins **0,15** (les méduses battent à 0,16 et plus, le manteau du calmar à 0,1) |
| Filaments | méduses, siphonophores | Se laisser porter par le courant, s'accrocher | un long fil souple : partie de rôle `whip`, `sting` ou `deco` d'au moins **8 maillons** et de souplesse (`flex`) au moins **0,3** (`filament`, `tentacule`, `brasOral`, `bras`, `couronne`…) ; pas les piquants raides |
| Cils | cténophore, vers | Écarter la vase, trouver ce qui est enfoui | une partie de rôle `cilia` (`cils`, `peigne`) |

Les traits se lisent sur le rôle, le style et la forme des parties, jamais sur leur nom (les espèces les renomment). Une partie marquée `bud` (« ébauche ») n'apporte aucun trait : ce sont la queue, la lueur et les cils de la larve de départ, qui naît donc sans trait ; ses enfants gardent ces ébauches, et leurs traits leur viennent du partenaire. Les seuils sont dans `TRAIT_THRESHOLDS`. Dans le bestiaire, la larve, l'étoile de mer et l'oursin n'ont aucun trait ; la tortue n'a pas de carapace (son tronc n'est pas en plaques).

- Un enfant hérite d'environ **60 % des traits de son parent** et d'environ **40 % du partenaire**. Des traits peuvent donc se perdre, et c'est un choix.
- **Toujours une solution** : chaque obstacle a au moins deux traits capables de le franchir, et le biome propose les partenaires qu'il faut. On ne peut jamais se bloquer.
- Les traits se lisent sur la définition de l'espèce (son arbre de parties) : ils sont déduits du corps, jamais donnés à part. Un trait est « visible » : on voit la partie qui l'apporte.
- Le moteur associe déjà certaines parties au déplacement (`drive` : traction, rame, marche, ondulation). Un trait peut en tirer un vrai effet de nage : par exemple, des nageoires qui rament donnent la force de remonter un courant.

## Les obstacles, sans danger

Décision : **zéro danger** ([décisions](decisions.md)). Rien ne blesse, rien ne tue, rien n'arrache une partie du corps.

- **Les prédateurs** passent, poursuivent parfois, mais ne touchent jamais. Ils donnent de la tension par leur taille et leur lenteur (se cacher dans le kelp de la Forêt).
- **Les contraintes du milieu** restent des obstacles (proposition à confirmer) : courants qui repoussent, froid qui ralentit, chaleur qui oblige à reculer, noir qui cache le chemin sauf avec une lanterne. Elles bloquent le passage tant qu'on n'a pas le trait, sans jamais faire de mal.
- Pas de combat, pas de barre de vie, pas de game over.

## Le chant

- Chaque génération apprend une note de son biome : un motif sonore et lumineux, joué par un geste du doigt.
- Le chant sert à ouvrir des passages (certains animaux répondent), à appeler les ancêtres, et c'est la clé de la fin.
- Le chant complet : une note par chapitre de descente, soit 9 notes avec la Grotte et le Glacier (proposition, voir la question 3 des [décisions](decisions.md#questions-ouvertes)).
- On chante avec un bouton en bas de l'écran, qui ouvre un cercle de notes à tracer du doigt.
- **Dans le jeu** (les règles dans `src/monde/chant.ts`, pures et testées ; le jeu dans `chant-jeu.ts`, le cercle dans `chant-cercle.ts`, la voix dans `chant-son.ts`) :
  - **Les notes** : neuf, une par chapitre de la descente (la Remontée n'en a pas). Leur nom est lu dans [chapitres.md](chapitres.md) (la ligne « Note : « … » » de chaque chapitre). Chacune a la couleur de son chapitre, sa forme (un éclat, un battement, une vague, des ondes, une spirale, une flamme, un cristal, une ombrelle, un cercle vide) et son timbre ; elles descendent la gamme pentatonique de ré, du la aigu de l'éclat au ré grave du silence, pour que tout chant sonne juste.
  - **Apprendre** : la note d'un chapitre s'apprend la première fois qu'on y entre, par la génération qu'on y joue, une fois l'ouverture dite et la mer tranquille un moment (aucun texte, aucune scène, aucun panneau). Elle fleurit autour du nageur (deux cercles et sa forme, sa voix), le bouton s'allume de sa couleur et la lignée dit « Ici, nous avons appris l'éclat. ». La partie la garde (`notes`, avec le rang de la génération) ; une partie sauvée avant le chant connaît les notes des chapitres d'avant le sien. L'arbre de la lignée dit ce que chaque génération a appris (« a appris le battement et le frôlement »).
  - **Le bouton** : rond, en bas au milieu, dès la première note ; caché pendant l'adieu, la portée et l'arbre.
  - **Le cercle** : les notes apprises autour du nageur, dans l'ordre de la descente à partir du haut, chacune avec son nom ; les autres ne sont qu'un point. On trace du doigt d'une note à l'autre (un doigt rapide n'en saute pas) : chaque note sonne quand on la touche, et le trait prend sa couleur. Toucher une seule note la chante ; toucher à côté sans tracer ferme le cercle. Douze notes au plus, jamais deux fois la même de suite. Au clavier : 1 à 9, Entrée pour chanter, Retour arrière, Échap. La mer continue pendant qu'on chante ; la parade ne commence pas et les textes attendent.
  - **Chanter** : quand le doigt se lève, le nageur chante les notes une à une (une demi-seconde entre deux), chacune en un grand cercle de sa couleur.
  - **Qui répond** : un animal à moins de 760 px répond à la note de son chapitre ; un animal qui brille (lanterne, lueurs) répond à tout chant, dès sa première note. Les huit plus proches répondent, chacun une fois, quand la note les a atteints : un cercle et un halo de la couleur de la note, sa forme au-dessus de lui, son écho une octave plus haut, à gauche ou à droite selon où il est. Puis il vient un peu vers le nageur (à 150 px), et retourne à sa vie. Les sœurs de la première larve nagent avec nous et ne répondent pas ; un ancêtre laissé dans le monde répond à la note de son chapitre.
  - **Le passage** : celui de la Fosse (le noir et le silence, « lanterne, chant ») revient aux lumières qui répondent dans la Fosse (son moment fort, [chapitres.md](chapitres.md), un chantier à part), branchées sur chaque note chantée (`onNote`). Ailleurs, le chant n'ouvre aucun obstacle : l'hérédité reste le seul moyen de les franchir.
  - **Pour les tests** : `monde.chant.learned` (les chapitres dont on sait la note), `learn('recif')`, `sing(['nurserie', 'recif'])`, `open()`, `close()`, `isOpen`, `answers` (qui répond au chant en cours), `onNote((chapitre, rang) => …)` appelé pour chaque note chantée.
- **À la Remontée**, la créature finale joue d'elle-même le chant complet, les neuf notes l'une après l'autre, chacune de sa couleur et de sa voix (`onNote` de `src/monde/remontee-jeu.ts`, voir [chapitres.md](chapitres.md#10-la-remontée-du-fond-à-la-surface)).

## L'arbre de la lignée

- Un écran accessible à tout moment montre l'arbre des générations, avec le portrait de chaque ancêtre, son nom, le partenaire et le lieu de naissance.
- Tu peux nommer chaque génération.
- À la fin, cet arbre passe en générique, puis devient une image souvenir à télécharger (sauf dans le lien Artifact, où les téléchargements sont bloqués) : voir « Le générique et l'image souvenir » ci-dessous.
- **Dans le jeu** (`src/monde/arbre-ecran.ts`, la logique pure dans `arbre.ts`) : un bouton rond en haut à gauche (à droite de ✎ quand l'Atelier est là), caché pendant l'adieu et la portée.
  - Les générations descendent comme la lignée, de la première larve (en haut) à celle qu'on joue (en bas, cerclée d'or, « aujourd'hui ») ; l'écran s'ouvre centré sur elle.
  - Pour chacune : son portrait (`snapshot3`) dans un médaillon, « Troisième génération » (en toutes lettres, pas de chiffres), son nom, « née au Récif ». Le lieu de naissance n'est pas gardé à part : c'est le chapitre où la génération d'avant a donné naissance, la Nurserie pour la première.
  - Entre un parent et son enfant, sur le fil d'or, le partenaire : son petit portrait (l'espèce du bestiaire) et « avec Méduse lune », en bleu pâle comme dans la portée. Les naissances sauvées avant l'arbre n'ont pas de partenaire : le fil continue sans lui.
  - **Nommer** : on touche un nom, on l'écrit (24 lettres au plus), Entrée ou toucher ailleurs le garde, Échap l'annule. Le nom est celui de la créature (`name` de sa définition) : celui de la génération jouée compte donc pour ses enfants, dont le nom commence comme celui du parent.
  - Le jeu s'arrête pendant que l'arbre est ouvert, et les textes attendent. On le ferme par ×, Échap ou en touchant à côté ; la croix reste dans le coin, au-dessus des générations qui défilent, même tout en bas de l'arbre.
  - **Les portraits vivants** (`src/monde/arbre-vivant.ts`, les tours dans `arbre-tours.ts`, purs et testés) : chaque génération et chaque partenaire nage sur place dans son médaillon, le portrait le suit, et de temps en temps il fait un tour, deux à la fois au plus, toutes les 5 à 12 secondes chacun. Des tours doux et un peu drôles, que les animaux ne font jamais dans la mer (voir [La vie des animaux](direction-artistique.md#la-vie-des-animaux)) :
    - la **culbute** : un looping lent sur lui-même, le nez en l'air d'abord ;
    - le **bond** : il se tasse, s'étire en sautant, s'écrase un peu en retombant, et lâche une bulle ;
    - le **coucou** : il sort du médaillon d'un côté, revient par l'autre, s'arrête au bord pour regarder, tourné vers nous, puis rentre chez lui ;
    - les **bulles** : tourné un peu vers nous, il souffle des bulles, la dernière plus grosse ;
    - la **photo** : il se tourne face à nous, un petit sursaut pour la photo, et repart ;
    - la **sieste** : il s'assoupit, la tête penchée, s'enfonce un peu, respire lentement en lâchant de petites bulles, puis se réveille en sursaut ;
    - la **toupie** : une pirouette sur place (une méduse, qui n'a pas de côté à montrer, se dandine).
    - Les méduses ne font pas la photo ; les marcheurs marchent sur place, la tête tenue à sa hauteur comme par le fond.
  - **Toucher un portrait** le fait rire : il se tortille vite, tremble, saute un peu et lâche trois bulles.
  - **À l'ouverture**, une lumière descend le fil d'or, de la première larve à la génération jouée, et chacun fait un petit bond quand elle passe (les partenaires quand elle passe leur nœud) ; arrivée en bas, l'anneau d'or d'« aujourd'hui » brille un moment. Puis, 14 à 20 secondes après l'ouverture, et ensuite toutes les 40 à 70 secondes, **la photo de famille** : tous ceux qu'on voit se tournent vers nous en même temps (les méduses sautillent), un éclair très doux, et chacun retourne à sa vie.
  - Seuls les médaillons à l'écran bougent ; la créature d'un médaillon est faite la première fois qu'il se montre, et gardée d'une ouverture à l'autre. Les portraits sont dessinés par le processeur (`willReadFrequently`) : une douzaine de petits canvas redessinés par la carte graphique à chaque image faisaient tomber l'arbre de 57 à 30 images par seconde. Ils se dessinent dans un budget de 6 ms par image : tous à chaque image sur un ordinateur (environ 3 ms pour douze), quelques-uns à tour de rôle sur un appareil lent, où chacun bouge moins finement mais la page reste fluide. Avec « réduire les animations » du système, les portraits restent fixes, comme avant.
  - Pour les tests : `monde.arbre.vivants.play(i, tour)` (i : le rang du médaillon, partenaires compris, dans l'ordre de l'arbre ; tours : `culbute`, `bond`, `coucou`, `bulles`, `pose`, `sieste`, `toupie`, `rire`, `vague`), `vivants.stats` (`live`, `made`, `played`, `ms`).
  - Pour les tests : `monde.arbre.open()`, `close()`, `rename(rang, nom)` (1 : la première génération), `isOpen`.

### Reprendre une espèce

Une forme choisie peut déplaire (une nage pénible, un aspect qui ne nous va pas) : on peut reprendre celle d'une génération d'avant, sans rien perdre (`src/monde/retour.ts`, pur et testé ; la scène dans `retour-jeu.ts`).

- **Jusqu'où** : toutes les générations de notre lignée, de la première larve à la dernière quittée, sauf celle dont on a déjà la forme. Pas les frères et sœurs des portées : la partie ne les garde pas.
- **Le geste** : dans l'arbre, sous chaque génération d'avant, « Reprendre cette espèce ». Une confirmation dans l'arbre même : « Redevenir Larve, ici ? », « Prepode restera là où nous sommes, parmi les nôtres. », « Reprendre » ou « Non ». Le bouton n'est pas là pendant un adieu, une parade, la portée, la Remontée ou le générique.
- **Où** : là où l'on est, dans le chapitre où l'on nage. Celle qu'on quitte reste là, comme un parent après l'adieu, et y nagera aux visites suivantes ; des lueurs dorées partent d'elle et s'assemblent un peu devant, où la forme reprise sort de leur lumière, petite, et grandit en deux secondes et demie. La lignée dit « Nous reprenons une forme d'autrefois. / Celle que nous étions nage ici, parmi les nôtres. », sous le nom de la forme reprise. On garde la main pendant la scène.
- **L'obstacle** : on garde la forme reprise même si elle ne franchit pas l'obstacle du chapitre ; ses indices s'éveillent, et le fil de lumière mène aux partenaires qui feraient l'affaire pour elle. Rien n'est perdu : celle qu'on a quittée est dans l'arbre, on peut la reprendre à son tour.
- **La lignée et la sauvegarde** : ce n'est pas une naissance. Celle qu'on quitte entre dans la lignée comme un parent (avec sa place, `at`), mais sans partenaire et avec `back`, le rang de la génération dont on reprend la forme ; la créature jouée est une copie de celle-ci (même nom, mêmes parties). Dans l'arbre, le générique et l'image souvenir, le fil d'or dit « retour à Larve » entre les deux, et la forme reprise est « reprise au Récif » au lieu de « née au Récif ». Les générations se comptent toujours dans l'ordre où on les a jouées. Dans la Balade libre, la forme reprise est seulement jouée : la lignée reste celle de l'histoire.
- Pour les tests : `monde.retour.take(k)` (k : 0 pour la première génération), `retour.can`, `retour.on`.

### Le générique et l'image souvenir

- **Le générique** (`src/monde/generique-ecran.ts`, la logique pure dans `generique.ts`) : à la fin de l'histoire, toute la lignée monte à l'écran, lentement, comme un générique de film, sur la mer assombrie (le jeu attend).
  - En tête, « La Lignée » et « Tous ceux que nous avons été ». Puis chaque génération, de la première larve à la dernière (cerclée d'or) : son portrait dans un médaillon teinté de l'eau du chapitre où elle est née, « Troisième génération », son nom, « née au Récif », et les notes du chant qu'elle a apprises, en or (« a appris l'éclat », comme dans l'arbre). Entre deux générations, un bout de fil d'or et le partenaire, en bleu pâle : son petit portrait et « avec Méduse lune ».
  - Après la lignée, les **Sons** : ceux qui ont publié les enregistrements qu'on entend, chacun avec le titre de son son (un lien vers sa source), son nom et sa licence (un lien vers son texte), lus dans `src/monde/sons/credits.json` (`credits-sons.ts`). La même liste s'ouvre à tout moment depuis le panneau ⚙, section « Son », bouton « Les sons et leurs auteurs ».
  - Il finit sur « La Lignée », seul au milieu de l'écran, un moment, puis l'image souvenir vient à sa place.
  - Environ 52 px par seconde, plus vite pour une très longue lignée (deux minutes au plus) : une quarantaine de secondes pour dix générations. Un doigt (ou Espace) posé le presse ; « Passer » (ou Échap) mène tout de suite à l'image. Avec « réduire les animations » du système, l'image vient sans défilement.
  - **Le déclencher** : `generique.play()` (`monde.generique` dans la console), que la fin de la Remontée appelle quand la lignée a percé la surface. Pour les tests, le panneau ⚙ a un bouton « Le générique de fin » avec `?dev`.
  - Quand il est allé au bout (ou qu'on l'a passé), l'histoire est finie : la Balade libre est ouverte (dès la fin de la Remontée, voir « La Balade libre » ci-dessous), et l'Atelier revient.
- **L'image souvenir** (`src/monde/generique-image.ts`) : l'arbre dessiné dans un canvas, comme une tranche de la mer descendue.
  - 1 080 px de large, et haute de ce que demande la lignée (environ 4 000 px pour dix générations) ; une très longue lignée est réduite pour tenir dans 12 000 px de haut, ce qu'un téléphone garde encore dans un canvas.
  - L'eau derrière chaque génération est celle de son chapitre (`bandColour`, assez sombre pour les lettres claires) : claire en haut, sous la surface, de plus en plus sombre jusqu'à la dernière, avec des rayons et de la neige marine. Le fil d'or, les médaillons, les noms, les notes apprises et les partenaires comme dans l'arbre ; en bas, le texte final de la Remontée (lu dans [chapitres.md](chapitres.md)) et « La Lignée ».
  - Montrée dans un cadre qu'on fait défiler, avec « Garder l'image » : un JPEG (qualité 0,9, 300 à 400 Ko pour dix générations) téléchargé sous le nom de la dernière génération, `la-lignee-aube.jpg`. On peut aussi appuyer longuement sur l'image, là où le navigateur le permet.
  - **Pas de bouton dans le lien Artifact** de claude.ai, dont le cadre bloque les téléchargements (`downloadsBlocked`) : la page servie depuis `claudeusercontent.com`, ou dans un cadre ouvert depuis `claude.ai` ou `claude.site`. `?artifact` dans l'adresse fait de même, pour les tests. L'image y est montrée quand même.
  - Une fois l'histoire finie (dans la Balade libre), l'arbre de la lignée a un bouton « L'image souvenir » sous les générations, qui la montre de nouveau, avec la lignée de l'histoire (et toujours avec `?dev`).
  - Les portraits (`snapshot3`) sont dessinés pendant le générique, quelques-uns par image ; l'image se dessine ensuite en un quart de seconde environ, même si on passe le générique tout de suite.
  - Pour les tests : `monde.generique.play()`, `souvenir()` (l'image seule), `skip()`, `close()`, `stage` (`'roll'`, `'souvenir'` ou `''`), `image` (le canvas), `canKeep`.

## Les ancêtres

- Chaque parent laissé derrière toi reste dans le monde. En revenant en arrière, tu le retrouves qui nage là où tu l'as quitté.
  - **Dans le jeu** : la scène de l'adieu range le parent dans la lignée avec sa place (`at`, `partie.born`) : x compté depuis le début de son chapitre, pour qu'elle survive à un déplacement des chapitres sur la carte, et y la profondeur. À l'ouverture de la page, chaque ancêtre de la sauvegarde revient à sa place (`homesOf`, `src/monde/ancetres.ts`, avec la carte du jeu dans `ancetres-jeu.ts`), gardée dans l'étendue de son chapitre et dans l'eau libre ; il y nage comme le parent qu'on vient de quitter (`stayGoal`, `adieu.ts`). Les larves-sœurs restent avec la première génération.
  - Un ancêtre d'une sauvegarde plus ancienne, sans place, est posé dans son chapitre, là où l'on rencontre les partenaires, à mi-eau ; plusieurs dans un même chapitre sont écartés. Un ancêtre dont le chapitre n'existe plus, ou dont la créature ne se lit plus, reste dans la lignée mais pas dans le monde.
  - Revenir en arrière ne fait pas reculer la partie : la sauvegarde garde le chapitre le plus avancé (`reachChapter`), pour qu'un rechargement ne nous remette pas avant un obstacle déjà franchi.
  - Pour le voir : `monde.ancestors()` (les acteurs `parent`), `monde.partie.lineage` (avec `at`) ; deux `monde.farewell()` dans deux chapitres, rechargement, puis `monde.teleport` et la nage en arrière.
- Plus bas, tu trouves des traces de ta lignée : une carcasse de parent devenue récif, une mue, des œufs non éclos.
- **Les traces dans le jeu** (`src/monde/traces.ts`, pures et testées ; dessin `traces-draw.ts`, jeu `traces-jeu.ts`) :
  - Chaque ancêtre de la sauvegarde (`partie.lineage`) laisse une trace **deux chapitres plus bas** que celui où il a donné naissance : le parent qu'on vient de quitter nage encore là où on l'a laissé, c'est plus loin qu'on retrouve sa trace. Rien avant la première naissance ; rien sous le fond de la Fosse. Le Jardin n'a pas de fond : ce qui devait s'y poser tombe jusqu'à la Fosse.
  - Les traces viennent **à tour de rôle** : les œufs non éclos (la première génération), la mue, le corps devenu récif, puis de nouveau les œufs. Trois générations montrent donc les trois : avec une naissance par chapitre, les œufs de la larve sont dans la Forêt, une mue dans la Grotte, un corps devenu récif au pied de la baleine de la Carcasse.
  - Chacune est faite du **corps même de l'ancêtre**, pour qu'on le reconnaisse : la mue est sa forme exacte, pâle et vide, fendue sur le dos ; le récif est son corps couché, blanchi comme les os de la baleine, couvert de coraux, d'anémones et d'éponges aux couleurs du Récif et du chapitre, à moitié pris dans le sable ; les œufs sont un amas d'œufs clairs à ses couleurs, chacun avec sa petite forme recroquevillée dedans. La mue et le récif sont un peu plus grands que la lignée ne nage, pour qu'on les voie de loin.
  - Elles reposent sur le fond, juste derrière le plan de nage (devant les os de la Carcasse), à une place fixe de leur chapitre, à l'écart des reliefs ; une petite lueur les signale dans le noir de la Grotte et de la Fosse.
  - La première fois qu'on s'en approche (dans la session), la lignée dit le texte de cette trace ([chapitres.md](chapitres.md#les-traces-de-la-lignée)), sous le nom de l'ancêtre (celui qu'on lui a donné dans l'arbre, s'il a été renommé), et la lueur de la trace s'avive le temps des mots. Rien ne se dit pendant un adieu ni par-dessus d'autres mots ; une ouverture de chapitre attend la fin de ceux d'une trace.
  - Chaque trace est dessinée une seule fois, à la première approche (quelques millisecondes), puis seulement relavée par l'eau.
  - Pour les tests : `monde.traces.list` (les traces, avec leur position), `monde.skip.add('trace')` (sans elles, pour des captures avant / après).
- À la Remontée, tous les ancêtres remontent avec toi, en formation : chacun vient avec la note qu'il a apprise, puis la lignée remonte en V derrière toi (voir [chapitres.md](chapitres.md#10-la-remontée-du-fond-à-la-surface)).

## Contrôles et interface

- **Un doigt** : nager en suivant le doigt (en place).
- **Deux doigts** : zoomer (en place).
- **Chanter** : un bouton en bas, qui ouvre le cercle de notes.
- **Écran de la lignée** : l'arbre, accessible à tout moment par le bouton en haut à gauche (voir « L'arbre de la lignée »).
- **Interface minimale** : pas de chiffres. Le texte narratif est la seule vraie interface.
- **Le son** : la musique et le chant se règlent dans le panneau ⚙, section « Son » ([direction artistique](direction-artistique.md#le-son)).
- **L'Atelier** n'est pas dans l'histoire : il revient après la fin, dans la « Balade libre » (décision validée, voir ci-dessous). Son bouton ✎ est caché pendant l'histoire, et pendant une nouvelle histoire commencée après une fin (`applyAtelierAccess`, `src/monde/atelier-access.ts`). Pour le développement, `?atelier` ou `?dev` (qui montre aussi le voyage du panneau ⚙) dans l'adresse le montre toujours ; `monde.unlockBalade()` ouvre la Balade dans la console.

## La Balade libre

Après la fin : la même mer, ouverte partout, sans histoire, avec l'Atelier.

- **Quand** : à la fin de la Remontée, quand la lignée a percé la surface, et pour de bon dans cette partie. Une fois le générique et l'image souvenir fermés, la lignée le dit une fois, sous le nom « La Balade libre » (la citation « La Balade libre : » de la Remontée, dans [chapitres.md](chapitres.md#10-la-remontée-du-fond-à-la-surface)), et les boutons ✎ et ⚙ luisent doucement un moment.
- **Le monde entier ouvert** : tous les obstacles sont franchis, quel que soit le corps (une créature de l'Atelier n'a pas forcément le trait). On les sent encore un peu, comme avec le bon trait, et le noir ne se referme plus. Le voyage du panneau ⚙ (les dix chapitres) s'ouvre aux joueurs ; voyager referme le panneau.
- **Sans histoire** : la lignée se tait (`narrator.silent`). Plus d'ouverture, seul le nom du chapitre passe ; plus de mots devant les obstacles, d'indices ni de fil de lumière ; plus de mots d'adieu, de traces, de rencontre avec le cousin, ni des lumières de la Fosse. La Remontée ne revient pas : le puits et sa lumière restent, y entrer ne fait rien.
- **Ce qui reste** : la parade, la ponte et la portée (sans traits en or ni ligne sur l'obstacle : rien n'est à franchir), le chant avec toutes les notes de la lignée, les ancêtres à leur place, les traces, la vie des animaux. La larve née à la surface nous suit, même après un rechargement.
- **L'Atelier** : son bouton ✎ revient ; « Nager » joue la créature de l'Atelier.
- **La lignée ne change plus** : la Balade a sa propre créature. Celle de l'Atelier, et l'enfant choisi dans une portée, sont joués sans entrer dans la lignée : l'adieu se fait sans mots, et le parent reste là le temps de la visite. L'arbre et l'image souvenir restent ceux de l'histoire, la créature finale en dernière génération (« aujourd'hui ») ; lui donner un nom dans l'arbre renomme celle de l'histoire.
- **La sauvegarde** (`balade` dans `lignee.partie`) : le chapitre où l'on nage, en avant comme en arrière, et la créature jouée (`null` : la créature finale). La page reprend au milieu de ce chapitre ; la première fois, sous la surface de la Nurserie, là où la lignée est sortie. Le chapitre de l'histoire ne bouge plus (c'est lui qui donne les notes apprises). Une partie finie avant la Balade, dont le navigateur n'a gardé que `lignee.balade` (et qui s'arrêtait à la Remontée), est reprise dans la Balade au lieu de rejouer la Remontée.
- **Recommencer** (panneau ⚙) commence une nouvelle histoire, sans Atelier jusqu'à sa propre fin.
- Dans le code : les règles dans `src/monde/balade.ts` (pures, testées), le jeu dans `balade-jeu.ts`, branché par `main.ts` (`initBalade`, puis `attach` une fois le monde fait), la sauvegarde dans `partie-jeu.ts`. Pour les tests : `monde.balade.on`, `monde.unlockBalade()` (ouvre la Balade tout de suite), `monde.partie.saved.balade`.

## Durée et sauvegarde

- Durée visée : environ 1 h 30 à 2 h, soit 9 à 12 minutes par chapitre sur 10 chapitres, avec une fin qu'on n'a pas envie de rater.
- Sauvegarde automatique dans le stockage du navigateur (`lignee.partie`, `src/monde/partie.ts`) : le chapitre atteint (le plus avancé : revenir en arrière ne le fait pas reculer), la créature jouée et la lignée (les parents, chacun avec le chapitre où il a donné naissance, son partenaire, `{ id, name }`, l'id du bestiaire servant au portrait de l'arbre, et l'endroit où on l'a quitté, `at`). La partie est sauvée à chaque naissance, à chaque nouveau chapitre et quand l'Atelier change la créature.
- À l'ouverture de la page, on reprend au début du chapitre sauvé, avec sa créature (dans la Balade libre, son chapitre et sa créature à elle) ; une ancienne sauvegarde (`lignee.player`, la créature seule) est reprise à la Nurserie. Le panneau ⚙ a un bouton « Recommencer depuis la Nurserie » (deux touches), et `?nouvelle` fait de même pour les tests.
- À chaque naissance (le choix d'un enfant de la portée), la scène de l'adieu (`farewell`, `main.ts`) appelle `monde.partie.born(enfant, chapitre, partenaire, place)`, qui range le parent dans la lignée avec son partenaire et l'endroit où on l'a quitté. Les portraits, s'ils sont gardés, iront plutôt dans IndexedDB ([décisions](decisions.md)).
