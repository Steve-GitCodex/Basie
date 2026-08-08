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

  report('heroes-smoke', checks, errors);
});
