# AI factions and world events: current codebase map

Research input for `FactionManager` (`js/systems/faction/`) and `WorldEventManager` (`js/systems/worldEvents/`, replacing
`EventManager`). Written 2026-10-09 from code only; the working tree has uncommitted changes (modified at snapshot include
`ResourceManager.js`, `BuildingManager.js`, `UIManager.js`, `navigation.js`, `combat.js`, `units.js`; none of the world,
march, combat-resolver, mail or event system files). Not a design lock. Paths are repo-relative. "Not present" means
grepped and absent in `js/`.

## 1. World seam (`js/systems/world/*`, `js/entities/data/worldMap.js`)

### Data
- `WORLD_MAP = { bounds, home, factions, regions, pois }` (`worldMap.js:204-210`). `factions` has three entries:
  `neutral`, `goblins` ("Scavenger Packs"), `bandits` ("Red Talon Raiders") with `{ id, name, tag, color, enemyTypes }`
  (`:62-66`). No faction has a home base, level, standing or behaviour field.
- 9 regions tessellate a 96x96 cell grid, 32x32 cells per sector (`worldGrid.js:12-13`, `SECTOR_OF` `:27-37`). Region
  fields: `id, name, factionId, startOwner, tier, strongholdId, buff, requires, isCommandCenter` plus derived `rect`,
  `center` (`:68-131`, `placeRegion` `:191`).
- `factionId` is static map data. Consumers of it: filler camp generation (`gridGen.js:172`, picks `enemyTypes`), region
  label colour and POI ring/`[TAG]` (`WorldRenderer.js:243,288,321`), grid tint (`gridLayer.js:176`), legend
  (`WorldMapUI.js:100-104`). It is never compared to `regionOwner`.
- Curated POIs sit in `CURATED_CELLS` (`worldGrid.js:39-74`); `placeCuratedPoi` throws if a curated POI has no cell
  (`worldMap.js:195-199`). Filler POIs come from `generateFillerPois` (pure function of seed `WORLD_SEED = 0x5ba51e`,
  `gridGen.js:168`), ids `gen_<region>_<n>`, never serialized (header `gridGen.js:4-5`).
- POI types: `city, resource_node, camp, stronghold, ruin, outpost, world_boss` (`worldMap.js:26`). There is no
  faction-base type. `home_city` (cell 16,80) is the only `city` POI and `WORLD_MAP.home` (`:206`) is a single point.

### Ownership
- `WorldMapManager` holds `_regionOwner` (region id to `'player' | factionId | 'neutral'`), `_outpostOwner` (same, outposts
  only), `_poiState`, `_discovered` Set, `_timedBuffs` (`WorldMapManager.js:21-29`). ADR 0005 states owner is a free string and
  consumers "must compare against 'player' explicitly".
- Region start owners: home `player`, `west_warrens/mistwood/goblin_crest` `goblins`, `red_lowlands/frost_hold/ember_reach`
  `bandits`, `dragon_spire/command_ruin` `neutral` (`worldMap.js:68-131`). Outposts default to `'neutral'`
  (`worldState.js:35`).
- The only writers: `captureRegion(regionId)` sets owner to the literal `'player'` (`WorldMapManager.js:235-241`) and
  emits `world:regionCaptured { regionId, buff }` + `world:buffsChanged`; `captureOutpost(poiId)` sets `'player'`
  (`:206-214`) and emits `world:outpostCaptured { poiId, boon }`. Both early-return if already `'player'`. Neither takes
  an owner argument; no `setRegionOwner`/`loseRegion` exists.
- Capture is triggered only from `marchResolver._attack` when a stronghold POI with `capturesRegion` is beaten
  (`marchResolver.js:60-62`) and `_capture` for outposts (`:138`).
- Region lock: `regionLock(id)` is derived from `requires` against `_regionOwner[x] === 'player'`
  (`WorldMapManager.js:126-135`). Fog: `isDiscovered` is true for the city, for POIs in unlocked regions, or if in
  `_discovered` (`:143-149`). Losing a required region re-locks and re-fogs everything behind it (a derived read, no stored
  flag). `home_vale` is required by `west_warrens` and `red_lowlands`; the ruin requires four regions (`worldMap.js:129`).

### Where ownership is read (all `=== 'player'` or `isPlayerOwned`)
`regionBuffs.js:15` (buffs only count player-owned regions), `WorldMapManager.js:68,113,118,131,181,207,236`,
`marchResolver.js:128`, `WorldMapUI.js:103,179,180`, `gridLayer.js:175,191`, `WorldRenderer.js:241,289,290,398`.
`tests/browser/world-smoke.mjs:26-27` asserts `isPlayerOwned('home_vale')` and not owned for `red_lowlands`.

### Region buffs, boss, nodes
- `activeBuffs(regionOwner, WORLD_MAP)` filters regions with `buff` and owner `'player'` (`regionBuffs.js:83-87`);
  `WorldMapManager.activeBuffs()` merges region buffs, held-outpost boons and unexpired `_timedBuffs` (`:177-184`).
  Consumers re-pull on `world:buffsChanged` (`ResourceManager.js:87-88`).
- World boss: window derived from the clock (`bossWindow`, `worldBoss.js:126-138`); only `defeatedWindowStart` persisted.
  `update(dt)` emits `world:bossWindow` on open/close transitions (`WorldMapManager.js:43-50`). A calendar-style
  recurring source already exists here in miniature.
- Node regen runs only in `update(dt)` (`:38-39`); `WorldMapManager` has **no `applyOffline`**, so nodes do not regen
  during offline catch-up and camp respawns are checked against `Date.now()` on the next tick (`:40`).

### Persistence (ADR 0002 seed + reconcile)
- `serialize()` returns `poiState, regionOwner, outpostOwner, timedBuffs, discovered` (`:244-250`). `deserialize` calls
  `reconcileState(state, WORLD_MAP)` (`worldState.js:55-70`), which keeps loaded values only for ids that still exist and
  fills new ids from `seedState`. Any new world-save field (for example a faction-held outpost flag or a base state) needs
  its own seed and reconcile or loads drop it (`CLAUDE.md` gotcha).
- `worldState.js:33-34` and `:41-44` carry comments naming "future AIManager" as the intended flipper.

### Home base POI question
A faction home base POI would be a new `type` in `WORLD_DEF.pois` with a `CURATED_CELLS` entry in each faction's
sector. Everything keyed by POI `type` would need a branch: `seedState` (`worldState.js:23-37`), `update` (`WorldMapManager.js:35-51`),
`MARCH_TYPE_FOR` (`marchRules.js:3-10`), `PoiDetailPanel._bodyHtml` (`:71-116`, falls through to "Your home city" text),
`WorldRenderer._drawMarker`/`_drawMarkerState`. An unknown type returns `marchTypeForPOI = null` and the dispatch is
refused with "Nothing to do here." (`marchRules.js:28`).

## 2. Marches seam (`js/systems/march/*`)

- `MarchManager` (225 lines) owns `_marches[]` and `_idSeq`. Constructor deps: unit, combat, resource, worldMap, building,
  inventory managers (`:20-30`). Slots come from the Rally Point (`marchSlots`, `:41`); `slotsFree = slots - _marches.length`
  (`:55`), so any extra march objects in `_marches` would consume player slots.
- March record (`:97-113`): `{ id, type: gather|attack|scout, squadId, targetPoiId, phase: outbound|acting|returning,
  departAt, arriveAt, actUntil, returnAt, distance, speed, tripMs, loadCap, payload, grants, casualties, outcome }`.
  Phase transitions use absolute epoch timestamps (`update` `:121-148`).
- **Player-specific**: origin is always `WORLD_MAP.home` (`:88`, `:62`); `squadId` references a `UnitManager` squad;
  `setSquadDeployed` lock (`:115`, `:142`); speed from squad units + Rally bonus + player logistic buffs (`:90-93`);
  `canDispatch` requires a squad and a free slot (`marchRules.js:20-25`); `_creditMarch` pays into the player's
  `ResourceManager`/`InventoryManager`/timed buffs (`:195-201`); targets are POI ids only (no region or march target).
- **Reusable as-is**: `marchMath.js` is pure (`distance`, `travelMs(dist, speed)`, `armySpeed(squad, bonuses)`,
  `BASE_SPEED_PX = 265`, `:238-289`); `resolveArrival(march, poi, ctx)` is a pure dispatcher on `march.type` that calls
  `ctx.worldMapManager` and `ctx.combatManager.resolveMarchBattle(march.squadId, ...)` (`marchResolver.js:29-38`); the
  phase state machine in `update`/`applyOffline` has no player-only logic except the calls listed above.
- `applyOffline(_elapsedSec, nowMs)` cascades each march through its phases from absolute timestamps: arrival at
  `arriveAt`, `actUntil = arriveAt + dwellMs`, `returnAt = actUntil + tripMs` (`:157-192`). Arrival resolves combat at
  current manager state, not state at `arriveAt`.
- Events emitted with the `_summary` shape (`:203-209`): `march:dispatched`, `march:arrived`, `march:returning`,
  `march:completed`. Subscribers do not filter by owner: `WorldMapUI.js:64-67` (notifications "Victory", "Army returned",
  panel refresh), `SoundManager.js:190-191` (dispatch/mission sounds). AI marches emitted on these names would fire them.
- Serialization: `serialize()` returns the raw `_marches` array and `idSeq` (`:212-214`); `deserialize` re-asserts squad
  locks, guarding phantom squads (`:216-224`). No schema version.
- No unit test targets `MarchManager` or `WorldMapManager` (only `marchMath`, `marchRules`, `marchResolver` pure modules;
  `resourceManager.test.js` is the only unit test that mentions `WorldMapManager`).

### March rendering (`js/ui/world/*`)
- `WorldRenderer._drawMarchArcs` (`:419-473`) iterates `this._mm.activeMarches()` and draws, per march, a dashed arc from
  `WORLD_MAP.home` to the target POI (`arcPoint(home.x, home.y, poi.x, poi.y, t)`), trail dots, a mover token, and an ETA
  label (`_drawMarchEta` `:475-496`). Colour is by `m.type` only (attack red, scout yellow, else blue). The origin is
  hard-coded to home; there is no per-march origin or owner field.
- `_frame` redraws every frame while `activeMarches().length > 0` (`:207-213`).
- Hit-testing is POI-only (`_poiAtClient` `:169`); no mover hit-test or selection exists, so intercepting a visible
  march would need new input handling.
- `MarchPanel` lists marches by `m.targetPoiId` name and `m.type` (`MarchPanel.js:30-41`); `WorldRenderer.js` is 503 lines.

## 3. Combat seam (`js/systems/combat/*`, `CombatManager.js`)

- `resolveBattle(attackerInput, defenderInput, { seed, rulesVersion, structure })` (`resolveBattle.js:199-226`) is pure and
  seeded (`createRng(seed)`). Attacker input: `{ stacks, strikers, triggers, lossEntries, healEntries, firstWaveBonus }`
  (`cloneAttacker` `:16-31`). Defender input: `{ waves: [{ name, stacks }] }`. Output: `{ rulesVersion, seed, victory,
  roundsTotal, waves, initial, fallen, dead, wounded }`.
- It is **asymmetric**: the attacker side has heroes (strikers, triggers) and loss/heal entries; defenders are wave stacks
  with `ability` (`heal`, `revive`, `aoe_blast`). Stack shape built in `battleSides.js`: `{ id, tierKey?, label, type, tier,
  row, count, startCount, hp, attack, defense, hpPool, ability? }`. Counters (`counterMult`) use `type`.
- Side builders: `squadSide` builds an attacker from a UnitManager squad, tech, HQ benefits, hero bonuses (`:38-55`);
  `encounterSide` builds a defender from a `MONSTERS_CONFIG`-shaped object (`:77-84`), applying `DIFFICULTY_MODIFIERS`
  enemy hp/atk (`:57-75`). There is no builder for "AI army as attacker" or "player garrison as defender".
- `CombatManager.resolveMarchBattle(squadId, monsterId, milMult, { structure, seed })` (`:116-139`) requires a player
  squad and `MONSTERS_CONFIG[monsterId]`; it applies casualties to the player squad (`_applyCasualties`, `:254`), awards
  player XP and hero XP, and emits `combat:marchResolved`. It deliberately does not emit `combat:victory`
  (comment `:115`), which `MailManager` (`MailManager.js:39-55`), `QuestManager`, `UserManager` stats and
  `EventManager` listen to. `attack()` (`:47-113`) is the campaign path and does emit them.
- `_sidesFor` reads `this._techBonuses`, `this._difficulty` and `this._bm.getHQBenefits()` (`:235-247`): all player-only
  and instance state. Only `resolveBattle` itself is neutral.
- Garrison concept today: `garrison: monsterId` exists as POI data on ruins and outposts (`worldMap.js:147,149,167`,
  consumed `marchResolver.js:111,132`), but is a static monster id with no runtime state, no persisted hp, and no
  player equivalent. There is no player region garrison, defense stat, wall, or "region attacked" concept in `js/`.
  Combat reports for march fights are not mailed (the march path skips `combat:victory`); `march:arrived` carries only
  `outcome` and `casualties` counts.
- Monster data (`combat.js:6-`) is wave/stack declarative with `rewards`, so an AI army expressed in that shape would
  resolve under `encounterSide`. Tests: `CombatManager.test.js` (21 cases, stubs the managers), `resolveBattle.test.js`,
  `battleSides.test.js`, `casualties.test.js`, `hitMath.test.js`, `seededRng.test.js`.

## 4. Events, objectives, rewards, mail

### Existing `EventManager` (248 lines) and `data/events.js` (70 lines)
- Registered with the engine and given resource/mail/inventory/user managers (`main.js:84`, `registerSystem` list). Config
  `EVENTS_CONFIG` has 3 entries, all with `startTs: null, endTs: null` (always inactive): `{ id, name, icon, description,
  startTs, endTs, effects: {resource: mult}, objectives: [{id, description, target}], reward }` (`events.js:16-69`).
- Lifecycle: `update(dt)` throttles `_checkEvents` to every 60 s (`EventManager.js:20,56-62`); one event active at a time
  (`:74`, `:81`). Activation applies `ResourceManager.addModifier(resource, mult, cfg.id)`; deactivation removes them
  (`:96-98,106-108`, `ResourceManager.js:310-326`).
- Objective tracking: only `combat:victory` is subscribed, advancing objective id `win_battles` (`:52`). The ids
  `produce_iron` and `gather_wood` have no subscription, so nothing in `js/` advances them.
- Reward: XP via `UserManager.addXP`, the rest as `{type:'resource'}` via `InventoryManager.grantRewards` (`:153-163`);
  it takes a mail manager but never uses it (`_mail` is unused in the file).
- Public API/events: `getPublicState()`, `claimReward(id)`, `events:started`, `events:expired`, `events:updated`,
  `events:rewardClaimed`. Subscribers: `EventsUI.js:32-40`, `NavigationUI.js:274` (badge), `buffEvents.js:7`.
- Persisted: `activeEventId, claimedEventIds, objectiveProgress` (`:217-223`); `deserialize` re-applies modifiers and
  clears an expired active event (`:225-247`). Timestamps are wall-clock `Date.now()`.
- UI: `EventsUI` (239 lines) renders `#events-list` view and a modal; nav entry `events` is unlocked at HQ level 4
  (`navigation.js:40-44`); `#nav-events` lives in the More grid (`index.html:483`).
- Tests: `tests/unit/eventManager.test.js` has 3 cases (activate/deactivate modifier cleanup).

### Reusable objective/reward machinery elsewhere
- `QuestManager`: hard-coded subscriptions to `building:completed`, `unit:trained`, `combat:victory`, `tech:researched`,
  `user:levelUp` mapped to objective types (`QuestManager.js:30-36`); rewards delivered by mail via `quest:completed`.
- `ChallengeManager`: declarative; each config row has `objective.event` and the manager subscribes with
  `eventBus.on(cfg.objective.event, ...)` (`ChallengeManager.js:60-63`): the closest existing generic
  event-name-to-objective pattern. Daily/weekly resets via `isoWeek`/`todayStr` (`:40-51`).
- `StoryManager`: trigger matchers on `quest:completed`, `building:completed`, `user:levelUp` (`:32-35`), emits
  `story:chapter_triggered`.
- `NotificationManager`: toasts keyed on events, plus a generic `notification:show { type, title, message }` entry
  (`NotificationManager.js:51`), usable from any manager without a UI reference.
- `BuffManager`/`ResourceManager.addModifier` for timed economy effects; `WorldMapManager.grantTimedBuff({durationMs,...})`
  for world buffs (`:217-222`), expiry in `update` emitting `world:buffExpired`.

### Mail
- `MailManager.send({ type, subject, body, attachments, report })` (`MailManager.js:83-101`). Stored message: `{ id, type,
  subject, body, isRead, isInTrash, deletedAt, isImportant, attachments, rewardsClaimed, report, timestamp }`. Emits
  `mail:received { unreadCount, message }` and `mail:updated`.
- Types in use: `combat`, `quest`, `achievement`, `system`. Categories are derived from `type` (`mailCategories.js:1-14`):
  `reports` = `combat`, `rewards` = `quest|achievement`, `system` = everything else. An unknown type lands in `system`;
  `TYPE_ICON` and `SENDER` fall back to `envelope`/`System` (`mailRow.js:6,8`).
- `attachments` is a flat map of resource key to amount; claim converts to `{type:'resource', itemId, quantity}` and
  `grantRewards` splits resources into tier bundles (`MailManager.js:230-232`, `InventoryManager.js:115-137`).
  `claimRewards`/`claimAll` set `rewardsClaimed` and emit `mail:rewardsClaimed`. A mail can reference `report` for a
  battle block (`battleReportBlock.js`, shape from `battleReport()` `MailManager.js:13-24`).
- **Not present**: reply/response buttons, per-message actions/choices, expiry, sender identity beyond `type`, or a
  mail-triggered callback. Mail UI files are `js/ui/mail/*` (MailHub, MailList, mailExpand, mailActions, ...) and
  `MailUI.js`. Diplomacy "accept/decline" would have no existing mechanism in mail.
- Welcome mail and level-up mail go through the same `send` (`main.js` launch; `MailManager.js:72-79`).
- Mail persisted in `serialize()` as `{ messages, nextId }` (`:204`); Trash purge after 7 days (`:6`).

## 5. Engine, time, save, dev hooks

- `GameEngine` registers systems with `update(dt)` (throws otherwise, `GameEngine.js:51-57`); fixed 50 ms tick, RAF loop,
  `frameMs` capped at 250 ms so a hidden tab does not catch up in-loop (`:117-144`). `tick:ui` every 20 ticks (`:137`).
  Per-system `update` is try/caught and logged (`:128-133`).
- Offline: `calculateOfflineProgress(lastSavedTimestamp)` caps credit at **24 h** and ignores <5 s (`:67-71`); calls each
  registered system's optional `applyOffline(elapsedSec, effectiveNow)` in registration order, try/caught (`:80-87`).
  Implementers: `ResourceManager:143`, `BuildingManager:174` (+ Cafeteria), `TechnologyManager:101`, `UnitManager:200`,
  `MarchManager:157`. `lastSavedTimestamp` is written by every `SaveManager.save` (`SaveManager.js:31`), i.e. every 30 s
  autosave, so offline time is measured from the last save, not from tab close.
- Registration order: resource, building, unit, combat, campaign, tech, quest, mail, hero, buff, market, shop, trader,
  challenge, user, achievement, event, worldMap, march (`main.js` "REGISTER WITH ENGINE"). Offline order follows this,
  so a FactionManager registered after `march` would run its `applyOffline` after the player's marches resolve.
- `main.js` launch (`launchGame`): `applyGameState(savedState)` then `UIManager` constructed, then offline progress run with
  temporary listeners that collect `building:completed`, `unit:trained`, `tech:researched`, `quest:completed` into a
  "Welcome Back" modal; modal shown only if tutorial complete and `offlineMs > 5000` (`main.js:~419-545`). That modal is
  built inline in `main.js` and lists resource gains plus those four event kinds; no hook for other systems.
- Save contract: each manager implements `serialize()`/`deserialize(state)`; `main.js` `getGameState()` and
  `applyGameState()` list them by hand (`:174-233` region). World/march sit behind `if (state.worldMap)` guards;
  a new manager needs a key in both functions and a guard for old saves. `engine.gameMode` and `lastSavedTimestamp` are
  saved. `window.game` exposes managers for tests (`main.js:~660-685`).
- Dev session: `?dev[=slot]` (`devSession.js:12-18`) boots a sandbox: `runDevSession` raises townhall, rally point,
  barracks, trains 4 infantry, squad, navigates to `world` (`:20-39`), then `DevDashboard().init({ slot, saveManager,
  getGameState, buildingManager })` (`main.js` startEngine). Dashboard panel is built from template strings with a
  `data-dev-tools` mount (`DevDashboard.js:44-60`, `_mountTools` `:26`); extra tool modules exist
  (`DevLevelSwitcher`, `DevAnchorNudger`, `DevPopupMuter`, `DevSpriteSource`). `DevDashboard` does not receive the world,
  march or any new manager today; it would need a constructor argument added in `main.js`.
- Dev-only: `devMute` (`core/devMute.js`) silences achievement toasts; sandbox mode gives free resources.

## 6. Player-strength signals available today

- HQ level: `BuildingManager.getHQLevel()` (`:682`); `getHQBenefits()` (attack/defense bonus, `:722`); `getLevelOf(id)`
  (max across instances).
- Player level/XP: `UserManager.profile.level, xp, xpToNext` (`UserManager.js:15-25`); curve `floor(500*1.4^(L-1))`, uncapped
  (`:153`); event `user:levelUp { level }`. `profile.stats` counters (`battlesWon`, `unitsTrainedTotal`, `timePlayed`, ...).
- Troops: `UnitManager.getTotalUnitCount()` (reserve + squads, excludes queues/wounded, `:814`); `getReserve()` (rows with
  per-tier `stats`), `getSquads()`, `getWounded()`, `isSquadDeployed`. Heroes: `HeroManager.getCombatBonuses(squadId)`.
- Regions held: `WorldMapManager.isPlayerOwned` per region id; `campaign` progress via `CampaignManager`.
- Existing power-like function: `lineupPower(waves)` in `stageGenerator.js:8-14`, monsters only.
- **Power stat and new level curve are not built**: no `PowerManager`, no `powerMath` file, no power field in `UserManager`
  (grep: no match). `docs/40-active.md` "PENDING PLANS" table lists plan 3 (`2026-10-07-power-stat.md`, "powerMath +
  PowerManager") and plan 4 (`2026-10-07-player-levels.md`) with no BUILT marker, after plans A, B and 1 (BUILT
  2026-10-08). Plan 2 (building levels 30) also has no BUILT marker; `git status` shows `buildingCurve.js`, `hqChain.js`,
  `buildingTables.js` modified/untracked, so it is in progress. `power-levels.md:141-142` states the Phase 4 AI "reads
  combat power and level through `PowerManager.getPower()` and `UserManager`". `docs/30-roadmap.md:409` has an unticked
  "AI difficulty scaling seam driven by player level + activity (Phase 4 prep)".
- Roadmap context: Phase 4 AI and Phase 5 "Map events & objectives" are both unticked (`docs/30-roadmap.md:18-19`);
  `docs/30-roadmap.md:270` records Steve's note that AI is "authoring actual opponents - capabilities, behaviours, and
  personalities", not an `AIManager` shell.

## 7. UI surfaces and mount points

- World view DOM (`index.html:234-` ): `#view-world > #world-grid` containing `#world-canvas`, `#world-home-btn`,
  `#world-march-panel` (top-left, `world-view.css:12-13`), `#world-legend` (top-right), `#world-poi-panel` (slide-up
  detail), `#march-sheet` (dispatch sheet). Panels have z-index 4-6 inside the view (`world-view.css:39,77,110,129`).
- Presenter wiring: `WorldMapUI` (225 lines) builds `WorldRenderer`, `PoiDetailPanel`, `MarchDispatchSheet`, `MarchPanel`
  (`:33-55`), a 1 s ticker while the view is active (`:116-122`), and listens to `march:*`, `world:poiChanged`,
  `world:outpostCaptured`, `world:regionCaptured` (`:62-77`). On `world:regionCaptured` it only knows the player-capture
  toast ("Region captured") and a ripple. The legend lists each non-neutral faction with a check when the player owns all
  its regions (`:95-107`).
- `PoiDetailPanel.open(vm)` has one primary action button resolved from `marchType` (Gather / Capture / Attack / Challenge)
  and a view-model from `WorldMapUI._poiVm` (`:169-189`); it has no faction/owner row for non-player owners (only
  "Yours"/"Held" suffix, `:45`).
- Region tint/labels do not follow `regionOwner` for non-player owners: `gridLayer._tintFor` and `_drawRegionLabel`
  use `factionId` from map data unless `isPlayerOwned` (`gridLayer.js:172-182`, `WorldRenderer.js:239-247`). The grid chunk
  cache is invalidated by `syncState()` (`WorldRenderer.js:83`).
- Nav: `#nav-flip` (Base/World), `#nav-more` FAB opening `#nav-more-menu` grid with Build, Quests, Combat, Economy,
  Events, Arena (disabled "soon") (`index.html:453-487`). `NavigationUI` (611 lines) owns unlock rules from
  `TAB_UNLOCK_CONDITIONS` (`navigation.js:22-60`), badges (`_badgeStore`), and `_updateEventsBadge` on `events:updated`
  (`NavigationUI.js:274`). `BUILDING_TAB_MAP` maps `rallypoint` to `world`.
- Header: two-tier topbar (`index.html:103-`, `game-header`, `#player-chip`, `#player-level`), `PlayerPlate`,
  `ResourceChips`, `ChipPopover` in `js/ui/hud/`; topbar design reserves a hidden power slot (see
  `power-levels-codebase.md` section 1). Mail hub: `MailUI` + `js/ui/mail/*`.
- `UIManager` (752 lines) constructs 17 presenters by hand with a `systems` bag (`UIManager.js:62-209`); `events` and
  `worldMap`/`march` are passed explicitly (`:135`, `:204`, `:209`). `main.js` passes the bag (`main.js` `new UIManager`).
- Z-index ladder, `css/base/variables.css:144-153`: `--z-base 1`, `--z-overlay 100`, `--z-popover 150` (chip popover),
  `--z-modal 200`, `--z-nav 210`, `--z-toast 300`, `--z-tooltip 400`, `--z-scene 500` (battle scene), `--z-float 600`,
  `--z-confirm 950`. Note `--z-nav` 210 is above `--z-modal`. World-view panels use literal 4-6.
- CSS: `world-view.css` (139 lines, `.world-*`, current map) vs `worldmap.css` (`.world-map-*`, legacy campaign); do not cross
  prefixes. `events.css` exists for the Events view.

## 8. `main.js` construction order (685 lines)

Order of `new` calls (`main.js` "INSTANTIATE SYSTEMS"): LogManager, GameEngine, SaveManager, FirebaseDataManager, User,
Resource, Building, Inventory, Buff, Hero, Unit, Combat, Campaign, Mail, Quest, Technology, Settings, Market, Shop,
Trader, Achievement(user, mail, rm, inv), Challenge(rm, mail, inv), Story, Tutorial, `EventManager(rm, mail, inv, user)`,
`WorldMapManager`, `resourceManager.setWorldMapManager`, `MarchManager(unit, combat, rm, worldMap, building, inventory)`,
then `mailManager.setInventoryManager`, then `_validateWiring` (a hand list of required fields).
- `MailManager` is created before `EventManager`/`WorldMapManager`/`MarchManager`, so a faction/event manager placed after
  `MarchManager` can take mail, user, worldMap, march, unit, combat, building (all already constructed). A
  `WorldEventManager` replacing `EventManager` takes the `eventManager` slot (before `WorldMapManager`), so it would
  need `worldMapManager` injected afterward by a setter (the pattern used by `setWorldMapManager`).
- Hand-maintained touchpoints for a new manager: the `import`, construction, `engine.registerSystem` list, `getGameState`,
  `applyGameState`, the `UIManager` systems bag, and `window.game`. `eventManager` appears in `getGameState` (`events:`),
  `applyGameState`, UI bag (`events:`), and `window.game` (`events:`).
- `main.js` already exceeds the ~400-line rule (685), as do `BuildingManager` (1151), `UnitManager` (965), `UIManager` (752),
  `NavigationUI` (611), `TechnologyManager` (533), `BarracksUI` (550), `SettingsUI` (513), `MilitaryUI` (499),
  `WorldRenderer` (503), `ResourceManager` (494).

## 9. Tests

- `tests/README.md` contract: one test file per source module; append, never rewrite; every bug fix lands with a regression
  test; tests import game modules directly; browser scripts build on `harness.mjs`; near-zero comments; additive suite
  (ADR 0012). Unit tier = `npm test` (node:test), browser tier = Playwright scripts via `BASIE_PW_ROOT`.
- Unit coverage relevant here: `worldState.test.js`, `regionBuffs.test.js`, `gridGen.test.js`, `gridLayer.test.js`,
  `marchMath.test.js`, `marchRules.test.js`, `marchResolver.test.js`, `eventManager.test.js` (3 cases), `mailManager.test.js`,
  `mailCategories.test.js`, `CombatManager.test.js`, `resolveBattle.test.js`, `battleSides.test.js`, `userManager.test.js`
  (5 cases), `worldBuffStat.test.js`, `saveManager.test.js`, `eventBus.test.js`. Not present: tests for `WorldMapManager`,
  `MarchManager`, `worldBoss.js`, `nodeEconomy.js`, `GameEngine.calculateOfflineProgress`.
- Browser: `world-smoke.mjs` (boots sandbox, navigates `world`, canvas paint, region capture re-tint via
  `wm.captureRegion('red_lowlands')`, legend rows), `combat-smoke.mjs`, `boot-smoke.mjs`, `mail-smoke.mjs`,
  `dev-smoke.mjs`, `dev-dashboard-smoke.mjs`, `tutorial-smoke.mjs`, `hud-smoke.mjs`. Tests reach managers via
  `window.game` (`world-smoke.mjs:25`).
- A fixture guard test is required by `CLAUDE.md` when adding content ranges (for example a synthetic extra faction).

## 10. Risks and gotchas (facts only)

1. **Regions can only be gained.** `captureRegion` hard-codes `'player'`; no setter for another owner or for losing a region.
   `world:regionCaptured` has no owner/previous-owner field, and its listeners (`WorldMapUI.js:72`, `ResourceManager.js:88`)
   assume a player gain.
2. **Everything uses `=== 'player'`** (section 1 list); non-player owners render as map-static `factionId` colours, so a
   region held by a different faction than its `factionId` would not re-tint or relabel.
3. **Losing a region cascades:** buffs vanish (`regionBuffs.js:15`), dependent regions re-lock and re-fog
   (`WorldMapManager.js:131,147`), and `canDispatch` blocks new marches to locked regions (`marchRules.js:22`). Marches
   already in flight are not re-checked on arrival (`resolveArrival` does not call `regionLock`).
4. **Stronghold capture is monster-based:** each region's `strongholdId` POI has a fixed `monsterId` and
   `capturesRegion`; there is no garrison state to defend, and the stronghold becomes attackable only via `hostileAvailable`
   (`respawnAt`).
5. **Marches have one origin (home) and one owner (player)**; `_marches.length` feeds `slotsFree`; `march:*` events carry
   no owner and drive player notifications/sounds.
6. **Combat resolver is player-attacker-only at the manager layer.** `resolveBattle` is neutral, but `CombatManager` and
   `battleSides.squadSide` assume a `UnitManager` squad, hero bonuses, and player tech/HQ.
7. **Offline gaps:** `WorldMapManager` has no `applyOffline`; offline marches resolve against post-load state; the 24 h cap and
   5 s floor are fixed in `GameEngine.js:70-71`; offline order is registration order.
8. **Welcome-back report is inline in `main.js`** and collects four event kinds only.
9. **`EventManager` gaps:** only `win_battles` has a producer; `_mail` unused; single active event; timestamps are
   `null` in all three configs so no event ever runs; `events:` badge is the only world-adjacent hook.
10. **Mail has no action/response mechanism**, only read, star, trash, claim attachments. Attachments are resource-keyed only
    (`withoutXp`, `_rewardArray`); `_rewardArray` maps every attachment key to `type:'resource'`; no `type:'item'` path exists in mail claim.
11. **Save**: `serialize` keys and `applyGameState` are hand lists in `main.js`; world/march loads are guarded by
    `if (state.worldMap)`, other managers are not. `WorldMapManager.serialize()` returns live object references
    (`_poiState`, `_regionOwner`).
12. **Fixed-id coupling:** POI/region ids are save keys; `TutorialManager` hardcodes view ids and selectors; `main.js`
    import order is load-bearing. Filler cell picking (`pickFillerCells`, `gridGen.js:97-120`) uses `isBuildableCell` and `hash3`; whether it
    avoids curated cells was not verified.
13. **Power/level inputs are planned, not built** (section 6); a `PowerManager` would be a new dependency.

## Files inspected

`CLAUDE.md`, `docs/research/power-levels-codebase.md`, `docs/30-roadmap.md` (lines 16-24, 266-285), `docs/40-active.md`
(86-115), `docs/10-design/power-levels.md` (136-146), `docs/20-decisions/0005-owner-as-free-string.md`, `tests/README.md`,
`js/main.js`, `js/core/{GameEngine,SaveManager,EventBus,devSession}.js`, `js/ui/dev/DevDashboard.js` (partial),
`js/systems/world/*`, `js/systems/march/*`, `js/systems/combat/{resolveBattle,battleSides,combatInputs}.js`,
`js/systems/{CombatManager,EventManager,MailManager,QuestManager,UserManager}.js` (UserManager partial),
`js/systems/ChallengeManager.js` (partial), `js/systems/{StoryManager,NotificationManager}.js` (event lines),
`js/systems/UnitManager.js` (excerpts), `js/systems/mail/mailCategories.js`, `js/entities/data/{worldMap,worldGrid,gridGen,events,combat,navigation}.js`
(`gridGen`, `combat`, `navigation` partial), `js/ui/controllers/{WorldMapUI,EventsUI}.js` (EventsUI partial),
`js/ui/world/{PoiDetailPanel,MarchPanel,gridLayer}.js`, `js/ui/world/WorldRenderer.js` (lines 195-235, 419-500), `js/ui/mail/mailRow.js`
(grep), `js/ui/UIManager.js` (grep), `js/ui/controllers/NavigationUI.js` (grep), `index.html` (grep + 234-274),
`css/base/variables.css` (grep), `css/components/world-view.css` (grep), `tests/unit/{worldState,eventManager}.test.js`
(head), `tests/browser/world-smoke.mjs` (head).

Not inspected: `HeroManager`, `BuffManager`, `ResourceManager` internals beyond modifier API, `CampaignManager`,
`FirebaseDataManager`, `TutorialManager`, `WorldCamera`, `MarchDispatchSheet` body, `MailHub`/`MailUI` internals, the
power-stat and player-levels plan documents (only their status lines), `docs/10-design/world-map.md`.
