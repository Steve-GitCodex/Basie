import { withPage, report, dismissOverlays, clearCitySectors } from './harness.mjs';

const waitGame = (page) => page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });

async function openInfo(page, buildingId, instanceIndex) {
  await page.evaluate(([id, idx]) => window.game.eventBus.emit('ui:openBuildingInfo', { buildingId: id, instanceIndex: idx }), [buildingId, instanceIndex]);
  await page.waitForSelector('#building-info-overlay:not(.hidden) .binfo-table', { timeout: 5000 });
}

const currentRowState = (page) => page.evaluate(() => {
  const wrap = document.querySelector('#binfo-body .binfo-table-wrap');
  const row = wrap.querySelector('.binfo-row--current');
  if (!row) return null;
  const w = wrap.getBoundingClientRect();
  const r = row.getBoundingClientRect();
  return {
    text: row.firstElementChild.textContent,
    visible: r.top >= w.top && r.bottom <= w.bottom,
    scrolls: wrap.scrollHeight > wrap.clientHeight,
    emptyCells: [...wrap.querySelectorAll('tbody td')].filter(td => td.textContent.trim() === '—').length,
  };
});

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=buildingssmoke`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  await dismissOverlays(page);
  await clearCitySectors(page);

  await page.evaluate(() => {
    const emit = (buildingId, level) => window.game.eventBus.emit('ui:devSetBuildingLevel', { buildingId, level });
    emit('townhall', 12);
    emit('barracks', 5);
  });

  const checks = [];

  await openInfo(page, 'townhall');
  const hq = await currentRowState(page);
  checks.push({ label: 'HQ info panel highlights the L12 row', ok: hq?.text === 'Lv.12' });
  checks.push({ label: 'HQ L12 row is scrolled into view inside the table region', ok: !!hq?.visible && hq.scrolls });
  checks.push({ label: 'HQ table has no placeholder effect cells', ok: hq?.emptyCells === 0 });
  const hqRows = await page.locator('#binfo-body .binfo-row').count();
  checks.push({ label: 'HQ table lists every level to maxLevel', ok: hqRows === await page.evaluate(async () => (await import('/js/entities/GAME_DATA.js')).BUILDINGS_CONFIG.townhall.maxLevel) });

  await openInfo(page, 'barracks');
  const label = await page.textContent('#binfo-body .binfo-effect');
  checks.push({ label: 'barracks label names Lv.4 for the 2nd squad slot', ok: /Lv\.4 → 2nd/.test(label) });
  const barracks = await currentRowState(page);
  checks.push({ label: 'barracks current row (L5) highlighted', ok: barracks?.text === 'Lv.5' });

  await openInfo(page, 'infantryhall');
  const hall = await page.textContent('#binfo-body .binfo-table tbody tr:nth-child(4)');
  checks.push({ label: 'trainer hall rows show slots from the table', ok: /2 slots/.test(hall) });

  await page.evaluate(() => {
    const g = window.game;
    g.buildings._buildings.set('house', [{ instanceId: 'house_0', level: 3 }, { instanceId: 'house_1', level: 1 }]);
    g.buildings._buildings.set('bank', [{ instanceId: 'bank_0', level: 1 }]);
    g.resources._population = { current: 7.9, cap: 80 };
  });
  const need = await page.evaluate(async () => (await import('/js/entities/GAME_DATA.js')).BUILDINGS_CONFIG.bank.levelRequirements[2].population);
  const perHouse = await page.evaluate(async () => (await import('/js/entities/GAME_DATA.js')).BUILDINGS_CONFIG.house.populationCapacityPerLevel);
  const housePop = async (idx) => { await openInfo(page, 'house', idx); return (await page.textContent('#binfo-body .binfo-pop')).trim(); };
  checks.push({ label: 'house_0 (L3) shows its own room and the city population', ok: await housePop(0) === `This house: room for ${3 * perHouse} · City population 7 / 80` });
  checks.push({ label: 'house_1 (L1) shows its own room, not house_0 room', ok: await housePop(1) === `This house: room for ${perHouse} · City population 7 / 80` });
  checks.push({ label: 'house_1 panel header and current row use that instance level', ok: (await currentRowState(page))?.text === 'Lv.1' });
  await openInfo(page, 'bank');
  const bankPop = (await page.textContent('#binfo-body .binfo-pop')).trim();
  checks.push({ label: 'bank info panel shows next-level population unmet', ok: bankPop === `City population for Lv.2: 7 / ${need.toLocaleString()} ✗` });
  await openInfo(page, 'farm');
  checks.push({ label: 'non-population building shows no population line', ok: await page.locator('#binfo-body .binfo-pop').count() === 0 });

  report('buildings-smoke', checks, errors);
});
