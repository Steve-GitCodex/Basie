import { eventBus } from './EventBus.js';

const SAVE_KEY = 'basie_game_state';
const AUTOSAVE_INTERVAL_MS = 30_000; // 30 seconds

export class SaveManager {
  constructor(storage = localStorage, saveKey = SAVE_KEY) {
    this.name = 'SaveManager';
    this._storage = storage;
    this._key = saveKey;
    this._autosaveTimer = null;
    this._isWiping = false;
  }

  load() {
    try {
      const raw = this._storage.getItem(this._key);
      if (!raw) return null;
      const state = JSON.parse(raw);
      console.log('[SaveManager] Game state loaded successfully.');
      return state;
    } catch (e) {
      console.error('[SaveManager] Failed to parse save:', e);
      return null;
    }
  }

  save(state) {
    if (this._isWiping) return;
    try {
      state.lastSavedTimestamp = Date.now();
      this._storage.setItem(this._key, JSON.stringify(state));
      eventBus.emit('game:saved', { timestamp: state.lastSavedTimestamp });
    } catch (e) {
      console.error('[SaveManager] Failed to save state:', e);
      const isQuotaError = e?.name === 'QuotaExceededError' || e?.code === 22 || e?.code === 1014;
      eventBus.emit('game:saveFailed', { reason: isQuotaError ? 'quota' : 'unknown', error: e });
    }
  }

  startAutosave(getStateFn) {
    this.stopAutosave();
    this._autosaveTimer = setInterval(() => {
      const state = getStateFn();
      this.save(state);
    }, AUTOSAVE_INTERVAL_MS);
    console.log(`[SaveManager] Autosave started (every ${AUTOSAVE_INTERVAL_MS / 1000}s).`);
  }

  stopAutosave() {
    if (this._autosaveTimer) clearInterval(this._autosaveTimer);
    this._autosaveTimer = null;
  }

  getLocalRawSave() {
    try {
      const raw = this._storage.getItem(this._key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  hasSave() {
    return !!this._storage.getItem(this._key);
  }

  wipe() {
    this._isWiping = true;
    this._storage.removeItem(this._key);
    eventBus.emit('game:wiped');
    console.log('[SaveManager] Save data wiped.');
    this._isWiping = false;
  }

  // Wipe-then-reload callers need this, or beforeunload re-saves live state over the wipe.
  suppressSaves() {
    this._isWiping = true;
  }
}
