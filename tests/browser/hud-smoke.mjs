import { withPage, report, dismissOverlays } from './harness.mjs';

const waitGame = (page) => page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });
const setRes = (page, key, amount, cap) => page.evaluate(([k, a, c]) => {
  const rm = window.game.resources;
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
  await page.waitForTimeout(400);
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

  checks.push({ label: 'zero page errors', ok: errors.length === 0 });
  report('hud-smoke', checks, errors);
});
