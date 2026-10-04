import { withPage, report } from './harness.mjs';

// Free-placement tutorial retarget gate (ADR 0022): the #city-proxy-layer divs
// track instance footprint rects, so the spotlight must ring the correct
// building for the first steps. Drives a fresh guest campaign (tutorial runs),
// checks step 1 (Lumber Mill), force-completes it, then checks step 2 (Iron Mine).

const RING = '#tut-spotlight-ring';

function ringOverTile(page, buildingId) {
  return page.evaluate((bid) => {
    const ring = document.querySelector('#tut-spotlight-ring');
    const tile = document.querySelector(`.base-tile[data-building-id="${bid}"]`);
    if (!ring || ring.classList.contains('hidden') || !tile) return null;
    const rr = ring.getBoundingClientRect();
    const tr = tile.getBoundingClientRect();
    const cx = r => r.left + r.width / 2;
    const cy = r => r.top + r.height / 2;
    return { dx: Math.abs(cx(rr) - cx(tr)), dy: Math.abs(cy(rr) - cy(tr)), tw: tr.width, th: tr.height };
  }, buildingId);
}

async function waitRingOver(page, buildingId, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    // A slow boot can surface the story dialog after the initial skip attempt —
    // keep dismissing it, or the tutorial spotlight never appears.
    await page.evaluate(() => document.querySelector('#story-btn-skip')?.click());
    last = await ringOverTile(page, buildingId);
    if (last && last.dx < 12 && last.dy < 12 && last.tw > 0 && last.th > 0) return last;
    await page.waitForTimeout(150);
  }
  console.error(`  waitRingOver(${buildingId}) timed out; last=${JSON.stringify(last)}`);
  return null;
}

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.click('#auth-guest');
  await page.click('.newgame-mode-btn[data-mode="campaign"]');
  await page.click('#btn-newgame-confirm');
  await page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 15_000 });
  // Dismiss the story dialog (not the tutorial) so nothing else steals focus.
  await page.click('#story-btn-skip', { timeout: 3000 }).catch(() => {});

  const step1 = await waitRingOver(page, 'lumbermill');

  // Force-complete the Lumber Mill so the tutorial advances to the Iron Mine step.
  await page.evaluate(() => {
    const g = window.game;
    g.resources.add({ wood: 99999, stone: 99999, iron: 99999 });
    g.buildings.build('lumbermill', 0);
    g.buildings.applyOffline(0, Date.now() + 60_000);
  });

  const step2 = await waitRingOver(page, 'mine');

  report('tutorial-smoke', [
    { label: 'step 1 spotlight rings the Lumber Mill footprint', ok: !!step1 },
    { label: 'Lumber Mill build advances the tutorial', ok: !!step2 },
    { label: 'step 2 spotlight retargets to the Iron Mine footprint', ok: !!step2 },
  ], errors);
});

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=tutcombat`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });
  await page.waitForTimeout(800);

  await page.evaluate(async () => {
    const g = window.game;
    const { TUTORIAL_STEPS } = await import('/js/systems/TutorialManager.js');
    document.querySelector('#bq-sidebar')?.classList.add('is-collapsed');
    window.__combatStarted = 0;
    g.eventBus.on('combat:started', () => { window.__combatStarted++; });
    g.user.setTutorialStep(TUTORIAL_STEPS.findIndex(s => s.id === 'combat'));
    g.eventBus.emit('tutorial:start');
  });

  const ringOn = (selector) => page.waitForFunction((sel) => {
    const ring = document.querySelector('#tut-spotlight-ring');
    const target = document.querySelector(sel);
    if (!ring || ring.classList.contains('hidden') || !target) return false;
    const rr = ring.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    return Math.abs(rr.left + rr.width / 2 - (tr.left + tr.width / 2)) < 12
      && Math.abs(rr.top + rr.height / 2 - (tr.top + tr.height / 2)) < 12;
  }, selector, { timeout: 12_000 }).then(() => true, () => false);

  const onNode = await ringOn('.campaign-node.available');
  await page.evaluate(() => {
    const pane = document.querySelector('#combat-pane-campaign');
    window.__paneMaxScrollLeft = 0;
    pane.addEventListener('scroll', () => { window.__paneMaxScrollLeft = Math.max(window.__paneMaxScrollLeft, pane.scrollLeft); });
  });
  const nodeClicked = await page.click('.campaign-node.available', { timeout: 4000 }).then(() => true, () => false);
  const onDeploy = await ringOn('#btn-campaign-attack');
  const deployHittable = await page.waitForFunction(() => {
    const r = document.querySelector('#btn-campaign-attack')?.getBoundingClientRect();
    return !!r && !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('#btn-campaign-attack');
  }, null, { timeout: 5000 }).then(() => true, () => false);
  const paneScroll = await page.evaluate(() => ({ now: document.querySelector('#combat-pane-campaign').scrollLeft, max: window.__paneMaxScrollLeft }));
  const deployClicked = await page.click('#btn-campaign-attack', { timeout: 4000 }).then(() => true, () => false);
  await page.waitForTimeout(500);
  if (await page.locator('#btn-warn-proceed').count()) await page.locator('#btn-warn-proceed').click();
  const started = await page.waitForFunction(() => window.__combatStarted > 0, null, { timeout: 5000 }).then(() => true, () => false);

  report('tutorial-combat-deploy', [
    { label: 'combat step rings an available node', ok: onNode },
    { label: 'the ringed node is clickable', ok: nodeClicked },
    { label: 'spotlight retargets to Deploy once the panel is open', ok: onDeploy },
    { label: 'Deploy centre hit-tests to Deploy, not a spotlight blocker', ok: deployHittable },
    { label: `campaign pane is never scrolled sideways by the spotlight (scrollLeft=${paneScroll.now}, max=${paneScroll.max})`, ok: paneScroll.now === 0 && paneScroll.max === 0 },
    { label: 'Deploy is clickable through the spotlight', ok: deployClicked },
    { label: 'clicking Deploy fires combat:started', ok: started },
  ], errors);
});
