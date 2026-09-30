# La feuille de route

Le cap de La Lignée : les six étapes du [plan v1](plan-v1.md), où on en est, et ce qui attend. Les chantiers eux-mêmes, avec leur état, sont dans le [backlog](backlog.md), la seule liste que suivent les agents.

## Les étapes

| Étape | Contenu | Résultat jouable | Où on en est |
| --- | --- | --- | --- |
| 1. Décors | Plans de profondeur, reliefs composés, végétation dense, lumière et rayons, bancs d'ambiance | La balade devient magnifique | **En cours** : le Grand Monde en a une grande partie (voir ci-dessous). |
| 2. Structure | Monde fini en 10 chapitres, textes narratifs, transitions, sauvegarde | On peut descendre du début à la fin | À faire. Les biomes affichent déjà leur titre à l'entrée. |
| 3. Hérédité | Traits, obstacles-clés, espèces compatibles, parade, portée de 4, adieux | La boucle de jeu complète | À faire. La fusion de deux espèces existe (Atelier). |
| 4. Lignée | Arbre généalogique, ancêtres dans le monde, traces | L'émotion des générations | À faire. |
| 5. Chant et fin | Notes, lumières qui répondent, remontée avec les ancêtres, générique | L'histoire complète | À faire. |
| 6. Son et finitions | Musique générée, sons, réglages, performance sur téléphone | Version 1.0 | À faire. Les performances sont déjà suivies (banc `?bench`). |

Chaque étape est publiée sur le même lien pour être testée sur téléphone au fur et à mesure. La page jouable est un seul fichier, `play/lignee-monde.html` (`npm run play`).

## Déjà en place

Avant le plan, le prototype a construit la base du jeu :

- **Le moteur de créatures** : des fouets en 3D (chaînes de Verlet), 43 espèces, les parties qui s'attachent par motifs (paire, éventail, série, anneau).
- **Les déplacements** : glisse (poissons), cloche (méduses), jets (poulpe, calmar), marche au sol (crabes, étoiles, vers). Les parties qui font avancer ont un rôle (`drive`) : traction, rame, marche, ondulation.
- **Le Grand Monde** : 6 biomes en 2.5D, de la Nurserie aux Abysses, avec plantes, rochers, décors, bancs, visiteurs, lumière. Rendu WebGL2, niveaux de détail, budget par image.
- **L'Atelier** : l'éditeur d'espèces, avec le catalogue, le générateur et la fusion. Il sera caché pendant l'histoire et débloqué après la fin.
- **Les agents** : le cadriciel `agents/` pour faire avancer le backlog par une équipe d'agents en parallèle.

## Parking

Idées gardées de côté, hors du plan pour l'instant :

- L'épave naturelle comme chapitre (proposée dans le plan v1, non retenue).
- Le « Quoi de neuf » dans le jeu, à partir des entrées de `changes/` (`whatsNew()` du cadriciel).
