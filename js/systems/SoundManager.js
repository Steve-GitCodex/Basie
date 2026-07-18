/**
 * SoundManager.js
 * Sample playback with a procedural-tone fallback. Each preset tries a sample
 * from SampleLibrary first; if its buffer isn't loaded yet it plays the original
 * Web Audio tone, so audio never regresses while samples stream in.
 * Respects sfxEnabled (all sound) and ambientEnabled (world-view bed).
 */
import { eventBus } from '../core/EventBus.js';
import { SampleLibrary } from './sound/sampleLibrary.js';
import { AmbientBed } from './sound/ambientBed.js';

export class SoundManager {
  constructor(settingsManager) {
    this.name = 'SoundManager';
    this._settings = settingsManager;
    this._ctx = null;
    this._view = null;
    this._lastClick = 0;
    this._initContext();
    this._samples = new SampleLibrary(this._ctx);
    this._ambient = new AmbientBed(this._ctx, () => this._ambientAllowed());
    this._samples.warm(['click', 'switch']);
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

  _ambientAllowed() {
    const s = this._settings.getSettings();
    return this._ctx && s.sfxEnabled && s.ambientEnabled;
  }

  _sample(key) {
    return this._isEnabled() && this._samples.tryPlay(key);
  }

  _playTone(frequency, duration, type = 'sine', volume = 0.2, delay = 0) {
    if (!this._isEnabled()) return;
    try {
      if (this._ctx.state === 'suspended') this._ctx.resume();

      const osc  = this._ctx.createOscillator();
      const gain = this._ctx.createGain();

      osc.connect(gain);
      gain.connect(this._ctx.destination);

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this._ctx.currentTime + delay);

      gain.gain.setValueAtTime(volume, this._ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + delay + duration);

      osc.start(this._ctx.currentTime + delay);
      osc.stop(this._ctx.currentTime + delay + duration + 0.05);
    } catch (e) { /* Silent fail */ }
  }

  // =============================================
  // SOUND PRESETS (sample-first, tone fallback)
  // =============================================

  click() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this._lastClick < 60) return;
    this._lastClick = now;
    if (this._sample('click')) return;
    this._playTone(880, 0.06, 'sine', 0.12);
  }

  confirm() {
    if (this._sample('switch')) return;
    this._playTone(660, 0.08, 'triangle', 0.15);
    this._playTone(880, 0.1, 'triangle', 0.15, 0.08);
  }

  complete() {
    if (this._sample('complete')) return;
    this._playTone(523, 0.1, 'triangle', 0.18);
    this._playTone(659, 0.1, 'triangle', 0.18, 0.10);
    this._playTone(784, 0.15, 'triangle', 0.20, 0.20);
  }

  victory() {
    if (this._sample('victory')) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => this._playTone(freq, 0.18, 'triangle', 0.22, i * 0.14));
  }

  defeat() {
    if (this._sample('defeat')) return;
    this._playTone(440, 0.15, 'sawtooth', 0.15);
    this._playTone(330, 0.2,  'sawtooth', 0.15, 0.15);
    this._playTone(220, 0.3,  'sawtooth', 0.12, 0.30);
  }

  error() {
    this._playTone(200, 0.08, 'square', 0.15);
    this._playTone(180, 0.1,  'square', 0.12, 0.10);
  }

  coin() {
    if (this._sample('coin')) return;
    this._playTone(1200, 0.05, 'sine', 0.15);
    this._playTone(1600, 0.07, 'sine', 0.18, 0.05);
  }

  levelUp() {
    if (this._sample('levelUp')) return;
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => this._playTone(freq, 0.15, 'triangle', 0.20, i * 0.10));
  }

  hit() {
    if (this._sample('impact')) return;
    this._playTone(180, 0.06, 'sawtooth', 0.18);
  }

  achievement() {
    if (this._sample('achievement')) return;
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => this._playTone(freq, 0.12, 'triangle', 0.18, i * 0.10));
  }

  battle() {
    if (this._sample('battle')) return;
    this._playTone(120, 0.15, 'sine', 0.20);
  }

  heal() {
    this._playTone(440, 0.12, 'sine', 0.15);
    this._playTone(523, 0.14, 'sine', 0.15, 0.10);
  }

  playChime() {
    if (this._sample('coin')) return;
    this._playTone(880,  0.08, 'sine', 0.18);
    this._playTone(1100, 0.12, 'sine', 0.18, 0.08);
  }

  /** Research complete — bright "tech online" chime, distinct from construction. */
  research() {
    this._playTone(784, 0.09, 'triangle', 0.16);
    this._playTone(1047, 0.11, 'triangle', 0.16, 0.09);
    this._playTone(1319, 0.14, 'sine', 0.14, 0.19);
  }

  /** March dispatch bark — voice only, no tone fallback (silence is fine). */
  dispatch() {
    this._sample('dispatch');
  }

  /** March returned successfully. */
  missionComplete() {
    if (this._sample('missionComplete')) return;
    this.victory();
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
    eventBus.on('combat:started',              () => this.battle());
    eventBus.on('combat:marchResolved',        () => this.hit());
    eventBus.on('quest:completed',             () => this.missionComplete());
    eventBus.on('tech:researched',             () => this.research());
    eventBus.on('user:levelUp',                () => this.levelUp());
    eventBus.on('resources:added',             () => this.coin());
    eventBus.on('ui:click',                    () => this.click());
    eventBus.on('ui:error',                    () => this.error());
    eventBus.on('achievement:unlocked',        () => this.achievement());
    eventBus.on('hero:recruited',              () => this.confirm());
    eventBus.on('market:traded',               () => this.coin());
    eventBus.on('building:cafeteria:shortfall',({ severity } = {}) => severity === 'info' ? this.confirm() : this.error());
    eventBus.on('combat:wave:start',           () => this.battle());
    eventBus.on('march:dispatched',            () => this.dispatch());
    eventBus.on('march:completed',             () => this.missionComplete());
    eventBus.on('ui:viewChanged',              (v) => this._onViewChanged(v));
    eventBus.on('settings:changed',            () => this._syncAmbient());
  }

  _onViewChanged(view) {
    this._view = view;
    this._syncAmbient();
  }

  _syncAmbient() {
    if (this._view === 'world' && this._ambientAllowed()) this._ambient.start();
    else this._ambient.stop();
  }

  update(dt) { /* No tick needed */ }
}
