const popOpen = (page) => page.evaluate(() => {
  const el = document.querySelector('.chip-popover');
  return !!el && !el.hidden && el.getClientRects().length > 0;
});

const tabRequested = (page) => page.evaluate(() => window.__tradeTab);

export const popoverRouteChecks = async (page) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__tradeTab = null;
    window.game.eventBus.on('ui:openTradingTab', (req) => { window.__tradeTab = req?.tab ?? null; });
  });
  const out = [];
  await page.click('#res-diamond');
  await page.click('.chip-popover [data-pop="trade"]');
  out.push({ label: 'diamond get more opens premium tab', ok: (await tabRequested(page)) === 'premium' });
  await page.evaluate(() => { window.__tradeTab = null; });
  await page.click('#res-money');
  await page.click('.chip-popover [data-pop="trade"]');
  out.push({ label: 'money trading post opens supply tab', ok: (await tabRequested(page)) === 'supply' });
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'base'));
  await page.waitForTimeout(300);
  return out;
};

export const popoverModalChecks = async (page) => {
  const out = [];
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.click('#res-wood');
  const openBefore = await popOpen(page);
  await page.evaluate(() => window.game.eventBus.emit('ui:openInventory'));
  await page.waitForTimeout(200);
  out.push({ label: 'popover closes when a modal opens', ok: openBefore && !(await popOpen(page)) });
  await page.evaluate(() => {
    window.game.eventBus.emit('ui:navigateTo', 'base');
    document.querySelectorAll('.inventory-modal, #inventory-modal, .modal-overlay.open').forEach((el) => el.classList.remove('open'));
  });
  return out;
};

export const popoverKeyboardChecks = async (page) => {
  const out = [];
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.focus('#res-wood');
  await page.keyboard.press('Enter');
  const inside = await page.evaluate(() => !!document.activeElement?.closest('.chip-popover'));
  await page.keyboard.press('Escape');
  const back = await page.evaluate(() => document.activeElement?.id === 'res-wood');
  out.push({ label: 'keyboard open focuses popover action', ok: inside && back });

  await page.click('#res-wood');
  out.push({ label: 'mouse open does not steal focus', ok: await page.evaluate(() => !document.activeElement?.closest('.chip-popover')) });
  const aria = await page.evaluate(() => {
    const pop = document.querySelector('.chip-popover');
    const anchor = document.getElementById('res-wood');
    return pop.getAttribute('role') === 'dialog' && !!pop.getAttribute('aria-label')
      && anchor.getAttribute('aria-haspopup') === 'dialog' && anchor.getAttribute('aria-controls') === pop.id && !!pop.id;
  });
  out.push({ label: 'popover and anchors carry dialog aria', ok: aria });
  await page.keyboard.press('Escape');

  await page.focus('#buff-hud-badge');
  const ring = await page.evaluate(() => getComputedStyle(document.getElementById('buff-hud-badge')).outlineStyle);
  out.push({ label: 'buff badge shows focus ring', ok: ring !== 'none' });
  await page.evaluate(() => document.activeElement?.blur());
  return out;
};

export const plateWidthChecks = async (page) => {
  const out = [];
  for (const width of [701, 760, 800, 360]) {
    await page.setViewportSize({ width, height: 720 });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const name = document.getElementById('player-name');
      const vip = document.getElementById('vip-badge');
      const wasHidden = vip.classList.contains('hidden');
      const oldName = name.textContent;
      const oldVip = vip.textContent;
      vip.classList.remove('hidden');
      vip.textContent = 'VIP II';
      name.textContent = 'Commander';
      const r = vip.getBoundingClientRect();
      const res = {
        clipped: name.scrollWidth > name.clientWidth,
        badgeFits: r.right <= innerWidth && r.left >= 0,
        noIcon: !vip.querySelector('svg, .icon'),
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
      };
      name.textContent = oldName;
      vip.textContent = oldVip;
      if (wasHidden) vip.classList.add('hidden');
      return res;
    });
    out.push({ label: `Commander name not clipped @${width}`, ok: !m.clipped });
    out.push({ label: `vip badge fits without icon @${width}`, ok: m.badgeFits && m.noIcon && !m.pageOverflow });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(250);
  return out;
};
