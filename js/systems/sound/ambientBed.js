const NOISE_SECONDS = 2;
const BED_GAIN      = 0.12;
const FADE_IN       = 1.5;
const FADE_OUT      = 0.4;

export class AmbientBed {
  constructor(ctx, isAllowed) {
    this._ctx = ctx;
    this._allowed = isAllowed;
    this._noise = null;
    this._nodes = null;
    this._running = false;
  }

  start() {
    if (!this._ctx || this._running || !this._allowed()) return;
    const ctx = this._ctx;
    if (ctx.state === 'suspended') ctx.resume();

    const src = ctx.createBufferSource();
    src.buffer = this._noise || (this._noise = this._buildNoise());
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(BED_GAIN, ctx.currentTime, FADE_IN);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start();
    lfo.start();
    this._nodes = { src, gain, lfo };
    this._running = true;
  }

  stop() {
    if (!this._running) return;
    const ctx = this._ctx;
    const { src, gain, lfo } = this._nodes;
    try {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(0.0001, ctx.currentTime, FADE_OUT);
      src.stop(ctx.currentTime + FADE_OUT * 4);
      lfo.stop(ctx.currentTime + FADE_OUT * 4);
    } catch { /* already stopped */ }
    this._nodes = null;
    this._running = false;
  }

  _buildNoise() {
    const rate = this._ctx.sampleRate;
    const buf = this._ctx.createBuffer(1, NOISE_SECONDS * rate, rate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buf;
  }
}
