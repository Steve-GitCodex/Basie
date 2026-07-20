# Systems Bug Audit — Findings

> **STATUS 2026-07-20: all 12 load-bearing defects below are FIXED** (two waves of Sonnet
> agents, specs written by the session owner). Verified independently: `npm test`
> **301/301**, comment-lint unchanged at the 13 known pre-existing violations.
> Wrong-but-contained and future-trap items are NOT fixed — they remain open below.

## Residue and consequences of the fixes — read before the balance pass

1. **Already-inflated VIP saves are not repaired.** The L3 fix adds a `vipBuildSlots` /
   `vipQueueSlots` counter tracking the VIP-granted portion, so the ratchet **stops**.
   But a save that already compounded to e.g. 3 slots loads with the legacy counter at 0,
   takes **one final increment**, and then stabilises. Existing over-granted slots are
   kept, not clawed back. Deliberate — clawing back purchased-feeling state is worse than
   over-granting — but it means live saves stay slightly inflated forever.
2. **`getBuildingProductionBonusMap` is still called, but its return value is now dead.**
   The agent reported it as "unused"; that is imprecise. It is still invoked at
   `HeroManager.js:491,504` to emit `hero:productionBonusChanged`, which `ResourceManager`
   listens to purely as a trigger (`() => this._reapplyRates()`) and ignores the payload.
   **Consequence: the `buildingType` check added to it in wave 1 currently has no runtime
   effect on production rates.** It is test-covered and would matter again the moment
   anything re-consumes the map. Do not delete the function — it is a live event trigger.
3. **Hero `buildingBonus.value` no longer influences production.** With the global
   application removed, the surviving per-instance path in `buildingEconomy.js:103-113`
   is type-gated (correct) but derives magnitude solely from `1 + level * 0.05`. The
   per-hero `value` field (e.g. Shadowblade's `0.15`) is now decorative. This de-facto
   settles the deferred applied-vs-displayed magnitude question by deletion — **confirm
   that is what you want**, since it flattens hero specialisation to level scaling.
4. **Over-cap semantics chosen: `update` stops snapping.** A new `_addCapped` helper is
   used by `update`, `applyOffline`, and `add` — at/over cap, further gains are wasted but
   existing stock is never reduced. `setCap` still does not clamp. The agent extended this
   to `add()` beyond the written spec, correctly, since it had the identical destructive
   snap and would otherwise have kept the paths disagreeing.
5. **`SaveManager` gained `suppressSaves()`.** `wipe()` no longer latches permanently
   (fixing guest→account registration); the wipe-then-reload path in
   `SettingsManager.wipeAllData()` must call `suppressSaves()` explicitly, or
   `beforeunload` re-saves over the wipe. Both behaviours are pinned by tests — the first
   fix attempt traded one bug for the other.

> Produced 2026-07-20 by five parallel specialist reviews (plan: `docs/systems-audit-plan.md`).
> Read-only pass; no code changed. Severity per the plan's triage tags.
> **Nothing here is fixed yet.**

**Result: the audit was worth running.** 12 load-bearing defects, three of which were
found independently by two reviewers each (marked ×2 — strong signal, not an artifact).
A happy-path verification pass would have surfaced almost none of them: most are on
reload boundaries, expiry paths, or failure branches that report success.

## Load-bearing — corrupts save state, loses progress, or crashes

| # | Defect | Location |
|---|---|---|
| L1 | **`wipe()` permanently disables saving.** `_isWiping` latch is never reset. Reached by guest→account registration, which does **not** reload. All progress after registering is lost from both localStorage and Firestore. | `SaveManager.js:40,94`; `SettingsUI.js:489` |
| L2 | **Storage-tech cap dropped on load, then over-cap amount destroyed.** Buildings deserialize before tech, so `_recalculateAllCaps()` runs with empty `_techBonuses`; the `resources:bonusChanged` handler calls `_notifyRates()` only. Next tick clamps. **~600 wood destroyed per reload** with +20% storage. | `BuildingManager.js:88,1021`; `ResourceManager.js:302,114` |
| L3 | **VIP premium slots compound on every load** ×2. State is restored, then `broadcastVipState()` fires `isInit:true` with *absolute* perks and re-adds. Unbounded; unlocks gated content. **Confirmed in both** `BuildingManager` (`_premiumBuildSlots`) and `TechnologyManager` (`_premiumQueueSlots`). | `BuildingManager.js:91-97`; `TechnologyManager.js:37-43`; `UserManager.js:238`; `main.js:414` vs `457` |
| L4 | **Expired events never release their multiplier** ×2. `addModifier` keys as `id:resourceType`; `_deactivateEvent` passes bare `cfg.id`. Silent no-op → permanent in-session economy inflation, stacking per event. | `EventManager.js:107`; `ResourceManager.js:328` |
| L5 | **Unit duplication.** `squad.units` and `squad.slotUnits` are dual-tracked with no invariant; `removeUnitsFromSquad` updates only the former, `clearSlotUnits` refunds the stale latter. Lose 40/100, clear slot, get 100 back. Repeatable, persists through save. | `UnitManager.js:747-757,549-564` |
| L6 | **Squads deletable mid-march.** `deleteSquad` checks no deploy-lock; combat and march both guard, deletion bypasses. Full army returns instantly, zero losses, zero travel time. | `UnitManager.js:619-632` |
| L7 | **Gacha resource rolls give nothing.** `GACHA_CONFIG.resourcePool` ids (`res_bundle_*_sm`) don't exist — `INVENTORY_ITEMS` defines only `_t1`…`_t5`. Scroll consumed, success reported, nothing granted. **40% of common / 30% rare / 20% legendary rolls.** | `heroes.js:266`; `HeroManager.js:94-98` |
| L8 | **Hero production bonus ignores `buildingType` and is applied twice.** The production-feeding path skips the type check the UI path performs → +15% money from a barracks slot. Separately double-counted: per-instance in `computeActiveRates` *and* again as a global resource multiplier. | `HeroManager.js:496-509` vs `750-763`; `buildingEconomy.js:103-113` vs `ResourceManager.js:184-190` |
| L9 | **Paladin aura applies from anywhere and leaks across squads.** `isHQHero` tests the hero's *config*, not station. Grants squad defense from a mine; squad 1 receives squad 2's Paladin. | `HeroManager.js:650-652,726-727` |
| L10 | **`HeroManager` drops `activeBuffs`** ×2. `if (!data?.owned) return;` bails before buffs restore. `buff_prod_lg` is a 1500-money 2h item. | `HeroManager.js:907-909` |
| L11 | **Mail `nextId` collision on legacy saves.** `data.nextId ?? _messages.length + 1` — ids aren't dense after deletes. New mail collides with an existing id; `.find()` hits the older one, new reward unreachable forever. | `MailManager.js:258` |
| L12 | **Quota exhaustion swallowed.** Bare catch, console only — no event, no notify, no pruning. `_battleLog`, `_chapterLog`, and all mail+attachments are uncapped append-mostly structures in a 5MB store. Past the limit every autosave fails silently. | `SaveManager.js:39-48` |

## Wrong-but-contained

- **Difficulty never restored.** `SettingsManager` loads it but only emits on `set()`; `CombatManager` stays `'normal'`. UI shows Hard, combat runs Normal (enemy HP off by 40%). Self-concealing — any settings toggle masks it. (`CombatManager.js:33-36`)
- **Loss-rate floor applied before reduction.** `Math.max(0.02, …) * (1 - reduction)` — effective floor is `0.02 × (1-r)`, not `0.02`. Past 50% reduction it vanishes → attrition-free farming. Also unclamped below zero. (`CombatManager.js:340-342`)
- **Challenge daily/weekly reset uses seconds as ms.** `_resetAccumMs += dt` where `dt` is 0.05s, compared to `60_000`. Needs **16.7h of continuous play** to fire. Tab left open across midnight = no new dailies until reload. (`ChallengeManager.js:67-68`)
- **Quest prereq gating discards progress.** Progress before the prereq completes is dropped, not banked — train 10 units before your first building, then train 10 *more*. (`QuestManager.js:50-53`)
- **Tutorial step-skip.** `waitFor` handler isn't unsubscribed until 500ms later via `_showStep`; a second emission in that window double-increments. Exposed on `'train'` and `'quest'` (no `filterBuildingId`). (`TutorialManager.js:171-182`)
- **Welcome mail's 500 `gold` destroyed** — `gold` is not a resource key. Wood/stone grant fine, so the failure is invisible. (`main.js:543`)
- **Universal speed-ups unusable** without caller-supplied `queueType` (`cfg.target === 'any'` matches no branch). Shipped UI paths pass it; a bare `useItem` hard-rejects. (`InventoryManager.js:250-268`)
- **`addItem` returns `undefined` on both success and rejection** — the systemic cause of L7. (`InventoryManager.js:86-93`)
- **Daily login streak uses UTC**, so the day boundary is 13:00 local at UTC+13; a genuine 24h gap can reset a 29-day streak. (`UserManager.js:110,118`)
- **`_reapplyRates` replays a stale snapshot** and no-ops on an empty building list. Self-corrects on next `_notifyRates()`. (`ResourceManager.js:98-102`)

## Future-traps — record, don't fix

- **`milMult < 1` debuffs silently discarded** (`CombatManager.js:150`). Guard is `> 1`, not `!== 1`. **Fix before Phase 4 authors debuff data** — otherwise magnitudes get inflated to compensate and all need re-tuning after the one-char fix.
- **Event objectives `produce_iron` / `gather_wood` have no writer** — only `win_battles` is hooked. Two of three events' rewards are permanently unclaimable. Inert only because all ship `startTs: null`. (`EventManager.js:52`)
- **Market `tradeBonus` is dead.** Bound worth respecting: **at `tradeBonus ≥ 0.112` the wood↔stone cycle becomes non-lossy** and mints resources. (`MarketManager.js:91,117`)
- **`concurrentSlots` authored Lv.1–10 but never read** — queue is linear behind a hardcoded `>= 3`. Barracks throughput upgrades pay out nothing. (`UnitManager.js:603-609,274`)
- **`purchaseXPBundle` references a nonexistent `gold` resource**; would throw on first use. Its always-false `canAffordXP` flags *are* live on every roster render. (`HeroManager.js:579-595`)
- **Story `rewards` + `unlocksQuestIds` are dead data** — never read; quest gating uses `prerequisiteQuest` independently. Dangerous because it reads as authoritative. (`story.js:24-25` et al)
- **No save version field.** All migration is shape-sniffing. `BuildingManager` infers "legacy" from a *missing* `sectors` key — a future bug dropping it would force-clear the player's grid. Add `version: 1` now as an anchor.
- **Mail trash is write-only** (`deletedAt` never read, no purge) — feeds L12. `delete()` and `permanentDelete()` are byte-identical.
- **`spend()` unguarded index** — a cost map with a zero-valued unknown key passes `canAfford` then throws mid-loop, after earlier keys were deducted. No caller today.
- **Debug `clearSave()` is a no-op** — calls `saveManager.clear?.()`; the method is `wipe()`. Optional chaining hides it; anyone debugging fresh-start reproduces against their existing save.
- **`_trainMultiplier` logic quadruplicated** — all 5 call sites verified correct, but `_computeTrainMs` (the intended single source) is called from `applyOffline` only.

## Verified clean (worth recording so it isn't re-audited)

- **Id integrity across progression is clean** — every tech prereq, building requirement, HQ unlock, tutorial filter, story quest id resolves. Prereq graph is a DAG, no cycles or orphans. **The bad ids are localized to gacha pools and mail attachment keys, not systemic.**
- Per-manager serialize/deserialize field mapping is largely symmetric; transient state (deploy-lock, adjacency, boss windows) correctly excluded per ADR 0002/0006. **The severe persistence bugs are all in the orchestration layer, not the field diffs.**
- Region economic buff add/remove has no ratchet (`recalculateRates` zeroes before rebuild). Adjacency is applied exactly once.
- `spend()` is atomic; offline math guards backwards clocks and caps at 24h; sandbox cannot leak into a campaign save.
- Double-claim guarded on achievements, quests, challenges, mail rewards. Tech effects don't double-apply on load.
- Manager init order has no listener-registration race. `_weightedRandom` cannot fall through.
- Tutorial + Settings **do** persist (via `userManager.profile.tutorialStep` and their own `basie_settings` key) — an earlier scoping guess that they didn't was wrong.

## Design calls for Steve — not bugs, need a decision

1. **`defense_boost` double-count** — `HeroManager.js:673-676` adds it to both `defenseMult` and `lossReduction`, under a comment asserting it is *not* double-counted. Code and comment contradict; docs don't settle it.
2. **`cancelTrain` refunds 100%** regardless of progress — defensible and genre-common, but undocumented, so it reads as an oversight.
3. **`concurrentSlots`** — implement parallel training (making Barracks upgrades pay out), or delete the data and pin the linear queue?
4. **Daily resets are UTC** — market, challenges, and login streak. At UTC+3 that's 3am local.
5. **VIP tracks diamonds *received*, not spent** (`ShopUI.js:150`) — coherent as a lifetime-purchase model, but every name says otherwise. Fixing the "missing" call would double-count and hand out free tiers.
6. **Story chapter `rewards`** — grant them, or delete the dead field?
7. **Hero passive attack/defense** applied both to own stats and squad-wide — intended stacking or double-dip?
