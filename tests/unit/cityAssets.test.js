import test from 'node:test';
import assert from 'node:assert/strict';

import { CityAssets, GRIT_BUILDING_MAP, AI_BUILDING_MAP, gritBucket, stageBucket, normalizeAnchor } from '../../js/ui/city/cityAssets.js';

const GRIT_DIR = 'assets/tiles/buildings/grit';
const AI_DIR = 'assets/tiles/buildings/ai';

test('every GRIT_BUILDING_MAP entry has contiguous levels from 1 pointing at grit sprites', () => {
  for (const [id, levels] of Object.entries(GRIT_BUILDING_MAP)) {
    const keys = Object.keys(levels).map(Number).sort((a, b) => a - b);
    const expected = keys.map((_, i) => i + 1); // [1, 2, ..., keys.length] — no gaps, starts at 1
    assert.deepEqual(keys, expected, `${id} levels must be contiguous from 1, got ${keys}`);
    for (const [level, path] of Object.entries(levels)) {
      assert.ok(path.startsWith(`${GRIT_DIR}/`), `${id} L${level} path outside grit dir: ${path}`);
      assert.ok(path.endsWith(`_L${level}.png`), `${id} L${level} path missing suffix: ${path}`);
    }
  }
});

test('gritBucket clamps to each building\'s own highest bucket, not a shared global cap', () => {
  // Grit types top out at whatever levels their art ships (3 today, since the HQ
  // regen re-sourced townhall from Wonder_SecondAge which has only L1-3). A building
  // whose gameplay level (up to 10, see buildings.js maxLevel) exceeds its own art
  // buckets must clamp to its own best-available bucket, never fall through to L1.
  assert.equal(gritBucket('townhall', 1), 1);
  assert.equal(gritBucket('townhall', 3), 3);
  assert.equal(gritBucket('townhall', 4), 3, 'townhall has no grit L4 — clamp to 3, not fall back to 1');
  assert.equal(gritBucket('townhall', 10), 3, 'townhall Lv.10 shows its best (Lv.3) grit art');

  assert.equal(gritBucket('well', 3), 3);
  assert.equal(gritBucket('well', 4), 3, 'well has no L4 art — must clamp to 3, not fall back to 1');
  assert.equal(gritBucket('well', 10), 3, 'well has no L4 art — must clamp to 3, not fall back to 1');

  assert.equal(gritBucket('unknown_type', 5), 3, 'a type absent from the map defaults to a 3-bucket clamp');
});

test('every AI_BUILDING_MAP entry has contiguous stages from 1 pointing at ai sprites', () => {
  for (const [id, stages] of Object.entries(AI_BUILDING_MAP)) {
    const keys = Object.keys(stages).map(Number).sort((a, b) => a - b);
    assert.deepEqual(keys, keys.map((_, i) => i + 1), `${id} stages must be contiguous from 1, got ${keys}`);
    for (const [stage, path] of Object.entries(stages)) {
      assert.ok(path.startsWith(`${AI_DIR}/`), `${id} S${stage} path outside ai dir: ${path}`);
      assert.ok(path.endsWith(`_S${stage}.png`), `${id} S${stage} path missing suffix: ${path}`);
    }
  }
});

test('stageBucket clamps a level to the AI type\'s highest available stage', () => {
  // townhall's AI set currently carries 4 stages; a level past that clamps to the
  // best (never falls back to stage 1), and a type with no AI set clamps to 1.
  assert.equal(stageBucket('townhall', 1), 1);
  assert.equal(stageBucket('townhall', 4), 4);
  assert.equal(stageBucket('townhall', 10), 4, 'townhall Lv.10 shows its best (stage 4) AI art');
  assert.equal(stageBucket('well', 5), 1, 'a type with no AI set clamps to stage 1');
});

test('AI sprites are off by default (grit is the default set) and the dev setter flips it', () => {
  // Grit is the default for everyone; the AI set is only routed to in a dev `?ai`
  // session or via the DevSpriteSource toggle (ADR 0024). In Node there is no
  // location, so a fresh instance must default to grit.
  const assets = new CityAssets();
  assert.equal(assets.aiEnabled, false, 'AI must be off unless a dev opts in');
  assets.setAiSprites(true);
  assert.equal(assets.aiEnabled, true);
  assets.setAiSprites(false);
  assert.equal(assets.aiEnabled, false);
});

test('normalizeAnchor defaults scale/rotation/skew and preserves explicit values', () => {
  // The renderer multiplies draw scale by anchor.s and rotates/skews by r/k degrees
  // about the anchor (DevAnchorNudger + ADR 0024); legacy anchors carry none of these
  // and must render unscaled, unrotated, unskewed.
  assert.deepEqual(normalizeAnchor({ ax: 70, ay: 140 }), { ax: 70, ay: 140, s: 1, r: 0, k: 0 });
  assert.deepEqual(
    normalizeAnchor({ ax: 70, ay: 140, s: 1.1, r: -3, k: 2 }),
    { ax: 70, ay: 140, s: 1.1, r: -3, k: 2 },
  );
  assert.equal(normalizeAnchor({ ax: 1, ay: 2, s: NaN }).s, 1, 'a non-finite s falls back to 1');
  assert.equal(normalizeAnchor({ ax: 1, ay: 2, r: NaN }).r, 0, 'a non-finite r falls back to 0');
});
