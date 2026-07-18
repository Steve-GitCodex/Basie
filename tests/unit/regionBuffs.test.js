import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activeBuffs, economicBonus, logisticSpeedMult, militaryMult,
} from '../../js/systems/world/regionBuffs.js';

const MAP = {
  regions: [
    { id: 'home_vale', buff: { flavor: 'economic', resource: 'iron', pct: 0.1 } },
    { id: 'west_warrens', buff: { flavor: 'economic', resource: 'iron', pct: 0.15 } },
    { id: 'mistwood', buff: { flavor: 'logistic', pct: 0.05 } },
    { id: 'red_lowlands', buff: { flavor: 'military', pct: 0.2 } },
    { id: 'command_ruin', buff: null },
  ],
};

const allOwned = Object.fromEntries(MAP.regions.map(r => [r.id, 'player']));

test('only buffs from player-owned regions are active', () => {
  const owner = { ...allOwned, west_warrens: 'bandits' };
  const ids = activeBuffs(owner, MAP).map(b => b.regionId);
  assert.ok(!ids.includes('west_warrens'));
  assert.ok(ids.includes('home_vale'));
});

test('regions without a buff contribute nothing', () => {
  const ids = activeBuffs(allOwned, MAP).map(b => b.regionId);
  assert.ok(!ids.includes('command_ruin'));
  assert.equal(ids.length, 4);
});

test('an active buff carries its region id alongside the buff fields', () => {
  const buff = activeBuffs({ home_vale: 'player' }, MAP)[0];
  assert.deepEqual(buff, { regionId: 'home_vale', flavor: 'economic', resource: 'iron', pct: 0.1 });
});

test('owning nothing yields no buffs', () => {
  assert.deepEqual(activeBuffs({}, MAP), []);
});

test('economic bonuses stack additively per resource key', () => {
  const buffs = activeBuffs(allOwned, MAP);
  assert.ok(Math.abs(economicBonus(buffs, 'iron') - 0.25) < 1e-9);
});

test('an economic bonus does not leak across resource keys', () => {
  const buffs = activeBuffs(allOwned, MAP);
  assert.equal(economicBonus(buffs, 'wood'), 0);
  assert.equal(economicBonus(buffs, 'food'), 0);
});

test('other buff flavors never count as an economic bonus', () => {
  const buffs = [
    { flavor: 'logistic', pct: 0.5 },
    { flavor: 'military', pct: 0.5, resource: 'iron' },
  ];
  assert.equal(economicBonus(buffs, 'iron'), 0);
});

test('a buff with no pct is treated as zero', () => {
  assert.equal(economicBonus([{ flavor: 'economic', resource: 'iron' }], 'iron'), 0);
  assert.equal(logisticSpeedMult([{ flavor: 'logistic' }]), 1);
  assert.equal(militaryMult([{ flavor: 'military' }]), 1);
});

test('logistic and military multipliers sum their flavor and are 1 when absent', () => {
  const buffs = activeBuffs(allOwned, MAP);
  assert.ok(Math.abs(logisticSpeedMult(buffs) - 1.05) < 1e-9);
  assert.ok(Math.abs(militaryMult(buffs) - 1.2) < 1e-9);
  assert.equal(logisticSpeedMult([]), 1);
  assert.equal(militaryMult([]), 1);
});

test('multipliers stack across several owned regions of the same flavor', () => {
  const buffs = [
    { flavor: 'logistic', pct: 0.05 },
    { flavor: 'logistic', pct: 0.1 },
  ];
  assert.ok(Math.abs(logisticSpeedMult(buffs) - 1.15) < 1e-9);
});
