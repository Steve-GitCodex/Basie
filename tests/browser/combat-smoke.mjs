import { withPage, report } from './harness.mjs';

const waitGame = (page) => page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=combatsmoke`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);

  const setup = await page.evaluate(() => {
    const um = window.game.units;
    for (const s of um.getSquads()) um.deleteSquad(s.id);
    window.game.eventBus.emit('ui:openSquads', { instanceIndex: 0 });
    const squad = um.getSquads().find(s => s.barracksInstanceId === 'barracks_0');
    if (!squad) return { ok: false };
    um._reserve.set('infantry_t1', 30);
    const res = um.assignToSquad(squad.id, 'infantry', 30, 1, 0);
    um.linkSlotUnit(squad.id, 0, 'infantry');
    return { ok: res.success, squadId: squad.id };
  });

  await page.waitForSelector('.sq-tile .slot-row-toggle', { timeout: 5000 });
  const rowBtn = (row) => page.locator(`.sq-tile >> nth=0 >> .slot-row-toggle__btn[data-row="${row}"]`);
  const frontBefore = await rowBtn('front').getAttribute('aria-pressed');
  await rowBtn('back').click();
  const backAfterClick = await rowBtn('back').getAttribute('aria-pressed');
  const woundedChip = await page.locator('.sq-stat--wounded').count();

  await page.waitForTimeout(300);
  await page.evaluate(() => window.game.save());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  const rowAfterReload = await page.evaluate((id) => window.game.units.getSlotRow(id, 0), setup.squadId);
  await page.evaluate(() => window.game.eventBus.emit('ui:openSquads', { instanceIndex: 0 }));
  await page.waitForSelector('.sq-tile .slot-row-toggle', { timeout: 5000 });
  const backPressedAfterReload = await rowBtn('back').getAttribute('aria-pressed');
  await page.evaluate(() => document.querySelector('#squad-panel .sq-close')?.click());

  const before = await page.evaluate((id) => window.game.units.getSquad(id).units.reduce((n, u) => n + u.count, 0), setup.squadId);
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'combat'));
  await page.waitForSelector('.campaign-node.available', { timeout: 5000 });
  await page.evaluate(() => document.querySelector('.campaign-node.available').click());
  await page.waitForSelector('#btn-campaign-attack', { state: 'attached' });
  const badge = await page.locator('#readiness-badge-area').textContent();
  await page.evaluate(() => document.querySelector('#btn-campaign-attack').click());
  await page.waitForTimeout(500);
  if (await page.locator('#btn-warn-proceed').count()) await page.locator('#btn-warn-proceed').click();
  await page.waitForSelector('#btn-battle-skip', { timeout: 5000 });
  await page.locator('#btn-battle-skip').click();
  const resultShown = await page.waitForSelector('#battle-result-area .battle-result', { timeout: 10_000 }).then(() => true, () => false);
  await page.waitForSelector('#btn-battle-close', { timeout: 10_000 });

  const after = await page.evaluate((id) => {
    const sum = (m) => Object.values(m ?? {}).reduce((a, b) => a + b, 0);
    const entry = window.game.combat.getBattleLog()[0];
    const wounded = window.game.units.getWounded();
    return {
      count: window.game.units.getSquad(id).units.reduce((n, u) => n + u.count, 0),
      dead: sum(entry?.dead), woundedEntry: sum(entry?.wounded),
      woundedPool: sum(wounded), hasSeed: entry?.seed != null, hasRules: entry?.rulesVersion != null,
    };
  }, setup.squadId);
  const resultText = await page.locator('#battle-result-area').textContent();

  report('combat', [
    { label: 'squad slot 0 seeded with units', ok: setup.ok && before === 30 },
    { label: 'slot 0 starts on the front row', ok: frontBefore === 'true' },
    { label: 'clicking Back selects Back', ok: backAfterClick === 'true' },
    { label: 'wounded chip is shown in the squad modal', ok: woundedChip === 1 },
    { label: 'slot row is still back after reload (state)', ok: rowAfterReload === 'back' },
    { label: 'slot row is still back after reload (UI)', ok: backPressedAfterReload === 'true' },
    { label: 'estimate badge shows a win percentage', ok: /~\d+%/.test(badge) },
    { label: 'battle result renders', ok: resultShown && resultText.trim().length > 0 },
    { label: 'battle log entry carries seed and rulesVersion', ok: after.hasSeed && after.hasRules },
    { label: 'battle produced casualties', ok: after.dead + after.woundedEntry > 0 },
    { label: 'squad lost exactly dead + wounded', ok: before - after.count === after.dead + after.woundedEntry },
    { label: 'wounded pool holds the battle wounded', ok: after.woundedPool >= after.woundedEntry },
  ], errors);
});
