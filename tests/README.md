# Tests

A persistent suite that **only ever grows**. Verification used to be redone from
scratch every session (throwaway probe scripts in scratchpads); anything proven here
stays proven. `@see docs/20-decisions/0012-test-suite.md` for the rationale.

Two tiers, no dependencies in this repo:

| Tier | Where | Run |
|---|---|---|
| Node unit tests (pure logic) | `tests/unit/` | `npm test` |
| Browser smoke (real game boot) | `tests/browser/` | `node tests/browser/boot-smoke.mjs` |

## The contract

1. **One test file per source module**, named after it — `marchMath.js` →
   `tests/unit/marchMath.test.js`. New module under test → new file.
2. **Append, don't rewrite.** New behavior adds cases to the matching file. Never
   delete a passing test to make a change go green — if a test is genuinely wrong,
   say so in the session handoff and explain why.
3. **Every bug fix lands with a regression test** in the matching file, asserting the
   fixed behavior. The null-POI cases in `marchResolver.test.js` are the model: the
   crash they cover can never come back silently.
4. **Tests import game modules directly** (`../../js/...`). Never copy logic into a
   test — a copy passes while the game breaks. If a module can't be reached without
   a testability seam in game source, stop and raise it; don't patch source to suit
   a test.
5. **Browser scripts build on `harness.mjs`, never fork it.** Boot flow, overlay
   dismissers and error capture live there once.
6. **Near-zero comments**, same as game source. A test name is the documentation;
   `node scripts/check-comments.mjs` guards `js/`, the convention covers `tests/`.

## Tier 1 — unit tests

Node's built-in runner (`node --test`) — no framework, nothing to install. The root
`package.json` exists only for this: `"type": "module"` lets the game's ES modules
import in Node. Browsers ignore it, so the game is unaffected.

Everything under `js/systems/march/`, `js/systems/world/`, `js/entities/data/`,
`js/systems/building/buildingRules.js` and `js/core/EventBus.js` is DOM-free and
importable today. `js/ui/**`, `GameEngine`, `SaveManager`, `SettingsManager`,
`LogManager`, `SoundManager` and `main.js` are browser-bound — cover those in tier 2.

Current files: `gameData`, `worldState`, `marchResolver`, `marchMath`, `marchRules`,
`regionBuffs`, `gridGen`, `buildingRules`, `eventBus`.

## Tier 2 — browser smoke

Committed scripts, run manually against a live server. Playwright stays **outside**
the repo so no heavy dependency lands here: `harness.mjs` resolves it from
`BASIE_PW_ROOT` (default `C:\Users\Steve\AppData\Local\Temp\claude\basie-verify\`).
That is a temp dir — if it's been cleaned, reinstall with `npm install playwright`
there.

`harness.mjs` starts `npx -y http-server -p 8123 -s` itself (**python on this machine
is the MS Store stub — never call `run.bat` from a script**), captures `pageerror` +
console errors, boots the guest sandbox flow (`#auth-guest` →
`.newgame-mode-btn[data-mode="sandbox"]` → `#btn-newgame-confirm`) and dismisses the
overlays that eat clicks (story dialog, tutorial blocker, `#modal-overlay`,
`#bq-sidebar`).

- `boot-smoke.mjs` — boot → guest → sandbox; asserts the city canvas rendered, the
  managers are wired, and zero page errors.
- `world-smoke.mjs` — flips to the world view (via `ui:navigateTo`, which skips the
  Rally Point unlock gate), asserts regions/POIs resolve and the map painted.

Both exit non-zero on failure, so a session can gate on them.

## Not covered yet

Save/load round-trip through `SaveManager`, the tutorial contract, march dispatch
end-to-end (a fresh guest save has no squads), and combat resolution. Add them here
as they get exercised rather than re-probing from a scratchpad.
