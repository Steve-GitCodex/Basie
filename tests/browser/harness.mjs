import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PW_ROOT = process.env.BASIE_PW_ROOT ?? 'C:\\Users\\Steve\\AppData\\Local\\Temp\\claude\\basie-verify\\';
const PORT = Number(process.env.BASIE_PORT ?? 8123);
const ORIGIN = `http://127.0.0.1:${PORT}`;

export function loadPlaywright() {
  const require = createRequire(join(PW_ROOT, 'noop.js'));
  try {
    return require('playwright');
  } catch (err) {
    throw new Error(
      `playwright not resolvable from ${PW_ROOT}\n` +
      `Install it there (npm install playwright) or set BASIE_PW_ROOT.\n${err.message}`,
    );
  }
}

async function waitForServer(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${ORIGIN}/index.html`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`server did not come up on ${ORIGIN}`);
}

export async function startServer() {
  const proc = spawn(`npx -y http-server -p ${PORT} -s`, {
    cwd: REPO_ROOT, shell: true, stdio: 'ignore',
  });
  await waitForServer();
  return { origin: ORIGIN, stop: () => { proc.kill(); } };
}

export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

async function clickIfPresent(page, selector, timeout = 2000) {
  try {
    await page.click(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

/** Overlays that eat clicks: story dialogs, quest/achievement modals, tutorial blockers. */
export async function dismissOverlays(page) {
  await clickIfPresent(page, '#story-btn-skip', 1500);
  await clickIfPresent(page, '#btn-tutorial-skip', 1500);
  await page.evaluate(() => {
    document.querySelector('#modal-overlay')?.classList.add('hidden');
    document.querySelector('#bq-sidebar')?.classList.add('is-collapsed');
  });
}

/** Boot a fresh guest sandbox game and wait for the engine to expose window.game. */
export async function bootGuestSandbox(page, origin) {
  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.click('#auth-guest');
  await page.click('.newgame-mode-btn[data-mode="sandbox"]');
  await page.click('#btn-newgame-confirm');
  await page.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 15_000 });
  await dismissOverlays(page);
}

export async function withPage(fn) {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = collectErrors(page);
  try {
    return await fn({ page, errors, origin: server.origin });
  } finally {
    await browser.close();
    server.stop();
  }
}

export function report(name, checks, errors) {
  const failures = checks.filter(c => !c.ok).map(c => `  ✖ ${c.label}`);
  for (const c of checks) if (c.ok) console.log(`  ✔ ${c.label}`);
  for (const f of failures) console.error(f);
  for (const e of errors) console.error(`  ✖ ${e}`);
  const failed = failures.length > 0 || errors.length > 0;
  console.log(failed ? `${name}: FAIL` : `${name}: PASS`);
  process.exitCode = failed ? 1 : 0;
}
