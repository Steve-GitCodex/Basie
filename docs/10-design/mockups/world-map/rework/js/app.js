(function (root) {
'use strict';
const $ = id => document.getElementById(id);
const { I } = Chrome;
const BAND_Z = { far: 0.143, mid: 0.34, near: 0.75 };
const HUD_RECTS = [
  { x0: 0, y0: 0, x1: 1280, y1: 50 }, { x0: 8, y0: 56, x1: 238, y1: 190 }, { x0: 1084, y0: 560, x1: 1272, y1: 726 },
  { x0: 8, y0: 600, x1: 60, y1: 800 }, { x0: 515, y0: 728, x1: 765, y1: 800 }, { x0: 1210, y0: 730, x1: 1280, y1: 800 }, { x0: 1240, y0: 350, x1: 1280, y1: 432 },
];

let W, view, phoneView, STEPS, idx = 0, mode = 'guided', offScript = false, scale = 1;
let cur = null;
let exploreFog = true, exploreCard = null, liveNonce = 0, marchUi = { sel: null, picker: false };
const liveOf = id => (view.live || []).find(m => m.id === id);

function rectOfProvs(ids, cam) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id of ids) {
    const b = view.shapes[id].box, v = view.view(cam);
    x0 = Math.min(x0, b.x0 * v.z + v.ox); x1 = Math.max(x1, b.x1 * v.z + v.ox); y0 = Math.min(y0, b.y0 * v.z + v.oy); y1 = Math.max(y1, b.y1 * v.z + v.oy);
  }
  return [x0, y0, x1 - x0, y1 - y0];
}
function rectOfRoute(chain, cam) {
  const pts = Overlays.routePath(W, chain).map(p => view.project(p[0], p[1], cam));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}
function frameRect(el) {
  const f = $('frame').getBoundingClientRect(), r = el.getBoundingClientRect();
  return [(r.left - f.left) / scale, (r.top - f.top) / scale, r.width / scale, r.height / scale];
}
const poiById = id => id.startsWith('main-') ? W.byId[id.slice(5)].main : W.pois.find(o => o.id === id);

function tagRects(step, cam) {
  return (step.tags || []).map(t => {
    const [px, py] = view.project(t.at[0], t.at[1], cam), sx = px + (t.dx || 0), sy = py;
    const w = t.text.length * 6.3 + 52;
    return { t, sx, sy: sy + (t.dy || 0), rect: { x0: sx - w / 2, x1: sx + w / 2, y0: sy + (t.dy || 0) - 11, y1: sy + (t.dy || 0) + 11 } };
  });
}

function cardFor(spec, ms) {
  if (!spec) return null;
  if (spec.prov) return Cards.provinceCard(W, ms, spec.prov, { why: spec.why });
  const poi = poiById(spec.poi);
  const c = Cards.poiCard(W, ms, spec.moved ? { ...poi, at: ms.campMoves[poi.id] } : poi);
  if (spec.moved) c.body += `<div class="why" style="--c:#e05a3d"><b>Respawned elsewhere.</b> Beaten at its old slot, it came back at a free slot in ${W.byId[poi.prov].name} at the province band.</div>`;
  return c;
}

function stepCam(step) { return view.camFor(step.cam); }

function render(animate = true) {
  const step = STEPS[idx];
  const camSpec = mode === 'explore' ? null : step.cam;
  const cam = camSpec ? view.camFor(camSpec) : view.cam;
  const mapSpec = Object.assign({}, step.map);
  if (mode === 'explore' && !exploreFog) mapSpec.fog = false;
  if (mode === 'explore') { delete mapSpec.pulses; mapSpec.marches = (mapSpec.marches || []).map(m => m.hostile ? m : { ...m, hover: false, cursor: false, pill: false }); }
  const ui = Object.assign({}, step.ui || {});
  if (mode === 'explore') { delete ui.toasts; delete ui.title; }
  const tags = mode === 'guided' ? tagRects(step, cam) : [];
  const cardSpec = mode === 'explore' ? exploreCard : step.card;
  const pre = Steps.derive(W, mapSpec);
  const card = cardFor(cardSpec, pre);
  let cardPos = null, anchor = null;
  if (card) {
    anchor = view.project(card.at[0], card.at[1], cam);
    anchor[1] -= 18;
    cardPos = Cards.placeCard(anchor[0], anchor[1], 300, 300, cardSpec.side);
  }
  const reserved = tags.map(t => t.rect);
  const hud = HUD_RECTS.slice();
  if (ui.ladder) hud.push({ x0: 8, y0: 140, x1: 252, y1: 560 });
  if (cardPos) hud.push({ x0: cardPos.left - 8, y0: cardPos.top - 8, x1: cardPos.left + cardPos.w + 8, y1: cardPos.top + 320 });
  if (ui.title || ui.banner) hud.push({ x0: 380, y0: 50, x1: 900, y1: 135 });
  if (ui.toasts) hud.push({ x0: 920, y0: 54, x1: 1240, y1: 150 });
  cur = Object.assign(pre, { reserved, hud });
  view.setState(cur);
  const nowT = performance.now();
  Marches.sync(view, cur.marches, `${mode}:${liveNonce}`, nowT);
  view.selMarch = liveOf(marchUi.sel) ? marchUi.sel : null;
  ui.marches = (ui.marches || []).map(r => { const lm = r.id && liveOf(r.id); return lm ? { ...r, returning: lm.phase === 'returning', status: lm.phase === 'returning' ? 'Returning' : r.status, time: Marches.fmt(lm.remain(nowT)) } : r; });
  if (camSpec) view.setCamera(cam, animate ? 850 : 0);
  const band = view.band(cam.z);
  $('hud').innerHTML = Chrome.hud(ui, band) + (ui.ladder ? Panels.ladder() : '');
  if (ui.ladder) Panels.paintLadder(W);
  $('layer').innerHTML = (card ? Cards.cardHtml(card, cardPos) : '') + (view.selMarch ? Marches.popupHtml(view, liveOf(view.selMarch), nowT, marchUi.picker) : '');
  if (card) { const el = $('card'), p = Cards.placeCard(anchor[0], anchor[1], 300, el.offsetHeight, cardSpec.side); el.style.top = p.top + 'px'; el.querySelector('.acard__arrow').style.top = p.arrow + 'px'; }
  $('maptags').innerHTML = tags.map(({ t, sx, sy }) => `<div class="mtag ${t.kind === 'imp' ? 'mtag--imp' : ''}" style="left:${sx}px;top:${sy}px">${t.kind === 'imp' ? Chrome.IMP : Chrome.NEW}${t.text}</div>`).join('');
  renderOverlay(step);
  document.body.classList.toggle('off-script', offScript);
  setSettling(animate && !!camSpec);
  renderCaption(); renderExplore();
  placeSpot(step, cam);
}

let settleTimer = 0;
function setSettling(on) {
  const els = [$('maptags'), $('layer'), $('rings')];
  els.forEach(e => { e.style.transition = 'opacity .25s'; e.style.opacity = on ? 0 : 1; });
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => { els.forEach(e => { e.style.opacity = 1; }); if (mode === 'guided' && STEPS[idx].spot && STEPS[idx].spot.sel) placeSpot(STEPS[idx], view.cam); fitRingChips(); }, on ? 960 : 80);
}

function renderOverlay(step) {
  const o = mode === 'guided' ? step.overlay : null;
  if (o === 'was') $('overlay').innerHTML = Panels.wasOverlay();
  else if (o === 'summary') $('overlay').innerHTML = '<div class="shade"></div>' + Panels.summary();
  else if (o === 'phone') { $('overlay').innerHTML = Panels.phone(Cards.etaFor(W, ['home-seat', 'home-B'])); startPhone(step); }
  else $('overlay').innerHTML = '';
  if (o !== 'phone') phoneView = null;
}

function startPhone(step) {
  const cv = $('phoneMap');
  phoneView = new MapView(cv, W, view.terrain, view.shapes);
  phoneView.resize(390, 844);
  const ms = Steps.derive(W, step.map);
  ms.hud = [{ x0: 0, y0: 0, x1: 390, y1: 130 }, { x0: 0, y0: 750, x1: 390, y1: 844 }, { x0: 0, y0: 700, x1: 60, y1: 844 }, { x0: 330, y0: 700, x1: 390, y1: 844 }];
  ms.reserved = [];
  phoneView.setState(ms);
  Marches.sync(phoneView, ms.marches, `phone:${liveNonce}`, performance.now());
  phoneView.setCamera(phoneView.camFor(step.cam), 0);
}

function fitRingChips() {
  const taken = (view.placed || []).concat(HUD_RECTS);
  document.querySelectorAll('#rings .ring').forEach(ring => {
    const b = ring.querySelector('b');
    if (!b) return;
    const [rx, ry, rw, rh] = frameRect(ring), w = b.offsetWidth / 1, h = b.offsetHeight;
    const cx = rx + rw / 2, cy = ry + rh / 2;
    const opts = [[cx - w / 2, ry + rh - h / 2], [cx - w / 2, ry - h / 2], [rx + rw - 8, cy - h / 2], [rx - w + 8, cy - h / 2], [rx + rw - 4, ry + rh - h], [rx - w + 4, ry + rh - h], [cx - w / 2, ry + rh + 8], [cx - w / 2, ry - h - 8]];
    const cost = o => taken.reduce((s, t) => s + Math.max(0, Math.min(o[0] + w, t.x1) - Math.max(o[0], t.x0)) * Math.max(0, Math.min(o[1] + h, t.y1) - Math.max(o[1], t.y0)), 0);
    const pick = opts.reduce((best, o) => cost(o) < cost(best) ? o : best, opts[0]);
    Object.assign(b.style, { left: (pick[0] - rx) + 'px', top: (pick[1] - ry) + 'px', transform: 'none' });
    taken.push({ x0: pick[0], y0: pick[1], x1: pick[0] + w, y1: pick[1] + h });
  });
}

function ringGeom(step, cam) {
  const out = [];
  for (const [id, label] of step.rings || []) {
    const p = W.byId[id], [sx, sy] = view.project(p.seed[0], p.seed[1], cam);
    const r = Math.max(26, p.tierInfo.footprint * 32 * cam.z * 2.3);
    out.push({ x: sx, y: sy - r * 0.35, r, label });
  }
  for (const [id, label] of step.poiRings || []) {
    const poi = poiById(id), [sx, sy] = view.project(poi.at[0], poi.at[1], cam);
    const main = id.startsWith('main-'), r = main ? 62 : 26;
    out.push({ x: sx, y: main ? sy - 30 : sy - 22, r, label });
  }
  for (const g of out) {
    const w = (g.label || '').length * 6.4 + 18;
    g.chip = g.label ? { x0: g.x - w / 2, x1: g.x + w / 2, y0: g.y + g.r + 2, y1: g.y + g.r + 24 } : null;
  }
  return out;
}

function placeSpot(step, cam) {
  const spot = $('spot');
  $('rings').innerHTML = '';
  if (mode !== 'guided' || offScript) { spot.style.display = 'none'; return; }
  const ring = (x, y, r, label) => `<div class="ring" style="left:${x - r}px;top:${y - r}px;width:${r * 2}px;height:${r * 2}px"><i></i>${label ? `<b>${label}</b>` : ''}</div>`;
  let html = ringGeom(step, cam).map(g => ring(g.x, g.y, g.r, g.label)).join('');
  if (step.ringSel) { const el = document.querySelector(step.ringSel[0]); if (el) { const [x, y, w, h] = frameRect(el); const r = Math.max(w, h) / 2 + 10; html += ring(x + w / 2, y + h / 2, r, ''); } }
  $('rings').innerHTML = html;
  const s = step.spot;
  if (!s) { spot.style.display = 'none'; return; }
  let r = null;
  if (s.provs) r = rectOfProvs(s.provs, cam);
  if (s.route) r = rectOfRoute(s.route, cam);
  if (s.sel) { const el = document.querySelector(s.sel); if (el) r = frameRect(el); }
  if (r && s.poi) { const p = W.byId[s.poi], [sx, sy] = view.project(p.seed[0], p.seed[1], cam); const x1 = Math.min(r[0], sx - 70), y1 = Math.min(r[1], sy - 90), x2 = Math.max(r[0] + r[2], sx + 70), y2 = Math.max(r[1] + r[3], sy + 40); r = [x1, y1, x2 - x1, y2 - y1]; }
  if (r && s.march) { const m = liveOf(s.march); if (m && m.screen) { const [sx, sy] = m.screen; const x1 = Math.min(r[0], sx - 70), y1 = Math.min(r[1], sy - 40), x2 = Math.max(r[0] + r[2], sx + 20), y2 = Math.max(r[1] + r[3], sy + 20); r = [x1, y1, x2 - x1, y2 - y1]; } }
  if (!r) { spot.style.display = 'none'; return; }
  const pad = s.pad ?? 8;
  r = [r[0] - pad, r[1] - pad, r[2] + pad * 2, r[3] + pad * 2];
  r[0] = Math.max(4, r[0]); r[1] = Math.max(4, r[1]); r[2] = Math.min(1276 - r[0], r[2]); r[3] = Math.min(796 - r[1], r[3]);
  Object.assign(spot.style, { display: 'block', left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px' });
}

function renderCaption() {
  const st = STEPS[idx];
  const was = (st.was || []).map(([k, t]) => `<div class="was"><span class="tag ${k === 'NEW' ? 'tag--new' : 'tag--imp'}">${k}</span><span>${t}</span></div>`).join('');
  $('caption').innerHTML = `<div class="caption__meta"><b>Step ${idx + 1} of ${STEPS.length} · ${st.tag}</b><div class="prog">${STEPS.map((_, i) => `<i class="${i < idx ? 'done' : i === idx ? 'on' : ''}" data-go="${i}" title="Step ${i + 1}: ${STEPS[i].title}"></i>`).join('')}</div></div>
    <h2>${st.title}</h2><p>${st.text}</p>${was}${offScript ? '<div class="off">You clicked off-script. Next or Back returns to the story.</div>' : ''}
    <div class="nav"><div class="row"><button class="btn btn--ghost" id="bwd" ${idx === 0 ? 'disabled' : ''}>Back</button><button class="btn" id="fwd" ${idx === STEPS.length - 1 ? 'disabled' : ''}>Next</button></div><small>or use ← → keys</small></div>`;
}
function renderExplore() {
  const band = view.band();
  $('explore').innerHTML = `<b>Explore</b><span>Zoom</span>${['far', 'mid', 'near'].map(b => `<button class="chip ${b === band ? 'on' : ''}" data-band="${b}">${b[0].toUpperCase() + b.slice(1)}</button>`).join('')}
    <span class="sep"></span><span>Fog</span><button class="chip ${exploreFog ? 'on' : ''}" data-fog="1">On</button><button class="chip ${exploreFog ? '' : 'on'}" data-fog="0">Off</button>
    <span class="sep"></span><button class="chip" data-reset="1">Reset view</button>
    <span style="margin-left:auto">Drag to pan · wheel to zoom · click a province or POI · state from step ${idx + 1}</span>`;
}

function resetMarchUi() { const st = STEPS[idx]; liveNonce++; marchUi = { sel: mode === 'guided' ? st.marchSel || null : null, picker: mode === 'guided' && !!st.picker }; }
function goStep(i) { idx = Math.max(0, Math.min(STEPS.length - 1, i)); offScript = false; exploreCard = null; resetMarchUi(); render(true); }
function setMode(m) {
  mode = m; document.body.classList.toggle('is-explore', m === 'explore');
  $('mGuided').classList.toggle('on', m === 'guided'); $('mExplore').classList.toggle('on', m === 'explore');
  exploreCard = null; offScript = false; resetMarchUi();
  fit();
  if (m === 'explore' && STEPS[idx].overlay) view.setCamera(view.camFor(Steps.FAR), 0);
  render(m === 'guided');
}

function openTarget(hit) {
  if (!hit) return false;
  if (hit.type === 'main' || hit.type === 'prov') exploreCard = { prov: hit.id };
  else if (hit.type === 'poi') exploreCard = { poi: hit.id };
  else return false;
  return true;
}

function setBand(b) {
  const c = view.cam;
  view.setCamera({ x: c.x, y: c.y, z: BAND_Z[b] }, 500);
  exploreCard = null;
  setTimeout(() => render(false), 520);
}

function act(a) {
  const [k, v] = a.split(':');
  if (k === 'close') { exploreCard = null; return true; }
  const nowT = performance.now(), lm = liveOf(v);
  if (k === 'mclose') { marchUi = { sel: null, picker: false }; return true; }
  if (k === 'msel' && lm) { marchUi = { sel: v, picker: false }; exploreCard = null; return true; }
  if (k === 'mspeed' && lm) { marchUi = { sel: v, picker: !(marchUi.sel === v && marchUi.picker) }; exploreCard = null; return true; }
  if (k === 'mboost' && lm) { lm.boost(+a.split(':')[2], nowT); marchUi = { sel: v, picker: false }; return true; }
  if (k === 'mrecall' && lm) { lm.recall(nowT); marchUi = { sel: v, picker: false }; return true; }
  if (k === 'band') { if (mode === 'explore') { setBand(v); return false; } return false; }
  if (k === 'march' && mode === 'explore') {
    const r = Cards.routeTo(W, cur, v);
    if (r) { STEPS[idx].map = Object.assign({}, STEPS[idx].map, { marches: [{ id: 'sqx', squad: 'Squad 1', type: 'Attack', target: W.byId[v].name, targetShort: W.byId[v].name, origin: r.origin, chain: r.chain, color: '#3ad17a', progress: 0.05 }] }); STEPS[idx].ui = Object.assign({}, STEPS[idx].ui, { marches: [{ id: 'sqx', name: `Squad 1 → ${W.byId[v].name}`, status: 'Marching', pct: 5, time: r.eta, icon: 'sword', actions: true }] }); liveNonce++; marchUi = { sel: null, picker: false }; }
    exploreCard = null; return true;
  }
  if (k === 'focus' && mode === 'explore') { exploreCard = { prov: v }; return true; }
  return false;
}

function bindInput() {
  const cv = $('map');
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cam: { ...view.cam }, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!drag) {
      const f = $('frame').getBoundingClientRect(), h = Marches.hit(view, (e.clientX - f.left) / scale, (e.clientY - f.top) / scale);
      view.hoverMarch = h; cv.style.cursor = h ? 'pointer' : '';
      return;
    }
    if (mode !== 'explore') return;
    const dx = (e.clientX - drag.x) / scale, dy = (e.clientY - drag.y) / scale;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    cv.classList.add('drag');
    view.cam = { x: drag.cam.x - dx / view.cam.z, y: drag.cam.y - dy / view.cam.z, z: view.cam.z };
    view.clampCam(); view.dirty = true;
    if (exploreCard) { exploreCard = null; $('layer').innerHTML = ''; }
  });
  cv.addEventListener('pointerup', e => {
    cv.classList.remove('drag');
    const d = drag; drag = null;
    if (!d || d.moved) { if (d && d.moved) renderExplore(); return; }
    const f = $('frame').getBoundingClientRect();
    const mh = Marches.hit(view, (e.clientX - f.left) / scale, (e.clientY - f.top) / scale);
    if (mh) { act(`msel:${mh}`); if (mode === 'guided') offScript = true; return render(false); }
    const hit = view.hitTest((e.clientX - f.left) / scale, (e.clientY - f.top) / scale);
    if (openTarget(hit)) { if (mode === 'guided') offScript = true; render(false); }
  });
  cv.addEventListener('wheel', e => {
    if (mode !== 'explore') return;
    e.preventDefault();
    const f = $('frame').getBoundingClientRect(), sx = (e.clientX - f.left) / scale, sy = (e.clientY - f.top) / scale;
    const v = view.view(), wx = (sx - v.ox) / v.z, wy = (sy - v.oy) / v.z;
    const z = Math.max(0.1, Math.min(1.3, view.cam.z * Math.exp(-e.deltaY * 0.0015)));
    view.cam = { z, x: wx - (sx - view.w / 2) / z, y: wy - (sy - view.h / 2) / z };
    view.clampCam(); view.dirty = true;
    exploreCard = null;
    clearTimeout(view._wheelT); view._wheelT = setTimeout(() => render(false), 160);
  }, { passive: false });
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]'); if (go) return goStep(+go.dataset.go);
    if (e.target.closest('#fwd')) return goStep(idx + 1);
    if (e.target.closest('#bwd')) return goStep(idx - 1);
    const b = e.target.closest('[data-band]'); if (b) return setBand(b.dataset.band);
    const fg = e.target.closest('[data-fog]'); if (fg) { exploreFog = fg.dataset.fog === '1'; return render(false); }
    if (e.target.closest('[data-reset]')) { view.setCamera(view.camFor(Steps.FAR), 500); exploreCard = null; return setTimeout(() => render(false), 520); }
    const el = e.target.closest('[data-act]');
    if (!el || !$('frame').contains(el)) return;
    if (act(el.dataset.act)) { if (mode === 'guided') offScript = true; render(false); }
  });
  document.addEventListener('keydown', e => {
    if (mode !== 'guided') return;
    if (e.key === 'ArrowRight') goStep(idx + 1);
    if (e.key === 'ArrowLeft') goStep(idx - 1);
  });
  $('mGuided').onclick = () => setMode('guided');
  $('mExplore').onclick = () => setMode('explore');
}

function fit() {
  const top = document.querySelector('.top').offsetHeight;
  const cap = mode === 'guided' ? 188 : $('explore').offsetHeight + 10;
  const availH = window.innerHeight - top - cap - 16, availW = window.innerWidth - 32;
  scale = Math.min(availW / 1280, availH / 800, 1.25);
  $('frame').style.transform = `scale(${scale})`;
  $('wrap').style.width = 1280 * scale + 'px';
  $('wrap').style.height = 800 * scale + 'px';
}

async function boot() {
  Chrome.injectIcons();
  W = WG.generate();
  W.QUARTER_NAME = { home: 'your quarter', red: 'Red Talon quarter', cov: 'Iron Covenant quarter', scav: 'Scavenger quarter' };
  await Sprites.load();
  if (document.fonts) await document.fonts.ready;
  const terrain = new Terrain(W);
  view = new MapView($('map'), W, terrain, MapLayers.buildShapes(W));
  view.resize(1280, 800);
  STEPS = Steps.buildSteps(W);
  bindInput();
  window.addEventListener('resize', () => { fit(); placeSpot(STEPS[idx], mode === 'guided' ? view.camFor(STEPS[idx].cam) : view.cam); });
  fit();
  const start = +(new URLSearchParams(location.search).get('step') || 1) - 1;
  idx = Math.max(0, Math.min(STEPS.length - 1, start));
  resetMarchUi();
  render(false);
  const loop = now => {
    view.tick(now);
    Marches.updatePopup(view, now); Marches.updatePanel(view, now);
    if (phoneView) phoneView.tick(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  root.__proto = { goStep, setMode, get idx() { return idx; }, steps: () => STEPS.length, view: () => view, W: () => W, act, openTarget, render };
  root.__ready = true;
}

boot();
})(globalThis);
