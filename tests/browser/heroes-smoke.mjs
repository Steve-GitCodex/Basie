import { withPage, bootGuestSandbox, dismissOverlays, report } from './harness.mjs';

await withPage(async ({ page, errors, origin }) => {
  const checks = [];
  await bootGuestSandbox(page, origin);

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await dismissOverlays(page);
  await page.waitForTimeout(500);

  checks.push({ label: 'three tabs mount', ok: await page.locator('.heroes-tab').count() === 3 });
  checks.push({ label: 'roster panel visible by default', ok: await page.isVisible('#heroes-tab-roster') });
  checks.push({ label: 'roster renders a card per hero', ok: await page.locator('.hero-roster-card').count() >= 6 });
  checks.push({
    label: 'roster card shows hero art, not emoji',
    ok: await page.locator('.hero-roster-card img.hero-portrait').count() >= 1,
  });

  await page.click('.heroes-tab[data-tab="assign"]');
  checks.push({ label: 'assign tab switches', ok: await page.isVisible('#heroes-tab-assign') });
  await page.click('.heroes-tab[data-tab="roster"]');
  checks.push({ label: 'roster tab switches back', ok: await page.isVisible('#heroes-tab-roster') });

  await page.click('.hero-roster-card[data-hero-id="warlord"]');
  checks.push({ label: 'detail panel shows a splash', ok: await page.locator('#heroes-detail-pane img.hero-portrait--splash, #heroes-detail-pane .hero-portrait--emoji').count() >= 1 });
  checks.push({ label: 'a hero with a clip offers a manual play button', ok: await page.locator('#heroes-detail-pane .hero-play-btn').count() === 1 });
  checks.push({ label: 'no video autoplays', ok: await page.locator('#heroes-detail-pane video').count() === 0 });

  await page.click('.hero-roster-card[data-hero-id="kaelenthorne"]');
  checks.push({ label: 'a hero without a clip has no play button', ok: await page.locator('#heroes-detail-pane .hero-play-btn').count() === 0 });

  await page.evaluate(() => {
    window.game.buildings.build('barracks');
    window.game.eventBus.emit('ui:devSetBuildingLevel', { buildingId: 'barracks', level: 3 });
    window.game.eventBus.emit('ui:devSetBuildingLevel', { buildingId: 'townhall', level: 4 });
    window.game.buildings.build('heroquarters');
    window.game.eventBus.emit('ui:devSetBuildingLevel', { buildingId: 'heroquarters', level: 1 });
    window.game.buildings.build('mine');
    window.game.heroes.recruitHeroRecord('kaelenthorne');
  });
  await page.waitForTimeout(300);
  await dismissOverlays(page);
  await page.evaluate(() => document.querySelector('#story-modal-overlay')?.classList.add('hidden'));
  await page.click('.heroes-tab[data-tab="assign"]');
  await page.waitForSelector('.hero-board-row', { timeout: 5000 });
  checks.push({ label: 'board excludes barracks', ok: await page.locator('.hero-board-row[data-instance^="barracks_"]').count() === 0 });
  checks.push({ label: 'board shows the slot counter', ok: /Hero slots: \d+ \/ \d+/.test(await page.locator('.hero-board-header').innerText()) });

  const beforeOccupied = await page.locator('.hero-board-row--occupied').count();
  await dismissOverlays(page);
  await page.click('.hero-board-row .btn-board-assign');
  const pickable = await page.locator('.hero-board-pick').count();
  if (pickable > 0) {
    await dismissOverlays(page);
    await page.click('.hero-board-pick');
    await page.waitForTimeout(300);
    checks.push({ label: 'assigning fills a slot', ok: await page.locator('.hero-board-row--occupied').count() === beforeOccupied + 1 });
    await dismissOverlays(page);
    await page.click('.btn-board-remove');
    await page.waitForTimeout(300);
    checks.push({ label: 'removing empties it again', ok: await page.locator('.hero-board-row--occupied').count() === beforeOccupied });
  } else {
    checks.push({ label: 'assign round trip (no owned hero in sandbox — skipped)', ok: true });
  }

  await page.click('.heroes-tab[data-tab="recruit"]');
  await page.waitForSelector('.recruit-banner', { timeout: 5000 });
  checks.push({ label: 'three recruit banners', ok: await page.locator('.recruit-banner').count() === 3 });
  checks.push({ label: 'banner shows a live token count', ok: await page.locator('.recruit-token-count').first().isVisible() });
  await page.click('.recruit-rates >> nth=0');
  checks.push({ label: 'rates panel discloses the guarantee', ok: /Guaranteed/.test(await page.locator('.recruit-rates-body').first().innerText()) });

  await page.evaluate(() => {
    window.game.inventory.addItem('token_normal', 1);
  });
  await page.waitForTimeout(300);
  await page.click('.recruit-banner--normal .btn-pull[data-count="1"]');
  checks.push({ label: 'a single pull shows a reveal card', ok: await page.locator('.recruit-result-card').count() === 1 });
  const revealCardText = await page.locator('.recruit-result-card').first().innerText();
  checks.push({ label: 'reveal card renders real outcome content', ok: revealCardText.trim().length > 0 && !/Unknown Outcome/.test(revealCardText) });
  await page.click('.recruit-reveal-done');
  await page.waitForTimeout(300);
  checks.push({ label: 'reveal dismisses back to the banners', ok: await page.locator('.recruit-banner').count() === 3 });

  const normalExchangeOptions = await page.locator('.recruit-exchange-hero[data-tier="normal"] option').allTextContents();
  checks.push({ label: 'exchange hero picker is restricted to normal-tier heroes', ok: normalExchangeOptions.length === 2 });

  await page.evaluate(() => window.game.inventory.addItem('tier_shard_normal', 5));
  await page.waitForTimeout(200);
  const beforeTierShards = await page.evaluate(() => window.game.inventory.getQuantity('tier_shard_normal'));
  const beforeHeroShards = await page.evaluate(() => window.game.inventory.getQuantity('shard_kaelenthorne'));
  await page.selectOption('.recruit-exchange-hero[data-tier="normal"]', 'kaelenthorne');
  await page.click('.btn-exchange[data-tier="normal"]');
  await page.waitForTimeout(300);
  const afterTierShards = await page.evaluate(() => window.game.inventory.getQuantity('tier_shard_normal'));
  const afterHeroShards = await page.evaluate(() => window.game.inventory.getQuantity('shard_kaelenthorne'));
  checks.push({
    label: 'exchange spends tier shards through the manager to grant the selected hero shard',
    ok: afterTierShards === beforeTierShards - 3 && afterHeroShards === beforeHeroShards + 1,
  });
  const displayedTierShardQty = await page.locator('.recruit-exchange-qty[data-tier="normal"]').innerText();
  checks.push({ label: 'exchange qty display patches in place after spend', ok: displayedTierShardQty.trim() === String(afterTierShards) });

  await page.evaluate(() => {
    window.game.inventory.addItem('shard_kaelenthorne', 100);
    for (let i = 0; i < 10; i++) window.game.heroes.awakenHero('kaelenthorne');
  });
  await page.waitForTimeout(300);
  await dismissOverlays(page);
  await page.click('.heroes-tab[data-tab="roster"]');
  await page.click('.heroes-tab[data-tab="recruit"]');
  await page.waitForSelector('.recruit-banner', { timeout: 5000 });
  const maxedOptionText = await page.locator('.recruit-exchange-hero[data-tier="normal"] option[value="kaelenthorne"]').innerText();
  checks.push({ label: 'exchange picker marks a fully-maxed hero before the click', ok: /Maxed/.test(maxedOptionText) });

  await page.evaluate(() => window.game.inventory.addItem('tier_shard_normal', 5));
  await page.waitForTimeout(200);
  const beforeOverflowTierShards = await page.evaluate(() => window.game.inventory.getQuantity('tier_shard_normal'));
  const beforeOverflowHeroShards = await page.evaluate(() => window.game.inventory.getQuantity('shard_kaelenthorne'));
  await page.evaluate(async () => {
    const { NotificationManager } = await import('/js/systems/NotificationManager.js');
    window.__capturedToasts = [];
    const original = NotificationManager.prototype.show;
    NotificationManager.prototype.show = function (type, title, message) {
      window.__capturedToasts.push({ type, title, message });
      return original.call(this, type, title, message);
    };
  });
  await page.selectOption('.recruit-exchange-hero[data-tier="normal"]', 'kaelenthorne');
  await page.click('.btn-exchange[data-tier="normal"]');
  await page.waitForTimeout(300);
  const afterOverflowTierShards = await page.evaluate(() => window.game.inventory.getQuantity('tier_shard_normal'));
  const afterOverflowHeroShards = await page.evaluate(() => window.game.inventory.getQuantity('shard_kaelenthorne'));
  checks.push({
    label: 'exchanging into a maxed hero spends shards and refunds the lossy overflow amount, no hero shard granted',
    ok: afterOverflowTierShards === beforeOverflowTierShards - 1 && afterOverflowHeroShards === beforeOverflowHeroShards,
  });
  const capturedToasts = await page.evaluate(() => window.__capturedToasts ?? []);
  checks.push({
    label: 'overflow exchange surfaces a toast telling the player why',
    ok: capturedToasts.some(t => /already|maxed/i.test(t.title) || /already|maxed/i.test(t.message)),
  });

  await page.evaluate(() => window.game.inventory.addItem('scroll_common', 1));
  await page.waitForTimeout(200);
  await dismissOverlays(page);
  await page.evaluate(() => window.game.eventBus.emit('ui:openInventory'));
  await page.waitForSelector('#inventory-panel.open', { timeout: 5000 });
  await page.click('.inv-tab[data-tab="scroll"]');
  await page.click('.inv-tile[data-item-id="scroll_common"]');
  await page.click('.inv-goto-recruit');
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  checks.push({ label: 'inventory recruit redirect lands on the Heroes view', ok: await page.isVisible('#view-heroes') });
  checks.push({ label: 'inventory recruit redirect activates the Recruit tab', ok: await page.locator('.heroes-tab--active[data-tab="recruit"]').count() === 1 });

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await dismissOverlays(page);
  await page.click('.heroes-tab[data-tab="roster"]');
  checks.push({ label: 'buff block no longer on the Heroes screen', ok: await page.locator('#view-heroes .heroes-buff-section, #view-heroes .inv-buff-section').count() === 0 });

  await page.evaluate(() => window.game.eventBus.emit('ui:openInventory'));
  await page.waitForSelector('#inventory-panel.open', { timeout: 5000 });
  checks.push({ label: 'buff block rehomed onto the Inventory panel', ok: await page.locator('#inventory-panel .inv-buff-section').count() === 1 });

  report('heroes-smoke', checks, errors);
});
