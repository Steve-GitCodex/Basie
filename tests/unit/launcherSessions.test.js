import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { sanitizeSlotList, sessionEntries, sessionForChoice, formatSessionMenu, createSlotStore } from '../../scripts/launcher/sessions.mjs';

test('slot lists are sanitized, de-duplicated and sorted', () => {
  assert.deepEqual(sanitizeSlotList(['Zed', 'alpha', 'zed', 42, '\x1b[2Jx']), ['2jx', 'alpha', 'zed']);
  assert.equal(sanitizeSlotList({ not: 'a list' }), null);
});

test('normal is always session 1 and dev slots follow in order', () => {
  const entries = sessionEntries(['a', 'b b']);
  assert.deepEqual(entries.map(e => e.label), ['normal', 'dev:a', 'dev:b b']);
  assert.equal(entries[2].path, '/?dev=b%20b');
});

test('a typed number picks that session; anything else picks nothing', () => {
  assert.equal(sessionForChoice('1', ['a']).path, '/');
  assert.equal(sessionForChoice(' 2 ', ['a']).path, '/?dev=a');
  assert.equal(sessionForChoice('3', ['a']), null);
  assert.equal(sessionForChoice('0', ['a']), null);
  assert.equal(sessionForChoice('two', ['a']), null);
});

test('the menu numbers every session, including past nine', () => {
  const slots = Array.from({ length: 10 }, (_, i) => `s${String(i).padStart(2, '0')}`);
  const menu = formatSessionMenu(slots);
  assert.match(menu, /\[1\] normal/);
  assert.match(menu, /\[11\] dev:s09/);
  assert.equal(sessionForChoice('11', slots).path, '/?dev=s09');
});

test('the menu explains how to create a slot when none exist', () => {
  assert.match(formatSessionMenu([]), /no dev slots yet/);
});

test('the slot store persists reported slots across launcher restarts', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'basie-slots-')), 'slots.json');
  const store = createSlotStore(file);
  assert.deepEqual(store.list(), []);
  assert.equal(store.replace(['a', 'b']), true);
  assert.equal(store.replace(['a', 'b']), false);
  assert.deepEqual(createSlotStore(file).list(), ['a', 'b']);
});

test('a corrupt slot file yields an empty list instead of crashing', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'basie-slots-')), 'slots.json');
  fs.writeFileSync(file, '{oops');
  assert.deepEqual(createSlotStore(file).list(), []);
});
