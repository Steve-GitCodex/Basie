(function (root) {
'use strict';
const WG = root.WG;
const { N, hash2, fbm, dist, segCross, distToSeg, distToLine, chaikin, simplify } = WG;
const CENTER = [48, 48];

const TIERS = {
  0: { kind: 'seat', label: 'Seat', footprint: 2.2, ring: 6, levelBase: 1, walls: 1.6 },
  1: { kind: 'market', label: 'Swap Market', footprint: 1.2, ring: 6, levelBase: 1, walls: 1 },
  2: { kind: 'township', label: 'Township', footprint: 1.8, ring: 6, levelBase: 3, walls: 1 },
  3: { kind: 'stockade', label: 'Stockade Town', footprint: 2.4, ring: 6, levelBase: 5, walls: 1.3 },
  4: { kind: 'ruin', label: 'Ruin City', footprint: 2.8, ring: 6, levelBase: 7, walls: 1.5 },
  5: { kind: 'metro', label: 'Metropolis', footprint: 3.6, ring: 7, levelBase: 9, walls: 1.8 },
};

const QUARTERS = [
  { id: 'home', faction: 'you', corner: [96, 96], dA: [-1, 0], dB: [0, -1],
    names: { seat: 'Home Refuge', A: 'Ashwood', B: 'Rustwater', T: 'Red Lowlands', S: 'Gallows Reach' },
    biomes: { seat: 'cracked', A: 'ash', B: 'mud', T: 'deadgrass', S: 'scorch' },
    jitter: { A: [1, 0], B: [0, 1], T: [0, 0], S: [1, -1] },
    seatPass: 'Ashen Pass', edge: { kind: 'ridge', name: 'Cinder Pass' }, ruin: 'Saltmouth' },
  { id: 'red', faction: 'red', corner: [96, 0], dA: [0, 1], dB: [-1, 0],
    names: { seat: 'Frost Hold', A: 'Ember Reach', B: 'Coldbrook', T: 'Talon Crossing', S: 'Iceteeth' },
    biomes: { seat: 'frost', A: 'scorch', B: 'mud', T: 'ash', S: 'frost' },
    jitter: { A: [-1, 1], B: [1, -1], T: [2, 0], S: [-1, 1] },
    seatPass: 'Rime Pass', edge: { kind: 'ridge', name: 'Gravel Pass' }, ruin: 'Old Transit' },
  { id: 'cov', faction: 'cov', corner: [0, 0], dA: [1, 0], dB: [0, 1],
    names: { seat: 'Behemoth Spire', A: 'Vulture Ridge', B: 'Slag Hollow', T: 'Ironrest', S: 'Hammerfall' },
    biomes: { seat: 'rubble', A: 'cracked', B: 'scorch', T: 'deadgrass', S: 'ash' },
    jitter: { A: [0, 1], B: [1, 0], T: [-1, 2], S: [1, 0] },
    seatPass: 'Anvil Pass', edge: { kind: 'river', name: 'Sludge Ford' }, ruin: 'Glass Hollow' },
  { id: 'scav', faction: 'scav', corner: [0, 96], dA: [0, -1], dB: [1, 0],
    names: { seat: 'West Warrens', A: 'Bone Flats', B: 'Junkwater', T: 'Mire Row', S: 'Rotmarsh' },
    biomes: { seat: 'rubble', A: 'frost', B: 'mud', T: 'deadgrass', S: 'scorch' },
    jitter: { A: [1, -1], B: [0, 0], T: [1, 1], S: [0, 1] },
    seatPass: 'Rat Run', edge: { kind: 'river', name: 'Junk Bridge' }, ruin: 'Dead Exchange' },
];
const LAYOUT = { seat: [7, 7], A: [27, 5], B: [5, 27], T: [19, 19], S: [33, 33] };
const ROLE_TIER = { seat: 0, A: 1, B: 1, T: 2, S: 3 };
const BIOME_IDS = ['ash', 'cracked', 'deadgrass', 'mud', 'frost', 'scorch', 'rubble', 'asphalt'];

const local = (q, a, b) => [q.corner[0] + a * q.dA[0] + b * q.dB[0], q.corner[1] + a * q.dA[1] + b * q.dB[1]];
const quarterById = id => QUARTERS.find(q => q.id === id);
const nextB = q => QUARTERS[(QUARTERS.indexOf(q) + 1) % 4];

function buildProvinces() {
  const P = [];
  for (const q of QUARTERS) {
    for (const role of ['seat', 'A', 'B', 'T', 'S']) {
      const j = q.jitter[role] || [0, 0];
      const [a, b] = LAYOUT[role];
      P.push({ id: `${q.id}-${role}`, quarter: q.id, role, name: q.names[role], tier: ROLE_TIER[role], biome: q.biomes[role],
        seed: local(q, a + j[0], b + j[1]), weight: role === 'seat' ? 0.92 : 1, seatOf: role === 'seat' ? q.faction : null });
    }
  }
  for (const q of QUARTERS) {
    const qb = nextB(q);
    const mid = [(q.corner[0] + qb.corner[0]) / 2, (q.corner[1] + qb.corner[1]) / 2];
    const k = 32 / 48;
    P.push({ id: `ruin-${q.id}`, quarter: null, edgeOf: [q.id, qb.id], role: 'R', name: q.ruin, tier: 4, biome: 'rubble',
      seed: [mid[0] + (CENTER[0] - mid[0]) * k, mid[1] + (CENTER[1] - mid[1]) * k], weight: 1.06 });
  }
  P.push({ id: 'metro', quarter: null, role: 'M', name: 'Command Ruin', tier: 5, biome: 'asphalt', seed: CENTER.slice(), weight: 1.22 });
  P.forEach((p, i) => { p.index = i; p.kind = TIERS[p.tier].kind; p.tierInfo = TIERS[p.tier]; });
  return P;
}

function wiggle(pts, amp, s) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const steps = Math.max(2, Math.round(dist(a, b) / 1.5));
    const nx = -(b[1] - a[1]) / dist(a, b), ny = (b[0] - a[0]) / dist(a, b);
    for (let k = 0; k < steps; k++) {
      const t = k / steps, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const edge = (i === 0 && k === 0) ? 0 : 1;
      const o = (fbm(x * 0.18, y * 0.18, s) - 0.5) * amp * edge;
      out.push([x + nx * o, y + ny * o]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function buildLines(P) {
  const L = [];
  for (const q of QUARTERS) {
    const qb = nextB(q);
    const seatRidge = [[0.3, 17.2], [3.2, 16.9], [8.4, 16.1], [11.2, 14.6], [14.2, 12.4], [16.2, 9.4], [17.6, 6.2]].map(([a, b]) => local(q, a, b));
    L.push({ id: `ridge-${q.id}`, kind: 'ridge', barrier: true, pts: seatRidge, gap: [seatRidge[1], seatRidge[2]],
      passName: q.seatPass, between: [`${q.id}-seat`, `${q.id}-B`] });
    if (q.edge.kind === 'ridge') {
      const e = [[0.2, 48], [3.4, 48.5], [8.6, 47.5], [12.5, 48.3], [16.5, 47.6]].map(([a, b]) => local(q, a, b));
      L.push({ id: `edge-${q.id}`, kind: 'ridge', barrier: true, pts: e, gap: [e[1], e[2]], passName: q.edge.name,
        between: [`${q.id}-B`, `${qb.id}-A`] });
    } else {
      const e = [[0, 48], [6, 48.6], [12, 47.6], [18, 48.4], [24, 47.2], [28.5, 44.2], [33, 42.4], [37.5, 43.6], [40.5, 45.6]].map(([a, b]) => local(q, a, b));
      L.push({ id: `edge-${q.id}`, kind: 'river', barrier: true, pts: wiggle(e, 1.4, 77 + L.length), pond: { at: local(q, 41.2, 46), r: 1.9 },
        bridgeName: q.edge.name, between: [`${q.id}-B`, `${qb.id}-A`] });
    }
  }
  const creeks = [['home', 'mud'], ['red', 'mud']];
  for (const [qid, look] of creeks) {
    const q = quarterById(qid);
    const pts = [[0, 34.5], [2.4, 35.2], [5, 36.4], [7.6, 36.2], [9.6, 35]].map(([a, b]) => local(q, a, b));
    L.push({ id: `creek-${qid}`, kind: 'river', barrier: false, look, pts: wiggle(pts, 0.9, 400 + L.length), pond: { at: local(q, 10.8, 34.4), r: 1.5 } });
  }
  return L;
}

function assignCells(P, L) {
  const prov = new Int16Array(N * N);
  const barriers = [];
  for (const l of L) if (l.barrier) for (let i = 0; i < l.pts.length - 1; i++) barriers.push([l.pts[i], l.pts[i + 1]]);
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
    const c = [gx + 0.5, gy + 0.5];
    const dx = (fbm(c[0] * 0.07, c[1] * 0.07, 11) - 0.5) * 9, dy = (fbm(c[0] * 0.07, c[1] * 0.07, 29) - 0.5) * 9;
    const pd = [c[0] + dx, c[1] + dy];
    let best = -1, bd = Infinity, fb = -1, fbd = Infinity;
    for (const p of P) {
      const d = dist(pd, p.seed) / p.weight;
      if (d < fbd) { fbd = d; fb = p.index; }
      if (d >= bd) continue;
      if (barriers.some(([a, b]) => segCross(c, p.seed, a, b))) continue;
      bd = d; best = p.index;
    }
    prov[gy * N + gx] = best >= 0 ? best : fb;
  }
  cleanupIslands(prov, P);
  return prov;
}

function cleanupIslands(prov, P) {
  for (let pass = 0; pass < 3; pass++) {
    const seen = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) {
      if (seen[i]) continue;
      const id = prov[i], comp = [i], border = {};
      seen[i] = 1;
      for (let k = 0; k < comp.length; k++) {
        const c = comp[k], x = c % N, y = (c / N) | 0;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const j = ny * N + nx;
          if (prov[j] === id) { if (!seen[j]) { seen[j] = 1; comp.push(j); } }
          else border[prov[j]] = (border[prov[j]] || 0) + 1;
        }
      }
      const s = P[id].seed, seedCell = Math.floor(s[1]) * N + Math.floor(s[0]);
      if (comp.includes(seedCell) || comp.length > 60) continue;
      const tgt = +Object.entries(border).sort((a, b) => b[1] - a[1])[0][0];
      for (const c of comp) prov[c] = tgt;
    }
  }
}

function adjacency(prov) {
  const adj = {};
  const add = (a, b) => { const k = a < b ? `${a}|${b}` : `${b}|${a}`; adj[k] = (adj[k] || 0) + 1; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = prov[y * N + x];
    if (x + 1 < N && prov[y * N + x + 1] !== a) add(a, prov[y * N + x + 1]);
    if (y + 1 < N && prov[(y + 1) * N + x] !== a) add(a, prov[(y + 1) * N + x]);
  }
  return adj;
}

function borderDistance(prov) {
  const d = new Int16Array(N * N).fill(-1), q = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, a = prov[i];
    const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1 ||
      prov[i - 1] !== a || prov[i + 1] !== a || prov[i - N] !== a || prov[i + N] !== a;
    if (edge) { d[i] = 0; q.push(i); }
  }
  for (let k = 0; k < q.length; k++) {
    const i = q[k], x = i % N, y = (i / N) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = ny * N + nx;
      if (d[j] < 0 && prov[j] === prov[i]) { d[j] = d[i] + 1; q.push(j); }
    }
  }
  return d;
}

function buildConnections(P) {
  const byId = Object.fromEntries(P.map(p => [p.id, p]));
  const C = [];
  const add = (a, b, kind, name) => C.push({ from: a, to: b, kind, name: name || null });
  for (const q of QUARTERS) {
    const qb = nextB(q), qa = QUARTERS[(QUARTERS.indexOf(q) + 3) % 4];
    const id = r => `${q.id}-${r}`;
    add(id('seat'), id('A'), 'road');
    add(id('seat'), id('B'), 'pass', q.seatPass);
    add(id('A'), id('T'), 'road');
    add(id('B'), id('T'), 'road');
    add(id('T'), id('S'), 'road');
    add(id('S'), `ruin-${q.id}`, 'road');
    add(id('S'), `ruin-${qa.id}`, 'road');
    add(id('B'), `${qb.id}-A`, q.edge.kind === 'ridge' ? 'pass' : 'bridge', q.edge.name);
    add(`ruin-${q.id}`, 'metro', 'gate');
  }
  for (const c of C) { c.a = byId[c.from]; c.b = byId[c.to]; c.id = `${c.from}~${c.to}`; }
  return C;
}

function astar(start, goal, cost) {
  const S = start[1] * N + start[0], G = goal[1] * N + goal[0];
  const g = new Float32Array(N * N).fill(Infinity), came = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
  const open = [[0, S]];
  g[S] = 0;
  const h = i => Math.hypot(i % N - goal[0], ((i / N) | 0) - goal[1]);
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const [, cur] = open.splice(bi, 1)[0];
    if (cur === G) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const x = cur % N, y = (cur / N) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = ny * N + nx, c = cost(nx, ny, j);
      if (!isFinite(c)) continue;
      const ng = g[cur] + c * (dx && dy ? 1.414 : 1);
      if (ng < g[j]) { g[j] = ng; came[j] = cur; open.push([ng + h(j), j]); }
    }
  }
  if (came[G] < 0 && S !== G) return null;
  const path = [];
  for (let i = G; i >= 0; i = i === S ? -1 : came[i]) path.push([i % N + 0.5, ((i / N) | 0) + 0.5]);
  return path.reverse();
}

function routeConnections(W) {
  const { P, C, L, cells } = W;
  for (const c of C) {
    const line = c.kind === 'pass' ? L.find(l => l.passName === c.name) : c.kind === 'bridge' ? L.find(l => l.bridgeName === c.name) : null;
    let way = null;
    if (c.kind === 'pass') way = [(line.gap[0][0] + line.gap[1][0]) / 2, (line.gap[0][1] + line.gap[1][1]) / 2];
    c.passPt = way;
    const allowed = new Set([c.a.index, c.b.index]);
    const cost = (x, y, j) => {
      if (cells.ridge[j] && !(way && Math.hypot(x + 0.5 - way[0], y + 0.5 - way[1]) < 1.8)) return Infinity;
      let k = 1 + fbm(x * 0.22, y * 0.22, 5) * 2.6;
      if (!allowed.has(cells.prov[j])) k += 6;
      if (cells.water[j]) k += c.kind === 'bridge' ? 4 : 40;
      return k;
    };
    const cellOf = p => [Math.floor(p[0]), Math.floor(p[1])];
    const legs = way ? [[c.a.seed, way], [way, c.b.seed]] : [[c.a.seed, c.b.seed]];
    let raw = [];
    for (const [s, e] of legs) { const r = astar(cellOf(s), cellOf(e), cost) || [s, e]; raw = raw.concat(raw.length ? r.slice(1) : r); }
    raw[0] = c.a.seed.slice(); raw[raw.length - 1] = c.b.seed.slice();
    c.cells = raw;
    c.path = chaikin(simplify(raw, 2), 3);
    if (c.kind === 'bridge') {
      const i = c.path.findIndex(p => cells.water[Math.floor(p[1]) * N + Math.floor(p[0])]);
      c.bridgePt = i >= 0 ? c.path[i] : c.path[c.path.length >> 1];
    }
    for (const p of raw) {
      const j = Math.floor(p[1]) * N + Math.floor(p[0]);
      if (j >= 0 && j < N * N) cells.road[j] = 1;
    }
  }
}

function markTerrain(W) {
  const { P, L, cells } = W;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, c = [x + 0.5, y + 0.5];
    for (const l of L) {
      if (l.kind === 'river') {
        const w = l.barrier ? 0.95 : 0.7;
        if (distToLine(c, l.pts) < w || (l.pond && dist(c, l.pond.at) < l.pond.r)) cells.water[i] = 1;
      } else {
        const segs = [];
        for (let k = 0; k < l.pts.length - 1; k++) {
          const a = l.pts[k], b = l.pts[k + 1];
          if (a === l.gap[0] && b === l.gap[1]) continue;
          segs.push([a, b]);
        }
        if (segs.some(([a, b]) => distToSeg(c, a, b) < 0.95)) cells.ridge[i] = 1;
      }
    }
    const p = P[cells.prov[i]];
    const jx = x + Math.round((hash2(x, y, 3) - 0.5) * 2.2), jy = y + Math.round((hash2(x, y, 4) - 0.5) * 2.2);
    const q = (jx >= 0 && jy >= 0 && jx < N && jy < N) ? P[cells.prov[jy * N + jx]] : p;
    cells.biome[i] = BIOME_IDS.indexOf(q.biome);
    const lush = p.biome === 'deadgrass' || p.biome === 'mud' || p.biome === 'frost';
    cells.forest[i] = lush && fbm(x * 0.16, y * 0.16, 91) > 0.56 ? 1 : 0;
  }
}

function generate() {
  const P = buildProvinces();
  const L = buildLines(P);
  const cells = { prov: assignCells(P, L), biome: new Uint8Array(N * N), water: new Uint8Array(N * N), ridge: new Uint8Array(N * N),
    road: new Uint8Array(N * N), forest: new Uint8Array(N * N), bdist: null };
  cells.bdist = borderDistance(cells.prov);
  const W = { N, P, L, cells, C: buildConnections(P), byId: {} };
  P.forEach(p => { W.byId[p.id] = p; });
  markTerrain(W);
  routeConnections(W);
  for (const p of P) p.cellCount = cells.prov.reduce((s, v) => s + (v === p.index ? 1 : 0), 0);
  W.adj = adjacency(cells.prov);
  W.missing = W.C.filter(c => !W.adj[c.a.index < c.b.index ? `${c.a.index}|${c.b.index}` : `${c.b.index}|${c.a.index}`]).map(c => c.id);
  WG.placeContent(W);
  WG.placeProps(W);
  WG.labelAnchors(W);
  W.neighbors = id => W.C.filter(c => c.from === id || c.to === id).map(c => c.from === id ? c.to : c.from);
  return W;
}

Object.assign(WG, { generate, TIERS, QUARTERS, BIOME_IDS });
})(globalThis);
