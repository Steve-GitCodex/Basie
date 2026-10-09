import test from 'node:test';
import assert from 'node:assert/strict';

import { VIP_TIERS } from '../../js/entities/GAME_DATA.js';
import { commanderRows, commanderHtml } from '../../js/ui/hud/commanderPopover.js';

const profile = { username: 'Steve', level: 7, xp: 1250, xpToNext: 4000 };

test('commanderRows maps profile to display values', () => {
  const rows = commanderRows(profile, 2);
  assert.equal(rows.name, 'Steve');
  assert.equal(rows.level, '7');
  assert.equal(rows.xp, `${(1250).toLocaleString()} / ${(4000).toLocaleString()}`);
  assert.equal(rows.vip, 'II');
  assert.ok(VIP_TIERS.find(t => t.tier === 2).label.endsWith(rows.vip));
  assert.equal(rows.ratio, 1250 / 4000);
});

test('commanderRows shows a dash without a VIP tier', () => {
  assert.equal(commanderRows(profile, 0).vip, '—');
  assert.equal(commanderRows(profile, undefined).vip, '—');
});

test('commanderRows falls back to the tier number for an unknown tier', () => {
  assert.equal(commanderRows(profile, 99).vip, '99');
});

test('commanderRows clamps the xp ratio and survives a zero threshold', () => {
  assert.equal(commanderRows({ ...profile, xp: 9000 }, 0).ratio, 1);
  assert.equal(commanderRows({ ...profile, xpToNext: 0 }, 0).ratio, 0);
});

test('commanderHtml has no power row and a profile action', () => {
  const html = commanderHtml();
  assert.ok(!/power/i.test(html));
  assert.ok(html.includes('data-pop="profile"'));
});
