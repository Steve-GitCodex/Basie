import test from 'node:test';
import assert from 'node:assert/strict';

import { GRIT_BUILDING_MAP } from '../../js/ui/city/cityAssets.js';

const GRIT_DIR = 'assets/tiles/buildings/grit';

test('every GRIT_BUILDING_MAP entry has levels 1, 2, 3 pointing at grit sprites', () => {
  for (const [id, levels] of Object.entries(GRIT_BUILDING_MAP)) {
    assert.deepEqual(Object.keys(levels).map(Number).sort(), [1, 2, 3], `${id} levels`);
    for (const [level, path] of Object.entries(levels)) {
      assert.ok(path.startsWith(`${GRIT_DIR}/`), `${id} L${level} path outside grit dir: ${path}`);
      assert.ok(path.endsWith(`_L${level}.png`), `${id} L${level} path missing suffix: ${path}`);
    }
  }
});
