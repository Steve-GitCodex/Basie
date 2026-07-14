# 0008 — Grit reskin ships before Phase 4 AI

**Date:** 2026-07 (the pivot that introduced this workstream).

## Context

Systems-wise the game has base + world + marches, but it doesn't *feel* like the target
genre (Last Shelter: Survival): fantasy fiction, bright sci-fi palette, organic-blob
world map, no juice, procedural-tone audio. Several existing systems are also known to
be buggy. Building AI opponents on top of a game that doesn't feel right (and isn't
hardened) risks polishing the wrong thing.

## Decision

Run the grit reskin (`docs/10-design/grit-reskin.md`) before Phase 4: (A) grit art
direction, (B) world map as a huge uniform tile grid, (C) polish/juice — keeping systems
and economy unchanged. Planning happens with the frontier model; execution phases are
sized for cheaper models, one session each. Hardening/bug-audit work runs alongside
(see roadmap Housekeeping).

## Consequences

- No gameplay rebalance or new managers during the reskin; the fixed city blueprint stays.
- Workstream B is a data + renderer replacement — the march/POI state machine must
  survive untouched (ids are save keys).
- Phase 4 AI targets the post-reskin map (tile grid, bigger bounds).
