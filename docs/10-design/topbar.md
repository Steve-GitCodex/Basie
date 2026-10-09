# Top bar (built 2026-10-08)

The header HUD as **one row on wide screens and two rows on narrow ones**, so all five resources stay visible on a phone.
Chosen 2026-10-07 (ADR 0041), built 2026-10-08 (ADR 0047 records the as-built divergences). Mockup (open in a browser):
`docs/10-design/mockups/topbar-mail/topbar-v1.html`, **option B**. Research: `docs/research/topbar-mail-codebase.md` and
`docs/research/topbar-mail-genre.md`.

## Rules

- **Wide (above 700px), one row:** player plate · five resource chips · money · diamond · buff badge.
- **Narrow (700px and below), two rows:**
  - Row 1: player plate on the left; money, diamond and the buff badge on the right.
  - Row 2: the five resources as equal-width cells (`grid-template-columns: repeat(N, 1fr)`).
  - When the cafeteria chip is shown it becomes a sixth cell: `#resource-bar` gets `resource-bar--six` and narrow cells shrink
    so values fit.
- **At 400px and below**, money hides from row 1 and stays reachable from the diamond popover. The buff badge drops its
  timer text and keeps the ring.
- **Responsive `--header-height`:** 48px wide, 86px narrow, set once on `:root` with a media query. It stays the single
  source of truth for toasts, world view, heroes detail, battle trail, sidebar and the map's negative margin. Nothing
  hard-codes header heights.
- **Player plate:** 34px square avatar with an orange border, the full name, `Lv N`, VIP badge, achievements badge, and a
  power slot (see Open questions). The name is capped at 9ch only in the 701-800px band. Tapping it opens the commander
  popover (below), which carries a Profile button.
- **Chip anatomy:** every resource, money and diamond is a single-line pill: an icon, a compact value and a 2px fill bar
  over a dim track (the capacity line).
  - Values use `Intl.NumberFormat` compact notation with `tabular-nums`, at most 4-5 characters (`48.2K`, `2.4M`).
  - `#c-{key}` and `#r-{key}` stay in the DOM and are still written, but are hidden in the header. Exact stock, cap and rate
    live in the popover.
  - **States:** near (90%) colours the chip border and the bar amber; full colours them red and pulses a box-shadow (no
    pulse under reduced motion).
  - Diamond has a green "+". The buff badge label uses `tabular-nums` with a reserved 10ch min-width while active, so the
    countdown never shifts the wallet.
  - **Sizes:** wide icon 18px / glyph 11px / value 14px; at 700px and below 16 / 10 / 13; six cells at 700px and below
    14 / 9 / 12.
- **Tap a chip** to open a popover with exact stock / cap, a fill bar, rate per second, "Full in ..." or "Full - production
  stopped", and actions (Use items; Upgrade storage). **The storage action is disabled until a storage route exists.**
  Money and diamond popovers show the exact amount and a route (Trading Post / Get more). Escape or tapping outside closes it.
- **Cafeteria chip:**
  - Hover tooltip "Cafeteria supplies": food, water, Empty in.
  - Popover: food and water stock, a min-ratio bar (danger below `LOW_STOCK_RATIO` 0.2 in `hudFormat.js`), consumption,
    "Empty in" or "Out of supplies", auto-restock.
  - Actions: **Restock** (fills each instance to cap through `bm.restockCafeteria`) and **Open cafeteria**
    (`ui:openBuildingInfo`). `BuildingManager.getCafeteriaDepletion()` feeds it.
- **Commander popover:** click, tap or Enter on `#player-chip`. Title is the commander name with a crown icon; `Level N`
  (bare number), an XP bar and `XP a / b`; `VIP <VIP_TIERS label>` or `—` when there is no tier; a ghost Profile button
  (`ui:openProfile`). The Power row is omitted until a power stat exists (power plan 3 adds it). The plate has no direct
  profile click and no native `title`; open and close play `ui:click`; the open plate has a subtle tint and a
  `:focus-visible` ring.
- **Buff popover:** tapping `#buff-hud-badge` opens "Active buffs": name + effect and remaining time (one line, tabular),
  shortest first, at most 5 rows then `+N more`, empty state "No active buffs". The ghost "Open buffs" button emits
  `ui:openBuffs` (the full panel). The badge has no direct click and no native title. Rows rebuild only when the live set
  changes; times patch on `tick:ui`.
- **One popover for the whole header:** the 5 resources, cafeteria, money, diamond, plate and buff badge all open the same
  single popover; `ChipPopover._place` measures at `left:0` before clamping.
- **Touch tooltips:** a chip that owns a popover carries `data-tooltip-mouse-only`. `TooltipService` tracks the last pointer
  type and skips those chips for non-mouse input, and while their popover is open (`aria-expanded="true"`). Desktop hover
  keeps the production tooltip; a tap shows only the popover.
- **Tap targets** are at least 32px tall in the header (44px hit area via padding where space allows); text is never below
  11px: 12px values in six-cell mode, 13-14px values elsewhere. Glyph sizes above are icon sizes, not text.
- **Safe areas:** `viewport-fit=cover` and `padding-top: env(safe-area-inset-top)` on the header, with the inset added to
  `--header-height`.
- **Patch in place** (ADR 0007):
  - The `#res-{key}`, `#v-{key}`, `#r-{key}`, `#c-{key}` and `.res-value` contract is kept. `resourceFlyout`, `numberTicker`,
    `resourceChipTooltips` and `ResourceChips` keep working.
  - Money and diamond share the same chip structure as the five resources.
- **Z-order is unchanged:** the header stays at `--z-overlay`, below modals, and the popover uses `--z-popover` (150), above the header and below modals, and closes whenever a modal or panel opens. Opened by keyboard, it focuses its first action and Escape returns focus to the anchor.

## Modules

- `js/ui/hud/`: `hudFormat.js` (compact values, fill states, `LOW_STOCK_RATIO`), `ResourceChips.js`, `PlayerPlate.js`,
  `ChipPopover.js`, `cafeteriaPopover.js`, `commanderPopover.js`. `js/ui/buffs/buffPopover.js` holds the buff popover.
  `NavigationUI` keeps navigation only.
- CSS: `css/layout/header.css` (header, plate, chips, tiers) and `css/components/chip-popover.css` (popover). The overridden
  `resources.css` breakpoints, `.hud-rail*` and `header-brand/logo/title` are gone; there is no `#hud-rail`.
- The dead `_refreshStatusBar` `sb-*` writes and the `#btn-settings` binding are removed.

## Built to extend

A sixth or seventh resource gets an equal-width cell in row 2. The `--six` class pattern generalises (a modifier per cell
count that shrinks the cell sizes); never hard-code the count in JS.

## Open questions

- **Power:** no player power stat exists (only campaign `lineupPower`). The plate reserves the slot; the formula (troops,
  heroes, buildings, research) is a game-design call for later. Until then the slot is hidden.
- The priority order if a sixth or seventh resource is ever added to row 2.

Tests: `tests/browser/hud-smoke.mjs` (with `hudCafeteriaSteps.mjs`) checks, at 1280 and 360 widths, that all resource chips
are visible and inside the viewport, that the header height matches `--header-height`, that the chip popover opens and
closes, that a fly-out reaches its chip, the cafeteria chip, and touch-only popovers (steps in `hudCafeteriaSteps.mjs`, `hudCommanderSteps.mjs`,
`hudBuffSteps.mjs`). Unit: `tests/unit/hudFormat.test.js`, `cafeteriaPopover.test.js`, `commanderPopover.test.js`,
`buffPopover.test.js`. Retest the tutorial after header changes (`navigation.md`).
