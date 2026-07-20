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
