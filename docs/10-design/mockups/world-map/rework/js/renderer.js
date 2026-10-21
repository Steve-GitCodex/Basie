(function (root) {
'use strict';

const BANDS = { far: 0.22, mid: 0.5 };
const NAME_SIZE = { 0: 15, 1: 12, 2: 12.5, 3: 13.5, 4: 14.5, 5: 17 };
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const shrink = (r, k) => { const dx = (r.x1 - r.x0) * k / 2, dy = (r.y1 - r.y0) * k / 2; return { x0: r.x0 + dx, x1: r.x1 - dx, y0: r.y0 + dy * 1.4, y1: r.y1 - dy * 0.3 }; };
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

class MapView {
  constructor(canvas, W, terrain, shapes, opts = {}) {
    Object.assign(this, { cv: canvas, ctx: canvas.getContext('2d'), W, terrain, shapes, opts });
    this.st = document.createElement('canvas');
    this.cam = { x: 0, y: 2300, z: 0.145 };
    this.anim = null; this.ms = null; this.dirty = true; this.hits = []; this.labels = [];
    this.measure = {};
    for (const p of W.P) {
      const sc = Sprites.canvas(4, 4).getContext('2d');
      const bb = PoiArt.drawMain(sc, p, 0, 0, 1, {});
      this.measure[p.id] = bb;
    }
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.cv.width = w; this.cv.height = h; this.st.width = w; this.st.height = h;
    this.dirty = true;
  }

  view(cam = this.cam) { const z = cam.z; return { z, ox: this.w / 2 - cam.x * z, oy: this.h / 2 - cam.y * z, w: this.w, h: this.h, W: this.W }; }
  project(gx, gy, cam) { const v = this.view(cam); const [wx, wy] = Iso.toWorld(gx, gy); return [wx * v.z + v.ox, wy * v.z + v.oy]; }
  unproject(sx, sy) { const v = this.view(); return Iso.toGrid((sx - v.ox) / v.z, (sy - v.oy) / v.z); }
  band(z = this.cam.z) { return this.ms && this.ms.band ? this.ms.band : z < BANDS.far ? 'far' : z < BANDS.mid ? 'mid' : 'near'; }

  camFor(spec) {
    const at = typeof spec.at === 'string' ? this.W.byId[spec.at].seed : spec.at;
    const [wx, wy] = Iso.toWorld(at[0], at[1]);
    return { x: wx + (spec.dx || 0), y: wy + (spec.dy || 0), z: spec.z };
  }
  setCamera(cam, ms = 700) {
    if (!ms) { this.cam = { ...cam }; this.anim = null; this.dirty = true; return; }
    this.anim = { from: { ...this.cam }, to: { ...cam }, t0: performance.now(), ms };
  }
  clampCam() {
    const c = this.cam, N = this.W.N;
    c.z = Math.max(0.1, Math.min(1.3, c.z));
    let [gx, gy] = Iso.toGrid(c.x, c.y);
    gx = Math.max(2, Math.min(N - 2, gx)); gy = Math.max(2, Math.min(N - 2, gy));
    [c.x, c.y] = Iso.toWorld(gx, gy);
  }
  setState(ms) { this.ms = ms; this.terrain.setFog(ms.fogged); this.dirty = true; }

  tick(now) {
    if (this.anim) {
      const k = Math.min(1, (now - this.anim.t0) / this.anim.ms), e = ease(k), a = this.anim.from, b = this.anim.to;
      const lz = Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * e;
      this.cam = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z: Math.exp(lz) };
      this.dirty = true;
      if (k >= 1) this.anim = null;
    }
    if (this.dirty) this.drawStatic(!this.anim);
    const x = this.ctx;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(this.st, 0, 0);
    if (this.ms) { Overlays.drawDynamic(this, x, now); Marches.drawRoutes(this, x, now); for (const l of this.labels) l.draw(x, l.dx || 0, l.dy || 0); Marches.draw(this, x, now); }
  }

  drawStatic(settled) {
    const x = this.st.getContext('2d'), v = this.view();
    x.setTransform(1, 0, 0, 1, 0, 0);
    const g = x.createRadialGradient(this.w / 2, this.h * 0.55, 50, this.w / 2, this.h * 0.55, Math.max(this.w, this.h) * 0.8);
    g.addColorStop(0, '#2a2119'); g.addColorStop(1, '#0c0a08');
    x.fillStyle = g; x.fillRect(0, 0, this.w, this.h);
    const complete = this.drawTerrain(x, v, settled);
    this.dirty = !complete;
    if (!this.ms) return;
    MapLayers.drawProvinces(x, v, this.shapes, this.ms);
    this.placeAndDraw(x, v);
  }

  drawTerrain(x, v, settled) {
    const want = v.z <= 0.25 ? 0.25 : v.z <= 0.5 ? 0.5 : 1;
    const view = { x0: -v.ox / v.z, y0: -v.oy / v.z, x1: (this.w - v.ox) / v.z, y1: (this.h - v.oy) / v.z };
    let budget = settled ? 6 : 1, complete = true;
    const r = this.terrain.chunkRange(want, view);
    for (let cy = r.cy0; cy <= r.cy1; cy++) for (let cx = r.cx0; cx <= r.cx1; cx++) {
      let c = this.terrain.get(want, cx, cy, false);
      if (!c && budget > 0) { budget--; c = this.terrain.get(want, cx, cy, true); }
      const b = this.terrain.bounds;
      if (c) { x.drawImage(c, b.x0 * v.z + v.ox + cx * r.span * v.z, b.y0 * v.z + v.oy + cy * r.span * v.z, r.span * v.z + 0.6, r.span * v.z + 0.6); continue; }
      complete = false;
      const fr = this.terrain.chunkRange(0.25, { x0: b.x0 + cx * r.span, y0: b.y0 + cy * r.span, x1: b.x0 + (cx + 1) * r.span - 1, y1: b.y0 + (cy + 1) * r.span - 1 });
      const fc = this.terrain.get(0.25, fr.cx0, fr.cy0, true);
      const sub = r.span / fr.span, ix = ((b.x0 + cx * r.span) - (b.x0 + fr.cx0 * fr.span)) / fr.span, iy = ((b.y0 + cy * r.span) - (b.y0 + fr.cy0 * fr.span)) / fr.span;
      x.drawImage(fc, ix * Iso.CHUNK_PX, iy * Iso.CHUNK_PX, sub * Iso.CHUNK_PX, sub * Iso.CHUNK_PX,
        b.x0 * v.z + v.ox + cx * r.span * v.z, b.y0 * v.z + v.oy + cy * r.span * v.z, r.span * v.z + 0.6, r.span * v.z + 0.6);
    }
    return complete;
  }

  isLandmark(p) { return p.tier === 0 || p.tier >= 4; }

  placeAndDraw(x, v) {
    const ms = this.ms, band = this.band(), placed = [], cores = [], hits = [], sprites = [], labels = [], spriteRect = {};
    const hud = ms.hud || [];
    const inFrame = r => r.x0 >= 4 && r.y0 >= 4 && r.x1 <= this.w - 4 && r.y1 <= this.h - 4;
    const free = (r, label = true, own = null) => label ? inFrame(r) && !placed.some(o => o !== own && overlap(o, r)) && !hud.some(o => overlap(o, r)) : !cores.some(o => overlap(o, r));
    const take = r => { placed.push(r); return r; };
    const onScreen = (sx, sy, pad = 80) => sx > -pad && sx < this.w + pad && sy > -pad && sy < this.h + pad * 2;
    for (const r of ms.reserved || []) take(r);
    for (const t of Overlays.staticThreats(this, v, band)) { take(t.rect); labels.push(t); }

    const farBoost = p => Math.min({ 0: 1.8, 3: 1.6, 4: 1.4, 5: 1.6 }[p.tier] || 1.6, Math.max(1, 0.25 / v.z));
    const boost = band === 'far' ? 1 : band === 'mid' ? Math.min(1.5, Math.max(1, 0.4 / v.z)) : 1;
    const mains = this.W.P.filter(p => {
      const fog = ms.fogged.has(p.id) && !ms.fogOffView;
      if (fog && !this.isLandmark(p)) return false;
      if (band === 'far' && p.tier > 0 && p.tier < 3 && !(ms.forceMain || []).includes(p.id)) return false;
      return !(ms.hideMain || []).includes(p.id);
    }).sort((a, b) => (a.tier === 0 ? 9 : a.tier) > (b.tier === 0 ? 9 : b.tier) ? -1 : 1);
    for (const p of mains) {
      const [sx, sy] = this.project(p.seed[0], p.seed[1]);
      if (!onScreen(sx, sy, 200)) continue;
      const S = v.z * (band === 'far' ? farBoost(p) : boost), m = this.measure[p.id];
      const rect = { x0: sx + m.x0 * S, y0: sy + m.y0 * S, x1: sx + m.x1 * S, y1: sy + m.y1 * S };
      const core = shrink(rect, band === "far" ? 0.45 : 0.3);
      if (!free(core, false)) continue;
      take({ x0: core.x0 + 6, x1: core.x1 - 6, y0: core.y0 + 4, y1: core.y1 - 4 }); cores.push(core);
      const owner = ms.owner[p.id] || 'neutral';
      const fog = ms.fogged.has(p.id) && !ms.fogOffView;
      sprites.push({ kind: 'main', p, sx, sy, S, owner, fog, depth: sy });
      spriteRect[p.id] = { rect, core, tag: null };
      hits.push({ rect, type: 'main', id: p.id });
      if (band !== 'far' && p.tier > 0) {
        const lbl = this.poiTag(x, p, owner, sx, rect.y1 + 1, fog);
        if (free(lbl.rect)) { take(lbl.rect); labels.push(lbl); spriteRect[p.id].tag = lbl.rect; }
      }
    }
    for (const p of this.W.P.slice().sort((a, b) => b.tier - a.tier)) {
      const lbl = this.provLabel(x, p, band, ms);
      if (!lbl) continue;
      const sr = spriteRect[p.id], [ax, ay] = this.project(p.labelAt[0], p.labelAt[1]);
      const below = sr ? [[(sr.rect.x0 + sr.rect.x1) / 2 - ax, (sr.tag ? sr.tag.y1 : sr.rect.y1) + lbl.h / 2 + 1 - ay]] : [];
      const above = sr ? [[(sr.rect.x0 + sr.rect.x1) / 2 - ax, sr.rect.y0 - lbl.h / 2 - 1 - ay]] : [];
      const first = sr && (p.tier === 0 || p.tier >= 3) ? below.concat(above, below.map(([bx, by]) => [bx, by + lbl.h * 0.8]), below.map(([bx, by]) => [bx, by + lbl.h * 1.6])) : [];
      for (const [dx, dy] of [...first, [0, 0], [0, -lbl.h * 1.1], [0, lbl.h * 1.1], [-lbl.w * 0.45, 0], [lbl.w * 0.45, 0], [0, -lbl.h * 2.2], [-lbl.w * 0.8, -lbl.h * 1.2], [lbl.w * 0.8, -lbl.h * 1.2], [0, lbl.h * 2.2], [0, -lbl.h * 3.4]]) {
        const rr = { x0: lbl.rect.x0 + dx, x1: lbl.rect.x1 + dx, y0: lbl.rect.y0 + dy, y1: lbl.rect.y1 + dy };
        if (onScreen(rr.x0, rr.y0, 300) && free(rr, true, spriteRect[p.id] && spriteRect[p.id].core)) { take(rr); labels.push({ ...lbl, rect: rr, dx, dy }); break; }
      }
    }
    for (const t of Overlays.staticMarkers(this, v, band)) { if (free(t.rect)) { take(t.rect); labels.push(t); if (t.hit) hits.push(t.hit); } }
    if (band === 'near' || ms.smallAt === band) {
      const order = { mid: 0, camp: 1, small: 2 };
      const pois = this.visiblePois().sort((a, b) => order[a.cls] - order[b.cls]);
      for (const poi of pois) {
        const [sx, sy] = this.project(poi.at[0], poi.at[1]);
        if (!onScreen(sx, sy)) continue;
        const S = v.z, r = poi.cls === 'mid' ? 12 : 10, lift = PoiArt.liftOf(poi, S);
        const rect = { x0: sx - r - 3, x1: sx + r * 1.9, y0: sy - lift - r - 6, y1: sy - lift + r + 3 };
        if (!free(rect)) continue;
        take(rect);
        sprites.push({ kind: 'small', poi, sx, sy, S, depth: sy, ghost: (ms.beaten || []).includes(poi.id) });
        hits.push({ rect: { ...rect, y1: sy + 6 }, type: 'poi', id: poi.id });
      }
    }
    sprites.sort((a, b) => a.depth - b.depth);
    for (const s of sprites) {
      if (s.kind === 'main') PoiArt.drawMain(x, s.p, s.sx, s.sy, s.S, { owner: s.owner, cutOff: ms.cutOff.has(s.p.id), alpha: s.fog ? 0.82 : 1, grey: false });
      else PoiArt.drawSmall(x, s.poi, s.sx, s.sy, s.S, { sprites: true, alpha: s.ghost ? 0.35 : 1 });
    }
    this.labels = labels; this.hits = hits; this.placed = placed;
  }

  visiblePois() {
    const ms = this.ms, W = this.W;
    const out = [];
    for (const poi of W.pois) {
      if (ms.fogged.has(poi.prov) && !ms.fogOffView) continue;
      if ((ms.hidePois || []).includes(poi.id)) continue;
      const mv = (ms.campMoves || {})[poi.id];
      out.push(mv ? { ...poi, at: mv } : poi);
    }
    return out.concat(ms.extraPois || []);
  }

  provLabel(x, p, band, ms) {
    const fog = ms.fogged.has(p.id) && !ms.fogOffView;
    const owner = ms.owner[p.id] || 'neutral';
    const size = NAME_SIZE[p.tier] + (band === 'mid' ? 2 : band === 'near' ? 4 : 0);
    const [sx, sy] = this.project(p.labelAt[0], p.labelAt[1]);
    const chips = [];
    if (ms.cutOff.has(p.id)) chips.push(['CUT OFF', '#3ad17a', '#06210f']);
    if (ms.contested.has(p.id)) chips.push(['CONTESTED', '#ffb84d', '#2b1a00']);
    const text = p.name;
    x.font = `${fog ? 600 : 800} ${size}px Outfit, sans-serif`;
    const tw = x.measureText(text).width;
    const chipW = chips.reduce((s, c) => s + c[0].length * 6.2 + 14, 0);
    const w = tw + (chipW ? chipW + 6 : 0) + 6, h = size + 6;
    const color = fog ? 'rgba(214,198,170,0.62)' : owner !== 'neutral' ? PoiArt.OWNER[owner] : '#f1e6d4';
    const rect = { x0: sx - w / 2, x1: sx + w / 2, y0: sy - h / 2, y1: sy + h / 2 };
    const draw = (cx, dx, dy) => {
      const x0 = sx - w / 2 + dx + 3, y = sy + dy;
      cx.save();
      cx.font = `${fog ? 'italic 600' : 800} ${size}px Outfit, sans-serif`;
      cx.textAlign = 'left'; cx.textBaseline = 'middle';
      cx.lineJoin = 'round'; cx.strokeStyle = 'rgba(8,5,2,0.92)'; cx.lineWidth = Math.max(3, size * 0.32);
      cx.strokeText(text, x0, y); cx.fillStyle = color; cx.fillText(text, x0, y);
      let cxp = x0 + tw + 6;
      for (const [t, bg, fg] of chips) {
        const cw = t.length * 6.2 + 10;
        cx.fillStyle = bg; cx.beginPath(); cx.roundRect(cxp, y - 7, cw, 14, 3); cx.fill();
        cx.fillStyle = fg; cx.font = '800 9px Outfit, sans-serif'; cx.fillText(t, cxp + 5, y + 0.5);
        cxp += cw + 4;
      }
      cx.restore();
    };
    return { rect, w, h, draw, prov: p.id };
  }

  poiTag(x, p, owner, sx, sy, fog) {
    const t = `${p.tierInfo.label.toUpperCase()}`, lv = `L${p.main.level}`;
    x.font = '800 10px Outfit, sans-serif';
    const tw = x.measureText(t).width, lw = x.measureText(lv).width;
    const w = tw + lw + 30, h = 17, col = owner !== 'neutral' ? PoiArt.OWNER[owner] : '#cdbb9c';
    const rect = { x0: sx - w / 2, x1: sx + w / 2, y0: sy, y1: sy + h };
    const draw = (cx) => {
      cx.save();
      cx.globalAlpha = fog ? 0.75 : 1;
      cx.fillStyle = 'hsla(25,25%,7%,0.9)'; cx.strokeStyle = col; cx.lineWidth = 1.2;
      cx.beginPath(); cx.roundRect(rect.x0, rect.y0, w, h, 8.5); cx.fill(); cx.stroke();
      cx.fillStyle = col; cx.font = '800 9px Outfit, sans-serif'; cx.textBaseline = 'middle'; cx.textAlign = 'left';
      cx.fillText(`T${p.tier}`, rect.x0 + 6, rect.y0 + h / 2 + 0.5);
      cx.fillStyle = '#efe6d6'; cx.font = '800 10px Outfit, sans-serif';
      cx.fillText(t, rect.x0 + 21, rect.y0 + h / 2 + 0.5);
      cx.fillStyle = col; cx.fillText(lv, rect.x0 + 25 + tw, rect.y0 + h / 2 + 0.5);
      cx.restore();
    };
    return { rect, draw };
  }

  hitTest(sx, sy) {
    for (let i = this.hits.length - 1; i >= 0; i--) { const r = this.hits[i].rect; if (sx >= r.x0 && sx <= r.x1 && sy >= r.y0 && sy <= r.y1) return this.hits[i]; }
    const [gx, gy] = this.unproject(sx, sy), N = this.W.N;
    if (gx < 0 || gy < 0 || gx >= N || gy >= N) return null;
    return { type: 'prov', id: this.W.P[this.W.cells.prov[Math.floor(gy) * N + Math.floor(gx)]].id };
  }
}

root.MapView = MapView;
root.MAP_BANDS = BANDS;
})(globalThis);
