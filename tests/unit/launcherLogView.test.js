import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyStatus, PageLoadGrouper, formatRequest, formatClientLog,
} from '../../scripts/launcher/logView.mjs';

const MB = 1_048_576;
const req = (path, status, at, bytes = 0) => ({ method: 'GET', path, status, bytes, ms: 2, at });

function grouperAt(start = 0) {
  const clock = { t: start };
  return { clock, g: new PageLoadGrouper({ quietMs: 1000, now: () => clock.t }) };
}

test('status codes map to log classes', () => {
  assert.deepEqual([200, 302, 304, 404, 500].map(classifyStatus), ['ok', 'ok', 'cached', 'missing', 'error']);
});

test('a page-load burst collapses to one summary plus its missing files', () => {
  const { clock, g } = grouperAt();
  assert.deepEqual(g.add(req('/', 200, 0)), []);
  for (const at of [100, 200, 300]) assert.deepEqual(g.add(req(`/f${at}.js`, 200, at, MB)), []);
  assert.deepEqual(g.add(req('/assets/x.png', 404, 400)), []);
  clock.t = 1500;
  const lines = g.flush();
  assert.equal(lines[0].kind, 'summary');
  assert.equal(lines[0].text, 'page load · 5 files · 3.0 MB · 400 ms · 1 missing');
  assert.equal(lines[0].bell, true);
  assert.equal(lines[1].kind, 'missing');
  assert.equal(lines[1].req.path, '/assets/x.png');
  assert.equal(lines.length, 2);
});

test('a clean page load has no bell and no missing suffix', () => {
  const { clock, g } = grouperAt();
  g.add(req('/index.html', 200, 0));
  clock.t = 2000;
  const [summary] = g.flush();
  assert.equal(summary.text, 'page load · 1 files · 0.0 MB · 0 ms');
  assert.equal(summary.bell, false);
});

test('flush before the quiet period keeps the group open', () => {
  const { clock, g } = grouperAt();
  g.add(req('/', 200, 0));
  clock.t = 500;
  assert.deepEqual(g.flush(), []);
});

test('requests outside a group are returned individually', () => {
  const { clock, g } = grouperAt();
  g.add(req('/', 200, 0));
  clock.t = 1500;
  g.flush();
  const lines = g.add(req('/late.js', 200, 5000));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].kind, 'request');
});

test('a new page load closes the previous group immediately', () => {
  const { g } = grouperAt();
  g.add(req('/', 200, 0));
  g.add(req('/a.js', 200, 100));
  const lines = g.add(req('/', 200, 300));
  assert.equal(lines[0].kind, 'summary');
  assert.match(lines[0].text, /^page load · 2 files/);
});

test('formatRequest renders time, status, method, path and duration', () => {
  const at = new Date(2026, 9, 1, 12, 4, 31).getTime();
  const r = { status: 404, method: 'GET', path: '/a.png', ms: 3, at };
  assert.equal(formatRequest(r, { color: false }), '12:04:31  404  GET /a.png  3ms');
  assert.ok(formatRequest(r, { color: true }).includes('\x1b[31m'));
});

test('formatClientLog tags the tab and marks errors and warnings', () => {
  const at = new Date(2026, 9, 1, 12, 4, 40).getTime();
  const e = formatClientLog({ level: 'error', message: 'boom', source: 'js/x.js:4', tag: 'dev:world', at }, { color: false });
  assert.equal(e, '12:04:40  [dev:world] ✖ boom  (js/x.js:4)');
  const w = formatClientLog({ level: 'warn', message: 'hm', tag: 'normal', at }, { color: true });
  assert.ok(w.includes('⚠') && w.includes('\x1b[33m'));
});
