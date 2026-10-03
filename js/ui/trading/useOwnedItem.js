import { eventBus } from '../../core/EventBus.js';
import { INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';
import { openSpeedupPicker } from '../buildings/SpeedupPicker.js';
import { getActiveQueues } from './activeQueues.js';

const NAVIGATE_TO_RECRUIT = new Set(['recruit_token', 'hero_card', 'hero_card_universal']);
const SIMPLE_USE_TITLES = { resource_bundle: 'Bundle Opened', buff: 'Boost Activated' };
let closePicker = null;

function warn(systems, title, reason) {
  eventBus.emit('ui:error');
  systems.notifications?.show('warning', title, reason);
}

function useSpeedup(cfg, anchorEl, systems) {
  const queueType = cfg.target === 'any' ? null : cfg.target;
  const active = getActiveQueues(systems);
  const running = queueType ? active[queueType] : active.building ?? active.training ?? active.research;
  if (!running) {
    systems.notifications?.show('info', 'Nothing to speed up', 'Start a build, training or research first.');
    return;
  }
  const type = queueType ?? Object.keys(active).find(k => active[k]);
  openSpeedupPicker({
    anchorRect: anchorEl.getBoundingClientRect(),
    queueType: type,
    secsLeft: running.secsLeft,
    inventory: systems.inventory,
    notifications: systems.notifications,
  });
}

function showHeroPicker(itemId, anchorEl, systems) {
  closePicker?.();
  const owned = (systems.heroes?.getRosterWithState?.() ?? []).filter(h => h.isOwned);
  if (!owned.length) {
    systems.notifications?.show('warning', 'No Heroes', 'Recruit a hero first.');
    return;
  }
  const picker = document.createElement('div');
  picker.className = 'tp-picker';
  picker.innerHTML = `
    <div class="tp-picker__label">Choose hero to receive XP</div>
    ${owned.map(h => `<button class="btn btn-xs btn-ghost tp-picker__hero" data-hero="${h.id}">${h.icon} ${h.name} <span>Lv.${h.level}</span></button>`).join('')}
    <button class="btn btn-xs btn-ghost tp-picker__cancel">Cancel</button>`;
  document.body.appendChild(picker);
  const rect = anchorEl.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - picker.offsetWidth - 8));
  const below = rect.bottom + 6;
  const top = below + picker.offsetHeight > window.innerHeight - 8 ? Math.max(8, rect.top - picker.offsetHeight - 6) : below;
  picker.style.left = `${left}px`;
  picker.style.top = `${top}px`;

  const onDoc = (e) => { if (!picker.contains(e.target)) close(); };
  function close() {
    picker.remove();
    document.removeEventListener('pointerdown', onDoc, true);
    if (closePicker === close) closePicker = null;
  }
  setTimeout(() => document.addEventListener('pointerdown', onDoc, true), 0);
  closePicker = close;

  picker.querySelector('.tp-picker__cancel').addEventListener('click', close);
  picker.querySelectorAll('.tp-picker__hero').forEach(btn => btn.addEventListener('click', () => {
    const heroId = btn.dataset.hero;
    close();
    const r = systems.inventory.useItem(itemId, { heroId });
    if (!r.success) return warn(systems, 'Cannot Apply', r.reason);
    const hero = owned.find(h => h.id === heroId);
    systems.notifications?.show('success', 'XP Applied', `+${r.xpAmount?.toLocaleString() ?? '?'} XP to ${hero?.name ?? heroId}`);
  }));
}

export function useOwnedItem(itemId, anchorEl, systems) {
  const cfg = INVENTORY_ITEMS[itemId];
  if (!cfg) return;
  if (cfg.type === 'speed_boost') return useSpeedup(cfg, anchorEl, systems);
  if (cfg.type === 'xp_bundle') return showHeroPicker(itemId, anchorEl, systems);
  if (NAVIGATE_TO_RECRUIT.has(cfg.type)) {
    eventBus.emit('ui:navigateTo', 'heroes');
    eventBus.emit('ui:openHeroesTab', 'recruit');
    return;
  }
  const r = systems.inventory.useItem(itemId);
  if (!r.success) return warn(systems, 'Cannot Use', r.reason);
  systems.notifications?.show('success', SIMPLE_USE_TITLES[cfg.type] ?? 'Item Used', cfg.name);
}
