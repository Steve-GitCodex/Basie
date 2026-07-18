import test from 'node:test';
import assert from 'node:assert/strict';

import { MANIFEST, CATEGORY_VOLUME } from '../../js/systems/sound/sampleLibrary.js';

test('every manifest entry has a non-empty file list', () => {
  for (const [key, entry] of Object.entries(MANIFEST)) {
    assert.ok(Array.isArray(entry.files) && entry.files.length > 0, `${key} has files`);
  }
});

test('every file path is an .ogg under a known audio subdir', () => {
  const dirs = new Set(['ui', 'combat', 'effects', 'voice']);
  for (const [key, entry] of Object.entries(MANIFEST)) {
    for (const f of entry.files) {
      assert.ok(f.endsWith('.ogg'), `${key}: ${f} ends in .ogg`);
      assert.ok(dirs.has(f.split('/')[0]), `${key}: ${f} under known dir`);
    }
  }
});

test('every manifest category has a defined volume in 0..1', () => {
  for (const [key, entry] of Object.entries(MANIFEST)) {
    const vol = CATEGORY_VOLUME[entry.cat];
    assert.equal(typeof vol, 'number', `${key} cat ${entry.cat} has a volume`);
    assert.ok(vol > 0 && vol <= 1, `${key} volume in range`);
  }
});

test('no duplicate file paths within a single manifest entry', () => {
  for (const [key, entry] of Object.entries(MANIFEST)) {
    assert.equal(new Set(entry.files).size, entry.files.length, `${key} has no dup variants`);
  }
});
