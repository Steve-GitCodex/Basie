# City View (base) — iso canvas + blueprint (shipped design)

The base view is a Canvas-2D **isometric** city rendered by `js/ui/city/CityRenderer.js`
into `#city-canvas` (inside `#base-grid`), owned by `BuildingsUI`.

> **Projection is being retired:** the diamond-iso projection (`isoMath.js`, 132×66
> diamonds) is scheduled to become a square-grid ¾ view during grit Phase A3 — see
> ADR 0009. Everything else on this page (blueprint, placements, camera, interaction,
> tutorial contract) carries over unchanged. Don't build new features against the
> diamond math.

## Blueprint & placements

- Layout is the hand-designed **blueprint** `js/entities/data/cityBlueprint.js`: 22×16
  grid — road network, zone districts, ~60 building plots, deco. `js/ui/city/isoMath.js`
  projects it isometrically (132×66 diamonds) with a decorative terrain ring
  (`cityLayout.js`).
- **Building positions are runtime save state** (ADR 0002): `BuildingManager._placements`
  maps `instanceId → plotId` (serialized; auto-seeded for new games/old saves by
  `_ensurePlacements()`). The blueprint must always have **more plots per zone than total
  instances of that zone** (`CATEGORY_ZONE` maps category→zone) or instances become
  unplaceable. The HQ is pinned via `fixed: 'townhall'` on `civic_hq`.
- Players build on empty plots via the zone-filtered Buildables flow (`bm.buildOnPlot`)
  and move buildings between same-zone plots (`bm.relocate`, emits `building:relocated`).
- **Interim guard:** `buildOnPlot`/`getBuildableOnPlot` reject building an instance that
  already holds a reserved plot (anti-teleport). The full no-reservation placement model
  is bundled with the build-menu/tutorial rework (roadmap, cross-cutting).

## Camera

`CityCamera.js` — "searchlight" clamp with `EDGE_OVERHANG` over a gradient backdrop
(supersedes the original no-void rule); `⌖` / `CityRenderer.home()` re-frames the HQ.
Sprites are declared in `cityAssets.js` (`ISO_BUILDING_MAP`, `GROUND_TILES`); tinted
variants are **pre-rendered once** (`_prerenderGrayscale` idiom) — never per-frame
`ctx.filter`.

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
