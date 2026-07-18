# Active — Session Handoff

> Most-updated file in the repo. Every session that changes code updates this file
> (what landed, known issues, exact next steps). See the session protocol in `CLAUDE.md`.

## Current state (2026-07-18)

- Branch: `Working_Branch`. Everything through A1+A2 is **committed** (`6273669`,
  `4d05cf0`). **Uncommitted:** grit reskin Phase B1 + B2 + the new test suite + the
  `?dev` session flag (below) — tree is commit-ready.
- Phase 1 (UI redesign) and Phase 2 (world map MVP + fast-follows) are **done** —
  see `docs/30-roadmap.md`.
- Current direction: **grit reskin** (`docs/10-design/grit-reskin.md`) — art/feel pass
  before Phase 4 AI. A1 + A2 + B1 + B2 landed; next phase: C1 sound (but see "next
  steps" — B3 terrain art has a case for jumping the queue now that B2 has shipped
  the grid in placeholder flat colour).
- **The repo has tests now** (ADR 0012). `npm test` before you hand off; fix a bug →
  add a regression test in the matching `tests/unit/*.test.js`. Contract:
  `tests/README.md`.

### Landed this session (2026-07-18)

4. **`?dev` session flag** (ADR 0014) — kills the from-scratch tax on eyeballing gated
   views. `http://localhost:8000/?dev` boots straight to an unlocked world map: no auth
   click-through, no tutorial, no new-game modal.
   - New `js/core/devSession.js` (~75 ln). Drives the **real** manager APIs: sandbox
     mode → `completeTutorial()` → `buildingManager.build()` raises HQ to Lv.3 + builds
     Rally Point (unlocks the World tab) + Barracks + Infantry Hall → trains infantry and
     forms a squad → `ui:navigateTo` `world`. Sandbox queues are drained synchronously via
     the managers' own `update(dt)` loop; resources floored through public `setCap`/`add`.
     No hand-crafted save, no internal poking — so it can't drift from the serialize format.
   - `main.js` gates on `isDevSession()`: launches as guest, forces `savedState = null`,
     and **skips all persistence** (autosave, `beforeunload`, queue/purchase save hooks) —
     a dev session never reads or overwrites `basie_game_state`, so the real save survives.
   - **Closes the march-test gap** B1 flagged: a fresh guest save had no squads, so march
     dispatch couldn't be driven live. `?dev` now boots with a 4-unit squad in place.
   - **Verified** (`tests/browser/dev-smoke.mjs`, committed): lands in sandbox at HQ Lv.3
     with Rally Point + a march-ready squad on the world map, a pre-seeded real save intact,
     zero page errors. `npm test` 138/138; `boot-smoke` still green (normal boot unregressed);
     `check-comments` clean in the new files (16 pre-existing violations untouched).
   - The military step is best-effort (wrapped) — if the train/squad model shifts, `?dev`
     still boots to the unlocked map, which is the primary goal.

### Landed this session (2026-07-16, latest)

3. **Grit reskin Phase B2 — grid renderer** (ADR 0013). The world map finally *looks*
   like a tile grid; B1's data is now on screen.
   - New `js/ui/world/gridLayer.js` (226 ln) — owns the terrain pass: cells, faction
     tint, per-cell fog, cell + sector seams. Rasterises 16×16-cell chunks into 512×512
     offscreen canvases (`TEX_CELL` 32), LRU-capped at 24, blitted with
     `imageSmoothingEnabled = false`. **Nearest-neighbour is exact here** because every
     cell is a uniform block, so one cached scale stays crisp from zoom 0.075 to 1.6 with
     no per-zoom re-raster. Below `LOD_ZOOM` (0.22) chunks flat-fill instead.
   - `WorldRenderer` **504 → 426 ln**: `_drawTerrain`/`_drawRegions`/`_drawRegionTile` and
     the whole organic warp field (`_warpX`/`_warpY`/`_outline`/`_traceRegion`) are gone,
     replaced by `this._grid.draw()` + a slim `_drawRegionLabels()`. `syncState()` now
     also calls `gridLayer.invalidate()`. The command-ruin "ready to assault" pulse became
     a sector-rect stroke.
   - **No new save state** — fog is a pure function of `isRegionUnlocked` + reveal circles
     from player-held `revealRadius` outposts (the same sources `revealArea` uses).
   - Tuning found by eye from screenshots, not guessed: the tint carries **two alphas**
     (0.14/0.11 over terrain so it doesn't drown the cells; 0.34/0.26 at flat LOD where
     it's the only territory signal), terrain colours were spread across a real **value**
     range (hue-only variation vanished under the tint), and region labels render at
     **constant screen size** with no zoom gate — they'd disappeared exactly when zoomed
     out, which is when you need them.
   - `POI_PICK_RADIUS` 42 → 50 (half a cell). `HOME_ZOOM` left at 0.7 — verified it frames
     ~18 cells across, which reads right; the plan's "retune it" turned out unnecessary.
   - **Verified:** 60fps during a drag sweep (16.7ms median, **16.8ms p95**), headless
     1280×800, zero page errors. Screenshots at home/zoomed-out/max zoom: terrain variety
     reads, cells crisp at max zoom, capture recolours correctly.
     `npm test` 138/138; both smoke scripts pass; `check-comments` clean.
   - **Tests grown:** `tests/unit/gridLayer.test.js` (10 tests — chunk geometry, LOD
     threshold, and the **chunk⊂sector invariant** ADR 0013 leans on: tint/fog resolve once
     per chunk, valid only while `SECTOR.cells % CHUNK_CELLS === 0`). Plus 3 `world-smoke`
     checks. Both were break-tested (deliberately broke `invalidate()` → red → reverted).
   - **Two things the break-test caught, worth knowing:** (a) a whole-canvas hash is a
     **flaky** metric here — boss/ruin markers pulse on their own timers, so it self-drifts
     and false-passes; the check asserts on owned-tint *hue* instead. (b) the zoomed-out
     flat-LOD path **bypasses the chunk cache entirely**, so a cache bug is invisible there
     — the smoke test pans at default zoom on purpose. A future grid test that zooms out to
     "see more" would silently stop testing the cache.

### Landed this session (2026-07-16, later)

2. **Persistent test suite** (ADR 0012) — the first tests in the repo. Additive by
   contract: it only ever grows, so a bug fixed once stays fixed instead of being
   re-probed from a scratchpad every session.
   - **Tier 1 — `npm test`**: 128 `node:test` unit tests, zero dependencies, in
     `tests/unit/` (one file per source module). Covers `gameData` (blueprint zone
     capacity — the `_ensurePlacements` gotcha — requirement refs, resource keys, POI
     id uniqueness/bounds), `worldState` (seed/reconcile round-trips, the ADR 0002
     gotcha; incl. filler POIs surviving a pre-B1 save), `marchResolver` (**null-POI →
     `lost_target` regression** for the fixed crash, all gather/attack/scout/boss
     outcomes), `marchMath`, `marchRules`, `regionBuffs` (**economic stacking
     regression** for the buff-wiring fix), `gridGen` (determinism, sector containment,
     no id collisions — B1's probes made permanent), `buildingRules` (incl. the "HQ"
     `shortName`), `eventBus` (on/emit/off/once, listener error isolation).
   - **Tier 2 — `node tests/browser/{boot,world}-smoke.mjs`**: committed Playwright
     scripts over a shared `harness.mjs` that codifies what was re-derived every
     session (http-server invocation, guest→sandbox flow, overlay dismissers,
     `pageerror` capture). Playwright resolves from **outside** the repo via
     `BASIE_PW_ROOT` — no heavy deps land here. Both exit non-zero on failure.
   - New root `package.json` — minimal, exists for `"type": "module"` so game ES
     modules import in Node. **Browsers ignore it; verified the game still boots.**
   - **No game source changed** — every module in scope was importable as-is; no
     testability seam was needed.
   - **Verified:** `npm test` 128/128 green; deliberately broke one assertion → exit 1,
     reverted → exit 0. Both smoke scripts pass against a live server with **zero page
     errors**; deliberately failed a check → exit 1, reverted → exit 0.
     `check-comments` clean.
   - **Deviation from the plan:** `node --test tests/unit/` (the directory form the
     plan specified) fails on Node 26 — it tries to load the directory as a module.
     The `test` script uses the glob form `node --test "tests/unit/**/*.test.js"`.

### Landed this session (2026-07-16, earlier)

1. **Grit reskin Phase B1 — grid data model + generator** (ADR 0011). Data only, no
   renderer work.
   - New `js/entities/data/worldGrid.js` — geometry owner: `GRID` (96×96 cells @ 100px
     = 9600×9600 world, ~7× the old area), 3×3 `SECTOR_OF` layout (32×32 cells per
     region, same 9 region ids), `CURATED_CELLS` (all 26 curated POIs as cell coords),
     cell↔px helpers.
   - New `js/entities/data/gridGen.js` — deterministic hash/value-noise `fbm`;
     `terrainAt(cx,cy)` → 6 terrain types (measured spread: wasteland 35%, cracked 31%,
     forest 15%, rubble 10%, water 6%, ridge 4%); `generateFillerPois()` → 99 filler
     nodes/camps, ids `gen_<region>_<n>`, spaced off curated POIs and off water/ridge.
   - `worldMap.js` reworked: authors regions/factions/curated POIs; `bounds`, `home`,
     region `rect`/`center`, POI `x,y` now **derived from cells** at the bottom of the
     file. Every downstream px consumer (WorldRenderer, WorldCamera, MarchManager)
     unchanged. Regions gained a `tier` field (1 home → 6 ruin) for filler level scaling.
   - **Generator lives in `entities/data/`, not `systems/world/` as the design doc said**
     — `WORLD_MAP` is composed at data-module load, so data would have had to import from
     systems. Recorded in ADR 0011; design doc annotated.
   - **`worldState.js` needed no changes** — its seed/reconcile is already id-driven, so
     filler POIs flow through automatically. The design doc expected a change here; it
     was wrong.
   - Px-coupled constants scaled to hold behavior: `BASE_SPEED_PX` 80 → **265**
     (march times land within ±7% of pre-B1); Mistwood watchtower `revealRadius`
     760 → **2000**.
   - **Verified** (probes in this session's scratchpad `b1/`, harness notes below):
     headless module probe — 26 curated POIs all land in their own region sector, filler
     8–14 per region, byte-identical output across two generator runs, no id collisions,
     no filler on water/ridge, home_vale camp-free. Save probe against the **real**
     `worldState.js` with a simulated pre-B1 save — node depletion, camp respawn timers,
     looted ruin, boss window, and region/outpost ownership all survive; 99 filler POIs
     seed fresh; no orphaned entries. Live browser boot (Play as Guest) — 125 POIs,
     9 regions, home at derived (1650, 8050), **zero page/console errors**.
   - **Not verified:** a real dispatched march. A fresh guest save has no squads, so
     `previewMarch` couldn't be driven live — the distance/time math was checked in the
     probe only. Worth exercising once a save with squads exists.

### Landed earlier (2026-07-15, later session)

7. **Grit reskin Phase A2 — UI theme shift (military-salvage).** Retheme is CSS-only.
   - `css/base/variables.css`: rewrote the palette — backgrounds cool-220 → warm
     gunmetal (hue 30, low sat, same lightness ladder); `--clr-primary` electric blue →
     signal-orange amber `hsl(32,90%,55%)` (+ light/dark/muted, border-glow,
     shadow/glow-primary follow); `--clr-gold` neon green → olive-drab `hsl(80,45%,45%)`;
     `--clr-success` → olive green; `--clr-warning` shifted yellower (`hsl(48,95%,52%)`)
     to deconflict from the amber primary; text hues cool-210 → warm-35; hero tiers set
     to steel / amber / deep-orange per the design doc. Water/wood/iron/money resource
     colors kept diegetic (water desaturated to a muted blue).
   - Component sweep: hue-swapped all hardcoded `hsl(200,*)`→amber(32) and
     `hsl(150,*)`→olive(80) across 11 CSS files (67 blue + 7 green occurrences); mapped
     electric-blue hex literals (`#7c83ff`,`#54d6ff`,`#58d0e0`,`#4aa6e0`) → amber and
     emerald hexes (`#34d399`,`#00b894`,`#4caf50`,`#4caf72`) → olive `#7ab143`; fixed
     `world-view.css` `.ms-squad` selected state (referenced an **undefined**
     `--clr-accent` var → now `--clr-primary`) and warmed its blue panel surfaces;
     barracks available-slot number blue → `--clr-primary`.
   - **Deferred (follow-up):** `gacha.css` has a self-contained rarity color ladder
     (rare=blue `#60a5fa`/`hsl(220,60%,14%)`, legendary=gold, etc.) independent of the
     `--clr-tier-*` vars. Remapping that whole ladder to steel/amber/deep-orange is a
     larger design pass and would collide rare-amber with legendary-gold — left intact.
   - Verified headless (Playwright, boot → Play as Guest → New Game modal): amber
     gradient on selected/CTA buttons, olive EASY dot, red HARD/danger, warm backdrop +
     amber card glow, grit-graded terrain behind, **zero console/page errors**. z-index
     ladder untouched; no selectors/ids renamed (pure value changes).

6. **UI bug fixes** (post-A1):
   - **Buildables card layout** — cards were a horizontal flex (`icon | main | action`),
     so the build button stole width and building names collapsed to a vertical
     one-char-per-line wrap. Reworked `.bp-card` to a grid (`"icon main" / "action
     action"`) so the action button spans full-width along the card bottom and the
     name/content gets the full column. CSS-only (`css/components/hud.css`).
   - **Raw `<span>` in reward fly-out** — `UIManager._showRewardAnimation` set the
     floating card via `textContent`, so `RES_META[x].icon` (an `icon()` span) showed
     as literal markup (the stray "`<span class=icon icon--money> ×100`" pill). Now
     `innerHTML` (all inputs are internal config). Verified: money/food fly-outs render
     the icon element, no literal span.
   - **Build-time hint on locked tiles** — `TileTooltip` showed the `⏱ Ns` build-time
     hint next to the disabled "🔒 Requires …" button on buildings whose prereqs aren't
     met (e.g. Cavalry Stable needing Infantry Hall Lv.3). Gated the hint on
     `b.requirementsMet`. Verified: locked cavalrystable suppresses it, buildable farm
     keeps it.
   - **Raw lock markup in tile tooltip** — `TileTooltip.patchAffordability()` re-set the
     upgrade button via `textContent`, so the locked-state label `${icon('lock')} …`
     rendered as literal `<span>` text once resources ticked. Now `innerHTML`
     (matches the `showTile` template; verified the HTML round-trips stably so the
     patch doesn't re-set every tick).
   - **"Headquarters (HQ)" too long in requirement strings** — added `shortName: 'HQ'`
     to the townhall config and a `reqName()` helper in `buildingRules.js`
     (`checkRequirements` + `collectMissing`) plus the slot-condition path in
     `BuildingManager`. All "Requires …" labels now read "Requires HQ Lv.X".
   - **Stuck in a group view with no path back to Base** — the Base⇄World flip button
     computed its target purely from `_primaryView` (base↔world), so from Economy/Market
     it pointed at World, which is HQ-locked → dead end. Added `_flipTarget()`: on a map
     view it toggles; from any other view it returns to the current map view. Also call
     `_updateFlipButton()` after a locked sub-tab (which skips `ui:viewChanged`) so the
     label doesn't lag. Verified: in locked Market the flip reads "Base" and returns to base.

5. **Grit reskin Phase A1 — grim grade + function plaques.** New
   `js/ui/city/cityGrade.js` (graded building/ground/grayscale sprite variants
   pre-rendered once at load — `_prerenderGrayscale` idiom, no per-frame `ctx.filter`;
   per-building function plaques pre-rendered from the SVG icon set; full-scene
   vignette + cold wash + horizon-haze overlay). `CityRenderer` draws through
   `_grade` accessors (+11 lines wiring only). `cityAmbient.js`: backdrop → overcast
   slate/ash, night veil → amber dusk (`rgba(150,110,75)` multiply, alpha logic
   untouched). New `js/ui/world/worldGrade.js` (ash backdrop, mud land base,
   `grime()` faction-color desaturator) wired into `WorldRenderer` region fills.
   Verified headless (sandbox boot → HQ Lv3 → Rally Point → world view): graded city
   + plaques on farm/lumbermill/well/HQ render, world regions show grimed faction
   tints on ash backdrop, zero page errors. Night veil verified by code inspection
   only (cycle timing makes screenshotting night impractical); locked-slot grayscale
   is currently unreferenced by the renderer (pre-existing). Also removed one
   pre-existing narration comment flagged by check-comments (CityRenderer).

### Landed earlier this session (2026-07-15)

0. **`CityRenderer.js` split** (1123 → 818 ln). Extracted `js/ui/city/cityInput.js`
   (pointer/gestures), `cityAgents.js` (drone + walkers), `cityAmbient.js` (day/night +
   backdrop) as collaborator classes with a back-ref to the renderer. Renderer keeps
   scene picking/hover (shares draw geometry) + all public API + drawing. Verified in
   browser: renders, hover/zoom/pan/tap clean, tutorial spotlight still pins to the
   proxy tile. Residual 818 ln left intentionally for ADR 0009's projection rewrite.

1. **March crash on removed POI** — `resolveArrival` (marchResolver.js) now guards a
   null POI at the top, aborting to a `lost_target` outcome (empty haul, squad returns).
   Covers runtime removal + load. Verified: gather/attack/scout all return cleanly on
   null POI (no TypeError).
2. **Economic region buffs → base production** (was a dead feature). Wiring:
   `ResourceManager.setWorldMapManager()` (main.js:83) + subscriptions to
   `world:buffsChanged`/`world:regionCaptured`; `recalculateRates()` applies
   `1 + economicBonus(activeBuffs(), key)` per resource. `WorldMapManager.captureRegion`
   now also emits `world:buffsChanged`; `applyGameState` emits it after world load so
   rates reflect restored regions. Decision: buffs apply **globally** (model of record).
   Verified: capturing `west_warrens` raised iron 100 → 110 (+10%) via the real event
   path. Boot smoke test clean (no page/console errors).
   - Verification harness: puppeteer/playwright installed in
     `C:\Users\Steve\AppData\Local\Temp\claude\basie-verify\`; probe scripts in this
     session's scratchpad (`buff-probe.mjs`, `boot-smoke.mjs`) — headless console tests,
     no UI clicking. `window.game` exposes `resources`/`worldMap`/`eventBus` for probes.

## Known issues / debt

- **`WorldRenderer.js` is 426 ln** — B2 took it 504 → 426 by extracting the tile engine,
  but it's still over the ~400 ceiling. The residual is POI-marker drawing (marker, level
  badge, state sub-badge, fog marker); `worldMarkers.js` is the obvious next extraction,
  and A4/B3 both touch marker art — do it there rather than as a standalone pass.
- **Playwright lives in a temp dir** — `C:\Users\Steve\AppData\Local\Temp\claude\basie-verify\`.
  `tests/browser/harness.mjs` resolves it from there (override with `BASIE_PW_ROOT`).
  Expect to re-run `npm install playwright` there after a temp cleanup; tier 1
  (`npm test`) is unaffected.
- **Scratchpad module probes are obsolete** — the old copy-to-scratchpad-with-
  `{"type":"module"}` trick is superseded by the root `package.json` + `tests/unit/`.
  Write a real test that imports the module instead; never copy game logic into a probe.

- **Most systems are bugged / roughly built** (owner's assessment, 2026-07-15). Feature
  checkmarks in the roadmap mean "implemented", not "verified". A systems bug audit is
  queued in `docs/30-roadmap.md` (Hardening) — treat existing manager behavior with
  suspicion and verify in the browser before building on it. A first code-review pass of
  the world/march systems (2026-07-15) found 6 concrete issues — one engine-tick crash
  path and a never-wired economic-buff feature among them — listed under the audit in
  `30-roadmap.md`.
- **Comment cleanup pending** (roadmap "Housekeeping"): run
  `node scripts/check-comments.mjs` and sweep narration comments + dead tracker refs
  (P#/B#/"Group N") across `js/` — suitable for a lower-cost model session.
- Placement model is interim-patched (anti-teleport guard); the full no-reservation
  redesign is bundled with the build-menu/tutorial rework (see roadmap, cross-cutting).
- `docs/` wiki is new (2026-07-15); design pages were back-filled from shipped specs —
  correct them in place if they drift from code.

### Landed 2026-07-18 (docs only)

- **Data consolidation plan** — audited hardcoded tunables across systems (combat
  formula coefficients, march speed/carry/dwell with no data home, MarketManager's
  entire trade table, population/cafeteria constants, starting grants, two divergent
  XP curves off the same base 500, 6 duplicated constants). Wrote the six-phase
  pure-move migration plan: `docs/data-consolidation-plan.md`; roadmap entry under
  Hardening. No code changed. Structure verdict: three-tier architecture is sound —
  this is about where numbers live, not moving modules.

## Next steps (session ended 2026-07-16 — resume here)

0. **Use the suite.** `npm test` is the cheap gate — run it before and after any change
   to march/world/data/building-rules logic, and add cases as you go (contract:
   `tests/README.md`). B2's geometry split worked out as hoped: the pure math went to
   `tests/unit/gridLayer.test.js` and only the pixel behaviour needed `world-smoke.mjs`.
   Worth adding when someone's in the area: SaveManager round-trip, march dispatch
   end-to-end (needs a save with squads — the gap B1 left), combat resolution.

1. **Steve: eyeball B2 in the browser** — this is the call to make before picking the
   next phase. **Fastest path: `run.bat` then open `http://localhost:8000/?dev`** — it
   boots straight onto the unlocked world map (ADR 0014), no tutorial/build grind.
   The grid renders and reads correctly, but it is **flat-colour placeholder**
   (that's B2's remit; B3 brings the texture atlas). Judge whether the map now looks
   *plausible* or *programmer-art*: the design doc's own warning is "don't let B3 slip
   long after B2". One-line tunables if it needs it: `TERRAIN_COLOR` (the six cell
   colours), the tint alphas, and the per-cell jitter strength — all at the top of
   `js/ui/world/gridLayer.js`. Also still pending: B1 filler density (8–14/sector,
   `FILLER_MIN_SPACING` 3 — the map now has 99 extra POIs), A1 tuning (plaque
   position/size, vignette, dusk warmth) and A2 (amber saturation, text contrast, the
   deferred gacha rarity ladder).
2. **Next reskin phase — sequencing needs a decision, not a default.** The plan says C1
   sound next, with B3 art last. Reasonable case for pulling **B3 forward**: B2 just
   shipped the map in placeholder flat colour, B3 is the cheapest AI-art win in the
   project, and it's the phase that makes the grid actually *sell*. Against: B3 needs
   user-in-the-loop art generation; C1 is a self-contained session with assets already
   in the repo. **Steve's call** (see (1) — decide it by looking at the map).
   If B3: note ADR 0013 — the fixed-texture-scale chunk cache is crisp only because
   cells are flat uniform fills. A real atlas breaks that assumption and needs either a
   zoom-bucketed cache or a native-resolution texture. Plan for it up front; don't
   discover it mid-phase.
3. Balance items B1 created (roadmap → Hardening): 99 filler nodes change gather supply;
   `dragon_spire`/`command_ruin` filler is unguarded (neutral → no faction enemy pool);
   `BASE_SPEED_PX` 265 preserves old times rather than being tuned for the new map.
4. Remaining world/march audit findings (lower severity, roadmap → Hardening): gather
   economic-bonus no-op clamp, `resolveMarchBattle` `milMult < 1` debuff trap, and a
   buff-dependent *UI* listener for `world:buffsChanged`.
5. Queue the comment-cleanup session (low-cost model; `node scripts/check-comments.mjs`
   lists 16 violations — none in the B1 files).

## State of decisions (don't re-litigate)

- ADR 0009: diamond iso retired at Phase A3 → square-grid ¾ projection.
- ADR 0010: building art = CC0 3D render-to-sprite (Quaternius Ultimate Fantasy RTS
  base, kit-bashed to post-apoc; evolution stages → per-level sprites).
- **Asset sourcing is COMPLETE** — every visual/audio category has a named licensed
  source in `10-design/assets.md` (buildings, props, terrain, monsters, people, mechs,
  drone, war FX, skill icons, equipment, loot). Only open art item: hero portraits
  (style-locked AI gen, user approves each, done with the hero-UX redesign).
- Hero recruitment/management redesign is on the roadmap (UX friendliness) — wants a
  game-designer pass before implementation.
