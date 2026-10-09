import test from 'node:test';
import assert from 'node:assert/strict';

import { buffPopoverModel, buffPopoverHtml, MAX_ROWS } from '../../js/ui/buffs/buffPopover.js';

const NOW = 1_000_000;
const buff = (id, secs, pct = 0.25) =>
  ({ sourceKind: 'item', sourceId: id, label: `Boost ${id}`, stat: 'production.wood', pct, startedAt: NOW - 1000, endsAt: NOW + secs * 1000 });

test('rows keep the given order and drop expired entries', () => {
  const model = buffPopoverModel([buff('a', 30), buff('gone', -5), buff('b', 90)], NOW);
  assert.deepEqual(model.rows.map(r => r.name), ['Boost a', 'Boost b']);
  assert.equal(model.rows[0].remaining, '30s');
  assert.equal(model.rows[1].remaining, '1m 30s');
  assert.equal(model.more, 0);
});

test('row carries name, effect and remaining time', () => {
  const [row] = buffPopoverModel([buff('a', 30)], NOW).rows;
  assert.equal(row.name, 'Boost a');
  assert.match(row.effect, /^\+25%/);
});

test('rows cap at five and the rest becomes +N more', () => {
  const entries = Array.from({ length: 8 }, (_, i) => buff(`b${i}`, 10 + i));
  const model = buffPopoverModel(entries, NOW);
  assert.equal(model.rows.length, MAX_ROWS);
  assert.equal(model.more, 3);
  assert.match(buffPopoverHtml(model), /\+3 more/);
});

test('empty state shows No active buffs and still offers Open buffs', () => {
  const model = buffPopoverModel([buff('gone', -1)], NOW);
  assert.equal(model.rows.length, 0);
  const html = buffPopoverHtml(model);
  assert.match(html, /No active buffs/);
  assert.match(html, /data-pop="buffs"/);
  assert.match(html, /Active buffs/);
});

test('signature changes when the live set changes, not as time passes', () => {
  const entries = [buff('a', 30), buff('b', 90)];
  const first = buffPopoverModel(entries, NOW).signature;
  assert.equal(buffPopoverModel(entries, NOW + 10_000).signature, first);
  assert.notEqual(buffPopoverModel(entries, NOW + 40_000).signature, first);
});
