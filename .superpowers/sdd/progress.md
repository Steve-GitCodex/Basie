# SDD progress — Hero Redesign Phase 0: HeroManager split

Plan: docs/superpowers/plans/2026-07-23-hero-redesign-phase0-manager-split.md
Branch: Working_Branch
Phase0 base: 088f47661bef89df22280c8cb6f9e47e92c2e357
Status: COMPLETE. All 7 tasks landed, each independently reviewed clean, plus a
final whole-branch review on opus (Ready to merge: Yes, no Critical/Important).
Checkpoint commits (task1..task7, see prior git log if needed) were squashed via
`git reset --soft` back to Phase0 base after the final review passed -- tree is
staged, uncommitted, commit-ready. Steve commits himself.

- [x] Task 1: characterization tests (review clean)
- [x] Task 2: heroRecruitment.js (review clean; minor: dual _recruitHero/recruitHeroRecord proxy, deferred to Phase 1)
- [x] Task 3: heroProgression.js (review clean; minor: pre-existing HeroesUI._barracksIdForSquad duplication, out of scope)
- [x] Task 4: heroAssignment.js (review clean; minor: out-of-scope comment condensing in HeroManager.js -- verified inert, class-header narrative lost, worth a glance)
- [x] Task 5: heroCombat.js (review clean; minor: pre-existing unused _lastBuffCount write, out of scope)
- [x] Task 6: heroEconomy.js (review clean; minor: unused eventBus import in heroEconomy.js)
- [x] Task 7: verify split (review clean; minor: dev-anchor-nudger smoke failure pre-existing/unrelated; plan's Task7 template heroquarters_0 example doesn't match real config, test adapted to barracks_0)
- [x] Final whole-branch review (opus) -- Ready to merge: Yes. HeroManager.js 958->237 lines.
      Minor findings deferred to Phase 1: unused eventBus import (heroEconomy.js), dual
      recruitHeroRecord/_recruitHero proxy, pre-existing dead MAX_HEROES_PER_SQUAD +
      _lastBuffCount, HeroesUI hand-copied barracksIdForSquad mirror, class-header
      narrative comment lost in Task 4 condensing (confirm captured in docs/10-design/).

npm test 322/322. check-comments.mjs clean on all 6 touched hero files. boot-smoke PASS.
dev-smoke PASS on core boot block (one unrelated pre-existing dev-anchor-nudger failure).

## Phase 1: Hero economy foundation

Plan: docs/superpowers/plans/2026-07-23-hero-redesign-phase1-economy-foundation.md
Phase1 base: 9075f195c8cbb264a25081a33112cebd9c5123dc

- [x] Task 1: retier roster to normal/epic/legendary, add Juno Vane + Kaelen Thorne + backstory
      (commits 093f4a5..2496047, review clean after 1 fix round: reverted out-of-scope
      aura edit deferred to Task 5; deduped TIER_CSS_SUFFIX into uiUtils.js)
- [x] Task 2: token/shard/fragment/xp-card items + XP/PITY/EXCHANGE/PROD config blocks
      (commits dcbc14f..649ccdf, review clean after 2 fix rounds: guarded legacy
      awakening consumers against undefined starCosts[5-9] instead of reverting the
      already-locked maxStars=10 interface; wired 4 new configs into GAME_DATA barrel;
      added regression tests for the guard)
- [x] Task 3: linear-step XP curve + Hero-Quarters-gated level cap (commit 81d2d60,
      review clean; scope-extended by 2 authorized one-liners into heroRecruitment.js/
      HeroManager.js to seed xpToNext correctly at recruit time + unowned display)
      Deferred (Important, tracked not blocking): HeroManager.js:228 deserialize()
      xpToNext fallback still reads retired cfg.xpPerLevel on corrupted/legacy saves
      missing xpToNext — narrow edge case, follow-up task should fix.
- [x] Task 4: 10-star shard-only awakening (commit 4ecde5c, review clean; legacy
      card/fragment method path fully removed from awakenHero, hand-verified against
      §C cost table for 3 tiers. Minor: heroes.js:228-229 comment still lists
      heroRecruitment/heroProgression as legacy-AWAKENING_CONFIG readers -- no longer
      true, only heroCombat.js is (Task 5's job). HeroesUI.js still calls old
      awakenHero(id, method) signature and shows stale nextStarCost -- accepted
      Phase 3/4 debt per plan.)
- [x] Task 5: bounded, base-relative aura formula (commits f995839..eb6d882, review
      clean after 1 fix round: folded new AURA_CONFIG fields into the already-barreled
      AWAKENING_CONFIG instead of a direct data/heroes.js import, restoring the
      GAME_DATA.js-only convention. Paired change verified intact: Vera aura 0.20 +
      magic_amplify x0.8 hack removed, worked example 0.379 confirmed by hand.)
- [x] Task 6: heroes-only token rolls with dupe->fragments/shard (commit 419cbbd,
      review clean; rates/consolation-split hand-verified vs SG numbers, dupe-checked-
      before-outcome-decided confirmed, deterministic _resolveTokenHero seam in place.
      Scope-extended into InventoryManager.js: recruitment_scroll item-use branch called
      the now-deleted rollScroll and would have crashed -- made it fail gracefully
      instead. TRACKED FOLLOW-UP (Important, not blocking): scroll_* items are now a
      permanent dead end in the live economy (still purchasable/droppable, always
      no-ops on use) -- needs its own task to retire scroll drops/shop entries or
      migrate them to tokens.)
- [x] Task 7: two-stage pity with persisted counters (commits 063c7c8..586e51d,
      review clean after 1 design-decision fix round: rosterComplete() switched from
      global (all 6 heroes) to per-tier gating for stage-2, per Steve's explicit call --
      a tier that finishes early now correctly gets guaranteed-shard pity instead of
      staying degraded-stage-1 until the whole roster is done. ADR 0002 persistence
      (_pity serialize/deserialize/reconcile) verified intact both rounds.)
- [x] Task 8: fragment->shard unlock, 3:1 tier-shard exchange, maxed overflow (commits
      abd19a7..75409da, review clean after 1 fix round: added missing test coverage for
      the maxed-hero overflow branches of convertFragments/exchangeTierShards).
      FRAGMENTS_PER_SHARD/SHARDS_TO_UNLOCK added here for the first time (confirmed
      correct scope per Task 2's review). "Fully maxed" = stars===10 only, no skill
      clause (no skill-level tracking exists yet -- Phase 2's job). Exchange direction
      hand-verified non-laundering (buy 3:1, refund 2:1, no reverse path exists).
- [x] Task 9: wire dev-hero production bonuses for all resource types (commit c6456bc,
      review clean; formula hand-verified for resource-output + speed stats; hero
      reassignment (shadowblade gold->iron stat fix, kaelenthorne mine->farm/food) is
      reasonable and non-arbitrary; paladin's non-production defense bonus untouched.
      ESCALATED, NOT FIXED (Important): getBuildingProductionBonusMap()'s correctly-
      wired numbers never reach live resource rates. ResourceManager/buildingEconomy.js
      has its own separate, pre-existing hero-bonus mechanism (1+level*0.05, no stars,
      wrong base %) that actually drives gameplay -- confirmed by a comment in
      ResourceManager.js citing double-count risk. The map's only live consumer just
      uses it as an event trigger, discarding the values. Pre-existing, out of Task 9's
      file scope -- needs a decision on whether to reconcile the two mechanisms.
- [x] Task 10: persistence round-trip coverage for economy state (commit 841e4eb,
      review clean; genuine end-to-end round-trip test for _owned/stars/_pity verified
      not tautological; InventoryManager confirmed (not assumed) to already cover
      fragments/shards generically; closed the Task-3 disclosed debt -- deserialize()'s
      xpToNext legacy fallback now computes from the real curve instead of retired
      cfg.xpPerLevel, no constructor-ordering risk confirmed. 376/376 unit, boot-smoke
      PASS, dev-smoke PASS except one pre-existing unrelated dev-anchor-nudger failure.)

## Phase 1 status: all 10 tasks complete and reviewed clean.
Next: final whole-branch review (9075f19..841e4eb), then squash to staged/uncommitted
for Steve to commit.

## Final whole-branch review (opus/sonnet) — Ready to merge: Yes

First pass (opus) found 1 Critical + 5 Important: (1) old summonFromFragments/
fragmentsToSummon path bypassed the new shard-gated unlock economy by ~3x, live in
InventoryUI/HeroesUI; (2) xp_card items minted but unspendable anywhere; (3)
deserialize() only recomputed xpToNext for non-finite saved values, so legacy saves
kept the old 1.3^L-curve value indefinitely; (4) card_common/card_rare (renamed in
Task 1) silently dropped on load; (5) aura passive skills (arcane_nova/poison_blade/
holy_light) went permanently inert -- Task 5's rewrite reads hero.skillLevels, a field
nothing writes yet; (6) ADR 0025's own stated exit condition (delete legacy
starCosts/perStarBonus + dead roster fields once the last consumer migrates) was
never met after Tasks 4/5.

All 6 fixed in one combined commit df1f0da. Re-review (opus overloaded twice, fell
back to sonnet) confirmed all 6 genuinely resolved with real code-path evidence + new
regression tests, no new regression introduced by the fix itself, aura-fallback/ADR-
0025-deletion interaction verified safe (fallback never reads perStarBonus).
390/390 unit, check-comments clean, boot-smoke PASS. **Ready to merge: Yes.**

**New gap surfaced (pre-existing, not part of the 6, not a reopened finding, tracked
not fixed):** recruit_token items (the only currency that can call rollToken -- the
entire gacha/pity/consolation economy this phase built) have zero acquisition path
anywhere (not sold, not quest/achievement-granted). SHOP_CONFIG's 'heroes' section
still sells the now-dead scroll_* items instead. As shipped, no player can reach the
new hero economy through any in-game action. Needs a follow-up: wire token_{tier}
into SHOP_CONFIG (and/or quest/achievement rewards), retire scroll_* from the shop.

## Phase 1 COMPLETE. Next: ADR for economy decisions (plan requirement), session
handoff (docs/40-active.md), roadmap tick, then git reset --soft to pre-Phase1 base
(9075f19) leaving tree staged-uncommitted -- Steve commits.
