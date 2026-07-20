import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';
import { TechnologyManager } from '../../js/systems/TechnologyManager.js';

function stubRM() {
  return { canAfford: () => true, spend() {}, add() {} };
}

function stubBM() {
  return {
    getHQUnlockedIds: () => new Set(),
    getRequiredHQLevel: () => 0,
    getLevelOf: () => 0,
  };
}

test('VIP extraResearchSlots grant is idempotent across repeated isInit broadcasts', () => {
  const tm = new TechnologyManager(stubRM(), stubBM());
  eventBus.emit('user:vipUpdate', { perks: { extraResearchSlots: 1 }, isInit: true });
  assert.equal(tm._premiumQueueSlots, 1);
  eventBus.emit('user:vipUpdate', { perks: { extraResearchSlots: 1 }, isInit: true });
  assert.equal(tm._premiumQueueSlots, 1);
  eventBus.emit('user:vipUpdate', { perks: { extraResearchSlots: 1 }, isInit: true });
  assert.equal(tm._premiumQueueSlots, 1);
});

test('VIP research slot grant survives a save/load cycle without accumulating', () => {
  const tm = new TechnologyManager(stubRM(), stubBM());
  eventBus.emit('user:vipUpdate', { perks: { extraResearchSlots: 1 }, isInit: true });
  assert.equal(tm._premiumQueueSlots, 1);
  const saved = tm.serialize();

  const tm2 = new TechnologyManager(stubRM(), stubBM());
  tm2.deserialize(saved);
  eventBus.emit('user:vipUpdate', { perks: { extraResearchSlots: 1 }, isInit: true });
  assert.equal(tm2._premiumQueueSlots, 1, 'reload must not re-add the already-restored VIP grant');

  eventBus.emit('user:vipUpdate', { perks: { extraResearchSlots: 1 }, isInit: true });
  assert.equal(tm2._premiumQueueSlots, 1, 'a second reload must remain idempotent too');
});

test('a shop-purchased research slot and a VIP-granted slot both survive independently', () => {
  const tm = new TechnologyManager(stubRM(), stubBM());
  tm.grantShopResearchSlot();
  eventBus.emit('user:vipUpdate', { perks: { extraResearchSlots: 1 }, isInit: true });
  assert.equal(tm._premiumQueueSlots, 2);

  const tm2 = new TechnologyManager(stubRM(), stubBM());
  tm2.deserialize(tm.serialize());
  eventBus.emit('user:vipUpdate', { perks: { extraResearchSlots: 1 }, isInit: true });
  assert.equal(tm2._premiumQueueSlots, 2, 'reload must preserve both the shop slot and the VIP slot');
});
