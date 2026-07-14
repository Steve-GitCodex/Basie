# World Map & Marches (shipped design)

Single-player top-down world map (`#view-world`) with timed marches. This page describes
what **is** — MVP + fast-follows are shipped. PvP/co-op is reserved for the future Arena.

## Model

- **Hybrid map:** a bounded top-down coordinate field (real `x,y` → distance-based travel)
  partitioned into **9 tessellating rect regions** (warp-field organic borders, ink seams),
  dotted with curated POIs. Data: `js/entities/data/worldMap.js` (immutable, aggregated
  into `GAME_DATA`).
- **An army is a UnitManager squad.** A march is `{ type, squadId, targetPoiId, departAt,
  arriveAt, phase: outbound|acting|returning, returnAt, payload }`; travel time =
  distance ÷ army speed (slowest unit × hero/tech/logistic multipliers). March slots come
  from the **Rally Point** building, which also gates the world tab.
- **Region unlock chain:** each tile `requires` an owned neighbour; the player expands from
  the bottom-left home tile toward the center **command-centre ruin** (locked until all 4
  orthogonal neighbours are owned + a high-level fight). Ownership uses `startOwner` +
  free owner-strings (see ADR 0005).
- Attack marches use `CombatManager.resolveMarchBattle()` — **not** `attack()`; march loot
  is carried home and credited on return, never mailed. The legacy menu campaign is
  untouched and runs in parallel until the Arena replaces it.

## POI taxonomy

| Type | March | Lifecycle | Yields |
|---|---|---|---|
| `resource_node` | gather | depletable + regen | resources (node stores in save state) |
| `camp` | attack | respawning (`respawnMs`) | loot, repeatable |
| `stronghold` | attack | one-time flip | **region capture** + signature buff |
| `ruin` | scout → expedition (`expeditionMs` dwell, optional `garrison`) | one-time (`looted`) | reward `{kind:'buff'\|'item'\|'resource'}`, applied on **return** by `MarchManager._creditMarch` |
| `outpost` (subtypes outpost/shrine/watchtower) | scout → capture | persistent (`_outpostOwner`) | standing `boon`; watchtower `revealRadius` lifts fog |
| `world_boss` | attack | **windowed** (`window:{everyMs,openMs}`, derived from clock — ADR 0006) | weighted `lootTable` (`worldBoss.rollLoot`), one kill per window, no capture |

## Buffs — one source of truth (with known gaps)

`WorldMapManager.activeBuffs()` merges region signature buffs (economic / military /
logistic), held-outpost boons, and timed buffs from ruin expeditions (`_timedBuffs`,
expiring). Consumers as **actually wired** (verified 2026-07-15):

- **logistic** → `MarchManager` via `logisticSpeedMult` (march speed). Works.
- **military** → `resolveMarchBattle` via `militaryMult` (attack mult; values < 1 are
  silently dropped by the `milMult > 1` guard in `CombatManager`). Works for buffs only.
- **economic** → gather marches only, and effectively **dead**: `marchResolver._gather`
  clamps `granted*(1+bonus)` back to `loadCap`, which `takeFromNode` already filled — the
  bonus survives only when the node held less than the squad could carry.
  **`ResourceManager` has no buff wiring at all** — the spec'd "economic buff boosts
  in-region production rates" was never implemented (no listener on
  `world:regionCaptured`/`world:buffsChanged` outside the world UI).
- **Region locality was never implemented** — the design says buffs apply "in-region"
  (in-region nodes/battles/march legs); all three flavors actually apply globally.

Fixing/re-speccing these is on the roadmap (Hardening → audit findings).

## Fog of war

`WorldMapManager.isDiscovered(poiId)`: POIs in unlocked regions are always visible; POIs
in locked regions render as a dimmed `?` until revealed into `_discovered` (Set,
serialized) by a captured watchtower (`revealArea`) or region capture.

## Save state (critical)

All POI/region runtime state lives in **`WorldMapManager` save state**, never in
`worldMap.js` (ADR 0002): node stores, respawn timers, region owners, ruin `looted`,
`_outpostOwner`, boss `defeatedWindowStart`, `_discovered`, `_timedBuffs`. Seeding and
reconcile split across two places (verified): `js/systems/world/worldState.js` handles
`poiState`/`regionOwner`/`outpostOwner`; `WorldMapManager.deserialize()` inline-filters
`discovered` (drops unknown ids) and `timedBuffs` (drops expired). **Every new save
field needs coverage in one of those two spots** or loads silently drop it. In-flight
**marches are NOT reconciled** against map edits — see audit finding on removed-POI
crash. Transient (never serialized): squad
deploy-lock (`UnitManager._deployedSquads`, re-asserted by `MarchManager.deserialize()`),
boss open-state (`_bossOpen`, recomputed from the clock). POI/region **ids are save keys**
— rename display names only, never ids.

## Module decomposition

```
js/systems/world/  WorldMapManager (orchestrator) · worldState (seed/reconcile)
                   · regionBuffs (pure) · nodeEconomy (pure) · worldBoss (pure windows/loot)
js/systems/march/  MarchManager (orchestrator) · marchMath (pure) · marchRules (validation)
                   · marchResolver (gather|attack|scout strategy map — never an inline switch)
js/ui/world/       WorldRenderer (rAF loop, reads synced snapshot) · WorldCamera
                   · worldProjection (pure + hit-test) · PoiDetailPanel · MarchDispatchSheet · MarchPanel
js/ui/controllers/ WorldMapUI (thin presenter; owns renderer, routes events)
```

Managers orchestrate; pure math lives in the sibling helpers. Key events:
`march:dispatched/arrived/completed/failed`, `world:poiChanged/regionCaptured/
outpostCaptured/bossWindow`.

## CSS

`css/components/world-view.css` (`.world-*`) only. The legacy campaign path uses
`worldmap.css` (`.world-map-*`) — never cross the prefixes.
