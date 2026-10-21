(function (root) {
'use strict';
const { I, NEW, IMP } = root.Chrome;

const LADDER = [
  [1, 'home-B', 'Swap Market', '1–2 stalls · no walls · 8 of them'],
  [2, 'home-T', 'Township', '4–5 houses · 4 of them'],
  [3, 'home-S', 'Stockade Town', 'walls from here up · 4'],
  [4, 'ruin-home', 'Ruin City', 'tall silhouette · seen through fog · 4'],
  [5, 'metro', 'Metropolis', 'skyline over ~6×6 cells · 1'],
];

function ladder() {
  return `<div class="ladder is-new" id="ladder"><div class="ctag">${NEW}</div><div class="ladder__head">Tier ladder · centre = harder, richer</div>
    ${LADDER.map(([t, id, n, d]) => `<div class="ladder__row" data-act="focus:${id}"><canvas width="104" height="78" data-tier="${id}"></canvas>
      <div><b><span class="tierchip">T${t}</span>${n}</b><small>${d}</small></div></div>`).join('')}
    <div class="ladder__note">Stand-in art: final sprites are rendered per tier with the sprite rig.</div></div>`;
}

function paintLadder(W) {
  document.querySelectorAll('canvas[data-tier]').forEach(cv => {
    const x = cv.getContext('2d'), p = W.byId[cv.dataset.tier];
    x.clearRect(0, 0, cv.width, cv.height);
    const S = { 1: 0.42, 2: 0.36, 3: 0.33, 4: 0.28, 5: 0.22 }[p.tier];
    PoiArt.drawMain(x, p, cv.width / 2, cv.height * 0.7, S, { owner: 'neutral' });
  });
}

const WAS_PINS = [
  ['default', 620, 250, 1, 'Flat colour squares: the grid is the art'],
  ['default', 640, 410, 2, 'One home point: every march starts at Your Outpost and flies straight'],
  ['zoom', 640, 380, 3, '9 regions, the same rectangle with a different tint'],
  ['zoom', 640, 600, 4, '125 full-size emoji badges clump when zoomed out'],
  ['zoom', 880, 470, 5, 'A "?" on every hidden POI gives the layout away'],
  ['zoom', 400, 375, 6, 'Region names sit under the markers'],
];

function wasOverlay() {
  const pins = key => WAS_PINS.filter(p => p[0] === key);
  const col = (key, src, label) => `<div class="wasov__col"><figure class="wasov__shot"><img src="${src}" alt=""><figcaption>${label}</figcaption>
    ${pins(key).map(([, x, y, n]) => `<span class="wasov__pin" style="left:${x * 0.47}px;top:${y * 0.47}px">${n}</span>`).join('')}</figure>
    <ol class="wasov__list">${pins(key).map(p => `<li><span class="wasov__pin wasov__pin--inline">${p[3]}</span>${p[4]}</li>`).join('')}</ol></div>`;
  return `<div class="wasov" id="was"><div class="wasov__title">Was: today's world map</div>
    <div class="wasov__row">${col('default', 'sprites/ref/was-default.jpg', 'Default zoom (03)')}${col('zoom', 'sprites/ref/was-zoomed-out.jpg', 'Zoomed out (04)')}</div></div>`;
}

const SUMMARY = [
  ['imp', 'World map', 'was 9 flat squares → a ¾ iso diamond of ~25 organic provinces, baked biome terrain, props, rivers and ridges'],
  ['imp', 'Territory', 'was a full flat tint → owner border line plus a soft inner glow; live owner drives it'],
  ['imp', 'Fog', 'was "?" on every hidden POI → dark sketch land; seats, Ruin Cities and the Metropolis stay visible'],
  ['imp', 'POI markers', 'was 125 emoji badges → one tiered main POI per province; small icon discs with levels at near zoom only'],
  ['imp', 'Marches', 'was a straight line with a mid-route ETA pill → routes along roads and passes; the route shows on hover or select only'],
  ['imp', 'Intel card', 'was the bottom POI panel → anchored card with tier, garrison, walls, forecast band and route'],
  ['imp', 'Territory legend', 'adds unexplored sketch, cut off and contested'],
  ['imp', 'Marches panel row', 'was progress only → adds Speed up and Recall'],
  ['imp', 'Phone', 'Marches panel and legend collapse out of the map\'s way'],
  ['new', 'Tier ladder', 'Swap Market → Township → Stockade Town → Ruin City → Metropolis; bigger and harder toward the centre'],
  ['new', 'Connections', 'roads, passes, bridges and gates; you may attack a province connected to one you hold'],
  ['new', 'Semantic zoom', 'far / mid / near bands with a zoom control; labels placed by priority, never overlapping'],
  ['new', 'Supply line', 'a held province with no held road home is cut off and loses its buff'],
  ['new', 'Real levels and respawn', 'level picks the monster; camps respawn at a different slot'],
  ['new', 'Hooks for the AI', 'war-camp slots on passes, contested Ruin Cities, Metropolis sieges one countdown at a time'],
  ['new', 'March token and popup', 'small pill on the squad; click for type, target, phase, ETA, load and progress; march speed-ups (+50%, +100%) and Recall'],
  ['new', 'Metropolis title', 'first capture grants a title and a map-wide buff'],
];

function summary() {
  return `<div class="sum" id="sum"><div class="sum__title">What changed</div><div class="sum__grid">
    ${SUMMARY.map(([k, t, d]) => `<div class="sum__item">${k === 'imp' ? IMP : NEW}<div><b>${t}</b><small>${d}</small></div></div>`).join('')}</div></div>`;
}

function phone(eta) {
  const { player, chips } = Chrome.topBar(true);
  return `<div class="phone-stage" id="phoneStage">
    <div class="phone-note" style="left:120px;top:150px"><span class="tag tag--imp">IMPROVED</span><b>Marches collapse to a chip</b>was: a 220px panel over a quarter of the map</div>
    <div class="phone-note" style="left:120px;top:330px"><span class="tag tag--imp">IMPROVED</span><b>Legend folds into a key</b>was: the territory legend always open</div>
    <div class="phone-note" style="right:120px;top:150px"><span class="tag tag--new">NEW</span><b>Tap radius in screen space</b>small discs stay tappable at every zoom</div>
    <div class="phone-note" style="right:120px;top:330px"><span class="tag tag--new">NEW</span><b>Resize keeps the centre</b>rotate or resize and the view stays on your target</div>
    <div class="phone" id="phone"><canvas id="phoneMap" width="390" height="844"></canvas>
      <div class="ph-top"><div class="ph-row">${player}<div class="ph-right"><div class="rchip"><i>${I('diamond', 'color:#e0883a')}</i><span>20</span></div><div class="buffs">${I('flask', 'width:13px;height:13px')}</div></div></div><div class="ph-res">${chips}</div></div>
      <div class="ph-chip is-imp"><div class="ctag">${IMP}</div>${I('sword', 'width:13px;height:13px')} Marches · 1 <span id="wmT-sq1">${eta}</span></div>
      <div class="ph-key is-imp"><div class="ctag">${IMP}</div>${I('quests', 'width:16px;height:16px')}</div>
      <div class="ph-zoom">${['F', 'M', 'N'].map((b, i) => `<span class="${i === 1 ? 'on' : ''}">${b}</span>`).join('')}</div>
      <div class="ph-dock"><div class="dock__btn">${I('backpack')}</div><div class="dock__flip">${I('base', 'color:var(--clr-primary)')}BASE</div><div class="dock__btn">${I('envelope')}<span class="dock__badge">3</span></div><div class="fab">${I('more')}<b></b></div></div>
    </div></div>`;
}

root.Panels = { ladder, paintLadder, wasOverlay, summary, phone, LADDER };
})(globalThis);
