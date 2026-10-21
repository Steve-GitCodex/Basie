# 0052 — AI factions: utility brain with telegraphed, staged plans

**Date:** 2026-10-09. Design: `docs/10-design/ai-factions.md`. Seeded by ADR 0005.

## Context

Phase 4 needs AI opponents that feel intelligent but are openly AI and rule-based, with no LLM. We considered three
approaches: behaviour trees (one tree per personality, poor at adaptation), a goal planner (GOAP: emergent but hard to
debug and to telegraph), and utility AI. A throwaway simulator (`docs/research/ai-factions-prototype.md`) ran 30-day
campaigns against aggressive, mixed and peaceful scripted players.

## Decision

- **Utility AI.** A faction re-thinks every ~7 game minutes. It scores the actions it can take as personality weights ×
  world-state considerations through response curves, with a compensation factor for the number of considerations. It
  picks at random among actions within 12% of the best score. The top factor is shown to the player as the plan's "why".
- **Plans run in stages:** probe → massing (a war camp on the faction's own border, fed by a supply column) → march →
  battle → aftermath. The massing countdown runs to departure.
- **Rules carried over from the simulator:**
  - per-action cooldowns, and a ×0.6 penalty for repeating the last action;
  - strength stays in a band around player power (a bonus within −0.4…+0.3, never compounding);
  - an explicit idle action;
  - the territory bonus is capped at 3 regions;
  - the AI only launches strikes it expects to win, judged from its remembered reinforce rate with an optimistic prior
    (so it probes first);
  - diplomacy needs a motive.

## Consequences

- Personality is data, so new factions are data appends. The pure scoring and plan modules get unit tests, with
  fixtures for a 4th faction.
- Open tuning: assault countdowns of 60–90m, raids that take loot in proportion to their margin, and more AI-vs-AI
  activity.
