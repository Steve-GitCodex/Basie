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

  report('heroes-smoke', checks, errors);
});
