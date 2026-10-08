import { eventBus } from '../../core/EventBus.js';

const RESOURCES = ['wood', 'stone', 'iron', 'food', 'water', 'money'];

export const BUFF_REFRESH_EVENTS = [
  'buffs:changed', 'world:buffsChanged', 'resources:bonusChanged',
  'user:vipUpdate', 'heroes:updated', 'events:started', 'events:expired',
  'inventory:updated',
];

export const BUFF_RATES_EVENT = 'resources:ratesChanged';

export function rateSignature(getBreakdown) {
  return RESOURCES
    .map(r => (getBreakdown?.(r)?.multiplier ?? 1).toFixed(6))
    .join('|');
}

export function subscribeBuffRefresh(systems, handler, extraEvents = []) {
  for (const name of [...BUFF_REFRESH_EVENTS, ...extraEvents]) eventBus.on(name, handler);
  const read = () => rateSignature(r => systems.rm?.getRateBreakdown?.(r));
  let last = read();
  eventBus.on(BUFF_RATES_EVENT, () => {
    const next = read();
    if (next === last) return;
    last = next;
    handler();
  });
}
