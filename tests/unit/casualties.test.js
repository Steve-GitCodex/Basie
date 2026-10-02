import test from 'node:test';
import assert from 'node:assert/strict';

import { splitCasualties } from '../../js/systems/combat/casualties.js';

const base = { lossReduction: 0, postBattleHeal: 0 };

test('victory wounds 40% of fallen', () => {
  const out = splitCasualties({ ...base, fallen: { a: 100 }, victory: true });
  assert.deepEqual(out, { healed: {}, wounded: { a: 40 }, dead: { a: 60 } });
});

test('defeat wounds 20% of fallen', () => {
  const out = splitCasualties({ ...base, fallen: { a: 100 }, victory: false });
  assert.equal(out.wounded.a, 20);
  assert.equal(out.dead.a, 80);
});

test('lossReduction moves dead into wounded', () => {
  const out = splitCasualties({ ...base, fallen: { a: 100 }, victory: true, lossReduction: 0.5 });
  assert.equal(out.wounded.a, 70);
  assert.equal(out.dead.a, 30);
});

test('postBattleHeal returns fallen on victory only', () => {
  const won = splitCasualties({ ...base, fallen: { a: 100 }, victory: true, postBattleHeal: 0.1 });
  assert.equal(won.healed.a, 10);
  assert.equal(won.wounded.a + won.dead.a, 90);
  const lost = splitCasualties({ ...base, fallen: { a: 100 }, victory: false, postBattleHeal: 0.1 });
  assert.deepEqual(lost.healed, {});
  assert.equal(lost.wounded.a + lost.dead.a, 100);
});

test('zero fallen produces empty maps', () => {
  const out = splitCasualties({ ...base, fallen: { a: 0 }, victory: true });
  assert.deepEqual(out, { healed: {}, wounded: {}, dead: {} });
});
