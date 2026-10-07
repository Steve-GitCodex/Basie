import { eventBus } from '../../../core/EventBus.js';

const barracksIndex = (squad) => Number(squad?.barracksInstanceId?.split('_').pop()) || 0;

export function routeFix(fix, { squad = null, trainBuildingId = null } = {}) {
  if (fix === 'heroes') {
    eventBus.emit('ui:navigateTo', 'heroes');
    return;
  }
  eventBus.emit('ui:navigateTo', 'base');
  if (fix === 'train') eventBus.emit('ui:openTraining', { buildingId: trainBuildingId });
  else eventBus.emit('ui:openSquads', { instanceIndex: barracksIndex(squad) });
}
