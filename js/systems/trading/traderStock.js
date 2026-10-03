import {
  TRADER_POOL, TRADER_STOCK_SIZE, TRADER_DISCOUNT, PRICE_ROUNDING, RESOURCE_VALUE, INVENTORY_ITEMS, findShopEntry,
} from '../../entities/GAME_DATA.js';
import { pickWeighted } from './pickWeighted.js';

const FALLBACK_RESOURCE = 'wood';

const roundUp = amount => Math.max(PRICE_ROUNDING, Math.ceil(amount / PRICE_ROUNDING) * PRICE_ROUNDING);

function worthOf(poolEntry) {
  if (poolEntry.worth != null) return poolEntry.worth;
  const moneyCost = findShopEntry(poolEntry.itemId)?.moneyCost ?? 0;
  return moneyCost * RESOURCE_VALUE.money;
}

function pickResources(held, rng, exclude) {
  const options = Object.keys(held).filter(res => !exclude.includes(res) && res !== 'money' && res in RESOURCE_VALUE && held[res] > 0);
  if (options.length === 0) return [FALLBACK_RESOURCE];
  const order = [];
  while (options.length) order.push(...options.splice(Math.floor(rng() * options.length), 1));
  return order;
}

const share = (worth, count, res) => roundUp(worth / count / RESOURCE_VALUE[res]);
const fitsCap = (amount, cap) => !Number.isFinite(cap) || amount <= cap;

function chooseCount(worth, order, caps, rng) {
  const preferred = order.length > 1 && rng() < 0.5 ? 2 : 1;
  for (let count = preferred; count <= order.length; count++) {
    if (order.slice(0, count).every(res => fitsCap(share(worth, count, res), caps[res]))) return count;
  }
  return order.length;
}

export function priceInResources(worth, held, rng, caps = {}, exclude = []) {
  const order = pickResources(held, rng, exclude);
  const chosen = order.slice(0, chooseCount(worth, order, caps, rng));
  const cost = {};
  for (const res of chosen) cost[res] = share(worth, chosen.length, res);
  return cost;
}

function rollDiscount(rng) {
  if (rng() >= TRADER_DISCOUNT.chance) return 0;
  return TRADER_DISCOUNT.values[Math.floor(rng() * TRADER_DISCOUNT.values.length)];
}

const grantedResources = itemId => Object.keys(INVENTORY_ITEMS[itemId]?.grants ?? {});

export function generateStock({ held, caps = {}, rng }) {
  const remaining = [...TRADER_POOL];
  const stock = [];
  for (let i = 0; i < TRADER_STOCK_SIZE; i++) {
    const [entry] = remaining.splice(remaining.indexOf(pickWeighted(remaining, rng)), 1);
    const discountPct = rollDiscount(rng);
    const worth = worthOf(entry) * (1 - discountPct / 100);
    stock.push({ slotId: `slot${i}`, itemId: entry.itemId, cost: priceInResources(worth, held, rng, caps, grantedResources(entry.itemId)), discountPct, sold: false });
  }
  return stock;
}
