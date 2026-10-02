import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveArrival } from '../../js/systems/march/marchResolver.js';

function fakeWorld(overrides = {}) {
  const calls = [];
  return {
    calls,
    activeBuffs: () => [],
    takeFromNode: (id, cap) => { calls.push(['takeFromNode', id, cap]); return cap; },
    markHostileCleared: (id) => calls.push(['markHostileCleared', id]),
    markBossDefeated: (id) => calls.push(['markBossDefeated', id]),
    captureRegion: (id) => calls.push(['captureRegion', id]),
    markRuinLooted: (id) => calls.push(['markRuinLooted', id]),
    captureOutpost: (id) => calls.push(['captureOutpost', id]),
    getPOIState: () => ({ looted: false }),
    outpostOwner: () => 'neutral',
    isBossOpen: () => true,
    ...overrides,
  };
}

const winner = { resolveMarchBattle: () => ({ victory: true, loot: { money: 50 } }) };
const loser = { resolveMarchBattle: () => ({ victory: false }) };

test('a null POI aborts to lost_target instead of throwing', () => {
  for (const type of ['gather', 'attack', 'scout']) {
    const out = resolveArrival({ type, loadCap: 100 }, null, { worldMapManager: fakeWorld() });
    assert.equal(out.outcome, 'lost_target');
    assert.deepEqual(out.payload, {});
    assert.equal(out.dwellMs, 0);
  }
});

test('an unknown march type resolves to none', () => {
  const out = resolveArrival({ type: 'picnic' }, { id: 'x', type: 'camp' }, { worldMapManager: fakeWorld() });
  assert.equal(out.outcome, 'none');
});

test('gather carries home what the node yielded', () => {
  const wm = fakeWorld();
  const poi = { id: 'rn_a', type: 'resource_node', resource: 'wood', gatherRate: 5 };
  const out = resolveArrival({ type: 'gather', loadCap: 100 }, poi, { worldMapManager: wm });
  assert.equal(out.outcome, 'gathered');
  assert.deepEqual(out.payload, { wood: 100 });
  assert.deepEqual(wm.calls[0], ['takeFromNode', 'rn_a', 100]);
});

test('gather on a depleted node returns empty with no payload', () => {
  const wm = fakeWorld({ takeFromNode: () => 0 });
  const poi = { id: 'rn_a', type: 'resource_node', resource: 'wood', gatherRate: 5 };
  const out = resolveArrival({ type: 'gather', loadCap: 100 }, poi, { worldMapManager: wm });
  assert.equal(out.outcome, 'empty');
  assert.deepEqual(out.payload, {});
});

test('gather never carries more than the squad load cap', () => {
  const wm = fakeWorld({
    takeFromNode: () => 100,
    activeBuffs: () => [{ flavor: 'economic', resource: 'wood', pct: 0.5 }],
  });
  const poi = { id: 'rn_a', type: 'resource_node', resource: 'wood', gatherRate: 5 };
  const out = resolveArrival({ type: 'gather', loadCap: 100 }, poi, { worldMapManager: wm });
  assert.deepEqual(out.payload, { wood: 100 });
});

test('attack victory clears the hostile and returns loot', () => {
  const wm = fakeWorld();
  const poi = { id: 'camp_a', type: 'camp', monsterId: 'goblin_camp' };
  const out = resolveArrival({ type: 'attack', squadId: 's1' }, poi, { worldMapManager: wm, combatManager: winner });
  assert.equal(out.outcome, 'victory');
  assert.deepEqual(out.payload, { money: 50 });
  assert.deepEqual(wm.calls, [['markHostileCleared', 'camp_a']]);
});

test('a stronghold victory captures its region', () => {
  const wm = fakeWorld();
  const poi = { id: 'sh_red', type: 'stronghold', monsterId: 'troll', capturesRegion: 'red_lowlands' };
  resolveArrival({ type: 'attack', squadId: 's1' }, poi, { worldMapManager: wm, combatManager: winner });
  assert.deepEqual(wm.calls, [['markHostileCleared', 'sh_red'], ['captureRegion', 'red_lowlands']]);
});

test('attack defeat changes no world state', () => {
  const wm = fakeWorld();
  const poi = { id: 'camp_a', type: 'camp', monsterId: 'goblin_camp' };
  const out = resolveArrival({ type: 'attack', squadId: 's1' }, poi, { worldMapManager: wm, combatManager: loser });
  assert.equal(out.outcome, 'defeat');
  assert.deepEqual(wm.calls, []);
});

test('attack without a combat manager resolves to no_combat', () => {
  const poi = { id: 'camp_a', type: 'camp', monsterId: 'goblin_camp' };
  const out = resolveArrival({ type: 'attack', squadId: 's1' }, poi, { worldMapManager: fakeWorld() });
  assert.equal(out.outcome, 'no_combat');
});

test('a boss outside its window is not fought', () => {
  const wm = fakeWorld({ isBossOpen: () => false });
  const poi = { id: 'wb_roc', type: 'world_boss', monsterId: 'frost_giant', lootTable: [] };
  const out = resolveArrival({ type: 'attack', squadId: 's1' }, poi, { worldMapManager: wm, combatManager: winner });
  assert.equal(out.outcome, 'closed');
  assert.deepEqual(wm.calls, []);
});

test('a boss kill is recorded and folds a drop into the loot', () => {
  const wm = fakeWorld();
  const poi = {
    id: 'wb_roc', type: 'world_boss', monsterId: 'frost_giant',
    lootTable: [{ kind: 'resource', resource: 'iron', amount: 200, weight: 1 }],
  };
  const out = resolveArrival({ type: 'attack', squadId: 's1' }, poi, { worldMapManager: wm, combatManager: winner });
  assert.equal(out.outcome, 'boss_victory');
  assert.deepEqual(out.payload, { money: 50, iron: 200 });
  assert.deepEqual(wm.calls, [['markBossDefeated', 'wb_roc']]);
});

test('scouting an already-looted ruin is spent', () => {
  const wm = fakeWorld({ getPOIState: () => ({ looted: true }) });
  const poi = { id: 'ruin_a', type: 'ruin' };
  const out = resolveArrival({ type: 'scout', squadId: 's1' }, poi, { worldMapManager: wm });
  assert.equal(out.outcome, 'spent');
  assert.deepEqual(wm.calls, []);
});

test('a ruin expedition loots once and carries a resource reward home', () => {
  const wm = fakeWorld();
  const poi = {
    id: 'ruin_a', type: 'ruin', expeditionMs: 5000,
    reward: { kind: 'resource', resource: 'money', amount: 300 },
  };
  const out = resolveArrival({ type: 'scout', squadId: 's1' }, poi, { worldMapManager: wm });
  assert.equal(out.outcome, 'explored');
  assert.deepEqual(out.payload, { money: 300 });
  assert.equal(out.dwellMs, 5000);
  assert.deepEqual(wm.calls, [['markRuinLooted', 'ruin_a']]);
});

test('item and buff ruin rewards land in grants, not payload', () => {
  const item = resolveArrival(
    { type: 'scout' },
    { id: 'r1', type: 'ruin', reward: { kind: 'item', itemId: 'token_epic', qty: 2 } },
    { worldMapManager: fakeWorld() },
  );
  assert.deepEqual(item.payload, {});
  assert.deepEqual(item.grants, { items: [{ itemId: 'token_epic', qty: 2 }] });

  const buff = resolveArrival(
    { type: 'scout' },
    { id: 'r2', type: 'ruin', reward: { kind: 'buff', flavor: 'logistic', pct: 0.1, durationMs: 60000 } },
    { worldMapManager: fakeWorld() },
  );
  assert.deepEqual(buff.payload, {});
  assert.deepEqual(buff.grants, { buff: { flavor: 'logistic', pct: 0.1, durationMs: 60000 } });
});

test('a lost garrison fight aborts the expedition and leaves the ruin unlooted', () => {
  const wm = fakeWorld();
  const poi = { id: 'ruin_a', type: 'ruin', garrison: 'goblin_camp', reward: { kind: 'resource', resource: 'money', amount: 300 } };
  const out = resolveArrival({ type: 'scout', squadId: 's1' }, poi, { worldMapManager: wm, combatManager: loser });
  assert.equal(out.outcome, 'defeat');
  assert.deepEqual(wm.calls, []);
});

test('scouting an outpost captures it', () => {
  const wm = fakeWorld();
  const out = resolveArrival({ type: 'scout', squadId: 's1' }, { id: 'op_a', type: 'outpost' }, { worldMapManager: wm });
  assert.equal(out.outcome, 'captured');
  assert.deepEqual(wm.calls, [['captureOutpost', 'op_a']]);
});

test('an outpost already held is not re-captured', () => {
  const wm = fakeWorld({ outpostOwner: () => 'player' });
  const out = resolveArrival({ type: 'scout', squadId: 's1' }, { id: 'op_a', type: 'outpost' }, { worldMapManager: wm });
  assert.equal(out.outcome, 'held');
  assert.deepEqual(wm.calls, []);
});

test('scouting a POI that is neither ruin nor outpost is spent', () => {
  const out = resolveArrival({ type: 'scout' }, { id: 'camp_a', type: 'camp' }, { worldMapManager: fakeWorld() });
  assert.equal(out.outcome, 'spent');
});

function capturing(result = { victory: true }) {
  const args = [];
  return { args, resolveMarchBattle: (...a) => { args.push(a); return result; } };
}

test('stronghold and outpost battles are structure fights', () => {
  for (const [march, poi] of [
    [{ type: 'attack', squadId: 's1' }, { id: 'sh', type: 'stronghold', monsterId: 'troll' }],
    [{ type: 'scout', squadId: 's1' }, { id: 'op', type: 'outpost', garrison: 'goblin' }],
  ]) {
    const cm = capturing();
    resolveArrival(march, poi, { worldMapManager: fakeWorld(), combatManager: cm });
    assert.equal(cm.args[0][3].structure, true);
  }
});

test('camp, ruin garrison and boss battles are field fights', () => {
  const cases = [
    [{ type: 'attack', squadId: 's1' }, { id: 'c', type: 'camp', monsterId: 'goblin_camp' }],
    [{ type: 'scout', squadId: 's1' }, { id: 'r', type: 'ruin', garrison: 'goblin' }],
    [{ type: 'attack', squadId: 's1' }, { id: 'b', type: 'world_boss', monsterId: 'dragon' }],
  ];
  for (const [march, poi] of cases) {
    const cm = capturing();
    resolveArrival(march, poi, { worldMapManager: fakeWorld(), combatManager: cm });
    assert.equal(cm.args[0][3].structure, false);
  }
});

test('battle results carry casualties', () => {
  const result = { victory: true, dead: { t1: 3 }, wounded: { t1: 2 } };
  const expected = { dead: { t1: 3 }, wounded: { t1: 2 } };
  const cm = capturing(result);
  const camp = { id: 'c', type: 'camp', monsterId: 'm' };
  const boss = { id: 'b', type: 'world_boss', monsterId: 'm' };
  const ruin = { id: 'r', type: 'ruin', garrison: 'g', reward: { kind: 'resource', resource: 'wood', amount: 1 } };
  const outpost = { id: 'o', type: 'outpost', garrison: 'g' };
  const ctx = { worldMapManager: fakeWorld(), combatManager: cm };
  assert.deepEqual(resolveArrival({ type: 'attack', squadId: 's' }, camp, ctx).casualties, expected);
  assert.deepEqual(resolveArrival({ type: 'attack', squadId: 's' }, boss, ctx).casualties, expected);
  assert.deepEqual(resolveArrival({ type: 'scout', squadId: 's' }, ruin, ctx).casualties, expected);
  assert.deepEqual(resolveArrival({ type: 'scout', squadId: 's' }, outpost, ctx).casualties, expected);
});

test('a lost battle still reports casualties', () => {
  const cm = capturing({ victory: false, dead: { t1: 4 }, wounded: {} });
  const out = resolveArrival({ type: 'attack', squadId: 's' }, { id: 'c', type: 'camp', monsterId: 'm' },
    { worldMapManager: fakeWorld(), combatManager: cm });
  assert.deepEqual(out.casualties, { dead: { t1: 4 }, wounded: {} });
});
