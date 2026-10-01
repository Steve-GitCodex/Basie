# 0031 — Stat-cap pipeline for hero (and future) bonuses

Date: 2026-10-01 · Status: accepted · Amends the Phase 2d spec
(`docs/superpowers/specs/2026-08-16-hero-phase2d-effect-seams-and-loss-ceiling-design.md`)

## Context

Hero bonuses stacked additively with no ceiling. Loss reduction from a mid-game 4-hero squad
reached 142% once "losing" triggers fired, so wins cost zero troops; two research heroes
took workshop speed 0.24 → 0.42. The 2d spec proposed `1 − Π(1 − v)` stacking (D1) plus a
separate 10% loss floor (D2) and a separate 50% construction-cost clamp. Steve wants a cap
on total hero effect, troops never 100% invulnerable, and a model that absorbs future
bonus sources (vehicles, armor, ornaments) without new maths.

## Decision

One pure aggregator (`js/systems/stats/statAggregator.js`) driven by one data table
(`js/entities/data/statRules.js`):

1. Every source emits entries `{ stat, category, value, sourceId }`.
2. Entries stack inside their category. Default `softcap`: `cap · (1 − Π(1 − v/cap))` —
   a lone source passes through unchanged, more sources approach the cap and never pass it,
   and every extra level or hero still adds something.
3. Each category is capped (hero lossReduction 0.60, tech 0.60, …).
4. Categories combine `1 − Π(1 − c)`, then clamp to the stat's `totalCap` (< 1 always), which
   is the "never invulnerable" guarantee — it replaces spec D2 and the cost clamp.
5. Squad `attackMult` / `defenseMult` stay additive (spec D3).
6. The Hero Quarters station effect is named `baseDefense`, not `defense`, because `defense`
   is already the squad-skill kind.

Starting caps are in the Phase 2d plan's Global Constraints table; they are tuning values.

## Consequences

- Adding a source = add a category line to `STAT_RULES` + emit entries. Retuning = edit data.
- With today's categories, max loss reduction is 1 − 0.4 · 0.4 = 0.84 (losses ≥ 16% of base);
  `totalCap 0.90` only binds once more categories exist.
- The tech cap was raised from 0.30 to 0.60 so purchased Steel Armor levels (0.60 at Lv4) keep their value.
- Mid-game losses rise versus today (≈11% → ≈47% of base for the reference squad). A skill
  magnitude pass is expected once the curve is seen in play.
- Losses are rounded to whole troops, so a very small stack can still lose 0 on an easy win.
  Left to the combat-model rework (roadmap backlog).
- Lone contributors pass through the aggregator exactly (soft-cap and category combine return a single
  non-zero value unchanged), so single-hero behaviour is bit-identical to before and float noise cannot
  break threshold assertions.
- Test inversions (ADR 0012 exceptions), each encoding behaviour this phase deliberately changed:
  1. `gameData` "every statEffectMap entry resolves to a known base key" gains a named
     `SKILL_PAID_EFFECTS` skip, because the new entries are paid by skills, not base rates.
  2. `gameData` paladin-inert test now asserts the `heroquarters` stat matches Paladin.
  3. `KNOWN_INERT_HERO_BUILDING_BONUSES` is emptied.
  4. `stationBoard` "no bonus for unmapped type" stand-in `heroquarters_0` becomes `rallypoint_0`.
  5. `heroSkillsData` "buildSpeed stays unauthored" becomes "only gather/march yield stay barred".
  6. `heroProductionBonus` two-research-hero assertion 0.42 becomes the soft-capped 0.332.
  7. `stationBoard` "sorts bonus-bearing rows first" stand-in `heroquarters_0` becomes `archeryrange_0`
     (Hero Quarters now pays).
  8. `heroManager` passive-XP test posts Paladin at `heroquarters_0` instead of `mine_0`: only a
     non-dormant posting earns passive XP, and Paladin contributes nothing at a mine.
- Skill effect assignments: `field_repairs` +`buildSpeed` 0.08, `scavenge` +`storageCap` 0.10,
  `arcane_archive` +`constructionCost` 0.06.
