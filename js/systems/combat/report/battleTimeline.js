import { COMBAT_RULES } from '../../../entities/data/combatRules.js';

const { ROWS } = COMBAT_RULES;

const OPPOSITE = { attacker: 'defender', defender: 'attacker' };

const fullPool = (stack) => stack.startCount * stack.hp;
const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const hitDamage = (hits) => hits.reduce((sum, hit) => sum + hit.damage, 0);

function emptyRoundStats() {
  return {
    lost: { attacker: {}, defender: {} },
    healed: {},
    counter: { attacker: {}, defender: {} },
    arrows: [],
    floats: [],
    heroKills: {},
    skills: [],
  };
}

function addTo(map, key, amount) {
  map[key] = (map[key] ?? 0) + amount;
}

function recordHits(stats, targetSide, hits) {
  for (const { targetId, damage, kills } of hits) {
    const value = Math.round(damage);
    if (value > 0) stats.floats.push({ stackId: targetId, kind: 'dmg', value });
    if (kills > 0) stats.floats.push({ stackId: targetId, kind: 'kill', value: kills });
    addTo(stats.lost[targetSide], targetId, kills);
  }
}

function recordHealed(stats, stackId, count) {
  addTo(stats.healed, stackId, count);
  stats.floats.push({ stackId, kind: 'heal', value: count });
}

function recordStrikes(stats, strikes) {
  const sideTotal = { attacker: 0, defender: 0 };
  for (const event of strikes) sideTotal[event.side] += hitDamage(event.hits);
  for (const event of strikes) {
    const total = sideTotal[event.side];
    stats.arrows.push({ side: event.side, fromId: event.fromId, toRow: event.row, weight: total > 0 ? hitDamage(event.hits) / total : 0 });
    if (event.counterMult > 1) {
      const counters = stats.counter[event.side];
      counters[event.fromId] = Math.max(counters[event.fromId] ?? 0, event.counterMult);
    }
  }
}

function roundStats(events, defenderHp, heroesBySlot) {
  const stats = emptyRoundStats();
  for (const event of events) {
    if (event.kind === 'strike') {
      recordHits(stats, OPPOSITE[event.side], event.hits);
      const leader = event.side === 'attacker' ? heroesBySlot[event.fromId] : null;
      if (leader) addTo(stats.heroKills, leader, event.hits.reduce((sum, hit) => sum + hit.kills, 0));
    }
    else if (event.kind === 'heroStrike') {
      recordHits(stats, 'defender', event.hits);
      addTo(stats.heroKills, event.heroId, event.hits.reduce((sum, hit) => sum + hit.kills, 0));
    } else if (event.kind === 'heal') recordHealed(stats, event.stackId, Math.ceil(event.amount / (defenderHp[event.stackId] || 1)));
    else if (event.kind === 'revive') recordHealed(stats, event.stackId, event.count);
    else if (event.kind === 'skill') stats.skills.push(event);
  }
  recordStrikes(stats, events.filter((event) => event.kind === 'strike'));
  return stats;
}

function stackEntry(stack, snapshot, { lost, healed, counter, ledBy }) {
  return {
    id: stack.id,
    label: stack.label ?? stack.name,
    tier: stack.tier,
    type: stack.type,
    count: snapshot.count,
    startCount: stack.startCount,
    hpPct: percent(snapshot.hpPool, fullPool(stack)),
    delta: { lost: lost[stack.id] ?? 0, healed: healed[stack.id] ?? 0 },
    ledBy,
    counter: counter[stack.id] ?? null,
  };
}

function sideView(stacks, snapshots, stats, side, heroesBySlot) {
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const rows = Object.fromEntries(ROWS.map((row) => [row, []]));
  let pool = 0;
  let start = 0;
  for (const stack of stacks) {
    const snapshot = byId.get(stack.id) ?? stack;
    pool += snapshot.hpPool;
    start += fullPool(stack);
    rows[stack.row]?.push(stackEntry(stack, snapshot, {
      lost: stats.lost[side],
      healed: side === 'defender' ? stats.healed : {},
      counter: stats.counter[side],
      ledBy: side === 'attacker' ? heroesBySlot[stack.id] ?? null : null,
    }));
  }
  return { strengthPct: percent(pool, start), rows };
}

function skillCatalog(report) {
  const catalog = {};
  for (const wave of report.waves) {
    for (const round of wave.rounds) {
      for (const event of round.events) {
        if (event.kind !== 'skill') continue;
        catalog[event.heroId] ??= {};
        catalog[event.heroId][event.skillId] = 'ready';
      }
    }
  }
  return catalog;
}

function heroRoster(report, heroesBySlot, catalog) {
  const ids = new Set([...Object.values(heroesBySlot), ...Object.keys(catalog)]);
  for (const wave of report.waves) {
    for (const round of wave.rounds) {
      for (const event of round.events) if (event.kind === 'heroStrike') ids.add(event.heroId);
    }
  }
  return Object.fromEntries([...ids].map((id) => [id, 0]));
}

function advanceSkills(previous, fired) {
  const next = {};
  for (const [heroId, skills] of Object.entries(previous)) {
    next[heroId] = {};
    for (const [skillId, state] of Object.entries(skills)) next[heroId][skillId] = state === 'firing' ? 'used' : state;
  }
  for (const { heroId, skillId } of fired) next[heroId][skillId] = 'firing';
  return next;
}

function accumulateKills(previous, gained) {
  const next = { ...previous };
  for (const [heroId, kills] of Object.entries(gained)) addTo(next, heroId, kills);
  return next;
}

export function battleTimeline(report, { heroesBySlot = {}, bossWaveIndex = null } = {}) {
  const attackerStacks = report.initial.attacker;
  const defenderWaves = report.initial.defender;
  const firstFought = report.waves.findIndex((wave) => wave.rounds.length > 0);
  const openingWave = Math.max(firstFought, 0);
  const noStats = emptyRoundStats();

  let skills = skillCatalog(report);
  let heroKills = heroRoster(report, heroesBySlot, skills);
  const frames = [{
    index: 0,
    waveIndex: openingWave,
    round: 0,
    sides: {
      attacker: sideView(attackerStacks, attackerStacks, noStats, 'attacker', heroesBySlot),
      defender: sideView(defenderWaves[openingWave] ?? [], defenderWaves[openingWave] ?? [], noStats, 'defender', heroesBySlot),
    },
    arrows: [],
    floats: [],
    heroKills,
    skills,
  }];

  const waves = report.waves.map((wave, waveIndex) => {
    const firstFrame = frames.length;
    const defenders = defenderWaves[waveIndex] ?? [];
    const defenderHp = Object.fromEntries(defenders.map((stack) => [stack.id, stack.hp]));
    for (const round of wave.rounds) {
      const stats = roundStats(round.events, defenderHp, heroesBySlot);
      heroKills = accumulateKills(heroKills, stats.heroKills);
      skills = advanceSkills(skills, stats.skills);
      frames.push({
        index: frames.length,
        waveIndex,
        round: round.round,
        sides: {
          attacker: sideView(attackerStacks, round.attacker, stats, 'attacker', heroesBySlot),
          defender: sideView(defenders, round.defender, stats, 'defender', heroesBySlot),
        },
        arrows: stats.arrows,
        floats: stats.floats,
        heroKills,
        skills,
      });
    }
    return { index: waveIndex, name: wave.name, firstFrame, isBoss: waveIndex === bossWaveIndex };
  });

  for (const wave of waves) wave.firstFrame = Math.min(wave.firstFrame, frames.length - 1);
  return { frames, waves };
}
