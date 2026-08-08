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

  report('heroes-smoke', checks, errors);
});
