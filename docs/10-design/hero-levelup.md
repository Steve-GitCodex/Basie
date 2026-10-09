# Hero level-up sheet (built 2026-10-08)

Hero XP items are spent from the hero's own page, through a **Level up** sheet. The Inventory and Trading Post route
there; they never pick a hero. Decided 2026-10-07 (ADR 0046). Mockup:
`docs/10-design/mockups/hero-xp/hero-levelup-v1.html`.

**Built (2026-10-08).** Three deviations from the rules below:
- On desktop the sheet is a viewport-fixed 420px right-hand panel, not literally over the info column (phone, 700px and below, is the bottom sheet as designed).
- Use issues one `useItem` per row and stops before a row once the hero reaches the level cap; the remaining items stay owned.
- `hero:levelUp` events are coalesced per hero per tick into one "<name> Lv a → b" toast (also for battle XP); the sheet itself toasts "+N XP" only when no level was crossed.

## Rules

- **Entry:** the hero detail XP block shows a **Level up** button next to the XP bar. It reads **Max level** and is
  disabled at the cap. It replaces the inline Tome buttons.
- **Sheet:** a panel over the info column on desktop, a bottom sheet on a phone.
  - **Header:** the hero, tier and "cap Lv N (Hero Quarters M)".
  - **Preview:** "Lv a → b", +XP, and the bar showing the gain. The line under it is either "x / y XP into Lv b" or
    "⚠ N XP would be wasted at the cap".
  - **Quick picks:** **Next level**, **Fill to cap** and **Clear**.
    - Auto-pick uses non-fragment items: largest first without going over the need, then one smallest item to finish.
  - **Item rows:** every owned item with `xpPerUnit > 0` shows its icon, name, "+XP · own N" and a −/qty/+ stepper. Tap
    targets are at least 32px and text at least 12px.
    - Order: Tomes and XP cards by XP ascending, then a **Fragments** group (this hero's fragments only), labelled
      "also used for awakening · never auto-picked".
  - **Use · Lv a → b** applies the selection with one `useItem(itemId, { qty, heroId })` per item, then closes the sheet
    with a "Lv a → b" toast.
- **XP math** uses the hero curve `round((100 + 20(L−1)) × tierMult)` and the Hero Quarters cap, through a pure
  `heroXpPlan` module shared by the preview and auto-pick.
- **Inventory:** XP tomes and cards show a description, the owned count, "Used from the hero screen" and
  **Level a hero ›** (`ui:navigateTo 'heroes'`). A fragment shows **Open <hero> ›** (`ui:navigateTo 'heroes'` then `ui:openHeroDetail heroId`).
- **Trading Post:** "Use" on these items routes the same way.

## Built to extend

New XP items, tiers or fragment heroes appear in the sheet with no code change, because the list is
`INVENTORY_ITEMS` filtered by `xpPerUnit > 0`. A hero cap change (ADR 0044) flows through `levelCap()`.
