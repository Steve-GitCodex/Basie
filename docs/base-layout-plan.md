# Base Layout Rework — Free Placement (proposal, 2026-07-19)

**Status: APPROVED by Steve (2026-07-19) — ADR 0022.** Bundles the already-planned
placement/build-menu/tutorial rework (roadmap, cross-cutting). Design input from a
game-designer consult (2026-07-19); implementation phased for Sonnet/Opus sessions.

## Goal

Replace the fixed hand-designed plot blueprint (22×16 tiles, ~60 one-tile plots,
zone-restricted auto-assignment) with player-authored layout: place and move any
building anywhere valid on a finer grid, with the base physically growing over time.
Kills the "tight grid" feel and the adjacent-plot sprite collisions; the base becomes
the player's own.

## Decisions (proposed)

1. **Grid: half-tile cells.** Subdivide the current 128×96 iso tile 2×2 → 64×48 px
   cells (projection unchanged — ADR 0020/0021 iso stays; everything is defined in
   cells). Occupancy is a plain cell→instanceId map.
2. **Footprints: three buckets.** Small 2×2 (1 tile: well, storehouse, bank, comms
   tower…), Medium 3×3 (1.5t: houses, farms, barracks, workshop…), Large 4×4 (2t: HQ,
   heroquarters, infantry hall, cavalry stable). Matches the authored sprite fits
   (0.9–1.6t) — **no art rework**. Footprint lives in `BUILDINGS_CONFIG` per type.
   Buildings may touch (flush packing, Last Shelter-style); collision is rect-only.
3. **Zones: hard restrictions dropped, replaced by adjacency bonuses** (Phase C):
   same-category adjacency and a few curated pairs (houses↔cafeteria, military
   cluster → training speed) grant small % bonuses via neighbor scan on
   place/move. One hard rule remains: **HQ is fixed and immovable** (camera +
   tutorial anchor).
4. **Roads: decorative, auto-generated, derived — never saved.** *(Amended
   2026-07-19 after Phase B play, Steve's design.)* Two-level hierarchy replacing
   free L-paths: a **fixed skeleton** — ring road around the HQ + four arterials
   (N/E/S/W) from the ring toward the map edge — that never moves and is
   **unbuildable** (placement rejects skeleton cells); arterials render only through
   the core + cleared sectors and extend as rubble clears (eventually into the edge
   forest/desert). **Connector roads** (visually narrower) run from each building's
   door to the nearest skeleton cell, pathing **around** building footprints — a
   road must never cross a footprint (the Phase B L-paths did; that was a bug).
   Skeleton is deterministic from the grid → still derived, never serialized.
   Walkers follow the full graph. Player-drawn roads stay out of scope.
5. **Expansion: rubble sectors.** Cleared ~14×14-cell core around the HQ at start;
   8–12 surrounding rubble sectors (~8×10 cells) cleared with resources + timer,
   gated by HQ level, cost ×2.5 per ring. Post-apoc fiction alignment; visible
   progression; late-game resource sink. **Sector ids are new save keys — mint
   stable ids from day one.**
6. **Move UX: always-free.** TileTooltip → Move → drag ghost with green/red cell
   validity → confirm/cancel. No move cost, no edit-mode toggle, no rotation
   (single authored sprite angle), no undo beyond ghost-cancel.
7. **Placements become `instanceId → {cx, cy}`** (top-left cell). Instance ids are
   untouched (save keys). Plot ids die — `BuildingManager.deserialize` already drops
   unknown plot ids, so old saves fall through to the auto-layout packer.
8. **Auto-layout packer (migration + new games):** deterministic spiral from the HQ,
   instances sorted by footprint then category, with directional category biases
   (production E, residential S, military W, civic N) so migrated bases land with
   adjacency bonuses already active. Pure function over the occupancy map,
   unit-tested. Used for legacy saves, new games, and tutorial builds until the
   player first moves something.

## Tutorial contract impact (flagged, rides Phase A)

`#city-proxy-layer` spotlight divs must track **instance cell rects** instead of
plot tiles; `.base-tile[data-building-id]` selector semantics keep working because
they're keyed by building id, not plot id. Retest the full tutorial (CLAUDE.md
gotcha) at the end of Phase A.

## Phasing (each phase ships green: npm test + smokes + tutorial check)

- **A — placement core:** cell grid, occupancy map, footprints in config, packer,
  place/move UX, blueprint retired (ground rendering keeps district tints as plain
  backdrop until B). Feels near-identical, but every building fits its footprint.
- **B — base life:** auto-roads + rubble expansion sectors (+ the deferred city
  ground/terrain pass folds in here — ground is per-cell now).
- **C — layout as gameplay:** adjacency bonuses + migration "bonus discovered"
  toast; balance pass.

## Explicitly out of scope (solo-dev traps)

Player-drawn roads; rotation; terrain obstacles inside sectors; wall/gate defense;
stacking/overlap rules beyond rects; separate edit-mode UI; road pathfinding;
per-cell terrain types; undo history; zoned placement restrictions.

## Edge forest + exploration seed (Steve, 2026-07-19, post-Phase-B)

Keep the camera clamp, but the player should never see the map edge: enlarge the
decorative surround and fill it with tree props — dense forest near the clamp edge,
sparse dead trees inside rubble sectors. Assets exist (`assets/tiles/props/grit/
tree_*.png` — pines, broadleaf, dead ×3). **Future (backlog, not now):** exploration
— widen the clamp slightly and stage ruins/animated finds in the forest/desert
beyond the base, unlocked as arterial roads extend outward.

## Open questions for Steve

1. Sign off on dropping hard zone restrictions (bonuses instead)?
2. Rubble-sector count/pacing feel right for the current economy, or should Phase B
   ship with generous/cheap clears first and tighten later?
3. Does Phase A ship alone (layout freedom, same visuals), or wait and ship A+B
   together for one big visible jump?
