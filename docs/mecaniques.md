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
- Aujourd'hui, les animaux de chaque biome viennent de sa `fauna` (`src/monde/biomes.ts`). Le partenaire compatible est à construire : un marqueur sur l'espèce et sa lueur.

### La parade

- Un court moment de nage synchronisée : tu suis ou imites le partenaire (le suivre sans le perdre, passer dans son sillage, tourner avec lui).
- Environ 20 secondes, **sans échec possible**, seulement plus ou moins réussie.
- La qualité de la parade influence la portée : bien réussie, les enfants héritent davantage des traits voulus.
- Appui dans le code : les animaux savent déjà suivre une cible (`steer`, `src/engine3/creature3.ts`) et nager chacun à sa façon (glisse, cloche, jets, marche). La mesure de la qualité est à construire.

### La portée

- 4 œufs éclosent, avec 4 enfants générés par la fusion du parent et du partenaire.
- L'écran montre ce que chacun a hérité du parent et du partenaire.
- Tu choisis 1 enfant parmi 4 : c'est lui que tu joues ensuite.
- Appui dans le code : la fusion de deux espèces existe (`fuse`, `src/content/generate.ts`, modes et part de B) et sert à l'onglet « Inventer » de l'Atelier. Les portraits se font avec `snapshot3` (`src/engine3/snapshot3.ts`).

### L'adieu

- Un texte de deux à quatre lignes, dans la voix du « nous » (voir [chapitres.md](chapitres.md)).
- Le parent reste dans le monde, là où tu l'as quitté (voir « Les ancêtres »).

## L'hérédité : les traits

Chaque partie du corps apporte un trait utile, qui sert aussi de clé pour franchir les obstacles.

| Trait | Vient de… | Permet | Dans le code (proposition) |
| --- | --- | --- | --- |
| Nageoires | poissons, raie | Remonter un courant fort | parties `nageoire`, `caudale`, `rayons`, `aile`, `collerette` (rôle `fin`) |
| Lanterne / photophores | baudroie, cténophore | Voir dans le noir, attirer, ouvrir des passages sombres | parties `lanterne`, `photophore`, et toute lueur (`color.glow`) |
| Pinces | crabe, homard | Écarter des algues denses, briser du corail mort | parties `pince`, `pinceHomard` (rôle `jaw`) |
| Corps fin (ver) | vers, anguille | Passer dans les failles étroites | tronc long et mince (formes `worm`, `sansue`…), seuil à définir sur longueur et largeur |
| Carapace / plaques | crustacés, nautile | Supporter la chaleur des sources, le froid, la pression | tronc en `plates` |
| Pulsation (ombrelle) | méduses | Monter ou descendre verticalement, flotter dans les zones sans fond | tronc en mouvement `pulse`, ou nage `bell` |
| Filaments | méduses, siphonophores | Se laisser porter par le courant, s'accrocher | parties `filament`, `tentacule`, `brasOral` |
| Cils | cténophore, vers | Écarter la vase, trouver ce qui est enfoui | parties `cils`, `peigne` (rôle `cilia`) |

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
- **L'Atelier** n'est pas dans l'histoire : il est débloqué après la fin, dans la « Balade libre » (décision validée). Aujourd'hui il est ouvert à tous (bouton ✎) : à cacher pendant l'histoire.

## Durée et sauvegarde

- Durée visée : environ 1 h 30 à 2 h, soit 9 à 12 minutes par chapitre sur 10 chapitres, avec une fin qu'on n'a pas envie de rater.
- Sauvegarde automatique dans le stockage du navigateur (`lignee.partie`, `src/monde/partie.ts`) : le chapitre atteint, la créature jouée et la lignée (les parents, chacun avec le chapitre où il a donné naissance). La partie est sauvée à chaque naissance, à chaque nouveau chapitre et quand l'Atelier change la créature.
- À l'ouverture de la page, on reprend au début du chapitre sauvé, avec sa créature ; une ancienne sauvegarde (`lignee.player`, la créature seule) est reprise à la Nurserie. Le panneau ⚙ a un bouton « Recommencer depuis la Nurserie » (deux touches), et `?nouvelle` fait de même pour les tests.
- Les naissances n'existent pas encore : l'hérédité appellera `monde.partie.born(enfant)`, qui range le parent dans la lignée. Les portraits, s'ils sont gardés, iront plutôt dans IndexedDB ([décisions](decisions.md)).
