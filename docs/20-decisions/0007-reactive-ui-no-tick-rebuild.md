# 0007 — Reactive UI: never innerHTML-rebuild on a tick

**Date:** back-filled 2026-07-15.

## Context

Early controllers re-rendered whole panels on timer ticks, destroying live countdowns,
open popups, input focus, and hover state — and burning layout work every second.

## Decision

Presenters patch in place over live progress: update text nodes/attributes/classes via
cached selectors (the NavigationUI/`TimerService` idiom). Full innerHTML rebuilds are
allowed only on discrete state changes, and never while a popup inside the subtree is
open. DOM selectors are cached in `init()`, never re-queried per render.

## Consequences

- Countdown/progress surfaces (march panel, build queue, boss windows) must expose
  patchable nodes.
- A future state-store ("Approach 2") may replace hand-patching; until then this rule is
  binding for every new surface.
