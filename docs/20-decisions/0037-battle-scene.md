# 0037 — Battle scene: report events, full-screen playback and results

Date: 2026-10-05 · Status: accepted · Spec: `docs/superpowers/specs/2026-10-04-battle-playback-results-design.md` ·
Plan: `docs/superpowers/plans/2026-10-04-battle-playback-results.md` · Design page: `docs/10-design/battle-tab.md`

## Context

Slices 3+4 of the Battle tab: replace the playback modal with a full-screen battle scene (rows facing rows, hero bar,
timeline, round log) and a results screen (casualty layers, hero XP, "Why you lost", last-attempt comparison). The
slice-1 report's per-round `triggered` listed every *active* trigger, not firing edges, so playback could not show
"skill fired" moments. No real users: no legacy shims.

## Decision

1. **Report events replace `triggered`.** Each round is `{ round, attacker, defender, heroHits, events }`; `attacker` /
   `defender` are per-stack snapshots (dead stacks included). `events` is an ordered list:
   - `{ kind: 'heal', stackId, amount }` — defender heal ability.
   - `{ kind: 'skill', heroId, skillId, trigger }` — a firing **edge**, once per `heroId:skillId:trigger`;
     `wave_start` skills re-arm per wave (key includes the wave index); `battle_start` / `final_wave` / `losing`
     fire once per battle.
   - `{ kind: 'strike', side, fromId, row, counterMult, hits }` — one per stack per target row (`aoe_blast` strikes
     every row); `hits` = `[{ targetId, damage, kills }]`; `counterMult` is measured against `targets[0]` only, so on
     mixed rows it is representative, not exact.
   - `{ kind: 'heroStrike', heroId, hits }`.
   - `{ kind: 'revive', stackId, count }`.
2. **Outcome-identical invariant.** Adding events changed no RNG draw or battle outcome: the resolver's results for
   fixed seeds are pinned against the pre-change resolver in `resolveBattle.test.js`.
3. **`hit.damage` = HP actually removed** (capped at the target's remaining pool, no overkill), so floats show real
   loss. `kills` identity: kills = drop + revives + healed count.
4. **Pure report models** in `js/systems/combat/report/`: `battleTimeline`, `battleMoments` (+ `turningPoint`),
   `roundLog` (signature `roundLog(frame, report, moments = [])`), `battleSummary`, `defeatAnalysis`, `battleText`.
5. **Scene overlay.** `js/ui/combat/scene/` (`BattleScene`, `BattleField`, `FieldArrows`, `Timeline`, `HeroBar`,
   `RoundLogView`, `heroBarModel`, `sceneToggles`, `sceneInputs`, `readinessWarning`, `sceneSkeleton`, `ResultsView`, `resultsHtml`,
   `resultsModel`, `resultsActions`) renders on `--z-scene` (500), opaque, over the whole UI. CSS in
   `battle-{scene,field,results}.css`.
6. **Replay is in-memory only.** The scene holds the fight's report; nothing replayable is serialized. Only
   `CampaignManager.lastReport` persists (now with `wavesReached`, `bossLeftPct`, and `heroXp` on attack:
   `[{ heroId, xpGained, levelBefore, levelAfter, xpPct, unlockedSkills }]` from `awardBattleXP`).
7. **Why-lost causes** (`defeatAnalysis`, top 2 by score, ties by order armor, heal, frontBroke, heroes, roundCap,
   counter), computed on the last wave that had rounds:
   - `armor` (fix `train`): the main-damage stack's hit loses >= 50% to the enemy front row's best defense.
   - `heal` (fix `mix`): enemy healing over the last 5 rounds >= damage dealt in them.
   - `frontBroke` (fix `rows`): the front row was wiped before round 4.
   - `heroes` (fix `heroes`): any empty commander slot (score 0.5 per slot, cap 1).
   - `roundCap` (fix `train`): the wave hit `ROUND_CAP`.
   - `counter` (fix `mix`): >= 60% of enemy damage came with `counterMult > 1`.
   **Fix routing:** `train` opens Training with `buildingId = UNITS_CONFIG[unitId].buildingId` of the analysed
   main-damage stack (its trainer); `mix` / `rows` open the Barracks; `heroes` opens Hero Quarters.
8. **New events:** `battle:opening { stageId }` (scene starts a fight), `battle:closed { stageId, victory }`,
   `battle:resultsShown { victory }`. The victory/defeat sound sting moved from `combat:victory|defeat` to
   `battle:resultsShown` (a sting at deploy time spoiled the outcome); story beats are held for the duration of a
   battle (released in a `finally`, so a throwing attack cannot strand them). The defeat shake moved to
   `CombatUI._shakeNode` on the fought node.
9. **Deleted:** `js/ui/combat/BattlePlayback.js`, `battleFlow.js`, `battleResultHtml.js`, `playbackSteps.js`, the test
   `tests/unit/playbackSteps.test.js` (its subject is gone; the new models carry their own tests), and the
   `UIManager` battle banner (`_showBattleBanner`). Confetti CSS stays (used by `QuestsUI`).

### Rulings taken during the build

- **Never-led defeats** (lead <= 0 on every frame) show "Watch the fight" from frame 0 instead of a meaningless
  turning point; the spec rule applies otherwise.
- **MVP pill hidden on defeat** (the mockup's defeat screen has none).
- **`sceneInputs.js` is the one UI adapter** deriving `{ heroesBySlot, bossWaveIndex, squadHeroes, supportHeroes,
  emptySlots }`; timeline, summary, hero bar and results all read it. Hero map keys are `${unitId}_t${tier}`
  (= `UnitManager._tierKey` = the report attacker stack id).
- **`commanderModel.js` keeps three named exports** (`commanderSlots`, `placedHeroes`, `commanderModel`) — shared
  slot/hero mapping beats three one-function files. **`sceneToggles.js` keeps two** (`readToggles` / `writeToggles`).
- **Toggle defaults:** numbers, arrows and log all on; stored in localStorage `basie_battle_toggles`, any key not
  explicitly `false` reads as on.
- **`bossLeftPct`** (in `combatInputs` and `lastReport`) means the remaining HP % of the last *fought* wave, not
  necessarily a boss.
- **Hero kills, one definition everywhere** (`battleTimeline` `heroKills`, `battleSummary` hero rows): the hero's
  `heroStrike` kills plus kills of attacker `strike` events whose `fromId` is the stack that hero leads, where
  "leads" = `heroesBySlot[stackId] === heroId` (one hero per stack, even when two slots merge into one stack).
  `battleSummary` takes `heroesBySlot` (defaulting to the first hero per stack of `squadHeroes`).
- **CAME BACK vs healed:** post-battle healing (`report.healed`) returns troops after the fight, so CAME BACK can
  exceed the final playback headcount; the results screen notes `+N healed after the battle` under the casualty
  layers. Heal counts in the timeline use `ceil(amount / hp)` like the resolver.
- **Support heroes** come from `placedHeroes` (the `heroquarters_` prefix).

## Consequences

- Playback and results read one report contract; adding a trigger or ability is a new event kind plus a model line.
- Old dev saves with `triggered` reports are not migrated: reset the slot.
- **Deploy-time spoilers remain outside the scene** — NotificationManager Victory/Defeated toasts (announced by
  `aria-live` even though hidden under the opaque scene) and the `levelUp` / `missionComplete` sounds. Backlogged;
  the fix is holding them like story beats.
- Deferred minors (see `docs/40-active.md`): `survival_wave` literal in `CombatManager.js` / `data/combat.js`; no
  test pins `counterMult` values or per-row `aoe_blast` events.
