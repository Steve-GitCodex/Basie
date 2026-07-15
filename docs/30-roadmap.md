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
| **Reskin** | Grit reskin (art direction, tile-grid world, juice) — `docs/10-design/grit-reskin.md`, ADR 0008 | [~] planned, next up (start A1) |
| **3** | **Arena** — PvP + alliance co-op boss fights + ranks; eventually replaces campaign combat | [ ] blocked on Phase 7 |
| **4** | AI opponents (`AIManager`) — factions grow with the player, re-capture regions (ADR 0005 seeds this) | [ ] after reskin |
| **5** | Map events & objectives | [ ] |
| **6** | Notification center + hero equipment crafting | [ ] |
| **7** | Backend + true multiplayer (Node.js + Firebase Realtime DB) | [ ] |

## Grit reskin (current focus)

Sequencing per `docs/10-design/grit-reskin.md` — each phase ≈ one session, independently
shippable: A1 grim grade → A2 UI theme → B1 grid data → B2 grid renderer → C1 sound →
A4 fiction pass → C2/C3 juice → A3 sprites + B3 terrain art (user-in-the-loop last).

- [ ] A1 · [ ] A2 · [ ] B1 · [ ] B2 · [ ] C1 · [ ] A4 · [ ] C2 · [ ] C3 · [ ] A3 · [ ] B3

**A3 is now bundled with the base-view projection swap** (ADR 0009): diamond iso →
square-grid ¾ view (`gridMath.js` replaces `isoMath.js`), new square-tile sprite
contract in `10-design/assets.md`. Reuse B2's chunked-terrain renderer for the city
ground layer while in there (also closes the 30fps full-repaint ceiling below).

**B3 art = AI-generated seamless terrain atlas, plan of record** (easiest AI-art win —
do it before A3's buildings; keep B3 close behind B2 so the grid map doesn't linger in
flat-color placeholder state). Details in `10-design/grit-reskin.md` § B3.

**A3 art = CC0 3D render-to-sprite, plan of record (ADR 0010):** Quaternius Ultimate
Fantasy RTS as base geometry (evolution stages → per-level building sprites — new
scope), kit-bashed to post-apoc, rendered from one Blender ortho-¾ scene. No direct AI
sprite generation.

## Hardening & housekeeping

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
  - [ ] **Split `CityRenderer.js`** (1026 lines — over the 400-line rule): extract
    `cityInput.js` (pointer/gestures), `cityAgents.js` (drone + walkers),
    `cityAmbient.js` (day/night + backdrop). Do **before** grit A1 so `cityGrade.js`
    lands next to clean siblings and reskin diffs stay small.
  - [ ] **City ground-layer chunk cache** — the ambient loop repaints the whole scene
    at ~30fps while the base view is open (battery/mobile ceiling). The ground never
    changes per frame; render it into cached offscreen chunks like B2's world terrain
    (do together with the ADR 0009 projection swap).
  - [ ] **No-reservation placement model** — confirmed as the base view's biggest
    structural debt (seeded-ghost plots force the anti-teleport guard and couple the
    tutorial to seeded tiles); already bundled below under cross-cutting reworks.
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

### Build-menu redesign + placement model + tutorial rework (bundled — ship together)
- [~] Interim anti-teleport guard in `buildOnPlot`/`getBuildableOnPlot` (applied).
- [ ] No-reservation placement model (only built/under-construction instances own a
  plot); extract a `PlacementStore` from `BuildingManager._placements`.
- [ ] Redesigned build sheet UX.
- [ ] Empty-plot proxies (`.base-plot[data-plot-id]`) + `buildSheet:opened` event.
- [ ] Tutorial rework — steps 1–6 move to a 2-phase spotlight (empty plot → build
  option). Bundled because dropping reservations removes the seeded tiles the current
  tutorial spotlights.

## Backlog / nice-to-haves

- [ ] Region buff stacking UI (all active territory buffs in one place).
- [ ] Multi-base / second city · [ ] mini-map / region jump-to.
- [ ] AI difficulty scaling seam driven by player level + activity (Phase 4 prep).
