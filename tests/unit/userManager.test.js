import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';
import { UserManager } from '../../js/systems/UserManager.js';

test('resources:spent with diamond advances diamondsSpent', () => {
  const user = new UserManager();
  eventBus.emit('resources:spent', { diamond: 30, money: 5 });
  assert.equal(user.profile.stats.diamondsSpent, 30);
});

test('resources:spent without diamond leaves diamondsSpent unchanged', () => {
  const user = new UserManager();
  eventBus.emit('resources:spent', { money: 100 });
  assert.equal(user.profile.stats.diamondsSpent, 0);
});
