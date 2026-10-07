import { withPage, report } from './harness.mjs';

const waitGame = (page) => page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=combatsmoke`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);

  const setup = await page.evaluate(() => {
    const um = window.game.units;
    for (const s of um.getSquads()) um.deleteSquad(s.id);
    window.game.eventBus.emit('ui:openSquads', { instanceIndex: 0 });
    const squad = um.getSquads().find(s => s.barracksInstanceId === 'barracks_0');
    if (!squad) return { ok: false };
    um._reserve.set('infantry_t1', 30);
    const res = um.assignToSquad(squad.id, 'infantry', 30, 1, 0);
    um.linkSlotUnit(squad.id, 0, 'infantry');
    return { ok: res.success, squadId: squad.id };
  });

  await page.waitForSelector('.sq-tile .slot-row-toggle', { timeout: 5000 });
  const rowBtn = (row) => page.locator(`.sq-tile >> nth=0 >> .slot-row-toggle__btn[data-row="${row}"]`);
  const frontBefore = await rowBtn('front').getAttribute('aria-pressed');
  await rowBtn('back').click();
  const backAfterClick = await rowBtn('back').getAttribute('aria-pressed');
  const woundedChip = await page.locator('.sq-stat--wounded').count();

  await page.waitForTimeout(300);
  await page.evaluate(() => window.game.save());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  const rowAfterReload = await page.evaluate((id) => window.game.units.getSlotRow(id, 0), setup.squadId);
  await page.evaluate(() => window.game.eventBus.emit('ui:openSquads', { instanceIndex: 0 }));
  await page.waitForSelector('.sq-tile .slot-row-toggle', { timeout: 5000 });
  const backPressedAfterReload = await rowBtn('back').getAttribute('aria-pressed');
  await page.evaluate(() => document.querySelector('#squad-panel .sq-close')?.click());

  const before = await page.evaluate((id) => window.game.units.getSquad(id).units.reduce((n, u) => n + u.count, 0), setup.squadId);
  await page.evaluate(() => window.game.campaign.deserialize({ bestStars: { ch1_s1: 3, ch1_s2: 3, ch1_s3: 3, ch1_s4: 3 } }));
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'combat'));
  await page.waitForSelector('.campaign-node.available', { timeout: 5000 });
  await page.evaluate(() => document.querySelector('.campaign-node.available').click());
  await page.waitForSelector('#btn-campaign-attack', { state: 'attached' });
  const badge = await page.locator('#readiness-badge-area').textContent();
  await page.evaluate(() => document.querySelector('#btn-campaign-attack').click());
  await page.waitForTimeout(500);
  if (await page.locator('#btn-warn-proceed').count()) await page.locator('#btn-warn-proceed').click();
  await page.waitForSelector('#btn-battle-skip:visible, #battle-results:not(.hidden)', { timeout: 5000 });
  if (await page.locator('#btn-battle-skip').isVisible()) await page.locator('#btn-battle-skip').click();
  const resultShown = await page.waitForSelector('#battle-results:not(.hidden)', { timeout: 10_000 }).then(() => true, () => false);
  await page.waitForSelector('#btn-battle-close', { timeout: 10_000 });

  const after = await page.evaluate((id) => {
    const sum = (m) => Object.values(m ?? {}).reduce((a, b) => a + b, 0);
    const entry = window.game.combat.getBattleLog()[0];
    const wounded = window.game.units.getWounded();
    return {
      count: window.game.units.getSquad(id).units.reduce((n, u) => n + u.count, 0),
      dead: sum(entry?.dead), woundedEntry: sum(entry?.wounded),
      woundedPool: sum(wounded), hasSeed: entry?.seed != null, hasRules: entry?.rulesVersion != null,
    };
  }, setup.squadId);
  const resultText = await page.locator('#battle-results').textContent();

  report('combat', [
    { label: 'squad slot 0 seeded with units', ok: setup.ok && before === 30 },
    { label: 'slot 0 starts on the front row', ok: frontBefore === 'true' },
    { label: 'clicking Back selects Back', ok: backAfterClick === 'true' },
    { label: 'wounded chip is shown in the squad modal', ok: woundedChip === 1 },
    { label: 'slot row is still back after reload (state)', ok: rowAfterReload === 'back' },
    { label: 'slot row is still back after reload (UI)', ok: backPressedAfterReload === 'true' },
    { label: 'estimate badge shows a win percentage', ok: /~\d+%/.test(badge) },
    { label: 'battle result renders', ok: resultShown && resultText.trim().length > 0 },
    { label: 'battle log entry carries seed and rulesVersion', ok: after.hasSeed && after.hasRules },
    { label: 'battle produced casualties', ok: after.dead + after.woundedEntry > 0 },
    { label: 'squad lost exactly dead + wounded', ok: before - after.count === after.dead + after.woundedEntry },
    { label: 'wounded pool holds the battle wounded', ok: after.woundedPool >= after.woundedEntry },
  ], errors);
});

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=combattrail`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('#bq-sidebar')?.classList.add('is-collapsed'));

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'combat'));
  await page.waitForSelector('.campaign-node.available', { timeout: 5000 });
  await page.waitForTimeout(300);

  const visiblePanes = () => page.evaluate(() =>
    ['campaign', 'survival', 'log'].filter(t => {
      const el = document.getElementById(`combat-pane-${t}`);
      return el && el.offsetParent !== null;
    }));

  const tabCount = await page.locator('.combat-tabs [data-tab]').count();
  const defaultPanes = await visiblePanes();
  const paneSwitches = [];
  for (const tab of ['survival', 'log', 'campaign']) {
    await page.locator(`.combat-tabs [data-tab="${tab}"]`).click();
    paneSwitches.push({ tab, panes: await visiblePanes() });
  }
  const logInLogPane = await page.evaluate(() => !!document.querySelector('#combat-pane-log #battle-log'));

  const trail = await page.evaluate(() => {
    const vpEl = document.querySelector('.campaign-trail');
    if (!vpEl) return { nodes: -1, expected: 0, available: 0, youInside: false, fogText: '', lockedChapter: null, fogCoversLocked: false };
    const vp = vpEl.getBoundingClientRect();
    const you = document.querySelector('.campaign-node__you')?.getBoundingClientRect();
    const fog = document.querySelector('.campaign-trail__fog');
    const fogRect = fog?.getBoundingClientRect();
    const states = window.game.campaign.getStageStates();
    const stages = window.game.campaign.getStages();
    const lockedFirst = stages.find(s => s.kind === 'regular' && s.index === 1 && states.get(s.id).isLocked);
    const lockedNode = lockedFirst && document.querySelector(`.campaign-node[data-stage-id="${lockedFirst.id}"]`)?.getBoundingClientRect();
    const fogBottom = fog ? fog.offsetTop + fog.offsetHeight : -1;
    const lockedNodeY = lockedNode ? lockedNode.top + lockedNode.height / 2 - document.querySelector('.campaign-trail__world').getBoundingClientRect().top : -1;
    return {
      nodes: document.querySelectorAll('.campaign-node').length,
      expected: stages.length,
      available: document.querySelectorAll('.campaign-node.available').length,
      youInside: !!you && you.top >= vp.top && you.bottom <= vp.bottom && you.left >= vp.left && you.right <= vp.right,
      fogText: fog?.textContent ?? '',
      lockedChapter: lockedFirst?.chapter ?? null,
      fogCoversLocked: !!fogRect && lockedNodeY >= 0 && fogBottom >= lockedNodeY,
    };
  });

  const patched = await page.evaluate(() => {
    const node = document.querySelector('.campaign-node[data-stage-id="ch1_s1"]');
    if (!node) return {};
    node.dataset.probe = 'kept';
    window.game.eventBus.emit('combat:victory', {
      monsterId: 'ch1_s1', stageId: 'ch1_s1', dead: {}, wounded: {}, rounds: 3, sent: 30, enemyLeftPct: 0,
    });
    const after = document.querySelector('.campaign-node[data-stage-id="ch1_s1"]');
    const next = document.querySelector('.campaign-node[data-stage-id="ch1_s2"]');
    return {
      sameNode: after?.dataset.probe === 'kept',
      completed: after?.classList.contains('completed'),
      stars: after?.querySelector('.campaign-node__stars')?.textContent ?? '',
      nextAvailable: next?.classList.contains('available'),
      youOnNext: !!next?.querySelector('.campaign-node__you'),
    };
  });

  await page.evaluate(() => document.querySelector('.campaign-node.available').click());
  const panelOpen = await page.waitForSelector('#campaign-stage-panel.campaign-stage-panel--open #btn-campaign-attack', { timeout: 3000 })
    .then(() => true, () => false);

  report('combat-tabs', [
    { label: 'three combat tabs', ok: tabCount === 3 },
    { label: 'campaign pane is the default', ok: defaultPanes.join() === 'campaign' },
    ...paneSwitches.map(s => ({ label: `${s.tab} tab shows exactly its pane`, ok: s.panes.join() === s.tab })),
    { label: '#battle-log lives in the log pane', ok: logInLogPane },
  ], []);
  report('campaign-trail', [
    { label: `one node per stage (${trail.nodes}/${trail.expected})`, ok: trail.nodes === trail.expected && trail.expected > 0 },
    { label: 'an available node exists', ok: trail.available > 0 },
    { label: 'YOU marker is inside the trail viewport', ok: trail.youInside },
    { label: `locked chapter ${trail.lockedChapter} is under fog`, ok: trail.fogCoversLocked && new RegExp(`CHAPTER ${trail.lockedChapter} ·`).test(trail.fogText) },
    { label: 'campaign:updated patches the node in place', ok: patched.sameNode },
    { label: 'cleared node shows completed + stars', ok: patched.completed && patched.stars.includes('★') },
    { label: 'next node becomes available and carries YOU', ok: patched.nextAvailable && patched.youOnNext },
    { label: 'clicking an available node opens the stage panel', ok: panelOpen },
  ], errors);
});

const seedSquad = (page, { tierKey, tier, count }) => page.evaluate(({ tierKey, tier, count }) => {
  const um = window.game.units;
  for (const s of um.getSquads()) um.deleteSquad(s.id);
  window.game.eventBus.emit('ui:openSquads', { instanceIndex: 0 });
  const squad = um.getSquads().find(s => s.barracksInstanceId === 'barracks_0');
  if (!squad) return null;
  um._reserve.set(tierKey, count);
  um.assignToSquad(squad.id, 'infantry', count, tier, 0);
  um.linkSlotUnit(squad.id, 0, 'infantry');
  document.querySelector('#squad-panel .sq-close')?.click();
  return squad.id;
}, { tierKey, tier, count });

const openStage = (page, stageId) => page.evaluate((id) => {
  document.querySelector(`.campaign-node[data-stage-id="${id}"]`)?.click();
}, stageId);

const panelSnapshot = (page) => page.evaluate(() => {
  const panel = document.querySelector('#campaign-stage-panel');
  const btn = panel.querySelector('#btn-campaign-attack');
  return {
    open: panel.classList.contains('campaign-stage-panel--open'),
    title: panel.querySelector('.stage-panel__title')?.textContent.trim() ?? '',
    waves: panel.querySelectorAll('.stage-wave').length,
    rewards: panel.querySelectorAll('.stage-rewards .stage-reward').length,
    firstClear: panel.querySelector('.stage-reward--first')?.textContent ?? '',
    badge: panel.querySelector('#readiness-badge-area')?.textContent ?? '',
    deployEnabled: !!btn && !btn.disabled,
    deployDisabled: !!btn && btn.disabled,
    note: panel.querySelector('.stage-panel__deploy-note')?.textContent ?? '',
    commanderRows: panel.querySelectorAll('.commander-row').length,
    assign: panel.querySelectorAll('.commander-row__assign').length,
    totals: panel.querySelector('.commander-totals')?.textContent ?? '',
    stars: panel.querySelector('.stage-panel__stars')?.textContent ?? '',
  };
});

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=stagepanel`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('#bq-sidebar')?.classList.add('is-collapsed'));

  const squadId = await seedSquad(page, { tierKey: 'infantry_t1', tier: 1, count: 30 });
  const slotCount = await page.evaluate(async () => {
    const { BUILDINGS_CONFIG } = await import('/js/entities/GAME_DATA.js');
    return BUILDINGS_CONFIG.barracks.squadSlots.length;
  });

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'combat'));
  await page.waitForSelector('.campaign-node.available', { timeout: 5000 });
  await openStage(page, 'ch1_s1');
  await page.waitForTimeout(400);
  const avail = await panelSnapshot(page);
  const stageName = await page.evaluate(() => window.game.campaign.getStages().find(s => s.id === 'ch1_s1').name);

  const navigated = await page.evaluate(() => {
    const seen = [];
    const off = window.game.eventBus.on('ui:navigateTo', v => seen.push(v));
    document.querySelector('.commander-row__assign')?.click();
    off();
    return seen;
  });

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'combat'));
  await page.waitForSelector('.campaign-node', { timeout: 5000 });
  const locked = await page.evaluate(() => {
    const states = window.game.campaign.getStageStates();
    const stage = window.game.campaign.getStages().find(s => s.chapter === 1 && states.get(s.id).isLocked);
    return { id: stage.id, reason: states.get(stage.id).lockReason };
  });
  await openStage(page, locked.id);
  await page.waitForTimeout(400);
  const lockedSnap = await panelSnapshot(page);

  report('stage-panel', [
    { label: 'squad seeded', ok: !!squadId },
    { label: 'available node opens the panel', ok: avail.open },
    { label: `title is the stage name (${avail.title})`, ok: avail.title === stageName },
    { label: 'at least one wave row', ok: avail.waves >= 1 },
    { label: 'rewards listed', ok: avail.rewards >= 1 },
    { label: `first-clear line shown (${avail.firstClear})`, ok: /First clear: .*\d+/.test(avail.firstClear) },
    { label: `estimate badge ~N% (${avail.badge.trim()})`, ok: /~\d+%/.test(avail.badge) },
    { label: 'Deploy enabled on an available stage', ok: avail.deployEnabled },
    { label: `one commander row per Barracks slot (${avail.commanderRows}/${slotCount})`, ok: avail.commanderRows === slotCount && slotCount > 0 },
    { label: 'empty slot offers Assign ›', ok: avail.assign >= 1 },
    { label: 'Assign › navigates to heroes', ok: navigated.includes('heroes') },
    { label: 'squad totals line rendered', ok: /attack/.test(avail.totals) && /strikes? \/ round/.test(avail.totals) },
    { label: `locked stage ${locked.id} opens with Deploy disabled`, ok: lockedSnap.open && lockedSnap.deployDisabled },
    { label: 'locked stage shows its lock reason', ok: !!locked.reason && lockedSnap.note.includes(locked.reason) },
  ], []);

  await page.evaluate(() => window.game.campaign.deserialize({}));
  await seedSquad(page, { tierKey: 'infantry_t5', tier: 5, count: 150 });
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'combat'));
  await page.waitForSelector('.campaign-node.available', { timeout: 5000 });
  await openStage(page, 'ch1_s1');
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#btn-campaign-attack').click());
  await page.waitForTimeout(500);
  if (await page.locator('#btn-warn-proceed').count()) await page.locator('#btn-warn-proceed').click();
  await page.waitForSelector('#btn-battle-skip:visible, #battle-results:not(.hidden)', { timeout: 5000 });
  if (await page.locator('#btn-battle-skip').isVisible()) await page.locator('#btn-battle-skip').click();
  await page.waitForSelector('#btn-battle-close', { timeout: 10_000 });
  await page.locator('#btn-battle-close').click();
  await page.waitForTimeout(800);
  const won = await page.evaluate(() => {
    const node = document.querySelector('.campaign-node[data-stage-id="ch1_s1"]');
    const filled = (node?.querySelector('.campaign-node__stars')?.childNodes[0]?.textContent ?? '').replace(/[^★]/g, '').length;
    return { completed: !!node?.classList.contains('completed'), filled, firstCleared: window.game.campaign.getProgress('ch1_s1').firstCleared };
  });
  const reopened = await panelSnapshot(page);

  report('stars-after-win', [
    { label: 'ch1_s1 node is completed', ok: won.completed },
    { label: `node shows ≥1 filled star (${won.filled})`, ok: won.filled >= 1 },
    { label: 'progress records firstCleared', ok: won.firstCleared === true },
    { label: 'reopened panel hides the claimed first-clear line', ok: reopened.open && reopened.firstClear === '' },
    { label: 'reopened panel shows best stars', ok: reopened.stars.includes('★') },
  ], []);

  const cap = await page.evaluate(() => {
    const g = window.game;
    g.buildings._buildings.get('barracks')[0].level = 5;
    const um = g.units;
    for (const s of um.getSquads()) um.deleteSquad(s.id);
    g.eventBus.emit('ui:openSquads', { instanceIndex: 0 });
    const squad = um.getSquads().find(s => s.barracksInstanceId === 'barracks_0');
    um._reserve.set('infantry_t1', 30);
    for (const slot of [0, 1, 2]) {
      um.assignToSquad(squad.id, 'infantry', 10, 1, slot);
      um.linkSlotUnit(squad.id, slot, 'infantry');
    }
    um.setSlotRow(squad.id, 0, 'front');
    um.setSlotRow(squad.id, 1, 'front');
    document.querySelector('#squad-panel .sq-close')?.click();
    g.eventBus.emit('ui:openSquads', { instanceIndex: 0 });
    return { rows: [0, 1, 2].map(i => um.getSlotRow(squad.id, i)) };
  });
  await page.waitForSelector('.sq-tile .slot-row-toggle', { timeout: 5000 });
  const thirdFront = await page.evaluate(() => {
    const btn = document.querySelectorAll('.sq-tile')[2]?.querySelector('.slot-row-toggle__btn[data-row="front"]');
    return btn ? btn.disabled : null;
  });

  report('row-cap-toggle', [
    { label: `slots 0 and 1 hold Front (${cap.rows.join(',')})`, ok: cap.rows[0] === 'front' && cap.rows[1] === 'front' },
    { label: 'third slot Front button is disabled', ok: thirdFront === true },
  ], errors);
});

const squadPicker = (page) => page.evaluate(() => {
  const panel = document.querySelector('#campaign-stage-panel');
  return {
    options: panel.querySelectorAll('.squad-dropdown-option').length,
    label: panel.querySelector('.squad-select-label')?.textContent.trim() ?? '',
    deployDisabled: !!panel.querySelector('#btn-campaign-attack')?.disabled,
  };
});

const leaveAndReturn = async (page) => {
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'heroes'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'combat'));
  await page.waitForTimeout(400);
};

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=combatreturn`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.querySelector('#bq-sidebar')?.classList.add('is-collapsed');
    const um = window.game.units;
    for (const s of um.getSquads()) um.deleteSquad(s.id);
  });

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'combat'));
  await page.waitForSelector('.campaign-node.available', { timeout: 5000 });
  await page.evaluate(() => { window.__trailNode = document.querySelector('.campaign-node[data-stage-id="ch1_s1"]'); });
  await openStage(page, 'ch1_s1');
  await page.waitForTimeout(400);
  const empty = await squadPicker(page);

  const squadId = await seedSquad(page, { tierKey: 'infantry_t1', tier: 1, count: 30 });
  await leaveAndReturn(page);
  const created = await squadPicker(page);
  const nodeKeptOnReturn = await page.evaluate(() =>
    document.querySelector('.campaign-node[data-stage-id="ch1_s1"]') === window.__trailNode);

  await page.evaluate(() => {
    const um = window.game.units;
    for (const s of um.getSquads()) um.deleteSquad(s.id);
  });
  await leaveAndReturn(page);
  const deleted = await squadPicker(page);

  await page.locator('.combat-tabs [data-tab="log"]').click();
  await leaveAndReturn(page);
  const tabAfterReturn = await page.evaluate(() => ({
    active: document.querySelector('.combat-tabs .combat-tabs__tab--active')?.dataset.tab,
    logVisible: document.getElementById('combat-pane-log')?.offsetParent !== null,
  }));
  await page.locator('.combat-tabs [data-tab="campaign"]').click();
  const nodeKeptAfterTabs = await page.evaluate(() =>
    document.querySelector('.campaign-node[data-stage-id="ch1_s1"]') === window.__trailNode);

  report('combat-return', [
    { label: `panel opened with no squads shows the empty picker (${empty.label})`, ok: empty.options === 0 && empty.deployDisabled },
    { label: 'squad seeded while away', ok: !!squadId },
    { label: `returning lists the new squad and enables Deploy (${created.options} option(s))`, ok: created.options >= 1 && !created.deployDisabled && created.label !== 'No squads available' },
    { label: `returning after deleting squads empties the picker (${deleted.label})`, ok: deleted.options === 0 && deleted.deployDisabled },
    { label: `chosen Log tab survives a view return (${tabAfterReturn.active})`, ok: tabAfterReturn.active === 'log' && tabAfterReturn.logVisible },
    { label: 'trail nodes are patched, not rebuilt, on a view return', ok: nodeKeptOnReturn },
    { label: 'trail nodes are patched, not rebuilt, on switching back to Campaign', ok: nodeKeptAfterTabs },
  ], errors);
});
