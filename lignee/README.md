# La Lignée — Le Grand Monde

A side-scrolling sea in 2.5D: animals built from whips (verlet chains) swim,
crawl and drift through six biomes, from the surface to the abyss. The
Atelier edits any species and lets you swim as it.

## Run

    npm install
    npm run dev      # http://localhost:5173
    npm run check    # type check
    npm run play     # build one self-contained file into play/lignee-monde.html

## Layout

- `src/engine/` — species definitions: types, defaults and patterns (`defs`),
  labels (`names`), measures and variations (`tools`), and the drawing of one
  projected part (`render`).
- `src/engine3/` — the 3D whip engine: `creature3` (simulation, locomotion:
  glide, bell, jet, crawl; parts with a drive), `flow` (water between bodies),
  `view` (perspective), `render3` (canvas, levels of detail), `paint-gl` and
  `gfx` (WebGL2), `snapshot3` (portraits).
- `src/content/` — the bestiary: parts library, 43 species, catalogue,
  generator and fusion.
- `src/editor/` — the Atelier (species editor).
- `src/monde/` — the game: `main` (loop, actors, drawing), `biomes`, `world`
  (floor, rocks, plants, decor), `plants`, `sprites`, `palette`, `scene-gl`,
  `input`, `bench` (`?bench`, `?bench=compare`).
