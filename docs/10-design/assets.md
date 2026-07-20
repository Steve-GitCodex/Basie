# Asset Inventory & Contracts

## Inventory

| Path | Contents |
|------|----------|
| `assets/tiles/buildings/buildingTiles_*.png` | Isometric building sprites (Kenney, mapped in `cityAssets.js ISO_BUILDING_MAP`) |
| `assets/tiles/landscape/landscapeTiles_000–129.png` | Isometric ground blocks: grass, water, cliffs (city ground + ring) |
| `assets/tiles/city/cityTiles_*.png` + `cityDetails_*.png` | Isometric roads, sidewalks, lots (road row + districts) |
| `assets/tiles/terrain/` | Isometric terrain blocks with N/E/S/W rotations (unused so far) |
| `assets/sprites/ui-pack/` | Progress bars, button frames, crosshairs (available for UI use) |
| `assets/icons/svg/` | 50 SVGs for the unified `icon()` system (26 upgraded with Kenney Board Game Icons, CC0) |
| `assets/audio/combat/` | Kenney impact sets: metal/glass/bell/generic × light/medium/heavy × 5 variants — **unused, earmarked for grit reskin C1** |
| `assets/audio/effects/`, `assets/audio/ui/`, `assets/audio/voice/` | Sample packs — unused, earmarked for C1 |

## Building sprite contract

**Current (diamond iso — being retired, ADR 0009):** iso building on a 132×66-base
diamond footprint, PNG with transparency, **includes its own ground block**,
bottom-anchored over the zone tile, consistent light direction, ~2× diamond width for
tall buildings. Missing sprite → colored fallback diamond. **Do not source or generate
any more art against this contract.**

**Target (retuned iso ¾ view — grit Phase A3, ADR 0020 amends 0009):** the projection swap
to a screen-aligned square grid was **not executed** — the chosen CC0 building art
(Quaternius Ultimate Fantasy RTS) is **isometric-rendered**, so its footprints are diamonds
(~1.1–1.3:1), which need a **diamond grid**. `isoMath.js` is kept and retuned to match:
`TILE_W 128 × TILE_H 96` (~1.33:1), `GROUND_BOTTOM = TILE_H/2`. Building sprites are
pre-lit "3D-look" objects, ¾ iso camera (consistent across the pack), PNG with transparency,
bottom-anchored on the tile's front vertex, drawn at **native px** (no fit-to-width) —
trimmed to content bbox and downscaled by **one shared factor** so relative sizes are
authored (town hall > house); larger buildings overhang their plot. Ground = flat-color
**diamond** cells (grit palette); Kenney landscape sprites retired. Manifest is level-keyed
(`GRIT_BUILDING_MAP[type] = {1,2,3}`). Session-1 trimmed dims (@ shared scale 0.34, 256-tall
cap dropped): house 114–147w, farm 153–233w, barracks 153–235w, storehouse 213–216w,
townhall 199w.

**Function-readability requirement (Steve, 2026-07-15 — binding for A3):** the current
Kenney set fails legibility — 20 distinct sprites but all generic city blocks, so
nothing communicates purpose. Every A3 sprite must pass: (1) **function prop dominates
the silhouette** (farm = fields, mine = pit + headframe, barracks = tents + flag,
lumbermill = sawmill + log pile, well = well tower…); (2) **category silhouette test** —
tall/thin military-tech, low/wide production, clustered residential, identifiable when
squinting; (3) **zone color accent** baked in, matching the existing zone tints.
Generation prompts should name the function props explicitly per building.

Tinted/graded variants are pre-rendered once at load (`CityAssets._prerenderGrayscale()`
idiom) — never per-frame `ctx.filter`.

## Sourcing plan of record (grit reskin — ADR 0010)

**Buildings: CC0 pre-rendered iso PNGs (ADR 0020 — no Blender needed).** The Quaternius
**"Ultimate Fantasy RTS"** pack already ships a `PNG/` folder of finished ¾-iso renders
(1024², per family × level × age), CC0 1.0 — the render-to-sprite step is done. Drop-in is:
offline alpha-bbox **trim + shared-scale downscale** (headless-Chromium script, no
Blender/PIL) → `assets/tiles/buildings/grit/<key>_L<n>.png` → level-keyed manifest. The
`.blend`/`.fbx`/`.gltf` in the pack are unused 3D source. Building **evolution stages** →
per-level sprites. Kit-bash toward post-apoc is deferred; the A1 grit-grade layer
desaturates the bright-wood renders at load. Gap-fillers: Kenney 3D kits (Survival Kit, city kits,
Asset Forge for kit-bash-to-sprite), Quaternius Ultimate/Farm Buildings + Zombie
Apocalypse Kit, KayKit city modules. All CC0.

**Prop/deco additions (Steve-approved candidates, 2026-07-15):**
- *Low Poly Forest Pack* (Ajay Karat, opengameart, CC0 — 31 trees + 25 fences,
  textured): city terrain-ring deco (redone at the ADR 0009 swap) rendered in the same
  Blender scene as buildings; ash-recolored trees → world-map dead-forest decals (B3);
  fences → base-perimeter kit-bash props.
- *Kenney Mini Characters* (CC0, 25 rigged + animated 3D characters): batch-render
  walk/idle cycles to small sprite sheets → **city walkers** (replacing the drawn
  shapes in CityRenderer) and **world-map march convoy tokens** (C2 juice). Chibi
  proportions are fine at walker scale (silhouette + dark palette + grim grade);
  do NOT use at close-up scale (no portraits).
- *Cube World Kit* (Quaternius, CC0, animated + textured): **do not mix into the city**
  — voxel aesthetic clashes with the low-poly RTS building library. Approved use only
  as cherry-picked enemies/animals rendered for **world-map POI markers** (separate
  visual context; style variance forgivable at marker scale).
- *Animated Mech Pack* (Quaternius, CC0, 4 rigged+animated mechs): **siege-squad march
  tokens** (mech convoy sprite sheet), **world-boss markers** (animated behemoth on the
  map), future Arena visuals. Fits post-apoc as salvaged war machines.
- *Ultimate Spaceships* (Quaternius, CC0, 10 ships × 5 colors): weak fiction fit —
  approved ONLY as a tiny scavenger-drone sprite replacing the drawn city drone
  (`CityRenderer._drawDrone`) + rare event flyovers. No spaceships as gameplay objects.

**Equipment & loot (feeds the existing equipment framework + Phase 6 crafting):**
- *Low Poly Guns Pack* (Quaternius, OGA, CC0 — 40 guns): render to icon-size sprites →
  **hero equipment icons** / crafting catalog; secondary: military-building kit-bash
  detail (weapon racks).
- *Chest — Blizzard Style* (Yughues, OGA, CC0): **rare-loot moments only** (gacha
  reveal, boss drops).
- *Crate & Barrel Bundle* (Mastahcez, OGA, CC0 — crate + 3 barrel variants):
  **common-loot markers** (gather returns, camp drops) — together with the chest this
  gives a common/rare loot visual hierarchy; barrels also join the building kit-bash
  prop pool.
- *Cethiel's Weapons 3D* (CC0, 10 swords + 4 shields × 3 variants): conditional —
  cherry-pick the 2–3 plainest blades/shields as melee equipment icons only; the
  ornate fantasy pieces and hand-painted style don't fit the grit set.

**Remaining art gaps — sources decided (2026-07-15):**
- **War/battle effects:** *Kenney Particle Pack* (CC0 — explosions, smoke, flares,
  sparks) feeding C2's pooled-particle module; procedural particles for ambient
  ash/dust.
- **Hero skill icons:** *game-icons.net* (~4,000 uniform SVG icons, **CC-BY 3.0 — add
  a credits line**); consumed by the existing `icon()` SVG system as-is.
- **Hero portraits (open risk):** no CC0 source exists for a characterful portrait set.
  Plan: AI-generated with a locked style block + fixed palette, user-approved
  one-by-one, executed alongside the hero-UX redesign (portraits are its centerpiece).
  Fallback: commission.

**World-map terrain: AI-generated seamless atlas** (see `grit-reskin.md` § B3) — the
one place AI art is the right tool; it can also generate material textures for the 3D
models. Interim grading of existing Kenney sprites stays Phase A1. The 2D pack market
(CraftPix/itch pixel-art top-down) was researched and rejected for buildings; usable at
most for world-map decals.
