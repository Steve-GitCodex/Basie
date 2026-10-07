import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';
import { routeFix } from '../../js/ui/combat/scene/resultsActions.js';

const EVENTS = ['ui:navigateTo', 'ui:openTraining', 'ui:openSquads'];

function capture(fn) {
  const seen = [];
  const handlers = EVENTS.map(name => [name, data => seen.push([name, data])]);
  for (const [name, handler] of handlers) eventBus.on(name, handler);
  fn();
  for (const [name, handler] of handlers) eventBus.off(name, handler);
  return seen;
}

test('train opens the trainer building of the analysed stack', () => {
  assert.deepEqual(capture(() => routeFix('train', { trainBuildingId: 'archeryrange' })), [
    ['ui:navigateTo', 'base'], ['ui:openTraining', { buildingId: 'archeryrange' }],
  ]);
});

test('mix and rows open the squad barracks instance', () => {
  const squad = { barracksInstanceId: 'barracks_2' };
  for (const fix of ['mix', 'rows']) {
    assert.deepEqual(capture(() => routeFix(fix, { squad })), [['ui:navigateTo', 'base'], ['ui:openSquads', { instanceIndex: 2 }]]);
  }
});

test('heroes navigates to the heroes view only', () => {
  assert.deepEqual(capture(() => routeFix('heroes')), [['ui:navigateTo', 'heroes']]);
});
