import { test } from 'node:test';
import assert from 'node:assert/strict';

import { INVENTORY_ITEMS } from '../../js/entities/data/economy.js';
import { HEROES_CONFIG, XP_CONFIG, PITY_CONFIG, EXCHANGE_CONFIG, AWAKENING_CONFIG } from '../../js/entities/data/heroes.js';

test('roster has 6 heroes at 2/2/2 tiers with backstory', () => {
  const ids = Object.keys(HEROES_CONFIG);
  assert.equal(ids.length, 6);
  const byTier = t => ids.filter(id => HEROES_CONFIG[id].tier === t);
  assert.deepEqual(byTier('legendary').sort(), ['archsorceress', 'warlord']);
  assert.deepEqual(byTier('epic').sort(),      ['junovane', 'paladin']);
  assert.deepEqual(byTier('normal').sort(),    ['kaelenthorne', 'shadowblade']);
  for (const id of ids) assert.ok(HEROES_CONFIG[id].backstory?.length > 0, `${id} backstory`);
});

test('re-fiction display names applied, ids unchanged (save keys)', () => {
  assert.equal(HEROES_CONFIG.warlord.name,      'Marcus Kestrel');
  assert.equal(HEROES_CONFIG.archsorceress.name,'Vera Sable');
  assert.equal(HEROES_CONFIG.shadowblade.name,  'Kira Nightwhisper');
  assert.equal(HEROES_CONFIG.paladin.name,      'Aldric Cross');
});

test('every hero has a fragment + shard item; every tier has token/tier-shard/xpcard', () => {
  for (const id of Object.keys(HEROES_CONFIG)) {
    assert.ok(INVENTORY_ITEMS[`fragment_${id}`], `fragment_${id}`);
    assert.ok(INVENTORY_ITEMS[`shard_${id}`],    `shard_${id}`);
  }
  for (const t of ['normal','epic','legendary']) {
    assert.ok(INVENTORY_ITEMS[`token_${t}`],      `token_${t}`);
    assert.ok(INVENTORY_ITEMS[`tier_shard_${t}`], `tier_shard_${t}`);
    assert.ok(INVENTORY_ITEMS[`xpcard_${t}`],     `xpcard_${t}`);
  }
});

test('config blocks match locked numbers', () => {
  assert.equal(AWAKENING_CONFIG.maxStars, 10);
  assert.equal(XP_CONFIG.tierMult.legendary, 1.5);
  assert.equal(PITY_CONFIG.stage1HardPityN, 10);
  assert.equal(EXCHANGE_CONFIG.tierShardsPerHeroShard, 3);
});
