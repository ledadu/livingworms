# Décisions et questions ouvertes

Ce qui a été tranché sur le [plan v1](plan-v1.md), ce qui reste à trancher, et pourquoi. Une décision prise ici s'applique à tous les autres documents.

## Décisions validées (réponses au plan v1)

| Sujet | Décision | Conséquence |
| --- | --- | --- |
| Chapitres | On **ajoute la Grotte et le Glacier** aux 8 chapitres. | 10 chapitres (9 de descente et la Remontée). Leur place et leur contenu sont des propositions, voir [chapitres.md](chapitres.md) et les questions 1 et 2 ci-dessous. |
| Reproduction | On garde la **parade** (nage synchronisée sans échec possible) ; c'est le joueur qui déclenche l'accouplement, suivi d'une danse à deux qu'on regarde. | Voir [mecaniques.md](mecaniques.md#la-parade). |
| Danger | **Zéro danger.** Les prédateurs ne touchent pas et n'arrachent rien. | Plus de perte de partie du corps. Voir la question 4 pour les contraintes du milieu. |
| Voix | Le **« nous » des ancêtres**. | Tous les textes narratifs sont écrits à la première personne du pluriel. |
| Durée | **1 h 30 à 2 h**, calibration validée. | Avec 10 chapitres : environ 9 à 12 minutes par chapitre. |
| Atelier | **Hors de l'histoire**, débloqué après la fin, dans la « Balade libre ». | L'hérédité est le seul moyen de changer pendant l'histoire. |

## Questions ouvertes

1. **Place de la Grotte et du Glacier dans la descente.** Proposition : la Grotte après la Forêt (la falaise sous le kelp s'ouvre sur des galeries), le Glacier après les Sources (le chaud puis le froid, une langue d'eau glacée qui plonge). À valider ou à déplacer.
2. **Contenu des deux nouveaux chapitres** : obstacle, traits qui le franchissent, partenaires, moment fort, note du chant et textes. Les propositions sont dans [chapitres.md](chapitres.md) et marquées « proposition ».
3. **Le chant et le nombre de générations.** Le plan v1 comptait 8 notes, une par génération, sur 7 chapitres de descente. Avec 9 chapitres de descente, il y a 9 générations avant la créature finale. Proposition : **une note par chapitre de descente, soit 9 notes**, et le chant complet joué à la Remontée. À valider. Le jeu suit cette proposition : chaque génération apprend la note du chapitre où elle entre ([mécaniques](mecaniques.md#le-chant)).
4. **« Zéro danger » et les contraintes du milieu.** Les prédateurs deviennent inoffensifs : ils passent, on peut se cacher (la scène du kelp garde sa tension), mais ils ne touchent jamais. Proposition : garder les **contraintes du milieu comme obstacles** (courants qui repoussent, froid qui ralentit, chaleur qui fait reculer, noir qui cache le chemin), puisqu'elles ne font jamais de mal. À confirmer.
5. **Épave naturelle** : proposée dans le plan v1 et non retenue dans les réponses. Considérée comme écartée, sauf avis contraire.

## Technique

Réponse proposée à la question : « Tu peux tout faire, même le son ? Avec quelle techno, quelle library ? On change du JS ? »

**On garde TypeScript et le moteur actuel.** Tout le plan se fait dans la base existante, sans changer de langage :

- **Langage et build** : TypeScript (compilé en JavaScript) et Vite, qui produisent une seule page HTML autonome, jouable sur téléphone. C'est le cas aujourd'hui.
- **Créatures** : le moteur de fouets 3D maison (`src/engine3`), avec ses locomotions (glisse, cloche, jets, marche) et les parties qui font avancer (`drive`). La fusion de deux espèces (`fuse`, `src/content/generate.ts`) sert déjà à l'Atelier : c'est la base de la portée.
- **Rendu** : WebGL2 maison (`src/engine3/paint-gl.ts`, `src/monde/scene-gl.ts`) avec le canvas 2D en repli, niveaux de détail et budget par image. Pas de Three.js (il a été retiré avec le prototype qui l'utilisait).
- **Son** : la **Web Audio API** du navigateur, sans bibliothèque :
  - nappes et harmoniques par oscillateurs et filtres ;
  - réverbération par convolution sur une réponse générée dans le code ;
  - courant, gouttes, cristaux et échos de la Grotte par bruit filtré et oscillateurs ;
  - chant par une note par chapitre, chacune avec son timbre.
  - **Quelques vrais enregistrements** pour l'ambiance, là où le son fait dans le code sonnait trop électronique : l'eau, le ressac, les bulles, la glace et les baleines (`src/monde/sons/`). La décision d'origine (« sans fichier audio ») est revue ainsi, l'utilisateur ayant choisi de les **embarquer dans la page** :
    - pris sur Freesound, en **CC0 ou CC-BY seulement** ; chaque fichier a sa ligne dans `src/monde/sons/credits.json` (titre, auteur, licence, source, extrait gardé), vérifiée par un test ;
    - **courts, mono, en MP3** (le seul format que décodent tous les navigateurs, téléphones compris), de 24 à 40 kb/s : 10 à 20 s chacun, les boucles faites sans couture dans le jeu, les bruits de chaque fichier repérés dans le jeu ;
    - **embarqués dans la page** (une URL `data:` chacun), dans un **budget de 400 Ko** une fois encodés (un test le vérifie) : le jeu reste un seul fichier, qui sonne pareil dans le lien Artifact, ouvert seul ou hors ligne, et que le navigateur garde en cache comme le reste de la page ;
    - **rien n'est décodé avant le premier toucher** ; ensuite un à un, sans bloquer le jeu, puis gardés décodés tant que la page vit. D'ici là, ou si un navigateur ne sait pas les lire, le son fait dans le code joue à leur place ;
    - ils passent par le même chemin que les autres bruits : leur côté, leur distance (plus faibles et plus sourds de loin), la réverbération du chapitre.
  - Une bibliothèque comme Tone.js n'est utile que si la musique devient une vraie partition séquencée. Elle ajouterait du poids à la page : à décider seulement si le besoin apparaît.
- **Sauvegarde** : le stockage du navigateur (`localStorage`, déjà utilisé pour la créature et les réglages), ou IndexedDB si la lignée devient lourde (portraits).
- **Nouveautés** : ce que racontent les entrées de `changes/` se lit dans le jeu, par le bouton ✦ à côté de ⚙ (`src/monde/nouveautes/`). Le plugin Vite `whatsNewPlugin.mjs` écrit les données de `whatsNew()` dans la page, en un script JSON :
  - en dev, avec la version en préparation (marquée comme telle) et les images servies depuis `changes/` ;
  - dans la page publiée, un seul fichier ouvert aussi sans serveur : les versions publiées seulement, et pour chaque entrée sa première image, réduite par ImageMagick en JPEG de 720 px de large (qualité 70), embarquée dans un budget de 400 Ko, image par image : la version la plus récente d'abord, ses entrées dans l'ordre du panneau. Dès qu'une image ne tient plus, son entrée et toutes les suivantes n'ont que leur texte : la version la plus récente garde les images qui tiennent même quand elles ne tiennent pas toutes, et les plus anciennes perdent les leurs à mesure que les versions s'ajoutent. Sans ImageMagick, les images sont embarquées telles quelles, dans le même budget.
  - Le panneau s'ouvre tout seul une fois par version publiée (le stockage du navigateur retient la dernière vue), jamais à la toute première visite : on commence par la mer.
- **Image souvenir** : dessin de l'arbre dans un canvas, puis `canvas.toBlob` pour le téléchargement (bloqué dans le lien Artifact, comme prévu).

Changer de langage ou de moteur (Unity, Godot, Rust et WebAssembly…) ferait perdre le moteur de créatures, l'Atelier, les 43 espèces et le monde déjà construits, sans gain pour ce jeu.
