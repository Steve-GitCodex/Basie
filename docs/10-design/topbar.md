# Top bar (target design, not built)

The header HUD as **one row on wide screens and two rows on narrow ones**, so all five resources stay visible on a phone.
Chosen 2026-10-07 (ADR 0041). Mockup (open in a browser): `docs/10-design/mockups/topbar-mail/topbar-v1.html`,
**option B**. Research: `docs/research/topbar-mail-codebase.md` and `docs/research/topbar-mail-genre.md`.

## Rules

- **Wide (above 700px), one row:** player plate · five resource chips · money · diamond · buff badge.
- **Narrow (700px and below), two rows:**
  - Row 1: player plate on the left; money, diamond and the buff badge on the right.
  - Row 2: the five resources as equal-width cells (`grid-template-columns: repeat(N, 1fr)`).
  - When the cafeteria chip is shown it becomes a sixth cell.
- **At 400px and below**, money hides from row 1 and stays reachable from the diamond popover. The buff badge drops its
  timer text and keeps the ring.
- **Responsive `--header-height`:** 48px wide, 86px narrow, set once on `:root` with a media query. It stays the single
  source of truth for toasts, world view, heroes detail, battle trail, sidebar and the map's negative margin. Nothing
  hard-codes header heights.
- **Player plate:** avatar, name (visible again; hidden today), `Lv N`, VIP badge, achievements badge, and a power slot
  (see Open questions). Tapping it opens the profile, as today.
- **Resource chips:**
  - Each chip shows an icon, a compact value and a capacity line underneath.
  - Values use `Intl.NumberFormat` compact notation with `tabular-nums`, at most 4–5 characters (`48.2K`, `2.4M`).
  - The capacity line turns **amber at 90%** and red with a slow pulse at 100%. The pulse respects reduced motion.
- **Tap a chip** to open a popover with exact stock / cap, a fill bar, rate per second, "Full in …" or "Full — production
  stopped", and actions (Use items, Upgrade storage). This replaces hover-only rate and cap, so touch players can see them.
  Money and diamond popovers show the exact amount and a route (Trading Post / Get more). Escape or tapping outside closes it.
- **Tap targets** are at least 32px tall in the header (44px hit area via padding where space allows); text is never below
  11px.
- **Safe areas:** `viewport-fit=cover` and `padding-top: env(safe-area-inset-top)` on the header, with the inset added to
  `--header-height`.
- **Patch in place** (ADR 0007):
  - Keep the `#res-{key}`, `#v-{key}`, `#r-{key}`, `#c-{key}` and `.res-value` contract. `resourceFlyout`, `numberTicker`,
    `resourceChipTooltips` and `NavigationUI._renderResources` keep working.
  - Money and diamond adopt the same chip structure as the five resources.
- **Z-order is unchanged:** the header stays at `--z-overlay`, below modals, and the popover uses `--z-tooltip`.

## Modules (planned)

- Header rendering moves out of `NavigationUI.js` (773 lines) into `js/ui/hud/` (`resourceChips`, `playerPlate`,
  `chipPopover`); `NavigationUI` keeps navigation only.
- Header CSS is consolidated into `hud.css` + `header.css`. The overridden `resources.css` breakpoints, `.hud-rail*`,
  `header-brand/logo/title` and the duplicate `.resource-chip:hover` are deleted.
- The dead `_refreshStatusBar` `sb-*` writes and the `#btn-settings` binding are removed.

## Open questions

- **Power:** no player power stat exists (only campaign `lineupPower`). The plate reserves the slot; the formula (troops,
  heroes, buildings, research) is a game-design call for later. Until then the slot is hidden.
- The priority order if a sixth or seventh resource is ever added to row 2.

Tests: a new `tests/browser/hud-smoke.mjs` that checks, at 1280 and 360 widths, that all resource chips are visible and
inside the viewport, that the header height matches `--header-height`, that the chip popover opens and closes, and that a
fly-out reaches its chip. Retest the tutorial after the change (`navigation.md`).
