# Building levels (target design; foundation built, scale not built)

Buildings go to **30 levels (HQ 30)**, with one shared cost/time curve, a cap tied to HQ, and an HQ prerequisite chain.
HQ 1–10 keeps today's cost and time. Decided 2026-10-07 (ADR 0044).

- Proposal and numbers: `docs/research/building-levels.md` §3.
- Codebase impact: `docs/research/building-levels-codebase.md`.
- **Foundation built (2026-10-08):** `js/systems/building/buildingCurve.js` (`costFactor`/`timeFactor`/`prodFactor`,
  `levelCap`, `eraAt`, `upgradeCost`, `upgradeTime`; constants in `js/entities/data/buildingCurve.js`), `levelTable.js`
  (per-level lookups throw on a gap instead of returning 0/null) + `trainingSlots.js`, and per-level table validation in
  `tests/unit/gameData.test.js`. `costMultiplier` is gone; every building uses the shared curve. `maxLevel`s are unchanged.

## Max levels

| Max | Buildings |
|---|---|
| 30 | HQ (townhall), Barracks, Infantry Hall, Archery Range, Cavalry Stable, Siege Workshop, Workshop, Storehouse, Farm, Lumber Mill, Quarry, Mine |
| 25 | Hero Quarters |
| 20 | House, Well, Cafeteria, Bank, Magic Tower (Comms Tower) |
| 10 | Rally Point |
| 3 | Construction Hall (exempt from the cap rule) |

Nothing goes past 30 for now. A post-30 band and chapters 11–12 are parked in the backlog.

## Rules

- **Cap:** `levelCap(b, hq) = min(b.maxLevel, ceil(b.maxLevel × hq / 30))`.
  - For the 30-level buildings this is exactly "≤ HQ".
  - Construction Hall has `capRule: 'none'`.
  - It is checked in `canUpgrade` and `getMissingRequirements` ("Requires HQ Lv.N").
- **HQ chain:**

  | HQ | Requires |
  |---|---|
  | 3 | Farm 2 |
  | 4 | Barracks 3 |
  | 5 | Infantry Hall 4 |
  | 6 | Storehouse 5 |
  | 7 | Barracks 6 |
  | 8 | Archery Range 7 |
  | 9 | Barracks 8 |
  | 10–30 | **Workshop N−1** + a rotating partner at N−1 |

  The rotating partner cycles Barracks → Infantry Hall → Archery Range → Cavalry Stable → Siege Workshop →
  Storehouse, starting with Barracks at HQ 10.
- **Cost:** `cost = floor(baseCost × costFactor(L))`. `costFactor(L)` is the product of the per-level factors from
  level 2 to L: 1.65 for levels ≤10, 1.45 for 11–20 and 1.30 for 21–30. This replaces the per-building
  `costMultiplier`. Base costs are trimmed to ≤ the HQ's (800) for the Siege Workshop, Hero Quarters and Magic Tower.
- **Time:** `buildTime × timeFactor(L)`:
  - levels ≤10: L;
  - levels 11–20: `10 × 1.35^(L−10)`;
  - levels 21–30: `10 × 1.35^10 × 1.20^(L−20)`.
- **Production:** per-level effects × `prodFactor(L)`, which is L up to level 10 and `10 × 1.09^(L−10)` above it.
  Trading Post crates use `resourceBase × prodFactor(hq)`.
- **Storage:** resource arrays extended to 31 entries. From today's L10 value they grow ×1.40 per level for L11–20 and
  ×1.25 per level for L21–30. The money cap follows the era: 5k (HQ1) … 3.6M (HQ26), then ×1.25 per level to 8.8M at
  HQ30.
- **One module:** `js/systems/building/buildingCurve.js` (`costFactor`, `timeFactor`, `prodFactor`, `levelCap`,
  `eraAt`) replaces the three copies of the formula in `BuildingManager`, `BuildingInfoPanel` and the
  `ResourceManager` tutorial estimate.
- **Every per-level table is length-validated** in `gameData.test.js` against `maxLevel`. Lookups never silently fall
  back to 0 or null.

## Content remap

Old HQ gate n maps to new HQ `M(n) = [1, 2, 4, 6, 9, 12, 15, 18, 22, 26]`. The same map applies to building-level gates
in tech and units. `eraAt(L)` is the largest n with `M(n) ≤ L`.

| System | New gates |
|---|---|
| Building unlocks | Archery Range, Infantry Hall and Bank at HQ 2. Cafeteria and House 4. Hero Quarters and Cavalry 6. Workshop and Siege 9. Magic Tower 18. |
| Troop tiers T1–T10 | HQ 2, 2, 2 (halls Lv 1/2/4), then 9, 11, 13, 15, 18, 22, 26. `trainingSlots.maxTrainableTier` reads `UNIT_TIER_REQUIREMENTS` instead of duplicating it. |
| Campaign chapters 3–10 | HQ 4, 6, 9, 12, 15, 18, 22, 26. Hero Quarters gates 5, 8, 10, 13. |
| Hero level cap | Hero Quarters × 4 (max 100). Hero slots are re-derived. |
| Squad slots | Barracks 4, 9, 15 |
| Barracks `slotCapacity` | 30 entries, 200 → 8,000 (table in research §3.4) |
| Marches | 2, 3, 4, 5 at Rally Point 1, 3, 6, 10 (HQ 4, 7, 16, 28) |
| Training concurrency | Hall 1, 4, 12, 22. Batch size `25 × L`. |
| Research slots | Workshop 2, 6, 12 |
| City rings / nav | Sector rings HQ 2 and 6. Challenges tab HQ 2, Events tab HQ 4. |
| HQ benefits | Cumulative value at M(n) equals today's at n, then a capstone. For example, attack +59% at HQ26 and +67% at HQ30. |
| Sprites | One bucket per era: 1 (L1–9), 2 (10–19), 3 (20–29), 4 (30) |

**The capstone band (HQ 27–30)** gets the 5th march, Hero Quarters 23–25, the last squad-size steps and the benefit
capstones.

## Pacing

A completionist, with two builders and −40% build time, reaches HQ 10 in about 13 h, HQ 20 in about 7 days, HQ 25 in
about 18 days and **HQ 30 in about 42 days**.

## Defaults taken (owner can overrule)

- **Proportional cap** (not plain ≤ HQ for every building).
- **Military buildings get cheaper at L5–10** than today, with base costs trimmed.
- **Research depth past Workshop ~18 is deferred.** Workshop 19–30 feeds only mastery 7 and the HQ chain until techs
  are extended (backlog).
- **Storage stays loose** (14–25× the next HQ cost). March gathering scaling is deferred.
- **Hero cap stays on Hero Quarters** (×4).

## Built to extend (future chapters and a post-30 band)

The range is data, never code, so the campaign and the HQ range can grow later without rewrites.

- `HQ_MAX`, `ERA_HQ` (M), the per-level tables and every `maxLevel` come from data. No code or test hard-codes 10
  chapters, 30 HQ levels or 10 eras. Loops run to `HQ_MAX` / `ERA_HQ.length` / `CAMPAIGNS_CONFIG.length`.
- **Adding chapters 11+** means:
  - append to `CAMPAIGNS_CONFIG` and `MONSTERS_CONFIG`;
  - add an `ERA_HQ` entry (its gate);
  - add a `CHAPTER_BOSS_TARGETS` entry.

  The stage generator, power, recommended power, level cap and rewards pick it up.
- **A post-30 band** (a new currency, like Whiteout Survival's Fire Crystal levels) means:
  - raise `HQ_MAX`;
  - append a curve band to `BUILDING_CURVE`;
  - extend the tables, which the length-validation test then demands.
- **Tests guard this:** a synthetic chapter 11 and an `HQ_MAX` of 35 built from fixture data must pass the generator
  and curve tests (see the scale and power plans).
