# 0005 — Territory ownership is a free owner-string

**Date:** back-filled 2026-07-15 (world map MVP).

## Context

Phase 4 plans AI factions that grow with the player and re-capture territory. A boolean
`playerOwned` flag would need a migration the moment AI lands.

## Decision

Region owners (`_regionOwner`), outpost owners (`_outpostOwner`), and `startOwner` in map
data are free strings: `'player'` | factionId | contested/neutral. Capture logic is
event-driven (`world:regionCaptured`, `world:outpostCaptured`) so a future `AIManager`
can flip owners through the same paths the player uses.

## Consequences

- No save migration needed for Phase 4; AI factions reuse the capture pipeline.
- Consumers must compare against `'player'` explicitly, never truthiness.
- Faction definitions in `worldMap.js` seed the future AI opponents.
