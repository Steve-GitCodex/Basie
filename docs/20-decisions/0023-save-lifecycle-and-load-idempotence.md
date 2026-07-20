# 0023 — Save lifecycle, load idempotence, and over-cap semantics

**Date:** 2026-07-20 · **Status:** accepted

## Context

The systems bug audit (`docs/systems-audit-plan.md`, findings in
`docs/audit-findings.md`) found that the severe persistence defects were **not** in
per-manager field mapping — those are largely symmetric and ADR 0002-compliant — but in
the *orchestration* around load and save. Four distinct bugs shared two root shapes:

1. **A single flag carrying two intents.** `SaveManager._isWiping` was set by `wipe()` and
   never reset, permanently disabling `save()`. It was guarding two unrelated things: a
   reentrant save during the wipe itself, and the `beforeunload` re-save after a
   wipe-then-reload. Because guest→account registration calls `wipe()` and then continues
   **without reloading**, all progress after registering was lost from both stores.
2. **Load-time handlers that accumulate instead of assert.** `user:vipUpdate` fires with
   `isInit: true` and the *absolute* perk value **after** `applyGameState()` has already
   restored the previous session's grant, so every reload added the perk again —
   unbounded, in both `BuildingManager` and `TechnologyManager`.

Separately, resource cap handling was self-contradictory: `setCap` wrote a lower cap
without touching `amount`, while `update` snapped `amount` down on the next tick — so a
storage-tech bonus dropped at load destroyed real player resources, and the two code
paths disagreed about whether over-cap stock was legal.

## Decision

**1. Save suppression is explicit and separate from wiping.** `wipe()` clears storage and
leaves saving functional. A caller that wipes and then reloads must call the new
`SaveManager.suppressSaves()`, which latches saving off for the remaining page lifetime.
`SettingsManager.wipeAllData()` does exactly this. Both behaviours are pinned by tests:
a save after `wipe()` must persist, and a save after `suppressSaves()` must not.

**2. Load-time grants must be idempotent.** Any handler that applies an absolute,
externally-derived quantity (VIP perks being the current case) tracks the portion it has
already granted in its own serialized counter (`vipBuildSlots` / `vipQueueSlots`) and
applies only the difference. Applying such a grant twice must equal applying it once.
The VIP-granted portion is tracked **separately** from other premium slots, because
`addPremiumBuildSlot` also has a shop-purchase caller — overwriting the total would
destroy purchased state.

**3. Over-cap stock is legal and never destroyed.** A single `_addCapped` helper is the
only way `ResourceManager` accrues (`update`, `applyOffline`, `add`): at or over cap,
further gains are wasted, but existing `amount` is never reduced. `setCap` does not clamp.
A cap that drops below current holdings therefore freezes accrual rather than confiscating.

**4. Hero production bonuses apply once, per-instance.** The global application in
`ResourceManager.recalculateRates` is removed; `buildingEconomy.computeActiveRates` —
which is type-gated to the building the hero actually occupies — is authoritative.

**5. Save failures are observable.** `SaveManager` emits `game:saveFailed`
(`reason: 'quota' | 'unknown'`) so quota exhaustion cannot silently stop persistence.
`SaveManager` also takes an injectable storage (`constructor(storage = localStorage)`),
which is what makes any of this unit-testable.

## Consequences

- **Guest→account registration no longer destroys progress.** This was the single
  highest-impact defect found in the audit.
- **Reloading no longer inflates VIP slots** — but saves that already compounded keep
  their extra slots and take one final increment before stabilising. Clawing back state
  that reads as purchased was judged worse than over-granting. Live saves stay slightly
  inflated permanently.
- **A cap reduction now freezes accrual instead of confiscating stock.** This is the
  player-favourable reading and the only one both paths can agree on. It also means a
  resource can sit visibly over its cap (e.g. `3600/3000`) until spent — intended.
- **Hero `buildingBonus.value` no longer influences production.** The surviving
  per-instance path derives magnitude from `1 + level * 0.05`, so per-hero `value` (e.g.
  Shadowblade's `0.15`) is now decorative. This settles the deferred applied-vs-displayed
  magnitude mismatch *by deletion* and flattens hero specialisation to level scaling —
  **flagged for Steve's confirmation**, not treated as settled design.
- `getBuildingProductionBonusMap` is still invoked to emit `hero:productionBonusChanged`
  (a refresh trigger whose payload is ignored), so it must not be deleted even though its
  return value is now unconsumed. The `buildingType` check added to it during the audit
  consequently has no runtime effect today.
- Adding two new serialized fields (`vipBuildSlots`, `vipQueueSlots`) is ADR 0002 surface:
  both read with `?? 0`, so legacy saves load cleanly.

## Alternatives rejected

- **Resetting `_isWiping` at the end of `wipe()`** (the first attempt). It satisfies the
  registration case and silently breaks "wipe all data" — `reload()` fires `beforeunload`,
  which re-saves live in-memory state over the wipe. Rejected because one flag cannot
  encode two intents; the fix must separate them.
- **Overwriting `_premiumBuildSlots` with the VIP perk value on load.** Simpler, but
  destroys shop-purchased slots.
- **Making `setCap` clamp `amount` immediately.** Honest and self-consistent, but it
  destroys player resources at a predictable moment rather than an unpredictable one —
  still destruction, for no gameplay benefit.
