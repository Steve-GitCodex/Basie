/**
 * SoundManager.js
 * Procedural audio using the Web Audio API.
 * No external files needed — all sounds are synthetically generated tones.
 * Respects the sfxEnabled setting from SettingsManager.
 */
import { eventBus } from '../core/EventBus.js';

export class SoundManager {
  constructor(settingsManager) {
    this.name = 'SoundManager';
    this._settings = settingsManager;
    this._ctx = null;
    this._initContext();
    this._registerEvents();
  }

  _initContext() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[SoundManager] Web Audio API not supported.');
    }
  }

  _isEnabled() {
    return this._ctx && this._settings.getSettings().sfxEnabled;
  }

  /**
   * Play a procedurally generated tone.
   * @param {number} frequency Hz
   * @param {number} duration seconds
   * @param {string} type OscillatorType: 'sine'|'square'|'sawtooth'|'triangle'
   * @param {number} volume 0–1
   * @param {number} [delay=0] seconds before playing
   */
  _playTone(frequency, duration, type = 'sine', volume = 0.2, delay = 0) {
    if (!this._isEnabled()) return;
    try {
      // Resume context on first user interaction
      if (this._ctx.state === 'suspended') this._ctx.resume();

      const osc   = this._ctx.createOscillator();
      const gain  = this._ctx.createGain();

      osc.connect(gain);
      gain.connect(this._ctx.destination);

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this._ctx.currentTime + delay);

      gain.gain.setValueAtTime(volume, this._ctx.currentTime + delay);
      // Fade out to avoid clicking
      gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + delay + duration);

      osc.start(this._ctx.currentTime + delay);
      osc.stop(this._ctx.currentTime + delay + duration + 0.05);
    } catch (e) { /* Silent fail */ }
  }

  // =============================================
  // SOUND PRESETS
  // =============================================

  /** Short UI click feedback */
  click() {
    this._playTone(880, 0.06, 'sine', 0.12);
  }

  /** Positive confirmation: build started, quest progress */
  confirm() {
    this._playTone(660, 0.08, 'triangle', 0.15);
    this._playTone(880, 0.1, 'triangle', 0.15, 0.08);
  }

  /** Building or research complete */
  complete() {
    this._playTone(523, 0.1, 'triangle', 0.18);
    this._playTone(659, 0.1, 'triangle', 0.18, 0.10);
    this._playTone(784, 0.15, 'triangle', 0.20, 0.20);
  }

  /** Victory fanfare */
  victory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => this._playTone(freq, 0.18, 'triangle', 0.22, i * 0.14));
  }

  /** Defeat stinger */
  defeat() {
    this._playTone(440, 0.15, 'sawtooth', 0.15);
    this._playTone(330, 0.2,  'sawtooth', 0.15, 0.15);
    this._playTone(220, 0.3,  'sawtooth', 0.12, 0.30);
  }

  /** Warning / cannot afford / error */
  error() {
    this._playTone(200, 0.08, 'square', 0.15);
    this._playTone(180, 0.1,  'square', 0.12, 0.10);
  }

  /** Reward / gold collect */
  coin() {
    this._playTone(1200, 0.05, 'sine', 0.15);
    this._playTone(1600, 0.07, 'sine', 0.18, 0.05);
  }

  /** Level up */
  levelUp() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => this._playTone(freq, 0.15, 'triangle', 0.20, i * 0.10));
  }

  /** Combat hit impact */
  hit() {
    this._playTone(180, 0.06, 'sawtooth', 0.18);
  }

  /** Achievement unlocked — ascending 5-note arpeggio, triangle wave */
  achievement() {
    const notes = [523, 659, 784, 1047, 1319]; // C5 E5 G5 C6 E6
    notes.forEach((freq, i) => this._playTone(freq, 0.12, 'triangle', 0.18, i * 0.10));
  }

  /** Combat wave start — low sine thud ~120 Hz */
  battle() {
    this._playTone(120, 0.15, 'sine', 0.20);
  }

  /** Heal pulse — ascending minor third, sine */
  heal() {
    this._playTone(440, 0.12, 'sine', 0.15);
    this._playTone(523, 0.14, 'sine', 0.15, 0.10);
  }

  /** Short two-tone reward chime — plays on item/resource grant. */
  playChime() {
    this._playTone(880,  0.08, 'sine', 0.18);
    this._playTone(1100, 0.12, 'sine', 0.18, 0.08);
  }

  // =============================================
  // EVENT WIRING
  // =============================================
  _registerEvents() {
    eventBus.on('building:completed',          () => this.complete());
    eventBus.on('building:started',            () => this.confirm());
    eventBus.on('unit:trained',                () => this.complete());
    eventBus.on('combat:victory',              () => this.victory());
    eventBus.on('combat:defeat',               () => this.defeat());
    eventBus.on('quest:completed',             () => { this.victory(); });
    eventBus.on('tech:researched',             () => this.complete());
    eventBus.on('user:levelUp',                () => this.levelUp());
    eventBus.on('resources:added',             () => this.coin());
    eventBus.on('ui:click',                    () => this.click());
    eventBus.on('ui:error',                    () => this.error());
    // New event wires
    eventBus.on('achievement:unlocked',        () => this.achievement());
    eventBus.on('hero:recruited',              () => this.confirm());
    eventBus.on('market:traded',               () => this.coin());
    eventBus.on('building:cafeteria:shortfall',({ severity } = {}) => severity === 'info' ? this.confirm() : this.error());
    eventBus.on('combat:wave:start',           () => this.battle());
  }

  update(dt) { /* No tick needed */ }
}
