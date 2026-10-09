import { cafeteriaChecks, sixCellChecks } from './hudCafeteriaSteps.mjs';
import { commanderChecks } from './hudCommanderSteps.mjs';
import { commanderChecks } from './hudCommanderSteps.mjs';
import { buffEmptyChecks, buffPopoverChecks } from './hudBuffSteps.mjs';
import { popoverRouteChecks, popoverModalChecks, popoverKeyboardChecks, plateWidthChecks } from './hudPopoverSteps.mjs';
import { withPage, report, dismissOverlays, loadPlaywright } from './harness.mjs';

const waitGame = (page) => page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });
const setRes = (page, key, amount, cap) => page.evaluate(([k, a, c]) => {
  const rm = window.game.resources;
  rm.setCapFloors?.({});
  rm.setCap(k, c);
  rm._resources[k].amount = a;
  window.game.eventBus.emit('resources:ratesChanged', rm.getSnapshot());
}, [key, amount, cap]);
const chipHas = (page, id, cls) => page.evaluate(([i, c]) => document.getElementById(i).classList.contains(c), [id, cls]);

const layoutChecks = async (page, width) => {
  const tag = (label) => `${label} @${width}`;
  const m = await page.evaluate(() => {
    const visible = (el) => el.offsetParent !== null;
    const badges = ['vip-badge', 'achievements-badge'].map((id) => document.getElementById(id));
    const hiddenBadges = badges.filter((el) => el.classList.contains('hidden'));
    hiddenBadges.forEach((el) => el.classList.remove('hidden'));
    const chips = [...document.querySelectorAll('#resource-bar .resource-chip')].filter(visible);
    const bar = document.getElementById('resource-bar');
    const header = document.getElementById('game-header');
    const probe = Object.assign(document.createElement('div'), { style: 'position:absolute;visibility:hidden;height:var(--header-height)' });
    document.body.appendChild(probe);
    const token = probe.getBoundingClientRect().height;
    probe.remove();
    const tapTargets = [...document.querySelectorAll('#game-header .resource-chip'), document.getElementById('buff-hud-badge'), document.getElementById('player-chip')]
      .filter(visible);
    window.game.eventBus.emit('notification:show', { type: 'info', title: 't', message: 'm' });
    const toast = document.getElementById('notification-container');
    const textSizes = ['v-wood', 'player-level', 'player-name', 'vip-badge', 'achievements-badge']
      .map((id) => document.getElementById(id))
      .filter((el) => el.offsetParent !== null)
      .map((el) => parseFloat(getComputedStyle(el).fontSize));
    hiddenBadges.forEach((el) => el.classList.add('hidden'));
    return {
      chipsInside: chips.every((c) => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }),
      barFits: bar.scrollWidth <= bar.clientWidth,
      headerH: header.offsetHeight,
      token,
      nameW: document.getElementById('player-name').getBoundingClientRect().width,
      valueFont: Math.min(...textSizes),
      minTap: Math.min(...tapTargets.map((el) => el.getBoundingClientRect().height)),
      toastTop: toast.getBoundingClientRect().top,
      headerBottom: header.getBoundingClientRect().bottom,
    };
  });
  return [
    { label: tag('all chips inside viewport'), ok: m.chipsInside && m.barFits },
    { label: tag('header height matches token'), ok: Math.abs(m.headerH - m.token) <= 1 && m.token === (width > 700 ? 48 : 86) },
    { label: tag('player name visible'), ok: m.nameW > 0 },
    { label: tag('chip text floor'), ok: m.valueFont >= 11 },
    { label: tag('tap target floor'), ok: m.minTap >= 32 },
    { label: tag('toast below header'), ok: m.toastTop >= m.headerBottom },
  ];
};

const narrowChecks = async (page) => {
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'world'));
  await page.waitForFunction(() => !document.querySelector('#view-world')?.classList.contains('hidden'), null, { timeout: 5000 });
  await page.waitForTimeout(300);
  const overlay = await page.evaluate(() => {
    const el = document.querySelector('.world-marches');
    const wasHidden = el.classList.contains('hidden');
    el.classList.remove('hidden');
    const top = el.getBoundingClientRect().top;
    if (wasHidden) el.classList.add('hidden');
    return top >= document.getElementById('game-header').getBoundingClientRect().bottom;
  });
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'base'));
  await page.waitForTimeout(200);

  for (const key of ['wood', 'stone', 'food', 'iron', 'water', 'money', 'diamond']) await setRes(page, key, 2410000, 3000000);
  await page.waitForTimeout(500);
  const lateFit = await page.evaluate(() => [...document.querySelectorAll('#game-header .res-value')]
    .filter((el) => el.offsetParent !== null)
    .every((el) => el.scrollWidth <= el.clientWidth));

  const six = await page.evaluate(() => {
    document.getElementById('res-cafeteria').style.display = '';
    const chips = [...document.querySelectorAll('#resource-bar .resource-chip')].filter((c) => c.offsetParent !== null);
    const rects = chips.map((c) => c.getBoundingClientRect());
    const w = rects[0].width;
    const ok = chips.length === 6
      && rects.every((r) => r.left >= 0 && r.right <= innerWidth && Math.abs(r.width - w) <= 1);
    document.getElementById('res-cafeteria').style.display = 'none';
    return ok;
  });

  const wallet = await page.evaluate(() => ({
    money: document.getElementById('res-money').offsetParent !== null,
    diamond: document.getElementById('res-diamond').offsetParent !== null,
  }));
  return [
    { label: 'world overlay below header @360', ok: overlay },
    { label: 'late values fit @360', ok: lateFit },
    { label: 'cafeteria becomes sixth cell @360', ok: six },
    { label: 'money hidden at 400 @360', ok: !wallet.money && wallet.diamond },
  ];
};


const stateChecks = async (page) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  const out = [];
  const capHidden = () => page.evaluate(() => ['c-wood', 'r-wood'].every((id) => document.getElementById(id).offsetParent === null));
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.waitForTimeout(300);
  out.push({ label: 'name not truncated @1000', ok: await page.evaluate(() => { const n = document.getElementById('player-name'); return n.scrollWidth <= n.clientWidth; }) });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  out.push({ label: 'cap text hidden in header @1280', ok: await capHidden() });
  await setRes(page, 'stone', 12000, 120000);
  await setRes(page, 'wood', 114000, 120000);
  await page.waitForTimeout(400);
  const border = (id) => page.evaluate((i) => getComputedStyle(document.getElementById(i)).borderTopColor, id);
  out.push({ label: 'near colours the chip', ok: (await border('res-wood')) !== (await border('res-stone')) });
  await setRes(page, 'wood', 120000, 120000);
  await page.waitForTimeout(400);
  out.push({ label: 'full pulses', ok: (await page.evaluate(() => getComputedStyle(document.getElementById('res-wood')).animationName)) !== 'none' });
  out.push({ label: 'diamond plus', ok: await page.evaluate(() => document.querySelector('#res-diamond .res-plus').offsetParent !== null) });
  out.push({ label: 'wide chips fit content', ok: (await page.evaluate(() => document.getElementById('res-wood').getBoundingClientRect().width)) <= 110 });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(300);
  out.push({ label: 'cap text hidden in header @360', ok: await capHidden() });
  out.push({ label: 'achievements badge near avatar @360', ok: await page.evaluate(() => { const b = document.getElementById('achievements-badge'); const hidden = b.classList.contains('hidden'); b.classList.remove('hidden'); const gap = b.getBoundingClientRect().left - document.getElementById('player-avatar').getBoundingClientRect().right; if (hidden) b.classList.add('hidden'); return gap <= 60; }) });
  await setRes(page, 'wood', 1000, 120000);
  return out;
};

const buffShiftChecks = async (page) => {
  await page.evaluate(() => window.game.inventory.addItem('buff_prod_sm', 2));
  await page.evaluate(() => window.game.eventBus.emit('ui:openBuffs'));
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('.buff-row--empty [data-use-item="buff_prod_sm"]').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => ['buffs-panel', 'buffs-panel-overlay'].forEach((id) => document.getElementById(id)?.classList.remove('open')));
  const out = [];
  for (const width of [1280, 701]) {
    await page.setViewportSize({ width, height: 720 });
    await page.waitForTimeout(300);
    const lefts = await page.evaluate(() => {
      const label = document.getElementById('buff-badge-label');
      const diamond = document.getElementById('res-diamond');
      return ['1 · 59m 59s', '1 · 1m 1s', '1 · 8m 08s'].map((text) => { label.textContent = text; return diamond.getBoundingClientRect().left; });
    });
    out.push({ label: 'buff countdown does not shift wallet @' + width, ok: lefts.every((l) => Math.abs(l - lefts[0]) <= 0.5) });
  }
  return out;
};

const hoverCheck = async (page) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.mouse.move(5, 400);
  await page.hover('#res-wood');
  const shown = await page.waitForFunction(() => document.getElementById('game-tooltip')?.classList.contains('visible'), null, { timeout: 1500 }).then(() => true, () => false);
  await page.mouse.move(5, 400);
  return [{ label: 'mouse hover still shows tooltip @1280', ok: shown }];
};

const touchCheck = async (origin) => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(origin + '/index.html?dev=hudtouch', { waitUntil: 'domcontentloaded' });
    await waitGame(page);
    await page.waitForTimeout(800);
    await dismissOverlays(page);
    await page.evaluate(() => { document.querySelector('.dev-dashboard')?.remove(); });
    await page.touchscreen.tap(...await page.evaluate(() => { const r = document.getElementById('res-iron').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => {
      const pop = document.querySelector('.chip-popover');
      return { pop: !!pop && !pop.hidden && pop.getClientRects().length > 0, tip: document.getElementById('game-tooltip')?.classList.contains('visible') };
    });
    return [{ label: 'tap shows popover without tooltip @360', ok: state.pop && !state.tip }];
  } finally {
    await browser.close();
  }
};

const popText = (page) => page.evaluate(() => document.querySelector('.chip-popover')?.textContent ?? '');
const popOpen = (page) => page.evaluate(() => {
  const el = document.querySelector('.chip-popover');
  return !!el && !el.hidden && el.getClientRects().length > 0;
});

const popoverChecks = async (page) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(300);
  await setRes(page, 'iron', 5000, 120000);
  await page.click('#res-iron');
  const text = await popText(page);
  const out = [{ label: 'tap opens popover @360', ok: (await popOpen(page)) && text.includes('Stock') && text.includes('/s') }];

  await page.keyboard.press('Escape');
  await page.click('#res-diamond');
  const rect = await page.evaluate(() => { const r = document.querySelector('.chip-popover')?.getBoundingClientRect(); return { l: r ? r.left : -1, r: r ? r.right : 9999 }; });
  out.push({ label: 'popover inside viewport @360', ok: rect.l >= 0 && rect.r <= 360 });
  const diamond = await popText(page);
  out.push({ label: 'diamond popover reaches money @360', ok: diamond.includes('Money') && diamond.includes('Diamond') });
  await page.keyboard.press('Escape');

  await page.click('#res-iron');
  await page.evaluate(() => { const el = document.querySelector('.chip-popover [data-part="stock"]'); if (el) el.__probe = true; });
  const before = await popText(page);
  await setRes(page, 'iron', 9000, 120000);
  await page.waitForTimeout(700);
  out.push({
    label: 'popover patches in place',
    ok: (await page.evaluate(() => document.querySelector('.chip-popover [data-part="stock"]')?.__probe === true)) && (await popText(page)) !== before,
  });
  await page.keyboard.press('Escape');

  await setRes(page, 'iron', 120000, 120000);
  await page.waitForTimeout(600);
  await page.click('#res-iron');
  out.push({ label: 'full shows production stopped', ok: (await popText(page)).includes('production stopped') });
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.click('#res-money');
  out.push({ label: 'money says no storage limit', ok: (await popText(page)).includes('No storage limit') });
  await page.keyboard.press('Escape');
  const escClosed = !(await popOpen(page));
  await page.click('#res-iron');
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.waitForTimeout(300);
  out.push({ label: 'escape and resize close', ok: escClosed && !(await popOpen(page)) });

  await page.focus('#res-wood');
  await page.keyboard.press('Enter');
  out.push({ label: 'enter opens from keyboard', ok: await popOpen(page) });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(300);
  await page.click('#res-iron');
  out.push({ label: 'popover buttons tap floor', ok: await page.evaluate(() => { const bs = [...document.querySelectorAll('.chip-popover button')]; return bs.length > 0 && bs.every((b) => b.getBoundingClientRect().height >= 32); }) });
  await page.keyboard.press('Escape');
  return out;
};

await withPage(async ({ page, errors, origin }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=hudsmoke`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  await dismissOverlays(page);

  const checks = [];

  await setRes(page, 'wood', 48200, 120000);
  await page.waitForFunction(() => document.getElementById('v-wood').textContent.trim() === '48.2K', null, { timeout: 3000 }).catch(() => {});
  checks.push({ label: 'compact values', ok: (await page.textContent('#v-wood')).trim() === '48.2K' });

  await setRes(page, 'wood', 114000, 120000);
  checks.push({
    label: 'near state',
    ok: await chipHas(page, 'res-wood', 'resource-chip--near') && !(await chipHas(page, 'res-wood', 'resource-chip--full')),
  });

  await setRes(page, 'wood', 120000, 120000);
  checks.push({
    label: 'full state',
    ok: await chipHas(page, 'res-wood', 'resource-chip--full') && !(await chipHas(page, 'res-wood', 'resource-chip--near')),
  });

  await setRes(page, 'money', 5000, Infinity);
  checks.push({
    label: 'money has no fill state',
    ok: !(await chipHas(page, 'res-money', 'resource-chip--near')) && !(await chipHas(page, 'res-money', 'resource-chip--full')),
  });

  await setRes(page, 'wood', 1000, 120000);
  await page.evaluate(() => window.game.eventBus.emit('resources:added', { wood: 10 }));
  const flashed = await page.waitForFunction(
    () => document.getElementById('v-wood').classList.contains('tick-flash'), null, { timeout: 1000 },
  ).then(() => true, () => false);
  checks.push({ label: 'fly-out still flashes', ok: flashed });

  checks.push({ label: 'level text', ok: /^Lv \d+$/.test((await page.textContent('#player-level')).trim()) });

  for (const [width, height] of [[1280, 720], [701, 640], [360, 640]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    checks.push(...await layoutChecks(page, width));
  }
  checks.push(...await narrowChecks(page));
  checks.push(...await stateChecks(page));
  checks.push(...await popoverChecks(page));
  checks.push(...await popoverRouteChecks(page));
  checks.push(...await popoverModalChecks(page));
  checks.push(...await popoverKeyboardChecks(page));
  checks.push(...await plateWidthChecks(page));
  checks.push(...await hoverCheck(page));
  checks.push(...await buffEmptyChecks(page));
  checks.push(...await buffShiftChecks(page));
  const buffName = await page.evaluate(async () => (await import('/js/entities/GAME_DATA.js')).INVENTORY_ITEMS.buff_prod_sm.name);
  checks.push(...await buffPopoverChecks(page, buffName));
  checks.push(...await cafeteriaChecks(page));
  checks.push(...await sixCellChecks(page));
  checks.push(...await commanderChecks(page));
  checks.push(...await commanderChecks(page));
  checks.push(...await touchCheck(origin));

  checks.push({ label: 'zero page errors', ok: errors.length === 0 });
  report('hud-smoke', checks, errors);
});
