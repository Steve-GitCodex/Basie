# Active — Session Handoff

> Most-updated file in the repo. Every session that changes code updates this file
> (what landed, known issues, exact next steps). See the session protocol in `CLAUDE.md`.

## Current state (2026-07-20)

- Branch: `Working_Branch`. Through adjacency is committed (`dd4e575`). **Uncommitted now:**
  A3 Sessions 1+2 (ADR 0020/0021) + base layout rework Phases A/B/C (ADR 0022) +
  **the systems bug audit and its 12 load-bearing fixes** (item 26). `npm test`
  **301/301**. **Note:** `/assets/` is git-ignored project-wide — all grit PNGs live on
  disk only.
- ⚠️ **Browser smokes have NOT been re-run since the audit fixes.** Six exist
  (boot, world, dev, tutorial, sector, align) and the fixes touched save/load, resources,
  buildings, units and heroes — this is a genuine verification gap, not a formality.
  **Run these first next session**, spaced ~3s apart (each spawns its own `http-server`
  on port 8123; back-to-back runs race and produce phantom FAILs — re-run any failure
  alone before believing it).

### Exact next steps (in order)

1. **Re-run the six browser smokes** (see the warning above). Nothing else should start
   until the audit fixes are confirmed in a real boot.
2. **Prong B — persistence round-trip harness** (`docs/systems-audit-plan.md`). The audit
   found per-manager field diffs *largely symmetric*, so lead with the **coverage
   assertion** (Proxy-record which keys `deserialize` actually reads, diff against what
   `serialize` writes, fail on written-but-never-read) rather than 16 hand-written
   round-trips. That is the assertion that catches the ADR 0002 silent-drop class.
3. **Prong C — empirical loop verification** (the roadmap's long-open Phase 2 pass).
4. **Then** the remaining hardening tracks: data consolidation
   (`docs/data-consolidation-plan.md`), comment cleanup (13 known violations, suited to a
   cheaper model), balance pass.

### Open debt carried forward (Steve's call, deliberately not done)

- **God files.** `BuildingManager.js` ~1094 ln, `HeroManager.js` ~958, `UnitManager.js`
  ~913, `TechnologyManager.js` ~525, `ResourceManager.js` ~512 — all over the ~400
  ceiling. All pre-existing; the audit agents correctly declined to refactor mid-fix.
  Splitting these is its own session, and should happen **before** much more logic lands
  in them.
- **Wrong-but-contained + future-trap findings** are unfixed and listed in
  `docs/audit-findings.md`. Highest-timing-sensitivity: the **`milMult < 1` debuff guard**
  — fix it *before* Phase 4 authors any debuff data, or the magnitudes get inflated to
  compensate and all need re-tuning after a one-character fix.
- **7 design calls** await Steve at the end of `audit-findings.md`. Contested lines were
  routed around, never silently decided.
- **Audit fix residue** — read the "Residue and consequences" section at the top of
  `audit-findings.md` before any balance work. Notably: hero `buildingBonus.value` no
  longer affects production (magnitude is now level-only), and already-inflated VIP saves
  keep their extra slots.
- Phase 1 (UI redesign) and Phase 2 (world map MVP + fast-follows) are **done** —
  see `docs/30-roadmap.md`.
- **Grit reskin is CLOSED (2026-07-20).** A1–A4, B1+B2, C1–C3 all shipped. A3 verified
  complete this session: all 20 types in `GRIT_BUILDING_MAP`, 60 sprites + `_anchors.json`
  on disk. The city terrain/ground pass A3 left open was absorbed by the base layout
  rework Phase B (`cityGround.js`). **B3 (world terrain atlas) is deferred by Steve** —
  the current grid map reads fine; reopen only if flat-colour terrain starts to grate.
- Next direction: **hardening & housekeeping** (`docs/30-roadmap.md`) — the reskin is done,
  so the "fix load-bearing bugs before the reskin builds on top" gate is now the live work.
- **The repo has tests now** (ADR 0012). `npm test` before you hand off; fix a bug →
  add a regression test in the matching `tests/unit/*.test.js`. Contract:
  `tests/README.md`.

### Landed this session (2026-07-20, later)

26. **Systems bug audit — Prong A complete, all 12 load-bearing defects fixed.**
    Plan: `docs/systems-audit-plan.md`. Findings + residue: `docs/audit-findings.md`
    (read the "Residue and consequences" section before any balance work).
    - **Why static review, not verification:** the happy path is the least likely place
      for a surviving bug. Five parallel specialist reviews over the untested manager
      clusters found **12 load-bearing defects**; three were found independently by two
      reviewers each. A loop-verification pass would have surfaced almost none of them —
      they live on reload boundaries, expiry paths, and failure branches that report
      success.
    - **Worst:** `SaveManager.wipe()` latched saving off permanently, and guest→account
      registration hit it **without a reload** — all progress after registering was lost
      from localStorage *and* Firestore. Also: storage-tech caps dropped every load then
      the overflow destroyed on the next tick; VIP slots compounding per load in both
      `BuildingManager` and `TechnologyManager`; expired events never releasing their
      production multiplier (composite-key mismatch); unit duplication via dual-tracked
      `squad.units`/`squad.slotUnits`; squads deletable mid-march; 40% of gacha scroll
      rolls granting nothing (dangling item ids).
    - **Fixed structurally, not symptomatically:** squad state now routes every mutation
      through one invariant helper; the modifier key is built by a shared helper so the
      two sites cannot drift; a data-integrity test asserts every `GACHA_CONFIG` id
      resolves against `INVENTORY_ITEMS`, retiring the whole dangling-id class.
    - **A fix that was wrong, caught by checking:** the first `wipe()` fix satisfied its
      test but broke `wipeAllData()` — `wipe()` then `reload()` fires `beforeunload`,
      which re-saves live state over the wipe. Root cause was an underspecified spec: one
      boolean carrying two intents. Split into `wipe()` + `suppressSaves()`; both
      behaviours now pinned by tests. **Same failure mode as the align-smoke tautologies
      — a passing test that could not fail.**
    - **Verified by the session owner, not relayed:** `npm test` **301/301** (283 after
      wave 1, +18 in wave 2); `check-comments` at exactly **13 pre-existing** violations,
      confirmed identical against a stashed baseline — zero new. Browser smokes NOT yet
      re-run (next session: run them spaced ~3s apart, per the port-8123 race).
    - **NOT fixed, deliberately:** all wrong-but-contained and future-trap findings remain
      open in `audit-findings.md` — incl. the `milMult < 1` debuff guard (fix **before**
      Phase 4 authors debuff data), difficulty never restored after load, the
      ChallengeManager seconds-as-ms reset, and the missing save `version` field.
    - **7 design calls deferred to Steve** (listed at the end of `audit-findings.md`):
      `defense_boost` double-count (code contradicts its own comment), hero passive
      stacking, `concurrentSlots` dead data, UTC daily resets, VIP tracking
      diamonds-received-not-spent, story chapter rewards, `cancelTrain` full refund.
      Contested lines were routed around, not silently decided.
    - **Debt unchanged/grown:** `BuildingManager.js` ~1094 ln, `HeroManager.js` ~958,
      `UnitManager.js` ~913, `TechnologyManager.js` ~525, `ResourceManager.js` ~512 — all
      over the ~400 ceiling, all pre-existing. Agents correctly declined to refactor.
    - **ADR 0023** records the decisions: explicit `suppressSaves()` split, load-time
      grant idempotence, over-cap stock is legal and never destroyed, hero bonuses apply
      once per-instance, save failures observable. Includes the rejected alternatives so
      the first (wrong) `wipe()` fix isn't re-attempted.
    - **Next:** Prongs B (persistence round-trip harness — the audit found the field
      diffs largely symmetric, so prioritise the *coverage* assertion that detects
      written-but-never-read keys) and C (empirical loop verification).

### Landed this session (2026-07-20)

25. **Base layout rework Phase C — adjacency bonuses (layout is now gameplay)**
    (ADR 0022 amendment). Closes the rework; A/B/C all shipped.
    - **`js/systems/building/adjacency.js`** (new, pure, 110 ln): neighbour test =
      rect gap ≤ 2 cells on both axes (one tile, so a connector road still fits
      between). Same-category clustering +5% each (cap +20%) for
      production/military/population; 5 curated pairs (house↔cafeteria,
      farm↔well, lumbermill↔workshop, mine↔storehouse, barracks↔rallypoint)
      +6–8% (cap +15%); total cap +30%.
    - **Production** spends the bonus as output — `buildingEconomy.computeActiveRates`
      reads `ctx.getAdjacencyBonus(instanceId)`. **Military** pools it into a
      training-time cut (mean, cap 25%) at UnitManager's new `_trainMultiplier()`
      (folded with the VIP cut at all 5 call sites — no other change there).
    - **Derived, never serialized.** `BuildingManager._recalcAdjacency()` runs on
      build-complete (both paths), move, and load. Legacy loads emit
      `building:adjacencyDiscovered` → BuildingsUI toast ("your layout grants +X%"),
      so a base the packer clustered on migration announces the gift.
    - **UI:** TileTooltip shows a `🔗 +N% neighbours` line with pair labels
      (`.tt-adjacency` in `sidebar.css`).
    - **Also, Steve's request:** rubble sector panel now opens **on tap only** —
      hover surfaces it only while that sector is actively clearing.
    - **Verified:** `npm test` **253/253** (+13 — adjacency.test.js ×10, three
      BuildingManager integration tests incl. move-away-drops-bonus and
      not-serialized-re-derives). All six browser smokes PASS (boot, world, dev,
      tutorial, sector, align). `check-comments` clean on every touched file.
    - **Open balance risk (Steve's call: level design, not code):** adjacency creates
      pressure to re-optimise layouts, which couples to rubble pacing — more cleared
      space = more clustering freedom. Tune the two together in the balance pass.
    - **Debt unchanged:** `BuildingManager.js` (~1084 ln) and `CityRenderer.js`
      (886 ln) over the ~400 ceiling; Phase C kept its logic in the pure sibling.

### Landed this session (2026-07-19, later)

24. **Per-sprite ground-anchor system — buildings now sit CENTRED on their plots**
    (ADR 0022; Steve's call after size-tweaking kept trading one artifact for another).
    Root insight (Steve): a flat billboard anchored at the plot's front vertex puts the
    building's ground-contact at the **front edge** of the plot, not its centre — so a
    base smaller than the plot always looked shoved forward, and sizing alone could
    never fix both centring and neighbour-overlap.
    - **Rig** projects the origin (models are centred on it, base at y=0) → that pixel
      IS the building's ground-contact centre; exported per sprite as `{ax, ay}` into
      `assets/tiles/buildings/grit/_anchors.json` (60 entries, regenerated with the
      sprites).
    - **`cityAssets`** loads the manifest (`_loadAnchors`) and exposes
      `anchor(id, level)`, falling back to bottom-centre if the file is missing.
    - **`CityRenderer._spriteBox(slot, scale)`** is now the single source of sprite
      geometry: it seats the anchor on the plot **centre** (`_centerWorld`). Draw,
      hit-test (`_pointInSlotSprite`), proxy/tutorial rect (`_slotRect`) and the
      progress/speed-up badge (`_slotTopWorld`) all derive from it, so they can no
      longer disagree. `bottomPad` is superseded for placement (kept as a padding guard).
    - Because each level's sprite carries its own anchor, **per-level centring is
      automatic** (Steve's "nudge should affect specific levels" note).
    - **align-smoke rewritten to a real invariant**: "every sprite ground-anchor seats
      on its plot centre" + "every built sprite has a rig-exported anchor". The old
      check compared the draw anchor to `_frontWorld` — both from the same function,
      a tautology that passed while buildings visibly sat wrong.
    - **Sizing settled at ~80% of plot** (2×2→0.8, 3×3→1.2, 4×4→1.6 tiles) — buildings
      sit inside their footprint with breathing room, no neighbour pile-ups. Size is now
      a pure look-and-feel dial: re-rendering at a new fit regenerates the anchors with
      it, and align-smoke confirmed centring held (Δ 0,0) across the size change.
    - **Gotcha for future sessions:** the browser smokes each spawn their own
      `http-server` on port 8123, so running them **back-to-back races on the port** and
      produces phantom FAILs (hit boot/world once here; both passed alone and in a spaced
      re-run). Put a ~3s gap between smoke invocations, or run them one at a time,
      before believing a failure.
    - **Verified:** 240/240; boot/dev/tutorial/sector/world/align smokes PASS;
      check-comments clean on touched files; proof shots
      `.playwright-mcp/anchor-final-{well,townhall}.png` show the ground-contact
      centred on the plot-centre marker.

23. **Building centering + connector-road shape** (Steve play-test after the anchor
    fix). (a) Buildings leaned into the bottom-right of their pads with empty top-left,
    and large production sprites (mine/quarry/lumbermill) spilled down-right — the rig
    aligned each model by its **front-right (max) corner**, so any non-square footprint
    dumped its gap on the back-left and big models overhung front-right. Rig now
    **centers the footprint bbox on the origin** (`(max+min)/2`); all 60 re-rendered.
    Per-sprite, so each level centers on its own footprint (Steve's "per-level" note is
    handled structurally). (b) Connector roads were small inset diamonds reading as
    patches; `cityGround._insetRoad` now draws full cell **height**, ~half **width** —
    a road strip. Verified: align-smoke still PASS (anchor intact, pad 0); overlay
    (`.playwright-mcp/centered-real.png`, `prod-built.png`) shows buildings centered
    and filling pads, production cluster no longer spilling. 240/240; five smokes green.
    **Open:** if a *specific* type/level still looks off-center, add a per-type-per-level
    draw nudge (data in buildings.js) — deferred until Steve flags specific ones.

22. **Building float — TRUE root cause: half-cell anchor offset (Steve's diagnosis).**
    Items 20–21 fixed real but secondary things (sprite padding). The dominant cause,
    found by comparing the sprite basis against the *actual cell-center grid* instead
    of against itself: `rectFrontTile`/`rectCenterTile`/`rectCornersTile` in
    `cityGrid.js` referenced the rect **boundary** coords (`cx+w`, `cy+h`) as if they
    were cell-center tile coords. The ground/roads place cell (X,Y) at
    `tileToWorld(X/2, Y/2)` (cell **centers**, occupying cx..cx+w-1), so every sprite,
    slot outline, badge, plaque, and fx anchor rendered exactly **half a cell (24 world
    px) down-forward of the road grid** — while roads/ground were correct. Measured
    live: green(sprite basis) vs cyan(cell basis) S-vertex differed by dy=48px @ 2×
    zoom = 24 world px, dx=0; after the fix dy=0 (scratchpad `basis-compare.png` →
    `basis-fixed.png`). Fix: the three functions now reference cell centers (edge
    cells cx..cx+w-1, vertices ±0.25 tile). Every earlier "proof" missed it because the
    overlays used `rectCornersTile` — the same function the sprite uses — so they were
    tautologies (as was align-smoke's anchor check). New guard:
    `cityGrid.test.js` "rect corners align with the cell-center grid" pins the three
    functions to `tileToWorld(cell/2)` ± half-cell. Two old unit tests that encoded the
    buggy values were corrected. **240/240; align/boot/dev/tutorial/sector/world smokes
    green.** Live: buildings now sit on their footprint cells, on the road grid.

21. **Building float — actual root cause proven, align-smoke was testing a tautology.**
    The prior align-smoke checked proxy-rect-bottom == `_frontWorld` anchor, but BOTH
    derive from the same math, so it always passed regardless of sprite padding — it
    could never catch this class of bug (why "fixed" kept not being fixed). Diagnosed
    live via headed Playwright with overlay proof (ground suppressed, flat-bg,
    footprint diamonds drawn from `_cornersWorld`): with the rig's true-lowest-pixel
    crop (`bottom = maxY`) every sprite now has `bottomPad ≈ 0`, and each building's
    base seats exactly on its footprint front vertex (scratchpad
    `.playwright-mcp/anchor-flat.png`, `anchor-all.png`). The remaining lever if a
    building looks small in its pad is `fit`, not the anchor. **align-smoke
    strengthened**: now also asserts no built sprite has >6px transparent padding
    below content — the invariant that actually guards the float. 239/239, five
    smokes green. Caveat recorded so it isn't relitigated: a truly cache-fresh client
    is required to observe the fix (server now `-c-1`; hard-reload the browser).

20. **"Buildings float above their pads" — real root causes found live with Steve**
    (parent session, live headed-Playwright debugging with in-page marker dots).
    Two stacked problems:
    - **Art:** the rig cropped sprite bottoms at the theoretical unit-tile front
      vertex while aligning models by full bbox (roof overhang included) → baked
      transparent padding under most buildings → sprites drew up-back of their
      footprints. Rig crop now = actual lowest visible pixel (`maxY`), all 60
      re-rendered. Belt-and-braces: `CityAssets` measures each sprite's real
      content-bottom at load (`bottomPad()`, from the grayscale-prerender pass) and
      `CityRenderer._drawSlot` anchors on measured content — padded art can never
      float again regardless of source.
    - **Caching hid every fix:** `http-server` default `max-age=3600` → browsers
      (Steve's, and even a fresh MCP Playwright process with its persistent profile)
      served hour-stale sprites/JS **without revalidating**, so landed fixes looked
      like failures and correct probes looked like lies. `run.bat` now serves with
      `-c-1` (caching disabled). Lesson for every future session: **after changing
      assets or JS, verify through a cache-cleared client** (CDP
      `Network.clearBrowserCache` or a truly fresh profile) before judging.
    - Verified: 239/239; align/boot/dev/tutorial/sector smokes PASS; live headed
      browser shows sprites seated with `bottomPad = 0` across types.

19. **Sprite fits now match footprints** (parent session; the real fix for Steve's
    "buildings look offset" report). The align-smoke invariant (sprite bottom ==
    footprint front corner) was passing, but sprites were *smaller* than their
    pads and front-corner-pinned, so every building sat shoved into the front-left
    of its rect with empty pad behind — perceptually "offset". Rule now: **fit =
    footprint size** (2×2 cells → 0.95 tiles, 3×3 → 1.42, 4×4 → 1.9; set by
    `rig/fix-fits.mjs` over `jobs-all.json`, mirrored to `assets/_rig/`). All 60
    sprites re-rendered — buildings fill their pads by construction. Per-type
    size variety now comes from footprint class + model silhouette, not ad-hoc
    fit numbers. Verified: align/boot/dev/tutorial smokes PASS; `?dev` screenshot
    (`rig/shot-fitmatch.png`) shows pads filled.

18. **Rubble-clear bug fix + road hierarchy (§4) + edge forest** (ADR 0022; two
    player-reported bugs + one design amendment). Implemented by an Opus subagent.
    - **BUG — glitchy rubble clearing (root cause).** `CityRenderer._syncSectors` built the
      ground-raster cache key from `sectorList.filter(s => s.state !== 'rubble')`, which
      bucketed **`clearing` together with `cleared`**. A sector goes `clearing → cleared` on
      completion, but that transition left the key **unchanged**, so `CityGround` never
      re-rastered — the just-cleared sector kept drawing as rubble until an *unrelated*
      building event happened to force a re-raster. That incidental timing is exactly the
      nondeterministic report ("no visible progress", "start a 2nd clear → all clear
      instantly, or one clears and the other never clears"). The `SectorState` timers were
      always genuinely independent (per-id Map) — proven by the two-clears probe. **Fix:**
      pure `groundSignature({clearedIds, skeleton, connectors})` in `cityGround.js` counts
      only truly-`cleared` sectors, so completion invalidates the cache. Legibility:
      on-canvas progress bar now shows live **m:ss** remaining; the open sector tooltip
      ticks its countdown in place (`TileTooltip.patchSector`, ADR 0007). Tests:
      `cityGround.test.js` (signature changes clearing→cleared), `sectorState.test.js`
      (two concurrent clears complete independently), `tests/browser/sector-smoke.mjs`
      (campaign, real tick path — A 120→118s over 2s, B still running when A finished, both
      to completion). **Probe result:** independent completion confirmed.
    - **BUG + redesign — roads never cross buildings (§4 two-level hierarchy).** Old
      `cityRoads.js` L-paths ran straight through footprints. Replaced with a **fixed
      skeleton** (ring around HQ + N/E/S/W arterials to the edge; geometry `SKELETON` in
      `cityGrid.js`) whose cells are **unbuildable** (`rectHitsSkeleton` extends the
      placement/move/packer predicate; `_isRectCleared` + `rectFree` reject them) and
      **connector roads** BFS'd from each building's **visible door** to the nearest
      skeleton cell over free ground (never a footprint, never rubble). Arterials render
      only through core + cleared sectors (extend as rubble clears); connectors drawn
      inset/lighter. Legacy saves with a building on a skeleton cell relocate on load
      (`cityPacker.skeletonOffenderMoves`, applied in `deserialize` for **all** placement
      states — built/queued/unbuilt). `doorSide: 'sw'|'se'|'s'` added per type in
      `buildings.js` (authoritative table from Steve's sprite eyeball). Tests: `cityRoads`
      (skeleton determinism/unbuildable, no road cell intersects any footprint, arterials
      gated by cleared sectors, doorSide validity + perimeter), `cityPacker` (never seats on
      skeleton, `skeletonOffenderMoves` migration), `buildingManager` (after load zero
      placement rects of any state hit skeleton).
    - **Edge forest + footprint retune.** `GRID_MARGIN_TILES` 4→9 so the camera clamp never
      shows the void; `cityGround.treeScatter` fills the surround with dense pines/broadleaf
      (density rising to the rim) + sparse dead trees in uncleared rubble, painter-ordered
      with buildings. Footprint buckets: `infantryhall` + `cavalrystable` 4×4→3×3 (sprite
      fits ~1.2–1.35), so 4×4 is now only `townhall` + `heroquarters` (save-safe shrink).
    - **Verified:** `npm test` **239/239**; boot/dev/world/**tutorial ×3**/sector smokes all
      PASS, zero page errors; `check-comments` clean on every touched file; `?dev`
      screenshot (scratchpad `base-roads.png`) shows the ring+arterial cross with buildings
      clustered in the quadrants (never on the skeleton), a pine cluster in the surround,
      and dead trees + debris in the rubble.
    - **Follow-up (2 play-test issues).** (1) **Sprite-offset report — NOT reproducible;
      anchor is provably correct.** A headless measurement probe (`tests/browser/align-smoke.mjs`,
      now permanent) projects each built building's footprint front (south) corner and compares
      it to the proxy rect's bottom-center: **Δ = (0,0) px** for every building at home framing
      AND after a pan. Root cause of the *report* is not a code offset — sprite, on-canvas label,
      proxy rect, and roads all derive from the single `_frontWorld(slot)` anchor, so they cannot
      diverge; transparent sprite bottom-padding is ≤13px. The likeliest source of Steve's
      screenshot is a stale cached build from the mid-task window (I was resumed after a usage
      limit; between the `cityGround` rewrite and the `CityRenderer._groundState` rewiring the
      ground briefly mismatched). The align-smoke locks the "sprites seat on their plots"
      invariant (ADR 0021/0022) going forward. (2) **Sector tooltip lifecycle.** The clear panel
      was pinned by tap and only ever `refreshSector`'d — on completion it re-rendered a *cleared*
      sector with a bogus "Clear Rubble" button and never closed. Fix: `city:sectorCleared` now
      `TileTooltip.closeSector(id)` auto-closes a panel open on the just-cleared sector; the panel
      is **pinned only by an explicit tap** (`showSector(..., {pinned})`), while **hovering** a
      rubble/clearing sector shows it transiently (new `CityRenderer._setSectorHover` →
      `onSectorHover/Leave`, reusing the building hover path; never steals a pinned panel). The
      countdown keeps ticking in place (`patchSector`, ADR 0007). Covered by two new
      `sector-smoke` assertions (panel opens on tap; auto-closes on completion). `window.game.city`
      is now exposed on base-view entry as a debug/automation handle for these probes.
    - **Deferred / notes:** `CityRenderer.js` (~979 ln) and `BuildingManager.js` (~1046 ln)
      remain over the ~400 ceiling — additions this session were kept thin (skeleton
      geometry, roads, trees, migration all live in siblings: `cityGrid`/`cityRoads`/
      `cityGround`/`cityPacker`). A `siegeworkshop` footprint mismatch was noted (2×2 vs
      ~1.3 sprite fit → arguably 3×3) but left alone: growing a footprint is **not**
      save-safe without overlap-migration, and only shrinks were in scope.

### Landed this session (2026-07-19)

17. **Tutorial spotlight race fixed** (parent session, found re-verifying Phase B —
    `tutorial-smoke` was flaky ~1-in-5). `UIManager._showTutorialStep` applied the
    spotlight **once** 250 ms after the step event; when the canvas proxy tiles
    weren't in the DOM yet (asset load now outlasts 250 ms on cold boot) it fell to
    the nav-pulse fallback and hid the ring **permanently** (`_repositionRing`
    ignores hidden rings). Now retries every 300 ms (≤40×) until the selector
    resolves, upgrading fallback → ring; timer cleared on hide. Pre-existing race,
    surfaced by the heavier Phase A/B boot. `tutorial-smoke` also hardened (keeps
    dismissing a late story dialog while polling; logs last measurement on timeout).
    Verified: 8/8 tutorial-smoke runs green (was 5/8); 227/227 + other three smokes
    unaffected. **Debt noted:** `UIManager.js` ~738 ln — extract the tutorial
    spotlight block (`_showTutorialStep`/`_applySpotlight`/`_repositionRing`/
    `_hideTutorial`) into a `TutorialSpotlight` module next touch.

16. **Base layout rework Phase B — roads, rubble sectors, textured ground** (ADR 0022;
    plan `docs/base-layout-plan.md`). Implemented by an Opus subagent.
    - **Textured city ground** (`js/ui/city/cityGround.js`) replaces flat `GROUND_COLOR`
      diamonds + district tints: per-cell earth/cracked/ash (deterministic hash), road
      tiles on road cells, rubble tiles + debris scatter on uncleared sectors. Single
      full-extent offscreen raster, re-rastered only on road/clear-set change (city is
      small + fixed → one cache beats the world map's chunk grid; noted vs the spec's
      "16×16 chunks"). Assets: `assets/tiles/ground/grit/`, `props/grit/`.
    - **Auto-derived roads** (`js/ui/city/cityRoads.js`, pure): door→nearest-web Manhattan
      L-paths seeded at the HQ door; deterministic, regenerated on layout change, **never
      serialized**. `cityAgents.js` walkers/drone now follow the derived road graph.
    - **Rubble-sector expansion** — `js/entities/data/citySectors.js` (4×4 block tiling;
      central 2×2 core, 8 ring-1 + 4 ring-2 sectors; `sector_<ring>_<n>` save-key ids;
      cost ×2.5/ring: ring1 wood600/stone400/iron150 @120s HQ2, ring2 ×2.5 @300s HQ4 —
      generous, tighten later). `js/systems/building/sectorState.js` (owned by
      BuildingManager) holds `{cleared, clearing}`, serialized; **grandfathering** on load
      (any sector under a placed building auto-clears; legacy saves migrate full-grid then
      reconcile). Placement (packer/ghost/move) confined to cleared cells. Tap a rubble
      sector → `TileTooltip.showSector` → `ui:clearSector`; clears show progress + dust,
      emit `city:sectorCleared`.
    - **Retired**: `js/entities/data/cityBlueprint.js` + `js/ui/city/cityLayout.js`.
      `CATEGORY_ZONE` + grid dims moved to `cityGrid.js`; isoMath/CityRenderer/GAME_DATA
      updated. Camera `homeIfUntouched()` re-frames HQ on base re-entry until the player
      pans (fixes the item-15 off-centre known issue).
    - **Verified:** `npm test` **227/227** (+24 — citySectors, sectorState, cityRoads,
      packer predicate, grandfathering + sector round-trip + no-serialize-footprint).
      boot/dev/world/**tutorial** smokes all PASS, zero page errors; `check-comments`
      clean on every touched file. `?dev` screenshot (scratchpad `phaseb-base.png`) shows
      textured ground, road L-paths to the HQ, and debris-scattered rubble edges.
    - **Deferred / notes:** Phase C (adjacency bonuses) unchanged. `BuildingManager.js`
      (~1039 ln) and `CityRenderer.js` (~950 ln) remain over the ~400 ceiling
      (pre-existing debt; Phase B kept additions thin via the sector/ground/road siblings)
      — a `citySectorPanel` / renderer-draw extraction is the next split candidate.

15. **Base layout rework Phase A — free placement shipped** (ADR 0022; plan
    `docs/base-layout-plan.md`). Implemented by an Opus subagent (spec in-session);
    the agent hit a usage limit mid-docs, so this entry + roadmap tick were written
    by the parent session after independently re-verifying everything.
    - New: `js/entities/data/cityGrid.js` (half-tile cells, 44×32, rect geometry/
      bounds), `js/systems/building/cityPacker.js` (deterministic spiral packer, HQ
      pinned center, category anchors N/E/S/W), `js/systems/building/placementStore.js`
      (`instanceId → {cx,cy}` + occupancy), `js/ui/city/cityGhost.js` (move drag-ghost
      with validity fill), `tests/browser/tutorial-smoke.mjs`. Deleted:
      `js/ui/buildings/PlacementController.js`. `buildings.js` gained per-type
      `footprint` (2×2/3×3/4×4 cells). `cityBlueprint.js` keeps roads/districts
      (visual only, Phase B replaces); plots retired.
    - `CityRenderer` draws footprint rects (sprite bottom-center = rect front corner,
      ADR 0021 anchor); proxy layer tracks instance footprint rects so the tutorial
      spotlight contract survives (`.base-tile[data-building-id]` unchanged).
    - Legacy saves: plot-id-string placements are dropped on deserialize and every
      instance re-places via the packer (regression-tested).
    - **Verified by the parent session:** `npm test` **203/203** (+20); boot/dev/
      world/**tutorial** smokes all PASS, zero page errors; `check-comments` clean on
      every Phase A file; live probe confirms packer layout (HQ 4×4 at cell (20,14) =
      grid center, military W / production E / civic N / residential S); `?dev`
      screenshot shows built sprites + dashed footprint ghosts correctly clustered.
    - **Known issues:** (a) on `?dev` (boot→world→navigate back to base) the camera
      home frame can be off-center until a double-tap re-homes — check whether a real
      save's straight-to-base boot is affected; consider calling `home()` on base-view
      re-entry. (b) `docs/10-design/city-view.md` was updated by the agent but not
      re-reviewed line-by-line — skim it next session.

14. **Grit reskin A3 Session 2 — render-to-grid sprite rig; all 20 types wired**
    (ADR 0021, amends 0020). The "native px + shared 0.34 trim" approach broke on
    multi-pack sources (accidental relative sizes, footprints disagreeing with the
    grid) — replaced by a headless-Chromium three.js rig (session scratchpad `rig/`:
    `render.html`, `render-rig.mjs`, `jobs-*.json`, `catalog-zips.ps1`, `base-shot.mjs`)
    with an ortho camera locked to the 128×96 diamond; per-type `fit` = footprint in
    tiles; sprite bottom pinned to the tile front vertex. Loaders: glTF/GLB/OBJ+MTL.
    - `GRIT_BUILDING_MAP` now covers **all 20 types** (Sonnet subagent wired 13 per
      spec; well + siegeworkshop added after gap-fill renders). Sources: UFR pack (15),
      Farm Buildings (well, cavalrystable barns, lumbermill L2–3 open barn), Zombie
      Apocalypse (well L3 water tower, siege container/armored truck). `townhall`
      swapped TownCenter plaza → **Temple** (reads heavier). Kenney `ISO_BUILDING_MAP`
      is now load-failure fallback only.
    - `CityRenderer._drawLevelBadge` now renders the bottom label line — "Lv4 HOUSE 1"
      pill+name under the plot (Steve's call; above-sprite badges overlapped tall art).
      Name drawing moved out of `_drawSlot` for built slots.
    - Rig look pass 2 (Steve: "most buildings don't look good / well placed"):
      front-corner seating (model footprint front corner pinned to tile front vertex),
      sun 2.4→1.7 with self-shadowing, `saturate(.82) brightness(.96) sepia(.10)`
      post-filter to harmonize the three packs' palettes. All 60 sprites re-rendered
      via consolidated `rig/jobs-all.json` (the one source of truth for type→model+fit).
    - Model catalog of every incoming zip: scratchpad `rig/catalog.md`. Pre-rig sprite
      backup: `rig/backup-grit-v1/`.
    - **Verified:** `npm test` 183/183 (new `tests/unit/cityAssets.test.js`); boot +
      dev smokes PASS, zero page errors; `?dev` screenshot shows new sprites seated
      on-grid at consistent scale.
    - Eyeball round 2 (Steve): bottom label line hidden for the hovered slot (hover
      pill was doubling it); heroquarters → Wonder_SecondAge castle, archeryrange →
      Archery_SecondAge, rallypoint → WatchTower_SecondAge. Gotcha: PS5.1
      `Set-Content -Encoding utf8` writes a BOM that broke the rig's jobs JSON parse
      (driver now strips it) — a "re-render" silently no-oped once; check render-rig
      output lines, not just the copy step.
    - Eyeball round 3 (Steve): `townhall` → **Wonder_FirstAge** (the golden ziggurat —
      "like the golden building"); rig gained `clampL` (per-job material-lightness
      clamp — fixes the farm-pack barns' black/white roofs on lumbermill/cavalrystable)
      and per-job `filter` overrides (mine/quarry/watertower darkened to earthy).
    - Eyeball round 4 — full in-game contact sheet (`rig/contact-sheet.mjs`: ?dev boot,
      raises HQ→8 then every type's instance 0 to L1/L2/L3 via `bm.build(id,0)` +
      synchronous drain, screenshots `sheet_L{1,2,3}.png`; bank stalls at L1 and
      magictower at 0 — deeper prereqs/tech, sprites reviewed from renders instead).
      Fixes: OBJ Phong **specular was defeating `clampL`** (cream-white barn roofs) —
      rig now zeroes specular on clamped materials; rocks pushed earthier
      (brightness .66–.68, sepia .3); military-cluster fits trimmed ~0.1 (barracks
      1.15, archery/infantry 1.2, heroquarters 1.35, siege 1.15/1.3) to reduce
      adjacent-plot sprite collisions. **Base sprite set is declared done** pending
      Steve's final look.
    - **Known / next:** per-type `fit` numbers await Steve's eyeball on the real save;
      city ground is still flat diamonds (next pass); rig lives in the session
      scratchpad — copy it somewhere durable if it should outlive temp cleanup.

### Landed earlier (2026-07-18)

13. **Grit reskin A3 Session 1 — grit building sprites + iso retune** (ADR 0020, amends
    0009/0010). The plan-of-record square-grid projection swap was **dropped mid-session**
    when measurement contradicted it (surfaced to Steve, who chose "retune iso"):
    - **Two reality corrections.** (a) The Quaternius "Ultimate Fantasy RTS" zip ships a
      `PNG/` folder of finished ¾-**iso** renders (1024², per family × level × age, CC0 1.0)
      — **no Blender** (ADR 0010's render step is moot; the `.blend`/`.fbx`/`.gltf` are unused
      3D source). (b) Those renders have **diamond footprints** (measured ~1.1–1.3:1 from
      TownCenter fence corners), so they need a **diamond grid** — ADR 0009's square-grid swap
      would sit crooked. `gridMath.js` was **not** written.
    - **isoMath retuned, not replaced:** `TILE_W 132→128`, `TILE_H 66→96` (~1.33:1),
      `GROUND_BOTTOM = TILE_H/2`. Everything parametric carried over; the one extra fix was
      `CityCamera.minZoom` (had `66/33` hardcoded → now from `TILE_W`/`TILE_H`).
    - **Buildings draw at native px** (removed the fit-to-plot-width seating). Sprites are
      trimmed offline (alpha bbox) and downscaled by **one shared factor (0.34)** so relative
      sizes are authored (town hall > house); bigger buildings overhang their plot. Trim tool:
      scratchpad `trim-sprites.mjs` (headless Chromium — no PIL/ImageMagick/Blender).
    - **Ground → flat-color diamond cells** (`GROUND_COLOR` in CityRenderer); Kenney landscape
      diamond sprites retired (they were 2:1). A city terrain atlas is a later pass.
    - **Level-keyed manifest:** `GRIT_BUILDING_MAP[type]={1,2,3}` + `gritBucket` + `building(id,
      level)` in `cityAssets`, mirrored in `cityGrade` (grades every variant key); falls back
      to legacy `ISO_BUILDING_MAP` (Kenney) for un-migrated types. **Wired the five**
      always-on-screen types (townhall/house/farm/barracks/storehouse, L1–L3). Sprites in
      `assets/tiles/buildings/grit/<key>_L<n>.png`.
    - **Asset download subagent** pulled the rest of the `assets.md` checklist into
      `assets/_incoming/` (git-ignored) with a `SOURCES.md`: 11 packs landed (Kenney ×6,
      KayKit, Low Poly Forest, Chest, Cethiel Weapons, game-icons **CC-BY → needs credit**);
      **6 Quaternius packs are MANUAL** (itch JS-gated — Farm Buildings, Zombie Apocalypse,
      Cube World, Mech, Spaceships, Guns; URLs in `SOURCES.md`).
    - **Verified:** `npm test` **182/182**; boot/world/dev smokes all PASS, **zero page
      errors**; `?dev` base screenshot shows grit barracks + townhall-L3 seated on the flat
      diamond grid, graded, level badges, empty-plot pads/labels intact. `check-comments`
      clean in all edited/new files (only pre-existing UIManager violations remain).
    - **Known / next:** un-migrated types show legacy Kenney boxes (interim). `townhall` uses
      TownCenter (monument plaza — reads light as an HQ; one-line swap to Temple/Wonder). Gap
      types (well/workshop/siege/cavalry/construction) need the staged gap-filler packs.

12. **Grit reskin Phase C3 — DOM/UI juice** (ADR 0019). Presentation only, no gameplay,
    no new save state, no new manager.
    - New `js/ui/fx/numberTicker.js` — pure `tickTo(el, target, format)`; per-element
      `WeakMap` state retargets a running count-up instead of stacking; ~320ms ease-out;
      formats `Math.round(val)` per frame (keeps `fmt`'s K/M rounding clean); first call
      per element sets instantly (no count-from-zero on boot). Wired into
      `NavigationUI._renderResources` — only the value ticks; cap/rate stay instant.
      Passive income now visibly counts up (retargets every 2Hz `resources:tick`).
    - New `js/ui/fx/resourceFlyout.js` (`ResourceFlyout`, instantiated once by UIManager) —
      on `resources:added` (fires only on discrete `add()` rewards, never passive ticks)
      flies a `.res-fly` coin (reuses the masked `.res-icon--{key}` art) from mid-screen
      into `#res-{key}`, then pulses the chip with the existing `tick-flash`. Pooled cap
      (24 live), skips when `document.hidden`. **Origin is mid-screen, not the true event
      source** — `resources:added` carries only `{key: amount}` (ADR 0019).
    - Sheets get `--transition-spring`: `.world-panel` (PoiDetailPanel) spring transform;
      `.world-sheet` (MarchDispatchSheet) + `.bp-sheet` (BuildablesPanel) are
      `display:none`-toggled so they get an entrance keyframe (`sheetRise`/`bpSheetRise`)
      that restarts on display. Toasts were already spring.
    - Universal button feel: `.btn:active:not(:disabled){scale(0.95)}` + one capture-phase
      `document` click listener (`UIManager._installButtonSfx`) that emits `ui:click` for
      any button. ~200 callsites already emit it manually → `SoundManager.click()` now
      **coalesces** (drops calls within 60ms) so there's exactly one click sound. Global
      `prefers-reduced-motion` guard added to `reset.css`; ticker/flyout also short-circuit
      on it in JS.
    - **Verified:** new `tests/unit/numberTicker.test.js` (5 tests, rAF/performance stubbed
      — instant first set, non-finite passthrough, animate-to-target, integer mid-frames,
      same-value settle; `npm test` **182/182**). boot/world/dev browser smokes all pass,
      **zero page errors**. Headless `?dev` probe (scratchpad `c3-probe.mjs`): reward coins
      spawn + reap, the money chip climbs 500→5000, and a mid-flight sample (2049) proves
      the tick-up is animated not instant. `check-comments` clean in all new/edited files
      (flagged violations are all pre-existing, in the queued cleanup task).

11. **Simultaneous-event feedback serialized (audio + UI).** When several events
    completed on the same tick (e.g. `quest:completed` + a milestone), overlapping
    `voice`-category clips garbled into a "merged voice," and toasts stacked 3-up.
    - **Audio:** `SampleLibrary` now runs the `voice` category through a single-channel
      **queue** (`_voiceQueue`, cap `VOICE_QUEUE_MAX = 3`) that drains one clip at a time,
      each scheduled by `setTimeout(clipDuration + 0.12s gap)`. Non-voice categories still
      stack. Regression tests in `tests/unit/sampleLibrary.test.js`.
    - **UI:** `NotificationManager` `MAX_VISIBLE` `3 → 1` — the existing `_queue`/`_flush`
      now reveals toasts strictly one at a time. Covered by the boot smoke tier
      (DOM-bound). Backlog note: at `TOAST_DURATION_MS = 4000` a big burst takes a while
      to drain; tune the duration if it feels slow.

10. **Grit reskin Phase C2 — canvas juice** (ADR 0018). Shared pooled particle system
    lands feel-motion on both canvases; no gameplay/state change.
    - New `js/ui/fx/particles.js` — `ParticleField`: pooled, **space-agnostic** (draws
      under whatever ctx transform is active), pure `update(dt)` (integrate → drag → reap
      by in-place compaction, unit-testable in Node). Shapes `dot`/`spark`/`ring`; emitter
      helpers `haze`/`burst`/`ripple`/`puff`. Each renderer keeps **two** fields — a
      screen-space one (ambient) + a world-space one (anchored fx).
    - `WorldRenderer` — `_ash` + `_fx`; `_frame` updates both every frame and redraws on
      dirty/marches/live-fx/~30fps ambient tick. Public `impactAt(poiId, kind)` +
      `rippleRegion(regionId)`; **WorldMapUI** fires them from `march:arrived`
      (victory→amber burst, defeat→grey) and `world:regionCaptured` (green ripple at region
      centroid). `_drawMarchArcs` now draws a fading 4-dot trail behind the mover + an ETA
      pill (`m:ss`, `⚔` while acting) from the phase's absolute timestamp.
    - `CityRenderer` — `_dust` + `_fx`; `syncState` precomputes `_smokers` (built
      production slots) + `_builders` (constructing); `_updateFx` trickles dust, dark
      chimney smoke, and construction dust (all count-paced). `popTile()` (from `cityInput`
      on a building tap) → `_popScale` gives a ≤13% bottom-anchored sprite pop over 260ms.
    - **No new save state** (fx are transient, like fog/boss windows). Pool caps bound
      draw cost. Ripple/impact take **ids not display names** — a fiction name silently
      no-ops (ADR 0002/0017 rule).
    - **Deferred (C2 follow-up, TODO):** battle-toast screen flash + camera nudge; building
      2-frame light-flicker overlays. Lower value, touch toast/overlay wiring.
    - **Verified:** new `tests/unit/particles.test.js` (8 tests — pool cap, integration,
      reaping/compaction, fade envelopes, emitter counts; `npm test` **174/174**). boot/
      world/dev browser smokes all pass, **zero page errors**. Headless `?dev` eyeball
      (scratchpad `c2-shot.mjs`): convoy mover + live ETA pill drawn on a dispatched gather
      march, green capture ripple expands over Home Refuge, terrain/ash render; farm built
      to Lv.1 to exercise the smoker path. `check-comments` clean in all edited/new files.

9. **Grit reskin Phase A4 — fiction pass** (ADR 0017). Post-apocalypse re-fiction of the
   fantasy strings — **display strings only, never ids** (ids are save keys). No systems
   or geometry changed.
   - `worldMap.js` — factions (Goblin Clans → Scavenger Packs/SCAV, Bandit Coalition →
     Red Talon Raiders, Wildlands → The Free Wastes), region names (Mistwood → Ashwood,
     Goblin Crest → Vulture Ridge, Dragon Spire → Behemoth Spire, Home Vale → Home
     Refuge), curated POI names + icons (Dragon's Lair → Behemoth Nest 🦂, Haunted Keep →
     Irradiated Depot ☢️, Warden Shrine → Warden Bunker 📡, watchtower → Radar Mast 📡,
     Goblin Camp → Scav Camp 🪓, castle/pagoda fort emoji → 🏭/🚧). Every id, factionId,
     monsterId, capturesRegion, regionId, and numeric field byte-identical.
   - `combat.js` — `MONSTERS_CONFIG` + `CAMPAIGNS_CONFIG` names/icons/descriptions/wave
     names (goblin_camp → "Scav Warband", undead_legion → "Ghoul Horde" ☣️, demon_gates →
     "Meltdown Site" ☢️, dragon_lair → "Behemoth Nest", chaos_titan → "The Colossus",
     etc.). All ids/monsterId/campaignStage/requires/stats untouched.
   - `buildings.js` — `magictower` only: Magic Tower → **Comms Tower** 📡, description +
     effectLabel de-magicked. Id `magictower` stays (save key + nav-view key). Every
     other building name was already genre-neutral.
   - `story.js` — light re-fiction of all 6 chapters (keep/empire/arcane → outpost/
     settlement/power-grid; Steward → Quartermaster, Scholar → Engineer). Ids/questIds/
     buildingIds/triggers/rewards preserved.
   - **Deferred to a later light pass (TODO, ADR 0017):** the **hero cast** (`heroes.js`
     + hero-card/fragment strings in `economy.js` — Arch Sorceress/arcane skills, Lord
     Arcturus) is left for the Hero recruitment redesign (skill names are id-coupled;
     re-fiction it there to avoid double churn); **unit tier names** (`units.js` —
     Paladin/Crusader/Templar/Archon) are borderline and out of A4 scope.
   - **Verified:** new regression test `gameData.test.js` → "save-key ids are unchanged
     by fiction passes" freezes region/faction/curated-POI/monster id sets (`npm test`
     **166/166**). boot/world/dev browser smokes all pass, **zero page errors**;
     world-smoke's id-driven seed/reconcile + region-ownership checks confirm no id was
     orphaned. `check-comments` clean in the edited files.

8. **Multi-instance buildings are now numbered where you look at them.** Bug: upgrade
   prereqs read "Upgrade House 1 first" but every House/Barracks/etc. showed the same
   bare "House" label on the map and in the click-tooltip, so you couldn't tell which
   physical copy was 1. `getBuildingTypesWithInstances()` now stamps a `displayName`
   (`<name> <idx+1>` when `instanceSlots.length > 1`, plain name otherwise) on each
   instance; consumed by the CityRenderer on-map label + hover pill, the TileTooltip
   header, and the BuildQueueSidebar rows. BuildingCards numbers via its own `instLabel`
   pill (same `totalSlots > 1` rule). Numbering is 1-based, matching the requirement
   strings in `BuildingManager` — the `#` was dropped from those too, so everything
   reads "House 1 / House 2" (no hash). The type-level BuildingInfoPanel stays unnumbered
   (per-type, not per-instance). Also: **unbuilt (planned) on-map labels recolored** from
   the old bluish `rgba(140,200,240,.65)` to warm amber `rgba(240,180,90,.8)` so a
   surveyed-but-unbuilt plot reads distinctly from a built one (built stays light-blue).
   Regression test in `tests/unit/buildingManager.test.js` (npm test 165/165).

7. **Concurrent build workers** (ADR 0016). The build queue was one-at-a-time
   (`_buildQueue[0]` = sole active); the Construction Hall's extra slots only added
   waiting depth, so unlocks never sped up the clock. Now every unlocked slot is a
   concurrent worker over one shared FIFO queue, +2 waiting buffer (capacity =
   workers + 2).
   - New pure module `js/systems/building/buildQueue.js` — worker-pool helpers
     (`fill`/`nextStartable`/`earliestDue`/`earliestActive`/`capacity`); active = item
     with `endsAt` set; same-instance items never run in parallel (upgrades stay serial);
     a freed worker skips ahead to the first startable item.
   - `BuildingManager`: single `_catchup(nowMs)` replaces the three head-drain loops
     (tick/offline/deserialize); `build()`/`cancelBuild()` push-then-`fill`; `getBuildQueue()`
     returns actives-first (+ `waitingPosition`); per-instance active detection in
     `getBuildingTypesWithInstances()`/`getActiveBuildings()`; `reduceActiveTimer(sec,
     instanceId?)` targets a specific active. Legacy saves fan out to N workers on load.
     Drive-by fix: `applyOffline` `elapsedSec` ReferenceError.
   - UI: sidebar renders multiple active rows with independent speed-up/cancel; speed-up
     threads `targetInstanceId` through SpeedupPicker → `InventoryManager.useItem` →
     `reduceActiveTimer`. Header shows `active/workers · N waiting`.
   - Tests: `tests/unit/buildQueue.test.js` (7) + `tests/unit/buildingManager.test.js` (13).

6. **Sandbox spend is now free** (`ResourceManager`). Bug: with `?dev` (sandbox mode) the
   boot flood topped resources once, but every build after that *depleted* the stockpile
   normally — you'd wait for production to refill like a real playthrough. Now
   `canAfford()` returns `true` and `spend()` deducts nothing in sandbox mode, so dev
   builds are truly unconstrained (matches the existing sandbox 10× `add()` / 100× build
   speed). Campaign/survival unchanged. New regression test
   `tests/unit/resourceManager.test.js` (2 tests, `npm test` 144/144). Also trimmed two
   pre-existing narrative comments in `ResourceManager.js` (comment-lint).

5. **Grit reskin Phase C1 — real sound** (ADR 0015). The Kenney `.ogg` packs under
   `assets/audio/` finally play; nothing did before.
   - New `js/systems/sound/sampleLibrary.js` — `MANIFEST` (preset key → files), lazy
     `fetch`+`decodeAudioData`, random-variant pick, per-category volume
     (`ui`/`combat`/`reward`/`fanfare`/`voice`). `tryPlay(key)` plays a decoded buffer and
     returns `true`, else kicks off the async load and returns `false`.
   - New `js/systems/sound/ambientBed.js` — procedural brown-noise wind bed (lowpass +
     slow-LFO swell), idempotent start/stop with fades. World view only.
   - `SoundManager` unchanged in shape (163 → ~200 ln): every tone preset is now
     `if (this._sample(key)) return; <existing tone>` — **sample-first, tone fallback,
     zero regression**. It owns the ambient lifecycle (subscribes `ui:viewChanged` +
     `settings:changed`; bed runs only on `world` view with `sfxEnabled && ambientEnabled`).
     `click`/`switch` warmed at construction. New event wires: `combat:started`/
     `combat:marchResolved` → impact, `march:dispatched` → voice bark (no tone fallback),
     `march:completed` → mission-complete voice.
   - `SettingsManager` gains `ambientEnabled` (default true) + a toggle in `SettingsUI`.
     `window.game` now exposes `sound` + `settings` for probes.
   - **Tests grown:** `tests/unit/sampleLibrary.test.js` (4 tests — manifest file paths
     `.ogg`/known-dir, every category has an in-range volume, no dup variants). `npm test`
     **142/142**. Both browser smoke scripts still pass (zero page errors — sound modules
     load, ambient starts on world-nav without throwing).
   - **Verified** (scratchpad `c1-sound-probe.mjs`): headless Chromium decodes the OGG
     samples (5 click variants + 2 victory voice variants), ambient bed runs on the world
     view and stops on both the `ambientEnabled` toggle and leaving the view; AudioContext
     resumes on gesture; no page errors. **`.ogg` decode is Chromium-native.**
   - **Note:** a manifest path that is well-formed but points at a *missing* file is only
     caught at runtime (drops to tone). Keep `MANIFEST` in sync with `assets/audio/`.
   - **Tuned by ear (Steve, 2026-07-18):** the chiptune sets (`jingles_NES`/`jingles_HIT`)
     were rejected on listening and are no longer wired anywhere. Final map in ADR 0015:
     build/train = metal clunk, research = its own bright synth chime, quest/march-return =
     "mission completed" voice, achievement = heavy bell toll, reward collect (mail /
     inventory / market / march haul) = leather-pouch pickup. Steve signed off: "everything
     sounds better now." One open caveat: `coin`/`dropLeather` is single-variant (repeats
     on rapid collects) — add variants if it grates.

### Landed this session (2026-07-18, earlier)

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

### Base layout rework status (approved 2026-07-19, ADR 0022)

- Plan: `docs/base-layout-plan.md`. **Phase A + Phase B shipped** (items 15, 16 — free
  placement, then auto-roads + rubble sectors + textured ground). Next: **Phase C**
  (adjacency bonuses + migration bonus toast; balance pass).

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

## Next steps (session ended 2026-07-18 — resume here)

0. **Use the suite.** `npm test` is the cheap gate — run it before and after any change
   to march/world/data/building-rules logic, and add cases as you go (contract:
   `tests/README.md`). Worth adding when someone's in the area: SaveManager round-trip,
   march dispatch end-to-end (needs a save with squads), combat resolution.

1. **A3 is DONE** (ADR 0021) — all 20 types rig-rendered and wired. Open follow-ups:
   tune per-type `fit` after Steve eyeballs his real save (one number per job in
   `rig/jobs-*.json`, re-render + copy); **city ground pass** is the next visual work
   (flat `GROUND_COLOR` diamonds — render/texture ground tiles, likely through the
   same rig). The 6 formerly-manual Quaternius packs are **on disk now**; game-icons.net
   is **CC-BY** → needs a credit line if its icons ship.
   - Non-art alternative any time: the **Hardening** track (systems bug audit / Phase 2
     verification+balance / data consolidation Phase 1). Deferred follow-ups still open:
     two **C2** (battle-toast flash + camera nudge, building light-flicker) and two **A4
     fiction** (hero cast → Hero redesign, unit tier names `units.js`).

2. **Optional sound follow-ups (C1 is done/signed-off, only if asked):** add variants to
   `coin`/`dropLeather` (single-clip repeats on rapid collects); the deferred A2 gacha
   rarity ladder; A1/A2 by-eye tuning (plaque size, vignette, amber saturation).
3. Balance items B1 created (roadmap → Hardening): 99 filler nodes change gather supply;
   `dragon_spire`/`command_ruin` filler is unguarded (neutral → no faction enemy pool);
   `BASE_SPEED_PX` 265 preserves old times rather than being tuned for the new map.
4. Remaining world/march audit findings (lower severity, roadmap → Hardening): gather
   economic-bonus no-op clamp, `resolveMarchBattle` `milMult < 1` debuff trap, and a
   buff-dependent *UI* listener for `world:buffsChanged`.
5. Queue the comment-cleanup session (low-cost model; `node scripts/check-comments.mjs`
   lists 13 violations, all pre-existing).

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
