# 0056 — Three hand-authored majors plus generated rebel factions; bases visible through fog

**Date:** 2026-10-09. Design: `docs/10-design/ai-factions.md`.

## Context

Steve wants the main opponents plus smaller groups that start as rebel camps and grow strong if left unchecked. Most of
the AI therefore can't be hand-made. Earlier mockups also showed that marches appear "from nowhere" when a faction's
home is fogged.

## Decision

- **3 major factions** are hand-authored, keeping the existing ids `bandits` and `goblins` and adding the new Iron
  Covenant.
- **Minor factions** are generated from archetypes (raiders, cultists, deserters). At most 3 are alive at once. Their
  lifecycle is camp → settlement → stronghold, and a stronghold can take a region. A `tier` field leaves room for a minor
  to rise to major later.
- **Every major has a physical home base.** Bases are **known landmarks visible through fog**, so every AI march has a
  visible origin.

## Consequences

- Region ownership for the Iron Covenant is an open question. The proposal is Vulture Ridge + Behemoth Spire.
- Name lists and archetype ranges are data. A guard test covers a synthetic extra archetype.
