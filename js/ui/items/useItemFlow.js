import { eventBus } from '../../core/EventBus.js';
import { INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';
import { openSpeedupPicker } from '../buildings/SpeedupPicker.js';
import { getActiveQueues } from '../trading/activeQueues.js';
import { activateBoostItem } from '../buffs/confirmReplace.js';
import { ACTION_OF_TYPE } from '../inventory/inventoryTabs.js';

const fmt = (n) => Number(n).toLocaleString();
const joinEntries = (map, sep) => Object.entries(map).map(([k, v]) => sep(k, v)).join(', ');

function warn(systems, reason) {
  eventBus.emit('ui:error');
  systems.notifications?.show('warning', 'Cannot Use', reason);
}

function resourceToast(systems, cfg, result) {
  let text = joinEntries(result.grants ?? {}, (k, v) => `+${fmt(v)} ${k}`);
  if (result.lost && Object.keys(result.lost).length) {
    text += ` · ${joinEntries(result.lost, (k, v) => `${fmt(v)} ${k}`)} lost to storage cap`;
  }
  systems.notifications?.show('success', cfg.name, text);
}

function applyUse(systems, itemId, cfg, qty) {
  const result = systems.inventory.useItem(itemId, { qty });
  if (!result.success) {
    warn(systems, result.reason);
    return result;
  }
  resourceToast(systems, cfg, result);
  return result;
}

function viewportCentreRect() {
  const left = window.innerWidth / 2;
  const top = window.innerHeight / 2;
  return { left, top, right: left, bottom: top, width: 0, height: 0 };
}

function openSpeedup(systems, cfg, anchorEl) {
  const queueType = cfg.target === 'any' ? null : cfg.target;
  const active = getActiveQueues(systems);
  const running = queueType ? active[queueType] : active.building ?? active.training ?? active.research;
  if (!running) {
    systems.notifications?.show('info', 'Nothing to speed up', 'Start a build, training or research first.');
    return null;
  }
  openSpeedupPicker({
    anchorRect: anchorEl?.getBoundingClientRect() ?? viewportCentreRect(),
    queueType: queueType ?? Object.keys(active).find(k => active[k]),
    secsLeft: running.secsLeft,
    inventory: systems.inventory,
    notifications: systems.notifications,
  });
  return null;
}

async function activateBoost(systems, itemId) {
  const result = await activateBoostItem(systems, itemId);
  if (result && !result.success) warn(systems, result.reason);
  return result;
}

export async function useItemFlow({ systems, itemId, qty = 1, anchorEl = null }) {
  const cfg = INVENTORY_ITEMS[itemId];
  const action = cfg && ACTION_OF_TYPE[cfg.type];
  if (!action || action === 'none') return null;
  if (action === 'boost') return activateBoost(systems, itemId);
  if (action === 'speedup') return openSpeedup(systems, cfg, anchorEl);
  if (action === 'recruit') {
    eventBus.emit('ui:navigateTo', 'heroes');
    eventBus.emit('ui:openHeroesTab', 'recruit');
    return null;
  }
  if (action === 'hero') {
    eventBus.emit('ui:navigateTo', 'heroes');
    if (cfg.type === 'hero_fragment') eventBus.emit('ui:openHeroDetail', cfg.targetHeroId);
    return null;
  }
  return applyUse(systems, itemId, cfg, qty);
}
