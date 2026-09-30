# Les changements de La Lignée

Chaque chantier livré laisse ici une entrée : `unreleased/<agent>/` avec `entry.md` (pour les joueurs), `report.md` (le rapport technique) et `img/`. Le format et les commandes sont dans `agents/docs/changes.md` (`make changes-new NAME=…`, `make changes-check`, `make whats-new`).

## Le ton des entrées

- **Doux et émerveillé**, comme le jeu : on raconte ce qu'on va voir ou ressentir, pas ce qui a été programmé.
- **Tutoiement**, phrases courtes, le joueur au centre (« tu peux maintenant… », « tu croiseras… »).
- **Concret** : où le voir (le chapitre, le geste du doigt), ce que ça change pendant la descente.
- **Pas de jargon** (WebGL, verlet, niveau de détail…) : il va dans `report.md`.
- **Sincère** : on ne promet pas ce qui n'existe pas encore.
- Un emoji au plus, au début ou à la fin ; de préférence un de la mer (🐚 🪼 🐙 🦀 🐠 🌊).
- Ne pas imiter la voix du « nous » des ancêtres : elle est réservée aux textes du jeu.

Exemple :

```markdown
---
type: new
title: Le poulpe nage comme un vrai
pitch: Ses bras s'ouvrent en parapluie, puis se referment d'un coup, et le voilà qui file 🐙
audience: players
images:
  - img/poulpe.jpg
---
Joue le poulpe et regarde ses bras : ils s'écartent lentement tout autour de lui, puis se referment d'un seul coup pour le propulser. Au fond, il marche sur ses bras, et repart à la nage dès qu'il décolle.
```
