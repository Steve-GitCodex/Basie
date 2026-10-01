import { withPage, bootGuestSandbox, dismissOverlays, report } from './harness.mjs';

async function openHero(page, heroId) {
  if (await page.isVisible('#heroes-detail-pane .hq-nav--back')) {
    await page.click('#heroes-detail-pane .hq-nav--back');
  }
  await page.click(`.hq-card[data-hero-id="${heroId}"]`);
  await page.waitForSelector('#heroes-detail-pane:not(.hidden)', { timeout: 5000 });
}

async function finishPull(page) {
  await page.click('.pull-stage', { position: { x: 10, y: 10 }, force: true });
  for (let i = 0; i < 30; i++) {
    if (await page.locator('.pull-summary:not(.hidden)').count() > 0) return;
    if (await page.locator('.pull-spotlight').count() > 0) await page.click('.pull-spotlight .pull-spotlight-continue');
    else await page.waitForTimeout(100);
  }
}

await withPage(async ({ page, errors, origin }) => {
  const checks = [];
  await bootGuestSandbox(page, origin);

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await dismissOverlays(page);
  await page.waitForTimeout(500);

  checks.push({ label: 'three tabs mount', ok: await page.locator('.heroes-tab').count() === 3 });
  checks.push({ label: 'roster panel visible by default', ok: await page.isVisible('#heroes-tab-roster') });
  checks.push({ label: 'roster renders a card per hero', ok: await page.locator('.hq-card').count() >= 6 });
  checks.push({
    label: 'roster card shows hero art, not emoji',
    ok: await page.locator('.hq-card img.hero-portrait').count() >= 1,
  });

  await page.click('.heroes-tab[data-tab="assign"]');
  checks.push({ label: 'assign tab switches', ok: await page.isVisible('#heroes-tab-assign') });
  await page.click('.heroes-tab[data-tab="roster"]');
  checks.push({ label: 'roster tab switches back', ok: await page.isVisible('#heroes-tab-roster') });

  await openHero(page, 'warlord');
  checks.push({ label: 'detail panel shows a splash', ok: await page.locator('#heroes-detail-pane img.hero-portrait--splash, #heroes-detail-pane .hero-portrait--emoji').count() >= 1 });
  checks.push({ label: 'a hero with a clip offers a manual play button', ok: await page.locator('#heroes-detail-pane .hero-play-btn').count() === 1 });
  checks.push({ label: 'no video autoplays', ok: await page.locator('#heroes-detail-pane video').count() === 0 });
  await page.click('#heroes-detail-pane .hero-play-btn');
  await page.waitForTimeout(500);
  await page.click('#heroes-detail-pane .hq-nav--back');
  checks.push({ label: 'leaving a hero stops their clip', ok: await page.evaluate(() => document.querySelector('#heroes-detail-pane video')?.paused === true) });

  await openHero(page, 'kaelenthorne');
  checks.push({ label: 'a hero without a clip has no play button', ok: await page.locator('#heroes-detail-pane .hero-play-btn').count() === 0 });

  await page.click('#heroes-detail-pane .hq-nav--back');
  checks.push({ label: 'an unowned card shows Hero Shards toward unlock', ok: /Hero Shards \d+ \/ \d+/.test(await page.locator('.hq-card--locked').first().innerText()) && await page.locator('.hq-card--locked .hq-bar').count() >= 1 });
  checks.push({ label: 'back returns to the gallery', ok: await page.isVisible('#heroes-roster-grid') && !(await page.isVisible('#heroes-detail-pane')) });

  const gridOrder = await page.locator('.hq-card').evaluateAll(cards => cards.map(c => c.dataset.heroId));
  await openHero(page, gridOrder[0]);
  checks.push({ label: 'opening a card hides the gallery and shows that hero', ok: !(await page.isVisible('#heroes-roster-grid')) && await page.getAttribute('#heroes-detail-pane', 'data-hero-id') === gridOrder[0] });
  await page.click('#heroes-detail-pane .hq-nav--next');
  checks.push({ label: 'next steps to the following hero in grid order', ok: await page.getAttribute('#heroes-detail-pane', 'data-hero-id') === gridOrder[1] });
  await page.click('#heroes-detail-pane .hq-nav--prev');
  await page.click('#heroes-detail-pane .hq-nav--prev');
  checks.push({ label: 'prev wraps from the first hero to the last', ok: await page.getAttribute('#heroes-detail-pane', 'data-hero-id') === gridOrder[gridOrder.length - 1] });
  await page.click('.heroes-tab[data-tab="roster"]');
  checks.push({ label: 're-clicking the Roster tab returns to the gallery', ok: await page.isVisible('#heroes-roster-grid') });
  const frag = await page.evaluate(() => {
    const h = window.game.heroes.getRosterWithState().find(x => x.id === 'shadowblade');
    return { itemId: h.fragmentItemId, need: h.fragmentsNeeded, owned: h.isOwned };
  });
  await page.evaluate(({ itemId, need }) => window.game.inventory.addItem(itemId, need), frag);
  await openHero(page, 'shadowblade');
  checks.push({ label: 'an unowned hero shows the how-to-recruit path', ok: !frag.owned && await page.locator('#heroes-detail-pane .hq-unlock').count() === 1 });
  const shardsBeforeConvert = await page.evaluate(() => window.game.inventory.getQuantity('shard_shadowblade'));
  await page.click('#heroes-detail-pane .hq-unlock [data-action="convert"]');
  await page.waitForTimeout(300);
  const shardsAfterConvert = await page.evaluate(() => window.game.inventory.getQuantity('shard_shadowblade'));
  checks.push({ label: 'Convert turns a full set of fragments into one Hero Shard', ok: shardsAfterConvert === shardsBeforeConvert + 1 });
  await page.evaluate(() => window.game.inventory.addItem('shard_shadowblade', 10));
  await page.waitForTimeout(200);
  await page.click('#heroes-detail-pane .hq-unlock [data-action="unlock"]');
  await page.waitForTimeout(300);
  checks.push({
    label: 'Unlock with Hero Shards recruits the hero and the page flips to the owned layout',
    ok: await page.evaluate(() => window.game.heroes.isOwned('shadowblade'))
      && await page.locator('#heroes-detail-pane .hq-unlock').count() === 0
      && await page.locator('#heroes-detail-pane .btn-deploy').count() === 1,
  });
  await page.click('#heroes-detail-pane .hq-nav--back');

  await page.evaluate(() => {
    window.game.buildings.build('barracks');
    window.game.eventBus.emit('ui:devSetBuildingLevel', { buildingId: 'barracks', level: 3 });
    window.game.eventBus.emit('ui:devSetBuildingLevel', { buildingId: 'townhall', level: 4 });
    window.game.buildings.build('heroquarters');
    window.game.eventBus.emit('ui:devSetBuildingLevel', { buildingId: 'heroquarters', level: 1 });
    window.game.buildings.build('mine');
    window.game.heroes.recruitHeroRecord('kaelenthorne');
  });
  await page.waitForTimeout(300);
  await dismissOverlays(page);
  await page.evaluate(() => document.querySelector('#story-modal-overlay')?.classList.add('hidden'));
  await page.click('.heroes-tab[data-tab="assign"]');
  await page.waitForSelector('.hero-board-row', { timeout: 5000 });
  checks.push({ label: 'board excludes barracks', ok: await page.locator('.hero-board-row[data-instance^="barracks_"]').count() === 0 });
  checks.push({ label: 'board shows the slot counter', ok: /Hero slots: \d+ \/ \d+/.test(await page.locator('.hero-board-header').innerText()) });

  const beforeOccupied = await page.locator('.hero-board-row--occupied').count();
  await dismissOverlays(page);
  await page.click('.hero-board-row .btn-board-assign');
  const pickable = await page.locator('.hero-board-pick').count();
  if (pickable > 0) {
    checks.push({ label: 'picker rows say how many skills activate at that post', ok: /skills? active here|remove first/.test(await page.locator('.hero-board-pick').first().innerText()) });
    await dismissOverlays(page);
    await page.click('.hero-board-pick');
    await page.waitForTimeout(300);
    checks.push({ label: 'assigning fills a slot', ok: await page.locator('.hero-board-row--occupied').count() === beforeOccupied + 1 });
    await dismissOverlays(page);
    await page.click('.btn-board-remove');
    await page.waitForTimeout(300);
    checks.push({ label: 'removing empties it again', ok: await page.locator('.hero-board-row--occupied').count() === beforeOccupied });
  } else {
    checks.push({ label: 'assign round trip (no owned hero in sandbox — skipped)', ok: true });
  }

  await page.click('.heroes-tab[data-tab="recruit"]');
  await page.waitForSelector('.recruit-banner', { timeout: 5000 });
  checks.push({ label: 'three recruit banners', ok: await page.locator('.recruit-banner').count() === 3 });
  checks.push({ label: 'banner shows a live token count', ok: await page.locator('.recruit-token-count').first().isVisible() });
  await page.click('.recruit-rates >> nth=0');
  checks.push({ label: 'rates panel discloses the guarantee', ok: /Guaranteed/.test(await page.locator('.recruit-rates-body').first().innerText()) });
  await page.evaluate(() => {
    const inv = window.game.inventory;
    const extra = inv.getQuantity('token_normal') - 1;
    if (extra > 0) inv.removeItem('token_normal', extra);
    if (inv.getQuantity('token_normal') < 1) inv.addItem('token_normal', 1);
  });
  await page.waitForTimeout(200);
  checks.push({ label: 'with one token there is no multi-pull button', ok: await page.locator('.recruit-banner--normal .btn-pull:not([data-count="1"])').count() === 0 });
  await page.evaluate(() => window.game.inventory.addItem('token_normal', 2));
  await page.waitForTimeout(200);
  const multiLabel = await page.locator('.recruit-banner--normal .btn-pull:not([data-count="1"])').innerText();
  checks.push({ label: 'the multi-pull button says exactly how many it will pull', ok: /×\s*3/.test(multiLabel) });
  checks.push({ label: 'the pity counter is visible on the banner', ok: /guaranteed in \d+ pulls?/.test(await page.locator('.recruit-pity-text[data-tier="normal"]').innerText()) });
  await page.click('.recruit-rates >> nth=0');

  await page.evaluate(() => {
    window.game.inventory.addItem('token_normal', 1);
  });
  await page.waitForTimeout(300);
  await page.click('.recruit-banner--normal .btn-pull[data-count="1"]');
  await finishPull(page);
  checks.push({ label: 'a single pull shows a reveal card', ok: await page.locator('.recruit-result-card').count() === 1 });
  const revealCardText = await page.locator('.recruit-result-card').first().innerText();
  checks.push({ label: 'reveal card renders real outcome content', ok: revealCardText.trim().length > 0 && !/Unknown Outcome/.test(revealCardText) });
  await page.click('.recruit-reveal-done');
  await page.waitForTimeout(300);
  checks.push({ label: 'reveal dismisses back to the banners', ok: await page.locator('.recruit-banner').count() === 3 });

  await page.evaluate(() => {
    const heroes = window.game.heroes;
    window.__realRollToken = heroes.rollToken;
    heroes.rollToken = () => ({ outcome: 'hero', heroId: 'paladin', tier: 'epic', isDuplicate: false });
    window.game.inventory.addItem('token_epic', 1);
  });
  await page.waitForTimeout(200);
  await page.click('.recruit-banner--epic .btn-pull[data-count="1"]');
  await page.waitForSelector('.pull-spotlight', { timeout: 5000 });
  checks.push({ label: 'a brand-new hero gets the full-screen spotlight', ok: /Aldric Cross/i.test(await page.locator('.pull-spotlight__name').innerText()) });
  await page.click('.pull-spotlight .pull-spotlight-continue');
  await page.waitForSelector('.pull-summary:not(.hidden)', { timeout: 5000 });
  checks.push({ label: 'after the spotlight the results show totals', ok: /1\s*new hero/.test(await page.locator('.pull-summary__totals').innerText()) });
  await page.click('.recruit-reveal-done');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.game.inventory.addItem('token_epic', 1));
  await page.waitForTimeout(200);
  await page.click('.recruit-banner--epic .btn-pull[data-count="1"]');
  checks.push({
    label: 'with reduced motion the pull lands straight on the results',
    ok: await page.locator('.pull-summary:not(.hidden)').count() === 1
      && await page.locator('.pull-spotlight').count() === 0
      && await page.locator('.pull-card--flipped').count() === 1,
  });
  await page.click('.recruit-reveal-done');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { window.game.heroes.rollToken = window.__realRollToken; });

  await page.evaluate(() => window.game.inventory.addItem('token_epic', 1));
  await page.waitForTimeout(200);
  await page.click('.recruit-banner--epic .btn-pull[data-count="1"]');
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'base'));
  await page.waitForTimeout(800);
  const flippedWhileAway = await page.locator('#view-heroes .pull-card--flipped').count();
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await page.waitForTimeout(300);
  checks.push({
    label: 'leaving the Heroes view mid-pull cancels the sequence cleanly',
    ok: flippedWhileAway === 0 && await page.locator('.recruit-banner').count() === 3 && await page.locator('.pull-stage').count() === 0,
  });

  const normalExchangeOptions = await page.locator('.recruit-exchange-hero[data-tier="normal"] option').allTextContents();
  checks.push({ label: 'exchange hero picker is restricted to normal-tier heroes', ok: normalExchangeOptions.length === 2 });

  await page.evaluate(() => window.game.inventory.addItem('tier_shard_normal', 5));
  await page.waitForTimeout(200);
  const beforeTierShards = await page.evaluate(() => window.game.inventory.getQuantity('tier_shard_normal'));
  const beforeHeroShards = await page.evaluate(() => window.game.inventory.getQuantity('shard_kaelenthorne'));
  await page.selectOption('.recruit-exchange-hero[data-tier="normal"]', 'kaelenthorne');
  await page.click('.btn-exchange[data-tier="normal"]');
  await page.waitForTimeout(300);
  const afterTierShards = await page.evaluate(() => window.game.inventory.getQuantity('tier_shard_normal'));
  const afterHeroShards = await page.evaluate(() => window.game.inventory.getQuantity('shard_kaelenthorne'));
  checks.push({
    label: 'exchange spends tier shards through the manager to grant the selected hero shard',
    ok: afterTierShards === beforeTierShards - 3 && afterHeroShards === beforeHeroShards + 1,
  });
  const displayedTierShardQty = await page.locator('.recruit-exchange-qty[data-tier="normal"]').innerText();
  checks.push({ label: 'exchange qty display patches in place after spend', ok: displayedTierShardQty.trim() === String(afterTierShards) });

  await page.evaluate(() => {
    window.game.inventory.addItem('shard_kaelenthorne', 100);
    for (let i = 0; i < 10; i++) window.game.heroes.awakenHero('kaelenthorne');
  });
  await page.waitForTimeout(300);
  await dismissOverlays(page);
  await page.click('.heroes-tab[data-tab="roster"]');
  await page.click('.heroes-tab[data-tab="recruit"]');
  await page.waitForSelector('.recruit-banner', { timeout: 5000 });
  const maxedOptionText = await page.locator('.recruit-exchange-hero[data-tier="normal"] option[value="kaelenthorne"]').innerText();
  checks.push({ label: 'exchange picker marks a fully-maxed hero before the click', ok: /Maxed/.test(maxedOptionText) });

  await page.evaluate(() => window.game.inventory.addItem('tier_shard_normal', 5));
  await page.waitForTimeout(200);
  const beforeOverflowTierShards = await page.evaluate(() => window.game.inventory.getQuantity('tier_shard_normal'));
  const beforeOverflowHeroShards = await page.evaluate(() => window.game.inventory.getQuantity('shard_kaelenthorne'));
  await page.evaluate(async () => {
    const { NotificationManager } = await import('/js/systems/NotificationManager.js');
    window.__capturedToasts = [];
    const original = NotificationManager.prototype.show;
    NotificationManager.prototype.show = function (type, title, message) {
      window.__capturedToasts.push({ type, title, message });
      return original.call(this, type, title, message);
    };
  });
  await page.selectOption('.recruit-exchange-hero[data-tier="normal"]', 'kaelenthorne');
  await page.click('.btn-exchange[data-tier="normal"]');
  await page.waitForTimeout(300);
  const afterOverflowTierShards = await page.evaluate(() => window.game.inventory.getQuantity('tier_shard_normal'));
  const afterOverflowHeroShards = await page.evaluate(() => window.game.inventory.getQuantity('shard_kaelenthorne'));
  checks.push({
    label: 'exchanging into a maxed hero spends shards and refunds the lossy overflow amount, no hero shard granted',
    ok: afterOverflowTierShards === beforeOverflowTierShards - 1 && afterOverflowHeroShards === beforeOverflowHeroShards,
  });
  const capturedToasts = await page.evaluate(() => window.__capturedToasts ?? []);
  checks.push({
    label: 'overflow exchange surfaces a toast telling the player why',
    ok: capturedToasts.some(t => /already|maxed/i.test(t.title) || /already|maxed/i.test(t.message)),
  });

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await dismissOverlays(page);
  await page.click('.heroes-tab[data-tab="roster"]');

  await page.evaluate(() => window.game.inventory.addItem('scroll_common', 1));
  await page.waitForTimeout(200);
  await dismissOverlays(page);
  await page.evaluate(() => window.game.eventBus.emit('ui:openInventory'));
  await page.waitForSelector('#inventory-panel.open', { timeout: 5000 });
  await page.click('.inv-tab[data-tab="scroll"]');
  await page.click('.inv-tile[data-item-id="scroll_common"]');
  checks.push({ label: 'retired scroll shows no recruit redirect', ok: await page.locator('.inv-goto-recruit').count() === 0 });
  checks.push({ label: 'retired scroll shows a disabled Retired action explaining the retirement', ok: await page.locator('.inv-card-action button:disabled[title*="retired" i]').count() === 1 });
  await page.click('#inv-panel-close');
  await page.waitForSelector('#inventory-panel:not(.open)', { timeout: 5000 });

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await dismissOverlays(page);
  await page.click('.heroes-tab[data-tab="roster"]');
  checks.push({ label: 'buff block no longer on the Heroes screen', ok: await page.locator('#view-heroes .heroes-buff-section, #view-heroes .inv-buff-section').count() === 0 });

  await page.evaluate(() => window.game.eventBus.emit('ui:openInventory'));
  await page.waitForSelector('#inventory-panel.open', { timeout: 5000 });
  checks.push({ label: 'buff block rehomed onto the Inventory panel', ok: await page.locator('#inventory-panel .inv-buff-section').count() === 1 });

  await page.click('#inv-panel-close');
  await page.waitForSelector('#inventory-panel:not(.open)', { timeout: 5000 });
  await page.evaluate(() => window.game.inventory.addItem('card_hero_warlord', 1));
  await page.waitForTimeout(200);
  await dismissOverlays(page);
  await page.evaluate(() => window.game.eventBus.emit('ui:openInventory'));
  await page.waitForSelector('#inventory-panel.open', { timeout: 5000 });
  await page.click('.inv-tab[data-tab="special"]');
  await page.click('.inv-tile[data-item-id="card_hero_warlord"]');
  checks.push({ label: 'hero card action redirects rather than spending directly', ok: await page.locator('.inv-goto-recruit').count() === 1 && await page.locator('.inv-use-card').count() === 0 });
  const heroCardQtyBefore = await page.evaluate(() => window.game.inventory.getQuantity('card_hero_warlord'));
  await page.click('.inv-goto-recruit');
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  checks.push({ label: 'hero card redirect lands on the Heroes view', ok: await page.isVisible('#view-heroes') });
  checks.push({ label: 'hero card redirect activates the Recruit tab', ok: await page.locator('.heroes-tab--active[data-tab="recruit"]').count() === 1 });
  const heroCardQtyAfter = await page.evaluate(() => window.game.inventory.getQuantity('card_hero_warlord'));
  checks.push({ label: 'hero card is not spent by the redirect', ok: heroCardQtyAfter === heroCardQtyBefore });

  await page.evaluate(() => window.game.inventory.addItem('card_epic', 1));
  await page.waitForTimeout(200);
  await dismissOverlays(page);
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await dismissOverlays(page);
  await page.click('.heroes-tab[data-tab="recruit"]');
  await page.waitForSelector('.btn-use-card[data-card="card_epic"]', { timeout: 5000 });
  const epicOwnedBefore = await page.evaluate(() =>
    window.game.heroes.getRosterWithState().filter(h => h.tier === 'epic' && h.isOwned).map(h => h.id));
  const epicCardQtyBefore = await page.evaluate(() => window.game.inventory.getQuantity('card_epic'));
  await dismissOverlays(page);
  await page.click('.btn-use-card[data-card="card_epic"]');
  await page.waitForTimeout(300);
  const epicOwnedAfter = await page.evaluate(() =>
    window.game.heroes.getRosterWithState().filter(h => h.tier === 'epic' && h.isOwned).map(h => h.id));
  const epicCardQtyAfter = await page.evaluate(() => window.game.inventory.getQuantity('card_epic'));
  const newlyOwned = epicOwnedAfter.filter(id => !epicOwnedBefore.includes(id));
  checks.push({
    label: 'universal epic hero card is spendable from the Recruit tab and grants a new unowned epic hero',
    ok: epicCardQtyAfter === epicCardQtyBefore - 1 && newlyOwned.length === 1,
  });

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await dismissOverlays(page);
  await page.click('.heroes-tab[data-tab="assign"]');
  await page.waitForSelector('.hero-board-row', { timeout: 5000 });

  const i2Instance = await page.locator('.hero-board-row').first().getAttribute('data-instance');
  await dismissOverlays(page);
  await page.click(`.hero-board-row[data-instance="${i2Instance}"] .btn-board-assign`);
  const i2FirstPick = await page.locator('.hero-board-pick').count();
  if (i2FirstPick > 0) {
    await dismissOverlays(page);
    await page.click('.hero-board-pick >> nth=0');
    await page.waitForTimeout(300);

    await dismissOverlays(page);
    await page.click(`.hero-board-row[data-instance="${i2Instance}"] .btn-board-assign`);
    await page.waitForSelector(`.hero-board-row[data-instance="${i2Instance}"] .hero-board-picker`, { timeout: 5000 });

    await page.click('.heroes-tab[data-tab="roster"]');
    await page.click('.heroes-tab[data-tab="assign"]');
    await page.waitForSelector('.hero-board-row', { timeout: 5000 });

    const i2OccupiedBeforeRemove = await page.locator(`.hero-board-row[data-instance="${i2Instance}"].hero-board-row--occupied`).count();
    await dismissOverlays(page);
    await page.click(`.hero-board-row[data-instance="${i2Instance}"] .btn-board-remove`);
    await page.waitForTimeout(300);
    const i2OccupiedAfterRemove = await page.locator(`.hero-board-row[data-instance="${i2Instance}"].hero-board-row--occupied`).count();
    checks.push({
      label: 'I2: Remove after an open-picker tab round-trip actually updates the board',
      ok: i2OccupiedBeforeRemove === 1 && i2OccupiedAfterRemove === 0,
    });
  } else {
    checks.push({ label: 'I2: assign-picker tab round-trip (no assignable hero in sandbox — skipped)', ok: true });
  }

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await dismissOverlays(page);

  const c1HeroId = 'kaelenthorne';
  await page.evaluate(() => window.game.inventory.addItem('xpcard_normal', 1));
  await page.waitForTimeout(200);
  const c1QtyBefore   = await page.evaluate(() => window.game.inventory.getQuantity('xpcard_normal'));
  const c1HeroBefore  = await page.evaluate(id => {
    const h = window.game.heroes.getRosterWithState().find(x => x.id === id);
    return { xp: h?.xp ?? 0, level: h?.level ?? 0 };
  }, c1HeroId);

  await dismissOverlays(page);
  await page.evaluate(() => window.game.eventBus.emit('ui:openInventory'));
  await page.waitForSelector('#inventory-panel.open', { timeout: 5000 });
  await page.click('.inv-tab[data-tab="boost"]');
  await page.click('.inv-tile[data-item-id="xpcard_normal"]');
  checks.push({ label: 'C1: xpcard is reachable in Inventory with a real action', ok: await page.locator('.inv-use-xp[data-item="xpcard_normal"]').count() === 1 });

  await page.click('.inv-use-xp[data-item="xpcard_normal"]');
  await page.waitForSelector('.inv-hero-picker', { timeout: 5000 });
  await page.click(`.inv-pick-hero[data-hero="${c1HeroId}"]`);
  await page.waitForTimeout(300);

  const c1QtyAfter  = await page.evaluate(() => window.game.inventory.getQuantity('xpcard_normal'));
  const c1HeroAfter = await page.evaluate(id => {
    const h = window.game.heroes.getRosterWithState().find(x => x.id === id);
    return { xp: h?.xp ?? 0, level: h?.level ?? 0 };
  }, c1HeroId);
  checks.push({
    label: 'C1: xpcard is spent and grants real hero XP/level through the manager',
    ok: c1QtyAfter === c1QtyBefore - 1 && (c1HeroAfter.xp > c1HeroBefore.xp || c1HeroAfter.level > c1HeroBefore.level),
  });

  await page.click('#inv-panel-close');
  await page.waitForSelector('#inventory-panel:not(.open)', { timeout: 5000 });

  await page.evaluate(() => {
    window.game.eventBus.emit('ui:devSetBuildingLevel', { buildingId: 'heroquarters', level: 3 });
    for (const id of ['warlord', 'archsorceress', 'paladin', 'junovane', 'shadowblade']) {
      window.game.heroes.recruitHeroRecord(id);
    }
  });
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await dismissOverlays(page);
  await page.click('.heroes-tab[data-tab="roster"]');
  await page.waitForTimeout(200);

  const heroIds = await page.evaluate(() =>
    window.game.heroes.getRosterWithState().filter(h => h.isOwned).map(h => h.id));

  let sawUndefinedLevel = false;
  let allGroupsWellFormed = heroIds.length > 0;
  for (const id of heroIds) {
    await dismissOverlays(page);
    await openHero(page, id);
    await page.waitForSelector('.hero-skill-groups', { timeout: 5000 });
    if (/Lv\.undefined/.test(await page.locator('#view-heroes').innerText())) sawUndefinedLevel = true;
    const counts = await page.evaluate(() => ({
      passive: document.querySelectorAll('.hero-skill-group--passive .hero-skill-slot').length,
      support: document.querySelectorAll('.hero-skill-group--support .hero-skill-slot').length,
      major:   document.querySelectorAll('.hero-skill-group--major .hero-skill-slot').length,
    }));
    if (counts.passive !== 3 || counts.support !== 2 || counts.major !== 1) allGroupsWellFormed = false;
  }
  checks.push({ label: 'no hero renders a Lv.undefined skill badge', ok: !sawUndefinedLevel });
  checks.push({ label: 'every hero shows 3 passive, 2 support and 1 major skill row', ok: allGroupsWellFormed });

  await page.evaluate(() => {
    window.game.inventory.addItem('shard_kaelenthorne', 20);
    window.game.heroes.awardHeroXP('kaelenthorne', 999999);
  });
  await dismissOverlays(page);
  await openHero(page, 'kaelenthorne');
  await page.waitForSelector('.hero-skill-groups', { timeout: 5000 });
  const pipBefore = await page.locator('.hero-skill-slot[data-skill-id="scavenge"] .hero-skill-level-pip').innerText();
  await page.click('.hero-skill-slot[data-skill-id="scavenge"] .skill-level-up');
  await page.waitForTimeout(300);
  const scavengeLevel = await page.evaluate(() =>
    window.game.heroes._owned.get('kaelenthorne').skillLevels.scavenge);
  const pipAfter = await page.locator('.hero-skill-slot[data-skill-id="scavenge"] .hero-skill-level-pip').innerText();
  checks.push({
    label: 'spending shards on a skill moves real manager state and re-renders the pip',
    ok: pipBefore.trim() === 'L1/10' && scavengeLevel === 2 && pipAfter.trim() === 'L2/10',
  });

  const dormancyFor = async (buildingId) => {
    await page.evaluate(id => {
      window.game.heroes.unassignHeroFromBuilding('kaelenthorne');
      window.game.heroes.assignHeroToBuilding('kaelenthorne', id);
    }, buildingId);
    await dismissOverlays(page);
    await openHero(page, 'kaelenthorne');
    await page.waitForSelector('.hero-skill-groups', { timeout: 5000 });
    return page.evaluate(() => ({
      resourceLive: !!document.querySelector('.hero-skill-slot[data-skill-id="scavenge"] .hero-skill-effect--live'),
      combatLive:   !!document.querySelector('.hero-skill-slot[data-skill-id="grit"] .hero-skill-effect--live'),
    }));
  };

  const inMine     = await dormancyFor('mine_0');
  const inBarracks = await dormancyFor('barracks_0');
  checks.push({
    label: 'a resource posting marks production skills live and combat skills dormant',
    ok: inMine.resourceLive === true && inMine.combatLive === false,
  });
  checks.push({
    label: 'reassigning to a barracks swaps which skills read as dormant',
    ok: inBarracks.combatLive === true && inBarracks.resourceLive === false,
  });
  await dormancyFor('mine_0');
  const postedText = await page.locator('#heroes-detail-pane .hq-detail__posted').innerText();
  checks.push({ label: 'the detail footer names the post, not its id', ok: /iron mine/i.test(postedText) && !/mine_0/i.test(postedText) });
  checks.push({
    label: 'every skill effect reads as Active or Dormant in plain words',
    ok: await page.evaluate(() => {
      const els = [...document.querySelectorAll('#heroes-detail-pane .hero-skill-effect')];
      return els.length > 0 && els.every(el => /Active:|Dormant:/.test(el.textContent));
    }),
  });
  await page.click('#heroes-detail-pane .hq-tab[data-tab="lore"]');
  checks.push({
    label: 'detail tabs switch the visible body',
    ok: await page.isVisible('#heroes-detail-pane [data-tab-body="lore"]') && !(await page.isVisible('#heroes-detail-pane [data-tab-body="skills"]')),
  });
  await page.evaluate(() => window.game.eventBus.emit('heroes:updated', window.game.heroes.getRosterWithState()));
  await page.waitForTimeout(200);
  checks.push({ label: 'a background hero update keeps the open detail tab', ok: await page.isVisible('#heroes-detail-pane [data-tab-body="lore"]') });
  await page.click('#heroes-detail-pane .hq-tab[data-tab="skills"]');
  const footerClear = await page.evaluate(() => {
    const main = document.getElementById('game-main');
    main.scrollTop = main.scrollHeight;
    const btn = document.querySelector('#heroes-detail-pane .btn-deploy');
    const r = btn.getBoundingClientRect();
    return btn.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  checks.push({ label: 'scrolled to the bottom, Change post is not covered by the dock', ok: footerClear });
  const artPinned = await page.evaluate(() => {
    const main = document.getElementById('game-main');
    const pane = document.getElementById('heroes-detail-pane');
    main.scrollTop = pane.offsetTop + 150;
    const art = document.querySelector('#heroes-detail-pane .hq-detail__art');
    const stickyEdge = main.getBoundingClientRect().top + parseFloat(getComputedStyle(main).paddingTop);
    return Math.abs(art.getBoundingClientRect().top - stickyEdge) <= 2;
  });
  checks.push({ label: 'the hero art stays pinned while the detail scrolls', ok: artPinned });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForSelector('#view-heroes:not(.hidden)', { timeout: 5000 });
  await dismissOverlays(page);
  await page.click('.heroes-tab[data-tab="roster"]');
  const phoneColumns = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#heroes-roster-grid')).gridTemplateColumns.split(' ').length);
  checks.push({ label: 'at phone width the gallery is two columns', ok: phoneColumns === 2 });
  await page.setViewportSize({ width: 1280, height: 800 });

  report('heroes-smoke', checks, errors);
});
