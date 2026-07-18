import test from 'node:test';
import assert from 'node:assert/strict';

import { buildingRules } from '../../js/systems/building/buildingRules.js';

const { scaleCost, checkRequirements, collectMissing, checkCondition } = buildingRules;

function ctx({ levels = {}, population = { current: 0, cap: 0 } } = {}) {
  return {
    getLevelOf: (id) => levels[id] ?? 0,
    getPopulation: () => population,
  };
}

test('cost at level zero is the base cost', () => {
  assert.deepEqual(scaleCost({ wood: 100, stone: 50 }, 1.6, 0), { wood: 100, stone: 50 });
});

test('cost scales geometrically and floors to whole resources', () => {
  assert.deepEqual(scaleCost({ wood: 100 }, 1.6, 1), { wood: 160 });
  assert.deepEqual(scaleCost({ wood: 100 }, 1.6, 2), { wood: 256 });
  assert.deepEqual(scaleCost({ wood: 80 }, 1.5, 3), { wood: 270 });
});

test('a multiplier of 1 never raises the cost', () => {
  assert.deepEqual(scaleCost({ wood: 100 }, 1, 9), { wood: 100 });
});

test('no requirements is always met', () => {
  assert.deepEqual(checkRequirements(null, ctx()), { met: true });
  assert.deepEqual(checkRequirements(undefined, ctx()), { met: true });
  assert.deepEqual(collectMissing(null, ctx()), []);
});

test('a satisfied building requirement is met', () => {
  assert.deepEqual(checkRequirements({ townhall: 3 }, ctx({ levels: { townhall: 3 } })), { met: true });
  assert.deepEqual(checkRequirements({ townhall: 3 }, ctx({ levels: { townhall: 5 } })), { met: true });
});

test('an unmet requirement reports the compact building name', () => {
  const out = checkRequirements({ townhall: 3 }, ctx({ levels: { townhall: 1 } }));
  assert.equal(out.met, false);
  assert.equal(out.reason, 'Requires HQ Lv.3');
});

test('a building with no shortName is named in full', () => {
  const out = checkRequirements({ infantryhall: 3 }, ctx());
  assert.equal(out.met, false);
  assert.equal(out.reason, 'Requires Infantry Hall Lv.3');
});

test('an unknown building id falls back to the id itself', () => {
  const out = checkRequirements({ not_a_building: 1 }, ctx());
  assert.equal(out.met, false);
  assert.equal(out.reason, 'Requires not_a_building Lv.1');
});

test('population requirements read the population, not a building level', () => {
  assert.deepEqual(checkRequirements({ population: 10 }, ctx({ population: { current: 10, cap: 20 } })), { met: true });
  const out = checkRequirements({ population: 10 }, ctx({ population: { current: 4, cap: 20 } }));
  assert.equal(out.met, false);
  assert.equal(out.reason, 'Requires Population ≥ 10');
});

test('checkRequirements stops at the first failure', () => {
  const out = checkRequirements({ townhall: 5, infantryhall: 5 }, ctx());
  assert.equal(out.reason, 'Requires HQ Lv.5');
});

test('collectMissing reports every unmet condition', () => {
  const missing = collectMissing({ townhall: 5, infantryhall: 5 }, ctx({ levels: { townhall: 1 } }));
  assert.deepEqual(missing, ['Requires HQ Lv.5', 'Requires Infantry Hall Lv.5']);
});

test('collectMissing omits the conditions already met', () => {
  const missing = collectMissing({ townhall: 5, infantryhall: 5 }, ctx({ levels: { townhall: 5 } }));
  assert.deepEqual(missing, ['Requires Infantry Hall Lv.5']);
  assert.deepEqual(collectMissing({ townhall: 5 }, ctx({ levels: { townhall: 5 } })), []);
});

test('collectMissing shows current population on a shortfall', () => {
  const missing = collectMissing({ population: 10 }, ctx({ population: { current: 4.7, cap: 20 } }));
  assert.deepEqual(missing, ['Requires Population ≥ 10 (current: 4)']);
});

test('an empty or missing condition is always true', () => {
  assert.equal(checkCondition(null, ctx()), true);
  assert.equal(checkCondition({}, ctx()), true);
});

test('a condition needs every building level satisfied', () => {
  const levels = { townhall: 3, farm: 2 };
  assert.equal(checkCondition({ townhall: 3, farm: 2 }, ctx({ levels })), true);
  assert.equal(checkCondition({ townhall: 5, farm: 2 }, ctx({ levels })), false);
});
