import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createChangeFilter, fingerprintFile, listFiles } from '../../scripts/launcher/changeFilter.mjs';

function fakeDisk(files) {
  const disk = new Map(Object.entries(files));
  const fingerprint = (rel) => {
    if (rel.endsWith('/')) return { kind: 'dir' };
    return disk.has(rel) ? { kind: 'file', hash: disk.get(rel) } : { kind: 'missing' };
  };
  return { disk, filter: createChangeFilter({ fingerprint }) };
}

test('rewriting a primed file with identical content is not a change', () => {
  const { filter } = fakeDisk({ 'js/a.js': 'h1' });
  filter.prime(['js/a.js']);
  assert.equal(filter.isRealChange('js/a.js'), false);
});

test('an edited file is a change once, then quiet until edited again', () => {
  const { disk, filter } = fakeDisk({ 'css/a.css': 'h1' });
  filter.prime(['css/a.css']);
  disk.set('css/a.css', 'h2');
  assert.equal(filter.isRealChange('css/a.css'), true);
  assert.equal(filter.isRealChange('css/a.css'), false);
});

test('directory events never count as changes', () => {
  const { filter } = fakeDisk({});
  assert.equal(filter.isRealChange('css/components/'), false);
});

test('deleting a known file is a change; a vanished unknown file is not', () => {
  const { disk, filter } = fakeDisk({ 'js/a.js': 'h1' });
  filter.prime(['js/a.js']);
  disk.delete('js/a.js');
  assert.equal(filter.isRealChange('js/a.js'), true);
  assert.equal(filter.isRealChange('js/tmp-save.js'), false);
});

test('an unprimed file counts on first sight and is filtered after', () => {
  const { filter } = fakeDisk({ 'assets/x.png': 'h1' });
  assert.equal(filter.isRealChange('assets/x.png'), true);
  assert.equal(filter.isRealChange('assets/x.png'), false);
});

test('fingerprintFile tells files, directories and missing paths apart by content', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'basie-fp-'));
  const file = path.join(dir, 'a.css');
  fs.writeFileSync(file, 'body{}');
  const first = fingerprintFile(file);
  fs.writeFileSync(file, 'body{}');
  assert.deepEqual(fingerprintFile(file), first);
  fs.writeFileSync(file, 'body{color:red}');
  assert.notEqual(fingerprintFile(file).hash, first.hash);
  assert.equal(fingerprintFile(dir).kind, 'dir');
  assert.equal(fingerprintFile(path.join(dir, 'nope')).kind, 'missing');
});

test('listFiles walks nested directories with forward-slash relative paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'basie-ls-'));
  fs.mkdirSync(path.join(root, 'css', 'sub'), { recursive: true });
  fs.writeFileSync(path.join(root, 'css', 'a.css'), '');
  fs.writeFileSync(path.join(root, 'css', 'sub', 'b.css'), '');
  assert.deepEqual(listFiles(root, 'css').sort(), ['css/a.css', 'css/sub/b.css']);
});
