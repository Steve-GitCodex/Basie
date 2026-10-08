# Power and player-level research (mobile 4X / base builders)

Research input for adding a player "power" stat and a better player-level system to Basie.
Written 2026-10-07. This is not a design lock. A decision taken from it should go into an ADR.

## Read this first: how much is actually confirmed

Web access was limited. Fandom wikis (Lords Mobile) and appgamer.com returned 402/403 to direct
fetches, so those claims rest on search-result excerpts. **No developer-published power formula
was found for any game studied.** Games do not publish them. Where numbers appear they come from
community wikis or calculators, and several of those pages were SEO guide sites of mixed quality.
Treat every number below as a hypothesis, not a spec.

Confidence labels:
**[official]** developer or in-game text. **[datamine/wiki]** community wiki or datamine.
**[community]** guide site, forum or search excerpt; may be wrong. **[not found]** searched,
nothing usable.

## Summary: what matters most for Basie

1. **Power is universally a sum of per-category sub-scores, shown as one big number.** Last
   Shelter: troops + buildings + technology ("total combat power is the sum of your troops power,
   building power and technology power") [community]. Rise of Kingdoms profile shows troop,
   building and technology power, plus commanders [community]. State of Survival lists troops,
   tech, hero levels and gear, chief level and gear, buildings [community]. Lords Mobile might also
   includes heroes, artifacts, player level and quests [community]. Basie already has every one of
   these inputs except player level feeding anything.
2. **Troop power is a per-unit constant by tier, roughly doubling per tier early then flattening.**
   RoK: T1 1, T2 2, T3 4, T4 6, T5 10 per troop [community, one guide site; unverified against
   the wiki]. Lords Mobile: T1 2, T2 8, T3 24, T4 36, T5 48 [community, search excerpt of the Might
   wiki]. Per-troop power is a flat table, not derived from stats. That makes it cheap to
   implement and also the source of "power does not equal strength".
3. **Building and research power is the padding problem.** Last Shelter community answers say
   "most of the research and buildings power doesn't actually make you stronger in fights"
   [community]. RoK: players chase power because the game rewards it, then kingdoms judge by kill
   points, a different metric [community]. Lords Mobile: "a player can still have a high Might
   even without a single troop" [community]. Games mitigate by showing the breakdown so a viewer
   can see where power came from.
4. **Troop loss lowers power in at least Lords Mobile** (injured or killed troops, damaged traps,
   demolished buildings reduce Might) [community]. Last Shelter: wounded troops sit in hospital;
   dead ones are removed permanently [community]; how power treats wounded vs dead was
   **[not found]**. Basie's combat already has dead vs wounded, so this decision is Basie's own.
5. **Power is used for ranking, event scoring and matchmaking, rarely for hard gates.** Lords
   Mobile kingdom rank is by might [community]. RoK "Mightiest Governor" events score power gains
   [community]. Clash of Clans matchmaking uses trophies, Town Hall level and army strength
   [community], and Clan War matchmaking sums a hidden per-item "war weight" that Supercell has
   never published [community, partly confirmed by Supercell as strength-based]. **Progression
   gates are almost always the HQ / Furnace / Town Hall level, not power.**
6. **Player level is the weak axis in this genre; HQ level is the real gate.** Whiteout Survival's
   Furnace level "gates everything else: troop tiers, building access, research categories"
   [community]. State of Survival HQ level gates facilities (HQ 12 for all, HQ 15 Furnace) and the
   chief level mostly grants talent points [community]. Last Shelter's commander-level details
   were **[not found]**.
7. **Curve guidance converges on: pick a shape deliberately, then hand-correct.** Game Developer:
   linear-increment ("quadratic") curve is the usual best balance; exponential is hard to
   calibrate; "don't hesitate to correct a computed curve by hand" [reputable article]. Basie's
   current `500 × 1.4^(L−1)` is the hard-to-calibrate kind. See section 6.

---

## 1. Power by game

### 1.1 Last Shelter: Survival
- Formula shape: troops + buildings + technology [community, appgamer answers 3851/14171/13250,
  fetched as search excerpts only]. Heroes are described as outside the headline number in some
  answers; unconfirmed.
- Per-troop and per-building values: **[not found]**.
- Display: "combat power" on the profile; exact breakdown screen **[not found]**.
- Use: leaderboards and alliance contribution are mentioned in guides; hard gates **[not found]**.
- Failure mode: "Most of the research and buildings power doesn't actually make you stronger in
  fights" [community].

### 1.2 State of Survival
- Battle power = troops, technology, hero levels and gear, chief level and gear, buildings
  [community, progameguides].
- Chief level feeds power directly (so does leveling yourself) [community].
- Per-item weights **[not found]**.

### 1.3 Whiteout Survival
- Furnace level raises a "max power" figure per level in at least one guide's table (Furnace 5
  15,500; 6 23,600; 7 35,300) [community; the figure is a quoted cumulative number, unverified].
- Fire Crystal troop upgrades "pack a big punch to total city power" [community].
- Furnace 25 unlocks T9 troops, 30 unlocks T10 [community].

### 1.4 Rise of Kingdoms
- Profile shows troop, building and technology power [community, riseofkingdomsguides governor
  profile page]; commanders add power [community].
- Per-troop: T1 1, T2 2, T3 4, T4 6, T5 10 [community]. Building power per upgrade grows with
  building level [community].
- Failure mode: power rewarded by events and the UI, kill points demanded socially in KvK
  [community].

### 1.5 Lords Mobile
- Might = research, buildings, troops, heroes, familiars, artifacts, player level, turf quests
  [community, Might wiki excerpt]. Traps give might (T1 2 to T4 5 per trap) [community].
- Troop might per unit as listed in summary item 2 [community].
- Loses might on dead or injured troops, destroyed traps, demolished buildings [community].
- Other players can inspect the might distribution, so empty might is visible [community,
  BlueStacks]. Used for kingdom ranking [community].

### 1.6 Evony
- Troops, buildings, research, generals all add power [community]. One guide quotes per-unit
  ranges by tier band and "+10 for recruiting a general, +10 to +100 per general level"; this is a
  loose ranged guide, not a table, so treat as **[community, low trust]**.

### 1.7 Clash of Clans (analogue)
- No single power number. Town Hall level is the progression gate; trophies are the PvP ladder,
  matchmaking uses trophies, TH level and army strength [community].
- "War weight" is a hidden per-item value (defenses heaviest) used to sum a base's strength for
  Clan War matchmaking; formula never published [community].
- Lesson: when a game needs fair matchmaking it builds a separate hidden strength score rather
  than reusing the displayed one.

---

## 2. What power is used for

| Use | Seen in | Source |
|---|---|---|
| Server/kingdom leaderboard | Lords Mobile, RoK | [community] |
| Event scoring (power gained) | RoK Mightiest Governor | [community] |
| Matchmaking by hidden strength | CoC war weight | [community] |
| Hard progression gate | none found; HQ/Furnace/TH level does this | [community] |
| Enemy scaling | **[not found]** for the 4X titles; AI-target scaling is Basie's own need |  |
| Visible bragging / inspection | all | [community] |

For Basie: single-player with future AI factions scaling by "player level/activity" (project
memory). Power is the natural replacement for "activity" as the AI scaling input, but only if it
resists padding (section 4).

## 3. Level systems

- **Commander/chief level vs HQ level.** In SoS, HQ level gates buildings and features; chief
  level grants talent points (2 per level, later 3) [community]. EXP comes from EXP medals earned
  from growth missions and rally intel missions, or bought [community].
- **Last Shelter**: base level gates buildings (appgamer requirement pages) [community]; commander
  level mechanics **[not found]**.
- **Whiteout Survival**: no separate player level surfaced; Furnace level is the player's level in
  practice [community].
- **Lords Mobile**: player level contributes to might and is gained through quests/activities
  [community]; curve **[not found]**.
- **RoK**: governor power matters more than any level **[not found]** for a level curve.
- **Clash of Clans XP** (documented formula): XP to advance = `level × 50` up to level 200, then
  `(level − 199) × 500 + 9,950`; theoretical cap about 300 [community, CoC wiki excerpt]. It is a
  linear-increment curve with a late step, and it gates nothing: level is prestige only.
- Pattern: XP sources are mission/quest completions and building upgrades; rewards are small
  talent/skill points and stamina, never the main gate.

## 4. Failure modes

1. **Power padding.** Cheap, safe categories (research, buildings, traps) inflate the number
   without combat value [community across LSS, Lords Mobile, RoK].
2. **Power not reflecting strength.** Flat per-troop tables ignore hero skills, counters,
   composition (the Last Shelter "combat synergy" point) [community].
3. **Social metrics replace power.** RoK moves to kill points [community]; Basie's analogue is
   kills or captured POIs.
4. **Volatility.** Lords Mobile might falls when troops die, which makes power a noisy "AI
   difficulty" input and encourages hospital/shield hoarding [community].
5. **Inflation.** Each new tier outweighs the whole prior game; flat tables jump an order of
   magnitude (RoK T5 = 10x T1).

## 5. Design guidance

- **Game Developer, "Quantitative design: how to define XP thresholds"**: linear
  (`T(n) = T(n−1) + c`), exponential (`T(n) = T(n−1) × k`), and linear-increment (increment grows
  by a constant). Linear-increment recommended for most games; exponential is hard to calibrate;
  correct the computed curve by hand; consider time between thresholds as much as XP values
  [reputable].
- **Aversa, "Game design math: RPG level-based progression"**: geometric model
  `E(L) = a(1 − b^L)/(1 − b)`; curve shape drives grind perception; model progression over time
  not just levels; Diablo 3 uses piecewise quadratics tuned per range [reputable blog].
- **Machinations / economy-design material**: exponential feels rewarding early, linear feels
  grindy late (search excerpts of vendor and Udemy pages) [secondary]. No primary Machinations
  article on power as a metric was found. **GDC talk on power as a progression metric: [not
  found]**. KingsIsle GDC Online 2011 "RPG math" exists (Engadget write-up surfaced) but was not
  read.

## 6. Basie's existing data (verified in code, 2026-10-07)

- `UserManager` curve: `xpToNext = floor(500 × 1.4^(level−1))`. Level 10 needs about 10k, level 20
  about 760k. That is exponential with no cap and no sources feeding it that scale with it; it will
  stall. (Code read; not run.)
- Unit tiers carry `hp/attack/defense` per tier in `js/entities/data/units.js`, so troop power can
  be derived from stats instead of a flat table.
- Heroes, tech, buildings, inventory and the stat aggregator (ADR 0031) exist, per the project
  docs; per-building and per-tech level data would be read directly.

## 7. Candidate options

### Power formula

| Option | Idea | Pros | Cons | Needs |
|---|---|---|---|---|
| A. Genre-standard sum | `troops×tierTable + Σ buildingLevel×w + Σ techLevel×w + heroPower` | Matches player expectation; easy | Padding; not strength | Tier table [new], per-category weights [placeholder] |
| B. Stat-derived troop power | Per-unit power from `hp×attack` (or the resolver's effective stat) | Tracks real strength; self-updates when combat balance changes | Needs a scaling constant; numbers can look odd | Unit stats **[have]** |
| C. Capped/weighted non-combat | A with building and tech contributions soft-capped relative to troops | Resists padding | Opaque to players | Option A inputs |
| D. Split metrics | Displayed "Power" (A) plus hidden "Threat" (B-based) for AI scaling | Fixes the CoC war-weight problem; padding cannot gate AI | Two numbers to maintain | Both |

Open sub-decisions: do wounded troops count (suggest yes, at reduced weight, to avoid volatility);
do dead troops reduce power (yes, they are gone); show breakdown by category on the profile
(recommended; every game does).

### Level system

| Option | Idea | Pros | Cons | Needs |
|---|---|---|---|---|
| 1. Keep exponential, retune | Lower k (about 1.1 to 1.15), add cap | Minimal code | Still hard to calibrate | Level cap decision |
| 2. Linear-increment | `xpToNext = base + step×(L−1)` (CoC style) | Predictable, hand-tunable | Late levels can feel flat | XP sources inventory |
| 3. Piecewise | Different slopes per band, aligned to HQ tiers | Matches the real gate | More tuning | HQ level thresholds **[have in building data]** |
| 4. Level derived from power | Level is a bucket of power | No separate XP | Level inherits power padding | Power formula |

Rewards to consider: small per-level stat or talent point (SoS), stamina or march cap, unlock
flags, and a level-up mail (already present). Recommend the HQ level remain the main gate and
player level stay a secondary reward axis, as in the genre.

---

## Sources

Search-result excerpts only unless noted "fetched".
- Last Shelter power answers: https://www.appgamer.com/last-shelter-survival/answers/3851-what-is-combat-power-how-is-it-meas , https://www.appgamer.com/last-shelter-survival/answers/14171-how-to-increase-my-combat-power , https://www.appgamer.com/last-shelter-survival/answers/13250-how-do-i-increase-my-total-combat-p
- Last Shelter wounded/dead: https://www.appgamer.com/last-shelter-survival/answers/8677-do-wounded-troop-die-if-not-healed
- State of Survival power: https://progameguides.com/guides/how-to-increase-battle-power-quickly-in-state-of-survival/
- State of Survival chief/HQ: https://www.appgamer.com/state-of-survival/strategy-guide/chief-guide-talents-and-gear , https://progameguides.com/guides/state-of-survival-headquarters-requirements/
- Whiteout Survival: https://commonsensegamer.com/whiteout-survival-furnace-upgrade-requirements/ , https://wostools.net/wiki/buildings/furnace
- RoK profile: https://riseofkingdomsguides.com/governor-profile-in-rok/
- RoK per-troop power: https://www.ldshop.gg/blog/rise-of-kingdoms/troops-tier-list.html (search excerpt)
- RoK power vs kill points: https://riseofkingdomsguides.com/how-to-get-more-kill-points-in-rise-of-kingdoms/ , https://www.appgamer.com/rise-of-kingdoms/strategy-guide/how-to-max-your-points-in-the-mightiest-governor
- Lords Mobile might: https://lordsmobile.fandom.com/wiki/Might (excerpt; fetch 402), https://www.bluestacks.com/blog/game-guides/lords-mobile/lords-mobile-gain-might-en.html (fetched)
- Evony: https://www.gamenguide.com/articles/106447/20241015/mastering-power-calculations-evony-king-s-return.htm
- Clash of Clans: https://trophycoach.com/clash-of-clans/guides/war-weight-matchmaking-explained (fetched), https://clashofclans.fandom.com/wiki/Clan_Wars , https://clashofclans.fandom.com/zh/wiki/%E7%BB%8F%E9%AA%8C%E5%80%BC
- XP curves: https://www.gamedeveloper.com/design/quantitative-design---how-to-define-xp-thresholds- (fetched), https://davideaversa.it/blog/gamedesign-math-rpg-level-based-progression/ (fetched), https://www.engadget.com/2011-10-12-gdc-austin-2011-kingsisles-sara-jensen-schubert-talks-rpg-math.html (not read)
