# Consigne des agents dans La Lignée

Ce qu'un agent doit savoir de La Lignée, à lire juste après la consigne commune (`agents/agent/brief.md`). Le cadriciel est décrit dans `agents/README.md` et `agents/docs/`.

## Le jeu

Un jeu de navigateur, sur téléphone d'abord : on joue une lignée de créatures marines, de la surface au fond de la fosse, génération après génération. Lire d'abord la [vision](vision.md), puis le document de conception de son chantier : [chapitres](chapitres.md), [mécaniques](mecaniques.md), [direction artistique et son](direction-artistique.md). Les [décisions](decisions.md) priment sur le [plan v1](plan-v1.md) d'origine. En particulier : **zéro danger** (rien ne blesse ni ne tue), textes dans la voix du « nous », Atelier hors de l'histoire.

## Architecture

TypeScript et Vite, sans serveur ni framework. Le build produit **un seul fichier HTML autonome** (`vite-plugin-singlefile`).

- `src/engine/` : les définitions d'espèces. Types (`types.ts`), valeurs par défaut et motifs d'attache (`defs.ts`), libellés de l'Atelier (`names.ts`), mesures et variations (`tools.ts`), dessin d'une partie projetée (`render.ts`).
- `src/engine3/` : le moteur de fouets 3D.
  - `creature3.ts` : simulation et locomotions (glisse, cloche, jets, marche ; parties avec un `drive`).
  - `flow.ts` : l'eau entre les corps.
  - `view.ts` : la perspective.
  - `render3.ts` : le dessin au canvas et les niveaux de détail.
  - `paint-gl.ts` et `gfx.ts` : le rendu WebGL2.
  - `snapshot3.ts` : les portraits.
- `src/content/` : le bestiaire. Bibliothèque de parties (`parts.ts`), 43 espèces (`species.ts`, dont `firstAncestor`), catalogue, générateur et fusion (`generate.ts`).
- `src/editor/` : l'Atelier, l'éditeur d'espèces (JavaScript peu typé, porté de Hydra).
- `src/monde/` : le jeu.
  - `main.ts` : la boucle, les acteurs, le dessin de la scène, l'API de test.
  - `biomes.ts` : la carte, les ambiances, le fond.
  - `world.ts` : rochers, plantes, décors.
  - `plants.ts`, `sprites.ts`, `palette.ts`, `scene-gl.ts`, `input.ts`.
  - `bench.ts` : le banc de performance.

Le monde : x vers la droite, y **vers le bas** (la surface est à y = 0), z en s'éloignant de l'œil ; le plan de nage est à z = 0.

## Fichiers partagés sensibles

- **`src/monde/main.ts`** (plus de 1 000 lignes) : presque tous les chantiers y touchent. Mettre le nouveau code dans de **nouveaux modules** de `src/monde/`, et ne laisser dans `main.ts` que des branchements courts.
- `src/monde/biomes.ts` : la carte du monde (le chantier des 10 chapitres la refait).
- `src/engine3/creature3.ts` : le moteur, utilisé par le jeu et l'Atelier. Tout changement de comportement touche les 43 espèces : vérifier visuellement plusieurs familles (poisson, méduse, poulpe, crabe).
- `src/content/species.ts` et `parts.ts` : le bestiaire, lu partout.

## Style

- Code et commentaires **en anglais**, sobres, comme le code voisin. Textes du jeu et docs **en français**.
- Messages de commit dans le style du dépôt (`git log`) : `La Lignée: …` en anglais, une phrase qui dit ce qui change pour le jeu.
- Tests vitest pour toute logique pure (règles d'hérédité, traits, sauvegarde…) : `src/**/*.test.ts`, à côté du module.
  - Un test qui lit des données qui grandissent (les versions de `changes/`, le bestiaire, la carte) vérifie une règle, pas leur état du jour : une version publiée ou une espèce ajoutée ne doit pas le faire échouer.
  - Les agents lancent leurs tests en même temps sur la même machine : la limite de `vitest.config.ts` (30 s par test) n'attrape que les tests bloqués. Un test lent se rend moins cher plutôt que de relever sa limite (un `expect` par valeur, dans une boucle de cent mille, coûte plus que le code testé).
  - Un test qui échoue : si la règle du jeu a changé exprès (dans les docs), on met le test à jour ; si le jeu ne la suit plus, on corrige le jeu ; si le test figeait un état du jour ou un délai, on le réécrit sur la règle.

## Outils de dev

- `make check` : typecheck puis tous les tests. `make up` démarre les deux serveurs de l'agent :
  - le « client » : le jeu en dev, avec rechargement à chaud ;
  - le « serveur » : la page compilée en un seul fichier (`vite preview`), celle qu'on publie.
- **L'API de test** du monde, dans la console ou avec playwright : `window.monde`.
  - Aller quelque part : `gotoBiome(i)`, `teleport(x, y)`.
  - Jouer une espèce : `becomes(spec)` (les espèces : `import('/src/content/index.ts')` puis `SPECIES[id]()`).
  - Faire apparaître des animaux : `spawn(id, kind, dx, dy)` et `spawnCrowd(n)`, puis `clearCrowd()`.
  - Pilote automatique : `auto = { on, x, y }`.
  - Contrôler le rendu : `timeScale.v` (vitesse du temps), `onlySp` (n'afficher que ces espèces), `skip` (couches à ne pas dessiner), `input.zoomMul` (zoom).
  - Mesurer : `stats`, `counts`.
- **Performance** : `?bench` (banc complet), `?bench=compare` (canvas contre WebGL, espèce par espèce), `?lod=0` (sans niveaux de détail).
- **Captures** : `make shot`, ou playwright sur le Chrome Windows (CDP 9222) dans sa propre fenêtre (`newWindowPage`, voir la consigne commune). Le Chrome de WSL n'a pas de GPU : ses images et ses mesures ne sont pas représentatives.

## À ne pas faire

- Ne pas toucher le serveur de dev de l'utilisateur : `npm run dev` du dépôt principal, sur http://localhost:5180 (le 5173 est celui d'Allèle, un autre projet).
- Ne pas reconstruire `play/lignee-monde.html` (`npm run play`) : c'est l'intégrateur qui le fait, à la publication.
- Pas de dépendance npm nouvelle : si un chantier semble en demander une (le son, par exemple), faire sans (Web Audio API) et le dire dans le rapport.
- Ne pas modifier le backlog, la roadmap ni les README (consigne commune) ; les documents de conception, oui, pour ce qui concerne son chantier.
