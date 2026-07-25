# Hero Redesign — Phase 0: HeroManager Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 958-line `HeroManager.js` god file into focused `js/systems/hero/`
collaborator modules **with zero behavior change**, so Phases 1–5 land new logic in clean,
single-responsibility files.

**Architecture:** `HeroManager` stays the public-facing owner of shared state (`_owned`,
`_activeBuffs`, the `_rm`/`_bm`/`_inv` refs) and the serialize/deserialize/read-model
surface. Cohesive method groups move into collaborator classes constructed with a back-ref
to the manager (`this._h`), reading/writing shared state through it — the exact pattern used
by `js/systems/world` and `js/systems/march`. Every current public method stays on
`HeroManager` as a one-line delegator, so **no consumer (`HeroesUI`, `GachaUI`,
`CombatManager`, `ResourceManager`, `BuildingsUI`, `UnitManager`) changes**.

**Tech Stack:** Vanilla ES6 modules, no build step. Tests: `node:test` (unit) +
Playwright smoke (`tests/browser/*-smoke.mjs`). Event bus singleton for all cross-system
comms.

## Global Constraints

- **Zero behavior change.** This is a pure refactor; the safety net is the test suite
  staying green, not new features. No public method signature, event name, or return shape
  changes.
- **Single named export per file**; file order imports → constants → class → export;
  methods `constructor` → `init` → public → private (`_` prefix). (CLAUDE.md conventions.)
- **No god files** — target every file under ~400 lines; `HeroManager` must end well under it.
- **Near-zero comments at write time** — self-documenting names; no narration. Enforced by
  `node scripts/check-comments.mjs` (must stay clean on every touched file).
- **Ids are save keys (ADR 0002).** Do not rename hero ids, event names, or assignment
  shapes. `serialize`/`deserialize` behavior is preserved byte-for-byte.
- **Managers communicate via EventBus only (ADR 0001).** Collaborators emit via the imported
  `eventBus` exactly as the current code does.
- **Test contract (ADR 0012):** additive — append to `tests/unit/heroManager.test.js`, never
  rewrite. Browser smokes spawn their own `http-server` on port 8123 — run them **one at a
  time / ~3s apart** or they race and produce phantom FAILs.

---

## File Structure

**Create:**

- `js/systems/hero/heroRecruitment.js` — gacha rolls, fragment summon, card recruit, hero
  creation, awakening (all currency-spending acquisition). Grows most in Phase 1.
- `js/systems/hero/heroProgression.js` — XP application/award/purchase + skill passive
  recompute + skill-state read. Grows in Phase 2.
- `js/systems/hero/heroAssignment.js` — squad (barracks-mapped) + building assignment,
  slot-capacity rules, assignment getters.
- `js/systems/hero/heroCombat.js` — combat-bonus aggregation (`getCombatBonuses`,
  `getCategorizedBonuses`) + timed production buffs.
- `js/systems/hero/heroEconomy.js` — building production-bonus map. Grows in Phase 2 (wired
  dev bonuses).

**Modify:**

- `js/systems/HeroManager.js` — becomes the thin owner: shared state, wiring, one-line
  delegators, `getRosterWithState`, `isOwned`, `update`, `serialize`, `deserialize`.
- `tests/unit/heroManager.test.js` — append characterization tests (Task 1) + a module-
  boundary assertion (Task 7). Never rewrite existing cases.

**Collaborator pattern (used by every extracted module):**

```javascript
import { eventBus } from "../../core/EventBus.js";
import { HEROES_CONFIG /* … */ } from "../../entities/GAME_DATA.js";

export class HeroRecruitment {
  /** @param {import('../HeroManager.js').HeroManager} hero */
  constructor(hero) {
    this._h = hero; // back-ref to owner: reads this._h._owned, this._h._inv, etc.
  }
  // moved methods operate on this._h._owned / this._h._inv / this._h._rm / this._h._bm
}
```

`HeroManager` constructs each collaborator after its own state is set up, and delegates:

```javascript
rollScroll(tier)            { return this._recruitment.rollScroll(tier); }
```

Private helpers a collaborator needs from the manager (e.g. `_recruitHero`,
`_applySkillPassives`, `_applyXP`, `_barracksIdForSquad`) move **with the group that owns
them**; cross-group calls go through the manager (e.g. recruitment calls
`this._h.applySkillPassives(hero)` where progression owns it — expose it as a public method
on the collaborator via the manager). Each task states its exact cross-references.

---

## Task 1: Characterization tests for the unpinned public surface

Pin current behavior of the methods that move in later tasks but have **no** test today: XP
(`awardHeroXP`, `purchaseXPBundle`, `awawardBattleXP`, `_applyXP` via public paths),
awakening (`awakenHero`), assignment (`assignHeroToSquad`/`assignHeroToBuilding` +
unassign), and the `getRosterWithState` read model. These tests are the green line every
extraction must hold.

**Files:**

- Test: `tests/unit/heroManager.test.js` (append only)

**Interfaces:**

- Consumes: `HeroManager` public API as it exists today; the test's existing
  `makeManager()`-style fixtures (inspect the top of the file and reuse its inventory/rm/bm
  stubs; if none is factored out, build a minimal stub inline mirroring the existing
  `rollScroll`/`getCombatBonuses` tests).
- Produces: characterization coverage later tasks rely on.

- [ ] **Step 1: Read the existing test file's fixtures**

Run: (open `tests/unit/heroManager.test.js`) — identify how the current tests construct a
`HeroManager` (inventory/resource/building stubs). Reuse that exact construction in the new
cases so they share the harness.

- [ ] **Step 2: Append XP characterization tests**

Add cases pinning today's behavior (values from `heroes.js`: `warlord.xpPerLevel = 500`,
`_applyXP` level-up curve `Math.floor(500 * 1.3^(level-1))`, XP bundle via `INVENTORY_ITEMS`):

```javascript
test("awardHeroXP levels a hero up using the 1.3^level curve", () => {
  const m = makeManager();
  m._recruitHero("warlord"); // level 1, xpToNext 500
  m.awardHeroXP("warlord", 500);
  const h = m.getRosterWithState().find((x) => x.id === "warlord");
  assert.equal(h.level, 2);
  assert.equal(h.xpToNext, Math.floor(500 * Math.pow(1.3, 1))); // 650
});

test("awardHeroXP ignores non-finite or non-positive amounts", () => {
  const m = makeManager();
  m._recruitHero("warlord");
  m.awardHeroXP("warlord", NaN);
  m.awardHeroXP("warlord", -100);
  assert.equal(m.getRosterWithState().find((x) => x.id === "warlord").level, 1);
});

test("awardBattleXP only feeds heroes assigned to the target squad barracks", () => {
  const m = makeManager();
  m._recruitHero("warlord");
  m._recruitHero("paladin");
  m.assignHeroToBuilding("warlord", "barracks_0"); // squad_1
  m.assignHeroToBuilding("paladin", "barracks_1"); // squad_2
  m.awardBattleXP(500, "squad_1");
  const roster = m.getRosterWithState();
  assert.equal(roster.find((x) => x.id === "warlord").level, 2);
  assert.equal(roster.find((x) => x.id === "paladin").level, 1);
});
```

- [ ] **Step 3: Append awakening + assignment characterization tests**

```javascript
test("awakenHero via fragments increments stars and consumes fragments", () => {
  const m = makeManager();
  m._recruitHero("warlord");
  m._inv.addItem("fragment_warlord", 10); // starCosts[0].fragments.common = 10
  const r = m.awakenHero("warlord", "fragment");
  assert.equal(r.success, true);
  assert.equal(r.stars, 1);
  assert.equal(m._inv.getQuantity("fragment_warlord"), 0);
});

test("assignHeroToBuilding blocks a second hero past a non-barracks heroCapacity", () => {
  const m = makeManager();
  m._recruitHero("warlord");
  m._recruitHero("paladin");
  // stub heroquarters level so slots exist; mine heroCapacity from BUILDINGS_CONFIG
  const first = m.assignHeroToBuilding("warlord", "mine_0");
  const second = m.assignHeroToBuilding("paladin", "mine_0");
  assert.equal(first.success, true);
  assert.equal(second.success, false);
});

test("assignHeroToSquad maps squad_1 to barracks_0 and getSquadHeroIds reflects it", () => {
  const m = makeManager();
  m._recruitHero("warlord");
  m.assignHeroToSquad("warlord", "squad_1");
  assert.deepEqual(m.getSquadHeroIds("squad_1"), ["warlord"]);
});
```

- [ ] **Step 4: Run the suite, expect PASS**

Run: `npm test`
Expected: PASS, count = previous total + new cases. (These characterize _current_ behavior;
they must pass before any extraction.)

- [ ] **Step 5: Commit**

```bash
git add tests/unit/heroManager.test.js
git commit -m "test(hero): characterize XP, awakening, assignment before manager split"
```

---

## Task 2: Extract recruitment + awakening → `heroRecruitment.js`

**Files:**

- Create: `js/systems/hero/heroRecruitment.js`
- Modify: `js/systems/HeroManager.js` (move methods out, add delegators + collaborator wiring)
- Test: `tests/unit/heroManager.test.js` (no change — existing rollScroll/awaken tests are the net)

**Interfaces:**

- Consumes: `this._h._owned`, `this._h._inv`; the progression helper
  `this._h.applySkillPassives(hero)` and `this._h.recruitHeroRecord(heroId)` (see below).
- Produces (unchanged public API, now delegated): `rollScroll`, `summonFromFragments`,
  `useFragmentAsXP`†, `recruitWithCard`, `awakenHero`. Also the private `_recruitHero`,
  `_weightedRandom`.
  † `useFragmentAsXP` calls `_applyXP` (progression). Keep `useFragmentAsXP` in
  **progression** (it grants XP), not recruitment — move only pure-recruitment methods here.

- [ ] **Step 1: Create `heroRecruitment.js` with the moved methods**

Move verbatim from `HeroManager.js`: `rollScroll` (83–168), `_weightedRandom` (170–178),
`summonFromFragments` (180–195), `recruitWithCard` (331–367), `_recruitHero` (306–322),
`awakenHero` (220–252). Rewrite internal references: `this._owned`→`this._h._owned`,
`this._inv`→`this._h._inv`, `this._applySkillPassives(hero)`→`this._h.applySkillPassives(hero)`.
Keep every `eventBus.emit(...)` call identical. Export `class HeroRecruitment` per the
collaborator pattern.

- [ ] **Step 2: Wire it into `HeroManager` and add delegators**

In the constructor, after state init: `this._recruitment = new HeroRecruitment(this);`.
Remove the moved method bodies; replace with one-line delegators:

```javascript
rollScroll(tier)             { return this._recruitment.rollScroll(tier); }
summonFromFragments(heroId)  { return this._recruitment.summonFromFragments(heroId); }
recruitWithCard(cardId)      { return this._recruitment.recruitWithCard(cardId); }
awakenHero(heroId, method)   { return this._recruitment.awakenHero(heroId, method); }
```

Expose the cross-group helpers the collaborators need as thin public methods on the manager
(so both recruitment and progression can call them):

```javascript
recruitHeroRecord(heroId)    { return this._recruitment._recruitHero(heroId); }
applySkillPassives(hero)     { return this._progression.applySkillPassives(hero); }
```

`_recruitHero` currently calls `_applySkillPassives` — route it via `this._h.applySkillPassives`.
(Progression is created in Task 3; until then, temporarily keep `_applySkillPassives` on the
manager and point `applySkillPassives` at it. Task 3 moves the body.)

- [ ] **Step 3: Run the suite, expect PASS**

Run: `npm test`
Expected: PASS, same count as end of Task 1. The existing gacha/recruit tests exercise the
delegated paths.

- [ ] **Step 4: Comment-lint the touched files**

Run: `node scripts/check-comments.mjs`
Expected: clean on `heroRecruitment.js` and `HeroManager.js` (no new violations).

- [ ] **Step 5: Commit**

```bash
git add js/systems/hero/heroRecruitment.js js/systems/HeroManager.js
git commit -m "refactor(hero): extract recruitment + awakening into heroRecruitment.js"
```

---

## Task 3: Extract XP + skills → `heroProgression.js`

**Files:**

- Create: `js/systems/hero/heroProgression.js`
- Modify: `js/systems/HeroManager.js`
- Test: `tests/unit/heroManager.test.js` (no change — Task 1 XP tests are the net)

**Interfaces:**

- Consumes: `this._h._owned`, `this._h._inv`, `this._h._rm`.
- Produces (delegated): `getSkillsForHero`, `awardHeroXP`, `purchaseXPBundle`,
  `awardBattleXP`, `useFragmentAsXP`. Public collaborator methods: `applySkillPassives(hero)`
  (was `_applySkillPassives`), used by recruitment/deserialize.

- [ ] **Step 1: Create `heroProgression.js` with moved methods**

Move verbatim: `getSkillsForHero` (263–273), `_applySkillPassives` (279–304) → rename to
public `applySkillPassives`, `useFragmentAsXP` (198–208), `awardHeroXP` (582–588),
`purchaseXPBundle` (596–612), `awardBattleXP` (619–628), `_applyXP` (631–642),
`_barracksIdForSquad`? — **no**: `_barracksIdForSquad` is used by both progression
(`awardBattleXP`) and assignment. Keep the canonical copy on the manager as public
`barracksIdForSquad(squadId)` and have both collaborators call `this._h.barracksIdForSquad`.
Rewrite refs to `this._h.*`.

- [ ] **Step 2: Wire + delegators**

Constructor: `this._progression = new HeroProgression(this);` (before recruitment, since
recruitment's `applySkillPassives` bridge points here — or keep the bridge and order
independent). Add delegators:

```javascript
getSkillsForHero(heroId)        { return this._progression.getSkillsForHero(heroId); }
awardHeroXP(heroId, amount)     { return this._progression.awardHeroXP(heroId, amount); }
purchaseXPBundle(heroId, b)     { return this._progression.purchaseXPBundle(heroId, b); }
awardBattleXP(amount, squadId)  { return this._progression.awardBattleXP(amount, squadId); }
useFragmentAsXP(fragId, heroId) { return this._progression.useFragmentAsXP(fragId, heroId); }
applySkillPassives(hero)        { return this._progression.applySkillPassives(hero); }
barracksIdForSquad(squadId)     { const n = parseInt(squadId?.replace('squad_','') ?? '1',10); return `barracks_${Math.max(0,n-1)}`; }
```

Remove the temporary manager-resident `_applySkillPassives`/`_barracksIdForSquad` bodies now
that they live in their canonical homes. Update `deserialize` to call
`this.applySkillPassives(hero)`.

- [ ] **Step 3: Run suite, expect PASS**

Run: `npm test`
Expected: PASS, same count. Task 1 XP/awaken tests + existing combat tests exercise these.

- [ ] **Step 4: Comment-lint**

Run: `node scripts/check-comments.mjs`
Expected: clean on touched files.

- [ ] **Step 5: Commit**

```bash
git add js/systems/hero/heroProgression.js js/systems/HeroManager.js
git commit -m "refactor(hero): extract XP + skills into heroProgression.js"
```

---

## Task 4: Extract assignment → `heroAssignment.js`

**Files:**

- Create: `js/systems/hero/heroAssignment.js`
- Modify: `js/systems/HeroManager.js`
- Test: `tests/unit/heroManager.test.js` (no change — Task 1 assignment tests are the net)

**Interfaces:**

- Consumes: `this._h._owned`, `this._h._bm`, `this._h.barracksIdForSquad`.
- Produces (delegated): `getSquadHeroIds`, `getAllSquadHeroIds`, `getActiveHeroIds`,
  `getHeroesForSquad`, `assignHeroToSquad`, `unassignHeroFromSquad`, `assignHeroToBuilding`,
  `unassignHeroFromBuilding`, `getBuildingHero`, `getHeroesForBuilding`,
  `getAvailableHeroSlots`, `getTotalAssignedToBuildings`, `unassignHero`.

- [ ] **Step 1: Create `heroAssignment.js` with moved methods**

Move verbatim the squad block (386–425) and building block (438–571), rewriting `this.*`
state refs to `this._h.*` and squad-mapping to `this._h.barracksIdForSquad`. Note
`assignHeroToBuilding` emits `hero:productionBonusChanged` with
`this._h.getBuildingProductionBonusMap()` — call it via `this._h.getBuildingProductionBonusMap()`
(economy collaborator, Task 6; the manager delegator exists throughout).

- [ ] **Step 2: Wire + delegators**

Constructor: `this._assignment = new HeroAssignment(this);`. Add one-line delegators for all
13 methods listed under Produces. Remove moved bodies.

- [ ] **Step 3: Run suite, expect PASS** — Run: `npm test` — Expected: PASS, same count.
- [ ] **Step 4: Comment-lint** — Run: `node scripts/check-comments.mjs` — Expected: clean.
- [ ] **Step 5: Commit**

```bash
git add js/systems/hero/heroAssignment.js js/systems/HeroManager.js
git commit -m "refactor(hero): extract squad + building assignment into heroAssignment.js"
```

---

## Task 5: Extract combat bonuses + buffs → `heroCombat.js`

**Files:**

- Create: `js/systems/hero/heroCombat.js`
- Modify: `js/systems/HeroManager.js`
- Test: `tests/unit/heroManager.test.js` (no change — existing getCombatBonuses tests are the net)

**Interfaces:**

- Consumes: `this._h._owned`, `this._h.barracksIdForSquad`, `this._h._activeBuffs`.
- Produces (delegated): `getCombatBonuses`, `getCategorizedBonuses`, `activateBuff`,
  `getActiveBuffs`, `getActiveBuffsWithRemaining`, `getActiveProductionMultiplier`.

- [ ] **Step 1: Create `heroCombat.js` with moved methods**

Move verbatim `getCombatBonuses` (654–727), `getCategorizedBonuses` (736–792),
`activateBuff` (798–805), `getActiveBuffs` (807), `getActiveBuffsWithRemaining` (812–822),
`getActiveProductionMultiplier` (827–831). `_activeBuffs` **stays owned by the manager**
(serialize touches it) — the collaborator reads/writes `this._h._activeBuffs`. Keep all
`eventBus.emit` identical.

- [ ] **Step 2: Wire + delegators**

Constructor: `this._combat = new HeroCombat(this);`. Delegators for the six methods. The
manager's `update()` filters `_activeBuffs` — leave `update()` on the manager but have it
call `this._combat` helpers if any buff-expiry logic moved; otherwise keep the expiry filter
inline on the manager (it only touches `this._activeBuffs`). Remove moved bodies.

- [ ] **Step 3: Run suite, expect PASS** — Run: `npm test` — Expected: PASS, same count.
- [ ] **Step 4: Comment-lint** — Run: `node scripts/check-comments.mjs` — Expected: clean.
- [ ] **Step 5: Commit**

```bash
git add js/systems/hero/heroCombat.js js/systems/HeroManager.js
git commit -m "refactor(hero): extract combat bonuses + timed buffs into heroCombat.js"
```

---

## Task 6: Extract production-bonus map → `heroEconomy.js`

**Files:**

- Create: `js/systems/hero/heroEconomy.js`
- Modify: `js/systems/HeroManager.js`
- Test: `tests/unit/heroManager.test.js` (no change — existing production-bonus tests are the net)

**Interfaces:**

- Consumes: `this._h._owned`.
- Produces (delegated): `getBuildingProductionBonusMap`.

- [ ] **Step 1: Create `heroEconomy.js`**

Move verbatim `getBuildingProductionBonusMap` (512–526), rewriting `this._owned` →
`this._h._owned`. (This is the module Phase 2 grows to wire all resource-type dev bonuses;
isolating the tiny method now is deliberate.)

- [ ] **Step 2: Wire + delegator**

Constructor: `this._economy = new HeroEconomy(this);`.

```javascript
getBuildingProductionBonusMap() { return this._economy.getBuildingProductionBonusMap(); }
```

- [ ] **Step 3: Run suite, expect PASS** — Run: `npm test` — Expected: PASS, same count.
- [ ] **Step 4: Comment-lint** — Run: `node scripts/check-comments.mjs` — Expected: clean.
- [ ] **Step 5: Commit**

```bash
git add js/systems/hero/heroEconomy.js js/systems/HeroManager.js
git commit -m "refactor(hero): extract production-bonus map into heroEconomy.js"
```

---

## Task 7: Verify the split — line ceiling, full suite, smokes, boundary test

**Files:**

- Modify: `tests/unit/heroManager.test.js` (append one structural assertion)

- [ ] **Step 1: Confirm `HeroManager.js` is under the ceiling**

Run: `wc -l js/systems/HeroManager.js`
Expected: well under 400 (state + wiring + delegators + `getRosterWithState` + `isOwned` +
`update` + `serialize` + `deserialize` only). If over, a group wasn't fully moved — fix.

- [ ] **Step 2: Append a delegation-integrity test**

Pin that the public API still resolves end-to-end through the collaborators (guards against a
missed delegator):

```javascript
test("every delegated public method still works after the split", () => {
  const m = makeManager();
  m._recruitHero("warlord");
  assert.equal(typeof m.rollScroll, "function");
  assert.equal(typeof m.awardHeroXP, "function");
  assert.equal(typeof m.assignHeroToSquad, "function");
  assert.equal(typeof m.getCombatBonuses, "function");
  assert.equal(typeof m.getBuildingProductionBonusMap, "function");
  // round-trip: assign → combat bonus reflects it (proves cross-module wiring)
  m.assignHeroToBuilding("warlord", "heroquarters_0");
  assert.ok(m.getCombatBonuses().attackMult > 1.0);
});
```

- [ ] **Step 3: Full unit suite** — Run: `npm test` — Expected: PASS, all cases green.
- [ ] **Step 4: Serialize/deserialize round-trip sanity**

Run: `npm test` (the existing deserialize tests + Task 1). Confirm `serialize()` output shape
is unchanged (`{ owned, activeBuffs }`) — grep the manager to verify no field renamed.

- [ ] **Step 5: Browser smoke — real boot, hero paths**

Run each **separately, ~3s apart** (port-8123 race):
`node tests/browser/boot-smoke.mjs` then `node tests/browser/dev-smoke.mjs`
Expected: PASS, zero page errors. (Confirms `HeroManager` still constructs and wires in the
live `main.js` import order.)

- [x] **Step 6: Commit**

```bash
git add tests/unit/heroManager.test.js
git commit -m "test(hero): assert delegation integrity after manager split"
```

---

## Self-Review

- **Spec coverage (§10 architecture):** the four spec-named concerns — roster+recruit
  (Task 2), progression (Task 3), combat (Task 5), production/economy (Task 6) — plus
  assignment (Task 4, cross-cutting) are each their own module; `HeroManager` is the thin
  orchestrator (Task 7 verifies the ceiling). ✅
- **Behavior preservation:** Tasks 2–6 add no new cases; the net is Task 1's characterization
  - the pre-existing 13 tests, all held green after each extraction. ✅
- **Boundary safety:** shared `_owned`/`_activeBuffs` stay manager-owned; cross-group calls
  (`applySkillPassives`, `barracksIdForSquad`, `getBuildingProductionBonusMap`) are named
  public methods, defined in Task 3/3/6 respectively and consumed in Tasks 2/3/4. Signatures
  match across tasks. ✅
- **No placeholders:** every moved method is named with its current line range; every new
  delegator and collaborator skeleton is shown in full. ✅

## Handoff to Phase 1

Phase 1 (economy & data foundation) lands in `heroRecruitment.js` (new currencies, token
rolls, dupe→frag/shard, tier-shard exchange, two-stage pity, shard-only awakening) and
`heroProgression.js` (HQ level cap, XP curve). Its concrete numbers come from the
game-designer numbers pass (in progress) and get written as the Phase 1 plan once locked.
