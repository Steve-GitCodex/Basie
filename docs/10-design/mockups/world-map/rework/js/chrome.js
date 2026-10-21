(function (root) {
'use strict';

const I = (n, style = '') => `<svg class="ic" style="${style}"><use href="#i-${n}"/></svg>`;
const NEW = '<span class="tag tag--new">NEW</span>';
const IMP = '<span class="tag tag--imp">IMPROVED</span>';
const AI = '<span class="tag tag--ai">LATER: AI</span>';

function injectIcons() {
  const defs = document.getElementById('iconDefs');
  defs.innerHTML = Object.entries(root.ICONS).map(([n, ic]) => {
    const a = Object.entries(ic.attrs || {}).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<symbol id="i-${n}" viewBox="${ic.vb}"><g ${a}>${ic.inner}</g></symbol>`;
  }).join('');
}

const RES = [['wood', '#c97a2b'], ['stone', '#a9a39a'], ['food', '#7fae4f'], ['iron', '#8fa3b8'], ['water', '#4fb0d9']];

function topBar(compact) {
  const chips = RES.map(([r, c]) => `<div class="rchip" style="--c:${c}"><i style="color:${c}">${I(r, `color:${c}`)}</i><span>500M</span></div>`).join('');
  const player = `<div class="tb__player"><span class="tb__av">${I('crown')}<b>3</b></span><span class="tb__name"><b>Dev Commander</b><small>Lv 1</small></span></div>`;
  if (compact) return { player, chips };
  return `<div class="tb">${player}${chips}<div class="tb__right">
    <div class="rchip" style="--c:#d9b24a"><i>${I('money', 'color:#d9b24a')}</i><span>500M</span></div>
    <div class="rchip" style="--c:#e0883a"><i>${I('diamond', 'color:#e0883a')}</i><span>20</span><span class="tb__plus">+</span></div>
    <div class="buffs">${I('flask', 'width:13px;height:13px')} Buffs</div></div></div>`;
}

function marchesPanel(rows) {
  const body = rows && rows.length ? rows.map(r => `<div class="wm__row ${r.threat ? 'wm__row--threat' : ''}" data-act="${r.act || 'noop'}">
      <div class="wm__top">${I(r.icon || 'sword', r.threat ? 'color:#e05a3d' : '')}<span>${r.name}</span><span>${r.status}</span></div>
      <div class="wm__bar"><i ${r.id ? `id="wmB-${r.id}"` : ''} style="width:${r.pct}%"></i></div><div class="wm__t" ${r.id ? `id="wmT-${r.id}"` : ''}>${r.time}</div>
      ${r.actions ? `<div class="wm__acts"><button data-act="mspeed:${r.id}">${I('lightning')}Speed up</button>${r.returning ? '' : `<button data-act="mrecall:${r.id}">${I('base')}Recall</button>`}</div><div class="wm__was">was: progress only</div>` : ''}</div>`).join('')
    : '<div class="wm__empty">No active marches</div>';
  const imp = rows && rows.some(r => r.actions);
  return `<div class="wm ${imp ? 'is-imp' : ''}" id="wm">${imp ? `<div class="ctag">${IMP}</div>` : ''}<div class="wm__head">Marches</div>${body}</div>`;
}

function territoryLegend(extra) {
  const sw = (c, n, cls = '') => `<div class="tleg__row ${cls}"><span class="tleg__sw tleg__sw--glow" style="color:${c};background:${c}"></span>${n}</div>`;
  return `<div class="tleg is-imp" id="tleg"><div class="ctag">${IMP}</div><div class="tleg__head">Territory</div>
    ${sw('var(--you)', 'My Territory', 'tleg__row--own')}${sw('var(--scav)', 'Scavenger Packs')}${sw('var(--red)', 'Red Talon Raiders')}${sw('var(--cov)', 'Iron Covenant')}
    <div class="tleg__sep"></div>
    <div class="tleg__row"><span class="tleg__sw tleg__sw--fog"></span>Unexplored (sketch)</div>
    ${extra ? `<div class="tleg__row"><span class="tleg__sw tleg__sw--cut"></span>Cut off · no buff</div>
    <div class="tleg__row"><span class="tleg__sw tleg__sw--con"></span>Contested</div>` : ''}</div>`;
}

function zoomBar(band) {
  return `<div class="zoombar is-new" id="zoombar"><div class="ctag">${NEW}</div>
    ${['far', 'mid', 'near'].map(b => `<button class="${b === band ? 'on' : ''}" data-act="band:${b}" title="${b} zoom">${b.toUpperCase()}</button>`).join('')}</div>`;
}

function dock() {
  return `<div class="recenter" title="Recenter">${I('search')}</div>
    <div class="qtab">${I('lightning', 'width:16px;height:16px')}<i></i></div>
    <div class="dock"><div class="dock__btn">${I('backpack')}<span class="dock__dot"></span></div>
      <div class="dock__flip">${I('base', 'color:var(--clr-primary)')}BASE</div>
      <div class="dock__btn">${I('envelope')}<span class="dock__badge">3</span></div></div>
    <div class="fab" title="More">${I('more')}<b></b></div>`;
}

function toasts(list) {
  if (!list || !list.length) return '';
  return `<div class="toasts">${list.map(t => `<div class="toast toast--${t.k} ${t.isNew ? 'is-new' : ''}">${t.isNew ? `<div class="ctag">${NEW}</div>` : ''}${I(t.icon)}<div><div class="toast__t">${t.t}</div><div class="toast__m">${t.m}</div></div></div>`).join('')}</div>`;
}

function banner(b) {
  if (!b) return '';
  return `<div class="banner is-new" id="banner"><div class="ctag">${NEW}</div>${I(b.icon || 'sword', 'color:hsl(5,85%,64%)')}<b>${b.title}</b><span>${b.text}</span>${b.time ? `<span class="t">${b.time}</span>` : ''}</div>`;
}

function title(t) {
  if (!t) return '';
  return `<div class="title is-new" id="titleBanner"><div class="ctag">${NEW}</div><small>${t.kicker}</small><b>${I('crown')}${t.title}</b><span>${t.text}</span></div>`;
}

function hud(ui, band) {
  return topBar() + marchesPanel(ui.marches) + territoryLegend(ui.legendExtra) + zoomBar(band) + dock() +
    (ui.mapImp ? `<div class="mapimp is-imp">${IMP}<span>World map · was 9 flat squares with emoji badges</span></div>` : '') +
    banner(ui.banner) + title(ui.title) + toasts(ui.toasts);
}

root.Chrome = { I, NEW, IMP, AI, injectIcons, topBar, marchesPanel, territoryLegend, zoomBar, dock, toasts, hud };
})(globalThis);
