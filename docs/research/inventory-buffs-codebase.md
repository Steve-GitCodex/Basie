# Inventory and buffs: codebase audit

Fact-finding input for an Inventory/Buffs redesign. Written 2026-10-03 from the working tree
(uncommitted changes included). Every claim cites `file:line`. This is not a design lock. A
decision taken from it should go into an ADR.

## Summary: what matters most

1. **Two unrelated "buff" systems share one badge word.** Item production boosts live in
   `HeroManager._activeBuffs` (`HeroManager.js:40`) and fire `buffs:*`. Territory buffs live in
   `WorldMapManager` and fire `world:*`. The HUD badge and the Inventory "Active Buffs" section read
   only the first. The second has no HUD presence at all (Part 2).
2. **Item boosts stack additively and run in parallel.** Two +25% items sum to +50%, each with its own
   timer. Nothing is refreshed or extended (`heroCombat.js:160-167,184-189`).
3. **The badge click goes to a screen that shows no buffs.** `NavigationUI.js:261-264` navigates to
   `heroes`, but no Heroes UI reads `getActiveBuffsWithRemaining` or `getCategorizedBonuses`. Buffs
   render only in the Inventory panel.
4. **The Inventory buff countdown is frozen while the panel is open.** It re-renders only on
   `buffs:updated`, which fires on activate/expire, not on the 1 s `tick:ui` (`InventoryUI.js:77`).
5. **`InventoryUI` full-rebuilds `panel.innerHTML`** on every tile click, tab click and
   `inventory:updated` (`InventoryUI.js:193-199`). That is an ADR 0007 violation, and the hero
   picker is destroyed by it (`InventoryUI.js:73,410`).
6. **Several owned item types appear in no Inventory tab** (`recruit_token`, `hero_shard`,
   `tier_shard`, `slot_purchase`, `automation`), though they count toward "inventory not empty".
7. **Roadmap and `world-map.md` are stale on buff wiring.** Economic buffs now reach
   `ResourceManager` and `milMult` has no `> 1` guard (Part 1 notes).

---

# Part 1: every buff, bonus and modifier

## 1.1 Item production boost (`type: 'buff'`)

- **Defined:** `js/entities/data/economy.js:98-109`. `buff_prod_sm` +25% / 1 h (`moneyCost 600`),
  `buff_prod_lg` +50% / 2 h (`moneyCost 1500`). Sold in Supply "Boosts" (`economy.js:~186-187`).
- **Granted by:** `InventoryManager.useItem` `cfg.type === 'buff'` (`InventoryManager.js:262-267`):
  `removeItem`, then `HeroManager.activateBuff({value, durationMs})` (`HeroManager.js:169`), which
  delegates to `heroCombat.activateBuff` (`heroCombat.js:160-167`).
- **State:** `HeroManager._activeBuffs` = `[{value, endsAt, durationMs}]` (`HeroManager.js:39-40`,
  `heroCombat.js:162`).
- **Duration:** timed. `endsAt = Date.now() + durationMs` (wall clock, so it also runs offline).
- **Stacking:** every activation pushes a new entry (`heroCombat.js:162`). No dedupe, refresh or cap.
  `getActiveProductionMultiplier` returns the **sum** of values (`heroCombat.js:185-189`), and
  `ResourceManager` applies one `(1 + sum)` to every resource (`ResourceManager.js:194-200`).
  Two +25% items give x1.50, not x1.5625.
- **Expiry:** `HeroManager.update` filters expired entries and emits `buffs:updated` +
  `buffs:changed` on a length change (`HeroManager.js:247-254`).
- **Events:** `buff:activated {value, durationMs}`, `buffs:updated (list with remaining)`,
  `buffs:changed` (`heroCombat.js:164-166`). `inventory:itemUsed {itemId}` (`InventoryManager.js:266`).
- **Consumers:** `ResourceManager` re-runs rates on `buffs:changed` (`ResourceManager.js:93`).
  UI: `InventoryUI.js:77-80`, `NavigationUI.js:307,722-725`, `InventoryBuffSection.js:29`.
- **Serialized:** yes, `activeBuffs` (`HeroManager.js:272`); expired entries are dropped on load
  (`HeroManager.js:279`).
- The also-defined `getCategorizedBonuses` pushes timed buffs as a hard-coded "Timed Buff / Production
  Boost" row into a `production` list (`heroCombat.js:146-154`). No code calls that function outside
  `HeroManager.js:168` (grep of `js/`), so it is dead output.

## 1.2 Region signature buffs (standing)

- **Defined:** `js/entities/data/worldMap.js` region `buff` objects, lines 78-128. Flavors:
  `economic {resource,pct}` (iron/food/wood/stone 0.10), `logistic {pct}` (0.12), `military {pct}`
  (0.10, 0.15, 0.25). Flavor doc at `worldMap.js:52-53`.
- **State:** `WorldMapManager._regionOwner` (`WorldMapManager.js:23`). A buff is active iff the owner is
  `'player'` (`regionBuffs.js:13-17`).
- **Granted by:** `captureRegion` (`WorldMapManager.js:232-238`), called on stronghold victory.
- **Duration:** standing, never expires while the region is held.
- **Events:** `world:regionCaptured {regionId, buff}` then `world:buffsChanged` (`:236-237`).
- **Serialized:** `regionOwner` is (`WorldMapManager.js:243`).

## 1.3 Outpost boons (standing)

- **Defined:** `worldMap.js` POI `boon: {flavor,resource?,pct}` (lines 141, 150, 168; doc line 36).
- **State:** `WorldMapManager._outpostOwner` (`:24`). Active iff owner is `'player'`
  (`WorldMapManager.js:177-179`).
- **Granted by:** `captureOutpost` (`:203-211`). Emits `world:outpostCaptured {poiId, boon}` then
  `world:buffsChanged`.
- **Duration:** standing. **Serialized:** `outpostOwner` (`:244`).

## 1.4 Ruin-expedition timed world buffs

- **Defined:** ruin `reward: {kind:'buff', flavor, pct, durationMs}` (`worldMap.js:139`, 600 000 ms
  logistic +15%). The boss path reuses the mapping (`marchResolver.js:85`).
- **Granted by:** `MarchManager._creditMarch` on army return (`MarchManager.js:196-199`) calls
  `WorldMapManager.grantTimedBuff` (`:214-219`). Emits `world:buffGranted {buff}` then
  `world:buffsChanged`.
- **State:** `_timedBuffs = [{flavor,resource?,pct,durationMs,expiresAt}]` (`:26,216`).
- **Stacking:** each grant pushes a new entry. Entries sum within a flavor (and per resource for
  economic) in the aggregators (1.5).
- **Expiry:** `WorldMapManager.update` filters and emits `world:buffsChanged` (`:52-57`).
  **Serialized:** yes, `timedBuffs` (`:244`); expired entries are dropped on load (`:258-260`).

## 1.5 The merged list and its aggregators

`WorldMapManager.activeBuffs()` returns region + outpost + non-expired timed entries as one flat array
(`WorldMapManager.js:174-181`). Pure reducers in `js/systems/world/regionBuffs.js`:

| Reducer | Math | Cite |
|---|---|---|
| `economicBonus(buffs, res)` | sum of `pct` for that resource | `regionBuffs.js:20-24` |
| `logisticSpeedMult` | `1 + sum(pct)` | `:27-32` |
| `militaryMult` | `1 + sum(pct)` | `:35-40` |

All sums are additive within a flavor, with no cap. Buffs apply **globally** (decision recorded in
`docs/30-roadmap.md:196-199`).

**Consumers (verified in code):**
- Economic, base production: `ResourceManager.recalculateRates` multiplies each resource by
  `1 + economicBonus` (`ResourceManager.js:172-179`). Listeners at `:83-84`
  (`world:buffsChanged`, `world:regionCaptured`). `main.js:209` re-emits `world:buffsChanged` after load.
- Economic, gather marches: `marchResolver._gather` computes `floor(granted*(1+bonus))` then clamps to
  `march.loadCap` (`marchResolver.js:41-48`). `granted` is already capped at `loadCap` by
  `takeFromNode`, so the bonus only shows when the node held less than the squad could carry.
- Military: `militaryMult(activeBuffs())` at `marchResolver.js:58,80,112,133`, passed to
  `CombatManager.resolveMarchBattle` (`CombatManager.js:112`) then `battleSides.js:31`, where it
  multiplies attacker attack directly. **No `> 1` guard exists in the current code**, so a value `< 1`
  would apply. `docs/30-roadmap.md:161-162,200-201` and `docs/10-design/world-map.md:43` still
  describe the guard (stale).
- Logistic: `MarchManager.js:64` (ETA preview) and `:91` (dispatch) feed `armySpeed`
  (`marchMath.js:41-42`). Speed is fixed at dispatch time and not re-evaluated mid-march.

## 1.6 Other production modifiers (in the rate pipeline)

Order in `recalculateRates` (`ResourceManager.js:151-227`), all multiplicative layers:

| # | Layer | Source | Cite |
|---|---|---|---|
| 0 | Base: `effects * level` per building, with per-instance hero bonus then adjacency bonus | `buildingEconomy.computeActiveRates` | `buildingEconomy.js:82-117`; `ResourceManager.js:157-164` |
| 1 | Tech `ironBonus/woodBonus/stoneBonus/waterBonus` (no food) | TechnologyManager | `ResourceManager.js:167-170` |
| 2 | Economic world buffs | 1.2-1.5 | `:172-179` |
| 3 | HQ `productionBonus` | `BuildingManager.getHQBenefits` | `:181-189`; `buildings.js:486-534` |
| 4 | Item production boost (all resources) | 1.1 | `:191-201` |
| 5 | VIP `productionBonus` | `user:vipUpdate` | `:203-208` |
| 6 | Difficulty `resourceRate` | `settings:changed` | `:210-215` |
| 7 | Event modifiers (`addModifier`) | EventManager | `:217-224` |

Stationed-hero production is applied per-instance in layer 0, not again globally
(`ResourceManager.js:191-192`).

## 1.7 Tech bonuses

- **Defined:** `js/entities/data/tech.js` `effects` (e.g. `ironBonus 0.25` line 11,
  `buildTimeReduction 0.15` line 62, `attackBonus/hpBonus` line 85, tier bonuses lines 99-138).
- **State:** `TechnologyManager._appliedBonuses` (`:30`), additive per key (`:527-531`).
- **Duration:** standing (permanent once researched). Applied each level completion (`_applyEffects`).
- **Events:** `resources:bonusChanged (map)` (`TechnologyManager.js:426,531`). Listeners:
  `ResourceManager.js:52`, `CombatManager.js:34`, `BuildingManager.js:94-95`.
- **Consumers:** rates (above), `buildTimeReduction` capped at 0.80 (`BuildingManager.js:405-406,565-566`),
  storage caps (`:1104`), combat (`CombatManager.js:278` into `battleSides.js:15`).
- **Serialized:** yes, `bonuses` (`TechnologyManager.js:400,421`), re-emitted on load (`:426`).

## 1.8 Hero stationing and global effects

- Per-instance resource bonus: `HeroEconomy.getInstanceBonus` (`heroEconomy.js:7-11`) from
  `resourceBonusFor` (`heroProductionBonus.js:47-58`): station base `* scaleFor` (star and level
  scaling, `:7-11`) plus skill bonus. Applied in `computeActiveRates` (`buildingEconomy.js:101-107`).
- Global effects (`trainingSpeed`, `researchSpeed`, `buildSpeed`, `constructionCost`, `storageCap`):
  `getGlobalEffectMap` (`heroEconomy.js:13-15`), aggregated through the stat aggregator
  (`heroProductionBonus.js:60-81`). Read at `BuildingManager.js:412,570,1104,1114-1119`,
  `TechnologyManager.js:435`, `UnitManager.js:169`.
- **State:** derived from `hero.assignment`, never stored as a bonus. **Duration:** standing while stationed.
- **Events:** `heroes:updated` + `hero:productionBonusChanged` on assign/unassign
  (`heroAssignment.js:103-104,116-117`). `ResourceManager` listens at `:94`.
- **Serialized:** not as a bonus. Hero assignment is serialized with the hero.
- Hero combat auras and building bonuses (`getCategorizedBonuses`, `heroCombat.js:102-157`) have no
  caller outside the manager facade. Combat reads `getCombatBonuses(squadId)` instead
  (`CombatManager.js:277`).

## 1.9 VIP perks

- **Defined:** `VIP_TIERS` incremental perks (`economy.js:~243-280`); aggregated by
  `UserManager._computeAggregatedPerks` (`UserManager.js:170-190`).
- **State:** tier is derived from `stats.diamondsSpent` (`UserManager.js:~195-205`); perks are not stored.
- **Events:** `user:vipUpdate {tier, perks, deltaPerks, isInit}` (`:226`; boot via `broadcastVipState`).
- **Consumers:** `ResourceManager.js:53-56` (production), `BuildingManager.js:101-108` (build time,
  slots), `TechnologyManager.js:41`, `UnitManager.js:35` (train time).
- **Stacking:** cumulative across tiers (additive sum of deltas). Standing. Cumulative production is
  +5% by VIP V.

## 1.10 EventManager modifiers

- **Defined:** `EVENTS_CONFIG[].effects` = `{resource: multiplier}` (`events.js:9-10`; e.g. `iron: 2.0`
  at line 24).
- **State:** `ResourceManager._modifiers` Map keyed `<eventId>:<resource>` (`ResourceManager.js:51,317-320`).
- **Duration:** timed by `startTs`/`endTs`. Applied by `_activateEvent` (`EventManager.js:96-98`),
  removed by `_deactivateEvent` (`:107`).
- **Stacking:** different event ids multiply (layer 7); the same key overwrites. No event stacking UI.
- **Events:** `events:started`, `events:updated`, `events:expired`. A rate change emits
  `resources:ratesChanged` (`:226`).
- **Serialized:** `_modifiers` is not. `EventManager` serializes `activeEventId` and re-adds modifiers on
  load (`EventManager.js:217-240`).

## 1.11 Other

- **Layout adjacency bonus** (production and military train time): `adjacency.js:95-112`; derived from
  placement, never serialized (`BuildingManager.js:~62-63`).
- **Combat modifier** `playerAttackMult 1.3` (`combat.js:262`), applied at `battleSides.js:31`. This is a
  mode modifier, not a player buff.
- **Item gacha "buff" outcomes** are gone: `GACHA_CONFIG.buffPool` retired (ADR 0026:87), though the
  `scroll_*` item descriptions still say "or buff" (`economy.js:111-125`).
- **Market `tradeBonus`:** documented dead in `docs/30-roadmap.md:163-164`. Not re-verified.

## 1.12 Summary table

| Source | Effect stat | Timed / standing | Stacking | State owner | Events | Consumers | Serialized |
|---|---|---|---|---|---|---|---|
| Item boost `buff_prod_*` | all-resource rate | timed (1 h / 2 h, wall clock) | additive sum, parallel timers | `HeroManager._activeBuffs` | `buff:activated`, `buffs:updated`, `buffs:changed` | ResourceManager, NavigationUI badge, InventoryBuffSection | yes |
| Region signature buff | resource rate / troop attack / march speed | standing while held | additive within flavor, global, no cap | `WorldMapManager._regionOwner` | `world:regionCaptured`, `world:buffsChanged` | ResourceManager, marchResolver, MarchManager | owner map yes |
| Outpost boon | same three flavors | standing while held | additive with the rest | `_outpostOwner` | `world:outpostCaptured`, `world:buffsChanged` | same | owner map yes |
| Ruin timed buff | same three flavors | timed, ms | additive, parallel | `_timedBuffs` | `world:buffGranted`, `world:buffsChanged` | same | yes |
| Tech | resource rate, build time, combat, storage | standing | additive per key | `TechnologyManager._appliedBonuses` | `resources:bonusChanged` | Resource, Building, Combat | yes |
| HQ level | prod / attack / defense / storage | standing | single value per HQ level | `BuildingManager` (derived) | none dedicated | Resource, Combat, BuildingCards | derived |
| Hero stationed | per-building rate, global speeds/cost | standing while stationed | per-hero entries via stat aggregator; per instance | `hero.assignment` (derived) | `heroes:updated`, `hero:productionBonusChanged` | buildingEconomy, Building, Tech, Unit | with hero |
| Adjacency | per-instance production, train time | standing | additive per instance | `BuildingManager._adjacency` | none dedicated | buildingEconomy, UnitManager | no (derived) |
| VIP | production %, build/train/research time, slots | standing | cumulative tiers | `UserManager` (derived from spend) | `user:vipUpdate` | Resource, Building, Tech, Unit | spend yes, perks derived |
| EventManager | per-resource multiplier | timed (`startTs`-`endTs`) | multiplicative across ids | `ResourceManager._modifiers` | `events:*` | ResourceManager | active id yes, modifiers rebuilt |
| Difficulty | production rate | standing | single | `ResourceManager` | `settings:changed` | ResourceManager | in settings |

---

# Part 2: current buff presentation

## 2.1 Inventory "Active Buffs" section

- `js/ui/inventory/InventoryBuffSection.js` (70 lines), appended to the end of `.inv-panel-body`
  on every render (`InventoryUI.js:147,201`).
- Reads **only** `heroes.getActiveBuffsWithRemaining()` (`InventoryBuffSection.js:29`). So it lists item
  production boosts only. World buffs, tech, VIP, events and HQ are absent.
- Per card: hard-coded name `Production Boost` (`:56`), effect `+N% all resources` (`:57`), formatted
  time left and a fill bar from `remaining / durationMs` (`:42-62`). Icon is always `production` (`:54`).
- Empty state: "No active buffs. Use production boost items from your Inventory..." (`:34-39`).
- `refresh()` removes and rebuilds the list via `getElementById('inv-buff-section')` (`:20-24`), called
  from `buffs:updated` (`InventoryUI.js:77`). No `tick:ui` listener, so the time text and bar are
  static between activate/expire events while the panel is open.
- The two entries have no identity key (index only, `:52`), so you cannot tell which item produced which.

## 2.2 Buff toast

`InventoryUI.js:78-80`: on `buff:activated` shows `'⛏️ Buff Active!'` with
`+N% production for Mm`. Duration is minutes only (`durationMs/60000` to 0 dp, so 1 h shows "60m").
It fires from the Inventory UI, so it appears even when the panel is closed. It is item-boost only.

## 2.3 HUD `#buff-hud-badge`

- Markup: `index.html:160-164`, `title="Active Buffs — click to manage"`, class `hidden` by default.
  Shows count and the shortest remaining time.
- Updated by `buffs:updated` (`NavigationUI.js:307`) and by the 1 s `tick:ui` via
  `_refreshBuffBadgeTick` (`:282,722-725`), which re-reads `heroes.getActiveBuffsWithRemaining()`.
  `_updateBuffBadge` (`:703-720`) patches text nodes in place (ADR 0007-compliant).
- **Click** (`NavigationUI.js:260-264`): comment says "Buff badge to Heroes (manage buffs)" and emits
  `ui:navigateTo 'heroes'` (switched at `:301`). The Heroes screen does not display buffs (no
  `getActiveBuffsWithRemaining` / `getCategorizedBonuses` call under `js/ui/heroes/`; grep of `js/ui`
  shows only InventoryBuffSection and NavigationUI read the buff list). The buffs UI lives in the
  Inventory panel (`ui:openInventory`), so the navigation target is wrong.
- World buffs never light the badge: its source list is the hero list only.

## 2.4 World UI

- `WorldMapUI._buffText` (`WorldMapUI.js:219-224`): used in the "Army returned" toast for
  `grants.buff` (`:215`). Copy: `+N% <resource> buff`, `+N% troop attack buff`, `+N% march speed buff`.
  Any unmatched flavor falls through to "march speed".
- `world:regionCaptured` handler: toast "Region captured" with the region name, ripple, sync, legend
  (`WorldMapUI.js:71-76`). It does not name the buff granted, although `d.buff` is in the payload.
- `PoiDetailPanel`: outpost row "Held — boon active" / "Capturable" and `Boon: +N% ...`
  (`PoiDetailPanel.js:109-111`, `_boonText :140-146`); ruin `_rewardText` for `kind:'buff'` with
  `for Nm` (`:122-129`). `_boonText` and `_rewardText` and `_buffText` duplicate the same
  flavor-to-copy mapping three times.
- There is no UI listener for `world:buffsChanged` or `world:buffGranted` (grep of `js/ui`). Timed world
  buffs are never listed anywhere, and their expiry is silent.
- Region buffs: the region's own `buff` is not rendered in any file under `js/ui/world/` (the
  `buff` grep over `js/ui` hits only the files named above).

## 2.5 Resource bar rates

`index.html:91-174` chips show a static `title="Wood"` etc. and `#r-*` rate text. `NavigationUI.js:612-615`
writes `+X.X/s` from `res.perSec` (refreshed on `resources:ratesChanged`, `:275`). There is no breakdown
tooltip: the player cannot see how the 8 multiplier layers in 1.6 produce the number. A TooltipService
exists (CLAUDE.md) but the chips do not use it.

## 2.6 Gaps

| Gap | Evidence |
|---|---|
| Territory buffs (region, outpost, timed) have no persistent UI list | 2.4; roadmap backlog `30-roadmap.md:380` |
| Badge ignores world buffs and VIP/tech/events | `NavigationUI.js:723` |
| Badge click lands on Heroes, which shows no buffs | `NavigationUI.js:261-264` |
| `Production Boost` / `all resources` hard-coded; no per-item name or icon | `InventoryBuffSection.js:56-57` |
| Inventory countdown stale (no tick listener) | `InventoryUI.js:77` |
| Timed world buff expiry/grant not surfaced | no listener for `world:buffsChanged` / `buffGranted` |
| Region-capture toast omits the buff | `WorldMapUI.js:71-72` |
| Three duplicated flavor-to-text mappers | `WorldMapUI.js:219`, `PoiDetailPanel.js:122,140` |
| No rate breakdown on resource chips | 2.5 |
| Toast says "60m" for 1 h; always "production" | `InventoryUI.js:79` |
| Roadmap tracks this as `[~]` "buff panels can still go stale" | `30-roadmap.md:202-205` |

---

# Part 3: Inventory UI

## 3.1 Structure

- `js/ui/controllers/InventoryUI.js`: 433 lines, one class mixing badge, open/close, render, detail,
  action HTML, listeners, hero picker. Over the 400-line god-file threshold in CLAUDE.md. Panel
  elements are looked up by `getElementById` in each method rather than cached in `init()`.
- `css/components/inventory.css`: 627 lines (also over the threshold); it also holds the buff-section styles (`:499+`).
- `js/systems/InventoryManager.js`: 341 lines, `Map<itemId, qty>`.

## 3.2 Tabs and types

`TABS` (`InventoryUI.js:15-21`):

| Tab | Item types |
|---|---|
| Special | `hero_card`, `hero_card_universal`, `hero_fragment` |
| Resource | `resource_bundle` |
| Speedup | `speed_boost` |
| Boost | `buff`, `xp_bundle`, `xp_card` |
| Scroll | `recruitment_scroll` |

Tabs with no items render disabled (`:170`) and show a count badge when non-empty (`:172`).
**Not in any tab:** `recruit_token`, `hero_shard`, `tier_shard`, `slot_purchase`, `automation`.
Those can be owned (`INVENTORY_ITEMS`), and they make `ownedItems.length > 0`, so the empty state is
skipped (`:137`). Tokens and tier shards are read from the Recruit tab instead
(`RecruitPanel.js:54,186`); `slot_purchase` and `automation` are handled by `ShopManager`
(`ShopManager.js:103-116`).

## 3.3 Item catalogue (`INVENTORY_ITEMS`)

Merged from `heroEconomyItems.js` and `economy.js:5-145`.

| Type | Ids | Count |
|---|---|---|
| `hero_card` | `card_hero_{warlord,archsorceress,shadowblade,paladin,junovane,kaelenthorne}` | 6 |
| `hero_card_universal` | `card_normal`, `card_epic`, `card_legendary` | 3 |
| `hero_fragment` | `fragment_<hero>` x6 | 6 |
| `hero_shard` | `shard_<hero>` x6 | 6 |
| `recruit_token` | `token_normal`, `token_epic`, `token_legendary` | 3 |
| `tier_shard` | `tier_shard_{normal,epic,legendary}` | 3 |
| `xp_card` | `xpcard_{normal,epic,legendary}` | 3 |
| `xp_bundle` | `xp_bundle_{small,medium,large}` | 3 |
| `resource_bundle` | `res_bundle_{wood,stone,food,money,iron,water,diamond}_t1..t5` | 35 |
| `buff` | `buff_prod_sm`, `buff_prod_lg` | 2 |
| `speed_boost` | `speedup_{build,train,research,universal}_{5m,15m,1h,8h}`, `speedup_universal_instant` | 17 |
| `slot_purchase` | `build_queue_expansion`, `research_queue_expansion` | 2 |
| `automation` | `cafeteria_automation` | 1 |
| `recruitment_scroll` | `scroll_{common,rare,legendary}` (retired) | 3 |

`LEGACY_ITEM_ID_ALIASES` rewrites `scroll_*` saves to `token_*` on load (`InventoryManager.js:15-21,333`).

## 3.4 Use flows (`InventoryManager.useItem`, `:208-313`)

| Type | Flow | Notes |
|---|---|---|
| `hero_card*` | `HeroManager.recruitWithCard` | UI shows "Recruit" that navigates to Heroes > recruit (`InventoryUI.js:239-252,320-327`) |
| `recruitment_scroll` | `rollScroll` if present, else "retired" | UI: disabled "Retired" button (`:234-236`) |
| `hero_fragment` | needs `heroId`; `useFragmentAsXP` | UI "to XP" button bound to the target hero; hidden if the hero is unowned (`:255-266`) |
| `xp_card`, `xp_bundle` | needs `heroId`; award XP; `xp_bundle` consumes the item | UI "Apply" opens the hero picker (`:269-271`) |
| `resource_bundle` | `rm.add(grants)` then `removeItem` | UI "Open" (`:274-276`) |
| `buff` | `removeItem` then `activateBuff` | UI "Activate" (`:279-281`) |
| `speed_boost` | validates target, calls `bm.reduceActiveTimer` / `um.reduceActiveTrainTimer` / `tm.reduceActiveResearchTimer`, then `removeItem` | UI shows hint "Use from queue" and no button (`:283-285`) |
| `slot_purchase` | grants the shop slot plus `bonus` | no Inventory UI action; shop only |
| `automation`, `recruit_token`, `tier_shard`, `hero_shard` | no `useItem` branch (falls to "cannot be used", `:312`) | |

`xp_card` is not branched with `xp_bundle` for item consumption in `useItem` (`:235-238` returns
`applyXPCard` directly); consumption is presumably inside `HeroManager.applyXPCard` and not verified here.

## 3.5 Render model

- `_render()` rebuilds `panel.innerHTML` for header, tab bar, grid and detail (`:126-203`), then re-binds
  all listeners (`_bindListeners`, `:293-384`) and re-appends the buff section.
- Called on: open, every tab click (`:305`), every tile click (`:315`), the `_clearNewItems` 3 s timer
  (`:56`), and `inventory:updated` while open, debounced 100 ms (`:72-75`). The debounce comment says it
  is there so the hero picker "isn't destroyed mid-use".
- **ADR 0007 violations:** a full innerHTML rebuild over live state (buff timers, an open hero picker
  appended outside the template at `:410`, an in-flight "NEW" highlight). Any `inventory:updated` while
  the picker is open removes it.
- Selection is `_selectedItemId` with a "detail popover" (`.inv-detail`) rendered below the grid
  (`:188-199`). Re-clicking a tile deselects it (`:314`). A tab change resets selection (`:304`).
- A selected item that falls to zero quantity disappears from the tab, so `selItem` becomes null and
  the detail closes (`:188-191`) without a message.

## 3.6 New-item badges

`inventory:updated` with `payload.rewards` (from `grantRewards`) fires `ui:rewardAnimation`, adds item ids
to `_newItemIds`, and sets `_hasNewRewards` for `#inventory-badge` (`:61-71`). Opening the panel hides
the dot at once and clears tile highlights after 3 s (`:101-107`). Closing clears everything (`:113-119`).
Resource rewards are split into tier bundles in `grantRewards` (`InventoryManager.js:112-134`), so the
highlighted tiles are the bundle items.

## 3.7 Hero picker

`_showHeroPicker` (`InventoryUI.js:390-432`) creates `#inv-hero-picker` after `.inv-detail`, lists owned
heroes with level, calls `useItem(bundleId, {heroId})`, and toasts "XP Applied!". CSS classes used by the
JS (`inv-pick-hero`, `inv-frag-actions`, `inv-convert-frag`) have no rule in `css/` (grep); the stylesheet
has `.inv-pick-btn` instead (`inventory.css:275`), which nothing in the JS emits.

## 3.8 Speed-up handling

Inventory never uses speed-ups. They are spent from queue surfaces via a shared picker
`js/ui/buildings/SpeedupPicker.js` (`openSpeedupPicker`), opened from `BuildQueueSidebar.js:109,210,296,325`,
`BuildingsUI.js:267`, `MilitaryUI.js:331,421,430`, `ResearchUI.js:334,361`, and the Trading Post
(`useOwnedItem.js:15-31`). `InventoryManager.useItem` supports `targetInstanceId` for building speed-ups
(`:208,278`).

## 3.9 Trading Post reuse

`js/ui/trading/useOwnedItem.js` is a separate dispatcher used by `SupplyTab.js:136` and
`TraderTab.js:142`:
- `speed_boost`: find the running queue (`getActiveQueues`, `activeQueues.js:21`), else toast "Nothing to
  speed up", else `openSpeedupPicker` (`:15-31`).
- `xp_bundle`: its own picker (`tp-picker`, `:33-72`). `xp_card` is not routed there, so it falls through
  to `useItem` with no `heroId` and warns "Select a hero".
- `recruit_token`/`hero_card*`: navigate to Heroes > recruit (`:6,79-85`). Same destination as the Inventory
  panel, with different type coverage (Inventory has no `recruit_token` path at all).
- Everything else: `useItem` plus toast titled via `SIMPLE_USE_TITLES` (`:7,84-86`), which labels `buff`
  "Boost Activated".

Net: use-flow logic is duplicated across `InventoryUI`, `useOwnedItem`, and the picker markup (two hero
pickers with different classes). The two surfaces already disagree on which types are usable.

## 3.10 Prior decisions and backlog

- `docs/30-roadmap.md:380`: "Region buff stacking UI (all active territory buffs in one place)", open.
- `docs/30-roadmap.md:196-199`: global buff application decided 2026-07-15; "align UI copy when the
  buff-stacking UI lands".
- `docs/30-roadmap.md:202-205`: `[~]` `world:buffsChanged` has no buff-dependent UI listener; panels can
  go stale.
- `docs/30-roadmap.md:200-201` and `161-162`: `milMult < 1` guard trap. Stale: code has no guard
  (`battleSides.js:31`).
- `docs/30-roadmap.md:159`: "universal speed-ups need caller `queueType`" listed as a known issue.
- `docs/30-roadmap.md:283-285`: Inventory redirects to the Recruit tab; the production-buff block was
  rehomed onto the Inventory panel (ADR 0028).
- `docs/10-design/world-map.md:35-52`: buffs section; its "ResourceManager has no buff wiring" bullet is
  stale (`ResourceManager.js:83-84,172-179`).
- ADR 0026:20,87: recruit tokens replace buff/resource gacha; `buffPool` retired.
- ADR 0007: no innerHTML rebuild over live state (binding for new surfaces).
- `docs/10-design/trading-post.md:24,27`: Boosts row = XP bundles + production buffs; every card shows
  owned xN and a Use button when owned.
- ADR 0027:52: legacy item-id alias map in `InventoryManager.deserialize`.
