# Active — Session Handoff

> Most-updated file in the repo. Every session that changes code updates this file
> (what landed, known issues, exact next steps). See the session protocol in `CLAUDE.md`.

## Hero Phase 2c — COMPLETE, all 12 tasks (2026-08-15, latest)

The 6-skill progression model is done. Tasks 1-9 landed as eleven commits
`873ae4c`..`0a9e0a8`; **Tasks 10, 11 and 12 landed this session and are uncommitted.**
Plan: `docs/superpowers/plans/2026-08-10-hero-phase2c-skill-progression.md` (untracked).
**ADR 0029** (`docs/20-decisions/0029-hero-skill-progression-model.md`) records the full
decision set. SDD ledger: `.superpowers/sdd/progress.md`.

- **ADR 0029's tracking is deliberately undecided — Steve's call at commit time.** ADRs
  0001-0026 are committed; 0027 and 0028 are on-disk only. `.gitignore` was **not** touched
  for 0029, so `git add` tracks it and doing nothing leaves it untracked-but-visible. The
  ADR carries a header note saying exactly this.
- **Shard copy now names all three sinks** — the six `shard_<hero>` descriptions in
  `heroEconomyItems.js` read "…unlock X outright; also spent on awakening stars **and skill
  levels**." Pinned by a test that checks all three sinks appear for every hero, so the copy
  cannot silently drift from the economy again.

### Full verification (Task 12, run by the session owner — not relayed)

| Check | Result |
|---|---|
| `npm test` | **525/525, 0 failing** (was 503 at Task 9) |
| `check-comments.mjs` | **exactly 12 violations, all pre-existing**, zero in any 2c file |
| `boot-smoke` | **PASS** (1 attempt) |
| `heroes-smoke` | **PASS** (1 attempt) |
| `tutorial-smoke` | **PASS** (1 attempt) |
| `dev-smoke` | **PASS** except the known pre-existing unrelated `dev-anchor-nudger` `variantFile` failure carried since 2026-07-22 |

### What stays knowingly inert after 2c (all Phase 2d)

- `heroquarters` has no `statEffectMap` entry — the Assignments board shows "no station
  bonus yet" for that slot.
- `PROD_BONUS_CONFIG.base.buildSpeed` has no consuming building.
- `XP_CONFIG.passiveXpPerProductionTick` / `passiveXpCapOffset` have **zero consumers** —
  passive stationed XP is config-only, inert since Phase 1.
- `aegis_of_the_faithful`'s `postBattleHeal` 0.10 — `collectEffects` short-circuits on
  `fx.trigger` before reaching the `postBattleHeal` branch.

### Next steps — Phase 2d (scoped, not planned)

1. **Balance, and it needs Steve, not a subagent:** total loss reduction has **no ceiling**.
   Triggered alone reaches 0.833; passives across five heroes ~1.01, so **zero-loss victories
   are reachable today**. The `Math.max(0, …)` clamp at `CombatManager.js:339` is
   behavior-neutral and *hides* this rather than capping it. Related: level-1 economy passives
   are free value on recruit (two-hero workshop research went 0.24 → 0.42).
2. Build the deferred effect kinds — `buildSpeed`, gather/march yield, construction cost,
   storage cap — and give `heroquarters` a `statEffectMap` entry. The seam rule barred them
   from 2c precisely so they'd be built, not faked.
3. Wire passive stationed XP to its existing config.
4. Fix `aegis_of_the_faithful`'s inert heal.
5. **Unrelated but found here:** `notification:show` is a **dead event** — no listener
   anywhere, so `MarketManager.js:137`'s "Daily prices have been reset" toast has never
   reached a player. Either wire it into `NotificationManager` or delete the emit.
6. **Still open in the backlog, untouched by 2c:** `HeroManager.convertFragments` /
   `unlockFromShards` have zero UI callers, while `HeroDetailPanel` renders an unowned hero's
   "Fragment Progress" bar promising a conversion no button performs.

---

**Task 11 (the skill UI) landed on top of Task 10 in the same session** — see the Task 10
section below for that half.

- **Skills now render as three labeled groups** (Passive → Support → Major) in the hero detail
  panel, via new `js/ui/heroes/heroSkillSection.js`. Each unlocked row carries an
  `L{n}/{cap}` pip, its scaled effect magnitude, and a shard-cost `⬆ N` button disabled when
  the player cannot afford it. Locked rows show a **real** threshold — `Lv.{unlockLevel}` for
  passive/support, `5★` for a major. **`Lv.undefined` is gone**, pinned by a browser check.
- **Dormancy is per-effect, and it is domain logic, so it is not in the UI.** New pure module
  `js/systems/hero/heroSkillActivation.js` (`skillEffectKinds` / `skillEffectActivation` /
  `skillDormancy`), 8 unit tests. Combat effects pay only from a barracks or the Hero
  Quarters; `resourceOutput` from any resource building; `trainingSpeed` from a barracks;
  `researchSpeed` from the workshop. `wastelands_bounty` pays its resource half in a farm and
  its training half in a barracks — the tests pin that the two halves **swap** with the
  posting rather than the skill being one blanket state. `stationedTypeOf` is now exported
  from `heroProductionBonus.js` so the gate is read from one place.
- **Deviation from the plan's Step 1, deliberate.** The plan routed level-up through
  `eventBus 'ui:levelUpSkill'` and surfaced failures via `eventBus 'notification:show'`.
  `HeroManager` has **no** `eventBus.on` subscriptions to follow, and **`notification:show`
  has zero listeners anywhere in the tree** — `MarketManager.js:137`'s emit is dead. Following
  it literally would have made every rejection reason silent. Used the house idiom from the
  sibling `.btn-awaken-shard` button in the same file instead: the panel calls
  `heroes.levelUpSkill` directly and toasts through `notifications.show`.
  **Finding, unfixed:** `notification:show` is a dead event — the Market's "Daily prices have
  been reset" toast has never reached a player.
- **Both Task 11 carry-forwards are closed, not carried further:**
  1. `applySkillPassives` now scales by skill level (`effectValueAt` + `reconcileSkillLevels`)
     and gates on `isUnlocked`. Buying a skill level now moves `effectiveStats`, which is what
     the roster UI reads. Three tests appended; **verified discriminating** by reverting the
     scaling in place — exactly two of the three fail.
  2. The two vacuous "same hero, two postings" tests in `heroProductionBonus.test.js` now
     assert through `HeroManager.getCombatBonuses` against `grit` and `safe_route`. **Verified
     discriminating:** deleting the barracks/HQ gate in `heroCombat.js` now fails a test;
     before this change it did not. Those two test bodies were **replaced, not appended to** —
     a narrow ADR 0012 exception, recorded because they could not fail as written.
- **`getSkillsForHero` now returns `groupedSkillsFor`'s shape** so the panel reads one source;
  `HeroManager.getSkillState` delegates to it instead of duplicating the call.
- **Video heroes no longer freeze the skills section.** `HeroDetailPanel.patch()` used to
  return early whenever a `<video>` was present (Marcus, Juno) — it now patches
  `.hero-skill-groups` in place, so the pip moves for them too.
- **Verified:** `npm test` **524/524**. `check-comments.mjs` **12, all pre-existing**.
  `heroes-smoke` **PASS with 4 new checks** (2 attempts — the first died on the pre-existing
  `.btn-board-remove` step in the assignment block; that exact sequence was re-probed twice in
  isolation with zero page errors and would not reproduce, second full run green).
  `boot-smoke` **PASS**, `tutorial-smoke` **PASS** — the latter matters, this task rewrote
  `#view-heroes` skill markup.

## Hero Phase 2c — Task 10 of 12 (2026-08-15, same session)

Executing `docs/superpowers/plans/2026-08-10-hero-phase2c-skill-progression.md`. Tasks 1-9
landed as eleven commits `873ae4c`..`0a9e0a8` (each task-reviewed clean); **Task 10 landed
this session and is uncommitted.** SDD ledger: `.superpowers/sdd/progress.md`. The section
below is superseded on its "next step" line only — everything else in it still holds.

- **Task 10 — reassignment is now explicit.** `assignHeroToBuilding`
  (`js/systems/hero/heroAssignment.js`) rejects a hero who already holds a *different*
  `buildingId` with `Already stationed at <name> — remove them first.`, inserted after the
  same-slot early return and after the barracks eviction block so **eviction and same-slot
  behavior are untouched**. All three call sites (`BuildingCards.js:386`,
  `BarracksUI.js:316`, `HeroAssignmentPanel.js:117`) already surfaced `res.reason`, so no
  new toast was added.
- **Scope call Steve should eyeball:** the guard is building-agnostic, so a
  `barracks_0 → barracks_1` **squad** move is now rejected too — the plan's tests only
  covered the same-building slot swap. It follows from spec §2.3 ("a hero holds one
  assignment at a time"), and it is pinned by its own test rather than left implicit, but it
  is a real Barracks-screen UX change.
- **One UI copy fix the guard forced:** `HeroAssignmentPanel`'s picker advertised
  `moving from <X>` on already-stationed heroes — a promise the guard turns into a
  guaranteed failure. Those rows now render **disabled** with `at <X> — remove first`
  (the existing disabled-ghost idiom), plus one `.hero-board-pick:disabled` rule in
  `heroes.css`.
- **Verified this session:** `npm test` **513/513, 0 failing**. `check-comments.mjs` —
  exactly **12 violations, all pre-existing** (`InventoryManager.js`, `QuestManager.js`,
  `UnitManager.js`, `UIManager.js`), zero in any touched file. `heroes-smoke` **PASS**
  (1 attempt), `boot-smoke` **PASS** (1 attempt).
- **Tests:** six appended to `tests/unit/heroAssignment.test.js` (strict append, the existing
  test untouched) — the plan's three, plus the cross-barracks rejection, a
  reason-names-the-building assertion, and a same-slot-is-still-a-no-op regression pin.
  Verified discriminating: the three reassignment tests failed red before the guard, the
  three regression pins were green both before and after.
- **Carried forward into Task 11 (the skill UI), from the ledger — both were real, and both
  are now closed by Task 11 above:**
  1. `applySkillPassives` (`js/systems/hero/heroProgression.js:79-88`) **ignores skill level
     entirely** — only `collectEffects` scales. A hero's `effectiveStats` do not move when
     the player buys a skill level, so a UI built on `getRosterWithState()` will look broken.
     Same dual-mechanism shape as the old production-bonus gap.
  2. `tests/unit/heroProductionBonus.test.js:67-84`'s "same hero, two postings" tests are
     **vacuous** — they assert through `collectEffects`, which is posting-agnostic (the
     barracks/HQ combat gate lives in `getCombatBonuses`), and Kaelen has no attack skill at
     all. Delete the barracks gate in `heroCombat.js` and both stay green. Re-assert via
     `getCombatBonuses`.
- **Open balance question for Phase 2d (Steve's call, found by Task 8):** total loss
  reduction has **no ceiling** — triggered alone reaches 0.833, passives across five heroes
  ~1.01, so zero-loss victories are reachable today. The `Math.max(0, …)` clamp at
  `CombatManager.js:339` is behavior-neutral and **hides** this rather than capping it.
  Also still open from Task 8: `aegis_of_the_faithful`'s `postBattleHeal` 0.10 is inert
  (`collectEffects` short-circuits on `fx.trigger` before the `postBattleHeal` branch).
- **Still needs Steve, not a subagent:** whether **ADR 0029** is committed or gitignored
  (0027/0028 are on-disk only).
- **Not committed (Steve commits himself).** Dirty after both tasks: modified
  `js/systems/HeroManager.js`, `js/systems/hero/heroAssignment.js`,
  `js/systems/hero/heroProductionBonus.js`, `js/systems/hero/heroProgression.js`,
  `js/ui/heroes/HeroAssignmentPanel.js`, `js/ui/heroes/HeroDetailPanel.js`,
  `css/components/heroes.css`, `tests/browser/heroes-smoke.mjs`,
  `tests/unit/heroAssignment.test.js`, `tests/unit/heroProductionBonus.test.js`,
  `tests/unit/heroProgression.test.js`, `docs/30-roadmap.md`, `docs/40-active.md`; new
  `js/systems/hero/heroSkillActivation.js`, `js/ui/heroes/heroSkillSection.js`,
  `tests/unit/heroSkillActivation.test.js`.

## Phase 2c designed + planned; superpowers folders cleaned (2026-08-10, earlier)

**No game code changed this session.** Phase 2c is specced and planned; execution is
deliberately deferred to a fresh session (Steve's call — subagent-driven development,
12 tasks, wants the full context budget).

- **Housekeeping — `.superpowers/` and `docs/superpowers/` cleaned.** `.superpowers/sdd/`
  went **67 files / 1.8M → 4 files / 89K**: deleted 43 `review-*.diff` and all 20
  `task-N-brief.md`/`task-N-report.md` from the completed Hero 0/1/2a/2b phases. **Kept**
  `progress.md` (still staged-deleted, on disk, never restore it) and both
  `final-review-fix-report.md` (Phase 1) / `final-review-fixes-report.md` (Phase 2b) — the
  latter is cited by name in this file. Grepped `docs/` for references to anything deleted:
  none. Separately, the **7 still-tracked files in `docs/superpowers/`** were
  `git rm --cached`'d (kept on disk), so the folder is now consistently ignored per
  `.gitignore:30`, matching the ADR 0027/0028 convention. Consequence: roadmap/handoff cite
  plan and spec paths that dangle on a fresh clone — already true for the 2a/2b plans, now
  uniform.
- **Spec:** `docs/superpowers/specs/2026-08-10-hero-phase2c-skill-progression-design.md`
  (untracked). **Plan:** `docs/superpowers/plans/2026-08-10-hero-phase2c-skill-progression.md`
  (untracked, 12 tasks).
- **Four defects found in the shipped tree while specing — read these before touching hero
  code:**
  1. **Six dangling skill ids, player-visible.** `junovane` references
     `emp_burst`/`overclock`/`static_ward` and `kaelenthorne` references
     `scavenge`/`trail_marks`/`grit` (`js/entities/data/heroes.js:99`, `:112`) — **none exist
     in `SKILLS_CONFIG`**. `getSkillsForHero` degrades to `{ id, name: skillId, unlocked:
     false }` with no `type`/`unlockLevel`, so `HeroDetailPanel.js:108-124` renders raw ids as
     names and **`Lv.undefined`** badges for 2 of 6 heroes. Pre-existing since Phase 1.
  2. **The 2b handoff's premise was wrong.** It claimed the detail panel "groups by Passive /
     Support / Major already". It does not — it branches binary
     `skill.type === 'active' ? 'Active' : 'Passive'`. 2c includes real UI work.
  3. **`skillLevels` is half-built** — `heroCombat.js:21` reads it, nothing writes it.
  4. **`effect.duration` is declared but never read.** `CombatManager.js:291` applies every
     `battle_start` skill on `isFirstWave` regardless, so any `duration: 2` skill silently
     behaves as `duration: 1`.
  5. **Arithmetic error in the locked numbers spec.** §D enumerates
     `shardCostForSkillLevel` as `1,1,2,2,3,3,4,4,5` (sums to 25) while claiming 29. The
     formula `ceil(L/2)` gives `1,2,2,3,3,4,4,5,5` = **29**, matching its own 145/hero total.
     Formula and totals are right; the written-out list is wrong. Corrected in the 2c spec.
- **A third inert data gap, previously unrecorded:**
  `XP_CONFIG.passiveXpPerProductionTick` and `passiveXpCapOffset` have **zero consumers** —
  passive stationed XP is config-only. Deferred to Phase 2d. The known-inert list previously
  named only `heroquarters` `statEffectMap` and `PROD_BONUS_CONFIG.base.buildSpeed`.
- **Steve's design calls this session:**
  1. **Assignment is the switch.** A building gains an effect only while a hero is assigned to
     it, and a hero holds one assignment at a time — so the posting selects which of a hero's
     six skills pay out. Kaelen in a bank → production on, combat off; the same hero in a
     barracks → combat on, production off. Mixed combat/development skill sets are
     **correct and intended**. **Gating is per-effect, not per-skill** — one skill may declare
     effects for two postings and each activates in its own.
  2. **Reassignment must be explicit.** `assignHeroToBuilding` (`heroAssignment.js:95`)
     currently overwrites `hero.assignment` silently; it must reject a cross-building move
     until the hero is removed. Folded into 2c as its own task.
  3. **All hero progression currency comes from purchases and events.** 2c adds a
     145-shard-per-hero sink and deliberately adds **no gameplay faucet**. This closes the
     shard-income balance question rather than deferring it — grind is not an income source.
  4. **Seam rule:** every effect authored in 2c must land on a hook already live in the tree;
     kinds needing new plumbing (`buildSpeed`, gather yield, construction cost, storage cap)
     are deferred to 2d and not authored. Enforced by a test, not by review.
- **Verified this session:** nothing to verify — no code changed.
- **Phase 2b is now committed.** Steve committed during this session: `1a34284`
  ("docs: finalize hero redesign Phase 2b and cleanup legacy documentation", which carries
  this session's `docs/superpowers/` untracking deletions) and `229f561`
  ("fix(ui): resolve hero redesign phase 2b review findings"). The next section's
  "not committed" note is historical — it has landed. Only `docs/30-roadmap.md` and
  `docs/40-active.md` are dirty now (this handoff).
- **Next step: execute the 2c plan in a fresh session** via
  `superpowers:subagent-driven-development`. Ordering constraints are in the plan's
  self-review section — Task 2 before 3, Task 4 before 5/6/7, Task 5 before 8, Task 6 before
  11, Task 10 before 11's fourth browser check. **Two items need Steve, not a subagent:**
  whether ADR 0029 is committed or gitignored (0027/0028 are on-disk only), and a deliberate
  review of Task 7's exemption of the skill term from `globalEffectBonus`'s
  `buildingBonus`-match guard (without it Kaelen's `trail_marks` can never pay out, since his
  `buildingBonus` is `farm` while `trainingSpeed` lives on `barracks`).
- **Still open, deliberately NOT in the 2c plan:** the roadmap backlog's Phase 2c candidate —
  `HeroManager.convertFragments`/`unlockFromShards` (`js/systems/HeroManager.js:56-57`) have
  zero UI callers, while `HeroDetailPanel.js:78-87` renders an unowned hero's "Fragment
  Progress" bar promising a conversion no button performs, and the Shard Exchange can mint
  `shard_<unownedHero>` with no spend path. It was raised at the start of this session and
  then dropped out of scope during design — 2c is about skills, and this is a
  fragment/unlock-flow gap. It stays open in the backlog and needs either a real UI hookup or
  the dead methods removed.

## Final whole-branch review fixes — Hero redesign Phase 2b (2026-08-09, earlier)

Fixed all findings from the final whole-branch review of Phase 2b on top of the
Task 9 uncommitted work below. Full finding-by-finding writeup:
`.superpowers/sdd/final-review-fixes-report.md`.

- **C1** — `xp_card` items (`xpcard_normal/epic/legendary`, granted by 20% of
  non-hero recruit pulls) were acquirable but had no Inventory tab, no action
  branch, and no UI path to `HeroManager.applyXPCard` (which already worked).
  Added `xp_card` to the Boost tab's types and reused the existing `xp_bundle`
  hero-picker flow (`.inv-use-xp` / `_showHeroPicker`) verbatim — it was already
  item-agnostic, so no new picker or manager logic was needed.
- **I1** — a successful card recruit in `RecruitPanel._bindCards` was silent (only
  the failure path notified). Added the `👑 Hero Recruited!` toast on success,
  resolving the hero name from static `HEROES_CONFIG`.
- **I2** — `HeroAssignmentPanel._openSlot` was only ever cleared by the hero-pick
  handler, never by `render()`. A picker left open across a tab round-trip
  (Assignments → Roster → Assignments) permanently deadened `patch()` — a
  subsequent Remove succeeded in the manager but the board never visually
  updated. Fixed by clearing `_openSlot` at the top of `render()`;
  `patch()`'s own guard (for a picker open *without* a tab switch) is unaffected.
- **I3** — `heroCardView.statusChipHtml` interpolated the player-typed `squadName`
  into raw HTML. Routed through `escapeHtml` (`js/ui/uiUtils.js`); fixed the same
  raw interpolation of `squad.name` in `js/ui/controllers/BarracksUI.js`'s
  squad-modal title, and the last two remaining raw squad-name renders in
  `js/ui/controllers/CombatUI.js` (legacy campaign squad dropdown) — same
  player-typed value, same input. No unescaped squad-name path remains.
- **M1** — deleted dead `.btn-summon-frags` CSS (no emitter anywhere in the tree).
- **M2** — added the missing `.recruit-result--common` rule (normal tier — the
  highest-volume pull — was rendering unstyled).
- **M3** — added the missing `.chip-unowned` rule alongside its siblings in
  `cards.css`.
- **M4** — removed the duplicate `⚗️ Buff Activated!` toast fired directly from
  `InventoryUI`'s `inv-use-buff` click handler; kept the `buff:activated`
  event-driven listener, which also covers buffs activated from other sources.
- **M5** — `InventoryBuffSection` now appends inside `.inv-panel-body` in both the
  empty and non-empty render branches, so it always sits in the scrolling body.
- **M6** — the Recruit tab's hero-card list now mirrors Inventory's disabled
  "Owned"/"All Owned" treatment instead of always rendering a live button that
  errors on click for an already-owned hero; ownership read from
  `getRosterWithState()`'s `isOwned`, manager stays authoritative on the click.
- **Docs** — corrected `heroPityDisclosure.js`'s real location
  (`js/systems/hero/`, not `js/ui/heroes/`), the real `js/ui/heroes/` module count
  (eight, not seven), `HeroesUI.js`'s real line count (77, not 78), the ADR's
  misattributed `patch()` guard (video-only; the picker/reveal/exchange guards
  belong to different owners), the stale staging list, and dropped the
  `.btn-summon-frags` "rescued" claim per M1. Added a known-gaps line (both here
  and `docs/30-roadmap.md`) for `HeroManager.convertFragments`/`unlockFromShards`
  having no UI caller — pre-existing, flagged as a Phase 2c candidate.
- **Tests** — appended two mutation-strong checks to `tests/browser/heroes-smoke.mjs`
  (strict append, existing checks untouched): I2's tab-round-trip-then-Remove
  repro, and C1's xpcard grant → spend → real manager-state assertion (item
  consumed, hero XP/level increased).
- **Verified:** `npm test` **449/449**, no regression. `check-comments.mjs` —
  exactly **12 violations, all pre-existing**, zero added. `heroes-smoke`
  **PASS, 38/38** (2 attempts — first hit the documented pre-existing
  tutorial-state flakiness on an unrelated pre-existing check, not a new one).
  `boot-smoke` **PASS** (1 attempt).
- **Not committed (Steve commits himself).** See the staging note under the Task
  9 section below for the exact `git status --short` file list.

## Hero redesign Phase 2b — Heroes Screen + Recruit Hall shipped, all 9 tasks (2026-08-09, latest)

Executed the remainder of
`docs/superpowers/plans/2026-07-27-hero-phase2b-heroes-screen-recruit-hall.md`
(Tasks 6-9, resuming the session below) via subagent-driven development. All 9 tasks
independently task-reviewed clean. ADR 0028 records the full decision set —
**it is gitignored, not committed** (Steve's call at Task 1; see the ADR's own header).
SDD ledger: `.superpowers/sdd/progress.md`.

- **`#view-heroes` is the three-tab Hero Quarters interior, complete.** `HeroesUI.js`
  went **581 → 77 lines**. Roster, hero detail, the Assignments board, and the Recruit
  tab all live across eight modules in `js/ui/heroes/` (`HeroRosterPanel.js`,
  `HeroDetailPanel.js`, `HeroAssignmentPanel.js`, `RecruitPanel.js`, `stationBoard.js`,
  `heroCardView.js`, `recruitReveal.js`, `heroSquadLookup.js`); the pity-disclosure
  module (`heroPityDisclosure.js`) lives in `js/systems/hero/`, not `js/ui/heroes/`.
  `GachaUI.js` (480 ln) and `css/components/gacha.css`
  (688 ln) are **deleted**; `ui:openGacha` no longer exists.
- **The pity-disclosure fix (Task 2, the single most important decision of this
  phase) is now recorded in ADR 0028.** `HeroManager._pity[tier]` holds
  pulls-**completed** (incremented before the roll resolves). Disclosing the odds for
  the *next* pull therefore needs two different indices from that one counter: the
  rate ramp reads `pullsCompleted + 1`, the guarantee countdown keeps reading
  `pullsCompleted`. A second review round found the ramp formula alone still lied at
  the hard-pity boundary (44% shown for what `_rollStage1` actually resolves as a
  100%-certain guaranteed hero) — the rate now clamps to 1 whenever the next pull
  reaches `stage1HardPityN`. Stage 2 (post-roster-complete shard-floor pity) is
  deliberately unramped and unclamped — its guarantee is a flat shard rate, not a
  new-hero rate.
- **The Assignments board (Task 6)** excludes barracks by construction — squad
  assignment stays in the Barracks screen; the board owns every other building slot
  including HQ. Fixed a real bug in the plan's own sample code: `_openPicker` cleared
  its guard *after* the synchronous `assignHeroToBuilding` → `heroes:updated` →
  `patch()` chain had already fired, so a successful assignment never visually filled
  the slot — the guard now clears before the manager call.
- **The Recruit tab + reveal (Task 7)** ports `rollToken`'s real 8-outcome delegate
  tree (hero/shard/fragment/xp/overflow), not the old scroll-gacha's 5-outcome table
  the brief pointed at — porting as literally instructed would have reproduced the
  exact "40% of rolls grant nothing" bug the brief itself warned about. **Steve's
  call: the Shard Exchange is wired up, not a read-only tally** — the brief
  contradicted itself by declaring `exchangeTierShards` a consumed interface while
  templating a static display. A per-tier hero picker (restricted to that tier by
  construction) now calls it for real; the maxed-hero lossy overflow path gets its
  own toast reading amounts from `EXCHANGE_CONFIG` instead of silently dropping
  counters. The `gacha.css` deletion initially took several **live, non-gacha
  styles** with it (`.hero-stars-row`, `.hero-skill-*`, `.btn-summon-frags`,
  `.shop-item-featured`, etc.) — relocated verbatim into `heroes.css`/`inventory.css`
  before the file was removed, byte-compared both directions in review.
- **Inventory rehoming (Task 8).** The production-buff block is live again in
  `InventoryUI` (`js/ui/inventory/InventoryBuffSection.js`) after being unrendered
  since Task 4 — including its `buff:activated` toast, which had **zero listeners**
  for that whole span (the emit in `heroCombat.js` never stopped firing; nothing was
  listening). Inventory no longer spends recruitment items directly — it redirects to
  the Recruit tab. A review round caught a **Critical** self-inflicted by the first
  fix: consolidating everything onto the `.inv-goto-recruit` redirect killed the only
  spend path for **universal** hero cards (`hero_card_universal` — shop-sold and
  level-reward-granted), because `RecruitPanel._cardListHtml` only built buttons from
  the six brief-specified per-hero cards. Fixed by unioning universal cards into the
  same list and binding.
- **Retired recruitment scrolls now render a disabled "Retired" action** instead of a
  live-looking recruit-redirect button that led to a tab with nothing to spend them
  on. `_buildActionHtml`'s `recruitment_scroll` branch in
  `js/ui/controllers/InventoryUI.js` returns
  `<button class="btn btn-xs btn-ghost" disabled title="Recruitment scrolls have been
  retired — use Recruit Tokens instead.">Retired</button>`, mirroring the existing
  disabled-ghost idiom used for "Owned"/"All Owned". Deleted the now-orphaned
  `.inv-scroll-actions`/`.inv-scroll-cost` rules from `css/components/inventory.css`
  (grep-confirmed no other emitter of either class). `tests/browser/heroes-smoke.mjs`
  lines ~150-158 (its committed scroll-fixture block) is a deliberate ADR-0012
  exception: **both original assertions were replaced, none dropped** — "inventory
  recruit redirect lands on the Heroes view" / "activates the Recruit tab" (already
  independently covered by the hero-card redirect block at lines ~174-188) became
  "retired scroll shows no recruit redirect" (`.inv-goto-recruit` count is 0) and
  "retired scroll shows a disabled Retired action explaining the retirement"
  (a `:disabled` button with a `title` containing "retired" is present). The scroll
  block also needed a new explicit `#inv-panel-close` click — the old flow relied on
  `.inv-goto-recruit`'s click handler to close the panel as a side effect, and without
  a redirect nothing else closed it before the next test step tried to click through
  the still-open overlay (caught by a real first-attempt smoke failure, not
  theoretical).
- **Verified this session, by the session owner, not relayed:** `npm test`
  **449/449, 0 failing.** `check-comments.mjs` — exactly **12 violations, all
  pre-existing** (`InventoryManager.js`, `QuestManager.js`, `UnitManager.js`,
  `UIManager.js`), **zero** in any Phase 2b file or in the two files this task
  touched. `heroes-smoke` **PASS, 34/34 checks** (2 attempts — the first failed on
  the smoke-file's own missing panel-close after the retired-scroll edit, a real bug
  in the test change itself, fixed before the second run). `boot-smoke` **PASS** (1
  attempt). `dev-smoke` **PASS** except the one pre-existing, unrelated
  `dev-anchor-nudger` `variantFile` failure carried since 2026-07-22 (1 attempt).
  `tutorial-smoke` **PASS** (1 attempt) — confirms the `#view-heroes` markup rewrite
  across all of Phase 2b did not break the tutorial's hardcoded view-id/spotlight
  contract.
- **Two data gaps stay knowingly inert** (need a balance number a future phase sets,
  asserted inert by `tests/unit/gameData.test.js`): `heroquarters` has no
  `statEffectMap` entry, so the Assignments board shows "no station bonus yet" for
  that slot; `PROD_BONUS_CONFIG.base.buildSpeed` has no consuming building.
- **Known gap, carried deliberately (found by the final whole-branch review):**
  `HeroManager.convertFragments`/`unlockFromShards` (`js/systems/HeroManager.js:56-57`)
  have **zero UI callers** anywhere — pre-existing, predates this phase (verified
  against `843dd90`) — yet `HeroDetailPanel.js:78-87` renders an unowned hero's
  "Fragment Progress" bar promising a conversion no button performs, and the Shard
  Exchange lets a player mint `shard_<unownedHero>` that cannot currently be spent.
  Flagged as a Phase 2c candidate, not fixed this session.
- **Not committed (Steve commits himself).** `git status --short` at end of session:
  a pre-staged deletion `D  .superpowers/sdd/progress.md` (Steve's own, keep on disk,
  never restore it) plus modified/partially-staged working-tree changes across
  `docs/30-roadmap.md`, `docs/40-active.md`, `js/ui/controllers/InventoryUI.js`,
  `js/ui/controllers/BarracksUI.js`, `js/ui/heroes/HeroAssignmentPanel.js`,
  `js/ui/heroes/RecruitPanel.js`, `js/ui/heroes/heroCardView.js`,
  `css/components/inventory.css`, `css/components/heroes.css`,
  `css/components/cards.css`, `tests/browser/heroes-smoke.mjs`. `.gitignore` is
  **not** modified — it is itself self-ignored (`.gitignore:4`) and cannot be staged.
  **ADR 0028 is intentionally not staged** — it's gitignored, on-disk only, same as
  ADR 0027.
- **Next step: Phase 2c — the 6-skill progression model** (parent design §5, 2b spec
  §10). The 2b detail panel already groups skills Passive/Support/Major, so 2c is
  data plus level-up controls, not a re-layout.

## Hero redesign Phase 2b — Tasks 1-5 of 9 landed (2026-08-08 — superseded by the completion summary above; kept for per-task detail)

**Historical, mid-plan status as of 2026-08-08 — Phase 2b is now complete, see the
section above.** Kept verbatim for the per-task detail on Tasks 1-5 it originally
compressed; Tasks 6-9 landed the next day and are summarized above, not here.

Executed `docs/superpowers/plans/2026-07-27-hero-phase2b-heroes-screen-recruit-hall.md`
Tasks 1-5 via subagent-driven development; Steve stopped the session after Task 5, Tasks
6-9 ran the next session. Each of the five tasks was independently task-reviewed (spec +
quality) and is clean. SDD ledger: `.superpowers/sdd/progress.md`.

- **`#view-heroes` is now the three-tab Hero Quarters interior.** `HeroesUI.js` went
  **581 → 54 lines**, a shell owning `_activeTab`, the tab strip and a `_panelFor(tab)`
  seam. Roster and detail live in `js/ui/heroes/`. The Recruit and Assignments panels are
  **mounted but empty** — that is Tasks 6-7, not a bug.
- **Landed:** `stationBoard.js` (pure building×hero join, barracks excluded),
  `heroPityDisclosure.js` + `HeroManager.getPityState`, `heroCardView.js` (shared portrait/
  chip/tier-pill markup), `HeroRosterPanel.js`, `HeroDetailPanel.js` (splash art, backstory,
  manual ▶ video, XP bundles, awakening, skills, Deploy handoff), `heroSquadLookup.js`.
- **Real bug found and fixed by review, not by the plan — the plan's own code was wrong.**
  `HeroManager._pity[tier]` is incremented *before* a roll resolves
  (`heroRecruitment.js:26`), so it holds pulls-**completed**. The plan's `pityDisclosure`
  treated it as the index of the pull being disclosed and used it for both the rate ramp
  and the countdown, so the disclosed odds lagged reality by one soft-pity step (12% shown
  where the next pull actually rolls at 20%). **Steve's call: disclose the next pull.** The
  two fields genuinely need different indexing — the ramp now uses `pullsCompleted + 1`,
  the countdown still uses `pullsCompleted`. A second review round caught the boundary:
  `_rollStage1` short-circuits to a guaranteed hero at `stage1HardPityN`, so the rate now
  clamps to 1 there instead of showing 44% for a certainty. **This decision needs to land
  in ADR 0028 at Task 9.**
- **Roadmap cleanup folded in ahead of schedule:** "stop string-parsing `assignedBuilding`
  for squad names" (listed under Phase 2b in `30-roadmap.md`) is **done**. The old code
  indexed `getSquads()[idx]` from `barracks_<idx>`, but `getSquads()` returns Map insertion
  order, not barracks-slot order — a wrong squad label whenever squads were made out of
  order. New `js/ui/heroes/heroSquadLookup.js` matches on `barracksInstanceId`; both panels
  share the one copy.
- **Two deliberate gaps, do not "fix" them mid-plan:** the production-buff block was
  dropped from the Heroes screen and is **unrendered until Task 8** rehomes it into
  `InventoryUI`; `GachaUI.js` remains live and knowingly broken until **Task 7** deletes it.
- **Verified by the session owner, not relayed:** `npm test` **449/449**;
  `heroes-smoke` (new, `tests/browser/heroes-smoke.mjs`) **PASS 10/10** — including
  "roster card shows hero art, not emoji", which proves the 2a art ingest reaches the DOM;
  `boot-smoke` **PASS**; `tutorial-smoke` **PASS** (the `#view-heroes` markup rewrite did
  not break the hardcoded tutorial contract); `dev-smoke` **PASS** except the one
  pre-existing unrelated `dev-anchor-nudger` `variantFile` failure carried since
  2026-07-22. `check-comments.mjs` exactly **12 violations, all pre-existing**, zero in any
  Phase 2b file.
- **The brief's CSS token names are wrong** — `--color-*` does not exist. The real tokens
  are `--clr-border` / `--clr-primary` / `--clr-text-primary` / `--clr-text-muted` and
  `--space-1..12` in `css/base/variables.css`. Tasks 6-8 append CSS; check before pasting.
- **Known plan bug for Task 8:** its Step 2 says recover the buff methods via
  `git show HEAD:js/ui/controllers/HeroesUI.js`. By Task 8 that file is already a shell.
  The real source is **`git show 843dd90:js/ui/controllers/HeroesUI.js`**.
- **Recorded, unfixed, for the final review:** `heroCardView.portraitHtml` interpolates
  `hero.name` into `alt=""` and `hero.icon` into element text with **no escaping**. Safe
  today (static config only) — but Task 7's recruit reveal must not route dynamic text
  through it.
- **Not committed (Steve commits himself).** Five task commits are on `Working_Branch`
  (`44a8fa4`, `e55dfa7`+`d069a90`+`0297ef0`, `9dec6fd`, `df0f438`, `3e42686`). Per Steve's
  call this session, `.superpowers/sdd/progress.md` is **untracked** (`git rm --cached`,
  staged, kept on disk) and `/docs/superpowers/` + `docs/20-decisions/0027-*.md` are now
  gitignored. **Task 9 must ask whether ADR 0028 should follow 0027 out of tracking** —
  ADRs 0001-0026 are all still committed.
- **Next step: resume at Task 6** (Assignments board), then 7, 8, 9. Extract each brief
  with `.superpowers` `scripts/task-brief`, and carry a hard git-hygiene block in every
  dispatch — subagents damaged the untracked ledger in three of five tasks this session,
  once restoring it from the stale tracked blob and destroying two task entries.

## Hero redesign Phase 2a — "Make It Real" shipped (2026-08-08, earlier)

Executed `docs/superpowers/plans/2026-07-26-hero-phase2a-make-it-real.md` via
subagent-driven development (8 tasks, each independently task-reviewed clean, plus this
final documentation + full-verification task). ADR 0027 records the full decision set.
SDD ledger: `.superpowers/sdd/progress.md`.

- **Per-instance hero production bonus is now the live model.** New pure module
  `js/systems/hero/heroProductionBonus.js` implements the §I formula
  (`resourceBonusFor`/`globalEffectBonus`). `getBuildingProductionBonusMap()` (the
  Phase 1 map with correct numbers but no consumer) is **removed**.
  `buildingEconomy.computeActiveRates` now calls `ctx.getHeroInstanceBonus(instanceId)`
  — the old dead `1 + level·0.05` formula is gone, and the bank `if`/`else if` bug is
  fixed so bank pop-scaling and the hero bonus **compose** instead of one discarding
  the other. No hero currently maps to `gold_production`, so the bank branch is dormant
  capacity for now — it no longer discards a hero bonus, but none exists to pay out yet.
- **Balance consequence (intended, spec §2.7):** a level-10, 0-star stationed hero's
  building bonus goes from a flat **+50%** to **~+16.35%** under the real formula — a
  real magnitude shift on existing saves, not a bug, flagged for the eventual balance
  pass.
- **`trainingSpeed`/`researchSpeed` now have real consumers.** Both stay roster-wide
  global effects (no single building to attach to) but are actually read now:
  `UnitManager._trainMultiplier()` and new `TechnologyManager._researchMultiplier()`
  divide job duration by `(1 + bonus)`. `setHeroManager` injection added to both,
  wired in `main.js`.
- **Recruit tokens are now reachable in-game — closes Phase 1's known gap #2.**
  `token_normal`/`token_epic`/`token_legendary` are sold in `SHOP_CONFIG` and granted
  by progression/world-map reward tables. `scroll_*` retires **from sale** (item
  definitions and the `useItem` branch are deliberately kept — persisted mail/quest
  payloads can still name them); legacy scroll ids fold onto tokens via
  `LEGACY_ITEM_ID_ALIASES`, idempotent, no migration-marker save field. Welcome-mail
  grant in `main.js` repointed to tokens.
- **Steve's call this session:** `hall_of_heroes`'s trigger count bumped 4 → 6 so it
  matches its own "recruit all 6 heroes" description (stale since Phase 1 grew the
  roster). A regression test derives the expected count from `HEROES_CONFIG` so a
  future roster resize fails loudly instead of drifting stale again.
- **Hero art ingested.** New `js/ui/icons/heroArt.js` manifest + tests; ingest ran via
  `assestProcessing/ingest_heroes.py`, `assets/heroes/` holds 12 PNGs + 2 MP4s (warlord
  + Juno Vane get video). **`ingest_heroes.py` itself is untracked** — `/assestProcessing/`
  is git-ignored repo-wide (`.gitignore:20`) and zero files there are tracked, same as
  the pre-existing building `ingest.py`; only the consuming JS files are committed.
- **Still knowingly inert (needs a balance number a future phase sets):** `paladin`'s
  `heroquarters` station bonus (no `statEffectMap` entry) and
  `PROD_BONUS_CONFIG.base.buildSpeed` (no building consumes it). Both asserted
  explicitly inert by `tests/unit/gameData.test.js`.
- **`GachaUI.js` remains knowingly broken** — untouched by design this phase, Phase 2b
  deletes it outright rather than patching a UI that's about to be replaced.
- **Verified this session:** `npm test` **425/425**. `check-comments.mjs` — exactly 12
  violations, all pre-existing (March 2026, `git blame`-confirmed) in files this phase
  never touched the flagged lines of (`InventoryManager.js`, `QuestManager.js`,
  `UnitManager.js` — touched by Task 4 but not near these lines — and `UIManager.js`);
  zero violations introduced by this phase. `boot-smoke.mjs` **PASS**, zero page
  errors — this mattered because the economy changes reach load-time paths
  (`InventoryManager.deserialize`, `BuildingManager._notifyRates`).
- **Not committed (Steve commits himself)** — docs are commit-ready; the ADR/handoff/
  roadmap commit for this task lands separately from the 8 task commits already on the
  branch.
- **Next step: Phase 2b — Heroes screen + Recruit Hall.** Spec
  `docs/superpowers/specs/2026-07-27-hero-phase2b-heroes-screen-recruit-hall-design.md`,
  plan `docs/superpowers/plans/2026-07-27-hero-phase2b-heroes-screen-recruit-hall.md`
  (9 tasks). `#view-heroes` becomes a three-tab Hero Quarters interior (Roster ·
  Recruit · Assignments); `HeroesUI.js` 581 ln → a shell over seven modules in
  `js/ui/heroes/`; `GachaUI.js` + `css/components/gacha.css` + `ui:openGacha` deleted.

## Hero redesign Phase 2a + 2b — both planned (superseded — 2a now shipped, see above)

No code changed this session. Both halves of the "make heroes real and visible" work are
now specced and planned; **next session executes 2a end-to-end, then 2b on top.**

- **Phase 2a — "Make It Real"** (headless): spec
  `docs/superpowers/specs/2026-07-26-hero-phase2a-make-it-real-design.md`, plan
  `docs/superpowers/plans/2026-07-26-hero-phase2a-make-it-real.md` (8 tasks). Per-instance
  stationed-hero production bonus becomes the model of record, `trainingSpeed`/`researchSpeed`
  get real consumers, `scroll_*` retires onto `token_*`, hero art is ingested behind a
  manifest.
- **Plan bug found and fixed this session:** the 2a plan asserted
  `getBuildingProductionBonusMap()` had no live call site. It has **two** —
  `js/systems/hero/heroAssignment.js:97` and `:110`, where it supplies an ignored payload to
  `hero:productionBonusChanged`. Removing the method without the new Task 2 Step 1c would
  make **every hero assignment throw**. Task 2 now carries the full call-site table, the
  repointed emits, a regression test, and the real test surface (`heroManager.test.js`,
  `heroEconomy.test.js`, `resourceManager.test.js:90`, not just the one file it anticipated).
- **Phase 2b — Heroes screen + Recruit Hall** (UI): spec
  `docs/superpowers/specs/2026-07-27-hero-phase2b-heroes-screen-recruit-hall-design.md`, plan
  `docs/superpowers/plans/2026-07-27-hero-phase2b-heroes-screen-recruit-hall.md` (9 tasks).
  `#view-heroes` becomes a three-tab Hero Quarters interior (Roster · Recruit · Assignments);
  `HeroesUI.js` 581 ln → a shell over seven modules in `js/ui/heroes/`, two of them pure and
  unit-tested. `GachaUI.js` + `css/components/gacha.css` + `ui:openGacha` are deleted.
- **Steve's calls this session:** recruiting is **tied to the building** — Inventory stores
  tokens/cards and redirects to the Recruit tab, it never spends them. **Barracks/squad
  assignment stays in the Barracks**; the new Assignments board owns every *other* building
  slot including HQ, forward-compatible with a future Hero Station building. The
  production-buff block **moves to Inventory** rather than being deleted. XP cards and
  fragments-as-XP apply from the hero detail panel.
- **Still knowingly inert after both phases** (needs a balance number a future phase sets):
  `paladin`'s `heroquarters` station bonus, and `PROD_BONUS_CONFIG.base.buildSpeed`. The
  board renders the HQ slot as "no station bonus yet" rather than inventing a magnitude.
- **Next after 2b:** Phase 2c — the 6-skill progression model (parent design §5). The 2b
  detail panel already groups skills Passive / Support / Major, so 2c is data plus level-up
  controls, not a re-layout.
- **Not committed (Steve commits himself)** — docs are commit-ready.

## Hero redesign Phase 1 — economy foundation shipped (2026-07-25, latest)

Executed `docs/superpowers/plans/2026-07-23-hero-redesign-phase1-economy-foundation.md`
via subagent-driven development (10 tasks, each independently task-reviewed with fix
rounds where issues surfaced, plus a final whole-branch review on Opus — one retry
needed on a 529 overload, second attempt succeeded — that found 1 Critical + 5
Important cross-task issues, all fixed in one combined commit and verified resolved
in a re-review). ADR 0026 records the full decision set.

- **Full new hero economy, headless (no UI this phase).** Roster retiered
  `common/rare/legendary` → `normal/epic/legendary` (fixed 2/2/2, +2 new heroes: Juno
  Vane, Kaelen Thorne; all 6 got `backstory`). Heroes-only recruit tokens
  (`rollToken(tier)`) replace resource/buff/xp gacha scrolls — never pays a base
  resource, always hero/fragment/shard/xp; two-stage pity (soft ramp from pull 7,
  hard-guaranteed new hero by pull 10, **per-tier** not global — Steve's call after
  review flagged the brief's literal global reading left a completed tier degraded);
  dupe rolls convert to that hero's fragments/shard instead of wasting the pull.
  10-star shard-only awakening (was 5-star card-or-fragment). Bounded, base-relative
  aura formula (folded away the old `magic_amplify × 0.8` hack). HQ-gated XP curve
  (`HERO_LEVEL_CAP = HeroQuarters_level × 10`, was unusable `1.3^L`).
  Fragment→Shard→Unlock + lossy Tier-Shard exchange (buy 3:1, refund only 2:1 — no
  laundering loop). Production bonuses recomputed correctly per the locked numbers
  spec for all 5 resource types (was gold-only).
- **Every new save field has real serialize/deserialize/reconcile coverage (ADR
  0002)** — verified end-to-end in the final review, not just per-field: legacy saves
  with the old `1.3^L`-curve `xpToNext`, saves holding the renamed `card_common`/
  `card_rare` ids, and saves missing `_pity` entirely all reconcile safely with no
  data loss.
- **Two known gaps shipped deliberately open, both recorded in ADR 0026 — read it
  before touching hero economy code again:**
  1. **Production bonuses don't reach live gameplay.** `getBuildingProductionBonusMap()`
     computes the correct §I numbers but `ResourceManager` still drives real resource
     rates through a separate, older per-instance mechanism
     (`1 + stationedHero.level·0.05` in `js/systems/building/buildingEconomy.js`).
     Steve's call: this needs real redesign, not a patch — don't wire the map in
     as-is without rethinking how the two mechanisms should merge.
  2. **Recruit tokens are unobtainable in-game.** `token_{tier}` items aren't sold in
     `SHOP_CONFIG`, granted by quests/achievements, or referenced anywhere outside
     their own data definition — surfaced in the final review, after the economy
     itself was otherwise verified closed-loop. Meanwhile `SHOP_CONFIG`'s `'heroes'`
     section still sells the now-retired `scroll_*` items (always fail on use since
     `HeroManager.rollScroll` no longer exists). **As shipped, no player can reach
     this entire new economy through any in-game action.** Needs a follow-up: wire
     `token_{tier}` into the shop and/or reward tables, retire `scroll_*` from sale.
- **Verified:** `npm test` **390/390**; `check-comments.mjs` clean on touched files;
  `boot-smoke` PASS. `dev-smoke` not re-run after the final fix commit (was PASS
  except one pre-existing, unrelated `dev-anchor-nudger` failure as of Task 10 —
  re-run before the next UI-touching session just to be safe, though this fix
  commit touched no rendering code).
- **Not committed (Steve commits himself)** — tree is commit-ready, all 17 task/fix
  commits squashed to staged changes (`git reset --soft` back to the pre-Phase1 base
  after the final review passed, per Steve's standing preference — same pattern as
  Phase 0). SDD ledger: `.superpowers/sdd/progress.md`.
- **Next step:** either close gap #2 above first (cheapest way to make the shipped
  economy actually playable), or move straight to **Phase 2** — progression (6-skill
  model, ~36 class-matched skills, levelable skills, extended star bumps) per the
  plan's own Handoff note. Phases 3-4 (Heroes screen + Recruit Hall UI) are where
  gap #2 would also naturally get closed alongside the real UI work.

## Hero redesign Phase 0 — HeroManager split shipped (2026-07-25, earlier)

Executed `docs/superpowers/plans/2026-07-23-hero-redesign-phase0-manager-split.md` via
subagent-driven development (7 tasks, each independently task-reviewed + a final
whole-branch review on the most capable model — all clean, no Critical/Important findings).

- **`js/systems/HeroManager.js` 958 → 237 lines.** Split into five collaborator modules
  under `js/systems/hero/`, each `constructor(hero) { this._h = hero; }` back-ref pattern:
  `heroRecruitment.js` (gacha/card recruit, awakening), `heroProgression.js` (XP, skill
  passives; owns the canonical `barracksIdForSquad(squadId)` — stays on `HeroManager`
  itself, shared by progression + assignment), `heroAssignment.js` (13 squad/building
  assignment methods, the largest extraction), `heroCombat.js` (combat-bonus aggregation +
  timed buffs; `_activeBuffs` stays manager-owned/serialized), `heroEconomy.js`
  (production-bonus map, deliberately tiny — Phase 2 grows it). `HeroManager` keeps every
  original public method as a one-line delegator — **zero consumer changed**
  (`HeroesUI`/`GachaUI`/`CombatManager`/`ResourceManager`/`BuildingsUI`/`UnitManager`).
- **Zero behavior change, verified mechanically.** Task 1 added characterization tests
  (XP curve, awakening, assignment) before any extraction; every later task's reviewer
  diffed moved bodies byte-for-byte against the pre-move originals. `serialize()`/
  `deserialize()` shape (`{owned, activeBuffs}`) untouched.
- **Verified:** `npm test` **322/322**; `check-comments.mjs` clean on all six touched hero
  files; `boot-smoke` PASS; `dev-smoke` PASS on its core boot block (one unrelated
  pre-existing failure in the `dev-anchor-nudger` sub-suite, confirmed out of this
  branch's diff scope).
- **Deferred to Phase 1 (non-blocking, flagged by the final review):** unused `eventBus`
  import in `heroEconomy.js`; dual `recruitHeroRecord`/`_recruitHero` proxy (collapse once
  `tests/unit/heroManager.test.js` is editable again); pre-existing dead
  `MAX_HEROES_PER_SQUAD` constant and `_lastBuffCount` field (both predate this refactor);
  `HeroesUI.js` has its own hand-copied `_barracksIdForSquad` — could now call the
  manager's public version instead. The class-header narrative comment lost in Task 4's
  forced condensing (squad/building mutual-exclusivity, HQ-global-bonus semantics) should
  be confirmed captured in `docs/10-design/` before it's lost institutionally.
- **Not committed (Steve commits himself)** — tree is commit-ready, 7 logical chunks
  squashed to staged changes (`git reset --soft` back to the pre-Phase0 commit after the
  final review passed, per Steve's standing preference). SDD ledger:
  `.superpowers/sdd/progress.md`.
- **Next step:** Phase 1 — `docs/superpowers/plans/2026-07-23-hero-redesign-phase1-economy-foundation.md`
  (currencies, XP curve + HQ level cap, shard-only awakening, bounded aura, two-stage pity,
  wired dev bonuses).

## Hero recruitment + management redesign — designed & planned (2026-07-23, latest)

The next feature of record is now **fully designed and Phase 0+1 planned** (no code yet).
Steve iterated the whole model with me; scope = **consolidate + reskin** the hero systems
(no new *combat* depth — troop-affinity/positioning/power-rating are future notes).

- **Spec:** `docs/superpowers/specs/2026-07-23-hero-recruitment-management-redesign-design.md`
  — approved. Roster grows past 6 over time (data-driven). Recruit Hall **is the Hero
  Quarters interior**. Currencies: 3 Recruit Tokens, Specific Hero Cards (event-gated),
  per-hero **Fragments** (partial) → **Hero Shards** (full copy), **Tier Shards**
  (exchange-only), **XP Cards**; dupe→frag/shard; no separate "dust" (maxed overflow → tier
  shards). Rates + **two-stage pity**. **6 skills/hero HARD CAP** (3 passive / 2 support /
  1 Major=Awakening), composition matches the hero's field (dev heroes get dev skills).
  Ceilings raised: hero max level (HQ×10=100), stars 5→10, skill levels →10. Base/production
  buffs belong to the **HQ / base-management** feature (unbuilt) — evicted from Heroes here.
- **Locked numbers:** `docs/superpowers/specs/2026-07-23-hero-economy-numbers.md`
  (game-designer pass — full XP curve, bounded aura fix, star/skill shard sinks, pity odds
  ~50-pull median, 3:1/2:1 exchange, wired per-resource dev bonuses). Consumed verbatim by
  the plans.
- **Plans written (Phase 0 + 1; 2–5 are JIT):**
  - `docs/superpowers/plans/2026-07-23-hero-redesign-phase0-manager-split.md` — split the
    958-ln `HeroManager` into `js/systems/hero/` (recruitment/progression/assignment/combat/
    economy), pure refactor behind characterization tests. **Do this first.**
  - `docs/superpowers/plans/2026-07-23-hero-redesign-phase1-economy-foundation.md` — the
    whole economy headless + unit-tested (currencies, XP curve + HQ level cap, 10-star
    shard-only awakening, bounded aura, heroes-only token rolls, two-stage pity w/ persisted
    counters, fragments/shard unlock, tier-shard exchange, wired dev bonuses).
- **New art on disk (git-ignored):** `mixBoard/Heroes/` — full-body renders for all 6
  (Marcus Kestrel, Vera Sable, Kira Nightwhisper, Aldric Cross, Juno Vane, Kaelen Thorne) +
  **videos** for Juno Vane & Marcus Kestrel (detail/reveal use a **▶ manual play button, no
  autoplay**). Art ingest + backstory copy land in Phase 5.
- **Phased roadmap:** 0 split · 1 economy · 2 progression (6-skill model, ~36 class-matched
  skills) · 3 Heroes screen · 4 Recruit Hall · 5 art+content. Fast-follow: passive
  building-XP (guardrails already designed: slower than combat, capped 20 lvls below HQ cap).
- **Next step:** execute Phase 0, then Phase 1. An **ADR** for the economy decisions
  (heroes-only tokens, dupe→shard, shard-only awakening, two-shard roles, HQ-gated level cap,
  two-stage pity) lands with the Phase 1 code. Nothing committed (Steve commits himself) —
  docs are commit-ready.

## City ambient life — grit walkers + road-following ship-drone & truck (2026-07-23, earlier)

Replaced the base city's procedural pedestrian blobs + ellipse drone with rig-rendered grit
sprites, and made the drone follow roads out-and-back from a parked truck instead of flying
over the HQ. Spec: `docs/superpowers/specs/2026-07-23-city-ambient-life-walkers-drone.md`;
plan: `docs/superpowers/plans/2026-07-23-city-ambient-life-walkers-drone.md`.

- **Sprites (rig, ADR 0021):** `assets/_rig/jobs-ambient.json` renders Zombie-Kit survivors
  (`Characters_Lis/Matt/Sam/Shaun` → `survivor_*`), `Vehicle_Truck` → `truck`, and Ultimate
  Spaceships `Bob` → `drone` to `assets/tiles/props/ambient/` (+ `_anchors.json`). **Git-ignored
  on disk** like all other art (`/assets/` is ignored repo-wide) — regenerate via the rig, not
  committed. Bob's glTF is unpacked into the scratchpad rig's `packs/spaceships/Bob/glTF/`.
- **New module `js/ui/city/cityAmbientAssets.js`** — decodes + grim-grades the ambient sprites
  (same filter as CityGrade, duplicated by design to keep ambient props decoupled from building
  grading). Loaded by `CityRenderer.load()`, handed to agents via `_agents.setAssets(...)`.
- **`js/ui/city/cityAgents.js`** — added pure exported helpers (`pickDockKey`, `bfsFarthest`,
  `bfsPath`, `faceLeft`, `pingPong`, unit-tested in `tests/unit/cityAgents.test.js`). `setRoads`
  now docks at the corner-most road cell and builds a BFS road path dock→farthest; the drone
  **ping-pongs** out-and-back (no more straight-row fly-over). `drawWalker`/`drawDrone`/new
  `drawTruck` blit anchored graded sprites (scaled to a fixed on-screen height, mirrored L/R by
  travel direction) with the old procedural drawing kept as a **fallback** if a sprite is missing.
- **`js/ui/city/CityRenderer.js`** — loads the ambient assets and depth-interleaves the truck
  like the drone.
- **Verified:** `npm test` **315/315** (+8 new: helpers, drone path/ping-pong, walker sprite
  index, ambient manifest); `boot-smoke` **PASS** (no 404s — sprites on disk); comment-lint clean
  on touched files. Zoomed `?dev` screenshots confirm: truck = graded van on the road, walkers =
  graded survivor figures (not blobs), drone = graded ship with scan-beam + shadow following the
  road. Ambient readout `{walkers:4, drone:true, truck:true}`.
- **Known / next:** at normal (1×) zoom the agents are small ambient detail (14–22px, grim-graded)
  — intended. Executed via subagent-driven development; **not committed** (Steve commits himself) —
  tree is commit-ready. SDD ledger: `.superpowers/sdd/progress.md`.

## Grit is the default sprite set; AI is dev-gated + HQ/hero/quarry re-sourced (2026-07-23)

Steve: until AI modules/effort have a real setting, ship **grit as the default** and give
dev a UI toggle to preview AI. Plus re-source three grit buildings from stronger models.

- **AI gate (`js/ui/city/cityAssets.js`):** `CityAssets.aiEnabled` (false unless `?ai` or the
  dev toggle) guards the AI branch in `variantKey` — grit wins for everyone (ADR 0024 update).
  New **`js/ui/dev/DevSpriteSource.js`** (`?dev` only, wired in `main.js`, `.dev-sprite-source`
  in `css/components/dev.css`): a live grit↔AI checkbox; the running RAF repaints on flip.
- **Re-sourced grit art (rig re-run, ADR 0021):** re-mapped in **both** the durable
  `assets/_rig/jobs-all.json` (source of truth) and a 9-job partial re-render
  (`jobs-remap.json` in the scratchpad rig) copied into `assets/tiles/buildings/grit/`,
  anchors **merged** into `_anchors.json` (other ~51 untouched): `townhall`→`Wonder_SecondAge_L1-3`,
  `heroquarters`→`Temple_SecondAge_L1-3`, `quarry`→`Resource_Gold_1/2/3` (L1=G1, L2=G2, L3=G3 —
  on-disk dims confirm provenance). Dropped `townhall` grit **L4** (Wonder_SecondAge is 3 levels);
  `gritBucket` clamps Lv.4+ to L3 automatically.
- **Removed the dead ground-tile chain.** The Kenney `landscape/`+`city/` tile dirs are gone
  (ground is procedural via `cityGround.js`), but `GROUND_TILES` still pointed at them and
  404'd on every boot. Deleted `GROUND_TILES` + `CityAssets.ground()` + the `g:` load entries,
  and `CityGrade`'s ground import/`ground()`/grading loop. Nothing drew from them.
- **Verified:** `npm test` **306/306** (updated townhall clamp + new grit-default flag test);
  `check-comments` clean on touched files; **boot-smoke PASS** (the GROUND_TILES 404s were its
  only failures); `?dev` screenshot shows grit HQ/hero/quarry seated on-plot, `aiEnabled=false`,
  `townhall`→`townhall_L3.png` (grit, not AI).
- **Known / next:** HQ visual quality is now Steve's call (ADR 0024 once judged grit HQ weaker
  than AI — this re-sources from Wonder_SecondAge; eyeball and iterate the model/`fit` if
  needed). `main.js` 660 ln stays over the ~400 ceiling (this added the 1-line dev-widget wiring
  + import); a dev-bootstrap extraction is the natural follow-up.

## Dev Anchor Nudger — interactive sprite-anchor calibration (2026-07-22)

Steve asked for a way to seat AI sprites by eye instead of the edit-JSON-and-rescreenshot
loop (no pixel heuristic centres every sprite — ADR 0024). Spec:
`docs/superpowers/specs/2026-07-22-dev-anchor-nudger-design.md`.

- **`js/ui/dev/DevAnchorNudger.js`** (`?dev` only, wired in `main.js` beside the other
  dev widgets): a **Building mode** toggle. Armed → drag the selected building to set its
  `ax`/`ay`; **wheel** = scale (`s`), **Alt+wheel** = rotate (`r`°, in-plane tilt),
  **Ctrl+wheel** = skew (`k`°, horizontal shear); **Shift** = fine on any of them — all
  live, with a cyan plot-diamond + centre reference. Drag/wheel over empty ground fall
  through to camera pan/zoom. **Copy** puts a ready-to-paste `_anchor_overrides.json` entry
  (keyed by sprite filename, only the non-default fields) on the clipboard; **Reset**
  reverts. Readout warns when `s > 1.1` (raster upscale — re-scale in Python ingest for big
  changes). Rotation/skew are true tilt for a flat sprite (spin/shear about the anchor, base
  stays grounded), not 3D — hit-test/badge stay AABB, fine for small angles.
- **Ground-contact shadow — tried and removed (Steve's call).** The AI cut-outs bake no
  shadow, so they read as pasted-on regardless of position. Tried a radial ellipse then a
  projected-silhouette shadow at the anchor; neither convinced (long throw hid behind the
  building; tight version read as grime), so it was pulled out entirely. Grounding the AI
  set convincingly is better solved in the art (bake a soft contact shadow into the sprite)
  than in the renderer. No shadow code remains.
- **Nudger controls shown inline** (`.dev-nudge-hint`), not just a hover title:
  "drag move · wheel scale · Alt rotate · Ctrl skew · Shift fine".
- **Selection is click-driven + shared:** clicking a building emits `dev:buildingSelected`
  (`BuildingsUI.onTileClick`); both the nudger and `DevLevelSwitcher` snap to it. Nudger has
  no building dropdown — it acts on the selected building at its rendered level.
- **Anchor manifest gained optional `s` (scale, default 1), `r` (rotation°, default 0),
  `k` (horizontal-shear°, default 0).** `CityRenderer._spriteBox` multiplies its draw scale
  by `anchor.s` (hit-test/proxy/badge derive from it); the draw path (`drawBuilding`) seats
  the anchor on the plot centre then `rotate(r)` + shear(`k`) + `scale(s)` about it, so the
  ground-contact point holds at any tilt. `normalizeAnchor` defaults all three.
  `cityAssets` now loads `ai/_anchor_overrides.json` **on top of** `_anchors.json` at game
  load (`_loadAnchors` takes a url list) — so a pasted override shows in-game on reload
  **without** re-ingest and still survives one. New `setDevAnchor`/`clearDevAnchor` (live
  preview), `variantFile` (override key), `normalizeAnchor` (pure, `s` default).
- **Verified:** `npm test` **305/305** (+`normalizeAnchor`); `dev-smoke` all functional
  assertions PASS incl. the new `dev-anchor-nudger` block (widget mounts, click-sync, `s`
  scales the box, clear restores, `variantFile` key) — only the pre-existing GROUND_TILES
  404 noise keeps the smoke red; live screenshot shows the widget armed + reference diamond
  + level-switcher synced. `check-comments` clean on all touched files.
- **Debt noted (unchanged, deferred):** `CityRenderer.js` 989 ln / `main.js` 658 ln remain
  over the ~400 ceiling — additions here were 1 line each (renderer scale multiply, dev
  widget registration); the tool's logic lives in its own `js/ui/dev/` module.

## AI HQ un-parked: base-vs-prop tilt fixed, ai→grit path wired (2026-07-22, earlier)

Steve retried the AI building set (grit HQ art judged weaker) and reported the HQ
"touching the ground with the left side only, hovering on the right" — a tilt, not a
float. A previous agent had also overwritten `grit/townhall_L1-L4.png` with the AI
renders instead of wiring a real AI path.

- **Root cause (verified live, footprint-diamond overlay).** `anchor.py` foot mode
  derived `ax`/`ay` from the single widest row across the whole sprite. On HQ that
  row is the parked cart/barrel prop at mid-height, ~18px left of the stone
  foundation's centre — so the anchor seated the base off toward a plot corner and
  it read as tilted. `ax` 84→103 removed the tilt at L1; all four stages sit level.
- **`anchor.py` — kept the simple widest-row default; hard cases go to overrides.**
  First tried a "lowest row ≥0.7× widest" rule to dodge the cart; it fixed HQ L1 but
  shoved L3 to the right of its plot (L3's front steps fooled it the same way the cart
  fooled the old rule). A median-estimator sweep confirmed the ADR's conclusion: **no
  single pixel rule centres both a side-prop building (L1 cart) and a front-step
  building (L3)** — widest-row is correct for 3 of 4 stages, the cart defeats every
  automatic estimator. So `anchor.py` foot mode stays widest-row (reverted), and the
  four townhall stages are pinned in a re-added
  `assets/tiles/buildings/ai/_anchor_overrides.json` (merged last by `ingest.py`'s
  `_apply_overrides`, intact). **Verified anchors, all 4 centred + grounded live:**
  S1 `(103,123)` · S2 `(67,104)` · S3 `(70,140)` · S4 `(87,145)`, written to both
  `_anchors.json` (what the game loads) and `_anchor_overrides.json` (survives
  re-ingest). `ground_width` for scaling still the full silhouette (round-4, unchanged).
- **`ai → grit → legacy` wired (ADR 0024, was reverted):** `cityAssets.js` gained
  `AI_BUILDING_MAP` + `stageBucket` + one `variantKey(id, level)` resolver;
  `building`/`anchor`/`buildingGray`/`bottomPad` + `cityGrade.building`/
  `buildingGray` all route through it (no divergent sprite picks). AI anchors load
  via a second `_loadAnchors(url, entries)` call. Only `townhall` is mapped so far —
  add a type by wiring its stages in `AI_BUILDING_MAP` once its `ai/*_S*.png` land.
- **Verified:** `npm test` **304/304** (+3: AI-map/stageBucket in
  `cityAssets.test.js`); `align-smoke` invariants all PASS (missing-anchor check now
  resolves via `variantKey`; townhall Δ(0,0)); live overlay shows HQ L1-L4 seated
  level and centred. Boot/align smokes still red **only** on the pre-existing legacy
  `buildingTiles_*` 404s (ISO_BUILDING_MAP fallbacks not on disk) — confirmed **zero**
  new/`ai/`/`townhall` 404s introduced.
- **Removed the legacy "glassy office" set (`ISO_BUILDING_MAP`, Steve's call).** The
  Kenney iso pack was a dead fallback — grit covers all 20 types, and its
  `buildingTiles_*.png` weren't on disk, so it only produced 404s. Deleted the map +
  its load + the `variantKey` legacy branch (now falls back to grit L1). Consumers
  `TileTooltip`/`BuildingInfoPanel` repointed to the icon set first
  (`buildingIconUrl`), then the grit L1 sprite — **building 404s 29 → 0** (9 remain,
  all `GROUND_TILES` landscape/city tiles, left for a ground pass).
- **Tooltip/info-panel thumbnails now prefer `assets/icons/buildings/*_icon.png`**
  and only fall back to the building sprite when no icon exists (Steve's call).
- **Open — grit townhall still clobbered.** `grit/townhall_L1-L4.png` are the AI
  renders (grit is git-ignored; `assets/_rig/backup-grit-v1/` only has L1-L3 pre-rig
  art). The grit fallback is cosmetically dead now (AI wins) but should be restored
  to real grit art via the rig if the fallback is ever wanted — **Steve's call**.

## HQ wired in-game, anchor algorithm rewritten, dev tooling added (2026-07-22, earlier)

Follow-up to the prompt rework below — Steve generated real HQ art with the
single-prompt-4-images workflow and asked to see it wired in-game, which surfaced a
real bug in the anchor-detection script itself (not just prompt/art issues).

- **HQ fully wired, all 4 levels**: `assets/tiles/buildings/grit/townhall_L1-L4.png` +
  `_anchors.json` point at the new `mixBoard/HQ` generation. Steve supplied a
  same-framing full-res Level 4 render (1024×1024, replacing the earlier 500×500
  background-removed one that scaled too small) — regenerate via
  `python assestProcessing/ingest.py HQ`.
- **Regression caught before shipping: `gritBucket()` needed per-building clamping.**
  Wiring L4 meant bumping the level→sprite-bucket clamp past 3 — but nearly every other
  building has `maxLevel` 6-10 in `buildings.js` while only having 3 grit art buckets. A
  flat global clamp bump to 4 would have made every *other* building fall back to its
  Level 1 art (not Level 3) the moment its real level exceeded 3, since bucket 4 doesn't
  exist for them. Fixed `gritBucket(id, level)` (now takes `id`) in `cityAssets.js` to
  clamp to each building's own highest available bucket from `GRIT_BUILDING_MAP`,
  defaulting to 3 for unmapped types. Updated all 6 call sites (`cityAssets.js` ×4,
  `cityGrade.js` ×2). Regression-tested in `tests/unit/cityAssets.test.js` (townhall
  Lv.10 → bucket 4; well Lv.10 → bucket 3, not 1).
- **Found and muted a pre-existing duplicate achievement toast**: `main.js` and
  `NavigationUI.js` both independently listen for `achievement:unlocked` and show a
  toast (different title/body) — surfaced when muting one half made the other still
  fire. Not fixed (removing either changes displayed content — main.js's includes the
  description, NavigationUI's doesn't — a product call, not this session's to make);
  both are now muted together under the `'achievements'` devMute key so dev sessions are
  fully silent. Worth a real cleanup pass later.
- Confirmed visually via a throwaway `?dev` Playwright script (not committed): HQ Lv.4
  renders as the fortress art, correctly scaled and grounded next to the other Lv.1
  buildings on the same base.
- **`anchor.py` rewritten** (`assestProcessing/anchor.py`): `'foot'` mode used to
  estimate the base's centre with an analytic lift formula assuming an idealised
  symmetric diamond base — measured 19px wrong on HQ's asymmetric corner-tower design,
  which read in-game as "standing on one side, hovering on the other." Now measures the
  widest solid row directly (same as `'base'` mode) — no more analytic lift, no
  per-sprite override needed. `_anchor_overrides.json` deleted; keep it that way unless
  a detection is genuinely un-fixable in the algorithm.
- **`ingest.py` stage-file bug fixed**: `STAGE_RE` matched "stage4" as a *substring*, so
  a same-folder reference file (`Stage4-removebg-preview.png`) got ingested as a phantom
  duplicate stage and silently bumped real Level 4 art to `_S5`. Now requires a full
  filename match (`^stage\s*(\d+)$`).
- **Level 4 blocked on source art**: Steve's replacement `Stage4.png` (background-removed
  500×500) has more empty padding around the castle than the original 1024×1024 render,
  so it scales out much smaller than L1-3 under the pipeline's fixed-scale-from-Stage-1
  design. Needs the original full-res render or a same-framing re-export — not an anchor
  problem, `ingest.py`'s own rembg cutout already handles background removal.
- Full rationale trail (11 rounds) in `docs/10-design/assets.md` under the prompt-contract
  section — read that before touching `Building-style.md`/`building-fillers.md` again.
- **New dev tooling** (`?dev` sessions only, zero effect on real play):
  - `js/ui/dev/DevLevelSwitcher.js` + `js/systems/building/devLevel.js` — floating
    widget to force any already-placed building instance to any level instantly, for
    eyeballing per-level sprite anchors without grinding a real upgrade.
  - `js/ui/dev/DevPopupMuter.js` + `js/core/devMute.js` — floating widget to silence
    story-chapter, achievement, and quest-completion popups during dev sessions (still
    grants rewards, just skips the interruption), toggleable back on. `devMute.js` lives
    in `js/core/` (not `js/ui/`) so both systems (`NotificationManager`) and UI
    (`UIManager`, `QuestsUI`, `NavigationUI`) can read it without crossing the tier
    boundary.
  - Both covered in `tests/browser/dev-smoke.mjs` (appended, not rewritten, per ADR
    0012).

**Next steps:** get a same-framing Level 4 source for HQ and re-ingest; once HQ reads
fully correct in-game (all 4 levels), move to the next building per the reboot plan
(`docs/10-design/assets.md`) — well or another currently-bad type — applying the same
single-prompt-4-images workflow + fixed anchor algorithm.

## AI sprite prompt rework + icons wired (2026-07-22, later)

Follow-up to the parked pipeline below — prep for Steve's next `mixBoard` regeneration
round (starting with HQ), plus using the one part of the old set that was already good.

**Second-round fix, same session:** Steve's first regen pass against the rewrite below
came back "blocky random buildings" — the primitive-cap language capped *how much*
detail but never required the primitives to visibly join into one structure, so stages
read as scattered disconnected blocks, worst at the sparse stage-1 end where the model
had least to anchor an identity to. Levels dropped 6 → 4.

**Third-round rework, same session (Steve + GPT critique):** Steve ran the prompt past
GPT, which correctly diagnosed the whole approach as written for the wrong audience —
a diffusion image model, not a reasoning model. Long prose, "never X" negation
(diffusion models handle negation poorly — naming a concept can reinforce it), and
abstract meta-fields ("scale ceiling," "primitive cap") don't function the way careful
instructions do for an LLM. The single-image multi-stage grid was its own failure mode
too — every level free to compromise against every other level in the same canvas.
**Pipeline now:** a fixed, never-edited style bible (`assestProcessing/Building-style.md`
/ `Hero-style.md`) + a short per-item keyword block (`building-fillers.md` /
`hero-fillers.md`, rewritten to plain concrete "Visual keywords" + per-level
"additions" lists, zero negation) + buildings generated **one level at a time, chained
by image reference** (approve Level 1, feed it back in, prompt only the delta to reach
Level 2, etc.) instead of a grid. `Building-promt.md`/`hero-promt.md` now hold the
workflow instructions, not the literal prompt content. **Not yet verified against a
real generation** — next step is confirming the image-chained HQ Level 1→4 workflow
actually holds consistency before doing the rest of the roster.

- **Diagnosed why the AI art didn't fit** (`game-designer` pass + Steve's own read):
  it's not a materials problem, it's spatial frequency — at the ~40-130px this game
  actually renders buildings, only massing/silhouette survives, so "flashy" detail reads
  as noise, not richness. Grit's 3D models work because they're kitbashed from 3-6
  simple primitives (a human artist's economy of form under a poly budget), which
  happens to match glanceable strategy-game legibility. Also found and fixed a *second*,
  separate failure: generic per-stage escalation language ("grandest," "prestige,"
  "statues") with no per-building anchor was defaulting high-level farm/mine renders to
  castle imagery regardless of purpose.
- **`assestProcessing/promt.md`** (Steve's actual working prompt file, previously unseen
  by any session doc) rewritten in place: replaced the `"hand-painted, semi-realistic...
  weathered stone"` style block (the literal source of the over-detail problem) with a
  primitive-cap + flat-color-block + signature-shape-move contract, and added an
  explicit anti-castle-drift rule tying each stage's growth to a per-building
  `{SCALE_CEILING}`, not generic grandeur language.
- **`assestProcessing/building-fillers.md`** — all 20 building blocks gained
  `Silhouette identity` / `Primitive cap` / `Scale ceiling` fields. Only `townhall` +
  `heroquarters` are prestige-tier (grandeur language allowed); every other type's
  ceiling is explicitly "a bigger version of its own working function, never a
  castle/fortress/manor" — this is the direct fix for the farm/mine-becomes-a-castle
  report.
- **New: `assestProcessing/hero-promt.md` + `hero-fillers.md`** — same locked-style-block
  approach for one-at-a-time hero portrait generation (post-apoc grounded-tech
  constraint: no magic-user imagery). Steve chose to re-fiction the 4 existing heroes to
  the post-apoc setting now rather than generate fantasy art that the pending hero
  redesign would throw out: Lord Arcturus → Marcus Kestrel, Lyra Dawnveil → Vera Sable
  (Arc Technician), Kira Nightwhisper → the Ghost Runner (name unchanged), Sir Aldric →
  Aldric Cross (Iron Warden). **These are draft visual concepts only — `heroes.js`
  itself is untouched**; carrying the new names/titles into game data is a small
  follow-up best done alongside the actual hero recruitment/management redesign.
- **`docs/10-design/assets.md`** gained a permanent "AI-generated building sprites —
  prompt contract" section recording both failure modes + the reusable template, so a
  future session isn't starting from scratch.
- **Cleaned `assets/tiles/buildings/ai/`** (Steve's request, ahead of a fresh HQ-first
  regeneration): deleted all `*_S1-6.png` sprites + `_anchors.json`/
  `_anchor_overrides.json` (being regenerated against the new prompt anyway); the 14
  `*_icon.png` files that were already good moved to new `assets/icons/buildings/`.
  `ai/` folder itself kept (empty) as ingest.py's output target for the next run.
- **Wired those icons into the game** — new `js/ui/buildings/buildingIcons.js`
  (`buildingIconUrl(id)` / `cardIconHtml(id, emoji)`, a static id-list manifest like
  `GRIT_BUILDING_MAP`'s pattern; falls back to the existing emoji for any type without a
  generated icon yet). Consumed by `BuildablesPanel.js` (build-catalog cards),
  `BuildingCards.js` (base-tab card grid + locked-slot cards), and `BuildingInfoPanel.js`
  (detail overlay, folded into its existing sprite-or-emoji fallback chain). Kept the
  helper in the sibling module rather than growing `BuildingCards.js` further (already
  over the ~400-line ceiling, pre-existing debt).
- **Verified:** `npm test` 301/301; `check-comments` still exactly 13 pre-existing
  violations (none in touched files); boot-smoke's console 404s confirmed pre-existing
  and unrelated (legacy `buildingTiles_*`/`landscapeTiles_*`/`cityTiles_*` — same gap
  noted in ADR 0024, not caused by this work); live Playwright screenshot of the
  Buildables catalog confirms real icons render (lumbermill/well/farm/quarry/mine/
  storehouse/construction hall/HQ) in place of emoji.
- **Next:** Steve regenerates HQ against the new `promt.md` + `building-fillers.md`
  townhall block first (calibration reference), then farm/mine as the anti-castle-drift
  test cases, then whichever building looks worst in-game next (well was mentioned).
  Hero portraits are prepped but not yet started — hero recruitment/management redesign
  is still the next feature of record (see below); portrait generation can run ahead of
  it since `heroes.js` itself isn't touched by this prep.

## AI building sprite pipeline — parked (2026-07-21/22)

Steve tried an AI-sprite path for buildings (`assestProcessing/` ingest pipeline:
bg-strip → trim → auto-anchor → scale → `assets/tiles/buildings/ai/`). After several
rounds of sizing/anchoring fixes the effort-to-payoff wasn't there yet, so **the game is
back to grit-only** — `cityAssets.js`/`cityGrade.js` reverted, no `ai/` wiring. Parked,
not deleted: `assestProcessing/anchor.py`/`ingest.py`/`mixboard_map.json`, the `mixBoard/`
source images, and the generated `assets/tiles/buildings/ai/` sprites (incl. the
`_icon.png` set, which looked good and is worth wiring into building cards later even if
the in-world sprites stay parked) are all still on disk for a future attempt. ADR 0024
kept as a record of what was learned (real bugs found: scale must be measured against the
sprite's full width or content overshoots its footprint; anchor centring needs the whole
silhouette, not just a foot-level band; a diamond footprint only requires the *base* to
stay contained — roof overflow is normal and fine).

## Current state (2026-07-20)

- Branch: `Working_Branch`. Through adjacency is committed (`dd4e575`). **Uncommitted now:**
  A3 Sessions 1+2 (ADR 0020/0021) + base layout rework Phases A/B/C (ADR 0022) +
  **the systems bug audit and its 12 load-bearing fixes** (item 26). `npm test`
  **301/301**. **Note:** `/assets/` is git-ignored project-wide — all grit PNGs live on
  disk only.
- ⚠️ **Browser smokes have NOT been re-run since the audit fixes.** Six exist
  (boot, world, dev, tutorial, sector, align) and the fixes touched save/load, resources,
  buildings, units and heroes — this is a genuine verification gap, not a formality.
  **Run these first next session**, spaced ~3s apart (each spawns its own `http-server`
  on port 8123; back-to-back runs race and produce phantom FAILs — re-run any failure
  alone before believing it).

### Exact next steps (in order)

1. **Re-run the six browser smokes** (see the warning above) — the only audit follow-up
   Steve kept as blocking, because the fixes touched `SaveManager` and load-time grants
   and a broken boot would be mis-attributed by whoever works next. Cheap; do it first.
2. **Hero recruitment + management redesign** — **the next feature of record**
   (Steve, 2026-07-20). Spec lives in `docs/30-roadmap.md` § UX friendliness; write the
   design up as `docs/10-design/heroes.md`. Worth a `game-designer` specialist pass
   before any code. Chosen over Phase 4 deliberately: see the roadmap note — Phase 4 is
   authoring opponents (capabilities, behaviours, personalities), a design project before
   it is a code project, and much larger than it looks.
3. **Then** the deferred hardening tracks, in whatever order they start blocking:
   Prong B (persistence *coverage* assertion — Proxy-record which keys `deserialize`
   actually reads, diff against what `serialize` writes, fail on written-but-never-read;
   that is what catches the ADR 0002 silent-drop class), Prong C loop verification, data
   consolidation, comment cleanup, balance pass.

**Steve's standing call on the audit residue (2026-07-20):** this is not the final build.
The 7 design calls, the god-file split, the `milMult` guard and the comment-lint
violations are all **deferred until something actually blocks on them** — do not open a
session by re-litigating that list. Fix them when they bite.

### Open debt carried forward (Steve's call, deliberately not done)

- **God files.** `BuildingManager.js` ~1094 ln, `HeroManager.js` ~958, `UnitManager.js`
  ~913, `TechnologyManager.js` ~525, `ResourceManager.js` ~512 — all over the ~400
  ceiling. All pre-existing; the audit agents correctly declined to refactor mid-fix.
  Splitting these is its own session, and should happen **before** much more logic lands
  in them.
- **Wrong-but-contained + future-trap findings** are unfixed and listed in
  `docs/audit-findings.md`. Highest-timing-sensitivity: the **`milMult < 1` debuff guard**
  — fix it *before* Phase 4 authors any debuff data, or the magnitudes get inflated to
  compensate and all need re-tuning after a one-character fix.
- **7 design calls** await Steve at the end of `audit-findings.md`. Contested lines were
  routed around, never silently decided.
- **Audit fix residue** — read the "Residue and consequences" section at the top of
  `audit-findings.md` before any balance work. Notably: hero `buildingBonus.value` no
  longer affects production (magnitude is now level-only), and already-inflated VIP saves
  keep their extra slots.
- Phase 1 (UI redesign) and Phase 2 (world map MVP + fast-follows) are **done** —
  see `docs/30-roadmap.md`.
- **Grit reskin is CLOSED (2026-07-20).** A1–A4, B1+B2, C1–C3 all shipped. A3 verified
  complete this session: all 20 types in `GRIT_BUILDING_MAP`, 60 sprites + `_anchors.json`
  on disk. The city terrain/ground pass A3 left open was absorbed by the base layout
  rework Phase B (`cityGround.js`). **B3 (world terrain atlas) is deferred by Steve** —
  the current grid map reads fine; reopen only if flat-colour terrain starts to grate.
- Next direction: **hardening & housekeeping** (`docs/30-roadmap.md`) — the reskin is done,
  so the "fix load-bearing bugs before the reskin builds on top" gate is now the live work.
- **The repo has tests now** (ADR 0012). `npm test` before you hand off; fix a bug →
  add a regression test in the matching `tests/unit/*.test.js`. Contract:
  `tests/README.md`.

### Landed this session (2026-07-20, later)

26. **Systems bug audit — Prong A complete, all 12 load-bearing defects fixed.**
    Plan: `docs/systems-audit-plan.md`. Findings + residue: `docs/audit-findings.md`
    (read the "Residue and consequences" section before any balance work).
    - **Why static review, not verification:** the happy path is the least likely place
      for a surviving bug. Five parallel specialist reviews over the untested manager
      clusters found **12 load-bearing defects**; three were found independently by two
      reviewers each. A loop-verification pass would have surfaced almost none of them —
      they live on reload boundaries, expiry paths, and failure branches that report
      success.
    - **Worst:** `SaveManager.wipe()` latched saving off permanently, and guest→account
      registration hit it **without a reload** — all progress after registering was lost
      from localStorage *and* Firestore. Also: storage-tech caps dropped every load then
      the overflow destroyed on the next tick; VIP slots compounding per load in both
      `BuildingManager` and `TechnologyManager`; expired events never releasing their
      production multiplier (composite-key mismatch); unit duplication via dual-tracked
      `squad.units`/`squad.slotUnits`; squads deletable mid-march; 40% of gacha scroll
      rolls granting nothing (dangling item ids).
    - **Fixed structurally, not symptomatically:** squad state now routes every mutation
      through one invariant helper; the modifier key is built by a shared helper so the
      two sites cannot drift; a data-integrity test asserts every `GACHA_CONFIG` id
      resolves against `INVENTORY_ITEMS`, retiring the whole dangling-id class.
    - **A fix that was wrong, caught by checking:** the first `wipe()` fix satisfied its
      test but broke `wipeAllData()` — `wipe()` then `reload()` fires `beforeunload`,
      which re-saves live state over the wipe. Root cause was an underspecified spec: one
      boolean carrying two intents. Split into `wipe()` + `suppressSaves()`; both
      behaviours now pinned by tests. **Same failure mode as the align-smoke tautologies
      — a passing test that could not fail.**
    - **Verified by the session owner, not relayed:** `npm test` **301/301** (283 after
      wave 1, +18 in wave 2); `check-comments` at exactly **13 pre-existing** violations,
      confirmed identical against a stashed baseline — zero new. Browser smokes NOT yet
      re-run (next session: run them spaced ~3s apart, per the port-8123 race).
    - **NOT fixed, deliberately:** all wrong-but-contained and future-trap findings remain
      open in `audit-findings.md` — incl. the `milMult < 1` debuff guard (fix **before**
      Phase 4 authors debuff data), difficulty never restored after load, the
      ChallengeManager seconds-as-ms reset, and the missing save `version` field.
    - **7 design calls deferred to Steve** (listed at the end of `audit-findings.md`):
      `defense_boost` double-count (code contradicts its own comment), hero passive
      stacking, `concurrentSlots` dead data, UTC daily resets, VIP tracking
      diamonds-received-not-spent, story chapter rewards, `cancelTrain` full refund.
      Contested lines were routed around, not silently decided.
    - **Debt unchanged/grown:** `BuildingManager.js` ~1094 ln, `HeroManager.js` ~958,
      `UnitManager.js` ~913, `TechnologyManager.js` ~525, `ResourceManager.js` ~512 — all
      over the ~400 ceiling, all pre-existing. Agents correctly declined to refactor.
    - **ADR 0023** records the decisions: explicit `suppressSaves()` split, load-time
      grant idempotence, over-cap stock is legal and never destroyed, hero bonuses apply
      once per-instance, save failures observable. Includes the rejected alternatives so
      the first (wrong) `wipe()` fix isn't re-attempted.
    - **Next:** Prongs B (persistence round-trip harness — the audit found the field
      diffs largely symmetric, so prioritise the *coverage* assertion that detects
      written-but-never-read keys) and C (empirical loop verification).

### Landed this session (2026-07-20)

25. **Base layout rework Phase C — adjacency bonuses (layout is now gameplay)**
    (ADR 0022 amendment). Closes the rework; A/B/C all shipped.
    - **`js/systems/building/adjacency.js`** (new, pure, 110 ln): neighbour test =
      rect gap ≤ 2 cells on both axes (one tile, so a connector road still fits
      between). Same-category clustering +5% each (cap +20%) for
      production/military/population; 5 curated pairs (house↔cafeteria,
      farm↔well, lumbermill↔workshop, mine↔storehouse, barracks↔rallypoint)
      +6–8% (cap +15%); total cap +30%.
    - **Production** spends the bonus as output — `buildingEconomy.computeActiveRates`
      reads `ctx.getAdjacencyBonus(instanceId)`. **Military** pools it into a
      training-time cut (mean, cap 25%) at UnitManager's new `_trainMultiplier()`
      (folded with the VIP cut at all 5 call sites — no other change there).
    - **Derived, never serialized.** `BuildingManager._recalcAdjacency()` runs on
      build-complete (both paths), move, and load. Legacy loads emit
      `building:adjacencyDiscovered` → BuildingsUI toast ("your layout grants +X%"),
      so a base the packer clustered on migration announces the gift.
    - **UI:** TileTooltip shows a `🔗 +N% neighbours` line with pair labels
      (`.tt-adjacency` in `sidebar.css`).
    - **Also, Steve's request:** rubble sector panel now opens **on tap only** —
      hover surfaces it only while that sector is actively clearing.
    - **Verified:** `npm test` **253/253** (+13 — adjacency.test.js ×10, three
      BuildingManager integration tests incl. move-away-drops-bonus and
      not-serialized-re-derives). All six browser smokes PASS (boot, world, dev,
      tutorial, sector, align). `check-comments` clean on every touched file.
    - **Open balance risk (Steve's call: level design, not code):** adjacency creates
      pressure to re-optimise layouts, which couples to rubble pacing — more cleared
      space = more clustering freedom. Tune the two together in the balance pass.
    - **Debt unchanged:** `BuildingManager.js` (~1084 ln) and `CityRenderer.js`
      (886 ln) over the ~400 ceiling; Phase C kept its logic in the pure sibling.

### Landed this session (2026-07-19, later)

24. **Per-sprite ground-anchor system — buildings now sit CENTRED on their plots**
    (ADR 0022; Steve's call after size-tweaking kept trading one artifact for another).
    Root insight (Steve): a flat billboard anchored at the plot's front vertex puts the
    building's ground-contact at the **front edge** of the plot, not its centre — so a
    base smaller than the plot always looked shoved forward, and sizing alone could
    never fix both centring and neighbour-overlap.
    - **Rig** projects the origin (models are centred on it, base at y=0) → that pixel
      IS the building's ground-contact centre; exported per sprite as `{ax, ay}` into
      `assets/tiles/buildings/grit/_anchors.json` (60 entries, regenerated with the
      sprites).
    - **`cityAssets`** loads the manifest (`_loadAnchors`) and exposes
      `anchor(id, level)`, falling back to bottom-centre if the file is missing.
    - **`CityRenderer._spriteBox(slot, scale)`** is now the single source of sprite
      geometry: it seats the anchor on the plot **centre** (`_centerWorld`). Draw,
      hit-test (`_pointInSlotSprite`), proxy/tutorial rect (`_slotRect`) and the
      progress/speed-up badge (`_slotTopWorld`) all derive from it, so they can no
      longer disagree. `bottomPad` is superseded for placement (kept as a padding guard).
    - Because each level's sprite carries its own anchor, **per-level centring is
      automatic** (Steve's "nudge should affect specific levels" note).
    - **align-smoke rewritten to a real invariant**: "every sprite ground-anchor seats
      on its plot centre" + "every built sprite has a rig-exported anchor". The old
      check compared the draw anchor to `_frontWorld` — both from the same function,
      a tautology that passed while buildings visibly sat wrong.
    - **Sizing settled at ~80% of plot** (2×2→0.8, 3×3→1.2, 4×4→1.6 tiles) — buildings
      sit inside their footprint with breathing room, no neighbour pile-ups. Size is now
      a pure look-and-feel dial: re-rendering at a new fit regenerates the anchors with
      it, and align-smoke confirmed centring held (Δ 0,0) across the size change.
    - **Gotcha for future sessions:** the browser smokes each spawn their own
      `http-server` on port 8123, so running them **back-to-back races on the port** and
      produces phantom FAILs (hit boot/world once here; both passed alone and in a spaced
      re-run). Put a ~3s gap between smoke invocations, or run them one at a time,
      before believing a failure.
    - **Verified:** 240/240; boot/dev/tutorial/sector/world/align smokes PASS;
      check-comments clean on touched files; proof shots
      `.playwright-mcp/anchor-final-{well,townhall}.png` show the ground-contact
      centred on the plot-centre marker.

23. **Building centering + connector-road shape** (Steve play-test after the anchor
    fix). (a) Buildings leaned into the bottom-right of their pads with empty top-left,
    and large production sprites (mine/quarry/lumbermill) spilled down-right — the rig
    aligned each model by its **front-right (max) corner**, so any non-square footprint
    dumped its gap on the back-left and big models overhung front-right. Rig now
    **centers the footprint bbox on the origin** (`(max+min)/2`); all 60 re-rendered.
    Per-sprite, so each level centers on its own footprint (Steve's "per-level" note is
    handled structurally). (b) Connector roads were small inset diamonds reading as
    patches; `cityGround._insetRoad` now draws full cell **height**, ~half **width** —
    a road strip. Verified: align-smoke still PASS (anchor intact, pad 0); overlay
    (`.playwright-mcp/centered-real.png`, `prod-built.png`) shows buildings centered
    and filling pads, production cluster no longer spilling. 240/240; five smokes green.
    **Open:** if a *specific* type/level still looks off-center, add a per-type-per-level
    draw nudge (data in buildings.js) — deferred until Steve flags specific ones.

22. **Building float — TRUE root cause: half-cell anchor offset (Steve's diagnosis).**
    Items 20–21 fixed real but secondary things (sprite padding). The dominant cause,
    found by comparing the sprite basis against the *actual cell-center grid* instead
    of against itself: `rectFrontTile`/`rectCenterTile`/`rectCornersTile` in
    `cityGrid.js` referenced the rect **boundary** coords (`cx+w`, `cy+h`) as if they
    were cell-center tile coords. The ground/roads place cell (X,Y) at
    `tileToWorld(X/2, Y/2)` (cell **centers**, occupying cx..cx+w-1), so every sprite,
    slot outline, badge, plaque, and fx anchor rendered exactly **half a cell (24 world
    px) down-forward of the road grid** — while roads/ground were correct. Measured
    live: green(sprite basis) vs cyan(cell basis) S-vertex differed by dy=48px @ 2×
    zoom = 24 world px, dx=0; after the fix dy=0 (scratchpad `basis-compare.png` →
    `basis-fixed.png`). Fix: the three functions now reference cell centers (edge
    cells cx..cx+w-1, vertices ±0.25 tile). Every earlier "proof" missed it because the
    overlays used `rectCornersTile` — the same function the sprite uses — so they were
    tautologies (as was align-smoke's anchor check). New guard:
    `cityGrid.test.js` "rect corners align with the cell-center grid" pins the three
    functions to `tileToWorld(cell/2)` ± half-cell. Two old unit tests that encoded the
    buggy values were corrected. **240/240; align/boot/dev/tutorial/sector/world smokes
    green.** Live: buildings now sit on their footprint cells, on the road grid.

21. **Building float — actual root cause proven, align-smoke was testing a tautology.**
    The prior align-smoke checked proxy-rect-bottom == `_frontWorld` anchor, but BOTH
    derive from the same math, so it always passed regardless of sprite padding — it
    could never catch this class of bug (why "fixed" kept not being fixed). Diagnosed
    live via headed Playwright with overlay proof (ground suppressed, flat-bg,
    footprint diamonds drawn from `_cornersWorld`): with the rig's true-lowest-pixel
    crop (`bottom = maxY`) every sprite now has `bottomPad ≈ 0`, and each building's
    base seats exactly on its footprint front vertex (scratchpad
    `.playwright-mcp/anchor-flat.png`, `anchor-all.png`). The remaining lever if a
    building looks small in its pad is `fit`, not the anchor. **align-smoke
    strengthened**: now also asserts no built sprite has >6px transparent padding
    below content — the invariant that actually guards the float. 239/239, five
    smokes green. Caveat recorded so it isn't relitigated: a truly cache-fresh client
    is required to observe the fix (server now `-c-1`; hard-reload the browser).

20. **"Buildings float above their pads" — real root causes found live with Steve**
    (parent session, live headed-Playwright debugging with in-page marker dots).
    Two stacked problems:
    - **Art:** the rig cropped sprite bottoms at the theoretical unit-tile front
      vertex while aligning models by full bbox (roof overhang included) → baked
      transparent padding under most buildings → sprites drew up-back of their
      footprints. Rig crop now = actual lowest visible pixel (`maxY`), all 60
      re-rendered. Belt-and-braces: `CityAssets` measures each sprite's real
      content-bottom at load (`bottomPad()`, from the grayscale-prerender pass) and
      `CityRenderer._drawSlot` anchors on measured content — padded art can never
      float again regardless of source.
    - **Caching hid every fix:** `http-server` default `max-age=3600` → browsers
      (Steve's, and even a fresh MCP Playwright process with its persistent profile)
      served hour-stale sprites/JS **without revalidating**, so landed fixes looked
      like failures and correct probes looked like lies. `run.bat` now serves with
      `-c-1` (caching disabled). Lesson for every future session: **after changing
      assets or JS, verify through a cache-cleared client** (CDP
      `Network.clearBrowserCache` or a truly fresh profile) before judging.
    - Verified: 239/239; align/boot/dev/tutorial/sector smokes PASS; live headed
      browser shows sprites seated with `bottomPad = 0` across types.

19. **Sprite fits now match footprints** (parent session; the real fix for Steve's
    "buildings look offset" report). The align-smoke invariant (sprite bottom ==
    footprint front corner) was passing, but sprites were *smaller* than their
    pads and front-corner-pinned, so every building sat shoved into the front-left
    of its rect with empty pad behind — perceptually "offset". Rule now: **fit =
    footprint size** (2×2 cells → 0.95 tiles, 3×3 → 1.42, 4×4 → 1.9; set by
    `rig/fix-fits.mjs` over `jobs-all.json`, mirrored to `assets/_rig/`). All 60
    sprites re-rendered — buildings fill their pads by construction. Per-type
    size variety now comes from footprint class + model silhouette, not ad-hoc
    fit numbers. Verified: align/boot/dev/tutorial smokes PASS; `?dev` screenshot
    (`rig/shot-fitmatch.png`) shows pads filled.

18. **Rubble-clear bug fix + road hierarchy (§4) + edge forest** (ADR 0022; two
    player-reported bugs + one design amendment). Implemented by an Opus subagent.
    - **BUG — glitchy rubble clearing (root cause).** `CityRenderer._syncSectors` built the
      ground-raster cache key from `sectorList.filter(s => s.state !== 'rubble')`, which
      bucketed **`clearing` together with `cleared`**. A sector goes `clearing → cleared` on
      completion, but that transition left the key **unchanged**, so `CityGround` never
      re-rastered — the just-cleared sector kept drawing as rubble until an *unrelated*
      building event happened to force a re-raster. That incidental timing is exactly the
      nondeterministic report ("no visible progress", "start a 2nd clear → all clear
      instantly, or one clears and the other never clears"). The `SectorState` timers were
      always genuinely independent (per-id Map) — proven by the two-clears probe. **Fix:**
      pure `groundSignature({clearedIds, skeleton, connectors})` in `cityGround.js` counts
      only truly-`cleared` sectors, so completion invalidates the cache. Legibility:
      on-canvas progress bar now shows live **m:ss** remaining; the open sector tooltip
      ticks its countdown in place (`TileTooltip.patchSector`, ADR 0007). Tests:
      `cityGround.test.js` (signature changes clearing→cleared), `sectorState.test.js`
      (two concurrent clears complete independently), `tests/browser/sector-smoke.mjs`
      (campaign, real tick path — A 120→118s over 2s, B still running when A finished, both
      to completion). **Probe result:** independent completion confirmed.
    - **BUG + redesign — roads never cross buildings (§4 two-level hierarchy).** Old
      `cityRoads.js` L-paths ran straight through footprints. Replaced with a **fixed
      skeleton** (ring around HQ + N/E/S/W arterials to the edge; geometry `SKELETON` in
      `cityGrid.js`) whose cells are **unbuildable** (`rectHitsSkeleton` extends the
      placement/move/packer predicate; `_isRectCleared` + `rectFree` reject them) and
      **connector roads** BFS'd from each building's **visible door** to the nearest
      skeleton cell over free ground (never a footprint, never rubble). Arterials render
      only through core + cleared sectors (extend as rubble clears); connectors drawn
      inset/lighter. Legacy saves with a building on a skeleton cell relocate on load
      (`cityPacker.skeletonOffenderMoves`, applied in `deserialize` for **all** placement
      states — built/queued/unbuilt). `doorSide: 'sw'|'se'|'s'` added per type in
      `buildings.js` (authoritative table from Steve's sprite eyeball). Tests: `cityRoads`
      (skeleton determinism/unbuildable, no road cell intersects any footprint, arterials
      gated by cleared sectors, doorSide validity + perimeter), `cityPacker` (never seats on
      skeleton, `skeletonOffenderMoves` migration), `buildingManager` (after load zero
      placement rects of any state hit skeleton).
    - **Edge forest + footprint retune.** `GRID_MARGIN_TILES` 4→9 so the camera clamp never
      shows the void; `cityGround.treeScatter` fills the surround with dense pines/broadleaf
      (density rising to the rim) + sparse dead trees in uncleared rubble, painter-ordered
      with buildings. Footprint buckets: `infantryhall` + `cavalrystable` 4×4→3×3 (sprite
      fits ~1.2–1.35), so 4×4 is now only `townhall` + `heroquarters` (save-safe shrink).
    - **Verified:** `npm test` **239/239**; boot/dev/world/**tutorial ×3**/sector smokes all
      PASS, zero page errors; `check-comments` clean on every touched file; `?dev`
      screenshot (scratchpad `base-roads.png`) shows the ring+arterial cross with buildings
      clustered in the quadrants (never on the skeleton), a pine cluster in the surround,
      and dead trees + debris in the rubble.
    - **Follow-up (2 play-test issues).** (1) **Sprite-offset report — NOT reproducible;
      anchor is provably correct.** A headless measurement probe (`tests/browser/align-smoke.mjs`,
      now permanent) projects each built building's footprint front (south) corner and compares
      it to the proxy rect's bottom-center: **Δ = (0,0) px** for every building at home framing
      AND after a pan. Root cause of the *report* is not a code offset — sprite, on-canvas label,
      proxy rect, and roads all derive from the single `_frontWorld(slot)` anchor, so they cannot
      diverge; transparent sprite bottom-padding is ≤13px. The likeliest source of Steve's
      screenshot is a stale cached build from the mid-task window (I was resumed after a usage
      limit; between the `cityGround` rewrite and the `CityRenderer._groundState` rewiring the
      ground briefly mismatched). The align-smoke locks the "sprites seat on their plots"
      invariant (ADR 0021/0022) going forward. (2) **Sector tooltip lifecycle.** The clear panel
      was pinned by tap and only ever `refreshSector`'d — on completion it re-rendered a *cleared*
      sector with a bogus "Clear Rubble" button and never closed. Fix: `city:sectorCleared` now
      `TileTooltip.closeSector(id)` auto-closes a panel open on the just-cleared sector; the panel
      is **pinned only by an explicit tap** (`showSector(..., {pinned})`), while **hovering** a
      rubble/clearing sector shows it transiently (new `CityRenderer._setSectorHover` →
      `onSectorHover/Leave`, reusing the building hover path; never steals a pinned panel). The
      countdown keeps ticking in place (`patchSector`, ADR 0007). Covered by two new
      `sector-smoke` assertions (panel opens on tap; auto-closes on completion). `window.game.city`
      is now exposed on base-view entry as a debug/automation handle for these probes.
    - **Deferred / notes:** `CityRenderer.js` (~979 ln) and `BuildingManager.js` (~1046 ln)
      remain over the ~400 ceiling — additions this session were kept thin (skeleton
      geometry, roads, trees, migration all live in siblings: `cityGrid`/`cityRoads`/
      `cityGround`/`cityPacker`). A `siegeworkshop` footprint mismatch was noted (2×2 vs
      ~1.3 sprite fit → arguably 3×3) but left alone: growing a footprint is **not**
      save-safe without overlap-migration, and only shrinks were in scope.

### Landed this session (2026-07-19)

17. **Tutorial spotlight race fixed** (parent session, found re-verifying Phase B —
    `tutorial-smoke` was flaky ~1-in-5). `UIManager._showTutorialStep` applied the
    spotlight **once** 250 ms after the step event; when the canvas proxy tiles
    weren't in the DOM yet (asset load now outlasts 250 ms on cold boot) it fell to
    the nav-pulse fallback and hid the ring **permanently** (`_repositionRing`
    ignores hidden rings). Now retries every 300 ms (≤40×) until the selector
    resolves, upgrading fallback → ring; timer cleared on hide. Pre-existing race,
    surfaced by the heavier Phase A/B boot. `tutorial-smoke` also hardened (keeps
    dismissing a late story dialog while polling; logs last measurement on timeout).
    Verified: 8/8 tutorial-smoke runs green (was 5/8); 227/227 + other three smokes
    unaffected. **Debt noted:** `UIManager.js` ~738 ln — extract the tutorial
    spotlight block (`_showTutorialStep`/`_applySpotlight`/`_repositionRing`/
    `_hideTutorial`) into a `TutorialSpotlight` module next touch.

16. **Base layout rework Phase B — roads, rubble sectors, textured ground** (ADR 0022;
    plan `docs/base-layout-plan.md`). Implemented by an Opus subagent.
    - **Textured city ground** (`js/ui/city/cityGround.js`) replaces flat `GROUND_COLOR`
      diamonds + district tints: per-cell earth/cracked/ash (deterministic hash), road
      tiles on road cells, rubble tiles + debris scatter on uncleared sectors. Single
      full-extent offscreen raster, re-rastered only on road/clear-set change (city is
      small + fixed → one cache beats the world map's chunk grid; noted vs the spec's
      "16×16 chunks"). Assets: `assets/tiles/ground/grit/`, `props/grit/`.
    - **Auto-derived roads** (`js/ui/city/cityRoads.js`, pure): door→nearest-web Manhattan
      L-paths seeded at the HQ door; deterministic, regenerated on layout change, **never
      serialized**. `cityAgents.js` walkers/drone now follow the derived road graph.
    - **Rubble-sector expansion** — `js/entities/data/citySectors.js` (4×4 block tiling;
      central 2×2 core, 8 ring-1 + 4 ring-2 sectors; `sector_<ring>_<n>` save-key ids;
      cost ×2.5/ring: ring1 wood600/stone400/iron150 @120s HQ2, ring2 ×2.5 @300s HQ4 —
      generous, tighten later). `js/systems/building/sectorState.js` (owned by
      BuildingManager) holds `{cleared, clearing}`, serialized; **grandfathering** on load
      (any sector under a placed building auto-clears; legacy saves migrate full-grid then
      reconcile). Placement (packer/ghost/move) confined to cleared cells. Tap a rubble
      sector → `TileTooltip.showSector` → `ui:clearSector`; clears show progress + dust,
      emit `city:sectorCleared`.
    - **Retired**: `js/entities/data/cityBlueprint.js` + `js/ui/city/cityLayout.js`.
      `CATEGORY_ZONE` + grid dims moved to `cityGrid.js`; isoMath/CityRenderer/GAME_DATA
      updated. Camera `homeIfUntouched()` re-frames HQ on base re-entry until the player
      pans (fixes the item-15 off-centre known issue).
    - **Verified:** `npm test` **227/227** (+24 — citySectors, sectorState, cityRoads,
      packer predicate, grandfathering + sector round-trip + no-serialize-footprint).
      boot/dev/world/**tutorial** smokes all PASS, zero page errors; `check-comments`
      clean on every touched file. `?dev` screenshot (scratchpad `phaseb-base.png`) shows
      textured ground, road L-paths to the HQ, and debris-scattered rubble edges.
    - **Deferred / notes:** Phase C (adjacency bonuses) unchanged. `BuildingManager.js`
      (~1039 ln) and `CityRenderer.js` (~950 ln) remain over the ~400 ceiling
      (pre-existing debt; Phase B kept additions thin via the sector/ground/road siblings)
      — a `citySectorPanel` / renderer-draw extraction is the next split candidate.

15. **Base layout rework Phase A — free placement shipped** (ADR 0022; plan
    `docs/base-layout-plan.md`). Implemented by an Opus subagent (spec in-session);
    the agent hit a usage limit mid-docs, so this entry + roadmap tick were written
    by the parent session after independently re-verifying everything.
    - New: `js/entities/data/cityGrid.js` (half-tile cells, 44×32, rect geometry/
      bounds), `js/systems/building/cityPacker.js` (deterministic spiral packer, HQ
      pinned center, category anchors N/E/S/W), `js/systems/building/placementStore.js`
      (`instanceId → {cx,cy}` + occupancy), `js/ui/city/cityGhost.js` (move drag-ghost
      with validity fill), `tests/browser/tutorial-smoke.mjs`. Deleted:
      `js/ui/buildings/PlacementController.js`. `buildings.js` gained per-type
      `footprint` (2×2/3×3/4×4 cells). `cityBlueprint.js` keeps roads/districts
      (visual only, Phase B replaces); plots retired.
    - `CityRenderer` draws footprint rects (sprite bottom-center = rect front corner,
      ADR 0021 anchor); proxy layer tracks instance footprint rects so the tutorial
      spotlight contract survives (`.base-tile[data-building-id]` unchanged).
    - Legacy saves: plot-id-string placements are dropped on deserialize and every
      instance re-places via the packer (regression-tested).
    - **Verified by the parent session:** `npm test` **203/203** (+20); boot/dev/
      world/**tutorial** smokes all PASS, zero page errors; `check-comments` clean on
      every Phase A file; live probe confirms packer layout (HQ 4×4 at cell (20,14) =
      grid center, military W / production E / civic N / residential S); `?dev`
      screenshot shows built sprites + dashed footprint ghosts correctly clustered.
    - **Known issues:** (a) on `?dev` (boot→world→navigate back to base) the camera
      home frame can be off-center until a double-tap re-homes — check whether a real
      save's straight-to-base boot is affected; consider calling `home()` on base-view
      re-entry. (b) `docs/10-design/city-view.md` was updated by the agent but not
      re-reviewed line-by-line — skim it next session.

14. **Grit reskin A3 Session 2 — render-to-grid sprite rig; all 20 types wired**
    (ADR 0021, amends 0020). The "native px + shared 0.34 trim" approach broke on
    multi-pack sources (accidental relative sizes, footprints disagreeing with the
    grid) — replaced by a headless-Chromium three.js rig (session scratchpad `rig/`:
    `render.html`, `render-rig.mjs`, `jobs-*.json`, `catalog-zips.ps1`, `base-shot.mjs`)
    with an ortho camera locked to the 128×96 diamond; per-type `fit` = footprint in
    tiles; sprite bottom pinned to the tile front vertex. Loaders: glTF/GLB/OBJ+MTL.
    - `GRIT_BUILDING_MAP` now covers **all 20 types** (Sonnet subagent wired 13 per
      spec; well + siegeworkshop added after gap-fill renders). Sources: UFR pack (15),
      Farm Buildings (well, cavalrystable barns, lumbermill L2–3 open barn), Zombie
      Apocalypse (well L3 water tower, siege container/armored truck). `townhall`
      swapped TownCenter plaza → **Temple** (reads heavier). Kenney `ISO_BUILDING_MAP`
      is now load-failure fallback only.
    - `CityRenderer._drawLevelBadge` now renders the bottom label line — "Lv4 HOUSE 1"
      pill+name under the plot (Steve's call; above-sprite badges overlapped tall art).
      Name drawing moved out of `_drawSlot` for built slots.
    - Rig look pass 2 (Steve: "most buildings don't look good / well placed"):
      front-corner seating (model footprint front corner pinned to tile front vertex),
      sun 2.4→1.7 with self-shadowing, `saturate(.82) brightness(.96) sepia(.10)`
      post-filter to harmonize the three packs' palettes. All 60 sprites re-rendered
      via consolidated `rig/jobs-all.json` (the one source of truth for type→model+fit).
    - Model catalog of every incoming zip: scratchpad `rig/catalog.md`. Pre-rig sprite
      backup: `rig/backup-grit-v1/`.
    - **Verified:** `npm test` 183/183 (new `tests/unit/cityAssets.test.js`); boot +
      dev smokes PASS, zero page errors; `?dev` screenshot shows new sprites seated
      on-grid at consistent scale.
    - Eyeball round 2 (Steve): bottom label line hidden for the hovered slot (hover
      pill was doubling it); heroquarters → Wonder_SecondAge castle, archeryrange →
      Archery_SecondAge, rallypoint → WatchTower_SecondAge. Gotcha: PS5.1
      `Set-Content -Encoding utf8` writes a BOM that broke the rig's jobs JSON parse
      (driver now strips it) — a "re-render" silently no-oped once; check render-rig
      output lines, not just the copy step.
    - Eyeball round 3 (Steve): `townhall` → **Wonder_FirstAge** (the golden ziggurat —
      "like the golden building"); rig gained `clampL` (per-job material-lightness
      clamp — fixes the farm-pack barns' black/white roofs on lumbermill/cavalrystable)
      and per-job `filter` overrides (mine/quarry/watertower darkened to earthy).
    - Eyeball round 4 — full in-game contact sheet (`rig/contact-sheet.mjs`: ?dev boot,
      raises HQ→8 then every type's instance 0 to L1/L2/L3 via `bm.build(id,0)` +
      synchronous drain, screenshots `sheet_L{1,2,3}.png`; bank stalls at L1 and
      magictower at 0 — deeper prereqs/tech, sprites reviewed from renders instead).
      Fixes: OBJ Phong **specular was defeating `clampL`** (cream-white barn roofs) —
      rig now zeroes specular on clamped materials; rocks pushed earthier
      (brightness .66–.68, sepia .3); military-cluster fits trimmed ~0.1 (barracks
      1.15, archery/infantry 1.2, heroquarters 1.35, siege 1.15/1.3) to reduce
      adjacent-plot sprite collisions. **Base sprite set is declared done** pending
      Steve's final look.
    - **Known / next:** per-type `fit` numbers await Steve's eyeball on the real save;
      city ground is still flat diamonds (next pass); rig lives in the session
      scratchpad — copy it somewhere durable if it should outlive temp cleanup.

### Landed earlier (2026-07-18)

13. **Grit reskin A3 Session 1 — grit building sprites + iso retune** (ADR 0020, amends
    0009/0010). The plan-of-record square-grid projection swap was **dropped mid-session**
    when measurement contradicted it (surfaced to Steve, who chose "retune iso"):
    - **Two reality corrections.** (a) The Quaternius "Ultimate Fantasy RTS" zip ships a
      `PNG/` folder of finished ¾-**iso** renders (1024², per family × level × age, CC0 1.0)
      — **no Blender** (ADR 0010's render step is moot; the `.blend`/`.fbx`/`.gltf` are unused
      3D source). (b) Those renders have **diamond footprints** (measured ~1.1–1.3:1 from
      TownCenter fence corners), so they need a **diamond grid** — ADR 0009's square-grid swap
      would sit crooked. `gridMath.js` was **not** written.
    - **isoMath retuned, not replaced:** `TILE_W 132→128`, `TILE_H 66→96` (~1.33:1),
      `GROUND_BOTTOM = TILE_H/2`. Everything parametric carried over; the one extra fix was
      `CityCamera.minZoom` (had `66/33` hardcoded → now from `TILE_W`/`TILE_H`).
    - **Buildings draw at native px** (removed the fit-to-plot-width seating). Sprites are
      trimmed offline (alpha bbox) and downscaled by **one shared factor (0.34)** so relative
      sizes are authored (town hall > house); bigger buildings overhang their plot. Trim tool:
      scratchpad `trim-sprites.mjs` (headless Chromium — no PIL/ImageMagick/Blender).
    - **Ground → flat-color diamond cells** (`GROUND_COLOR` in CityRenderer); Kenney landscape
      diamond sprites retired (they were 2:1). A city terrain atlas is a later pass.
    - **Level-keyed manifest:** `GRIT_BUILDING_MAP[type]={1,2,3}` + `gritBucket` + `building(id,
      level)` in `cityAssets`, mirrored in `cityGrade` (grades every variant key); falls back
      to legacy `ISO_BUILDING_MAP` (Kenney) for un-migrated types. **Wired the five**
      always-on-screen types (townhall/house/farm/barracks/storehouse, L1–L3). Sprites in
      `assets/tiles/buildings/grit/<key>_L<n>.png`.
    - **Asset download subagent** pulled the rest of the `assets.md` checklist into
      `assets/_incoming/` (git-ignored) with a `SOURCES.md`: 11 packs landed (Kenney ×6,
      KayKit, Low Poly Forest, Chest, Cethiel Weapons, game-icons **CC-BY → needs credit**);
      **6 Quaternius packs are MANUAL** (itch JS-gated — Farm Buildings, Zombie Apocalypse,
      Cube World, Mech, Spaceships, Guns; URLs in `SOURCES.md`).
    - **Verified:** `npm test` **182/182**; boot/world/dev smokes all PASS, **zero page
      errors**; `?dev` base screenshot shows grit barracks + townhall-L3 seated on the flat
      diamond grid, graded, level badges, empty-plot pads/labels intact. `check-comments`
      clean in all edited/new files (only pre-existing UIManager violations remain).
    - **Known / next:** un-migrated types show legacy Kenney boxes (interim). `townhall` uses
      TownCenter (monument plaza — reads light as an HQ; one-line swap to Temple/Wonder). Gap
      types (well/workshop/siege/cavalry/construction) need the staged gap-filler packs.

12. **Grit reskin Phase C3 — DOM/UI juice** (ADR 0019). Presentation only, no gameplay,
    no new save state, no new manager.
    - New `js/ui/fx/numberTicker.js` — pure `tickTo(el, target, format)`; per-element
      `WeakMap` state retargets a running count-up instead of stacking; ~320ms ease-out;
      formats `Math.round(val)` per frame (keeps `fmt`'s K/M rounding clean); first call
      per element sets instantly (no count-from-zero on boot). Wired into
      `NavigationUI._renderResources` — only the value ticks; cap/rate stay instant.
      Passive income now visibly counts up (retargets every 2Hz `resources:tick`).
    - New `js/ui/fx/resourceFlyout.js` (`ResourceFlyout`, instantiated once by UIManager) —
      on `resources:added` (fires only on discrete `add()` rewards, never passive ticks)
      flies a `.res-fly` coin (reuses the masked `.res-icon--{key}` art) from mid-screen
      into `#res-{key}`, then pulses the chip with the existing `tick-flash`. Pooled cap
      (24 live), skips when `document.hidden`. **Origin is mid-screen, not the true event
      source** — `resources:added` carries only `{key: amount}` (ADR 0019).
    - Sheets get `--transition-spring`: `.world-panel` (PoiDetailPanel) spring transform;
      `.world-sheet` (MarchDispatchSheet) + `.bp-sheet` (BuildablesPanel) are
      `display:none`-toggled so they get an entrance keyframe (`sheetRise`/`bpSheetRise`)
      that restarts on display. Toasts were already spring.
    - Universal button feel: `.btn:active:not(:disabled){scale(0.95)}` + one capture-phase
      `document` click listener (`UIManager._installButtonSfx`) that emits `ui:click` for
      any button. ~200 callsites already emit it manually → `SoundManager.click()` now
      **coalesces** (drops calls within 60ms) so there's exactly one click sound. Global
      `prefers-reduced-motion` guard added to `reset.css`; ticker/flyout also short-circuit
      on it in JS.
    - **Verified:** new `tests/unit/numberTicker.test.js` (5 tests, rAF/performance stubbed
      — instant first set, non-finite passthrough, animate-to-target, integer mid-frames,
      same-value settle; `npm test` **182/182**). boot/world/dev browser smokes all pass,
      **zero page errors**. Headless `?dev` probe (scratchpad `c3-probe.mjs`): reward coins
      spawn + reap, the money chip climbs 500→5000, and a mid-flight sample (2049) proves
      the tick-up is animated not instant. `check-comments` clean in all new/edited files
      (flagged violations are all pre-existing, in the queued cleanup task).

11. **Simultaneous-event feedback serialized (audio + UI).** When several events
    completed on the same tick (e.g. `quest:completed` + a milestone), overlapping
    `voice`-category clips garbled into a "merged voice," and toasts stacked 3-up.
    - **Audio:** `SampleLibrary` now runs the `voice` category through a single-channel
      **queue** (`_voiceQueue`, cap `VOICE_QUEUE_MAX = 3`) that drains one clip at a time,
      each scheduled by `setTimeout(clipDuration + 0.12s gap)`. Non-voice categories still
      stack. Regression tests in `tests/unit/sampleLibrary.test.js`.
    - **UI:** `NotificationManager` `MAX_VISIBLE` `3 → 1` — the existing `_queue`/`_flush`
      now reveals toasts strictly one at a time. Covered by the boot smoke tier
      (DOM-bound). Backlog note: at `TOAST_DURATION_MS = 4000` a big burst takes a while
      to drain; tune the duration if it feels slow.

10. **Grit reskin Phase C2 — canvas juice** (ADR 0018). Shared pooled particle system
    lands feel-motion on both canvases; no gameplay/state change.
    - New `js/ui/fx/particles.js` — `ParticleField`: pooled, **space-agnostic** (draws
      under whatever ctx transform is active), pure `update(dt)` (integrate → drag → reap
      by in-place compaction, unit-testable in Node). Shapes `dot`/`spark`/`ring`; emitter
      helpers `haze`/`burst`/`ripple`/`puff`. Each renderer keeps **two** fields — a
      screen-space one (ambient) + a world-space one (anchored fx).
    - `WorldRenderer` — `_ash` + `_fx`; `_frame` updates both every frame and redraws on
      dirty/marches/live-fx/~30fps ambient tick. Public `impactAt(poiId, kind)` +
      `rippleRegion(regionId)`; **WorldMapUI** fires them from `march:arrived`
      (victory→amber burst, defeat→grey) and `world:regionCaptured` (green ripple at region
      centroid). `_drawMarchArcs` now draws a fading 4-dot trail behind the mover + an ETA
      pill (`m:ss`, `⚔` while acting) from the phase's absolute timestamp.
    - `CityRenderer` — `_dust` + `_fx`; `syncState` precomputes `_smokers` (built
      production slots) + `_builders` (constructing); `_updateFx` trickles dust, dark
      chimney smoke, and construction dust (all count-paced). `popTile()` (from `cityInput`
      on a building tap) → `_popScale` gives a ≤13% bottom-anchored sprite pop over 260ms.
    - **No new save state** (fx are transient, like fog/boss windows). Pool caps bound
      draw cost. Ripple/impact take **ids not display names** — a fiction name silently
      no-ops (ADR 0002/0017 rule).
    - **Deferred (C2 follow-up, TODO):** battle-toast screen flash + camera nudge; building
      2-frame light-flicker overlays. Lower value, touch toast/overlay wiring.
    - **Verified:** new `tests/unit/particles.test.js` (8 tests — pool cap, integration,
      reaping/compaction, fade envelopes, emitter counts; `npm test` **174/174**). boot/
      world/dev browser smokes all pass, **zero page errors**. Headless `?dev` eyeball
      (scratchpad `c2-shot.mjs`): convoy mover + live ETA pill drawn on a dispatched gather
      march, green capture ripple expands over Home Refuge, terrain/ash render; farm built
      to Lv.1 to exercise the smoker path. `check-comments` clean in all edited/new files.

9. **Grit reskin Phase A4 — fiction pass** (ADR 0017). Post-apocalypse re-fiction of the
   fantasy strings — **display strings only, never ids** (ids are save keys). No systems
   or geometry changed.
   - `worldMap.js` — factions (Goblin Clans → Scavenger Packs/SCAV, Bandit Coalition →
     Red Talon Raiders, Wildlands → The Free Wastes), region names (Mistwood → Ashwood,
     Goblin Crest → Vulture Ridge, Dragon Spire → Behemoth Spire, Home Vale → Home
     Refuge), curated POI names + icons (Dragon's Lair → Behemoth Nest 🦂, Haunted Keep →
     Irradiated Depot ☢️, Warden Shrine → Warden Bunker 📡, watchtower → Radar Mast 📡,
     Goblin Camp → Scav Camp 🪓, castle/pagoda fort emoji → 🏭/🚧). Every id, factionId,
     monsterId, capturesRegion, regionId, and numeric field byte-identical.
   - `combat.js` — `MONSTERS_CONFIG` + `CAMPAIGNS_CONFIG` names/icons/descriptions/wave
     names (goblin_camp → "Scav Warband", undead_legion → "Ghoul Horde" ☣️, demon_gates →
     "Meltdown Site" ☢️, dragon_lair → "Behemoth Nest", chaos_titan → "The Colossus",
     etc.). All ids/monsterId/campaignStage/requires/stats untouched.
   - `buildings.js` — `magictower` only: Magic Tower → **Comms Tower** 📡, description +
     effectLabel de-magicked. Id `magictower` stays (save key + nav-view key). Every
     other building name was already genre-neutral.
   - `story.js` — light re-fiction of all 6 chapters (keep/empire/arcane → outpost/
     settlement/power-grid; Steward → Quartermaster, Scholar → Engineer). Ids/questIds/
     buildingIds/triggers/rewards preserved.
   - **Deferred to a later light pass (TODO, ADR 0017):** the **hero cast** (`heroes.js`
     + hero-card/fragment strings in `economy.js` — Arch Sorceress/arcane skills, Lord
     Arcturus) is left for the Hero recruitment redesign (skill names are id-coupled;
     re-fiction it there to avoid double churn); **unit tier names** (`units.js` —
     Paladin/Crusader/Templar/Archon) are borderline and out of A4 scope.
   - **Verified:** new regression test `gameData.test.js` → "save-key ids are unchanged
     by fiction passes" freezes region/faction/curated-POI/monster id sets (`npm test`
     **166/166**). boot/world/dev browser smokes all pass, **zero page errors**;
     world-smoke's id-driven seed/reconcile + region-ownership checks confirm no id was
     orphaned. `check-comments` clean in the edited files.

8. **Multi-instance buildings are now numbered where you look at them.** Bug: upgrade
   prereqs read "Upgrade House 1 first" but every House/Barracks/etc. showed the same
   bare "House" label on the map and in the click-tooltip, so you couldn't tell which
   physical copy was 1. `getBuildingTypesWithInstances()` now stamps a `displayName`
   (`<name> <idx+1>` when `instanceSlots.length > 1`, plain name otherwise) on each
   instance; consumed by the CityRenderer on-map label + hover pill, the TileTooltip
   header, and the BuildQueueSidebar rows. BuildingCards numbers via its own `instLabel`
   pill (same `totalSlots > 1` rule). Numbering is 1-based, matching the requirement
   strings in `BuildingManager` — the `#` was dropped from those too, so everything
   reads "House 1 / House 2" (no hash). The type-level BuildingInfoPanel stays unnumbered
   (per-type, not per-instance). Also: **unbuilt (planned) on-map labels recolored** from
   the old bluish `rgba(140,200,240,.65)` to warm amber `rgba(240,180,90,.8)` so a
   surveyed-but-unbuilt plot reads distinctly from a built one (built stays light-blue).
   Regression test in `tests/unit/buildingManager.test.js` (npm test 165/165).

7. **Concurrent build workers** (ADR 0016). The build queue was one-at-a-time
   (`_buildQueue[0]` = sole active); the Construction Hall's extra slots only added
   waiting depth, so unlocks never sped up the clock. Now every unlocked slot is a
   concurrent worker over one shared FIFO queue, +2 waiting buffer (capacity =
   workers + 2).
   - New pure module `js/systems/building/buildQueue.js` — worker-pool helpers
     (`fill`/`nextStartable`/`earliestDue`/`earliestActive`/`capacity`); active = item
     with `endsAt` set; same-instance items never run in parallel (upgrades stay serial);
     a freed worker skips ahead to the first startable item.
   - `BuildingManager`: single `_catchup(nowMs)` replaces the three head-drain loops
     (tick/offline/deserialize); `build()`/`cancelBuild()` push-then-`fill`; `getBuildQueue()`
     returns actives-first (+ `waitingPosition`); per-instance active detection in
     `getBuildingTypesWithInstances()`/`getActiveBuildings()`; `reduceActiveTimer(sec,
     instanceId?)` targets a specific active. Legacy saves fan out to N workers on load.
     Drive-by fix: `applyOffline` `elapsedSec` ReferenceError.
   - UI: sidebar renders multiple active rows with independent speed-up/cancel; speed-up
     threads `targetInstanceId` through SpeedupPicker → `InventoryManager.useItem` →
     `reduceActiveTimer`. Header shows `active/workers · N waiting`.
   - Tests: `tests/unit/buildQueue.test.js` (7) + `tests/unit/buildingManager.test.js` (13).

6. **Sandbox spend is now free** (`ResourceManager`). Bug: with `?dev` (sandbox mode) the
   boot flood topped resources once, but every build after that *depleted* the stockpile
   normally — you'd wait for production to refill like a real playthrough. Now
   `canAfford()` returns `true` and `spend()` deducts nothing in sandbox mode, so dev
   builds are truly unconstrained (matches the existing sandbox 10× `add()` / 100× build
   speed). Campaign/survival unchanged. New regression test
   `tests/unit/resourceManager.test.js` (2 tests, `npm test` 144/144). Also trimmed two
   pre-existing narrative comments in `ResourceManager.js` (comment-lint).

5. **Grit reskin Phase C1 — real sound** (ADR 0015). The Kenney `.ogg` packs under
   `assets/audio/` finally play; nothing did before.
   - New `js/systems/sound/sampleLibrary.js` — `MANIFEST` (preset key → files), lazy
     `fetch`+`decodeAudioData`, random-variant pick, per-category volume
     (`ui`/`combat`/`reward`/`fanfare`/`voice`). `tryPlay(key)` plays a decoded buffer and
     returns `true`, else kicks off the async load and returns `false`.
   - New `js/systems/sound/ambientBed.js` — procedural brown-noise wind bed (lowpass +
     slow-LFO swell), idempotent start/stop with fades. World view only.
   - `SoundManager` unchanged in shape (163 → ~200 ln): every tone preset is now
     `if (this._sample(key)) return; <existing tone>` — **sample-first, tone fallback,
     zero regression**. It owns the ambient lifecycle (subscribes `ui:viewChanged` +
     `settings:changed`; bed runs only on `world` view with `sfxEnabled && ambientEnabled`).
     `click`/`switch` warmed at construction. New event wires: `combat:started`/
     `combat:marchResolved` → impact, `march:dispatched` → voice bark (no tone fallback),
     `march:completed` → mission-complete voice.
   - `SettingsManager` gains `ambientEnabled` (default true) + a toggle in `SettingsUI`.
     `window.game` now exposes `sound` + `settings` for probes.
   - **Tests grown:** `tests/unit/sampleLibrary.test.js` (4 tests — manifest file paths
     `.ogg`/known-dir, every category has an in-range volume, no dup variants). `npm test`
     **142/142**. Both browser smoke scripts still pass (zero page errors — sound modules
     load, ambient starts on world-nav without throwing).
   - **Verified** (scratchpad `c1-sound-probe.mjs`): headless Chromium decodes the OGG
     samples (5 click variants + 2 victory voice variants), ambient bed runs on the world
     view and stops on both the `ambientEnabled` toggle and leaving the view; AudioContext
     resumes on gesture; no page errors. **`.ogg` decode is Chromium-native.**
   - **Note:** a manifest path that is well-formed but points at a *missing* file is only
     caught at runtime (drops to tone). Keep `MANIFEST` in sync with `assets/audio/`.
   - **Tuned by ear (Steve, 2026-07-18):** the chiptune sets (`jingles_NES`/`jingles_HIT`)
     were rejected on listening and are no longer wired anywhere. Final map in ADR 0015:
     build/train = metal clunk, research = its own bright synth chime, quest/march-return =
     "mission completed" voice, achievement = heavy bell toll, reward collect (mail /
     inventory / market / march haul) = leather-pouch pickup. Steve signed off: "everything
     sounds better now." One open caveat: `coin`/`dropLeather` is single-variant (repeats
     on rapid collects) — add variants if it grates.

### Landed this session (2026-07-18, earlier)

4. **`?dev` session flag** (ADR 0014) — kills the from-scratch tax on eyeballing gated
   views. `http://localhost:8000/?dev` boots straight to an unlocked world map: no auth
   click-through, no tutorial, no new-game modal.
   - New `js/core/devSession.js` (~75 ln). Drives the **real** manager APIs: sandbox
     mode → `completeTutorial()` → `buildingManager.build()` raises HQ to Lv.3 + builds
     Rally Point (unlocks the World tab) + Barracks + Infantry Hall → trains infantry and
     forms a squad → `ui:navigateTo` `world`. Sandbox queues are drained synchronously via
     the managers' own `update(dt)` loop; resources floored through public `setCap`/`add`.
     No hand-crafted save, no internal poking — so it can't drift from the serialize format.
   - `main.js` gates on `isDevSession()`: launches as guest, forces `savedState = null`,
     and **skips all persistence** (autosave, `beforeunload`, queue/purchase save hooks) —
     a dev session never reads or overwrites `basie_game_state`, so the real save survives.
   - **Closes the march-test gap** B1 flagged: a fresh guest save had no squads, so march
     dispatch couldn't be driven live. `?dev` now boots with a 4-unit squad in place.
   - **Verified** (`tests/browser/dev-smoke.mjs`, committed): lands in sandbox at HQ Lv.3
     with Rally Point + a march-ready squad on the world map, a pre-seeded real save intact,
     zero page errors. `npm test` 138/138; `boot-smoke` still green (normal boot unregressed);
     `check-comments` clean in the new files (16 pre-existing violations untouched).
   - The military step is best-effort (wrapped) — if the train/squad model shifts, `?dev`
     still boots to the unlocked map, which is the primary goal.

### Landed this session (2026-07-16, latest)

3. **Grit reskin Phase B2 — grid renderer** (ADR 0013). The world map finally *looks*
   like a tile grid; B1's data is now on screen.
   - New `js/ui/world/gridLayer.js` (226 ln) — owns the terrain pass: cells, faction
     tint, per-cell fog, cell + sector seams. Rasterises 16×16-cell chunks into 512×512
     offscreen canvases (`TEX_CELL` 32), LRU-capped at 24, blitted with
     `imageSmoothingEnabled = false`. **Nearest-neighbour is exact here** because every
     cell is a uniform block, so one cached scale stays crisp from zoom 0.075 to 1.6 with
     no per-zoom re-raster. Below `LOD_ZOOM` (0.22) chunks flat-fill instead.
   - `WorldRenderer` **504 → 426 ln**: `_drawTerrain`/`_drawRegions`/`_drawRegionTile` and
     the whole organic warp field (`_warpX`/`_warpY`/`_outline`/`_traceRegion`) are gone,
     replaced by `this._grid.draw()` + a slim `_drawRegionLabels()`. `syncState()` now
     also calls `gridLayer.invalidate()`. The command-ruin "ready to assault" pulse became
     a sector-rect stroke.
   - **No new save state** — fog is a pure function of `isRegionUnlocked` + reveal circles
     from player-held `revealRadius` outposts (the same sources `revealArea` uses).
   - Tuning found by eye from screenshots, not guessed: the tint carries **two alphas**
     (0.14/0.11 over terrain so it doesn't drown the cells; 0.34/0.26 at flat LOD where
     it's the only territory signal), terrain colours were spread across a real **value**
     range (hue-only variation vanished under the tint), and region labels render at
     **constant screen size** with no zoom gate — they'd disappeared exactly when zoomed
     out, which is when you need them.
   - `POI_PICK_RADIUS` 42 → 50 (half a cell). `HOME_ZOOM` left at 0.7 — verified it frames
     ~18 cells across, which reads right; the plan's "retune it" turned out unnecessary.
   - **Verified:** 60fps during a drag sweep (16.7ms median, **16.8ms p95**), headless
     1280×800, zero page errors. Screenshots at home/zoomed-out/max zoom: terrain variety
     reads, cells crisp at max zoom, capture recolours correctly.
     `npm test` 138/138; both smoke scripts pass; `check-comments` clean.
   - **Tests grown:** `tests/unit/gridLayer.test.js` (10 tests — chunk geometry, LOD
     threshold, and the **chunk⊂sector invariant** ADR 0013 leans on: tint/fog resolve once
     per chunk, valid only while `SECTOR.cells % CHUNK_CELLS === 0`). Plus 3 `world-smoke`
     checks. Both were break-tested (deliberately broke `invalidate()` → red → reverted).
   - **Two things the break-test caught, worth knowing:** (a) a whole-canvas hash is a
     **flaky** metric here — boss/ruin markers pulse on their own timers, so it self-drifts
     and false-passes; the check asserts on owned-tint *hue* instead. (b) the zoomed-out
     flat-LOD path **bypasses the chunk cache entirely**, so a cache bug is invisible there
     — the smoke test pans at default zoom on purpose. A future grid test that zooms out to
     "see more" would silently stop testing the cache.

### Landed this session (2026-07-16, later)

2. **Persistent test suite** (ADR 0012) — the first tests in the repo. Additive by
   contract: it only ever grows, so a bug fixed once stays fixed instead of being
   re-probed from a scratchpad every session.
   - **Tier 1 — `npm test`**: 128 `node:test` unit tests, zero dependencies, in
     `tests/unit/` (one file per source module). Covers `gameData` (blueprint zone
     capacity — the `_ensurePlacements` gotcha — requirement refs, resource keys, POI
     id uniqueness/bounds), `worldState` (seed/reconcile round-trips, the ADR 0002
     gotcha; incl. filler POIs surviving a pre-B1 save), `marchResolver` (**null-POI →
     `lost_target` regression** for the fixed crash, all gather/attack/scout/boss
     outcomes), `marchMath`, `marchRules`, `regionBuffs` (**economic stacking
     regression** for the buff-wiring fix), `gridGen` (determinism, sector containment,
     no id collisions — B1's probes made permanent), `buildingRules` (incl. the "HQ"
     `shortName`), `eventBus` (on/emit/off/once, listener error isolation).
   - **Tier 2 — `node tests/browser/{boot,world}-smoke.mjs`**: committed Playwright
     scripts over a shared `harness.mjs` that codifies what was re-derived every
     session (http-server invocation, guest→sandbox flow, overlay dismissers,
     `pageerror` capture). Playwright resolves from **outside** the repo via
     `BASIE_PW_ROOT` — no heavy deps land here. Both exit non-zero on failure.
   - New root `package.json` — minimal, exists for `"type": "module"` so game ES
     modules import in Node. **Browsers ignore it; verified the game still boots.**
   - **No game source changed** — every module in scope was importable as-is; no
     testability seam was needed.
   - **Verified:** `npm test` 128/128 green; deliberately broke one assertion → exit 1,
     reverted → exit 0. Both smoke scripts pass against a live server with **zero page
     errors**; deliberately failed a check → exit 1, reverted → exit 0.
     `check-comments` clean.
   - **Deviation from the plan:** `node --test tests/unit/` (the directory form the
     plan specified) fails on Node 26 — it tries to load the directory as a module.
     The `test` script uses the glob form `node --test "tests/unit/**/*.test.js"`.

### Landed this session (2026-07-16, earlier)

1. **Grit reskin Phase B1 — grid data model + generator** (ADR 0011). Data only, no
   renderer work.
   - New `js/entities/data/worldGrid.js` — geometry owner: `GRID` (96×96 cells @ 100px
     = 9600×9600 world, ~7× the old area), 3×3 `SECTOR_OF` layout (32×32 cells per
     region, same 9 region ids), `CURATED_CELLS` (all 26 curated POIs as cell coords),
     cell↔px helpers.
   - New `js/entities/data/gridGen.js` — deterministic hash/value-noise `fbm`;
     `terrainAt(cx,cy)` → 6 terrain types (measured spread: wasteland 35%, cracked 31%,
     forest 15%, rubble 10%, water 6%, ridge 4%); `generateFillerPois()` → 99 filler
     nodes/camps, ids `gen_<region>_<n>`, spaced off curated POIs and off water/ridge.
   - `worldMap.js` reworked: authors regions/factions/curated POIs; `bounds`, `home`,
     region `rect`/`center`, POI `x,y` now **derived from cells** at the bottom of the
     file. Every downstream px consumer (WorldRenderer, WorldCamera, MarchManager)
     unchanged. Regions gained a `tier` field (1 home → 6 ruin) for filler level scaling.
   - **Generator lives in `entities/data/`, not `systems/world/` as the design doc said**
     — `WORLD_MAP` is composed at data-module load, so data would have had to import from
     systems. Recorded in ADR 0011; design doc annotated.
   - **`worldState.js` needed no changes** — its seed/reconcile is already id-driven, so
     filler POIs flow through automatically. The design doc expected a change here; it
     was wrong.
   - Px-coupled constants scaled to hold behavior: `BASE_SPEED_PX` 80 → **265**
     (march times land within ±7% of pre-B1); Mistwood watchtower `revealRadius`
     760 → **2000**.
   - **Verified** (probes in this session's scratchpad `b1/`, harness notes below):
     headless module probe — 26 curated POIs all land in their own region sector, filler
     8–14 per region, byte-identical output across two generator runs, no id collisions,
     no filler on water/ridge, home_vale camp-free. Save probe against the **real**
     `worldState.js` with a simulated pre-B1 save — node depletion, camp respawn timers,
     looted ruin, boss window, and region/outpost ownership all survive; 99 filler POIs
     seed fresh; no orphaned entries. Live browser boot (Play as Guest) — 125 POIs,
     9 regions, home at derived (1650, 8050), **zero page/console errors**.
   - **Not verified:** a real dispatched march. A fresh guest save has no squads, so
     `previewMarch` couldn't be driven live — the distance/time math was checked in the
     probe only. Worth exercising once a save with squads exists.

### Landed earlier (2026-07-15, later session)

7. **Grit reskin Phase A2 — UI theme shift (military-salvage).** Retheme is CSS-only.
   - `css/base/variables.css`: rewrote the palette — backgrounds cool-220 → warm
     gunmetal (hue 30, low sat, same lightness ladder); `--clr-primary` electric blue →
     signal-orange amber `hsl(32,90%,55%)` (+ light/dark/muted, border-glow,
     shadow/glow-primary follow); `--clr-gold` neon green → olive-drab `hsl(80,45%,45%)`;
     `--clr-success` → olive green; `--clr-warning` shifted yellower (`hsl(48,95%,52%)`)
     to deconflict from the amber primary; text hues cool-210 → warm-35; hero tiers set
     to steel / amber / deep-orange per the design doc. Water/wood/iron/money resource
     colors kept diegetic (water desaturated to a muted blue).
   - Component sweep: hue-swapped all hardcoded `hsl(200,*)`→amber(32) and
     `hsl(150,*)`→olive(80) across 11 CSS files (67 blue + 7 green occurrences); mapped
     electric-blue hex literals (`#7c83ff`,`#54d6ff`,`#58d0e0`,`#4aa6e0`) → amber and
     emerald hexes (`#34d399`,`#00b894`,`#4caf50`,`#4caf72`) → olive `#7ab143`; fixed
     `world-view.css` `.ms-squad` selected state (referenced an **undefined**
     `--clr-accent` var → now `--clr-primary`) and warmed its blue panel surfaces;
     barracks available-slot number blue → `--clr-primary`.
   - **Deferred (follow-up):** `gacha.css` has a self-contained rarity color ladder
     (rare=blue `#60a5fa`/`hsl(220,60%,14%)`, legendary=gold, etc.) independent of the
     `--clr-tier-*` vars. Remapping that whole ladder to steel/amber/deep-orange is a
     larger design pass and would collide rare-amber with legendary-gold — left intact.
   - Verified headless (Playwright, boot → Play as Guest → New Game modal): amber
     gradient on selected/CTA buttons, olive EASY dot, red HARD/danger, warm backdrop +
     amber card glow, grit-graded terrain behind, **zero console/page errors**. z-index
     ladder untouched; no selectors/ids renamed (pure value changes).

6. **UI bug fixes** (post-A1):
   - **Buildables card layout** — cards were a horizontal flex (`icon | main | action`),
     so the build button stole width and building names collapsed to a vertical
     one-char-per-line wrap. Reworked `.bp-card` to a grid (`"icon main" / "action
     action"`) so the action button spans full-width along the card bottom and the
     name/content gets the full column. CSS-only (`css/components/hud.css`).
   - **Raw `<span>` in reward fly-out** — `UIManager._showRewardAnimation` set the
     floating card via `textContent`, so `RES_META[x].icon` (an `icon()` span) showed
     as literal markup (the stray "`<span class=icon icon--money> ×100`" pill). Now
     `innerHTML` (all inputs are internal config). Verified: money/food fly-outs render
     the icon element, no literal span.
   - **Build-time hint on locked tiles** — `TileTooltip` showed the `⏱ Ns` build-time
     hint next to the disabled "🔒 Requires …" button on buildings whose prereqs aren't
     met (e.g. Cavalry Stable needing Infantry Hall Lv.3). Gated the hint on
     `b.requirementsMet`. Verified: locked cavalrystable suppresses it, buildable farm
     keeps it.
   - **Raw lock markup in tile tooltip** — `TileTooltip.patchAffordability()` re-set the
     upgrade button via `textContent`, so the locked-state label `${icon('lock')} …`
     rendered as literal `<span>` text once resources ticked. Now `innerHTML`
     (matches the `showTile` template; verified the HTML round-trips stably so the
     patch doesn't re-set every tick).
   - **"Headquarters (HQ)" too long in requirement strings** — added `shortName: 'HQ'`
     to the townhall config and a `reqName()` helper in `buildingRules.js`
     (`checkRequirements` + `collectMissing`) plus the slot-condition path in
     `BuildingManager`. All "Requires …" labels now read "Requires HQ Lv.X".
   - **Stuck in a group view with no path back to Base** — the Base⇄World flip button
     computed its target purely from `_primaryView` (base↔world), so from Economy/Market
     it pointed at World, which is HQ-locked → dead end. Added `_flipTarget()`: on a map
     view it toggles; from any other view it returns to the current map view. Also call
     `_updateFlipButton()` after a locked sub-tab (which skips `ui:viewChanged`) so the
     label doesn't lag. Verified: in locked Market the flip reads "Base" and returns to base.

5. **Grit reskin Phase A1 — grim grade + function plaques.** New
   `js/ui/city/cityGrade.js` (graded building/ground/grayscale sprite variants
   pre-rendered once at load — `_prerenderGrayscale` idiom, no per-frame `ctx.filter`;
   per-building function plaques pre-rendered from the SVG icon set; full-scene
   vignette + cold wash + horizon-haze overlay). `CityRenderer` draws through
   `_grade` accessors (+11 lines wiring only). `cityAmbient.js`: backdrop → overcast
   slate/ash, night veil → amber dusk (`rgba(150,110,75)` multiply, alpha logic
   untouched). New `js/ui/world/worldGrade.js` (ash backdrop, mud land base,
   `grime()` faction-color desaturator) wired into `WorldRenderer` region fills.
   Verified headless (sandbox boot → HQ Lv3 → Rally Point → world view): graded city
   + plaques on farm/lumbermill/well/HQ render, world regions show grimed faction
   tints on ash backdrop, zero page errors. Night veil verified by code inspection
   only (cycle timing makes screenshotting night impractical); locked-slot grayscale
   is currently unreferenced by the renderer (pre-existing). Also removed one
   pre-existing narration comment flagged by check-comments (CityRenderer).

### Landed earlier this session (2026-07-15)

0. **`CityRenderer.js` split** (1123 → 818 ln). Extracted `js/ui/city/cityInput.js`
   (pointer/gestures), `cityAgents.js` (drone + walkers), `cityAmbient.js` (day/night +
   backdrop) as collaborator classes with a back-ref to the renderer. Renderer keeps
   scene picking/hover (shares draw geometry) + all public API + drawing. Verified in
   browser: renders, hover/zoom/pan/tap clean, tutorial spotlight still pins to the
   proxy tile. Residual 818 ln left intentionally for ADR 0009's projection rewrite.

1. **March crash on removed POI** — `resolveArrival` (marchResolver.js) now guards a
   null POI at the top, aborting to a `lost_target` outcome (empty haul, squad returns).
   Covers runtime removal + load. Verified: gather/attack/scout all return cleanly on
   null POI (no TypeError).
2. **Economic region buffs → base production** (was a dead feature). Wiring:
   `ResourceManager.setWorldMapManager()` (main.js:83) + subscriptions to
   `world:buffsChanged`/`world:regionCaptured`; `recalculateRates()` applies
   `1 + economicBonus(activeBuffs(), key)` per resource. `WorldMapManager.captureRegion`
   now also emits `world:buffsChanged`; `applyGameState` emits it after world load so
   rates reflect restored regions. Decision: buffs apply **globally** (model of record).
   Verified: capturing `west_warrens` raised iron 100 → 110 (+10%) via the real event
   path. Boot smoke test clean (no page/console errors).
   - Verification harness: puppeteer/playwright installed in
     `C:\Users\Steve\AppData\Local\Temp\claude\basie-verify\`; probe scripts in this
     session's scratchpad (`buff-probe.mjs`, `boot-smoke.mjs`) — headless console tests,
     no UI clicking. `window.game` exposes `resources`/`worldMap`/`eventBus` for probes.

### Base layout rework status (approved 2026-07-19, ADR 0022)

- Plan: `docs/base-layout-plan.md`. **Phase A + Phase B shipped** (items 15, 16 — free
  placement, then auto-roads + rubble sectors + textured ground). Next: **Phase C**
  (adjacency bonuses + migration bonus toast; balance pass).

## Known issues / debt

- **`WorldRenderer.js` is 426 ln** — B2 took it 504 → 426 by extracting the tile engine,
  but it's still over the ~400 ceiling. The residual is POI-marker drawing (marker, level
  badge, state sub-badge, fog marker); `worldMarkers.js` is the obvious next extraction,
  and A4/B3 both touch marker art — do it there rather than as a standalone pass.
- **Playwright lives in a temp dir** — `C:\Users\Steve\AppData\Local\Temp\claude\basie-verify\`.
  `tests/browser/harness.mjs` resolves it from there (override with `BASIE_PW_ROOT`).
  Expect to re-run `npm install playwright` there after a temp cleanup; tier 1
  (`npm test`) is unaffected.
- **Scratchpad module probes are obsolete** — the old copy-to-scratchpad-with-
  `{"type":"module"}` trick is superseded by the root `package.json` + `tests/unit/`.
  Write a real test that imports the module instead; never copy game logic into a probe.

- **Most systems are bugged / roughly built** (owner's assessment, 2026-07-15). Feature
  checkmarks in the roadmap mean "implemented", not "verified". A systems bug audit is
  queued in `docs/30-roadmap.md` (Hardening) — treat existing manager behavior with
  suspicion and verify in the browser before building on it. A first code-review pass of
  the world/march systems (2026-07-15) found 6 concrete issues — one engine-tick crash
  path and a never-wired economic-buff feature among them — listed under the audit in
  `30-roadmap.md`.
- **Comment cleanup pending** (roadmap "Housekeeping"): run
  `node scripts/check-comments.mjs` and sweep narration comments + dead tracker refs
  (P#/B#/"Group N") across `js/` — suitable for a lower-cost model session.
- Placement model is interim-patched (anti-teleport guard); the full no-reservation
  redesign is bundled with the build-menu/tutorial rework (see roadmap, cross-cutting).
- `docs/` wiki is new (2026-07-15); design pages were back-filled from shipped specs —
  correct them in place if they drift from code.

### Landed 2026-07-18 (docs only)

- **Data consolidation plan** — audited hardcoded tunables across systems (combat
  formula coefficients, march speed/carry/dwell with no data home, MarketManager's
  entire trade table, population/cafeteria constants, starting grants, two divergent
  XP curves off the same base 500, 6 duplicated constants). Wrote the six-phase
  pure-move migration plan: `docs/data-consolidation-plan.md`; roadmap entry under
  Hardening. No code changed. Structure verdict: three-tier architecture is sound —
  this is about where numbers live, not moving modules.

## Next steps (session ended 2026-07-18 — resume here)

0. **Use the suite.** `npm test` is the cheap gate — run it before and after any change
   to march/world/data/building-rules logic, and add cases as you go (contract:
   `tests/README.md`). Worth adding when someone's in the area: SaveManager round-trip,
   march dispatch end-to-end (needs a save with squads), combat resolution.

1. **A3 is DONE** (ADR 0021) — all 20 types rig-rendered and wired. Open follow-ups:
   tune per-type `fit` after Steve eyeballs his real save (one number per job in
   `rig/jobs-*.json`, re-render + copy); **city ground pass** is the next visual work
   (flat `GROUND_COLOR` diamonds — render/texture ground tiles, likely through the
   same rig). The 6 formerly-manual Quaternius packs are **on disk now**; game-icons.net
   is **CC-BY** → needs a credit line if its icons ship.
   - Non-art alternative any time: the **Hardening** track (systems bug audit / Phase 2
     verification+balance / data consolidation Phase 1). Deferred follow-ups still open:
     two **C2** (battle-toast flash + camera nudge, building light-flicker) and two **A4
     fiction** (hero cast → Hero redesign, unit tier names `units.js`).

2. **Optional sound follow-ups (C1 is done/signed-off, only if asked):** add variants to
   `coin`/`dropLeather` (single-clip repeats on rapid collects); the deferred A2 gacha
   rarity ladder; A1/A2 by-eye tuning (plaque size, vignette, amber saturation).
3. Balance items B1 created (roadmap → Hardening): 99 filler nodes change gather supply;
   `dragon_spire`/`command_ruin` filler is unguarded (neutral → no faction enemy pool);
   `BASE_SPEED_PX` 265 preserves old times rather than being tuned for the new map.
4. Remaining world/march audit findings (lower severity, roadmap → Hardening): gather
   economic-bonus no-op clamp, `resolveMarchBattle` `milMult < 1` debuff trap, and a
   buff-dependent *UI* listener for `world:buffsChanged`.
5. Queue the comment-cleanup session (low-cost model; `node scripts/check-comments.mjs`
   lists 13 violations, all pre-existing).

## State of decisions (don't re-litigate)

- ADR 0009: diamond iso retired at Phase A3 → square-grid ¾ projection.
- ADR 0010: building art = CC0 3D render-to-sprite (Quaternius Ultimate Fantasy RTS
  base, kit-bashed to post-apoc; evolution stages → per-level sprites).
- **Asset sourcing is COMPLETE** — every visual/audio category has a named licensed
  source in `10-design/assets.md` (buildings, props, terrain, monsters, people, mechs,
  drone, war FX, skill icons, equipment, loot). Only open art item: hero portraits
  (style-locked AI gen, user approves each, done with the hero-UX redesign).
- Hero recruitment/management redesign is on the roadmap (UX friendliness) — wants a
  game-designer pass before implementation.
