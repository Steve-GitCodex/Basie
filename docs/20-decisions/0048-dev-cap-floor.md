# 0048 — Dev sessions: 500M starting grant under a 2B cap floor

**Date:** 2026-10-08.

## Context

The `?dev` preset (ADR 0014) flooded resources by raising caps to 1e9 and calling `add(1e7)` before every build. Sandbox
`add()` multiplies by 10 and sandbox `spend()` is free, so stockpiles piled up to hundreds of millions while every later
`_recalculateAllCaps()` dropped caps back to the HQ Lv.3 building values. The result was a stockpile far above its cap,
so production never ran and the HUD showed nonsense ratios.

## Decision

- A dev session grants an exact stockpile of `DEV_GRANT` (500M) per resource via a new `ResourceManager.setAmount()`.
- `ResourceManager.setCapFloors()` pins a minimum cap per resource that `setCap()` never goes below. Dev sessions set
  the floor to `DEV_CAP` (2B). If building caps are higher, the
  building caps apply.
- Floors are transient and never serialized. `main.js` re-asserts them with `applyDevCapFloors()` on every dev boot,
  so saved dev slots keep the floor too.

## Consequences

- Dev stockpiles sit at a quarter of the cap, leaving visible room for production and rewards to fill.
- Normal sessions are unaffected. `_capFloors` stays empty, so `setCap()` behaves as before.
- Covered by `tests/unit/resourceManager.test.js` (floor semantics, `setAmount`) and `tests/browser/dev-smoke.mjs`.
