# 0039 — Inventory: Mail-style modal, regrouped tabs, shared use flow, batch use

Date: 2026-10-07 · Status: accepted · Spec: `docs/superpowers/specs/2026-10-03-inventory-design.md` ·
Plan: `docs/superpowers/plans/2026-10-03-inventory.md` · Design page: `docs/10-design/inventory.md`

## Context

The bag was a right-hand slide-in panel. Its tabs needed scrolling, five item types appeared in no tab, and
`InventoryUI.js` (433 lines) rebuilt `innerHTML` on every click or update (ADR 0007), which destroyed the hero picker. The
Trading Post (`useOwnedItem.js`) carried its own copy of the use logic and a second hero picker, so an `xp_card` failed with
"Select a hero". There was no Use xN. No real users: no legacy shims, no save migration; the inventory save shape is unchanged.

## Decision

1. **Modal, Mail-style.** `ui:openInventory` toggles `openModal(...)` with a small shell in `js/ui/controllers/InventoryUI.js`
   and parts in `js/ui/inventory/`. `#modal-content` gets `inv-modal-host`; the inner root (`#inv-root`) owns `.inv-modal`.
   The dock floats above the modal overlay, so its panels (Inventory, Mail, Profile) open through `swapModal` in
   `js/ui/uiUtils.js`: it closes the visible modal (running its `onClose`) and shows the new one at once, instead of
   `openModal`'s queue. `openModal` still queues system modals; both take an `onShown` callback that builds the shell once
   its markup is in the DOM. The backdrop listener is tracked and removed on close/swap. `ui:openInventory { itemId }`
   preselects an item (unknown ids fall back to All). The old `#inventory-panel*` markup and slide-in CSS are deleted.
2. **Tab regrouping** (`inventoryTabs.js`): **All · Resources · Speedups · Boosts · Heroes · Other**. Heroes = hero cards,
   fragments, shards, recruit tokens, tier shards, XP bundles and cards; Boosts = `buff`; Other = slot purchase, automation,
   retired recruitment scroll. Every catalogue type maps to exactly one non-All tab (unit-tested). Sort: rarity desc, tier, name.
3. **Shared `useItemFlow`** (`js/ui/items/useItemFlow.js`, routing by `ACTION_OF_TYPE`) is the only place that decides what
   "Use" does: boost -> `confirmReplace` when one is running, resource bundle / XP -> `useItem` plus a toast, speedup ->
   `getActiveQueues` + `SpeedupPicker`, hero items -> open the Inventory. The Trading Post `useOwnedItem.js` is a thin call;
   its private hero picker is deleted. When a hero is needed the Trading Post emits `ui:openInventory { itemId }`.
4. **Batch use.** `InventoryManager.useItem(itemId, { qty, heroId })` applies the effect `qty` times and emits one
   `inventory:updated`; hero cards and `buff` clamp to 1. `previewUse` returns the same shape without mutating. Resource
   bundles report `{ grants, lost }`, where `lost` is the over-cap amount computed from free storage room before granting; the
   detail column shows requested amount and room per resource (amber when something would be lost). Helpers (`BATCHABLE`,
   `xpPerUnit`, `resourceYield`) live in `js/systems/inventory/itemYield.js`, keeping the manager under the god-file limit.
   `previewUse` ignores `heroId` (XP is hero-independent); `useItem` still requires it for XP types.
5. **XP items go through one `awardHeroXP`** (`xp_bundle`, `xp_card`, `hero_fragment`), returning `{ xpAmount }` (batch total). `hero_fragment` XP use is limited to the fragment's `targetHeroId` (summon/awakening currency; enforced in `useItem` and in the detail chips), and `awardHeroXP` returns `gained` so a level-capped hero keeps the items.
   `HeroManager.useFragmentAsXP` / `applyXPCard` are now unused by the inventory; they stay (their own tests in
   `heroProgression.test.js`) and are dead API to remove later.
6. **Patch in place** (ADR 0007): the grid builds tiles once per tab and `patch()` updates quantity text, adds/removes tiles
   and keeps selection; the detail column updates its own nodes, so hero choice and quantity survive `inventory:updated`
   (quantity clamps to the new owned count). A 400 ms cooldown after a use disables the action buttons against double-clicks.

## Consequences

- Test edits forced: the `inventoryManager.test.js` case "useItem on an xp_card delegates to HeroManager.applyXPCard" is
  repointed to `awardHeroXP`; `heroes-smoke` Inventory flow now picks the hero chip first, then clicks Use (and its panel
  selectors point at `#inv-root` and the new tab ids).
- New: `useItemFlow.js`, `itemYield.js`, 7 modules in `js/ui/inventory/`, `css/components/inventory-detail.css`,
  `tests/unit/inventoryTabs.test.js`, `tests/browser/inventory-smoke.mjs` (12 checks).
- Dead CSS left in `inventory.css` was removed (`.inv-speed-hint`, the `.bq-*` / `.slot-*` speed-up row rules and overflow
  overrides); `.speedup-picker*` rules stay because `SpeedupPicker.js` and the Military/Research UIs use them.
- Not built: selling/discarding, auto-use speedups, "Use all" across the bag. Under 720 px the detail column stacks below the grid.
