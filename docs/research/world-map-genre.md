# World-map design research (mobile 4X, single-player strategy, 2D canvas art)

Research input for the world-map rework: better sprites, sub-region design and content placement, and hosting the
agreed AI-factions and world-events design (`docs/10-design/ai-factions.md`, `world-events.md`). Written 2026-10-12.
This is not a design lock. A decision taken from it goes into an ADR.

## Read this first: how much is actually confirmed

Mobile 4X games publish almost nothing about their maps. Their official sites are store pages, and the community wikis
(Fandom) returned 402 or bot walls to direct fetches this session. Most mobile-genre facts below come from guide sites
and Q&A pages, and they often disagree with each other. The strongest primary sources here are:

- the Heroes III HotA random-map template reference;
- the Songs of Conquest map-generator modding docs;
- Bridson's Poisson-disk paper;
- MDN's canvas optimisation guide;
- Mapbox's label-collision docs;
- Lilith's Rise of Kingdoms press releases;
- the Townscaper / Bad North developer article.

No mobile studio has published an art breakdown of its world map that I could find.

Confidence labels:

- **[official]**: developer text, docs, press release or patch note.
- **[wiki]**: community wiki or game files.
- **[community]**: guide site, Q&A or forum. May be stale or wrong.
- **[memory]**: known to the researcher, not re-verified this session.
- **[inference]**: my reasoning, not a sourced fact.
- **[not found]**: searched, nothing usable.

## Summary: what matters most for Basie

1. **Every genre leader uses concentric tiers, gated by passes or adjacency.** Rise of Kingdoms has zones 1 → 2 → 3,
   counted 6/3/1 per kingdom. The zones are walled by mountains and rivers and linked by capturable passes. The Lost
   Temple sits at the centre [community]. Whiteout Survival runs Icefield (L1–5 tiles) → Tundra (L6–7) → centre (L8)
   around Sunfire Castle [community]. Last Shelter's state map runs plots L1–5 → 5–9 → 9–12 → 12–16 from the edge
   inward [community]. Basie's "expand toward the centre ruin" matches the genre. What it lacks is the *physical*
   gate: a pass or ridge that you can see.
2. **Ownership is claimed at a finer grain than the "region".** RoK flags and Whiteout banners each claim a small
   footprint that must touch existing territory. Territory has to *touch* a target before you can attack it
   [community]. Total War splits a province into a capital plus 1–3 minor settlements, and holding all of them unlocks
   a province-wide commandment [wiki]. Basie's whole-region flip is coarser than anything in the genre.
3. **Badge soup in Basie is mostly a zoom problem.** Filler POIs are spaced ≥3 cells apart in *world* space
   (`gridGen.js`, Manhattan distance). At the zoomed-out view that is about 20 px, but the badges are about 30 px, so
   they overlap and clump [inference, measured from code and screenshot 04]. The fixes are semantic zoom (show fewer
   classes when zoomed out) and screen-space collision with priority, the way Mapbox resolves labels [official].
4. **The best single-player reference for placement is the Heroes random-map generator.** It builds zones joined by
   *guarded connections* whose guard strength follows a value. Mines carry fixed values and are ringed by 0–3 loose
   resources of their own type. Treasure comes in value bands. Guards are derived from the value they protect, and
   guards worth more than a threshold are kept off roads [official, HotA template docs]. Songs of Conquest uses the
   same shape: nodes, connections with `guardChance`, and blueprints that place objects by `distance` from the region
   centre and by `location` (near roads, edges) [official].
5. **Fog doesn't need "?" badges.** Civ VI draws unexplored land as an old-cartography parchment and keeps a sketched
   memory of land you've seen [community/press]. Basie's faction design already wants bases visible through fog. A
   sketched-terrain fog with only *known landmarks* shown will read better than dozens of dashed circles
   [inference].
6. **A rich look on a solo budget means baking the terrain, then scattering details over it.** Bake the terrain into
   cached chunk canvases once (MDN: pre-render to offscreen canvases, layer canvases by update rate, avoid `shadowBlur`
   and per-frame text [official]). Blend biomes with a 5-tile dual-grid autotile (down from 14 or 47 tiles
   [official/wiki]) or with splat masks. Then scatter Poisson-disk decorations [official, Bridson]. Render POI props
   once in Blender with an orthographic camera at a fixed angle [community tutorials].
7. **Recommended structure (detail in §7):** **provinces with settlements and passes.**
   - About 12 organic provinces (versus 9 rectangles), joined by an explicit connection graph of road, pass and gate
     links.
   - Each province holds one capital (the region capture), 2–4 settlements or districts (individually ownable) and one
     landmark.
   - Faction home bases, war camps and rebels all live on pre-baked *slots*.
   - Everything is a data append.

---

## 1. How the genre leaders structure their world maps

### 1.1 Comparison table

| Game | Hierarchy | Tier rings | Gates / chokepoints | Centre | Holding territory |
|---|---|---|---|---|---|
| **Rise of Kingdoms** | Kingdom → 3 zone types (6× zone 1, 3× zone 2, 1× zone 3) [community] | Outer zone 1 starts; better resources, barbarians and holy sites inward [community] | Mountains/rivers wall zones; **passes** must be captured to enter the next region; zone 2 needs a level-2 pass [community] | **Lost Temple**; holder's leader becomes King [community] | Centre fortress → flags; each flag must touch existing territory; you can only attack holy sites and flags your territory touches; +25% gather inside own territory [community] |
| **Whiteout Survival** | State → Icefield / Tundra / Fertile centre [community] | Icefield L1–5 tiles, Tundra L6–7, centre L8 [community] | Territory must *reach* a facility before it can be contested [community] | **Sunfire Castle** + 4 turrets (Eastcourt, Westplain, Southwing, Northground); turrets shoot the castle holder if held by a rival [community] | Alliance HQ + banners (≈7×7 cells each, must connect) [community]; 12 fortresses + 4 strongholds contested weekly, NPC-held at season start [community] |
| **Last Shelter: Survival** | State map; named rings (Doomsday season: "Death Desert" outer, "Badlands" second) [community] | Plots L1–5, 5–9, 9–12, 12–16 from edge to centre [community] | Can only occupy a plot adjacent to your own or an ally's plot [community] | Presidency decided by a Launch Center battle [community] | Alliance Centers (AC1 outer, AC2 second ring); a rally point covers 9 plots [community] |
| **State of Survival** | State with one capital [community] | [not found] | [not found] | **Capital**: Capital Clash, held for N hours (sources say 6 or 8); towers support the attack [community] | Alliance territory around a relocatable alliance HQ [community] |
| **Lords Mobile** | Kingdom with Wonders "arranged around the map"; Darknests L1–5 [community] | [not found] | [not found] | Wonder held by the guild that rules; Emperor title [community] | Guild-based; no tile claims documented [not found] |
| **Evony: The King's Return** | Map with **City of Throne** "exactly at the middle" [community] | Resource buildings have levels; NPC guards must be beaten first [community] | [not found] | Throne: hold for 5 h against challengers → King [community] | Per-building occupation [community] |
| **Puzzles & Survival** | [not found] | [not found] | [not found] | [not found] | [not found] |
| **Age of Empires Mobile** | One big map; Imperial City Clash for a royal city; "dynamic weather"; rain and drought change the landscape and affect troop movement [official press] | [not found] | [not found] | Royal city [official press] | [not found] |

### 1.2 Common shape

Read across the table, the mobile 4X template is consistent [inference, from the rows above]:

- **Concentric difficulty.** Start at the rim and push inward. Every ring raises tile level, monster level and reward
  value. Basie's region `tier` 1→6 already encodes this.
- **Physical gates.** RoK walls its zones with terrain and makes passes the only way through. Passes are both capturable
  objectives and travel links (RoK lets you teleport between regions joined by an owned pass) [community]. A gate is a
  *place*, not a rule in a tooltip.
- **One crowned centre.** The centre gives a title (King, President, Emperor) and is ringed by satellites that matter
  to the fight: Whiteout's turrets, State of Survival's towers.
- **Small-footprint claims that must stay contiguous.** Flags, banners and plots all require adjacency. The adjacency
  rule *is* the expansion mechanic, and it also decides what you're allowed to attack.
- **Season resets and NPC defenders.** Contested buildings start each season held by NPCs (Whiteout's Phaethon
  Mercenaries) [community]. In a single-player game, AI factions fill that role permanently.

### 1.3 What transfers to single player

| Genre pattern | Translation for Basie |
|---|---|
| Zone rings + passes | Keep tier rings, and make the ring borders *passes* on the map that a faction can hold or wall |
| Flags/banners touching territory | Ownership at settlement level. You can only attack a settlement adjacent to one you hold (or reachable via an owned pass) |
| Centre + satellite turrets | Command Ruin gets 2–4 satellite settlements that must fall first (today it needs 4 owned regions) |
| Territory gather bonus | Already exists as region buffs. Make it local: the design always said "in-region" and it was never built (`world-map.md`) |
| NPC-held contested buildings | The AI factions hold them, and rebels can take neutral ones |

---

## 2. Single-player and offline maps worth borrowing from

### 2.1 Northgard: small sectors with capacity

- The map is split into territories. Colonising one costs food (or Krowns for some clans), often after clearing wolves,
  draugr or kobolds, and **each new territory costs more** [community: PC Gamer, bit-tech, GameSkinny].
- **Each territory has a building cap** (2–4 slots, start tile excepted). Tiles can mix resource types, and scouting
  shows a territory's slots and resources before you commit [wiki excerpt, community].
- *Why it reads well* [inference]:
  - The territory is the unit of everything: ownership, building, resources and fog.
  - Every territory is roughly screen-sized at normal zoom, so one glance shows one decision.
  - The escalating cost paces expansion without a separate unlock chain.

### 2.2 Civilization: borders that grow, and fog as an old map

- In Civ VI a city starts with a 7-hex footprint and grows borders tile by tile through culture, or by buying tiles
  adjacent to its border. Workable range is 3 rings, and borders can reach 5 [community]. Culture bombs instantly
  annex the six surrounding tiles [wiki].
- Civ VI's fog is drawn as **old cartography**: parchment with sketched terrain. Once a unit leaves, a sketched memory
  of the explored area remains. Lead designer Ed Beach tied the look to an Age of Exploration theme [community/press:
  Digital Trends, Gamepressure, Apolyton].
- In the resource scripts, **natural wonders get an exclusion zone**: no resources around them except fish. Strategic
  resources are placed outside the 3-ring start areas. The minimum start distance is a data parameter (12) [community,
  CivFanatics, from reading `AssignStartingPlots.lua`].
- *Borrow:*
  - landmarks keep clear space around themselves, which makes them read as landmarks;
  - fog keeps the shape of what you've seen;
  - ownership edges are drawn as coloured lines rather than full-area fills [memory: Civ V/VI border style].

### 2.3 Total War: province = capital + minor settlements

- The campaign map is divided into provinces. Each holds several settlements: a capital plus usually 1–3 minor
  settlements. Settlements control the territory around them [official: Total War Academy; wiki].
- **Holding every settlement in a province unlocks a commandment**, a province-wide edict such as higher tax [wiki,
  community].
- A contested province is treated as separate "local provinces" per owner [community].
- Settlements raise their own garrison when attacked, at no upkeep, and repeated battles deplete it [official
  excerpt].
- Zooming far out switches to a strategic (parchment) map that shows only discovered areas. Overlays of cities and
  armies change with zoom [official Academy; community].
- *Borrow:* this is the hybrid Basie needs. The **province** is the region that carries a name, biome and buff. The
  **settlements** are what you capture and lose, one at a time. Partial ownership is visible and meaningful. The full
  province gives a bonus. Faction pressure can take one settlement without taking the whole region, which softens the
  "lose region → cascade re-fog" penalty in ADR 0055.

### 2.4 Heroes of Might & Magic: guarded passes, mines and value bands

The Heroes III HotA template format is the most explicit published model of fair, readable placement [official]:

- **Zones** are "a self-coherent piece of land, containing a single terrain type". Size is relative.
- **Connections** come in four kinds:
  - *Standard*: monster-guarded, with strength tied to the connection value.
  - *Wide*: never guarded.
  - *Border Guard*: a coloured gate opened by visiting a matching Keymaster's Tent elsewhere.
  - *Fictive*: no passage, but it shapes the layout.
  - Roads are optional per connection.
- **Mines** carry values (Sawmill 1500, Gold Mine 7000). Each "can be surrounded by 0–3 unguarded resources of its own
  type". The first Sawmill and Ore Pit are placed "within 12 tiles of the main town, if possible".
- **Treasure** comes in three value bands per zone, each with a frequency. Objects are grouped until the group's value
  is met, and each group shares one guard.
- **Guard size is derived from the protected value.** Below 2000 there is no guard. Guards over "Max Road Block Value"
  (a third of the zone's top treasure) are never placed on roads, so the main route never dead-ends on a monster the
  player can't beat yet.
- Community templates show the usual topology: spawn → one road → a zone with a city to conquer → a guarded centre with
  the richest treasure [community, Steam]. The known failure is generator "leaks": treasure reachable around its guard
  [community].

Songs of Conquest (a modern Heroes-like) exposes the same model as data [official]:

- layout `nodes` with relative `x,y` and `fill` share, plus child regions that grow off a parent;
- connections with `road`, `wide`, `guardChance` and `guardTier`;
- blueprints that place objects by `count`, `distance` from the region centre and `location` (near roads, map edges);
- region types `player_start`, low/medium/high treasure, `center`, and `default` fill.

*Borrow:* a connection graph with guarded passes and keyed gates, mines with a satellite cluster, value-driven guards,
and "never block the road with an unbeatable guard".

### 2.5 Frostpunk 2: the Frostland as a logistics layer

- You zoom out from the city to the Frostland. Regions show their potential rewards when clicked [community: Prima,
  Twinfinite, Sportskeeda].
- **Frostland teams** run expeditions. Sites come in three kinds:
  - *one-off caches*: a single trip;
  - *harvesting sites*: teams stay on site for a steady supply;
  - *outposts*: permanent bonuses that must be linked to the city by a **Trail or Skyway**, whose cost grows with length
    and complexity [community].
- *Borrow:* holdings stay useful only while *connected* by a route you built. In Basie terms, a settlement's buff is
  active only while it's road-connected to owned territory. This makes intercepts and cut supply lines meaningful
  without new combat [inference].

### 2.6 They Are Billions: a campaign map revealed by play

- The campaign world map starts unknown. Completing a mission reveals nearby areas and unlocks more missions. Several
  missions are always open, so you can pick an order that fits your tech. Colony maps are linked by a railway that
  brings colonists daily [official: Numantian dev blog; community].
- Empire City is ringed by the Great Crater as a natural barrier [community].
- *Borrow:* reveal by *adjacency to success*, always offer 2–3 parallel choices, and use one huge natural barrier
  around the centre.

### 2.7 Kingdom Rush and Bad North

- **Kingdom Rush:**
  - Each stage is a spot on a kingdom map, and selecting one shows a briefing first.
  - The map doubles as the progress and hero hub.
  - The route follows a story path, and stars gate later content [community].
- **Bad North:**
  - The islands are procedural and generated with wave function collapse from over 300 hand-built tiles.
  - Island shape *is* the tactics (chokepoints).
  - Stålberg: WFC "is pretty bad for long, thin things", which is why rivers and roads need their own pass [official
    interview, Game Developer].
- *Borrow:* an anchored briefing card on the map node (already accepted as the "intel card"). Generate roads and rivers
  as splines, not as tiles.

### 2.8 Roguelite node maps (progression only)

- **Slay the Spire:**
  - 17 floors per act, up to 6 rooms per floor, 1–3 paths into each room.
  - The first floor holds only easy fights, with at least 2 different starting rooms.
  - A rest site always sits before the boss [wiki/community].
  - The whole route is visible, so the player plans backward from the boss [community].
- **FTL:** 8 sectors of about 20 beacons each. A rebel fleet advances behind you and blocks quests in the sectors it
  reaches. Developer Matthew Davis on uncertain jump ranges: "it adds suspense … makes your path decision more of a
  risk" [Wikipedia; Subset forum, developer post].
- *Borrow for progression:*
  - show the whole route graph of passes and provinces up front;
  - guarantee ≥2 choices at every frontier;
  - put a rest/heal node before every capstone fight;
  - an advancing front (FTL's fleet) is a ready-made model for **contamination spreading across cells** in
    `world-events.md`.

### 2.9 What makes a map read, feel like a place, and pace well

| Quality | Pattern | Seen in |
|---|---|---|
| Reads | One unit of ownership, sized to the screen at the zoom where you act on it | Northgard, Total War |
| Reads | Landmarks keep clear space; nothing clusters around them | Civ resource exclusion, HoMM mine satellites |
| Place | Each zone has one terrain identity | HoMM "single terrain type" per zone, Northgard biomes |
| Place | Natural barriers explain the gates | RoK mountains/rivers, TAB Great Crater |
| Pacing | Visible, guarded routes; difficulty tied to the guarded value | HoMM, Songs of Conquest |
| Pacing | Escalating cost per expansion | Northgard |
| Pacing | Always ≥2 frontier choices | TAB, Slay the Spire |

---

## 3. Sub-region design patterns

### 3.1 Where ownership lives

| Model | Example | Pros | Cons |
|---|---|---|---|
| Region only (today) | Basie's 9 tiles; Risk-style | Simple, few save keys | One fight flips a huge area; "lose region → cascade" is brutal; little to do inside a region |
| Sub-region only | Northgard territories, Civ tiles | Fine-grained progress | Many units to name and draw; the region identity weakens |
| **Hybrid: province + settlements** | Total War; RoK zone + flags | Partial holds, local fights, a province bonus on completion; AI can nibble | Two levels to show at once (solved by semantic zoom, §4.1) |

The hybrid fits the faction design best [inference]:

- war camps target a *settlement*;
- walls are per settlement, with the province capital walled hardest;
- a rebel stronghold takes a settlement, then the province once it holds the capital;
- the Welcome Back report can say "Talon took Grain Fields (Red Lowlands)" without wiping the region.

### 3.2 Borders: grid vs organic, natural boundaries

- **Grid seams look artificial.** Paradox's EU IV dev diary said EU III's provinces "felt a little weird, because the
  borders didn't look right" even after a resolution increase [official dev diary, quoted via search excerpt].
- **Organic regions from points.** Seed points per province, assign cells to the nearest seed (Voronoi), and perturb
  edges with noise. This is the standard technique from Amit Patel's polygon map generation article [memory; mapgen2
  page confirmed it uses Delaunay/Voronoi, official].
- **Natural boundaries carry the meaning.** Draw the province border *along* a river or ridge wherever possible, and
  leave a deliberate gap: a ford, a bridge or a pass. RoK does exactly this [community]. In HoMM the zone border is
  solid obstacle except at the connection [official].
- **Basie already has terrain classes** (`WATER`, `RIDGE`, `FOREST`, `RUBBLE`, `CRACKED`, `WASTELAND` from fbm noise in
  `gridGen.js`). They're scattered by noise rather than used as borders, and in screenshot 03 they read as a muted
  checkerboard [inference from code and screenshot].

### 3.3 Chokepoints and passes as gameplay

| Pass kind | Gameplay | Source pattern |
|---|---|---|
| Guarded pass | Beat the guard to open the province beyond | HoMM Standard connection |
| Keyed gate | Open by taking a specific POI elsewhere | HoMM Border Guard + Keymaster's Tent |
| Fortified pass | Holder gets a wall bonus; AI war camps mass behind their own pass | RoK passes; Basie ADR 0055 walls |
| Wide border | No gate; open frontier | HoMM Wide |
| Bridge / ford | A road crosses a river; intercept point | [inference] |

Passes also give marches a route:

- a march between provinces must go through a connection;
- the **intercept window** happens at a real, visible spot;
- **storm cells** that sit on a pass close it [inference, fits `world-events.md`].

### 3.4 Landmarks per region

- Use one **signature landmark** per province: the visual and narrative anchor (e.g. "Behemoth Spire" as a real spire
  sprite).
- Civ VI natural wonders and HoMM unique objects are placed with exclusion space [community; official], and that space
  is what lets them read.
- Faction home bases are landmarks *by design*: ai-factions.md says they are visible through fog.

### 3.5 Roads that shape march routes

- Songs of Conquest connections carry a `road` type, and blueprints place objects "near roads" [official]. HoMM keeps
  big guards off roads [official].
- Frostpunk 2 makes routes a built, priced asset [community].
- For Basie [inference]:
  - Marches follow the road graph (A* over connections, then straight inside a province).
  - Roads speed marches up (logistic flavour).
  - The visible path makes faction marches readable and their intercept points predictable.
  - Herd migration follows a fixed off-road route.

### 3.6 Biome identity per region

- HoMM: one terrain type per zone, and object rules allow only certain terrains [official].
- Whiteout's ring names are biomes (Icefield, Tundra) [community].
- For Basie: one dominant biome per province, ≤2 secondary ones, and a resource bias tied to the biome (§6.5).

---

## 4. Map readability and UI

### 4.1 Semantic zoom (LOD by meaning, not just size)

Strategy maps change *what* they show as you zoom, not only how big it is:

- Total War swaps to a parchment strategic map when zoomed out, and the city/army overlays depend on zoom [official
  Academy; community].
- RoK sells "infinite zoom" from world to individual city on one seamless map [official press].

Proposed Basie zoom bands [inference]:

| Band | Shows | Hides |
|---|---|---|
| **Far** (whole map) | Province fills and borders, province names, capitals, faction bases, landmarks, threat routes, event areas | Nodes, camps, small labels |
| **Mid** (one province fills the screen) | Settlements with level, passes, roads, war camps, rebel camps, ruins, outposts, world boss | Individual nodes become a count chip per settlement ("⛏3 🌲2") |
| **Near** (default play zoom) | Everything, with POI names on hover/selection only | Province name drops to a corner chip |

### 4.2 Icon and badge design

- Today every class uses the same circle badge, which is why the map reads as "badge soup" [inference].
- Use **shape for class and colour for owner** [inference, standard cartographic practice]:
  - resource nodes: small, no frame, the resource glyph only;
  - camps: a shield;
  - settlements and capitals: a bigger sprite with a plinth;
  - landmarks: a full illustrated sprite with no badge.
- The level appears only on targets you can act on, and only at mid or near zoom.

### 4.3 Label placement without overlap

- Mapbox's collision system places labels in **priority order** and keeps placement **deterministic and stable** while
  panning and zooming, so labels drop only when there is truly no room. It notes that a delay of a couple hundred ms
  before resolving a new collision is perceptually fine, while synchronous work over a few ms is not [official,
  mapbox-gl-native wiki].
- The usual approach is a coarse-to-fine test (bounding boxes first) [patent US6724392, via search].
- Province names go at the polygon's **pole of inaccessibility** (the interior point farthest from the edges; Mapbox
  `polylabel`) [memory], never on top of the capital icon. That fixes the "West Warrens" label covering icons in
  screenshot 04.
- Pre-render each label to a small canvas once. MDN: avoid text rendering per frame [official].

### 4.4 Fog of war without "?" markers

Options:

1. **Cartographic fog** (Civ VI): unexplored land drawn as sketched parchment; explored-but-not-visible land keeps a
   desaturated sketch of what was seen [community/press].
2. **Known landmarks only**: fogged provinces show their silhouette, name and the landmarks the player "knows". Faction
   bases are known by design.
3. **Rumours**: a scout or watchtower reveals *that* something is there (a faint glyph) before revealing *what*. This is
   the honest version of "?" and limited to the few POIs actually rumoured.

Recommendation [inference]: options 1 and 2, with 3 for scout-tier intel. Never draw one marker per hidden POI.

### 4.5 Territory tint and borders

- A full flat tint flattens terrain (screenshot 04).
- Use a **border stroke** in the owner colour, an **inner glow band** that fades inward over about a cell, and a very
  light fill [memory: Civ V/VI border style].
- Contested settlements get **diagonal hatching**. The faction prototype already uses threat hatching
  (`ai-factions.md`).
- Rebel-held settlements get violet `#b07ad8` dashes.
- Use an outline plus a pattern, never colour alone, so the map stays readable for colour-blind players [inference].

### 4.6 Threats, marches and events without clutter

- The faction prototype already sets route styles: hostile red dashed, scouts yellow dotted, non-hostile AI dotted.
- Additional rules [inference]:
  - Only the **one hostile countdown** (fairness rule) gets an animated route and pulse. All other AI marches are
    static thin lines, visible at mid zoom or nearer.
  - Area events (storm, contamination) are drawn as **ground overlays** under POIs (animated cell tint), never as
    badges.
  - Point events (supply drop, herd) get one sprite each, capped by the director's "3 other visible events" limit.
  - "Threat focus" map mode (accepted) dims everything except threats.

---

## 5. Art and sprites for a 2D canvas map

### 5.1 Projection

| Option | Fit for a world map | Notes |
|---|---|---|
| Pure top-down | Best legibility, cheapest tiles, distances read correctly | Flat unless the props have height |
| **Top-down ground + 3/4 props** | The mobile 4X look | Ground tiles stay square; POI sprites rendered at an angle with a drop shadow [inference/memory] |
| Isometric | Matches the city view | Diamond grid complicates organic borders, hit-testing and travel math; Basie's march math is Euclidean on `x,y` |

Recommendation: keep top-down ground, which keeps `worldProjection.js` and `marchMath`, and render props and settlements
at 3/4 to echo the iso city [inference].

### 5.2 Terrain tile approaches

| Technique | Tiles needed per transition | Notes |
|---|---|---|
| Edge Wang (2 colours) | 16 | [official, Boris the Brave classification] |
| Corner Wang / marching squares | 16 (6 with rotation/mirror) | Corner values on the grid's vertices [official] |
| Blob (edge + corner) | 47 (16 with symmetry) | The classic RPG Maker-style autotile [official; wiki] |
| **Dual grid** | **5** (fill, edge, corner, inner corner, merged corner) | Offset the visual grid by half a cell; popularised by Oskar Stålberg [official, TileWorldCreator docs] |
| Splat map | 1 texture per biome + mask | Blend textures by an alpha weight map; chunk the terrain so each chunk only stores the masks it needs [Wikipedia] |
| Painted background + decoration scatter | 0 tiles | One painted image per province or chunk, with props scattered on top; most "handmade"-looking, least flexible |

For Basie [inference]:

- Bake the dual-grid or splat result **into chunk canvases at load**, so the per-frame cost is one `drawImage` per
  visible chunk.
- Rivers and roads are splines stroked on top. Stålberg notes tile solvers are bad at "long, thin things" [official].

### 5.3 How mobile 4X maps are actually made

- **[not found]**: no studio breakdown. A Legou (RoK) job ad lists a senior environment concept artist owning "the
  head map of the project and the resource map" [official job post, via search].
- [memory/inference]:
  - The big mobile 4X games are Unity or in-house 3D engines, drawn from a fixed high camera angle.
  - Terrain is a large tiled texture or mesh.
  - Buildings, monsters and nodes are 3D or pre-rendered sprites.
  - RoK's "seamless world map" with "infinite zoom" [official press] implies LOD-switched 3D assets, not 2D tiles.
- A solo canvas game should copy the *look* (painted ground, angled props, soft shadows), not the pipeline.

### 5.4 Procedural vs hand-authored

- The strongest pattern is **hand-authored anchors plus procedural fill**:
  - HoMM templates author the topology and generate the content [official];
  - Songs of Conquest authors nodes and blueprints, then generates [official];
  - TAB's campaign is authored and its survival mode is random [community].
- Basie already follows this: curated POIs plus a deterministic `generateFillerPois`. Keep it, and give the generator
  better rules (§6).

### 5.5 A rich look cheaply as a solo developer

- **Blender pre-render** [community tutorials, GameFromScratch, OpenGameArt]:
  - orthographic camera at a fixed angle;
  - for isometric props, use the 2:1 game angle, not true isometric, because true iso leaves "gaps or overlappings"
    (Create IsoCam add-on);
  - transparent background;
  - a separate shadow-catcher pass.
  - One kit of props (walls, tents, ruins, rigs) can be recombined into many settlements and rendered in each faction's
    colour via a mask pass [inference].
- **AI-assisted textures**:
  - Scenario and Layer offer style-trained, tileable texture generation;
  - Scenario's SDXL texture model is aimed mostly at realistic textures, and the free tier is personal-use only
    [community comparison].
  - Always check seams on a 2×2 repeat [community].
  - Use AI for **ground textures and decals**, where seams can be checked mechanically. Use Blender for **props**,
    where consistent angle and lighting matter most [inference].
- **Recolour, don't redraw**:
  - Faction variants come from a palette swap.
  - Biome variants are one texture with a colour grade. Basie already has `worldGrade.js`.

### 5.6 Canvas performance

From MDN [official]:

- pre-render repeated drawing to offscreen canvases;
- use integer coordinates;
- don't scale in `drawImage`; cache the sizes you need;
- layer canvases by update rate;
- use `alpha:false` where possible;
- avoid `shadowBlur` and text.

Applied to Basie [inference]:

- **Chunk cache:**
  - Fixed 8×8-cell chunks (800 px world).
  - One cached canvas per chunk per zoom band (full, and a ¼-scale band for the far view).
  - Built lazily, invalidated only by contamination or ownership changes.
- **Layers:**
  1. baked terrain chunks;
  2. borders and territory (re-baked on ownership change);
  3. POI sprites from one **atlas**;
  4. dynamic layer: marches, pulses, event overlays.
- **Shadows** are baked into sprites. Never use `ctx.filter` or `shadowBlur` per frame (matches the CLAUDE.md gotcha).
- **Culling:** use a spatial hash of POIs by chunk; draw only visible chunks plus a 1-chunk margin.

---

## 6. Content placement and generation

### 6.1 What Basie does today (from the code)

`js/entities/data/gridGen.js` and `worldGrid.js`:

- **Grid and density:** 96×96 cells, 9 sectors of 32×32. Each sector gets **8–14 filler POIs** plus its curated ones.
- **Placement:**
  - rejection sampling over hashed coordinates;
  - spacing **≥3 cells (Manhattan)** from each other and from curated cells;
  - a 2-cell edge margin;
  - water and ridge cells are excluded.
- **Classes and tiering:**
  - 40% camps (when the faction has an enemy pool), otherwise resource nodes;
  - uniform random resource type, with a 40% bias only toward an economic-buff region's resource;
  - every filler has `level = region tier`, so there is no gradient inside a region.
- **Respawn:** camps respawn in place after `respawnMs` (30 min). Nodes regenerate in place.

Problems [inference]:

- 3 cells is about 300 px in world space, but only about 20–25 px on screen at the far zoom, so the circles merge (screenshot
  04).
- There is no hierarchy, so every POI is visually equal.
- Nothing relates placement to terrain (water nodes away from water, camps away from roads).
- Uniform level means no "deeper is harder" inside a region.
- Fixed respawn spots make the map feel static.

### 6.2 How the genre distributes content

| Concern | Pattern | Source |
|---|---|---|
| Tier by distance | Tile and monster level rise toward the centre (Whiteout L1–5 / 6–7 / 8; Last Shelter L1–5 … 12–16) | [community] |
| Tier near home | RoK barbarians L1–12 can be spawned *near your city*; higher levels are spread kingdom-wide; levels unlock over the kingdom's first days | [wiki, older revision; community] |
| Density | Large outer zone so "resources are easy to find" (RoK zone 1) | [community] |
| Replacement | Whiteout added an "Alliance Bomb" that clears free nodes, beasts and Polar Terrors, which implies these respawn continuously in the wilderness | [official patch note via APKMirror] |
| Exclusion | Civ: no resources next to natural wonders; strategic resources outside start rings | [community, CivFanatics] |
| Satellite clusters | HoMM: each mine can be ringed by 0–3 loose resources of its type | [official] |
| Value-guarded | HoMM: guard size from treasure value; none below 2000; big guards kept off roads | [official] |
| Distance from centre | Songs of Conquest blueprints place objects by `distance` from the region centre and by `location` (near roads, edges) | [official] |
| Start fairness | HoMM: first Sawmill and Ore Pit within 12 tiles of the town; Civ VI: start-distance parameter | [official; community] |

Respawn timers for mobile resource tiles and monsters: **[not found]**. No source gave numbers.

### 6.3 Generation techniques

- **Poisson-disk (blue-noise) sampling:**
  - Points stay at least *r* apart but look natural.
  - Bridson's algorithm runs in O(N) with a background grid of cell size r/√2 and *k* (~30) candidates per active
    point [official paper; SciPy uses it as the default].
  - Use a **variable radius per class**: big for landmarks, small for nodes.
- **Jittered grid:** one point per coarse cell, offset randomly. It's cheaper and guarantees even coverage, but looks
  more regular than Poisson [memory, standard technique].
- **Rule-based scatter with constraints:** score every candidate cell and take the best, or a weighted pick. Example
  rules:
  - "water node within 2 cells of water";
  - "never on a road";
  - "camp within 3 cells of a road" (ambush);
  - "≥6 cells from the home city";
  - "not within 3 cells of a landmark".
- **Hand anchors plus procedural fill:**
  - Author the capital, landmark, passes and faction base per province.
  - Generate settlements and fill around them with Songs-of-Conquest-style blueprints [official].
- **Guarded-treasure patterns** [official, HoMM]:
  - mine + guard in front;
  - ruin behind a pass;
  - keyed gate (Border Guard ↔ Keymaster's Tent);
  - treasure cluster sharing one guard.
- **Determinism:** keep everything a pure function of `(seed, data)`, as `gridGen.js` already does, so generated ids
  stay stable and are never saved (ADR 0011).

### 6.4 Content hierarchy inside a region

A three-level structure, adapted from HoMM's value bands and the Total War capital and minor-settlement split
[inference from official and wiki sources]:

| Level | Count per province | Examples | Reads as |
|---|---|---|---|
| **Signature** | 1 landmark + 1 capital (may coincide) | Behemoth Spire, Reaver Fort | Illustrated sprite, clear space around it, named at every zoom |
| **Mid** | 2–4 | Settlements (ownable), ruin, watchtower, mine-with-satellites, faction war-camp slot | Sprite on plinth; level badge at mid zoom |
| **Small** | 6–12 | Resource nodes, roaming camps | Glyph only; shown at near zoom; clustered around mids |

To make a region tell a story [inference]:

- **Small nodes cluster around their mid POI.** A "Grain Fields" settlement is ringed by food nodes, the way a HoMM mine
  carries its satellite resources. Ownership of the settlement then explains *why* those nodes matter.
- **Content follows the biome and the faction:**
  - Red Talon provinces have raider camps along the roads and burnt ruins;
  - Covenant provinces have ordered depots and wall segments.
- **A gradient from the entry pass toward the capital:** easier near the pass you came through, harder near the capital.

### 6.5 Resource bias per biome

A starting table [inference]. Weights are relative.

| Biome | wood | stone | iron | food | water |
|---|---|---|---|---|---|
| Forest / Ashwood | 5 | 1 | 1 | 2 | 1 |
| Ridge / Spire | 1 | 4 | 4 | 1 | 0 |
| Lowlands / fields | 1 | 1 | 1 | 5 | 2 |
| Frost / salt flats | 0 | 2 | 2 | 1 | 5 |
| Wasteland / rubble | 1 | 3 | 3 | 1 | 1 |

---

## 7. Synthesis for Basie

### 7.1 Constraints recap

- **Single player.** AI factions provide all the pressure.
- **Factions** need:
  - home bases visible through fog;
  - war camps *on their own border*;
  - visible marches with an intercept point;
  - walls per defended unit;
  - rebels growing camp → settlement → stronghold → region;
  - a loss cascade (ADR 0055).
- **Events** need anchors:
  - storm cells over a route;
  - a herd migration route;
  - supply-drop spots;
  - contamination spreading across *cells*;
  - a boss lair.
- **Built to extend.** Provinces, settlements, connections, biomes and slot kinds grow by data appends. No code assumes
  9, 3×3 or 32.
- **Art budget.** Bake, scatter, kit-bash.
- **Saves.** Ids are save keys, but there are no legacy saves to keep (no-legacy-compat rule).

### 7.2 Options

**Option A: Keep the 9 rectangles and dress them.**

- Same sectors and ids.
- Paint natural borders (a river or ridge band) along the seams with 1–2 pass gaps each.
- Add semantic zoom, sketch fog and the §6 placement rules inside the rectangles.

| + | − |
|---|---|
| Least code; zero save-model change | Still a 3×3 grid, and organic dressing on straight seams looks fake |
| Ships fast | Whole-region ownership stays; war camps and rebels have no finer target; cascade stays brutal |
| | Adding a 10th region breaks the 3×3 tessellation, which conflicts with "Built to extend" |

**Option B: Provinces with settlements, joined by a connection graph (recommended).**

- **Provinces:**
  - About 12 hand-placed province seeds; cells assigned by noisy Voronoi.
  - Borders snap to rivers and ridges where the seed layout allows.
  - Each province has `biome`, `tier`, a `landmark` and a `capitalId`.
- **Connections** are data: `{ from, to, kind: road|pass|gate|wide, guard?, keyPoiId? }`. Marches route over this graph.
- **Settlements:**
  - 2–4 per province plus the capital.
  - They are the unit of capture, walls, rebel takeover and AI targeting.
  - Holding all of them gives the province buff (the Total War commandment pattern).
  - Holding the capital gives the name and the unlock of onward connections.
- **Small content** (nodes, camps) is generated around settlements per §6, each tied to a `settlementId`.

| + | − |
|---|---|
| Matches the faction design: war camp slots sit on *pass* cells of the faction's own border; intercept happens on a connection | Bigger rework: `worldGrid.js` sector math, `regionAt`, the renderer region drawing and the unlock chain all change |
| Losing a settlement is a local setback; the cascade can apply only when the *capital* falls | Two ownership levels to explain (semantic zoom carries it) |
| Data appends: a new province means a seed, entries and connections; the guard test is a synthetic 13th province | Organic polygons need a label anchor and hit-test (cell → province lookup table, cheap) |
| Natural borders and passes give the map identity | |

**Option C: Northgard-style sectors only.**

- About 40–60 small sectors, each owned individually.
- "Regions" are only named groups for buffs and labels.

| + | − |
|---|---|
| Very fine progress, Northgard-proven readability | Many ids, many fights; the AI must reason about 50 targets |
| Contamination per sector is natural | Weak province identity; more UI per sector; more art per sector |

**Option D: Route-node map (Kingdom Rush / Slay the Spire style).**

- The map is a graph of nodes on a painted backdrop. Marches go node to node.

| + | − |
|---|---|
| Cheapest art (one painted backdrop per era); crystal-clear progression | Loses the open-field march, area events and the "living world" feel the faction design depends on |

### 7.3 Recommendation

**Option B.** The faction and events design already assumes a finer grain than whole regions:

- war camps on borders;
- intercepts on roads;
- walls;
- rebels that grow and take ground;
- events that move along routes.

Total War's capital plus minor settlements and HoMM's guarded connection graph are both proven, data-driven and
readable. Two of Option A's pieces — natural-border dressing and the placement rules — can land first, inside the
current rectangles, and then be ported. That is a natural slicing [inference].

**What it means for the save and id model:**

- Province ids can reuse the current region ids where the province plays the same role (`home_vale`, `red_lowlands`,
  `command_ruin`, …). The extra provinces get new ids.
- Since there are no legacy saves, rename or split freely. Still keep `regionOwner` → `provinceOwner` derived from
  settlement owners rather than stored twice. One source of truth is settlement ownership, and the province owner is
  computed.
- New save fields:
  - `settlementOwner`;
  - per-settlement `walls`;
  - dynamic `slotOccupant` (rebels, war camps, events).
- Each needs seed and reconcile coverage in `worldState.js` (CLAUDE.md gotcha).
- Generated nodes and camps stay unsaved, with ids derived from `(seed, settlementId, index)` as today.
- `captureRegion` hard-codes `'player'` (ai-factions.md). In B it becomes `setSettlementOwner(id, owner)`, which emits
  `world:settlementCaptured/Lost`, with the province events derived from those.

### 7.4 Placement and generation rules for Basie (concrete starting values)

All numbers are **[placeholder, untested]**. They live in a data config (`worldGenRules.js` or similar), never in code.

**Scale.** 96×96 = 9,216 cells. Twelve provinces average about 770 cells, roughly a 28×28 patch.

**Density per province:**

| Class | Count | Notes |
|---|---|---|
| Capital | 1 | Authored |
| Landmark | 1 | Authored; may be the capital |
| Settlements | 2–4 | Authored seeds; scaled by province area (`round(area / 250)`, clamped) |
| Mid POIs (ruin, watchtower, outpost, mine) | 2–3 | Generated from the province blueprint |
| Resource nodes | 6–10 | 2–3 per settlement cluster, plus 1–2 loose |
| Camps (roaming) | 2–4 | Faction provinces only; tier-scaled |
| **Total visible at near zoom** | **~14–22** | About the same as today, but tiered and clustered |

**Spacing.** Poisson-disk radius by class, measured centre to centre in cells (Euclidean):

| Pair | Min distance |
|---|---|
| Signature ↔ anything | 6 (clear ring) |
| Settlement ↔ settlement | 7 |
| Mid ↔ mid or settlement | 5 |
| Small ↔ small | 3 |
| Small ↔ its own settlement | 2–4 (cluster ring) |
| Anything ↔ province border | 2 |
| Anything ↔ road centreline | 1 (nodes never on a road) |
| Camp ↔ road | ≤3 preferred (ambush flavour) |
| Anything ↔ home city | 4 |

Screen-space collision runs on top of this. At each zoom band, draw in priority order (threat > base > capital >
settlement > mid > small) and skip or count-chip anything that overlaps. This fixes the far-zoom clumping regardless of
world spacing.

**Tiering:**

- `poiLevel = province.tier + gradient`, where `gradient` = 0 near the entry connection and +1 (or +2 at tier ≥4) near
  the capital. Distance is measured along the province's interior.
- Province tier stays the ring number from home (1) to the Command Ruin (max). Read `max` from data.
- Settlement walls scale with tier. The capital gets ×1.5 [placeholder].

**Resource bias.** Use the §6.5 weights by the settlement's local biome. Water nodes need a water cell within 2 cells,
and wood nodes need forest within 2.

**Guards (HoMM pattern):**

- Mid POIs worth more than a threshold get a guard camp placed between them and the nearest road.
- Pass connections get a guard whose level is the destination province tier.
- A guard over the road-block threshold is never placed *on* the road, so the frontier stays walkable.

**Respawn:**

| Content | Rule |
|---|---|
| Resource node | Regenerates in place (today). When fully depleted, it relocates after 30–60 min to a free node slot **in the same settlement cluster**. Ids stay derived from `(slot, generation)` |
| Roaming camp | Respawns after `respawnMs` at a **different** free camp slot in the same province. Level = province band, nudged by player power within ±1 (RoK-style "near your level", capped by tier) |
| Guards | Do not respawn once beaten (one-time unlock, like HoMM) |
| Faction-held settlements | Never "respawn"; changed only by the faction brain |

**Slots for dynamic entities.** Precompute these deterministically at load from seed and data, and never save them:

- `rebelSlots`: 2–3 per neutral or frontier province; ≥6 cells from any settlement; not on roads; prefer forest or
  rubble.
- `warCampSlots`: 1–2 per faction province *per outgoing connection*, on the faction's side of the pass, within 4 cells
  of it.
- `eventSlots`:
  - supply-drop slots, open ground ≥4 cells from POIs;
  - herd-route waypoints, off-road, crossing 2–3 provinces;
  - storm-cell centres on roads or passes;
  - contamination seeds next to ruins.
- `bossLair`: authored.

At runtime a spawner scores the free slots of a kind (distance to the target, threat budget, not visible-and-empty) and
takes one. Save only `{ slotId, occupant }`. Contamination spreads cell to cell inside its province using the same
terrain rules, and cleared cells return to normal.

**Built to extend.** A province, settlement, connection, biome row, blueprint or slot kind is a data entry. Guard tests:

- a synthetic 13th province;
- a 5th settlement in a province;
- a new slot kind;
- generation stays deterministic, and every POI satisfies the spacing table.

---

## Sources

Mobile 4X
- Rise of Kingdoms zones guide (zone counts, pass level 2): https://riseofkingdomsguides.com/rise-of-kingdoms-zones-guide/
- Rise of Kingdoms map guide: https://riseofkingdomsguides.com/rise-of-kingdoms-map-guide/
- RoK Holy Sites (wiki, via search): https://riseofkingdoms.fandom.com/wiki/Holy_Sites
- RoK Territory (flags must touch territory; attack only touching): https://riseofkingdoms.fandom.com/wiki/Territory
- RoK alliance territory guide: https://riseofkingdomsguides.com/rise-of-kingdoms-alliance-territory-guide/
- RoK barbarians (spawn near city, level unlocks): https://riseofkingdoms.fandom.com/wiki/Barbarians?oldid=9546 ;
  https://riseofkingdomsguides.com/rise-of-kingdoms-barbarians-and-barbarian-forts/
- RoK "Seamless World Map", "infinite zoom" (Lilith press release): https://www.uberstrategist.com/press-release/rise-of-kingdoms-lilith-games
- RoK passes and natural barriers, Lost Kingdom central province: https://www.pocketgamer.com/rise-of-kingdoms/kvk-guide/ ;
  https://riseofkingdomsguides.com/rise-of-kingdoms-1-0-90-return-of-the-king-update/
- Legou Games environment concept artist posting ("head map … resource map"): https://www.aswift.com/job/senior-environment-concept-artist
- Whiteout Survival map guide (Icefield/Tundra/centre tile levels): https://heaven-guardian.com/whiteout-survival-map-guide/
- Whiteout alliance guide (banners 7×7, connect): https://www.bluestacks.com/blog/game-guides/white-out-survival/wos-alliance-guide-en.html
- Whiteout expedition facilities: https://wostools.net/wiki/facilities
- Whiteout Winter Siege (12 fortresses + 4 strongholds): https://topuplist.com/blogs/detail/whiteout-survival-winter-siege-guide
- Whiteout Sunfire Castle turrets: https://wostools.net/sunfire-castle-battle ; https://theriagames.com/?p=14875
- Whiteout 1.22.19 notes (Alliance Bomb clears nodes/beasts): https://apkmirror.com/apk/century-games-pte-ltd/whiteout-survival/whiteout-survival-1-22-19-release
- Last Shelter state map plot rings: https://www.appgamer.com/last-shelter-survival/answers/7376-where-is-the-best-place-to-place-bu ;
  https://www.appgamer.com/last-shelter-survival/answers/15303-no-adjacent-territory-cannot-occupy ;
  https://www.appgamer.com/last-shelter-survival/answers/7494-how-many-plots-can-rally-point-occu
- Last Shelter presidency / Launch Center: https://www.appgamer.com/last-shelter-survival/answers/7271-how-does-one-become-president-of-th
- State of Survival capital and governor: https://www.mrguider.org/articles/state-of-survival-governor-guide-for-beginners/ ;
  https://www.touchtapplay.com/state-of-survival-capital-clash-event-guide/ ; https://state-of-survival.fandom.com/wiki/Alliance
- Lords Mobile kingdom (wiki via search): https://lordsmobile.fandom.com/wiki/Kingdom ; https://earlyguides.com/lords-mobile/maps
- Evony City of Throne: https://www.bluestacks.com/blog/game-guides/evony-the-kings-return/etkr-combat-guide-en.html
- Age of Empires Mobile siege / weather: https://gamespress.westeu-v2.propressroom.com/Age-of-Empires-Mobile-Showcases-Siege-Multiplayer-Gameplay-in-Final-Tr ;
  https://unbox.ph/news/age-of-empires-mobile-global-launch/

Single-player strategy
- Northgard colonisation cost and building caps: https://pcgamer.com/northgard-review ;
  https://www.bit-tech.net/reviews/gaming/pc/northgard-review/1/ ;
  https://www.gameskinny.com/tips/northgard-guide-tips-and-tricks-for-getting-started-with-your-first-settlement/ ;
  https://northgard.fandom.com/wiki/Fenrir?oldid=411
- Civ VI fog as cartography: https://digitaltrends.com/gaming/art-civilization-vi ;
  https://www.gamepressure.com/editorials/civilization-vi-hands-on-dont-judge-a-game-by-its-promo-screens/z3ba
- Civ VI borders and tile purchase: https://cyberpost.co/how-many-tiles-away-from-a-city-can-you-buy-civ-6/ ;
  https://civilization.fandom.com/wiki/Culture_Bomb_(Civ6)
- Civ VI resource placement / start distance (CivFanatics): https://forums.civfanatics.com/threads/inherit-current-map-remove-add-resources.619726 ;
  https://forums.civfanatics.com/threads/assignstartingplots-defaults-for-vp.662444/
- Total War provinces and settlements: https://academy.totalwar.com/?p=118 ; https://academy.totalwar.com/?p=251 ;
  https://totalwarwarhammer.gamepedia.com/File:Icon_Marker_Settlement.png ; https://www.totalwar.com/?p=15524
- Heroes III HotA template format: https://h3hota.com/en/template-format
- Songs of Conquest RMG modding: https://songsofconquest.com/modding/rmg
- Heroes Olden Era community templates: https://steamcommunity.com/app/3105440/discussions/0/670600125430830425/
- Frostpunk 2 Frostland: https://twinfinite.net/guides/frostpunk-2-frostland-exploration-explained/ ;
  https://sportskeeda.com/esports/all-outposts-resource-deposits-frostlands-frostpunk-2 ;
  https://primagames.com/gaming/frostpunk-2-chapter-1-guide-how-to-find-a-permanent-source-of-fuel-and-transfer-oil
- They Are Billions campaign map: https://numantiangames.com/News/2019-04-02-they-are-billions-update-campaign-development-iii/ ;
  https://gamerwalkthroughs.com/they-are-billions/
- Kingdom Rush map: https://kingdomrushtd.fandom.com/wiki/Kingdom_Rush ; https://blog.popey.com/2021/01/kingdom-rush/
- Bad North / Townscaper (Stålberg): https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making ;
  https://www.pockettactics.com/bad-north/review
- Slay the Spire map generation: https://slaythespire.wiki.gg/wiki/Map_Generation
- FTL sectors and navigation: https://en.wikipedia.org/wiki/FTL:_Faster_Than_Light ;
  https://subsetgames.com/forum/viewtopic.php?p=76713
- EU IV dev diary 1 (map, borders): https://forum.paradoxplaza.com/forum/threads/europa-universalis-iv-developer-diary-1-the-world-is-at-your-feet.631266/

Readability, art, generation, performance
- Mapbox label collision: https://github.com/mapbox/mapbox-gl-native/wiki/Collision-Detection ;
  https://docs.mapbox.com/help/dive-deeper/optimize-map-label-placement.md
- Mapbox polylabel (pole of inaccessibility) [memory]: https://github.com/mapbox/polylabel
- Label placement patent (coarse-to-fine): https://patents.google.com/patent/US6724392
- Boris the Brave, classification of tilesets: https://www.boristhebrave.com/2021/11/14/classification-of-tilesets/
- Blob tileset (cr31 mirror): https://boristhebrave.com/permanent/24/06/cr31/stagecast/wang/blob.html
- Dual grid (5 tiles, Stålberg attribution): https://giantgrey.gitbook.io/tileworldcreator-v4-documentation/dual-and-standard-grid
- Marching squares / corner Wang: https://www.boristhebrave.com/docs/sylves/1/articles/tutorials/marching_squares.html
- Texture splatting: https://en.wikipedia.org/wiki/Texture_splatting
- Red Blob mapgen2 (Delaunay/Voronoi): https://www.redblobgames.com/maps/mapgen2/
- Polygon map generation [memory]: http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/
- Bridson, Fast Poisson Disk Sampling (SIGGRAPH 2007): https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf
- SciPy PoissonDisk: https://docs.scipy.org/doc/scipy-1.14.1/reference/generated/scipy.stats.qmc.PoissonDisk.html
- MDN, Optimizing canvas: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- Blender isometric/orthographic tiles: https://gamefromscratch.com/creating-isometric-tiles-in-blender/ ;
  https://gamefromscratch.com/creating-orthographic-tiles-in-blender/ ;
  https://wiki.blender.jp/Extensions:2.6/Py/Scripts/Add_Mesh/Create_IsoCam ;
  https://opengameart.org/content/isometric-sprite-rendering-scene
- AI texture tools comparison: https://app.cinevva.com/guides/ai-texture-generators ;
  https://www.scenario.com/models/sdxl-for-textures ; https://layer.ai/tools/layer--tileable-texture

Basie code read for §6.1: `js/entities/data/gridGen.js`, `js/entities/data/worldGrid.js`, `js/entities/data/worldMap.js`.
