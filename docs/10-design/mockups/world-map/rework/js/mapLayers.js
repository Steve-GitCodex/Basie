(function (root) {
'use strict';

function provinceLoops(W, index) {
  const N = W.N, prov = W.cells.prov;
  const inP = (x, y) => x >= 0 && y >= 0 && x < N && y < N && prov[y * N + x] === index;
  const edges = new Map();
  const add = (a, b) => { const k = `${a[0]},${a[1]}`; if (!edges.has(k)) edges.set(k, []); edges.get(k).push(b); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!inP(x, y)) continue;
    if (!inP(x, y - 1)) add([x, y], [x + 1, y]);
    if (!inP(x + 1, y)) add([x + 1, y], [x + 1, y + 1]);
    if (!inP(x, y + 1)) add([x + 1, y + 1], [x, y + 1]);
    if (!inP(x - 1, y)) add([x, y + 1], [x, y]);
  }
  const loops = [];
  while (edges.size) {
    const [startKey] = edges.keys();
    let key = startKey;
    const loop = [];
    for (let guard = 0; guard < 20000; guard++) {
      const list = edges.get(key);
      if (!list) break;
      const nxt = list.pop();
      if (!list.length) edges.delete(key);
      const [x, y] = key.split(',').map(Number);
      loop.push([x, y]);
      key = `${nxt[0]},${nxt[1]}`;
      if (key === startKey) break;
    }
    if (loop.length > 3) loops.push(loop);
  }
  return loops.map(l => smoothClosed(dropCollinear(l), 2));
}

function dropCollinear(l) {
  const n = l.length, o = [];
  for (let i = 0; i < n; i++) {
    const a = l[(i - 1 + n) % n], b = l[i], c = l[(i + 1) % n];
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) o.push(b);
  }
  return o;
}
function smoothClosed(l, iters) {
  let p = l;
  for (let k = 0; k < iters; k++) {
    const o = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = o;
  }
  return p;
}

function buildShapes(W) {
  const shapes = {};
  for (const p of W.P) {
    const loops = provinceLoops(W, p.index);
    const path = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const l of loops) {
      l.forEach((g, i) => {
        const [wx, wy] = Iso.toWorld(g[0], g[1]);
        x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy);
        i ? path.lineTo(wx, wy) : path.moveTo(wx, wy);
      });
      path.closePath();
    }
    shapes[p.id] = { path, box: { x0, y0, x1, y1 }, loops };
  }
  return shapes;
}

function hatch(colorA, colorB, size) {
  const c = Sprites.canvas(size, size), x = c.getContext('2d');
  if (colorB) { x.fillStyle = colorB; x.fillRect(0, 0, size, size); }
  x.strokeStyle = colorA; x.lineWidth = size / 3.2;
  x.beginPath();
  for (let k = -size; k <= size * 2; k += size) { x.moveTo(k, size); x.lineTo(k + size, 0); }
  x.stroke();
  return c;
}

const PATTERNS = {};
function pattern(ctx, key, a, b, size) {
  if (!PATTERNS[key]) PATTERNS[key] = hatch(a, b, size);
  return ctx.createPattern(PATTERNS[key], 'repeat');
}

function drawProvinces(x, view, shapes, ms) {
  const { z, ox, oy } = view;
  x.save();
  x.setTransform(z, 0, 0, z, ox, oy);
  const lw = px => px / z;
  for (const p of view.W.P) {
    const s = shapes[p.id], owner = ms.owner[p.id] || 'neutral', fog = ms.fogged.has(p.id);
    const col = PoiArt.OWNER[owner];
    x.save();
    x.clip(s.path, 'evenodd');
    if (owner !== 'neutral' && !fog) {
      x.fillStyle = col; x.globalAlpha = ms.cutOff.has(p.id) ? 0.04 : 0.07; x.fill(s.path);
      x.globalAlpha = 0.2; x.strokeStyle = col; x.lineWidth = lw(16); x.stroke(s.path);
      x.globalAlpha = 1; x.lineWidth = lw(5);
      if (ms.cutOff.has(p.id)) x.setLineDash([lw(10), lw(7)]);
      x.stroke(s.path); x.setLineDash([]);
    } else if (owner !== 'neutral' && fog && ms.knownOwners) {
      x.globalAlpha = 0.5; x.strokeStyle = col; x.lineWidth = lw(4); x.setLineDash([lw(6), lw(6)]); x.stroke(s.path); x.setLineDash([]);
    } else {
      x.globalAlpha = fog ? 0.35 : 0.7; x.strokeStyle = 'rgba(10,6,3,0.9)'; x.lineWidth = lw(3); x.stroke(s.path);
      x.globalAlpha = fog ? 0.12 : 0.28; x.strokeStyle = '#f3e3c8'; x.lineWidth = lw(1.2); x.stroke(s.path);
    }
    if (ms.cutOff.has(p.id)) {
      x.globalAlpha = 0.5; x.setTransform(1, 0, 0, 1, 0, 0);
      x.fillStyle = pattern(x, 'cut', 'rgba(58,209,122,0.55)', null, 14);
      x.fillRect(0, 0, view.w, view.h);
      x.setTransform(z, 0, 0, z, ox, oy);
    }
    if (ms.contested.has(p.id)) {
      x.globalAlpha = 0.42; x.setTransform(1, 0, 0, 1, 0, 0);
      const [a, b] = ms.contestedBy[p.id];
      x.fillStyle = pattern(x, `con-${a}-${b}`, PoiArt.OWNER[a], PoiArt.OWNER[b] + '55', 18);
      x.fillRect(0, 0, view.w, view.h);
      x.setTransform(z, 0, 0, z, ox, oy);
    }
    x.restore();
  }
  x.restore();
}

function drawAttackable(x, view, shapes, ids, t) {
  const { z, ox, oy } = view;
  x.save();
  x.setTransform(z, 0, 0, z, ox, oy);
  for (const id of ids) {
    const s = shapes[id];
    x.save(); x.clip(s.path, 'evenodd');
    x.fillStyle = 'rgba(255,184,77,0.10)'; x.fill(s.path);
    x.strokeStyle = '#ffb84d'; x.lineWidth = 6 / z; x.setLineDash([14 / z, 9 / z]); x.lineDashOffset = -t * 0.03 / z;
    x.stroke(s.path);
    x.restore();
  }
  x.restore();
}

root.MapLayers = { buildShapes, drawProvinces, drawAttackable, pattern };
})(globalThis);
