import { escapeHtml } from '../../uiUtils.js';

const FRAME_MS = 700;
const END_ZONE = 70;

function markersHtml(waves, moments, pos) {
  const waveMarks = waves.map(wave => `
    <button type="button" class="timeline__wave-marker${pos(wave.firstFrame) > END_ZONE ? ' timeline__wave-marker--end' : ''}" style="left:${pos(wave.firstFrame)}%" data-frame="${wave.firstFrame}">
      WAVE ${wave.index + 1}${wave.isBoss ? ' · BOSS' : ''}
    </button>`);
  const byFrame = new Map();
  for (const moment of moments) {
    if (!byFrame.has(moment.frameIndex)) byFrame.set(moment.frameIndex, []);
    byFrame.get(moment.frameIndex).push(moment);
  }
  const momentMarks = [...byFrame].map(([frame, list]) => `
    <button type="button" class="timeline__moment" style="left:${pos(frame)}%" data-frame="${frame}"
      title="${escapeHtml(list.map(m => m.text).join(' · '))}">${escapeHtml(list[0].icon)}</button>`);
  return [...waveMarks, ...momentMarks].join('');
}

export class Timeline {
  constructor(el, { frames, waves, moments = [], onSeek, onEnd = () => {}, onSkip = () => {} }) {
    this._frames = frames;
    this._last = frames.length - 1;
    this._onSeek = onSeek;
    this._onEnd = onEnd;
    this._index = 0;
    this._speed = 1;
    this._timer = null;
    this._abort = new AbortController();
    this._dom = {
      play: el.querySelector('#btn-battle-play'),
      back: el.querySelector('#btn-battle-step-back'),
      fwd: el.querySelector('#btn-battle-step-fwd'),
      speed: el.querySelector('#btn-battle-speed'),
      skip: el.querySelector('#btn-battle-skip'),
      track: el.querySelector('.timeline__track'),
      done: el.querySelector('.timeline__done'),
      knob: el.querySelector('.timeline__knob'),
      marks: el.querySelector('.timeline__marks'),
      count: el.querySelector('.timeline__count'),
    };
    this._dom.marks.innerHTML = markersHtml(waves, moments, i => this._pos(i));
    this._bind(onSkip);
    this.setSpeed(1);
    this._setPlaying(false);
    this.seek(0);
  }

  get index() {
    return this._index;
  }

  get playing() {
    return this._timer !== null;
  }

  play() {
    if (this.playing) return;
    if (this._index >= this._last) this.seek(0);
    this._setPlaying(true);
    this._schedule();
  }

  pause() {
    clearTimeout(this._timer);
    this._timer = null;
    this._setPlaying(false);
  }

  seek(i) {
    this._index = Math.max(0, Math.min(this._last, i));
    const pct = `${this._pos(this._index)}%`;
    this._dom.done.style.width = pct;
    this._dom.knob.style.left = pct;
    this._dom.count.textContent = `${this._index} / ${this._last}`;
    this._onSeek(this._index, this._frames[this._index]);
  }

  step(delta) {
    this.pause();
    this.seek(this._index + delta);
  }

  setSpeed(speed) {
    this._speed = speed;
    this._dom.speed.textContent = `${speed}×`;
    this._dom.speed.setAttribute('aria-pressed', String(speed === 2));
  }

  destroy() {
    this.pause();
    this._abort.abort();
    this._dom.marks.replaceChildren();
  }

  _pos(i) {
    return this._last > 0 ? (i / this._last) * 100 : 0;
  }

  _schedule() {
    this._timer = setTimeout(() => {
      if (this._index >= this._last) {
        this.pause();
        this._onEnd();
        return;
      }
      this.seek(this._index + 1);
      this._schedule();
    }, FRAME_MS / this._speed);
  }

  _setPlaying(on) {
    this._dom.play.textContent = on ? '⏸' : '▶';
    this._dom.play.setAttribute('aria-label', on ? 'Pause' : 'Play');
  }

  _bind(onSkip) {
    const opts = { signal: this._abort.signal };
    const { play, back, fwd, speed, skip, track, marks } = this._dom;
    play.addEventListener('click', () => (this.playing ? this.pause() : this.play()), opts);
    back.addEventListener('click', () => this.step(-1), opts);
    fwd.addEventListener('click', () => this.step(1), opts);
    speed.addEventListener('click', () => this.setSpeed(this._speed === 1 ? 2 : 1), opts);
    skip.addEventListener('click', () => onSkip(), opts);
    marks.addEventListener('click', e => {
      const mark = e.target.closest('[data-frame]');
      if (!mark) return;
      e.stopPropagation();
      this.pause();
      this.seek(Number(mark.dataset.frame));
    }, opts);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); }, opts);
    this._bindScrub(track, opts);
  }

  _bindScrub(track, opts) {
    const frameAt = (x) => {
      const rect = track.getBoundingClientRect();
      const ratio = rect.width > 0 ? (x - rect.left) / rect.width : 0;
      return Math.round(Math.max(0, Math.min(1, ratio)) * this._last);
    };
    const scrubTo = (x) => {
      const i = frameAt(x);
      if (i !== this._index) this.seek(i);
    };
    track.addEventListener('pointerdown', e => {
      if (e.target.closest('[data-frame]')) return;
      this.pause();
      track.setPointerCapture(e.pointerId);
      scrubTo(e.clientX);
    }, opts);
    track.addEventListener('pointermove', e => {
      if (track.hasPointerCapture(e.pointerId)) scrubTo(e.clientX);
    }, opts);
  }
}
