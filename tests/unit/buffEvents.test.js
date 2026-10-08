import test from 'node:test';
import assert from 'node:assert/strict';
import { eventBus } from '../../js/core/EventBus.js';
import { rateSignature, subscribeBuffRefresh, BUFF_RATES_EVENT } from '../../js/ui/buffs/buffEvents.js';

test('rateSignature is stable for equal multipliers and changes when one moves', () => {
  const get = m => r => ({ multiplier: m[r] ?? 1 });
  assert.equal(rateSignature(get({ wood: 1.1 })), rateSignature(get({ wood: 1.1 })));
  assert.notEqual(rateSignature(get({ wood: 1.1 })), rateSignature(get({ wood: 1.2 })));
  assert.equal(rateSignature(undefined), rateSignature(() => ({ multiplier: 1 })));
});

test('ratesChanged only refreshes when a layer multiplier changed', () => {
  const mult = { wood: 1 };
  const systems = { rm: { getRateBreakdown: r => ({ multiplier: mult[r] ?? 1 }) } };
  let calls = 0;
  subscribeBuffRefresh(systems, () => { calls++; });
  for (let i = 0; i < 5; i++) eventBus.emit(BUFF_RATES_EVENT);
  assert.equal(calls, 0, 'population churn must not refresh');
  mult.wood = 1.25;
  eventBus.emit(BUFF_RATES_EVENT);
  eventBus.emit(BUFF_RATES_EVENT);
  assert.equal(calls, 1);
  eventBus.emit('buffs:changed');
  assert.equal(calls, 2, 'other events stay unconditional');
});
