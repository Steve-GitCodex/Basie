# 0002 — Data/runtime split: configs immutable, mutable state in manager save state

**Date:** back-filled 2026-07-15 (established with city placements, extended by world map).

## Context

Game configs (`js/entities/data/`) need to evolve between versions without corrupting
player saves. Early designs mixed positions/timers into data objects.

## Decision

Data files are immutable declarative configs (copy before mutating). All mutable/runtime
state lives in manager save state: building positions in `BuildingManager._placements`,
POI/region runtime (node stores, respawn timers, owners, `looted`, `_discovered`,
`_timedBuffs`) in `WorldMapManager`. Save state is seeded and **reconciled** against data
on load (`_ensurePlacements()`, `worldState.js`) so saves survive map/blueprint edits.

## Consequences

- Every new world save field needs a seed + reconcile entry in `worldState.js` or loads
  silently drop it.
- POI/region/building/monster **ids are save keys** — rename display names only.
- Derived/transient state (deploy-lock, boss open-state, fog masks, generated terrain) is
  never serialized; recompute on load.
