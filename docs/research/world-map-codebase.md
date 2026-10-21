# World map: current codebase audit (for the rework)

Research only, written 2026-10-12. This covers what the shipped world map **is** in code, what it looks like, what a
rework can keep, and what constrains it. A separate pass covers genre approaches. Facts carry `file:line`; opinions are
marked **(opinion)**. Line numbers are against the working tree on `Working_Branch` (uncommitted changes included).

Scope read: `js/entities/data/{worldMap,worldGrid,gridGen}.js`, `js/ui/world/*`, `js/ui/controllers/WorldMapUI.js`,
`js/systems/world/*`, `js/systems/march/*`, `css/components/world-view.css`, the world tests, ADRs 0005/0006/0011/0013,
`grit-reskin.md` §B, `assets.md`, `ai-factions.md`, `world-events.md`, and `ai-events-codebase.md` §1–2, §7 and §10.

---

## 0. Summary

- **Structurally**, the map is a 96×96 grid of 100 px cells, cut into a **hard-coded 3×3 grid of 32×32-cell rect
  sectors**. One sector is one region (`worldGrid.js:12-13,27-37`). There are no sub-regions, no roads, no
  routes, and no terrain that matters to gameplay beyond "can filler spawn here".
- **Visually**, terrain is **flat colour squares**: 6 terrain colours, a per-cell brightness jitter and a faction tint
  at 11–14% alpha (`gridLayer.js:31-38,127-149`). There are no textures, edges, transitions or decals. Below zoom 0.22
  the terrain vanishes completely and each region becomes a flat tinted square (`gridLayer.js:154-169`). Every POI is an
  emoji in a disc, with a diamond level badge and a text label (`WorldRenderer.js:281-333`).
- **Reusable as they are:** the state layer (`WorldMapManager`, `worldState`, `regionBuffs`, `worldBoss`,
  `nodeEconomy`), the march state machine (`MarchManager`, `marchMath`, `marchRules`, `marchResolver`), `WorldCamera`,
  the chunk-cache *pattern*, `ParticleField`, and the three DOM panels.
- **Content placement is weak** (§8):
  - Filler uses a region-independent candidate sequence, so the 99 filler POIs occupy only 40 relative cells and
    every region is nearly the same stamp.
  - POI levels are cosmetic, and filler camps draw from the full faction pool. A tier-2 region holds `frost_giant` and
    `undead_legion` camps labelled L2 that are harder than its own stronghold.
  - About 79% of POIs are resource nodes. There are 2 ruins and 3 outposts in the whole world.
- **Load-bearing constraints:** region ids are save keys and frozen by a snapshot test
  (`tests/unit/gameData.test.js:133-152`). Sector = region = rect is assumed by the grid, the filler, the tint/fog
  chunk shortcut, the labels and the ripple. March distance is straight-line from a single `home` point, scaled by
  `BASE_SPEED_PX`. Fog is derived from the `requires` chain.

---

## 1. Data model

### 1.1 Geometry (`js/entities/data/worldGrid.js`)

- `GRID = { cols: 96, rows: 96, cellPx: 100 }`, `SECTOR = { cols: 3, rows: 3, cells: 32 }`, `WORLD_SEED = 0x5ba51e`
  (`:12-14`). `WORLD_BOUNDS` = 9600×9600 world px (`:16`).
- `TERRAIN` enum has 6 values: wasteland, cracked_earth, dead_forest, water, ridge, ruin_rubble (`:18-25`).
- `SECTOR_OF` maps each region id to a `{sc, sr}` sector slot (`:27-37`). **This is the only definition of region
  shape.** `sectorCellRect` / `sectorPxRect` / `sectorCenterPx` derive axis-aligned rects (`:88-114`).
  `regionAtCell` does an integer divide by `SECTOR.cells` and a linear search of `SECTOR_OF` (`:116-120`).
- `CURATED_CELLS` hand-places 26 curated POIs by cell (`:39-74`). `cellToPx` returns the cell centre (`:76-78`).
- Cells are the source of truth and px are derived (ADR 0011). Every downstream consumer reads px.

### 1.2 Regions, factions, curated POIs (`js/entities/data/worldMap.js`)

- **Factions** (`:62-66`): `neutral`, `goblins` (Scavenger Packs, `#b7d645`), `bandits` (Red Talon, `#e05a3d`). Fields:
  `{ id, name, tag, color, enemyTypes }`. The Iron Covenant from `ai-factions.md` does not exist yet.
- **Regions** (`:68-131`): fields `id, name, factionId, startOwner, tier (1–6), strongholdId, buff, requires,
  isCommandCenter`. `placeRegion` adds the derived `rect` and `center` (`:191-193`).
- **`requires` chain** (`worldMap.js:79-129`):
  - `home_vale` unlocks `west_warrens` and `red_lowlands`.
  - `west_warrens` → `mistwood` → `goblin_crest` → `dragon_spire`.
  - `red_lowlands` → `frost_hold` → `ember_reach`.
  - `command_ruin` needs `{ regions: [west_warrens, goblin_crest, ember_reach, red_lowlands] }`.
- **Buffs**, one signature flavour per region:
  - economic: iron, food, wood and stone, each at 10%;
  - logistic: 12% (frost_hold);
  - military: 10% (goblin_crest), 15% (dragon_spire) and 25% (command_ruin);
  - `home_vale` has none.
- **Curated POIs** (`:133-188`): 26 entries. Each is placed by `placeCuratedPoi`, which throws if the id has no cell
  (`:195-199`). The POI types are listed in the header (`:26`):
  - `city`, `resource_node`, `camp`, `stronghold`, `ruin`;
  - `outpost` (subtypes outpost, shrine and watchtower);
  - `world_boss`.

  There is one world boss, `wb_roc` in Red Lowlands, with a 180 s cycle and a 90 s open window (`:156-162`).
- **`icon`** is an emoji string on every POI (e.g. `:135`, `:144`). Nothing in the map data references a sprite or SVG.
- `WORLD_MAP = { bounds, home, factions, regions, pois }` (`:204-210`). `home` is the single px point of `home_city`
  (`:206`).

### 1.3 Filler generation (`js/entities/data/gridGen.js`)

- **Terrain** is a pure function of the cell and the seed. It uses two 3-octave value-noise fields, elevation (scale
  /14) and moisture (scale /9), with thresholds (`:192-200`):
  - water if elevation < 0.28;
  - ridge if elevation > 0.74;
  - forest if moisture > 0.66;
  - rubble if moisture < 0.34;
  - otherwise cracked or wasteland.

  Terrain is **global**: it ignores the region, so "Frost Hold" and "Ashwood" get the same noise statistics.
  Measured cell counts across the 9,216 cells: wasteland 3265, cracked 2821, forest 1372, rubble 887, water 515,
  ridge 356 (computed with `terrainAt` over the grid).
- **Buildable cells.** `isBuildableCell` excludes water and ridge (`:202-205`). Only filler checks it.
  **Curated POIs are never checked**: `camp_red` (cell 55,86) sits on a water cell (verified by computing
  `terrainAt` for all curated cells).
- **Filler placement:**
  - each region gets 8–14 filler POIs, with the count hashed from the region id (`:136,237-240`);
  - cells are rejection-sampled inside the sector rect minus a 2-cell margin, with Manhattan spacing ≥ 3 from curated
    POIs and other filler, for up to 400 attempts (`:134-135,217-235`);
  - 40% roll a camp from the region's faction `enemyTypes` and the rest are resource nodes (`:294-297`);
  - neutral regions have no `enemyTypes`, so they only get nodes (`:265-267`);
  - node resources are biased 40% toward the region's economic buff resource (`:243-247`).
- **Filler naming:**
  - every generated camp is called **"Scav Warband"** with icon 👺, even in bandit regions (`:275-276`);
  - node names come from a 5-entry table (`:139-145`).
- **Filler levels** come from `region.tier` (`:248,269`).
- **Ids** are `gen_<regionId>_<index>` (`:251,272`). They are never serialized as definitions (`:1-6`), but their
  runtime state *is* keyed by these ids in the save (§5).

### 1.4 Counts per region (computed from `WORLD_MAP.pois`; 125 POIs total)

| Region | Curated | Filler nodes | Filler camps |
|---|---|---|---|
| home_vale | city, 2 nodes, ruin, outpost | 11 | 0 |
| west_warrens | stronghold, node, camp, ruin, outpost (shrine) | 4 | 5 |
| red_lowlands | stronghold, node, camp, world_boss | 10 | 2 |
| mistwood | stronghold, node, outpost (watchtower) | 7 | 6 |
| frost_hold | stronghold, node | 6 | 3 |
| goblin_crest | stronghold, node | 8 | 1 |
| ember_reach | stronghold, node | 12 | 2 |
| dragon_spire | stronghold, node | 9 | 0 |
| command_ruin | stronghold | 13 | 0 |

**(opinion)** The command ruin, the end-game capstone, is 13 generic resource nodes around one stronghold. Filler
dominates every region (~100 of 125 POIs), so regions differ mostly in tint.

### 1.5 What a sub-region layer would need to touch

A sub-region (a named area inside a region, or regions split into several areas) changes the "one sector = one rect =
one region" identity everywhere:

- **Geometry:** `SECTOR_OF` / `sectorCellRect` / `regionAtCell` are rect-only (`worldGrid.js:27-37,88-120`). A
  per-cell region map would be needed: a lookup array built from authored polygons or a seeded Voronoi, kept as pure
  data the same way `terrainAt` is.
- **Filler:** `pickFillerCells` samples inside the sector rect (`gridGen.js:217-235`). `curatedCellsInSector` also uses
  the rect (`:207-211`).
- **Render:**
  - `gridLayer` resolves tint and fog **once per chunk, from the chunk's top-left cell** (`gridLayer.js:123-125`,
    `:155`). That is valid only while `SECTOR.cells % CHUNK_CELLS === 0` (ADR 0013; asserted at
    `tests/unit/gridLayer.test.js:17-21`). Any non-rect boundary forces per-cell region resolution.
  - Sector seams are straight lines on the 3×3 lattice (`gridLayer.js:216-225`).
  - Labels, the ruin pulse and the capture ripple use `r.rect` centroids (`WorldRenderer.js:239-279,98-104`).
- **State:** `regionOwner` is keyed by region id (`worldState.js:39-46`). If sub-regions are capturable, they need their
  own owner map plus seed and reconcile (CLAUDE.md gotcha), a `requires` model and buffs (`regionBuffs.js:83-87`).
- **POIs:** every POI carries a `regionId` (`worldMap.js:135-187`) that the lock, fog, buff, tint and panel code all
  read. A `subRegionId` would be additive. Changing `regionId` values breaks saves (§5).
- **Tests:** the gridGen sector tests (`tests/unit/gridGen.test.js:56-72,107-122`) and the gridLayer chunk⊂sector test.

---

## 2. Rendering pipeline

### 2.1 Frame structure (`js/ui/world/WorldRenderer.js`, 503 lines)

- **rAF loop:** `start()` / `stop()` (`:73-80`). The loop stops on view leave (`WorldMapUI.js:125-130`).
- **Redraw gate** (`_frame`, `:195-214`): the renderer redraws if it is dirty, if marches are active, if fx particles
  are alive, or if **the ambient-haze tick (33 ms) is due**. Ambient haze is always running (`:200-204`), so the gate
  never idles: **the whole map is redrawn at about 30 fps for as long as the world view is open**. The roadmap notes
  this ("world view now redraws at ~30fps", `docs/30-roadmap.md:74`).
- **Draw order** (`_draw`, `:216-233`):
  1. Fill the backdrop `#161310` (`worldGrade.js:6`).
  2. In the world-space transform: `GridLayer.draw` (terrain chunks, cell seams, sector seams), then region labels,
     then world-space fx.
  3. In the screen-space transform: march arcs, then **all POI markers in a single loop**, then ambient ash.
- **Region labels draw under the markers**, because they are in the world-space pass (`:225` vs `:231`). In screenshot
  `04` the marker discs cover the region names ("West Warrens", "Red Lowlands").

### 2.2 Terrain (`js/ui/world/gridLayer.js`, 226 lines)

- **Chunking.** Chunks are 16×16 cells. Each one is rasterised once into a 512×512 offscreen canvas (`TEX_CELL = 32`)
  and blitted with `imageSmoothingEnabled = false` (`:19-25,85-104,117-152`). The cache is a Map capped at 24 entries
  that evicts insertion-first; hits are not re-inserted, so it is **FIFO, not LRU** (`:107-115`).
- **Per cell**, up to 4 `fillRect` calls (`:129-148`):
  - the terrain colour from a 6-entry table (`:31-38`);
  - a hash jitter, either darken ≤11% or lighten ≤4.5% (`:133-137`);
  - the faction tint at alpha 0.11, or 0.14 when the player owns the region (`:139-144,180`);
  - fog at `rgba(9,8,7,0.8)` (`:40,145-148`).
- **There is no texture, no atlas, no edge blending, no decals and no warp field.** `world-map.md:9` still says
  "warp-field organic borders, ink seams". That is **stale**: ADR 0013 deleted the warp field
  (`_warpX`/`_warpY`/`_outline`/`_traceRegion`). `WorldCamera.js:6-8` also still talks about "sea gutters" that no
  longer exist.
- **LOD.** Below `LOD_ZOOM = 0.22` (`:22`), `_drawFlatChunk` paints `LAND_BASE`, the tint at `flatAlpha` 0.26/0.34 and
  fog (`:154-169`). **The terrain disappears at this zoom.** That is the zoomed-out view (screenshots `04`, `bg-world-today`,
  and the new `31-world-lod-boundary.jpg`). The flat path also ignores watchtower reveal circles, because it fogs the
  whole chunk.
- **Seams:**
  - Cell seams are a live world-space path, drawn at zoom ≥ `SEAM_ZOOM` 0.5 (`:27,102,204-214`). This is the "grid
    look" at default zoom 0.7.
  - Sector seams are 6 world-px dark lines on the 3×3 lattice, drawn at every zoom (`:216-225`).
- **Invalidation:**
  - `invalidate()` drops the whole cache (`:79-82`). `WorldRenderer.syncState()` calls it (`WorldRenderer.js:83`).
  - `WorldMapUI` calls `syncState()` **every second from its ticker** (`WorldMapUI.js:116-122`) and on every
    `world:poiChanged` (`:68`). That includes `'gathered'` and the boss-window transitions (`WorldMapManager.js:47-48,193`).
  - So the visible chunks are re-rasterised at least once a second, each one 256 × `terrainAt` (2 × 3-octave fbm)
    plus ~1,000 fills. ADR 0013 said to "revisit if a future change invalidates on a tick", and this is that case.
  - **(opinion)** This is cheap with flat fills. It will not be cheap with texture blits, so a rework must split
    "static terrain" from "dynamic overlay" caches.
- **The tint follows `factionId` (static data), not `regionOwner`,** unless the player is the owner (`:172-181`).
  `ai-events-codebase.md` §10.2 also records this.

### 2.3 Palette (`js/ui/world/worldGrade.js`, 49 lines)

`WORLD_BACKDROP`, `LAND_BASE` and `grime(hex)`, a cached HSL desaturate and darken (`:6-23`). It is pure and reusable.

### 2.4 Markers, badges, labels (`WorldRenderer.js:281-417`)

- **Markers are drawn in screen space at a fixed size:** a disc of radius 16 (`MARKER_R`, `:23`) with the emoji at 17px
  (`:304-309`). The ring colour follows city, held outpost, owned region, or else the faction colour (`:291-293`).
  Selection makes the ring gold (`:300-302`).
- **The level badge** is a rotated square in the ring colour, top-left, on every POI except the city (`:314-317,355-374`).
- **State sub-badges** (`:376-417`):
  - nodes get a 3px depletion bar;
  - cleared camps and looted ruins get a ✓;
  - held outposts get 🚩;
  - the boss gets a pulsing red ring when open and 💤 otherwise.
- **Labels** are `[TAG] name` on a dark pill. They are drawn for **every** on-screen POI when `zoom > 0.45`, or when the
  POI is hovered or selected (`:319-331`). There is no collision avoidance or priority.
- **Culling** is a screen-rect test with a 40px pad (`:283`). There is no zoom-based marker LOD: at whole-map zoom all
  125 discs and badges draw at full size.
- **Fogged POIs** draw as a dashed disc with "?" at their **exact position** (`:284,335-353`). Fog therefore leaks how
  many POIs a region has and where they are.

### 2.5 Region labels (`WorldRenderer.js:235-273`)

- Labels are a constant screen size (`scale = 1/zoom`, `:247`; ADR 0013), placed at the rect centroid.
- Locked regions get a 🔒 22px above the name (`:261-265`). It collides with fog "?" discs in screenshot `04`.
- The command ruin gets a pulsing gold rect stroke once it is assaultable (`:254-260`).

### 2.6 March arcs (`WorldRenderer.js:419-494`)

- Each march draws a dashed quadratic arc **from `WORLD_MAP.home`** to the target (`:421,436`), bowed by 0.18 of its
  length (`worldProjection.js:53-65`).
- It also draws 4 trail dots, a 6px token and an `m:ss` ETA pill (`:447-494`).
- The colour depends only on `m.type` (`:440,462`). There is no owner, no origin field and no route geometry.
- `this._pois.find` runs per march per frame (`:423`).
- The arc is longer than the straight line the travel time is charged on (`MarchManager.js:89`). **(opinion)** The
  mismatch is minor but visible once routes matter.

### 2.7 Camera (`js/ui/world/WorldCamera.js`, 98 lines)

- Plain scale and translate (`:47-53`).
- **Zoom limits:** `MAX_ZOOM` 1.6 (`:17,34`). `minZoom` is a contain-fit × 0.9 (`:28-32`): about 0.12 on a 1280×800
  desktop and about 0.037 on a 390px-wide phone.
- **Pan clamp:** you can pan up to `PAN_MARGIN = 700` world px past the edges, and the view centres when zoomed out
  further than that (`:18,88-101`).
- `HOME_ZOOM = 0.7` frames about 18 cells across a 1280px view (`WorldRenderer.js:24,107`).
- There is no inertia, no animated fly-to (`centerOn` snaps, `:73-79`) and no zoom buttons.

### 2.8 FX

- `ParticleField` (`js/ui/fx/particles.js`, 170 lines) drives two fields (`WorldRenderer.js:44-45`):
  - 140 screen-space ash particles;
  - 220 world-space particles for impact bursts (`:86-95`) and the region ripple (`:98-104`).
- It is generic, and the city view shares it.

### 2.9 World images and atlases

- **There are no world-specific images.** `assets/tiles/` contains only `buildings/` (city, grit and ai sets),
  `ground/grit/` (11 tiles) and `props/` (`grit/` debris and trees, `ambient/` survivors, truck and drone).
  `assets/icons/svg/world.svg` is a nav icon. `assets.md:9` lists `assets/tiles/terrain/` as "unused"; that folder
  does not exist in the tree.
- `ground/grit/*.png` are **64×48 foreshortened city cells** (ash, cracked, earth, road and rubble). `cityGround.js`
  uses them (`:21-28`). `props/grit/*` holds 8 debris pieces and 8 trees, 38–113 px, used by the city.
  **(opinion)** These are candidates for world decals (B3 already earmarked "ash-recolored trees → world-map
  dead-forest decals", `assets.md:298`). The ground tiles are in the city's foreshortened projection, though, so they
  are not drop-in top-down world tiles.
- **Atlas hook:** none. Nothing in `gridLayer` loads an image. ADR 0013 warns that a real atlas breaks the
  fixed-512px-nearest-neighbour cache, which then needs zoom-bucketed or native-resolution textures.
  `grit-reskin.md:253-267` (B3, deferred) specifies:
  - an AI-generated seamless atlas of ~5 types × 2–3 variants;
  - 10–15 decals;
  - per-cell variant picks and jitter, seeded decal scatter and soft-edged fog;
  - road polylines between sector centres;
  - SVG POI markers.

### 2.10 Implemented but unused, or stale

- `hitTestRegion` (`worldProjection.js:38-46`) has no callers and reads `r.radius`, a field regions no longer have.
- `TERRAIN.RUBBLE` is named `ruin_rubble`, but nothing ties it to ruins; it is just low moisture (`gridGen.js:198`).
- `world-map.md:9` (warp field), `WorldCamera.js:6-8` (sea gutters) and the CSS comments are stale:
  `.world-marches` "(top-right)" is really top-left (`world-view.css:104-107`), and the legend "(top-right)" is
  really bottom-right (`:124-127`).

---

## 3. Interaction

- **Input** is on the canvas only (`WorldRenderer.js:115-167`):
  - one-pointer drag pans after a 6px slop (`:20,142-145`);
  - two-pointer pinch zooms about the midpoint and pans by half the delta (`:129-138`);
  - the wheel zooms ±10% per notch (`:162-166`);
  - a tap is under 500 ms with no move (`:21,154-157`).
- **Hit-testing** (`:169-173`, `worldProjection.js:23-31`) returns the nearest POI within `POI_PICK_RADIUS = 50`
  **world px** (`:22`), over all 125 POIs, fogged ones included.
  - Markers are a **fixed 16 screen px** while the pick radius is in world px. At zoom 0.12 the pick radius is about
    6 screen px, smaller than the disc, so edge taps miss. At zoom 1.6 it is 80 screen px, so taps near a marker
    select it.
  - Overlapping discs at low zoom resolve to whichever centre is nearest.
  - There is no hit-testing for marches, regions or empty cells. An empty tap only closes panels (`WorldMapUI.js:37`).
- **POI panel** (`PoiDetailPanel.js`, 139 lines):
  - it is a bottom slide-up, `min(440px, 100% − 2·space-4)` wide (`world-view.css:25-31`);
  - its body is `innerHTML` by type (`:71-116`), with one primary action button whose blocked reasons chain through
    a nested ternary (`:53-67`);
  - fogged POIs show "Unexplored" with no action (`:33-41`);
  - `WorldMapUI._poiVm` builds the view model (`WorldMapUI.js:169-189`), and the whole panel re-renders on every
    `world:poiChanged` and every second for bosses (`:68,121`).
- **Dispatch sheet** (`MarchDispatchSheet.js`, 78 lines): a squad picker with an ETA from `MarchManager.previewMarch`
  (`MarchManager.js:58-68`). The action sequence is POI panel → sheet → `march.dispatch` (`WorldMapUI.js:142-159`).
- **Marches panel** (`MarchPanel.js`, 54 lines) sits top-left, 220px wide, at `max-height: 50%` (`world-view.css:104-108`).
- **Phone** (`20-phone-world.jpg` and new capture `32-phone-world-zoomed-out.jpg`, 390×844):
  - `world-view.css` has **no media queries**. The 220px Marches panel (even when it reads "No active marches") and
    the Territory legend take about a quarter of the map area.
  - The default zoom of 0.7 on a phone shows about 5 cells across, with typically no POI other than your city.
  - On resize, `setViewport` re-clamps but does not keep the view centre (`WorldCamera.js:36-41`). After the
    1280→390 resize in the capture, the view ended up on the map's left edge with void showing.
  - `minZoom` ≈ 0.037 lets the phone shrink the whole 9600px map to about 350px, which is far smaller than any POI
    disc.

---

## 4. Visual critique

Sources: `ui-reference/03`, `04`, `05`, `07`, `20`, `bg-world-today`, plus new captures `30-world-mid-zoom.jpg`,
`31-world-lod-boundary.jpg` and `32-phone-world-zoomed-out.jpg` (git-ignored, not committed). All items are **(opinion)**,
each grounded in the code cause.

1. **Terrain monotony / "programmer art".** At default zoom (`03`) the ground is a quilt of olive squares 70px across.
   The 6 terrain colours sit within ~25% luminance of each other (`gridLayer.js:31-38`), and the green owned-tint over
   everything flattens them further. Water reads as slightly bluer squares, not water (`30`). Nothing has an edge, a
   shoreline, a ridge silhouette or a tree. B3 called this the placeholder that "reads programmer-art" if B3 slips
   (`grit-reskin.md:262-263`), and it did slip.
2. **The grid look.** The cell seams at zoom ≥ 0.5 and the per-cell jitter make the cell lattice the dominant visual
   structure. Last Shelter-style maps hide their grid until it is needed. Here the grid is the art.
3. **Zoomed out = no terrain at all.** Below 0.22 the map becomes 9 flat tinted squares with 6px black seams on a
   brown void (`04`, `31`). The LOD switch at 0.22 is abrupt: terrain pops from mosaic to flat.
4. **Badge clutter.** Every POI carries a disc, a diamond level badge, a depletion bar and (above zoom 0.45) a text
   pill. At overview zoom the 125 full-size discs merge into clumps (`04`: West Warrens, Red Lowlands). Every POI weighs
   the same, so a stronghold or world boss reads like a forage patch. Emoji glyphs (🌾 ⛏️ 💧 👺) render differently per
   platform and clash with the grit art.
5. **Label overlap.** Region names sit under the markers. POI labels have no collision handling. The lock icon overlaps
   fog "?" discs and region names ("Ashwood", "Behemoth Spire" in `04`).
6. **Fog presentation.** Fog is an 80%-black fill that blends into the backdrop, so a fogged region looks like empty
   void. The "?" discs at exact POI positions add more clutter to the fog than to the visible area, and they give away
   the layout. There is no soft edge or texture, and no silhouettes of known landmarks.
7. **Region identity.** Regions are identical rects, told apart only by an 11% tint and a name. The terrain is global
   noise, so names promise biomes ("Frost Hold", "Ashwood", "Salt Flats") that the ground does not show. Faction
   territory has no architecture or props. The command ruin, the capstone, is visually a grey square.
8. **No sense of place or routes.** There are no roads, rivers, chokepoints or landmarks, and nothing visual links home
   to anywhere. Marches are abstract dashed bows (`07`) that cross terrain without regard to it. The design calls for
   routes, interception on the road and storms that slow marches, and nothing in the visual or data model has a path.
9. **Scale and density.** At home zoom about 3 POIs are visible (`03` shows 2). The map is mostly empty squares at
   play zoom and an unreadable clump at overview zoom. No zoom level is pleasant: a "middle" zoom (`30`) shows mosaic
   terrain with sparse discs.
10. **HUD overlap.** On desktop the Marches panel and legend are permanent. On phone they eat about 25% of the map
    (`20`), and the legend repeats what the tint already says.

---

## 5. Constraints and coupling

Classification: **Easy** means a local change. **Moderate** means several files plus tests. **Load-bearing** means it
touches saves, other systems or design contracts.

| Dependency | Where | Class | Notes |
|---|---|---|---|
| 9 region **ids** | `worldMap.js:68-131`; snapshot `tests/unit/gameData.test.js:133-141`; `regionBuffs.test.js` (11 refs), `worldState.test.js` (13), `marchResolver.test.js` (2), `world-smoke.mjs:21,25-27,66` | **Load-bearing** | Save keys (`regionOwner`), ADR 0017 freeze. Per Steve's no-legacy-compat stance (dev only), ids *can* change if the snapshot test and the fixtures are updated deliberately. The AI design also pins ids (`ai-factions.md` "Existing ids stay"; Covenant = `goblin_crest` + `dragon_spire`). |
| Curated POI ids (26) | `worldMap.js:133-188`, `worldGrid.js:39-74`, snapshot `gameData.test.js:146-151` | **Load-bearing** | Save keys in `poiState` / `outpostOwner` / `discovered`. Positions (`CURATED_CELLS`) are **easy** to move. |
| Filler ids `gen_<region>_<n>` | `gridGen.js:251,272`; `world-smoke.mjs:29` | Moderate | State is keyed per id. Changing the terrain, the seed or the curated cells shifts filler *positions* under the same ids (the save then attaches to a different spot). Changing counts drops or adds ids, which reconcile handles (`worldState.js:55-70`). |
| 3×3 sectors, region = rect | `worldGrid.js:13,27-37,88-120`; `gridGen.js:207-235`; `gridLayer.js:123-125,155,216-225`; `WorldRenderer.js:254-260,275-279` | **Load-bearing (structural)** | Every region-shape consumer assumes an axis-aligned rect. Test guards: `gridGen.test.js:56-72,107-122`, `gridLayer.test.js:17-21`. |
| Region `rect` / `center` | `worldMap.js:191-193`; labels, ripple and ruin pulse in `WorldRenderer.js` | Easy | Presentation only. Replace with a label anchor point. |
| `requires` chain | `worldMap.js:79-129`; `WorldMapManager.regionLock` `:126-135`; `marchRules.canDispatch` `:205-207`; `PoiDetailPanel` lock text via `_poiVm` | Moderate | Pure data plus one reader. Fog is **derived** from it (`isDiscovered` `:143-149`, `gridLayer._isRegionFogged` `:183-185`), so the AI re-fog cascade comes for free on a derived read. |
| Fog model | `WorldMapManager.js:143-170`; `gridLayer.js:145-148,183-201`; `_discovered` serialized `:248,257-259` | Moderate | Region-granular plus watchtower circles. The `_discovered` POI set persists and survives a region loss (a lost region's revealed POIs stay visible). There is no "landmark through fog" concept. |
| `regionBuffs` | `regionBuffs.js:83-110`; consumers `ResourceManager.js:87-88`, `marchResolver.js:58,80,112,133`, `MarchManager.js:65,92`, `buffSnapshot.js:15` | Easy | Pure, keyed by region and owner. It survives any geometry change. |
| `marchMath` distance and speed | `marchMath.js:13,17-19,40-43`; `MarchManager.js:62,88-94` | **Load-bearing (tuning)** | Straight-line px from `WORLD_MAP.home`. `BASE_SPEED_PX = 265` was rescaled once with the world (ADR 0011). Today home → ruin is about 4,500px ≈ 17s at speed 1, and the far corner about 35s. Resizing the world, adding routes or adding storm slowdowns changes every ETA, so speed must be retuned and a path-cost function introduced. |
| Single origin `WORLD_MAP.home` | `worldMap.js:206`; `MarchManager.js:62,88`; `WorldRenderer.js:107,421` | Moderate | The AI design needs per-march origins (bases, war camps). |
| Save fields | `WorldMapManager.serialize` `:244-250`; `worldState.seedState/reconcileState` `:20-70`; inline `discovered`/`timedBuffs` filters `:257-263`; `MarchManager.serialize` `:212-218` | **Load-bearing (process)** | Every new field needs seed and reconcile (CLAUDE.md). Marches store `targetPoiId` and absolute times only. Transient boss open-state is never saved (ADR 0006). |
| `world-smoke` assertions | `tests/browser/world-smoke.mjs:14-84` | Moderate | Checks region and POI ids, legend rows, "**distinct > 40 colours**" at home (`:81`) and a **green-pixel ratio after capturing `red_lowlands`** (`:82-83`). The pan script assumes `red_lowlands` sits east of home at the default zoom (`:53-62`). A palette or layout rework must rewrite these checks. |
| Unit tests | `gridGen.test.js` (19 tests), `gridLayer.test.js` (10), `worldState`, `regionBuffs`, `marchMath`, `marchRules`, `marchResolver` | Moderate | `gridLayer.test.js` pins `CHUNK_CELLS`, LOD and the chunk⊂sector invariant. The suite is additive, so a geometry change appends new tests and updates the pinned ones. |
| Tutorial | `TutorialManager.js` | Easy | **No world-map references** (grep finds no `world`, `march` or `rally`). Only the nav contract (`#view-world`, `data-view`) applies. |
| Nav and gating | `navigation.js:94,112` (`rallypoint` → `world`); `NavigationUI.js:183-209` | Easy | View-level only. |
| DOM ids | `index.html:234-` (`#world-canvas`, `#world-poi-panel`, `#march-sheet`, `#world-march-panel`, `#world-legend`) | Easy | Cached in `init()` by the panels. |
| `factionId` vs owner | `gridLayer.js:172-181`; `WorldRenderer.js:243-244,288-293,321`; `WorldMapUI.js:100-104` | Moderate | Colour and `[TAG]` come from static `factionId`, so a faction-held region in another faction's colour is impossible today (ADR 0005 vs render). |
| One-way ownership | `WorldMapManager.captureRegion` `:235-241` hard-codes `'player'` | **Load-bearing (AI)** | Not geometry, but the rework is the natural place for a `setRegionOwner` and `world:regionLost` (`ai-factions.md`). |

---

## 6. Reusable vs. replace

**Survives as is (logic):**

- `WorldMapManager` (265 lines), `worldState`, `regionBuffs`, `nodeEconomy`, `worldBoss`. They are geometry-agnostic:
  ids, owners and timers only. They need *additions* (owner setter, region loss, new POI types), not a rewrite.
- `MarchManager`, `marchRules`, `marchResolver`: the phase machine on absolute timestamps and the strategy map. The
  change needed is an origin and a path-cost hook in place of the straight `distance(home, poi)`.
- `marchMath`: pure, but `distance()` becomes "path length" once routes exist.
- `WorldCamera` (98 lines): sound. It needs resize-preserving centre, a smaller phone `minZoom` floor, a fly-to tween,
  and possibly a "show the whole map" fit that respects HUD insets.
- `worldProjection.arcPoint` / `hitTestPOI`. `hitTestPOI` needs a screen-px radius or a radius from the marker size.
  `hitTestRegion` should be deleted.
- `worldGrade` (`grime`), `ParticleField`, `PoiDetailPanel`, `MarchDispatchSheet`, `MarchPanel`, and the thin
  `WorldMapUI` presenter routing (its 1s `syncState` ticker must change, §2.2).
- The `gridGen.js` hash/noise primitives (`hash3`, `valueNoise`, `fbm`, `cellNoise`, `:147-190`) and the
  deterministic seed contract (ADR 0011), as a good base for per-region biomes, decal scatter and sub-region Voronoi.
- The chunk-cache **pattern** (viewport chunks, offscreen canvas, LOD) from `gridLayer`.

**Replace or split:**

- `gridLayer.js` *as a renderer*. Its flat-fill-plus-nearest-neighbour design is explicitly incompatible with
  textures (ADR 0013). Its per-chunk tint and fog shortcut is incompatible with non-rect regions. **(opinion)** Split it
  into:
  1. a static terrain cache with textures and decals, at native or zoom-bucketed resolution, invalidated only on a
     seed or layout change;
  2. a cheap dynamic overlay pass for ownership tint, borders, fog and event cells, invalidated on world events;
  3. an overview LOD that is a pre-rendered whole-map image, not a flat fill.
- `WorldRenderer.js` (503 lines, past the ~400 split rule). **(opinion)** Split along the existing seams:
  - `poiMarkers.js` (`_drawMarker`/`_drawMarkerState`/`_drawLevelBadge`/`_drawFogMarker`, ~140 lines), with icon
    sprites, zoom LOD and priority-based label collision;
  - `marchLayer.js` (`_drawMarchArcs`/`_drawMarchEta`, ~80 lines);
  - `regionLabels.js` (~45 lines);
  - `worldInput.js` (pointer and wheel, ~70 lines).

  What remains is the loop and the layer orchestration.
- `gridGen.terrainAt` should become region- or biome-aware (or authored per sub-region), not one global noise field.
  The filler generator should name camps by faction and check curated cells against unbuildable terrain.
- The legend should go away or become optional, and the CSS needs phone breakpoints.

---

## 7. Seams to leave for the AI factions and world events design

1. **Dynamic map entities, separate from static POIs.**
   - Today everything iterates `WORLD_MAP.pois`, an immutable list (`WorldRenderer.js:39,231`;
     `WorldMapManager.js:28,35`). War camps, rebel camps (camp → settlement → stronghold), supply drops, herd nodes and
     the waking boss are **runtime-spawned**, with ids and state that must serialize and reconcile.
   - **(opinion)** Add a `worldEntities` store (owned by the new managers, e.g. `AIManager` / `WorldEventManager`) that
     exposes `{ id, kind, owner, x, y | cell, level, state }`.
   - The renderer and hit-tester should read a merged `entities()` snapshot (static POIs plus dynamic entities) through
     one marker pipeline keyed by `kind`.
   - `getPOI` / `isDiscovered` / `marchTypeForPOI` need to resolve dynamic ids too. An unknown type is refused with
     "Nothing to do here." (`marchRules.js:33-35`).
2. **A route and path layer.**
   - Marches need `origin`, `ownerId`, and a `route: [cell|px points]` with a cached length.
   - `marchMath` should gain `pathLength(route)` and a `pathCostMs(route, speed, modifiers)` that can integrate storm
     cells ("+40% travel time through the storm").
   - Intercepts need a **position-at-time** function on a route plus march hit-testing (none exists, §3).
   - A static road network (B3 already proposed "cracked-road polylines between sector centres") gives routes a visible
     shape and gives the herd migration a path to follow. Keep it as data (a graph of cells), not as paint.
3. **Per-cell overlay layer.**
   - Contamination spreads cell by cell; storms are moving cell sets. These need a `cellOverlay(cx, cy) → {kind,
     intensity}` source and a dedicated overlay cache or pass that invalidates per event.
   - They must not go through the static terrain cache or the whole-cache `invalidate()`.
   - Contaminated-cell state is new save state and needs seed and reconcile.
4. **Owner-driven tint and borders.**
   - Colour must come from `regionOwner` (any faction, including rebels at `#b07ad8`), not `factionId`. The places to
     change are `gridLayer.js:172-181`, `WorldRenderer.js:243-244,288-293`, `WorldMapUI.js:100-104`.
   - Borders should be drawn between cells of different owners, so a lost region visibly changes hands. That is also
     where "walls per held region" can render: a wall or fortification stroke along owned borders, with its strength
     read from the defense state.
   - `world:regionCaptured` carries no owner (`WorldMapManager.js:239`). Pair it with `world:regionLost` and
     `{ owner, prevOwner }`.
5. **Landmarks through fog.**
   - Fog today hides everything except exact "?" positions. The design needs *known landmarks* (faction home bases,
     possibly the world boss lair) drawn faded inside fog, and nothing else.
   - **(opinion)** Add a `visibility(entity)` with three states (`hidden | landmark | visible`) in place of the boolean
     `isDiscovered`. Fogged filler should stop rendering at all rather than as "?".
   - Soft-edged fog belongs in the overlay pass, so the re-fog cascade is a redraw rather than a cache rebuild.
6. **Origins at the map edge and through fog.** The brief requires every march to start at a visible origin: a base, a
   camp, your outpost, or a labelled map-edge marker (`mockups/ai-events/BRIEF.md:72-73`). The renderer needs an
   origin token and a route that can begin inside fog.
7. **Threat focus mode.** The prototype's accepted "Threat focus" map mode (`ai-factions.md` UI surfaces) implies a
   render mode switch that dims everything except threat entities and routes. That is easiest if layers are separate
   modules (§6).
8. **Anchored intel card.** `ai-factions.md` replaces the bottom POI panel with a card anchored to the node for AI
   targets. `WorldCamera.worldToScreen` already gives the anchor. The panel layer needs a "follow entity" position
   update on pan and zoom.
9. **Built to extend.** No code should assume 9 regions, 3×3 or 3 factions (`ai-factions.md` "Built to extend").
   Today `SECTOR` (3×3) and `SECTOR_OF` are the hard-coded bounds. A data-driven region map (cell → region) removes
   them.

---

## 8. Content placement, spacing and generation

All the numbers here come from importing `js/entities/data/worldMap.js`, `worldGrid.js`, `gridGen.js` and `combat.js`
in Node and measuring `WORLD_MAP.pois`. The script lives in the session scratchpad, not the repo. Distances are in
**cells** (1 cell = 100 world px). A 1280×800 view at the home zoom of 0.7 spans about 18×11 cells.

### 8.1 Placement today

- **Curated POIs** are placed by hand in `CURATED_CELLS` (`worldGrid.js:39-74`) and converted to px by
  `placeCuratedPoi` (`worldMap.js:195-199`). Nothing validates them against terrain, labels or spacing. The only
  check is the test that each curated cell lands in its own sector (`tests/unit/gridGen.test.js:66-72`).
  - **The same relative cells repeat across regions.** Measured as (cx−sector.cx0, cy−sector.cy0):
    - every outer stronghold sits at relative (16,10) or (16,12), top-centre, directly above the region label
      anchor at (16,16): `sh_west`, `sh_red`, `sh_frost`, `sh_ember` at (16,10); `sh_mist`, `sh_crest`, `sh_dragon`
      at (16,12);
    - `home_city` and `sh_ruin` sit exactly **on** the label anchor (16,16);
    - curated nodes repeat around (9–10, 20–23) and (21–22, 20–23): `rn_iron` (10,20), `rn_grain` (9,23),
      `rn_crest` (9,22), `rn_hunt` (10,22), `rn_ore` (21,20), `rn_ice` (21,23), `rn_timber` (22,22),
      `rn_well` (21,23).
  - `camp_red` (cell 55,86) sits on a **water** cell (§1.3).
- **Filler POIs** (`gridGen.js:288-301`): `fillerCount` hashes the region id into 8–14 (`:237-240`).
  `pickFillerCells` (`:217-235`) then draws candidates:

  ```js
  const cx = inner.cx0 + Math.floor(hash3(attempt, out.length, seed) * span.w);
  const cy = inner.cy0 + Math.floor(hash3(out.length, attempt, seed + 0x1234) * span.h);
  ```

  (`gridGen.js:227-228`). The candidate sequence depends only on `(attempt, out.length, seed)`. **The region is not an
  input**, so every region tries the same relative cells in the same order. Only `isBuildableCell` rejections and the
  curated-cell spacing make the regions differ.
  - **Measured:** the 99 filler POIs occupy only **40 distinct relative positions**. Relative cell (28,5) is used in
    **8 of 9** regions, (4,9) and (7,18) in 7, (11,4) and (23,10) in 5. Each region is close to the same stamp.
  - Candidates are rejected if `!isBuildableCell` (water or ridge, `:202-205,229`) or if the Manhattan distance to any
    taken cell is under 3 (`:134,213-215,230`). The taken set starts with the region's curated cells (`:219`).
  - The draw region is the sector rect inset by `FILLER_EDGE_MARGIN = 2` (`:135,221-224`). Up to 400 attempts
    (`:226`); every region reached its count.
- **The seed** is `WORLD_SEED = 0x5ba51e` (`worldGrid.js:14`), with fixed salts per draw (`gridGen.js:228,239,244,268,294`).
  The output is byte-stable, and `gridGen.test.js:79-89` pins that.
- **What placement ignores:**
  - **Labels.** There is no reserved zone. `home_city` and `sh_ruin` sit on the anchor, and `gen_*_7` / `gen_*_11` fall
    within ±5×±2 cells of the label centre in west_warrens, red_lowlands, mistwood, ember_reach, dragon_spire and
    command_ruin.
  - **Region edges.** The only rule is the 2-cell inset. No POI is placed toward the side you approach from; the
    stronghold is always top-centre, whatever the `requires` direction.
  - **Terrain affinity.** `nodeFor` picks the resource by hash plus the buff bias (`:242-247`), never by terrain, so
    wood is not in forests and water is not by water. Terrain only vetoes cells.
  - **The home base.** The home city is treated like any curated cell (spacing ≥ 3 only). The nearest POIs to home are
    `gen_home_vale_9` at 7.3, `rn_well` at 8.6 and `rn_oak` at 10.0 cells.
  - **Hierarchy.** There is no inner/outer ring, guard radius or cluster template.

### 8.2 Measured spacing per region

The table measures nearest-neighbour (NN) distance within each region, in cells. The edge column is the minimum
distance to the sector edge.

| Region (tier) | POIs | NN min | NN avg | NN max | NN < 3 | Edge min | Quadrants NE/NW/SE/SW |
|---|---|---|---|---|---|---|---|
| home_vale (1) | 16 | 2.24 | 4.81 | 8.94 | 3 | 2 | 4/4/6/2 |
| west_warrens (2) | 14 | 2.24 | 3.91 | 7.00 | 2 | 2 | 6/3/2/3 |
| red_lowlands (2) | 16 | 2.83 | 4.51 | 8.49 | 2 | 2 | 5/6/3/2 |
| mistwood (3) | 16 | 2.24 | 4.22 | 11.70 | 6 | 2 | 8/3/3/2 |
| frost_hold (3) | 11 | 3.61 | 5.44 | 9.43 | 0 | 2 | 3/3/3/2 |
| goblin_crest (4) | 11 | 3.00 | 4.68 | 9.49 | 0 | 3 | 4/1/2/4 |
| ember_reach (4) | 16 | 2.24 | 4.37 | 7.00 | 2 | 2 | 4/3/4/5 |
| dragon_spire (5) | 11 | 3.16 | 5.40 | 12.08 | 0 | 3 | 4/3/1/3 |
| command_ruin (6) | 14 | 2.24 | 4.44 | 14.76 | 2 | 2 | 4/5/2/3 |

- Across all 125 POIs: NN average 4.50 cells, minimum 2.24 (√5, the Manhattan-3 floor).
- **Spacing:**
  - No POIs share a cell or a neighbouring cell, and no cross-border pair is closer than 4 cells.
  - The closest curated–filler pairs are `op_relay`–`gen_home_vale_0` and `op_relay`–`gen_home_vale_3` at 2.24, then
    `wb_roc`–`gen_red_lowlands_8`, `sh_mist`–`gen_mistwood_11` and `rn_timber`–`gen_mistwood_3` at 2.83.
  - At 2.2–2.8 cells, two 32px-diameter screen markers overlap at any zoom below about 0.14. Once the 15px label pills
    appear (zoom > 0.45), neighbours at 2.2 cells (~155 screen px at 0.7) still clash horizontally.
- **Density** is 11–16 POIs per 1,024-cell region (one per 64–93 cells), and it is **uniform**: there are no dense
  hubs or empty wastes by design. The large NN-max values (12–15 cells) are holes left by rejected terrain, not
  intended open space.

### 8.3 Counts and levels by region

| Region | Curated | Filler by type (level) |
|---|---|---|
| home_vale | city, rn_oak L1, rn_well L1, ruin_vale L1, op_relay L1 | 11 nodes L1 |
| west_warrens | sh_west L3, rn_iron L2, camp_west L2, ruin_warren L3, op_shrine L3 | 4 nodes L2, 5 camps L2 |
| red_lowlands | sh_red L3, rn_grain L2, camp_red L2, wb_roc L8 | 10 nodes L2, 2 camps L2 |
| mistwood | sh_mist L5, rn_timber L3, op_tower L4 | 7 nodes L3, 6 camps L3 |
| frost_hold | sh_frost L5, rn_ice L3 | 6 nodes L3, 3 camps L3 |
| goblin_crest | sh_crest L6, rn_crest L4 | 8 nodes L4, 1 camp L4 |
| ember_reach | sh_ember L6, rn_ore L4 | 12 nodes L4, 2 camps L4 |
| dragon_spire | sh_dragon L7, rn_hunt L5 | 9 nodes L5 |
| command_ruin | sh_ruin L10 | 13 nodes L6 |

- **How levels are assigned:**
  - Curated levels are authored by hand (`worldMap.js:135-187`).
  - Every filler POI in a region gets `level = region.tier` (`gridGen.js:248,257,269,277`), so all filler in a region
    shares one level.
- **What "level" does: nothing.** The POI level is display only.
  - `marchResolver._fight` passes only `monsterId`, `milMult` and `{ structure }` (`marchResolver.js:20-23`).
  - `CombatManager.resolveMarchBattle` reads `MONSTERS_CONFIG[monsterId]` and nothing else (`CombatManager.js:115-139`).
  - Node level does not feed the node math either: `nodeEconomy.js:7-19` and `marchResolver.js:41-48` use `capacity`,
    `regenPerSec` and `gatherRate` directly.
- **Tier vs. distance from home.** Tier follows `requires` depth, not distance. Distances below are from the home
  point to each region's centre:
  - tier 2: about 32 cells;
  - tier 3: about 64 cells;
  - tier 4: about 71 cells;
  - tier 5: about 90 cells;
  - tier 6 (command_ruin): 45 cells, so the hardest region is nearer than every tier-3 to tier-5 region.

  March time scales with distance (§5) and not with tier.

### 8.4 Resources

- **Curated nodes** each have an authored resource, gather rate, capacity and regen (`worldMap.js:136-184`). For
  example, `rn_oak` is wood 6/s, 1200 capacity, 2.0/s regen, and `rn_iron` is iron 4/s, 800 capacity, 1.2/s regen.
- **Filler nodes** derive everything from the tier (`gridGen.js:258-261`): `gatherRate = 3+tier`,
  `capacity = 600+150·tier`, `regen = 0.8+0.2·tier`.
  - Tier 1 gives 4/s, 750, 1.0.
  - Tier 6 (command_ruin) gives 9/s, 1500, 2.0.

  A node 45 cells away therefore holds 2× a home node.
- **The resource mix per region** (all nodes):

  | Region | Resource mix | Total capacity |
  |---|---|---|
  | home_vale | wood 4, water 5, iron 3, food 1 | 10,450 |
  | west_warrens | iron 3, food 1, water 1 | 4,400 |
  | red_lowlands | food 6, water 3, iron 2 | 10,000 |
  | mistwood | wood 6, iron 1, water 1 | 8,550 |
  | frost_hold | water 3, wood 2, food 1, iron 1 | 7,400 |
  | goblin_crest | stone 3, iron 2, wood 2, water 2 | 10,500 |
  | ember_reach | water 7, stone 3, iron 2, food 1 | 15,400 |
  | dragon_spire | food 4, water 3, iron, wood, stone | 13,350 |
  | command_ruin | iron 6, stone 3, food 2, water 2 | 19,500 |

  - **Stone** appears only from tier 4 up, and **money** nodes do not exist (`NODE_RESOURCES`, `gridGen.js:137`).
  - Ember Reach's signature buff is stone, but it has 7 water nodes. The 40% bias (`:245`) is weaker than the uniform
    5-way roll it falls back to.
- **Nodes regenerate in place** (`nodeEconomy.regen`, `nodeEconomy.js:7-10`, ticked in `WorldMapManager.update`
  `:38-39`). They never move, despawn or get exhausted. A home node (1200 capacity at 2/s) refills from empty in
  10 minutes.
- **What limits a gather is the squad's load:** `loadCapacity` = units × 25 (`marchMath.js:14,56-58`), taken by
  `takeFromNode` (`WorldMapManager.js:188-195`). `gatherRate` only sets the on-site dwell, clamped to 2–15 s
  (`marchMath.js:15-16,61-64`). **(opinion)** The capacity and rate differences between near and far nodes barely
  change the payoff, so there is little reason to gather far from home.

### 8.5 Monsters and camps

- **Monster pools.** `enemyTypes` per faction (`worldMap.js:64-65`):
  - goblins: `goblin_camp` (difficulty 1), `orc_warband` (3), `undead_legion` (5), `demon_gates` (7);
  - bandits: `bandit_camp` (2), `troll_bridge` (4), `frost_giant` (6), `demon_gates` (7).

  Difficulties are the `difficulty` field in `combat.js` `MONSTERS_CONFIG`.
- **Filler camps draw uniformly from the faction's whole pool, whatever the region tier**
  (`gridGen.js:266-268,279`). Measured results:
  - **west_warrens (tier 2):** 3 × `undead_legion` (difficulty 5) and 2 × `goblin_camp`, all labelled L2. Its
    stronghold is `orc_warband` (difficulty 3).
  - **red_lowlands (tier 2):** `gen_red_lowlands_6` is **`frost_giant`** (difficulty 6, the same monster as the L8
    world boss) labelled **L2**. Its stronghold `troll_bridge` is difficulty 4.
  - **frost_hold (tier 3):** 2 × `demon_gates` (difficulty 7) labelled L3. Its stronghold `frost_giant` is difficulty 6.
  - **goblin_crest:** filler `demon_gates` matches its stronghold.
  - **ember_reach:** 2 × `frost_giant`.

  So **filler camps are often harder than the region's own stronghold**, and the displayed level misrepresents them.
  `MONSTERS_CONFIG.*.requires` (townhall gates) and `maxRewardedWins` are not consulted by `resolveMarchBattle`
  (`CombatManager.js:115-139`).
- **Names and icons.** Every filler camp is "Scav Warband" 👺 (`gridGen.js:275-276`), whatever the monster or faction.
  The curated camps are "Scav Camp" 🪓 and "Raider Hideout" 🗡️ (`worldMap.js:146,155`).
- **Respawn.** All camps use `respawnMs: 1_800_000` (30 min): curated `:146,155`, filler `gridGen.js:280`.
  `markHostileCleared` sets `respawnAt` on the same POI (`WorldMapManager.js:225-232`), and `update` clears it in place
  (`:40-42`). **A respawn reuses the same cell and the same monster.** Loot is the monster's fixed `rewards`
  (`CombatManager.js:126-131`). A tier-2 `frost_giant` camp pays 1,200 money, 300 stone and 80 iron every 30 minutes.
- **Strongholds:** one per non-home region, authored, at top-centre (§8.1). They are one-time: once cleared they have
  no `respawnMs`, so `respawnAt = 0` (`WorldMapManager.js:230`). The capture flips the region
  (`marchResolver.js:60-62`).
- **World boss:** a single authored POI, `wb_roc` in red_lowlands at relative (28,7) near the sector's top-right
  corner (`worldGrid.js:55`). It is a `frost_giant` labelled L8, with a clock window (`worldBoss.js:16-20`). Nothing
  marks it as a landmark beyond its marker pulse.
- **Garrisons:** `ruin_warren`, `op_shrine` and `op_tower` are all guarded by `goblin_camp` (difficulty 1)
  (`worldMap.js:147,149,167`). The L4 watchtower in tier-3 Ashwood therefore has the game's weakest guard.

### 8.6 Ruins and outposts

- **Ruins:** only 2, `ruin_vale` (home_vale, relative (7,25)) and `ruin_warren` (west_warrens, relative (7,5))
  (`worldMap.js:138,147`). They are one-time: `looted` is set by `markRuinLooted` (`WorldMapManager.js:198-203`), and
  `isScoutAvailable` returns false afterwards (`:110-112`). They have fixed rewards. Filler never generates ruins.
- **Outposts:** only 3, `op_relay` (outpost subtype, home_vale), `op_shrine` (shrine, west_warrens) and `op_tower`
  (watchtower, mistwood) (`worldMap.js:140,149,167`). They are persistent and owner-flipped
  (`captureOutpost`, `WorldMapManager.js:206-214`). None sets `startOwner`, so all start `'neutral'`
  (`worldState.js:35`). They sit at relative x 26–27 in their sector.
- **Spread:** 6 of 9 regions, including the whole bandit side (red_lowlands, frost_hold, ember_reach), have no ruin
  and no outpost. The only watchtower is on the goblin side.

### 8.7 Problems

1. **Copy-paste regions.** Filler draws from one region-independent candidate sequence (`gridGen.js:227-228`): 99
   filler POIs use 40 relative positions, one of them in 8 of 9 regions. Curated strongholds and nodes repeat the same
   relative cells too. The regions are close to one template with a different tint.
2. **Level and difficulty mismatch.** POI levels are cosmetic, and filler monsters are random from the faction's full
   pool. A tier-2 region holds difficulty 5–6 camps labelled L2 that are harder than its stronghold, and a level label
   promises nothing.
3. **No hierarchy within a region.** All filler shares one level. Nothing grades from the edges toward a core, and
   there are no clusters (camp plus guarded node), approach gates or "boss lair" area. The stronghold always sits at
   top-centre regardless of the approach direction.
4. **Monotony of type.** About 79% of all POIs are resource nodes (99 of 125). Neutral regions are 100% nodes plus a
   stronghold. There are 2 ruins and 3 outposts in the whole world, there is one boss, and the bandit side has no
   ruins or outposts.
5. **No story or guards.** Garrisons are three difficulty-1 `goblin_camp`s. Filler camps share one name and icon.
   Nothing groups POIs into places, such as a raider town or a quarry guarded by a warband.
6. **Density is uniform and sparse at play zoom.** There are about 2–3 POIs per home-zoom screen and no dense hubs.
   The only empty areas are accidental terrain-rejection holes (NN max up to 14.8 cells).
7. **Labels collide with content.** `home_city` and `sh_ruin` sit on the label anchor, every stronghold is 4–6 cells
   above it, and several filler POIs fall in the label box.
8. **Terrain is decorative and only vetoes.** No terrain affinity, and curated POIs aren't validated (`camp_red` is on
   water).
9. **The resource economy is flat with distance.** Far nodes are ≤2× the capacity of near nodes, but the yield is
   capped by squad load. Stone and money are absent early, and the signature-resource bias is weak (Ember Reach is
   mostly water).
10. **Respawns are static.** Camps return on the same cell with the same monster on a global 30-minute timer, and nodes
    never move. Nothing on the map changes over time except the boss window.

### 8.8 Constraints for a new placement system

- **Curated ids are save keys:**
  - `poiState` (`worldState.js:21-31`), `outpostOwner` (`:32-36`) and `discovered` (`WorldMapManager.js:257-259`) key
    on POI ids;
  - the 26 curated ids are frozen by `gameData.test.js:146-151` (ADR 0017).

  **Positions are free to change; ids are not**, unless Steve's dev-only no-legacy stance is invoked deliberately and
  the snapshot is updated.
- **Filler is regenerated on every load and never serialized** (`gridGen.js:1-6`, ADR 0011), but its **runtime state
  is saved by id** (`gen_<region>_<n>`).
  - A new generator that changes counts or ordering silently remaps saved `remaining`/`respawnAt` to different POIs.
    Reconcile drops unknown ids and seeds new ones (`worldState.js:55-70`).
  - That is acceptable in dev, but the generator must stay **deterministic** (pure in seed, cell and region) so ids are
    stable between loads.
  - A seeded weekly or dynamic layer (moving herds, rebel camps) must therefore be a *separate* serialized entity store
    (§7.1), not filler.
- **The save fields involved:**
  - `WorldMapManager.serialize`: `poiState`, `regionOwner`, `outpostOwner`, `timedBuffs`, `discovered`
    (`WorldMapManager.js:244-250`);
  - `MarchManager.serialize`: `marches` (holding `targetPoiId`) and `idSeq` (`MarchManager.js:212-214`).
  - An in-flight march whose target id disappears resolves as `lost_target` (`marchResolver.js:33`).
  - Every new field (sub-region owner, entity state, cell overlays) needs seed and reconcile.
- **Tests that pin the current generator:**
  - `gridGen.test.js`: byte-identical filler (`:79-83`), the seed moving filler (`:85-89`), ids unique and namespaced
    (`:91-98`), no collision with curated ids (`:100-105`), counts within the band (`:107-113`), inside the sector and
    off unbuildable terrain (`:115-122`), only nodes or camps (`:124-130`), nodes-only for neutral (`:132-137`), level
    equals tier (`:139-144`);
  - `world-smoke.mjs:29` expects `gen_home_vale_0` to exist.

  A new placement system appends tests (the suite is additive) and deliberately rewrites the pinned ones.
- **Geometry coupling:** filler is bounded by the sector rect (`gridGen.js:218-224`). Sub-regions or non-rect regions
  need a cell→region lookup first (§1.5).
- **Built to extend:** counts, pools and templates should be data (`ai-factions.md` and CLAUDE.md "Built to extend").
  Today `FILLER_PER_SECTOR`, `FILLER_MIN_SPACING`, `NODE_META` and the 40% camp and bias rolls are constants in
  `gridGen.js:134-145,245,295`.
- **Monster strength has to come from somewhere real.** Either `resolveMarchBattle` gains a level and strength scaler,
  or placement must pick monsters by tier from an ordered pool. Today `difficulty` / `campaignStage` exist on every
  monster (`combat.js`) but placement does not use them.

---

## Files inspected

- `CLAUDE.md`; `docs/10-design/world-map.md`, `grit-reskin.md`, `assets.md`, `ai-factions.md`, `world-events.md`
- `docs/research/ai-events-codebase.md` (§1, §2, §7, §10); `docs/10-design/mockups/ai-events/BRIEF.md` (map references)
- `docs/20-decisions/0011-grid-world-geometry.md`, `0013-grid-renderer-chunking.md`; `docs/30-roadmap.md` (world lines)
- `js/entities/data/worldMap.js`, `worldGrid.js`, `gridGen.js`
- `js/ui/world/WorldRenderer.js`, `gridLayer.js`, `worldGrade.js`, `worldProjection.js`, `WorldCamera.js`,
  `PoiDetailPanel.js`, `MarchDispatchSheet.js` (head); `js/ui/controllers/WorldMapUI.js`
- `js/systems/world/WorldMapManager.js`, `worldState.js`, `regionBuffs.js`
- `js/systems/march/MarchManager.js`, `marchMath.js`, `marchRules.js`, `marchResolver.js` (grep and `:18-23`)
- `js/systems/world/nodeEconomy.js`, `worldBoss.js` (head); `js/systems/CombatManager.js:114-140`;
  `js/entities/data/combat.js` (`MONSTERS_CONFIG` difficulty, stage and requires)
- Node measurement scripts (session scratchpad, not in the repo): per-region spacing, counts, terrain under POIs,
  relative-cell reuse, monster pools
- `js/ui/city/cityGround.js` (header), `js/systems/TutorialManager.js` (grep), `js/entities/data/navigation.js` (grep),
  `js/ui/controllers/NavigationUI.js` (grep), `js/systems/ResourceManager.js` / `SoundManager.js` (grep)
- `css/components/world-view.css`; `index.html` (`#view-world` block)
- `tests/browser/world-smoke.mjs`, `tests/browser/harness.mjs`; `tests/unit/gameData.test.js` (world block),
  `gridGen.test.js`, `gridLayer.test.js`, `worldState.test.js`, `regionBuffs.test.js`, `marchMath.test.js` (test names)
- `assets/tiles/**` listing plus PNG dimensions of `ground/grit` and `props/grit`
- Screenshots: `ui-reference/03`, `04`, `05`, `07`, `20`, `bg-world-today`; new captures `30-world-mid-zoom.jpg`,
  `31-world-lod-boundary.jpg`, `32-phone-world-zoomed-out.jpg` (git-ignored)
