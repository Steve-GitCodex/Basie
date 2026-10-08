import { withPage, report, dismissOverlays } from './harness.mjs';

const CATS = ['reports', 'rewards', 'system', 'starred', 'trash'];
const REPORT = { victory: true, enemyName: 'Raider Camp', sent: 120, dead: { infantry: 4 }, wounded: { infantry: 6 },
  rounds: 5, enemyLeftPct: 0, rewards: { iron: 30 } };

const waitGame = (page) => page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });
const isVisible = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}, sel);
const openMail = async (page) => {
  if (await page.locator('#mail-root').count()) return;
  await page.click('#btn-mail');
  await page.waitForSelector('#mail-root .mail-tile', { timeout: 5000 });
};
const closeMail = async (page) => {
  if (!(await page.locator('#mail-root').count())) return;
  await page.click('#mail-root .modal-close');
  await page.waitForSelector('#mail-root', { state: 'detached', timeout: 5000 });
};
const selectCat = (page, cat) => page.click(`#mail-root .mail-tile[data-cat="${cat}"]`);
const rowId = (page, sel) => page.evaluate((s) => Number(document.querySelector(s)?.dataset.id), sel);

async function seed(page, report) {
  await page.evaluate((rep) => {
    const mail = window.game.mail;
    mail._messages = [];
    mail.send({ type: 'system', subject: 'Server notice', body: 'Plain text.' });
    for (let i = 0; i < 3; i++) mail.send({ type: 'quest', subject: `Quest ${i}`, body: 'Done.', attachments: { wood: 10 + i } });
    for (let i = 0; i < 2; i++) mail.send({ type: 'combat', subject: `Combat Report ${i}`, body: 'Won.', attachments: { iron: 30 }, report: rep });
  }, report);
}

async function desktopChecks(page, checks) {
  await openMail(page);
  checks.push({
    label: 'dock opens mail with five tiles',
    ok: JSON.stringify(await page.$$eval('#mail-root .mail-tile', ts => ts.map(t => t.dataset.cat))) === JSON.stringify(CATS),
  });
  checks.push({
    label: 'reports tile shows claim 2',
    ok: (await page.textContent('[data-cat=reports] [data-tile-claim]').catch(() => ''))?.trim() === 'Claim 2',
  });
  await selectCat(page, 'rewards');
  checks.push({
    label: 'rows are at least 56px',
    ok: await page.$$eval('.mail-row', rs => rs.length > 0 && rs.every(r => r.getBoundingClientRect().height >= 56)),
  });
  const questId = await rowId(page, '.mail-row');
  await page.click(`.mail-row[data-id="${questId}"] [data-row-claim]`);
  await page.waitForTimeout(150);
  checks.push({
    label: 'inline claim claims without opening',
    ok: await page.locator(`.mail-row[data-id="${questId}"] [data-row-claim]`).count() === 0
      && await page.locator('.mail-row--open').count() === 0,
  });
  await page.evaluate(() => { document.querySelector('.mail-row').dataset.probe = '1'; });
  const firstId = await rowId(page, '.mail-row');
  await page.evaluate((id) => window.game.mail.toggleImportant(id), firstId);
  await page.waitForTimeout(100);
  checks.push({
    label: 'list patches in place',
    ok: await page.evaluate((id) => document.querySelector(`.mail-row[data-id="${id}"]`)?.dataset.probe === '1', firstId),
  });
  await page.evaluate((id) => window.game.mail.toggleImportant(id), firstId);
  await selectCat(page, 'system');
  await page.evaluate(() => window.game.mail.send({ type: 'system', subject: '<img src=x onerror=window.__x=1>', body: '' }));
  await page.waitForTimeout(150);
  checks.push({
    label: 'subject is escaped',
    ok: await page.evaluate(() => window.__x === undefined
      && [...document.querySelectorAll('.mail-row')].some(r => r.textContent.includes('<img'))),
  });
}

const openCount = (page) => page.locator('.mail-row--open').count();
const tileTotal = (page, cat) => page.textContent(`[data-cat=${cat}] .mail-tile__meta`);

async function expandAndClaimChecks(page, checks) {
  await selectCat(page, 'rewards');
  const [a, b] = await page.$$eval('.mail-row', rs => rs.slice(0, 2).map(r => Number(r.dataset.id)));
  await page.click(`.mail-row[data-id="${a}"] .mail-row__head`);
  await page.click(`.mail-row[data-id="${b}"] .mail-row__head`);
  checks.push({
    label: 'expand marks read and opens one row',
    ok: await openCount(page) === 1
      && await page.locator(`.mail-row[data-id="${b}"].mail-row--open`).count() === 1
      && await page.locator(`.mail-row[data-id="${a}"].mail-row--unread`).count() === 0
      && await page.getAttribute(`.mail-row[data-id="${b}"] .mail-row__head`, 'aria-expanded') === 'true',
  });

  await selectCat(page, 'reports');
  await page.click('.mail-row .mail-row__head');
  const banner = await page.textContent('.mail-row--open .mail-report__banner').catch(() => '');
  checks.push({
    label: 'battle report renders',
    ok: /VICTORY/i.test(banner ?? '') && (await page.textContent('.mail-row--open .mail-report')).includes('120'),
  });

  await page.evaluate(() => { window.__shown.length = 0; });
  await page.click('[data-cat=rewards] [data-tile-claim]');
  await page.waitForTimeout(150);
  checks.push({
    label: 'tile claim all clears category',
    ok: !(await isVisible(page, '[data-cat=rewards] [data-tile-claim]'))
      && await page.evaluate(() => window.__shown.length === 1
        && window.__shown[0][0] === 'success' && /Wood \+21/.test(window.__shown[0][2])),
  });

  await page.click('[data-mail-claim-all]');
  await page.waitForTimeout(150);
  checks.push({ label: 'header claim all disables at zero', ok: await page.isDisabled('[data-mail-claim-all]') });
}

async function deleteChecks(page, checks) {
  await selectCat(page, 'rewards');
  const before = await tileTotal(page, 'rewards');
  const id = await rowId(page, '.mail-row');
  await page.click(`.mail-row[data-id="${id}"] .mail-row__head`);
  await page.click(`.mail-row[data-id="${id}"] [data-act=delete]`);
  const gone = await page.locator(`.mail-row[data-id="${id}"]`).count() === 0;
  const undoShown = await isVisible(page, '[data-undo]');
  await page.click('[data-undo]');
  await page.waitForTimeout(100);
  checks.push({
    label: 'delete then undo restores',
    ok: gone && undoShown && await page.locator(`.mail-row[data-id="${id}"]`).count() === 1
      && await tileTotal(page, 'rewards') === before,
  });

  const starId = await rowId(page, '.mail-row');
  await page.click(`.mail-row[data-id="${starId}"] [data-row-star]`);
  await page.click('[data-list-menu]');
  await page.click('[data-act=read-all]');
  await page.click('[data-list-menu]');
  await page.click('[data-act=delete-read]');
  await page.waitForTimeout(100);
  checks.push({
    label: 'delete read keeps starred',
    ok: JSON.stringify(await page.$$eval('.mail-row', rs => rs.map(r => Number(r.dataset.id)))) === JSON.stringify([starId]),
  });

  await selectCat(page, 'trash');
  const trashId = await rowId(page, '.mail-row');
  await page.click(`.mail-row[data-id="${trashId}"] .mail-row__head`);
  await page.click(`.mail-row[data-id="${trashId}"] [data-act=purge]`);
  const dialogShown = await isVisible(page, '.confirm-dialog');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  checks.push({
    label: 'purge uses in-game confirm',
    ok: dialogShown && await page.locator('.confirm-dialog').count() === 0
      && await page.locator('#mail-root').count() === 1
      && await page.evaluate((i) => window.game.mail.getMessages().some(m => m.id === i), trashId),
  });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  checks.push({ label: 'escape closes mail', ok: await page.locator('#mail-root').count() === 0 });
}

async function scrollKeepCheck(page, checks) {
  await page.evaluate(() => {
    for (let i = 0; i < 25; i++) window.game.mail.send({ type: 'system', subject: `Bulk ${i}`, body: 'x' });
  });
  await openMail(page);
  await selectCat(page, 'system');
  const kept = await page.evaluate(async () => {
    const list = document.querySelector('.mail__list');
    list.scrollTop = 400;
    const row = [...list.querySelectorAll('.mail-row')][10];
    row.querySelector('.mail-row__head').click();
    await new Promise(r => setTimeout(r, 50));
    window.game.mail.send({ type: 'system', subject: 'Late arrival', body: 'x' });
    await new Promise(r => setTimeout(r, 100));
    return row.classList.contains('mail-row--open') && row.isConnected && list.scrollTop >= 300;
  });
  checks.push({ label: 'new mail keeps expanded row and scroll', ok: kept });
}

async function phoneUndoCheck(page, checks) {
  await closeMail(page);
  await page.evaluate(() => {
    const mail = window.game.mail;
    mail._messages = mail._messages.filter(m => m.type !== 'system');
    mail.send({ type: 'system', subject: 'Lonely notice', body: 'x' });
  });
  await openMail(page);
  await selectCat(page, 'system');
  await page.click('.mail-row .mail-row__head');
  await page.click('.mail-row--open [data-act=delete]');
  const emptyShown = await isVisible(page, '.mail__empty');
  await page.click('[data-undo]');
  await page.waitForTimeout(100);
  checks.push({
    label: 'phone undo returns from empty state',
    ok: emptyShown && await isVisible(page, '.mail-row') && !(await isVisible(page, '.mail__empty')),
  });
}

async function escapeScopeChecks(page, checks) {
  await closeMail(page);
  const queuedSurvives = await page.evaluate(async () => {
    const { openModal, closeModal } = await import('/js/ui/uiUtils.js');
    openModal('<div id="probe-modal">daily</div>');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    const alive = !!document.getElementById('probe-modal');
    closeModal();
    return alive;
  });
  checks.push({ label: 'escape leaves system modals open', ok: queuedSurvives });

  const pickerOnly = await page.evaluate(async () => {
    const { swapModal, closeModal } = await import('/js/ui/uiUtils.js');
    const { openSpeedupPicker } = await import('/js/ui/buildings/SpeedupPicker.js');
    swapModal('<div id="probe-panel">panel</div>');
    openSpeedupPicker({ anchorRect: { top: 100, left: 100, right: 140, bottom: 120, width: 40, height: 20 },
      queueType: 'build', secsLeft: 60, inventory: window.game.inventory });
    await new Promise(r => setTimeout(r, 50));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    const ok = !document.querySelector('.speedup-picker') && !!document.getElementById('probe-panel');
    closeModal();
    return ok;
  });
  checks.push({ label: 'escape closes speedup picker but not the panel under it', ok: pickerOnly });
}

async function sharedFrameCheck(page, checks, label) {
  await closeMail(page);
  const rectOf = () => page.evaluate(() => {
    const r = document.getElementById('modal-content').getBoundingClientRect();
    return [r.left, r.top, r.width, r.height].map(Math.round).join(',');
  });
  await openMail(page);
  await page.waitForTimeout(400);
  const mailRect = await rectOf();
  await page.click('#btn-inventory');
  await page.waitForSelector('#inv-root', { timeout: 5000 });
  await page.waitForTimeout(400);
  const invRect = await rectOf();
  await page.click('#inv-root .modal-close');
  await page.waitForSelector('#inv-root', { state: 'detached', timeout: 5000 });
  checks.push({ label: `mail and inventory share one frame (${label})`, ok: mailRect === invRect });
}

async function phoneChecks(page, checks) {
  await closeMail(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await openMail(page);
  checks.push({
    label: 'phone shows hub only',
    ok: await isVisible(page, '.mail__hub') && !(await isVisible(page, '.mail__listwrap')),
  });
  await selectCat(page, 'rewards');
  const listShown = await isVisible(page, '.mail__listwrap') && !(await isVisible(page, '.mail__hub'));
  await page.click('[data-mail-back]');
  checks.push({
    label: 'phone tile opens list, back returns',
    ok: listShown && await isVisible(page, '.mail__hub'),
  });
  checks.push({
    label: 'phone modal fits viewport',
    ok: await page.evaluate(() => {
      const r = document.getElementById('modal-content').getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= 360 && r.bottom <= 640;
    }),
  });
}

await withPage(async ({ page, errors, origin }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}/index.html?dev=mailsmoke`, { waitUntil: 'domcontentloaded' });
  await waitGame(page);
  await page.waitForTimeout(1500);
  await dismissOverlays(page);
  await page.addStyleTag({ content: '#notification-container, #notification-container * { pointer-events: none !important; } .dev-dashboard, .dev-dashboard__toggle { display: none !important; }' });
  await page.evaluate(() => {
    window.__shown = [];
    const notifications = window.game.notifications;
    const show = notifications.show.bind(notifications);
    notifications.show = (...args) => { window.__shown.push(args); show(...args); };
  });
  await seed(page, REPORT);

  const checks = [];
  await desktopChecks(page, checks);
  await expandAndClaimChecks(page, checks);
  await deleteChecks(page, checks);
  await scrollKeepCheck(page, checks);
  await escapeScopeChecks(page, checks);
  await sharedFrameCheck(page, checks, "desktop");
  await phoneChecks(page, checks);
  await phoneUndoCheck(page, checks);
  await sharedFrameCheck(page, checks, "phone");
  report('mail-smoke', checks, errors);
});
