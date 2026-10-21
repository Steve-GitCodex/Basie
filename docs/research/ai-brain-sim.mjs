// THROWAWAY PROTOTYPE (P1) — faction-brain simulator. Not game code.
// node sim.mjs [--days=30] [--seed=7] [--player=mixed|aggressive|peaceful] [--log=player|all|none] [--logDays=5]

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const DAYS = +(args.days ?? 30);
const SEED = +(args.seed ?? 7);
const LOG = args.log ?? 'player';
const LOG_DAYS = +(args.logDays ?? 5);
const PROFILE = args.player ?? 'mixed';

const MIN = 1, HOUR = 60, DAY = 1440;
const T = {
  thinkEvery: 7, thinkJitter: 3, topBand: 0.12, repeatPenalty: 0.6,
  cooldownH: { gift: 24, truce: 48, demand: 24, scout: 6, gather: 6, fortify: 8, claim: 4, rival: 8, raid: 3, assault: 12 },
  raidCountdown: 15, assaultCountdown: 180, claimCountdown: 60, rivalCountdown: 120, returnCountdown: 45,
  budgetPerHour: 0.03, budgetCap: 1.5, failsafeQuiet: 4 * DAY,
  cycle: [{ name: 'buildup', len: 1.2 * DAY, mult: 1 }, { name: 'peak', len: 0.6 * DAY, mult: 2 }, { name: 'calm', len: 1.2 * DAY, mult: 0.3 }],
  fort: 0.3, reinforce: 0.9, reinforceChance: 0.75,
  minRaid: 0.15, minAssault: 0.55,
  bonusMin: -0.4, bonusMax: 0.3, bonusDecayPerHour: 0.01, regionStrength: 0.12,
  calmAfterRaidH: 4, calmAfterAssaultH: 12, diploCooldownH: 24, betrayalTrustMax: 20, betrayalForeshadowH: 6, coverStandingMax: 20,
  minorCap: 3, minorSpawnEvery: [2 * DAY, 4 * DAY], minorStart: 0.05, minorSettlement: 0.2, minorStronghold: 0.45, minorFadeDays: 10,
  clearMinorPerOnlineHour: { camp: 0.03, settlement: 0.06, stronghold: 0.05 },
};
const PROFILES = {
  aggressive: { captureEvery: [2, 3], captureFactions: true, raidEvery: [0.8, 1.6], truceAccept: 0.4, demandPay: 0.2 },
  mixed: { captureEvery: [3, 4], captureFactions: true, raidEvery: [2.5, 4], truceAccept: 0.6, demandPay: 0.4 },
  peaceful: { captureEvery: [4, 5], captureFactions: false, raidEvery: null, truceAccept: 0.9, demandPay: 0.7 },
};
const PLAYER = PROFILES[PROFILE];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = rng(SEED);
const pick = arr => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + rand() * (hi - lo);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const clamp01 = x => clamp(x, 0, 1);
const logistic = (x, k = 10, mid = 0.5) => 1 / (1 + Math.exp(-k * (x - mid)));
const compensate = scores => { const p = scores.reduce((a, s) => a * s, 1); return p + (1 - p) * (1 - 1 / scores.length) * p; };

const ADJ = { r0: ['r1', 'r3'], r1: ['r0', 'r2', 'r4'], r2: ['r1', 'r5'], r3: ['r0', 'r4', 'r6'], r4: ['r1', 'r3', 'r5', 'r7'], r5: ['r2', 'r4', 'r8'], r6: ['r3', 'r7'], r7: ['r4', 'r6', 'r8'], r8: ['r5', 'r7'] };
const regions = {
  r0: { owner: 'goblins', base: 'goblins' }, r1: { owner: 'covenant', base: 'covenant' }, r2: { owner: 'covenant' },
  r3: { owner: 'goblins' }, r4: { owner: 'neutral', ruin: true }, r5: { owner: 'neutral' },
  r6: { owner: 'player', base: 'player' }, r7: { owner: 'bandits' }, r8: { owner: 'bandits', base: 'bandits' },
};

const MAJORS = [
  { id: 'bandits', name: 'Red Talon', ratio: 0.9, baseline: -30, trust: 10, w: { aggression: 1.0, greed: 0.6, patience: 0.2, loyalty: 0.2, opportunism: 0.5, expansion: 0.5, forgiveness: 0.4 } },
  { id: 'goblins', name: 'Scavengers', ratio: 0.7, baseline: -10, trust: 5, w: { aggression: 0.5, greed: 0.9, patience: 0.4, loyalty: 0.5, opportunism: 1.0, expansion: 0.4, forgiveness: 0.8 } },
  { id: 'covenant', name: 'Iron Covenant', ratio: 1.0, baseline: 0, trust: 25, w: { aggression: 0.4, greed: 0.4, patience: 1.0, loyalty: 0.9, opportunism: 0.1, expansion: 0.9, forgiveness: 0.6 } },
];
const ARCHETYPES = {
  raiders: { aggression: [0.7, 1.0], greed: [0.5, 0.8], growthPerDay: [0.06, 0.09], names: ['Ash', 'Rust', 'Bone', 'Grim'] },
  cultists: { aggression: [0.3, 0.6], greed: [0.2, 0.4], growthPerDay: [0.08, 0.11], names: ['Pale', 'Hollow', 'Ember', 'Veil'] },
  deserters: { aggression: [0.4, 0.7], greed: [0.6, 0.9], growthPerDay: [0.05, 0.07], names: ['Broken', 'Lost', 'Iron', 'Grey'] },
};
const NOUNS = ['Fangs', 'Choir', 'Brood', 'Legion', 'Crows', 'Kin'];

const factions = MAJORS.map(m => ({
  ...m, tier: 'major', alive: true, bonus: 0, fort: 0.2,
  mods: [{ reason: 'Baseline temperament', value: m.baseline, start: 0, life: Infinity }],
  plan: null, pending: null, nextThink: Math.floor(rand() * 10), truceUntil: -1, stats: {}, standingByDay: [], cooldowns: {}, memory: { seen: 0, reinforced: 0 }, foreshadowAt: 0,
}));

const P = { regionsLost: 0, regionsTaken: 0, raidsBounced: 0, raidsLanded: 0, assaultsHeld: 0, assaultsLost: 0, reinforced: 0, heldForLogin: 0, countdownOnlineMin: 0, onlineMin: 0, strikes: [], lastStrike: 0, betrayals: 0, gifts: 0, trucesAccepted: 0, trucesRefused: 0, demandsPaid: 0, demandsRefused: 0, wasOnline: false, regionsByDay: [] };
const M = { spawned: 0, cleared: 0, settlement: 0, stronghold: 0, regionsClaimed: 0, faded: 0, hoursToStronghold: [] };
const director = { budget: 0.3, calmUntil: 0 };
let now = 0, nextCapture = 1.5 * DAY, nextPlayerRaid = PLAYER.raidEvery ? 1.2 * DAY : Infinity, nextMinorSpawn = between(...T.minorSpawnEvery), minorSeq = 0;

const day = t => Math.floor(t / DAY);
const stamp = t => `d${day(t) + 1} ${String(Math.floor((t % DAY) / HOUR)).padStart(2, '0')}:${String(Math.floor(t % HOUR)).padStart(2, '0')}`;
const playerPower = t => 1000 * Math.pow(1 + 0.25 * (t / DAY), 1.5);
const online = t => { const m = t % DAY; return (m >= 8 * HOUR && m < 9 * HOUR) || (m >= 13 * HOUR && m < 13.5 * HOUR) || (m >= 20 * HOUR && m < 22 * HOUR); };
const log = (kind, msg) => { if (LOG === 'none' || day(now) >= LOG_DAYS) return; if (LOG === 'player' && kind !== 'player') return; console.log(`${stamp(now)}  ${msg}`); };

const ownedBy = id => Object.keys(regions).filter(r => regions[r].owner === id);
const playerRegions = () => ownedBy('player').filter(r => !regions[r].base);
const strengthRatio = f => f.tier === 'major' ? f.ratio * (1 + T.regionStrength * Math.min(ownedBy(f.id).length, 3)) * (1 + f.bonus) : f.share;
const hostileQueued = () => now < director.calmUntil || factions.some(f => f.alive && (f.plan?.vsPlayer || f.pending));
const budgetNow = () => (now - P.lastStrike > T.failsafeQuiet ? Math.max(director.budget, 0.8) : director.budget);
const targetsFor = kind => kind === 'raid' ? ownedBy('player') : playerRegions();
function expectedDefense(f) { const seen = f.memory.seen; const rate = (f.memory.reinforced + 0.25) / (seen + 1); return T.fort + rate * T.reinforce; }

function standing(f) {
  return clamp(f.mods.reduce((s, m) => s + (m.life === Infinity ? m.value : m.value * Math.max(0, 1 - (now - m.start) / m.life)), 0), -100, 100);
}
function addMod(f, reason, value, lifeHours) { f.mods.push({ reason, value, start: now, life: lifeHours * HOUR / (value < 0 ? f.w.forgiveness + 0.4 : 1) }); }
const band = s => s < -60 ? 'Hostile' : s < -20 ? 'Unfriendly' : s <= 20 ? 'Neutral' : s <= 60 ? 'Friendly' : 'Allied';
const count = (f, key) => { f.stats[key] = (f.stats[key] ?? 0) + 1; };
function phase() {
  const total = T.cycle.reduce((s, c) => s + c.len, 0); let t = now % total;
  for (const c of T.cycle) { if (t < c.len) return c; t -= c.len; }
  return T.cycle[0];
}

function candidateActions(f) {
  const s = standing(f), hostility = clamp01((100 - s) / 200), friendship = 1 - hostility;
  const str = strengthRatio(f), rel = str / (str + 1), busy = online(now) ? 0.3 : 1, w = f.w, out = [];
  const truce = now < f.truceUntil;
  const openlyHostile = !truce && s < -20;
  const coveting = !truce && s <= T.coverStandingMax && w.expansion >= 0.8 && playerRegions().length > ownedBy(f.id).length && playerRegions().some(r => ADJ[r].some(a => regions[a].owner === f.id));
  const betrayal = !openlyHostile && !coveting && f.foreshadowAt && now - f.foreshadowAt >= T.betrayalForeshadowH * HOUR;
  const canHitPlayer = (openlyHostile || betrayal || coveting) && !hostileQueued();
  const winnable = share => Math.min(str * share, budgetNow()) > expectedDefense(f);
  const diploReady = now >= (f.diploUntil ?? 0);
  const affordable = need => director.budget >= need || now - P.lastStrike > T.failsafeQuiet;

  out.push({ kind: 'idle', score: 0.05 });
  out.push({ kind: 'gather', score: w.greed * compensate([clamp01(1 - f.bonus / T.bonusMax), 0.6]) });
  if (f.tier === 'major') {
    out.push({ kind: 'fortify', score: w.patience * compensate([clamp01(1 - f.fort / 0.6), 0.5]) });
    out.push({ kind: 'scout', score: w.patience * 0.25 });
    if (canHitPlayer && affordable(T.minRaid) && winnable(0.35)) out.push({ kind: 'raid', vsPlayer: true, betrayal, score: w.aggression * compensate([logistic(hostility, 8, 0.45), busy * (0.5 + 0.5 * w.opportunism), 0.8]) });
    if (canHitPlayer && playerRegions().length && affordable(T.minAssault) && winnable(0.7)) out.push({ kind: 'assault', vsPlayer: true, betrayal, coveting, score: (w.aggression + w.patience) / 2 * compensate([logistic(hostility, 8, 0.55), logistic(rel, 8, 0.4), 0.9]) });
    const neutral = Object.keys(regions).filter(r => regions[r].owner === 'neutral' && !regions[r].ruin && ADJ[r].some(a => regions[a].owner === f.id));
    if (neutral.length) out.push({ kind: 'claim', target: pick(neutral), score: w.expansion * compensate([logistic(rel, 8, 0.35), 0.8]) });
    const rivals = factions.filter(o => o !== f && o.alive && o.tier === 'major' && ownedBy(o.id).some(r => !regions[r].base && ADJ[r].some(a => regions[a].owner === f.id)));
    if (rivals.length) { const r = pick(rivals); if (str * 0.6 > strengthRatio(r) * (0.3 + r.fort)) out.push({ kind: 'rival', rival: r, score: w.aggression * 0.6 * compensate([clamp01(str / (str + strengthRatio(r))), 0.7]) }); }
    if (diploReady && s >= -10) out.push({ kind: 'gift', score: w.loyalty * compensate([logistic(friendship, 6, 0.5), clamp01(1 / (str + 1)), 0.5]) * 0.5 });
    if (diploReady && hostility > 0.55 && rel < 0.5 && !truce) out.push({ kind: 'truce', score: w.loyalty * compensate([hostility, 1 - rel, 0.6]) * 0.6 });
    if (diploReady && s < 0 && rel > 0.45 && (f.bonus < 0 || f.mods.some(m => m.reason.startsWith('You took') && now - m.start < DAY))) out.push({ kind: 'demand', score: w.greed * compensate([hostility, rel, 0.5]) * 0.5 });
  } else {
    if (canHitPlayer && affordable(T.minRaid) && winnable(0.5)) out.push({ kind: 'raid', vsPlayer: true, score: w.aggression * compensate([busy, 0.7]) });
    if (f.stage === 'stronghold' && regions[f.region].owner !== f.id) {
      const vsPlayer = regions[f.region].owner === 'player';
      if (!vsPlayer || (canHitPlayer && affordable(T.minAssault))) out.push({ kind: vsPlayer ? 'assault' : 'claim', target: f.region, vsPlayer, score: w.aggression * 0.9 });
    }
  }
  return out
    .filter(a => now >= (f.cooldowns[a.kind] ?? 0))
    .map(a => (a.kind === f.lastKind ? { ...a, score: a.score * T.repeatPenalty } : a))
    .filter(a => a.score > 0.01);
}

function think(f) {
  const acts = candidateActions(f);
  const best = Math.max(...acts.map(a => a.score));
  const choice = pick(acts.filter(a => a.score >= best * (1 - T.topBand)));
  if (choice.kind !== 'idle') count(f, choice.kind);
  f.lastKind = choice.kind;
  if (T.cooldownH[choice.kind]) f.cooldowns[choice.kind] = now + T.cooldownH[choice.kind] * HOUR;
  if (['gift', 'truce', 'demand'].includes(choice.kind)) f.diploUntil = now + T.diploCooldownH * HOUR * between(0.7, 1.8);
  startPlan(f, choice);
}

function telegraph(f, a) {
  const isRaid = a.kind === 'raid', str = strengthRatio(f);
  const size = isRaid ? Math.max(T.minRaid, Math.min(str * (f.tier === 'minor' ? 0.5 : 0.35), budgetNow())) : Math.max(T.minAssault, Math.min(str * 0.7, budgetNow()));
  director.budget = Math.max(0, director.budget - size);
  const target = a.target && regions[a.target].owner === 'player' ? a.target : pick(targetsFor(a.kind));
  const countdown = isRaid ? T.raidCountdown : T.assaultCountdown;
  f.plan = { kind: a.kind, vsPlayer: true, target, size, strikeAt: now + countdown, telegraphedAt: now };
  if (a.betrayal) { P.betrayals++; f.trust = Math.max(0, f.trust - 15); count(f, 'betrayal'); f.foreshadowAt = 0; f.truceUntil = -1; }
  if (a.coveting) count(f, 'covet');
  log('player', `TELEGRAPH ${f.name} ${a.kind} on ${target} in ${countdown}m (size ${size.toFixed(2)}×pp vs fort ${T.fort})${a.betrayal ? ' [BETRAYAL]' : ''}${a.coveting ? ' [COVETS]' : ''}`);
}

function startPlan(f, a) {
  if (a.kind === 'idle' || a.kind === 'scout') return;
  if (a.kind === 'gather') { f.bonus = clamp(f.bonus + 0.05, T.bonusMin, T.bonusMax); if (f.tier === 'minor') f.share += 0.01; return; }
  if (a.kind === 'fortify') { f.fort = Math.min(0.6, f.fort + 0.05); return; }
  if (a.kind === 'gift') { addMod(f, 'Sent you a gift', 12, 48); f.trust = Math.min(50, f.trust + 1); P.gifts++; log('player', `${f.name} sends a gift caravan (standing ${standing(f).toFixed(0)})`); return; }
  if (a.kind === 'truce') {
    const accept = rand() < PLAYER.truceAccept;
    if (accept) { addMod(f, 'Truce', 40, 48); f.truceUntil = now + 48 * HOUR; f.trust = Math.min(50, f.trust + 3); P.trucesAccepted++; } else P.trucesRefused++;
    log('player', `${f.name} offers a truce → ${accept ? 'accepted (48h)' : 'refused'}`); return;
  }
  if (a.kind === 'demand') {
    const pay = rand() < PLAYER.demandPay;
    addMod(f, pay ? 'Paid tribute' : 'Refused demand', pay ? 10 : -10, 24); pay ? P.demandsPaid++ : P.demandsRefused++;
    log('player', `${f.name} demands tribute → ${pay ? 'paid' : 'refused'}`); return;
  }
  if (a.vsPlayer) {
    if (online(now)) telegraph(f, a);
    else { f.pending = a; P.heldForLogin++; }
    return;
  }
  if (a.kind === 'claim') { f.plan = { kind: 'claim', target: a.target, strikeAt: now + T.claimCountdown }; return; }
  if (a.kind === 'rival') {
    const target = pick(ownedBy(a.rival.id).filter(r => !regions[r].base && ADJ[r].some(x => regions[x].owner === f.id)));
    f.plan = { kind: 'rival', target, rival: a.rival, strikeAt: now + T.rivalCountdown };
  }
}

function resolvePlan(f) {
  const p = f.plan;
  f.plan = null;
  if (p.vsPlayer) {
    if (regions[p.target].owner !== 'player') return;
    const reinforced = rand() < T.reinforceChance;
    if (reinforced) P.reinforced++;
    f.memory.seen++; if (reinforced) f.memory.reinforced++;
    director.calmUntil = now + (p.kind === 'raid' ? T.calmAfterRaidH : T.calmAfterAssaultH) * HOUR;
    const won = p.size > T.fort + (reinforced ? T.reinforce : 0);
    P.strikes.push({ t: now, lead: now - p.telegraphedAt }); P.lastStrike = now;
    if (p.kind === 'raid') { won ? P.raidsLanded++ : P.raidsBounced++; }
    else if (won && regions[p.target].base) P.raidsLanded++;
    else if (won) {
      P.assaultsLost++; P.regionsLost++;
      regions[p.target].owner = f.tier === 'major' ? f.id : f.id;
      if (f.tier === 'minor') M.regionsClaimed++;
    } else P.assaultsHeld++;
    if (!won) f.bonus = clamp(f.bonus - 0.15, T.bonusMin, T.bonusMax);
    log('player', `STRIKE ${f.name} ${p.kind} ${p.target}: ${won ? 'LANDED' : 'repelled'}${reinforced ? ' (reinforced)' : ''}`);
  } else if (p.kind === 'claim') {
    if (regions[p.target].owner === 'neutral') { regions[p.target].owner = f.id; if (f.tier === 'minor') M.regionsClaimed++; log('all', `${f.name} claims ${p.target}`); }
  } else if (p.kind === 'rival') {
    if (regions[p.target].owner === p.rival.id && strengthRatio(f) * 0.5 > strengthRatio(p.rival) * (0.3 + p.rival.fort)) {
      regions[p.target].owner = f.id; p.rival.bonus = clamp(p.rival.bonus - 0.1, T.bonusMin, T.bonusMax); count(f, 'rivalWon');
      p.rival.mods.push({ reason: `${f.name} took ${p.target}`, value: 0, start: now, life: 1 });
      log('all', `${f.name} takes ${p.target} from ${p.rival.name}`);
    } else f.bonus = clamp(f.bonus - 0.1, T.bonusMin, T.bonusMax);
  }
}

function spawnMinor() {
  if (factions.filter(f => f.alive && f.tier === 'minor').length >= T.minorCap) return;
  const spots = Object.keys(regions).filter(r => !regions[r].base && !regions[r].ruin);
  const arch = pick(Object.keys(ARCHETYPES)), A = ARCHETYPES[arch];
  const f = {
    id: `minor_${++minorSeq}`, name: `${pick(A.names)} ${pick(NOUNS)}`, tier: 'minor', archetype: arch, stage: 'camp', region: pick(spots), alive: true,
    w: { aggression: between(...A.aggression), greed: between(...A.greed), patience: 0.3, loyalty: 0, opportunism: 0.6, expansion: 0.6, forgiveness: 0.5 },
    growthPerDay: between(...A.growthPerDay), share: T.minorStart, bonus: 0, fort: 0.1,
    mods: [{ reason: 'Rebels', value: -40, start: now, life: Infinity }],
    trust: 0, plan: null, pending: null, nextThink: now + 30, truceUntil: -1, stats: {}, born: now, cooldowns: {}, memory: { seen: 0, reinforced: 0 }, foreshadowAt: 0,
  };
  factions.push(f); M.spawned++;
  log('player', `REBEL CAMP ${f.name} (${arch}) appears in ${f.region}`);
}

function tickMinor(f) {
  if (now % HOUR === 0) f.share += f.growthPerDay / 24;
  if (f.stage === 'camp' && f.share >= T.minorSettlement) { f.stage = 'settlement'; M.settlement++; log('player', `${f.name} grows into a SETTLEMENT (${((now - f.born) / DAY).toFixed(1)}d)`); }
  if (f.stage === 'settlement' && f.share >= T.minorStronghold) { f.stage = 'stronghold'; M.stronghold++; M.hoursToStronghold.push((now - f.born) / HOUR); log('player', `${f.name} becomes a STRONGHOLD (${((now - f.born) / DAY).toFixed(1)}d)`); }
  if (online(now) && now % HOUR === 0 && rand() < T.clearMinorPerOnlineHour[f.stage]) {
    f.alive = false; f.plan = null; f.pending = null; M.cleared++;
    for (const r of ownedBy(f.id)) regions[r].owner = 'neutral';
    log('player', `Player clears ${f.name} (${f.stage})`);
  }
}

function playerScript() {
  if (now >= nextCapture) {
    nextCapture = now + between(...PLAYER.captureEvery) * DAY;
    const frontier = [...new Set(ownedBy('player').flatMap(r => ADJ[r]))]
      .filter(r => regions[r].owner !== 'player' && !regions[r].base && (PLAYER.captureFactions || regions[r].owner === 'neutral' || regions[r].owner.startsWith('minor_')));
    if (frontier.length) {
      const r = pick(frontier), prev = regions[r].owner; regions[r].owner = 'player'; P.regionsTaken++;
      const f = factions.find(x => x.id === prev);
      if (f) { addMod(f, `You took ${r}`, -30, 72); f.bonus = clamp(f.bonus - 0.1, T.bonusMin, T.bonusMax); }
      log('player', `Player captures ${r}${f ? ` from ${f.name}` : ''}`);
    }
  }
  if (now >= nextPlayerRaid) {
    nextPlayerRaid = now + between(...PLAYER.raidEvery) * DAY;
    addMod(pick(factions.filter(x => x.alive && x.tier === 'major')), 'You raided their camp', -15, 36);
  }
  const on = online(now);
  if (on && !P.wasOnline) {
    const queued = factions.filter(f => f.alive && f.pending);
    const first = queued.sort((a, b) => b.w.aggression - a.w.aggression)[0];
    for (const f of queued) { if (f === first && playerRegions().length) telegraph(f, f.pending); f.pending = null; }
    for (const f of factions) if (f.alive && f.plan?.vsPlayer) f.plan.strikeAt = Math.max(f.plan.strikeAt, now + T.returnCountdown);
  }
  P.wasOnline = on;
}

for (now = 0; now < DAYS * DAY; now += MIN) {
  director.budget = Math.min(T.budgetCap, director.budget + T.budgetPerHour * phase().mult / HOUR);
  playerScript();
  if (now >= nextMinorSpawn) { spawnMinor(); nextMinorSpawn = now + between(...T.minorSpawnEvery); }
  if (online(now)) P.onlineMin++;
  if (online(now) && hostileQueued()) P.countdownOnlineMin++;
  if (now % DAY === 0) P.regionsByDay.push(ownedBy('player').length);
  for (const f of factions) {
    if (!f.alive) continue;
    if (now % HOUR === 0) f.bonus += (0 - f.bonus) * T.bonusDecayPerHour;
    if (f.tier === 'minor') { tickMinor(f); if (!f.alive) continue; }
    if (f.tier === 'major' && now % DAY === 0) {
      f.standingByDay.push(standing(f));
      if (!f.foreshadowAt && standing(f) >= -20 && f.trust < T.betrayalTrustMax && rand() < f.w.opportunism * 0.25) { f.foreshadowAt = now; P.foreshadows = (P.foreshadows ?? 0) + 1; log('player', `FORESHADOW ${f.name}: trust is slipping, troops gathering (betrayal possible in ${T.betrayalForeshadowH}h+)`); }
      if (f.foreshadowAt && now - f.foreshadowAt > 2 * DAY) f.foreshadowAt = 0;
    }
    if (f.plan) {
      if (now >= f.plan.strikeAt) {
        if (f.plan.vsPlayer && !online(now)) f.plan.strikeAt = now + 1;
        else resolvePlan(f);
      }
      continue;
    }
    if (f.pending) continue;
    if (now >= f.nextThink) { think(f); f.nextThink = now + T.thinkEvery + Math.floor(rand() * T.thinkJitter); }
  }
}

const gaps = P.strikes.map((s, i) => (i ? s.t - P.strikes[i - 1].t : s.t));
const leadAvg = P.strikes.reduce((s, x) => s + x.lead, 0) / Math.max(1, P.strikes.length);
const spark = arr => arr.map(v => ' ▁▂▃▄▅▆▇█'[Math.round((v + 100) / 200 * 8)]).join('');
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;

console.log(`\n══ P1 summary — ${DAYS} days · seed ${SEED} · player ${PROFILE} ══`);
console.log(`Player power d1 ${playerPower(0).toFixed(0)} → d${DAYS} ${playerPower(DAYS * DAY).toFixed(0)} · regions owned/day ${P.regionsByDay.join('')}`);
console.log(`Strikes on player: ${P.strikes.length} (${(P.strikes.length / DAYS).toFixed(2)}/day) · raids landed ${P.raidsLanded} / bounced ${P.raidsBounced} · assaults held ${P.assaultsHeld} / lost ${P.assaultsLost}`);
console.log(`Reinforced ${P.reinforced} · plans queued for login ${P.heldForLogin} · avg telegraph lead ${leadAvg.toFixed(0)}m · longest quiet gap ${(Math.max(0, ...gaps) / DAY).toFixed(1)}d · online time under a hostile countdown ${(100 * P.countdownOnlineMin / P.onlineMin).toFixed(0)}%`);
console.log(`Regions: player took ${P.regionsTaken}, lost ${P.regionsLost} · foreshadows ${P.foreshadows ?? 0} → betrayals ${P.betrayals} · gifts ${P.gifts} · truces ${P.trucesAccepted} accepted / ${P.trucesRefused} refused · demands paid/refused ${P.demandsPaid}/${P.demandsRefused}`);
console.log(`Minors: spawned ${M.spawned}, cleared ${M.cleared}, →settlement ${M.settlement}, →stronghold ${M.stronghold} (avg ${(avg(M.hoursToStronghold) / 24).toFixed(1)}d), regions claimed ${M.regionsClaimed}`);
console.log('Major factions:');
for (const f of factions.filter(x => x.tier === 'major')) {
  const s = standing(f);
  console.log(`  ${f.name.padEnd(14)} str ${strengthRatio(f).toFixed(2)}×pp · regions ${ownedBy(f.id).length} · standing ${s.toFixed(0)} (${band(s)}) · trust ${f.trust.toFixed(0)}  standing/day ${spark(f.standingByDay)}`);
  console.log(`    ${Object.entries(f.stats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')}`);
}
