# 0044 — Buildings to 30 levels: shared curve, HQ cap and chain, content remap

Date: 2026-10-07 · Status: accepted (design; not built) · Design page: `docs/10-design/building-levels.md` ·
Research: `docs/research/building-levels.md`, `docs/research/building-levels-codebase.md`

## Context

Most buildings cap at ≤10 (HQ 10), and the whole HQ track is about 1.8 h of build time. Raising max levels as things
stand would break silently:

- Per-level storage, cafeteria, rally and barracks tables fall back to 0, null or a plateau.
- The HQ benefits table stops at 10.
- Population is clamped to 1000.

Balance would break too:

- Per-building cost multipliers of 1.6–2.5 explode at L30 (up to 1e11), while time stays linear.
- Military buildings already cost up to 53× the HQ at L10.
- Nothing ties building levels to the HQ.

## Decision

1. **Max levels:** HQ and 11 spine/economy buildings to 30, Hero Quarters 25, support buildings 20, Rally Point 10,
   Construction Hall 3. Nothing past 30 for now.
2. **One shared curve** (`buildingCurve.js`):
   - cost factor ×1.65 / ×1.45 / ×1.30 per level across the three bands;
   - time linear to 10, then ×1.35 / ×1.20;
   - production linear to 10, then ×1.09.
   
   HQ 1–10 cost and time stay exactly as today. The per-building `costMultiplier` is removed.
3. **Cap:** `min(max, ceil(max × hq / 30))`, with Construction Hall exempt. From HQ 10, HQ N needs Workshop N−1 plus a
   rotating military or Storehouse partner at N−1.
4. **Content remap** with `M = [1, 2, 4, 6, 9, 12, 15, 18, 22, 26]`, applied to HQ gates, building-level gates, troop
   tiers (T4–T10 at HQ 9/11/13/15/18/22/26), campaign chapters, hero cap (Hero Quarters × 4), squad/march/research
   slots and HQ benefits. HQ 27–30 is a capstone band.
5. **Every per-level table is length-validated** against `maxLevel`. No lookup may silently return 0 or null.

## Consequences

- **Pace:** HQ30 in about 42 days for a completionist, against about 7 months in the genre.
- **Power and level draft (ADR 0045) re-fit through `eraAt`:**
  - player level cap = interpolated 5 × era (55 at HQ30);
  - building XP `0.3 × L²` (HQ `5 × L²`);
  - building/research troop-equivalents by era;
  - non-combat floor `500 × era`;
  - money cap by era.
- **ADR 0043:** the monster targets keep their values but move to the new gates (`M(k)`).
- **Art:** one sprite bucket per era. More stages are an asset-pipeline task.
- **Tests that pin level-10 behaviour change by contract:** `cityAssets`, `heroProgression` (HQ × 10) and `gameData`.
- **Deferred:**
  - research depth for Workshop 19–30;
  - post-30 band and chapters 11–12;
  - march gathering scaling;
  - storage pressure.
