import test from 'node:test';
import assert from 'node:assert/strict';

import { populationInfo, populationInfoHtml } from '../../js/ui/buildings/populationInfo.js';
import { BUILDINGS_CONFIG } from '../../js/entities/GAME_DATA.js';

const bank = BUILDINGS_CONFIG.bank;
const nextNeed = level => bank.levelRequirements[level + 1].population;

test('house shows its own room and the city current over cap with the current floored', () => {
  const per = BUILDINGS_CONFIG.house.populationCapacityPerLevel;
  const info = populationInfo('house', BUILDINGS_CONFIG.house, 3, { current: 41.9, cap: 60 });
  assert.equal(info.text, `This house: room for ${3 * per} · City population 41 / 60`);
  assert.equal(info.met, true);
});

test('bank shows the next-level population requirement as unmet', () => {
  const need = nextNeed(1);
  const info = populationInfo('bank', bank, 1, { current: need - 1, cap: 999 });
  assert.ok(info.text.includes(`City population for Lv.2: ${need - 1} / ${need} ✗`));
  assert.equal(info.met, false);
});

test('bank requirement is met at exactly the needed population', () => {
  const need = nextNeed(1);
  const info = populationInfo('bank', bank, 1, { current: need, cap: 999 });
  assert.match(info.text, /✓/);
  assert.equal(info.met, true);
});

test('bank at max level and other buildings show nothing', () => {
  assert.equal(populationInfo('bank', bank, bank.maxLevel, { current: 5, cap: 5 }), null);
  assert.equal(populationInfo('farm', BUILDINGS_CONFIG.farm, 1, { current: 5, cap: 5 }), null);
  assert.equal(populationInfoHtml(null), '');
});

test('unmet requirement renders the warn modifier', () => {
  assert.match(populationInfoHtml({ text: 'x', met: false }), /binfo-pop--warn/);
  assert.doesNotMatch(populationInfoHtml({ text: 'x', met: true }), /warn/);
});

test("house room follows that house's own level, not the city total", () => {
  const per = BUILDINGS_CONFIG.house.populationCapacityPerLevel;
  const city = { current: 50, cap: 200 };
  const low = populationInfo('house', BUILDINGS_CONFIG.house, 1, city);
  const high = populationInfo('house', BUILDINGS_CONFIG.house, 5, city);
  assert.ok(low.text.startsWith(`This house: room for ${per} `));
  assert.ok(high.text.startsWith(`This house: room for ${5 * per} `));
});
