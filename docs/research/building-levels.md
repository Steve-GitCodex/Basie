# Building levels: genre structure and a 30-level proposal for Basie

Research input for raising building caps from ≤10 to 20–30. Written 2026-10-07. **This is not a design lock.** Decisions
taken from it go into an ADR, and the power/level draft (`power-levels-formula.md`, ADRs 0042/0043) is re-fitted after.

Every Basie number below comes from `js/entities/data/*.js` or from throwaway scripts that import those files (cost
and time are computed the way `buildingRules.scaleCost` and `BuildingManager.build` compute them). Every proposed
number is **[PLACEHOLDER]** until it has been playtested.

Confidence labels: **[official]** is developer or in-game text. **[datamine/wiki]** is a community wiki or tool site
with full per-level tables. **[community]** is a guide site, forum or search excerpt and may be wrong. **[not found]**
means searched with nothing usable found.

## Summary: what matters most for Basie

1. **The genre's main-building cap is 25–30, plus a post-cap "era" band.** Whiteout Survival (WoS) Furnace goes to 30, then FC1–FC10 with Fire
   Crystals. State of Survival (SoS) HQ goes to 30, then plasma stars. Rise of Kingdoms (RoK) City Hall goes to 25. Lords Mobile Castle goes to 25. Last
   War HQ goes to 30, then 31–35 behind a research node and oil. Evony Keep goes to 35 and beyond. [datamine/wiki, community]
2. **Other buildings may not exceed the HQ level.** WoS, Lords Mobile and Evony state this outright. On top of that,
   **HQ N requires one or two specific buildings at N−1.** WoS needs the Embassy at N−1 plus a rotating camp or the
   Research Center. SoS rotates Range, Barracks and Garage at N−1. RoK needs Wall N−1 plus one rotating building. Clash
   of Clans (CoC) is the contrast: each Town Hall level sets a separate max level per building. [datamine/wiki]
3. **The cost and time curves are piecewise exponential.** Early levels are steep and nearly free: L1→10 grows about
   ×1.9–2.0 per level in time, from seconds to about 6 h. **L10→20 grows about ×1.30–1.35 per level in time and
   ×1.47 in cost. L20→30 grows about ×1.27–1.30 in time and ×1.30 in cost.** WoS and SoS are almost identical
   (Furnace/HQ 30 costs 290–300M per main resource and takes 40 days). [datamine/wiki, computed]
4. **Pace.** WoS and SoS take about 0.5 days of build time to reach HQ10, about 13–14 days to HQ20, about 66 days to HQ25
   and about 215 days to HQ30, before speed buffs. Real players get roughly the first 18–20 levels in week one, then
   less than one level a week past 25. [computed from datamine/wiki tables]
5. **Basie today is "arcade" pacing.** HQ10 costs 72.5k and takes **20 minutes**. The whole HQ track is 1.8 h of build
   time. Build time is **linear** (`buildTime × level`), not exponential. Nothing caps other buildings at the HQ level.
   Per-building cost multipliers of 1.6–2.5 already invert costs: **Siege Workshop L10 costs 17× HQ L10, and Hero
   Quarters L10 costs 53×**. Extending those multipliers to L30 would explode (2.5^29 ≈ 3×10¹¹).
6. **Proposal: HQ 30.** The spine buildings go to 30 (military halls, Barracks, Workshop, Storehouse and the four
   producers). Hero Quarters goes to 25. House, Well, Cafeteria, Bank and Comms Tower go to 20. Rally Point goes to 10
   and Construction Hall stays at 3. **One cap rule:**
   `cap(b, HQ) = min(max_b, ceil(max_b × HQ / 30))`. For 30-level buildings that means "≤ HQ". Shorter buildings spread their
   levels across the whole HQ range. HQ N also requires the Workshop and one rotating military building at N−1.
7. **Proposal: one shared curve.** Cost factor ×1.65 per level up to L10, ×1.45 for L11–20 and ×1.30 for L21–30.
   Time stays `buildTime × L` up to L10, then grows ×1.35 per level (L11–20) and ×1.20 (L21–30). HQ L1–10 is
   **identical to today**, L20 is 3.0M / 6.7 h and L30 is 41M / 1.7 d. Production stays linear to L10, then grows
   ×1.09 per level. The modelled completionist pace is HQ20 in about 7 days, HQ25 in about 18 days and HQ30 in about
   6 weeks. That keeps the genre's first two weeks and compresses the late game about 5×.
8. **Content spreads with one remap.** Old HQ gate n becomes new HQ **M(n)**, with
   `M = [1, 2, 4, 6, 9, 12, 15, 18, 22, 26]`. The same table re-indexes chapters 1–10, unlock gates, slots and the
   ADR 0043 monster targets. The targets **keep their values; only the gate HQ changes**. T10 arrives at HQ26. HQ27–30
   is a capstone band.
9. **Power/level draft knock-ons.** The level cap `5 × HQ` would reach 150. Replace it with **5 × era**, interpolated
   per HQ level: 25 at HQ9, 50 at HQ26, 55 at HQ30. The building troop-equivalent becomes
   `infantryPower(eraAt(level))`, so `min(level, 10)` is gone. The money cap follows the era, so the draft's level-reward
   table survives unchanged. Building and research XP coefficients must be re-fitted.
10. **No save migration** (no real users). The work is mostly data plus three duplicated cost/time formulas that should
    become one pure `buildingCurve` module (§3.7).

---

## 1. Genre

### 1.1 Main-building cap and post-cap band

| Game | Main building max | Post-cap band | Evidence |
|---|---|---|---|
| Whiteout Survival | Furnace 30 | FC1–FC10, each with 4–5 sub-steps, costing Fire Crystals and Refined FC; 7–20 days per step | [datamine/wiki] wostools |
| State of Survival | HQ 30 | plasma levels (stars) that cost plasma cores, 8–12 days each | [datamine/wiki] mejoress table; plasma [community] |
| Last Shelter: Survival | **[not found]**: every per-level source returned 402/403. Search results conflate it with *Last War: Survival* | n/a | [not found] |
| Last War: Survival (a close cousin) | HQ 30, then 31–35 behind the "HQ Expansion" research and oil | HQ31–35 | [community] lastwarvault, cpt-hedge |
| Rise of Kingdoms | City Hall 25 | none, but 25 needs a "Master's Blueprint" item and takes 126 days | [datamine/wiki] riseofkingdomsguides |
| Lords Mobile | Castle 25 | none (gear and familiars carry the endgame) | [community] |
| Evony: The King's Return | Keep 35+ (the walls table runs to 50; times past 35 run to thousands of days, so buff-gated) | levels 36–50 | [datamine/wiki] evonyguidewiki |
| Clash of Clans | Town Hall 17 (2025–26) | none; new TH levels ship over the years | [official] Supercell TH17 post |

**Takeaway.** 25–30 is the norm, and 30 is the norm in the survival sub-genre Basie is reskinning toward. Every survival
title adds a currency-gated band *after* 30 instead of raising the number.

### 1.2 How other buildings are capped

- **Building level ≤ main building level.** WoS: "No building can exceed the Furnace level" [community]. Lords Mobile:
  the Castle "increases the max level of other buildings", and Castle 25 is needed for other buildings at 25
  [community]. Evony: "Walls may be upgraded up to Keep level" [datamine/wiki].
- **Prerequisite chain on the main building (N needs X at N−1):**
  - **WoS Furnace N** needs **Embassy N−1** plus one rotating building at N−1: Infantry, Marksman or Lancer Camp, or
    the Research Center. The rotation runs from Furnace 11 to 30. Before 10 the prerequisites are one-off (Sawmill 1,
    Shelter, Coal Mine 3, Hero Hall, Iron Mine 5 and so on). [datamine/wiki]
  - **SoS HQ N** needs Range, Barracks or Garage at N−1, rotating, from HQ5 to 30. [datamine/wiki]
  - **RoK City Hall N** needs **Wall N−1** plus one rotating building at N−1 (Hospital, Storehouse, Academy, Alliance
    Center, Scout Camp, Trading Post, Siege Workshop). [datamine/wiki]
  - **Last War HQ N** needs **Tech Center N−1** at every level from HQ8, plus a rotating partner. [community]
- **CoC (contrast):** each Town Hall level publishes a max level per building, for example "Caps at TH17: Hero Hall 11,
  Laboratory 15". Buildings have very different max levels, and none of them equals the TH level. [community, Supercell post]

**Pattern.** One fixed "spine partner" (Embassy, Wall, Tech Center) plus one rotating building at N−1. The player can
never leave the military or research buildings far behind, and every HQ step costs about three upgrades.

### 1.3 Bands and what they unlock

| Game | Troop-tier gates | Other band beats |
|---|---|---|
| WoS | T9 at Furnace 25–26 (camps 26), T10 at 30; T11 behind FC1 (War Academy) | Furnace 15 Alliance Championship, 22 Chief Gear, 25 Chief Charms [datamine/wiki, community] |
| RoK | T2 at CH8, T3 at 16, T4 at 21, T5 at 25 | 2nd march at 5, 3rd at 11, 4th at 17, 5th at 22; troop cap 2k → 150k [datamine/wiki] |
| Lords Mobile | T5 needs Academy 25, so Castle 25 | march size 200k at Castle 25 [community] |
| Last War | T10 needs HQ30, Tech Center 30, Barracks 30 and a research node | hero cap +5 per HQ (175 at HQ35) [community] |
| SoS | HQ30 opens plasma, which opens plasma troops | [community] |

**Pattern.** Unlocks are front-loaded in *count* (new buildings, 2nd/3rd march) and back-loaded in *weight* (the top
troop tier is the capstone at the max level). March slots arrive at roughly ⅕, ⅖, ⅗ and ⅘ of the range in RoK.

### 1.4 Cost and time curves (computed from the tables)

Per-level growth is the geometric mean over each range (script `genre.mjs`):

| Game | Time ×/level, L5–10 | Time ×/level, L10–20 | Time ×/level, L20–max | Cost ×/level, L10–20 | Cost ×/level, L20–max |
|---|---|---|---|---|---|
| WoS Furnace | 2.05 | 1.30 | 1.28 | 1.47 (wood) | 1.30 |
| SoS HQ | 1.86 | 1.35 | 1.27 | 1.47 (food) | 1.31 |
| RoK City Hall | 1.89 | 1.23 | 1.73 (the L25 Blueprint spike) | 1.50 | 1.50 |
| Last War HQ | n/a | 1.36 | 1.35 | n/a | n/a |
| Evony Walls (keep-gated) | n/a | 1.51 | 1.39 | n/a | n/a |

Anchor values:

| Game | L10 | L20 | L30 |
|---|---|---|---|
| WoS Furnace | 460k wood, 6 h | 21M, 3 d 10 h | 300M, 40 d 4 h |
| SoS HQ | 418k food, 4 h 20 m | 20M, 3 d 12 h | 290M, 39 d 12 h |
| RoK City Hall | 184k, 1 d | 10.8M, 8 d 6 h | L25: 82M, 126 d |

**Shape.** The curve is piecewise. A steep "tutorial" ramp runs to L10, a ×1.3–1.35 time ramp runs through L20, and a
flatter ×1.2–1.3 tail follows (with RoK's deliberate item spike at the cap). Cost grows faster than time through L20
(×1.47 vs ×1.3), so resources become the binding constraint mid-game. Those resources come from gathering, events and
packs, not only from the city's producers.

### 1.5 Time to reach each level

Main-building critical path only, summed build time, **no** construction-speed buffs or speedups:

| Game | to L10 | to L15 | to L20 | to L25 | to L30 |
|---|---|---|---|---|---|
| WoS | 0.6 d | 3.1 d | 13.8 d | 65.6 d | 215 d |
| SoS | 0.4 d | 2.8 d | 13.0 d | 66.0 d | 215 d |
| RoK | 2.4 d | 12.8 d | 42.7 d | 257 d (L25) | n/a |

- Real players run +50–250% construction speed plus speedups, so the calendar is shorter. The community describes
  Lords Mobile Castle 25 as "about 3 months casual" [community].
- **Levels per real-time week** (inferred from the table plus typical buffs): about 15–20 in week 1, about 3–5 a week
  through the high teens, about 1 a week around 20–25, and under 0.5 a week past 25.

---

## 2. Basie today (verified in code and data, 2026-10-07)

### 2.1 Formulas

- **Cost to reach level L:** `floor(base × costMultiplier^(L−1))`, from `buildingRules.scaleCost(base, mult, currentLevel)`.
- **Time to reach level L:** `buildTime × L`. This is **linear** (`BuildingManager.build`, and again at line 562).
  Tech `buildTimeReduction` (Rapid Construction, up to 60%), VIP and the hero build-speed bonus apply after it.
- **The formula is duplicated in three places:** `BuildingManager`, `BuildingInfoPanel` (the per-level rows) and
  `ResourceManager`'s tutorial starting-resource estimate (`building.costMultiplier`).
- **No cap at the HQ level.** `canUpgrade` checks `maxLevel`, the instance ordering (instance N ≤ instance N−1) and
  `levelRequirements[pendingLevel]` (only House → Cafeteria and Bank → population use it). A Barracks can be L8 at HQ3.
- **No HQ prerequisites.** `townhall` has no `levelRequirements`, so the HQ climbs on resources alone.

### 2.2 Per-building numbers (script `current.mjs`)

| Building | Max | Base (sum) | ×/lvl | Base time | Cost at max | Time at max | Cumulative cost | Cumulative time |
|---|---|---|---|---|---|---|---|---|
| HQ (`townhall`) | 10 | 800 | 1.65 | 120 s | 72.5k | 20 m | 183k | 1.8 h |
| Farm | 10 | 110 | 1.6 | 10 s | 7.6k | 1.7 m | 20k | 9 m |
| Iron Mine | 10 | 150 | 1.8 | 15 s | 29.8k | 2.5 m | 67k | 14 m |
| Lumber Mill | 10 | 80 | 1.7 | 12 s | 9.5k | 2 m | 23k | 11 m |
| Quarry | 10 | 120 | 1.8 | 20 s | 23.8k | 3.3 m | 53k | 18 m |
| Storehouse | 10 | 500 | 1.6 | 25 s | 34.4k | 4.2 m | 91k | 23 m |
| Well | 8 | 100 | 1.7 | 15 s | 4.1k | 2 m | 10k | 9 m |
| House | 10 | 200 | 1.6 | 20 s | 13.7k | 3.3 m | 36k | 18 m |
| Cafeteria | 8 | 320 | 1.8 | 30 s | 19.6k | 4 m | 44k | 18 m |
| Bank | 8 | 800 | 2.0 | 60 s | 102k | 8 m | 204k | 36 m |
| Barracks | 8 | 350 | 1.9 | 30 s | 31.3k | 4 m | 66k | 18 m |
| Archery Range | 10 | 300 | 1.9 | 45 s | 96.8k | 7.5 m | 204k | 41 m |
| Hero Quarters | 10 | 1,000 | **2.5** | 120 s | **3.81M** | 20 m | 6.36M | 1.8 h |
| Rally Point | 6 | 660 | 2.0 | 60 s | 21.1k | 6 m | 42k | 21 m |
| Workshop | 8 | 800 | 2.1 | 90 s | 144k | 12 m | 274k | 54 m |
| Construction Hall | 3 | 900 | 2.2 | 100 s | 4.4k | 5 m | 7k | 10 m |
| Infantry Hall | 10 | 550 | 2.0 | 45 s | 282k | 7.5 m | 563k | 41 m |
| Cavalry Stable | 10 | 800 | 2.1 | 80 s | 635k | 13 m | 1.21M | 1.2 h |
| Siege Workshop | 10 | 1,050 | 2.2 | 120 s | **1.27M** | 20 m | 2.32M | 1.8 h |
| Comms Tower (`magictower`) | 8 | 1,300 | 2.5 | 180 s | 793k | 24 m | 1.32M | 1.8 h |

HQ track: L2 1.3k / 4 m, L5 5.9k / 10 m, L10 72.5k / 20 m.

- **Pacing model (`economy.mjs`):** production only (no quests, crates or gathering), 2 builders, −40% build time, and
  production bonuses rising to ×3.4 at L10 (Reinforced Lumber plus the HQ production bonus).
  - **Completionist, everything to max:** about 1.8 days, resource-bound (resource time is 6–18× builder time).
  - **HQ alone:** 1.8 h of build time.
- **Storage:** HQ plus 2 Storehouses hold 1.6M wood at L10, which is about 25× the next HQ wood cost (roughly
  10–14× when only one Storehouse is counted). The `money` array grows ×2.1 per level (5k → 3.6M). Buildings never
  cost money. Money pays for units, research and the power draft's level rewards (4% of the HQ money cap).

### 2.3 What is keyed to building levels

| What | Where | Values today |
|---|---|---|
| Buildings, unit types and techs unlocked by HQ | `HQ_UNLOCK_TABLE` (headquarters.js reads it) | HQ2 Archery, Infantry Hall, Bank. HQ3 Cafeteria, House. HQ4 Hero Quarters, Cavalry. HQ5 Workshop, Siege. HQ8 Comms Tower. |
| HQ benefits | the same table; `headquarters.benefits` **sums** the per-level entries | at HQ10: production +95%, attack +59%, defense +56%, storage +140% (storage looks unread by `computeStorageCaps`) |
| Building `requires` | buildings.js | Cafeteria HQ2, Bank HQ3, Rally HQ3, Workshop HQ5, Hero Quarters Barracks 3 + HQ4, Cavalry Infantry Hall 3 + HQ4, Siege Workshop 1 + HQ5, Comms Tower Workshop 5 + HQ8 |
| Instance slots | `instanceSlots[].condition` | Farm HQ 3/5/7; Mine and Quarry HQ 4/6; Lumber HQ 3/5; Well HQ 3/6; Storehouse HQ5; House HQ 2/3/5/7/9; Bank HQ6; Barracks HQ 4/6/8 |
| Squad slots | `barracks.squadSlots` | Barracks 3/5/7 |
| Squad size | `barracks.levelStats[].slotCapacity` (8 entries) | 200 → 4,000 |
| Marches | `rallypoint.levelStats` (6 entries) | 2/3/4 marches at Lv 1/3/5; +5% speed per level |
| Training | `trainingSlots[]` × 4 halls (10 entries each) | concurrent slots at 1/3/6/9; ×1.0/0.9/0.8/0.7 time; `maxTrainableTier` = level; batch 25 × level |
| Troop tiers | `UNIT_TIER_REQUIREMENTS` | T1–T3 at hall 1; T4–T10 at hall 2–8 plus mastery 1–7 |
| Mastery and other tech gates | `tech.js` `requires` / `levelRequirements` | Workshop 1–8; Barracks 3–8; halls 3–9; Well 2–6 |
| Queues | `QUEUE_CONFIG` | research slots at Workshop 2/4/6; build slots at Construction Hall 1/2/3 |
| Hero level cap | `heroProgression.levelCap()` | **Hero Quarters level × 10** (not the HQ), so 100 at Hero Quarters 10 |
| Campaign gates | `CAMPAIGNS_CONFIG` and `MONSTERS_CONFIG.requires` | chapters 3–10 at HQ 3/4/5/6/7/7/9/10, plus Hero Quarters 2–5 for chapters 7–10 |
| City sectors | `citySectors.RING_HQ_GATE` | ring 1 HQ2, ring 2 HQ4 |
| Nav tabs | `navigation.js` `hq_level` | Challenges HQ2, Events HQ3 |
| Crates | `tradingPost` `moneyPerHqLevel: 100`, `resourceBase × hqLevel` | linear in HQ |
| Sprites | `cityAssets.gritBucket` | level clamped to 3 art buckets |
| Cafeteria and Bank arrays | `foodCapacityPerLevel` (9 entries), Bank population ladder (L2–8) | n/a |

### 2.4 Findings that shape the proposal

1. **Linear time cannot stretch to 30.** At L30 the HQ would take only 60 minutes.
2. **Per-building multipliers are inconsistent.** The genre prices spine buildings *below* the main building. Basie
   prices Siege Workshop, Hero Quarters, Cavalry Stable and Comms Tower 9–53× *above* the HQ at the same level.
   One shared curve with per-building base costs fixes this.
3. **Without a cap at the HQ level, a level number means nothing as a gate.** Any "HQ N" content can be bypassed by
   rushing side buildings, and the power draft's "building level ↔ troop tier" mapping has no anchor.
4. **The HQ benefits are cumulative sums.** Copying today's increments up to L30 would push attack to about +300%. The
   increments have to be re-spread.
5. **Production is linear per level**, while costs are exponential. Above L10 the economy needs either geometric
   production or outside income (gathering, crates, events); the genre uses both.

---

## 3. Proposal

### 3.1 Target max levels

| Max | Buildings | Why |
|---|---|---|
| **30** | HQ, Barracks, Infantry Hall, Archery Range, Cavalry Stable, Siege Workshop, Workshop, Storehouse, Farm, Lumber Mill, Quarry, Iron Mine | The spine and the economy. 30 matches WoS, SoS and Last War, and 30 ÷ 10 gives an even 3 HQ levels per troop tier. |
| **25** | Hero Quarters | Hero cap `4 × level` reaches 100 at 25, today's cap. |
| **20** | House, Well, Cafeteria, Bank, Comms Tower | Support buildings with population or ladder arrays. 20 is enough to keep them relevant. |
| **10** | Rally Point | Five marches at most (2/3/4/5 at Lv 1/3/6/10); the speed bonus caps at +45%. |
| **3** | Construction Hall | Build-queue slots. A level is a slot, so there is nothing to stretch. |

**HQ 25 instead of 30?** It is possible. Take every table below and scale the HQ by ×0.83. It gives up the even
tier/HQ cadence and the survival-genre "30", and it saves about 2 weeks at the top of the curve. Recommend 30.

### 3.2 The cap rule and the HQ chain

**Rule 1: proportional cap.**

```
levelCap(b, hq) = min(b.maxLevel, ceil(b.maxLevel × hq / HQ_MAX))      HQ_MAX = 30
```

- For 30-level buildings this is exactly "≤ HQ" (the genre rule).
- 20-level buildings advance 2 levels per 3 HQ levels, 25-level ones 5 per 6, and Rally Point 1 per 3. **Every HQ
  level therefore unlocks something in the short buildings too**, so they don't max out at HQ20 and leave HQ21–30 empty.
- **Exempt:** Construction Hall (`capRule: 'none'`). Queue slots should not wait for HQ11/21.
- **Implementation:** one check in `canUpgrade` and `getMissingRequirements` ("Requires HQ Lv.N"), with the cap from
  a pure helper.

**Rule 2: the HQ prerequisite chain** (`townhall.levelRequirements`, a schema that already exists):

| HQ N | Requires (at N−1 unless shown) |
|---|---|
| 2 | none (as today) |
| 3 | Farm 2 |
| 4 | Barracks 3 |
| 5 | Infantry Hall 4 |
| 6 | Storehouse 5 |
| 7 | Barracks 6 |
| 8 | Archery Range 7 |
| 9 | Barracks 8 |
| 10–30 | **Workshop N−1** + a rotating partner at N−1, cycling Barracks → Infantry Hall → Archery Range → Cavalry Stable → Siege Workshop → Storehouse (10 Barracks, 11 Infantry Hall, 12 Archery, 13 Cavalry, 14 Siege, 15 Storehouse, 16 Barracks, …) |

- The Workshop is Basie's "Embassy / Tech Center": the fixed partner from HQ10. It unlocks at HQ9 (§3.4).
- The early one-offs teach a building each, as WoS's L2–10 prerequisites do.

### 3.3 Cost, time, production and storage curves

**Shared curves.** These replace the per-building `costMultiplier`; `buildTime` is kept as the per-building time weight.

```
costFactor(L) = Π_{l=2..L} g(l),  g = 1.65 (l ≤ 10), 1.45 (11–20), 1.30 (21–30)
cost_b(L)     = floor(baseCost_b × costFactor(L))
timeFactor(L) = L                                  (L ≤ 10, today's linear rule)
              = 10 × 1.35^(L−10)                   (11–20)
              = 10 × 1.35^10 × 1.20^(L−20)         (21–30)
time_b(L)     = buildTime_b × timeFactor(L)
```

| L | costFactor | timeFactor | HQ cost | HQ time | Farm | Barracks | Infantry Hall | Siege Workshop | Workshop |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 1 | 800 | 2 m | 110 / 10 s | 350 / 30 s | 550 / 45 s | 1.1k / 2 m | 800 / 1.5 m |
| 5 | 7.4 | 5 | 5.9k | 10 m | 815 / 50 s | 2.6k / 2.5 m | 4.1k / 4 m | 7.8k / 10 m | 5.9k / 7.5 m |
| 10 | 90.6 | 10 | **72.5k** | **20 m** | 10.0k / 2 m | 31.7k / 5 m | 49.9k / 7.5 m | 95k / 20 m | 72.5k / 15 m |
| 15 | 581 | 44.8 | 465k | 1.5 h | 64k / 7 m | 203k / 22 m | 320k / 34 m | 610k / 1.5 h | 465k / 1.1 h |
| 20 | 3,724 | 201 | 3.0M | 6.7 h | 410k / 34 m | 1.3M / 1.7 h | 2.0M / 2.5 h | 3.9M / 6.7 h | 3.0M / 5 h |
| 25 | 13,828 | 500 | 11.1M | 16.7 h | 1.5M / 1.4 h | 4.8M / 4.2 h | 7.6M / 6.3 h | 14.5M / 16.7 h | 11.1M / 12.5 h |
| 30 | 51,342 | 1,245 | 41.1M | 1.7 d | 5.6M / 3.5 h | 18.0M / 10.4 h | 28.2M / 15.6 h | 53.9M / 1.7 d | 41.1M / 1.3 d |

- Costs are summed across resources. HQ wood alone is 500 (L1), 3.7k (L5), 45k (L10), 290k (L15), 1.9M (L20),
  6.9M (L25) and 25.7M (L30).
- **Early pacing.** HQ L1–10 is identical to today (same 1.65 factor, same linear time). The Farm and Storehouse
  (today ×1.6) cost about 30% more at L10. The ×1.9–2.5 buildings get cheaper at L5–10. Example: Infantry Hall L10
  goes from 282k to 50k. This is intended (finding 2).
- **Base-cost hygiene [tuning].** With one curve, `baseCost` is the whole price ratio. Siege Workshop (1,050), Hero
  Quarters (1,000) and Comms Tower (1,300) sit above the HQ (800). The genre puts spine buildings at about 0.3–0.8× the
  main building. Suggestion: trim them to ≤ 800.
- **Against the genre.** Mid-band growth is ×1.45 cost / ×1.35 time (genre ×1.47 / ×1.30–1.35). The tail is ×1.30
  cost / ×1.20 time (genre ×1.30 / ×1.27). The late time curve is deliberately flatter: HQ30 takes 1.7 days, not
  40 days.

**Production** (a per-level multiplier on `effects.<resource>`):

```
prodFactor(L) = L                    (L ≤ 10, today)
              = 10 × 1.09^(L−10)     (L > 10)    → 15.4 at L15, 23.7 at L20, 36.4 at L25, 56 at L30
```

- **Why 1.09.** From band 10 to band 30, the wood needed per band grows 336× and the band's builder time grows 70×.
  Income must therefore grow about 4.8× over 20 levels (1.08 per level) to keep today's ratio of resource time to
  build time. 1.09 leaves some slack for the cheaper military curve.
- A per-level effect (`+0.8 wood/s × prodFactor`) replaces the linear "+0.8/s per level". **Crates and gathering must
  scale too.** `crateRoll` is `resourceBase × hqLevel` (linear) and should become `resourceBase × prodFactor(hq)`, or
  the late game starves.

**Storage** (resource arrays extended to 31 entries):

- Wood, stone, iron, food and water: today's L10 value × ×1.40 per level (L11–20) and × ×1.25 per level (L21–30).
- Combined wood (HQ + 2 Storehouses): 3.2M (L12), 8.7M (L15), 46.9M (L20), 143M (L25), 436M (L30). That is 14–25× the
  next HQ cost, so `ECONOMY_PARAMS.storageBuffer` (2×) holds everywhere [tune down if storage should bind].
- **Money follows the era instead (§3.5),** because no building costs money.

**Pacing** (`economy.mjs`, completionist, production only, 2 builders, −40% build time, production bonus ×3.4 from L10):

| Reach every building at | Builder time / band | Resource time / band | Cumulative |
|---|---|---|---|
| HQ5 | 38 m | 51 m | 4.6 h |
| HQ10 | 1.3 h | 2.9 h | 13 h (today about 1.8 d, because of the high-multiplier military buildings) |
| HQ15 | 5.5 h | 10.4 h | 1.9 d |
| HQ20 | 1.0 d | 1.8 d | 7.4 d |
| HQ25 | 1.7 d | 3.0 d | 18.3 d |
| HQ30 | 3.7 d | 6.5 d | **42 d** |

- **HQ-only build time** (−40%) is 0.04 d to HQ10, 0.66 d to HQ20 and 5.9 d to HQ30. The chain in §3.2 makes the real
  critical path sit between that and the completionist figure.
- **Levels per week (Basie, proposed):** week 1 reaches HQ about 19–20, week 2 about 23, week 4 about 27, week 6 HQ30.
  The genre's week 1 looks the same, and the genre needs about 7 months for 30.

### 3.4 How the content spreads: one remap

**Old HQ gate n → new HQ M(n):**

| Old n | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| **M(n)** | 1 | 2 | 4 | 6 | 9 | 12 | 15 | 18 | 22 | 26 |

- The gaps grow (1, 2, 2, 3, 3, 3, 3, 4, 4) because time per level grows. Real time between unlocks stays roughly
  even early and stretches late, as in the genre.
- **The same M applies to building-level gates** (Workshop, Barracks and hall levels in tech and units), because a
  building is capped at the HQ. "Old level k" becomes "new level M(k)".
- **HQ27–30 is the capstone band.** It has no M slot; its content is listed below.

| System | Today | Proposed |
|---|---|---|
| Building unlocks (`HQ_UNLOCK_TABLE`) | HQ 2/3/4/5/8 | Archery, Infantry Hall, Bank **2**. Cafeteria, House **4**. Hero Quarters, Cavalry **6**. Workshop, Siege **9**. Comms Tower **18**. |
| `requires` | as §2.3 | Rally Point HQ4. Hero Quarters Barracks 4 + HQ6. Cavalry Infantry Hall 4 + HQ6. Siege Workshop 1 + HQ9. Comms Tower Workshop 9 + HQ18. |
| Instance slots | as §2.3 | Farm 4/9/15. Mine and Quarry 6/12. Lumber 4/9. Well 4/12. Storehouse 9. House 2/4/9/15/22. Bank 12. **Barracks 6/12/18.** |
| **Troop tiers** (first trainable) | T1–3 HQ2, then mastery from HQ5 to about 10 | T1–T3 **2** (halls Lv 1/2/4), T4 **9** (Workshop), T5 **11**, T6 **13**, T7 **15**, T8 **18**, T9 **22**, T10 **26** |
| `UNIT_TIER_REQUIREMENTS.minBuildingLevel` | 1,1,1,2…8 | 1, 2, 4, 9, 11, 13, 15, 18, 22, 26 (= the tier table). `trainingSlots.maxTrainableTier` should read the same table instead of duplicating it. |
| Mastery `levelRequirements` (level k → tier k+3) | Workshop 3–8, hall 3–9 | Hall = tier HQ. Workshop = M(old Workshop requirement). Infantry: Workshop 4/6/9/12/12/15/18. |
| Other tech gates | Workshop 1–8, Barracks 3–8, Well 2–6 | each level mapped through M. Example: Elite Training L5 needs Workshop 18 + Barracks 18. |
| **Campaign chapters** | 3–10 at HQ 3/4/5/6/7/7/9/10 | **3: HQ4, 4: 6, 5: 9, 6: 12, 7: 15, 8: 18, 9: 22, 10: 26** (chapter 8's old "HQ7" becomes 18, matching its own +Hero Quarters gate) |
| Chapter Hero Quarters gates | Hero Quarters 2/3/4/5 (hero cap 20–50) | Hero Quarters **5/8/10/13** (same hero cap: 4 × level) |
| Hero level cap | Hero Quarters × 10, max 100 | **Hero Quarters × 4**, max 25 → 100. Hero Quarters ≤ ceil(25 × HQ / 30). |
| Squad slots per barracks | Barracks 3/5/7 | Barracks **4/9/15** |
| `slotCapacity` (30 entries) | 200 → 4,000 at L8 | old values at M(n), linear between, then 5,000 (L22), 6,500 (L26), 8,000 (L30): `200,500,650,800,1000,1200,1350,1550,1700,1900,2100,2300,2550,2750,3000,3350,3650,4000,4250,4500,4750,5000,5400,5750,6150,6500,6900,7250,7650,8000` |
| Marches (Rally Point ≤ ceil(HQ/3)) | 2/3/4 at Rally 1/3/5 | **2/3/4/5 at Rally 1/3/6/10**, which is HQ 4/7/16/28 |
| Training concurrency | hall 1/3/6/9 | hall **1/4/12/22**; time multiplier steps move with them; batch `25 × L` |
| Research slots | Workshop 2/4/6 | Workshop **2/6/12** |
| Build slots | Construction Hall 1/2/3 | unchanged (exempt from the cap rule) |
| City sector rings | HQ 2/4 | HQ **2/6** |
| Nav tabs | Challenges HQ2, Events HQ3 | Challenges **2**, Events **4** |
| HQ benefits | per-level increments, summed | re-spread so the cumulative value at M(n) equals today's at n, then a capstone. Attack: +7% (HQ9), +21% (15), +44% (22), **+59% (26)**, +67% (30). The other benefits follow the same rule. |
| Sprites | 3 buckets (level clamped) | buckets by **era**: 1 (L1–9), 2 (10–19), 3 (20–29), 4 (30), so the art changes at band boundaries |

**The capstone band (HQ27–30)** gets:

- the 5th march (HQ28);
- Hero Quarters 23–25 (hero cap 92–100);
- Comms Tower 19–20;
- the HQ benefit capstone;
- the last squad-size steps.

This is the band where the survival games put FC/plasma. Whether a post-30 band or chapters 11–12 follow is open
question 4.

**Research depth.** Most techs top out at Workshop gates that map to about 18. Workshop levels 19–30 currently feed only
mastery 7 and the HQ chain. The research tree needs extra levels or new techs for the late band. This proposal does not
size those; see open question 6.

### 3.5 Knock-on changes to the power and level draft

**Era helper (new, pure):** `eraAt(L) = max n such that M(n) ≤ L` (1–10). Several rules below use it to keep the
draft's scale.

| Draft item | Today (assumes HQ 1–10) | Proposed |
|---|---|---|
| **Player level cap** | `5 × HQ` (would be 150) | **5 × era, interpolated per HQ level** so that every HQ step raises it: 1:5, 2:10, 3:12, 4:15, 5:17, 6:20, 7:21, 8:23, 9:25, 10:26, 11:28, 12:30, 13:31, 14:33, 15:35, 16:36, 17:38, 18:40, 19:41, 20:42, 21:43, 22:45, 23:46, 24:47, 25:48, 26:**50**, 27:51, 28:52, 29:53, 30:**55** |
| XP curve and bank | `80+150(L−1)+5(L−1)²`, 370k to L50; bank of 5 levels | keep both. L55 is about 475k (L60 would be 595k). The fit of the cap to XP content per chapter holds, because chapters moved with M. |
| Building troop-equivalent | `10 × infantryPower(min(level,10))` | `10 × infantryPower(eraAt(level))`: L1 T1, 2–3 T2, 4–5 T3, 6–8 T4, 9–11 T5, 12–14 T6, 15–17 T7, 18–21 T8, 22–25 T9, 26–30 T10 |
| Research troop-equivalent | infantry tier of the Workshop requirement | infantry tier `eraAt(workshopReq)` |
| Non-combat floor | `500 × HQ` | `500 × eraAt(HQ)` (keeps the 5,000 ceiling) |
| Building XP | `4 × level²` (HQ `40 × level²`) | `0.3 × level²` (HQ `5 × level²`; HQ30 is 4,500, close to the old HQ10 4,000) **[re-fit]**. There are about 3× as many upgrades, so the old coefficient would roughly triple building XP. |
| Research XP | `30 × workshopReq²` | `30 × eraAt(workshopReq)²` (same totals) |
| HQ money cap (level rewards = 4% / 15% of it) | ×2.1 per level, 3.6M at HQ10 (×2.1 to HQ30 would be 10¹³) | **money cap follows the era.** Old value at M(n), geometric between, ×1.25 per level after 26: 5k (1), 10k (2), 20k (4), 42k (6), 88k (9), 185k (12), 390k (15), 820k (18), 1.7M (22), 3.6M (26), 8.8M (30). The draft's money for L2–50 is **unchanged**; L51–55 use the HQ30 cap. |
| Level milestones | every 5th level = HQ band cap | still every 5th level (it now equals the era cap); add L55 |

**Monster rescale targets (ADR 0043).**

- **The targets keep their values; only the gate HQ changes.** Chapter k's boss target is still
  0.7 × "the lead squad at chapter k's gate". The gate is now M(k), and Barracks slots, squad size and tiers were
  re-indexed by the same M.
- A cross-check model (`content2.mjs`, 4 squad slots of a ⅓ infantry / ⅓ ranged / ⅓ cavalry mix of the best tier,
  bonus multipliers interpolated from the draft's example players) uses a realism factor of 0.11, fitted to the draft's
  examples. It reproduces the draft's HQ5 and HQ9 lead squads within 0.6–0.9×.

| Chapter | New gate | Old gate | Model lead squad | **Boss recommended target (0.7×)** | Camp target (0.4×) |
|---|---|---|---|---|---|
| 1–2 | HQ1–2 | none | 0.5–3.6k | 340 – 2.5k | 190 – 1.4k |
| 3 | HQ4 | HQ3 | 12.5k | 8.7k | 5.0k |
| 4 | HQ6 | HQ4 | 20k | 14k | 8.1k |
| 5 | HQ9 | HQ5 | 79k (draft 127k) | 55k (draft basis 89k) | 32k |
| 6 | HQ12 | HQ6 | 257k | 180k | 103k |
| 7 | HQ15 | HQ7 | 1.39M | 0.97M | 0.56M |
| 8 | HQ18 | HQ7 + Hero Quarters 3 | 3.45M | 2.4M | 1.4M |
| 9 | HQ22 | HQ9 | 8.06M (draft 8.69M) | 5.6M (draft basis 6.1M) | 3.2M |
| 10 | HQ26 | HQ10 | 17.1M | 11.9M | 6.8M |
| (capstone) | HQ30 | none | 22.8M | 16.0M (world boss / elite tier) | 9.1M |

- **Recommendation:** use the draft's example-player numbers (the ADR 0043 basis) for chapters 5 and 9, and this model
  for the chapters it did not cover. Re-derive all of them from simulated players once the curves are in data.
- The model's mid-chapter numbers rise faster than the draft's because squad slots and capacity now arrive together.

### 3.6 Alternatives considered

| Option | Verdict |
|---|---|
| Plain "≤ HQ" for every building | Genre-pure, but 20-level buildings max out at HQ20 and leave the last third of the game without side upgrades. The proportional rule is "≤ HQ" for the 30-level buildings anyway. |
| CoC-style per-HQ max table per building | Most control, but 20 buildings × 30 rows of data, and it loses the one-line rule. Use it only if the proportional rule feels wrong in play. |
| Keep per-building multipliers | Not viable to 30: 2.5^29 overflows any economy, and cost order is already inverted at L10. |
| Mechanical remap with no hand-correction | It would put T4–T6 all at HQ9–10 (today's HQ5–6 burst) and T10 at HQ22. The tier table above is hand-spread (9/11/13/15/18/22/26). |
| HQ 25 | Viable; see §3.1. |

### 3.7 Change list and migration

- **No save migration** (no real users; `basie-no-legacy-compat`). A dev save with, for example, Barracks 8 at HQ5
  stays loadable. It just can't upgrade until the HQ catches up.
- **Data:**
  - `buildings.js`: `maxLevel`; drop `costMultiplier`, which becomes the shared curve; `storageCap` arrays to 31
    entries; `levelStats` (Barracks 30, Rally 10); `trainingSlots` to 30; `squadSlots`; `instanceSlots`; `requires`;
    `townhall.levelRequirements` (new chain); Cafeteria and Bank arrays/ladders to 20; House → Cafeteria ladder;
    `HQ_UNLOCK_TABLE` to 30, with benefits re-spread; `QUEUE_CONFIG.research`; `ECONOMY_PARAMS`.
  - Other data files: `units.js` tier requirements; `tech.js` `requires` / `levelRequirements`; `heroes.js`
    `heroLevelCapPerHQLevel` 10 → 4; `combat.js` `MONSTERS_CONFIG.requires` + `CAMPAIGNS_CONFIG`;
    `citySectors.RING_HQ_GATE`; `navigation.js` `hq_level`; trading crates (`× hqLevel`); world POI `level` display
    values; story and achievement building-level triggers (audit `building_level` targets).
- **New pure modules:**
  - `js/systems/building/buildingCurve.js`: `costFactor`, `timeFactor`, `prodFactor`, `levelCap`.
  - `eraAt`, plus the data constants `BUILDING_CURVE` and `ERA_HQ = M`.
  - It replaces the three copies of the cost/time formula: `BuildingManager` (two places), `BuildingInfoPanel` and
    `ResourceManager`'s tutorial estimate.
- **Code:** add the cap check in `canUpgrade` and `getMissingRequirements`. Production reads `prodFactor`. Remove the
  duplication between `trainingSlots.maxTrainableTier` and `UNIT_TIER_REQUIREMENTS`. `gritBucket` maps by era.
- **Tests (additive):**
  - `buildingCurve` unit tests: HQ L1–10 equal to today's values, monotonic, and the L30 anchors.
  - A `gameData` test: every `requires` / `levelRequirements` is satisfiable under the cap rule, and no gate exceeds 30.
  - Retest the tutorial (the HQ2 step and starting resources).
- **Docs:** an ADR for the levels and curve; re-fit `power-levels-formula.md` §B–§D; amend ADR 0043's gate column;
  update `city-view.md` / `economy.md`.

---

## 4. Open questions for the owner

1. **Pacing target.** The model gives HQ30 in about 6 weeks for a completionist (genre: about 7 months). Is that the
   target, or should the late tail be longer (time ×1.25/level after L20 gives about 2.5 d at HQ30) or shorter?
2. **HQ 30 or 25?** The recommendation is 30.
3. **Proportional cap or plain "≤ HQ"?** The proportional rule keeps short buildings levelling to the end. The plain
   rule is the genre convention.
4. **The capstone band.** HQ27–30 has the 5th march, the hero cap to 100 and benefit capstones. Add chapters 11–12, or
   plan a post-30 "era" band (WoS FC / SoS plasma style, using a new currency) for later? (The rule on staying in phase
   scope suggests parking this in the backlog.)
5. **Military building cost order.** Accept that Siege, Cavalry, Hero Quarters and Comms Tower become *cheaper* at
   L5–10 than today, with base costs trimmed to ≤ HQ?
6. **Research depth.** Extend tech max levels or add techs for Workshop 19–30 now, or later?
7. **External income.** Crates and gathering scale with `prodFactor(HQ)`, assumed here. Should march gathering also
   scale (node capacity and rate by region level)?
8. **Hero cap.** It stays on Hero Quarters (×4, Hero Quarters max 25). Or move it to the HQ the way Last War does
   (+5 per HQ level gives 150 at 30, which would need hero data to 150)?
9. **Storage pressure.** Storage at 14–25× the next HQ cost never binds. Tighten it to make Storehouse levels matter?
10. **Player-level cap rule.** Use the interpolated 5 × era (55 at HQ30), or a simpler `HQ + 25`-style rule?

---

## Sources

Fetched unless noted "excerpt".

- WoS Furnace L1–30 + FC table, prerequisites and times: https://wostools.net/wiki/buildings/furnace (fetched).
  Building ≤ Furnace: https://www.bluestacks.com/blog/game-guides/white-out-survival/wos-furnace-guide-en.html ,
  https://hostedgg.com/blog/whiteout-survival-beginner-progression-guide (excerpt). T9/T10 gates:
  https://commonsensegamer.com/your-troops-in-whiteout-survival-everything-you-need-to-know/ (excerpt)
- SoS HQ L2–30 costs, times and N−1 prerequisites: http://www.mejoress.com/state-of-survival-hq-requirements/
  (fetched). Plasma after 30: https://www.pockettactics.com/state-of-survival/plasma (excerpt),
  https://progameguides.com/guides/state-of-survival-headquarters-requirements/ (403)
- RoK City Hall L1–25 (prerequisites, costs, times, unlocks, troop cap):
  https://riseofkingdomsguides.com/rise-of-kingdoms-city-hall-requirements-and-cost/ (fetched)
- Lords Mobile Castle 25, march size, other buildings capped by Castle:
  https://lordsmobile.fandom.com/wiki/Battle_Hall?oldid=9861 (excerpt), https://gameplay.tips/guides/4282-lords-mobile.html (excerpt)
- Evony Walls ≤ Keep, L1–50 table: https://evonyguidewiki.com/en/walls-en (fetched)
- Last War HQ 1–35 (cousin of Last Shelter): https://lastwarvault.com/guides/general/hq-progression/ (fetched),
  https://cpt-hedge.com/guides/hq-requirements (fetched; strategy only)
- Last Shelter: Survival (all **[not found]**: 402/403): https://last-shelter-survival.fandom.com/wiki/Headquarters ,
  https://www.appgamer.com/last-shelter-survival/strategy-guide/base-building-resource-requirements ,
  https://www.mrguider.org/guides/last-shelter-survival-base-upgrade-requirements/
- CoC TH17 and per-TH max levels: https://supercell.com/en/games/clashofclans/blog/game-updates/the-town-hall-17-update-is-here-2/ (excerpt),
  https://clashguideswithdusk.net/2026/07/th17-max-levels-list-clash-of-clans/ (excerpt)
- Scripts (scratchpad, not committed): `current.mjs` (today's curves), `genre.mjs` (genre multipliers and cumulative
  days), `proposal.mjs` / `economy.mjs` (proposed curves and pacing), `content2.mjs` (remap, slot capacity, level cap,
  money cap and monster targets).
