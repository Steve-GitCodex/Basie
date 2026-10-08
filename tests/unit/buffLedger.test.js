import test from 'node:test';
import assert from 'node:assert/strict';
import { collect, timedEntries, statTotals } from '../../js/systems/buffs/buffLedger.js';
import { BUFF_STATS } from '../../js/entities/GAME_DATA.js';

const baseSnapshot = (overrides = {}) => ({
  boosts: [], worldBuffs: [], techBonuses: {}, vipPerks: {}, vipTier: 0, hqLevel: 1, hqBenefits: {},
  heroEffects: {}, activeEvent: null, rateBreakdowns: {}, regionNames: {}, poiNames: {}, itemNames: {},
  ...overrides,
});

test('production stat total equals the rate breakdown multiplier', () => {
  const snap = baseSnapshot({ rateBreakdowns: { wood: { base: 20, layers: [], multiplier: 2.0925 } } });
  const totals = statTotals(collect(snap), snap.rateBreakdowns);
  assert.ok(Math.abs(totals['production.wood'].effectivePct - 1.0925) < 1e-9);
});

test('production.all entries are listed under every resource stat', () => {
  const snap = baseSnapshot({ hqBenefits: { productionBonus: 0.05 } });
  const totals = statTotals(collect(snap), snap.rateBreakdowns);
  for (const r of ['wood', 'stone', 'iron', 'food', 'water', 'money'])
    assert.ok(totals[`production.${r}`].entries.some(e => e.sourceKind === 'hq'), r);
});

test('production total without a breakdown falls back to the additive sum incl. production.all', () => {
  const snap = baseSnapshot({ hqBenefits: { productionBonus: 0.05 }, techBonuses: { woodBonus: 0.1 } });
  const totals = statTotals(collect(snap), {});
  assert.ok(Math.abs(totals['production.wood'].effectivePct - 0.15) < 1e-9);
});

test('non-production totals are additive sums', () => {
  const snap = baseSnapshot({ techBonuses: { attackBonus: 0.08 }, hqBenefits: { attackBonus: 0.04 } });
  assert.ok(Math.abs(statTotals(collect(snap), {})['troop.attack'].effectivePct - 0.12) < 1e-9);
});

test('every catalogue stat is present even at zero', () => {
  const totals = statTotals([], {});
  for (const id of Object.keys(BUFF_STATS)) assert.ok(totals[id], id);
  assert.equal(totals['gather.load'].effectivePct, 0);
});

test('timedEntries sorts by endsAt and excludes standing', () => {
  const t = timedEntries([{ endsAt: 30 }, { endsAt: null }, { endsAt: 10 }]);
  assert.deepEqual(t.map(e => e.endsAt), [10, 30]);
});

test('collect tolerates an empty snapshot', () => {
  assert.deepEqual(collect({}), []);
  assert.deepEqual(collect(baseSnapshot()), []);
});
