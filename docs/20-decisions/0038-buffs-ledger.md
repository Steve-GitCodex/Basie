# 0038 — Buffs: BuffManager, one boost per stat, ledger and shared production layers

Date: 2026-10-07 · Status: accepted · Spec: `docs/superpowers/specs/2026-10-03-buffs-design.md` ·
Plan: `docs/superpowers/plans/2026-10-03-buffs.md` · Design page: `docs/10-design/buffs.md`

## Context

Timed item boosts lived in `HeroManager._activeBuffs` and stacked without limit (two +25% gave x1.50). They were the only
buffs the UI showed; territory, outpost, expedition, tech, VIP, HQ, hero and event bonuses had no list, the HUD badge
navigated to Heroes (which showed no buffs), and the inventory countdown froze while open. The production multiplier
layers were inline in `ResourceManager.recalculateRates`, so nothing else could show the real total. No real users: no
legacy shims, no save migration.

## Decision

1. **`BuffManager` is the sole owner of item boosts and of `buffs:changed`.** `js/systems/BuffManager.js`, save key
   `buffs`. API: `activate`, `previewActivate`, `getBoosts`, `multiplierFor(stat)`, `update`. Removed from `HeroManager`:
   `_activeBuffs`, `activateBuff`, `getActiveBuffs*`, `getActiveProductionMultiplier`, the buff expiry in `update()`,
   and `buffs:updated`. `InventoryManager.useItem` delegates the `buff` branch to `BuffManager.activate`.
2. **One timed boost per stat; activating a second replaces the first** (the old remainder is discarded). The UI shows a
   replace confirmation only when `previewActivate().current` is non-null.
3. **Shared `productionLayers`** (`js/systems/resource/productionLayers.js`): pure layers tech, world, HQ, item boost,
   VIP, difficulty, event, plus `layerMultiplier`. `ResourceManager` applies them and exposes `getRateBreakdown`; the
   Overview tab reads the same breakdown, so the displayed total is the real rate. The spec's single formula
   (product over layers of `1 + sum pct`) could not reproduce the existing behaviour for stacked event modifiers, which
   multiply. Ruling: the **difficulty and event layers compound their entries** (product of `1 + pct`); every other layer
   adds within itself. This is behaviour-preserving; the ledger footer says "multiply".
4. **Pure ledger** (`js/systems/buffs/buffLedger.js`, `ledgerSources.js`): every source becomes
   `{ sourceKind, sourceId, label, stat, pct, endsAt }`. `sourceId` is the field key, so VIP and HQ both use
   `productionBonus`; rows are keyed on `(sourceKind, sourceId, stat)`. `buffSnapshot.js` (presenter side) reads the
   managers and builds the snapshot.
5. **`worldBuffStat` lives in `js/systems/buffs/`**, not `js/ui/buffs/`: the ledger consumes it and systems must not
   import UI. `buffText` re-exports it.
6. **HUD badge and chip tooltips split out of `NavigationUI`** (already 773 lines): `js/ui/buffs/buffBadge.js` and
   `resourceChipTooltips.js`; NavigationUI only wires them.
7. **`TimerService` opt-in `data-timer-format="duration"`** renders `formatRemaining` (`59m 59s`) instead of whole
   seconds. The default label is unchanged; buff rows opt in.
8. **Stat catalogue** `js/entities/data/buffStats.js` (`{ label, icon, group, order, format: 'pct' }`); `buff_prod_sm` and
   `buff_prod_lg` gain `stat: 'production.all'`. The production boost percentage comes from
   `multiplierFor('production.all')`; label and end time come from an optional `getBoosts?.()` lookup.
9. **Replace-confirm is reachable from every Use path (amended 2026-10-07).** The Buffs panel offers Available slots only for
   stats with nothing running, so it never needs it. `confirmReplace` is its own body-level overlay at
   the new `--z-confirm` token (950), above the legacy inventory panel (z 900/901). Trading Post Supply/Trader Use and the
   legacy `InventoryUI` "Activate" (`inv-use-buff`) now go through `activateBoostItem`, so nothing silently replaces a
   running boost. The Buffs panel/overlay moved to `--z-nav + 20/21` so the floating dock no longer covers it.
10. **Signature gate (2026-10-07).** `resources:ratesChanged` fires every tick while population changes. `buffEvents.js`
   (`subscribeBuffRefresh`) gates it on the six `getRateBreakdown(res).multiplier` values (toFixed(6)); other events stay
   unconditional. Also removes the BuffsUI import cycle.
11. **Tech `defenseBonus` is not mapped.** `tech.js` grants a flat DEF add (`battleSides.js`), not a percent; flat stats are
   outside the % catalogue, so the tech `troop.defense` mapping was dropped (HQ and tech `attackBonus` are fractions and stay).

## Consequences

- Test edits forced by removing the HeroManager buff contract: the `heroManager` L10 test is renamed "deserialize without
  owned does not throw" (its `getActiveBuffs` assertions dropped); dead mock keys removed from `resourceManager.test.js`
  (`getActiveProductionMultiplier`) and `CombatManager.test.js` (`productionBuffMult`); the `heroes-smoke` Inventory
  assertion now expects no buff block (`InventoryBuffSection.js` is deleted).
- Old saves with `heroes.activeBuffs` ignore it (no-legacy).
- New files: `BuffManager.js`, `js/systems/buffs/` (3 modules), `js/systems/resource/productionLayers.js`, 9 modules in
  `js/ui/buffs/`, `css/components/buffs.css`. The manager count in `CLAUDE.md` is 24 now (Steve's call to update).
- Non-obvious: the Overview shows the real compounded production total, not a sum; a `production.all` entry fans out under
  every resource. Gather-load clamp fix, new boost items (gather, attack, march) and a unified modifier pipeline remain
  out of scope.
- The Inventory modal plan (`docs/superpowers/plans/2026-10-03-inventory.md`) builds on `BuffManager` and wires
  `activateBoostItem`.
