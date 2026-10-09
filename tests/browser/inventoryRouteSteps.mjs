const openInventory = async (page) => {
  await page.click('#btn-inventory');
  await page.waitForSelector('#inv-root', { timeout: 5000 });
};

const activeView = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[id^="view-"]')].find(v => !v.classList.contains('hidden'))?.id ?? null);

const detailHeroName = (page) => page.evaluate(() =>
  document.querySelector('.hq-detail__name')?.textContent?.trim() ?? '');

export const inventoryRouteChecks = async (page) => {
  const out = [];
  await page.evaluate(() => {
    const { inventory, heroes, eventBus } = window.game;
    inventory._items.clear();
    inventory.addItem('xpcard_normal', 2);
    inventory.addItem('fragment_warlord', 3);
    heroes.recruitHeroRecord('warlord');
    eventBus.emit('ui:navigateTo', 'base');
  });
  await page.waitForTimeout(200);

  await openInventory(page);
  await page.click('.inv-rail__tab[data-tab="heroes"]');
  await page.click('.inv-tile[data-item-id="xpcard_normal"]');
  const xpCard = await page.evaluate(() => ({
    chips: document.querySelectorAll('.inv-hero-chip').length,
    button: document.querySelector('[data-act="goto-heroes"]')?.textContent.trim() ?? '',
    qty: !!document.querySelector('.inv-qty__slider'),
  }));
  await page.click('[data-act="goto-heroes"]');
  await page.waitForTimeout(300);
  out.push({
    label: 'xp card shows level a hero',
    ok: xpCard.chips === 0 && /Level a hero/.test(xpCard.button) && !xpCard.qty
      && await activeView(page) === 'view-heroes' && await page.locator('#inv-root').count() === 0,
  });

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'base'));
  await openInventory(page);
  await page.click('.inv-rail__tab[data-tab="heroes"]');
  await page.click('.inv-tile[data-item-id="fragment_warlord"]');
  const target = await page.evaluate(() => {
    const b = document.querySelector('[data-act="goto-hero"]');
    return { text: b?.textContent.trim() ?? '', hero: b?.dataset.hero ?? '' };
  });
  await page.click('[data-act="goto-hero"]');
  await page.waitForTimeout(300);
  const name = await page.evaluate(() => window.game.heroes.getRosterWithState().find(h => h.id === 'warlord')?.name ?? '');
  out.push({
    label: 'fragment opens its hero',
    ok: target.hero === 'warlord' && target.text.includes(name) && await activeView(page) === 'view-heroes'
      && (await detailHeroName(page)).includes(name) && await page.locator('#inv-root').count() === 0,
  });
  return out;
};

export const tradingRouteChecks = async (page) => {
  await page.evaluate(() => {
    window.game.inventory.addItem('xp_bundle_small', 1);
    window.game.eventBus.emit('ui:navigateTo', 'economy');
  });
  const clicked = await page.evaluate(async () => {
    for (const category of ['boosts', 'heroes', 'speedups', 'resources', 'other']) {
      window.game.eventBus.emit('ui:openTradingTab', { tab: 'supply', category });
      await new Promise(r => setTimeout(r, 150));
      const btn = document.querySelector('.tp-card__use[data-item-id="xp_bundle_small"]');
      if (btn) { btn.click(); return true; }
    }
    return false;
  });
  await page.waitForTimeout(300);
  return {
    label: 'use xp card routes to heroes',
    ok: clicked && await activeView(page) === 'view-heroes' && await page.locator('#inv-root').count() === 0,
  };
};
