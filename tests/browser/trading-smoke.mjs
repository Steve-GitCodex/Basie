import { withPage, report, dismissOverlays } from './harness.mjs';

const waitGame = (page) => page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=tradingsmoke`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  await dismissOverlays(page);

  await page.evaluate(() => {
    window.__tpEvents = [];
    window.game.eventBus.on('tradingpost:tabShown', ({ id }) => window.__tpEvents.push('+' + id));
    window.game.eventBus.on('tradingpost:tabHidden', ({ id }) => window.__tpEvents.push('-' + id));
    window.game.eventBus.emit('ui:navigateTo', 'economy');
  });
  await page.waitForTimeout(200);

  const opened = await page.evaluate(() => {
    const sub = document.getElementById('sub-view-trading');
    const view = document.getElementById('view-economy');
    return !!sub && !sub.classList.contains('hidden') && !view.classList.contains('hidden');
  });
  const subBarVisible = await page.evaluate(() => {
    const bar = document.querySelector('#view-economy .sub-tab-bar');
    return !!bar && bar.offsetParent !== null;
  });
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.tp__tab')].map(t => t.dataset.tab));
  const traderDotFresh = await page.evaluate(() => {
    const dot = document.querySelector('.tp__tab[data-tab="market"] .tp-dot');
    return !!dot && !dot.classList.contains('hidden');
  });
  const walletOk = await page.evaluate(() =>
    /🪙/.test(document.querySelector('.tp__coin--money')?.textContent ?? '') &&
    /💎/.test(document.querySelector('.tp__coin--diamond')?.textContent ?? ''));

  const bareButtons = await page.evaluate(() => [...document.querySelectorAll('#trading-post-root button.btn')]
    .filter(b => b.offsetParent !== null)
    .filter(b => {
      const cs = getComputedStyle(b);
      const noFill = cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none';
      const noBorder = parseFloat(cs.borderTopWidth) === 0 || cs.borderTopColor === 'rgba(0, 0, 0, 0)';
      return noFill && noBorder;
    })
    .map(b => b.className));

  const pairedBefore = await page.evaluate(() => window.__tpEvents.join());
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'economy'));
  await page.click('.tp__tab--active');
  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'supply' }));
  const pairedAfter = await page.evaluate(() => window.__tpEvents.join());
  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'premium' }));
  const switchEvents = await page.evaluate(() => window.__tpEvents.join());
  const premiumSelected = await page.evaluate(() =>
    document.querySelector('.tp__tab--active')?.dataset.tab === 'premium');

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'base'));
  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'supply', category: 'speedups' }));
  await page.waitForTimeout(200);
  const coldOpen = await page.evaluate(() => ({
    shown: !document.getElementById('view-economy').classList.contains('hidden'),
    tab: document.querySelector('.tp__tab--active')?.dataset.tab,
  }));

  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'supply' }));
  await page.waitForTimeout(200);
  const supply = await page.evaluate(() => {
    const rows = (sel) => {
      const tops = {};
      document.querySelectorAll(sel).forEach(c => { tops[c.offsetTop] = (tops[c.offsetTop] ?? 0) + 1; });
      return Math.max(0, ...Object.values(tops));
    };
    return {
      forYou: document.querySelectorAll('.tp-foryou .tp-card').length,
      forYouRow: rows('.tp-foryou .tp-card'),
      gridRow: rows('.tp-supply__grid .tp-card'),
    };
  });

  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'supply', category: 'boosts' }));
  await page.waitForTimeout(100);
  const owned = () => page.evaluate(() => {
    const el = document.querySelector('.tp-supply__grid [data-entry-id="xp_bundle_small"] .tp-card__owned');
    return el ? Number(el.textContent.match(/\d+/)?.[0]) : null;
  });
  const ownedBefore = await owned();
  await page.evaluate(() => document.querySelector('.tp-supply__grid [data-entry-id="xp_bundle_small"] .tp-card__buy').click());
  await page.waitForTimeout(150);
  const ownedAfter = await owned();

  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'supply', category: 'speedups' }));
  await page.waitForTimeout(100);
  const switchVisible = await page.evaluate(() => {
    const el = document.querySelector('.tp-supply__types');
    return !!el && !el.classList.contains('hidden') && el.offsetParent !== null;
  });
  const universal1h = await page.evaluate(() => !!document.querySelector('.tp-supply__grid [data-entry-id="speedup_universal_1h"]'));
  await page.evaluate(() => document.querySelector('.tp-supply__types [data-speedup-type="train"]').click());
  await page.waitForTimeout(100);
  const trainIds = await page.evaluate(() =>
    [...document.querySelectorAll('.tp-supply__grid .tp-card')].map(c => c.dataset.entryId));

  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'premium' }));
  await page.waitForTimeout(200);
  const diamonds = () => page.evaluate(() => window.game.resources.getSnapshot().diamond.amount);
  const vipText = () => page.evaluate(() => document.querySelector('.tp-vip')?.textContent.replace(/\s+/g, ' ').trim() ?? null);
  const click = (sel) => page.evaluate((q) => document.querySelector(q)?.click(), sel);
  const testStrips = await page.evaluate(() => document.querySelectorAll('.tp-testmode').length);
  const packCount = await page.evaluate(() => document.querySelectorAll('.tp-pack').length);
  const popularOn = await page.evaluate(() => document.querySelector('.tp-pack[data-pack-id="diamonds_500"] .tp-pack__ribbon')?.textContent ?? null);
  const vipBefore = await vipText();
  const diamondsBefore = await diamonds();
  const grantMult = await page.evaluate(() => (window.game.resources._gameMode === 'sandbox' ? 10 : 1));
  await click('.tp-pack[data-pack-id="diamonds_100"] .tp-pack__buy');
  await page.waitForTimeout(100);
  const sheetStep1 = await page.evaluate(() => ({
    step: document.querySelector('.tp-sheet')?.dataset.step,
    close: !!document.querySelector('.tp-sheet__close'),
    diamondsHeld: window.game.resources.getSnapshot().diamond.amount,
  }));
  await click('.tp-sheet__next');
  await page.waitForTimeout(100);
  const sheetStep2 = await page.evaluate(() => ({
    step: document.querySelector('.tp-sheet')?.dataset.step,
    confirmText: document.querySelector('.tp-sheet__confirm')?.textContent.trim(),
    cancelText: document.querySelector('.tp-sheet__cancel')?.textContent.trim(),
    diamondsHeld: window.game.resources.getSnapshot().diamond.amount,
  }));
  await click('.tp-sheet__confirm');
  await page.waitForTimeout(150);
  const sheetStep3 = await page.evaluate(() => document.querySelector('.tp-sheet')?.dataset.step);
  const diamondsAfter = await diamonds();
  await click('.tp-sheet__done');
  await page.waitForTimeout(100);
  const sheetGone = await page.evaluate(() => !document.querySelector('.tp-sheet'));
  const vipAfter = await vipText();

  const closeVia = async (how) => {
    const before = await diamonds();
    await click('.tp-pack[data-pack-id="diamonds_100"] .tp-pack__buy');
    await page.waitForTimeout(80);
    if (how === 'escape') await page.keyboard.press('Escape');
    else await click(how);
    await page.waitForTimeout(80);
    return (await page.evaluate(() => !document.querySelector('.tp-sheet'))) && (await diamonds()) === before;
  };
  const closedByX = await closeVia('.tp-sheet__close');
  const closedByCancel = await closeVia('.tp-sheet__cancel');
  const closedByEscape = await closeVia('escape');
  const sheetZ = await (async () => {
    await click('.tp-pack[data-pack-id="diamonds_100"] .tp-pack__buy');
    const z = await page.evaluate(() => {
      const nav = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--z-nav'), 10);
      return { sheet: Number(getComputedStyle(document.querySelector('.tp-sheet-shade')).zIndex), nav };
    });
    await click('.tp-sheet__close');
    return z.sheet > z.nav;
  })();

  await page.evaluate(() => window.game.resources.add({ diamond: 2000 }));
  await page.waitForTimeout(100);
  const spentBefore = await page.evaluate(() => window.game.user.getProfile().stats.diamondsSpent);
  const unlockSel = '.tp-unlocks [data-entry-id="build_queue_expansion"] .tp-card__buy';
  await click(unlockSel);
  await page.waitForTimeout(150);
  await click(unlockSel);
  await page.waitForTimeout(150);
  const unlock = await page.evaluate((q) => ({
    label: document.querySelector(q)?.textContent.trim(),
    disabled: document.querySelector(q)?.disabled,
    spent: window.game.user.getProfile().stats.diamondsSpent,
  }), unlockSel);

  const lockState = () => page.evaluate(() => ({
    locked: !document.querySelector('.tp__locked').classList.contains('hidden'),
    reason: document.querySelector('.tp__locked-reason').textContent,
    paneHidden: document.querySelector('.tp__pane[data-tab="market"]')?.classList.contains('hidden') ?? null,
  }));
  await page.evaluate(() => {
    window.game.buildings.devSetLevel('townhall', 1);
    window.game.resources.add({ wood: 1 });
    window.game.eventBus.emit('ui:openTradingTab', { tab: 'exchange' });
  });
  await page.waitForTimeout(150);
  const hq1 = await page.evaluate(() => window.game.buildings.getHQLevel());
  const lockedAtHq1 = await lockState();
  await page.waitForTimeout(700);
  const traderDotAtHq1 = await page.evaluate(() => {
    const dot = document.querySelector('.tp__tab[data-tab="market"] .tp-dot');
    const nav = document.getElementById('nav-economy');
    return { tab: !!dot && !dot.classList.contains('hidden'), nav: nav?.classList.contains('tab-has-badge') };
  });
  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'supply' }));
  await page.evaluate(() => {
    window.game.buildings.devSetLevel('townhall', 2);
    window.game.resources.add({ wood: 1 });
  });
  await page.waitForTimeout(700);
  const hq2 = await page.evaluate(() => window.game.buildings.getHQLevel());
  const marketDot = () => page.evaluate(() => {
    const dot = document.querySelector('.tp__tab[data-tab="market"] .tp-dot');
    return !!dot && !dot.classList.contains('hidden');
  });
  const traderDotAtHq2 = await marketDot();
  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'exchange' }));
  await page.waitForTimeout(150);
  const traderDotAfterOpen = await marketDot();
  const unlockedAtHq2 = await lockState();
  const sharedPane = await page.evaluate(() => {
    const pane = document.querySelector('.tp__pane[data-tab="market"]');
    return !!pane?.querySelector('.tp-exchange') && !!pane?.querySelector('.tp-trader');
  });

  await page.evaluate(() => {
    const rm = window.game.resources;
    window.game.engine.setGameMode('campaign');
    rm.add({ wood: 5000 });
    const stone = rm.getSnapshot().stone.amount;
    if (stone > 0) rm.spend({ stone });
  });
  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'exchange' }));
  await page.waitForTimeout(150);
  const setSlider = (v) => page.evaluate((val) => {
    const el = document.querySelector('.tp-exchange__slider');
    el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  await page.click('.tp-exchange__chip[data-side="give"][data-res="wood"]');
  await page.click('.tp-exchange__chip[data-side="get"][data-res="stone"]');
  const getChipDisabled = await page.evaluate(() => document.querySelector('.tp-exchange__chip[data-side="get"][data-res="wood"]')?.disabled);
  const tradeAtZero = await page.evaluate(() => document.querySelector('.tp-exchange__trade')?.disabled);
  await setSlider(1000);
  const trade = await page.evaluate(() => {
    const rm = window.game.resources;
    const held = () => ({ wood: rm.getSnapshot().wood.amount, stone: rm.getSnapshot().stone.amount });
    const before = held();
    const gain = Number(document.querySelector('.tp-exchange__get').dataset.amount);
    document.querySelector('.tp-exchange__trade').click();
    const after = held();
    return { woodDelta: before.wood - after.wood, stoneDelta: after.stone - before.stone, gain };
  });
  await page.waitForTimeout(150);
  const meterAfter = await page.evaluate(() => document.querySelectorAll('.tp-exchange__meter i.tp-exchange__seg--on').length);
  await setSlider(1000);
  await page.evaluate(() => {
    const rm = window.game.resources;
    rm.spend({ wood: rm.getSnapshot().wood.amount - 100 });
  });
  await page.waitForTimeout(150);
  const clamp = await page.evaluate(() => {
    const el = document.querySelector('.tp-exchange__slider');
    return { max: Number(el.max), value: Number(el.value) };
  });

  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'supply' }));
  await page.waitForTimeout(200);
  const dotVisible = () => page.evaluate(() => {
    const dot = document.querySelector('.tp__tab[data-tab="supply"] .tp-dot');
    return !!dot && !dot.classList.contains('hidden');
  });
  const crateBefore = await page.evaluate(() => {
    const g = window.game;
    window.__crate = null;
    g.eventBus.on('shop:crateClaimed', ({ result }) => { window.__crate = result; });
    ['wood', 'stone', 'food', 'water', 'iron', 'money'].forEach(k => g.resources.setCap(k, 1e9));
    const snap = g.resources.getSnapshot();
    return {
      amounts: Object.fromEntries(Object.entries(snap).map(([k, v]) => [k, v.amount])),
      claimDisabled: document.querySelector('.tp-crate__claim')?.disabled,
    };
  });
  const dotBeforeClaim = await dotVisible();
  await page.evaluate(() => document.querySelector('.tp-crate__claim').click());
  await page.waitForTimeout(150);
  const crateAfter = await page.evaluate((before) => {
    const g = window.game;
    const result = window.__crate;
    const snap = g.resources.getSnapshot();
    const gainedRes = result?.grants ? Object.keys(result.grants).some(k => snap[k].amount > before.amounts[k]) : false;
    return {
      result,
      increased: result?.itemId ? g.inventory.getQuantity(result.itemId) >= 1 : gainedRes,
      reveal: !!document.querySelector('.tp-crate__reveal'),
      revealShowsApplied: Object.entries(result?.applied ?? {}).every(([, n]) => document.querySelector('.tp-crate__reveal')?.textContent.includes(String(Math.floor(n)))),
      claimDisabled: document.querySelector('.tp-crate__claim')?.disabled,
      timer: document.querySelector('.tp-crate__timer')?.textContent,
    };
  }, crateBefore);
  const dotAfterClaim = await dotVisible();
  await page.evaluate(() => document.querySelector('.tp-sheet__done')?.click());

  await page.evaluate(() => {
    ['wood', 'stone', 'food', 'water', 'iron'].forEach(k => window.game.resources.add({ [k]: 100000 }));
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'trader' }));
  await page.waitForTimeout(200);
  const traderCards = await page.evaluate(() => document.querySelectorAll('.tp-trader__grid .tp-card').length);
  const traderTimer = await page.evaluate(() => document.querySelector('.tp-trader__timer')?.textContent);
  const buyable = '.tp-trader__grid .tp-card:not(:has(.tp-card__buy:disabled)) ';
  const traderOwned = () => page.evaluate((sel) => {
    const card = document.querySelector(sel);
    return { slotId: card?.dataset.entryId, itemId: card?.dataset.itemId, owned: Number(card?.querySelector('.tp-card__owned')?.textContent.match(/\d+/)?.[0]) };
  }, '.tp-trader__grid .tp-card:not(:has(.tp-card__buy:disabled))');
  const traderBefore = await traderOwned();
  await page.evaluate((sel) => document.querySelector(sel + '.tp-card__buy').click(), buyable);
  await page.waitForTimeout(200);
  const traderBought = await page.evaluate((id) => {
    const card = document.querySelector('.tp-trader__grid [data-entry-id="' + id + '"]');
    return { label: card?.querySelector('.tp-card__buy')?.textContent.trim(), disabled: card?.querySelector('.tp-card__buy')?.disabled, owned: Number(card?.querySelector('.tp-card__owned')?.textContent.match(/\d+/)?.[0]) };
  }, traderBefore.slotId);
  const stockBefore = await page.evaluate(() => window.game.trader.getState().stock.map(s => s.slotId + ':' + s.sold).join());
  await page.evaluate(() => window.game.save());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  const stockAfter = await page.evaluate(() => window.game.trader.getState().stock.map(s => s.slotId + ':' + s.sold).join());
  const dotAfterReload = await page.evaluate(() => window.game.trader.getState().hasNew);

  await page.evaluate(() => window.game.eventBus.emit('ui:openTradingTab', { tab: 'market' }));
  const sidebarClearance = async (open) => {
    await page.evaluate((o) => document.getElementById('bq-sidebar').classList.toggle('is-collapsed', !o), open);
    await page.waitForTimeout(450);
    return page.evaluate(() => {
      const right = Math.max(...[...document.querySelectorAll('#trading-post-root .tp-card, #trading-post-root .tp-exchange')]
        .filter(el => el.offsetParent !== null).map(el => el.getBoundingClientRect().right));
      const edge = document.getElementById('bq-toggle').getBoundingClientRect().left;
      return { right, edge };
    });
  };
  const clearOpen = await sidebarClearance(true);
  const chipOverflow = await page.evaluate(() => {
    const panel = document.querySelector('#trading-post-root .tp-exchange').getBoundingClientRect();
    return [...document.querySelectorAll('#trading-post-root .tp-exchange__chip')]
      .filter(c => c.getBoundingClientRect().right > panel.right + 0.5).length;
  });
  const clearCollapsed = await sidebarClearance(false);

  report('trading-smoke', [
    { label: `content clears the open queue sidebar (right ${clearOpen.right} ≤ ${clearOpen.edge})`, ok: clearOpen.right <= clearOpen.edge },
    { label: `exchange chips stay inside the Exchange panel with the sidebar open (${chipOverflow} overflow)`, ok: chipOverflow === 0 },
    { label: `content clears the collapsed queue-sidebar tab (right ${clearCollapsed.right} ≤ ${clearCollapsed.edge})`, ok: clearCollapsed.right <= clearCollapsed.edge },
    { label: 'economy nav opens #sub-view-trading', ok: opened },
    { label: 'no .sub-tab-bar visible for economy', ok: !subBarVisible },
    { label: 'shell shows registered tabs in order', ok: tabs.join() === 'supply,market,premium' },
    { label: 'wallet shows coins and diamonds', ok: walletOk },
    { label: `every visible Supply button has a fill or border (bare: ${[...new Set(bareButtons)].join(' | ') || 'none'})`, ok: bareButtons.length === 0 },
    { label: 'first view show fires onShow once', ok: pairedBefore === '+supply' },
    { label: 're-entering economy, re-clicking active tab, re-opening same tab do not repeat onShow', ok: pairedAfter === pairedBefore },
    { label: 'switching tab pairs onHide with next onShow', ok: switchEvents === '+supply,-supply,+premium' },
    { label: 'ui:openTradingTab {tab:premium} selects premium tab', ok: premiumSelected },
    { label: 'ui:openTradingTab from another view navigates and selects tab', ok: coldOpen.shown && coldOpen.tab === 'supply' },
    { label: 'supply renders ≤ 8 cards per row and a For you row', ok: supply.forYou > 0 && supply.forYouRow <= 8 && supply.gridRow <= 8 },
    { label: 'buying xp_bundle_small raises its owned count by 1', ok: ownedBefore !== null && ownedAfter === ownedBefore + 1 },
    { label: 'ui:openTradingTab {tab:supply,category:speedups} shows the speed-up switch', ok: switchVisible && universal1h },
    { label: 'speed-up type switch to Train changes the 1 hour card entryId to speedup_train_1h', ok: trainIds.length === 5 && trainIds.includes('speedup_train_1h') && !trainIds.includes('speedup_universal_1h') },
    { label: 'test-mode strip present exactly once', ok: testStrips === 1 },
    { label: 'premium shows 5 pack cards, 500 pack badged Popular', ok: packCount === 5 && /popular/i.test(popularOn ?? '') },
    { label: 'checkout steps pack -> confirm (Confirm purchase / Cancel, visible close) with no grant before confirm', ok: sheetStep1.step === 'summary' && sheetStep1.close && sheetStep2.step === 'confirm' && sheetStep2.confirmText === 'Confirm purchase' && sheetStep2.cancelText === 'Cancel' && sheetStep1.diamondsHeld === diamondsBefore && sheetStep2.diamondsHeld === diamondsBefore },
    { label: 'checkout on diamonds_100 reaches receipt and diamonds rise by 100', ok: sheetStep3 === 'receipt' && diamondsAfter === diamondsBefore + 100 * grantMult && sheetGone },
    { label: 'VIP bar value unchanged after a pack purchase', ok: !!vipBefore && vipBefore === vipAfter },
    { label: 'buying build_queue_expansion twice leaves the card Purchased and spends 800 once', ok: unlock.label === 'Owned' && unlock.disabled === true && unlock.spent - spentBefore === 800 },
    { label: 'close X, Cancel and Escape each dismiss the sheet without granting diamonds', ok: closedByX && closedByCancel && closedByEscape },
    { label: 'checkout sheet stacks above the nav layer', ok: sheetZ },
    { label: 'locked card shown with HQ reason when HQ < 2', ok: hq1 === 1 && lockedAtHq1.locked && /Level 2/.test(lockedAtHq1.reason) && lockedAtHq1.paneHidden },
    { label: 'Exchange and Wandering Trader share the Market tab', ok: sharedPane },
    { label: 'exchange unlocks live when HQ reaches 2', ok: hq2 === 2 && !unlockedAtHq2.locked && unlockedAtHq2.paneHidden === false },
    { label: 'exchange get chip equal to give is disabled and Trade is disabled at slider 0', ok: getChipDisabled === true && tradeAtZero === true },
    { label: 'exchange wood->stone at slider 1000 lowers wood by 1000 and raises stone by the readout amount', ok: trade.woodDelta === 1000 && trade.gain > 0 && trade.stoneDelta === trade.gain },
    { label: 'pressure meter lights at least one segment after a trade', ok: meterAfter >= 1 },
    { label: 'after setting wood to 100 via rm while slider is at 1000, slider max is 100', ok: clamp.max === 100 && clamp.value === 100 },
    { label: 'claim clears the Supply dot, reveals the drop and inventory or resources increase', ok: crateBefore.claimDisabled === false && dotBeforeClaim && !dotAfterClaim && crateAfter.reveal && crateAfter.revealShowsApplied && crateAfter.increased && crateAfter.claimDisabled === true && /Resets in \d\d:\d\d:\d\d/.test(crateAfter.timer) },
    { label: 'trader dot visible on fresh boot', ok: traderDotFresh },
    { label: 'trader dot hidden while HQ < 2 (locked tab)', ok: hq1 === 1 && !traderDotAtHq1.tab },
    { label: 'market dot visible once HQ 2 unlocks the tab (trader arrived, unseen)', ok: traderDotAtHq2 },
    { label: 'opening Market clears the trader dot', ok: traderDotAtHq2 && !traderDotAfterOpen && traderCards === 6 && /^leaves in \d\d:\d\d:\d\d$/.test(traderTimer ?? '') },
    { label: 'buying the first affordable slot shows Sold and owned count rises', ok: !!traderBefore.slotId && traderBought.label === 'Sold' && traderBought.disabled === true && traderBought.owned === traderBefore.owned + 1 },
    { label: 'trader state survives save + reload (same slotIds, sold flag kept)', ok: stockBefore.split(',').length === 6 && stockBefore === stockAfter && stockAfter.includes(traderBefore.slotId + ':true') && dotAfterReload === false },
  ], errors);
});
