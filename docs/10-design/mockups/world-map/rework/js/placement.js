(function (root) {
'use strict';
const WG = root.WG;
const { N, hash2, rngOf, fbm, dist, cellIdx } = WG;
const BIOME_RES = {
  ash: { wood: 1, iron: 2, stone: 2, food: 0.5 }, cracked: { stone: 3, iron: 2, food: 1 },
  deadgrass: { food: 3, wood: 2, water: 1 }, mud: { food: 2, wood: 1.5, water: 2.5 },
  frost: { water: 2, iron: 2, stone: 1, wood: 1 }, scorch: { iron: 3, stone: 2 },
  rubble: { iron: 2.5, stone: 2, food: 0.5 }, asphalt: { iron: 2, stone: 2 },
};
const MID_KINDS = ['ruin', 'watchtower', 'outpost', 'mine'];
const MONSTERS = ['Scav Rats', 'Feral Pack', 'Raider Crew', 'Mutant Hounds', 'Bone Gang', 'Ash Brutes', 'Iron Ghouls', 'Frost Giant', 'Wasteland Behemoth', 'Warlord Guard', 'Titan Husk', 'Titan Husk'];
const monsterFor = lvl => MONSTERS[Math.max(0, Math.min(MONSTERS.length - 1, lvl - 1))];
const powerFor = lvl => Math.round(420 * Math.pow(1.42, lvl - 1));

function near(cells, flag, x, y, r) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
    if (cells[flag][ny * N + nx] && Math.hypot(dx, dy) <= r + 0.01) return true;
  }
  return false;
}
function roadDist(cells, x, y, maxR) {
  for (let r = 0; r <= maxR; r++) if (near(cells, 'road', x, y, r)) return r;
  return Infinity;
}

function placeContent(W) {
  const { P, C, cells } = W;
  const pois = [], campSlots = {}, warCampSlots = [];
  for (const p of P) {
    const ti = p.tierInfo;
    const lvl = ti.levelBase + (p.tier >= 4 ? 2 : 1);
    p.main = { id: `main-${p.id}`, cls: 'main', prov: p.id, at: p.seed.slice(), tier: p.tier, level: lvl, monster: monsterFor(lvl),
      power: Math.round(powerFor(lvl) * 1.6 * ti.walls) };
  }
  const pick = (rng, weights) => { const e = Object.entries(weights); let t = rng() * e.reduce((s, x) => s + x[1], 0); for (const [k, w] of e) { t -= w; if (t <= 0) return k; } return e[0][0]; };

  for (const p of P) {
    const rng = rngOf(WG.SEED ^ (p.index * 7919 + 13));
    const cand = [];
    for (let i = 0; i < N * N; i++) {
      if (cells.prov[i] !== p.index || cells.bdist[i] < 2 || cells.water[i] || cells.ridge[i]) continue;
      const c = [i % N + 0.5, ((i / N) | 0) + 0.5];
      if (dist(c, p.seed) < p.tierInfo.ring + (p.tier === 5 ? 1 : 0)) continue;
      cand.push(c);
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const placed = [];
    const ok = (c, rules) => placed.every(o => dist(o.at, c) >= (rules[o.cls] ?? 3));
    const entry = entryPoint(p, C);
    const maxD = Math.max(...cand.map(c => dist(c, p.seed)), 1);
    const levelAt = c => {
      const gEntry = entry ? dist(c, entry) : maxD;
      const g = Math.max(0, Math.min(1, 1 - dist(c, p.seed) / Math.max(1, dist(entry || c, p.seed) + 2)));
      return p.tierInfo.levelBase + Math.round(g * (p.tier >= 4 ? 2 : 1)) + (gEntry < 3 ? 0 : 0);
    };
    const isSeat = p.tier === 0, isHomeSeat = p.id === 'home-seat';
    const midCount = isSeat ? 0 : p.tier === 5 ? 2 : 2 + (rng() < 0.5 ? 1 : 0);
    const kinds = MID_KINDS.slice().sort(() => rng() - 0.5);
    let mi = 0;
    for (const c of cand) {
      if (mi >= midCount) break;
      if (!ok(c, { mid: 5, small: 3, camp: 3 })) continue;
      const kind = kinds[mi % kinds.length], lvl = levelAt(c);
      placed.push({ id: `${p.id}-m${mi}`, cls: 'mid', kind, prov: p.id, at: c, level: lvl });
      mi++;
    }
    for (const m of placed.filter(o => o.cls === 'mid' && (o.kind === 'mine' || o.kind === 'ruin'))) {
      const g = cand.find(c => dist(c, m.at) >= 2 && dist(c, m.at) <= 3.2 && ok(c, { mid: 2, small: 3, camp: 3 }) && !cells.road[cellIdx(c)]);
      if (g) placed.push({ id: `${m.id}-guard`, cls: 'camp', guard: true, guards: m.kind, prov: p.id, at: g, level: m.level + 1 });
    }
    for (const cn of C) {
      if (cn.kind !== 'pass') continue;
      const guardSide = cn.b;
      if (guardSide !== p || !cn.passPt) continue;
      const g = cand.concat(allCellsNear(cn.passPt, 4, p, cells)).find(c => dist(c, cn.passPt) >= 1.6 && dist(c, cn.passPt) <= 4 &&
        cells.prov[cellIdx(c)] === p.index && !cells.road[cellIdx(c)] && !cells.ridge[cellIdx(c)] && ok(c, { mid: 3, small: 2.5, camp: 3 }));
      if (g) placed.push({ id: `${p.id}-pg-${cn.name.replace(/\s/g, '')}`, cls: 'camp', guard: true, guards: cn.name, prov: p.id, at: g, level: p.tierInfo.levelBase + 1 });
    }
    const nodeCount = isHomeSeat ? 4 : isSeat ? 0 : 6 + Math.floor(rng() * 5);
    const clusters = [];
    for (const c of cand) {
      if (clusters.length >= Math.ceil(nodeCount / 3)) break;
      if (cells.road[cellIdx(c)] || near(cells, 'road', Math.floor(c[0]), Math.floor(c[1]), 1)) continue;
      if (!ok(c, { mid: 4, small: 3, camp: 3 }) || clusters.some(k => dist(k, c) < 6)) continue;
      clusters.push(c);
    }
    let ni = 0;
    for (const k of clusters) {
      for (const c of cand) {
        if (ni >= nodeCount) break;
        const d = dist(c, k);
        if (d > 4.2 || placed.filter(o => o.cluster === k).length >= 3) continue;
        const x = Math.floor(c[0]), y = Math.floor(c[1]);
        if (cells.road[y * N + x] || near(cells, 'road', x, y, 1)) continue;
        if (!ok(c, { mid: 3, small: 3, camp: 3, main: 0 })) continue;
        let res = null;
        for (let t = 0; t < 6 && !res; t++) {
          const r = pick(rng, BIOME_RES[p.biome]);
          if (r === 'water' && !near(cells, 'water', x, y, 2)) continue;
          if (r === 'wood' && !near(cells, 'forest', x, y, 2)) continue;
          res = r;
        }
        if (!res) res = near(cells, 'water', x, y, 2) ? 'water' : 'stone';
        placed.push({ id: `${p.id}-n${ni}`, cls: 'small', kind: 'node', res, prov: p.id, at: c, level: levelAt(c), cluster: k });
        ni++;
      }
    }
    const slots = [];
    if (!isSeat) {
      const roadCand = cand.filter(c => !cells.road[cellIdx(c)] && roadDist(cells, Math.floor(c[0]), Math.floor(c[1]), 3) <= 3);
      for (const c of roadCand.concat(cand)) {
        if (slots.length >= 5) break;
        if (cells.road[cellIdx(c)]) continue;
        if (!ok(c, { mid: 3, small: 3, camp: 3.5 }) || slots.some(s => dist(s, c) < 4)) continue;
        slots.push(c);
      }
      for (const c of cand) {
        if (slots.length >= 3) break;
        if (cells.road[cellIdx(c)] || !ok(c, { mid: 2.5, small: 2.2, camp: 3 }) || slots.some(s => dist(s, c) < 3.5)) continue;
        slots.push(c);
      }
      const campCount = Math.max(Math.min(1, slots.length), Math.min(slots.length - 1, p.tier >= 3 ? 3 : 2));
      slots.forEach((c, k) => { if (k < campCount) placed.push({ id: `${p.id}-c${k}`, cls: 'camp', prov: p.id, at: c, level: levelAt(c), slot: k }); });
    }
    campSlots[p.id] = slots;
    for (const o of placed) {
      if (o.cls === 'camp') { o.monster = monsterFor(o.level); o.power = powerFor(o.level); }
      delete o.cluster;
      pois.push(o);
    }
  }
  for (const cn of C) {
    if (cn.kind !== 'pass' || !cn.passPt) continue;
    for (const side of [cn.a, cn.b]) {
      const pts = allCellsNear(cn.passPt, 5, side, cells).filter(c => !cells.road[cellIdx(c)] && !cells.ridge[cellIdx(c)] && !cells.water[cellIdx(c)] && dist(c, cn.passPt) >= 2.5 &&
        pois.every(o => dist(o.at, c) >= 2.5));
      if (pts.length) warCampSlots.push({ id: `wc-${side.id}-${cn.name.replace(/\s/g, '')}`, prov: side.id, pass: cn.name, at: pts.sort((u, v) => dist(u, cn.passPt) - dist(v, cn.passPt))[0] });
    }
  }
  W.pois = pois; W.campSlots = campSlots; W.warCampSlots = warCampSlots;
}
function allCellsNear(pt, r, p, cells) {
  const out = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = Math.floor(pt[0]) + dx, y = Math.floor(pt[1]) + dy;
    if (x < 0 || y < 0 || x >= N || y >= N) continue;
    if (cells.prov[y * N + x] === p.index && cells.bdist[y * N + x] >= 1) out.push([x + 0.5, y + 0.5]);
  }
  return out;
}
function entryPoint(p, C) {
  let best = null, bt = 99;
  for (const c of C) {
    const other = c.a === p ? c.b : c.b === p ? c.a : null;
    if (!other || !c.path) continue;
    if (other.tier < bt) {
      bt = other.tier;
      const mid = c.path.find(pt => Math.floor(pt[0]) >= 0 && pt && dist(pt, p.seed) < dist(pt, other.seed));
      best = mid || p.seed;
    }
  }
  return best;
}

function placeProps(W) {
  const { P, cells, pois } = W;
  const props = [];
  const sets = {
    ash: [['tree_dead_1', 3], ['tree_dead_2', 3], ['tree_dead_3', 2], ['debris_cinder', 1], ['debris_rock', 1]],
    cracked: [['debris_rock', 1], ['debris_wheels', 1], ['debris_trash', 1], ['tree_dead_3', 2], ['debris_pipes', 1], ['tree_dead_2', 1]],
    deadgrass: [['tree_broad_1', 3], ['tree_broad_2', 3], ['tree_dead_2', 1], ['debris_rock', 1]],
    mud: [['tree_pine', 2], ['tree_dead_1', 2], ['debris_wreck', 1], ['debris_trash', 1]],
    frost: [['tree_pine', 3], ['tree_dead_2', 2], ['debris_rock', 2]],
    scorch: [['tree_dead_3', 3], ['tree_dead_1', 2], ['debris_cinder', 2], ['debris_pipes', 1]],
    rubble: [['debris_crates', 2], ['debris_pallet', 2], ['debris_pipes', 2], ['debris_trash', 2], ['debris_wreck', 1]],
    asphalt: [['debris_wreck', 3], ['debris_crates', 1], ['debris_pallet', 1], ['debris_trash', 1]],
  };
  const forestSets = { deadgrass: ['tree_broad_group', 'tree_broad_1', 'tree_broad_2'], mud: ['tree_pine_group', 'tree_pine', 'tree_dead_1'], frost: ['tree_pine_group', 'tree_pine'] };
  const density = { ash: 0.08, cracked: 0.05, deadgrass: 0.07, mud: 0.07, frost: 0.06, scorch: 0.07, rubble: 0.1, asphalt: 0.06 };
  const blocked = (c, r) => pois.some(o => dist(o.at, c) < r) || P.some(p => dist(p.seed, c) < p.tierInfo.footprint + 1.6);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, c = [x + 0.5 + (hash2(x, y, 51) - 0.5) * 0.6, y + 0.5 + (hash2(x, y, 52) - 0.5) * 0.6];
    if (cells.water[i] || cells.road[i]) continue;
    const biome = WG.BIOME_IDS[cells.biome[i]], r = hash2(x, y, 53);
    if (cells.ridge[i]) { if (r < 0.55 && !blocked(c, 1)) props.push({ img: 'debris_rock', at: c, s: 0.55 + hash2(x, y, 54) * 0.3, ridge: true }); continue; }
    if (blocked(c, 1.3)) continue;
    if (cells.forest[i] && forestSets[biome]) {
      if (r < 0.62) { const f = forestSets[biome]; props.push({ img: f[Math.floor(hash2(x, y, 55) * f.length)], at: c, s: 0.62 + hash2(x, y, 56) * 0.25 }); }
      continue;
    }
    const roadNear = near(cells, 'road', x, y, 1);
    const pr = density[biome] + (roadNear ? 0.07 : 0);
    if (r < pr) {
      const set = roadNear && hash2(x, y, 57) < 0.5 ? [['debris_wreck', 2], ['debris_wheels', 1], ['debris_trash', 1]] : sets[biome];
      const tot = set.reduce((s, e) => s + e[1], 0);
      let t = hash2(x, y, 58) * tot, img = set[0][0];
      for (const [k, w] of set) { t -= w; if (t <= 0) { img = k; break; } }
      props.push({ img, at: c, s: 0.55 + hash2(x, y, 59) * 0.25 });
    }
  }
  W.props = props;
}

function labelAnchors(W) {
  const { P, cells } = W;
  for (const p of P) {
    let best = null, bs = -Infinity;
    for (let i = 0; i < N * N; i++) {
      if (cells.prov[i] !== p.index) continue;
      const c = [i % N + 0.5, ((i / N) | 0) + 0.5];
      const dm = dist(c, p.seed);
      const below = (c[0] + c[1]) - (p.seed[0] + p.seed[1]);
      const across = Math.abs((c[0] - c[1]) - (p.seed[0] - p.seed[1]));
      let s = Math.min(cells.bdist[i], 6) * 1.2 - Math.abs(dm - (p.tierInfo.footprint + 4.5)) * 0.9 - across * 0.35 + (below > 0 ? 1.2 : 0);
      if (dm < p.tierInfo.footprint + 2.5) s -= 20;
      if (s > bs) { bs = s; best = c; }
    }
    p.labelAt = best;
  }
}
Object.assign(WG, { placeContent, placeProps, labelAnchors, monsterFor, powerFor, BIOME_RES });
})(globalThis);
