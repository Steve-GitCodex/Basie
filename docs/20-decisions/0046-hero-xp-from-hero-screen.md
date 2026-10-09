# 0046 — Hero XP items are spent from the hero screen, not the Inventory

Date: 2026-10-07 · Status: accepted · built 2026-10-08 · Design page: `docs/10-design/hero-levelup.md` ·
Mockup: `docs/10-design/mockups/hero-xp/hero-levelup-v1.html` · Partly supersedes ADR 0039 decision 3

## Context

ADR 0039 made the Inventory the place where hero items are used. An XP card shows a wrapping row with a chip for every
owned hero:

- no limit, sort or search;
- the first hero in roster order is preselected;
- heroes at max level are still listed;
- 11px chips (`detailBlocks.js:18-25`, `inventory-detail.css:48-61`).

With about 30 heroes the chips fill 8–12 rows and push Use below the fold, and the default target is usually wrong.
The hero detail page already has one-at-a-time Tome buttons (`HeroDetailPanel.js:20-24,177-222`), but they don't
cover XP cards or fragments.

## Decision

1. **XP items are spent only from a hero's page.** This covers `xp_bundle`, `xp_card`, and `hero_fragment` used as XP.
2. **A Level up sheet on the hero detail** replaces the inline Tome buttons. It contains:
   - every owned XP item with a stepper;
   - a preview ("Lv 21 → 24", XP left over, and a waste warning at the cap);
   - **Next level** and **Fill to cap** auto-pick: largest items first without going over, then the smallest item to
     finish. It overshoots by at most one smallest item.
   - fragments, listed separately and never auto-picked (they are the awakening and summon currency).
3. **The Inventory** shows XP items with **Level a hero ›** (opens the Heroes roster). A fragment shows
   **Open <hero> ›** (opens that hero's page).
4. **The Trading Post** "Use" on these items routes the same way. `useItemFlow`'s `'hero'` action becomes a navigation
   to Heroes, not `ui:openInventory`.
5. **Built to extend:** the sheet lists every item with `xpPerUnit(cfg) > 0` (`itemYield.js`). New XP item types or
   tiers appear automatically.

## Consequences

- The Inventory hero picker (`chipsHtml`) and its CSS are deleted. `InventoryDetail`'s `'hero'` branch becomes a route
  button.
- `inventory-smoke` / `heroes-smoke` checks that use an XP card from the Inventory are re-pointed to the hero sheet,
  by contract.
- Batch use reuses `InventoryManager.useItem(itemId, { qty, heroId })` and `previewUse`. The sheet applies one
  `useItem` per item type, with the totals previewed through hero XP math.
- The hero level cap remains Hero Quarters-based (ADR 0044: Hero Quarters × 4).
