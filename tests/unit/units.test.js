import test from 'node:test';
import assert from 'node:assert/strict';

import { UNITS_CONFIG, UNIT_TIER_REQUIREMENTS, tierRequirements } from '../../js/entities/data/units.js';

const withAppendedTier = unit => ({
  ...unit,
  tiers: [...unit.tiers, { ...unit.tiers.at(-1), tier: unit.tiers.length + 1 }],
});

test('a tier appended without a hall-level entry throws instead of going ungated', () => {
  assert.throws(() => tierRequirements(withAppendedTier(UNITS_CONFIG.infantry)), /infantry tier \d+ has no TIER_MIN_HALL_LEVEL entry/);
});

test('tierRequirements reproduces the shipped requirements for every unit', () => {
  for (const [unitId, unit] of Object.entries(UNITS_CONFIG)) assert.deepEqual(tierRequirements(unit), UNIT_TIER_REQUIREMENTS[unitId]);
});
