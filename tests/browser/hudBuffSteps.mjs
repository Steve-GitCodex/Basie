const popOpen = (page) => page.evaluate(() => {
  const el = document.querySelector('.chip-popover');
  return !!el && !el.hidden && el.getClientRects().length > 0;
});
const popText = (page) => page.evaluate(() => document.querySelector('.chip-popover')?.textContent ?? '');
const panelOpen = (page) => page.evaluate(() => !!document.querySelector('#buffs-panel-overlay.open, #buffs-panel.open'));

export const buffEmptyChecks = async (page) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.click('#buff-hud-badge');
  const text = await popText(page);
  const out = [{
    label: 'no buffs shows empty state',
    ok: (await popOpen(page)) && text.includes('No active buffs') && text.includes('Open buffs') && !(await panelOpen(page)),
  }];
  await page.keyboard.press('Escape');
  return out;
};

export const buffPopoverChecks = async (page, buffName) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  const out = [];

  await page.click('#buff-hud-badge');
  const text = await popText(page);
  out.push({
    label: 'badge opens buff popover',
    ok: (await popOpen(page)) && text.includes('Active buffs') && text.includes(buffName) && text.includes('Open buffs') && !(await panelOpen(page)),
  });
  out.push({ label: 'badge aria-expanded while open', ok: (await page.getAttribute('#buff-hud-badge', 'aria-expanded')) === 'true' });

  await page.evaluate(() => { document.querySelector('.chip-popover').__probe = true; });
  const before = await page.evaluate(() => document.querySelector('[data-buff-time]').textContent);
  await page.waitForFunction((t) => document.querySelector('[data-buff-time]')?.textContent !== t, before, { timeout: 2500 }).catch(() => {});
  out.push({
    label: 'buff popover counts down in place',
    ok: (await page.evaluate(() => document.querySelector('.chip-popover').__probe === true))
      && (await page.evaluate(() => document.querySelector('[data-buff-time]').textContent)) !== before,
  });

  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.click('#buff-hud-badge');
  out.push({
    label: 'buff time stays on one line @360',
    ok: await page.evaluate(() => {
      const t = document.querySelector('[data-buff-time]');
      const r = document.querySelector('.chip-popover').getBoundingClientRect();
      return t.getClientRects().length === 1 && t.getBoundingClientRect().height <= 1.5 * (parseFloat(getComputedStyle(t).lineHeight) || 1.2 * parseFloat(getComputedStyle(t).fontSize)) && r.left >= 8 - 0.5 && r.right <= window.innerWidth - 8 + 0.5;
    }),
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.click('#buff-hud-badge');
  await page.click('[data-pop="buffs"]');
  await page.waitForTimeout(300);
  out.push({ label: 'open buffs button opens panel', ok: (await panelOpen(page)) && !(await popOpen(page)) });
  await page.evaluate(() => {
    document.getElementById('buffs-panel')?.classList.remove('open');
    document.getElementById('buffs-panel-overlay')?.classList.remove('open');
  });

  await page.focus('#buff-hud-badge');
  await page.keyboard.press('Enter');
  out.push({ label: 'enter on badge opens popover', ok: (await popOpen(page)) && (await popText(page)).includes('Active buffs') });
  await page.keyboard.press('Escape');
  out.push({ label: 'escape closes buff popover', ok: !(await popOpen(page)) });
  return out;
};
