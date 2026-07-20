# City View (base) — iso canvas + free placement (shipped design)

The base view is a Canvas-2D **isometric** city rendered by `js/ui/city/CityRenderer.js`
into `#city-canvas` (inside `#base-grid`), owned by `BuildingsUI`. Projection: diamond
iso `isoMath.js` (128×96 tiles, ADR 0020/0021).

## Free-placement cell grid (ADR 0022, Phase A)

- The fixed-plot blueprint retired. Layout is now **player-authored free placement** on a
  **half-tile cell grid**: `js/entities/data/cityGrid.js` subdivides each iso tile 2×2 →
  cell (cx,cy) maps to fractional tile (cx/2, cy/2); the projection is linear so
  `tileToWorld` takes fractional coords. Buildable area is a fixed rect (`BUILD_RECT`,
  blueprint tiles ×2 = 44×32 cells).
- Every building type declares a `footprint: [w,h]` in cells (`BUILDINGS_CONFIG`): 2×2
  (well, storehouse, bank, comms tower, rally point, siege workshop), 4×4 (HQ,
  heroquarters, infantry hall, cavalry stable), 3×3 (everything else). Buildings may
  touch; collision is rect-only.
- **Positions are runtime save state**: `PlacementStore`
  (`js/systems/building/placementStore.js`) owns `instanceId → {cx,cy}` + a footprint
  occupancy test; BuildingManager delegates. Serialized as a plain `{cx,cy}` map. Sprites
  bottom-center on the footprint's **front (south) corner** (ADR 0021).
- **Packer** (`js/systems/building/cityPacker.js`, pure + unit-tested): HQ pinned at the
  buildable-rect center; every other instance placed at the free cell rect nearest its
  district anchor (production E, residential S, military W, civic N). Deterministic. Used
  for new games, newly-unlocked slots, and **legacy-save migration** — `deserialize` drops
  plot-id strings / unknown / out-of-bounds positions, then the packer re-places them.
- `zoneOfBuilding` (`CATEGORY_ZONE`) is now a soft district hint (packer bias + Buildables
  grouping), not a hard restriction. **HQ is the only anchored building** (immovable).

## Ground, roads & rubble sectors (ADR 0022, Phase B)

- **`cityBlueprint.js` + `cityLayout.js` retired.** Grid geometry, `CATEGORY_ZONE`, and
  tile dimensions now live in `cityGrid.js`; camera bounds derive from `BUILD_RECT` +
  `GRID_MARGIN_TILES` (isoMath `RING`).
- **Textured ground** (`js/ui/city/cityGround.js`) replaces the flat `GROUND_COLOR`
  diamonds + district tints. Per-cell earth/cracked/ash variants (deterministic
  cell-coord hash, subtle — buildings stay the stars), skeleton road cells draw full road
  tiles, connector road cells draw a narrower inset tile, uncleared rubble sectors draw
  rubble tiles + a deterministic debris-prop scatter (2–5/sector, `debris_wreck` rare).
  The whole ground rasters once into a single offscreen at 1:1 world res and blits each
  frame; re-rasters only when `groundSignature({clearedIds, skeleton, connectors})`
  changes. **The signature counts only truly-`cleared` sectors — a `clearing` sector still
  draws as rubble, so completing a clear invalidates the cache** (the earlier
  `state !== 'rubble'` key bucketed clearing WITH cleared and never re-rastered on
  completion — the "glitchy clearing" bug). Assets: `assets/tiles/ground/grit/`,
  `props/grit/`.
- **Auto-derived roads — two-level hierarchy** (`js/ui/city/cityRoads.js` pure; skeleton
  geometry in `cityGrid.js`; amended §4). A **fixed skeleton** (ring around the HQ + four
  N/E/S/W arterials to the map edge) is deterministic from the grid and **never crosses a
  building**: its cells are UNBUILDABLE (placement/move/packer reject any rect intersecting
  them via `rectHitsSkeleton`; legacy offenders relocate on load via
  `skeletonOffenderMoves`). Arterials render only through the core + cleared sectors, so
  they visibly extend as rubble clears. **Connector roads** run from each building's
  **visible door** (`doorSide: 'sw'|'se'|'s'` in `buildings.js` → middle cell of that iso
  face) to the nearest skeleton cell via **BFS over free ground** — never through a
  footprint or rubble; drawn lighter/inset. Roads are **never serialized**; ambient walkers
  + drone (`cityAgents.js`) follow the combined visible graph.
- **Edge forest** (`cityGround.treeScatter`): `GRID_MARGIN_TILES` widened so the camera
  clamp never shows the void; the surround is filled with dense pines/broadleaf (density
  rising toward the outer clamp edge) and uncleared rubble sectors get sparse dead trees
  alongside debris. Trees are painter-ordered props (drawn interleaved with buildings), not
  baked into the ground raster, so base-edge trees occlude correctly.
- **Rubble-sector expansion.** `citySectors.js` tiles `BUILD_RECT` into a 4×4 block grid;
  the central 2×2 is the always-clear **core** (HQ-centred, fits a fresh base), the other
  12 blocks are rubble sectors — ring 1 (8 inner) + ring 2 (4 corners). Ids
  (`sector_<ring>_<n>`) are **save keys**; per-ring clear cost = base ×2.5, HQ-level gated.
  `sectorState.js` (owned by BuildingManager) holds `{cleared, clearing}`, serialized with
  the save; **grandfathering**: on load, any sector holding a placed instance is
  force-cleared (legacy saves migrate on the full grid then reconcile) so no base strands
  a building under rubble. Placement (packer/ghost/move) is confined to cleared cells. Tap
  a rubble sector → `TileTooltip.showSector` (cost/time/HQ gate/[Clear Rubble] →
  `ui:clearSector`); an in-progress clear shows an on-canvas progress bar + live m:ss
  remaining + construction dust, and the open sector tooltip ticks its remaining time in
  place (ADR 0007, no per-tick innerHTML rebuild). On completion it emits
  `city:sectorCleared` and becomes normal ground. Concurrent clears run on independent
  per-id timers (`SectorState`); one finishing never affects another.

## Camera

`CityCamera.js` — "searchlight" clamp with `EDGE_OVERHANG` over a gradient backdrop
(supersedes the original no-void rule); `⌖` / `CityRenderer.home()` re-frames the HQ.
On base re-entry `homeIfUntouched()` re-frames the HQ unless the player has panned/zoomed
(fixes the off-centre `?dev` boot→world→base frame). Sprites are declared in
`cityAssets.js` (`ISO_BUILDING_MAP`, `GROUND_TILES`); tinted variants are **pre-rendered
once** (`_prerenderGrayscale` idiom) — never per-frame `ctx.filter`.

## Interaction

- **Clicking a built tile** opens the `#tile-tooltip` click-popup (`TileTooltip`):
  summary + Upgrade + open-its-system button (`BUILDING_VIEW_ACTION` →
  `ui:navigateTo`/`ui:openTraining`) + Details (`ui:openBuildingInfo` →
  `BuildingInfoPanel`, `#building-info-overlay`) + cafeteria Restock + Move.
- **Clicking an empty plot** opens the Buildables panel scoped to that plot's zone.
- **Buildables Inventory** (`js/ui/buildings/BuildablesPanel.js`, overlay
  `#buildables-panel`): opens via `ui:openBuildables { zone?, plotId? }` — from More
  grid → Build (`#nav-build`, full catalog) or an empty-plot tap. Reads
  `bm.getBuildablesCatalog()`; grouping (Zone/Function/Status), sort, search. Tapping a
  card emits `ui:placeBuilding { buildingId, plotId? }` → with `plotId` builds directly;
  without, `PlacementController.enterBuildMode` highlights free same-zone plots.
  Relocate is the same controller. Decorations are a stubbed "coming soon" group.
- The old slide-up `#building-detail-panel` is **deleted** — do not resurrect it.

## Tutorial contract (binding)

An inert proxy layer (`#city-proxy-layer`, `.base-tile[data-building-id]` divs) keeps
tutorial spotlight selectors working — never remove it. View ids (`#view-{name}`) and
`data-view` attributes are hardcoded keys in `TutorialManager.js`; renaming breaks
tutorials silently. The Train step spotlights the Infantry Hall tile.

## Build queue sidebar

`#bq-sidebar` — fixed-right collapsible panel (`BuildingsUI._renderSidebar()`) showing
build/research/training queue items. Auto-opens on activity (auto-closes after 10s;
manual toggle cancels). Toggle: `#bq-toggle`.

The build section runs **concurrent workers** (ADR 0016): up to `getMaxBuildSlots()`
builds are active at once with their own progress bar and speed-up, drawn from one shared
FIFO queue (capacity = workers + 2 waiting). Header shows `active/workers · N waiting`.
