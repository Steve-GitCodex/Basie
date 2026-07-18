# Data Consolidation Plan — get hardcoded tunables into the data layer

> Status: **planned, not started** (2026-07-18). Audit-backed; line numbers below are
> approximate as of that date — re-grep before editing. Execute one phase per session,
> each behind `npm test`. Record an ADR (next number) when Phase 1 lands the convention.

## Problem

The declarative *content* layer (`js/entities/data/`, barreled by `GAME_DATA.js`) is
healthy: buildings, units, monsters, heroes, tech, POIs, quests all live there. What
leaks out is **numbers and text that will be re-tuned**: formula coefficients, rates,
timers, prices, starting grants, XP curves, and player-facing string tables embedded as
literals inside managers. Balancing the game today means hunting magic numbers across
~10 system files, and six constants are already duplicated with room to diverge.

## Target convention (the rule going forward)

- **Data files own every number a designer might change; managers own only logic.**
  A manager may keep a constant only if it is *structural* (array caps, log lengths)
  or an *engine* concern (tick rate, autosave interval).
- Tuning blocks are named exports from the matching `js/entities/data/` file, imported
  through `GAME_DATA.js` like everything else. Copy before mutating (ADR 0002).
- New code: never introduce a gameplay literal in a manager — add it to the domain's
  data file first, even if it's one number.

## Phase order (by tuning risk — highest churn first)

### Phase 1 — Marches: create `js/entities/data/marches.js` *(no home exists today)*
Move from `js/systems/march/`:
- `marchMath.js` — `BASE_SPEED_PX` (265), `CARRY_PER_UNIT` (25), `MIN/MAX_DWELL_MS`,
  `CATEGORY_SPEED` table (infantry/ranged 1.0, cavalry 1.4, siege 0.6).
- `marchResolver.js` — `ATTACK_DWELL_MS` (1500).
- `marchRules.js` — `MARCH_TYPE_FOR` (POI type → march type); consider co-locating with
  POI defs in `worldMap.js` instead — decide at implementation, note in the ADR.

Tests: `tests/unit/marchMath|marchResolver|marchRules.test.js` already exercise these
paths — they are the change gate. Add one assertion that the new exports exist with the
current values (locks the migration to a pure move). This also positions the roadmap's
`BASE_SPEED_PX` retune (B1 debt) as a one-line data edit.

### Phase 2 — Combat: add a `COMBAT_MODEL` tuning block to `data/combat.js`
`CombatManager.js` holds ~15 formula coefficients: defense mitigation `* 0.5`, per-round
damage `* 0.3`, ability defaults (heal 0.2 / aoe 0.3 / revive 0.3), loss floors
(victory `0.02`, defeat `0.5 + (1-rate)*0.5`), reduced-reward `* 0.1`, battle-XP `* 0.5`
+ fallback `100`, survival escalation `1.05` / wave scaling `0.02` / weak threshold `30`,
unit-stat fallback `{attack:10, defense:5, hp:100}`. Move all into one structured
`COMBAT_MODEL` export. Combat has **no unit tests yet** (roadmap gap) — write
characterization tests for `_simulateBattle` outcomes *before* the move, then migrate.
Fix the `milMult < 1` debuff trap (roadmap Hardening) in the same area while there.

### Phase 3 — Economy: extend `data/economy.js`
- `MarketManager.js` — the whole `TRADES` table (pairs, rates, labels, flavor, icons) +
  `INFLATION_RATE` (0.02) + `MAX_INFLATION` (2.0) → `MARKET_TRADES` / `MARKET_MODEL`.
- `ResourceManager.js` — starting grants (wood 500, stone 300, iron 50, food 50,
  water 50, diamond 20, money 500) + `SAFETY_BUFFER` (1.1) → `STARTING_STATE`.
- Population cluster → one `POPULATION` block: `CafeteriaService.js` (restock 30,
  reserve 50, reminder 90, growth 0.08, per-capita 0.02 + 0.008/lvl, starvation 0.02×2)
  and `buildingEconomy.js` (pop ceiling 1000, capacity/level 10, cafeteria cap 200).

### Phase 4 — Progression & heroes: extend `data/progression.js` / `data/heroes.js`
- `UserManager.js` — player XP curve (`500 × 1.4^n`) → `progression.js`.
- `HeroManager.js` — squad cap 4, production bonus 0.02/lvl, default building bonus
  0.15, hero XP curve (`500 × 1.3^n`), aura 0.05/lvl + 0.8/0.5 coefficients,
  heroquarters slots ×5, default buff duration 1h → `heroes.js`.
- **Deliberate decision point:** the two XP curves share base 500 but diverge (1.4 vs
  1.3). Keep both, but define them side by side in data so the divergence is visible
  and intentional.
- `UnitManager.js` — default `trainTime` 10 and upgrade-time ratio 0.35 (each repeated
  ~4×), queue cap 3, VIP cap 0.80 → `units.js` (single definition each).

### Phase 5 — Dedupe (folds into phases above; verify none survive)
1. Building-hero production mult `1 + level*0.05` — `buildingEconomy.js` + `HeroManager.js`.
2. Cafeteria cap fallback `200` — `CafeteriaService.js` + `buildingEconomy.js`.
3. House occupancy `level*10` — `CafeteriaService.js` ×2 + `buildingEconomy.js`.
4. Starvation shrink `0.02` — `CafeteriaService.js` ×2.
5. `trainTime 10` / ratio `0.35` — `UnitManager.js` ×4.
6. XP base 500 — see Phase 4 decision.

### Phase 6 — String tables (low priority; do when touching those systems)
Data by nature, near-zero balance churn — relocate opportunistically, or as prep if
i18n ever becomes real: `TutorialManager.TUTORIAL_STEPS` (**tutorial contract gotcha:
selectors inside steps stay load-bearing — move text, retest tutorial**), `MailManager`
flavor mail, `main.js` `MODES`/`DIFFS` label tables, `InventoryManager`
`RESOURCE_BUNDLE_TIERS` (ids must keep matching `economy.js` INVENTORY_ITEMS — add a
unit test asserting the id join).

## Explicitly out of scope (leave in place)

- **Engine constants:** `GameEngine` tick 50ms / offline caps, `SaveManager` 30s
  autosave, `EventManager` 60s check, `NotificationManager` toast timings.
- **Rendering/layout constants:** zoom levels, pixel sizes, colors across `js/ui/`
  (`gridLayer` tunables are deliberately top-of-file per the B2 handoff).
- **Already-clean systems:** `WorldMapManager` + world/ helpers (POI-config-driven),
  gacha/awakening, `buildingRules`/HQ tables — no action.

## Per-phase working recipe

1. `npm test` green before starting.
2. Write/extend characterization tests for the manager's current outputs (combat
   especially — it has none).
3. Create the data export with the exact current values; manager imports it; delete
   the literals. Pure move — **zero behavior change** is the acceptance bar.
4. `npm test` + both browser smokes green; `check-comments` clean.
5. Update `40-active.md`; first phase also lands the convention ADR.

## Structure verdict (from the same audit)

The three-tier architecture itself is sound and doesn't need reorganizing: the
decomposition precedents (`systems/world|march|building`, `ui/city|world`) are working,
`GAME_DATA.js` barreling is the right import surface, and the worst offenders are
concentrated in exactly the managers the systems bug audit already flags. This plan is
about **where numbers live**, not moving modules.
