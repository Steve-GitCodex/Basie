const popOpen = (page) => page.evaluate(() => {
  const el = document.querySelector('.chip-popover');
  return !!el && !el.hidden && el.getClientRects().length > 0;
});
const popText = (page) => page.evaluate(() => document.querySelector('.chip-popover')?.textContent ?? '');
const profileOpen = (page) => page.evaluate(() => !!document.getElementById('profile-modal-body'));

export const commanderChecks = async (page) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('modal-overlay')?.classList.add('hidden'));
  const out = [];

  await page.click('#player-chip');
  const text = await popText(page);
  out.push({
    label: 'plate opens commander popover',
    ok: (await popOpen(page)) && text.includes('Level') && text.includes('Profile') && !/Power/.test(text) && !(await profileOpen(page)),
  });

  await page.evaluate(() => { document.querySelector('.chip-popover').__probe = true; });
  const before = await popText(page);
  await page.evaluate(() => window.game.user.addXP(5));
  await page.waitForTimeout(100);
  out.push({
    label: 'plate popover patches xp',
    ok: (await page.evaluate(() => document.querySelector('.chip-popover').__probe === true)) && (await popText(page)) !== before,
  });

  await page.click('#res-iron');
  out.push({ label: 'chip popover replaces commander popover', ok: (await popOpen(page)) && (await popText(page)).includes('Stock') });
  await page.click('#player-chip');
  out.push({ label: 'commander popover replaces chip popover', ok: (await popText(page)).includes('Level') });
  await page.click('#player-chip');
  out.push({ label: 'second click closes commander popover', ok: !(await popOpen(page)) });

  await page.click('#player-chip');
  await page.click('[data-pop="profile"]');
  await page.waitForTimeout(300);
  out.push({ label: 'profile button opens profile', ok: (await profileOpen(page)) && !(await popOpen(page)) });
  await page.evaluate(() => document.querySelector('#modal-overlay .modal-close')?.click());
  await page.waitForTimeout(300);

  await page.focus('#player-chip');
  await page.keyboard.press('Enter');
  out.push({ label: 'enter on plate opens popover', ok: (await popOpen(page)) && (await popText(page)).includes('Level') });
  await page.keyboard.press('Escape');
  return out;
};
