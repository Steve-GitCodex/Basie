# 0045 — Power stat and player level model

Date: 2026-10-07 · Status: accepted (design; not built; numbers re-fitted to HQ 30 by ADR 0044) · Design page: `docs/10-design/power-levels.md` ·
Numbers: `docs/research/power-levels-formula.md`

## Context

- No power stat exists.
- Player level gates nothing; real progression comes from building and HQ levels.
- The level curve is `500×1.4^(L-1)` with no cap, which stalls.
- The level-up mail promises unlocks that don't exist.
- March wins give full XP on every win.
- `lineupPower` (`hp + 10·atk`, summed) measures monsters only and mis-ranks stages: its log-sd against resolver
  thresholds is 0.44.

## Decision

1. **Power is combat-weighted.**
   - Troop power per unit is `√(H·D)`, computed from the same effective stats the resolver builds.
   - Only assigned heroes count, through auras and strikes.
   - Buildings and non-combat research are converted to troop equivalents and capped at 25%.
   - Buffs and VIP are excluded. Wounded troops don't count until healed; marching troops do.
   - Power is derived and never saved, and it emits `power:changed`.
2. **Enemies use the same metric.** `rawEnemy` (waves combined as root-sum-square) replaces `lineupPower` in
   `stageGenerator`. Recommended power is 1.2 × enemy power. The bands are 1.2 and 0.9, and the simulated estimate
   stays the authority.
3. **Player level is an activity and rewards meter.**
   - The curve is `80 + 150(L−1) + 5(L−1)²`, capped at 5 × HQ, with a 5-level XP bank that pays out on HQ upgrade.
   - New XP sources: buildings, research and training (daily cap).
   - March XP gets per-target daily limits. Survival gives XP only for new-best waves.
4. **Rewards and level-up card.**
   - Rewards: per level, money scaled to the HQ cap, plus diamonds and speedups; milestones every 5 levels.
   - They are paid through a level-up card that replaces the mail.
   - The cards queue during critical moments and release as a deck, one card per level, with Collect all.
5. **Display.**
   - The top-bar slot and the profile breakdown (option A).
   - A squad-vs-enemy gauge, attached to the target on the world map and placed inside the campaign stage panel.
   - Battle reports.

## Consequences

- **Monsters are 15×–1,350× too weak for the new metric**, so recommended power is meaningless without the rescale
  in ADR 0043. That rescale ships with this work.
- **New save state:**
  - pending level rewards;
  - the XP bank (held in the profile);
  - per-POI daily march counters on `CombatManager` (seed and reconcile).
  - There is no migration; `xpToNext` is recomputed on load.
- `UserManager`'s curve moves to `progression.js`. `MailManager` drops its `user:levelUp` mail.
- `PoiDetailPanel` is replaced by an anchored card on the world map.
- The hero strike value is only accurate to ±50%. That is acceptable because strikes are under 5% of power after HQ3.
