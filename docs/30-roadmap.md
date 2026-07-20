# Roadmap

Legend: `[x]` done · `[~]` in progress / partial · `[ ]` not started.
Deep design lives in `docs/10-design/`; the session handoff is `docs/40-active.md`.

> **Health warning:** feature checkmarks mean "implemented", not "solid". Most systems
> are known to be buggy / roughly built — see the **Hardening & housekeeping** track
> below before trusting any `[x]`.

## Phase status

| Phase | Theme | Status |
|---|---|---|
| **1** | UI redesign — iso city, blueprint + placements, floating-dock nav, build queue sidebar, HUD restyle, SVG icon system | [x] done |
| **2** | World map + marches — MVP (gather/attack, regions, Rally Point) **and** fast-follows (scout, ruins, outposts, world bosses, fog) | [x] implemented (uncommitted as of 2026-07-15); hardening open |
| **Reskin** | Grit reskin (art direction, tile-grid world, juice) — `docs/10-design/grit-reskin.md`, ADR 0008 | [~] in progress (A1+A2 done 2026-07-15, B1+B2 done 2026-07-16, C1+A4+C2+C3 done 2026-07-18; A3 Session 1 done 2026-07-18 — five core grit buildings; A3 rest + B3 left) |
| **3** | **Arena** — PvP + alliance co-op boss fights + ranks; eventually replaces campaign combat | [ ] blocked on Phase 7 |
| **4** | AI opponents (`AIManager`) — factions grow with the player, re-capture regions (ADR 0005 seeds this) | [ ] after reskin |
| **5** | Map events & objectives | [ ] |
| **6** | Notification center + hero equipment crafting | [ ] |
| **7** | Backend + true multiplayer (Node.js + Firebase Realtime DB) | [ ] |

## Grit reskin (current focus)

Sequencing per `docs/10-design/grit-reskin.md` — each phase ≈ one session, independently
shippable: A1 grim grade → A2 UI theme → B1 grid data → B2 grid renderer → C1 sound →
A4 fiction pass → C2/C3 juice → A3 sprites + B3 terrain art (user-in-the-loop last).

- [x] A1 · [x] A2 · [x] B1 · [x] B2 · [x] C1 · [x] A4 · [x] C2 · [x] C3 · [~] A3 · [ ] B3

**A3 Session 1 landed 2026-07-18** (ADR 0020, amends 0009/0010): the square-grid swap was
dropped — the Quaternius CC0 art is **iso-rendered** (diamond footprints) and ships finished
**PNG renders** (no Blender). `isoMath.js` **retuned** (`TILE_W 128 × TILE_H 96`), buildings
draw at native px (shared-scale-trimmed → real size variety), ground → flat-color diamond
cells (Kenney landscape retired), level-keyed `GRIT_BUILDING_MAP`. Wired the five
always-on-screen types (townhall/house/farm/barracks/storehouse, L1–L3); rest are one-line
manifest additions. Verified: `?dev` base view renders grit sprites seated + graded, zero
page errors, 182/182 unit + all three smokes green. **Next:** wire the remaining ~15 types;
gap types need the staged gap-filler packs; consider townhall→Temple/Wonder (plaza reads
light as an HQ).

**C3 landed 2026-07-18** (ADR 0019): DOM/HUD juice, no new save state. New
`js/ui/fx/numberTicker.js` (per-element retargeting count-up) wired into
`NavigationUI._renderResources`; new `js/ui/fx/resourceFlyout.js` flies a reward coin from
mid-screen into `#res-{key}` on `resources:added` then pulses the chip. Sheets
(PoiDetailPanel/MarchDispatchSheet/BuildablesPanel) get `--transition-spring` slide+fade;
universal `.btn:active` scale + a capture-phase `ui:click` for every button, deduped by a
60ms coalesce in `SoundManager.click()`. Global `prefers-reduced-motion` guard. Next reskin
phase: **A3 sprites** / **B3 terrain atlas** (both user-in-the-loop art).

**C2 landed 2026-07-18** (ADR 0018): one shared pooled `js/ui/fx/particles.js`
(`ParticleField`, space-agnostic, pure `update`) drives both canvases. World map: ambient
ash, amber/grey impact burst on `march:arrived`, green capture ripple on
`world:regionCaptured`, and convoy movers upgraded with a fading trail + `m:ss` ETA pill.
City: ambient dust, dark chimney smoke on producing buildings, construction dust, and a
≤13% sprite tap-pop. No new save state; world view now redraws at ~30fps while open.
Deferred follow-up: battle-toast screen flash/camera nudge + building light-flicker.

**C1 landed 2026-07-18** (ADR 0015): sample playback with a procedural-tone fallback. New
`js/systems/sound/{sampleLibrary,ambientBed}.js`; `SoundManager` presets try a decoded
Kenney `.ogg` sample first and fall back to the original tone if the buffer isn't loaded
yet (zero regression). Procedural wind bed on the world view, gated by a new
`ambientEnabled` setting. Verified headless: OGG decode + ambient toggling.

**B2 landed 2026-07-16** (ADR 0013): `js/ui/world/gridLayer.js` (226 ln) renders the cell
grid into 16×16-cell offscreen chunks (512×512 texture, nearest-neighbour blit → crisp at
any zoom), flat-fills chunks below zoom 0.22, and derives per-cell fog from existing
region/outpost state — **no new save state**. `WorldRenderer` 504 → 426 ln; the organic
warp/outline code is deleted. 60fps verified during a pan sweep. The map now reads as a
tile grid, in flat-colour placeholder — **B3's terrain atlas should follow close behind**
(it also breaks the fixed-texture-scale assumption; see ADR 0013).

**B1 landed 2026-07-16** (ADR 0011): 96×96 cells @ 100px = 9600×9600 world, 9 sectors of
32×32 cells. `worldGrid.js` owns geometry (cells → derived px), `gridGen.js` generates
terrain + 99 filler POIs from a fixed seed. Region/POI ids untouched; old saves verified
intact. `BASE_SPEED_PX` 80→265 holds march times steady. **No renderer work yet** — the
map still draws the warped organic region polygons over the new (larger) rects; B2
replaces that terrain layer with the chunked grid.

**A3 kept the diamond grid, retuned** (ADR 0020 amends 0009): the Quaternius CC0 art is
iso-rendered (diamond footprints), so `isoMath.js` was **retuned** (`TILE_W 128 × TILE_H 96`)
rather than replaced by a square `gridMath.js`. Ground is flat-color diamond cells for now;
a chunked city terrain atlas (reusing B2, closing the 30fps ceiling) is still open.

**B3 art = AI-generated seamless terrain atlas, plan of record** (easiest AI-art win —
do it before A3's buildings; keep B3 close behind B2 so the grid map doesn't linger in
flat-color placeholder state). Details in `10-design/grit-reskin.md` § B3.

**A3 art = CC0 3D render-to-sprite, plan of record (ADR 0010):** Quaternius Ultimate
Fantasy RTS as base geometry (evolution stages → per-level building sprites — new
scope), kit-bashed to post-apoc, rendered from one Blender ortho-¾ scene. No direct AI
sprite generation.

## Hardening & housekeeping

- [x] **Test suite** (2026-07-16, ADR 0012) — two tiers, additive by contract
  (`tests/README.md`): `npm test` runs 128 `node:test` unit tests across 9 files
  (data invariants, worldState seed/reconcile, march resolver/math/rules, region
  buffs, grid determinism, building rules, EventBus); `node tests/browser/*-smoke.mjs`
  drives a real guest-sandbox boot via Playwright resolved from outside the repo.
  No game source changed. **Every bug fix from here on lands with a regression test.**
  Not yet covered: SaveManager round-trip, tutorial contract, march dispatch
  end-to-end, combat resolution.
  Grown by B2 (2026-07-16): 138 unit tests (`gridLayer` chunk geometry/LOD, incl. the
  chunk⊂sector invariant ADR 0013 depends on) + 3 `world-smoke` checks (terrain variety,
  owned-tint recolor through the *cached* path).
- [x] **`?dev` session flag** (2026-07-18, ADR 0014) — `http://localhost:8000/?dev`
  boots straight to an unlocked world map (skips auth/tutorial/new-game modal; drives
  the real build/train APIs to sandbox HQ Lv.3 + Rally Point + a march-ready squad).
  Ephemeral: never persisted, so the real save is untouched. Covered by
  `tests/browser/dev-smoke.mjs`. Removes the from-scratch tax on eyeballing gated views.
- [x] **Concurrent build workers** (2026-07-18, ADR 0016) — build queue went from
  one-at-a-time to N concurrent workers over a shared FIFO queue (workers =
  `getMaxBuildSlots()`, +2 waiting buffer). New `js/systems/building/buildQueue.js`
  pool helpers; unified `BuildingManager._catchup`; same-instance upgrades stay serial;
  legacy saves fan out on load. Fixes the `applyOffline` `elapsedSec` ReferenceError.
  Tests: `buildQueue.test.js` (7) + `buildingManager.test.js` (13).
- [ ] **Systems bug audit** — most managers are bugged / roughly built (owner's
  assessment). Sweep system by system (browser + Playwright harness), file findings
  here, fix the load-bearing ones before the reskin builds on top.

  **Findings so far (world/march code review, 2026-07-15):**
  - [x] **Crash:** an in-flight march whose target POI is removed dereferenced
    `poi.id`/`poi.resource` in `marchResolver._gather` on arrival → TypeError inside
    the engine tick. **Fixed** (2026-07-15) with a null-POI guard at the top of
    `resolveArrival` — aborts to a `lost_target` outcome (empty haul, squad returns and
    frees its slot). Chosen over the deserialize-drop suggestion because the guard also
    covers runtime removal, not just load. Verified: all three march types return
    cleanly on a null POI.
  - [x] **Dead feature:** economic region buffs never reached base production. **Fixed**
    (2026-07-15): `ResourceManager.setWorldMapManager()` injects the world ref and
    subscribes to `world:buffsChanged`/`world:regionCaptured`; `recalculateRates()` now
    multiplies each resource by `1 + economicBonus(activeBuffs(), key)`. `captureRegion`
    now also emits `world:buffsChanged`; load re-runs rates after world state restores.
    Verified: capturing `west_warrens` raised iron production 100 → 110 (+10%).
  - [ ] **No-op math:** the gather economic bonus in `marchResolver._gather` is clamped
    back to `loadCap`, which the node extraction already filled — the bonus only pays
    out on nearly-empty nodes. Either raise the clamp or apply the bonus mint-side.
  - [x] **Design drift:** all buff flavors apply globally; the design said in-region
    only. **Decided** (2026-07-15): global is the model of record (matches the flat
    `activeBuffs()` list and the existing gather/military/logistic treatment). Base
    economic buffs now apply globally too; align UI copy when the buff-stacking UI lands.
  - [ ] **Future trap:** `CombatManager.resolveMarchBattle` ignores `milMult < 1`
    (`milMult > 1` guard) — silently breaks the first debuff (Phase 4 AI).
  - [~] **Unused event:** `world:buffsChanged` fires (outpost capture, region capture,
    timed buffs, expiry) — `ResourceManager` now listens (production reapply). No
    buff-dependent *UI* listener yet, so buff panels can still go stale until another
    event repaints them.
  - Verified sound, for the record: clock-derived boss windows; deploy-lock
    runtime-only + re-asserted on load + excluded from campaign attacks; offline march
    catch-up (cascading absolute timestamps); `worldState` seed/reconcile;
    anti-teleport placement guard.

  **Base-view findings (code review, 2026-07-15)** — the best-crafted corner of the
  codebase (proper dirty-flag rendering, culling, depth-interleaved agents, reactive-UI
  discipline in `BuildingsUI`), but:
  - [x] **Split `CityRenderer.js`** (2026-07-15): extracted `cityInput.js`
    (pointer/gestures, 137 ln), `cityAgents.js` (drone + walkers, 146 ln),
    `cityAmbient.js` (day/night + backdrop, 89 ln) as collaborator classes holding a
    back-ref to the renderer (which stays the owner of `ctx`/`camera`/`slots`). Picking
    + hover stay on the renderer (they share draw geometry); CityInput dispatches to
    them. CityRenderer 1123 → **818 ln** — still over 400: the residual is the slot/
    building/plot/badge drawing, deliberately left for ADR 0009's projection swap to
    rewrite (a `cityDraw.js` extraction now would collide with that). Verified: boots,
    renders, hover/zoom/pan/tap clean; tutorial spotlight still pins to the proxy tile.
  - [ ] **City ground-layer chunk cache** — the ambient loop repaints the whole scene
    at ~30fps while the base view is open (battery/mobile ceiling). The ground never
    changes per frame; render it into cached offscreen chunks like B2's world terrain
    (do together with the ADR 0009 projection swap).
  - [ ] **No-reservation placement model** — confirmed as the base view's biggest
    structural debt (seeded-ghost plots force the anti-teleport guard and couple the
    tutorial to seeded tiles); already bundled below under cross-cutting reworks.
- [ ] **Data consolidation** — hardcoded tunables (combat formula coefficients, march
  speed/carry/dwell, market trade table + inflation, population/cafeteria constants,
  starting grants, XP curves, 6 duplicated constants) live in managers instead of
  `js/entities/data/`. Six-phase pure-move plan, ordered by tuning churn:
  `docs/data-consolidation-plan.md` (2026-07-18 audit). One phase per session, behind
  `npm test`; Phase 1 (new `data/marches.js`) also lands the convention ADR.
- [ ] **Comment cleanup** *(suited to a lower-cost model)* — run
  `node scripts/check-comments.mjs`; delete narration comments and dead tracker refs
  (P#/B#/"Group N"); move real rationale into `docs/` / ADRs with `@see` pointers.
  Hot files: `UIManager.js`, `BuildingManager.js`, `CombatManager.js`,
  `ResourceManager.js`; plus reviewer-talk comments in the world/march files.
- [ ] **Phase 2 verification pass** (never completed from the old roadmap): full-loop
  browser checks — gather/camp/stronghold/unlock-chain/ruin/outpost/boss/fog flows,
  save/reload round-trip of every new field, camera reach, no console errors.
- [ ] **Phase 2 balance pass** — march times vs speed, gather rates vs base economy,
  per-tile difficulty ramp (L3 → L10 ruin), buff percentages + ruin capstone.
  Added by B1 (ADR 0011): 99 generated filler nodes/camps materially change gather
  supply — retune rates against the base economy; `dragon_spire` + `command_ruin` are
  neutral so their filler is resource-nodes-only (reads unguarded for endgame tiles);
  `BASE_SPEED_PX` 265 was set to preserve old march times, not tuned for the new map.
- [ ] Decide campaign-combat retirement timing (interim: marches run parallel to the
  menu campaign until the Arena).

## UX friendliness

- [ ] **Hero recruitment + management redesign** (Steve, 2026-07-15: "does not feel
  friendly" — confirmed by code review). Problems: recruiting spans four views
  (Shop → Inventory → GachaUI modal → Heroes detail pane) with no in-game guidance;
  five item classes to understand (scrolls, specific cards, universal cards,
  per-hero fragments, XP tomes); no drop-rate display and no pity/guarantee system
  anywhere; Heroes screen leads with raw multiplier chips and packs
  recruit/fragments/XP/skills/awakening into one dense pane; an unrelated
  "production buffs from Inventory" section sits in the Heroes view.
  Direction to design (candidate): one **Recruitment** surface owning scrolls, rolls,
  rates, and pity, reachable from the Heroes view; recruit/summon actions surfaced as
  a single "N recruitable" affordance; move the inventory-buff section out; simplify
  or merge currency types; genre-standard rate disclosure + pity counter. Worth a
  `game-designer` specialist pass before implementation; spec it as
  `10-design/heroes.md` when designed. Code cleanups to fold in: stop string-parsing
  `assignedBuilding` for squad names (HeroesUI); patch-in-place instead of full
  `render()` rebuilds (ADR 0007).

## Cross-cutting reworks

### Base layout rework — free placement (ADR 0022, `docs/base-layout-plan.md`)

Supersedes the previously bundled build-menu/placement/tutorial rework: the plot
model retires entirely (interim anti-teleport guard dies with it).

- [x] **Phase A** (2026-07-19) — half-tile cell grid + occupancy map, footprints in
  `BUILDINGS_CONFIG`, `instanceId → {cx,cy}` placements, spiral packer (legacy-save
  migration + new games), place/move ghost UX, tutorial proxy retarget + full
  tutorial retest.
- [x] **Phase B** (2026-07-19) — auto-derived decorative roads (`cityRoads.js`, never
  serialized), rubble-sector expansion (`citySectors.js` layout + `sectorState.js` save
  state, stable `sector_<ring>_<n>` keys, HQ-gated clears + grandfathering), textured
  per-cell city ground (`cityGround.js`, earth/cracked/ash/road/rubble + debris scatter).
  `cityBlueprint.js` + `cityLayout.js` retired. Camera re-homes on base re-entry until
  the player pans.
- [ ] **Phase C** — adjacency bonuses + migration bonus toast; balance pass.

## Backlog / nice-to-haves

- [ ] Region buff stacking UI (all active territory buffs in one place).
- [ ] Multi-base / second city · [ ] mini-map / region jump-to.
- [ ] AI difficulty scaling seam driven by player level + activity (Phase 4 prep).
