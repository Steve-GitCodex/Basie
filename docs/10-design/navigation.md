# Navigation & Shell (shipped design)

There is **no bottom tab bar** (ADR 0003). The shell is a game HUD layered over the city.

## Surfaces

- **`#floating-dock`** (bottom-center): `#btn-inventory` · `#nav-flip` · `#btn-mail`.
- **`#nav-flip`** — single Base⇄World switch. `NavigationUI` tracks `_primaryView`;
  `_updateFlipButton()` shows the *destination* (on Base it reads "World"). Locked until
  a Rally Point exists.
- **`#more-fab`** (bottom-right): `#nav-more` opens the `.more-grid` popover —
  `nav-quests`, `nav-combat`, `nav-economy`, `nav-events`, **Build** (`#nav-build`),
  disabled Arena. Status hub: `#nav-build-dot` when something's buildable + aggregate
  `#nav-more-dot` on the closed FAB.
- **Building-tied views** (Heroes/Research/Military/Training) are reached by clicking the
  owning building — `TileTooltip` actions from `BUILDING_VIEW_ACTION` (see
  `city-view.md`). Building-tied badges redirect to the flip/Base.
- View switching is centralized in `NavigationUI._switchView` / `ui:navigateTo`.
- HUD: resource bar is `.resource-chip` components (`hud.css`), header actions, player
  chip, floating `#hud-rail`. Icons are the unified SVG `icon()` system (50 SVGs in
  `assets/icons/svg/`) — no emoji in UI.

## Conventions

- DOM ids: `#view-{viewName}`, `#nav-{viewName}`; events `domain:action` lowercase.
- Tutorial steps highlight by element id or `highlightSelector`
  (`.base-tile[data-building-id=...]` via `#city-proxy-layer`) — retest the tutorial
  after any nav layout change (spotlight coordinates shift).
- z-index: `--z-overlay` is the shell layer; sidebars/modals must stay above it — check
  the `variables.css` z-index ladder before adding fixed/absolute elements.

## Reactive UI rule (binding — ADR 0007)

Never innerHTML-rebuild on a tick or over live progress/open popups; patch text/attrs in
place (the NavigationUI/TimerService idiom). Full rebuilds only on discrete state
changes, and never while a popup within the subtree is open.
