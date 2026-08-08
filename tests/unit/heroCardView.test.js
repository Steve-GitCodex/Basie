import test from 'node:test';
import assert from 'node:assert/strict';

import { portraitHtml, statusChipHtml, tierPillHtml, TIER_META } from '../../js/ui/heroes/heroCardView.js';

const hero = (over = {}) => ({
  id: 'warlord', name: 'Marcus Kestrel', tier: 'legendary', icon: '⚔️',
  isOwned: true, isInSquad: false, isInBuilding: false, assignedBuilding: null, ...over,
});

test('portraitHtml emits an img when the art manifest has the path', () => {
  const html = portraitHtml(hero(), 'thumb');
  assert.match(html, /<img/);
  assert.match(html, /assets\/heroes\/warlord_thumb\.png/);
});

test('portraitHtml falls back to the emoji for a hero with no art', () => {
  const html = portraitHtml(hero({ id: 'nope' }), 'thumb');
  assert.ok(!html.includes('<img'), 'no img tag without a manifest entry');
  assert.match(html, /⚔️/);
});

test('portraitHtml alt text carries the hero name, never a file path', () => {
  const html = portraitHtml(hero(), 'splash');
  assert.match(html, /alt="Marcus Kestrel"/);
});

test('statusChipHtml distinguishes idle, squad, stationed and unrecruited', () => {
  assert.match(statusChipHtml(hero(), {}), /Idle/i);
  assert.match(statusChipHtml(hero({ isInSquad: true, assignedBuilding: 'barracks_0' }), { squadName: 'Alpha' }), /Alpha/);
  assert.match(statusChipHtml(hero({ isInBuilding: true, assignedBuilding: 'mine_0' }), {}), /mine_0|Mine/i);
  assert.match(statusChipHtml(hero({ isOwned: false }), {}), /recruit/i);
});

test('tierPillHtml uses the tier label from TIER_META', () => {
  assert.match(tierPillHtml(hero()), new RegExp(TIER_META.legendary.label));
  assert.match(tierPillHtml(hero({ tier: 'normal' })), /Normal/);
});
