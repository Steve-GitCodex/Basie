/**
 * align-smoke.mjs
 * ADR 0021/0022 invariant: every building sprite seats on its footprint — the
 * drawn sprite bottom-center coincides with the footprint front (south) corner,
 * which is exactly where the proxy rect, on-canvas label, and roads are anchored.
 * Regression guard for the "sprites draw offset up-left of their footprint" report:
 * for every built building, the projected front corner must match the proxy rect's
 * bottom-center within a couple of px, at home framing and after a pan.
 */
import { loadPlaywright, startServer, collectErrors, dismissOverlays } from './harness.mjs';

const TOL = 2; // px

/**
 * The invariant that actually matters: each sprite's rig-exported ground-contact
 * anchor must land on its plot CENTRE. (The old check compared the draw anchor to
 * `_frontWorld` — both derived from the same function, so it was a tautology and
 * passed while buildings visibly sat off their plots.)
 */
async function measure(page) {
  return page.evaluate(() => {
    const city = window.game.city;
    const out = [];
    for (const slot of city._slots) {
      if (!(slot.level > 0)) continue;
      const box = city._spriteBox(slot);
      if (!box) continue;
      const a = city._assets.anchor(slot.buildingId, slot.level);
      const c = city._centerWorld(slot);
      out.push({
        id: `${slot.buildingId}_${slot.instanceIndex}`,
        dx: Math.round((box.left + a.ax) - c.x),
        dy: Math.round((box.top + a.ay) - c.y),
      });
    }
    return out;
  });
}

async function run() {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = collectErrors(page);
  const checks = [];
  const add = (label, ok) => checks.push({ label, ok });

  try {
    await page.goto(`${server.origin}/index.html?dev`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20000 });
    await page.waitForTimeout(1000);
    for (let i = 0; i < 4; i++) { await dismissOverlays(page); await page.waitForTimeout(300); }
    await page.evaluate(() => window.game.eventBus.emit('ui:navigateTo', 'base'));
    await page.waitForFunction(() => !!window.game.city?._slots?.length, null, { timeout: 10000 });
    await page.evaluate(() => window.game.city.home());
    await page.waitForTimeout(600);

    let rows = await measure(page);
    add(`measured ${rows.length} built buildings`, rows.length >= 3);
    const bad = rows.filter(r => Math.abs(r.dx) > TOL || Math.abs(r.dy) > TOL);
    add('every sprite ground-anchor seats on its plot centre (home)', bad.length === 0);
    if (bad.length) console.error('  offenders:', JSON.stringify(bad));

    const missing = await page.evaluate(() => {
      const a = window.game.city._assets;
      return window.game.city._slots
        .filter(s => s.level > 0 && !a._anchor.get(a.variantKey(s.buildingId, s.level)))
        .map(s => s.buildingId);
    });
    add('every built sprite has a rig-exported ground anchor', missing.length === 0);
    if (missing.length) console.error('  missing anchors:', JSON.stringify(missing));

    // The anchor check above is necessary but not sufficient: sprite bottom == front
    // corner only seats the building if the sprite's opaque content actually reaches
    // its bottom edge. Baked transparent padding below content re-introduces the float
    // even with a correct anchor (the "still offset after every fix" bug). Guard it.
    const pads = await page.evaluate(() => {
      const a = window.game.city._assets;
      const seen = new Map();
      for (const s of window.game.city._slots) {
        if (!(s.level > 0)) continue;
        seen.set(`${s.buildingId}:${s.level}`, a.bottomPad(s.buildingId, s.level));
      }
      return [...seen].map(([k, v]) => ({ k, v }));
    });
    const padded = pads.filter(p => p.v > 6);
    add('no built sprite has transparent padding below its content', padded.length === 0);
    if (padded.length) console.error('  padded sprites:', JSON.stringify(padded));

    // Pan and re-check — the invariant must hold under any camera state.
    await page.evaluate(() => window.game.city._camera.panBy(-120, 80));
    await page.waitForTimeout(300);
    rows = await measure(page);
    const bad2 = rows.filter(r => Math.abs(r.dx) > TOL || Math.abs(r.dy) > TOL);
    add('invariant holds after a pan', bad2.length === 0);
    if (bad2.length) console.error('  offenders(pan):', JSON.stringify(bad2));

    console.log(`  sample Δ: ${rows.slice(0, 4).map(r => `${r.id}(${r.dx},${r.dy})`).join('  ')}`);
  } finally {
    await browser.close();
    server.stop();
  }

  const failures = checks.filter(c => !c.ok).map(c => `  ✖ ${c.label}`);
  for (const c of checks) if (c.ok) console.log(`  ✔ ${c.label}`);
  for (const f of failures) console.error(f);
  for (const e of errors) console.error(`  ✖ ${e}`);
  const failed = failures.length > 0 || errors.length > 0;
  console.log(failed ? 'align-smoke: FAIL' : 'align-smoke: PASS');
  process.exitCode = failed ? 1 : 0;
}

run();
