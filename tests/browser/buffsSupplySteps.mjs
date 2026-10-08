export async function supplyUsePromptsOnRunningBoost(page) {
  await page.evaluate(() => {
    window.game.inventory.addItem('buff_prod_sm', 1);
    window.game.eventBus.emit('ui:openTradingTab', { tab: 'supply', category: 'boosts' });
  });
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => window.game.buffs.getBoosts().map(b => b.endsAt));
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('.tp-supply__grid .tp-card__use[data-item-id="buff_prod_sm"]');
    btn?.click();
    return !!btn;
  });
  await page.waitForTimeout(250);
  const prompted = await page.evaluate(() => {
    const dlg = document.querySelector('.buff-confirm');
    if (!dlg) return false;
    const r = dlg.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && dlg.contains(hit);
  });
  if (prompted) await page.click('.buff-confirm [data-answer="keep"]');
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => window.game.buffs.getBoosts().map(b => b.endsAt));
  const kept = before.length === 1 && JSON.stringify(before) === JSON.stringify(after);
  return { clicked, prompted, kept };
}
