import test from 'node:test';
import assert from 'node:assert/strict';

import { buildingEconomy } from '../../js/systems/building/buildingEconomy.js';

test('computeStorageCaps applies storageCapacityBonus to finite caps', () => {
  const buildings = new Map([
    ['townhall', [{ instanceId: 'townhall_0', level: 1 }]],
  ]);
  const noBonus   = buildingEconomy.computeStorageCaps(buildings, {});
  const withBonus = buildingEconomy.computeStorageCaps(buildings, { storageCapacityBonus: 0.2 });
  assert.ok(withBonus.caps.wood > noBonus.caps.wood);
});

test('a stationed hero production bonus scales only its own instance, once', () => {
  const buildings = new Map([
    ['mine', [
      { instanceId: 'mine_0', level: 1 },
      { instanceId: 'mine_1', level: 1 },
    ]],
  ]);
  const ctx = {
    getPopulation:   () => ({ current: 0, cap: 0 }),
    getBuildingHero: (iid) => iid === 'mine_0' ? { heroId: 'shadowblade', level: 4 } : null,
  };
  const [withHero, withoutHero] = buildingEconomy.computeActiveRates(buildings, ctx);

  assert.equal(withoutHero.effects.iron, 0.5);
  assert.equal(withHero.effects.iron, 0.5 * (1 + 4 * 0.05));
});
