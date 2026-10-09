const stockOf = (page) => page.evaluate(() => window.game.buildings.getCafeteriaStock()[0].stock);

export const cafeteriaChecks = async (page) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('buffs-panel-overlay')?.classList.remove('open'));
  await page.evaluate(() => {
    const g = window.game;
    g.buildings._buildings.set('cafeteria', [{ instanceId: 'cafeteria_0', level: 1, stock: { food: 30, water: 80 } }]);
    g.resources.setCapFloors?.({});
    for (const key of ['food', 'water']) { g.resources.setCap(key, 50000); g.resources._resources[key].amount = 40000; }
    g.eventBus.emit('resources:ratesChanged', g.resources.getSnapshot());
  });
  await page.waitForTimeout(400);
  const out = [];
  out.push({ label: 'cafeteria chip shows', ok: await page.evaluate(() => document.getElementById('res-cafeteria').offsetParent !== null) });

  await page.mouse.move(5, 400);
  await page.hover('#res-cafeteria');
  const tip = await page.waitForFunction(() => document.getElementById('game-tooltip')?.classList.contains('visible'), null, { timeout: 1500 }).then(() => true, () => false);
  const tipText = await page.evaluate(() => document.getElementById('game-tooltip').textContent);
  out.push({ label: 'cafeteria tooltip on hover @1280', ok: tip && tipText.includes('Cafeteria supplies') && tipText.includes('Food') && tipText.includes('Water') });
  await page.mouse.move(5, 400);

  await page.click('#res-cafeteria');
  const text = await page.evaluate(() => document.querySelector('.chip-popover')?.textContent ?? '');
  out.push({ label: 'cafeteria popover', ok: text.includes('Cafeteria') && text.includes('Food') && text.includes('Water') && text.includes('Restock') });

  out.push({ label: 'cafeteria popover hides Empty in without consumers', ok: !/Infinity|NaN|Empty in/.test(await page.evaluate(() => [...document.querySelectorAll('.chip-popover .chip-popover__row')].filter((r) => r.offsetParent !== null).map((r) => r.textContent).join('|'))) });
  await page.mouse.move(5, 400);
  await page.hover('#res-cafeteria');
  await page.waitForTimeout(300);
  out.push({ label: 'tooltip stays hidden over open popover @1280', ok: !(await page.evaluate(() => document.getElementById('game-tooltip').classList.contains('visible'))) });
  await page.evaluate(() => {
    const s = window.game.buildings._buildings.get('cafeteria')[0].stock;
    s.food = 0;
    s.water = 0;
  });
  await page.click('[data-pop="restock"]');
  const cap = await page.evaluate(() => window.game.buildings.getCafeteriaStock()[0].stockCap);
  const filled = await stockOf(page);
  const shown = await page.evaluate(() => document.querySelector('.chip-popover [data-part="food"]').textContent);
  out.push({ label: 'cafeteria restock fills', ok: filled.food === cap.food && filled.water === cap.water && shown.startsWith(cap.food.toLocaleString()) });

  await page.click('[data-pop="restock"]');
  const msg = await page.evaluate(() => document.querySelector('.chip-popover [data-part="msg"]').textContent);
  out.push({ label: 'cafeteria restock failure message', ok: msg.length > 0 });
  await page.keyboard.press('Escape');
  return out;
};

export const sixCellChecks = async (page) => {
  const out = [];
  for (const width of [360, 701]) {
    await page.setViewportSize({ width, height: 640 });
    await page.evaluate(() => {
      const g = window.game;
      const amounts = { wood: 48200, stone: 120000, food: 2410000, iron: 48200, water: 120000 };
      g.resources.setCapFloors?.({});
      for (const [key, amount] of Object.entries(amounts)) { g.resources.setCap(key, 3000000); g.resources._resources[key].amount = amount; }
      g.eventBus.emit('resources:ratesChanged', g.resources.getSnapshot());
    });
    await page.waitForTimeout(700);
    const fit = await page.evaluate(() => {
      const values = [...document.querySelectorAll('#resource-bar .res-value')].filter((el) => el.offsetParent !== null);
      return values.length === 6 && values.every((el) => el.scrollWidth <= el.clientWidth);
    });
    out.push({ label: `six cells values fit @${width}`, ok: fit });
  }
  return out;
};
