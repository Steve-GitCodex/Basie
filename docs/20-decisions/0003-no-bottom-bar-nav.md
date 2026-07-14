# 0003 — No bottom tab bar: floating dock + flip + More grid

**Date:** back-filled 2026-07-15 (Phase 1 UI redesign).

## Context

The Phase 1 redesign first replaced the sidebar with a bottom tab bar, but the bar
competed with the city canvas and didn't scale as views multiplied.

## Decision

Remove the bar entirely. Navigation is: a bottom-center `#floating-dock`
(Inventory · Base⇄World **flip** · Mail), a bottom-right More-grid FAB (quests, combat,
economy, events, Build, disabled Arena), and **building clicks** for building-tied views
(Heroes/Research/Military/Training via `BUILDING_VIEW_ACTION` tooltip actions). The old
slide-up building detail panel was deleted in favor of the Buildables catalog +
`BuildingInfoPanel`.

## Consequences

- The flip button shows the *destination* view and is locked until a Rally Point exists.
- Tutorial spotlights target building tiles (`.base-tile[data-building-id]` proxies),
  not nav-button ids; retest tutorials after any nav layout change.
- Building-tied badges redirect to the flip/Base instead of a tab.
