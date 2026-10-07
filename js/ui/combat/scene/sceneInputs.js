import { commanderSlots, placedHeroes } from '../commanderModel.js';
import { stageById } from '../../../systems/campaign/campaignStages.js';

const BOSS_KINDS = new Set(['boss', 'elite']);

const stackIdOf = (slot) => (slot?.unitId && slot.count > 0 ? `${slot.unitId}_t${slot.tier}` : null);

function bossWaveIndex(stageId) {
  const stage = stageById(stageId);
  return stage && BOSS_KINDS.has(stage.kind) ? stage.monster.waves.length - 1 : null;
}

export function sceneInputs(systems, { stageId, squadId }) {
  const { barracksId, squadHeroes, supportHeroes } = placedHeroes(systems, squadId);
  const slots = commanderSlots(systems, squadId, barracksId);
  const led = squadHeroes.map(({ heroId, slotIndex }) => ({
    heroId, slotIndex, stackId: stackIdOf(slots[slotIndex]),
  }));
  const heroesBySlot = {};
  for (const { heroId, stackId } of led) if (stackId && !heroesBySlot[stackId]) heroesBySlot[stackId] = heroId;
  const ledSlots = new Set(led.map(h => h.slotIndex));
  return {
    heroesBySlot,
    bossWaveIndex: bossWaveIndex(stageId),
    squadHeroes: led,
    supportHeroes: supportHeroes.map(({ heroId }) => ({ heroId })),
    emptySlots: slots
      .filter(slot => slot.lockedAt === null && stackIdOf(slot) && !ledSlots.has(slot.slotIndex))
      .map(slot => slot.slotIndex),
  };
}
