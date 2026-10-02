# L'animal : du corps aux aptitudes

Une première réflexion, à discuter : comment les caractéristiques d'un animal (son déplacement, ses pouvoirs, ses aptitudes) se lisent dans **le jeu doux** (La Lignée) et dans **le jeu combatif** qui reprendra l'animal façonné ici. Rien n'est encore codé ; les chantiers « La nage : accélération et élan », « Les capacités de nage par corps » et « La fiche de l'animal » ([backlog](backlog.md)) partiront d'ici.

## Le principe : un seul animal, deux lectures

Un animal, c'est **son corps**. La Lignée le dit déjà : un trait « vient d'une partie qu'on voit » ([mécaniques](mecaniques.md#lhérédité--les-traits)), jamais d'un chiffre donné à part. On garde cette règle et on l'étend en trois couches, calculées l'une de l'autre :

```
Corps (Spec : l'arbre de parties, la nage, les couleurs)
  └─► Mesures      : ce que le corps est, en grandeurs physiques (taille, masse, poussée, blindage…)
        └─► Aptitudes : 8 notes de 0 à 1 (vitesse, agilité, robustesse…)
        └─► Capacités : ce que l'animal sait faire (un jet, un bond, des pinces, un éclair…)
```

Les deux jeux lisent **les mêmes valeurs**. Seule la traduction change :

- **Le jeu doux** ne montre jamais de chiffres. Il traduit les aptitudes en sensations (une créature vive, une créature qui plane) et les capacités en façons de franchir le monde. Rien n'y est un échec : toujours une solution.
- **Le jeu combatif** les traduit en règles : points de vie, dégâts, temps de recharge, portée.

## Les règles d'or

1. **Tout se voit.** Une aptitude ou une capacité vient de parties visibles. Si l'animal frappe fort, on voit ses pinces ; s'il est rapide, on voit ses nageoires et son corps effilé.
2. **Aucun animal n'est le meilleur partout.** Les compromis viennent de la physique, pas d'un budget arbitraire : la carapace pèse (robuste, mais lent à accélérer), la grande taille frappe fort mais se voit de loin, le corps fin se faufile mais encaisse mal.
3. **Une fiche, deux jeux.** Les mesures et aptitudes sont calculées une fois, dans un module pur et testé, et exportées telles quelles. Le jeu combatif ne recalcule pas l'animal à sa façon.
4. **Le jeu doux reste doux.** Les aptitudes y changent le plaisir de nager et les chemins possibles, jamais la possibilité de finir. L'hérédité garde son sens premier : ce que le corps transmet.
5. **Versionné.** La fiche porte une version ; changer une formule, c'est une nouvelle version, et un animal ancien se relit toujours.

## Couche 1 : les mesures

Calculées du `Spec`, comme `bodyMeasures` le fait déjà (`src/content/traits.ts` : finesse, plaques, pulsation). On ajoute :

| Mesure | Lue sur | Existe déjà |
| --- | --- | --- |
| **Taille** | longueur du tronc et envergure des parties | en partie (`chain`) |
| **Masse** | surface de chaque partie × densité (les plaques pèsent 2 à 3 fois plus) | non |
| **Finesse** | longueur du tronc / plus grand rayon | oui (`slender`) |
| **Blindage** | part de la surface en plaques | oui (`plated`) |
| **Poussée** | somme des parties qui poussent (`drive` : traction, rame, marche, ondulation), selon leur taille et leur battement | non (le moteur l'utilise sans la chiffrer) |
| **Surface portante** | nageoires, ailes, ombrelle | non |
| **Pulsation** | ampleur du battement du tronc | oui (`pulse`) |
| **Prise** | pinces, mâchoires, bras qui saisissent (`jaw`, `pull`) | non |
| **Piquants** | rôle `sting`, filaments longs | en partie (filaments) |
| **Sens** | yeux, parties `sense`, cils, lanternes | non |
| **Lueur et transparence** | `color.glow`, `alpha` | non |
| **Manière de nager** | `swim.mode` : `steady`, `pulse`, `dart`, `bell`, `jet`, `crawl` | oui |

## Couche 2 : les aptitudes

Huit notes de 0 à 1, chacune calculée de quelques mesures (des formules simples, réglées sur le bestiaire : l'anguille, le crabe, la méduse et la larve servent de repères, comme les seuils de `TRAIT_THRESHOLDS`).

| Aptitude | Monte avec | Baisse avec | Jeu doux | Jeu combatif |
| --- | --- | --- | --- | --- |
| **Vitesse** (pointe) | poussée, finesse, nageoires | masse, traînée (filaments, grande surface) | on traverse vite, on surfe les courants | fuir, poursuivre, se placer |
| **Accélération** | poussée / masse, jets | masse, plaques | l'élan de « La nage » est vif | esquiver, charger |
| **Agilité** (virage) | petite taille, nageoires paires, ondulation | longueur, masse | slalomer entre les coraux | tourner autour d'un adversaire |
| **Endurance** | nage économe (cloche, ondulation), surface portante | jets (coûteux), masse | l'élan se recharge vite | durée des efforts, recharge |
| **Robustesse** | masse, blindage | finesse, transparence | supporter la chaleur, le froid (comme la carapace aujourd'hui) | points de vie, réduction des coups |
| **Force** | prise, taille, traction | petite taille | écarter des algues, déplacer une pierre | dégâts au contact, saisir |
| **Perception** | yeux, sens, cils, lanterne | | voir dans le noir, trouver les trésors et la nourriture cachée | voir venir, repérer une proie cachée |
| **Discrétion** | petite taille, transparence, corps fin | lueur, grande taille | approcher un animal timide sans qu'il se cache | surprendre, se cacher |

Les huit forment le **profil** de l'animal : une méduse plane et voit peu ; un crabe est robuste et fort mais lent ; une anguille est rapide, agile et discrète mais fragile.

## Couche 3 : les capacités

Des actions, chacune liée à une partie ou une manière de nager, déclenchée par un geste et rechargée avec le temps. Leur force vient des aptitudes.

| Capacité | Vient de | Jeu doux | Jeu combatif |
| --- | --- | --- | --- |
| **Élan** | toute créature | l'accélération de base | l'esquive de base |
| **Jet** | nage `jet` (manteau, bras qui tirent) | fuser loin d'un coup | charge ou fuite éclair |
| **Planer** | nage `bell`, pulsation | descendre lentement, flotter au-dessus du vide | rester hors d'atteinte, tomber sur l'adversaire |
| **Bond** | nage `crawl`, pattes qui marchent | sauter depuis le fond | attaque plongeante depuis le sol |
| **Se faufiler** | corps fin | passer dans les failles | se glisser, échapper à une prise |
| **Éclair** | lanterne, lueur | éclairer, faire répondre les lumières | éblouir (ralentit l'autre un instant) |
| **Pincer** | pinces | écarter les algues, briser le corail mort | coup fort, saisir |
| **Piquer** | rôle `sting`, filaments | s'accrocher au courant | toucher à distance, engourdir |
| **Se blinder** | carapace | supporter la chaleur, le froid | bloquer un coup |
| **Fouiller** | cils | trouver ce qui est enfoui | débusquer ce qui se cache |

Les traits d'aujourd'hui deviennent des capacités : rien n'est perdu, les obstacles des chapitres continuent de les lire.

Pour le jeu combatif, il faudra sans doute **limiter les capacités actives** (deux ou trois, choisies parmi celles du corps), sinon un animal fait de tout serait trop riche.

## La croissance et le régime

- **La maturité** (chantier « Grandir jusqu'à la maturité ») agit sur les mesures : un jeune est petit, donc agile et discret mais faible et fragile. Ses aptitudes suivent sa taille ; c'est un compromis de plus, joli à sentir.
- **Le régime** (« Le régime selon le corps ») dit ce qui nourrit le mieux : il découle de la prise, des filaments et de la bouche. Dans le jeu combatif, il pourrait dire ce qui soigne ou recharge.
- À trancher : manger fait-il seulement grandir, ou aussi monter des aptitudes ? La [vision](vision.md) dit « pas d'objets ni d'expérience : on progresse uniquement par ce que le corps transmet ». Proposition : manger fait grandir jusqu'à la taille adulte de l'espèce et rien au-delà ; les aptitudes restent celles du corps.

## L'équilibre

- **Dans le jeu doux**, pas d'équilibrage à faire : chaque obstacle garde au moins deux solutions, et une aptitude faible rend un passage moins plaisant, jamais impossible.
- **Dans le jeu combatif**, les compromis physiques font l'essentiel. S'il faut plus (des parties en ligne entre joueurs), le jeu combatif peut ajouter un **budget** : la somme des aptitudes ramenée à une valeur commune, en gardant le profil. C'est à lui de le faire, pas à la fiche.
- Un banc d'essai (`?bench` ou un test) calculera le profil de tout le bestiaire et de croisements tirés au hasard, pour voir les extrêmes et qu'aucun animal ne domine.

## La fiche de l'animal

Ce que le jeu doux exporte (chantier « La fiche de l'animal ») : un fichier JSON, versionné, lisible par un autre programme.

```json
{
  "fiche": 1,
  "nom": "Lunécaille",
  "lignee": { "generation": 7, "chapitre": "la-fosse", "ancetres": ["Première", "…"] },
  "corps": { "…": "le Spec complet, comme la sauvegarde le garde" },
  "maturite": 1,
  "mesures": { "taille": 84, "masse": 2.3, "finesse": 9.1, "blindage": 0.42, "poussee": 1.7, "…": "…" },
  "aptitudes": { "vitesse": 0.45, "acceleration": 0.3, "agilite": 0.35, "endurance": 0.6, "robustesse": 0.8, "force": 0.7, "perception": 0.4, "discretion": 0.2 },
  "capacites": ["elan", "pincer", "se-blinder"],
  "traits": ["pinces", "carapace", "lanterne"]
}
```

Le corps suffit pour tout recalculer ; les mesures, aptitudes et capacités sont là pour que le jeu combatif n'ait pas à embarquer le moteur de La Lignée, et pour qu'un changement de formule se voie (la version).

## Ce qu'il faut trancher

1. **Le jeu combatif** : en temps réel ou au tour par tour ? Seul contre des créatures, ou entre joueurs ? Ça change tout le besoin d'équilibre.
2. **L'animal continue-t-il d'évoluer** dans le jeu combatif (nouvelles générations, nouveaux partenaires), ou arrive-t-il figé ?
3. **Des chiffres dans le jeu doux ?** Proposition : aucun, ou un profil en forme (une étoile à huit branches, sans nombre) dans l'arbre des espèces, pour aider à choisir.
4. **Combien de capacités actives** dans le jeu combatif ?
5. **Manger d'autres animaux** : jusqu'où, dans le jeu doux (proposition : de petites proies qui fuient, gobées sans combat, voir « La chasse douce ») ?

## Par où commencer

1. **Un module pur** `src/content/aptitudes.ts` (mesures, aptitudes, capacités), avec ses tests et le profil du bestiaire : sans rien changer au jeu. Il gagnerait à être une sous-tâche avant « Les capacités de nage par corps ».
2. **« La nage : accélération et élan »** lit la vitesse, l'accélération, l'agilité et l'endurance.
3. **« Les capacités de nage par corps »** branche les capacités sur le geste d'élan.
4. **« La fiche de l'animal »** exporte le tout.
