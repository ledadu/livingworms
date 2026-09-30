# Les mécaniques

Comment on joue : la boucle d'un chapitre, la reproduction, l'hérédité, le chant, la lignée. Repris du [plan v1](plan-v1.md) avec les [décisions](decisions.md) (zéro danger, 10 chapitres). Les liens vers le code disent sur quoi chaque mécanique peut s'appuyer ; ce qui n'existe pas encore est marqué « à construire ».

## La boucle d'un chapitre

```
Arriver dans un nouveau biome (texte d'ouverture)
   → Explorer, observer la vie locale
   → Trouver l'OBSTACLE qui bloque la descente
   → Découvrir quelle ESPÈCE locale sait le franchir
   → La rejoindre, nager avec elle : la PARADE
   → La PORTÉE : choisir 1 enfant parmi 4
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
- **On ne se bloque jamais** : les partenaires d'un chapitre apportent, par leur corps, chacun des traits qui franchissent son obstacle (`uncovered`, testé contre les traits de chaque espèce). Le chant de la Fosse n'est pas un trait du corps : il viendra à l'étape 5.

### La parade

- Un court moment de nage synchronisée : tu suis ou imites le partenaire (le suivre sans le perdre, passer dans son sillage, tourner avec lui).
- Environ 20 secondes, **sans échec possible**, seulement plus ou moins réussie.
- La qualité de la parade influence la portée : bien réussie, les enfants héritent davantage des traits voulus.
- Appui dans le code : les animaux savent déjà suivre une cible (`steer`, `src/engine3/creature3.ts`) et nager chacun à sa façon (glisse, cloche, jets, marche). La mesure de la qualité est à construire.

### La portée

- 4 œufs éclosent, avec 4 enfants générés par la fusion du parent et du partenaire.
- L'écran montre ce que chacun a hérité du parent et du partenaire.
- Tu choisis 1 enfant parmi 4 : c'est lui que tu joues ensuite.
- Dans le code : `brood` (`src/content/portee.ts`) fait les 4 enfants avec `fuse` en mode « mélange », une part du partenaire de 30, 37, 43 et 50 % (40 % en moyenne), et note d'où vient chaque membre et à qui ressemble le corps. Chaque enfant reçoit au moins un membre du côté qui ne lui a pas donné son corps.
- Les **traits voulus** sont ceux qui franchissent l'obstacle du chapitre (`KEYS`, `src/monde/obstacles.ts`) ; sans obstacle, ceux du partenaire que le parent n'a pas. Les membres du partenaire qui les apportent (`limbTraits`, lu avec `traitsOf` de `src/content/traits.ts`) vont à 1 enfant après une parade ratée, 2 à mi-chemin, 3 après une parade parfaite (`carriers`) : jamais à aucun, jamais aux 4, pour qu'il reste un choix.
- L'écran (`src/monde/portee-ecran.ts`) : quatre œufs qui tremblent puis fondent, chacun sur son portrait (`snapshot3`), son nom (le début du nom du parent, la fin de celui du partenaire) « de Première : Corps, Cil… / de Méduse lune : Filament… », puis ses traits, en or ceux qui franchissent l'obstacle du chapitre. On touche un enfant, puis « Continuer avec … » : il devient la créature jouée, et le parent rejoint la lignée de la sauvegarde (`partie.born`).
- Pour l'ouvrir : `monde.openPortee(partenaire, qualité)` (un id du bestiaire ou une espèce, qualité de 0 à 1), ou, avec `?dev`, le bouton « Une portée avec un partenaire d'ici » du panneau ⚙ (un partenaire du chapitre, `PARTNERS`). La parade l'appellera à sa fin.

### L'adieu

- Un texte de deux à quatre lignes, dans la voix du « nous » (voir [chapitres.md](chapitres.md)).
- Le parent reste dans le monde, là où tu l'as quitté (voir « Les ancêtres »).

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

## L'arbre de la lignée

- Un écran accessible à tout moment montre l'arbre des générations, avec le portrait de chaque ancêtre, son nom, le partenaire et le lieu de naissance.
- Tu peux nommer chaque génération.
- À la fin, cet arbre devient une image souvenir exportable (sauf dans le lien Artifact, où les téléchargements sont bloqués).

## Les ancêtres

- Chaque parent laissé derrière toi reste dans le monde. En revenant en arrière, tu le retrouves qui nage là où tu l'as quitté.
- Plus bas, tu trouves des traces de ta lignée : une carcasse de parent devenue récif, une mue, des œufs non éclos.
- À la Remontée, tous les ancêtres remontent avec toi, en formation.

## Contrôles et interface

- **Un doigt** : nager en suivant le doigt (en place).
- **Deux doigts** : zoomer (en place).
- **Chanter** : un bouton en bas, qui ouvre le cercle de notes.
- **Écran de la lignée** : l'arbre, accessible à tout moment.
- **Interface minimale** : pas de chiffres. Le texte narratif est la seule vraie interface.
- **L'Atelier** n'est pas dans l'histoire : il est débloqué après la fin, dans la « Balade libre » (décision validée). Son bouton ✎ est caché pendant l'histoire ; il revient quand `lignee.balade` vaut `1` dans le stockage du navigateur (`unlockBalade()`, `src/monde/atelier-access.ts`, à appeler à la fin de l'histoire). Pour le développement, `?atelier` ou `?dev` (qui montre aussi le voyage du panneau ⚙) dans l'adresse le montre toujours ; `monde.unlockBalade()` débloque la Balade dans la console.

## Durée et sauvegarde

- Durée visée : environ 1 h 30 à 2 h, soit 9 à 12 minutes par chapitre sur 10 chapitres, avec une fin qu'on n'a pas envie de rater.
- Sauvegarde automatique dans le stockage du navigateur (`lignee.partie`, `src/monde/partie.ts`) : le chapitre atteint, la créature jouée et la lignée (les parents, chacun avec le chapitre où il a donné naissance). La partie est sauvée à chaque naissance, à chaque nouveau chapitre et quand l'Atelier change la créature.
- À l'ouverture de la page, on reprend au début du chapitre sauvé, avec sa créature ; une ancienne sauvegarde (`lignee.player`, la créature seule) est reprise à la Nurserie. Le panneau ⚙ a un bouton « Recommencer depuis la Nurserie » (deux touches), et `?nouvelle` fait de même pour les tests.
- À chaque naissance (le choix d'un enfant de la portée), `monde.partie.born(enfant)` range le parent dans la lignée. Les portraits, s'ils sont gardés, iront plutôt dans IndexedDB ([décisions](decisions.md)).
