import test from 'node:test';
import assert from 'node:assert/strict';

import { EventManager } from '../../js/systems/EventManager.js';
import { ResourceManager } from '../../js/systems/ResourceManager.js';
import { EVENTS_CONFIG } from '../../js/entities/GAME_DATA.js';

function stubRM() {
  const modifiers = new Map();
  return {
    modifiers,
    addModifier(resourceType, multiplier, id) { modifiers.set(`${id}:${resourceType}`, multiplier); },
    removeModifier(id, resourceType) { modifiers.delete(`${id}:${resourceType}`); },
  };
}

test('deactivating an event removes every modifier it added', () => {
  const rm = stubRM();
  const em = new EventManager(rm, null, null, null);
  const cfg = EVENTS_CONFIG.find(e => e.id === 'double_iron_weekend');

  em._activateEvent(cfg);
  assert.equal(rm.modifiers.size, 1);

  em._deactivateEvent(cfg);
  assert.equal(rm.modifiers.size, 0);
});

test('deactivating a multi-effect event removes every resource it modified', () => {
  const rm = stubRM();
  const em = new EventManager(rm, null, null, null);
  const cfg = EVENTS_CONFIG.find(e => e.id === 'forest_bounty');

  em._activateEvent(cfg);
  assert.equal(rm.modifiers.size, 2);

  em._deactivateEvent(cfg);
  assert.equal(rm.modifiers.size, 0);
});

test('expired event releases its production multiplier on the real ResourceManager', () => {
  const rm = new ResourceManager();
  rm.recalculateRates([{ effects: { iron: 10 }, level: 1 }]);
  const baseline = rm._resources.iron.perSec;

  const em = new EventManager(rm, null, null, null);
  const cfg = EVENTS_CONFIG.find(e => e.id === 'double_iron_weekend');

  em._activateEvent(cfg);
  assert.equal(rm._resources.iron.perSec, baseline * 2);

  em._deactivateEvent(cfg);
  assert.equal(rm._resources.iron.perSec, baseline);
});
