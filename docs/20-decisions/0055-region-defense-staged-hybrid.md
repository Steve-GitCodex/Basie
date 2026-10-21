# 0055 — Region defense: walls, then telegraph + reinforce/intercept, garrison later

**Date:** 2026-10-09. Design: `docs/10-design/ai-factions.md`.

## Context

Once AI factions can take regions back, regions need a defense. The options were a garrison (chores, ties up troops),
fortification alone (passive), the telegraph alone (punishing), or a hybrid.

## Decision

- **Staged hybrid:**
  1. **Walls / fortification** give each region a baseline, so small raids bounce off.
  2. **Telegraph + respond** is the main way to play. **Reinforce** fights behind the walls (+30%). **Intercept** meets
     the enemy on the road with no wall bonus. The forecast uses the power-levels bands.
  3. **Garrison slots** come later.
- **Home Refuge** can be raided for resources but never captured.
- Losing a region drops its buff and re-locks and re-fogs the regions beyond it (the cascade).

## Consequences

- World foundation work comes first: ownership must allow loss (`captureRegion` hard-codes `'player'` today), the map
  must tint by live owner, a `world:regionLost` event is needed, and in-flight marches must be re-checked.
- The march system needs an owner-neutral core and the ability to intercept.
