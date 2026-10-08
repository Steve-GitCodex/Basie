# Power and player levels (target design, not built)

**Power** is a combat-weighted measure of strength. **Player level** is an activity and rewards meter; HQ level stays
the real progression gate. Decided 2026-10-07 (ADR 0045), with the monster rescale in ADR 0043.

- Numbers and calibration: `docs/research/power-levels-formula.md` (877 resolver fights).
- Research: `docs/research/power-levels-{genre,codebase}.md`.
- Mockup: `docs/10-design/mockups/power-levels/power-v1.html`. Choices: breakdown **A**, recommended power **B**,
  level-up **A**.

## Power

- **Per-unit power** is `√(H × D)`, with `H = hp × (100 + def) / 100` and `D = atk² / (atk + 120)`. The stats are the
  effective ones built by the same expression as `battleSides.playerStack`: tech, HQ and hero auras.
  - Excluded: `milMult`, encounter modifiers, difficulty, timed buffs and VIP.
  - `firstWaveBonus` multiplies troop power by `1 + 0.04 × bonus`.
- **Which troops count:** reserve, squads and marching squads. Troops in training queues, wounded troops (until
  healed) and dead troops do not.
- **Heroes:** only assigned heroes count, through their auras (as stat increases) and, for barracks heroes, a strike
  term `10 × √(effHp × strikeAtk² / (strikeAtk + 120))`. Unassigned heroes count 0.
- **Buildings and non-combat research** are converted into troop equivalents:
  - 10 infantry of tier `eraAt(level)` per building level;
  - 20 per research level, at the infantry tier `eraAt(workshopReq)`.
  - They are capped at `max(combat / 3, 500 × eraAt(HQ))`, so they make up at most 25% of the total. The breakdown
    shows "capped from X". `eraAt` is defined in `building-levels.md` (ADR 0044).
- **Combat research** (any tech with hp/attack/defense/firstWave effects) counts only through troop stats, and is
  uncapped.
- **Total** = combat + capped non-combat. **Squad power** (troops plus that squad's heroes) is what gets compared
  with enemies.
- **Never saved.** A `PowerManager` marks itself dirty on events and recomputes once per tick.
  - Events: `army:updated`, `heroes:updated`, `tech:researched` and `building:completed`, plus one compute after load.
  - It emits `power:changed { total, breakdown, squads, previous }` only when the rounded total changes.

## Enemy power and recommended power

- **Enemy stacks** use the same `unitPower` on their `monsterStack` stats.
  - Heal ability: hp × (1 + 12·v). AOE: × 1.3. Revive: 0.
- **Combining waves:** `rawEnemy = √(Σ wavePower²)`; `enemyPower = 1.13 × rawEnemy`; `recommended = 1.2 × enemyPower`.
- **Stage scaling:** `stageGenerator` uses `rawEnemy` in place of `lineupPower`. Stages stamp `enemyPower` and
  `recommendedPower` when they are frozen.
- **Bands** (squad ÷ enemyPower): **green ≥ 1.2**, **amber 0.9–1.2**, **red < 0.9**. The simulated win estimate
  (`estimateBadge`) stays the authority and is shown next to the band.
- **Structure fights:** siege stacks count × 1.22 in those dialogs only.
- **Where it shows:**
  - **World map:** tapping a marker pops the gauge card, attached to that target. It follows the `TileTooltip._position`
    idiom: it flips above or below, keeps 8px inside the screen, and has an arrow. It re-places on camera `onChange`
    and hides when the target is off-screen. This replaces the docked `PoiDetailPanel`. Markers carry a band-coloured
    power chip.
  - **Campaign:** the existing stage panel (`battle-tab.md`) gets the same gauge inside it. Trail nodes get the chip.
- **Battle reports:** your squad's power before the fight and the enemy's power, both stored when the fight happens.
- **Phase 4 AI** reads `combat` power (never the total) plus the player's level.

## Profile breakdown (option A, placement 1)

The breakdown lives **inside the existing Profile tab** of the profile modal. The four tabs (Profile · Achievements ·
Account · Settings) stay.

- **The tab** becomes three blocks:
  - **Level:** the XP bar, plus the cap and XP bank line.
  - **Power:** the breakdown below.
  - **Statistics:** the existing 12 rows, collapsed by default.
- **The modal header** shows power next to the level: "Level N Commander · ⚔ total".
- `SettingsUI.js` (513 lines) has to be split first: the profile modal moves into `js/ui/profile/`.

The Power block contains:

- The big total and today's change.
- One stacked bar across the categories: Troops, Heroes, Combat research & HQ, Buildings (CAP), Other research (CAP).
- Rows that expand into their sources, with the wounded shown as "not counted".
- A "fastest gain" tip.

## Player level

- **Curve:** `xpToNext(L) = 80 + 150(L−1) + 5(L−1)²`, in `progression.js`. The total to reach L50 is 370,440.
- **Cap and bank:**
  - Level is capped by HQ through a table (interpolated 5 × era, ADR 0044):

    | HQ | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
    |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
    | Cap | 5 | 10 | 12 | 15 | 17 | 20 | 21 | 23 | 25 | 26 | 28 | 30 | 31 | 33 | 35 |

    | HQ | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 |
    |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
    | Cap | 36 | 38 | 40 | 41 | 42 | 43 | 45 | 46 | 47 | 48 | 50 | 51 | 52 | 53 | **55** |

    The total XP to reach L55 is about 475k.
  - XP keeps banking for up to 5 more levels and pays out when HQ upgrades (the `townhall` `building:completed` event).
  - When the bank is full the bar reads "XP bank full, upgrade HQ".
  - `deserialize` recomputes `xpToNext`.
- **XP sources:**
  - Existing: quests, achievements, campaign and marches.
  - New:
    - each building upgrade: `0.3 × level²` (HQ: `5 × level²`), re-fitted for 30 levels;
    - each research level: `30 × eraAt(workshopReq)²`;
    - training batches: `ceil(count × tier / 10)`, capped at `50 × HQ` per day.
- **March XP:** per-target daily limit. Camps give full XP for 6 wins a day and the world boss for 3; after that,
  10%. Garrisons give XP on first clear only. March wins also count toward `battlesWon`.
- **Survival:** full XP only for waves past your best; other waves give 10%.
- **`addXP`** keeps its name and ignores amounts that are not finite or are ≤ 0. `user:levelUp { level }` stays
  absolute: one event per level.

## Level-up rewards and the card (option A)

- **Every level:**
  - money at 4% of the HQ money cap (the era-based cap from ADR 0044; L51–55 use the HQ30 cap);
  - diamonds: 2 (L2–19), 3 (L20–39), 5 (L40–50);
  - universal speedups by band.
- **Milestones (every 5th level):** 15% of the money cap, plus tokens or cards (the table in the formula draft, §D).
  L55 is added as a final milestone, a copy of L50's row. Lifetime diamonds total about 600.
- **The card** replaces the level-up mail. It shows the level, its rewards and the next milestone.
  - **Collect** moves the rewards into the bag through `InventoryManager.grantRewards`.
  - At the cap it explains the bank.
- **Queue:**
  - Level-ups never show during the battle scene or playback, a tutorial step, a confirm dialog or an open modal.
  - A pip on the top-bar plate shows the waiting count.
  - On release they appear as a **deck, one card per level**, lowest on top, with "n of N", **Collect** (go to the next
    card) and **Collect all (N)**.
  - Closing the deck keeps the rewards pending; nothing is lost. Pending rewards are saved.

## Data placement

- `js/entities/data/power.js`: `POWER_RULES` (the references, ability weights, calibration, bands, troop equivalents
  and cap). It is re-exported from `GAME_DATA.js`.
- `js/entities/data/progression.js`: `PLAYER_LEVEL`, `PLAYER_XP_SOURCES`, `LEVEL_REWARDS`, `LEVEL_MILESTONES`,
  `MARCH_XP_DAILY_FULL` and `SURVIVAL_XP_RULE`.
- `js/systems/power/powerMath.js`: pure and unit-tested.

## Open (defaults taken)

- **Pacing target:** none is set; the curve is fitted to the XP content.
- **XP past L50:** held in the bank, no conversion.
- **Healing:** weight 12 for now; chapter 4's heals are left to the balance pass.
- **Cavalry:** about 2.2× infantry power at the same tier; left to the balance pass.
- **Difficulty:** recommended power always shows the **normal** difficulty.

## Built to extend

- `CHAPTER_BOSS_TARGETS`, `CAMP_TARGETS`, `LEVEL_CAP_BY_HQ` and `LEVEL_MILESTONES` are data tables indexed by
  chapter or HQ. A new chapter or HQ band is a data append, with no code change.
- `recommendedPower` is derived from each stage's lineup, so new monsters get recommended power automatically.
- The Phase 4 AI reads `combat` power and level through `PowerManager.getPower()` and `UserManager`. Scaling AI factions
  needs no new power code.
