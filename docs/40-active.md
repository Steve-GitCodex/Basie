# Active — Session Handoff

> Most-updated file in the repo. Every session that changes code updates this file
> (what landed, known issues, exact next steps). See the session protocol in `CLAUDE.md`.

## Current state (2026-07-15)

- Branch: `Working_Branch`. **Uncommitted:** the two world/march audit-bug fixes, the
  `CityRenderer.js` split, and grit reskin Phases A1 + A2 (below) — tree is commit-ready.
- Phase 1 (UI redesign) and Phase 2 (world map MVP + fast-follows) are **done** —
  see `docs/30-roadmap.md`.
- Current direction: **grit reskin** (`docs/10-design/grit-reskin.md`) — art/feel pass
  before Phase 4 AI. A1 + A2 landed; next phase: B1 grid data model.

### Landed this session (2026-07-15, later session)

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
2. ~~Split `CityRenderer.js`~~ — **done this session**. New siblings `cityInput.js` /
   `cityAgents.js` / `cityAmbient.js` (collaborator classes, back-ref to renderer).
   CityRenderer 1123 → 818 ln; residual drawing left for ADR 0009's projection swap.
3. ~~Grit reskin Phase A1 + A2~~ — **both done this session** (see above). Next reskin
   phase: **B1 grid data model** (`docs/10-design/grit-reskin.md` § B1 — new
   `worldGrid.js` + `gridGen.js`, no rendering yet; watch the `worldState.js`
   seed/reconcile gotcha for the new POI id set). Steve should eyeball A1+A2 in the
   browser and flag tuning: A1 (plaque position/size, vignette strength, dusk warmth),
   A2 (amber saturation, warm-neutral text contrast, the deferred gacha rarity ladder).
4. Remaining world/march audit findings (lower severity, roadmap → Hardening): gather
   economic-bonus no-op clamp, `resolveMarchBattle` `milMult < 1` debuff trap, and a
   buff-dependent *UI* listener for `world:buffsChanged`.
5. Queue the comment-cleanup session (low-cost model; `node scripts/check-comments.mjs`
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
