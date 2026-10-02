import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { resolveSafePath, contentType, injectBridge, BRIDGE_TAG } from '../../scripts/launcher/staticFiles.mjs';

const root = path.resolve('fixture-root');

test('plain paths resolve under root', () => {
  assert.equal(resolveSafePath(root, '/js/main.js'), path.join(root, 'js', 'main.js'));
});

test('the site root maps to index.html', () => {
  assert.equal(resolveSafePath(root, '/'), path.join(root, 'index.html'));
});

test('query strings and hashes are ignored (css hot-swap appends ?v=)', () => {
  const plain = path.join(root, 'js', 'main.js');
  assert.equal(resolveSafePath(root, '/js/main.js?v=123'), plain);
  assert.equal(resolveSafePath(root, '/js/main.js#x'), plain);
});

test('percent-encoded names are decoded', () => {
  assert.equal(resolveSafePath(root, '/assets/my%20file.png'), path.join(root, 'assets', 'my file.png'));
});

test('traversal outside root and malformed encodings are rejected', () => {
  for (const bad of ['/../secret', '/%2e%2e/secret', '/js/../../secret', '/%E0%A4%A', '/..%5csecret']) {
    assert.equal(resolveSafePath(root, bad), null, bad);
  }
});

test('content types cover game assets and fall back to octet-stream', () => {
  assert.equal(contentType('a.css'), 'text/css; charset=utf-8');
  assert.equal(contentType('a.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentType('a.png'), 'image/png');
  assert.equal(contentType('A.PNG'), 'image/png');
  assert.equal(contentType('a.xyz'), 'application/octet-stream');
});

test('injectBridge inserts the tag once before </head>', () => {
  const html = '<html><head><title>x</title></head><body></body></html>';
  const once = injectBridge(html);
  assert.ok(once.includes(BRIDGE_TAG + '</head>'));
  assert.equal(injectBridge(once).split(BRIDGE_TAG).length - 1, 1);
});

test('injectBridge leaves html without a head untouched', () => {
  assert.equal(injectBridge('<p>no head</p>'), '<p>no head</p>');
});
