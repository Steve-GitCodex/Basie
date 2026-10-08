# 0041 — Top bar: two tiers on narrow screens, responsive header height

Date: 2026-10-07 · Status: accepted (design; not built) · Design page: `docs/10-design/topbar.md` ·
Mockup: `docs/10-design/mockups/topbar-mail/topbar-v1.html` (option B)

## Context

The header has no breakpoint below 768px (`docs/research/topbar-mail-codebase.md`).

- `.header-actions` never shrinks, so resource chips that don't fit sit in a scroll with the scrollbar hidden, where players
  can't reach them.
- Rate and cap only show on hover, so they are invisible on touch.
- The player name is hidden.
- `fmt()` gives values anywhere from 1 to 6 characters wide.

Three options were prototyped:

- One strip with a +N overflow chip, which keeps the header at 48px.
- Two tiers on narrow screens.
- A Last Shelter-style commander plate.

## Decision

Build **two tiers** (option B).

- Wide screens keep one row.
- At 700px and below, the header splits into a row with the player plate and currencies, and a row of equal-width resource
  cells.
- `--header-height` becomes responsive (48px / 86px plus the safe-area inset) and stays the only source for every consumer.
- Chips show compact values. Tapping a chip opens a popover with the exact stock, cap, rate and time until full.
- Money and diamond share the resource chip structure.

Chosen because every resource stays visible on a phone with no overflow logic. It also matches the compact category-hub Mail
(ADR 0040).

## Consequences

- The phone header is about 86px, so the map shows less on a phone. Every `--header-height` consumer has to be checked at
  both heights:
  - `notifications.css`
  - `world-view.css`
  - `heroes-detail.css`
  - `battle-trail.css`
  - `sidebar.css`
  - the map's negative margin in `hud.css`
- Header rendering leaves `NavigationUI.js` for `js/ui/hud/`.
- The power readout is reserved but hidden until a player power stat is designed.
- The `#res-*` id contract is kept, so the fly-out, tick-up and tooltips keep working.
