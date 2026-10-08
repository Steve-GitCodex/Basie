import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPct, formatRemaining, describeEntry, worldBuffEffect } from '../../js/ui/buffs/buffText.js';
import { BUFF_SOURCES } from '../../js/entities/GAME_DATA.js';

test('formatRemaining picks two units', () => {
  assert.equal(formatRemaining(2 * 86400e3 + 4 * 3600e3), '2d 4h');
  assert.equal(formatRemaining(72 * 60e3), '1h 12m');
  assert.equal(formatRemaining(250e3), '4m 10s');
  assert.equal(formatRemaining(9e3), '9s');
  assert.equal(formatRemaining(-5), '0s');
});

test('formatPct', () => {
  assert.equal(formatPct(0.5), '+50%');
  assert.equal(formatPct(0), '—');
  assert.equal(formatPct(-0.1), '−10%');
});

test('describeEntry names effect with the stat label', () => {
  const d = describeEntry({ sourceKind: 'region', label: 'Pinewood Vale', stat: 'production.wood', pct: 0.15, endsAt: null });
  assert.equal(d.name, 'Pinewood Vale');
  assert.match(d.effect, /^\+15% /);
  assert.equal(d.effect, '+15% Wood production');
  assert.equal(d.tag, BUFF_SOURCES.region.tag);
});

test('worldBuffEffect words each world flavor', () => {
  assert.equal(worldBuffEffect({ flavor: 'economic', resource: 'wood', pct: 0.15 }), '+15% Wood production');
  assert.equal(worldBuffEffect({ flavor: 'military', pct: 0.1 }), '+10% Troop attack');
  assert.equal(worldBuffEffect({ flavor: 'logistic', pct: 0.12 }), '+12% March speed');
});
