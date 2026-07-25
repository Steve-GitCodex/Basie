# 0025 — AWAKENING_CONFIG dual-shape transition (Phase 1 Task 2)

**Date:** 2026-07-25 · **Status:** accepted

## Context

`docs/superpowers/specs/2026-07-23-hero-economy-numbers.md` §C locks a new 10-star,
shard-only awakening track (`maxStars` 5→10, `perStarStatBonus 0.06`,
`perStarAuraBonus 0.04`, replacing the old `'card'` awaken method entirely). Task 2's
scope is data/config only — `heroCombat.js`, `heroRecruitment.js`'s runtime logic, and
the aura formula are explicitly out of scope (a prior task broke behavior by editing
half of a two-part aura change). Those files still read the old `starCosts[stars]`
(`cards`/`fragments`) and `perStarBonus.{statMultiplier,auraValueBonus}` shape, and
`tests/unit/heroManager.test.js` exercises `awakenHero(...,'fragment')` against it.

## Decision

`AWAKENING_CONFIG` carries both shapes side by side: `maxStars` is 10 (the spec's
locked ceiling — `tests/unit/heroesData.test.js` asserts this value, so it cannot be
reverted to 5), `starCosts`/`perStarBonus` stay byte-for-byte as they were (5 entries),
and the new `starShardCosts` (10-entry, tier-keyed, §C table) / `perStarStatBonus` /
`perStarAuraBonus` fields are added alongside, unread until a later task rewires the
three consumer files to the shard-only flow.

Bumping `maxStars` to 10 while `starCosts` stays 5 entries means the legacy gate
(`hero.stars >= maxStars`) no longer stops legacy consumers before they index
`starCosts[hero.stars]` for stars 5-9 — that reads `undefined` and both
`heroRecruitment.js#awakenHero` (dereferencing `costCfg.fragments[...]`) and
`HeroManager.js#getHeroRoster` (computing `nextStarCost`) would break. A follow-up
fix (post-landing review) added explicit `undefined`-guards at both call sites so
stars ≥ `starCosts.length` are treated exactly as "no legacy award available" — the
same effective outcome as when `maxStars` was 5. `HeroesUI.js`'s star-pip track and
"Star X/10" label still render against the full 10-star ceiling (that visual, and the
full shard-based awaken flow, is Task 4's job), but the awaken action itself can no
longer crash or silently return `undefined` for stars 5-9.

## Consequences

- No behavior change to the *legacy 0-4 star* awaken/aura/progression paths.
- A hero still caps out at 5 stars via the legacy `card`/`fragment` awaken flow, exactly
  as before this task: reaching star 5 still works, and any further attempt (which
  would push toward stars 6-9) now fails closed with `'Hero is at max stars.'` / `null`
  instead of throwing — this is new guard code, not new game behavior.
- Transitional duplication in `heroes.js` is intentional debt, not oversight — the
  legacy fields disappear once Tasks 4/5 (progression + aura) cut over.
- Any task touching `heroCombat.js`, `heroRecruitment.js`, `HeroManager.js`, or
  `heroProgression.js` next should remove `starCosts`/`perStarBonus` (and the guards
  added here) in the same change that switches those files to
  `starShardCosts`/`perStarStatBonus`/`perStarAuraBonus`.

## Closing note (final review fix pass)

`starCosts`/`perStarBonus` are removed from `AWAKENING_CONFIG` (`js/entities/data/heroes.js`).
`HeroManager.getRosterWithState()` no longer computes/publishes the legacy-shape
`nextStarCost`/`fragForAwaken`/`canAwakenByCard`/`canAwakenByFrag`/`dupCardQty` fields —
it publishes `shardQty`/`nextStarShardCost`/`canAwakenByShard` instead, and
`HeroesUI.js`'s awaken action is a single shard-based button. The dual shape is
resolved; nothing in the runtime reads the legacy fields anymore.
