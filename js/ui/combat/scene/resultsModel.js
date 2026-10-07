import { COMBAT_RULES } from '../../../entities/data/combatRules.js';
import { UNITS_CONFIG } from '../../../entities/GAME_DATA.js';
import { SURVIVAL_STAGE_ID, stageById, trailStages } from '../../../systems/campaign/campaignStages.js';
import { battleSummary } from '../../../systems/combat/report/battleSummary.js';
import { defeatAnalysis } from '../../../systems/combat/report/defeatAnalysis.js';
import { turningPoint } from '../../../systems/combat/report/battleMoments.js';
import { bossLeftPct, wavesReached } from '../../../systems/combat/combatInputs.js';

function nextStage(stageId) {
  const trail = trailStages();
  const index = trail.findIndex(stage => stage.id === stageId);
  const next = index >= 0 ? trail[index + 1] : null;
  return next ? { id: next.id, name: next.name } : null;
}

function defeatReason(report, reached) {
  if (report.victory || reached < 1) return null;
  const capped = report.waves[reached - 1].rounds.length >= COMBAT_RULES.ROUND_CAP;
  return capped ? `Round limit reached in wave ${reached}` : `Your squad was wiped out in wave ${reached}`;
}

const leadOf = (frame) => frame.sides.attacker.strengthPct - frame.sides.defender.strengthPct;

function pivotOf(report, timeline) {
  const frames = timeline?.frames ?? [];
  if (!report.victory && frames.slice(1).every(frame => leadOf(frame) <= 0)) return { frame: 0, neverLed: true };
  const frame = frames.length ? turningPoint(report, timeline) : 0;
  const at = frames[frame];
  return { frame, neverLed: false, wave: (at?.waveIndex ?? 0) + 1, round: at?.round ?? 0 };
}

function mainDamageStack(report) {
  const damage = {};
  for (const wave of report.waves) {
    for (const round of wave.rounds) {
      for (const event of round.events ?? []) {
        if (event.kind !== 'strike' || event.side !== 'attacker') continue;
        damage[event.fromId] = (damage[event.fromId] ?? 0) + event.hits.reduce((sum, hit) => sum + hit.damage, 0);
      }
    }
  }
  const stacks = report.initial.attacker;
  return [...stacks].sort((a, b) => (damage[b.id] ?? 0) - (damage[a.id] ?? 0))[0] ?? null;
}

function trainerFor(report) {
  const stack = mainDamageStack(report);
  return UNITS_CONFIG[stack?.type]?.buildingId ?? null;
}

function progressPct(entry) {
  return entry?.xpToNext > 0 ? Math.round((entry.xp / entry.xpToNext) * 100) : 0;
}

function heroMeta(summary, roster, squadHeroes) {
  const byId = new Map(roster.map(entry => [entry.id, entry]));
  const labels = new Map(summary.stacks.map(stack => [stack.id, stack.label]));
  const stackOf = new Map(squadHeroes.map(hero => [hero.heroId, hero.stackId]));
  const meta = {};
  for (const hero of summary.heroes) {
    const entry = byId.get(hero.heroId);
    const leveled = hero.xp && hero.xp.levelAfter > hero.xp.levelBefore;
    meta[hero.heroId] = {
      level: hero.xp?.levelAfter ?? entry?.level ?? 1,
      tier: entry?.tier ?? 'normal',
      stackLabel: labels.get(stackOf.get(hero.heroId)) ?? null,
      xpFrom: leveled ? 0 : progressPct(entry),
    };
  }
  return meta;
}

export function resultsModel({ result, stageId, inputs, timeline = null, prior = {}, roster = [], title = '' }) {
  const { report } = result;
  const isSurvival = stageId === SURVIVAL_STAGE_ID;
  const stage = isSurvival ? null : stageById(stageId) ?? null;
  const emptySlots = inputs.emptySlots ?? [];
  const summary = battleSummary({ report, stage, heroXp: result.heroXp ?? [], squadHeroes: inputs.squadHeroes ?? [], emptySlots, heroesBySlot: inputs.heroesBySlot });
  const reached = wavesReached(report);
  const firstClear = report.victory && stage && !prior.firstCleared ? stage.firstClear?.diamond ?? 0 : 0;
  return {
    title,
    isSurvival,
    summary,
    healedTotal: Object.values(report.healed ?? {}).reduce((sum, count) => sum + count, 0),
    analysis: defeatAnalysis({ report, emptySlots: emptySlots.length }),
    reason: defeatReason(report, reached),
    previous: isSurvival ? null : prior.lastReport ?? null,
    current: { wavesReached: reached, bossLeftPct: bossLeftPct(report), waveName: stage?.monster.waves[reached - 1]?.name ?? `Wave ${reached}` },
    rewards: result.rewards ?? null,
    reducedReward: !!result.reducedReward,
    firstClearDiamonds: firstClear,
    next: report.victory && stage ? nextStage(stageId) : null,
    heroMeta: heroMeta(summary, roster, inputs.squadHeroes ?? []),
    turningPoint: pivotOf(report, timeline),
    trainBuildingId: trainerFor(report),
    supportHeroes: (inputs.supportHeroes ?? []).map(({ heroId }) => {
      const entry = roster.find(candidate => candidate.id === heroId);
      return { heroId, level: entry?.level ?? 1, tier: entry?.tier ?? 'normal' };
    }),
  };
}
