import { escapeHtml } from '../uiUtils.js';

export function neighbourIds(order, heroId) {
  if (order.length === 0) return { prev: null, next: null };
  const index = order.indexOf(heroId);
  if (index === -1) return { prev: order[order.length - 1], next: order[0] };
  if (order.length === 1) return { prev: null, next: null };
  return {
    prev: order[(index - 1 + order.length) % order.length],
    next: order[(index + 1) % order.length],
  };
}

const firstName = hero => escapeHtml(String(hero.name ?? '').split(' ')[0]);

export function detailNavHtml(prevHero, nextHero) {
  return `
    <button type="button" class="hq-nav hq-nav--back" data-action="nav-back">‹ Roster</button>
    ${prevHero ? `<button type="button" class="hq-nav hq-nav--prev" data-action="nav-go" data-hero-id="${prevHero.id}">‹ ${firstName(prevHero)}</button>` : ''}
    ${nextHero ? `<button type="button" class="hq-nav hq-nav--next" data-action="nav-go" data-hero-id="${nextHero.id}">${firstName(nextHero)} ›</button>` : ''}`;
}
