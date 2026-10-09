import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevelUpCoalescer } from '../../js/ui/heroes/levelUpCoalescer.js';

const harness = () => {
  const out = [];
  const queue = [];
  const record = createLevelUpCoalescer(b => out.push(b), fn => queue.push(fn));
  return { out, record, drain: () => queue.splice(0).forEach(fn => fn()) };
};

test('a burst of level-ups for one hero flushes once as from -> to', () => {
  const { out, record, drain } = harness();
  for (const level of [13, 14, 15]) record({ heroId: 'w', name: 'Warlord', level });
  assert.equal(out.length, 0);
  drain();
  assert.deepEqual(out, [{ name: 'Warlord', from: 12, to: 15 }]);
});

test('different heroes flush separately and a later burst starts fresh', () => {
  const { out, record, drain } = harness();
  record({ heroId: 'a', name: 'A', level: 5 });
  record({ heroId: 'b', name: 'B', level: 9 });
  drain();
  record({ heroId: 'a', name: 'A', level: 6 });
  drain();
  assert.deepEqual(out.map(o => [o.name, o.from, o.to]), [['A', 4, 5], ['B', 8, 9], ['A', 5, 6]]);
});
