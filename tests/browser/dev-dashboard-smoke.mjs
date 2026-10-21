import { withPage, report } from './harness.mjs';
import { MOCKUP_CATALOG } from '../../docs/10-design/mockups/catalog.js';

const SLOT_KEY = 'basie_dev_save:smoke';
const SENTINEL = '{"sentinel":"real-save","gameMode":"campaign"}';

async function bootDev(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.game?.eventBus && !!document.querySelector('.dev-dashboard'), null, { timeout: 20_000 });
  await page.waitForTimeout(800);
}

const readState = (page) => page.evaluate(({ slotKey, sentinel }) => ({
  hq: window.game.buildings.getHQLevel(),
  slotSaved: !!localStorage.getItem(slotKey),
  realSaveIntact: localStorage.getItem('basie_game_state') === sentinel,
  panelVisible: !document.querySelector('.dev-dashboard').hidden,
  toolsInPanel: document.querySelectorAll('.dev-dashboard [data-dev-tools] .dev-widget').length,
  strayWidgets: document.querySelectorAll('body > .dev-widget').length,
  slotOptions: [...document.querySelectorAll('[data-dev-slot-select] option')].map(o => o.value),
}), { slotKey: SLOT_KEY, sentinel: SENTINEL });

await withPage(async ({ page, errors, origin }) => {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('basie_game_state', s); }, SENTINEL);

  await bootDev(page, `${origin}/index.html?dev=smoke`);
  const fresh = await readState(page);

  await page.evaluate(() => window.game.eventBus.emit('ui:devSetBuildingLevel', { buildingId: 'townhall', level: 2 }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });
  const reloaded = await readState(page);

  await page.keyboard.press('Backquote');
  const hiddenAfterHotkey = await page.evaluate(() => document.querySelector('.dev-dashboard').hidden);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('.dev-dashboard'), null, { timeout: 20_000 });
  const stillHidden = await page.evaluate(() => document.querySelector('.dev-dashboard').hidden);
  await page.click('.dev-dashboard__toggle');
  const reopened = await page.evaluate(() => !document.querySelector('.dev-dashboard').hidden);

  page.once('dialog', d => d.accept());
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click('[data-dev-reset]'),
  ]);
  await page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });
  await page.waitForTimeout(800);
  const reset = await readState(page);

  const protoLink = await page.evaluate(() => {
    const a = document.querySelector('.dev-dashboard [data-dev-prototypes]');
    return a ? { href: a.href, newTab: a.target === '_blank' } : null;
  });
  await page.goto(protoLink?.href ?? `${origin}/docs/10-design/mockups/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card', { timeout: 10_000 }).catch(() => {});
  const galleryCards = await page.$$eval('.card', cards => cards.map(c => ({ href: c.href, newTab: c.target === '_blank' })));
  const firstCardOk = galleryCards[0]
    ? await page.evaluate(async (href) => (await fetch(href)).ok, galleryCards[0].href)
    : false;

  report('dev-dashboard', [
    { label: 'fresh slot runs the preset (HQ Lv.4)', ok: fresh.hq === 4 },
    { label: 'preset result is saved to the slot key', ok: fresh.slotSaved },
    { label: 'all 4 tools mount inside the dashboard', ok: fresh.toolsInPanel === 4 },
    { label: 'no tool floats loose on <body>', ok: fresh.strayWidgets === 0 },
    { label: 'current slot is listed in the switcher', ok: fresh.slotOptions.includes('smoke') },
    { label: 'refresh keeps dev progress (HQ stays Lv.2)', ok: reloaded.hq === 2 },
    { label: 'real save untouched by a persisted dev slot', ok: reloaded.realSaveIntact },
    { label: 'backtick hides the dashboard', ok: hiddenAfterHotkey },
    { label: 'hidden state survives refresh', ok: stillHidden },
    { label: 'toggle button reopens it', ok: reopened },
    { label: 'Reset slot re-runs the preset (HQ back to Lv.4)', ok: reset.hq === 4 },
    { label: 'real save still untouched after reset', ok: reset.realSaveIntact },
    { label: 'dashboard links to the prototypes gallery in a new tab', ok: !!protoLink && protoLink.newTab },
    { label: 'gallery lists every catalog entry', ok: galleryCards.length === MOCKUP_CATALOG.length },
    { label: 'gallery cards open in a new tab', ok: galleryCards.length > 0 && galleryCards.every(c => c.newTab) },
    { label: 'a gallery card opens a real page', ok: firstCardOk },
  ], errors);
});
