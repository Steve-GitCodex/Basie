import { INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';
import { xpPerUnit } from '../../systems/inventory/itemYield.js';
import { iconFromEmoji } from '../icons.js';
import { escapeHtml } from '../uiUtils.js';

export function xpItemsFor(heroId) {
  return Object.values(INVENTORY_ITEMS)
    .map(cfg => ({
      id: cfg.id,
      name: cfg.name,
      icon: cfg.icon,
      xp: xpPerUnit(cfg),
      fragment: cfg.type === 'hero_fragment',
      targetHeroId: cfg.targetHeroId,
    }))
    .filter(item => item.xp > 0 && (!item.fragment || item.targetHeroId === heroId))
    .sort((a, b) => Number(a.fragment) - Number(b.fragment) || a.xp - b.xp);
}

function rowHtml(item, owned) {
  const name = escapeHtml(item.name);
  return `
    <div class="hero-levelup__row${item.fragment ? ' hero-levelup__row--fragment' : ''}" data-item-id="${item.id}">
      <span class="hero-levelup__icon">${iconFromEmoji(item.icon)}</span>
      <span class="hero-levelup__meta">
        <b>${name}</b>
        <small>+${item.xp.toLocaleString()} XP · own <span data-owned>${owned}</span></small>
      </span>
      <span class="hero-levelup__step">
        <button type="button" class="hero-levelup__stepbtn" data-act="dec" aria-label="Fewer ${name}">−</button>
        <span class="hero-levelup__qty" data-qty>0</span>
        <button type="button" class="hero-levelup__stepbtn" data-act="inc" aria-label="More ${name}">+</button>
      </span>
    </div>`;
}

export function rowsHtml(items, ownedOf) {
  const render = list => list.map(i => rowHtml(i, ownedOf(i.id))).join('');
  const plain = render(items.filter(i => !i.fragment));
  const frags = render(items.filter(i => i.fragment));
  const fragGroup = frags
    ? `<div class="hero-levelup__group"><span>Fragments</span><small>also used for awakening · never auto-picked</small></div>${frags}`
    : '';
  return `<div class="hero-levelup__group"><span>XP items</span></div>${plain}${fragGroup}`;
}
