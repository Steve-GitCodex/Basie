# 0057 — One event model with four sources, paced by a director

**Date:** 2026-10-09. Design: `docs/10-design/world-events.md`. Replaces the `EventManager` stub.

## Context

Steve wants events that create pressure, make the world feel alive, and give a liveops rhythm. Today `EventManager` is
a stub: null timestamps, a single objective hook, one event at a time.

## Decision

- **One event model** (stages, objectives, a threshold reward track, effects, an optional map anchor, threat cost,
  cooldown, exclusion group, offline policy) with **four sources**:
  - **faction** plans;
  - **world** happenings (storm, herd migration, supply drop, boss waking, contamination);
  - a **seeded weekly calendar**: one featured event for 5–7 days, then 2–3 quiet days. A personal best plus an AI
    faction's par score stands in for a leaderboard;
  - **milestones**.
- **The director** sets a threat budget from combat power with diminishing returns and runs build-up → peak → calm
  cycles. Its failsafe forces pressure through events when the world has been quiet too long. Limits: 1 hostile
  countdown, 1 featured event, 3 other visible events; the rest queue.
- **Division of labour:** the director decides *how much* pressure there is; the factions decide *what* to do with it.
- `WorldEventManager` replaces `EventManager` outright (no legacy compatibility). The Events view is reworked into
  Active / Calendar / History.

## Consequences

- Templates, calendar weeks, world events and milestones are data appends, each with a guard test.
