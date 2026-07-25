# 0026 — Hero economy Phase 1 redesign

**Date:** 2026-07-25 · **Status:** accepted

## Context

The hero recruitment/management system (audited 2026-07-15, spec'd 2026-07-23) had
four item classes with no drop-rate disclosure or pity, dupe cards/fragments that
often did nothing useful, an unbounded aura formula, and a 5-level XP curve
(`1.3^L`) that was unusable past ~L25. `docs/superpowers/specs/2026-07-23-hero-
economy-numbers.md` locked a full replacement economy (game-designer pass). Phase 1
built it headless (no UI) via `docs/superpowers/plans/2026-07-23-hero-redesign-
phase1-economy-foundation.md`, 10 tasks, subagent-driven development.

## Decisions

- **Tiers renamed** `common/rare/legendary` → `normal/epic/legendary` (fixed 2/2/2:
  legendary = Marcus Kestrel/Vera Sable, epic = Aldric Cross/Juno Vane, normal = Kira
  Nightwhisper/Kaelen Thorne). Ids unchanged (ADR 0002 — they're save keys).
- **Heroes-only recruit tokens** replace resource/buff/xp gacha scrolls entirely —
  `rollToken(tier)` never pays a base resource; a roll is always hero / fragment /
  shard / xp. Un-owned-biased at `NEW_HERO_RATE` (10/12/14%), with two-stage pity:
  soft ramp from pull 7, hard-guaranteed new hero by pull 10 (per-tier, not global —
  see amendment below), then once a tier's own roster is complete, every 10 pulls
  guarantees a Hero Shard instead of a wasted consolation roll.
- **Dupe → fragments/shard, never a wasted pull.** A "hero" roll landing on an
  already-owned hero converts to that hero's currency instead of doing nothing.
- **Shard-only awakening, 10 stars** (was 5-star card-or-fragment). Star costs are a
  pure Hero-Shard sink (§C table, 35/55/70 total by tier). `perStarStatBonus` is
  additive (+0.06/star); aura gets `+0.04·base/star`.
- **Bounded, base-relative aura**: `base·(1 + 0.005·(L−1) + 0.04·stars +
  skillAuraFrac)`. Replaces an unbounded per-level/per-star stacking formula and folds
  away a hardcoded `magic_amplify × 0.8` special-case (Vera's base dropped 0.25→0.20
  to compensate, landing at the same effective value as before).
- **HQ-gated level cap**: `HERO_LEVEL_CAP = HeroQuarters_level × 10`. A hero can no
  longer out-level the player's own base infrastructure.
- **Fragments → Shard → Unlock**, plus a lossy Tier-Shard exchange (3 tier-shards buy
  1 hero-shard; a maxed hero's surplus shard refunds only 2 tier-shards back) so value
  never dies but can't be laundered net-positive.
- **Production bonuses recomputed** per §I (level+star-scaled, all 5 resource types +
  training/research speed) but — see Known gaps below — not yet wired into live
  resource rates.

## Amendment (Task 7 review): pity stage-2 gate is per-tier, not global

The brief's literal wording ("once rosterComplete()... all heroes owned") reads as a
global gate across all 6 heroes. Steve's call: a tier's own stage-2 guarantee should
kick in as soon as *that tier's* heroes are all owned, independent of the other two
tiers — a token draw only ever pulls from its own tier anyway, so gating on the whole
roster left an already-completed tier running degraded stage-1 logic for no reason.
`HeroManager.rosterComplete(tier)` is tier-scoped; `rollToken`'s stage-1/stage-2
dispatch passes the tier being rolled.

## Known gaps, explicitly deferred (not blocking this ADR)

1. **Production bonuses are inert in live gameplay** (escalated during Task 9,
   Steve's call: the production-bonus system itself needs real redesign, not a patch
   — see [[basie-hero-production-bonus-gap]]). `getBuildingProductionBonusMap()`'s
   correct §I numbers never reach `ResourceManager`; a separate, older per-instance
   mechanism (`1 + level·0.05`) still drives real resource rates.
2. **Recruit tokens have no acquisition path** (surfaced in the final whole-branch
   review, after this ADR's economy was otherwise verified closed-loop). `token_*`
   items aren't sold in `SHOP_CONFIG`, granted by quests/achievements, or referenced
   anywhere outside their own data definition. Meanwhile `SHOP_CONFIG`'s `'heroes'`
   section still sells the now-retired `scroll_*` items, which always fail on use.
   As shipped, no player can reach this economy through any in-game action. Needs a
   follow-up: wire `token_{tier}` into the shop (and/or reward tables), retire
   `scroll_*` from sale.
3. **UI is untouched by design** (Phase 3/4 per the plan) — `HeroesUI`/`GachaUI`/
   `InventoryUI` were only patched where they'd otherwise crash on a deleted method
   (`summonFromFragments`) or reference a genuinely-removed field; cosmetic staleness
   elsewhere is accepted debt until the Heroes-screen/Recruit-Hall redesign lands.
4. **Skill-level system doesn't exist yet** (Phase 2). `_isHeroFullyMaxed` is
   `stars === 10` only, no skill-maxed clause. Aura's `skillAuraFrac` falls back to a
   flat `skill.effect.value` contribution (matching pre-Phase-1 behavior) when
   `hero.skillLevels` is absent, gated on the old `hero.level >= skill.unlockLevel`
   check — this bridge must be revisited once Phase 2 lands real skill levels (the
   fallback must not double-count once `skillLevels` data starts existing; it's
   written as an `if skillLvl / else legacy-flat` branch specifically to prevent that).

## Consequences

- Every new save field (`_pity`, per-hero `stars`/`xpToNext`) has serialize +
  deserialize + reconcile coverage (ADR 0002) — verified end-to-end, not just
  per-field, in the final review (legacy saves with old-curve `xpToNext`, renamed
  `card_common`/`card_rare` ids, and missing `_pity` all reconcile safely).
- `GACHA_CONFIG.outcomeWeights`/`heroTierWeights`/`resourcePool`/`xpPool`/`buffPool`
  and the old `AWAKENING_CONFIG.starCosts`/`perStarBonus` shape are fully retired —
  no dual-shape debt remains once this ADR lands (see 0025's closing note).
- Phase 2 (progression: 6-skill model, ~36 class-matched skills) builds on
  `heroProgression.js` + `SKILLS_CONFIG` using the §C/§D numbers not yet consumed
  here. Phases 3–4 (Heroes screen + Recruit Hall UI) consume `getRosterWithState()`'s
  new shard/currency fields.
