import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';
import { loadPlaywright, collectErrors, bootGuestSandbox, report } from './harness.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8124;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CSS_FILE = join(REPO_ROOT, 'css', 'components', 'dev.css');
const JS_FILE = join(REPO_ROOT, 'js', 'core', 'devSlots.js');

async function waitFor(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await check()) return true;
    } catch { /* page mid-navigation */ }
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}

const touch = (file) => fs.writeFileSync(file, fs.readFileSync(file));

const SLOTS_FILE = join(fs.mkdtempSync(join(os.tmpdir(), 'basie-launcher-')), 'slots.json');
const launcher = spawn(process.execPath, ['scripts/launcher/launch.mjs', '--port', String(PORT), '--slots-file', SLOTS_FILE], { cwd: REPO_ROOT });
let stdout = '';
launcher.stdout.on('data', (d) => { stdout += d; });
launcher.stderr.on('data', (d) => { stdout += d; });

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const checks = [];
let errors = [];
try {
  const pingOk = await waitFor(async () => (await (await fetch(`${ORIGIN}/__basie/ping`)).json()).app === 'basie-launcher', 20_000);
  checks.push({ label: 'ping answers as basie-launcher', ok: pingOk });
  checks.push({ label: 'startup lists sessions instead of opening a tab', ok: await waitFor(() => stdout.includes('[1] normal'), 3000) });

  const html = await (await fetch(`${ORIGIN}/`)).text();
  checks.push({ label: 'served index.html carries the bridge tag', ok: html.includes('/__basie/bridge.js') });

  const pageA = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  errors = collectErrors(pageA);
  await bootGuestSandbox(pageA, ORIGIN);
  await pageA.waitForTimeout(1000);
  checks.push({ label: 'normal boot has zero page errors', ok: errors.length === 0 });

  await pageA.evaluate(() => setTimeout(() => { throw new Error('smoke-bridge-ping'); }));
  checks.push({
    label: 'page error reaches the terminal tagged [normal]',
    ok: await waitFor(() => /\[normal\].*smoke-bridge-ping/.test(stdout), 3000),
  });
  errors = errors.filter(e => !e.includes('smoke-bridge-ping'));

  await pageA.evaluate(() => window.game.log.log('smoke', 'smoke-logmanager-ping', 'error'));
  checks.push({
    label: 'logManager errors reach the terminal',
    ok: await waitFor(() => stdout.includes('smoke-logmanager-ping'), 3000),
  });

  const pageB = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await pageB.goto(`${ORIGIN}/index.html?dev=smoke`, { waitUntil: 'domcontentloaded' });
  await pageB.waitForFunction(() => !!window.game?.eventBus, null, { timeout: 20_000 });
  await pageB.waitForTimeout(800);
  checks.push({
    label: 'a saved dev slot is reported into the terminal session list',
    ok: await waitFor(() => /\[\d+\] dev:smoke/.test(stdout), 5000),
  });
  checks.push({ label: 'reported slots persist to the slots file', ok: fs.readFileSync(SLOTS_FILE, 'utf8').includes('smoke') });

  await pageA.evaluate(() => { window.__marker = 1; });
  touch(CSS_FILE);
  const swapped = await waitFor(() => pageA.evaluate(() =>
    [...document.querySelectorAll('link[rel="stylesheet"]')].some(l => l.href.includes('?v='))), 3000);
  checks.push({
    label: 'css change hot-swaps without reload',
    ok: swapped && await pageA.evaluate(() => window.__marker === 1),
  });

  await pageB.evaluate(() => { window.__marker = 1; });
  touch(JS_FILE);
  checks.push({
    label: 'js change reloads a dev tab',
    ok: await waitFor(() => pageB.evaluate(() => window.__marker === undefined), 5000),
  });
  const noteShown = await waitFor(() => pageA.evaluate(() => !!document.getElementById('basie-launcher-note')), 3000);
  checks.push({
    label: 'js change does not reload a normal tab, shows note',
    ok: noteShown && await pageA.evaluate(() => window.__marker === 1),
  });

  checks.push({ label: 'launcher never hit EADDRINUSE', ok: !stdout.includes('EADDRINUSE') });
} finally {
  await browser.close();
  launcher.kill();
}

report('launcher', checks, errors);
