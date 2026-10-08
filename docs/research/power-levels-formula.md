# Power and player level: proposed formulas and numbers

**Design draft for Steve to approve. Not locked.** Written 2026-10-07. Builds on `power-levels-codebase.md` and
`power-levels-genre.md`; applies the owner decisions given for this pass (level = activity/reward meter, HQ stays
the gate; power = combat-weighted and derived, never saved; wounded/queued troops excluded, marching troops included).
Every number below is computed from the repo's data files or from scratch simulations against the real resolver
(`js/systems/combat/resolveBattle.js`). All constants are **[PLACEHOLDER]** until playtested. Once approved, the
decisions go into an ADR (next free number is 0042).

## Headline findings

1. **Troop power formula:** `unitPower = √( hp·(100 + def)/100 × atk²/(atk + 120) )`, computed from the same effective
   stack stats `battleSides.playerStack` builds. It sits on the same scale as monsters and was checked against
   877 simulated threshold fights. Within one chapter it predicts the winning army to ±12–16% (log-sd). Across the
   whole campaign, 80% of army compositions fall within 0.86–1.48× the median. The current `hp + 10·atk` metric scatters
   about twice as much (log-sd 0.44 vs 0.26).
2. **The resolver is near-deterministic around the threshold.** The power that wins 80% of seeds is only 0–2% above
   the power that wins 50%, because ±10% variance averages out. So "X% win chance" in the power bands means
   **"X% of army compositions win"**. Most of the uncertainty comes from the formula, not from dice. The exact
   per-squad odds stay with the existing `estimateBattle` badge.
3. **Biggest balance flag: campaign enemies are 15× to 1,000× weaker than a plausible army at their gate HQ.** The
   chapter-10 boss needs about 9,200 power. A plausible HQ9 lead squad is about 8.7M. Monster lineups have 5–30
   troops, while Barracks slots hold 200–4,000. With the new metric, the balance pass can scale monster counts
   straight to a target (power is linear in count). See §B.4.
4. **Level curve:** `xpToNext(L) = 80 + 150·(L−1) + 5·(L−1)²`. The cap is **5 × HQ level** (50 at HQ10), and
   reaching the cap takes 370,440 XP in total. At each HQ the cap lands at 80–95% of that HQ's XP content, so the
   cap usually binds just before an HQ upgrade. Over-cap XP banks for up to 5 levels and pays out when the HQ goes up.
5. **XP exploits to close:** march wins skip the reduced-reward path. The world boss (`wb_roc`, 900 XP, reopens every
   3 min) and Survival (50 XP/wave, unlimited) are the open repeatable XP faucets.

---

## A. Power formula

### A.1 Per-unit troop power: what was tested and why this one

The resolver's hit is `atk²/(atk + def)` (`hitMath.js`), applied each round to the front-most living row. It
behaves like a **Lanchester square-law** fight: each side's output shrinks as its count falls. Under square law,
two armies tie when `N_a·√(d_a·h_a) = N_b·√(d_b·h_b)`, where `d` is damage per round and `h` is durability. So the
right additive per-unit power is **√(damage × durability)**, which grows linearly with count. That gives the
genre-standard feel of "each troop is worth X" while still tracking real strength.

Defense matters a lot here. Steel Armor adds a flat +25 defense per level, and against a 30-attack monster that
triples effective HP. So defense must count. It enters through effective HP against a reference attacker:

```
H = hp × (A_REF + def) / A_REF            // effective HP vs a reference hit
D = atk² / (atk + D_REF)                  // damage per hit vs a reference defender
unitPower = √(H × D)
A_REF = 100, D_REF = 120                  // fitted, see below
```

**Calibration** (scratch scripts, real resolver, normal difficulty, no heroes or bonuses):

- For every one of the 60 generated stages, 4–5 mixed army archetypes were tested at the 2–4 tiers that are
  plausible for that chapter's HQ gate. The archetypes were infantry+ranged+cavalry+siege; infantry+ranged;
  infantry+cavalry; a 2:1:1 infantry/ranged/cavalry mix; and a blend that mixes in tier N−1.
- Enemy counts were ×10 so the threshold could be found to 1% (it is not granular at 5 troops).
- Each run binary-searched the troop count that wins at least 50% of 16 seeds. That gave 877 thresholds.
- A grid over `A_REF`, `D_REF`, the ability weights and the wave aggregation then minimised the scatter of
  log(player power ÷ enemy power) at the threshold.

| Metric (enemy waves combined as shown) | Median P/E at 50% win | log-sd | p10–p90 |
|---|---|---|---|
| `hp + 10·atk`, sum (today's `lineupPower`) | 0.94 | 0.44 | n/a |
| `√(hp·atk)` (defense ignored), RSS | 1.28 | 0.46 | 0.88–2.76 |
| **`√(H·D)`, A100/D120, ability weights, RSS** | **1.13** | **0.26** | **0.86–1.48** |
| Same, per chapter, excluding ch4 | 0.95–1.28 | 0.10–0.16 | n/a |

- Chapter 4 (`troll_bridge`) is the outlier at 2.0×. It has two healing stacks, one with an explicit defense of 60,
  and a healing Warboss. Healing is undervalued (§A.5, open question 6).
- Composition still matters. An all-four-types army with glass-cannon siege needs 0.92×, and infantry+cavalry needs
  1.31×. Power is a guide; the per-squad estimate badge stays the exact answer.
- Bonus check: the same fit was re-run with HQ10 bonuses (+59% atk / +56% def), Steel Armor Lv4 (+100 def),
  Elite Training Lv5 (+100% hp / +50% atk) and a hero aura (×1.35 atk / ×1.2 def). The ratio stayed within ±10% of
  the no-bonus case in every chapter tested. Steel Armor is slightly overvalued (+5–12%). Pushing effective stats
  through the same formula therefore keeps bonus power on scale.

### A.2 Troop power per unit, base stats (T1–T10)

| Tier | Infantry | Ranged | Cavalry | Siege |
|---|---|---|---|---|
| T1 | Footman 13.9 | Archer 16.9 | Scout 34.8 | Catapult 38.2 |
| T2 | Soldier 24.3 | Crossbowman 29.5 | Horseman 62.6 | Ballista 62.8 |
| T3 | Sergeant 40.7 | Sharpshooter 49.0 | Lancer 105.7 | Trebuchet 98.2 |
| T4 | Knight 69.7 | Ranger 78.4 | Knight 173.5 | Battering Ram 151.2 |
| T5 | Paladin 115.2 | Strider 121.4 | Cavalier 278.6 | Bombard 227.0 |
| T6 | Champion 182.1 | Predator 182.1 | Heavy Rider 430.9 | Heavy Cannon 335.2 |
| T7 | Vanguard 281.7 | Sniper 265.3 | Templar 653.0 | Siege Tower 487.7 |
| T8 | Warlord 429.5 | Hawkeye 384.5 | Warden 971.6 | War Engine 704.1 |
| T9 | Crusader 649.5 | Phantom 552.4 | Juggernaut 1432.8 | Doomsday Cannon 1003.7 |
| T10 | Archon 989.9 | Deathbolt 791.3 | Dreadnought 2108.8 | Obliterator 1457.0 |

- Each tier is worth about ×1.6 the one before it (the genre-typical "roughly doubles early, then flattens").
- **Power per gold is nearly flat across tiers.** Footman 0.28, Paladin 0.29, Archon 0.35, Scout 0.23 and Dreadnought
  0.38 power per money. Hoarding cheap low tiers or upgrading them buys no extra power per coin. Siege is the
  exception (Obliterator 0.14/money, plus heavy wood and iron), so siege is "expensive power".
- Cavalry is about 2.2× infantry at the same tier. That is what the data says: Dreadnought has 4,600 hp and 460 atk
  against Archon's 2,500 hp and 240 atk. It is flagged for the balance pass, not hidden by the formula.
- Displayed totals round to integers; per-unit values are kept fractional internally.

### A.3 How bonuses apply (no separate multipliers)

Power never applies its own multipliers. It feeds each tierKey's stats through the **same expression as
`battleSides.playerStack`**, so power cannot drift from the resolver:

```
hp  = base.hp  × (1 + tech.hpBonus)
atk = base.atk × (1 + tech.attackBonus) × hero.attackMult × (1 + hq.attackBonus)
def = (base.def + tech.defenseBonus) × hero.defenseMult × (1 + hero.baseDefense) × (1 + hq.defenseBonus)
```

- **Excluded:** `milMult` (a world buff), encounter modifiers, difficulty, timed buffs and VIP (owner decision 2).
- **Which hero bonus applies.** Squad troops use `getCombatBonuses(squadId)`, which covers that squad's barracks
  heroes plus heroes stationed at HQ. Reserve troops use HQ-stationed heroes only, so they are computed with a
  barracks-free bonus set. Putting a hero in a squad therefore visibly raises power.
- **`firstWaveBonus`** (Battle Formations, Advanced Tactics) does not change stack stats. It is worth a power
  multiplier on troop power of `(1 + 0.04 × firstWaveBonus)`. In simulation, +2.3 first-wave attack saved 4–12% of
  troops and +0.5 saved 0–3%.
- **`lossReduction` / `postBattleHeal`** do not change who wins, so they add no power. They are a later "efficiency"
  stat at most.
- **Breakdown attribution** is computed in a fixed order: base stats, then +combat research, then +HQ, then +hero
  auras. Each category shows the increase from its step.

### A.4 Hero power

- **Unassigned roster heroes count 0**, so recruiting heroes cannot pad power. Owner decision 2 says only assigned
  heroes count.
- **Aura (squad and HQ heroes):** counted in the breakdown as the "Heroes" increase from §A.3.
- **Strike (barracks heroes only; HQ-stationed heroes never strike):**

```
strikeAtk  = effAtk × (1 + HERO_STRIKE.perLevel × (level − 1))      // as resolveBattle.planHeroStrike
heroStrike = HERO_STRIKE.factor × √( effHp × strikeAtk² / (strikeAtk + D_REF) )
```

`effHp` and `effAtk` are `effectiveStats` (stars ×1.06 each). The hero cannot be hit, so its own HP stands in for
how long its strikes last. That keeps hero power stable rather than dependent on the squad.

- Simulated hero value, measured as troops saved, ranged from 450 power (Warlord L1 vs a tiny chapter-3 lineup)
  to 11,900 (Sorceress L40 vs chapter 10 at ×5 scale). It rises with fight size. The formula gives Warlord L1
  2,190, Warlord L20 2★ 3,570, Warlord L80 6★ 7,510 and Sorceress L70 5★ 7,930. That lands in the middle of the
  measured range: too high for the tiny early fights, a rounding error against late armies.
- **Accuracy:** ±50%, not ±15%. It is good enough because strikes are under 5% of power after HQ3 (§B).

### A.5 Enemy power (same scale) and recommended power

Monster stacks go through the same `unitPower`, using the stats `encounterSide.monsterStack` builds (difficulty
`enemyHpMult` / `enemyAtkMult` applied; defense = stack `defense` or `MONSTER_TIERS[tier-1].defense`). Ability
weights are fitted:

| Ability | Weight | Fitted effect |
|---|---|---|
| `heal` v | hp × (1 + 12·v) | best fit 12–30; 12 chosen (heal is undervalued even so, see ch4) |
| `revive` v | none | fit preferred 0; the one-off revive barely moves thresholds |
| `aoe_blast` | unit power × 1.3 | the resolver plans one strike per living row (`abilityValue` is unused), but it fits at only 1.3 |

```
wavePower   = Σ_stacks count × unitPower(stack)
rawEnemy    = √( Σ_waves wavePower² )          // square law: fighting waves in turn = their strengths add in squares
enemyPower  = 1.13 × rawEnemy                 // ENEMY_CALIBRATION: equal powers ≈ a coin flip
recommended = 1.20 × enemyPower               // RECOMMENDED_MULT
```

The root of the sum of squares across waves beat a plain sum in every grid cell. Summing overrates multi-wave
lineups, which is one reason `lineupPower` mis-ranks stages.

**Replace `lineupPower` in `stageGenerator.js`** with `rawEnemy`, both for the regular-stage scaling targets and for
the reward scaling. That puts stage generation, the badge and the recommendation on one metric.

**Comparison uses squad power, not account power.** The stage panel and march dialogs compare the selected squad's
power, plus its heroes' strikes and auras, against `recommended`. The top bar shows account total.

- **Strongholds / outposts** are structure fights. In those dialogs only, the squad's siege stacks count
  ×√1.5 = ×1.22, because `SIEGE_VS_STRUCTURE_MULT` 1.5 is a damage multiplier and power is √damage.
- **Encounter modifiers** are left out of the recommended number so it stays stable; the badge already reads them.

### A.6 Colour bands (you ÷ enemy power)

| Band | You ÷ enemyPower | Simulated share of army compositions that win (all / excl. ch4) |
|---|---|---|
| Green | **≥ 1.20** (= at or above Recommended) | ≥ 86% / ≥ 95% |
| Amber | **0.90 – 1.20** | 37–86% / 41–95% |
| Red | **< 0.90** | < 37% / < 41% (at 0.72: about 6%) |

Because outcomes are near-deterministic (finding 2), amber means "it depends on your composition and heroes, so
check the badge". Red means almost no composition wins. The stage-panel badge (`estimateBattle`) stays the
authority; the band is the at-a-glance pre-check for list views, world-map POIs and AI targets.

### A.7 Buildings and non-combat research: capped share

- **Buildings:** each building level is worth 10 troops of the matching infantry tier.
  `buildingPower = Σ_instances 10 × infantryPower(min(level,10))`. Using the troop scale keeps buildings relevant as
  troop power grows, instead of a flat weight that is huge early and invisible late.
- **Non-combat research:** economy techs plus the four masteries, whose value already arrives through the troops
  they unlock. Each research level is worth 20 troops of the infantry tier equal to the Workshop level it required.
  The Workshop requirement comes from `levelRequirements[L].workshop ?? requires.workshop`.
- **Combat research:** any tech whose effects include `hpBonus` / `attackBonus` / `defenseBonus` / `firstWaveBonus`.
  It counts only through troop stats (§A.3) and is **uncapped**.
- **Cap rule (exact):**

```
nonCombatRaw    = buildingPower + nonCombatResearchPower
nonCombatCap    = max(combatPower / 3, 500 × hqLevel)      // ≤ 25% of total once you have an army
nonCombatPower  = min(nonCombatRaw, nonCombatCap)
combatPower     = troops(with research+HQ+hero aura) + heroStrikes
total           = combatPower + nonCombatPower
```

The floor `500 × HQ` keeps a brand-new player from showing 0. The breakdown shows the cap honestly, for example
"Buildings 2,590 (capped from 3,314)".

### A.8 Which troops count

| State | Counts | Why |
|---|---|---|
| Reserve (`_reserve`) and squads | yes | standing army |
| Marching squads | yes | still yours (decision 3) |
| Training / upgrade queues | no | not trained yet |
| Wounded (`getWounded()`) | no, until healed | decision 3; no hospital exists yet, so wounded currently stay out of power |
| Dead | no | removed by `removeUnitsFromSquad` |

`UnitManager.getTotalUnitCount()` already follows these rules (it excludes queues and wounded), so the aggregator
iterates the same collections.

---

## B. Example players

Armies were checked against barracks slot caps (`levelStats.slotCapacity`), slot unlocks (`squadSlots`),
instance gates and tier gates (`UNIT_TIER_REQUIREMENTS`, mastery needs Workshop, HQ5+).

### B.1 Early: HQ2 (about the first session)

Barracks Lv2 (1 slot, 500 cap). Squad 1: 150 Soldiers (T2 infantry). Reserve: 60 Archers and 40 Footmen.
Kaelen Thorne L5 0★ in Barracks. 14 buildings at Lv1–3. No tech (the Workshop needs HQ5).

| Category | Power |
|---|---|
| Troops (base) | 5,219 |
| Research / HQ / hero aura | 0 / 0 / 0 (HQ2 atk bonus is 0; Kaelen's aura is production) |
| Hero strikes | 2,550 |
| **Combat** | **7,769** |
| Buildings + research | 3,314 raw, **capped to 2,590** |
| **Total** | **10,358** |
| Squad 1 (compare to stages) | 6,198 |

Padding check: buildings are already at the cap, which is fine early (owner intent). The hero is 33% of combat;
heroes dominate the earliest fights, which matches the simulations, where a hero plus 3 troops clears chapter 1.

### B.2 Mid: HQ5

- **Barracks:** two. Lv5 has 3 slots, cap 1,700; Lv4 has 2 slots, cap 1,200.
- **Squad 1:** 900 Sergeants, 600 Sharpshooters, 300 Lancers, with Warlord L20 2★.
- **Squad 2:** 600 Soldiers, 400 Crossbowmen, with Shadow Blade L18 1★.
- **Reserve:** 60 Knights (T4, first mastery level) and 200 Footmen.
- **Other heroes:** Paladin L20 1★ at Hero Quarters (aura plus baseDefense of about 0.11); Kaelen at a farm (counts 0).
- **Buildings and research:** 27 buildings at Lv1–5. Economy research covers 5 levels; there is no combat tech yet
  (Workshop Lv2).

| Category | Power | Share |
|---|---|---|
| Troops (base) | 131,105 | 68% |
| Combat research | 0 | n/a |
| HQ bonus (+7% atk / +6% def) | 8,637 | 4% |
| Hero auras | 24,227 | 13% |
| Hero strikes | 7,494 | 4% |
| **Combat** | **171,463** | |
| Buildings 18,595 + research 2,014 | 20,609 (cap 57,154, not binding) | 11% |
| **Total** | **192,072** | |
| Squad 1 / Squad 2 | 126,787 / 37,004 | |

### B.3 Late: HQ9

- **Squads:** four, at Barracks Lv7 (4 slots, cap 3,000), 17,300 troops in total:
  - Squad 1: 1,500 T8 infantry, 1,000 T8 ranged, 800 T7 cavalry, 1,200 T7 infantry.
  - Squad 2: T7 troops plus 300 T6 siege.
  - Squads 3 and 4: T6 and T5 troops.
  - Reserve: 1,400 T4 troops.
- **Research:** Elite Training Lv3, Steel Armor Lv4, Battle Formations Lv4, Advanced Tactics Lv3. Economy and
  mastery research covers 35 levels.
- **Heroes:** Warlord L80 6★ and Sorceress L70 5★ in squad 1, Shadow Blade L75 6★ in squad 2, Juno Vane L60 3★ in
  squad 3, and Paladin L80 6★ at Hero Quarters.
- **Buildings:** 41 at Lv3–9.

| Category | Power | Share |
|---|---|---|
| Troops (base) | 4,664,397 | 24% |
| Combat research | 5,096,616 | 26% |
| HQ bonus (+44% atk / +41% def) | 4,257,596 | 22% |
| Hero auras | 5,406,526 | 27% |
| Hero strikes | 30,526 | 0.2% |
| **Combat** | **19,455,661** | |
| Buildings 164,736 + research 81,920 | 246,656 (cap 6.49M, not binding) | 1.3% |
| **Total** | **19,702,317** | |
| Squads 1–4 | 8.69M / 5.50M / 3.28M / 1.58M | |

### B.4 Padding test and recommended power per chapter

**Padder (HQ5):** 100 Footmen and 26 buildings pushed to Lv6–8. Raw non-combat is 83,281, capped to 2,500, so the
total is **3,985**. A balanced HQ5 player has **192,072**. Padding is neutralised.

Recommended power per chapter, shown as *enemyPower / recommended* at normal difficulty. Regulars s2–s3 lie between
s1 and s4.

| Ch | Gate | Regular s1 | Regular s4 | Boss | Elite |
|---|---|---|---|---|---|
| 1 | none | 95 / 114 | 190 / 228 | goblin_camp 198 / 238 | 306 / 367 |
| 2 | none | 246 / 296 | 246 / 296 | bandit_camp 304 / 364 | 485 / 582 |
| 3 | HQ3 | 567 / 681 | 614 / 737 | orc_warband 635 / 762 | 1,060 / 1,280 |
| 4 | HQ4 | 1,200 / 1,440 | 1,290 / 1,550 | troll_bridge 1,330 / 1,600 | 2,200 / 2,640 |
| 5 | HQ5 | 1,070 / 1,290 | 1,570 / 1,890 | undead_legion 1,760 / 2,110 | 2,780 / 3,340 |
| 6 | HQ6 | 1,700 / 2,030 | 1,700 / 2,030 | frost_giant 1,660 / 1,990 | 2,790 / 3,350 |
| 7 | HQ7 | 1,770 / 2,130 | 2,220 / 2,660 | demon_gates 2,370 / 2,850 | 3,920 / 4,700 |
| 8 | HQ7 + HeroQ3 | 1,780 / 2,130 | 1,780 / 2,130 | dragon_lair 2,280 / 2,740 | 4,780 / 5,730 |
| 9 | HQ9 + HeroQ4 | 2,470 / 2,960 | 4,930 / 5,920 | corrupted_arena 5,380 / 6,450 | 9,540 / 11,450 |
| 10 | HQ10 | 5,810 / 6,970 | 7,330 / 8,800 | chaos_titan 7,660 / 9,200 | 13,250 / 15,900 |

World POIs reuse `MONSTERS_CONFIG`, so they get the same numbers:

- Camps: `goblin_camp` 238 and `bandit_camp` 364 recommended.
- Strongholds: from `orc_warband` 762 up to `chaos_titan` 9,200 recommended (compare with siege ×1.22, §A.5).
- World boss `wb_roc` (`frost_giant`): 1,990 recommended.

**Flags for the balance pass:**

- **Scale gap.** The early squad is 17× chapter 2's recommendation. The mid lead squad is 60× the chapter 5 boss.
  The late lead squad is about 1,350× the chapter 9 boss. Every campaign node and world monster would show deep
  green. A recommended number is only useful once monsters are rescaled. Because power is linear in count, the
  pass can set `count × (targetRecommended / currentRecommended)` per chapter. A suggested target is
  recommended ≈ 0.6–0.8 × the expected lead squad at the gate HQ.
- **Non-monotonic difficulty:**
  - Chapter 5's s1 (1,290) is easier than chapter 4's regulars (1,440).
  - Chapter 6's regulars (2,030) are harder than its own boss (1,990).
  - Chapter 8's regulars (2,130) match chapter 7's s1.
  - All of chapter 2's regulars are identical (the `prevBoss` clamp in `chapterStages` collapses `lo` onto `hi`).
  - Moving `stageGenerator` to `rawEnemy` fixes the metric, not the monster data.
- **Chapter 4** plays about 2× harder than its number, because of stacked heals on high-defense units.
- **Regular-stage XP outruns bosses late:** chapter 9 regulars give up to 4,250 XP × 5 full wins, against the boss's
  5,000 × 1 (`REGULAR_MAX_WINS` is 5 regardless of chapter).

---

## C. Level curve

### C.1 Rules

- **Curve (linear increment plus a small quadratic):** `xpToNext(L) = 80 + 150·(L−1) + 5·(L−1)²`.
  - The first step is only 80. The first quest (50) plus the first achievement (50) give level 2 in minute one.
  - The shape follows the "pick a shape, then hand-correct" guidance in the genre research. Every term is a round,
    tunable number.
- **Cap:** `levelCap = 5 × HQ level`, so 50 at HQ10. This matches the HQ-tied hero cap precedent
  (`heroLevelCapPerHQLevel`) and keeps level a faithful activity proxy for AI scaling.
- **Bank:** at the cap, XP keeps accruing up to the total needed for the next 5 levels (one HQ band). Anything beyond
  that is dropped, and the bar reads "XP bank full, upgrade HQ".
  - On `building:completed` for `townhall`, `UserManager` re-runs the level loop. That emits one absolute
    `user:levelUp { level }` per level, and the popup batches them.
  - At L50 the bank is still capped to 5 levels (the cap never rises), and the XP stays visible. Post-cap use is
    open question 3.
- **`deserialize`** recomputes `xpToNext` from the curve. No legacy compatibility is needed.
- **`addXP(amount)`** keeps its name and ignores non-finite or ≤0 amounts. It emits
  `user:xpGained { xp, profile, banked }`.

### C.2 XP per level and cumulative (selected; all 50 levels follow the formula)

| Level | HQ needed | XP to next | Cumulative to reach | Average regular-stage wins per level* |
|---|---|---|---|---|
| 1 | 1 | 80 | 0 | 1 |
| 2 | 1 | 235 | 80 | 4 |
| 5 | 1 | 760 | 1,290 | 4–5 |
| 10 | 2 | 1,835 | 7,140 | 8 |
| 15 | 3 | 3,160 | 18,865 | 9 |
| 20 | 4 | 4,735 | 37,715 | 11 |
| 25 | 5 | 6,560 | 64,940 | 9 |
| 30 | 6 | 8,635 | 101,790 | 9 |
| 35 | 7 | 10,960 | 149,515 | 6 |
| 40 | 8 | 13,535 | 209,365 | 4 |
| 45 | 9 | 16,360 | 282,590 | 3 |
| 49 | 10 | 18,800 | 351,640 | 3 |
| 50 (cap) | 10 | n/a | **370,440** | n/a |

\*Full-reward wins of the chapter that unlocks at that HQ. The average regular XP per chapter is 65, 170, 232, 363,
426, 765, 940, 1,700, 3,250 and 5,883. Each regular gives full XP for only 5 wins, then 10%.

### C.3 XP sources, real amounts, and fit to the cap

The XP a completionist has earned by the end of each HQ, with "repeatable" meaning full-reward wins only:

| HQ | Campaign (full-reward) | Cumulative incl. quests 3,450, achievements, strongholds | + building / research XP (proposed) | Total by end of HQ | Cap XP (L = 5·HQ) | Cap ÷ total |
|---|---|---|---|---|---|---|
| 1 | 8,450 (ch1+ch2) | 12,850 | +76 | 12,926 | 1,290 | 0.10 |
| 2 | 0 | 17,150 | +560 | 17,710 | 7,140 | 0.40 |
| 3 | 7,640 | 28,990 | +1,864 | 30,854 | 18,865 | 0.61 |
| 4 | 12,055 | 42,025 | +4,396 | 46,421 | 37,715 | 0.81 |
| 5 | 13,010 | 62,335 | +9,596 | 71,931 | 64,940 | 0.90 |
| 6 | 22,050 | 88,285 | +19,066 | 107,351 | 101,790 | 0.95 |
| 7 | 27,790 | 131,475 | +32,650 | 164,125 | 149,515 | 0.91 |
| 8 | 44,000 (ch8) | 184,475 | +51,992 | 236,467 | 209,365 | 0.89 |
| 9 | 77,500 | 265,975 | +75,272 | 341,247 | 282,590 | 0.83 |
| 10 | 137,650 | 416,625 | +99,962 | 516,587 | 370,440 | 0.72 |

- Achievements total 45,350 XP. Events grant no XP today; `events.js` rewards are resources and diamonds only.
- HQ1–2 hit the cap almost immediately. That is intended: those HQs last minutes, and the bank carries the surplus
  into HQ3.
- At HQ4–9 the cap binds once 80–95% of the HQ's content is done.
- At HQ10, L50 arrives with about 70% of the endgame done, so the last chapter's grind isn't required for the
  final level.

**Proposed new XP sources ("activity" meter):**

| Event | XP | Total over a full game | Notes |
|---|---|---|---|
| `building:completed` (non-HQ) | `4 × newLevel²` (Lv10 = 400) | about 50k | every instance counts; cheap levels give little |
| `building:completed` (`townhall`) | `40 × newLevel²` (HQ10 = 4,000) | about 15k | the HQ upgrade is the big beat |
| `tech:researched` | `30 × workshopReq²` (Workshop 8 = 1,920) | about 34k | scales with the gate, not with the research count |
| Training batch completion | `ceil(count × tier / 10)`, daily cap `50 × HQ` | about 10k | a resource-to-XP converter, so it is capped |
| Hero recruit / level / star | 0 | 0 | hero progress has its own XP track |

**Time to level** (no pacing target exists in the docs or data, so this is an assumption; see open question 1):

- **Levels 1–5:** the tutorial quests and first achievements give about 2k, so the first 10–15 minutes.
- **Mid-game:** a level is about 9–11 full-reward regular wins, or one HQ-band building spree.
- **Late game:** 3–4 wins of chapter 9 or 10 regulars per level.
- **Camps:** respawn every 30 minutes and give 100–200 XP, so they are ambient, not a driver.

### C.4 March and Survival XP (the reduced-reward gap)

- `CombatManager.resolveMarchBattle` grants the full `monster.rewards.xp` on every win. It skips `_victoryCounts`,
  `maxRewardedWins` and `REDUCED_REWARD_SHARE` (0.1).
  - The world boss `wb_roc` uses `frost_giant` (900 XP) on a 180 s / 90 s window. That is up to 18k XP/hour, more
    than a whole HQ7 band per day of farming.
  - **Proposal:** route march XP through the same `_scaleRewards`, with a per-POI **daily** counter:
    - Camp: 6 full kills a day.
    - World boss: 3 a day.
    - Garrisons: first clear only.
    - Strongholds are captured once, so they are unaffected.
    - Further kills get 10% of the XP (loot unchanged).
  - Store the counters as `{ poiId: { day, wins } }` on `CombatManager`, with seed and reconcile (ADR 0002).
- **Survival** gives 50 XP per wave with `maxRewardedWins: Infinity`. Proposal: XP only for waves above
  `stats.waveHighScore`, and 10% for the rest.
- **Also fix `stats.battlesWon`:** march wins currently don't count, because no `combat:victory` fires. That affects
  the win achievements.

---

## D. Level rewards

Each level's rewards go out as mail attachments through the existing `user:levelUp` mail handler (ADR 0001). The
handler reads `LEVEL_REWARDS[level]` instead of `level × 50` and drops the false "new buildings will unlock" text.

**Every level (L2–50):**

- **Money:** `round50(0.04 × HQ money cap at HQ = ceil(L/5))`. That is 200 (L2–4), 400, 800, 1,700, 3,500, 7,400,
  15,600, 32,800, 68,000 and 144,000 (L46–49). It scales with `townhall.storageCap.money`, so it never becomes noise.
- **Diamonds:** 2 (L2–19), 3 (L20–39), 5 (L40–50).
- **Speedups:**
  - L2–10: 2 × `speedup_universal_5m`.
  - L11–25: 2 × `speedup_universal_15m`.
  - L26–40: `speedup_universal_1h` + `speedup_build_15m`.
  - L41–49: 2 × `speedup_universal_1h`.

**Milestones (every 5th level = the cap of an HQ band).** Milestones replace that level's money with
`0.15 × cap`; the speedups above still apply.

| Level | Money | Diamonds | Items |
|---|---|---|---|
| 5 | 750 | 10 | `token_normal` ×1, `speedup_build_15m` ×2 |
| 10 | 1,500 | 15 | `token_epic` ×1, `xp_bundle_medium` ×1 |
| 15 | 3,000 | 15 | `card_epic` ×1, `speedup_research_1h` ×1 |
| 20 | 6,300 | 20 | `token_epic` ×2, `buff_prod_sm` ×2 |
| 25 | 13,200 | 25 | `token_legendary` ×1, `speedup_universal_1h` ×2 |
| 30 | 27,750 | 30 | `card_epic` ×2, `xp_bundle_large` ×1 |
| 35 | 58,500 | 35 | `token_legendary` ×1, `speedup_build_8h` ×1 |
| 40 | 123,000 | 40 | `card_legendary` ×1, `speedup_research_8h` ×1 |
| 45 | 255,000 | 45 | `token_legendary` ×2, `speedup_universal_8h` ×1 |
| 50 | 540,000 | 100 | `card_legendary` ×1, `speedup_universal_instant` ×2 |

**Lifetime diamonds:** 151 per-level plus 335 milestone = **486**. That is about 37 days of the daily pass (13/day),
roughly one $4.99 pack. It is meaningful but doesn't undercut the passes or the shop.

**Level-up popup.** A modal on the first `user:levelUp` of a batch, with several levels collapsed into one sheet:

- "Commander Level N" (or "Level 21 → 24" for a batch), with the XP bar animating to the new value.
- The reward chips for those levels, with a **Collect** button that claims the level-up mail (one source of truth).
- The next milestone preview: "Level 25: Legendary Recruit Token".
- At the cap: "Level cap 25 reached. Upgrade HQ to Lv.6 to continue (banked 4,210 XP)."
- No power line. Level does not feed power (decision 1).

Sound: the existing `SoundManager` level-up jingle. Use the z-index ladder above `--z-overlay`. It must not
interrupt a battle playback or the tutorial; queue it until the playback or step closes.

---

## E. Data placement and events

**New `js/entities/data/power.js`** (frozen, re-exported from `GAME_DATA.js`, ADR 0002):

```
POWER_RULES = {
  A_REF: 100, D_REF: 120,                       // unitPower references
  FIRST_WAVE_WEIGHT: 0.04,
  ABILITY: { healWeight: 12, reviveWeight: 0, aoeMult: 1.3 },
  ENEMY_CALIBRATION: 1.13, RECOMMENDED_MULT: 1.2,
  BANDS: { green: 1.2, amber: 0.9 },
  STRUCTURE_SIEGE_POWER_MULT: 1.22,
  BUILDING_TROOP_EQUIV: 10, RESEARCH_TROOP_EQUIV: 20,
  NONCOMBAT_CAP_OF_COMBAT: 1/3, NONCOMBAT_FLOOR_PER_HQ: 500,
  COMBAT_TECH_EFFECTS: ['hpBonus', 'attackBonus', 'defenseBonus', 'firstWaveBonus'],
}
```

Hero strike reuses `COMBAT_RULES.HERO_STRIKE`; no duplicate.

**`js/entities/data/progression.js`** (moves the curve out of `UserManager`, per `data-consolidation-plan.md`):

- `PLAYER_LEVEL = { base: 80, step: 150, curve: 5, levelsPerHQ: 5, bankLevels: 5 }`.
- `PLAYER_XP_SOURCES = { building: 4, townhall: 40, researchPerWorkshopSq: 30, trainingPerTierUnit: 0.1,
  trainingDailyCapPerHQ: 50 }`.
- `LEVEL_REWARDS` (per-level rules) and `LEVEL_MILESTONES` (the §D table).
- `MARCH_XP_DAILY_FULL = { camp: 6, world_boss: 3 }`.
- `SURVIVAL_XP_RULE = { newBestOnly: true, otherShare: 0.1 }`.

**Code (later, not this pass):**

- **`js/systems/power/powerMath.js`:** pure functions `unitPower`, `stackPower`, `troopPower`, `heroStrikePower`,
  `enemyPower`, `recommendedPower` and `nonCombatPower`, unit-tested, one test file.
- **`PowerManager`:** inserted after Hero/Tech/Building/Unit in `main.js`, before the UI. It is never serialized:
  `serialize()` returns `null`, and `deserialize` is a no-op.
- **`campaignStages.js`:** stamps `stage.enemyPower` and `stage.recommendedPower` at freeze time.
- **`stageGenerator`:** swaps `lineupPower` for `rawEnemy`.

**Event:** `power:changed { total, breakdown, squads, previous }`, where

```
breakdown = { troops, research, hq, heroAura, heroStrikes, combat,
              buildings, buildingsRaw, ncResearch, ncResearchRaw, nonCombatCap, nonCombat }
squads    = { squad_1: 126787, ... }
```

**Recompute triggers:** mark dirty on any of these, then recompute once in `update(dt)`. This coalesces bursts, such
as a battle that fires `army:updated` and `heroes:updated` together.

- `army:updated` covers train, upgrade, wound, death, assign and march.
- `heroes:updated` covers recruit, level, star and assignment.
- `tech:researched` and `building:completed` (HQ benefits come from the HQ level).
- `difficulty:changed`, if enemy displays are live.
- Plus one explicit compute after the load in `main.js`, because a restored save fires no events.

Emit only when `Math.round(total)` changes.

**Consumers:**

| Consumer | Uses |
|---|---|
| Top bar | the hidden power slot (ADR 0041), showing `total` |
| Profile | breakdown rows with the cap note |
| Stage panel / POI panel / march dialog | squad power against `recommendedPower`, with band colour |
| Battle log entry | `yourPower` and `enemyPower` stored at fight time; the report shows "You 12,400 vs Enemy 8,200" |
| Phase 4 AI | `getPower().combat`, plus `level` from `UserManager`, read for AI scaling |

The battle report shows the squad's power at fight time, before losses. AI uses combat power, not the total, so
buildings never move the AI.

---

## F. Open questions for Steve

1. **Pacing target.** No doc or data says how long HQ1→HQ10 should take. The level curve is fitted to XP content,
   not hours. Give a target (for example "HQ10 in about 30 days") and the curve and the March and Survival caps can
   be re-fitted to time.
2. **Monster scale.** Rescale campaign and world monsters to the power targets now (§B.4: 15× to 1,000×), or ship
   power and "recommended" first, knowing every node shows deep green until the balance pass?
3. **XP at L50.** Is post-cap XP dropped, converted (for example 1 diamond per 2,000 XP), or a "prestige" counter for
   the AI to read?
4. **Bank size.** Is one HQ band (5 levels) the right bank, or should the cap be hard (no bank) so the HQ upgrade is
   the only level burst?
5. **Training XP.** Keep it (capped at `50 × HQ`/day) or drop it, so XP means "progress" and not "spent resources"?
6. **Heal ability.** Chapter 4 plays 2× harder than its power because `heal` restores a share of *all* lost HP every
   round. Accept a stronger weight (fit up to 30), or cap healing per round in `COMBAT_RULES` (a balance change)?
7. **Cavalry.** Same-tier cavalry has about 2.2× infantry power at about 2× the cost. Is that intended?
8. **Hero strike value.** It is fixed per hero (stable, ±50% accurate). Should it instead scale with the squad's
   average effective HP (more accurate, but jumps when troops change)?
9. **Bands.** Green ≥1.2 / amber 0.9–1.2 / red <0.9 against enemy power, which means green = at or above
   Recommended. Keep the three-colour band, or show only Recommended plus the existing win-estimate badge?
10. **Difficulty.** Should "recommended" follow the difficulty setting (it can; easy is about 0.6×) or always show
    normal?
