# 0034 — Shared round-based combat resolver

Date: 2026-10-02 · Status: accepted · Spec: `docs/superpowers/specs/2026-10-02-combat-resolver-design.md` ·
Research: `docs/research/combat-model.md` · Design page: `docs/10-design/combat.md`

## Context

`CombatManager._simulateBattle` pooled every attack, defense and HP and subtracted pooled defense from
wave attack. Ten tier-1 Footmen (def 100 pooled) took 1 damage per round from a 45-attack Alpha;
tier, position and troop type meant nothing; heroes added multipliers but never killed anything.
Steve's direction (roadmap backlog, 2026-10-01): a hit only hurts in proportion to how much attack
beats the target's defense, low tiers die first, heroes land real kills. Campaign stages, world-map
marches and the future Arena/PvP must share one resolver. Basie has no real users, so there is no
legacy to carry.

## Decision

One pure module folder, `js/systems/combat/`, resolves every fight; `CombatManager` is a thin adapter.
All tuning lives in `js/entities/data/combatRules.js` (`COMBAT_RULES`, `RULES_VERSION` 1).

1. **Hit formula.** `hitDamage(atk, def) = atk² / (atk + def)`. 25 vs 100 = 5, 1000 vs 10 ≈ 990.
   `+ − × /` only (no `pow`/`exp`/trig) so results are identical across browsers.
2. **Rows.** Each stack sits in front / mid / back. Damage goes to the front-most row with a living
   stack and is split across its stacks weighted by `count × TIER_TARGET_WEIGHT[tier-1]`, so low
   tiers soak first. Overflow spills within the row, then is lost for that round.
3. **Counters.** Infantry > cavalry > ranged > infantry, `COUNTER_MULT` 1.15. Siege gets
   `SIEGE_VS_STRUCTURE_MULT` 1.5 in structure fights.
4. **Casualties.** `fallen` = start − end per tierKey. Victory heals `floor(fallen × postBattleHeal)`;
   the rest splits wounded/dead with `WOUNDED_SHARE` (0.40 victory, 0.20 defeat) pushed up by the
   soft-capped `lossReduction` (ADR 0031). Wounded go to a pool on `UnitManager` (`getWounded()`);
   there is no heal path yet.
5. **Seeded variance.** Each stack rolls ±10% per round from a mulberry32 stream. A report is a pure
   function of `{ rulesVersion, seed, inputs }`; seed and `rulesVersion` are stored on every battle
   log entry for replay and later server verification.
6. **Structure is a fight context, not a monster flag.** `marchResolver` passes `{ structure: true }`
   for strongholds and outposts; campaign, camps, ruins and bosses are field fights.
7. **Heroes strike.** Barracks heroes become `strikers` (`heroCombat.getCombatBonuses().strikers`):
   one hit per round into the front row, scaled by `HERO_STRIKE`. HQ-stationed heroes never strike.
8. **Waves and rounds.** Waves are sequential; survivors and HP pools carry over. `ROUND_CAP` 30 per
   wave, reached = defeat. Skill `duration` is now in rounds. `estimateBattle` runs `ESTIMATE_RUNS`
   seeded fights with no side effects and drives the "Likely win · ~70%" badge.
9. **No legacy.** No adapters for the old `losses` / `waveDetails` / single-stack monster shapes, no
   save migrations; missing new fields (`slotRows`, `wounded`) start empty. Events carry
   `dead` / `wounded` maps keyed by tierKey.

### Rulings made during implementation

- R2: one stack per tierKey; when several slots hold the same tierKey it takes the lowest slot's row.
- R3: the campaign stage detail wave list was updated to the stack shape (a consumer the plan missed).
- R4: a row wiped by an earlier strike in the same round loses later damage aimed at it (not re-targeted).
  Within a row, a stack wiped earlier passes its share to its row-mates (deterministic live re-weighting).
- R5: a mutual wipe on the final wave is a defeat (a "victory" with zero survivors would reward a dead squad).
- R6: first-wave triggers (`battle_start`, `firstWaveBonus`) fire on the first non-empty wave; the structure
  bonus is attacker-only; healing only affects living stacks; `losing` compares to the attacker's starting HP;
  empty waves are kept with no rounds.
- R7: stack `attackBonus` and `firstWaveBonus` go inside `hitDamage` (`atk' = attack × (1+bonus) × opening`),
  so buffs follow the same attack-vs-defense curve.
- R8: a unit's combat type is its `UNITS_CONFIG` key (infantry/ranged/cavalry/siege), not its data category.
- R9: test file named after its module (`playbackSteps.test.js`).
- Unslotted units fight at their type's default row. A row belongs to the slot, so it persists into the
  next unit placed there. Locked slots show no row toggle.
- An unknown difficulty setting is ignored (previous valid value stays); `milMult < 1` is honoured (closes the roadmap "future trap").

## Consequences

- Balance is now a data exercise: `COMBAT_RULES` and `MONSTER_TIERS` are first-pass values and every
  monster's tier assignment is a guess. A balance pass is the next step; the skill-magnitude pass (ADR
  0031) waits for it.
- `CombatManager.js` shrank 500 → ~308 lines; `CombatUI.js` 628 → ~496 with playback/result code in
  `js/ui/combat/`.
- Adding PvP/Arena = `resolveBattle(squadSide(a), squadSide(b), { seed })`; no new maths.
- Wounded units are lost to the player until a hospital exists (the Barracks modal says so).
- `lossReduction` only moves fallen troops from dead to wounded. Because wounded cannot be healed until a
  hospital exists, Steel Armor and the "reduces troop losses" skills/aura/losing-trigger currently keep
  no extra troops. Open decision for Steve: an interim rule (e.g. a share of wounded returns) vs.
  prioritising the hospital.
- Implementation note: the T5-T7 plan tasks briefly broke the suite mid-way (transitional); no lasting
  consequence.
- `estimateSurvival` and `_simulateBattle` (pooled maths) are deleted.
- Test inversions (ADR 0012 exceptions; the old pooled model they tested is gone):
  1. `CombatManager.test.js`: 14 tests asserting wave-indexed trigger windows, pooled loss rates,
     the 10% loss floor, aegis/postBattleHeal restoring losses, `baseDefense` pooled maths and Steel
     Armor's 60% loss cut were replaced by rules-based equivalents (new `attack` / `estimateBattle` /
     `resolveMarchBattle` / structure / difficulty tests). One test (summed `defenseBonus` above 1.0
     reachable from config) was kept.
  The other test files only gained appended tests (marchResolver casualties and structure vs field fights,
  heroCombat strikers, gameData monster-stack invariants, unitManager rows and wounded round-trip).
- Known quirks accepted: `heroHits` damage/kills are computed at planning time and may overstate; a
  hero hit line in playback shows no hero name; the estimate badge reads (does not consume) the pending
  encounter modifier so odds match the fight.
