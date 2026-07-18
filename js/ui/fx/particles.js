/**
 * ui/fx/particles.js
 * One lightweight pooled particle field shared by both canvases (city + world).
 * Space-agnostic: positions/velocities are in whatever units the caller emits in
 * and drawn under whatever ctx transform is active — a renderer keeps a
 * screen-space field for ambient haze and a world-space field for anchored
 * effects (smoke, bursts, ripples). Pure motion/geometry; draw() is the only
 * canvas touch, so update() is unit-testable in Node.
 */
const TAU = Math.PI * 2;

export class ParticleField {
  constructor(max = 220) {
    this._max = max;
    this._live = [];
    this._acc = 0;
  }

  get count() { return this._live.length; }
  clear() { this._live.length = 0; }

  spawn(p) {
    if (this._live.length >= this._max) return;
    this._live.push({
      x: p.x, y: p.y,
      vx: p.vx ?? 0, vy: p.vy ?? 0,
      ax: p.ax ?? 0, ay: p.ay ?? 0,
      drag: p.drag ?? 0,
      age: 0, life: p.life ?? 1,
      size: p.size ?? 2, grow: p.grow ?? 0,
      width: p.width ?? 1.5,
      color: p.color ?? '#fff',
      shape: p.shape ?? 'dot',
      alpha: p.alpha ?? 1,
      fade: p.fade ?? 'out',
    });
  }

  update(dt) {
    const live = this._live;
    let w = 0;
    for (let i = 0; i < live.length; i++) {
      const pt = live[i];
      pt.age += dt;
      if (pt.age >= pt.life) continue;
      pt.vx += pt.ax * dt; pt.vy += pt.ay * dt;
      if (pt.drag) { const d = Math.max(0, 1 - pt.drag * dt); pt.vx *= d; pt.vy *= d; }
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.size = Math.max(0, pt.size + pt.grow * dt);
      if (w !== i) live[w] = pt;
      w++;
    }
    live.length = w;
  }

  draw(ctx) {
    for (const pt of this._live) {
      const t = pt.age / pt.life;
      const a = pt.alpha * this._envelope(pt.fade, t);
      if (a <= 0 || pt.size <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.strokeStyle = pt.color;
      if (pt.shape === 'ring') {
        ctx.lineWidth = pt.width;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
        ctx.stroke();
      } else if (pt.shape === 'spark') {
        const sp = Math.hypot(pt.vx, pt.vy) || 1;
        const k = pt.size / sp;
        ctx.lineWidth = pt.width;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x - pt.vx * k, pt.y - pt.vy * k);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  _envelope(fade, t) {
    const c = t < 0 ? 0 : t > 1 ? 1 : t;
    if (fade === 'none') return 1;
    if (fade === 'in') return c;
    if (fade === 'inout') return Math.sin(Math.PI * c);
    return 1 - c;
  }

  // ── Emitters ────────────────────────────────────────────────────────────────

  /** Trickle drifting motes across a screen rect (accumulator-paced ambient haze). */
  haze(dt, opts) {
    const { w, h } = opts;
    if (!w || !h) return;
    this._acc += dt * (opts.rate ?? 5);
    while (this._acc >= 1) {
      this._acc -= 1;
      if (this._live.length >= this._max) break;
      const ang = Math.random() * TAU;
      const spd = (opts.speed ?? 6) * (0.4 + Math.random());
      this.spawn({
        x: Math.random() * w, y: Math.random() * h,
        vx: Math.cos(ang) * spd + (opts.wind ?? 0),
        vy: Math.sin(ang) * spd * 0.5 - (opts.rise ?? 0),
        life: (opts.life ?? 6) * (0.6 + Math.random() * 0.8),
        size: (opts.size ?? 1.4) * (0.5 + Math.random()),
        color: opts.color ?? 'rgba(200,190,170,1)',
        alpha: opts.alpha ?? 0.5,
        fade: 'inout',
      });
    }
  }

  /** Radial spark burst (impact / battle resolution). */
  burst(x, y, opts = {}) {
    const n = opts.count ?? 14;
    const spd = opts.speed ?? 120;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + Math.random() * 0.5;
      const s = spd * (0.5 + Math.random());
      this.spawn({
        x, y,
        vx: Math.cos(ang) * s, vy: Math.sin(ang) * s,
        drag: opts.drag ?? 3.5,
        life: (opts.life ?? 0.6) * (0.7 + Math.random() * 0.6),
        size: opts.size ?? 7,
        width: 2,
        color: opts.color ?? '#ffb14e',
        shape: 'spark',
        fade: 'out',
      });
    }
  }

  /** Expanding ring (region capture / shockwave). */
  ripple(x, y, opts = {}) {
    this.spawn({
      x, y,
      life: opts.life ?? 1.1,
      size: opts.size ?? 6,
      grow: opts.grow ?? 180,
      width: opts.width ?? 4,
      color: opts.color ?? 'rgba(120,255,170,1)',
      shape: 'ring',
      fade: 'out',
    });
  }

  /** Single rising smoke/dust puff. */
  puff(x, y, opts = {}) {
    const jitter = opts.jitter ?? 3;
    this.spawn({
      x: x + (Math.random() - 0.5) * jitter,
      y: y + (Math.random() - 0.5) * jitter,
      vx: (opts.wind ?? 0) + (Math.random() - 0.5) * (opts.spread ?? 6),
      vy: -(opts.rise ?? 14) * (0.7 + Math.random() * 0.6),
      life: (opts.life ?? 2.2) * (0.7 + Math.random() * 0.6),
      size: (opts.size ?? 3) * (0.7 + Math.random() * 0.6),
      grow: opts.grow ?? 6,
      color: opts.color ?? 'rgba(120,120,120,1)',
      alpha: opts.alpha ?? 0.4,
      fade: 'inout',
    });
  }
}
