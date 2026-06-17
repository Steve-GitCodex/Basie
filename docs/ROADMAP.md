# Basie — Roadmap & Progress Tracker

A living checklist of what's **done**, what's **in progress**, and what's **next**.
Update the boxes as work lands. Deep design specs live in their own docs (e.g.
[`phase2-worldmap.md`](phase2-worldmap.md)); this file is the high-level map.

Legend: `[x]` done · `[~]` in progress / partial · `[ ]` not started

---

## ✅ Recently shipped (this work stream)

- [x] **World-map region redesign** — map is one rectangle **partitioned into 9
  tessellating tiles** (no overlap, thin seams), a continuous **warp field** bends
  the shared cell borders into organic hand-drawn curves, thick **ink borders**,
  no outer container box.
- [x] **Square command-centre ruin** (centre tile) — end-game capture, **gated**:
  locked until the 4 orthogonal neighbours are owned **and** a high-level fight
  (`chaos_titan` L10). Shows 🔒 when locked, gold "ready" pulse when unlockable.
- [x] **Region unlock chain** — each tile `requires` an owned neighbour; the player
  expands inward from the bottom-left **home** tile. (`region.requires` was dead
  data before — now enforced in `WorldMapManager.regionLock` + `_poiVm` +
  `PoiDetailPanel` + `marchRules.canDispatch`.)
- [x] **Ownership model** — explicit `startOwner` (only home starts player-owned;
  ruin starts unowned). Kept an owner-string for the future AI (Phase 4).
- [x] **Free-pan camera** — `WorldCamera` floor switched cover→**contain** + margin
  clamp so you can zoom out to the whole map and pan in all directions.
- [x] **Territory legend** (bottom-right) — My Territory + factions, updates on
  capture. **POI level badges + `[TAG]` faction labels** on markers.
- [x] **Inventory restyle** — tabbed bag (per-tab count badges) + rarity-tinted
  square tile grid + tap-to-detail popover (reuses existing item actions).

---

## 🔨 Current focus — Phase 2 **Hardening**

> Goal: take the world-map/march MVP from "works in a headless smoke test" to
> "solid, balanced, and pleasant to play," and update the docs/counts. No new
> pillars — stabilise and polish what exists before Phase 3+.

**1. Verification (full loop in a real browser)**
- [ ] Gather march: dispatch → node depletes → army returns with loot (carried, not mailed).
- [ ] Camp: attack → clear → respawn timer → re-attackable.
- [ ] Stronghold: attack → region flips to player → signature buff activates → legend updates.
- [ ] Unlock chain: locked tiles refuse march with the right reason; capturing a neighbour unlocks the next; the **ruin gate** opens only after all 4 neighbours.
- [ ] Camera: contain zoom shows whole map; pan reaches every edge; ⌖ reframes home.
- [ ] **Save / reload round-trip** with the new fields (`startOwner`, list-`requires`, `rect`); deploy-lock re-asserts from restored marches; respawn timers survive reload.
- [ ] No `pageerror` / console errors during the above.

**2. Balance pass**
- [ ] March times vs army `speed` (not too slow/instant); logistic buff feels meaningful.
- [ ] Gather rates / node capacities / regen vs base production (don't trivialise the city economy).
- [ ] Per-tile monster difficulty matches the level badge ramp (L3 edges → L10 ruin); ruin is hard-but-reachable.
- [ ] Region buff percentages (economic/military/logistic) and the **ruin capstone** (currently `military +25%`).

**3. Runtime robustness / edge cases**
- [ ] `worldState.reconcileState` handles map edits (renamed/added/removed regions & POIs) on old saves without errors.
- [ ] Squad deploy-lock is runtime-only and rebuilt on load (never serialised).
- [ ] Concurrent marches, all march slots full, empty/destroyed squads, node fully depleted mid-march.

**4. UX & visual tuning**
- [ ] Seam thickness, warp strength, tile colours, label placement, **double-digit level badge** readability.
- [ ] Marker legibility across zoom; tooltip; dispatch error toasts; capture toast.
- [ ] Rally Point gating of the world tab + march-slot count from building level.

**5. Fast-follows (pull in if cheap, else defer)** — from the Phase 2 spec
- [ ] **Ruins / dungeons** POI (scout → buff/item/lore).
- [ ] **World boss** POI (windowed, rare loot — a lightweight Arena teaser).
- [ ] **Outposts / watchtowers** (shorter marches / fog reveal).
- [ ] **Fog of war**.

**6. Docs & housekeeping**
- [ ] Update [`phase2-worldmap.md`](phase2-worldmap.md) — it still shows the old
  3-circle layout; refresh to the 9-tile tessellation + command ruin + gating.
- [ ] Re-check CLAUDE.md manager/UI counts (still **21** managers / **17** UI — unchanged this stream).
- [ ] Decide the campaign-combat retirement timing (interim: map marches run in
  parallel with the menu campaign; Arena/Phase 3 eventually replaces it).

---

## 🗺️ Phase status overview

| Phase | Theme | Status |
|---|---|---|
| **1** | UI redesign (bottom tabs, iso city, blueprint, plot placements, camera, build-queue sidebar, tooltips) | [~] mostly done; **SVG/sprite icons** + **game-HUD shell restyle** not started |
| **2** | World map + march system (`WorldMapManager`, `MarchManager`, regions, gather/attack, Rally Point) | [~] MVP + region redesign done; **hardening in progress** (this doc) |
| **3** | **Arena** — PvP + alliance co-op boss fights + ranks; eventually replaces campaign combat | [ ] needs Phase 7 backend |
| **4** | **AI opponents** (`AIManager`, `AIBase`, `AIStrategy`) | [ ] not started |
| **5** | Map events & objectives | [ ] not started |
| **6** | Notification centre + hero equipment crafting | [ ] not started |
| **7** | Backend + true multiplayer (Node.js + Firebase Realtime DB) | [ ] not started |

### Phase 1 — UI redesign (remaining)
- [ ] Replace emoji with SVG/sprite icons in nav + cards.
- [ ] Game-HUD restyle of the shell (resource bar, nav, panels layered over the city).

### Phase 3 — Arena (combat pillar)
Strong AI bosses, player ranks, PvP, and alliance co-op boss fights (Shadow-Fight
style). Intended to **replace** the menu campaign combat. Until then, world-map
marches are the interim combat layer. Likely blocked on the Phase 7 backend.

### Phase 4 — AI opponents  ⭐ (ties into the world map)
`AIManager` driving faction regions. **Per the product direction**, AI is the
world-map's long-term engagement loop: AI factions **grow with the player's
level/activity** and, past a threshold, can **claim regions back from the player**,
keeping them busy defending. The current tessellation + capture/buff loop +
owner-string ownership model are deliberately built to feed this. (See the project
memory note on AI-faction direction.)

### Phase 5 — Map events & objectives
Time-limited world events, dynamic objectives, and reward modifiers layered onto
the map.

### Phase 6 — Notification centre + hero equipment crafting
A unified notification hub and a crafting loop for hero gear (the equipment
framework already exists).

### Phase 7 — Backend + multiplayer
Node.js + Firebase Realtime DB; the prerequisite for the Arena (Phase 3) and any
true cross-player interaction.

---

## 🧩 Cross-cutting reworks (not tied to one phase)

These were agreed/raised in discussion but span multiple systems, so they live
here rather than under a single phase.

### Build-menu redesign + placement model + tutorial rework  ⭐ (user-requested, next-ish)
The base build flow is to be reworked. Today it's only **interim-patched** (an
anti-teleport guard), not fixed.
- [~] **Interim patch applied** — `buildOnPlot`/`getBuildableOnPlot` reject building
  an instance that already holds a reserved plot, so building happens only via the
  named blueprint tiles (tutorial unaffected).
- [ ] **No-reservation placement model** — only built / under-construction instances
  own a plot; unbuilt instances hold none. Collapses the two conflicting build paths
  into one (empty plot → build sheet → fresh plot). Fold into a `PlacementStore`
  extraction out of `BuildingManager._placements`.
- [ ] **Redesigned build menu / sheet** — the build-here UX the user wants to rework
  first (it drives the tutorial change below).
- [ ] **Empty-plot proxies + event** — `.base-plot[data-plot-id]` proxies and a
  `buildSheet:opened` event for spotlighting.
- [ ] **Tutorial rework** — rewrite steps 1–6 from spotlighting seeded
  `.base-tile[data-building-id]` tiles to a **2-phase spotlight** (empty plot →
  `[data-build-id]` option). Required because dropping reservations removes the
  seeded blueprint tiles the current tutorial depends on.

> Why bundled: the tutorial currently only works because every unbuilt building is
> seeded a plot; removing that (the proper placement fix) breaks tutorial steps 1–6,
> so the build-menu redesign, placement model, and tutorial rework must ship together.

### Game-HUD shell restyle (also listed under Phase 1)
- [ ] Restyle the shell — resource bar, nav, and panels layered as a game HUD over
  the iso city (not a dashboard). Pairs with the SVG/sprite icon swap.

> **Anything missing?** If you've raised other reworks not captured here, tell me and
> I'll add them — this section is meant to catch the cross-cutting items the phase
> list doesn't.

---

## Backlog / nice-to-haves
- [ ] Region buff stacking UI (show all active territory buffs in one place).
- [ ] Multi-base / second city.
- [ ] Map mini-map / region jump-to.
- [ ] Difficulty/scaling seam for AI strength driven by player level + activity (Phase 4 prep).
