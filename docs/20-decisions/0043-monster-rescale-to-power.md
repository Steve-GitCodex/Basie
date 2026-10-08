# 0043 — Rescale campaign and world monsters to the power metric

Date: 2026-10-07 · Status: accepted (design; not built) · Related: ADR 0045, ADR 0036 (campaign chapters)

## Context

The formula draft (`docs/research/power-levels-formula.md` §B.4) measured armies against monster lineups.

- A plausible army at each chapter's HQ gate is 17× (early), 60× (mid) and about 1,350× (late) the strength of that
  chapter's monsters.
- Lineups have 5–30 troops, while barracks slots hold 200–4,000.
- Every recommendation would read deep green, and the campaign gives no resistance.
- Difficulty also runs backwards in places:
  - chapter 5 s1 is easier than chapter 4;
  - chapter 6's regular stages are harder than its boss;
  - all of chapter 2's regular stages are identical (the `prevBoss` clamp);
  - chapter 4 plays about 2× harder because of stacked heals.

## Decision

1. Rescale the monster lineups (`MONSTERS_CONFIG`, the campaign bosses and elites) so that each chapter's boss
   **recommended power ≈ 0.7 × the expected lead squad at the chapter's HQ gate**.
   - Power is linear in count, so the main lever is the per-chapter count multiplier,
     `count × target / current`. Tiers are bumped where counts would exceed sensible numbers.
2. `stageGenerator` uses `rawEnemy`. Each chapter's regular stages must be strictly increasing and stay below the boss.
   Fix the `prevBoss` clamp so regulars are no longer identical.
3. World POIs that reuse `MONSTERS_CONFIG` inherit the rescale. Camps target recommended ≈ 0.4 × the lead squad at
   the region's tier gate.
4. Add a unit test that locks the targets: per chapter, the boss recommended power lies within ±15% of the target, and
   difficulty is monotonic.

## Consequences

- Rewards scale with `target / bossPower` (ADR 0036), so reward amounts have to be re-checked after the rescale.
  Keep the totals per chapter roughly as they are.
- The existing combat and campaign smokes and stage-generator tests will need their expected numbers updated. That is
  a contract change, not a regression.
- Chapter 4's heal and the cavalry ×2.2 imbalance stay open balance items. The rescale only touches counts and tiers.
- The "expected lead squad" per HQ comes from the formula draft's example players. Those examples are assumptions and
  should be retuned once the game is played.

## Amendment (2026-10-07, ADR 0044)

Buildings now go to HQ 30, so each chapter gate moves to `M(k)`; the target values stay the same. Boss recommended
targets (0.7 × lead squad at the gate) and camp targets (0.4 ×):

| Chapter | Gate | Boss target | Camp target |
|---|---|---|---|
| 1–2 | HQ1–2 | 340 – 2.5k | 190 – 1.4k |
| 3 | HQ4 | 8.7k | 5.0k |
| 4 | HQ6 | 14k | 8.1k |
| 5 | HQ9 | 89k (draft basis) | 32k |
| 6 | HQ12 | 180k | 103k |
| 7 | HQ15 | 0.97M | 0.56M |
| 8 | HQ18 | 2.4M | 1.4M |
| 9 | HQ22 | 6.1M (draft basis) | 3.2M |
| 10 | HQ26 | 11.9M | 6.8M |
| World boss / capstone | HQ30 | 16.0M | 9.1M |

Re-derive these from simulated players once the curves are in data.
