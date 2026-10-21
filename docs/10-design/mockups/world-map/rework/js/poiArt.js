(function (root) {
'use strict';

const OWNER = { you: '#3ad17a', scav: '#b7d645', red: '#e05a3d', cov: '#6f9fd8', rebel: '#b07ad8', neutral: '#8a93a0' };
const HALF_W = 32, HALF_H = 24;
const off = (dgx, dgy) => [(dgx - dgy) * HALF_W, (dgx + dgy) * HALF_H];

const COMPOSITES = {
  1: { parts: [['workshop_L1', -0.9, -0.8, 0.72], ['bank_L1', 0.1, 0.05, 1.6], ['siegeworkshop_L1', 1.1, -0.7, 1.0], ['bank_L1', -0.95, 0.9, 1.25]] },
  2: { parts: [['house_L1', -1.25, -1.35, 0.66], ['house1_L1', 0.65, -1.5, 0.6], ['well_L1', -0.1, -0.1, 0.45], ['house_L2', -1.6, 0.5, 0.62], ['house1_L2', 0.75, 0.45, 0.6], ['farm_L1', -0.35, 1.55, 0.68], ['house_L3', 1.7, 1.25, 0.56]] },
  3: { wall: { r: 2.2, h: 15, style: 'wood', towers: 'rallypoint_L3', towerScale: 0.33 },
       parts: [['barracks_L1', -0.6, -0.6, 0.42], ['house1_L3', 0.7, -0.4, 0.4], ['storehouse_L2', -0.8, 0.8, 0.42], ['house_L2', 0.75, 0.85, 0.4]] },
  4: { wall: { r: 2.7, h: 16, style: 'ruin', towers: 'rallypoint_L3', towerScale: 0.34, broken: true },
       parts: [['cafeteria_L3', 0.5, -1.6, 0.42, 1], ['house1_L4', -1.6, -0.9, 0.42, 1], ['heroquarters_L3', -0.15, -0.15, 0.6, 1], ['infantryhall_L2', 1.5, 0.0, 0.42, 1],
         ['house1_L6', -1.4, 1.2, 0.4, 1], ['magictower_L2', 0.9, 1.4, 0.55, 1]] },
  5: { wall: { r: 3.5, h: 22, style: 'stone', towers: 'rallypoint_L3', towerScale: 0.42, gates: true },
       parts: [['heroquarters_L2', -1.6, -1.6, 0.52, 1], ['house1_L6', 0.2, -2.3, 0.44], ['magictower_L2', 1.7, -1.7, 0.62], ['cafeteria_L3', -2.3, 0.1, 0.44, 1],
         ['heroquarters_L3', 0, 0, 0.78], ['infantryhall_L2', 2.2, -0.2, 0.46], ['house1_L6', -1.5, 1.4, 0.44], ['townhall_L1', 1.4, 1.5, 0.42, 1],
         ['house1_L4', 0.0, 2.3, 0.42, 1], ['heroquarters_L1', -2.4, -2.0, 0.34, 1]] },
  seatHome: { parts: [['house1_L1', -2.3, -0.7, 0.5], ['house_L1', 0.8, -2.4, 0.5], ['townhall_L2', 0, 0, 0.86], ['farm_L1', -1.8, 1.8, 0.62], ['house_L2', 2.2, 1.1, 0.5]] },
  seatWar: { wall: { r: 2.1, h: 18, style: 'iron', towers: 'rallypoint_L3', towerScale: 0.36 },
       parts: [['barracks_L3', -0.8, -0.7, 0.5], ['heroquarters_L1', 0.15, 0.1, 0.46], ['cavalrystable_L1', 0.9, 1.0, 0.34]] },
};
const WALL_STYLE = {
  wood: { a: '#6e5236', b: '#55402a', top: '#9c7a52', stake: 'rgba(30,18,8,0.55)' },
  stone: { a: '#9a9183', b: '#7a7266', top: '#c9bfae', stake: null },
  ruin: { a: '#7b766f', b: '#5f5b55', top: '#a7a198', stake: null },
  iron: { a: '#4a4744', b: '#383533', top: '#77716a', stake: 'rgba(0,0,0,0.4)' },
};

function drawPart(x, sx, sy, S, name, dgx, dgy, sc, grey, tintWash, bb) {
  const im = tintWash ? Sprites.tint(name, tintWash) : Sprites.bld(name, !!grey);
  if (!im) return;
  const [ax, ay] = Sprites.anchor(name);
  const [ox, oy] = off(dgx, dgy);
  const k = sc * S;
  const dx = sx + ox * S - ax * k, dy = sy + oy * S - ay * k, w = im.width * k, h = im.height * k;
  x.drawImage(im, dx, dy, w, h);
  bb.x0 = Math.min(bb.x0, dx); bb.y0 = Math.min(bb.y0, dy); bb.x1 = Math.max(bb.x1, dx + w); bb.y1 = Math.max(bb.y1, dy + h);
}

function ringCorners(r) { return { N: off(-r, -r), E: off(r, -r), S: off(r, r), W: off(-r, r) }; }

function wallSeg(x, sx, sy, S, p0, p1, h, st, shade, broken) {
  const pieces = broken ? [[0, 0.34], [0.5, 0.78], [0.88, 1]] : [[0, 1]];
  for (const [t0, t1] of pieces) {
    const a = [p0[0] + (p1[0] - p0[0]) * t0, p0[1] + (p1[1] - p0[1]) * t0], b = [p0[0] + (p1[0] - p0[0]) * t1, p0[1] + (p1[1] - p0[1]) * t1];
    const A = [sx + a[0] * S, sy + a[1] * S], B = [sx + b[0] * S, sy + b[1] * S], H = h * S;
    x.fillStyle = shade;
    x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); x.lineTo(B[0], B[1] - H); x.lineTo(A[0], A[1] - H); x.closePath(); x.fill();
    if (st.stake) {
      x.strokeStyle = st.stake; x.lineWidth = Math.max(0.6, S * 2);
      const n = Math.max(2, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / Math.max(3, 9 * S)));
      x.beginPath();
      for (let i = 1; i < n; i++) { const t = i / n, px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t; x.moveTo(px, py); x.lineTo(px, py - H); }
      x.stroke();
    }
    x.strokeStyle = st.top; x.lineWidth = Math.max(1, 4 * S);
    x.beginPath(); x.moveTo(A[0], A[1] - H); x.lineTo(B[0], B[1] - H); x.stroke();
  }
}

function gatedSegs(p0, p1, gate) {
  if (!gate) return [[p0, p1]];
  const lerp = t => [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
  return [[p0, lerp(0.4)], [lerp(0.6), p1]];
}

function drawWall(x, sx, sy, S, wall, half, bb) {
  const c = ringCorners(wall.r), st = WALL_STYLE[wall.style];
  const segs = half === 'back' ? [[c.W, c.N, st.b], [c.N, c.E, st.b]] : [[c.E, c.S, st.a], [c.S, c.W, st.b]];
  for (const [p0, p1, shade] of segs) for (const [a, b] of gatedSegs(p0, p1, wall.gates)) wallSeg(x, sx, sy, S, a, b, wall.h, st, shade, wall.broken);
  const towerAt = half === 'back' ? [c.W, c.N, c.E] : [c.S];
  if (wall.gates) {
    const mids = half === 'back' ? [[c.W, c.N], [c.N, c.E]] : [[c.E, c.S], [c.S, c.W]];
    for (const [p0, p1] of mids) for (const t of [0.4, 0.6]) towerAt.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]);
  }
  const im = Sprites.bld(wall.towers, wall.style === 'ruin');
  if (!im) return;
  const [ax, ay] = Sprites.anchor(wall.towers);
  for (const p of towerAt) {
    const k = wall.towerScale * S;
    const dx = sx + p[0] * S - ax * k, dy = sy + p[1] * S - ay * k;
    x.drawImage(im, dx, dy, im.width * k, im.height * k);
    bb.y0 = Math.min(bb.y0, dy);
  }
}

function ownerRing(x, sx, sy, S, r, color, dashed) {
  x.save();
  x.strokeStyle = color; x.lineWidth = Math.max(2, 5 * S); x.globalAlpha = 0.9;
  if (dashed) x.setLineDash([8, 6]);
  x.beginPath(); x.ellipse(sx, sy, r * HALF_W * 1.45 * S + 4, r * HALF_H * 1.45 * S + 3, 0, 0, Math.PI * 2); x.stroke();
  x.globalAlpha = 0.22; x.lineWidth = Math.max(5, 16 * S); x.setLineDash([]);
  x.beginPath(); x.ellipse(sx, sy, r * HALF_W * 1.45 * S + 4, r * HALF_H * 1.45 * S + 3, 0, 0, Math.PI * 2); x.stroke();
  x.restore();
}

function banner(x, px, py, S, color, big) {
  const k = Math.max(0.55, S * (big ? 1.4 : 1));
  const poleH = 46 * k, fw = 22 * k, fh = 14 * k;
  x.strokeStyle = '#1b130c'; x.lineWidth = Math.max(1.5, 3 * k);
  x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - poleH); x.stroke();
  x.fillStyle = color; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(px, py - poleH); x.lineTo(px + fw, py - poleH + 2 * k); x.lineTo(px + fw - 5 * k, py - poleH + fh / 2 + 1 * k); x.lineTo(px + fw, py - poleH + fh); x.lineTo(px, py - poleH + fh); x.closePath(); x.fill(); x.stroke();
}

const FACTION_WASH = { red: 'rgba(224,90,61,0.22)', scav: 'rgba(183,214,69,0.2)', cov: 'rgba(111,159,216,0.24)' };

function drawMain(x, prov, sx, sy, S, o) {
  const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const key = prov.tier === 0 ? (prov.seatOf === 'you' ? 'seatHome' : 'seatWar') : prov.tier;
  const comp = COMPOSITES[key];
  const r = prov.tierInfo.footprint;
  x.save();
  if (o.alpha != null) x.globalAlpha = o.alpha;
  x.fillStyle = 'rgba(0,0,0,0.28)';
  x.beginPath(); x.ellipse(sx, sy + 4 * S, r * HALF_W * 1.25 * S, r * HALF_H * 1.25 * S, 0, 0, Math.PI * 2); x.fill();
  if (o.owner && o.owner !== 'neutral') ownerRing(x, sx, sy, S, r, OWNER[o.owner], o.cutOff);
  const wash = prov.tier === 0 && prov.seatOf !== 'you' ? FACTION_WASH[prov.seatOf] : null;
  if (comp.wall) drawWall(x, sx, sy, S, comp.wall, 'back', bb);
  const parts = comp.parts.slice().sort((a, b) => (a[1] + a[2]) - (b[1] + b[2]));
  for (const [name, dgx, dgy, sc, grey] of parts) drawPart(x, sx, sy, S, name, dgx, dgy, sc, grey || o.grey, wash, bb);
  if (comp.wall) drawWall(x, sx, sy, S, comp.wall, 'front', bb);
  if (prov.tier === 0) {
    const [bx, by] = off(r * 0.9, -r * 0.9);
    banner(x, sx + bx * S, sy + by * S, S, OWNER[prov.seatOf], true);
    const [cx2, cy2] = off(-r * 0.9, r * 0.9);
    banner(x, sx + cx2 * S, sy + cy2 * S, S, OWNER[prov.seatOf], true);
  } else if (o.owner && o.owner !== 'neutral') {
    const [bx, by] = off(r * 0.8, -r * 0.8);
    banner(x, sx + bx * S, sy + by * S, S, OWNER[o.owner], prov.tier >= 3);
  }
  x.restore();
  if (!isFinite(bb.x0)) { bb.x0 = sx - 20; bb.x1 = sx + 20; bb.y0 = sy - 30; bb.y1 = sy + 5; }
  return bb;
}

const NODE_SPRITE = {
  wood: ['props/tree_pine_group', 0.52], stone: ['buildings/quarry_L1', 0.49], iron: ['buildings/mine_L1', 0.46],
  food: ['buildings/farm_L1', 0.55], water: ['buildings/well_L1', 0.49],
};
const MID_SPRITE = { ruin: ['buildings/house1_L4', 0.53, true], watchtower: ['buildings/rallypoint_L3', 0.56], outpost: ['buildings/infantryhall_L2', 0.50], mine: ['buildings/mine_L1', 0.64] };
const RES_COLOR = { wood: '#7fae4f', stone: '#a9a39a', iron: '#8fa3b8', food: '#d9b24a', water: '#4fb0d9' };
const MID_ICON = { ruin: 'column', watchtower: 'search', outpost: 'base', mine: 'iron' };

function smallSprite(x, sx, sy, S, key, sc, grey) {
  const [kind, name] = key.split('/');
  const im = kind === 'props' ? Sprites.prop(name, null) : Sprites.bld(name, grey);
  if (!im) return;
  const [ax, ay] = kind === 'props' ? [im.width / 2, im.height * 0.85] : Sprites.anchor(name);
  const k = sc * S;
  x.drawImage(im, sx - ax * k, sy - ay * k, im.width * k, im.height * k);
}

function camp(x, sx, sy, S, guard) {
  const crates = Sprites.prop('debris_crates', null), wheels = Sprites.prop('debris_wheels', null);
  const k = 0.42 * S;
  if (wheels) x.drawImage(wheels, sx - 26 * S - wheels.width * k / 2, sy - wheels.height * k + 6 * S, wheels.width * k, wheels.height * k);
  if (crates) x.drawImage(crates, sx + 10 * S - crates.width * k / 2, sy - crates.height * k + 4 * S, crates.width * k, crates.height * k);
  x.fillStyle = 'rgba(30,14,10,0.9)';
  x.beginPath(); x.moveTo(sx - 16 * S, sy + 4 * S); x.lineTo(sx - 2 * S, sy - 26 * S); x.lineTo(sx + 12 * S, sy + 4 * S); x.closePath(); x.fill();
  x.strokeStyle = guard ? '#e05a3d' : '#a8452e'; x.lineWidth = Math.max(1, 2 * S); x.stroke();
}

function disc(x, cx, cy, r, ring, iconName, level, o = {}) {
  x.save();
  if (o.alpha != null) x.globalAlpha = o.alpha;
  x.fillStyle = 'rgba(0,0,0,0.45)';
  x.beginPath(); x.arc(cx, cy + 1.5, r + 1.5, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'hsl(30,12%,10%)'; x.strokeStyle = ring; x.lineWidth = Math.max(2, r * 0.2);
  if (o.dashed) x.setLineDash([3, 2.5]);
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); x.stroke();
  x.setLineDash([]);
  const im = Sprites.icon(iconName);
  if (im) x.drawImage(im, cx - r * 0.6, cy - r * 0.6, r * 1.2, r * 1.2);
  if (level != null) {
    const bx = cx + r * 0.78, by = cy - r * 0.78, br = Math.max(6.5, r * 0.55);
    x.fillStyle = o.levelColor || ring; x.strokeStyle = 'rgba(0,0,0,0.7)'; x.lineWidth = 1.2;
    x.beginPath(); x.roundRect(bx - br, by - br * 0.82, br * 2, br * 1.64, 3); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.font = `800 ${Math.round(br * 1.25)}px Outfit, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(level), bx, by + 0.5);
  }
  x.restore();
  return { x0: cx - r - 2, y0: cy - r - 2 - (level != null ? 4 : 0), x1: cx + r + (level != null ? r * 0.9 : 2), y1: cy + r + 2 };
}

function liftOf(poi, S) { return (poi.cls === 'mid' ? 84 : 50) * S + (poi.cls === 'mid' ? 12 : 10); }

function drawSmall(x, poi, sx, sy, S, o = {}) {
  const r = poi.cls === 'mid' ? 12 : 10;
  if (o.sprites) {
    if (poi.kind === 'node') { const [k, sc] = NODE_SPRITE[poi.res]; smallSprite(x, sx, sy, S, k, sc); }
    else if (poi.cls === 'mid') { const [k, sc, g] = MID_SPRITE[poi.kind]; smallSprite(x, sx, sy, S, k, sc, g); }
    else camp(x, sx, sy, S, poi.guard);
  }
  const lift = o.sprites ? liftOf(poi, S) : 0;
  const cy = sy - lift;
  let ring, icon;
  if (poi.kind === 'node') { ring = RES_COLOR[poi.res]; icon = poi.res; }
  else if (poi.cls === 'mid') { ring = '#d9c7a3'; icon = MID_ICON[poi.kind]; }
  else { ring = poi.guard ? '#ff7a4d' : '#c9503a'; icon = poi.guard ? 'shield' : 'skull'; }
  const bb = disc(x, sx, cy, r, ring, icon, poi.level, { alpha: o.alpha, levelColor: poi.cls === 'camp' ? '#b8402c' : 'hsl(30,30%,30%)' });
  if (o.sprites) bb.y1 = Math.max(bb.y1, sy + 4);
  return bb;
}

root.PoiArt = { drawMain, drawSmall, liftOf, disc, banner, OWNER, RES_COLOR, COMPOSITES };
})(globalThis);
