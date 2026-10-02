import fs from 'node:fs';
import path from 'node:path';

const WATCHED_DIRS = ['js', 'css', 'assets'];
const WATCHED_FILES = ['index.html'];
const TEMP_FILE = /(~|\.swp|\.tmp)$|(^|\/)#[^/]*#$/;

export class ChangeBatcher {
  constructor({ quietMs = 150, onBatch, setTimer = setTimeout, clearTimer = clearTimeout }) {
    this._quietMs = quietMs;
    this._onBatch = onBatch;
    this._setTimer = setTimer;
    this._clearTimer = clearTimer;
    this._files = new Set();
    this._timer = null;
  }

  add(relPath) {
    const file = relPath.replace(/\\/g, '/');
    if (TEMP_FILE.test(file)) return;
    this._files.add(file);
    if (this._timer !== null) this._clearTimer(this._timer);
    this._timer = this._setTimer(() => this._fire(), this._quietMs);
  }

  _fire() {
    this._timer = null;
    const files = [...this._files].sort();
    this._files.clear();
    if (!files.length) return;
    const kind = files.every(f => f.endsWith('.css')) ? 'css' : 'full';
    this._onBatch({ kind, files });
  }
}

export function startWatcher({ root, onBatch, warn }) {
  const batcher = new ChangeBatcher({ onBatch });
  const watchers = [];
  const watch = (target, rel, opts) => {
    try {
      watchers.push(fs.watch(path.join(root, target), opts, (_evt, name) => {
        if (name) batcher.add(rel(String(name)));
      }));
    } catch (e) {
      warn(`not watching ${target}: ${e.code ?? e.message}`);
    }
  };
  for (const dir of WATCHED_DIRS) watch(dir, name => `${dir}/${name}`, { recursive: true });
  for (const file of WATCHED_FILES) watch(file, () => file, {});
  return { close: () => watchers.forEach(w => w.close()) };
}
