(function (root) {
'use strict';

const BASE_OWNER = { 'home-seat': 'you', 'red-seat': 'red', 'cov-seat': 'cov', 'scav-seat': 'scav' };
for (const q of ['red', 'cov', 'scav']) for (const r of ['A', 'B', 'T']) BASE_OWNER[`${q}-${r}`] = q;
const FAR = { at: [48.6, 48.6], z: 0.143 };
const LANDMARK_FOG_NOTE = 'Seats, Ruin Cities and the Metropolis stay visible through fog';

function derive(W, spec) {
  const owner = Object.assign({}, BASE_OWNER, spec.owner || {});
  const held = Object.keys(owner).filter(k => owner[k] === 'you');
  const discovered = new Set(held);
  for (const h of held) for (const n of W.neighbors(h)) discovered.add(n);
  for (const s of spec.scouted || []) discovered.add(s);
  const fogged = new Set(spec.fog === false ? [] : W.P.map(p => p.id).filter(id => !discovered.has(id)));
  const reach = new Set(['home-seat']), q = ['home-seat'];
  while (q.length) { const c = q.shift(); for (const n of W.neighbors(c)) if (owner[n] === 'you' && !reach.has(n)) { reach.add(n); q.push(n); } }
  const cutOff = new Set(held.filter(h => !reach.has(h)));
  const contestedBy = spec.contested || {};
  return Object.assign({}, spec, { owner, fogged, cutOff, discovered, contested: new Set(Object.keys(contestedBy)), contestedBy });
}

function picks(W) {
  const inProv = (id, f) => W.pois.filter(o => o.prov === id && f(o));
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const rw = W.byId['home-B'];
  const creek = W.L.find(l => l.id === 'creek-home');
  const water = inProv('home-B', o => o.res === 'water').sort((a, b) => near(a.at, creek.pond.at) - near(b.at, creek.pond.at))[0];
  const mid = inProv('home-B', o => o.cls === 'mid').sort((a, b) => near(a.at, rw.seed) - near(b.at, rw.seed))[0];
  const guard = W.pois.find(o => o.id.startsWith('home-B-pg-'));
  const camp = inProv('home-B', o => o.cls === 'camp' && !o.guard)[0];
  const node = inProv('home-B', o => o.kind === 'node' && o !== water).sort((a, b) => near(b.at, water.at) - near(a.at, water.at))[0];
  const rlCamp = inProv('home-T', o => o.cls === 'camp' && !o.guard)[0];
  const slots = W.campSlots['home-T'];
  const free = slots.filter(s => !W.pois.some(o => o.prov === 'home-T' && o.cls === 'camp' && near(o.at, s) < 0.1));
  const newSlot = free.sort((a, b) => near(b, rlCamp.at) - near(a, rlCamp.at))[0] || slots[slots.length - 1];
  return { water, mid, guard, camp, node, rlCamp, newSlot };
}

function buildSteps(W) {
  const pk = picks(W);
  const C = (a, b) => W.C.find(c => (c.from === a && c.to === b) || (c.from === b && c.to === a)).id;
  const L = id => W.byId[id].labelAt;
  const ashen = W.C.find(c => c.name === 'Ashen Pass');
  const homeConns = [C('home-seat', 'home-A'), C('home-seat', 'home-B'), C('home-A', 'home-T'), C('home-B', 'home-T'), C('home-B', 'red-A'), C('scav-B', 'home-A'), C('home-T', 'home-S')];
  const metroHeld = { 'home-B': 'you', 'home-T': 'you', 'home-S': 'you', 'ruin-home': 'you', metro: 'you' };
  const eta1 = Cards.etaFor(W, ['home-seat', 'home-B']);
  const marchRow = { id: 'sq1', name: 'Squad 1 → Rustwater', status: 'Marching', pct: 35, time: eta1, icon: 'sword', actions: true };
  const sq1 = extra => Object.assign({ id: 'sq1', squad: 'Squad 1', type: 'Attack', target: 'Rustwater · Swap Market', targetShort: 'Rustwater', origin: 'Home Refuge',
    chain: ['home-seat', 'home-B'], color: '#3ad17a', progress: 0.3, pill: true }, extra);
  const panelWas = ['IMPROVED', 'Marches panel row gains Speed up and Recall. was: progress only.'];
  return [
    { tag: 'Was', title: 'Today\'s world map', overlay: 'was', cam: FAR, map: { fog: false },
      text: 'This is the map we have now. It is 9 flat squares that all look alike, and about 125 emoji badges that clump together when you zoom out. Every hidden POI gets a "?", and every march flies in a straight line from one home point.' },
    { tag: 'Map', title: 'The new map, zoomed out', cam: FAR, map: { fog: false }, ui: { mapImp: true },
      tags: [{ at: [48, 48], dy: -86, text: 'Metropolis skyline', kind: 'new' }, { at: [47.5, 85], dy: -10, text: 'Natural borders: river, ridges', kind: 'new' }],
      text: 'The world is now a diamond in the same ¾ view as your base, cut into 25 provinces with their own ground. Home Refuge is the bottom point. Red Talon holds the right point, the Iron Covenant the top and the Scavengers the left. Rings run inward to the Metropolis. Fog is lifted for this overview.' },
    { tag: 'Tiers', title: 'The tier ladder', cam: FAR, map: { fog: false }, ui: { ladder: true },
      spot: { sel: '#ladder', pad: 6 }, rings: [['home-B', 'T1'], ['home-T', 'T2'], ['home-S', 'T3'], ['ruin-home', 'T4'], ['metro', 'T5']],
      text: 'Each province has one main POI, and it grows toward the centre: Swap Market, Township, Stockade Town, Ruin City, Metropolis. Garrisons, walls and buffs rise with the tier. The art here is stand-in; the final sprites are rendered per tier with the sprite rig.' },
    { tag: 'Home', title: 'Your corner', cam: { at: [82, 82], z: 0.3 }, map: {},
      spot: { provs: ['home-seat', 'home-A', 'home-B'], pad: 10 },
      text: 'Your quarter starts neutral, held by monster garrisons, so you learn against monsters first. Ashwood and Rustwater (two Swap Markets) flank Home Refuge. Each tag shows its tier and its garrison level. Red Lowlands and Gallows Reach wait in the fog behind them.' },
    { tag: 'Seats', title: 'Warlord seats', cam: FAR, map: {}, rings: [['red-seat', 'Red Talon'], ['cov-seat', 'Iron Covenant'], ['scav-seat', 'Scavengers']],
      text: 'The three warlord seats sit at the far corners. Each is a walled compound under the faction\'s banner, and you can see it through the fog, so an AI march never comes from nowhere. You can scout a seat now; sacking it comes with the AI.' },
    { tag: 'Fog', title: 'Sketch fog', cam: { at: [72, 70], z: 0.2 }, map: { hlConns: [C('home-seat', 'home-A'), C('home-seat', 'home-B')] },
      rings: [['ruin-home', 'landmark'], ['ruin-scav', 'landmark']],
      tags: [{ at: L('home-T'), dy: 22, text: 'Sketch fog, no "?"', kind: 'imp' }],
      was: [['IMPROVED', 'was: an 80% black fill with a "?" on every hidden POI.']],
      text: 'Land you haven\'t discovered is drawn as a dark sketch, with no "?" markers. Ashwood and Rustwater are clear because a road connects them to Home Refuge. ' + LANDMARK_FOG_NOTE + '.' },
    { tag: 'Zoom', title: 'Zoom bands: mid', cam: { at: [83, 80], z: 0.34 }, map: {}, ringSel: ['#zoombar', 'zoom band'],
      text: 'Far zoom shows provinces, names, tier 3+ POIs, seats and threats. Mid zoom adds every main POI with its tier and garrison level. Labels are placed in priority order (threat, seat, main POI by tier, then the rest), and a label drops out rather than overlap another.' },
    { tag: 'Zoom', title: 'Zoom bands: near', cam: { at: [87.5, 81], z: 0.78 }, map: {}, ringSel: ['#zoombar', 'zoom band'],
      text: 'Near zoom shows everything: resource nodes, camps, ruins and watchtowers. Each one is a small sprite with an icon disc and its level, no longer a full-size emoji badge. Province names stay large, and the pass gates carry their names.' },
    { tag: 'Province', title: 'Inside a province', cam: { at: [86.5, 66.5], z: 0.62 }, map: {},
      poiRings: [['main-home-B', 'main POI · clear ring'], [pk.mid.id, `mid POI · ${pk.mid.kind}`], [pk.node.id, 'node cluster'], [pk.camp.id, 'camp by the road'], [pk.guard.id, 'guard at the pass'], [pk.water.id, 'water by the creek']],
      text: 'Inside Rustwater the content follows spacing rules: a clear ring around the main POI, mid POIs apart, and nodes in small clusters, never on a road. Camps sit near roads, and a guard holds the Ashen Pass. The biome picks the resources, so water nodes sit by the creek.' },
    { tag: 'Routes', title: 'Connections', cam: { at: [76, 74], z: 0.21 }, map: { showConnections: true, namedConns: homeConns, hlConns: homeConns, attackable: ['home-A', 'home-B'] },
      tags: [{ at: ashen.passPt, dy: -36, text: 'Pass with a gate', kind: 'new' }, { at: L('home-B'), dy: 24, text: 'You may attack this', kind: 'new' }],
      text: 'Provinces are joined by roads, passes through ridges, bridges and the Metropolis gates. You may attack a province only if it is connected to one you hold. Right now that means Ashwood and Rustwater (amber). Red Lowlands borders Home Refuge, but the ridge has no pass there.' },
    { tag: 'Intel', title: 'The intel card', cam: { at: [86, 70], z: 0.42, dx: 150 }, map: { hlConns: [C('home-seat', 'home-B')] }, card: { prov: 'home-B', why: 'Taking Rustwater opens Red Lowlands and Ember Reach.' },
      spot: { sel: '#card', pad: 6, poi: 'home-B' },
      was: [['IMPROVED', 'was: the bottom POI panel, far from the node, with Type and Status rows only.']],
      text: `Tap a province's main POI to open the anchored intel card. It shows the tier, the garrison and its level, the walls (none below tier 3) and the buff. It also shows a forecast band for your squad and the route: via Ashen Pass, ${eta1}.` },
    { tag: 'March', title: 'March along the road', cam: { at: [88, 79], z: 0.38 }, map: { marches: [sq1({ hover: true, cursor: true })] },
      ui: { marches: [marchRow] }, spot: { route: ['home-seat', 'home-B'], pad: 40 },
      was: [['IMPROVED', 'was: a straight dashed line from Your Outpost to the target, with a big ETA pill mid-route.'], panelWas],
      text: 'Squad 1 leaves Home Refuge and follows the road through Ashen Pass. A small pill rides on the squad itself: its name and the time left. Hovering the squad shows the pill and draws its full route; other marches show only their token.' },
    { tag: 'Squad', title: 'Your squad on the map (1 of 3)', cam: { at: [88, 79], z: 0.38, dx: 120 }, map: { marches: [sq1({ progress: 0.62 })] },
      ui: { marches: [marchRow] }, marchSel: 'sq1', picker: true, spot: { sel: '#mpop', pad: 6, march: 'sq1' },
      text: 'Click the squad and a popup opens on it, styled like the intel card: type, target, phase, ETA, carried load and a progress bar along the route. Speed up opens the march speed-up items: +50% and +100%, with how many you own and a buy price.' },
    { tag: 'Squad', title: 'Your squad on the map (2 of 3)', cam: { at: [88, 79], z: 0.38, dx: 120 }, map: { marches: [sq1({ progress: 0.66, speed: 2, boosted: 100 })] },
      ui: { marches: [marchRow], toasts: [{ k: 'ok', icon: 'lightning', t: '+100% march speed used', m: 'Squad 1 arrives at Rustwater twice as fast', isNew: true }] }, marchSel: 'sq1', spot: { sel: '#mpop', pad: 6, march: 'sq1' },
      text: 'Using the +100% item halves the time left for the rest of the trip. The token visibly moves faster, and the pill, popup and Marches panel all show the new ETA. Only march speed-ups apply here; build and research speed-ups do not.' },
    { tag: 'Squad', title: 'Your squad on the map (3 of 3)', cam: { at: [88, 79], z: 0.38, dx: 120 }, map: { marches: [sq1({ progress: 0.72, phase: 'returning' })] },
      ui: { marches: [marchRow] }, marchSel: 'sq1', spot: { sel: '#mpop', pad: 6, march: 'sq1' }, was: [panelWas],
      text: 'Recall turns the march around where it stands, and it returns home along the same road. Recall is free while outbound; a gather recall keeps the load gathered so far. Once the march is returning, the Recall button is hidden.' },
    { tag: 'Capture', title: 'Rustwater is yours', cam: { at: [83, 62], z: 0.235 }, map: { owner: { 'home-B': 'you' }, pulses: [{ at: W.byId['home-T'].seed, color: '#ffd38a', r: 46 }, { at: W.byId['red-A'].seed, color: '#ffd38a', r: 46 }] },
      ui: { toasts: [{ k: 'ok', icon: 'check', t: 'Rustwater captured', m: '+10% water gather · Red Lowlands and Ember Reach come out of the fog', isNew: true }] },
      text: 'The garrison falls and Rustwater turns green. Its buff, +10% water gather, applies at once. Its connected neighbours come out of the fog: Red Lowlands, and Ember Reach across Cinder Pass, which Red Talon holds.' },
    { tag: 'Pacing', title: 'Pacing by strength', cam: { at: [79, 80], z: 0.34, dx: 170 }, map: { owner: { 'home-B': 'you' }, attackable: ['home-A', 'home-T', 'red-A'],
      mapPills: [{ at: L('home-A'), dy: 22, text: 'SKIPPED · STILL NEUTRAL', color: '#cdbb9c' }] },
      card: { prov: 'home-T', why: 'Ashwood can wait. There is no "clear every lower tier" rule: if the forecast says you are strong enough, go.' },
      text: 'You skip the second Swap Market and go straight for the Township of Red Lowlands. It is connected to Rustwater, and the forecast is amber, so you are strong enough. Strength decides the pace, not a checklist.' },
    { tag: 'Supply', title: 'Cut off', cam: { at: [84, 68], z: 0.25 }, map: { owner: { 'home-B': 'red', 'home-T': 'you' },
      marches: [{ id: 'rt', chain: ['red-A', 'home-B'], color: '#e05a3d', dotted: true, noMover: true, hostile: true }],
      mapPills: [{ at: L('red-A'), dy: 22, text: 'FOG RE-FORMED', color: '#cdbb9c' }] },
      ui: { legendExtra: true, toasts: [{ k: 'bad', icon: 'skull', t: 'Rustwater lost to Red Talon', m: 'Red Lowlands is cut off · +15% food buff paused', isNew: true }] },
      tags: [{ at: L('home-T'), dy: -26, text: 'Cut-off state', kind: 'new' }],
      text: 'Red Talon takes Rustwater through Cinder Pass. Red Lowlands is still yours, but no held road links it to Home Refuge, so it shows "cut off" and its buff pauses until you retake Rustwater or take Ashwood. Ember Reach was visible only through Rustwater, so it fogs over again.' },
    { tag: 'Warlords', title: 'Warlord quarters', cam: { at: [72, 26], z: 0.185 }, map: { owner: { 'home-B': 'you', 'home-T': 'you', 'ruin-red': 'red' }, scouted: ['red-A', 'red-B', 'red-T', 'red-S', 'red-seat', 'ruin-red', 'cov-A', 'cov-T'],
      contested: { 'ruin-red': ['red', 'cov'] }, warCamps: ['wc-red-A-CinderPass', 'wc-red-B-GravelPass'] },
      ui: { legendExtra: true },
      text: 'Scouted, Red Talon\'s quarter shows in its colour: the seat, both Swap Markets and the Township. War-camp slots wait on its side of Cinder Pass and Gravel Pass; the AI fills them later. Old Transit, a Ruin City between Red Talon and the Covenant, is contested.' },
    { tag: 'Camps', title: 'Real levels and respawn', cam: { at: pk.rlCamp.at.map((v, i) => (v + pk.newSlot[i]) / 2), z: 0.62 },
      map: { owner: { 'home-B': 'you', 'home-T': 'you' }, respawn: { from: pk.rlCamp.at, to: pk.newSlot, level: pk.rlCamp.level }, campMoves: { [pk.rlCamp.id]: pk.newSlot } },
      card: { poi: pk.rlCamp.id, moved: true, side: 'right' },
      text: `A camp's level now picks its monster and scales its stats: this L${pk.rlCamp.level} camp holds a ${pk.rlCamp.monster}, never a frost giant (those are L8). When you beat it, it respawns at a different free slot in the same province, so the map changes over time.` },
    { tag: 'Metropolis', title: 'Taking the Metropolis', cam: { at: [52, 54], z: 0.3 }, map: { owner: metroHeld, pulses: [{ at: [48, 48], color: '#ffd38a', r: 120 }] },
      ui: { title: { kicker: 'First capture · milestone', title: 'Warden of Command Ruin', text: '+5% all gather, map-wide · the title stays while you hold it' } },
      text: 'Your road reaches the centre through Saltmouth\'s gate. The first capture of the Metropolis is a milestone: a title and a map-wide buff. The game does not end here; the Metropolis becomes a permanent prize.' },
    { tag: 'Metropolis', title: 'Then the warlords come', cam: { at: [50, 44], z: 0.26 }, map: { owner: Object.assign({ 'cov-S': 'cov', 'ruin-red': 'cov' }, metroHeld),
      marches: [{ id: 'siege', squad: 'Covenant siege', chain: ['ruin-red', 'metro'], color: '#e05a3d', progress: 0.06, still: true, totalSec: 20530 / 0.94, pill: true, route: 'always', hostile: true }],
      mapPills: [{ at: L('red-S'), dy: 22, text: 'RED TALON WAITS · ONE COUNTDOWN AT A TIME', color: '#e05a3d' }] },
      ui: { marches: [{ name: 'Covenant siege → Command Ruin', status: 'Massing', pct: 18, time: '5:42:10', icon: 'sword', threat: true }], banner: { title: 'IRON COVENANT SIEGE', text: 'Command Ruin in', time: '5:42:10' } },
      text: 'After that, the warlords besiege the Metropolis like any other target, under the fairness rules: one hostile countdown at a time, never landing while you are offline, and 12h of calm after an assault. Red Talon waits its turn. Losing it drops the title and buff, but does not re-fog the map.' },
    { tag: 'Phone', title: 'On a phone', overlay: 'phone', cam: { at: [86, 80], z: 0.3 }, map: { owner: {}, marches: [sq1({ progress: 0.62 })] },
      text: 'The same map at 390×844. The Marches panel collapses into a chip and the legend folds into a key button, so the map gets the screen. The zoom bands and the label rules are the same as on desktop.' },
    { tag: 'Summary', title: 'What changed', overlay: 'summary', cam: FAR, map: { fog: false },
      text: 'Every surface this rework touches, with the old version named. NEW items have no equivalent today. Explore mode (top right) lets you pan, zoom, switch bands, toggle fog and click any province or POI.' },
  ];
}

root.Steps = { buildSteps, derive, BASE_OWNER, FAR };
})(globalThis);
