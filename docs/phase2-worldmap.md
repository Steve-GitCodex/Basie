# Phase 2 — World Map & March System (Design Spec)

Status: **design complete, ready for implementation.** Single-player. No build step (vanilla ES6).

## 1. Locked decisions

- **Map model — hybrid.** A bounded **top-down** coordinate field (real `x,y` → distance-based travel) dotted with **curated POIs** grouped into **regions**, over a soft terrain layer (visuals/fog, not strict hex). Marches use free 2D positions.
- **Rendering — top-down 2D** (base view stays iso). Reuse the *projection-agnostic* camera/culling/hit-test patterns proven in `js/ui/city/`; only the projection differs.
- **Multiplayer — none here.** The world map is the player's own space. PvP/co-op live only in the future **Arena**.
- **Marches — timed**, driven by a **marching speed** stat (distance ÷ army speed). Speed is modifiable by heroes, tech, region buffs, and outposts (later).
- **Combat fit — parallel layer.** The menu campaign (`combat.js`, `CombatManager`) is untouched. The map adds **gather** marches (→ resources) and **attack** marches (→ reuse `_simulateBattle`). A future **Arena** eventually replaces campaign combat.
- **An army is a squad.** Marches dispatch an existing `UnitManager` squad. March slots = how many squads can be out at once.

## 2. POI & region taxonomy

Every POI shares an anatomy: `interaction` (gather/attack/scout/capture/passive) · `lifecycle` (one-time/respawning/persistent) · `garrison` (none/fixed/scaling) · `yield` (resources/loot/buff/territory/intel) · `gating` (fog/prereqs).

| Type | March | Garrison | Lifecycle | Yields | MVP? |
|---|---|---|---|---|---|
| **Resource node** | gather | none | respawning/depletable | resources over time | ✅ |
| **Camp** | attack | fixed force | respawning (cooldown) | loot, repeatable | ✅ |
| **Stronghold** | attack→capture | heavy | one-time flip | **region control** | ✅ |
| **Ruin/dungeon** | scout→expedition | light/none | one-time | buff/item/lore | ⏳ fast-follow |
| **World boss** | attack | elite | windowed | rare loot (Arena teaser) | ⏳ fast-follow |
| **Outpost/shrine/watchtower** | capture/scout | light/none | persistent | shorter marches / buff / fog reveal | ⏳ later |

**Regions** group POIs under a **faction** owner. Capturing a region's **stronghold** flips it to the player and activates its **signature buff**. Each faction has *one signature buff flavor* so each conquest feels different:
- economic (`+x% of a resource from in-region nodes`),
- military (`+x% troop attack/def in in-region battles`),
- logistic (`-x% march time within the region`).

**Factions** (`neutral`, `goblins`, `bandits`, … reusing `MONSTERS_CONFIG` themes) define enemy types per region and seed Phase 4 AI opponents.

## 3. Data — `js/entities/data/worldMap.js`

Declarative & immutable (copy-before-mutate), aggregated into `GAME_DATA.js` like `cityBlueprint.js`.

```js
export const WORLD_MAP = {
  bounds: { w: 3600, h: 2600 },                 // world px (top-down)
  home:   { x: 1800, y: 1300 },                 // player city POI anchor
  factions: {
    neutral: { id:'neutral', name:'Wildlands', color:'#7f8c8d' },
    goblins: { id:'goblins', name:'Goblin Clans', color:'#6ab04c', enemyTypes:['goblin_camp'] },
    bandits: { id:'bandits', name:'Bandit Coalition', color:'#c0392b', enemyTypes:['bandit_camp'] },
  },
  regions: [
    { id:'home_valley', name:'Home Valley', factionId:'neutral',
      center:{x:1800,y:1300}, radius:520, strongholdId:null, buff:null, requires:null },
    { id:'green_marches', name:'The Green Marches', factionId:'goblins',
      center:{x:1050,y:850}, radius:560, strongholdId:'goblin_keep',
      buff:{ flavor:'economic', resource:'wood', pct:0.10 }, requires:null },
    { id:'red_coast', name:'Red Coast', factionId:'bandits',
      center:{x:2650,y:1750}, radius:600, strongholdId:'bandit_fort',
      buff:{ flavor:'logistic', pct:0.15 }, requires:{ region:'green_marches' } },
  ],
  pois: [
    { id:'home_city', type:'city', regionId:'home_valley', name:'Your City',
      x:1800, y:1300, icon:'🏰' },
    // resource nodes
    { id:'oak_forest', type:'resource_node', regionId:'home_valley', name:'Oak Forest',
      x:1500, y:1050, icon:'🌲', resource:'wood', gatherRate:6, capacity:1200, regenPerSec:2 },
    { id:'iron_vein', type:'resource_node', regionId:'green_marches', name:'Iron Vein',
      x:1150, y:1080, icon:'⛏️', resource:'iron', gatherRate:4, capacity:800, regenPerSec:1 },
    // camps (reference MONSTERS_CONFIG or inline waves)
    { id:'goblin_camp_1', type:'camp', regionId:'green_marches', name:'Goblin Camp',
      x:900, y:1000, icon:'👺', monsterId:'goblin_camp', respawnMs:1800000 },
    // strongholds
    { id:'goblin_keep', type:'stronghold', regionId:'green_marches', name:'Goblin Keep',
      x:1050, y:650, icon:'🏯', monsterId:'orc_warband', capturesRegion:'green_marches' },
    { id:'bandit_fort', type:'stronghold', regionId:'red_coast', name:'Bandit Fort',
      x:2650, y:1500, icon:'🏯', monsterId:'troll_bridge', capturesRegion:'red_coast' },
  ],
};
```

POI runtime state is **save state**, not data (mirrors `BuildingManager._placements`): cleared/respawn timers, node remaining/regen, discovery, region ownership — all in `WorldMapManager`.

## 3.5 Module decomposition (no god modules)

Match the base-redesign precedent (`js/systems/building/`, `js/ui/city/`, `js/ui/buildings/`). Managers **orchestrate**; pure math and type-strategies live in sibling helpers; each UI surface is its own file.

```
js/systems/world/  WorldMapManager (orchestrator) · worldState (seeding) · regionBuffs (pure) · nodeEconomy (pure)
js/systems/march/  MarchManager (orchestrator) · marchMath (pure) · marchRules (pure validation) · marchResolver (gather|attack|scout strategies)
js/ui/world/       WorldRenderer (loop+input) · WorldCamera · worldProjection (pure+hit-test) · worldLayout (derive geometry) · worldAssets
                   PoiDetailPanel · MarchDispatchSheet · MarchPanel   (sibling UI surfaces)
js/ui/controllers/ WorldMapUI (thin controller; owns renderer, routes events)
```

Boundary rules: (1) no math in managers — `marchMath`/`regionBuffs`/`nodeEconomy` are pure & stateless; (2) `MarchManager.update()` delegates per-type work to `marchResolver`, never a growing switch; (3) one UI surface per file; (4) the renderer reads a synced snapshot (`syncState()` like `CityRenderer`), never owns game state.

## 4. Systems

### `WorldMapManager` (`js/systems/WorldMapManager.js`)
Owns map runtime state. `{ name:'worldMap', update(dt), serialize(), deserialize() }`.
- **State:** `_poiState: Map<poiId,{ remaining, clearedAt, respawnAt, discovered }>`, `_regionOwner: Map<regionId,'player'|factionId>`, seeded from `WORLD_MAP` on new game (an `_ensureState()` like `_ensurePlacements()`).
- **update(dt):** advance camp respawn timers (`respawnAt` → mark available, emit `world:poiChanged`); regen depletable nodes (`remaining = min(capacity, remaining + regenPerSec·dt)`).
- **API:** `getPOI(id)`, `getRegion(id)`, `isPlayerOwned(regionId)`, `takeFromNode(poiId, amount)→granted`, `markCampCleared(poiId)`, `captureRegion(regionId)` (sets owner, emits `world:regionCaptured`), `activeBuffs()→[{flavor,…}]`.
- **Emits:** `world:poiChanged`, `world:regionCaptured`, `world:ready`.

### `MarchManager` (`js/systems/MarchManager.js`)
Owns armies-in-transit. Constructor-injected refs (matches `CombatManager` style): `(unitManager, combatManager, resourceManager, worldMapManager, heroManager, userManager)`.
- **State:** `_marches: March[]`, `_slots:number` (from Rally Point building / HQ level).
- **March:** `{ id, type:'gather'|'attack'|'scout', squadId, targetPoiId, departAt, arriveAt, phase:'outbound'|'acting'|'returning', returnAt, payload:{}, distance, speed }`.
- **Speed:** `armySpeed(squadId)` = slowest unit speed × hero/tech/region-logistic multipliers (units gain a `speed` stat; default 1.0 = e.g. 120 px/s). `time = distance / speed`.
- **dispatch({type, targetPoiId, squadId}):** validate (slot free, squad non-empty & home, target valid/discovered); compute `distance` (hypot home↔POI) & times; mark squad deployed (`unitManager.setSquadDeployed(squadId,true)`); push march; emit `march:dispatched`.
- **update(dt):** drive phase transitions:
  - `outbound`→arrive: resolve by type (below), set `phase`/`returnAt`, emit `march:arrived`.
  - `returning`→done: `unitManager.setSquadDeployed(squadId,false)`; credit `payload` via `resourceManager.add(payload)`; apply post-battle losses already removed at arrival; emit `march:completed`; drop march.
- **Arrival resolution (synchronous):**
  - **gather:** `granted = worldMapManager.takeFromNode(poi.id, capacityForSquad)`; `payload = { [poi.resource]: granted }`; brief on-site dwell then return.
  - **attack/stronghold:** `result = combatManager.resolveMarchBattle(squadId, poi.monsterId)`; on win → `payload = result.loot`; `worldMapManager.markCampCleared(poi.id)` and, if stronghold, `worldMapManager.captureRegion(poi.capturesRegion)`. Losses applied to squad by CombatManager. Return either way.
- **Emits:** `march:dispatched`, `march:arrived`, `march:completed`, `march:failed`.
- **Serialize:** the `_marches` array + `_slots` (timestamps are absolute epoch ms → resume correctly after reload).

### Integration touch-points (existing code)
- **`CombatManager`** — add `resolveMarchBattle(squadId, monsterId) → { victory, losses, survivors, loot }`: thin wrapper over `_simulateBattle(getSquad(squadId).units, MONSTERS_CONFIG[monsterId])`, applies `removeUnitsFromSquad`, returns loot scaled like `attack()`. Does **not** touch campaign victory counts/mail.
- **`UnitManager`** — add `deployed` flag per squad + `setSquadDeployed(id,bool)` and `isSquadAvailable(id)`; add a `speed` stat to unit tier configs (default if absent). Deployed squads are excluded from campaign attacks/defense.
- **`ResourceManager`** — reuse `add(rewards)` for gather/loot payloads (already sandbox-aware).
- **Region buffs** — `ResourceManager` listens to `world:regionCaptured`/applies economic buffs to rates; `MarchManager.armySpeed` reads `worldMapManager.activeBuffs()` for logistic; `CombatManager.resolveMarchBattle` reads them for military.

## 5. Rendering & UI (`js/ui/world/`, `WorldMapUI`)

- **`worldProjection.js`** — top-down math: `worldToScreen`, `screenToWorld`, `hitTestPOI(wx,wy)` (nearest POI within marker radius), `hitTestRegion`. (Trivial vs iso.)
- **`WorldCamera.js`** — pan/zoom/clamp-to-`bounds` + cover floor + cull rect. Port the structure of `CityCamera` with the identity-ish top-down projection.
- **`WorldRenderer.js`** — rAF render-only loop. Layers: terrain/biome tint per region → region borders + ownership shading → roads/paths (optional) → POI markers (icon + faction ring + label, fog-dimmed if undiscovered) → **active march arcs** (quadratic curve home↔target with a moving army token at progress `t`) → selection highlight. Reuse culling + hit-testing patterns.
- **DOM** — `#view-world` with `#world-canvas`, `#world-loading`, `#world-poi-panel` (slide-up POI detail = gather/attack actions), `#march-dispatch-sheet` (squad picker + ETA preview), `#march-panel` (active marches list with countdowns via `TimerService`).
- **`WorldMapUI` (`js/ui/controllers/`)** — read-only presenter. Flow: click POI → `world:poiSelected` → detail panel → "Send army" → dispatch sheet → `ui:dispatchMarch` → `MarchManager`. Re-renders on `march:*` and `world:*`. Reuses `uiUtils` (`fmt`, modals).

## 6. Wiring

- **`navigation.js`** — `world: { type:'building', buildingId:'rallypoint', label:'Build a Rally Point' }`; `BUILDING_TAB_MAP.rallypoint = 'world'`.
- **`buildings.js`** — new **Rally Point** building: unlocks the World tab and provides march slots (more slots / +speed per level). (Consistent with heroquarters→heroes, workshop→research.)
- **`main.js`** — instantiate `WorldMapManager` then `MarchManager` (after Resource/Unit/Combat/Hero/User managers; before UI). Register both as engine systems. Add to save/load state.
- **`UIManager.js`** — bootstrap `WorldMapUI` (controllers 16 → **17**).
- **`index.html`** — `#view-world` section + nav button `#nav-world` (`data-view="world"`); world CSS file.
- **`CLAUDE.md`** — update manager count 19→**21**, UI count 16→**17**, add a "World map" architecture note + gotchas (POI state is save state, like placements).

## 7. Core loop

gather nodes → fund armies → farm camps for loot → clear a region's **stronghold** → **own region + signature buff** → push into the next faction's territory, stronger and richer. Marching speed + distance make *where* you expand a real decision.

## 8. MVP scope

**In:** `worldMap.js` (home valley + 2 faction regions, ~2 nodes / 1 camp / 1 stronghold each), `WorldMapManager`, `MarchManager` (gather + attack, timed, slots), Rally Point building + tab, top-down renderer + camera, `WorldMapUI` (POI detail, dispatch sheet, march panel), `resolveMarchBattle`, squad-deploy locking, economic + logistic region buffs.

**Deferred (architecture-ready, not built):** ruins, world bosses (Arena teasers), outposts/shrines/watchtowers, fog-of-war, multi-base, the **Arena** (PvP/co-op/ranks/alliances — its own future pillar), Phase 4 AI factions, Phase 5 map events.

## 9. Build order (each step independently verifiable)

0. **Data + building + nav** — `worldMap.js`, `GAME_DATA` aggregate, Rally Point building, `world` tab gate.
1. **Managers (no UI)** — `WorldMapManager` + `MarchManager`, `main.js` wiring + save/load; verify via console/EventBus (`logManager`).
2. **Combat/economy seams** — `resolveMarchBattle`, unit speed + deploy-lock, gather crediting, region-buff application.
3. **Renderer + view** — `worldProjection`, `WorldCamera`, `WorldRenderer`, `#view-world` DOM/CSS/nav.
4. **UI controller** — `WorldMapUI`: POI detail, dispatch sheet, march panel; reactive re-render.
5. **Verify** — Playwright (reuse `basie-verify` harness): dispatch a gather march → travel/return/credit; attack a camp → battle + clear + respawn; capture a stronghold → region buff active.
6. **Docs** — update `CLAUDE.md` counts/notes + memory.
