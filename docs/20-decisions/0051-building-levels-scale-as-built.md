# 0051 — Building levels to 30: as-built rulings and derived values

Date: 2026-10-09 · Status: built (uncommitted) · Extends ADR 0044 · Design page: `docs/10-design/building-levels.md` ·
Plan: `docs/superpowers/plans/2026-10-07-building-levels-scale.md`

## Context

ADR 0044 and `building-levels.md` fix the shape: 30 levels, a shared curve, the HQ cap, the HQ chain and the remap
`M = [1,2,4,6,9,12,15,18,22,26]`. Building it needed values that the design and research do not give, and it exposed
places where the plan text and the design disagreed. This ADR records how they were resolved.

## Decision

1. **HQ chain at 30:** `hqChain()[30] = { workshop: 29, archeryrange: 29 }`. The rotation in the design (Barracks at
   HQ 10, then Infantry Hall, Archery Range, Cavalry Stable, Siege Workshop, Storehouse) lands on Archery Range at 30. The
   plan's `storehouse` was an arithmetic slip.
2. **T3 opens at HQ 4 in practice.** `TIER_MIN_HALL_LEVEL = [1,2,4,9,11,13,15,18,22,26]` as planned. Hall level 4 needs
   HQ 4 under the cap, so the design's "T1–T3 at HQ 2" means T1–T2 at HQ 2 and T3 at HQ 4. Cavalry and Siege tiers also
   wait for their mastery tech (HQ 12 / 15), as they did before the remap.
3. **House → Cafeteria ladder goes through M.** The old cafeteria levels 2/3/5/7 become 2/4/9/15: House L4–8 need
   Cafeteria 2, L9–14 need 4, L15–20 need 9.
4. **Cafeteria and House `requires` stay at HQ 2 / HQ 1**, earlier than the design table's HQ 4 unlock. The HQ unlock
   table is display-only for these two, and raising the gates risks the tutorial and early population.
5. **Passive hero XP offset stays `levelCap − 20`.** With the hero cap at Hero Quarters × 4, passive XP now starts at
   Hero Quarters 6 (it started at 3). The owner may retune the constant.
6. **Derived values (no number in the research):**
   - Base-cost trims keep each building's own mix, scaled to 800 total: Siege Workshop 380/305/115, Hero Quarters
     400/320/80, Magic Tower 370/307/123.
   - Storehouse money cap = the HQ era money table × 1.7 (the old L10 ratio).
   - Cafeteria food/water L9–20 grow geometrically from 62,000 to 186,000 (a 15-minute reserve for 1,200 population).
   - Bank population ladder is 10/20/50/100/180/260/300/340/380 for L2–L10, then grows geometrically to 1,000 at L20, rounded to 10. The old L7–L10 values (300/450/480/510) exceeded the housing the player can hold at the HQ where those bank levels open (HQ 10/11/13/14: 280/320/360/400); a data guard test now holds every population gate to that capacity. Cost if wrong: retuning five numbers in `BANK_POPULATION_BASE`, no migration.
   - `POPULATION_MAX = 6 houses × 20 × 10 = 1,200`.
   - `requires` not listed in the research map through M: Bank HQ 2, Workshop HQ 9.
   - HQ benefits interpolate linearly between `ERA_HQ` anchors. The HQ 30 capstone scales every benefit by
     `0.67 / HQ_BENEFITS_BY_ERA.at(-1).attackBonus`.
7. **Extension guards fail loudly.** A unit tier without a `TIER_MIN_HALL_LEVEL` entry throws at load, and so does an
   `HQ_BENEFITS_BY_ERA` whose length differs from `ERA_HQ`. The curve functions take the curve and `HQ_MAX` as
   overridable defaults, so tests can prove a post-30 band without touching game data.

8. **Implementation and process rulings (from the plan run):**
   - The `?dev` boot break (HQ 3 now needs Farm 2) and the UI snapshot that lacked the cap gate were fixed inside Task 1:
     `devSession` raises prerequisites from data (`levelRequirements` + `minHqForLevel`), with no bypass. Cost if wrong:
     none (both were regressions that Task 1 caused).
   - The BuildingCards production preview uses `prodFactor`, so the displayed rate matches the produced rate. Cost if
     wrong: the displayed and produced rates diverge again.
   - Smoke regressions were judged against the pre-plan tree `5d7dc8f` (via `git archive`), not HEAD, because the
     baseline is the uncommitted tree. Cost if wrong: if the pre-plan tree isn't the true baseline, a real regression
     could be dismissed as pre-existing (heroes, buffs, inventory, hud, `dev-anchor-nudger`).
   - Literal max levels (`TRAINING_SLOTS(30)` and similar) were hoisted into shared constants (`HALL_MAX_LEVEL`,
     `HOUSE_MAX_LEVEL`, …), and the duplicated `eraOf` was folded into `eraNumber` in `data/buildingCurve.js`. These are
     the Built-to-extend and lint rules. Cost if wrong: extra churn in the Task 2 diff, and the `eraOf` fold would need
     undoing.

## Consequences

- Covered by `tests/unit/{hqChain,headquarters,buildingTables,gameData,extensibility}.test.js` and
  `tests/browser/progression-smoke.mjs` (HQ 30 and HQ 9 checkpoints, HQ 10 → 11 chain gate).
- **Money cap audit (HQ ≤ 10 caps are now much lower than before):** nothing money-priced became unaffordable. Tech,
  unit and building money costs all sit under the HQ-only money cap at the HQ where they open. Trader prices are already
  split to fit caps. The 8 h shop speed-ups (8,000 / 18,000) exceed the bare HQ 1 cap (5,000), as they did before the
  plan. A Storehouse covers them. No data changed.
- The design table for Cafeteria/House (HQ 4) and the data (HQ 2 / 1) still differ, on purpose (point 4).
