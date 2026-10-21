# World map: one tiered main POI per province (research)

This research looks at Steve's proposal for the world-map rework. Each province has **one main POI**, and its tier grows
toward the centre: a community market on the rim, then a town and a city, and the **metropolis** at the centre. The
tiered main POI takes the place of Option B's separate "province capital".

- **Inputs:** `world-map-genre.md` §7 (Option B), `world-map-codebase.md`, `10-design/ai-factions.md` and
  `10-design/world-events.md`.
- **Date:** written 2026-10-12. This is not a design lock. A decision taken from it goes into an ADR.

**Confidence labels** are the same as in `world-map-genre.md`:

- **[official]**: developer text, a manual, the store or a patch note.
- **[wiki]**: a community wiki.
- **[community]**: a guide site or forum, which may be stale.
- **[memory]**: known to the researcher, not re-verified.
- **[inference]**: reasoning, not a sourced fact.
- **[not found]**: searched, nothing usable.

**Caveat.** As in the earlier research, the mobile 4X games publish almost no official map documentation, and the
Fandom wikis returned HTTP 402. The strongest sources this time are:

- the Koei Tecmo RTK XIV manual;
- the Total War siege blog;
- Amplitude's Humankind feature focus;
- the official app-store and press text for AoE Mobile.

Most numbers for the mobile games come from guide sites.

## 0. Summary

1. **The genre already does this, and the closest match is Last War: Survival.** Last War is a different game from
   Last Shelter, though the two are often confused. Its map is cut into zones, and **each zone holds one village or
   city of level 1–6**. The **single level-7 zone at the centre holds the Capitol**, guarded by 4 cannons. Levels open
   one at a time, from L1 to L6, and then the Capitol event repeats. You can only attack a zone adjacent to your
   territory, and each zone grants one buff [community]. That is Steve's structure almost exactly.
2. **"The main POI owns the region" is a proven single-player rule as well.** In Endless Legend, founding a city claims
   the whole region, and there is **only one city per region** [official dev forum; community]. Amplitude made the rule
   on purpose, to stop cities being packed together. The regions still hold 1–3 minor-faction villages that you deal
   with separately [wiki].
   - In RTK XIV, each city region is a city plus areas, and every area has a capturable "core" [official manual].
   - Total War splits a province into a walled major capital plus unwalled minor settlements, and minors are capped at
     tier III [official blog; wiki].
3. **Steve is right that a tiered main POI removes the need for a separate capital.** In Option B the "capital" was
   already the one settlement that carried the province's name and its onward unlock. Making it *the* main POI, with a
   tier, just merges the two.
   - **Basie already works this way:** each region has one `strongholdId`, and capturing it calls `captureRegion`
     (`marchResolver.js:62`). Today's model is design (a), with tiers 1–6 [code].
4. **Recommendation: design (b), a main POI plus 1–3 minor "holdings".** These are depots, watchtowers or wells.
   - The **main POI alone decides the province owner**, its buff, its name and onward unlocks, and the cascade.
   - **Holdings** are small ownable sites. They carry local yield and act as **siege satellites**: each one you hold
     next to an enemy main POI lowers its walls. This follows the Whiteout turrets and the State of Survival towers.
   - Holdings give the AI and rebels something to nibble without flipping a province.
5. **Tier ladder: 5 tiers over 12 provinces**, with the counts per ring set in data. The ladder runs: Swap Market →
   Township → Stockade Town → Ruin City → Metropolis. Walls, garrison, buff, yield and **footprint** (1×1 up to about
   6×6 cells) all scale per tier.
6. **The centre is the end goal and then the hill.** The first capture of the Metropolis is a milestone victory, giving
   a title and a map-wide buff. After that the factions contest it through the normal one-countdown fairness rules.
   There is no seasonal reset.

---

## 1. Prior art: tiered city POIs that grow toward the centre

### 1.1 Comparison

| Game | Tiers / ring layout | What holding gives | Difficulty to take | Ownership grain | Separately owned extras |
|---|---|---|---|---|---|
| **Last War: Survival** (S1 "City Clash") | Zones each with **one village/city, L1–6**; **one L7 zone = Capitol** at centre; levels open in order, from L1 up to L6 [community] | Continuous alliance buffs (food/iron/gold, build speed), a first-capture reward [community]; "each zone gives one buff"; influence 100k (L1) → 1M (L6) [community] | Durability bar driven to 0 by repeated attacks, then garrison within 1 h; defenders can reinforce; 6-day protection after capture [community] | **The city is the zone.** Attack only zones adjacent to your territory; alliance cap of 6 cities [community] | **Military Strongholds** (a Corruptor guardian; held separately, capped at 3–7) [community] |
| **Last Shelter: Survival** | State-map plots L1–5 → 5–9 → 9–12 → 12–16, edge to centre [community, from genre doc] | [not found] for tiered cities | Adjacent-plot rule [community] | Plots via Alliance Centers [community] | Presidency through a Launch Center battle [community]. No tiered city POIs confirmed [not found] |
| **State of Survival** | One **Capital** plus **Towers** [community] | Winning alliance names a **Governor** [community] | Hold for 6 consecutive hours, or longest total, within a 12 h event; Towers bombard the Capital faster the longer they're held [community] | Capital only; alliance HQ territory elsewhere [community] | Towers (satellites). No tiered strongholds found [not found] |
| **Whiteout Survival** | Rings: Icefield L1–5 → Tundra L6–7 → centre L8 [community]. **74 facilities, Lv1–4** (e.g. Construction Lv1 +5% ×8, Lv3 +8% ×4; Expedition Lv3 +15% march ×4); each **3×3 cells** [community] | Passive alliance buffs; same type at the same level doesn't stack [community]. **Sunfire Castle**: President +5% attack/defence/lethality/health, state-wide skills, ministers [community] | Hold an unguarded facility 25 min; 3-day shield. Castle: hold 2.5 h; **4 turrets** fire on the holder; Lv4 Weapon facilities cause ~10% deaths [community] | Each facility is one point; it must touch your banner territory (7×7 banner, 15×15 HQ) [community] | Fortresses (12) and Strongholds (4) in Winter Siege [community, low confidence] |
| **Rise of Kingdoms** | Zone 1 ×6, zone 2 ×3, zone 3 ×1 [community]; **Passes L1–3** gate the zones (a tier-N pass lets you into a tier-N area) [wiki]; **Sanctums** (zone 1, 70 total), **Altars**, **Shrines** (zone 2), **Lost Temple** (zone 3) [community] | Sanctum/altar buffs, e.g. Earth Altar +5% build, Harvest Altar +10% gather; same types don't stack [community]. Lost Temple holder becomes **King**: titles and kingdom-wide buffs once a day [wiki via search] | Barbarian guardians; holy sites open every 3 days and need a 4 h hold; Lost Temple opens every 7 days and needs an 8 h hold; severe wounds die there [wiki via search] | Each site is one point; you can attack only sites your territory touches [wiki] | Flags, forts, passes (passes also allow teleport) [wiki] |
| **Call of Dragons** (S1) | Regions A (7 areas, L1) → B (3, L2) → C (1, "ultimate") [community]. Tiered **passes**, not cities | Villages give buffs while inside alliance territory [community]; captured behemoths fight for you [community] | Pass: border it and beat its defenders; behemoths need the whole alliance [community] | Alliance territory (towers, fortress); passes gate the regions [community] | Villages, behemoth lairs, lighthouses (1 per area, clears fog) [community] |
| **Age of Empires Mobile** | Royal city / **Imperial City Clash** [official press] | [not found] | Official store text: aim at archer towers, breach gates, seize central structures; trebuchets, rams, escalades [official] | [not found] | [not found] |
| **Total War: Warhammer** | Province = **major** settlement (capital) + minors. **Minors cap at tier III**, majors reach V [wiki/community]. Slot counts: minor 4, small capital 6, capital 8, special capital 10 (WH2 dev post) [community via PC Invasion] | Settlement buildings; holding the whole province unlocks a commandment [wiki, genre doc] | Majors fight **sieges with walls**; minor settlement battles have no walls but use bespoke maps with towers and barricades [official blog] | **Every settlement owned separately**; the province can be split [community] | Minors are the "other points" |
| **Total War: Three Kingdoms** | Commandery = capital county + resource counties [wiki] | Capital holds most buildings [wiki] | | A commandery can have several owners, one per county [wiki] | Resource counties |
| **RTK XIV** (Koei, single-player) | City regions made of areas [official manual]; cities "expand", which changes their appearance and raises durability, gold and supplies [official] | Development benefits [official] | A base (city/gate) falls when durability **or** troops reach 0; the governor's ability matters [official] | **Each area has a core**; take the core and you take the area. Cities, gates and ports are also cores [official] | Gates (Hulao, Yangping) are fortified points; tribes passing through "un-own" areas [official] |
| **Endless Legend** | Regions, no ring tiers | City founding claims the **whole region** [community] | | **One city per region**, a deliberate design choice [official dev forum; Gamespot] | 1–3 minor-faction **villages** per region: pacify, bribe or destroy them, then assimilate the faction [wiki] |
| **Humankind** | Territories | | | One Outpost/City per territory [wiki]; outposts are "fragile" and can be **absorbed** into a city [official blog] | |
| **Civ VI** | City-states, no rings | Envoy tiers 1/3/6 grant escalating bonuses; the **suzerain** gets a unique bonus, vision and resources [wiki] | | City-state = one city | |

### 1.2 Patterns

- **Tier equals the ring, and the count shrinks toward the centre.** The ratios are RoK 6/3/1, CoD 7/3/1, Last War
  "many L1–6, one L7", and Whiteout Lv1 ×8 versus Lv3–4 ×3–4 [community]. Every case has **exactly one apex**.
  [inference from the table]
- **The tiers unlock in order.** Last War opens one city level at a time [community], and RoK and CoD open pass levels
  in order [wiki; community]. In single player the equivalent is a gate: tier N+1 needs a held tier-N neighbour.
- **Holding gives a buff that scales with tier**, and **buffs of the same type don't stack** (Whiteout, RoK)
  [community]. That rule stops the player from snowballing on one stat.
- **Difficulty is durability plus garrison**, with walls only on the big tiers. Examples:
  - Last War durability bars [community];
  - RTK XIV "durability *or* troops reaches 0" [official];
  - Total War, where walls belong to majors only and minors have none [official blog; community].
- **The apex has satellites that matter to the fight:** Last War's 4 cannons, Whiteout's 4 turrets and State of
  Survival's towers [community].
- **Two ownership styles coexist.** Either the main POI *is* the territory (Last War zones, Endless Legend, Humankind),
  or every point is owned separately (RoK sites, Total War minors, RTK cores). The games that use the first style still
  add a **second, minor class** of ownable sites: Last War's strongholds, Endless Legend's villages and Humankind's
  absorbable outposts.

---

## 2. Main POI as province owner: three designs compared

- **(a) The main POI only.** Its owner is the province owner. All other POIs are content (nodes, camps, ruins).
- **(b) The main POI plus 1–3 holdings.** The main POI alone sets the province owner. Holdings are small ownable sites
  with local yield. They act as siege satellites and are the nibble target. They never flip the province.
- **(c) Option B's capital plus settlements** (`world-map-genre.md` §7). Holding all settlements gives the province buff,
  the capital gives the name and onward unlock, and the owner is derived from the settlements.

| Criterion | (a) Main only | (b) Main + holdings | (c) Capital + settlements |
|---|---|---|---|
| **Pacing** (fights per province) | 1 → about 11 to clear the map. That is fast, close to today's 8 strongholds | 1 required + 1–3 optional, so about 11 required and 30 total | 3–5, so about 35–50, and the slowest |
| **Readability** | Best: one big sprite, one colour, one rule | Good: one big owner sprite plus small flags. "Big decides, small helps" | Weakest: "who owns it?" needs a rule, and "capital" and "settlement" read alike |
| **AI targeting** | Coarse. Every assault aims at a main POI, so every successful strike flips a province | War camps aim at the **main POI**. Raids and rebels aim at **holdings**, and a strike can be scaled down to "take a depot" | Fine, but the AI must reason about about 40 targets (the Option C critique applies in part) |
| **Granularity of loss** | Brutal. One lost fight means a lost province **and** the re-fog cascade (ADR 0055) | Graded. Losing a holding costs local yield and lowers the wall bonus. Only losing the main POI triggers the cascade | Graded, but there are two kinds of partial loss to explain |
| **Walls and defence** | Walls on the main POI only: simple, and they match the per-region baseline in ADR 0055 | Walls on the main POI. Holdings have light or no walls (Total War minors), so small raids bounce off the main POI but can take holdings | Walls on every settlement: more to tune and draw |
| **Event anchoring** | Events anchor to the main POI or to slots. Defend and siege templates fit; there is little for "escort to the depot" | Holdings are natural anchors: defend the depot, a contaminated well, a supply drop beside a holding, a rebel taking a watchtower | Rich, but the settlements compete with slots for space |
| **Built to extend** | Trivial | `holdings[]` per province, with the count taken from data | Same as (b) |

**Recommendation: (b).** [inference]

- It keeps Steve's rule: **one main POI decides the province**, and there is no separate capital.
- It also keeps the finer grain that the faction and event design needs. That design calls for raids that can "take
  something" without a cascade, rebels that grow and take ground before a province, and Welcome Back messages like
  "Talon burned the Grain Depot (Red Lowlands)".
- **(a) is the right first slice.** It is today's model with tiers and footprint added. Holdings can follow as a data
  append, because a province with `holdings: []` is design (a).
- **Siege-satellite rule** [inference, following Whiteout turrets, SoS towers and Last War cannons; community]:
  - each holding next to a main POI that you own **adds +X% wall** to that main POI when you defend it;
  - each one that an attacker holds **removes X%** from it.
- **Holdings are optional to take, but they pay off:**
  - they make the main POI cheaper to take;
  - they give the AI something to take first, which is the visible "they're closing in" telegraph.

---

## 3. Tier ladder

### 3.1 Names and distribution (12 provinces)

The ring is a layout guide. The **tier is a data field per province**, and the rule a test enforces is **"tier never
decreases along a connection toward the centre"**. The ratios follow the 6/3/1 and 7/3/1 shape from §1.2.

| Tier | Main POI (grit name) | Ring | Count of 12 | Reads as |
|---|---|---|---|---|
| — | **Home Refuge** (player) | Rim | 1 | Not on the ladder. Raidable but never captured (ADR 0055) |
| 1 | **Swap Market**: a tarp bazaar around a dry fountain, Steve's "community market" | Outer | 4 | Stalls, a single watch-post |
| 2 | **Township**: a fenced cluster of repaired houses and a water tower | Outer/mid | 3 | A palisade begins |
| 3 | **Stockade Town**: container walls around an old mall or depot | Mid | 2 | Full ring wall, gate |
| 4 | **Ruin City**: a half-standing downtown, a fortified stadium | Inner | 1 | Concrete walls, 2 gates, towers |
| 5 | **The Metropolis**: the drowned skyline at the centre (today's `command_ruin`) | Centre | 1 | Multi-cell walled city; apex |

- **Faction seats** sit on tier 2–3 provinces (§6.2). The tier ladder then gives each faction a credible home city
  without a fifth special tier.
- **Alternative names** (grit tone): Barter Yard / Scrap Market (1); Holdout / Waystation (2); Bastion / Fort Town (3);
  Old City / Dead City (4); The Sprawl / Capitol Ruins (5).

### 3.2 What scales per tier

All values are **[placeholder]**. They live in a `MAIN_POI_TIERS` data array indexed by tier, and nothing reads a
literal 5.

| Scales | T1 Market | T2 Township | T3 Stockade | T4 Ruin City | T5 Metropolis | Source pattern |
|---|---|---|---|---|---|---|
| **Walls** (× ADR 0055 baseline) | 0.5 (bounce small raids) | 0.8 | 1.0 | 1.3 | 1.8 | Total War: walls on majors only [official/community] |
| **Garrison power** (× province band) | 0.6 | 0.8 | 1.0 | 1.3 | 1.8 | Last War durability + garrison [community] |
| **Province buff** | 5% economic | 8% eco/logistic | 10% any | 15% military | 25% military + title | Whiteout facility Lv1 +5% → Lv3 +8% [community]; today's 10/12/15/25% [code] |
| **Resource yield** (nodes in the province) | `3+tier`/s (today's formula) | ↑ | ↑ | ↑ | ↑ | `gridGen.js` [code] |
| **March unlock** | HQ ≥ `tierGate[1]` | `tierGate[2]` | … | … | … | Last War's opening of levels in order [community]; RoK pass levels [wiki] |
| **Holdings** | 1 | 1–2 | 2 | 2–3 | 4 satellites | Last War cannons / Whiteout turrets ×4 [community] |
| **Footprint** (cells) | 1×1 | 2×2 | 3×3 | 4×4 | 6×6 | Whiteout facility 3×3, HQ 15×15 [community] |
| **Visible at zoom** | near + mid | near + mid | all | all | all, plus through fog | §5 |

- **Ties to the existing tiers.** Today the region `tier` runs 1–6 and follows `requires` depth, not geography
  (`world-map-codebase.md` §8.3). For example, `command_ruin` is only 45 cells from home.
- **The tier ladder fixes that.** The tier becomes **distance to the centre**, and the gates follow the connection
  graph from Option B.
- **Filler levels** keep `poiLevel = province.tier + gradient` from genre §7.4.

**Built to extend:**

- Adding a T6 (say, an "Ark" beyond the Metropolis) means appending one row to `MAIN_POI_TIERS` and one province.
- Guard tests:
  - a synthetic 13th province;
  - a synthetic 6th tier;
  - tier monotonic toward the apex;
  - exactly one apex, with `max(tier)` read from data.

---

## 4. The centre metropolis

### 4.1 What holding the centre means in the genre

| Game | Title | Effect | Contest cadence | End goal? |
|---|---|---|---|---|
| RoK Lost Temple | King | Hands out titles, buffs and debuffs; kingdom-wide build, research, train and gather buffs once a day [wiki via search] | Opens every 7 days; 8 h hold [wiki via search] | No: recurring |
| Whiteout Sunfire Castle | President / Supreme President | +5% (×1.5 for Supreme) to the four combat stats; state-wide skills; ministers [community] | Monthly, plus SvS; 2.5 h hold [community] | No: recurring |
| State of Survival Capital | Governor | [not found] | Bi-weekly, 12 h event, 6 h hold [community] | No: recurring |
| Last War Capitol | President | [not found] | Repeats after the L6 phase [community]; opens on day 28 [community] | Season climax |
| Civ (domination) | — | Win | — | **Yes**: hold every original capital [community] |

The genre's centre is **a title plus a kingdom-wide effect plus a recurring contest window**. Single-player 4X uses the
capital as **the victory condition**. [inference from the table]

### 4.2 Options for Basie

| Option | Fit with the agreed AI design |
|---|---|
| **A. End-goal victory**: take it, get credits, the game ends | Kills the faction loop (ai-factions purpose 2, a living world). Poor fit |
| **B. Permanent capital with rotating warlord sieges** | Good. Each siege is an AI plan (Probe → Massing → March) and counts as **the one hostile countdown**; locked when telegraphed; held while offline |
| **C. Seasonal reset** | Needs a reset of the save or the map; conflicts with a persistent single-player save. Poor fit |
| **D. King of the hill: the AI keeps contesting** | Good if fairness caps it. Factions can also fight *each other* for it before you arrive, which is a visible living world |

**Recommendation: B + D, with the first capture as a milestone "victory".** [inference]

1. **Before the player arrives**, the Metropolis is neutral and heavily garrisoned (the NPC defenders the genre uses at
   season start). Majors may lay siege to it AI-vs-AI.
   - A faction holding the Metropolis gets its buff, which gives the player a reason to go there.
2. **First capture** is a **milestone event** ("Warden of the Sprawl"):
   - an end-of-arc screen and a title;
   - the T5 map-wide buff;
   - a 4-satellite defence ring.
3. **Afterwards**, the factions score "assault the Metropolis" like any other target. The utility weights favour it, and
   the "why" reads "the crown". The sieges still obey the fairness rules:
   - one countdown at a time;
   - a calm period of 12 h after an assault;
   - never landing while offline;
   - the global assault cap;
   - and, optionally, a calendar slot such as "Siege Week" (`world-events.md` calendar source).
4. **Losing it** drops the title and buff and returns it to the taker. **The Metropolis is exempt from the re-fog
   cascade**, because it's the apex and has nothing "beyond" it. That keeps the loss sharp but not crushing.

---

## 5. Map presentation: making the tier visible

| Technique | Genre evidence | Basie rule [inference] |
|---|---|---|
| **Footprint grows with tier** | Whiteout facility 3×3, banner 7×7, HQ 15×15 [community] | Footprint from `MAIN_POI_TIERS.footprint`. Cells under it are unbuildable for filler, with a 6-cell clear ring (genre §7.4) |
| **Art changes with level** | RTK XIV: city expansion "changes their visual appearance" [official]; Total War settlement models update on upgrade [community, modding notes] | One sprite per tier (Blender render, genre §5.5), with faction recolour by owner tint |
| **Walls drawn on the big ones** | Total War: majors are sieges with walls, minors are not [official blog] | Draw a wall ring from T3 up. Its stroke weight and tower count scale with tier, and wall damage shows as gaps |
| **Skyline silhouette** | [not found] for mobile 4X; RoK sells a "seamless" infinite zoom [official press] | T4–T5 get a tall silhouette that reads at far zoom and is cached as a pre-rendered canvas (MDN) |
| **Label weight** | Mapbox priority placement [official] | Label size and weight by tier; priority = tier, so a market label yields before a city label |
| **Zoom visibility** | Total War overlays change with zoom [official Academy] | Far zoom: T3+ and faction seats. Mid: all main POIs and holdings. Near: everything (genre §4.1) |
| **Fog** | ai-factions: bases visible through fog | Main POIs of T4+ and faction seats are **known landmarks** in fog (silhouette and name). Lower tiers show once their province is discovered |
| **Satellites** | Whiteout's 4 turrets, Last War's 4 cannons [community] | Holdings are drawn with a thin dashed tether to their main POI, so the "helps the siege" link is visible |

---

## 6. Implications for Basie

### 6.1 Changes to Option B

- **Delete `capitalId`** and settlements as the owners. Each province gets `mainPoiId`, `tier` and `holdings[]`.
- **The province owner is the owner of the main POI**, read directly rather than derived from all the settlements.
- **The province buff comes from the main POI alone.** Holdings add local yield and the siege-satellite wall modifier.
  The Total War "all settlements" commandment is dropped.
- **Onward unlock and cascade** run from main POIs only. Losing a holding never re-fogs anything.
- **Everything else in Option B stays:**
  - the connection graph, passes, organic provinces and slots;
  - war camps on pass cells;
  - generated nodes and camps clustered around **holdings** (not settlements) and the main POI.
- **Today's code is about 80% of design (a) already.** `strongholdId` plus the stronghold's `capturesRegion` is
  effectively `mainPoiId`. The rework renames the field, adds `tier` geometry and footprint, and replaces the hard-coded
  `'player'` in `captureRegion` with `setPoiOwner(id, owner)` (genre §7.3).

### 6.2 Faction home bases

- A **faction seat** is the **main POI of the faction's home province**, with `seatOf: <factionId>`. It is a tier 2–3
  main POI with:
  - a seat bonus to garrison and walls (ADR 0055's "very hard");
  - landmark visibility through fog;
  - the supply-column origin for war camps.
- **Can the player capture it?** The design leaves this open. ai-factions says the base "can be scouted and attacked,
  but is very hard". Two choices for an ADR:
  - (i) **sack, not capture**: a win loots it and sets the faction back, but ownership stays (it mirrors Home Refuge);
  - (ii) **capture eliminates the faction**, which conflicts with "No code hard-codes 3 factions" only in content
    terms.

  Recommend (i) for v1. [inference]

### 6.3 Rebels

- The rebel lifecycle runs **camp → settlement → stronghold** on `rebelSlots`, which are not main POIs.
- A rebel **stronghold** first takes a **holding**. Then it can **assault the main POI of a province up to
  `rebelMaxTier`** (data, e.g. 2).
- **Rebels never create a new main POI.** That keeps the invariant of exactly one main POI per province. A rebel-held
  Market keeps its tier, takes violet ownership and gets violet hatching.
- The future "minor rises to major" (`tier: minor|major` in ai-factions) hooks in here: a rebel faction that holds a
  T2+ main POI for N days can be promoted. [inference]

### 6.4 Save and id model

- **Static data** (not saved):
  - `province.mainPoiId`;
  - `tier`;
  - the footprint cells;
  - `holdings[]` ids;
  - `seatOf`.
- **Saved:**
  - `poiOwner[poiId]` for main POIs and holdings, with one owner map that replaces `regionOwner`;
  - `walls[poiId] = { level, hp }` (main POIs and walled holdings);
  - the existing `slotOccupant`.
  - Each needs seed and reconcile coverage in `worldState.js` (CLAUDE.md gotcha).
- **Derived** (never stored):
  - `provinceOwner = poiOwner[mainPoiId]`;
  - the title holder = the owner of the apex main POI;
  - the effective walls (base walls ± the holding-satellite modifier).
- **Ids:**
  - keep the `sh_*` ids where a main POI replaces a stronghold (`sh_ruin` → the Metropolis);
  - new provinces get `mp_<provinceId>`;
  - holdings get `hd_<provinceId>_<n>`.
  - No legacy migration is needed (no-legacy-compat), but the snapshot test in `gameData.test.js` changes deliberately.
- **Events:** `world:poiCaptured` / `world:poiLost`. `world:regionCaptured` / `world:regionLost` are emitted **only**
  when the POI is a main POI.

---

## Sources

Tiered cities, mobile 4X

- Last War City Clash (zones, L1–6, L7 Capitol, cannons, adjacency, cap of 6): https://www.lastwartutorial.com/?p=759
- Last War S1 map (strongholds vs cities, protection, caps, one buff per zone, Capitol on day 28):
  https://wera-website.onrender.com/docs/season-1/map
- Last War presidential titles: https://heaven-guardian.com/last-war-presidential-titles-guide-alliance-power/
- Last Shelter president in the state view: https://www.appgamer.com/last-shelter-survival/answers/9963-how-to-see-the-list-of-the-presiden
- Last Shelter plot rings and adjacency (via the genre doc): https://www.appgamer.com/last-shelter-survival/answers/7376-where-is-the-best-place-to-place-bu ;
  https://www.appgamer.com/last-shelter-survival/answers/15303-no-adjacent-territory-cannot-occupy
- State of Survival Capital Clash (towers, 6 h hold, Governor): https://www.touchtapplay.com/state-of-survival-capital-clash-event-guide/ ;
  https://game-solver.com/state-of-survival/capital-clash-event/
- Whiteout facilities (Lv1–4, buffs, 3×3, capture rules): https://wostools.net/wiki/facilities
- Whiteout Sunfire Castle (turrets, 2.5 h hold, President buffs): https://wostools.net/sunfire-castle-battle
- Whiteout SvS: https://www.bluestacks.com/blog/game-guides/white-out-survival/wos-svs-guide-en.html
- Whiteout Winter Siege (12 fortresses + 4 strongholds; low confidence): https://topuplist.com/blogs/detail/whiteout-survival-winter-siege-guide
- Whiteout map rings (via the genre doc): https://heaven-guardian.com/whiteout-survival-map-guide/
- RoK map and holy-site buffs: https://riseofkingdomsguides.com/rise-of-kingdoms-map-guide/
- RoK zones (6/3/1, pass level 2): https://riseofkingdomsguides.com/rise-of-kingdoms-zones-guide/
- RoK holy sites, passes, Lost Temple (wiki, read via search excerpts; HTTP 402 on fetch): https://riseofkingdoms.fandom.com/wiki/Holy_Sites ;
  https://riseofkingdoms.fandom.com/wiki/Kingdom
- Call of Dragons S1 (A7/B3/C1, pass levels): https://cod.guide/season-1/
- Call of Dragons villages: https://cod.guide/villages/ ; patch 1.0.16: https://cod.guide/update-1-0-16-song-of-summer/
- Call of Dragons territory: https://heaven-guardian.com/call-of-dragons-alliance-buildings-territory-guide/
- AoE Mobile store text (gates, archer towers, siege weapons): https://apps.apple.com/app/6476261995
- AoE Mobile siege / royal city press: https://gamespress.westeu-v2.propressroom.com/Age-of-Empires-Mobile-Showcases-Siege-Multiplayer-Gameplay-in-Final-Tr

Single-player strategy

- Total War: Warhammer III sieges and minor settlement battles (official): https://www.totalwar.com/?p=15524
- Total War slot counts by settlement type (WH2 dev post via PC Invasion): https://www.pcinvasion.com/?p=152941
- Total War minor settlement tier cap / walls (wiki, forum): https://totalwarwarhammer.fandom.com/wiki/Ogre_Kingdoms_buildings ;
  https://steamcommunity.com/app/1142710/discussions/0/6369856944151888256
- Total War: Three Kingdoms counties and commanderies: https://totalwar.fandom.com/wiki/Counties
- Total War provinces (Academy, via the genre doc): https://academy.totalwar.com/?p=118
- RTK XIV manual (city regions, areas, cores, bases, durability): https://www.koeitecmoamerica.com/manual/rtk14/en/3100.html
- RTK XIV system page (city expansion changes appearance and durability; gates; tribes): https://www.koeitecmoeurope.com/rtk14/system-field.html
- Endless Legend: one city per region (dev forum GDD): https://community.amplitude-studios.com/amplitude-studios/endless-legend/forums/7-archives/threads/3589-el-gdd-3-the-world?page=4
- Endless Legend design intent: https://www.gamespot.com/articles/how-endless-legend-modernizes-4x-strategy/1100-6418512/
- Endless Legend minor-faction villages: https://endlesslegend.wiki.gg/wiki/Assimilation
- Humankind feature focus: claiming territory (official): https://community.amplitude-studios.com/amplitude-studios/humankind/blogs/724-humankind-feature-focus-03-claimi?page=1
- Humankind territory rule: https://humankind.fandom.com/wiki/Territory
- Civ VI city-states and suzerain: https://civilization.fandom.com/wiki/City-state_(Civ6) ; https://civilization.fandom.com/wiki/Suzerain_(Civ6)
- Civ domination victory: https://www.keengamer.com/articles/guides/civilization-vi-domination-victory-guide/ ;
  https://civilization.fandom.com/wiki/Victory_(Civ5)
- HoMM III HotA template format (towns per zone, guard values): https://h3hota.com/en/template-format

Presentation

- Mapbox label collision and priority: https://github.com/mapbox/mapbox-gl-native/wiki/Collision-Detection
- MDN, Optimizing canvas: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- RoK seamless world map (Lilith press release): https://www.uberstrategist.com/press-release/rise-of-kingdoms-lilith-games

Basie code and docs: `js/entities/data/worldMap.js` (`strongholdId`, `tier`), `js/systems/march/marchResolver.js:62`
(`capturesRegion`), `js/systems/world/WorldMapManager.js:235` (`captureRegion`), `docs/research/world-map-genre.md`
§3, §4 and §7, `docs/research/world-map-codebase.md` §1 and §8, `docs/10-design/ai-factions.md` and
`docs/10-design/world-events.md`.
