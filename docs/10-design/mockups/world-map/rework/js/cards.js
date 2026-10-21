(function (root) {
'use strict';
const { I, NEW, IMP } = root.Chrome;

const FACTION = { you: 'You', red: 'Red Talon Raiders', cov: 'Iron Covenant', scav: 'Scavenger Packs', neutral: 'Neutral · monster garrison' };
const BUFF = { ash: 'iron gather', cracked: 'stone gather', deadgrass: 'food gather', mud: 'water gather', frost: 'march speed', scorch: 'iron gather', rubble: 'troop defense', asphalt: 'all gather, map-wide' };
const BUFF_PCT = { 0: 0, 1: 10, 2: 15, 3: 20, 4: 25, 5: 5 };
const SQUAD = 2600;
const fmtK = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
const band = (enemy) => { const r = enemy / SQUAD; return r < 0.6 ? ['g', 'green'] : r < 1 ? ['a', 'amber'] : ['r', 'red']; };

function etaFor(W, chain) {
  const pts = Overlays.routePath(W, chain);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const s = Math.round(len * 16);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function routeTo(W, ms, target) {
  const held = Object.keys(ms.owner).filter(k => ms.owner[k] === 'you');
  const prev = {}, q = [...held];
  held.forEach(h => { prev[h] = null; });
  while (q.length) {
    const c = q.shift();
    if (c === target) break;
    for (const n of W.neighbors(c)) if (!(n in prev)) { prev[n] = c; if (n === target || ms.owner[n] === 'you') q.push(n); }
  }
  if (!(target in prev)) return null;
  const chain = [];
  for (let c = target; c; c = prev[c]) chain.unshift(c);
  if (chain.length === 1) return null;
  const vias = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const c = W.C.find(k => (k.from === chain[i] && k.to === chain[i + 1]) || (k.to === chain[i] && k.from === chain[i + 1]));
    if (c && c.name) vias.push(c.name);
  }
  return { chain, via: vias, eta: etaFor(W, chain), origin: W.byId[chain[0]].name };
}

function provinceCard(W, ms, id, extra = {}) {
  const p = W.byId[id], owner = ms.owner[id] || 'neutral', m = p.main;
  const col = PoiArt.OWNER[owner];
  const isSeat = p.tier === 0;
  const route = owner === 'you' ? null : routeTo(W, ms, id);
  const [bk, bn] = band(m.power);
  const buff = BUFF_PCT[p.tier] ? `+${BUFF_PCT[p.tier]}% ${BUFF[p.biome]}` : 'none';
  const rows = [];
  rows.push(`<div class="kv"><span>Holder</span><b style="color:${col}">${FACTION[owner]}</b></div>`);
  if (!isSeat || owner !== 'you') rows.push(`<div class="kv kv--new"><span>Garrison</span><b>${m.monster} · L${m.level} · ${fmtK(m.power)}</b></div>`);
  rows.push(`<div class="kv kv--new"><span>Walls</span><b>${p.tierInfo.walls > 1 ? `×${p.tierInfo.walls} defense` : 'none (walls from tier 3)'}</b></div>`);
  rows.push(`<div class="kv"><span>Province buff</span><b>${ms.cutOff.has(id) ? '<s style="color:var(--clr-text-muted)">' + buff + '</s> paused' : buff}</b></div>`);
  if (ms.cutOff.has(id)) rows.push(`<div class="why" style="--c:var(--you)"><b>Cut off.</b> No held road back to Home Refuge, so the buff is paused. Retake Rustwater or take Ashwood to reconnect.</div>`);
  if (owner !== 'you' && !isSeat) {
    rows.push(`<div class="kv kv--new"><span>Forecast · Squad 1 ${fmtK(SQUAD)}</span><b><span class="band band--${bk}">${bn}</span></b></div>`);
    rows.push(route ? `<div class="kv kv--new"><span>Route</span><b>${route.via.length ? 'via ' + route.via.join(', ') : 'by road'} · ${route.eta}</b></div>`
      : `<div class="kv kv--new"><span>Route</span><b style="color:var(--clr-text-muted)">not connected to your provinces</b></div>`);
  }
  if (extra.why) rows.push(`<div class="why" style="--c:${extra.whyColor || 'var(--clr-primary)'}">${extra.why}</div>`);
  const canAttack = !isSeat && owner !== 'you' && !!route;
  const actions = isSeat && owner !== 'you'
    ? `<button data-act="noop">Scout</button><button disabled title="Sacking comes with the AI slices">Sack · later</button>`
    : owner === 'you' ? `<button data-act="noop">Garrison</button><button data-act="noop">Details</button>`
    : `<button class="pri" data-act="march:${id}" ${canAttack ? '' : 'disabled'}>Attack</button><button data-act="noop">Scout</button>`;
  return { c: col, icon: isSeat ? 'base' : p.tier >= 4 ? 'column' : 'house', title: p.name,
    sub: `${isSeat ? 'Warlord seat' : `${p.tierInfo.label} · Tier ${p.tier}`} · ${W.QUARTER_NAME[p.quarter] || 'centre ring'}`,
    body: rows.join(''), actions, at: p.seed };
}

function poiCard(W, ms, poi) {
  const rows = [];
  let title, icon, c, actions;
  if (poi.kind === 'node') {
    title = `${poi.res[0].toUpperCase() + poi.res.slice(1)} node`; icon = poi.res; c = PoiArt.RES_COLOR[poi.res];
    rows.push(`<div class="kv"><span>Level</span><b>L${poi.level}</b></div><div class="kv kv--new"><span>Why here</span><b>${poi.res === 'water' ? 'water within 2 cells' : poi.res === 'wood' ? 'forest within 2 cells' : 'biome mix'}</b></div>`);
    actions = '<button class="pri" data-act="noop">Gather</button>';
  } else if (poi.cls === 'camp') {
    title = poi.guard ? `Guard · ${poi.guards}` : 'Monster camp'; icon = poi.guard ? 'shield' : 'skull'; c = '#e05a3d';
    rows.push(`<div class="kv kv--new"><span>Monster</span><b>${poi.monster} · L${poi.level}</b></div><div class="kv kv--new"><span>Power</span><b>${fmtK(poi.power)} <span class="band band--${band(poi.power)[0]}">${band(poi.power)[1]}</span></b></div>`);
    rows.push(`<div class="kv"><span>Respawn</span><b>${poi.guard ? 'never (guard)' : 'elsewhere in province'}</b></div>`);
    actions = '<button class="pri" data-act="noop">Attack</button><button data-act="noop">Scout</button>';
  } else {
    title = poi.kind[0].toUpperCase() + poi.kind.slice(1); icon = { ruin: 'column', watchtower: 'search', outpost: 'base', mine: 'iron' }[poi.kind]; c = '#d9c7a3';
    rows.push(`<div class="kv"><span>Level</span><b>L${poi.level}</b></div><div class="kv"><span>Kind</span><b>${poi.kind === 'mine' ? 'rich node, guarded' : poi.kind === 'watchtower' ? 'capturable, reveals fog' : poi.kind === 'outpost' ? 'capturable' : 'one-time loot'}</b></div>`);
    actions = '<button class="pri" data-act="noop">Scout</button>';
  }
  return { c, icon, title, sub: `${W.byId[poi.prov].name} · near zoom`, body: rows.join(''), actions, at: poi.at };
}

function cardHtml(card, pos) {
  const arrow = `<div class="acard__arrow acard__arrow--${pos.side}" style="top:${pos.arrow}px"></div>`;
  return `<div class="acard is-imp" id="card" style="--c:${card.c};left:${pos.left}px;top:${pos.top}px;width:${pos.w}px">${arrow}
    <div class="ctag">${IMP}${NEW}</div><div class="acard__stripe"></div>
    <div class="acard__head"><span class="acard__icon">${I(card.icon)}</span><div><h3>${card.title}</h3><div class="acard__sub">${card.sub}</div></div>
    <button class="acard__x" data-act="close">${I('x-circle', 'width:18px;height:18px')}</button></div>
    <div class="acard__body">${card.body}</div><div class="acard__actions">${card.actions}</div></div>`;
}

function placeCard(sx, sy, w, h, side, frameW = 1280, frameH = 800) {
  const right = side ? side === 'left' : sx + 46 + w < frameW - 50;
  const left = right ? sx + 46 : sx - 46 - w;
  const top = Math.max(58, Math.min(frameH - h - 80, sy - h * 0.42));
  return { left, top, w, side: right ? 'left' : 'right', arrow: Math.max(16, Math.min(h - 24, sy - top - 7)) };
}

root.Cards = { etaFor, provinceCard, poiCard, cardHtml, placeCard, routeTo, BUFF, BUFF_PCT };
})(globalThis);
