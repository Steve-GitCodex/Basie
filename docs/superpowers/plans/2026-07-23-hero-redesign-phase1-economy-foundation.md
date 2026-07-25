# Hero Redesign — Phase 1: Economy & Data Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full new hero economy — currencies, roster, XP curve, 10-star awakening,
bounded aura, heroes-only token rolls with two-stage pity, dupe→shard, fragments/shard
unlock, tier-shard exchange, and wired dev production — **headless (no UI)**, every rule
unit-tested.

**Architecture:** Lands in the `js/systems/hero/` modules created in Phase 0
(`heroRecruitment.js`, `heroProgression.js`, `heroCombat.js`, `heroEconomy.js`) and the data
files `js/entities/data/heroes.js` + `economy.js`. `HeroManager` gains new save state (pity
counters) — every new field needs serialize + deserialize + reconcile (ADR 0002).

**Tech Stack:** Vanilla ES6 modules, no build. `node:test` unit tier + Playwright smoke.
EventBus singleton.

## Global Constants

**All numeric values come verbatim from the locked balance reference:**
`docs/superpowers/specs/2026-07-23-hero-economy-numbers.md` (game-designer pass 2026-07-23).
Do not invent numbers — cite that file. Key constants used below:

- `HERO_LEVEL_CAP = HeroQuarters_level × 10`; `xpToNext(L) = round((100 + 20·(L−1))·tierMult)`,
  `tierMult = {normal:1.0, epic:1.25, legendary:1.5}`.
- Tiers renamed **normal / epic / legendary** (was common / rare / legendary).
- Tiers fixed 2/2/2: **Legendary** `warlord`(Marcus)+`archsorceress`(Vera); **Epic**
  `paladin`(Aldric)+`junovane`; **Normal** `shadowblade`(Kira)+`kaelenthorne`.
- `MAX_STARS = 10`, awakening **shard-only** (`'card'` method removed); star costs per tier
  table §C; `MAJOR_SKILL_UNLOCK_STAR = 5`.
- Aura §B (bounded): `base·(1 + 0.005·(L−1) + 0.04·stars + skillAuraFrac)`; Vera base
  0.20 with the `×0.8` hack removed.
- `NEW_HERO_RATE {normal:.10, epic:.12, legendary:.14}`, `SOFT_PITY_FROM=7`,
  `STAGE1_HARD_PITY_N=10`, consolation split §G.
- `FRAGMENTS_PER_SHARD {normal:8,epic:10,legendary:12}`,
  `SHARDS_TO_UNLOCK {normal:4,epic:6,legendary:8}`.
- `TIER_SHARDS_PER_HERO_SHARD = 3`, `MAXED_OVERFLOW_TO_TIER = 2`.
- `PROD_BONUS_BASE {resourceOutput:.15, trainingSpeed:.12, researchSpeed:.12, buildSpeed:.12}`,
  `prodLevelScale ×(1+0.01·(L−1))`, `prodStarBonus +0.02·base/star`.
- `XP_CARD {normal:500, epic:2500, legendary:12000}`.

**Conventions:** ids are save keys (ADR 0002) — never rename hero ids; managers talk via
EventBus (ADR 0001); near-zero comments (`node scripts/check-comments.mjs` stays clean);
tests append to `tests/unit/*` (ADR 0012), never rewrite; browser smokes run ~3s apart
(port-8123 race). New item ids follow existing conventions in `economy.js`
(`scroll_common`, `card_rare`, `fragment_warlord`, `xp_bundle_small`).

---

## File Structure

**Modify (data):**
- `js/entities/data/heroes.js` — retier + rename + backstory + 2 new heroes; rewrite
  `AWAKENING_CONFIG` (10 stars, shard-only); replace `GACHA_CONFIG` with `PITY_CONFIG` +
  consolation + rate blocks; add `XP_CONFIG`, `EXCHANGE_CONFIG`, `PROD_BONUS_CONFIG`; aura
  base tweak (Vera 0.20).
- `js/entities/data/economy.js` — add currency items: `token_{normal,epic,legendary}`,
  `tier_shard_{normal,epic,legendary}`, `shard_{heroId}` (per hero), `fragment_{heroId}` for
  the 2 new heroes, `xpcard_{normal,epic,legendary}`. Retire/keep-inert old scroll/card items.

**Modify (logic):**
- `js/systems/hero/heroRecruitment.js` — `rollToken`, dupe→frag/shard, pity, unlock,
  exchange, maxed overflow, shard-only `awakenHero`.
- `js/systems/hero/heroProgression.js` — new XP curve + HQ-gated level cap; XP-card apply.
- `js/systems/hero/heroCombat.js` — bounded aura formula.
- `js/systems/hero/heroEconomy.js` — wired per-resource production bonuses.
- `js/systems/HeroManager.js` — pity-counter state + serialize/deserialize/reconcile;
  `getRosterWithState` surfaces the new currency/tier fields.

**Modify (tests):** append to `tests/unit/heroManager.test.js`,
`tests/unit/heroesData.test.js` (create if absent), `tests/unit/heroProgression.test.js`,
`tests/unit/heroRecruitment.test.js`, `tests/unit/heroCombat.test.js`,
`tests/unit/heroEconomy.test.js`.

---

## Task 1: Retier + re-fiction roster, add 2 heroes, backstory field

**Files:**
- Modify: `js/entities/data/heroes.js` (`HEROES_CONFIG`, `HERO_CLASSIFICATIONS` tier refs)
- Modify: any code referencing tier strings `common/rare/legendary` (grep first)
- Test: `tests/unit/heroesData.test.js` (create)

**Interfaces:**
- Produces: `HEROES_CONFIG` with 6 heroes, `tier ∈ {normal,epic,legendary}`, `backstory`
  string, ids `warlord/archsorceress/shadowblade/paladin/junovane/kaelenthorne`.

- [ ] **Step 1: Grep every tier-string reference**

Run: `grep -rnE "'common'|'rare'|'legendary'|common:|rare:|legendary:" js/ tests/`
Record every hit — TIER_META, GACHA tables, CSS class strings, test fixtures. These migrate
to `normal/epic/legendary` (legendary keeps its name). Note: CSS class names like
`hero-card--legendary` stay; only the *tier key* values change.

- [ ] **Step 2: Write the failing data test**

Create `tests/unit/heroesData.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEROES_CONFIG } from '../../js/entities/data/heroes.js';

test('roster has 6 heroes at 2/2/2 tiers with backstory', () => {
  const ids = Object.keys(HEROES_CONFIG);
  assert.equal(ids.length, 6);
  const byTier = t => ids.filter(id => HEROES_CONFIG[id].tier === t);
  assert.deepEqual(byTier('legendary').sort(), ['archsorceress', 'warlord']);
  assert.deepEqual(byTier('epic').sort(),      ['junovane', 'paladin']);
  assert.deepEqual(byTier('normal').sort(),    ['kaelenthorne', 'shadowblade']);
  for (const id of ids) assert.ok(HEROES_CONFIG[id].backstory?.length > 0, `${id} backstory`);
});

test('re-fiction display names applied, ids unchanged (save keys)', () => {
  assert.equal(HEROES_CONFIG.warlord.name,      'Marcus Kestrel');
  assert.equal(HEROES_CONFIG.archsorceress.name,'Vera Sable');
  assert.equal(HEROES_CONFIG.shadowblade.name,  'Kira Nightwhisper');
  assert.equal(HEROES_CONFIG.paladin.name,      'Aldric Cross');
});
```

- [ ] **Step 3: Run, expect FAIL** — Run: `node --test tests/unit/heroesData.test.js` — Expected: FAIL (6 ≠ 4, names).

- [ ] **Step 4: Edit `HEROES_CONFIG`**

Retier the 4 existing (common→normal etc. per §Global), set names/titles to the re-fiction,
add a `backstory` field to each (placeholder lore now, final copy in Phase 5 — but non-empty
sentences, not "TODO"). Add `junovane` (Epic, tech) + `kaelenthorne` (Normal) full entries
mirroring the existing shape (`stats`, `skills`, `aura`, `xpPerLevel`, `buildingBonus`,
`classification`). Migrate any tier-key references found in Step 1 across `js/`.

- [ ] **Step 5: Run full suite, expect PASS** — Run: `npm test` — Expected: PASS (fix any test fixture that hard-coded old tiers).

- [ ] **Step 6: Comment-lint + commit**
```bash
node scripts/check-comments.mjs
git add js/entities/data/heroes.js tests/unit/heroesData.test.js js/
git commit -m "feat(hero): retier roster to normal/epic/legendary, add Juno Vane + Kaelen Thorne + backstory"
```

---

## Task 2: New currency items + config blocks

**Files:**
- Modify: `js/entities/data/economy.js` (INVENTORY_ITEMS), `js/entities/data/heroes.js`
  (config blocks)
- Test: `tests/unit/heroesData.test.js` (append)

**Interfaces:**
- Produces: items `token_{tier}`, `tier_shard_{tier}`, `shard_{heroId}`, `xpcard_{tier}`,
  `fragment_{junovane,kaelenthorne}`; config `XP_CONFIG`, `PITY_CONFIG`, `EXCHANGE_CONFIG`,
  `PROD_BONUS_CONFIG`; rewritten `AWAKENING_CONFIG`.

- [ ] **Step 1: Write failing resolution tests**
```javascript
import { INVENTORY_ITEMS } from '../../js/entities/data/economy.js';
import { HEROES_CONFIG, XP_CONFIG, PITY_CONFIG, EXCHANGE_CONFIG, AWAKENING_CONFIG } from '../../js/entities/data/heroes.js';

test('every hero has a fragment + shard item; every tier has token/tier-shard/xpcard', () => {
  for (const id of Object.keys(HEROES_CONFIG)) {
    assert.ok(INVENTORY_ITEMS[`fragment_${id}`], `fragment_${id}`);
    assert.ok(INVENTORY_ITEMS[`shard_${id}`],    `shard_${id}`);
  }
  for (const t of ['normal','epic','legendary']) {
    assert.ok(INVENTORY_ITEMS[`token_${t}`],      `token_${t}`);
    assert.ok(INVENTORY_ITEMS[`tier_shard_${t}`], `tier_shard_${t}`);
    assert.ok(INVENTORY_ITEMS[`xpcard_${t}`],     `xpcard_${t}`);
  }
});

test('config blocks match locked numbers', () => {
  assert.equal(AWAKENING_CONFIG.maxStars, 10);
  assert.equal(XP_CONFIG.tierMult.legendary, 1.5);
  assert.equal(PITY_CONFIG.stage1HardPityN, 10);
  assert.equal(EXCHANGE_CONFIG.tierShardsPerHeroShard, 3);
});
```

- [ ] **Step 2: Run, expect FAIL** — Run: `node --test tests/unit/heroesData.test.js` — Expected: FAIL (undefined items/config).

- [ ] **Step 3: Add items + config**

In `economy.js`, add the currency items following the existing item shape (`id, type, name,
icon, description, rarity`). Types: `recruit_token`, `tier_shard`, `hero_shard`,
`xp_card`, `hero_fragment` (existing). `xpcard_{tier}` carries `xpValue` from
`XP_CARD` (§E). In `heroes.js` add `XP_CONFIG`, `PITY_CONFIG`, `EXCHANGE_CONFIG`,
`PROD_BONUS_CONFIG`, and rewrite `AWAKENING_CONFIG` (10-star cost table §C,
`perStarStatBonus 0.06`, `perStarAuraBonus 0.04`) — all values from the numbers doc.

- [ ] **Step 4: Run suite, expect PASS** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Comment-lint + commit**
```bash
node scripts/check-comments.mjs
git add js/entities/data/economy.js js/entities/data/heroes.js tests/unit/heroesData.test.js
git commit -m "feat(hero): add token/shard/fragment/xp-card items + XP/PITY/EXCHANGE/PROD config blocks"
```

---

## Task 3: XP curve + Hero-Quarters-gated level cap

**Files:**
- Modify: `js/systems/hero/heroProgression.js` (`_applyXP`, new `xpToNext`, cap enforcement)
- Test: `tests/unit/heroProgression.test.js` (create)

**Interfaces:**
- Consumes: `HEROES_CONFIG[id].tier`, `XP_CONFIG`, `this._h._bm.getLevelOf('heroquarters')`.
- Produces: `_applyXP` uses `xpToNext(L, tier)`; level clamps at `heroquarters_level × 10`.

- [ ] **Step 1: Failing tests**
```javascript
test('xpToNext follows the linear-step curve with tier multiplier', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('warlord');                       // legendary, tierMult 1.5
  const h0 = m.getRosterWithState().find(x => x.id === 'warlord');
  assert.equal(h0.xpToNext, Math.round((100 + 20*0) * 1.5)); // 150
});

test('level is capped at heroquarters level × 10', () => {
  const m = makeManager({ heroquartersLevel: 1 });  // cap = 10
  m._recruitHero('shadowblade');
  m.awardHeroXP('shadowblade', 10_000_000);
  assert.equal(m.getRosterWithState().find(x => x.id === 'shadowblade').level, 10);
});
```
(Ensure the test harness lets you stub `heroquarters` level via `_bm.getLevelOf`.)

- [ ] **Step 2: Run, expect FAIL** — Run: `node --test tests/unit/heroProgression.test.js` — Expected: FAIL (old 1.3^L curve, no cap).

- [ ] **Step 3: Implement**

Add `xpToNext(level, tier)` per §A. In `_applyXP`, compute the cap
`const cap = (this._h._bm?.getLevelOf('heroquarters') ?? 1) * 10;` and stop leveling at
`cap` (bank overflow XP or discard — discard is fine; document via test). Replace the
`Math.pow(1.3, …)` line. Recompute `xpToNext` from tier on each level.

- [ ] **Step 4: Run suite, expect PASS** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Comment-lint + commit**
```bash
node scripts/check-comments.mjs
git add js/systems/hero/heroProgression.js tests/unit/heroProgression.test.js
git commit -m "feat(hero): linear-step XP curve + Hero-Quarters-gated level cap"
```

---

## Task 4: 10-star shard-only awakening

**Files:**
- Modify: `js/systems/hero/heroRecruitment.js` (`awakenHero`), `heroProgression.js`
  (`applySkillPassives` star math)
- Test: `tests/unit/heroRecruitment.test.js` (create)

**Interfaces:**
- Consumes: `AWAKENING_CONFIG` (10-star cost table, `perStarStatBonus`), `shard_{id}` items.
- Produces: `awakenHero(heroId)` — **shard-only**, no `method` arg; consumes `shard_{id}` per
  §C; stars 0→10.

- [ ] **Step 1: Failing tests**
```javascript
test('awakenHero is shard-only and consumes the per-star Hero-Shard cost', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');                    // normal: star1 cost = 1 shard
  m._inv.addItem('shard_shadowblade', 1);
  const r = m.awakenHero('shadowblade');
  assert.equal(r.success, true);
  assert.equal(r.stars, 1);
  assert.equal(m._inv.getQuantity('shard_shadowblade'), 0);
});

test('awakenHero rejects at max 10 stars', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');
  m._inv.addItem('shard_shadowblade', 999);
  for (let i = 0; i < 10; i++) m.awakenHero('shadowblade');
  const r = m.awakenHero('shadowblade');
  assert.equal(r.success, false);
  assert.equal(m.getRosterWithState().find(x => x.id === 'shadowblade').stars, 10);
});
```

- [ ] **Step 2: Run, expect FAIL** — Run: `node --test tests/unit/heroRecruitment.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement**

Rewrite `awakenHero(heroId)` — drop the `method` param and the `'card'` branch entirely;
read cost from `AWAKENING_CONFIG.starCosts[hero.stars][tier]` as Hero Shards (`shard_{id}`);
guard `stars >= 10`. Update `applySkillPassives` star math to `perStarStatBonus 0.06`
additive. Emit `hero:awakened` unchanged.

- [ ] **Step 4: Run suite, expect PASS** — Run: `npm test` — Expected: PASS (update any existing awaken test that passed `'fragment'`/`'card'`).

- [ ] **Step 5: Comment-lint + commit**
```bash
node scripts/check-comments.mjs
git add js/systems/hero/heroRecruitment.js js/systems/hero/heroProgression.js tests/unit/heroRecruitment.test.js
git commit -m "feat(hero): 10-star shard-only awakening"
```

---

## Task 5: Bounded aura re-model

**Files:**
- Modify: `js/systems/hero/heroCombat.js` (`getCombatBonuses`, `getCategorizedBonuses`)
- Modify: `js/entities/data/heroes.js` (Vera base 0.20)
- Test: `tests/unit/heroCombat.test.js` (create)

**Interfaces:**
- Produces: `auraValue = base·(1 + 0.005·(L−1) + 0.04·stars + skillAuraFrac)`; `magic_amplify`
  no longer multiplied by 0.8 (folded into base).

- [ ] **Step 1: Failing test (pins the bounded endgame value)**
```javascript
test('aura is bounded and fully relative to base at endgame', () => {
  const m = makeManager({ heroquartersLevel: 10 });
  m._recruitHero('archsorceress');                  // Vera, base 0.20
  const h = m._owned.get('archsorceress');
  h.level = 100; h.stars = 10;
  m.assignHeroToBuilding('archsorceress', 'heroquarters_0');
  // 0.20·(1 + 0.005·99 + 0.04·10) = 0.20·1.895 = 0.379 (no arcane_nova level here)
  const b = m.getCombatBonuses();
  assert.ok(Math.abs((b.attackMult - 1) - 0.379) < 0.01, `got ${b.attackMult}`);
});
```

- [ ] **Step 2: Run, expect FAIL** — Run: `node --test tests/unit/heroCombat.test.js` — Expected: FAIL (old unbounded formula + ×0.8).

- [ ] **Step 3: Implement**

Set `archsorceress.aura.value = 0.20`. In `heroCombat.js` replace the aura computation with
§B; remove the `case 'magic_amplify': attackMult += auraValue * 0.8` special-case (now
`+= auraValue` like the others). Apply the same formula in `getCategorizedBonuses`.

- [ ] **Step 4: Run suite, expect PASS** — Run: `npm test` — Expected: PASS (update any existing combat test asserting old magnitudes).

- [ ] **Step 5: Comment-lint + commit**
```bash
node scripts/check-comments.mjs
git add js/systems/hero/heroCombat.js js/entities/data/heroes.js tests/unit/heroCombat.test.js
git commit -m "feat(hero): bounded, base-relative aura formula"
```

---

## Task 6: Heroes-only token rolls + dupe→fragments/shard

**Files:**
- Modify: `js/systems/hero/heroRecruitment.js` (replace `rollScroll` → `rollToken`)
- Test: `tests/unit/heroRecruitment.test.js` (append)

**Interfaces:**
- Consumes: `token_{tier}`, `NEW_HERO_RATE`, consolation split §G, `HEROES_CONFIG`.
- Produces: `rollToken(tier)` → `{ outcome: 'hero'|'fragment'|'shard'|'xp', heroId?, itemId?,
  isDuplicate? }`; never returns a base-resource outcome. Dupe hero → `fragment`/`shard` of
  that hero.

- [ ] **Step 1: Failing tests (seed RNG for determinism)**
```javascript
test('a token roll never yields a base-resource outcome', () => {
  const m = makeManager();
  m._inv.addItem('token_legendary', 200);
  const outcomes = new Set();
  for (let i = 0; i < 200; i++) outcomes.add(m.rollToken('legendary').outcome);
  for (const o of outcomes) assert.ok(['hero','fragment','shard','xp'].includes(o), o);
});

test('rolling a hero already owned converts to that hero fragments or shard', () => {
  const m = makeManager();
  m._recruitHero('warlord');
  // force a hero-outcome roll landing on warlord (inject rng or a test seam)
  const r = m._resolveTokenHero('legendary', 'warlord');
  assert.equal(r.isDuplicate, true);
  assert.ok(['fragment','shard'].includes(r.outcome));
});
```
(Add a small injectable RNG or an internal `_resolveTokenHero(tier, forcedId)` seam so the
test is deterministic — do not rely on `Math.random`.)

- [ ] **Step 2: Run, expect FAIL** — Run: `node --test tests/unit/heroRecruitment.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement**

Add `rollToken(tier)` consuming `token_{tier}`: roll `NEW_HERO_RATE[tier]` (un-owned-biased —
only un-owned heroes eligible for the "new hero" branch); on a new hero call
`_recruitHero`; otherwise resolve the consolation split §G into `fragment`/`shard`/`xp`. A
"hero" roll that lands on an owned hero converts to that hero's fragments/shard (dupe rule).
Delete `rollScroll` and the `_weightedRandom` resource/buff paths. Keep `heroes:updated`
emit.

- [ ] **Step 4: Run suite, expect PASS** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Comment-lint + commit**
```bash
node scripts/check-comments.mjs
git add js/systems/hero/heroRecruitment.js tests/unit/heroRecruitment.test.js
git commit -m "feat(hero): heroes-only token rolls with dupe→fragments/shard"
```

---

## Task 7: Two-stage pity (with persistence)

**Files:**
- Modify: `js/systems/hero/heroRecruitment.js` (pity in `rollToken`), `js/systems/HeroManager.js`
  (pity state + serialize/deserialize)
- Test: `tests/unit/heroRecruitment.test.js` (append), `tests/unit/heroManager.test.js` (append)

**Interfaces:**
- Consumes: `PITY_CONFIG` (`softPityFrom 7`, `stage1HardPityN 10`, `stage2ShardFloor 1`).
- Produces: `this._h._pity = { normal, epic, legendary }` counters; `rollToken` guarantees an
  un-owned hero within N (stage 1); once roster complete, every N pulls yields a shard floor
  (stage 2). Pity counters serialized.

- [ ] **Step 1: Failing tests**
```javascript
test('stage-1 pity guarantees an un-owned hero by pull 10', () => {
  const m = makeManager();
  m._inv.addItem('token_normal', 10);
  let got = null;
  for (let i = 0; i < 10; i++) { const r = m.rollToken('normal'); if (r.outcome === 'hero' && !r.isDuplicate) got = r.heroId; }
  assert.ok(got, 'a new hero within 10 pulls');
});

test('pity counters survive serialize/deserialize', () => {
  const m = makeManager();
  m._inv.addItem('token_normal', 5);
  for (let i = 0; i < 5; i++) m.rollToken('normal');
  const data = m.serialize();
  const m2 = makeManager();
  m2.deserialize(data);
  assert.equal(m2._pity.normal, m._pity.normal);
});
```

- [ ] **Step 2: Run, expect FAIL** — Run: `node --test tests/unit/heroRecruitment.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement**

Init `this._pity = { normal:0, epic:0, legendary:0 }` in `HeroManager`. In `rollToken`:
increment the tier counter each pull; from `softPityFrom` add the soft bonus to new-hero
rate; at `stage1HardPityN` force an un-owned hero (reset counter on any new-hero grant). When
`rosterComplete()` (all heroes owned), switch to stage 2: every N pulls guarantee
`stage2ShardFloor` Hero Shards for a not-yet-maxed hero of the tier. Add `_pity` to
`serialize()` output and restore + reconcile (default to 0s) in `deserialize`.

- [ ] **Step 4: Run suite, expect PASS** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Comment-lint + commit**
```bash
node scripts/check-comments.mjs
git add js/systems/hero/heroRecruitment.js js/systems/HeroManager.js tests/unit/heroRecruitment.test.js tests/unit/heroManager.test.js
git commit -m "feat(hero): two-stage pity with persisted counters"
```

---

## Task 8: Fragments→shard unlock, tier-shard exchange, maxed overflow

**Files:**
- Modify: `js/systems/hero/heroRecruitment.js` (`unlockFromShards`, `exchangeTierShards`,
  `_overflowToTierShards`)
- Test: `tests/unit/heroRecruitment.test.js` (append)

**Interfaces:**
- Consumes: `FRAGMENTS_PER_SHARD`, `SHARDS_TO_UNLOCK`, `EXCHANGE_CONFIG`.
- Produces: `convertFragments(heroId)` (8/10/12 frags → 1 shard); `unlockFromShards(heroId)`
  (4/6/8 shards → owned); `exchangeTierShards(tier, heroId, count)` (3 tier → 1 hero shard);
  awarding a maxed hero's shard routes to `_overflowToTierShards` (1 shard → 2 tier shards).

- [ ] **Step 1: Failing tests**
```javascript
test('N fragments convert to one hero shard by tier', () => {
  const m = makeManager();
  m._inv.addItem('fragment_shadowblade', 8);        // normal: 8 per shard
  const r = m.convertFragments('shadowblade');
  assert.equal(r.success, true);
  assert.equal(m._inv.getQuantity('shard_shadowblade'), 1);
  assert.equal(m._inv.getQuantity('fragment_shadowblade'), 0);
});

test('unlock consumes SHARDS_TO_UNLOCK and adds the hero to the roster', () => {
  const m = makeManager();
  m._inv.addItem('shard_shadowblade', 4);           // normal: 4 to unlock
  const r = m.unlockFromShards('shadowblade');
  assert.equal(r.success, true);
  assert.equal(m.isOwned('shadowblade'), true);
});

test('tier-shard exchange is 3:1 and cannot be laundered net-positive', () => {
  const m = makeManager();
  m._inv.addItem('tier_shard_normal', 3);
  const r = m.exchangeTierShards('normal', 'shadowblade', 1);
  assert.equal(r.success, true);
  assert.equal(m._inv.getQuantity('shard_shadowblade'), 1);
  assert.equal(m._inv.getQuantity('tier_shard_normal'), 0);
  // overflow refund is only 2 → round-trip is lossy
});
```

- [ ] **Step 2: Run, expect FAIL** — Run: `node --test tests/unit/heroRecruitment.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement**

Add the three methods with costs from the constants. In the shard-award path (dupe/pity/
consolation), if the target hero is fully maxed (`stars===10` and all skills maxed), route
the shard to `_overflowToTierShards` (add 2 `tier_shard_{tier}`) instead of a dead
`shard_{id}`. Enforce the exchange direction (buy 3→1 only; refund 2→1 only) so no
net-positive loop.

- [ ] **Step 4: Run suite, expect PASS** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Comment-lint + commit**
```bash
node scripts/check-comments.mjs
git add js/systems/hero/heroRecruitment.js tests/unit/heroRecruitment.test.js
git commit -m "feat(hero): fragment→shard unlock, 3:1 tier-shard exchange, maxed overflow"
```

---

## Task 9: Wired dev-hero production bonuses (all resources)

**Files:**
- Modify: `js/systems/hero/heroEconomy.js` (`getBuildingProductionBonusMap`)
- Modify: `js/entities/data/heroes.js` (`buildingBonus` stat→resource coverage if needed)
- Test: `tests/unit/heroEconomy.test.js` (create)

**Interfaces:**
- Consumes: `PROD_BONUS_CONFIG`, hero `buildingBonus`, `this._h._owned`.
- Produces: `getBuildingProductionBonusMap()` returns per-resource bonuses for every wired
  building type (not just `gold_production`), scaled by level (`×(1+0.01·(L−1))`) + stars
  (`+0.02·base/star`).

- [ ] **Step 1: Failing test**
```javascript
test('a dev hero stationed at their building boosts the matching resource', () => {
  const m = makeManager();
  m._recruitHero('shadowblade');                    // buildingBonus gold_production/mine
  m.assignHeroToBuilding('shadowblade', 'mine_0');
  const map = m.getBuildingProductionBonusMap();
  assert.ok(map.money > 0);                          // was the only wired case
});

test('non-gold production stats are now wired (e.g. food at farm)', () => {
  const m = makeManager();
  // a hero whose buildingBonus targets a farm/food — assert map.food > 0 when stationed
  // (choose the hero whose buildingBonus.buildingType === 'farm' after Task 1 authoring)
  // ...
});
```

- [ ] **Step 2: Run, expect FAIL** — Run: `node --test tests/unit/heroEconomy.test.js` — Expected: FAIL (only gold wired today).

- [ ] **Step 3: Implement**

Rewrite `getBuildingProductionBonusMap` using the §I stat→resource map (gold→money,
food_production→food, wood/stone/iron similarly) and `PROD_BONUS_CONFIG` scaling. Ensure the
6 heroes' `buildingBonus` entries (Task 1) collectively exercise more than one resource so
the dev role is real. Keep the `hero:productionBonusChanged` emit contract.

- [ ] **Step 4: Run suite, expect PASS** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Comment-lint + commit**
```bash
node scripts/check-comments.mjs
git add js/systems/hero/heroEconomy.js js/entities/data/heroes.js tests/unit/heroEconomy.test.js
git commit -m "feat(hero): wire dev-hero production bonuses for all resource types"
```

---

## Task 10: Persistence coverage + full verification

**Files:**
- Modify: `js/systems/HeroManager.js` (`getRosterWithState` new currency/tier fields, if any
  gap), `deserialize` reconcile
- Test: `tests/unit/heroManager.test.js` (append)

- [ ] **Step 1: Failing round-trip test (the ADR 0002 guard)**
```javascript
test('serialize→deserialize preserves owned heroes, stars, and pity', () => {
  const m = makeManager();
  m._recruitHero('warlord');
  m._owned.get('warlord').stars = 4;
  m._inv.addItem('token_normal', 3); for (let i=0;i<3;i++) m.rollToken('normal');
  const data = m.serialize();
  const m2 = makeManager();
  m2.deserialize(data);
  assert.equal(m2._owned.get('warlord').stars, 4);
  assert.deepEqual(m2._pity, m._pity);
});
```

- [ ] **Step 2: Run, expect FAIL if any field is dropped** — Run: `node --test tests/unit/heroManager.test.js` — Expected: FAIL if `_pity` (or a new field) isn't restored.

- [ ] **Step 3: Close any gaps**

Ensure `serialize()` includes every new stateful field and `deserialize` restores +
reconciles them (defaults for legacy saves). New *currencies* are inventory items → already
persisted by InventoryManager; only `_pity` (and any new HeroManager state) needs explicit
coverage.

- [ ] **Step 4: Full unit suite** — Run: `npm test` — Expected: PASS, all green.

- [ ] **Step 5: Browser smokes (separately, ~3s apart)**

Run: `node tests/browser/boot-smoke.mjs`  … wait …  `node tests/browser/dev-smoke.mjs`
Expected: PASS, zero page errors (confirms the data/config rewrites don't break boot; UI is
unchanged this phase, so no visual regression expected).

- [ ] **Step 6: Comment-lint + commit**
```bash
node scripts/check-comments.mjs
git add js/systems/HeroManager.js tests/unit/heroManager.test.js
git commit -m "test(hero): persistence round-trip coverage for economy state"
```

---

## Self-Review

- **Spec coverage:** currencies + config (T1–T2), XP curve + cap (T3), 10-star shard-only
  awakening (T4), bounded aura (T5), heroes-only tokens + dupe→shard (T6), two-stage pity
  (T7), fragments/shard unlock + exchange + overflow (T8), wired dev bonuses (T9),
  persistence (T10). Every §4/§5/§6/§7 economy rule maps to a task. UI (§8) is Phase 3–4;
  passive building-XP is the fast-follow. ✅
- **Numbers:** every value cited from the locked reference; no invented constants. ✅
- **Placeholder scan:** backstory copy is explicitly "non-empty now, final in Phase 5" (not a
  TODO in code); the one `...` in T9 Step 1 is a test-authoring note tied to the hero chosen
  in T1 — resolve when T1's `buildingBonus` authoring is fixed. ✅
- **Type consistency:** `rollToken`, `convertFragments`, `unlockFromShards`,
  `exchangeTierShards`, `awakenHero(heroId)` (no method arg), `_pity` shape are used
  consistently across tasks and match the numbers-doc constant names. ✅
- **ADR 0002:** T7 + T10 explicitly cover the new save field (`_pity`) with round-trip +
  reconcile — the highest-severity class for this codebase. ✅

## Handoff

Phase 2 (progression: 6-skill model, ~36 class-matched skills, levelable skills, extended
star bumps beyond the mechanics landed here) builds on `heroProgression.js` + `SKILLS_CONFIG`
using the §C/§D numbers. Phases 3–4 (Heroes screen + Recruit Hall UI) consume
`getRosterWithState`'s new fields. Plan each JIT.
