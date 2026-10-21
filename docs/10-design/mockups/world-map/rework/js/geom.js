(function (root) {
'use strict';
const WG = root.WG = root.WG || {};
const N = 96;
const SEED = 0x5ba51e;
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = t => t * t * (3 - 2 * t);
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
function fbm(x, y, s) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < 4; o++) { v += vnoise(x * f, y * f, s + o * 31) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return v / norm;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);


function segCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
function distToSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function distToLine(p, pts) {
  let m = Infinity;
  for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, distToSeg(p, pts[i], pts[i + 1]));
  return m;
}


function chaikin(pts, iters) {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const o = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    o.push(p[p.length - 1]);
    p = o;
  }
  return p;
}
function simplify(pts, every) {
  const o = pts.filter((_, i) => i % every === 0);
  if (o[o.length - 1] !== pts[pts.length - 1]) o.push(pts[pts.length - 1]);
  return o;
}
const cellIdx = c => Math.floor(c[1]) * N + Math.floor(c[0]);
Object.assign(WG, { N, SEED, hash2, rngOf, vnoise, fbm, segCross, distToSeg, distToLine, chaikin, simplify, dist, cellIdx });
})(globalThis);
