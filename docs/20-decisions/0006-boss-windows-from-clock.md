# 0006 — World-boss windows derived from the clock, not stored timers

**Date:** back-filled 2026-07-15 (Phase 2 fast-follows).

## Context

Windowed content (a boss open every N hours for M minutes) could be modeled with
serialized open/close timestamps, but stored timers drift, need reconcile entries, and
break when the schedule is tuned.

## Decision

`worldBoss.bossWindow` computes open-state purely from the current time and the POI's
`window:{everyMs,openMs}` config. Only `defeatedWindowStart` (one kill per window) is
persisted. The transient `_bossOpen` map exists solely to detect open/close transitions
for events and is never serialized.

## Consequences

- Schedule tuning in `worldMap.js` applies to existing saves automatically.
- Reload mid-window resumes correctly with zero reconcile logic.
- The same derive-from-clock pattern is the default for future windowed/scheduled
  content (map events, Phase 5).
