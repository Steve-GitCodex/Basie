# Grit Reskin — "Last Shelter" Direction (active workstream)

> Status tracking lives in `docs/30-roadmap.md`; session handoff in `docs/40-active.md`.

**Goal**: keep the game systems exactly as they are and close the *feel* gap with Last
Shelter: Survival along three axes:

1. **Workstream A** — gritty post-apocalypse art direction (city + world + UI theme).
2. **Workstream B** — rebuild the world map as a huge uniform tile grid you scroll across.
3. **Workstream C** — polish/juice (animations, effects, real sound).

**Explicitly out of scope**: the fixed city blueprint stays (no free-form building field);
no gameplay/economy rebalance; no new managers unless noted; Arena/backend unchanged.

This document is written to be executed by an AI agent (Sonnet/Opus) one phase at a time.
Each phase is sized to roughly one session and ends with a verification step. Read
`CLAUDE.md` first — its Critical Gotchas section is binding.

---

## Ground truth (verified 2026-07-09 — don't rediscover this)

| Fact | Where |
|------|-------|
| City renderer: Canvas-2D iso, sprites via manifest | `js/ui/city/CityRenderer.js` (1123 ln), `js/ui/city/cityAssets.js` (97 ln) |
| Sprite contract: building sprite includes its own ground block, drawn bottom-anchored over the zone tile; missing sprite → colored fallback diamond | `cityAssets.js` header comment + `CityAssets.load()` |
| Pre-render idiom for tinted variants (never per-frame `ctx.filter`) | `CityAssets._prerenderGrayscale()` — copy this pattern for grim-grade variants |
| World renderer: Canvas-2D top-down, layers = terrain → warped organic region polygons → screen-space POI markers → march arcs | `js/ui/world/WorldRenderer.js` (504 ln), `js/ui/world/worldProjection.js` |
| World data: 3600×2600 px bounded field, 9 tessellating rect regions, ~28 curated POIs with pixel coords | `js/entities/data/worldMap.js` |
| POI/region **ids are save-state keys** (`WorldMapManager` node stores, `_outpostOwner`, `_discovered`, region owners). Renaming an id orphans save data | `js/systems/world/worldState.js` seed/reconcile |
| Every new world save field needs a **seed + reconcile entry** or loads silently drop it | `worldState.js` (CLAUDE.md gotcha) |
| Sound: fully procedural Web Audio tones, event-wired at the bottom of the file. **No sample playback exists yet** | `js/systems/SoundManager.js` (167 ln) |
| Audio samples already in the repo, unused: `assets/audio/combat/` (Kenney impact sets: metal/glass/bell/generic × light/medium/heavy × 5 variants), `assets/audio/effects/`, `assets/audio/ui/`, `assets/audio/voice/` | `assets/audio/` |
| UI theme: single `:root` palette, sci-fi electric blue/neon green | `css/base/variables.css` |
| Icons: 50 SVGs, rendered via `icon()` helper — recolorable via CSS | `assets/icons/svg/` |
| Never innerHTML-rebuild on a tick or over live progress/open popups; patch in place | memory `reactive-ui-no-tick-rebuild` |
| Verification: no automated tests — `run.bat` + browser, Playwright notes in memory `basie-verify-playwright` | |
| Global rule: no god files — new logic goes in new sibling modules (~400-line ceiling) | user global CLAUDE.md |

**Asset research conclusion**: there is no ready-made CC0 post-apocalyptic pack matching
Kenney's 132×66 iso diamond format. Free/CC0 candidates exist for the *top-down world*
terrain (itch.io tags `isometric+post-apocalyptic`, `post-apocalyptic+top-down`;
opengameart CC0 collections; Screaming Brain "Iso Town Pack" CC0, 443 tiles) but the iso
*city buildings* will come from either (a) a procedural grim-grade of the existing Kenney
sprites (Phase A1 — zero new assets, ships immediately) or (b) an AI-generated sprite set
in one consistent style, dropped in one-by-one via the manifest (Phase A3 — the real
visual win). Plan both; A1 is not throwaway (it becomes the shared grading layer that
also unifies A3 sprites).

---

## Workstream A — Gritty post-apocalypse restyle

### Phase A1 — Grim grading pass (no new assets)  *(1 session)*

Make the existing scene read desaturated/cold/dusty purely in code.

- **Function plaques (quick win, survives A3):** the Kenney sprites don't communicate
  building purpose (all generic city blocks — see `assets.md` § function-readability).
  Draw each building's existing SVG system icon as a small sign/plaque on its tile
  (pre-rendered per building like the grayscale variants, never per-frame SVG
  rasterisation). Zero new assets; makes every building's purpose readable immediately
  and remains useful as a UI affordance after the A3 art swap.

- New module `js/ui/city/cityGrade.js` (keep CityRenderer under control — don't grow it):
  - At load, pre-render **graded variants** of every building + ground sprite
    (offscreen canvas, one-time `ctx.filter`: e.g. `saturate(0.55) brightness(0.9)
    contrast(1.08) sepia(0.15) hue-rotate(-10deg)`), mirroring `_prerenderGrayscale()`.
    Renderer draws graded variants; the grayscale locked-slot variant grades on top of it.
  - Full-scene overlay after the tile pass: subtle vignette (radial gradient), a low-alpha
    cold color wash, and a horizon haze band. All cheap single `fillRect`/gradient draws.
- Sky/backdrop: replace the current gradient backdrop colors with overcast
  slate/ash tones; rebalance the existing day/night tint toward "permanent overcast with
  amber dusk" rather than bright day.
- World map: same treatment in `WorldRenderer` terrain layer — mud/ash ground palette
  instead of the current colors; region fills shift to faction-tinted grime (keep faction
  hue identity, drop saturation).
- **Verify**: run the game, screenshot base + world at day and night, confirm no per-frame
  `ctx.filter` (perf) and locked-slot grayscale still distinguishable.

### Phase A2 — UI theme shift  *(1 session)*

`css/base/variables.css` is the single palette source — retheme there, touch component
CSS only where a raw color was hardcoded (grep `hsl(200` and `hsl(150` across `css/`).

- Direction: military-salvage. Suggested anchors (tune by eye):
  - Backgrounds: keep the dark ladder but shift hue 220→~35 desaturated
    (`hsl(35,12%,6%)` base) or a neutral gunmetal `hsl(210,8%,7%)`.
  - `--clr-primary` electric blue → **amber/signal-orange** `hsl(32,90%,55%)` (Last
    Shelter's HUD accent family); `--clr-border-glow`, `--shadow-primary`, `--glow-primary`
    follow.
  - `--clr-gold` neon green → **olive-drab/military green** `hsl(80,45%,45%)` for
    success/positive.
  - Danger stays red; warning stays amber (deconflict with new primary by darkening one).
  - Hero tiers: common=steel, rare=amber, legendary=deep orange/red.
- Fonts: keep `Orbitron` for display (reads "military console" fine) or swap to a
  stencil-style Google font if desired — one-line change in `--font-display`.
- Icons: the 50 SVGs are tinted by CSS `currentColor`/classes — verify they inherit the
  new palette; adjust any hardcoded fills.
- **Verify**: click through every view (nav flip, More grid, modals, toasts, bq-sidebar);
  check contrast of text-secondary/muted on the new backgrounds; check the `--z-*` ladder
  untouched.

### Phase A3 — Asset replacement + base projection swap (the real look)  *(2–3 sessions + user-in-the-loop art)*

**Scope change (ADR 0009):** A3 now bundles the diamond-iso retirement. The base view
moves to a square-grid ¾ projection — `gridMath.js` replaces `isoMath.js` (square cells
+ mild Y-foreshortening, same projection family as the world map); CityCamera/culling/
painter-sort/blueprint/placements/proxy layer all survive (projection-agnostic). Redo
the decorative terrain ring as square cells; delete the diamond hit-test/seating math.
Reuse B2's chunked-terrain renderer for the city ground layer (fixes the 30fps
full-repaint ceiling). Do the `CityRenderer` split (roadmap: `cityInput`/`cityAgents`/
`cityAmbient`) **before** this phase.

- **Art pipeline (ADR 0010 — plan of record): CC0 3D render-to-sprite.** One Blender
  scene: fixed orthographic ¾ camera + grim light rig; batch-render PNGs matching the
  `assets.md` target contract. Base geometry: Quaternius **Ultimate Fantasy RTS**
  (CC0, .blend, building evolution stages → **per-level building sprites**, new scope),
  kit-bashed toward post-apoc grit (corrugated metal, barrels/antennas/tarps from
  Kenney Survival Kit); gaps from Kenney/Quaternius city + survival kits. AI is used
  for model *textures* only, not whole sprites. Session 1 = Blender scene + render
  script + the always-on-screen five (townhall, house, farm, barracks, storehouse);
  then batches via the manifest. Do NOT generate diamond-iso art or direct AI sprites.
- Process: drop new PNGs in `assets/tiles/buildings/grit/`, remap `ISO_BUILDING_MAP`
  entries **one building type at a time** (the manifest is the only wiring — no renderer
  changes). The A1 grading layer stays on, which visually unifies mixed old/new sprites
  during the transition.
- Same path for ground: `GROUND_TILES` keys (grass→cracked earth, road→broken asphalt,
  plaza→rubble concourse). The decorative terrain ring in `cityLayout.js` may reference
  additional landscape tiles — grep for `landscapeTiles_` before assuming the manifest
  covers everything.
- 20 building types + 9 ground keys = **29 images minimum** for full coverage. Prioritize:
  townhall, house, farm, barracks, storehouse (the always-on-screen five), then the rest.
- **Verify**: fallback diamond still renders for any missing sprite; grayscale locked
  variant regenerates from the new art.

### Phase A4 — Fiction/copy pass  *(DONE 2026-07-18 — ADR 0017)*

> **As built:** `worldMap.js` (factions/regions/curated-POI names + grit emoji glyphs,
> kept as emoji not SVG — SVG markers stay B3), `combat.js` (`MONSTERS_CONFIG` +
> `CAMPAIGNS_CONFIG`), `buildings.js` (`magictower` → Comms Tower only; other names were
> already genre-neutral), and a light re-fiction of all 6 `story.js` chapters. **Deferred
> (TODO, ADR 0017):** hero cast (`heroes.js` + hero-card strings in `economy.js`) → folded
> into the Hero redesign; unit tier names (`units.js`). Frozen-id regression test added.

The world is currently fantasy (goblins, dragons, shrines). Re-fiction to post-apocalypse
**names only — never ids** (ids are save keys, see ground truth).

- `worldMap.js`: region/POI `name`, faction `name`/`tag`, and `icon` fields (e.g. Goblin
  Clans → "The Scavenger Packs", Bandit Coalition → "Red Talon Raiders", Haunted Keep →
  "Irradiated Depot", Dragon's Lair → "Behemoth Nest", shrine/watchtower → relay
  bunker/radar mast). Emoji icons on POIs should move to the SVG `icon()` system or new
  grit-appropriate glyphs while at it (WorldRenderer draws `poi.icon` — check how, adapt).
- `MONSTERS_CONFIG` display names (goblin_camp → "Scav Warband" etc. — id stays
  `goblin_camp`). Same for hero/story/quest strings that clash hardest; do a light pass,
  not a rewrite (story text is large — flag remaining clashes in a TODO list instead).
- Building display names in building data (Magic Tower → "Comms Tower" etc.) — display
  strings only.
- **Verify**: load an existing save; confirm all owned regions/outposts/looted ruins
  survive (proves no id was touched).

---

## Workstream B — World map → huge uniform tile grid

Target feel: Last Shelter's world — a big scrollable grid of terrain cells, POIs sitting
on cells, fog over the unknown, marches crawling across it. **Keep the entire march/POI
state machine** (`MarchManager`, `WorldMapManager`, resolver, buffs, fog sets) — this is a
data + renderer replacement, not a systems rewrite.

### Phase B1 — Grid data model + generator  *(DONE 2026-07-16 — ADR 0011)*

> **As built** (differs from the plan below in two places): the generator lives in
> `js/entities/data/gridGen.js`, **not** `js/systems/world/` — `WORLD_MAP` must be
> composed at data-module load, and data must not import from systems (ADR 0011).
> And `worldState.js` needed **no changes**: its seed/reconcile is already id-driven, so
> filler POIs flow through automatically. Shipped: 96×96 @ 100px, 9 sectors of 32×32,
> 26 curated + 99 filler POIs, `BASE_SPEED_PX` 80→265 to hold march times.

- New module `js/entities/data/worldGrid.js` (data) + `js/systems/world/gridGen.js`
  (deterministic generator):
  - Define `GRID = { cols, rows, cellPx }` — suggest **96×96 cells at 100 world-px**
    (9600×9600 world; ~7× current area — "huge" without perf pain given culling in B2).
  - Keep the 9-region ownership structure but scale it: each region becomes a **sector
    of cells** (32×32 cells each in a 3×3 sector layout). Region ids stay identical
    (`home_vale`, `mistwood`, … — save-compat).
  - Terrain per cell generated **deterministically from a fixed seed** (simple value-noise
    or hash-based; no library): wasteland / cracked earth / dead forest / water / ridge /
    ruin-rubble. Store nothing per-cell in saves — regenerate from seed every load.
  - Curated POIs keep their ids and roles but get new positions expressed as cell coords
    (`cx, cy`), spread across their region's sector. Add **procedural filler POIs**
    (resource nodes + camps) scattered per sector with deterministic ids
    (`gen_<region>_<n>` — ids must be stable across loads or `worldState.js` reconcile
    drops their state). Density: ~8–14 filler POIs per sector, level scaling with the
    region's difficulty tier.
  - `worldMap.js` stays as the source for regions/factions/curated-POI *definitions*;
    `worldGrid.js` owns geometry. `WORLD_MAP.bounds`/`home`/poi `x,y` get derived from
    cell coords so **everything downstream (marchMath distances, camera, hit-testing)
    keeps working unchanged**.
- Update `worldState.js` seed/reconcile for the new POI id set (existing save entries for
  moved curated POIs carry over by id; filler POIs seed fresh).
- **Verify**: headless sanity — log generated POI counts per region, assert id
  determinism across two generator runs, load an old save and confirm region owners and
  curated-POI state survive.

### Phase B2 — Grid renderer  *(DONE 2026-07-16 — ADR 0013)*

> **As built** (differs from the plan below in two places): `invalidate()` drops the
> **whole** chunk cache rather than the per-chunk invalidation specified here — only
> viewport chunks are ever rebuilt, so targeting is bookkeeping with no payoff. And
> `HOME_ZOOM` was **not** retuned (0.7 frames ~18 cells across, which reads right);
> only `POI_PICK_RADIUS` moved, 42 → 50 (half a cell). Shipped: `gridLayer.js` (226 ln),
> 16×16-cell chunks at a fixed 512×512 texture scale blitted with smoothing off,
> flat-fill LOD below zoom 0.22, per-cell fog with no new save state.
> **Note for B3:** the fixed-texture-scale cache is only crisp because cells are flat
> uniform fills. A real terrain atlas invalidates that — see ADR 0013.

Replace the organic-region terrain layer in `WorldRenderer` with the tile grid. Keep the
POI-marker, march-arc, and input layers as-is (they're screen-space and coordinate-based).

- New module `js/ui/world/gridLayer.js`; `WorldRenderer` calls it for the terrain pass
  (renderer is 504 lines — do not inline a tile engine into it).
- **Chunking**: render terrain into offscreen canvas chunks (e.g. 16×16 cells per chunk),
  draw only chunks intersecting the viewport, invalidate a chunk only when something in
  it changes (fog reveal, region capture recolor). Never draw 9,216 cells per frame.
- **LOD**: below a zoom threshold, skip per-cell detail and draw chunk-level flat color +
  region tint (Last Shelter does exactly this zoom-out simplification).
- Region identity: tint cells by owner faction (reuse existing faction colors post-A1
  desaturation); draw sector borders as thin seams; region label at sector center
  (existing label code adapts).
- **Fog per cell**: currently fog is per-POI (`isDiscovered`). Add a cell-level *visual*
  fog mask derived from the same sources (unlocked regions fully visible; watchtower
  `revealRadius` circles; else dark). No new save state — it's a pure function of
  existing `_discovered`/region state, rendered into the chunk cache.
- Camera: `WorldCamera` (98 ln) is bounds-based — it takes the new larger bounds
  unchanged; retune `HOME_ZOOM` and zoom floor for the bigger world.
- **Verify (perf gate)**: pan/zoom across the full map at 60fps with DevTools performance
  recording; fog reveal and region capture recolor the right chunks; POI tap targets
  still hit (`POI_PICK_RADIUS` vs new cell size).

### Phase B3 — Grid-world texture pass  *(1 session + art generation)*

- **Plan of record (2026-07-15): AI-generated seamless terrain atlas**, not CC0 hunting.
  Seamless top-down ground textures are the easiest AI-art win in the project (no
  perspective/lighting-coherence problems, unlike A3's buildings) — generate them
  **before** the A3 building set. Scope: ~5 ground types (wasteland, cracked earth,
  dead forest, water, ridge) × 2–3 variants + 10–15 decal PNGs (wrecks, craters,
  cracks). What sells it is renderer-side and cheap (build into B2's chunk cache):
  per-cell variant pick + slight color jitter (kill repetition), deterministic decal
  scatter, soft-edged fog, vignette/haze. B2's interim flat-color+dither look is a
  placeholder — don't let B3 slip long after B2 or the map reads programmer-art.
- Decorations: cracked-road polylines between sector centers, wreck/crater doodads
  scattered by the same seed, home-city sprite at `home`.
- POI markers: replace emoji markers with the SVG icon system + faction ring (started in
  A4) so markers read cleanly against busy terrain.

---

## Workstream C — Polish / juice

### Phase C1 — Real sound  *(1 session)*

The repo already contains Kenney sample packs under `assets/audio/` that nothing plays.

- New module `js/systems/sound/sampleLibrary.js`: manifest (event-name → array of file
  variants), lazy `fetch`+`decodeAudioData` into `AudioBuffer`s, random-variant pick,
  volume per category. `SoundManager` keeps its public preset API (`click()`,
  `victory()`…) but each preset tries a sample first and **falls back to the existing
  procedural tone** if the buffer isn't loaded — zero regression risk. Keep SoundManager
  under ~200 lines by putting all loading/decoding in the new module.
- Inventory the packs first (`ls assets/audio/*`) and map: UI clicks (`ui/`), combat
  impacts (`combat/` metal/generic sets), reward chimes (`effects/`), and check what
  `voice/` holds (possible march-dispatch barks).
- Ambient bed: a low looping wind/rumble (procedural via filtered noise buffer is fine —
  no asset needed) on the world view only, gated by `sfxEnabled` + a new `ambientEnabled`
  setting in `SettingsManager`.
- **Verify**: settings toggle mutes everything; no audio-context errors before first user
  gesture (resume-on-interaction already handled — keep it).

### Phase C2 — Canvas juice  *(1–2 sessions)*

- Shared `js/ui/fx/particles.js` (one lightweight pooled particle module, used by both
  canvases): drifting ash/dust motes (ambient, both views), chimney smoke wisps on
  producing buildings (city), muzzle-flash/impact burst on march battle resolution
  (world), capture ripple when a region flips.
- March movers: draw an animated convoy dot with a trail along the march arc (position
  from existing march progress %), plus an ETA label. (Check what WorldRenderer already
  draws for arcs and upgrade, don't duplicate.)
- Building animations (city): pre-rendered 2-frame light-flicker overlays and a subtle
  scale "pop" on tap; construction sites get animated scaffold/dust while a build timer
  runs.
- Screen feedback: brief flash + tiny camera nudge on battle victory/defeat toast (keep
  amplitude small; respect reduced-motion if trivially available).

### Phase C3 — DOM/UI juice  *(1 session)*

- Resource fly-out: on `resources:added` from a march return or collection, animate a
  small icon from the event's screen origin to the matching HUD `.resource-chip`, then
  tick the number up. **Must patch in place** — no innerHTML rebuilds over live timers
  (memory `reactive-ui-no-tick-rebuild` is binding).
- Number tick-up animation on resource chips (requestAnimationFrame count, ~300ms).
- Panel/modal transitions: standardize on `--transition-spring` slide+fade for sheets
  (MarchDispatchSheet, PoiDetailPanel, BuildablesPanel); toast entrance polish.
- Button press states: universal `:active` scale-down + the C1 click sample.

---

## Sequencing

Recommended order — each phase is independently shippable:

1. **A1 grim grade** (instant visible payoff, zero asset risk)
2. **A2 UI theme** (the two together transform the feel for ~2 sessions of work)
3. **B1 grid data** → 4. **B2 grid renderer** (the biggest single win for the Last
   Shelter feel; do before more art so art targets the final map)
5. **C1 sound** (cheap, assets already in repo)
6. **A4 fiction pass**
7. **C2 canvas juice** → 8. **C3 UI juice**
9. **A3 sprite replacement** and **B3 terrain texture pass** last — they depend on
   art sourcing (user-in-the-loop) and everything else makes the game feel right even
   with placeholder-graded Kenney art.

## Guardrails for the executing agent (binding)

- Read `CLAUDE.md` Critical Gotchas before every phase. Specifically: never rename POI /
  region / building / monster **ids** (display names only); every new world save field
  needs a `worldState.js` seed + reconcile entry; don't serialize derived state
  (fog mask, boss windows, generated terrain).
- Don't grow `WorldRenderer.js`, `CityRenderer.js`, or `SoundManager.js` — new
  capability goes in the new sibling modules named above (~400-line file ceiling).
- Never `ctx.filter` per frame; pre-render variants once (the `_prerenderGrayscale`
  idiom). Never innerHTML-rebuild over live progress or open popups.
- `world-view.css` (`.world-*`) only — don't touch legacy `worldmap.css` (`.world-map-*`).
- Keep `#city-proxy-layer` and all tutorial selector strings intact.
- After each phase: launch via `run.bat`, exercise the changed flow in the browser
  (Playwright notes: memory `basie-verify-playwright`), and load a pre-existing save to
  prove compatibility.
