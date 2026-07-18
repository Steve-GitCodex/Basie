import test from 'node:test';
import assert from 'node:assert/strict';

import { MANIFEST, CATEGORY_VOLUME, SampleLibrary } from '../../js/systems/sound/sampleLibrary.js';

const mockCtx = () => {
  const ctx = {
    currentTime: 0,
    state: 'running',
    destination: {},
    sources: 0,
    createBufferSource() { ctx.sources++; return { buffer: null, connect() {}, start() {} }; },
    createGain() { return { gain: {}, connect() {} }; },
  };
  return ctx;
};

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

test('simultaneous voice clips queue and play one at a time', async () => {
  const ctx = mockCtx();
  const lib = new SampleLibrary(ctx);
  lib._buffers.set('missionComplete', [{ duration: 0.01 }]);
  lib._buffers.set('victory', [{ duration: 0.01 }]);

  assert.equal(lib.tryPlay('missionComplete'), true);
  assert.equal(lib.tryPlay('victory'), true, 'consumed (no tone fallback)');
  assert.equal(ctx.sources, 1, 'only the first voice starts immediately');

  await new Promise(r => setTimeout(r, 200));
  assert.equal(ctx.sources, 2, 'queued voice plays once the first finishes');
});

test('the voice queue is capped so a burst cannot avalanche', () => {
  const ctx = mockCtx();
  const lib = new SampleLibrary(ctx);
  lib._buffers.set('victory', [{ duration: 5 }]);

  for (let i = 0; i < 10; i++) lib.tryPlay('victory');
  assert.equal(ctx.sources, 1, 'one plays now');
  assert.ok(lib._voiceQueue.length <= 3, 'backlog is bounded');
});

test('non-voice samples still stack (only the voice channel is exclusive)', () => {
  const ctx = mockCtx();
  const lib = new SampleLibrary(ctx);
  lib._buffers.set('impact', [{ duration: 0.1 }]);
  lib.tryPlay('impact');
  lib.tryPlay('impact');
  assert.equal(ctx.sources, 2);
});

test('no duplicate file paths within a single manifest entry', () => {
  for (const [key, entry] of Object.entries(MANIFEST)) {
    assert.equal(new Set(entry.files).size, entry.files.length, `${key} has no dup variants`);
  }
});
