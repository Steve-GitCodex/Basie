(function (root) {
'use strict';

const CW = 64, CH = 48;
const CHUNK_PX = 512;
const LODS = [0.25, 0.5, 1];
const SKIRT = 70;

const toWorld = (gx, gy) => [(gx - gy) * CW / 2, (gx + gy) * CH / 2];
const toGrid = (wx, wy) => [(wx / (CW / 2) + wy / (CH / 2)) / 2, (wy / (CH / 2) - wx / (CW / 2)) / 2];

class Terrain {
  constructor(W) {
    this.W = W;
    const N = W.N;
    this.bounds = { x0: -N * CW / 2, x1: N * CW / 2, y0: -60, y1: N * CH + SKIRT + 10 };
    this.base = new Map();
    this.sketch = new Map();
    this.final = new Map();
    this.fogAlpha = new Float32Array(N * N);
    this.fogKey = '';
  }

  setFog(fogged) {
    const key = [...fogged].sort().join(',');
    if (key === this.fogKey) return;
    this.fogKey = key;
    this.final.clear();
    const { W } = this, N = W.N, prov = W.cells.prov;
    const isFog = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) isFog[i] = fogged.has(W.P[prov[i]].id) ? 1 : 0;
    this.fogAlpha = Float32Array.from(isFog);
  }

  chunkRange(lod, view) {
    const span = CHUNK_PX / lod, b = this.bounds;
    const cx0 = Math.floor((Math.max(view.x0, b.x0) - b.x0) / span), cx1 = Math.floor((Math.min(view.x1, b.x1) - b.x0) / span);
    const cy0 = Math.floor((Math.max(view.y0, b.y0) - b.y0) / span), cy1 = Math.floor((Math.min(view.y1, b.y1) - b.y0) / span);
    return { cx0, cx1, cy0, cy1, span };
  }

  get(lod, cx, cy, allowBake) {
    const k = `${lod}|${cx}|${cy}`;
    if (this.final.has(k)) return this.final.get(k);
    if (!allowBake) return null;
    const base = this._base(lod, cx, cy, k);
    const c = this._compose(lod, cx, cy, base, k);
    this.final.set(k, c);
    return c;
  }

  _rect(lod, cx, cy) {
    const span = CHUNK_PX / lod, b = this.bounds;
    return { x0: b.x0 + cx * span, y0: b.y0 + cy * span, span };
  }

  _base(lod, cx, cy, k) {
    if (this.base.has(k)) return this.base.get(k);
    const c = Sprites.canvas(CHUNK_PX, CHUNK_PX), x = c.getContext('2d');
    const r = this._rect(lod, cx, cy);
    x.setTransform(lod, 0, 0, lod, -r.x0 * lod, -r.y0 * lod);
    this._paint(x, r, lod);
    this.base.set(k, c);
    const s = Sprites.canvas(CHUNK_PX, CHUNK_PX), sx = s.getContext('2d');
    sx.filter = 'grayscale(1) sepia(0.55) brightness(0.36) contrast(1.15)';
    sx.drawImage(c, 0, 0);
    sx.filter = 'none';
    sx.globalCompositeOperation = 'source-atop';
    sx.strokeStyle = 'rgba(205,180,140,0.10)';
    sx.lineWidth = 1;
    const step = Math.max(4, 7 * Math.sqrt(lod));
    sx.beginPath();
    for (let i = -CHUNK_PX; i < CHUNK_PX * 2; i += step) { sx.moveTo(i, 0); sx.lineTo(i + CHUNK_PX * 0.6, CHUNK_PX); }
    sx.stroke();
    sx.fillStyle = 'rgba(30,22,14,0.18)';
    sx.fillRect(0, 0, CHUNK_PX, CHUNK_PX);
    this.sketch.set(k, s);
    return c;
  }

  _compose(lod, cx, cy, base, k) {
    const c = Sprites.canvas(CHUNK_PX, CHUNK_PX), x = c.getContext('2d');
    x.drawImage(base, 0, 0);
    if (!this.fogKey) return c;
    const r = this._rect(lod, cx, cy), N = this.W.N;
    const PAD = 32, M = CHUNK_PX + PAD * 2;
    const m = Sprites.canvas(M, M), mx = m.getContext('2d');
    mx.setTransform(lod, 0, 0, lod, -r.x0 * lod + PAD, -r.y0 * lod + PAD);
    mx.fillStyle = '#000';
    mx.beginPath();
    let any = false;
    const pad = PAD / lod;
    for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
      if (!this.fogAlpha[gy * N + gx]) continue;
      const [wx, wy] = toWorld(gx + 0.5, gy + 0.5);
      if (wx + CW < r.x0 - pad || wx - CW > r.x0 + r.span + pad || wy + CH + SKIRT < r.y0 - pad || wy - CH > r.y0 + r.span + pad) continue;
      any = true;
      mx.moveTo(wx, wy - CH / 2 - 1); mx.lineTo(wx + CW / 2 + 1, wy); mx.lineTo(wx, wy + CH / 2 + 1); mx.lineTo(wx - CW / 2 - 1, wy);
      if (gx === N - 1 || gy === N - 1) { mx.moveTo(wx - CW / 2, wy); mx.lineTo(wx + CW / 2, wy); mx.lineTo(wx + CW / 2, wy + SKIRT + CH); mx.lineTo(wx - CW / 2, wy + SKIRT + CH); }
    }
    if (!any) return c;
    mx.fill();
    const t = Sprites.canvas(CHUNK_PX, CHUNK_PX), tx = t.getContext('2d');
    tx.filter = `blur(${Math.max(1.5, 9 * lod)}px)`;
    tx.drawImage(m, -PAD, -PAD);
    tx.filter = 'none';
    tx.globalCompositeOperation = 'source-in';
    tx.drawImage(this.sketch.get(k), 0, 0);
    x.drawImage(t, 0, 0);
    return c;
  }

  _paint(x, r, lod) {
    const { W } = this, N = W.N, cells = W.cells;
    const inRect = (wx, wy, pad) => wx + pad >= r.x0 && wx - pad <= r.x0 + r.span && wy + pad >= r.y0 && wy - pad <= r.y0 + r.span;
    this._skirt(x, r);
    for (let s = 0; s <= 2 * (N - 1); s++) {
      for (let gx = Math.max(0, s - N + 1); gx <= Math.min(N - 1, s); gx++) {
        const gy = s - gx, i = gy * N + gx;
        const [wx, wy] = toWorld(gx + 0.5, gy + 0.5);
        if (!inRect(wx, wy, CW)) continue;
        const biome = WG.BIOME_IDS[cells.biome[i]];
        const im = Sprites.tile(biome, Math.floor(WG.hash2(gx, gy, 7) * 3));
        if (im) x.drawImage(im, wx - CW / 2 - 1, wy - CH / 2 - 1, CW + 2, CH + 2);
        const n = WG.fbm(gx * 0.11, gy * 0.11, 17) - 0.5;
        if (Math.abs(n) > 0.04) {
          x.fillStyle = n > 0 ? `rgba(255,236,200,${Math.min(0.12, n * 0.4)})` : `rgba(10,6,2,${Math.min(0.28, -n * 0.8)})`;
          x.beginPath(); x.moveTo(wx, wy - CH / 2 - 1); x.lineTo(wx + CW / 2 + 1, wy); x.lineTo(wx, wy + CH / 2 + 1); x.lineTo(wx - CW / 2 - 1, wy); x.fill();
        }
      }
    }
    this._edgeShade(x, r);
    for (const l of W.L) if (l.kind === 'river') this._river(x, l);
    for (const l of W.L) if (l.kind === 'ridge') this._ridge(x, l);
    for (const c of W.C) this._road(x, c);
    for (const c of W.C) if (c.bridgePt) this._bridge(x, c);
    const props = W.props.filter(p => { const [wx, wy] = toWorld(p.at[0], p.at[1]); return inRect(wx, wy - 40, 140); })
      .sort((a, b) => (a.at[0] + a.at[1]) - (b.at[0] + b.at[1]));
    for (const p of props) {
      const biome = WG.BIOME_IDS[cells.biome[Math.floor(p.at[1]) * N + Math.floor(p.at[0])]];
      const im = Sprites.prop(p.img, biome);
      if (!im) continue;
      const [wx, wy] = toWorld(p.at[0], p.at[1]);
      const w = im.width * p.s, h = im.height * p.s;
      x.drawImage(im, wx - w / 2, wy - h + CH * 0.18, w, h);
    }
  }

  _skirt(x) {
    const N = this.W.N;
    const L = toWorld(0, N), B = toWorld(N, N), R = toWorld(N, 0);
    const g = x.createLinearGradient(0, B[1] - 400, 0, B[1] + SKIRT);
    g.addColorStop(0, '#3a2c20'); g.addColorStop(1, '#16100b');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(L[0], L[1]); x.lineTo(B[0], B[1]); x.lineTo(R[0], R[1]);
    x.lineTo(R[0], R[1] + SKIRT); x.lineTo(B[0], B[1] + SKIRT); x.lineTo(L[0], L[1] + SKIRT); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2;
    for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(L[0], L[1] + k * 17); x.lineTo(B[0], B[1] + k * 17); x.lineTo(R[0], R[1] + k * 17); x.stroke(); }
  }

  _edgeShade(x) {
    const N = this.W.N;
    const corners = [toWorld(0, 0), toWorld(N, 0), toWorld(N, N), toWorld(0, N)];
    x.save();
    x.beginPath(); corners.forEach((c, i) => i ? x.lineTo(c[0], c[1]) : x.moveTo(c[0], c[1])); x.closePath();
    x.clip();
    x.strokeStyle = 'rgba(12,8,4,0.45)';
    for (const [w, a] of [[140, 0.22], [70, 0.3], [24, 0.35]]) {
      x.lineWidth = w; x.globalAlpha = a / 0.45;
      x.beginPath(); corners.forEach((c, i) => i ? x.lineTo(c[0], c[1]) : x.moveTo(c[0], c[1])); x.closePath(); x.stroke();
    }
    x.restore();
  }

  _poly(x, pts) { pts.forEach((p, i) => { const [wx, wy] = toWorld(p[0], p[1]); i ? x.lineTo(wx, wy) : x.moveTo(wx, wy); }); }

  _river(x, l) {
    const icy = l.look === 'frost';
    const wide = l.barrier ? 1 : 0.62;
    const layers = icy
      ? [['rgba(40,52,60,0.9)', 74], ['#7f97a3', 58], ['#a9bfca', 40], ['rgba(230,240,245,0.5)', 6]]
      : [['rgba(28,22,14,0.85)', 76], ['#203038', 60], ['#28414a', 44], ['rgba(120,160,170,0.35)', 5]];
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const [col, w] of layers) {
      x.strokeStyle = col; x.lineWidth = w * wide;
      x.beginPath(); this._poly(x, l.pts); x.stroke();
      if (l.pond) {
        const [px, py] = toWorld(l.pond.at[0], l.pond.at[1]);
        x.fillStyle = col;
        x.beginPath(); x.ellipse(px, py, l.pond.r * CW * 0.62 + (w - 40) * 0.5 * wide, l.pond.r * CH * 0.62 + (w - 40) * 0.38 * wide, 0, 0, Math.PI * 2); x.fill();
      }
    }
  }

  _ridge(x, l) {
    const segs = [];
    for (let k = 0; k < l.pts.length - 1; k++) if (!(l.pts[k] === l.gap[0] && l.pts[k + 1] === l.gap[1])) segs.push([l.pts[k], l.pts[k + 1]]);
    const runs = [];
    for (const s of segs) { const last = runs[runs.length - 1]; if (last && last[last.length - 1] === s[0]) last.push(s[1]); else runs.push([s[0], s[1]]); }
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const run of runs) {
      const pts = WG.chaikin(run, 2);
      const rough = pts.map((p, i) => [p[0] + (WG.hash2(i, 3, run.length) - 0.5) * 0.35, p[1] + (WG.hash2(i, 4, run.length) - 0.5) * 0.35]);
      x.save(); x.translate(4, 14);
      x.strokeStyle = 'rgba(6,4,2,0.5)'; x.lineWidth = 66; x.beginPath(); this._poly(x, rough); x.stroke();
      x.restore();
      x.strokeStyle = '#3e342b'; x.lineWidth = 54; x.beginPath(); this._poly(x, rough); x.stroke();
      x.save(); x.translate(0, -6);
      x.strokeStyle = '#5d5044'; x.lineWidth = 38; x.beginPath(); this._poly(x, rough); x.stroke();
      x.translate(0, -5);
      x.strokeStyle = '#6f6253'; x.lineWidth = 20; x.setLineDash([18, 9, 7, 12]); x.beginPath(); this._poly(x, rough); x.stroke(); x.setLineDash([]);
      x.restore();
    }
  }

  _road(x, c) {
    x.lineCap = 'round'; x.lineJoin = 'round';
    const metro = c.kind === 'gate';
    for (const [col, w, dash] of [['rgba(18,12,6,0.5)', metro ? 30 : 24, null], [metro ? '#4b4a48' : '#6a5640', metro ? 22 : 16, null], ['rgba(222,200,160,0.20)', 2, [10, 12]]]) {
      x.strokeStyle = col; x.lineWidth = w; x.setLineDash(dash || []);
      x.beginPath(); this._poly(x, c.path); x.stroke();
    }
    x.setLineDash([]);
  }

  _bridge(x, c) {
    const i = c.path.indexOf(c.bridgePt);
    const a = c.path[Math.max(0, i - 3)], b = c.path[Math.min(c.path.length - 1, i + 3)];
    const [ax, ay] = toWorld(a[0], a[1]), [bx, by] = toWorld(b[0], b[1]);
    const [mx, my] = toWorld(c.bridgePt[0], c.bridgePt[1]);
    const ang = Math.atan2(by - ay, bx - ax);
    x.save(); x.translate(mx, my); x.rotate(ang);
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(-46, -11, 92, 26);
    x.fillStyle = '#7a5a38'; x.fillRect(-44, -12, 88, 22);
    x.strokeStyle = '#4a3420'; x.lineWidth = 2;
    for (let k = -40; k <= 40; k += 8) { x.beginPath(); x.moveTo(k, -12); x.lineTo(k, 10); x.stroke(); }
    x.fillStyle = '#3a2816'; x.fillRect(-44, -14, 88, 3); x.fillRect(-44, 9, 88, 3);
    x.restore();
  }
}

root.Iso = { CW, CH, LODS, CHUNK_PX, toWorld, toGrid };
root.Terrain = Terrain;
})(globalThis);
