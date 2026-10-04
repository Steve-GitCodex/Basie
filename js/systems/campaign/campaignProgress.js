import { BUILDINGS_CONFIG } from '../../entities/GAME_DATA.js';

function unmetRequirements(requires, getBuildingLevel) {
  return Object.entries(requires || {}).filter(([buildingId, level]) => getBuildingLevel(buildingId) < level);
}

function requirementText(unmet) {
  const parts = unmet.map(([buildingId, level]) => `${BUILDINGS_CONFIG[buildingId]?.name || buildingId} Lv.${level}`);
  return `Requires: ${parts.join(', ')}`;
}

function lockFor(stage, previousTrail, bossOfChapter, isDone, getBuildingLevel) {
  if (stage.kind === 'elite') {
    const boss = bossOfChapter.get(stage.chapter);
    return boss && !isDone(boss.id) ? `Defeat ${boss.name} first` : null;
  }
  if (previousTrail && !isDone(previousTrail.id)) {
    return previousTrail.chapter === stage.chapter
      ? `Clear ${previousTrail.name} first`
      : `Defeat ${previousTrail.name} first`;
  }
  const unmet = unmetRequirements(stage.requires, getBuildingLevel);
  return unmet.length ? requirementText(unmet) : null;
}

export function stageStates(stages, { bestStars }, getBuildingLevel) {
  const isDone = id => (bestStars[id] || 0) > 0;
  const bossOfChapter = new Map(stages.filter(s => s.kind === 'boss').map(s => [s.chapter, s]));
  const states = new Map();
  let previousTrail = null;

  stages.forEach(stage => {
    const lockReason = lockFor(stage, previousTrail, bossOfChapter, isDone, getBuildingLevel);
    const isLocked = lockReason !== null;
    states.set(stage.id, {
      isLocked,
      isAvailable: !isLocked,
      isCompleted: isDone(stage.id),
      bestStars: bestStars[stage.id] || 0,
      lockReason
    });
    if (stage.kind !== 'elite') previousTrail = stage;
  });

  return states;
}

export function currentStageId(stages, states) {
  const trail = stages.filter(s => s.kind !== 'elite');
  const open = trail.find(s => !states.get(s.id).isLocked && !states.get(s.id).isCompleted);
  const lastCleared = trail.findLast(s => states.get(s.id).isCompleted);
  return (open || lastCleared || trail[0]).id;
}
