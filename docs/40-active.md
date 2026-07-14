# Active — Session Handoff

> Most-updated file in the repo. Every session that changes code updates this file
> (what landed, known issues, exact next steps). See the session protocol in `CLAUDE.md`.

## Current state (2026-07-15)

- Branch: `Working_Branch`. **Uncommitted:** the Phase 2 fast-follows implementation
  (scout marches, ruins, outposts/shrines/watchtowers, world bosses, fog-of-war —
  `js/systems/world/worldBoss.js` is new) plus this wiki setup. Needs a commit.
- Phase 1 (UI redesign) and Phase 2 (world map MVP + fast-follows) are **done** —
  see `docs/30-roadmap.md`.
- Current direction: **grit reskin** (`docs/10-design/grit-reskin.md`) — art/feel pass
  before Phase 4 AI. Recommended first phase: A1 grim grading (zero asset risk).

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

1. ~~Commit~~ — done by Steve (2026-07-15). Note: **Steve always commits himself**;
   sessions leave the tree commit-ready and say so, never commit.
2. **Fix the two serious audit bugs** while the world/march code is fresh: the
   removed-POI march crash and the never-wired economic buffs (roadmap → Hardening →
   findings).
3. **Split `CityRenderer.js`** (`cityInput`/`cityAgents`/`cityAmbient`), then start
   grit Phase A1 (grim grade + function plaques).
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
