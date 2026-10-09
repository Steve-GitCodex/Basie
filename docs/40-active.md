# Active — Session Handoff

> Most-updated file in the repo. Every session that changes code updates this file
> (what landed, known issues, exact next steps). See the session protocol in `CLAUDE.md`.
> Keep it to current state: replace finished sections with a short summary — history lives in
> git (`git log -p docs/40-active.md`) and decisions live in `docs/20-decisions/`.

## Current state (2026-10-07)

- Branch `Working_Branch`. The combat resolver is committed (`74cf629`) and the Trading Post (`8b37896`). **Uncommitted:** the
  Battle tab slices 1+2 (campaign model + map: `js/systems/campaign/`, `CampaignManager`, `js/entities/data/campaign.js`,
  `css/components/battle-*.css`) AND slices 3+4 (report events, `js/systems/combat/report/`, the battle scene in
  `js/ui/combat/scene/`, `battle-{scene,field,results}.css`, new tests and `battle-scene-smoke`; deleted
  `BattlePlayback`/`battleFlow`/`battleResultHtml`/`playbackSteps`), plus **Buffs**, the **Inventory modal** and the **Mail hub** (below).
  Tree is commit-ready.
- Baseline: `npm test` **1184/1184**; `node scripts/check-comments.mjs` **12 violations, all pre-existing**;
  boot / tutorial / combat / battle-scene / world / heroes / trading / buffs / inventory / mail / dev-dashboard smokes PASS; dev-smoke PASS except the
  known `dev-anchor-nudger`.

## Dev-session resource caps (2026-10-08)

- `?dev` now grants exactly 500M of each resource, and caps are pinned at 2B by a transient cap floor
  (`ResourceManager.setCapFloors`, re-asserted on every dev boot). See ADR 0048. Unit tests: 1143/1143. dev-smoke has a new
  check that passes; `dev-anchor-nudger` `variantFile` still fails, which was already happening before this change.

## Launcher session picker (2026-10-08)

- `run.bat` now starts only the server. It no longer opens a tab. It prints a numbered session list (normal plus every known dev
  slot), and `[l]` reprints the list and asks for a number. `[o]`/`[d]` are gone. `run.bat dev [slot]` and `run.bat normal` still open a tab.
- The page bridge POSTs `listDevSlots(localStorage)` to `/__basie/slots` on load and whenever the list changes (2 s poll). The launcher
  saves it to the gitignored `.basie-launcher-slots.json` so the list is ready at the next startup. The slot list is per origin, so a
  slot only appears after a tab on that port has loaded once since the slot was created. See ADR 0049. `npm test` 1155/1155; launcher smoke PASS.

## Hero level-up sheet — COMPLETE (2026-10-08, uncommitted)

Plan `2026-10-07-hero-levelup-sheet.md` (ADR 0046). Design: `docs/10-design/hero-levelup.md`.

- **What landed:** `js/systems/hero/heroXpPlan.js` (pure: `xpToNext` single source, `HeroProgression.xpToNext` delegates; `project`, `xpNeeded`, `autoPick`).
  `js/ui/heroes/LevelUpSheet.js` + `levelUpRows.js` + `css/components/hero-levelup.css`: steppers, preview, Next level / Fill to cap / Clear,
  Fragments never auto-picked, waste warning, empty state, `role=dialog` focus handling. Mounted on `document.body` at `calc(--z-nav + 20)`;
  desktop = viewport-fixed 420px right panel, phone (<=700px) = bottom sheet. Closes on Escape, shade, or `ui:viewChanged` away from heroes;
  re-syncs in place on `inventory:updated` / `heroes:updated` / `building:completed`.
- **Use:** one `useItem` per row; stops before a row once the hero hits `levelCap` (remaining items stay owned).
  `levelUpCoalescer.js`: HeroesUI merges `hero:levelUp` per hero per tick into one "<name> Lv a → b" toast (also battle XP); the sheet toasts "+N XP" only when no level crossed.
- **Hero detail:** Tome buttons and `XP_BUNDLES` removed; Level up / Max level button (disabled at cap). `HeroManager.levelCap()` is a public read.
- **Inventory:** hero picker removed (chips, `_heroes`/`_heroId`, picker CSS). XP items show "Used from the hero screen" + "Level a hero ›"; fragments of owned heroes "Open <hero> ›"
  (`ui:navigateTo` heroes + `ui:openHeroDetail`); unowned-hero fragments keep progress + Recruit. `useItemFlow` 'hero' action navigates to Heroes (Trading Post Use routes there too).
  Dead CSS removed (`.btn-xp-bundle`, `.xp-qty-badge`, `.hero-xp-hint`, `.inv-hero-picker`, `.inv-picker-*`).
- **Tests:** `heroXpPlan.test.js`, `levelUpCoalescer.test.js`; browser step modules `heroLevelupSteps.mjs` (heroes-smoke) and `inventoryRouteSteps.mjs` (inventory + trading smokes).
  `npm test` 1184/1184; check-comments 12 (pre-existing); heroes (3 consecutive), boot, tutorial, trading smokes PASS.
- **Known issues:** inventory-smoke 'full storage preview shows requested amount and room per resource' fails, and also failed before this plan (likely the dev cap floor, ADR 0048).
  Desktop sheet is a right panel, not over the info column (CSS-only to change). At cap with XP wasted the gain bar fills to 100%. Double-click on Use may leak a click under the closed sheet (parked).
  Item list is frozen at sheet open; LevelUpSheet bus subscriptions are never removed (singleton). No smoke for the HQ-upgrade cap refresh; the "+N XP" toast text has no automated check.
- **Next steps:** Steve commits. Fix the inventory-smoke storage-preview failure in a separate session. Remaining plans: 2, 3, 4.

## Building levels: safety foundation — COMPLETE (2026-10-08, uncommitted)

Plan `2026-10-07-building-levels-safety.md` (ADR 0044), run subagent-driven; final review Ready.

- **What landed:** `js/systems/building/buildingCurve.js` + data `js/entities/data/buildingCurve.js` (`BUILDING_CURVE`,
  `ERA_HQ`, `HQ_MAX = 30`). Every cost and time site (BuildingManager charge + price, BuildingInfoPanel, tutorial estimate in
  ResourceManager) uses `upgradeCost`/`upgradeTime`. `buildingRules.scaleCost` and every `costMultiplier` are deleted.
  `levelTable.js` replaces silent `?? 0`/`?? null`/`Math.min(level-1, …)` lookups and throws `<id>.<field>: no entry for level N`;
  `trainingSlots.js` (`trainingSlotAt`/`levelStatsAt`, null at level 0) consolidates the training-slot and Rally Point lookups.
  Cafeteria reads `house.populationCapacityPerLevel`. `gameData.test.js` validates every per-level table against `maxLevel`.
- **Balance:** HQ 1–10 cost and time are unchanged exactly. **Non-HQ buildings now use the 1.65 curve** (their multipliers were 1.6–2.5),
  so high-multiplier buildings such as Hero Quarters are much cheaper at L10. This is intended by ADR 0044; plan 2 trims base costs.
  The Info panel now shows the floored price that is actually charged (it used to round).
- **Data gaps:** none. Every table already covered `maxLevel` (Rally Point `maxLevel` is 6 with 6 rows).
- **Tests:** `npm test` 1171/1171; check-comments 12 (pre-existing); boot / tutorial / heroes / world smokes PASS.
- **Carry into plan 2 (scale):** `bandedFactor` plateaus silently past the last band's `upTo` (add a guard test: last band ≥ `HQ_MAX`
  and ≥ every `maxLevel`); the HQ parity test in `buildingCurve.test.js` hard-codes `1.65`/`< 10` on purpose; add `levelCap`
  clamp tests and `trainingSlotAt`/`levelStatsAt` unit tests; `MilitaryUI._slotData` is still a hand-written slot lookup;
  `levelStatsAt` could move to a neutral file name. Tiny tidies: the regex in `buildingEconomy.test.js` (`\.` inside a template
  literal) and a dynamic `import()` in `buildingCurve.test.js`.
- **Next steps:** Steve commits. Next plan: `2026-10-07-building-levels-scale.md` in a fresh session.

## PENDING PLANS — read this first (2026-10-07)

Five plans were written; A, B and 1 are built. Each one is self-contained (spec links, constraints, failing tests first,
checkpoints).

**One plan per session (Steve's rule).** Never run two plans in one session, and never run a plan in the session that
wrote it. **How to run one:** open a fresh session and say, for example, "implement
`docs/superpowers/plans/<file>.md` with subagent-driven development". The session invokes
`superpowers:subagent-driven-development`: one implementer subagent per task, a reviewer per task, then a whole-branch
review. Every task ends with "tree is commit-ready"; **Steve commits between tasks/plans, and agents never commit.**
Follow the session protocol in `CLAUDE.md`, which means updating this file and ticking the roadmap at the end.

| # | Plan | Depends on | What it does |
|---|---|---|---|
| A | `2026-10-07-topbar-two-tier.md` | none (independent) | **BUILT 2026-10-08** (ADR 0041, 0047). Responsive two-tier header, compact values, chip popover |
| B | `2026-10-07-hero-levelup-sheet.md` | none (independent) | **BUILT 2026-10-08** (ADR 0046). Hero XP items are spent only from the hero page, through a Level up sheet (steppers, preview, Next level / Fill to cap). The Inventory and Trading Post route to Heroes (ADR 0046) |
| 1 | `2026-10-07-building-levels-safety.md` | none | **BUILT 2026-10-08.** Shared `buildingCurve.js`, `levelTable` (no silent 0/null), per-level table validation. HQ 1–10 unchanged; non-HQ buildings moved onto the shared curve. |
| 2 | `2026-10-07-building-levels-scale.md` | 1 | Max levels to 30, cap rule, HQ chain, tables to 30, gate remap `M`, prod/crates, UI for 30 rows, progression smoke, extensibility guard tests (ADR 0044) |
| 3 | `2026-10-07-power-stat.md` | 2 (A optional) | `powerMath` + `PowerManager`, enemy power in the stage generator, monster rescale (ADR 0043), profile split + Power block, top-bar power, battle-report power, gauge (campaign panel + anchored world card) (ADR 0045) |
| 4 | `2026-10-07-player-levels.md` | 2 (3 recommended first, for the Profile Level block) | Level curve, cap and bank, new XP sources, march/survival XP limits, rewards, queued level-up deck (ADR 0045) |

**Order:** A and B can run any time. Run 1 → 2 → 3 → 4. **Never raise a `maxLevel` before plan 1 lands**, or storage silently
drops to 0 and marches stop.

**Built to extend:** the campaign (chapters 11+) and a post-30 band are data appends, guarded by tests in plans 2–4.
See "Built to extend" in `building-levels.md` and `power-levels.md`.

**Deferred to the backlog:**
- chapters 11–12;
- a post-30 band;
- research depth for Workshop 19–30;
- march gathering scaling;
- building art for eras 2–4;
- storage pressure;
- the chapter 4 heal and cavalry ×2.2 balance.

## Power + player levels — RESEARCH (2026-10-07, no code changed)

- `docs/research/power-levels-genre.md` (genre; sourcing thin, labelled) and `docs/research/power-levels-codebase.md`
  (current XP/level code, power inputs, events, open questions).
- Key facts: no power stat; level gates nothing real (HQ/building levels do); curve `500×1.4^(L-1)` uncapped;
  `lineupPower` exists for monsters only; `userManager.test.js` has no level tests.
- **Decided:**
  - Level = activity + rewards meter (HQ stays the gate). Power is combat-weighted, with buildings and other research
    capped. Wounded troops don't count until healed.
  - Power is used in: top bar + profile, recommended power, an AI hook, and battle reports.
- **Prototype:** `docs/10-design/mockups/power-levels/power-v1.html`. Choices:
  - Breakdown **A** (stacked bar + expandable list).
  - Recommended power **B** (squad-vs-enemy gauge plus the existing win % from `estimateBadge`; chip on markers and list
    cards).
    - **World map:** tapping a marker pops the gauge card attached to the target. It reuses the `TileTooltip._position`
      idiom (flip above/below, 8px viewport clamp, arrow) with `WorldCamera.worldToScreen` and re-places on camera
      `onChange`, hiding when the target is off-screen. It replaces the docked `PoiDetailPanel`.
    - **Campaign:** keeps its own stage panel (`battle-tab.md`), with the gauge inside it.
  - Level-up **A** (celebration card; replaces the level-up mail).
- **Level-up queue rule:**
  - Level-ups are queued and never pop during the battle scene/playback, a tutorial step, a confirm dialog or an open
    modal.
  - On release they show as a deck of cards, one per level (lowest on top, "1 of N"), with Collect (next card) and
    Collect all.
  - Closing without collecting keeps the rewards waiting. A pip on the plate shows the waiting count.
- **Formula draft landed:** `docs/research/power-levels-formula.md` (not locked).
  - Troop power is √(effective hp × atk²/(atk+120)), validated on 877 resolver fights.
  - Enemies use the same metric (replacing `lineupPower`); recommended power = 1.2 × enemy power.
  - Buildings and research are capped at 25%.
  - Curve: `80+150(L-1)+5(L-1)²`, capped at 5×HQ, with an XP bank.
  - **Blocking finding:** monsters are 15×–1,350× weaker than a plausible army at their gate, so every recommendation
    would read green until monsters are rescaled.
- **Ruled:** rescale monsters now (ADR 0043); level cap 5×HQ with an XP bank; new XP from buildings, research and
  training (daily cap); march XP daily limit then 10%. Design page `docs/10-design/power-levels.md`, ADR 0045.
- **Profile placement:** placement 1, power inside the existing Profile tab (Level · Power · Statistics blocks). Recorded in `power-levels.md`.
- **Building levels decided (ADR 0044):**
  - HQ 30, about 42 days for a completionist, nothing past 30.
  - One shared curve (HQ 1–10 unchanged).
  - Proportional HQ cap, and the HQ chain from HQ 10 (Workshop + a rotating partner).
  - The content remap `M = [1,2,4,6,9,12,15,18,22,26]`.
  - Design page `docs/10-design/building-levels.md`. Research `docs/research/building-levels{,-codebase}.md`.
- **Re-fitted for HQ 30:** `power-levels.md` (level-cap table to 55, building XP `0.3·L²`, era-based troop
  equivalents and money cap) and the ADR 0043 amendment (monster targets at the new gates).
- **Plans (build order):**
  1. `2026-10-07-building-levels-safety.md`
  2. `2026-10-07-building-levels-scale.md`
  3. `2026-10-07-power-stat.md`
  4. `2026-10-07-player-levels.md`

  Mail and the top bar are built.

## Top bar — COMPLETE (2026-10-08, uncommitted)

ADR 0041 (built) + ADR 0047 (as-built divergences), design `docs/10-design/topbar.md`, plan `2026-10-07-topbar-two-tier.md`.

- **What landed:**
  - Responsive `--header-height` (48 / 86px + safe-area inset), two tiers at 700px and below, `--six` cell mode for the cafeteria.
  - Single-line pill chips with a 2px fill bar (cap text hidden, exact numbers in the popover); near and full states.
  - Chip popover with rate and "Full in", a disabled storage action, money and diamond routes.
  - Cafeteria hover tooltip and popover (Restock, Open cafeteria); `BuildingManager.getCafeteriaDepletion()`.
  - Mouse-only tooltips on popover chips (`data-tooltip-mouse-only`, `TooltipService`).
  - Commander popover (plate: name, Level, XP, VIP, Profile button) and buff popover (Active buffs list, Open buffs button);
    every header element opens the same single popover. The plate's direct profile click and the badge's direct click are gone.
  - Buff badge reserved width. Dead `sb-*` writes, `#btn-settings` binding and `.hud-rail*` removed.
- **New files:** `js/ui/hud/{hudFormat,ResourceChips,PlayerPlate,ChipPopover,cafeteriaPopover,commanderPopover}.js`,
  `js/ui/buffs/buffPopover.js`, `css/components/chip-popover.css`,
  `tests/browser/{hud-smoke,hudCafeteriaSteps,hudCommanderSteps,hudBuffSteps}.mjs`,
  `tests/unit/{hudFormat,cafeteriaPopover,commanderPopover,buffPopover}.test.js`.
- **Tests:** `npm test` **1155/1155**; check-comments **12** (pre-existing); hud-smoke, buffs-smoke, boot-smoke and
  tutorial-smoke PASS. The hud smokes clear dev cap floors (`rm.setCapFloors?.({})`) before setting caps (ADR 0048 floors caps
  at 2B under `?dev`).
- **Deferred minors:**
  - `ratesChanged` shares the popover tick throttle.
  - `resize` closes the popover on a mobile URL-bar height change.
  - No smoke for a popover open across the 700px tier.
  - The 701-800px band caps the name at 9ch.
  - Pen input counts as non-mouse.
  - The hud-smoke touch check launches its own browser outside `withPage` error capture.
  - `emptyInSec` takes the max over instances, which overstates when stock is uneven.
  - Cafeteria Restock is a UI-side write (`bm.restockCafeteria`); an intent event or `bm.restockAllCafeterias()` would fix the
    ADR 0001 drift.
  - The commander popover re-places on every `user:xpGained` event.
  - The hud smokes hide a `#modal-overlay` left open by earlier buff steps (test leakage).
  - ChipPopover's long-lived listeners are never unsubscribed (guarded by `_key`).
  - `UIManager.js` (743) and `NavigationUI.js` (615) are pre-existing god files.
- **Known issues (for the ADR 0048 owner, not the top bar):**
  - `inventory-smoke` "full storage preview shows requested amount and room per resource" fails: under the new floors the dev
    stockpile (500M) no longer overflows its cap (2B), so there is no "storage room" text.
  - `trading-smoke.mjs:~267` calls `setCap` under `?dev` without clearing the floors.
- **Next steps:** Steve commits. Power slot on the plate waits for plan 3 (power stat). Run the remaining pending plans.
- **Env note:** Playwright had to be reinstalled at `BASIE_PW_ROOT` (the temp dir was wiped): `npm install playwright` +
  `npx playwright install chromium` there.

## Shared panel frame — DONE (2026-10-07, uncommitted)

- Mail and Inventory now use one frame (ADR 0042): tokens `--panel-modal-w`/`--panel-modal-h` in `variables.css`, one rule in
  `modals.css` for `.mail-modal` + `.inv-modal-host`; at ≤700px both are full width, top to `--dock-clearance`. Per-file sizing
  removed from `mail.css`/`inventory.css`; Mail's dock padding/toast offset removed.
- `mail-smoke` +2 checks (same `#modal-content` rect desktop + phone), now 23. Inventory, buffs smokes PASS.

## Mail hub — COMPLETE (2026-10-07, uncommitted)

ADR 0040 (built), design `docs/10-design/mail.md`, plan `docs/superpowers/plans/2026-10-07-mail-hub.md`.

- **What landed:** pure `js/systems/mail/mailCategories.js`; `MailManager` gains `claimAll`, `trashMany`/`restoreMany`,
  `markReadMany` (renamed), `counts()`, 7-day trash purge on load, `msg.report` from the combat payload; archive / `delete` /
  `icon` / `_inferType` / emoji subjects removed; welcome mail `gold` → `money`. `MailUI.js` (431 → 93 lines) is a shell over
  `js/ui/mail/` (hub, list, row, expand, battle report, actions, list menu, Undo toast). New generic `js/ui/confirmDialog.js`.
  Escape now closes `swapModal` panels only (system `openModal` modals like Daily Login are exempt; `SpeedupPicker` now
  `preventDefault`s its Escape). Mail CSS moved out of `modals.css` into `mail.css` +
  `mail-expand.css`; `confirm-dialog.css` new. `window.game.notifications` exposed for smoke spies.
- **Tests:** unit +19 (`mailCategories.test.js` new, `mailManager.test.js` appended); `tests/browser/mail-smoke.mjs` new (21 checks, 23 with the frame checks).
- **Verification:** npm 1123/1123; check-comments 12 (pre-existing); mail, inventory, boot, tutorial, buffs smokes PASS.
- **Final review (Opus) deferred minors:** Escape with the ⋯ menu open closes Mail; Delete read is a no-op in Starred; trash purge
  only on load; ages don't tick while open; confirm dialog has no focus trap/return; scroll-keep check is weak (relies on
  scroll anchoring); daily-login mail still passes a dead `icon:`.
- **Known gaps:** no Attack again button in the report (no stage route stored); tutorial-smoke does not assert the welcome mail;
  `ChallengeManager` and the daily-login mail in `UIManager` still put emoji in subjects and pass a now-ignored `icon`.
- **Next:** Steve reviews/commits; then the top bar plan (`docs/superpowers/plans/2026-10-07-topbar-two-tier.md`).

## Top bar + Mail redesign — RESEARCH + PROTOTYPES (2026-10-07, no code changed)

- **Research:** `docs/research/topbar-mail-genre.md` (genre + MDN/WCAG/APG; genre half thin, labelled) and
  `docs/research/topbar-mail-codebase.md` (current HUD/Mail map, mail usability friction table, constraints).
- **Prototypes:** `docs/10-design/mockups/topbar-mail/topbar-v1.html` (A one strip + priority overflow, B two tiers on
  narrow, C commander plate; desktop/tablet/phone frames, early/mid/late value presets) and `mail-v1.html` (A tabs + sticky
  claim bar, B category hub + in-place expand, C single feed + reward tray + select mode; interactive desktop + phone).
- **Key facts:** header has no breakpoint below 768px and silently scroll-clips chips; rate/cap invisible on touch. Mail
  rebuilds via innerHTML on every keystroke (search loses focus), has no claim-all/bulk UI (manager methods exist), no
  Escape, no responsive layout, unescaped subject/body.
- **Mail decided:** option B, category hub with in-place expand → `docs/10-design/mail.md`, ADR 0040.
- **Top bar decided:** option B, two tiers at ≤700px → `docs/10-design/topbar.md`, ADR 0041. No player power stat exists;
  the plate slot stays hidden until one is designed.
- **Plans written:** `docs/superpowers/plans/2026-10-07-mail-hub.md` (5 tasks) and
  `docs/superpowers/plans/2026-10-07-topbar-two-tier.md` (5 tasks). They are independent and can run in either order.
- **Next — top bar build order:** move header rendering out of `NavigationUI.js` into `js/ui/hud/` → responsive
  `--header-height` (48/86 + safe area) and check every consumer → two-tier CSS + compact values + chip popover → delete
  dead header CSS/JS → `hud-smoke.mjs` at 1280/360 + retest tutorial.
- Mail is built (section above).

## Battle tab — playback + results (slices 3+4) — COMPLETE (2026-10-05)

ADR 0037 (`docs/20-decisions/0037-battle-scene.md`), design `docs/10-design/battle-tab.md`, spec/plan
`docs/superpowers/specs|plans/2026-10-04-battle-playback-results*` (left for Steve to delete once he's happy).

- **What landed:** resolver rounds carry per-stack snapshots + ordered `events` (heal / skill edge / strike / heroStrike /
  revive; replaces `triggered`, outcome-identical); pure report models in `js/systems/combat/report/` (timeline, moments +
  turning point, round log, summary, defeat analysis, text); `awardBattleXP` returns per-hero results (`heroXp`);
  `lastReport` gains `wavesReached`/`bossLeftPct`; full-screen battle scene in `js/ui/combat/scene/` on `--z-scene`
  (rows facing rows, arrows, floats, hero bar, timeline with pause/step/scrub/1x/2x/Skip, round log, toggles) and results
  (casualty layers, hero XP, why-lost with fix routing, last-attempt comparison, "Watch the turning point"). Old modal,
  `BattlePlayback`, `playbackSteps`, `battleResultHtml`, `battleFlow` and the UIManager battle banner are deleted. New events
  `battle:opening` / `battle:closed` / `battle:resultsShown` (victory/defeat sting moved there; story beats held during a battle).
- **Tests:** unit 925 -> 1041 (new: battleTimeline/Moments/Summary, roundLog, defeatAnalysis, heroBarModel, sceneInputs,
  resultsModel/Html/Actions; `playbackSteps.test.js` deleted with its module; `resolveBattle` triggered assertions rewritten
  to events); `tests/browser/battle-scene-smoke.mjs` (+ `battleSceneSteps.mjs`) new; `combat-smoke` updated to the scene ids.
- **Verification (2026-10-05, after final-review fixes):** npm **1048/1048**; check-comments **12** (pre-existing); combat-smoke
  PASS x3 (Skip is now optional: a 1-round fight can auto-play to results first), battle-scene, tutorial, boot PASS;
  dev-smoke fails only the known `dev-anchor-nudger`. Final-review fixes: one hero-kills definition (led-stack kills),
  heal count `ceil`, `+N healed after the battle` note, defeat-comparison guard, `BattleField` moment timer cleared on close.
- **Rulings (full list in ADR 0037):** never-led defeats show "Watch the fight" from frame 0; MVP pill hidden on defeat;
  `roundLog(frame, report, moments = [])`; `hit.damage` = HP actually removed; one `sceneInputs` adapter; `commanderModel` 3
  exports, `sceneToggles` 2; toggles default on (`basie_battle_toggles`); `train` fix opens Training for the main-damage stack's
  trainer, `mix`/`rows` Barracks, `heroes` Hero Quarters.
- **Deferred minors:** no test pins `strike.counterMult` or per-row `aoe_blast` events (`counterMult` is vs `targets[0]`);
  `wavesReached` `?.i + 1 || 0` obscure, `poolOf` duplicated, `xpGained` reports the full award when capped mid-award; heal count
  rounds to 0 on small heals, heal only on the defender side; roundLog repeats revive/heroKill on the moment line, no plurals
  ("1 Soldiers"); stars from `report.dead` vs rules from layers (one source safer), "(25%)" shown on a 25.4% fail; `waveIndex`
  guard repeated 4x in the report models; support card and story-hold release on a throwing attack have no automated test;
  smoke writes `heroes._owned` directly and its turning-point check only matches the label; `pivotOf` treats a frame-0-only
  defeat as never-led; phone timeline label "WAVE 2 · BOSS" was clipped (fixed in T9, re-check on devices);
  `'survival_wave'` literal remains in `CombatManager.js` / `data/combat.js`.
- **Final fix pass (2026-10-07):** double-click guarded by `_busy`; Mail builds in `onShown`; fragments only target their own
  hero (else progress + Recruit; `useItem` rejects other heroes); `awardHeroXP` returns `gained` and capped heroes keep the
  items ("Hero is at max level."); detail stacks under the grid below 720 px; sort is rarity desc, tier (`_tN` / `skipSeconds`),
  name; items arriving in an empty tab select the first tile; owned hero cards show a disabled "Owned" / "All Owned".
- **Fixed after hand-off (2026-10-07) — dock clicks queued modals:** with the Inventory open, the Mail dock button (above
  `--z-modal`) queued Mail instead of replacing the Inventory, and each extra click queued another Mail that reopened after
  every close. New `swapModal` in `uiUtils.js` replaces the visible modal; Mail, Inventory and Profile use it. The backdrop
  listener is now tracked (was `{ once: true }`, consumed by the first click inside the content). Preview line lost its
  leading `→`. Regression: inventory-smoke `dock swaps mail and inventory without queueing`; two queue-era checks re-pointed
  to swap semantics (`inventory from dock replaces mail, wired`, `mail replaces inventory and renders`).
- **Notes for Steve:** deploy-time spoilers still fire outside the scene (Victory/Defeated toasts, announced via aria-live;
  `levelUp`/`missionComplete` sounds) — backlogged. Old dev saves with `triggered` reports: reset the slot (no-legacy). CLAUDE.md
  is stale (wiki map says the battle tab is not built) — not edited. Slices 1+2 and 3+4 are both uncommitted.

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
- **Slice-3 note (resolved):** the activation format became firing-edge `skill` events (ADR 0037).
- **Notes for Steve:** CLAUDE.md is stale (manager count, wiki map says battle-tab "not built") - not edited. Old dev saves:
  reset the slot (no-legacy). Stage knobs (scale, elite bump, diamonds, round par) are placeholders for the balance pass.
  Fresh-save tutorial blocker: see KNOWN ISSUE above.

## Buffs — COMPLETE (2026-10-07)

ADR 0038 (`docs/20-decisions/0038-buffs-ledger.md`), design `docs/10-design/buffs.md` (mockup
`mockups/inventory-buffs/buffs-v1.html`), spec/plan `docs/superpowers/specs|plans/2026-10-03-buffs*` (left for Steve to delete
once he's happy). Run ledger: `.superpowers/sdd/2026-10-03-buffs/progress.md`.

- **What landed:** `BuffManager` owns timed item boosts (one per stat, replace) and `buffs:changed`; the HeroManager buff
  methods are gone. Shared `js/systems/resource/productionLayers.js` (`ResourceManager.getRateBreakdown`); pure ledger +
  `worldBuffStat` in `js/systems/buffs/`; stat catalogue `buffStats.js`; Buffs panel (Active + Overview), HUD badge, replace
  confirm, toasts and resource-chip tooltips in `js/ui/buffs/`; `css/components/buffs.css`. `TimerService` gained opt-in
  `data-timer-format="duration"`. `InventoryBuffSection.js` and the Inventory buff footer are deleted.
- **Tests:** unit 1048 -> 1087 (new: buffManager, buffText, buffLedger, ledgerSources, productionLayers, worldBuffStat,
  appended resourceManager/inventoryManager/userManager/gameData cases); new `tests/browser/buffs-smoke.mjs` (9 checks, ~64 s,
  a 90 s toast poll behind the dev-slot toast backlog).
- **Verification (2026-10-07):** npm **1087/1087**; check-comments **12** (pre-existing); buffs-smoke PASS x3; boot, tutorial,
  world, trading smokes PASS.
- **Rulings (full list in ADR 0038):** difficulty and event layers compound their entries, others add (behaviour-preserving);
  `worldBuffStat` in `js/systems/buffs` (systems don't import UI); badge/tooltips split out of the 773-line `NavigationUI`;
  replace-confirm reachable only from the future Inventory modal; "Get in Supply" emits `ui:openTradingTab { tab: 'supply' }`.
- **Forced edits to existing tests:** `heroManager` L10 test renamed "deserialize without owned does not throw" (buff asserts
  dropped); dead mock keys removed in `resourceManager.test.js` (`getActiveProductionMultiplier`) and `CombatManager.test.js`
  (`productionBuffMult`); `heroes-smoke` Inventory assertion flipped to expect no buff block.
- **Fixed in passing:** BuffsUI did not re-render on `inventory:updated` (stale Use buttons while open).
- **Deferred minors:** `deserialize` doesn't check saved stat against the item config, `isBuffConfig` doesn't validate finite
  value/duration; `formatPct`/`formatRemaining` lack a `Number.isFinite` guard; `TimerService` imports `buffText`
  (`formatRemaining` could live in `uiUtils`); event modifier label truncates ids containing ':'; ledger `sourceId` is the
  field key (rows must key on kind + id + stat); `buffSnapshot.js` has no unit test; event effect keys are mapped
  unchecked; `_toggleStat` full re-render loses keyboard focus; Overview source clocks are static between events;
  `!important` and hsl/rgba literals in `buffs.css`; failed activation surfaces as an unhandled rejection; badge ring is full
  when `startedAt` is null; `resourceChipTooltips` leaves `d.name` unescaped (static data); tooltips build the ledger twice
  per event; an expedition grant shows both "Army returned" and "Buff gained" toasts and `NotificationManager`
  `MAX_VISIBLE=1` can delay them; smoke has fixed 200-300 ms sleeps and a weak z-compare in check 5.
- **Final fix wave (2026-10-07):** `resources:ratesChanged` gated on a rate-multiplier signature (`js/ui/buffs/buffEvents.js`; panel no
  longer rebuilds per tick, 0 body mutations in 3 s idle); Trading Post Use and legacy Inventory Activate route through
  `activateBoostItem` (confirm above the legacy panel via `--z-confirm`); tech flat `defenseBonus` no longer mapped to a %; Buffs
  panel above the dock (`--z-nav + 20`); chip tooltip names escaped; toggled Overview row keeps focus. Tests: npm **1090/1090**,
  buffs-smoke now 10 checks (supply Use prompts); boot/tutorial/heroes/trading smokes PASS.
- **Notes for Steve:** CLAUDE.md wiki map (no `buffs.md`) and manager count (23 -> 24) are your call - not edited. Old saves'
  `heroes.activeBuffs` is ignored (no-legacy). `InventoryUI.js` is now a 162-line shell over `js/ui/inventory/*`.

## Inventory — COMPLETE (2026-10-07)

ADR 0039 (`docs/20-decisions/0039-inventory-modal.md`), design `docs/10-design/inventory.md` (mockup
`mockups/inventory-buffs/inventory-v1.html` option B), spec/plan `docs/superpowers/specs|plans/2026-10-03-inventory*` (left for
Steve to delete once he's happy). Run ledger: `.superpowers/sdd/2026-10-03-inventory/progress.md`.

- **What landed:** the bag is a Mail-style modal (`InventoryUI.js` shell + `js/ui/inventory/*`); tabs All, Resources, Speedups,
  Boosts, Heroes, Other; shared `js/ui/items/useItemFlow.js` (Trading Post `useOwnedItem` is a thin call, its hero picker is
  gone; hero items open the Inventory); batch `useItem({ qty, heroId })` / `previewUse` with the `lost` over-cap report
  (`js/systems/inventory/itemYield.js`); XP items via one `awardHeroXP` (`HeroManager.useFragmentAsXP` / `applyXPCard` now unused
  by the inventory, kept with their own tests). `openModal` gained an `onShown` hook; dock panels use `swapModal` (see fix below). Old
  slide-in panel, `InventoryBuffSection.js` and dead CSS removed.
- **Tests:** npm **1104/1104** (was 1090; `inventoryTabs` new, appended inventoryManager cases); new
  `tests/browser/inventory-smoke.mjs` (12 checks). Forced edits: `inventoryManager.test.js` xp_card case repointed to
  `awardHeroXP`; `heroes-smoke` Inventory flow now picks the hero chip before Use.
- **Verification (2026-10-07):** npm 1104/1104; check-comments **12** (pre-existing); inventory, trading, boot, tutorial, heroes
  (and buffs) smokes PASS.
- **Deferred minors:** `useOwnedItem` returns an unawaited promise in SupplyTab/TraderTab, and an unhandled rejection if
  `useItemFlow` rejects in `_run`; `RARITY_RANK` also ranks uncommon; no unit coverage of `useItemFlow` (smoke only);
  `joinEntries` param `sep` is a formatter; `InventoryHeader.js` exports a const plus a class; `.modal-close` no longer emits
  `ui:click` sound; boost chip, hero chips and speedup/boost remaining text are static between events; `InventoryUI.js` 162 lines vs 150 target;
  stepper buttons enabled at bounds; non-qty buttons re-enable mid-cooldown after `show()`; recruit act calls `_onClose` then
  `_run`; smoke disables pointer-events on `#notification-container`.
- **Notes for Steve:** the CLAUDE.md wiki map should list `inventory.md` and `buffs.md` (not edited).

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
- hotkeys `[l] [n] [t] [v] [c] [q]` (session picker, ADR 0049)
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

1. **Commit** (Steve), then play battles (the new scene + results) and the Trading Post to feel the new curve.
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
7. **Battle tab redesign — COMPLETE** (slices 1+2 ADR 0036, slices 3+4 ADR 0037, 2026-10-05). Remaining combat items: the
   balance pass (#2, incl. the stage knobs in `js/entities/data/campaign.js` and `HERO_STRIKE`), hospital (#4), the backlogged
   deploy-time spoilers (Victory/Defeated toasts, `levelUp`/`missionComplete` sounds fire before the results reveal), and the
   parked fresh-save tutorial blocker (see the KNOWN ISSUE above — don't raise it in combat sessions). Also parked:
   squad↔barracks mapping mismatch, unused legacy campaign CSS in `worldmap.css`, fog label overlapping a node.
8. ~~Buffs~~ done 2026-10-07 (ADR 0038). ~~Inventory~~ done 2026-10-07 (ADR 0039). **Next: commit (Steve), then the balance pass (#2) when wanted.**
