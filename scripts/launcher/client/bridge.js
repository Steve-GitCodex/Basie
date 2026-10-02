// @see docs/20-decisions/0033-dev-launcher.md — injected only by the Basie launcher.
import { sanitizeSlotName } from '/js/core/devSlots.js';

const params = new URLSearchParams(location.search);
const IS_DEV = params.has('dev');
const TAG = IS_DEV ? `dev:${sanitizeSlotName(params.get('dev'))}` : 'normal';
const LOG_URL = '/__basie/log';
const FLUSH_MS = 500;
const DEDUPE_MS = 2000;
const POLL_MS = 1000;
const MAX_MESSAGE = 2000;
const GAME_ROUTED_TAGS = new Set(['window', 'promise']);
const NOTE_ID = 'basie-launcher-note';

const queue = [];
const recent = new Map();

function report(level, message, source = '') {
  const text = String(message).slice(0, MAX_MESSAGE);
  const key = level + text;
  const now = Date.now();
  if (now - (recent.get(key) ?? -Infinity) < DEDUPE_MS) return;
  recent.set(key, now);
  queue.push({ level, message: text, source, tag: TAG, at: now });
}

function flush(useBeacon = false) {
  const cutoff = Date.now() - DEDUPE_MS;
  for (const [k, t] of recent) if (t < cutoff) recent.delete(k);
  if (!queue.length) return;
  const body = JSON.stringify(queue.splice(0));
  if (useBeacon) {
    navigator.sendBeacon(LOG_URL, body);
    return;
  }
  fetch(LOG_URL, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body })
    .catch(() => {});
}

const shortSource = (file, line) => (file ? `${file.replace(location.origin + '/', '')}:${line}` : '');

function describe(arg) {
  if (arg instanceof Error) return arg.message;
  if (arg && typeof arg === 'object') {
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }
  return String(arg);
}

function captureErrors() {
  window.addEventListener('error', (e) => report('error', e.message || describe(e.error), shortSource(e.filename, e.lineno)));
  window.addEventListener('unhandledrejection', (e) => report('error', `unhandled rejection: ${describe(e.reason)}`));
  for (const level of ['error', 'warn']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      report(level, args.map(describe).join(' '));
    };
  }
}

function hookLogManager() {
  const lm = window.game?.log;
  if (!lm) {
    setTimeout(hookLogManager, POLL_MS);
    return;
  }
  const original = lm.log.bind(lm);
  lm.log = (tag, message, level = 'info') => {
    const result = original(tag, message, level);
    if ((level === 'error' || level === 'warn') && !GAME_ROUTED_TAGS.has(tag)) report(level, `${tag}: ${message}`);
    return result;
  };
}

function swapCss(files) {
  const local = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .filter(l => new URL(l.href).origin === location.origin);
  const matched = local.filter(l => files.some(f => new URL(l.href).pathname.endsWith('/' + f)));
  const stamp = Date.now();
  for (const link of matched.length ? matched : local) link.href = `${new URL(link.href).pathname}?v=${stamp}`;
}

function showChangedNote() {
  if (document.getElementById(NOTE_ID)) return;
  const note = document.createElement('div');
  note.id = NOTE_ID;
  note.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:600;'
    + 'display:flex;gap:10px;align-items:center;padding:6px 12px;border-radius:6px;font:12px sans-serif;'
    + 'background:rgba(20,20,20,.92);color:#fff;border:1px solid #c90;';
  note.innerHTML = '<span>Files changed — refresh when ready</span>'
    + '<button type="button" style="background:none;border:0;color:#fff;cursor:pointer;font-size:14px">×</button>';
  note.querySelector('button').addEventListener('click', () => note.remove());
  document.body.appendChild(note);
}

function listenForChanges() {
  const events = new EventSource('/__basie/events');
  let dropped = false;
  events.addEventListener('error', () => { dropped = true; });
  events.addEventListener('open', () => {
    if (dropped && IS_DEV) location.reload();
    dropped = false;
  });
  events.addEventListener('css', (e) => swapCss(JSON.parse(e.data).files ?? []));
  events.addEventListener('reload', () => (IS_DEV ? location.reload() : showChangedNote()));
}

captureErrors();
hookLogManager();
listenForChanges();
setInterval(flush, FLUSH_MS);
window.addEventListener('pagehide', () => flush(true));
