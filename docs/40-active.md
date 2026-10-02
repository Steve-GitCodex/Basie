# Active — Session Handoff

> Most-updated file in the repo. Every session that changes code updates this file
> (what landed, known issues, exact next steps). See the session protocol in `CLAUDE.md`.
> Keep it to current state: replace finished sections with a short summary — history lives in
> git (`git log -p docs/40-active.md`) and decisions live in `docs/20-decisions/`.

## Current state (2026-10-01)

- Branch `Working_Branch`. Hero Quarters UI (`1ef23ab`) and Phase 2d (`c0ba036`) committed. **Uncommitted:**
  the docs cleanup + the dev dashboard / dev slots work below. Tree is commit-ready.
- Baseline: `npm test` **657/657**; `node scripts/check-comments.mjs` **12 violations, all pre-existing**;
  boot / world / tutorial / dev-dashboard / launcher smokes PASS; dev-smoke PASS except the known `dev-anchor-nudger`
  "variantFile resolves the override-manifest key" failure (also fails on clean `c0ba036`: `variantFile`
  returns `townhall_L3.png`, the test expects `townhall_S<n>.png`).

## Basie dev launcher — COMPLETE (2026-10-01, latest)

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

## Hero Phase 2d — COMPLETE (2026-10-01, latest)

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

1. **Commit** the docs cleanup (Steve), then play a few battles to feel the new loss curve.
2. **Combat-model rework** (roadmap backlog, Steve's direction): per-hit attack vs defense (25 atk can't
   one-shot 100 def), tier matchups, tier-weighted losses, hero strikes. Start with a brainstorming session;
   first open question is giving monsters a tier.
3. **Skill-magnitude pass** after the combat rework (retuning before it would be wasted).
4. Gather/march yield hero effect stays barred until the march balance pass.
