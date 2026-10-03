import { INVENTORY_ITEMS, findShopEntry } from '../../entities/GAME_DATA.js';
import { itemCard } from './tradeCards.js';

const CURRENCY_ICON = { money: '🪙', diamond: '💎' };

export function entryCard(shop, entryId, { reason = null, name = null } = {}) {
  const entry = findShopEntry(entryId);
  const cfg = entry && INVENTORY_ITEMS[entry.itemId];
  if (!cfg) return null;
  const state = shop.entryState(entryId);
  const currency = 'diamond' in state.cost ? 'diamond' : 'money';
  const amount = state.cost[currency] ?? 0;
  return itemCard({
    entryId,
    itemId: entry.itemId,
    name: name ?? cfg.name,
    icon: cfg.icon,
    rarity: cfg.rarity,
    reason,
    owned: state.owned,
    priceLabel: `${CURRENCY_ICON[currency]} ${amount.toLocaleString()}`,
    currency,
    canAfford: state.canAfford,
    status: state.status,
  });
}
