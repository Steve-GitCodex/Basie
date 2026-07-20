/**
 * SaveManager.js
 * Handles reading/writing game state to localStorage (offline-first).
 * Designed to be extensible — swap the storage backend to Firestore
 * by replacing the read/write methods here.
 */
import { eventBus } from './EventBus.js';

const SAVE_KEY = 'basie_game_state';
const AUTOSAVE_INTERVAL_MS = 30_000; // 30 seconds

export class SaveManager {
  constructor(storage = localStorage) {
    this.name = 'SaveManager';
    this._storage = storage;
    this._autosaveTimer = null;
    this._isWiping = false;
  }

  /**
   * Load raw game state from localStorage.
   * @returns {object|null}
   */
  load() {
    try {
      const raw = this._storage.getItem(SAVE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      console.log('[SaveManager] Game state loaded successfully.');
      return state;
    } catch (e) {
      console.error('[SaveManager] Failed to parse save:', e);
      return null;
    }
  }

  /**
   * Save the provided game state object to localStorage.
   * @param {object} state
   */
  save(state) {
    if (this._isWiping) return;
    try {
      state.lastSavedTimestamp = Date.now();
      this._storage.setItem(SAVE_KEY, JSON.stringify(state));
      eventBus.emit('game:saved', { timestamp: state.lastSavedTimestamp });
    } catch (e) {
      console.error('[SaveManager] Failed to save state:', e);
      const isQuotaError = e?.name === 'QuotaExceededError' || e?.code === 22 || e?.code === 1014;
      eventBus.emit('game:saveFailed', { reason: isQuotaError ? 'quota' : 'unknown', error: e });
    }
  }

  /**
   * Start auto-saving by calling the provided getter function every interval.
   * @param {Function} getStateFn - Returns the current game state object.
   */
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

  /**
   * Return the parsed save object directly from localStorage without triggering
   * the full load pipeline. Returns null if no save exists or parsing fails.
   * @returns {object|null}
   */
  getLocalRawSave() {
    try {
      const raw = this._storage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Returns true if a save game exists in localStorage.
   * @returns {boolean}
   */
  hasSave() {
    return !!this._storage.getItem(SAVE_KEY);
  }

  wipe() {
    this._isWiping = true;
    this._storage.removeItem(SAVE_KEY);
    eventBus.emit('game:wiped');
    console.log('[SaveManager] Save data wiped.');
    this._isWiping = false;
  }

  /**
   * Permanently blocks save() for the remaining lifetime of this page. Callers
   * that wipe and then reload must use this, or the beforeunload handler
   * re-saves live in-memory state over the wipe.
   */
  suppressSaves() {
    this._isWiping = true;
  }
}
