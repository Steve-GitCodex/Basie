# Power and levels: current codebase map

Research input for a player power stat (none exists) and a player level redesign. Written 2026-10-07 from code only;
companion to `power-levels-genre.md`. Not a design lock. Paths are repo-relative.

## 1. Player level and XP today

- **Profile** (`UserManager.js:15-25`): `level`, `xp`, `xpToNext`, persisted whole (`:248-258`).
- **Curve:** `xpToNext(L) = floor(500 * 1.4^(L-1))` hard-coded (`:9`, `:153`): 500, 700, 980, 1372 … ≈10.3k at L10,
  ≈150k at L20, ≈4M at L30. **No cap**: `addXP` loops (`:148-157`), emitting one `user:levelUp { level }` per level and
  one `user:xpGained { xp, profile }`. No input validation. `deserialize` doesn't recompute `xpToNext` (`:253`).
- **XP sources** (all `addXP`):

| Source | Where | Amount |
|---|---|---|
| Direct/campaign victory | `CombatManager.js:100` | `rewards.xp` (reduced after `maxRewardedWins`) |
| March victory | `CombatManager.js:129` | `monster.rewards.xp`, **no** reduction |
| Quest | `QuestManager.js:80-82` | 50–1000 (`progression.js:9-63`) |
| Achievement | `AchievementManager.js:147` | 50–8000 (`progression.js:73-225`) |
| Event objective | `EventManager.js:156` | `cfg.reward.xp` |

  Monster XP by chapter: 100…8000 (`combat.js:19-175`). Not player XP: challenge-pass points, `xp_bundle_*` items and
  hero battle XP (separate tracks).
- **Level-up rewards:** mail with `{ money: level * 50 }` (`MailManager.js:71-81`); its text promises unlocks that don't
  exist. Jingle (`SoundManager.js:181`). No toast/modal.
- **What level gates: effectively nothing.** Only the `rising_power` quest (L5) and achievements at L5/L10.
  Real gates are building-driven: `TAB_UNLOCK_CONDITIONS` (`navigation.js:19-60`, building / `hq_level` types),
  `HQ_UNLOCK_TABLE` (`buildings.js:481+`), campaign `requires` (`combat.js:182-191`), unit tiers
  (`UNIT_TIER_REQUIREMENTS`, `units.js:85+`), hero level cap = heroquarters level × 10 (`heroProgression.js:21-23`).
- **VIP** (`economy.js:228-278`): 10 tiers from cumulative `diamondsSpent`; perks are speed, slots, production.
- **UI:** `#player-level` (`index.html:189`), profile tab XP bar + 12 stat rows (`SettingsUI.js:232-257`). Top bar plan
  reserves a hidden power slot (`topbar.md`, ADR 0041).
- **Tests:** `userManager.test.js` has 3 tests, none on `addXP`, the curve or level-up.
- **Stat quirks:** march wins don't count in `battlesWon` (no `combat:victory`); `unitsTrainedTotal` counts upgrades.

## 2. Candidate power inputs

### Existing power-like formula

`lineupPower(waves) = Σ count × (hp + 10 × attack)` (`stageGenerator.js:8-14`), **monsters only**. Used to scale campaign
stages (regular 0.45–0.85 of boss power) and rewards. The "squad power score" in `40-active.md:352` doesn't exist in code.

### Combat math (what real strength is)

- Player stack (`battleSides.js:17-43`):
  - hp = base × (1 + tech hp) × modifier;
  - attack = base × (1 + tech atk) × hero attackMult × (1 + HQ atk) × milMult × modifier;
  - defense = (base + tech def) × hero defenseMult × (1 + hero baseDefense) × (1 + HQ def).
- Hit = `atk² / (atk + def)` (`hitMath.js:5-8`). Counters ×1.15, variance ±10%, 30-round cap (`combatRules.js`).
- Difficulty easy/normal/hard scales enemy hp/atk 0.7/1/1.4 (`combat.js:196-200`).
- Stat caps (ADR 0031, `statRules.js`) cap utility stats; **squad attackMult/defenseMult stay uncapped**.

### Units (`units.js`, `UnitManager.js`)

4 types × 10 tiers. T1→T10: infantry hp 120→2500 / atk 14→240 / def 10→145; ranged 80→1400 / 22→356 / 5→68; cavalry
200→4600 / 28→460 / 14→165; siege 70→1400 / 60→1080 / 4→56. State: reserve map `tierKey → count`, squads, wounded pool
(`getWounded()`), dead removed. `getTotalUnitCount()` excludes queues and wounded. Monster stat scale differs from
player tiers.

### Heroes

Base stats per hero (`heroes.js:60-146`). `effectiveStats` = base × (1 + stars × 0.06) × squad passives
(`heroProgression.js:60-83`). Max 10 stars. Level XP is linear `(100 + 20(L-1)) × tierMult`, capped by HQ.
Only assigned heroes affect combat (`heroCombat.js:37-103`).

### Buildings

About 20 types, multi-instance. `getLevelOf` (max across instances), `getAllBuildingsWithStatus` (per instance),
`getHQLevel`, `getHQBenefits` (feeds combat). Costs grow exponentially, so spent cost could proxy value.

### Research

12 techs, maxLevel 3–7 (`tech.js`); 4 mastery techs gate unit tiers 4–10. `getTechWithState()`.

### Buffs, VIP, items, world

Temporary buffs and purchasable VIP are volatile, so they are poor power inputs. World: 9 regions (tier 1–6, permanent
buff), outposts, owner strings (`WorldMapManager.js:244-262`).

## 3. Consumers of power or level

| Consumer | Today |
|---|---|
| Campaign | Static monster tables via `lineupPower`; frozen at import; gated by HQ / heroquarters. No player input. |
| Enemy scaling | Global difficulty, survival `1.05^wave`, encounter modifiers. Seam: `encounterSide` (`battleSides.js:77-84`). |
| World POIs | Level = region tier; cosmetic. |
| AI factions (Phase 4) | Roadmap: "AI difficulty scaling seam driven by player level + activity" (unchecked). `TraderManager.js:6` already has an activity event set. |
| Quests / achievements | `reach_level`, `user_level` need absolute `level` in `user:levelUp`. |
| Top bar / mail / profile | Hidden power slot; battle-report mail notes "no power stat". |

## 4. Events an aggregator can use

- `army:updated`: the best single "troops changed" signal.
- `building:completed { id, instanceIndex, building }`.
- `tech:researched { id, level }`.
- `heroes:updated <roster>`: covers recruit, awaken, level-up and assignment.
- `world:regionCaptured`, `world:outpostCaptured`.
- `combat:victory` / `combat:defeat` / `combat:marchResolved`.
- `user:levelUp` / `user:xpGained`.

Restored saves fire no events, so do an explicit compute after `deserialize` (`main.js:200`).

## 5. Constraints

1. Constants go in `js/entities/data/` (ADR 0002). The player curve moves to `progression.js`
   (`data-consolidation-plan.md:60-65`, whose hero-curve description is stale).
2. Use EventBus only (ADR 0001). A `PowerManager` derives power and emits `power:changed { total, breakdown }`. It is
   **never serialized**.
3. Read the same bonus sources as the combat resolver, so power can't drift from real strength.
4. Keep `user:levelUp { level }` absolute, and keep the `addXP` name (stubbed in `CombatManager.test.js:55`).
5. Precedent: the hero cap ties to building level (HQ × 10), so player milestones can tie to HQ too.

## 6. Open design questions

1. Should level gate anything, or stay an activity / reward meter (with HQ as the real gate)?
2. Level = activity, power = strength? The AI direction says AI scales on "player level + activity".
3. Which XP sources count? Should building, research and training give XP? Should march XP get the reduction?
4. Cap and curve shape. Recompute `xpToNext` on load (no legacy compat applies).
5. Level-up rewards beyond money, and a level-up toast or modal.
6. Power inputs and weights: troop basis (`hp + 10·atk` vs `atk²/(atk+def)`); whether wounded, queued and marching troops
   count; assigned heroes vs the whole roster; buildings by max or by instance sum; research levels vs bonuses; world
   holdings; no buffs or VIP.
7. Same-scale power for enemies, e.g. a stage's "recommended power"?
8. Is the first AI deliverable only the stat plus a hook?
9. Where power shows: top bar, profile breakdown, battle reports.
