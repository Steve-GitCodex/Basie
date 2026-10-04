# Active — Session Handoff

> Most-updated file in the repo. Every session that changes code updates this file
> (what landed, known issues, exact next steps). See the session protocol in `CLAUDE.md`.
> Keep it to current state: replace finished sections with a short summary — history lives in
> git (`git log -p docs/40-active.md`) and decisions live in `docs/20-decisions/`.

## Current state (2026-10-03)

- Branch `Working_Branch`. The combat resolver is committed (`74cf629`) and the Trading Post (`8b37896`). **Uncommitted:** the
  Battle tab campaign model + map below (new `js/systems/campaign/`, `CampaignManager`, `js/entities/data/campaign.js`,
  `js/ui/combat/*`, `css/components/battle-*.css`, modified combat/unit/mail/tutorial/UI files, tests) plus the Buffs +
  Inventory research/specs/plans (docs only). Tree is commit-ready.
- Baseline: `npm test` **924/924**; `node scripts/check-comments.mjs` **12 violations, all pre-existing**;
  boot / tutorial / combat / world / heroes / trading / dev-dashboard smokes PASS; dev-smoke PASS except the known
  `dev-anchor-nudger` ("variantFile resolves the override-manifest key").

## Battle tab — campaign model + map (slices 1+2) — COMPLETE (2026-10-03)

ADR 0036 (`docs/20-decisions/0036-campaign-chapters.md`), design `docs/10-design/battle-tab.md`, spec/plan
`docs/superpowers/specs|plans/2026-10-03-battle-tab-campaign*` (left for Steve to delete once he's happy).

- **KNOWN ISSUE — Fresh-save tutorial blocker (pre-existing; PARKED by Steve 2026-10-03):** the `train` step only fills the reserve; no squad exists
  (or it's empty) at the `combat` step, so Deploy is disabled / "Empty Squad!" and the player can only Skip. Proposed fix
  (not built — needs Steve's call): a `squad` tutorial step between `train` and `combat` highlighting the Barracks tile,
  waiting on a new narrow event (e.g. `squad:unitsAssigned` from `assignToSquad`). In the roadmap backlog.
- **What landed:** max 2 slots per row (`ROW_SLOT_CAP`, `UnitManager` re-flow, Barracks toggle disables a full row); 10 chapters from
  `CAMPAIGNS_CONFIG` with generated stages (4 regular + boss + elite; boss ids = existing monster ids; `js/systems/campaign/`);
  star rules (`STAR_RULES.lossFraction` 0.25 + round par); `CampaignManager` (bestStars / firstCleared / lastReport, first-clear
  diamonds by mail); combat event payloads carry hero ids + per-round `triggered` skill events; `squadCommanders`; `trailLayout`;
  new Combat view (Campaign / Survival / Log tabs, A1 vertical trail, stage panel with squad picker, win estimate and
  Commanders); tutorial `combat` spotlight retargets from the node to Deploy. `CombatUI` split into `js/ui/combat/` modules,
  CSS into `battle-{stage,commanders,trail}.css`.
- **Tests:** unit 847 -> 925; `combat-smoke` gained stars-after-win, row-cap-toggle, report and `combat-return` blocks;
  `tutorial-smoke` gained `tutorial-combat-deploy` (incl. Deploy hit-test + campaign pane never scrolled sideways).
- **Final-review fixes (2026-10-03):** Deploy spotlight race fixed (`.combat-pane--campaign { overflow: clip }` — `hidden` let
  the spotlight's `scrollIntoView` scroll the pane sideways mid-slide, misplacing ring/blockers); returning to Combat
  re-opens an open stage panel (fresh squads / Deploy state); chosen tab kept across view returns (default only on first show
  or mode change) and the trail is patched, not rebuilt, unless its width changed; `getMonsterProgress` uses the generated
  stage (cap 5, not 999); "1 strike / round". Report: `.superpowers/sdd/2026-10-03-battle-tab-campaign/final-fix-report.md`.
- **Verification (after final-review fixes):** npm **925/925**; check-comments **12**; combat-smoke PASS (all 7 blocks);
  tutorial-smoke PASS 4/4 consecutive runs; boot, heroes PASS. Earlier in the session: world, trading, dev-dashboard PASS;
  dev-smoke fails only the known `dev-anchor-nudger`.
- **Rulings (full list in ADR 0036):** YOU marker falls back to the last completed non-elite stage, else the first; default tab
  is Survival in survival mode; locked nodes still open the panel; lock text uses config building names; tutorial spotlight
  retarget; aura chips show effective values (`auraValueFor`); chips follow `isUnlocked`/stars/scope like `collectEffects`.
- **Deferred minors:** `assignToSquad` stores default rows as "stored" so an overflowed slot can jump rows when room frees; no
  tests for merged stacks under the cap / toggle refresh; `ui:setSlotRow` rejection gives no UI feedback; stage knobs other than
  tier/regularCount unvalidated; per-stack rounding doesn't guarantee non-decreasing power; `CampaignManager.deserialize` copies
  `lastReport` unvalidated; `MailManager` imports campaign data for the stage name; empty-stages / elite-without-boss
  `trailLayout` edge cases; `squadCommanders` imports `heroCombat`; slot-lock rule duplicated
  vs `BarracksUI`; squad-to-barracks mapping mismatch (`HeroManager.barracksIdForSquad` vs squad `barracksInstanceId`, backlog);
  fog label of a locked chapter overlaps its first node; legacy `.campaign-detail*` CSS in `grid.css`/`worldmap.css` unused.
- **Slice-3 note:** the report's `triggered` lists every *active* trigger per round
  (`wave_start`/`losing` repeat each round; round implied by nesting), not activations — decide the activation format
  (`{ round, heroId, skillId }` edges) in the slice-3 spec.
- **Notes for Steve:** CLAUDE.md is stale (manager count, wiki map says battle-tab "not built") - not edited. Old dev saves:
  reset the slot (no-legacy). Stage knobs (scale, elite bump, diamonds, round par) are placeholders for the balance pass.
  Fresh-save tutorial blocker: see KNOWN ISSUE above.

## Buffs + Inventory — PLANNED, not started (2026-10-03)

Design-only session; no game code changed. Build **Buffs first**, then Inventory (Inventory uses `BuffManager`).

- Research: `docs/research/inventory-buffs-codebase.md` (every buff source, file:line), `docs/research/inventory-buffs-genre.md`
  (thin: most genre sites blocked fetches; screen layouts unconfirmed).
- Mockups: `docs/10-design/mockups/inventory-buffs/` — `buffs-v1.html` (approved), `inventory-v1.html` (**option B, modal**, approved).
- Specs: `docs/superpowers/specs/2026-10-03-buffs-design.md`, `2026-10-03-inventory-design.md`.
- Plans: `docs/superpowers/plans/2026-10-03-buffs.md` (9 tasks), `2026-10-03-inventory.md` (5 tasks).
- Decisions taken: one timed boost per stat, replace-with-confirm; Overview shows the real compounded total via shared
  `productionLayers()`; Inventory becomes a Mail-style modal; speedups from the bag reuse `SpeedupPicker`.

## Trading Post — COMPLETE (2026-10-02, latest)

ADR 0035, design `docs/10-design/trading-post.md` (mockups in `mockups/trading-post/`), spec/plan under
`docs/superpowers/` (left for Steve to delete once he's happy).

- **What landed:** one Trading Post view (Supply · Market · Premium; Market = Exchange + Wandering Trader side by side) in `js/ui/trading/`; `MarketManager`
  now Exchange only (value table, 0.15 spread, daily pressure); new `ShopManager` (Supply, daily crate; For-you picks in
  `js/systems/trading/forYouPicks.js`; VIP-by-diamonds-spent in `UserManager`) and `TraderManager` (HQ 2, timed visits, activity cut); pure modules in `js/systems/trading/`;
  `js/entities/data/tradingPost.js`; `market:traded` -> `market:exchanged`; `unit:trainingStarted`; CSS split into
  `trading-{post,supply,exchange,trader,premium}.css`.
- **Tests:** unit 747 -> 847; `tests/browser/trading-smoke.mjs` (34 checks).
- **Verification:** npm 847/847 (after the final-review wave; trading/boot/tutorial re-run PASS); trading, boot, tutorial, world, combat, heroes, dev-dashboard smokes PASS; dev-smoke
  fails only the known `dev-anchor-nudger` (twice); check-comments 12.
- **Final-review wave:** exchange rejects ('Not enough storage.') when the gain would exceed the storage cap and the
  slider max/hint follow free room; Trader pricing is cap-aware and never prices a bundle in its own resource;
  `trader:updated` now emits when activity changes `nextVisitAt`; market deserialize treats a missing/invalid
  `lastResetDate` as stale; shared helpers hoisted (`countdown.js`, `pickWeighted.js`, `buyFailureText.js`);
  `.tp-sheet*` CSS moved to `trading-post.css`.
- **Fixed after hand-off — queue sidebar covered the Trading Post's right edge:** `.tp` now reserves the pull-tab
  width always, and the open panel's width above 900px (`body:has(#bq-sidebar:not(.is-collapsed))`); new
  `--bq-panel-width` / `--bq-toggle-width` in `variables.css`, used by `sidebar.css`. Exchange chips use
  `minmax(0, 1fr)` + compact `fmt()` amounts so they no longer spill into the trader column. Smoke: 3 clearance checks.
  The same overlap on other views (e.g. Hero Quarters roster) is parked in the roadmap backlog.
- **Amended after hand-off — Exchange + Trader share the Market tab** (ADR 0035 amendment): new
  `js/ui/trading/MarketTab.js` composes both panels; old `exchange`/`trader` tab ids alias to `market`; layout rules
  in `trading-trader.css`. Smoke checks updated (tab order, shared pane, market dot).
- **Fixed after hand-off — card buttons rendered as bare text:** `.btn` has no fill or border on its own; every
  Trading Post button lacked a variant class. Cards now use `btn-gold` (coins/resources) / `btn-primary` (diamonds),
  falling back to `btn-ghost` when owned, sold or unaffordable. Use is `btn-success`; Claim, checkout and pack buttons got
  variants too. Regression check in `trading-smoke.mjs` ("every visible Supply button has a fill or border").
- **Notes for Steve:** CLAUDE.md is stale (wiki map still says `trading-post.md` "not built"; manager count 21 -> 23;
  presenter count 17 -> 16) - not edited. Sandbox x10 inflates shop
  receipts and VIP accrues free in sandbox; trader pool weights and crate table are placeholders; locked Trader tab
  shows no dot at HQ 1.
- **Deferred minors:** checkout has no focus trap; hero picker no Escape/resize teardown; banner dots rebuilt per
  rotation and clicks don't restart the interval; unescaped config strings in picker/cards; `quote.rate` unrounded;
  Trader countdown on `tick:ui` not `TimerService`; trader reseeds whole block on bad save; tab dot not re-evaluated at
  midnight while Supply hidden; `refreshDots` sets `#nav-economy` badge class directly; smoke gaps (Use flows, banner
  lifecycle, notifications, Need label / away phase, nav badge at HQ1, VIP-unchanged is trivially true);
  `forYouPicks` secsLeft unvalidated; `UIManager.js` (734 lines) is a god file (pre-existing); Trader 'unaffordable'
  toast says "Not enough funds." (shared `buyFailureText`); a bundle can still be priced in its own resource when the
  player holds nothing else (wood fallback).

## Dev mode multi-instance fixes — COMPLETE (2026-10-02)

- **Level switcher only reached copy #1:** the switcher listed building *types* and its event had no
  `instanceIndex`, so `devSetLevel` defaulted to instance 0. It also filled its list once at startup, so buildings
  built later never showed up. It now lists instances (`Barracks #1`, `Barracks #2`, values `barracks_0`…),
  refreshes the list on focus/pointerdown, and sends `instanceIndex`. A building click
  (`BuildingsUI` → `dev:buildingSelected`) now carries `instanceIndex` too.
- **Barracks #1 "No squad available":** the dev preset created its squad with no `barracksInstanceId`. That unbound
  squad used the only slot (`maxSquads` = built barracks), so `BarracksUI._squadForInstance(0)` couldn't create one.
  The preset now calls `createSquad('Squad 1', 'barracks_0')`. **Dev slots saved before this fix still hold the unbound
  squad: use Reset slot.**
- Regression test: the `dev-multi-instance` block in `tests/browser/dev-smoke.mjs` (6 checks). The two older
  switcher checks now use `townhall_0`. The `dev-anchor-nudger-from-world` flake is fixed: the test now waits for
  `#city-loading` to hide, because the loading overlay was intercepting the drag (4/4 clean runs).
- **Still intermittent (not from this work):** `boot-smoke` "city canvas rendered pixels" failed 1 of 3 runs, most
  likely the same loading race.

## Combat resolver — COMPLETE (2026-10-02)

ADR 0034 (`docs/20-decisions/0034-shared-combat-resolver.md`), design page `docs/10-design/combat.md`, spec
`docs/superpowers/specs/2026-10-02-combat-resolver-design.md`, research `docs/research/combat-model.md`.

- **What landed:** pure `js/systems/combat/` (`seededRng`, `hitMath`, `targeting`, `casualties`, `resolveBattle`,
  `battleSides`, `combatInputs`); `js/entities/data/combatRules.js`; all monsters rewritten to wave stack lineups with
  tiers; `CombatManager` is a ~308-line adapter (`attack`, `resolveMarchBattle` with `structure`, `estimateBattle`);
  hero strikers; `UnitManager` slot rows + wounded pool; `marchResolver` and the march toast carry dead and wounded;
  CombatUI estimate badge + round playback (`js/ui/combat/`); Barracks Front/Mid/Back toggle + Wounded chip
  (`js/ui/barracks/`); `tests/browser/combat-smoke.mjs` (11 checks).
- **Rulings (full list in ADR 0034):** R2 one stack per tierKey, lowest slot's row wins; R3 campaign stage wave list moved
  to stack shape; R4 a row wiped mid-round loses later damage aimed at it; R5 mutual wipe on the final wave = defeat;
  R6 first-wave triggers on the first non-empty wave, structure bonus attacker-only, `losing` vs attacker start HP;
  R7 attack bonuses inside `hitDamage`; R8 combat type = `UNITS_CONFIG` key; R9 test file named after its module.
- **Deferred minors:** `counterMult` throws if its 3rd arg is omitted; `splitCasualties` has no defaults and relies on
  lossReduction < 1; `resolveBattle` seed has no default or guard; `heroHits` damage/targetId computed at planning time
  (may overstate); no tests for `firstWaveBonus` / structure / `final_wave` / `wave_start` windows; out-of-range monster
  tier throws (a data test guards it); `wavesCleared` counts an all-zero skipped wave as not cleared; difficulty guard uses
  truthiness (`Object.hasOwn` is stricter); `setSlotRow` doesn't validate slotIndex; `stackSummary` / `battleResultHtml`
  untested; `plural()` misnamed; empty-rounds wave still sleeps; `battle-wave-counter` re-queried; lunge timeouts survive
  skip; hero hit lines show no hero name; wave summary repeats the name when stack name equals wave name; the toggle's
  `setRow` is unused; the wounded chip has no smoke assertion beyond presence; `UnitManager.js` (~957) is still a god file.
- **Verification:** unit **747/747**; combat-smoke PASS (row persists across reload, estimate badge `~N%`, squad loses
  exactly dead + wounded, wounded pool updated); boot / world / tutorial / heroes smokes PASS; check-comments 12 (baseline).
- **Note:** no migrations (no-legacy): old dev saves with the previous combat shapes may misbehave; reset the slot.

## Basie dev launcher — COMPLETE (2026-10-01)

ADR 0033. `run.bat` → `node scripts/launcher/launch.mjs [dev [slot]] [--no-open] [--port N]`. The modules
are `staticFiles`, `logView`, `watcher`, `server`, `hotkeys`, `browser`, `launch` and `client/bridge.js`.
Features:
- page-load summary lines, with missing files in red plus a bell
- in-browser errors printed in the terminal, tagged `[normal]` / `[dev:<slot>]`
- hotkeys `[o] [d] [n] [t] [v] [c] [q]`
- dev tabs auto-reload on JS/asset changes; CSS hot-swaps everywhere; normal tabs only get a note

The one game change is `window.game.log = logManager` in `main.js`. Tests: 5 unit files (+35 tests) and
`tests/browser/launcher-smoke.mjs` (9 checks). Baseline is now `npm test` **657/657**. A final review (fresh
reviewer) found 3 Important issues, all fixed: a malformed or cross-origin log POST crashed the launcher (now
Host/Origin-guarded and sanitised); Ctrl+C in the `[n]` prompt froze the hotkeys; the bridge stopped looking
for logManager after 60 s.
- **Deferred minors:** `[t]` ignores the npm exit code; DevTools attributes console errors to `bridge.js`;
  no bridge queue cap (a burst over 64 KB is dropped); `--port abc` prints a raw stack; the `index.html` watch
  dies after a rename-style save; smoke gaps (vacuous EADDRINUSE check, the CSS check can pass via fallback,
  already-running path and HEAD untested).
- **Unverified by automation:** hotkeys (raw TTY). Try `o`, `d`, `n`, `t`, `v`, `c`, `q` once by hand.
- **Note:** the launcher serves `http://localhost`, so existing saves (per-origin localStorage) stay
  visible. The harness still uses `npx http-server` on 127.0.0.1.

## Dev dashboard + persistent dev slots — COMPLETE (2026-10-01)

ADR 0032 (amends 0014). `?dev=<slot>` (bare `?dev` → `default`) now persists to `basie_dev_save:<slot>`.
The preset runs only when the slot is empty; the real save is still never touched. The four dev widgets
moved into one panel (`js/ui/dev/DevDashboard.js`), opened and closed with the 🛠 button (bottom left) or
backtick, and whether it's open is remembered. The Session section has switch slot / + New slot / Save now /
Reset slot. Supporting changes: `js/core/devSlots.js`; `SaveManager` takes an optional key; widgets'
`init()` takes a mount element. Tests: `tests/unit/devSlots.test.js`, an appended `saveManager.test.js`
case, and `tests/browser/dev-dashboard-smoke.mjs` (12 checks).

- **Fixed same session: anchor-nudger Building mode turned itself off.** `_setEditing` refused (and
  unticked the box) whenever `window.game.city._canvas` didn't exist yet. A fresh dev slot opens on the
  world view, where the city hasn't been built, so ticking it there silently did nothing. Listeners now go on
  `window` (capture) and filter to the city canvas, and the overlay hides while the base view is hidden.
  Regression test: the `dev-anchor-nudger-from-world` block in `dev-smoke.mjs`. Also: `harness.report()` no
  longer resets `exitCode` to 0 when a later block passes (it was hiding earlier failures); dashboard
  buttons/selects got readable styling; the save-status line starts from the slot's last save.
- **Flaky (pre-existing):** the `dev-anchor-nudger` block in `dev-smoke` sometimes throws reading
  `_spriteBox(slot).width` before the townhall sprite has loaded (1 run in 3). It needs to wait for the image.
- **Possible follow-ups (not requested):** delete-other-slot UI; a `dev.bat` launcher that opens `?dev`;
  persisting the popup-mute toggles per slot (they reset to muted on every boot).
- ADR tracking is Steve's call at commit time: 0027–0029 are on-disk only (gitignored); 0030 and 0031 are committed.
- The hero redesign is **complete** (Phases 0, 1, 2a, 2b, 2c, 2d + Hero Quarters UI; ADRs 0026–0031).
  Completed specs/plans under `docs/superpowers/` were deleted 2026-10-01; their decisions are in those ADRs.

## Hero Phase 2d — COMPLETE (2026-10-01)

ADR 0031 (`docs/20-decisions/0031-stat-cap-pipeline.md`) records the stat-cap pipeline, all rulings,
the eight ADR 0012 test inversions and the three skill assignments.

- **What landed:** stat-cap pipeline (`js/entities/data/statRules.js`, `js/systems/stats/statAggregator.js`:
  per-category soft caps, categories combine `1 - prod(1 - c)`, clamp to a `totalCap` < 1; lone values pass
  through exactly); hero combat entries and Aegis triggered heal; `CombatManager` losses and post-battle heal
  read the aggregate; economy globals soft-capped; `heroCapacity` 1 on `heroquarters` / `construction_hall` /
  `storehouse`; `statEffectMap` heroquarters → `baseDefense` 0.10, construction_hall → `buildSpeed`,
  storehouse → `storageCap`, townhall → `constructionCost`; `baseDefense` applied in battle;
  `js/systems/building/heroBuildModifiers.js` (build time, cost, storage); skills `field_repairs`
  +buildSpeed 0.08, `scavenge` +storageCap 0.10, `arcane_archive` +constructionCost 0.06; passive stationed
  XP (`js/systems/hero/heroPassiveXp.js`; only non-dormant postings; one batched `heroes:updated` and only on
  level-up); `notification:show` listener (Market reset toast reaches players).
- **Final-review rulings:** tech lossReduction cap raised 0.30 → 0.60 so Steel Armor Lv3–4 keeps its value;
  passive XP requires a real contribution at the posting (spec D9); passive XP no longer triggers UI rebuilds.
- **Notes for Steve:** `field_repairs` unlocks at hero Lv10 (Juno's build speed pays from Lv10); passive XP
  grants nothing below Hero Quarters level 3; real max loss reduction today is 84% (losses ≥ 16% of base);
  mid-game losses rise versus before (≈11% → ≈47% of base for the reference squad).
- **Deferred minors:** `mergeMaxBySource` can't replace a NaN-valued held entry; unknown stacking string throws a
  bare `TypeError`; aura entry pushed at value 0; `sumTriggeredEffects.lossReduction` now unread;
  `nextLevelBuildTime` hero branch untested and never applied the VIP reduction (pre-existing);
  `applyCostReduction` ceil can overshoot by 1 on float error; no value-above-cap or `baseDefense`-cap test;
  Hero Quarters building card shows +0% for Paladin (`BuildingCards` `gBonus`, grid hidden today); board shows
  "+10% base defense" whoever is posted; squad power score ignores `baseDefense`; lowering a storage cap doesn't
  refresh the resource bar; losses round to whole troops so a tiny stack can lose 0 (combat-model rework).

## Hero Quarters UI redesign — COMPLETE (2026-10-01, committed `1ef23ab`)

ADR 0030. Open follow-ups: split `tests/browser/heroes-smoke.mjs` (~550 lines, over the ~400 guideline);
dedupe tier labels / `rarityClass` / progress maths / portrait-fill CSS; smoke coverage for Pull again, View
hero, multi-spotlight skip and the tome/awaken routes; unit tests for `rarityClass` / `shardProgress` /
`fragmentProgress`; pull buttons' innerHTML rebuild drops focus; `_pityPct` unclamped; reduced motion loses
new-hero cues. The desktop queue sidebar overlapping the roster's right edge is pre-existing.

## Standing notes

- **Systems are known-buggy** (owner's assessment): roadmap ✅ means implemented, not verified. Verify
  manager behaviour before building on it. Open audit residue lives in `docs/30-roadmap.md` (Hardening →
  Systems bug audit) — don't open sessions with it (deferred until it blocks).
- **Playwright lives outside the repo** at `C:\Users\Steve\AppData\Local\Temp\claude\basie-verify\`
  (override `BASIE_PW_ROOT`); re-run `npm install playwright` there after a temp cleanup.
- **Run browser smokes one at a time**, ~3s apart (each spawns `http-server` on 8123; back-to-back runs race).
  Known flakes, pass on re-run: boot-smoke "city canvas rendered pixels", tutorial-smoke spotlight,
  dev-smoke `dev-popup-muter`, heroes-smoke Assignments-tab click intercepted by `#modal-overlay`.
- `/assets/` is git-ignored project-wide — grit PNGs live on disk only.
- `WorldRenderer.js` is ~426 lines; `worldMarkers.js` (POI-marker drawing) is the obvious extraction.
- Comment lint: the 12 remaining violations are pre-existing (`UIManager.js` tracker refs and similar).

## Next steps

1. **Commit** (Steve), then play battles and the Trading Post to feel the new curve.
2. **Balance pass — DEFERRED by Steve 2026-10-02** (fine tuning; other areas need work first). Yardstick chosen:
   hand-authored reference squads per stage (data table derived from each stage's TH / barracks / tier gates) +
   a sim script checking target win/loss bands. Probe findings (40 seeds, infantry only, no heroes/tech): monster
   stacks hold 1–20 units vs a 200-unit Lv1 barracks slot, so a full Lv1 barracks of Footmen beats stages 1–8;
   stages 5–8 need the same squad; stage 4 (`troll_bridge`, Ironclads def 60 + heals) is harder than 5–8;
   10 T10s beat stage 10.
   **Hero strikes dominate** (found 2026-10-02 while mocking the battle tab): with `HERO_STRIKE.factor` 10, two low-level
   heroes cut a 23-round fight (12 troops) to 4 rounds; a 240-troop squad with Marcus Lv22 + Kira Lv9 clears the Mutant
   Warband in 3 rounds losing 1 troop. Include `HERO_STRIKE` in the balance pass.
3. **Skill-magnitude pass** (hero skills), after the balance pass (deferred with it).
4. **Hospital** (heals the wounded pool) when wanted. Open decision: `lossReduction` (Steel Armor, loss-cut skills) keeps no troops until wounded can heal; interim rule vs. hospital first (ADR 0034).
5. Gather/march yield hero effect stays barred until the march balance pass.
6. ~~Trading Post~~ done 2026-10-02 (ADR 0035).
7. **Battle tab — PICK UP HERE next combat session.** Slices 1+2 (campaign model + map) done 2026-10-03, ADR 0036.
   - **Next: slices 3 + 4 together, one spec → plan cycle (Steve, 2026-10-03)** — same flow as slices 1+2
     (`docs/superpowers/specs/2026-10-03-battle-tab-campaign-design.md`). Design: `docs/10-design/battle-tab.md`
     "Playback" + "Results"; mockup `mockups/battle-tab/battle-final.html` screens 2 and 3.
     - Slice 3 — P1 battle-lines playback, replacing today's playback modal (`js/ui/combat/battleFlow.js`): rows facing
       rows, strength bars, attack arrows, hero bar, key-moment banners, timeline (pause/step/scrub/1×/2×/Skip), round log.
     - Slice 4 — results: victory/defeat screens, casualty layers, Commanders XP + level-ups, "Why you lost", last-attempt
       comparison from `CampaignManager.getProgress(stageId).lastReport`; "Watch the turning point" jumps the replay, so
       build playback tasks first within the plan.
     - **First decision in the spec:** report rounds carry `triggered` = every *active* trigger that round (wave_start/losing
       repeat each round), not activations — banners and "skills fired" need firing edges (`{ round, heroId, skillId }`);
       decide the format first (`js/systems/combat/resolveBattle.js` `playRound`).
   - Fresh-save tutorial blocker: **parked by Steve 2026-10-03** (see the KNOWN ISSUE above) — don't raise it in combat sessions.
   - Parked combat items: balance pass (#2, incl. the new stage knobs in `js/entities/data/campaign.js`), hospital (#4),
     squad↔barracks mapping mismatch, unused legacy campaign CSS in `worldmap.css`, fog label overlapping a node.
8. **Buffs, then Inventory**: planned 2026-10-03 (see the PLANNED section above); plans in `docs/superpowers/plans/`.
