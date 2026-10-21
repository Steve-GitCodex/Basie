import test from 'node:test';
import assert from 'node:assert/strict';

import { levelEffectParts, hasLevelEffects } from '../../js/ui/buildings/levelEffects.js';
import { BUILDINGS_CONFIG } from '../../js/entities/GAME_DATA.js';
import { prodFactor } from '../../js/systems/building/buildingCurve.js';

const textAt = (id, level) => levelEffectParts(BUILDINGS_CONFIG[id], level).map(p => p.text).join(' | ');

test('every level of every table-driven building yields an effect', () => {
  for (const cfg of Object.values(BUILDINGS_CONFIG)) {
    if (!hasLevelEffects(cfg)) continue;
    for (let level = 1; level <= cfg.maxLevel; level++) {
      assert.ok(levelEffectParts(cfg, level).length > 0, `${cfg.id} L${level}`);
    }
  }
});

test('production uses the shared production curve', () => {
  const [part] = levelEffectParts(BUILDINGS_CONFIG.farm, 12);
  assert.equal(part.res, 'food');
  assert.equal(part.text, `+${(0.5 * prodFactor(12)).toFixed(1)}/s`);
});

test('trainer halls show slots, tier and batch from trainingSlots', () => {
  assert.match(textAt('infantryhall', 4), /^2 slots · T\d+ · batch 100/);
  assert.match(textAt('infantryhall', 22), /^4 slots/);
});

test('barracks shows slot capacity and rally shows marches', () => {
  assert.match(textAt('barracks', 30), /8,000 units per squad slot/);
  assert.match(textAt('rallypoint', 10), /^5 marches · \+45% speed/);
});

test('hero quarters scales hero slots by level', () => {
  assert.equal(textAt('heroquarters', 12), '24 hero slots');
});

test('storage buildings list a cap for each resource', () => {
  const parts = levelEffectParts(BUILDINGS_CONFIG.storehouse, 30);
  assert.deepEqual(parts.map(p => p.res), ['wood', 'stone', 'iron', 'food', 'water', 'money']);
});

test('buildings without level tables report no effect column', () => {
  assert.equal(hasLevelEffects(BUILDINGS_CONFIG.workshop), false);
});
