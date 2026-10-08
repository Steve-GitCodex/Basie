import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fromBoosts, fromWorld, fromTech, fromVip, fromHq, fromHeroes, fromEvents,
} from '../../js/systems/buffs/ledgerSources.js';

test('fromBoosts maps an item boost with its timing', () => {
  const [e] = fromBoosts({ boosts: [{ itemId: 'x', stat: 'production.all', value: 0.25, startedAt: 5, endsAt: 99 }], itemNames: { x: 'Tonic' } });
  assert.deepEqual(e, { sourceKind: 'item', sourceId: 'x', label: 'Tonic', stat: 'production.all', pct: 0.25, startedAt: 5, endsAt: 99 });
});

test('fromWorld classifies region, outpost and expedition buffs', () => {
  const out = fromWorld({
    regionNames: { r1: 'Vale' }, poiNames: { p1: 'Tower' },
    worldBuffs: [
      { regionId: 'r1', flavor: 'economic', resource: 'wood', pct: 0.1 },
      { poiId: 'p1', flavor: 'military', pct: 0.05 },
      { flavor: 'logistic', pct: 0.2, expiresAt: 500, grantedAt: 100 },
    ],
  });
  assert.deepEqual(out.map(e => [e.sourceKind, e.stat, e.pct, e.startedAt, e.endsAt]), [
    ['region', 'production.wood', 0.1, null, null],
    ['outpost', 'troop.attack', 0.05, null, null],
    ['expedition', 'march.speed', 0.2, 100, 500],
  ]);
  assert.equal(out[0].label, 'Vale');
  assert.equal(out[1].label, 'Tower');
});

test('fromTech maps combat, build and resource bonuses', () => {
  const out = fromTech({ techBonuses: { attackBonus: 0.1, defenseBonus: 0.2, buildTimeReduction: 0.3, woodBonus: 0.4, waterBonus: 0, stoneBonus: 0.5, ironBonus: 0.6 } });
  const m = Object.fromEntries(out.map(e => [e.stat, e.pct]));
  assert.deepEqual(m, { 'troop.attack': 0.1, 'build.speed': 0.3, 'production.wood': 0.4, 'production.stone': 0.5, 'production.iron': 0.6 });
  assert.ok(out.every(e => e.sourceKind === 'tech' && e.endsAt === null));
});

test('fromVip maps perks and skips zeros', () => {
  const out = fromVip({ vipTier: 3, vipPerks: { productionBonus: 0.05, buildTimeReduction: 0.1, researchReduction: 0.2, trainReduction: 0.3, extraBuildSlots: 1 } });
  const m = Object.fromEntries(out.map(e => [e.stat, e.pct]));
  assert.deepEqual(m, { 'production.all': 0.05, 'build.speed': 0.1, 'research.speed': 0.2, 'train.speed': 0.3 });
  assert.ok(out.every(e => e.sourceKind === 'vip'));
  assert.deepEqual(fromVip({ vipTier: 0, vipPerks: { productionBonus: 0 } }), []);
});

test('fromHq maps production, attack and defense', () => {
  const out = fromHq({ hqLevel: 4, hqBenefits: { productionBonus: 0.05, attackBonus: 0.02, defenseBonus: 0.03, storageBonus: 0.5 } });
  assert.deepEqual(out.map(e => [e.sourceKind, e.stat, e.pct]), [
    ['hq', 'production.all', 0.05], ['hq', 'troop.attack', 0.02], ['hq', 'troop.defense', 0.03],
  ]);
});

test('fromHeroes maps speed effects', () => {
  const out = fromHeroes({ heroEffects: { buildSpeed: 0.1, researchSpeed: 0.2, trainingSpeed: 0.3, baseDefense: 9 } });
  const m = Object.fromEntries(out.map(e => [e.stat, e.pct]));
  assert.deepEqual(m, { 'build.speed': 0.1, 'research.speed': 0.2, 'train.speed': 0.3 });
  assert.ok(out.every(e => e.sourceKind === 'hero'));
});

test('fromEvents converts multipliers to pct and carries endTs', () => {
  const [e] = fromEvents({ activeEvent: { id: 'ev', name: 'Harvest', startTs: 10, endTs: 90, effects: { wood: 1.5 } } });
  assert.deepEqual(e, { sourceKind: 'event', sourceId: 'ev', label: 'Harvest', stat: 'production.wood', pct: 0.5, startedAt: 10, endsAt: 90 });
  assert.deepEqual(fromEvents({ activeEvent: null }), []);
});

test('collectors tolerate missing snapshot parts', () => {
  for (const f of [fromBoosts, fromWorld, fromTech, fromVip, fromHq, fromHeroes, fromEvents]) assert.deepEqual(f({}), []);
});

test('fromTech ignores the flat tech defenseBonus (not a percentage)', async () => {
  const { TECH_CONFIG } = await import('../../js/entities/GAME_DATA.js');
  const flat = Object.values(TECH_CONFIG).flatMap(t => Object.entries(t.effects ?? {})).filter(([k]) => k === 'defenseBonus');
  assert.ok(flat.some(([, v]) => v > 1), 'fixture assumption: a tech grants flat defense');
  assert.deepEqual(fromTech({ techBonuses: { defenseBonus: 25 } }), []);
});
