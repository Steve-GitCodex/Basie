# Active — Session Handoff

> Most-updated file in the repo. Every session that changes code updates this file
> (what landed, known issues, exact next steps). See the session protocol in `CLAUDE.md`.

## Current state (2026-07-15)

- Branch: `Working_Branch`. **Uncommitted:** the two world/march audit-bug fixes
  (below) — tree is commit-ready.
- Phase 1 (UI redesign) and Phase 2 (world map MVP + fast-follows) are **done** —
  see `docs/30-roadmap.md`.
- Current direction: **grit reskin** (`docs/10-design/grit-reskin.md`) — art/feel pass
  before Phase 4 AI. Recommended first phase: A1 grim grading (zero asset risk).

### Landed this session (2026-07-15) — two audit bugs fixed

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

## Known issues / debt

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

## Next steps (session ended 2026-07-15 — resume here)

1. ~~Fix the two serious audit bugs~~ — **done this session** (see above). Tree is
   commit-ready; **Steve commits himself**, sessions never commit.
2. **Split `CityRenderer.js`** (`cityInput`/`cityAgents`/`cityAmbient`), then start
   grit Phase A1 (grim grade + function plaques).
3. Remaining world/march audit findings (lower severity, roadmap → Hardening): gather
   economic-bonus no-op clamp, `resolveMarchBattle` `milMult < 1` debuff trap, and a
   buff-dependent *UI* listener for `world:buffsChanged`.
4. Queue the comment-cleanup session (low-cost model; `node scripts/check-comments.mjs`
   lists 17 violations).

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
