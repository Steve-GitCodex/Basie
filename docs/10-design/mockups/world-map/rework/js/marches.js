(function (root) {
'use strict';
const { I, NEW } = root.Chrome;

const RATE = 0.012;
const ITEMS = [[50, '+50% march speed', 3, 120], [100, '+100% march speed', 1, 250]];
const fmt = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`; };

class LiveMarch {
  constructor(W, spec, now) {
    Object.assign(this, { spec, id: spec.id || spec.chain.join('>'), t0: now });
    this.path = Overlays.routePath(W, spec.chain);
    let len = 0;
    for (let i = 1; i < this.path.length; i++) len += Math.hypot(this.path[i][0] - this.path[i - 1][0], this.path[i][1] - this.path[i - 1][1]);
    this.total = spec.totalSec || len * 16;
    this.p0 = spec.progress ?? 0.12;
    this.speed = spec.speed || 1;
    this.boosted = spec.boosted || 0;
    this.phase = spec.phase || 'outbound';
  }
  p(now) {
    if (this.spec.noMover) return 1;
    if (this.spec.still) return this.p0;
    const d = RATE * this.speed * (now - this.t0) / 1000;
    return this.phase === 'outbound' ? Math.min(0.97, this.p0 + d) : Math.max(0.03, this.p0 - d);
  }
  remain(now) { const p = this.p(now); return (this.phase === 'outbound' ? 1 - p : p) * this.total / this.speed; }
  boost(pct, now) { this.p0 = this.p(now); this.t0 = now; this.speed = Math.max(this.speed, 1 + pct / 100); this.boosted = Math.max(this.boosted, pct); }
  recall(now) { this.p0 = this.p(now); this.t0 = now; this.phase = 'returning'; }
}

function sync(view, specs, key, now) {
  if (view.liveKey === key) return;
  view.liveKey = key;
  view.live = (specs || []).map(s => new LiveMarch(view.W, s, now));
}

function routeSlice(sp, L, a, b) {
  const tot = L[L.length - 1], out = [Overlays.at(sp, L, a)];
  for (let i = 0; i < sp.length; i++) if (L[i] > a * tot && L[i] < b * tot) out.push(sp[i]);
  out.push(Overlays.at(sp, L, b));
  return out;
}

function arrow(x, p, color) {
  x.save(); x.fillStyle = color; x.translate(p[0], p[1]); x.rotate(p[2]);
  x.beginPath(); x.moveTo(7, 0); x.lineTo(-6, -6); x.lineTo(-6, 6); x.closePath(); x.fill(); x.restore();
}

function drawRoute(x, m, sp, L, p, now) {
  const col = m.spec.color, back = m.phase === 'returning';
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
  if (!back && p > 0.01 && !m.spec.noMover) { x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; Overlays.stroke(x, routeSlice(sp, L, 0, p)); }
  const live = back ? routeSlice(sp, L, 0, p).reverse() : routeSlice(sp, L, m.spec.noMover ? 0 : p, 1);
  x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 7; Overlays.stroke(x, live);
  x.strokeStyle = col; x.lineWidth = 3.4; x.setLineDash(m.spec.dotted ? [2, 7] : [10, 7]); x.lineDashOffset = -now * 0.025 * m.speed; Overlays.stroke(x, live);
  x.restore();
  const end = live[live.length - 1], prev = live[Math.max(0, live.length - 3)];
  arrow(x, [end[0], end[1], Math.atan2(end[1] - prev[1], end[0] - prev[0])], col);
}

function drawToken(x, m, pos, now) {
  const col = m.spec.color;
  x.save();
  x.fillStyle = col; x.globalAlpha = 0.25;
  x.beginPath(); x.arc(pos[0], pos[1], 13 + 3 * Math.sin(now / (300 / m.speed)), 0, Math.PI * 2); x.fill();
  x.globalAlpha = 1; x.fillStyle = 'hsl(30,12%,10%)'; x.strokeStyle = col; x.lineWidth = 2.6;
  if (m.phase === 'returning') x.setLineDash([3, 2]);
  x.beginPath(); x.arc(pos[0], pos[1], 9, 0, Math.PI * 2); x.fill(); x.stroke();
  x.setLineDash([]);
  const im = Sprites.icon('sword');
  if (im) x.drawImage(im, pos[0] - 5.5, pos[1] - 5.5, 11, 11);
  x.restore();
}

function drawPill(x, m, pos, now) {
  const txt = `${m.spec.squad || 'Squad 1'} · ${fmt(m.remain(now))}`;
  x.save();
  x.font = '800 9.5px Outfit, sans-serif';
  const bw = m.boosted ? x.measureText(`+${m.boosted}%`).width + 8 : 0;
  const w = x.measureText(txt).width + 12 + bw, h = 15, x0 = pos[0] - w / 2, y0 = pos[1] - 30;
  x.fillStyle = 'hsla(20,20%,6%,0.94)'; x.strokeStyle = m.boosted ? '#ffb84d' : m.spec.color; x.lineWidth = 1.2;
  x.beginPath(); x.roundRect(x0, y0, w, h, 7.5); x.fill(); x.stroke();
  x.fillStyle = m.spec.color; x.textBaseline = 'middle'; x.textAlign = 'left';
  x.fillText(txt, x0 + 6, y0 + h / 2 + 0.5);
  if (m.boosted) { x.fillStyle = '#ffb84d'; x.fillText(`+${m.boosted}%`, x0 + w - bw - 1, y0 + h / 2 + 0.5); }
  x.restore();
}

function drawCursor(x, pos) {
  const cx = pos[0] + 8, cy = pos[1] + 6;
  x.save(); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1.3;
  x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, cy + 17); x.lineTo(cx + 4.5, cy + 13); x.lineTo(cx + 8, cy + 20); x.lineTo(cx + 10.5, cy + 19); x.lineTo(cx + 7, cy + 12); x.lineTo(cx + 12.5, cy + 12); x.closePath(); x.fill(); x.stroke();
  x.restore();
}

function each(view, now, fn) {
  for (const m of view.live || []) {
    const sp = Overlays.screenPts(view, m.path);
    if (sp.length < 2) continue;
    fn(m, sp, Overlays.lengths(sp), m.p(now), view.hoverMarch === m.id || view.selMarch === m.id || m.spec.hover);
  }
}

function drawRoutes(view, x, now) {
  each(view, now, (m, sp, L, p, hot) => { if (m.spec.route === 'always' || hot || m.spec.noMover) drawRoute(x, m, sp, L, p, now); });
}

function draw(view, x, now) {
  each(view, now, (m, sp, L, p, hot) => {
    if (m.spec.noMover) { m.screen = null; return; }
    const pos = Overlays.at(sp, L, p);
    m.screen = pos;
    drawToken(x, m, pos, now);
    if (m.spec.pill || hot) drawPill(x, m, pos, now);
    if (m.spec.cursor) drawCursor(x, pos);
  });
}

function hit(view, sx, sy) {
  for (const m of view.live || []) if (m.screen && !m.spec.hostile && Math.hypot(m.screen[0] - sx, m.screen[1] - sy) < 16) return m.id;
  return null;
}

function popupHtml(view, m, now, picker) {
  const spec = m.spec, back = m.phase === 'returning';
  const pickerHtml = picker ? `<div class="mp__pick is-new"><div class="sect__h">March speed-ups</div>
    ${ITEMS.map(([pct, n, own, price]) => `<div class="mp__item">${I('lightning', 'width:14px;height:14px;color:#ffb84d')}<span><b>${n}</b><small>owned ${own} · or ${price} ${I('diamond', 'width:10px;height:10px;color:#e0883a')}</small></span>
      <button data-act="mboost:${m.id}:${pct}">Use</button></div>`).join('')}
    <div class="mp__hint">Only march speed-ups apply; build, train and research speed-ups don't.</div></div>` : '';
  return `<div class="acard mp" id="mpop" style="--c:${spec.color};width:272px"><div class="acard__arrow acard__arrow--left" id="mpArrow" style="top:40px"></div>
    <div class="ctag"><span class="tag tag--new">NEW</span></div><div class="acard__stripe"></div>
    <div class="acard__head"><span class="acard__icon">${I('sword')}</span><div><h3>${spec.squad || 'Squad 1'}</h3><div class="acard__sub">${spec.power || '2.6k power'} · 3 heroes</div></div>
    <button class="acard__x" data-act="mclose">${I('x-circle', 'width:18px;height:18px')}</button></div>
    <div class="acard__body">
      <div class="kv"><span>Type</span><b>${spec.type || 'Attack'}</b></div>
      <div class="kv"><span>Target</span><b>${spec.target}</b></div>
      <div class="kv"><span>Phase</span><b id="mpPhase">${back ? 'Returning home' : 'Outbound'}</b></div>
      <div class="kv"><span>ETA</span><b><span id="mpEta">${fmt(m.remain(now))}</span>${m.boosted ? ` <span class="band band--a">+${m.boosted}%</span>` : ''}</b></div>
      <div class="kv"><span>Carried load</span><b>${spec.load || 'none yet · loot on a win'}</b></div>
      <div class="mp__bar"><i id="mpBar" style="width:${Math.round(m.p(now) * 100)}%"></i></div>
      <div class="mp__ends"><span>${spec.origin || 'Home Refuge'}</span><span>${spec.targetShort || spec.target}</span></div>
      ${back ? '<div class="why" style="--c:var(--you)"><b>Recalled.</b> Turned around where it stood; it returns along the same road. Recall was free while outbound.</div>' : ''}
    </div>
    <div class="acard__actions"><button data-act="mspeed:${m.id}" class="mp__act">${I('lightning', 'width:13px;height:13px')} Speed up ${NEW}</button>
      ${back ? '' : `<button data-act="mrecall:${m.id}" class="mp__act">${I('base', 'width:13px;height:13px')} Recall ${NEW}</button>`}</div>${pickerHtml}</div>`;
}

function placePopup(el, m, frameW = 1280) {
  if (!m.screen) return;
  const w = el.offsetWidth, h = el.offsetHeight, [sx, sy] = m.screen;
  const right = sx + 60 + w < frameW - 50;
  const left = right ? sx + 60 : sx - 60 - w, top = Math.max(58, Math.min(800 - h - 80, sy - 60));
  el.style.left = left + 'px'; el.style.top = top + 'px';
  const ar = el.querySelector('#mpArrow');
  ar.className = `acard__arrow acard__arrow--${right ? 'left' : 'right'}`;
  ar.style.top = Math.max(14, Math.min(h - 24, sy - top - 7)) + 'px';
}

function updatePopup(view, now) {
  const el = document.getElementById('mpop'), m = (view.live || []).find(k => k.id === view.selMarch);
  if (!el || !m) return;
  const last = el._at, [sx, sy] = m.screen || [0, 0];
  if (!el.matches(':hover') && (!last || Math.hypot(last[0] - sx, last[1] - sy) > 24)) { placePopup(el, m); if (m.screen) el._at = [sx, sy]; }
  const e = document.getElementById('mpEta'); if (e) e.textContent = fmt(m.remain(now));
  const b = document.getElementById('mpBar'); if (b) b.style.width = Math.round(m.p(now) * 100) + '%';
}

function updatePanel(view, now) {
  for (const r of view.live || []) {
    const t = document.getElementById(`wmT-${r.id}`); if (t) t.textContent = fmt(r.remain(now));
    const bar = document.getElementById(`wmB-${r.id}`); if (bar) bar.style.width = Math.round((r.phase === 'returning' ? 1 - r.p(now) : r.p(now)) * 100) + '%';
  }
}

root.Marches = { sync, draw, drawRoutes, hit, popupHtml, placePopup, updatePopup, updatePanel, fmt, LiveMarch };
})(globalThis);
