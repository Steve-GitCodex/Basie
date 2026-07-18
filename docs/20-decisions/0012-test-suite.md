# ADR 0012 — Persistent test suite: node:test unit tier + repo-committed Playwright smoke

Date: 2026-07-16 · Status: accepted

## Context

Basie had no tests, no `package.json`, and no CI. Verification was re-derived from
scratch every session: throwaway Playwright probes written into a per-session
scratchpad, plus manual browser checks. Nothing accumulated — the B1 determinism and
save-reconcile probes, the buff-wiring check, the march null-POI crash repro were all
written, run once, and thrown away. A bug fixed in one session had no guard against
returning in the next.

Two constraints shaped the options:

- **No build step, no framework, no deps in the repo** is a standing project rule.
  A test framework (Jest/Vitest) plus a `node_modules` tree is exactly the thing the
  project has avoided.
- Node treats `.js` as CommonJS without a `package.json`, so the game's ES modules
  could not be imported in Node at all. The B1 session worked around this by copying
  data modules into a scratchpad with `{"type":"module"}` — which violates the
  "never copy logic into a test" rule the moment it's used for anything but a probe.

Exploration confirmed the codebase splits cleanly: `js/systems/march/`,
`js/systems/world/`, `js/entities/data/`, `js/systems/building/buildingRules.js` and
`js/core/EventBus.js` have no DOM in their import chains; `js/ui/**`, `GameEngine`
(rAF), `SaveManager`/`SettingsManager` (localStorage), `LogManager`, `SoundManager`
and `main.js` are browser-bound.

## Decision

A two-tier suite, additive by contract, local-only (no CI for now).

**Tier 1 — Node unit tests.** Node's built-in runner (`node --test`), zero
dependencies. A minimal root `package.json` (`private`, `type: module`, a `test` and
`lint:comments` script) exists for one reason: `"type": "module"` lets the real game
modules import in Node. Browsers ignore `package.json`, so the game is unaffected —
verified by a live boot after it landed. Tests live in `tests/unit/`, **one file per
source module**, and import game modules directly.

**Tier 2 — browser smoke, committed, deps external.** `tests/browser/` holds real
scripts (`boot-smoke.mjs`, `world-smoke.mjs`) over a shared `harness.mjs`. Playwright
is resolved via `createRequire` from `BASIE_PW_ROOT` (default the existing external
install at `C:\Users\Steve\AppData\Local\Temp\claude\basie-verify\`), so the heavy
dependency never enters the repo. The harness codifies the knowledge previously
re-derived every session: the http-server invocation (python here is the MS Store
stub — `run.bat` can't be driven from a script), `pageerror` capture, the guest →
sandbox boot flow, and the overlay dismissers that otherwise eat clicks. Both scripts
exit non-zero on failure.

**The additive rule is the point** and is written into `tests/README.md`: append
never rewrite; every bug fix lands with a regression test; tests import game modules,
never copy them; browser scripts build on the harness, never fork it.

## Consequences

- A fixed bug now stays fixed: the march null-POI crash (ADR-era fix, 2026-07-15) and
  the economic-buff stacking wiring both have regression tests. B1's determinism and
  save-reconcile probes are now permanent instead of scratchpad throwaways.
- Seed coverage is 128 tests across 9 files: data invariants (blueprint zone capacity
  — the documented `_ensurePlacements` gotcha — requirement refs, resource keys, POI
  uniqueness/bounds), `worldState` seed/reconcile round-trips (the ADR 0002 gotcha),
  march resolver outcomes, march math/rules, region buff stacking, grid determinism,
  building rules, and EventBus semantics.
- **No game source changed.** Every module in scope was importable as-is; no
  testability seam was needed.
- `node --test tests/unit/` (the directory form) fails on Node 26 — it tries to load
  the directory as a module. The `test` script uses the glob form
  `node --test "tests/unit/**/*.test.js"` instead.
- The Playwright install is in a **temp directory**. When it's cleaned, tier 2 fails
  with a clear message pointing at `npm install playwright` / `BASIE_PW_ROOT`; tier 1
  is unaffected.
- `world-smoke.mjs` reaches the world view by emitting `ui:navigateTo`, which bypasses
  the Rally Point unlock gate that the flip button enforces. That keeps the smoke
  cheap (no HQ Lv3 build-up) but means it does **not** cover the unlock path itself.
- CI is deliberately out of scope. If it lands later, tier 1 runs anywhere Node does;
  tier 2 needs a Playwright install and would have to stop depending on a temp path.

## Alternatives rejected

- **Jest/Vitest** — a framework plus a repo `node_modules` tree, against the
  no-deps/no-build rule, to gain little over `node --test` for pure functions.
- **Keeping probes in scratchpads** — the status quo; nothing accumulates.
- **Vendoring Playwright into the repo** — heavy dependency, browser binaries, for a
  tier that runs manually on one machine.
- **Testing UI modules under jsdom** — a second environment to maintain and a poor
  proxy for canvas rendering, which is what the UI actually does. Tier 2 drives the
  real browser instead.
