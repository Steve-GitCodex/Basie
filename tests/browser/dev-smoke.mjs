import { withPage, report } from './harness.mjs';

await withPage(async ({ page, errors, origin }) => {
  // Seed a fake pre-existing real save so we can assert the dev session never
  // touches it (ephemeral contract, ADR 0014).
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  const SENTINEL = '{"sentinel":"real-save","gameMode":"campaign"}';
  await page.evaluate((s) => localStorage.setItem('basie_game_state', s), SENTINEL);

  await page.goto(`${origin}/index.html?dev`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });
  await page.waitForTimeout(1500);

  const state = await page.evaluate((sentinel) => {
    const g = window.game;
    return {
      mode: g.engine.gameMode,
      hq: g.buildings.getHQLevel(),
      rally: g.buildings.getLevelOf('rallypoint'),
      squadUnits: g.units.getSquads()[0]?.units?.reduce((a, u) => a + u.count, 0) ?? 0,
      worldShown: !document.querySelector('#view-world')?.classList.contains('hidden'),
      realSaveIntact: localStorage.getItem('basie_game_state') === sentinel,
    };
  }, SENTINEL);

  report('dev-smoke', [
    { label: 'boots straight into sandbox mode', ok: state.mode === 'sandbox' },
    { label: 'HQ raised to Lv.3 (world unlock prereq)', ok: state.hq === 3 },
    { label: 'Rally Point built (world tab unlocked)', ok: state.rally >= 1 },
    { label: 'a march-ready squad exists', ok: state.squadUnits > 0 },
    { label: 'lands on the world map', ok: state.worldShown },
    { label: 'pre-existing real save left untouched', ok: state.realSaveIntact },
  ], errors);
});
