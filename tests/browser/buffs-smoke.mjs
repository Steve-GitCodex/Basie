import { supplyUsePromptsOnRunningBoost } from './buffsSupplySteps.mjs';
import { withPage, report, dismissOverlays } from './harness.mjs';

const waitGame = (page) => page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=buffssmoke`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  await dismissOverlays(page);

  await page.evaluate(() => {
    window.__toasts = [];
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) {
        if (n.classList?.contains('toast')) window.__toasts.push(n.textContent);
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

  const hasClass = (sel, cls) => page.evaluate(([s, c]) => !!document.querySelector(s)?.classList.contains(c), [sel, cls]);
  const runningCount = () => page.evaluate(() => document.querySelectorAll('.buff-row--live').length);

  const badgeIdle = await page.evaluate(() => {
    const el = document.getElementById('buff-hud-badge');
    return !!el && el.offsetParent !== null && el.classList.contains('buff-hud-badge--idle');
  });

  await page.click('#buff-hud-badge');
  await page.click('[data-pop="buffs"]');
  await page.waitForTimeout(200);
  const panelOpen = await hasClass('#buffs-panel', 'open');

  await page.evaluate(() => window.game.inventory.addItem('buff_prod_sm', 2));
  await page.waitForTimeout(200);
  await page.click('.buff-row--empty [data-use-item="buff_prod_sm"]');
  await page.waitForTimeout(300);
  const afterBoost = { rows: await runningCount(), active: await hasClass('#buff-hud-badge', 'buff-hud-badge--active') };

  await page.evaluate(() => {
    const row = document.querySelector('.buff-row--live');
    window.__row = row;
    window.__label = row.querySelector('.progress-time-label').textContent;
  });
  await page.waitForFunction(() => document.querySelector(".buff-row--live .progress-time-label")?.textContent !== window.__label, null, { timeout: 4000 }).catch(() => {});
  const ticked = await page.evaluate(() => {
    const row = document.querySelector('.buff-row--live');
    return {
      same: row.isSameNode(window.__row),
      before: window.__label,
      after: row.querySelector('.progress-time-label').textContent,
    };
  });

  await page.evaluate(async () => {
    const { activateBoostItem } = await import('/js/ui/buffs/confirmReplace.js');
    const g = window.game;
    activateBoostItem({ buffs: g.buffs, inventory: g.inventory }, 'buff_prod_sm');
  });
  await page.waitForTimeout(200);
  const confirmInfo = await page.evaluate(() => {
    const dlg = document.querySelector('.buff-confirm');
    if (!dlg) return null;
    const r = dlg.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      z: Number(getComputedStyle(dlg).zIndex),
      overlayZ: Number(getComputedStyle(document.getElementById('modal-overlay')).zIndex) || 0,
      hit: !!hit && dlg.contains(hit),
    };
  });
  await page.click('.buff-confirm [data-answer="replace"]');
  await page.waitForTimeout(300);
  const afterReplace = { rows: await runningCount(), confirmGone: !(await page.$('.buff-confirm')) };

  const supply = await supplyUsePromptsOnRunningBoost(page);

  await page.evaluate(() => window.game.worldMap.grantTimedBuff({ flavor: 'logistic', pct: 0.1, durationMs: 1500 }));
  await page.waitForTimeout(300);
  const worldRow = await page.evaluate(() =>
    [...document.querySelectorAll('.buff-row--live')].some(r => r.querySelector('.buff-row__tag')?.textContent === 'Expedition'));

  await page.waitForTimeout(2500);
  const expired = await runningCount();
  const marchToast = await page.waitForFunction(
    () => window.__toasts.some(t => /buff expired[\s\S]*march speed/i.test(t)), null, { timeout: 90_000 },
  ).then(() => true, () => false);

  await page.click('.buffs-tab[data-tab="overview"]');
  await page.waitForTimeout(200);
  const wood = await page.evaluate(() => ({
    text: document.querySelector('[data-stat-toggle="production.wood"] .buff-stat__total')?.textContent.trim(),
    pct: Math.round((window.game.resources.getRateBreakdown('wood').multiplier - 1) * 100),
  }));
  const expectedWood = wood.pct === 0 ? '—' : wood.pct > 0 ? `+${wood.pct}%` : `−${Math.abs(wood.pct)}%`;

  await page.click('[data-stat-toggle="production.wood"]');
  await page.evaluate(() => window.game.eventBus.emit('buffs:changed'));
  await page.waitForTimeout(300);
  const stillOpen = await page.evaluate(() =>
    document.querySelector('[data-stat-toggle="production.wood"]')?.getAttribute('aria-expanded') === 'true');

  report('buffs-smoke', [
    { label: 'badge idle at boot', ok: badgeIdle },
    { label: 'badge opens panel', ok: panelOpen },
    { label: `boost adds running row (rows ${afterBoost.rows}, active ${afterBoost.active})`, ok: afterBoost.rows === 1 && afterBoost.active },
    { label: `timer ticks in place (${ticked.before} -> ${ticked.after})`, ok: ticked.same && ticked.before !== ticked.after },
    { label: `replace prompts above #modal-overlay and keeps one row (${JSON.stringify(confirmInfo)}, rows ${afterReplace.rows})`,
      ok: !!confirmInfo && confirmInfo.z > confirmInfo.overlayZ && confirmInfo.hit && afterReplace.confirmGone && afterReplace.rows === 1 },
    { label: `supply Use with a running boost prompts; Keep leaves the original (${JSON.stringify(supply)})`, ok: supply.clicked && supply.prompted && supply.kept },
    { label: 'world timed buff appears with Expedition tag', ok: worldRow },
    { label: `world timed buff expires (rows ${expired}) with march speed toast`, ok: expired === 1 && marchToast },
    { label: `overview wood equals real rate (${wood.text} vs ${expectedWood})`, ok: wood.text === expectedWood },
    { label: 'expanded row survives re-render', ok: stillOpen },
  ], errors);
});
