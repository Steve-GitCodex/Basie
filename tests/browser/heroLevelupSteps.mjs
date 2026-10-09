const SHEET = '.hero-levelup';
const PANEL = '.hero-levelup__panel';

const openSheet = async (page) => {
  await page.click('#heroes-detail-pane [data-action="levelup"]');
  await page.waitForSelector(`${SHEET}:not(.hidden)`, { timeout: 1500 });
};

const heroLevel = (page) => page.evaluate(() =>
  window.game.heroes.getRosterWithState().find(h => h.id === 'warlord').level);

const sheetVisible = (page) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  return !!el && el.getClientRects().length > 0;
}, SHEET);

export const levelupChecks = async (page) => {
  const out = [];
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    const { heroes, inventory, eventBus } = window.game;
    eventBus.emit('ui:devSetBuildingLevel', { buildingId: 'heroquarters', level: 3 });
    const record = heroes._owned.get('warlord');
    record.level = 12;
    record.xp = 0;
    record.xpToNext = heroes._progression.xpToNext(12, record.tier ?? heroes.getRosterWithState().find(h => h.id === 'warlord').tier);
    inventory.addItem('xp_bundle_small', 14);
    inventory.addItem('xp_bundle_medium', 6);
    inventory.addItem('xpcard_normal', 9);
    eventBus.emit('heroes:updated', heroes.getRosterWithState());
  });
  if (await page.isVisible('#heroes-detail-pane .hq-nav--back')) await page.click('#heroes-detail-pane .hq-nav--back');
  await page.click('.hq-card[data-hero-id="warlord"]');
  await page.waitForSelector('#heroes-detail-pane:not(.hidden)', { timeout: 5000 });

  await openSheet(page).catch(() => {});
  out.push({
    label: 'level up button opens sheet',
    ok: (await sheetVisible(page)) && (await page.locator(`${SHEET} .hero-levelup__row:not(.hero-levelup__row--fragment)`).count()) === 3,
  });

  await page.click(`${SHEET} [data-act="next"]`).catch(() => {});
  const before = await heroLevel(page);
  const previewText = await page.locator(`${SHEET} .hero-levelup__big`).innerText().catch(() => '');
  out.push({ label: 'next level picks least waste', ok: previewText.includes(`→ ${before + 1}`) });

  const owned = () => page.evaluate(() => ['xp_bundle_small', 'xp_bundle_medium', 'xpcard_normal']
    .reduce((a, id) => a + window.game.inventory.getQuantity(id), 0));
  const ownedBefore = await owned();
  await page.click(`${SHEET} [data-act="use"]`).catch(() => {});
  await page.waitForTimeout(300);
  out.push({
    label: 'use applies xp',
    ok: (await heroLevel(page)) === before + 1 && !(await sheetVisible(page)) && (await owned()) < ownedBefore,
  });

  await openSheet(page).catch(() => {});
  await page.keyboard.press('Escape');
  out.push({ label: 'escape closes sheet', ok: !(await sheetVisible(page)) });

  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(200);
  await openSheet(page).catch(() => {});
  const gap = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? Math.abs(el.getBoundingClientRect().bottom - window.innerHeight) : 999;
  }, PANEL);
  out.push({ label: 'phone bottom sheet', ok: gap <= 1 });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 800 });
  out.push(...await edgeChecks(page));
  return out;
};

const seedHero = (page, { level, small = 0 }) => page.evaluate(({ level, small }) => {
  const { heroes, inventory, eventBus } = window.game;
  const record = heroes._owned.get('warlord');
  const tier = heroes.getRosterWithState().find(h => h.id === 'warlord').tier;
  record.level = level;
  record.xp = 0;
  record.xpToNext = heroes._progression.xpToNext(level, tier);
  const have = inventory.getQuantity('xp_bundle_small');
  if (have > small) inventory.removeItem('xp_bundle_small', have - small);
  else if (small > have) inventory.addItem('xp_bundle_small', small - have);
  eventBus.emit('heroes:updated', heroes.getRosterWithState());
}, { level, small });

const closeSheet = async (page) => {
  if (await sheetVisible(page)) await page.keyboard.press('Escape');
};

const edgeChecks = async (page) => {
  const out = [];
  await closeSheet(page);

  await page.evaluate(() => {
    const { heroes, eventBus } = window.game;
    heroes._owned.get('warlord').level = heroes.levelCap();
    eventBus.emit('heroes:updated', heroes.getRosterWithState());
  });
  const maxed = await page.evaluate(() => {
    const b = document.querySelector('#heroes-detail-pane [data-action="levelup"]');
    return b?.textContent.trim() === 'Max level' && b.disabled;
  });
  out.push({ label: 'max level disables', ok: maxed });

  await seedHero(page, { level: 12, small: 14 });
  await openSheet(page).catch(() => {});
  const smallRow = `${SHEET} .hero-levelup__row[data-item-id="xp_bundle_small"]`;
  for (let i = 0; i < 3; i++) await page.click(`${smallRow} [data-act="inc"]`, { timeout: 2000 }).catch(() => {});
  await page.evaluate((sel) => { document.querySelector(sel).dataset.probe = 'alive'; }, SHEET);
  await page.evaluate(() => window.game.inventory.removeItem('xp_bundle_small', 12));
  const clamped = await page.evaluate(({ sel, row }) => ({
    qty: document.querySelector(`${row} [data-qty]`)?.textContent.trim(),
    probe: document.querySelector(sel)?.dataset.probe,
  }), { sel: SHEET, row: smallRow });
  out.push({ label: 'owned change clamps in place', ok: clamped.qty === '2' && clamped.probe === 'alive' });

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'city'));
  await page.waitForTimeout(150);
  out.push({ label: 'sheet closes when the view changes', ok: !(await sheetVisible(page)) });

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await seedHero(page, { level: 12 });
  await page.evaluate(() => {
    const { heroes, inventory, eventBus } = window.game;
    const record = heroes._owned.get('warlord');
    const tier = heroes.getRosterWithState().find(h => h.id === 'warlord').tier;
    record.level = heroes.levelCap() - 1;
    record.xpToNext = heroes._progression.xpToNext(record.level, tier);
    record.xp = record.xpToNext - 10;
    inventory.addItem('fragment_warlord', 5);
    eventBus.emit('heroes:updated', heroes.getRosterWithState());
  });
  if (!(await page.isVisible('#heroes-detail-pane:not(.hidden)'))) await page.click('.hq-card[data-hero-id="warlord"]');
  await openSheet(page).catch(() => {});
  await page.click(`${SHEET} .hero-levelup__row--fragment [data-act="inc"]`, { timeout: 2000 }).catch(() => {});
  const waste = await page.evaluate((sel) => {
    const el = document.querySelector(`${sel} .hero-levelup__waste`);
    return !!el && el.getClientRects().length > 0;
  }, SHEET);
  out.push({ label: 'fragment past cap warns', ok: waste });
  await page.evaluate(() => {
    window.__toasts = [];
    const n = window.game.notifications;
    const orig = n.show.bind(n);
    n.show = (type, title, msg) => { window.__toasts.push({ type, title, msg }); return orig(type, title, msg); };
  });
  const frag = () => page.evaluate(() => window.game.inventory.getQuantity('fragment_warlord'));
  const fragBefore = await frag();
  await page.click(`${SHEET} [data-act="use"]`).catch(() => {});
  await page.waitForTimeout(300);
  const capLevel = await page.evaluate(() => window.game.heroes.levelCap());
  out.push({
    label: 'single fragment past cap uses',
    ok: !(await sheetVisible(page)) && (await heroLevel(page)) === capLevel && (await frag()) === fragBefore - 1,
  });
  out.push(...await multiRowCapChecks(page, frag));
  await closeSheet(page);
  return out;
};

const multiRowCapChecks = async (page, frag) => {
  const out = [];
  await page.evaluate(() => {
    const { heroes, inventory, eventBus } = window.game;
    const record = heroes._owned.get('warlord');
    const tier = heroes.getRosterWithState().find(h => h.id === 'warlord').tier;
    record.level = heroes.levelCap() - 1;
    record.xpToNext = heroes._progression.xpToNext(record.level, tier);
    record.xp = record.xpToNext - 5;
    inventory.addItem('xp_bundle_small', 5);
    inventory.addItem('fragment_warlord', 2);
    eventBus.emit('heroes:updated', heroes.getRosterWithState());
    window.__toasts.length = 0;
  });
  const fragBefore = await frag();
  await openSheet(page).catch(() => {});
  const smallRow = `${SHEET} .hero-levelup__row[data-item-id="xp_bundle_small"]`;
  for (let i = 0; i < 3; i++) await page.click(`${smallRow} [data-act="inc"]`, { timeout: 2000 }).catch(() => {});
  await page.click(`${SHEET} .hero-levelup__row--fragment [data-act="inc"]`, { timeout: 2000 }).catch(() => {});
  await page.click(`${SHEET} [data-act="use"]`).catch(() => {});
  await page.waitForTimeout(300);
  const capLevel = await page.evaluate(() => window.game.heroes.levelCap());
  const toasts = await page.evaluate(() => window.__toasts.slice());
  out.push({
    label: 'multi-row use stops at cap without warning',
    ok: !(await sheetVisible(page)) && (await heroLevel(page)) === capLevel && (await frag()) === fragBefore
      && !toasts.some(t => t.type === 'warning'),
  });

  await page.evaluate(() => {
    const { heroes, inventory, eventBus } = window.game;
    const record = heroes._owned.get('warlord');
    const tier = heroes.getRosterWithState().find(h => h.id === 'warlord').tier;
    inventory.addItem('xp_bundle_medium', 40);
    record.level = 10;
    record.xp = 0;
    record.xpToNext = heroes._progression.xpToNext(10, tier);
    eventBus.emit('heroes:updated', heroes.getRosterWithState());
    window.__toasts.length = 0;
  });
  await openSheet(page).catch(() => {});
  await page.click(`${SHEET} [data-act="fill"]`).catch(() => {});
  await page.click(`${SHEET} [data-act="use"]`).catch(() => {});
  await page.waitForTimeout(300);
  const levelToasts = (await page.evaluate(() => window.__toasts.slice())).filter(t => /Level Up/.test(t.title) || /Lv [0-9]+ → [0-9]+/.test(t.msg));
  out.push({ label: 'multi-level use raises exactly one level toast', ok: levelToasts.length === 1 && /Lv 10 → [0-9]+/.test(levelToasts[0].msg) });
  return out;
};
