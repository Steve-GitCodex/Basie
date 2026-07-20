/**
 * SettingsManager.js
 * Manages player preferences: sound, animations, data wipe, etc.
 * Reads/writes from localStorage independently of the main save.
 */
import { eventBus } from '../core/EventBus.js';

const SETTINGS_KEY = 'basie_settings';

const DEFAULT_SETTINGS = {
  sfxEnabled: true,
  ambientEnabled: true,
  animationsEnabled: true,
  autoSave: true,
  theme: 'dark', // Currently only dark supported
  difficulty: 'normal', // 'easy' | 'normal' | 'hard'
};

export class SettingsManager {
  constructor(saveManager) {
    this.name = 'SettingsManager';
    this._sm = saveManager;
    this._settings = { ...DEFAULT_SETTINGS };
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) Object.assign(this._settings, JSON.parse(raw));
    } catch { /* Use defaults */ }
  }

  _persist() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this._settings));
    eventBus.emit('settings:changed', this._settings);
  }

  getSettings() { return { ...this._settings }; }

  /** Get a single setting by key. */
  get(key) { return this._settings[key]; }

  set(key, value) {
    if (key in this._settings) {
      this._settings[key] = value;
      this._persist();
    }
  }

  toggle(key) {
    if (typeof this._settings[key] === 'boolean') {
      this._settings[key] = !this._settings[key];
      this._persist();
    }
  }

  /**
   * Wipe all save data and reload the page.
   */
  wipeAllData() {
    this._sm.wipe();
    this._sm.suppressSaves();
    localStorage.removeItem(SETTINGS_KEY);
    window.location.reload();
  }

  update(dt) { /* No tick needed */ }
}
