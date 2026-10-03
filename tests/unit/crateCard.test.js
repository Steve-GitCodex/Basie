import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus } from '../../js/core/EventBus.js';

function fakeElement() {
  const nodes = {};
  return {
    className: '',
    classList: { toggle() {} },
    set innerHTML(_) {
      nodes['.tp-crate__timer'] = { textContent: '' };
      nodes['.tp-crate__claim'] = { disabled: false, textContent: 'Claim', addEventListener() {} };
    },
    querySelector: (sel) => nodes[sel],
  };
}

globalThis.document = { createElement: fakeElement };
const { CrateCard } = await import('../../js/ui/trading/CrateCard.js');

test('midnight flip re-enables Claim on tick:ui and refreshes the dots', () => {
  let ready = false;
  const shop = { crateStatus: () => ({ ready, msUntilReset: 5000 }), claimCrate: () => ({ success: false }) };
  const card = new CrateCard(shop);
  const refreshes = [];
  const off = eventBus.on('tradingpost:refreshDots', () => refreshes.push(1));
  card.start();
  const claim = card.el.querySelector('.tp-crate__claim');
  assert.equal(claim.disabled, true);
  assert.match(card.el.querySelector('.tp-crate__timer').textContent, /^Resets in 00:00:05$/);
  const before = refreshes.length;
  ready = true;
  eventBus.emit('tick:ui');
  assert.equal(claim.disabled, false);
  assert.equal(refreshes.length, before + 1);
  card.stop();
  off();
});
