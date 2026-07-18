# 0011 — Grid world: geometry moves to cells, generation is seed-derived

**Date:** 2026-07-16.

## Context

Grit reskin Phase B1 rebuilds the world map as a 96×96 cell grid (9600×9600 world px,
~7× the old 3600×2600 field). `worldMap.js` previously authored geometry directly as
pixels: region `rect`s, region `center`s, and a hand-placed `x,y` per curated POI.

Three things had to be settled to land the grid without a systems rewrite:

1. **Who owns geometry**, given that `WORLD_MAP` is consumed as pixels at module load by
   `WorldRenderer`, `WorldCamera`, and `MarchManager`.
2. **Where the generator lives.** `docs/10-design/grit-reskin.md` § B1 proposed
   `js/systems/world/gridGen.js`.
3. **What the ~3.4× geometry scale-up does to gameplay**, since the reskin is explicitly
   not a rebalance.

## Decision

**Cells are the source of truth; pixels are derived.** `js/entities/data/worldGrid.js`
owns `GRID`, the 3×3 sector layout (`SECTOR_OF`), curated POI cell coords
(`CURATED_CELLS`), and cell↔px helpers. `worldMap.js` keeps authoring regions, factions
and curated POIs, and derives `bounds`, `home`, region `rect`/`center` and POI `x,y` from
cells at the bottom of the file. Every downstream px consumer is unchanged.

**The generator lives in `js/entities/data/gridGen.js`, not `js/systems/world/`** —
deviating from the design doc. `WORLD_MAP` must be fully composed at data-module load
(its consumers import it directly from `GAME_DATA.js`), so composition cannot wait for a
manager to run. Putting the generator in `systems/` would force `entities/data/` to import
from `systems/` — a layering inversion. `gridGen.js` is pure functions of `(cell, seed)`
with no manager state, so the data layer is its correct home.

**Generated state is never serialized.** Terrain and filler POIs regenerate identically
from `WORLD_SEED` every load. Filler POI ids are deterministic (`gen_<region>_<n>`), which
is what lets `worldState.js` reconcile them by id.

**Px-coupled gameplay constants scale with the world.** `BASE_SPEED_PX` 80 → 265 and the
Mistwood watchtower `revealRadius` 760 → 2000, chosen to hold current behavior steady
rather than to retune it.

## Consequences

- `worldState.js` needed **no changes** — its seed/reconcile is already id-driven and
  generic, so filler POIs flow through it automatically. The design doc's expectation that
  B1 would touch it was wrong.
- Region ids, curated POI ids, and all save keys are untouched; old saves keep node
  depletion, camp timers, looted ruins, boss windows, and region/outpost ownership
  (verified — see `40-active.md`).
- Curated POI *positions* moved. They were re-derived once from their normalized position
  inside the old region rect, preserving the hand-designed relative layout, and are now
  authored as cells in `CURATED_CELLS`. The old pixel coords are gone from `worldMap.js`.
- March times are held within ±7% of pre-B1 values. A full balance pass over the bigger
  world stays on the roadmap.
- Regions gained a `tier` field (1 home → 6 ruin) driving generated POI level scaling.
- Neutral regions (`home_vale`, `dragon_spire`, `command_ruin`) generate resource nodes
  only — they have no faction `enemyTypes` pool to draw camp monsters from. Home Vale
  staying camp-free is correct; Dragon Spire and Command Ruin reading as unguarded filler
  is a gap for the balance pass.
- `POI_PICK_RADIUS` (42 world px, under half a 100px cell) still holds, but B2 should
  retune it against the rendered cell size.
