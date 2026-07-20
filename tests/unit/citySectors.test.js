import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SECTORS, SECTOR_IDS, SECTOR_BY_ID, CORE_RECT,
  sectorIdAt, coreContains, sectorName,
} from '../../js/entities/data/citySectors.js';
import { CELL_COLS, CELL_ROWS, inBounds } from '../../js/entities/data/cityGrid.js';

test('sector ids are unique and stably formatted', () => {
  assert.equal(new Set(SECTOR_IDS).size, SECTOR_IDS.length);
  for (const id of SECTOR_IDS) assert.match(id, /^sector_[12]_\d+$/);
});

test('rings partition into 8 inner + 4 corner sectors', () => {
  const ring1 = SECTORS.filter(s => s.ring === 1);
  const ring2 = SECTORS.filter(s => s.ring === 2);
  assert.equal(ring1.length, 8);
  assert.equal(ring2.length, 4);
});

test('core + rubble sectors tile BUILD_RECT exactly once', () => {
  const owner = Array.from({ length: CELL_COLS * CELL_ROWS }, () => 0);
  const stamp = (r) => {
    for (let y = r.cy; y < r.cy + r.h; y++)
      for (let x = r.cx; x < r.cx + r.w; x++) owner[y * CELL_COLS + x]++;
  };
  stamp(CORE_RECT);
  for (const s of SECTORS) {
    assert.ok(inBounds(s.rect.cx, s.rect.cy, s.rect.w, s.rect.h), `${s.id} in bounds`);
    stamp(s.rect);
  }
  assert.ok(owner.every(n => n === 1), 'every cell owned by exactly one sector/core');
});

test('cost curve is base × 2.5 per ring', () => {
  const r1 = SECTOR_BY_ID.get('sector_1_0').cost;
  const r2 = SECTOR_BY_ID.get('sector_2_0').cost;
  for (const key of Object.keys(r1)) {
    assert.equal(r2[key], Math.round(r1[key] * 2.5), `${key} ring-2 cost`);
  }
});

test('outer ring gates on a higher HQ level', () => {
  const r1 = SECTOR_BY_ID.get('sector_1_0');
  const r2 = SECTOR_BY_ID.get('sector_2_0');
  assert.ok(r2.hqLevel > r1.hqLevel);
});

test('sectorIdAt is null in the core, an id in rubble', () => {
  assert.equal(sectorIdAt(CORE_RECT.cx, CORE_RECT.cy), null);
  assert.ok(coreContains(22, 16));                 // HQ centre cell
  assert.equal(sectorIdAt(0, 0), 'sector_2_0');    // top-left corner block
  const id = sectorIdAt(0, 0);
  assert.ok(SECTOR_BY_ID.has(id));
});

test('the HQ footprint sits entirely in the always-clear core', () => {
  for (let y = 14; y < 18; y++)
    for (let x = 20; x < 24; x++) assert.ok(coreContains(x, y), `HQ cell ${x},${y}`);
});

test('sectorName is human-readable and never leaks a raw id', () => {
  assert.match(sectorName('sector_1_0'), /Rubble Sector/);
});
