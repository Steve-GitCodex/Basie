# Inventory (built 2026-10-07)

The bag as a Mail-style modal: category rail, rarity grid, and a detail column that owns every use flow. Built per ADR 0039
(`docs/20-decisions/0039-inventory-modal.md`); spec `docs/superpowers/specs/2026-10-03-inventory-design.md`. Mockup (open in
a browser): `docs/10-design/mockups/inventory-buffs/inventory-v1.html`, **option B (centered modal)** plus the per-type detail
states. Research: `docs/research/inventory-buffs-codebase.md`.

> **Pending change (ADR 0046, not built):** XP tomes, XP cards and fragments-as-XP move off the Inventory. Their detail
> shows "Level a hero ›" / "Open <hero> ›" and the hero picker is removed. See `hero-levelup.md`.

## Rules

- Opened by the dock `#btn-inventory` (toggle) or `ui:openInventory { itemId? }` (Trading Post uses this for hero items).
- Same frame as Mail (ADR 0042): `--panel-modal-w/h` on desktop; full width down to `--dock-clearance` at 700px and below.
  Opens through `swapModal(html, onClose, onShown)`: pressing a dock button while Mail, Profile or the Inventory is up
  replaces that modal instead of queueing behind it (dock buttons sit above the overlay).
- Tabs: **All · Resources · Speedups · Boosts · Heroes · Other** (`inventoryTabs.js`; Heroes holds cards, fragments, shards,
  tokens, XP items; Other holds slot purchase, automation, retired scroll). Rail shows counts, dims empty tabs, and a NEW dot
  per tab cleared on visit. Sort: rarity desc, tier (`_tN` for bundles, `skipSeconds` for speedups, else none), name.
- Header: title, boosts chip (`N boosts · shortest`, opens the Buffs panel), close.
- Grid tiles are built once per tab and patched in place; rarity stripe, tier tag, NEW marker. When the selected item runs out
  the next tile in the tab is selected, and an item arriving in an empty tab is selected; an empty tab shows "Get more in Supply".
- Under 720 px the detail column stacks below the grid (one column, scrollable) instead of hiding.
- Detail column per type: quantity stepper + slider + preview line (`previewUse`) + Use 1 / Use xN for bundles and XP items
  (hero chips choose the target; a hero fragment offers only its own hero, and when that hero is unowned shows owned / needed
  fragments plus the Recruit route; heroes at the level cap gain nothing, so the items are kept and the use fails with "Hero is at max level."); speedups show the running job and open `SpeedupPicker` ("Nothing to speed up" otherwise);
  boosts show the replace warning and Activate / View buffs; hero cards offer Recruit (a disabled "Owned" / "All Owned" when nothing is left to recruit); retired scroll is a disabled "Retired".
- Over-cap bundles preview per resource: requested amount, and the free room in amber when something would be lost.

## Modules

- `js/ui/controllers/InventoryUI.js` - shell, new-item set, dock badge, event forwarding.
- `js/ui/inventory/` - `inventoryTabs.js` (pure), `InventoryRail.js`, `InventoryGrid.js`, `InventoryHeader.js`,
  `InventoryDetail.js`, `detailBlocks.js`, `inventoryModalHtml.js`.
- `js/ui/items/useItemFlow.js` - shared use routing (Inventory and Trading Post).
- `js/systems/inventory/itemYield.js` - batch helpers for `InventoryManager.useItem` / `previewUse`.
- CSS: `css/components/inventory.css` (shell, rail, grid; also the shared `.speedup-picker*` rules) and `inventory-detail.css`.

## Not built

Selling/discarding, auto-use speedups, "Use all", a per-second boost countdown in the header chip (refreshes on events).

Tests: `inventoryManager` (batch, lost report, previewUse) and `inventoryTabs` unit files; `tests/browser/inventory-smoke.mjs`.
