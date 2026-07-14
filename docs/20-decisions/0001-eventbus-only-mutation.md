# 0001 — Cross-manager mutation flows only through the EventBus

**Date:** back-filled 2026-07-15 (decision predates the wiki).

## Context

Basie has no frameworks; 21 system managers and 17 UI presenters coexist in one runtime.
Direct cross-manager writes would create hidden coupling and untraceable state changes.

## Decision

All cross-system communication flows through the `EventBus` singleton
(`domain:action` lowercase names). Managers never mutate another manager's state; UI
controllers are read-only presenters that emit `ui:*` intents and re-render from manager
state on result events. Managers may hold constructor-injected references for **reads**.

## Consequences

- Every active event name is discoverable via `grep eventBus.emit js/`.
- New features wire in by listening, not by patching other managers.
- Import order in `main.js` is load-bearing (dependencies instantiated before
  dependants); insert new managers at the correct position, never re-order.
