# Combat model research

Research input for replacing `CombatManager._simulateBattle` with one shared resolver used by
campaign stages, world-map marches, and future PvP/Arena. Written 2026-10-02. This is not a
design lock. A decision taken from it should go into an ADR.

Confidence labels for game-specific claims:
**[official]** comes from the developer or from in-game text.
**[datamine]** comes from a long-standing community wiki or datamine that is widely checked.
**[community]** comes from player testing or guides and may be wrong.

## Summary: what matters most for Basie

1. **Pick a defense curve that weakens small hits without zeroing them.** Pure subtraction
   (`atk − def`) produces a cliff. Below the cliff, a whole tier of units does almost nothing.
   Pure division (`atk × K/(K+def)`) has no cliff, but it ignores how big a hit is, so swarms
   still win. The hit-size ratio `atk² / (atk + def)` sits between the two. It has the same
   shape as Path of Exile's armour formula. A 25-attack hit into 100 defense does 5 damage, and
   a 1000-attack hit into 10 defense does 990. That matches the owner's rule.
2. **None of the studied 4X games pools a whole army into one number and one loss rate.** Each
   one resolves per troop group over rounds, with a counter triangle and targeting rules
   (front line, one group per round). How casualties are distributed is a design choice of its
   own, and games make it on purpose. Evony's "layering" meta shows what happens when targeting
   is per group and nobody guards it.
3. **Under Lanchester's square law, numbers matter as N².** Basie needs a stat curve that
   reduces what each weak unit can deal. Raw troop count should not do that job. RoK-family
   community models instead damp numbers with `√troops`.
4. **The resolver must be deterministic from the start.** Use seeded RNG, integer-friendly
   arithmetic, and no `Math.pow`/`exp`, so one module can run in the browser now and on a
   server later. A battle report can then be stored as `{rulesVersion, seed, inputs}` and
   replayed.
5. **Heroes should feed the resolver data, not code.** That data is stat multipliers from the
   existing stat aggregator plus skill descriptors such as `strike {power, targetRule}`. A
   hero strike is just another hit through the same formula.

---

## 1. Damage vs defense formulas

| Family | Formula | Example (source) | 25 vs 100 | 1000 vs 10 |
|---|---|---|---|---|
| Subtractive | `max(atk − def, floor)` | Fire Emblem: "(Physical power – enemy's Defence) × Critical coefficient" ([Serenes Forest](https://serenesforest.net/the-blazing-blade/miscellaneous/calculations/)) [datamine] | 0 (or the floor) | 990 |
| Ratio, fixed K | `atk × K/(K + def)` | LoL armour: `damage / (1 + armor/100)` ([LoL wiki](https://wiki.leagueoflegends.com/en-us/Armor)) [datamine] | 12.5 (K=100) | 909 |
| Ratio, attack/defense | `… × Atk/Def …` | Pokémon Gen V+: `((2·Lv/5+2)·Power·A/D)/50 + 2) × Modifier` ([Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Damage)) [datamine] | depends on Power and level | — |
| Hit-size ratio | `DR = armour / (armour + 5·hit)` | Path of Exile: 50% reduction at armour = 5× the hit, 33% at 2.5×, 66% at 10× ([PoE wiki](https://www.poewiki.net/wiki/Armour)) [datamine] | — | — |
| Hit-size, Basie-scaled | `atk² / (atk + def)` | the PoE curve with armour = 5×def | 5 | 990 |

How each family behaves:

- **Subtractive** is the most readable and the easiest for players to reason about. It is also
  the most brittle. Because the result is clamped, there is a hard threshold. In Basie terms, a
  Footman (atk 14) deals 4 damage into def 10, 1 into def 13, and only the floor into def 15.
  One point of defense can swing a matchup from fine to useless. Tuning is not stable: every
  defense change moves each unit across someone's cliff. Many games use the `+2` or "min 1"
  trick (Pokémon adds `+2` before the modifiers) so a hit never does exactly zero.
- **Fixed-K ratio** (LoL; Dota uses the same idea) is smooth and stable to tune. Each point of
  armour adds a constant amount of effective HP: in LoL, every armour point adds about 1% EHP.
  The weakness is that the curve does not care about hit size. A 14-attack hit and a 1000-attack
  hit lose the same percentage. A swarm of weak units therefore stays fully effective, so this
  family breaks the owner's "25 can't hurt 100" rule. That is fine for a MOBA. It does not fit
  here.
- **Hit-size ratio** (PoE armour) reduces small hits a lot and large hits barely. That is the
  property Basie wants. It is continuous, has no cliff, never returns zero, and uses only
  `+ × /`. With `atk² / (atk + def)`, damage is about `atk` when `atk ≫ def`, and about
  `atk²/def` when `def ≫ atk`. In the second case, a hit that is 4× weaker than the defense
  lands at 20% of its attack, and a 10× weaker one at about 9%.
- **Hybrids** combine the two. The most common pattern is subtractive with a percentage floor:
  `max(atk − def, atk × 5%)`. It keeps subtraction's readability, but the floor becomes the only
  thing that matters for chip damage, so the floor percentage turns into a balance-critical
  knob.

## 2. How comparable mobile 4X games resolve battles

| Game | Troop types and counters | Resolution and targeting | Casualties | Heroes/commanders |
|---|---|---|---|---|
| Rise of Kingdoms | Infantry > Cavalry > Archer > Infantry ([RoK wiki](https://riseofkingdoms.fandom.com/wiki/Troops/Archer)) [datamine] | Real-time on the map, 1-second turns. Normal attack once per turn, counterattacks unlimited ([BlueStacks](https://www.bluestacks.com/blog/game-guides/rise-of-kingdoms/rok-combat-guide-en.html)) [community] | Severely wounded go to the hospital; when it is full, troops die ([RoK Guides](https://riseofkingdomsguides.com/hospital/)) [community] | Rage builds to 1000, then fires an active skill with a published "Direct Damage Factor", e.g. Sun Tzu 150–450 ([BlueStacks](https://www.bluestacks.com/blog/game-guides/rise-of-kingdoms/rok-combat-guide-en.html)) [official in-game text] |
| Whiteout Survival / Kingshot (Century Games family) | Infantry > Lancer > Marksman > Infantry, +10% attack when countering ([WoSTools](https://wostools.net/guides/combat-guide)) [community] | Round-based. Marksmen sit behind the front line. No formula is published | Wounded go to the infirmary | Hero skills plus % stat buffs. A community model has "SkillMod" as the largest term ([Kingshot Guides](https://kingshotguides.com/guide/lethality-attack-defense-health-what-they-actually-do/)) [community] |
| State of Survival | Infantry tank the front; Riders and Hunters deal the damage. Stats are Attack, Lethality, Defense, Health ([official blog](https://stateofsurvival.game/en/blog/28)) [official]. Sub-types (Bikers, Snipers) sometimes bypass the infantry line ([progameguides](https://progameguides.com/state-of-survival/best-troop-formations-and-training-tips-for-state-of-survival/)) [community] | Front row / back row | Infirmary | Hero buffs |
| Lords Mobile | Infantry > Ranged > Cavalry > Infantry; siege is for walls. Tier 2 is about 2× tier 1, each later tier about +50% ([BlueStacks](https://www.bluestacks.com/blog/game-guides/lords-mobile/lords-mobile-best-troops-en.html)) [community] | Not published | All injured troops go to the infirmary when defending; 60% of injured go there when attacking outside your turf, the rest die ([Lords Mobile wiki](https://lordsmobile.fandom.com/wiki/Infirmary), search excerpt) [datamine] | Hero stats plus gear |
| Evony | Mounted > Ground > Ranged > Mounted; siege > ranged. Range 50 for melee, 500 for ranged, 1,400–2,178 for siege. Counters only hold "where the tiers, buffs… are equal" ([Evony Guide Wiki](https://evonyguidewiki.com/?p=3714)) [community] | Multi-round. "In each round, each troop type targets one specific enemy group" ([LDShop](https://www.ldshop.gg/blog/evony-the-king-s-return/pvp-guide-troop-layering.html)) [community] | Wounded and hospital | General buffs |
| Last Shelter: Survival | Fighters, Shooters, Vehicles in a counter triangle ([GuruGamer](https://gurugamer.com/mobile-games/last-shelter-survival-gameplay-a-real-time-strategy-zombie-war-game-9767/amp)) [community] | **No reliable public formula or targeting rule found** | Hospital | Hero skills |

What these games share:

- Counter bonuses are small multipliers, about +10% in WoS. They are not hard wins. Tier and
  buff gaps outweigh the triangle, as Evony's own guide admits.
- Front line and back line positions are explicit. In SoS and WoS, infantry acts as the tank.
- Losses are split into dead and wounded. A hospital or infirmary has a capacity limit, and
  the fraction that dies depends on context: defending versus attacking.
- **No exact damage formula is officially published for any of these games.** Every formula
  quoted for them is reverse-engineered by the community.

## 3. Aggregate models: Lanchester

- **Linear law.** Each soldier can fight only one opponent at a time, so losses are equal and
  numbers give no advantage beyond the extra bodies. **Square law.** Everyone can fire at
  anyone: `dA/dt = −βB`, `dB/dt = −αA`, and fighting strength scales as `αN²`. "A superiority in
  firepower equal to the square of the inferiority in numbers is required for victory"
  ([Wikipedia](https://en.wikipedia.org/wiki/Lanchester%27s_laws)).
- **What this means for Basie.** A per-round sim where every unit hits once per round is a
  square-law system. Swarms of cheap units are naturally strong. To make an elite unit worth its
  cost, Basie must shrink the swarm's per-unit firepower α in matchups where it is outclassed.
  The defense curve does exactly that: for Footmen against a def-100 unit, α drops by about 8×.
  Basie should not rely on a raw stat ratio.
- **The other lever games use** is to damp numbers directly. The community model for the
  RoK/Kingshot family is `Kills ∝ √Troops × (Atk × Lethality)/(Def × Health) × SkillMod`, and
  doubling troops gives ×1.41, not ×2 ([Kingshot Guides](https://kingshotguides.com/guide/lethality-attack-defense-health-what-they-actually-do/))
  [community]. `√N` turns the square law back into something close to linear. It works, but it
  is opaque to players.
- **Compute cost.** Per-unit simulation costs O(units × rounds). That is fine for Basie's
  current counts (tens to hundreds of units), but it becomes too slow at 4X scale (100k-unit
  rallies). Per-stack simulation keeps one record `{line, tier, count, frontHp}` per
  type-and-tier. Kills per round are `floor(totalDamage / hp)` with the leftover damage carried
  on the front unit, so the cost is O(stacks × rounds) whatever the troop count. Basie has 4
  lines × 10 tiers, at most 40 stacks per side, so this runs in well under a millisecond in a
  browser.

## 4. Casualty distribution

| Rule | Effect | Risk |
|---|---|---|
| Pooled single loss rate (current Basie) | Every stack loses the same %, so tiers don't matter | Breaks the owner's realism rule |
| Front line first (SoS/WoS infantry tank) | Infantry absorbs damage before ranged and siege; positions matter | Needs a bypass rule (SoS Bikers and Snipers) or the back line is never touched |
| One group per round (Evony) | Each group is focused down in turn | **Layering exploit**: tiny stacks of every tier each "buy a round" ([LDShop](https://www.ldshop.gg/blog/evony-the-king-s-return/pvp-guide-troop-layering.html)) [community] |
| Proportional to HP share | Damage spreads by how much of the line each stack represents | Fair and exploit-resistant, but low tiers don't specifically die first |
| Tier-weighted share | Share = `hpShare × tierWeight`, with a larger weight for lower tiers | Low tiers die first, high tiers stay valuable, layering doesn't pay. Needs one tuning knob |

On spill: within a stack, leftover damage should carry into the next unit, because a pooled
`frontHp` makes this automatic. Between stacks, leftover damage should **not** carry. Without
that rule, one overkill hit on a 1-unit layer would leak into the main stack.

For dead versus wounded, use the Lords Mobile split: a context-dependent wounded fraction
(defending 100%, attacking 60%) plus an RoK-style hospital that kills the overflow. This
already fits Basie's PvE/PvP split and needs no change to the formula.

## 5. Determinism, randomness, PvP

- Clash of Clans replays are not videos. They are "the attack being simulated again with the
  same order of events". Old replays stop being viewable after balance changes because "the
  simulation result would change" ([Clash Ninja](https://www.clash.ninja/guides/why-cant-i-view-previous-replays))
  [community]. **Takeaway:** store `rulesVersion` with every battle report.
- Floating point is deterministic only with "a single compiler, and a single CPU instruction
  set" ([Gaffer On Games](https://gafferongames.com/post/floating_point_determinism/)). In JS,
  basic `+ − × /` are IEEE-754 double. But "many `Math` functions have a precision that's
  implementation-dependent… different browsers can give a different result"
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math)).
  **Takeaway:** the resolver uses `+ − × /`, `floor`, and `sqrt` only. No `pow`, `exp`, or
  trig. `atk²/(atk+def)` qualifies.
- **Seeded RNG.** If a battle has variance (crits, skill procs), draw it from a small integer
  PRNG seeded per battle, never from `Math.random`. Then `(rulesVersion, seed, attacker snapshot,
  defender snapshot)` reproduces the battle exactly. That gives free battle reports and
  replays, server re-validation, and pre-battle estimates (run N seeds and show the win %).
  With no variance at all, the estimate is exact. Most 4X games show a power comparison rather
  than a guaranteed result.
- **Async PvP** means attacking a stored defense: the defender's squad, buffs, and hero are
  snapshotted at attack time. Basie needs that anyway for offline raids. Once Firebase lands,
  the same module runs in a Cloud Function as the authority, and the client runs it only to
  preview.

## 6. Hero integration

- RoK publishes skill power as a **Direct Damage Factor** against a 1000-rage gate
  ([BlueStacks](https://www.bluestacks.com/blog/game-guides/rise-of-kingdoms/rok-combat-guide-en.html))
  [official in-game text]. Skills are data: a number the combat engine interprets.
- For Basie, a hero strike should be a hit with `power = heroStrikeStat × skillFactor`, put
  through the **same** damage formula against the target stack's defense. Kills are
  `floor(damage / hp)`. A strong strike wipes out low tiers and only chips elites, which is the
  same realism rule applied to heroes.
- The existing `statRules.js`/`statAggregator.js` already produce capped multipliers
  (`attackPct`, `defensePct`, `lossReduction`). The resolver consumes the aggregated numbers and
  never hero objects. The current trigger buckets (`battle_start`, `wave_start`, `final_wave`,
  `losing`) map onto round events. Skill descriptors would look like
  `{ trigger, effect: 'strike'|'buff'|'heal', power, target: 'front'|'highestTier'|'lowestTier', duration }`.
  This keeps hero data free of combat logic, and the same hero works in PvE and PvP.

---

## Worked comparison with Basie numbers

Simulation setup:

- Per-stack, simultaneous rounds.
- Every unit hits once per round, and each hit targets one enemy unit.
- Overkill within a hit is wasted. Wounds carry on the front unit.
- No counters, heroes, or RNG.
- Units: Footman (hp 120, atk 14, def 10) and Paladin (hp 540, atk 56, def 38).
- Assumptions, because monsters have no defense today: boss = hp 1200, atk 45, **def 20**;
  t6 monster = hp 750, atk 76, **def 100**.
- Formulas:
  - **S** = `max(atk − def, 5% atk)`
  - **K** = `atk × 100/(100 + def)`
  - **H** = `atk² / (atk + def)`
- Reproduce with the script described here: a 40-line Node sim in the session scratchpad. It
  is not committed.

Per-hit damage:

| Hit | S | K | H |
|---|---|---|---|
| Footman → boss (def 20) | 0.7 | 11.7 | 5.8 |
| Footman → t6 (def 100) | 0.7 | 7.0 | 1.7 |
| Footman → Paladin (def 38) | 0.7 | 10.1 | 3.8 |
| Paladin → Footman | 46 | 50.9 | 47.5 |
| 25 atk → 100 def | 1.25 | 12.5 | 5.0 |
| 1000 atk → 10 def | 990 | 909 | 990 |

Outcomes (survivors are shown as attacker / defender):

| Fight | S | K | H |
|---|---|---|---|
| 10 Footmen vs boss | Boss wins with ~87% HP left (rd 40) | Footmen win, 6 left (rd 13) | Footmen win, 2 left (rd 33) |
| 10 Footmen vs t6 def-100 | Monster wins (rd 20) | Footmen win, 1 left | Monster wins (rd 20) |
| 50 Footmen vs t6 def-100 | Footmen win, 38 left (rd 25) | Footmen win, 49 left (rd 3) | Footmen win, 45 left (rd 10) |
| 1 Paladin vs 20 Footmen (cost 400 vs 1000 money) | **Paladin wins** | Footmen win, 19 left | Footmen win, 18 left |
| 1 Paladin vs 8 Footmen (equal money) | Paladin wins | Footmen win, 6 left | Paladin wins narrowly (about 130 HP left) |

How to read it:

- **S** makes elites immune. One Paladin kills 20 Footmen and takes floor damage only.
  Low-tier units become worthless once they fall behind on defense, and the 5% floor is the only
  thing deciding chip damage.
- **K** is the square law in its pure form. Footmen beat both the Paladin and the def-100
  monster, and tier barely matters. This violates the owner's rule.
- **H** is the middle ground. At equal cost the elite wins narrowly, 2.5× the cost in Footmen
  overwhelms it, and 10 Footmen cannot beat a def-100 monster while 50 can. This is "chips at it
  but cannot trivialise it". The cost is a little less legibility than `atk − def`.

---

## Options for Basie

**A. Subtractive with floor, per-stack rounds.** Damage is `max(atk − def, f·atk)`.
- Strengths: very readable ("my 56 attack minus your 38 defense"), and trivially deterministic.
- Weaknesses: cliffs make tuning fragile across 40 tier rows. Elites become invulnerable. The
  floor % ends up as the real balance knob.
- PvP-ready, and cheap to run.

**B. Fixed-K ratio, with `√N` damping and per-stack rounds** (closest to the RoK/Kingshot
community models).
- Strengths: smooth to tune, familiar to 4X players.
- Weaknesses: the formula cannot express hit size, so tier dominance has to be hand-tuned
  through `√N` and stat gaps. `√N` is opaque to players, and per-hit realism is lost.
- PvP-ready, and cheap to run.

**C. Hit-size ratio `atk²/(atk+def)`, per-stack rounds, tier-weighted front-line casualties.**
- Strengths: matches all three of the owner's rules without special cases. It is smooth to
  tune, uses only `+ × /` so it is deterministic in JS, and hero strikes reuse the same hit
  path.
- Weaknesses: harder to explain than subtraction. That can be addressed by showing an
  "effective %" in the UI: `atk/(atk+def)`. It also needs two knobs: the counter multiplier
  (about +10–20%) and the tier weight for casualties.
- PvP-ready: one pure module of the form `resolveBattle(sideA, sideB, {seed, rulesVersion})`,
  returning `{rounds[], losses, wounded, report}`. Cost: O(stacks × rounds), about 40×40×N
  operations, which is negligible.

**Recommendation: Option C.** Build it as a pure, stateless module in `js/systems/combat/`.
Have campaign, march, and boss fights all call it. Give monsters a `defense` stat and a
`line`, and treat each wave as a stack. Make the resolver deterministic with a seed from the
first commit, and store `{rulesVersion, seed, inputs}` in battle reports so PvP replay and
server authority can come later without a rewrite. Record the choice in an ADR before
implementation.
