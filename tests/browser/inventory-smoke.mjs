import { withPage, report, dismissOverlays } from './harness.mjs';
import { inventoryRouteChecks } from './inventoryRouteSteps.mjs';

const waitGame = (page) => page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });
const openInventory = async (page) => {
  await page.click('#btn-inventory');
  await page.waitForSelector('#inv-root', { timeout: 5000 });
};
const closeInventory = async (page) => {
  await page.click('#inv-root .modal-close');
  await page.waitForSelector('#inv-root', { state: 'detached', timeout: 5000 });
};
const selectTile = (page, id) => page.click(`.inv-tile[data-item-id="${id}"]`);
const tileQty = (page, id) => page.textContent(`.inv-tile[data-item-id="${id}"] .inv-tile__qty`);

await withPage(async ({ page, errors, origin }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=inventorysmoke`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  await dismissOverlays(page);
  await page.addStyleTag({ content: '#notification-container, #notification-container * { pointer-events: none !important; } .dev-widget, .dev-dashboard, .dev-dashboard__toggle { display: none !important; }' });

  await page.evaluate(() => {
    const inv = window.game.inventory;
    inv.addItem('res_bundle_wood_t1', 8);
    inv.addItem('xp_bundle_medium', 4);
    inv.addItem('speedup_build_5m', 2);
    inv.addItem('buff_prod_sm', 1);
    inv.addItem('xp_bundle_small', 1);
    window.game.heroes.recruitHeroRecord('kaelenthorne');
    window.game.heroes.recruitHeroRecord('warlord');
    window.__toasts = [];
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(`${n.className}|${n.textContent}`);
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.waitForTimeout(200);
  await dismissOverlays(page);

  const checks = [];

  await openInventory(page);
  checks.push({ label: 'dock opens modal', ok: await page.locator('#inv-root').count() === 1 });
  await page.click('#btn-inventory');
  await page.waitForSelector('#inv-root', { state: 'detached', timeout: 5000 });
  checks.push({ label: 'dock closes modal', ok: await page.locator('#inv-root').count() === 0 });

  await openInventory(page);
  checks.push({
    label: 'six tabs visible without scroll',
    ok: await page.evaluate(() => {
      const rail = document.querySelector('.inv-modal__rail');
      const box = rail.getBoundingClientRect();
      const tabs = [...rail.querySelectorAll('[data-tab]')];
      return tabs.length === 6 && tabs.every(t => {
        const r = t.getBoundingClientRect();
        return r.width > 0 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
      });
    }),
  });

  await selectTile(page, 'res_bundle_wood_t1');
  const tileBefore = await page.evaluateHandle(() => document.querySelector('.inv-tile[data-item-id="res_bundle_wood_t1"]'));
  await page.evaluate(() => { window.__toasts.length = 0; });
  await page.fill('.inv-qty__num', '5');
  await page.dispatchEvent('.inv-qty__num', 'change');
  const manyLabel = await page.textContent('.inv-use-n');
  await page.click('.inv-use-n');
  await page.waitForFunction(() => window.__toasts.some(c => /toast-success/.test(c)), null, { timeout: 30_000 }).catch(() => {});
  const sameTile = await page.evaluate((h) => document.querySelector('.inv-tile[data-item-id="res_bundle_wood_t1"]').isSameNode(h), tileBefore);
  await page.waitForTimeout(500);
  const overflowPreview = await page.textContent('.inv-detail__preview');
  checks.push({
    label: 'use x5 patches tile in place',
    ok: /×5/.test(manyLabel) && sameTile && (await tileQty(page, 'res_bundle_wood_t1')) === '3'
      && await page.evaluate(() => window.__toasts.some(c => /toast-success/.test(c))),
  });

  checks.push({
    label: 'full storage preview shows requested amount and room per resource',
    ok: /^\+6,000 wood \(storage room: [\d,]+ wood\)$/.test(overflowPreview?.trim() ?? ''),
  });

  await page.fill('.inv-qty__num', '3');
  await page.dispatchEvent('.inv-qty__num', 'change');
  await page.click('.inv-use-n');
  await page.waitForTimeout(200);
  checks.push({
    label: 'selection moves when item runs out',
    ok: await page.evaluate(() => {
      const sel = document.querySelector('.inv-tile--selected');
      const empty = !document.querySelector('.inv-modal__empty').classList.contains('hidden');
      const gone = !document.querySelector('.inv-tile[data-item-id="res_bundle_wood_t1"]');
      const header = document.querySelector('.inv-detail__name')?.textContent;
      const movedOn = !!sel && sel.dataset.itemId !== 'res_bundle_wood_t1' && gone && header === sel.title;
      const emptyShown = empty && !!document.querySelector('.inv-modal__empty button') && !header;
      return movedOn || emptyShown;
    }),
  });

  await page.evaluate(() => window.game.inventory.addItem('res_bundle_stone_t1', 4));
  await page.waitForTimeout(150);
  await selectTile(page, 'res_bundle_stone_t1');
  await page.fill('.inv-qty__num', '3');
  await page.dispatchEvent('.inv-qty__num', 'change');
  await page.evaluate(() => window.game.inventory.addItem('res_bundle_wood_t1', 1));
  await page.waitForTimeout(150);
  const qtyKept = await page.inputValue('.inv-qty__num') === '3';
  await page.evaluate(() => window.game.inventory.removeItem('res_bundle_stone_t1', 2));
  await page.waitForTimeout(150);
  const qtyClamped = await page.inputValue('.inv-qty__num') === '2' && await page.inputValue('.inv-qty__slider') === '2';
  checks.push({
    label: 'quantity survives external update',
    ok: qtyKept && qtyClamped,
  });
  await closeInventory(page);

  const started = await page.evaluate(() => {
    const g = window.game;
    g.buildings.build('barracks');
    const job = g.buildings._buildQueue.find(q => q.endsAt != null);
    if (job) job.endsAt += 1e10;
    return !!job;
  });
  if (!started) console.log('  note: no build could start in the preset; speedup picker check will fail');
  await page.waitForTimeout(200);
  await openInventory(page);
  await page.click('.inv-rail__tab[data-tab="speedups"]');
  await selectTile(page, 'speedup_build_5m');
  await page.click('.inv-act-main');
  await page.waitForTimeout(200);
  checks.push({ label: 'speedup opens picker', ok: await page.locator('.speedup-picker--floating').isVisible().catch(() => false) });
  await page.evaluate(() => document.querySelector('.speedup-picker--floating')?.remove());
  await closeInventory(page);

  await page.evaluate(() => {
    window.game.buffs.activate('buff_prod_lg');
    window.game.inventory.addItem('buff_prod_sm', 1);
  });
  await openInventory(page);
  await page.click('.inv-rail__tab[data-tab="boosts"]');
  await selectTile(page, 'buff_prod_sm');
  const warnText = await page.textContent('.inv-detail__hint--warn');
  await page.click('.inv-act-main');
  await page.waitForSelector('.buff-confirm', { timeout: 3000 }).catch(() => {});
  const confirmAbove = await page.evaluate(() => {
    const c = document.querySelector('.buff-confirm');
    if (!c) return false;
    const r = c.getBoundingClientRect();
    return getComputedStyle(c).position === 'fixed' && r.width > 0
      && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.buff-confirm') === c;
  });
  checks.push({
    label: 'boost shows replace warning and confirm',
    ok: /replaces it/i.test(warnText ?? '') && confirmAbove,
  });
  await page.click('.buff-confirm [data-answer="keep"]');
  await closeInventory(page);

  await page.evaluate(() => { window.__toasts.length = 0; window.game.eventBus.emit('ui:navigateTo', 'economy'); });
  const tpUse = await page.evaluate(async () => {
    for (const category of ['boosts', 'heroes', 'speedups', 'resources', 'other']) {
      window.game.eventBus.emit('ui:openTradingTab', { tab: 'supply', category });
      await new Promise(r => setTimeout(r, 150));
      const btn = document.querySelector('.tp-card__use[data-item-id="xp_bundle_small"]');
      if (btn) { btn.click(); return true; }
    }
    return false;
  });
  await page.waitForTimeout(300);
  checks.push({
    label: 'trading post xp card routes to heroes',
    ok: tpUse && await page.locator('#inv-root').count() === 0
      && await page.evaluate(() => !document.getElementById('view-heroes').classList.contains('hidden')),
  });

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'base'));
  await dismissOverlays(page);
  await page.click('#btn-mail');
  await page.waitForSelector('#modal-overlay:not(.hidden)', { timeout: 3000 });
  await page.click('#btn-inventory');
  await page.waitForSelector('#inv-root', { timeout: 5000 }).catch(() => {});
  const queued = await page.evaluate(() => ({
    root: !!document.getElementById('inv-root'),
    tabs: document.querySelectorAll('#inv-root .inv-modal__rail [data-tab]').length,
    tiles: document.querySelectorAll('#inv-root .inv-tile').length,
  }));
  if (queued.tiles) await page.click('#inv-root .inv-tile >> nth=0');
  const selectable = queued.tiles ? await page.locator('.inv-tile--selected').count() === 1 : false;
  await page.evaluate(() => window.game.inventory.addItem('res_bundle_wood_t1', 1));
  await page.waitForTimeout(150);
  checks.push({ label: 'inventory from dock replaces mail, wired', ok: queued.root && queued.tabs === 6 && selectable });
  if (await page.locator('#inv-root').count()) await closeInventory(page);

  await page.evaluate(() => {
    window.game.inventory._items.clear();
    window.game.inventory.addItem('res_bundle_stone_t1', 1);
    window.game.inventory.removeItem('res_bundle_stone_t1', 1);
  });
  await openInventory(page);
  await page.click('.inv-rail__tab[data-tab="boosts"]');
  await page.evaluate(() => window.game.inventory.addItem('buff_prod_sm', 1));
  await page.waitForTimeout(150);
  checks.push({
    label: 'arrival in empty tab selects it',
    ok: await page.locator('.inv-tile--selected[data-item-id="buff_prod_sm"]').count() === 1
      && !!(await page.textContent('.inv-detail__name').catch(() => '')),
  });

  await page.click('.inv-rail__tab[data-tab="all"]');
  await page.evaluate(() => window.game.inventory.addItem('res_bundle_stone_t1', 1));
  await page.waitForTimeout(150);
  await selectTile(page, 'res_bundle_stone_t1');
  const boostsBefore = await page.evaluate(() => window.game.buffs.getBoosts().length);
  await page.dblclick('.inv-use-n');
  await page.waitForTimeout(700);
  const strayPanel = await page.locator('#buffs-panel.open').count() > 0;
  if (strayPanel) await page.evaluate(() => window.game.eventBus.emit('ui:openBuffs'));
  await page.waitForTimeout(300);
  checks.push({
    label: 'double click spends once',
    ok: await page.evaluate(() => window.game.inventory.getQuantity('res_bundle_stone_t1')) === 0
      && await page.evaluate(() => window.game.buffs.getBoosts().length) === boostsBefore
      && await page.evaluate(() => window.game.inventory.getQuantity('buff_prod_sm')) === 1
      && await page.locator('.buff-confirm').count() === 0 && !strayPanel,
  });
  await closeInventory(page);

  await openInventory(page);
  await page.evaluate(() => window.game.eventBus.emit('ui:openMail'));
  await page.waitForSelector('#mail-root', { timeout: 3000 }).catch(() => {});
  checks.push({
    label: 'mail replaces inventory and renders',
    ok: await page.evaluate(() => {
      const root = document.getElementById('mail-root');
      const host = document.getElementById('modal-content');
      return !!root && root.childElementCount > 0 && !host.classList.contains('inv-modal-host') && host.classList.contains('mail-modal');
    }),
  });
  await page.click('#modal-overlay .modal-close', { timeout: 2000 }).catch(() => {});

  await page.waitForSelector('#modal-overlay.hidden', { state: 'attached', timeout: 3000 }).catch(() => {});
  await page.click('#btn-inventory');
  await page.waitForSelector('#inv-root', { timeout: 3000 });
  await page.click('#btn-mail');
  await page.waitForTimeout(150);
  const swappedToMail = await page.evaluate(() => {
    const host = document.getElementById('modal-content');
    return !!document.getElementById('mail-root') && !document.getElementById('inv-root')
      && host.classList.contains('mail-modal') && !host.classList.contains('inv-modal-host');
  });
  await page.click('#btn-inventory');
  await page.waitForTimeout(150);
  const swappedToInventory = await page.evaluate(() => {
    const host = document.getElementById('modal-content');
    return !!document.getElementById('inv-root') && !document.getElementById('mail-root')
      && document.querySelectorAll('#inv-root .inv-modal__rail [data-tab]').length === 6
      && host.classList.contains('inv-modal-host') && !host.classList.contains('mail-modal');
  });
  await page.click('#btn-mail');
  await page.click('#btn-mail');
  await page.click('#btn-mail');
  await page.waitForTimeout(150);
  await page.click('#modal-overlay .modal-close', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(500);
  const nothingQueued = await page.evaluate(() => document.getElementById('modal-overlay').classList.contains('hidden'));
  checks.push({
    label: 'dock swaps mail and inventory without queueing',
    ok: swappedToMail && swappedToInventory && nothingQueued,
  });

  await page.evaluate(() => {
    const inv = window.game.inventory;
    inv._items.clear();
    inv.addItem('fragment_warlord', 3);
    inv.addItem('fragment_paladin', 3);
    inv.addItem('card_hero_kaelenthorne', 1);
    inv.addItem('card_hero_paladin', 1);
  });
  await openInventory(page);
  await page.click('.inv-rail__tab[data-tab="heroes"]');
  await selectTile(page, 'fragment_warlord');
  const ownedFrag = await page.evaluate(() => [...document.querySelectorAll('[data-act="goto-hero"]')].map(c => c.dataset.hero));
  await selectTile(page, 'fragment_paladin');
  const lockedFrag = await page.evaluate(() => ({
    chips: document.querySelectorAll('[data-act="goto-hero"]').length,
    hint: document.querySelector('.inv-detail__hint')?.textContent,
    recruit: !!document.querySelector('.inv-goto-recruit'),
    slider: !!document.querySelector('.inv-qty__slider'),
  }));
  checks.push({
    label: 'fragments only target their own hero, else show progress and recruit',
    ok: ownedFrag.length === 1 && ownedFrag[0] === 'warlord'
      && lockedFrag.chips === 0 && /3 \/ \d+/.test(lockedFrag.hint ?? '') && lockedFrag.recruit && !lockedFrag.slider,
  });
  await selectTile(page, 'card_hero_kaelenthorne');
  const ownedCard = await page.evaluate(() => {
    const b = document.querySelector('.inv-detail__acts button');
    return { text: b?.textContent, disabled: b?.disabled };
  });
  await selectTile(page, 'card_hero_paladin');
  const freshCard = await page.evaluate(() => document.querySelector('.inv-detail__acts button')?.disabled);
  checks.push({
    label: 'owned hero card is disabled, unowned stays recruitable',
    ok: ownedCard.text === 'Owned' && ownedCard.disabled === true && freshCard === false,
  });
  await page.setViewportSize({ width: 600, height: 800 });
  await page.waitForTimeout(200);
  await page.click('.inv-rail__tab[data-tab="all"]');
  await selectTile(page, 'fragment_warlord');
  const narrow = await page.evaluate(() => {
    const d = document.querySelector('.inv-modal__detail');
    const r = d.getBoundingClientRect();
    const btn = document.querySelector('[data-act="goto-hero"]');
    const b = btn.getBoundingClientRect();
    return {
      visible: r.width > 0 && r.height > 0,
      clickable: document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === btn,
    };
  });
  checks.push({ label: 'narrow viewport keeps detail usable', ok: narrow.visible && narrow.clickable });
  await page.setViewportSize({ width: 1280, height: 720 });
  await closeInventory(page);

  checks.push(...await inventoryRouteChecks(page));
  checks.push({ label: 'zero page errors', ok: errors.length === 0 });
  report('inventory-smoke', checks, errors);
});
