/**
 * sector-smoke.mjs
 * Regression for the "glitchy rubble clearing" report (ADR 0022 §Task 1). Boots a
 * real guest CAMPAIGN game (NOT sandbox — sandbox clears are instant by design),
 * starts two concurrent rubble clears, samples progress, and drives both to real
 * completion through the engine tick + event path — proving the timers run
 * independently (one finishing never drags the other along or wipes it).
 */
import { loadPlaywright, startServer, collectErrors, dismissOverlays } from './harness.mjs';

async function bootGuestCampaign(page, origin) {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.click('#auth-guest');
  await page.click('.newgame-mode-btn[data-mode="campaign"]');
  await page.click('#btn-newgame-confirm');
  await page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 15_000 });
  await dismissOverlays(page);
}

async function run() {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = collectErrors(page);
  const checks = [];
  const add = (label, ok) => checks.push({ label, ok });

  try {
    await bootGuestCampaign(page, server.origin);

    // Give HQ Lv.2 (ring-1 gate) + flood resources so the clears are affordable.
    await page.evaluate(() => {
      const bm = window.game.buildings, rm = window.game.resources;
      bm._buildings.set('townhall', [{ instanceId: 'townhall_0', level: 2 }]);
      bm._recalculateAllCaps();
      for (const k of ['wood', 'stone', 'iron', 'food', 'water', 'money']) {
        rm.setCap?.(k, 1e9); rm.add?.({ [k]: 1e6 });
      }
    });

    const A = 'sector_1_0', B = 'sector_1_1';
    const remainOf = (id) => page.evaluate((sid) => {
      const s = window.game.buildings.getSectors().find(x => x.id === sid);
      return s?.clearing ? Math.round((s.endsAt - Date.now()) / 1000) : null;
    }, id);

    const started = await page.evaluate(([a, b]) => {
      const bm = window.game.buildings;
      const ra = bm.clearSector(a), rb = bm.clearSector(b);
      return { a: ra.success, b: rb.success };
    }, [A, B]);
    add('both clears start (campaign)', started.a && started.b);

    const remainA0 = await remainOf(A);
    const remainB0 = await remainOf(B);
    add('sector A is clearing', remainA0 > 0);
    add('sector B is clearing', remainB0 > 0);

    await page.waitForTimeout(2000);
    const remainA1 = await remainOf(A);
    add(`progress advances (A ${remainA0}s → ${remainA1}s over 2s)`, remainA1 !== null && remainA1 < remainA0);

    // Sector tooltip lifecycle: tap A → pinned panel opens; on completion it must
    // auto-close (a cleared sector is nothing to act on).
    await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'base'));
    await page.waitForFunction(() => !!window.game.city, null, { timeout: 8000 });
    await page.evaluate((a) => { const c = window.game.city; c._onSectorClick(a, c.getSectorScreenRect(a)); }, A);
    await page.waitForTimeout(120);
    const ttOpen = await page.evaluate(() =>
      document.getElementById('tile-tooltip')?.classList.contains('is-visible'));
    add('sector clear panel opens (pinned) on tap', !!ttOpen);

    // Drive A to completion (its own endsAt), leave B running — the engine tick
    // completes it via the real SectorState.update + city:sectorCleared path.
    await page.evaluate((a) => { window.game.buildings._sectors._clearing.set(a, Date.now()); }, A);
    await page.waitForFunction((a) => window.game.buildings.isCellCleared
      && window.game.buildings.getSectors().find(s => s.id === a)?.cleared, A, { timeout: 5000 });
    const bStillClearing = await remainOf(B);
    add('A completed independently; B still clearing', bStillClearing > 0);

    await page.waitForTimeout(120);
    const ttClosed = await page.evaluate(() =>
      !document.getElementById('tile-tooltip')?.classList.contains('is-visible'));
    add('tooltip auto-closes when its sector completes', ttClosed);

    await page.evaluate((b) => { window.game.buildings._sectors._clearing.set(b, Date.now()); }, B);
    await page.waitForFunction((b) => window.game.buildings.getSectors().find(s => s.id === b)?.cleared, B, { timeout: 5000 });

    const finalState = await page.evaluate(([a, b]) => {
      const bm = window.game.buildings;
      const secs = bm.getSectors();
      const rectOf = (id) => secs.find(s => s.id === id).rect;
      const cellCleared = (r) => bm.isCellCleared(r.cx, r.cy) && bm.isCellCleared(r.cx + r.w - 1, r.cy + r.h - 1);
      return {
        aCleared: secs.find(s => s.id === a).cleared,
        bCleared: secs.find(s => s.id === b).cleared,
        aCells: cellCleared(rectOf(a)),
        bCells: cellCleared(rectOf(b)),
      };
    }, [A, B]);
    add('both sectors cleared to completion', finalState.aCleared && finalState.bCleared);
    add('cleared cells are placeable ground', finalState.aCells && finalState.bCells);

    console.log(`  timings: A ${remainA0}s→${remainA1}s (2s), B started ${remainB0}s, B still running when A finished: ${bStillClearing}s`);
  } finally {
    await browser.close();
    server.stop();
  }

  const failures = checks.filter(c => !c.ok).map(c => `  ✖ ${c.label}`);
  for (const c of checks) if (c.ok) console.log(`  ✔ ${c.label}`);
  for (const f of failures) console.error(f);
  for (const e of errors) console.error(`  ✖ ${e}`);
  const failed = failures.length > 0 || errors.length > 0;
  console.log(failed ? 'sector-smoke: FAIL' : 'sector-smoke: PASS');
  process.exitCode = failed ? 1 : 0;
}

run();
