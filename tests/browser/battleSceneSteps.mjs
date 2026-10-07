export const STAGE = 'goblin_camp';
export const waitGame = (page) => page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });

export const seedSquad = (page) => page.evaluate(() => {
  const um = window.game.units;
  for (const s of um.getSquads()) um.deleteSquad(s.id);
  window.game.eventBus.emit('ui:openSquads', { instanceIndex: 0 });
  const squad = um.getSquads().find(s => s.barracksInstanceId === 'barracks_0');
  if (!squad) return null;
  um._reserve.set('infantry_t1', 60);
  um.assignToSquad(squad.id, 'infantry', 60, 1, 0);
  um.linkSlotUnit(squad.id, 0, 'infantry');
  document.querySelector('#squad-panel .sq-close')?.click();
  return squad.id;
});

export async function deploy(page, { keyboard = false, stage = STAGE } = {}) {
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'combat'));
  await page.waitForSelector('.campaign-node', { timeout: 5000 });
  await page.evaluate((id) => document.querySelector(`.campaign-node[data-stage-id="${id}"]`)?.click(), stage);
  await page.waitForSelector('#btn-campaign-attack', { state: 'attached' });
  await page.waitForTimeout(300);
  if (keyboard) {
    await page.locator('#btn-campaign-attack').focus();
    await page.keyboard.press('Enter');
  } else {
    await page.evaluate(() => document.querySelector('#btn-campaign-attack').click());
  }
  await page.waitForTimeout(300);
  if (await page.locator('#btn-warn-proceed').count()) await page.locator('#btn-warn-proceed').click();
  return page.waitForSelector('#battle-scene:not(.hidden)', { timeout: 5000 }).then(() => true, () => false);
}

export const roundLabel = (page) => page.locator('#battle-round-label').textContent();
export const isVisible = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  return !!el && !el.classList.contains('hidden') && el.offsetParent !== null;
}, sel);
