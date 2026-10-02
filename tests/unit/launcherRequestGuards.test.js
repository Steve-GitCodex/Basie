import test from 'node:test';
import assert from 'node:assert/strict';

import { isTrustedRequest, sanitizeClientEntries } from '../../scripts/launcher/requestGuards.mjs';

test('same-host requests with no or matching origin are trusted', () => {
  assert.equal(isTrustedRequest({ host: 'localhost:8000' }, 8000), true);
  assert.equal(isTrustedRequest({ host: '127.0.0.1:8000', origin: 'http://127.0.0.1:8000' }, 8000), true);
  assert.equal(isTrustedRequest({ host: 'localhost:8000', origin: 'http://localhost:8000' }, 8000), true);
});

test('foreign origins and rebinding hosts are rejected', () => {
  assert.equal(isTrustedRequest({ host: 'localhost:8000', origin: 'https://evil.example' }, 8000), false);
  assert.equal(isTrustedRequest({ host: 'evil.example:8000' }, 8000), false);
  assert.equal(isTrustedRequest({ host: 'localhost:9999' }, 8000), false);
});

test('non-array payloads are rejected', () => {
  assert.equal(sanitizeClientEntries({ a: 1 }), null);
  assert.equal(sanitizeClientEntries('x'), null);
});

test('null and non-object entries are dropped instead of crashing', () => {
  assert.deepEqual(sanitizeClientEntries([null, 3, 'x', []]), []);
});

test('entries are coerced to strings with sane defaults', () => {
  const [e] = sanitizeClientEntries([{ level: 'weird', message: 42, tag: null }]);
  assert.equal(e.level, 'error');
  assert.equal(e.message, '42');
  assert.equal(e.tag, 'unknown');
  assert.equal(e.source, '');
  assert.ok(Number.isFinite(e.at));
});

test('terminal control characters are stripped from client text', () => {
  const [e] = sanitizeClientEntries([{ level: 'warn', message: 'a\x1bcb\x07', tag: 'dev:\x1b[2Jx' }]);
  assert.equal(e.level, 'warn');
  assert.ok(!/[\x00-\x1f\x7f]/.test(e.message + e.tag));
});

test('an oversized batch is capped', () => {
  assert.equal(sanitizeClientEntries(Array.from({ length: 500 }, () => ({ message: 'x' }))).length, 100);
});
