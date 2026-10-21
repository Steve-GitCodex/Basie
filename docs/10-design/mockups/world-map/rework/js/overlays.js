(function (root) {
'use strict';

function routePath(W, chain) {
  let pts = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i], b = chain[i + 1];
    const c = W.C.find(k => (k.from === a && k.to === b) || (k.from === b && k.to === a));
    if (!c) continue;
    const seg = c.from === a ? c.path : c.path.slice().reverse();
    pts = pts.concat(pts.length ? seg.slice(1) : seg);
  }
  return pts;
}

function screenPts(view, pts) { return pts.map(p => view.project(p[0], p[1])); }
function lengths(sp) { const L = [0]; for (let i = 1; i < sp.length; i++) L.push(L[i - 1] + Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1])); return L; }
function at(sp, L, t) {
  const d = t * L[L.length - 1];
  let i = 1;
  while (i < L.length - 1 && L[i] < d) i++;
  const k = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
  return [sp[i - 1][0] + (sp[i][0] - sp[i - 1][0]) * k, sp[i - 1][1] + (sp[i][1] - sp[i - 1][1]) * k, Math.atan2(sp[i][1] - sp[i - 1][1], sp[i][0] - sp[i - 1][0])];
}
function stroke(x, sp) { x.beginPath(); sp.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); }

function pill(x, cx, cy, text, color, opts = {}) {
  x.font = '800 10.5px Outfit, sans-serif';
  const w = x.measureText(text).width + 16, h = 19;
  const r = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
  return { rect: r, draw: (c) => {
    c.save();
    c.fillStyle = opts.bg || 'hsla(20,20%,6%,0.92)'; c.strokeStyle = color; c.lineWidth = 1.3;
    c.beginPath(); c.roundRect(r.x0, r.y0, w, h, 9.5); c.fill(); c.stroke();
    c.fillStyle = opts.fg || color; c.font = '800 10.5px Outfit, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, cx, cy + 0.5);
    if (opts.tag) {
      const tw = opts.tag.length * 5.6 + 8;
      c.fillStyle = opts.tagBg || 'hsl(188,85%,58%)'; c.beginPath(); c.roundRect(r.x1 + 4, cy - 6.5, tw, 13, 3); c.fill();
      c.fillStyle = '#03222a'; c.font = '800 8.5px Outfit, sans-serif'; c.fillText(opts.tag, r.x1 + 4 + tw / 2, cy + 0.5);
    }
    c.restore();
  }, w };
}

function staticThreats(view, v, band) {
  const ms = view.ms, out = [];
  for (const id of ms.warCamps || []) {
    const s = view.W.warCampSlots.find(w => w.id === id);
    if (!s) continue;
    const [sx, sy] = view.project(s.at[0], s.at[1]);
    const r = band === 'far' ? 11 : 14, col = PoiArt.OWNER[ms.owner[s.prov]] || '#e05a3d';
    const p = pill(view.ctx, sx, sy + r + 16, 'WAR-CAMP SLOT', col, { tag: 'LATER: AI', tagBg: '#6f9fd8' });
    out.push({ rect: { x0: sx - r - 2, x1: Math.max(sx + r + 2, p.rect.x1 + 70), y0: sy - r - 2, y1: p.rect.y1 }, draw: c => {
      c.save(); c.setLineDash([4, 3]);
      PoiArt.disc(c, sx, sy, r, col, 'sword', null, { dashed: true });
      c.restore(); p.draw(c);
    } });
  }
  for (const t of ms.mapPills || []) {
    const [sx, sy] = view.project(t.at[0], t.at[1]);
    out.push(pill(view.ctx, sx + (t.dx || 0), sy + (t.dy || 0), t.text, t.color, t));
  }
  return out;
}

function staticMarkers(view, v, band) {
  const ms = view.ms, out = [];
  const show = band !== 'far' || ms.showConnections;
  if (show) {
    for (const c of view.W.C) {
      if (c.kind !== 'pass' && c.kind !== 'bridge') continue;
      if ((ms.fogged.has(c.from) && ms.fogged.has(c.to)) && !ms.showConnections) continue;
      const pt = c.passPt || c.bridgePt;
      const [sx, sy] = view.project(pt[0], pt[1]);
      if (sx < -50 || sx > view.w + 50 || sy < -50 || sy > view.h + 50) continue;
      const k = Math.max(0.7, Math.min(1.3, v.z * 2.2));
      const name = c.name;
      view.ctx.font = '700 italic 10px Outfit, sans-serif';
      const tw = view.ctx.measureText(name).width;
      const showName = band !== 'far' || (ms.showConnections && (ms.namedConns || []).includes(c.id));
      const rect = { x0: sx - 12 * k, x1: sx + 12 * k + (showName ? tw + 8 : 0), y0: sy - 22 * k, y1: sy + 6 };
      out.push({ rect, hit: { rect, type: 'conn', id: c.id }, draw: x => {
        x.save();
        if (c.kind === 'pass') gateIcon(x, sx, sy, k, '#d8c3a0');
        else bridgeIcon(x, sx, sy, k);
        if (showName) {
          x.font = '700 italic 10px Outfit, sans-serif'; x.textBaseline = 'middle'; x.lineJoin = 'round';
          x.strokeStyle = 'rgba(8,5,2,0.9)'; x.lineWidth = 3; x.strokeText(name, sx + 13 * k, sy - 8 * k);
          x.fillStyle = '#e8d6b4'; x.fillText(name, sx + 13 * k, sy - 8 * k);
        }
        x.restore();
      } });
    }
  }
  if (ms.respawn) {
    const r = ms.respawn, [ax, ay] = view.project(r.from[0], r.from[1]), [bx, by] = view.project(r.to[0], r.to[1]);
    const p1 = pill(view.ctx, ax, ay + 20, `BEATEN · L${r.level}`, '#a69c8c');
    const t2 = `RESPAWNED HERE · L${r.level}`, w2 = pill(view.ctx, 0, 0, t2, "#e05a3d").w;
    const p2 = pill(view.ctx, bx - 14 + w2 / 2, by + 20, t2, "#e05a3d", { tag: "NEW" });
    out.push({ rect: p1.rect, draw: c => { c.save(); c.globalAlpha = 0.7; PoiArt.disc(c, ax, ay - 6, 11, '#8a8072', 'skull', r.level, { dashed: true }); c.strokeStyle = '#e05a3d'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(ax - 6, ay - 12); c.lineTo(ax + 6, ay); c.moveTo(ax + 6, ay - 12); c.lineTo(ax - 6, ay); c.stroke(); c.restore(); p1.draw(c); } });
    out.push({ rect: { ...p2.rect, x1: p2.rect.x1 + 40 }, draw: c => p2.draw(c) });
  }
  return out;
}

function gateIcon(x, sx, sy, k, col) {
  x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.ellipse(sx, sy, 13 * k, 5 * k, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#5a4634'; x.strokeStyle = '#1a120a'; x.lineWidth = 1.2;
  x.fillRect(sx - 10 * k, sy - 18 * k, 4 * k, 18 * k); x.strokeRect(sx - 10 * k, sy - 18 * k, 4 * k, 18 * k);
  x.fillRect(sx + 6 * k, sy - 18 * k, 4 * k, 18 * k); x.strokeRect(sx + 6 * k, sy - 18 * k, 4 * k, 18 * k);
  x.fillStyle = col; x.fillRect(sx - 12 * k, sy - 21 * k, 24 * k, 4 * k); x.strokeRect(sx - 12 * k, sy - 21 * k, 24 * k, 4 * k);
}
function bridgeIcon(x, sx, sy, k) {
  x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.ellipse(sx, sy, 12 * k, 4 * k, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#d8c3a0'; x.lineWidth = 2.2 * k;
  x.beginPath(); x.arc(sx, sy + 2 * k, 9 * k, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
}

function drawDynamic(view, x, now) {
  const ms = view.ms, v = view.view();
  if (ms.attackable && ms.attackable.length) MapLayers.drawAttackable(x, v, view.shapes, ms.attackable, now);
  for (const id of ms.hlConns || []) {
    const c = view.W.C.find(k => k.id === id);
    if (!c) continue;
    const sp = screenPts(view, c.path);
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = 'rgba(255,200,110,0.28)'; x.lineWidth = 12; stroke(x, sp);
    x.strokeStyle = '#ffd38a'; x.lineWidth = 3; x.setLineDash([10, 8]); x.lineDashOffset = -now * 0.02; stroke(x, sp);
    x.restore();
  }
  for (const pu of ms.pulses || []) {
    const [sx, sy] = view.project(pu.at[0], pu.at[1]);
    const k = (now % 1600) / 1600;
    x.save(); x.strokeStyle = pu.color; x.globalAlpha = 1 - k; x.lineWidth = 2.5;
    x.beginPath(); x.ellipse(sx, sy, (pu.r || 30) * (1 + k * 0.5), (pu.r || 30) * 0.62 * (1 + k * 0.5), 0, 0, Math.PI * 2); x.stroke();
    x.restore();
  }
  if (ms.respawn) {
    const r = ms.respawn, [ax, ay] = view.project(r.from[0], r.from[1]), [bx, by] = view.project(r.to[0], r.to[1]);
    x.save(); x.strokeStyle = '#ffb84d'; x.lineWidth = 2.5; x.setLineDash([6, 6]); x.lineDashOffset = -now * 0.02;
    const mx = (ax + bx) / 2, my = Math.min(ay, by) - 60;
    x.beginPath(); x.moveTo(ax, ay - 18); x.quadraticCurveTo(mx, my, bx, by - 50); x.stroke();
    x.restore();
  }
}

root.Overlays = { routePath, staticThreats, staticMarkers, drawDynamic, pill, screenPts, lengths, at, stroke };
})(globalThis);
