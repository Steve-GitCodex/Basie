import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MOCKUP_CATALOG } from '../../docs/10-design/mockups/catalog.js';

const MOCKUPS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', '10-design', 'mockups');
const GALLERY = 'index.html';
const SKIPPED_DIRS = new Set(['_verify', 'ui-reference']);
const STATUSES = new Set(['design', 'built', 'superseded']);

function listHtml(dir, rel = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : listHtml(path.join(dir, entry.name), relPath);
    return entry.name.endsWith('.html') ? [relPath] : [];
  });
}

test('every catalog entry points at an existing prototype file', () => {
  for (const entry of MOCKUP_CATALOG) {
    assert.ok(fs.existsSync(path.join(MOCKUPS_DIR, entry.path)), `missing file for "${entry.title}": ${entry.path}`);
  }
});

test('every prototype page under mockups/ is listed in the catalog', () => {
  const listed = new Set(MOCKUP_CATALOG.map(e => e.path));
  const orphans = listHtml(MOCKUPS_DIR).filter(p => p !== GALLERY && !listed.has(p));
  assert.deepEqual(orphans, []);
});

test('catalog entries are complete and use a known status', () => {
  for (const entry of MOCKUP_CATALOG) {
    for (const field of ['group', 'title', 'path', 'description', 'date']) {
      assert.ok(typeof entry[field] === 'string' && entry[field].length > 0, `${entry.path}: ${field} is empty`);
    }
    assert.ok(STATUSES.has(entry.status), `${entry.path}: unknown status ${entry.status}`);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('catalog paths are unique', () => {
  const paths = MOCKUP_CATALOG.map(e => e.path);
  assert.equal(new Set(paths).size, paths.length);
});
