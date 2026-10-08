# Building levels: what depends on them (codebase map)

Research input for raising most buildings' max level from ≤10 to 20–30. Written 2026-10-07 from code only;
companion to `building-levels.md` (genre + proposal). Not a design lock.

## Key facts

- All 20 buildings live in `BUILDINGS_CONFIG` (`js/entities/data/buildings.js:6-453`). `QUEUE_CONFIG` is at :460 and
  `HQ_UNLOCK_TABLE` at :481-536. There is no headquarters data file; `js/systems/building/headquarters.js` is pure
  logic.
- **Cost** is exponential: `floor(base × mult^effectiveLevel)` (`buildingRules.js:19`).
  - **Build time is linear:** `buildTime × level` (`BuildingManager.js:404,561`).
  - With multipliers of 1.6–2.5, level 30 costs 1e9–1e11. HQ L30 takes only 1h, and the whole HQ1–30 run about
    15.5h.
  - `BuildingInfoPanel.js:44-48` duplicates the cost formula.
- **No "building level ≤ HQ level" rule exists.** Only `requires`, slot conditions and per-level `levelRequirements`
  gate progress (`BuildingManager.js:273-350`).
- **Max levels today:**
  - 10: townhall, farm, mine, lumbermill, quarry, storehouse, house, archeryrange, heroquarters, infantryhall,
    cavalrystable, siegeworkshop.
  - 8: well, cafeteria, bank, barracks, workshop, magictower.
  - 6: rallypoint.
  - 3: construction_hall.

## Per-level tables and their lengths

- `townhall.storageCap` and `storehouse.storageCap`: 6 arrays each, length 11. Cafeteria food/water arrays: length 9.
- `barracks.levelStats` (8, slot capacity 200–4000) and `squadSlots` (4).
- `rallypoint.levelStats` (6).
- `trainingSlots` (10) on the 4 trainer buildings.
- `house.levelRequirements` (cafeteria 2–7) and `bank.levelRequirements` (population up to 450).
- `HQ_UNLOCK_TABLE` keys 2–10. Content stops at HQ 8; the cumulative benefits plateau at HQ 10.
- `UNIT_TIER_REQUIREMENTS` (`units.js:85-134`): tiers 1–10, `minBuildingLevel` up to 8, mastery techs up to 7.
  - It overlaps the `trainingSlots` `maxTrainableTier = level`; the stricter of the two wins.
- Tech `levelRequirements` go up to workshop 8 and halls 9. `QUEUE_CONFIG` uses workshop 2/4/6 and construction_hall
  1/2/3.

## Silent failures above the current tables (P0)

1. **Storage goes to 0.** `perLevel[inst.level] ?? 0` (`buildingEconomy.js:32-34,54-55`, `CafeteriaService.js:43-44`,
   `BuildingCards.js:234,255,422`).
2. **Rally Point above L6** returns `null` stats, so there are 0 march slots (`MarchManager.js:36`).
3. **Barracks and trainers plateau silently** via `Math.min(level-1, len-1)`:
   - `UnitManager.js:145,186,313,436,490,664,742`;
   - `MilitaryUI.js:61`;
   - `BarracksUI.js:420`.
4. **HQ benefits and unlocks stop at HQ 10** (`headquarters.js:47-57`).
5. **Population is clamped to 1000** (`buildingEconomy.js:69`, `ResourceManager.js:322`).
   `CafeteriaService.js:266,286` hard-codes house population at `level × 10`.

## Other couplings

- **Hero cap** is `heroquarters × 10` (`heroes.js:155`, `heroProgression.js:23-25`). **Hero slots** are
  `heroquarters × 5` (`heroAssignment.js:137`).
- **Campaign** chapters 3–10 require townhall 3–10 plus heroquarters 3–5 (`combat.js:182-193`, duplicated on monsters).
- **Trading Post** crates are linear in HQ (`crateRoll.js:11,15`).
- **Production** is linear per level (`ResourceManager.js:163-168`). The cafeteria draw per resident grows with level
  (`CafeteriaService.js:21-22`).
- **Sectors:** `RING_HQ_GATE` covers HQ 2 and 4 only (`citySectors.js:35`).
- **Quests and achievements** count `building:completed`, so more levels complete them faster
  (`progression.js:44,108,318`).
- **Art:** grit maps have 3 level buckets and townhall has 4 AI stages (`cityAssets.js:21-73`). Every level past the
  last bucket looks the same. No band mapping exists for 20–30 levels.
- **UI:** `BuildingInfoPanel.js:43-52` renders one row per level, with no paging. Many `effectLabel`s and the
  `navigation.js` labels contain fixed threshold text.

## Safe as-is

- The `maxLevel` checks (`canUpgrade`, `build`, `isMaxLevel`) and the dev level switcher.
- Save/load (no clamp on load).
- Tab unlocks (all ≤ HQ 5).
- World region gates (ownership-based).
- Placement and adjacency.
- Canvas level badges.

## Tests pinning level-10 behaviour

- `gameData.test.js:83-89`: only townhall `storageCap.length === maxLevel + 1` is checked. No other per-level table is
  validated.
- `cityAssets.test.js:23-33,50-54`: pins the art bucket clamp at L10.
- `heroProgression.test.js:55-72`: pins the HQ × 10 hero cap.

## What must change (prioritised)

1. **P0, before any `maxLevel` bump:** extend or replace every per-level table, or derive them from formulas, and add a
   length-validation test for all of them. Fix the Rally Point null, the plateaus, the HQ table and the population
   clamp.
2. **P1, balance:**
   - Cost and time curves.
   - A building-level ≤ HQ rule.
   - Production curves.
   - Re-spread the per-level requirements and tech gates, the unit tier gates, the hero cap and slots, and the
     campaign gates.
   - Re-fit the power and level draft (level cap, building XP, monster targets).
3. **P2, content:**
   - Art level bands and extended sprite maps.
   - More rubble rings.
   - Retuned building-count quests.
4. **P3, UI:**
   - Paginate the info panel.
   - Generate threshold text from data.
   - Update the pinned tests.
