# 0054 — AI fairness: one countdown, locked outcomes, strikes wait for the player

**Date:** 2026-10-09. Design: `docs/10-design/ai-factions.md`.

## Context

The AI must pressure the player without feeling cheap, and without punishing being offline in a single-player game.
The mobile 4X norm is that NPCs never hit offline players and that losses are capped.

## Decision

- At most **one hostile countdown** on the player at a time, across all factions. Others queue.
- **The outcome is locked when it is telegraphed.** What decides the result is the player's response (reinforce,
  intercept, tribute, raiding the camp), not dice.
- **A calm period after each strike:** 4h after a raid, 12h after an assault.
- **Offline (simulated catch-up, capped):**
  - AI growth, plans, gifts and AI-vs-AI results resolve while the player is away.
  - A hostile strike never lands offline. On return, it gets a fresh countdown of at least 45 minutes that **starts
    when Welcome Back is closed**.
  - Welcome Back lists the threat first.
  - Both buttons are safe, because gains are credited before the modal opens:
    - **Defend now** jumps to the threatened region.
    - **Continue** stays put, and the threat stays visible in the banner, Marches, Events, the More dot and a toast.
- Difficulty reads combat power and player level, with diminishing returns.

## Consequences

- Every faction and event system needs an `applyOffline` that stops before a strike.
- The Welcome Back modal moves out of `main.js` into its own module.
