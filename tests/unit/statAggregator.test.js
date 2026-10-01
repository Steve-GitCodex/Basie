import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregate, statEntry, mergeMaxBySource } from '../../js/systems/stats/statAggregator.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;
const hero = (v, id = 'h') => statEntry('lossReduction', 'hero', v, id);
const tech = (v) => statEntry('lossReduction', 'tech', v, 'tech');

test('a single entry below its cap passes through unchanged', () => {
  assert.ok(near(aggregate('lossReduction', [hero(0.2)]).total, 0.2));
});
test('softcap: two 0.30 hero entries under a 0.60 cap give 0.45', () => {
  assert.ok(near(aggregate('lossReduction', [hero(0.3, 'a'), hero(0.3, 'b')]).total, 0.45));
});
test('softcap never exceeds the category cap however much is stacked', () => {
  const r = aggregate('lossReduction', Array.from({ length: 8 }, (_, i) => hero(0.5, `h${i}`)));
  assert.ok(r.byCategory.hero.value <= 0.60 + 1e-12);
  assert.equal(r.byCategory.hero.cap, 0.60);
});
test('every extra hero entry still adds something below the cap', () => {
  const two = aggregate('lossReduction', [hero(0.2, 'a'), hero(0.2, 'b')]).total;
  const three = aggregate('lossReduction', [hero(0.2, 'a'), hero(0.2, 'b'), hero(0.2, 'c')]).total;
  assert.ok(three > two);
});
test('categories combine diminishingly: hero 0.45 + tech 0.15 = 0.5325', () => {
  assert.ok(near(aggregate('lossReduction', [hero(0.45), tech(0.15)]).total, 0.5325));
});
test('totalCap binds when combined categories would exceed it', () => {
  const rules = { x: { categories: { a: { stacking: 'additive', cap: 1 }, b: { stacking: 'additive', cap: 1 } }, totalCap: 0.9 } };
  const r = aggregate('x', [statEntry('x', 'a', 0.8, 'a'), statEntry('x', 'b', 0.8, 'b')], rules);
  assert.equal(r.total, 0.9);
});
test('diminishing stacking is 1 − Π(1 − v), then the category cap', () => {
  const rules = { x: { categories: { a: { stacking: 'diminishing', cap: 0.5 } }, totalCap: 1 } };
  assert.ok(near(aggregate('x', [statEntry('x', 'a', 0.2, '1'), statEntry('x', 'a', 0.2, '2')], rules).total, 0.36));
});
test('negative, NaN and missing values contribute nothing', () => {
  assert.equal(aggregate('lossReduction', [hero(-0.3), hero(NaN), hero(undefined)]).total, 0);
});
test('no entries → total 0', () => { assert.equal(aggregate('lossReduction', []).total, 0); });
test('byCategory lists every category in the rule, 0 when empty', () => {
  const r = aggregate('lossReduction', [hero(0.2)]);
  assert.deepEqual(Object.keys(r.byCategory), ['hero', 'tech']);
  assert.equal(r.byCategory.tech.value, 0);
});
test('statEntry returns the plain entry object', () => {
  assert.deepEqual(statEntry('s', 'c', 1, 'id'), { stat: 's', category: 'c', value: 1, sourceId: 'id' });
});
test('an unknown stat throws', () => { assert.throws(() => aggregate('nope', []), /nope/); });
test('an entry in a category the stat has no rule for throws', () => {
  assert.throws(() => aggregate('lossReduction', [statEntry('lossReduction', 'vehicle', 0.1, 'v')]), /vehicle/);
});
test('mergeMaxBySource keeps the larger value per sourceId', () => {
  const m = new Map();
  mergeMaxBySource(m, [hero(0.1, 'a'), hero(0.3, 'b')]);
  mergeMaxBySource(m, [hero(0.2, 'a'), hero(0.1, 'b')]);
  assert.deepEqual([...m.values()].map(e => [e.sourceId, e.value]), [['a', 0.2], ['b', 0.3]]);
});

test('a single softcap entry passes through exactly', () => {
  assert.equal(aggregate('lossReduction', [hero(0.08)]).total, 0.08);
});
