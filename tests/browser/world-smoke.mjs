import { withPage, bootGuestSandbox, dismissOverlays, report } from './harness.mjs';

await withPage(async ({ page, errors, origin }) => {
  await bootGuestSandbox(page, origin);

  await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'world'));
  await page.waitForFunction(
    () => !document.querySelector('#view-world')?.classList.contains('hidden'),
    null, { timeout: 10_000 },
  );
  await dismissOverlays(page);
  await page.waitForTimeout(500);

  const state = await page.evaluate(() => {
    const wm = window.game.worldMap;
    const canvas = document.querySelector('#world-canvas');
    const ctx = canvas?.getContext('2d');
    const pixels = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 3; pixels && i < pixels.length; i += 4000) if (pixels[i] > 0) painted++;
    const regionIds = ['home_vale', 'west_warrens', 'red_lowlands', 'command_ruin'];
    return {
      canvasSized: (canvas?.width ?? 0) > 0 && (canvas?.height ?? 0) > 0,
      painted,
      regionsResolve: regionIds.every(id => !!wm.getRegion(id)),
      homeOwned: wm.isPlayerOwned('home_vale'),
      enemyRegionNotOwned: !wm.isPlayerOwned('red_lowlands'),
      poiResolves: !!wm.getPOI('rn_oak'),
      fillerResolves: !!wm.getPOI('gen_home_vale_0'),
      nodeHasStock: wm.nodeRemaining('rn_oak') > 0,
      legendRows: document.querySelectorAll('#world-legend-list .world-legend__row').length,
    };
  });

  // ── Grid layer (B2) ────────────────────────────────────────────────────────
  // `greenish` counts owned-tint pixels. It is deliberately hue-based, not a
  // whole-canvas hash: world-boss and ruin markers pulse on their own timers, so
  // any "did the canvas change at all" metric drifts on its own and false-passes.
  const sample = () => page.evaluate(() => {
    const c = document.querySelector('#world-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const colors = new Set();
    let greenish = 0;
    for (let i = 0; i < d.length; i += 400) {
      colors.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
      if (d[i + 1] > d[i] + 8 && d[i + 1] > d[i + 2] + 8) greenish++;
    }
    return { distinct: colors.size, greenish };
  });

  const atHome = await sample();

  // Pan east into Red Lowlands, staying at the default zoom so the per-cell chunk
  // cache (not the zoomed-out flat-fill path) is what renders — a capture that
  // failed to invalidate a cached chunk would keep painting the old faction tint.
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(1100, 400);
    await page.mouse.down();
    for (let s = 1; s <= 8; s++) { await page.mouse.move(1100 - s * 112, 400); await page.waitForTimeout(16); }
    await page.mouse.up();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);

  const before = await sample();
  await page.evaluate(() => window.game.worldMap.captureRegion('red_lowlands'));
  await page.waitForTimeout(800);
  const after = await sample();

  report('world-smoke', [
    { label: 'world view shown', ok: true },
    { label: 'world canvas has a size', ok: state.canvasSized },
    { label: 'world canvas rendered pixels', ok: state.painted > 0 },
    { label: 'regions resolve from the manager', ok: state.regionsResolve },
    { label: 'home region starts player-owned', ok: state.homeOwned },
    { label: 'enemy region starts unowned', ok: state.enemyRegionNotOwned },
    { label: 'curated POI resolves', ok: state.poiResolves },
    { label: 'generated filler POI resolves', ok: state.fillerResolves },
    { label: 'resource node seeded with stock', ok: state.nodeHasStock },
    { label: 'territory legend rendered', ok: state.legendRows > 0 },
    { label: 'grid renders varied terrain, not a flat fill', ok: atHome.distinct > 40 },
    { label: 'unowned territory does not render as owned', ok: before.greenish * 3 < after.greenish },
    { label: 'capturing a region invalidates and recolors its cached chunks', ok: after.greenish > 200 },
  ], errors);
});
