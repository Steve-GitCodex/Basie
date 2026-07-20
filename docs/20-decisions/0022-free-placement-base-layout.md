# 0022 — Free-placement base layout on half-tile cells

**Date:** 2026-07-19 · **Status:** accepted

## Context

The city view used a hand-designed blueprint (22×16 tiles, ~60 fixed one-tile plots,
zone-restricted auto-assignment). With grid-fitted sprites (ADR 0021) authored at
0.9–1.6-tile footprints, fixed adjacent plots visually collide for large types and
waste space for small ones, and the player has no layout authorship. Steve's
direction (2026-07-19): remove the tight grid; the player decides the base layout.
Full design + game-designer consult: `docs/base-layout-plan.md` (approved).

## Decision

Half-tile cell grid (64×48 px; iso projection unchanged). Per-type footprints in
`BUILDINGS_CONFIG` (2×2 / 3×3 / 4×4 cells). Placements are `instanceId → {cx, cy}`;
plot ids retire (deserialize already drops unknown ids → deterministic spiral packer
re-places legacy saves with category clustering). Hard zones are dropped in favor of
adjacency bonuses (Phase C); HQ is fixed and immovable. Roads are decorative,
auto-derived from layout, never serialized. Base grows by clearing rubble sectors
(stable new save keys, HQ-gated). Move UX: tooltip → Move → drag ghost → confirm;
no rotation, no edit mode, no move cost.

Phases: **A** placement core + tutorial retarget (proxy layer tracks instance cell
rects) · **B** auto-roads + rubble sectors + city ground pass · **C** adjacency
bonuses + migration bonus toast. Non-goals listed in the plan are binding.

## Amendment (2026-07-20) — sprite seating uses a per-sprite ground anchor

Buildings are billboards; anchoring the sprite's bottom-centre at the plot's front
(south) vertex puts the building's ground-contact at the plot's front EDGE, so any
base smaller than its plot reads as shoved forward. Sizing alone cannot fix both
centring and neighbour overlap.

The rig therefore exports, per sprite, the pixel where the model's ground-contact
centre projects (`{ax, ay}` → `assets/tiles/buildings/grit/_anchors.json`), and
`CityRenderer._spriteBox()` seats that point on the plot **centre**. Draw, hit-test,
proxy rect and badges all derive from `_spriteBox`, so they cannot diverge. Each
level's sprite carries its own anchor, so per-level centring is automatic. Sprite
`fit` = the footprint size (2×2→1.0, 3×3→1.5, 4×4→2.0 tiles).

`align-smoke` asserts the real invariant — the ground anchor lands on the plot centre
— replacing an earlier check that compared the draw anchor against the same function
that produced it (a tautology).

## Amendment (2026-07-20) — Phase C adjacency shipped

`js/systems/building/adjacency.js` is pure over the placement rects: two footprints
are neighbours when the gap on both axes is ≤ 2 cells (one tile — a connector road
may pass between). Same-category neighbours (production/military/population) grant
+5% each capped at +20%; five curated pairs (Fed Quarters, Irrigation, Timber Yard,
Ore Depot, Muster Ground) grant +6–8% capped at +15%; total capped at +30%.

Production instances spend their bonus as output (`buildingEconomy.computeActiveRates`
via `_economyCtx.getAdjacencyBonus`); military instances pool theirs into a
training-time cut (mean bonus, capped 25%) applied at UnitManager's single
`_trainMultiplier()`. Recomputed on build-complete, move, and load — **never
serialized**; a legacy load emits `building:adjacencyDiscovered` once so a base the
packer clustered on migration announces its bonus instead of changing silently.

**Open balance risk (Steve, 2026-07-20 — treated as level design, not code):**
adjacency creates pressure to re-optimise layouts, which interacts with rubble
pacing — more cleared space means more clustering freedom. Tune the two together.

## Consequences

- `cityBlueprint.js` retires with the plot model; district tints stay as backdrop
  until Phase B ground work.
- Blueprint-capacity gotcha (`_ensurePlacements`, CLAUDE.md) disappears with it;
  replaced by "any free cell rect" placement.
- Every phase must land green (`npm test` + smokes) and Phase A must retest the
  tutorial end-to-end (spotlight contract changes).
- Rubble sector ids join the ids-are-save-keys contract from day one.
