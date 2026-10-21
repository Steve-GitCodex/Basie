# 0053 — Standing as fading named reasons, separate trust, light two-way diplomacy

**Date:** 2026-10-09. Design: `docs/10-design/ai-factions.md`.

## Context

The genre research found that a single hidden attitude number is what players complain about (Civ V/VI), while
breakdowns of named modifiers with decay feel fair (Civ IV, Stellaris, CK3, Total War). Steve wants AI diplomacy with
the player, gifts included, but **friendship must not be permanent**.

## Decision

- **Standing** runs from −100 to +100 in 5 bands (Hostile, Unfriendly, Neutral, Friendly, Allied). It is the sum of
  named reasons, each with its own fade timer, and is shown as a breakdown.
- **Trust** runs from 0 to 50, shown as 5 pips. It is separate and moves slowly; betrayal reads trust. Friendship drifts
  back toward the baseline and can break. Betrayal is foreshadowed.
- **Diplomacy is two-way and light.**
  - The AI sends gifts, truce offers, warnings and ultimatums through a new **Mail → Diplomacy** category. Each letter has
    an expiry, Accept/Decline, and its consequences shown up front.
  - The player can send tribute, propose a truce, or request help. Each has a cost and a shared cooldown.
  - Formal pacts are deferred, but the data model leaves room for them.

## Consequences

- Mail gains actions and expiry. It has neither today, so this needs a mail-actions plan.
- Mail attachments must allow non-resource rewards.
