# Economy & Game Data (shipped design)

## Data layer

All game configs (buildings, units, heroes, combat, tech, economy, progression, story,
events, navigation, city blueprint, world map) are **immutable declarative objects** in
`js/entities/data/`, aggregated by `js/entities/GAME_DATA.js`. Copy before mutating;
never modify in place. Runtime/mutable state always lives in manager save state
(ADR 0002).

## Resources

All resource costs and payloads use the keys `{ wood, stone, iron, food, water, money }`.
`ResourceManager` owns production rates, storage caps, and transactions (`add()` is the
single crediting entry point — sandbox-aware; march loot and gather payloads go through
it on march return).

## Buff pipeline

Territory/expedition buffs aggregate in `WorldMapManager.activeBuffs()` — see
`world-map.md` § Buffs for what is **actually wired** (logistic, military and
economic buffs all apply; economic feeds base production, though the gather-march bonus is
still clamped away by load capacity; "in-region" locality was never implemented for any
flavor). VIP and hero/tech multipliers apply in their owning managers and do work.

Production is one product of layers (`js/systems/resource/productionLayers.js`): tech, world, HQ, item
boost, VIP, difficulty, event. `ResourceManager` and the Buffs panel Overview both read it, so the displayed
total is the real rate (ADR 0038, `buffs.md`). Timed item boosts are owned by `BuffManager`.

## Population / cafeteria

Cafeteria feeding (auto-restock + drain → shortfall → population) ticks inside
`BuildingManager.update()`, including an offline catch-up window that runs **after**
queue completions so upgrades are already applied. Restock is exposed on the tile
tooltip.

## Balance tuning

Tuning values live in the data files (per-building/unit/POI), not inline in managers.
Open balance questions are tracked in `docs/30-roadmap.md` (Phase 2 hardening list).
