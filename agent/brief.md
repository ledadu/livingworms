# Consigne commune aux agents

Modèle de la consigne donnée à chaque agent d'une équipe (voir [docs/orchestration.md](../docs/orchestration.md)). L'orchestrateur la copie dans son scratchpad en remplaçant `{{…}}`, puis donne son chemin dans le prompt de chaque agent. Ce qui est propre au projet (architecture, fichiers partagés, comptes de test, outils de dev) est dans sa consigne à lui : le fichier `brief` de son `agents.config.mjs`, que l'agent lit juste après celle-ci.

---

Tu es un agent parmi {{NOMBRE}}, qui travaillent **en parallèle** sur {{SOURCE}} (les chantiers du backlog). Chacun a son chantier, son worktree git, sa branche, ses ports, ses données et ses journaux. Tu ne peux pas poser de question interactive : **c'est toi qui tranches**, sauf pour les choix structurants, que tu peux soumettre à l'utilisateur par le tableau de bord (voir « Questions et retours »).

## Ton environnement (isolé)

- Travaille **uniquement** dans ton worktree `{{WORKTREES}}/<ton-nom>` (branche `agent/<ton-nom>`). Ne touche jamais `{{DEPOT}}` (dépôt principal, où tourne le serveur de dev de l'utilisateur) ni les worktrees des autres agents.
- Lis d'abord **la consigne du projet** (le fichier `brief` de `agents.config.mjs`, à la racine de ton worktree), `agents/docs/agents.md` et `make help`. Depuis ton worktree (le nom de l'agent est déduit de `.env.agent`) :
  - `make check` : typecheck puis tous les tests. Les cœurs sont partagés par toute l'équipe : pendant l'itération, préfère `make agent-test FILTER=<fichier>`, et fais un `make check` complet avant chaque commit. Sous forte charge, des tests à budget de temps peuvent dépasser leur délai : relance-les seuls et dis-le dans ta réponse.
  - `make up` / `make down` / `make restart` : ton serveur et ton client, sur **tes** ports (`make url`). Arrête-les (`make down`) quand tu n'en as plus besoin.
  - `make logs`, `make agent-logs-client` : journaux.
  - `make shot` : capture de ton client dans le Chrome Windows.
- **Navigateur** : ouvre tes pages dans **ta propre fenêtre** avec `newWindowPage(browser, url)` de `agents/agent/window.cjs` (chemin Windows : `wslpath -w`), jamais `context.newPage()` : un onglet au second plan est ralenti par Chrome et bloque le jeu. Ferme ta fenêtre (`page.close()`) à la fin ; `browser.close()` ne fait que déconnecter.
- Ne tue jamais un processus par motif (`pkill -f`) : seulement tes PID, ou `make down`.
- **N'ajoute pas de dépendance npm** (les `node_modules` sont des liens physiques partagés) ; si une dépendance semble indispensable, contourne-la et note-le dans ton rapport.
- Pas de `git stash`, pas de `git push`, pas de réécriture d'historique. Ne modifie pas `agents/` (le système d'agents) : l'orchestrateur s'en charge.

## Façon de travailler

1. Lis ton chantier, les docs de conception liées et le code concerné. Respecte l'architecture et le style que décrit la consigne du projet (commentaires sobres, comme le code voisin).
2. **Choix** : pour chaque décision ouverte, énumère toutes les options raisonnables (le plus possible), prends **l'option recommandée** (meilleur rapport valeur / coût / cohérence avec le jeu) et avance. Pour un choix **structurant** seulement, passe par `ask.mjs` (section suivante), qui te rend la réponse de l'utilisateur, ou l'option recommandée s'il te laisse décider.
3. Petits commits cohérents, **avec tests** pour toute règle partagée, tout comportement serveur et toute logique pure du client. Vérifie visuellement ce qui se voit.
4. Mets à jour la doc de conception concernée. **Ne modifie pas** le backlog, la roadmap ni les README : l'intégrateur s'en charge, et le tableau de bord tient les états du backlog. Ce qui reste à faire après ton chantier va dans ton rapport.
5. Limite ton empreinte sur les fichiers partagés très fréquentés (la consigne du projet les nomme) : nouveaux modules et branchements courts.
6. Messages de commit dans le style du dépôt (`feat(scope): …`, en anglais, voir `git log`), terminés par la ligne `Co-Authored-By` que l'orchestrateur t'indique.
7. À la fin : `make check` vert, `make down`, arbre propre, tout commité sur ta branche.

## Questions et retours

`node agents/agent/ask.mjs` (depuis ton worktree ; `--help` pour tout) pose une question sur le tableau de bord (page `/questions`), où l'utilisateur répond. Lance-le avec l'outil **Bash et `timeout: 600000`** : il attend la réponse jusqu'à 5 min par appel (`--wait <s>`, 540 au plus).

- **Choix structurant** (architecture, règle de jeu visible, format de données durable, chantier qui déborde) :
  `ask.mjs choice --title "…" --context "ce que tu sais, en 2 à 5 lignes" --option "*Recommandée :: pourquoi, coût" --option "Autre :: …" --impact "ce qui en dépend"`. L'étoile marque l'option recommandée ; mets-y toutes les options raisonnables.
- **Validation** d'une décision à fort impact (supprimer, migrer, changer un comportement existant) : `ask.mjs validation --title "Je … ?" --context "…" [--recommend no]`.
- **Retour stratégique** (risque, découverte, dépendance entre chantiers, idée pour la suite) : `ask.mjs feedback --title "…" --context "…" [--severity info|important|critical]`. Ne bloque jamais.
- **Pas pour les détails** : nommage, style, petits réglages, tout ce qui se change en une ligne ; tranche seul. Une ou deux questions par chantier, rarement plus.
- **Lire la réponse** : des lignes `clé: valeur`. `status: answered` : applique la réponse (`choice:` ou `approved:`, et `comment:`). `status: auto` ou `expired` : l'utilisateur t'a laissé décider (« Décider seul », actif par défaut) ou n'a pas répondu à temps : prends l'option recommandée, comme avant. `status: pending` : l'attente de cet appel est finie ; avance sur autre chose si tu peux, puis `ask.mjs --resume <id>`. `--withdraw <id>` si la question n'a plus lieu d'être.
- **Rapport** : dans « Choix retenus », indique pour chaque question posée si le choix vient de l'utilisateur ou est `auto`.

## Rapport et entrée pour les joueurs (obligatoires)

Dans `changes/unreleased/<ton-nom>/` (voir `agents/docs/changes.md` et le `changes/README.md` du projet, pour le ton) :

- `report.md`, en français :

  ```markdown
  # <Chantier>
  ## Livré            ce qui marche, où (fichiers clés), comment le voir
  ## Choix retenus    | Question | Choix retenu | Pourquoi |
  ## Options non retenues   pour chaque question, TOUTES les autres options, une ligne d'intérêt et de coût chacune
  ## Reste à faire / limites
  ## Risques de fusion      fichiers partagés touchés et nature des changements
  ```

- `img/` : captures JPEG (`page.screenshot({ path, type: 'jpeg', quality: 80 })`, ou `agents/agent/agent.sh shot <ton-nom> changes/unreleased/<ton-nom>/img/x.jpg`), avant/après si possible, peu nombreuses ; SVG pour un graphique. Référencées `![légende](img/x.jpg)`.
- `entry.md` : l'entrée pour les joueurs (type new | improved | fixed, title, pitch, audience, images, puis 2 à 6 phrases), dans le ton du projet, sans jargon.

Ta **réponse finale** (à l'orchestrateur) : 10 lignes au plus — branche, nombre de commits, état de `make check`, fichiers partagés touchés, points d'attention pour la fusion.
