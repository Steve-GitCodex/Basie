// @see docs/20-decisions/0033-dev-launcher.md
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createLauncherServer } from './server.mjs';
import { startWatcher } from './watcher.mjs';
import { startHotkeys } from './hotkeys.mjs';
import { openUrl } from './browser.mjs';
import { createSlotStore, formatSessionMenu, sessionForChoice } from './sessions.mjs';
import { PageLoadGrouper, classifyStatus, formatRequest, formatClientLog, paint, clock } from './logView.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_PORT = 8000;
const PORT_TRIES = 5;
const FLUSH_MS = 250;
const FOOTER_DEBOUNCE_MS = 300;
const FOOTER = '[l] launch a session  [n] new dev slot  [t] tests  [v] verbose  [c] clear  [q] quit';
const COLOR = !!process.stdout.isTTY;

const opts = parseArgs(process.argv.slice(2));
const state = { port: opts.port, verbose: false, testsRunning: false, closing: false, footerTimer: null };
let hotkeys = null;
let watcher = null;
let flushTimer = null;

const grouper = new PageLoadGrouper();
const slotStore = createSlotStore(opts.slotsFile);
const { server, broadcast, closeClients } = createLauncherServer({
  root: ROOT,
  onRequest,
  onClientLog: (entries) => entries.forEach(e => print(formatClientLog({ ...e, at: e.at ?? Date.now() }, { color: COLOR }))),
  onSlots,
  onWarn: warn,
});

await bind();
watcher = startWatcher({ root: ROOT, onBatch, warn });
hotkeys = startHotkeys({ onKey });
printHeader();
printSessions();
flushTimer = setInterval(() => emit(grouper.flush()), FLUSH_MS);
process.on('SIGINT', shutdown);
if (opts.open) openUrl(urlFor(opts.startPath));

function parseArgs(argv) {
  const parsed = { open: false, port: DEFAULT_PORT, startPath: '/', slotsFile: path.join(ROOT, '.basie-launcher-slots.json') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--no-open') parsed.open = false;
    else if (arg === 'normal') parsed.open = true;
    else if (arg === '--port') parsed.port = Number(argv[++i]);
    else if (arg === '--slots-file') parsed.slotsFile = path.resolve(argv[++i]);
    else if (arg === 'dev') {
      const slot = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : null;
      parsed.startPath = slot ? `/?dev=${encodeURIComponent(slot)}` : '/?dev';
      parsed.open = true;
    }
  }
  return parsed;
}

function urlFor(p) {
  return `http://localhost:${state.port}${p}`;
}

async function bind() {
  for (let attempt = 0; ; attempt++) {
    try {
      await listen(state.port);
      return;
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
      if (await isLauncher(state.port)) {
        print(`launcher already running on :${state.port}`);
        if (opts.open) openUrl(urlFor(opts.startPath));
        else print(`open sessions from that launcher's terminal, or ${urlFor('/')}`);
        process.exit(0);
      }
      if (attempt >= PORT_TRIES - 1) {
        print(paint(`ports ${opts.port}–${state.port} are all busy`, 'error', COLOR));
        process.exit(1);
      }
      state.port += 1;
    }
  }
}

function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = (e) => { server.off('listening', onListening); reject(e); };
    const onListening = () => { server.off('error', onError); resolve(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

async function isLauncher(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/__basie/ping`, { signal: AbortSignal.timeout(1500) });
    return (await res.json()).app === 'basie-launcher';
  } catch {
    return false;
  }
}

function print(line) {
  process.stdout.write(line + '\n');
  scheduleFooter();
}

function warn(message) {
  print(paint(`${clock()}  ⚠ ${message}`, 'warn', COLOR));
}

function bell() {
  if (COLOR) process.stdout.write('\x07');
}

function scheduleFooter() {
  if (!hotkeys) return;
  clearTimeout(state.footerTimer);
  state.footerTimer = setTimeout(() => process.stdout.write(paint(FOOTER, 'cached', COLOR) + '\n'), FOOTER_DEBOUNCE_MS);
}

function printHeader() {
  const moved = state.port !== opts.port ? `  ·  port ${opts.port} busy` : '';
  const head = `BASIE ▸ ${urlFor('')}  ·  no-cache  ·  watching js/ css/ assets/${moved}`;
  print(COLOR ? `\x1b[1m${head}\x1b[0m` : head);
}

function printSessions() {
  print(formatSessionMenu(slotStore.list()));
}

async function launchFromList() {
  printSessions();
  const answer = await hotkeys.prompt('session number: ');
  if (!answer) return;
  const session = sessionForChoice(answer, slotStore.list());
  if (session) openUrl(urlFor(session.path));
  else print(paint(`no session [${answer}]`, 'warn', COLOR));
}

function onSlots(slots) {
  if (slotStore.replace(slots)) printSessions();
}

function onRequest(req) {
  if (state.verbose) print(formatRequest(req, { color: COLOR }));
  emit(grouper.add(req));
}

function emit(lines) {
  for (const line of lines) {
    if (line.kind === 'summary') {
      print(paint(`${clock()}  ${line.text}`, line.bell ? 'missing' : null, COLOR));
      if (line.bell) bell();
    } else if (line.kind === 'missing') {
      print('    ' + formatRequest(line.req, { color: COLOR }));
    } else if (!state.verbose) {
      const cls = classifyStatus(line.req.status);
      if (cls === 'missing' || cls === 'error') {
        print(formatRequest(line.req, { color: COLOR }));
        bell();
      }
    }
  }
}

function onBatch({ kind, files }) {
  broadcast(kind === 'css' ? 'css' : 'reload', { files });
  const what = kind === 'css' ? 'css hot-swap' : 'reloading dev tabs';
  print(`${clock()}  ↻ ${files.length} file${files.length === 1 ? '' : 's'} changed → ${what}`);
}

async function onKey(key) {
  if (key === 'l') await launchFromList();
  else if (key === 'n') {
    const name = await hotkeys.prompt('dev slot name: ');
    if (name) openUrl(urlFor(`/?dev=${encodeURIComponent(name)}`));
  } else if (key === 't') runTests();
  else if (key === 'v') {
    state.verbose = !state.verbose;
    print(`verbose ${state.verbose ? 'on' : 'off'}`);
  } else if (key === 'c') {
    process.stdout.write('\x1bc');
    printHeader();
    printSessions();
  } else if (key === 'q') shutdown();
}

function runTests() {
  if (state.testsRunning) return;
  state.testsRunning = true;
  const started = Date.now();
  print(`${clock()}  running npm test…`);
  let out = '';
  const child = spawn('npm', ['test'], { cwd: ROOT, shell: true });
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('error', (e) => {
    state.testsRunning = false;
    print(paint(`tests failed to start: ${e.message}`, 'error', COLOR));
  });
  child.on('close', () => {
    state.testsRunning = false;
    const pass = Number(out.match(/ℹ pass (\d+)/)?.[1] ?? 0);
    const fail = Number(out.match(/ℹ fail (\d+)/)?.[1] ?? 0);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    print(paint(`${clock()}  tests: ${pass} pass · ${fail} fail (${secs}s)`, fail > 0 ? 'error' : null, COLOR));
    if (fail > 0) bell();
  });
}

function shutdown() {
  if (state.closing) return;
  state.closing = true;
  clearInterval(flushTimer);
  clearTimeout(state.footerTimer);
  closeClients();
  watcher?.close();
  hotkeys?.close();
  server.closeAllConnections?.();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
