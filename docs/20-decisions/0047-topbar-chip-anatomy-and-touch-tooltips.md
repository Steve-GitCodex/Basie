# 0047 — Top bar as built: fill-bar chips, mouse-only tooltips, cafeteria popover

Date: 2026-10-08 · Status: accepted (built) · Design page: `docs/10-design/topbar.md` · Extends ADR 0041

## Context

ADR 0041 and its plan described each chip as an icon, a compact value and a capacity line with cap text. Building it against
mockup option B and testing on touch changed four things:

- Cap and rate text made the chips too wide for six cells at 360px.
- On touch, the production hover tooltip fired on tap and covered the chip popover.
- The cafeteria chip (food and water supplies) had no way to show depletion or restock from the header.
- Icon, glyph and value sizes needed a deliberate balance; four variants were rendered and variant B was chosen.

## Decision

1. **Chips are single-line pills.** An icon, a compact value and a 2px fill bar over a dim track. `#c-` and `#r-` stay in the
   DOM and are still written but hidden in the header; exact stock, cap and rate live in the popover. Near and full colour the
   chip border and the bar; full pulses a box-shadow (none under reduced motion).
2. **Mouse-only tooltips on popover chips.** Chips that own a popover carry `data-tooltip-mouse-only`. `TooltipService` tracks
   the last pointer type and skips those chips for non-mouse input, and while their popover is open (`aria-expanded="true"`).
3. **Cafeteria chip.** A hover tooltip and a popover (stock, min-ratio bar with `LOW_STOCK_RATIO` 0.2 in `hudFormat.js`,
   consumption, Empty in, auto-restock) with Restock and Open cafeteria. Module `js/ui/hud/cafeteriaPopover.js`;
   `BuildingManager.getCafeteriaDepletion()` added. When shown, `#resource-bar` gets `resource-bar--six`.
4. **Sizes:** wide icon 18 / glyph 11 / value 14; at 700px and below 16 / 10 / 13; six cells at 700px and below 14 / 9 / 12.
   The buff badge label reserves a 10ch min-width with `tabular-nums` while active. The plate shows the full name, capped at
   9ch only at 701-800px.

5. **Commander and buff popovers.** The player plate (`js/ui/hud/commanderPopover.js`: name, level, XP, VIP, Profile button) and
   the buff badge (`js/ui/buffs/buffPopover.js`: active buffs, Open buffs button) become popover anchors on the same single
   popover. Their former direct clicks (profile, buffs panel) and native titles are removed. The Power row waits for a power
   stat.

## Consequences

- The profile and the buffs panel are one tap further away (plate or badge, then the button).
- The commander popover has no Power row until power plan 3 adds the stat.
- Cap text is not visible in the header; players read exact numbers from the popover.
- **Debt (ADR 0001 drift):** cafeteria Restock is a UI-side write through `bm.restockCafeteria`, same as `TileTooltip`. A later
  `ui:restockCafeteria` intent event or `bm.restockAllCafeterias()` would fix it.
- Pen input counts as non-mouse, so pen users get no hover tooltip on popover chips.
- `emptyInSec` takes the max over instances, which overstates when stock is uneven.
- A seventh cell would need its own `--seven` size tier, following the `--six` pattern.
