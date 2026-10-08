import { escapeHtml } from '../uiUtils.js';

export const RETIRED_TITLE = 'Recruitment scrolls have been retired — use Recruit Tokens instead.';

export function headHtml(item) {
  const rarity = escapeHtml(item.rarity ?? 'common');
  return `
    <div class="inv-detail__top">
      <div class="inv-detail__icon inv-detail__icon--${rarity}">${item.icon}</div>
      <div class="inv-detail__id">
        <div class="inv-detail__name">${escapeHtml(item.name)}</div>
        <div class="inv-detail__meta"><span class="inv-detail__rarity">${rarity}</span> · Owned ×<b class="inv-detail__owned"></b></div>
      </div>
    </div>
    <div class="inv-detail__desc">${escapeHtml(item.description ?? '')}</div>`;
}

function chipsHtml(heroes) {
  if (!heroes.length) return '<div class="inv-detail__hint inv-detail__hint--warn">Recruit a hero first</div>';
  const chips = heroes.map(h => `
    <button type="button" class="inv-hero-chip inv-pick-hero" data-act="chip" data-hero="${escapeHtml(h.id)}">
      <span>${h.icon ?? '🦸'}</span>${escapeHtml(h.name)} <small>Lv ${h.level}</small>
    </button>`).join('');
  return `<div class="inv-hero-picker">${chips}</div>`;
}

function qtyHtml() {
  return `
    <div class="inv-detail__qty">
      <button type="button" class="inv-qty__step" data-act="dec" aria-label="Decrease">−</button>
      <input class="inv-qty__slider" type="range" min="1" value="1">
      <button type="button" class="inv-qty__step" data-act="inc" aria-label="Increase">+</button>
      <input class="inv-qty__num" type="number" min="1" value="1">
    </div>
    <div class="inv-detail__preview"></div>`;
}

function useActsHtml(itemId, isHero) {
  const xp = isHero ? ' inv-use-xp' : '';
  return `
    <div class="inv-detail__acts">
      <button type="button" class="btn btn-sm btn-ghost inv-use-one" data-act="one" data-item="${itemId}">Use 1</button>
      <button type="button" class="btn btn-sm btn-success inv-use-n${xp}" data-act="many" data-item="${itemId}">Use</button>
    </div>`;
}

function mainActHtml(label, act, cls = 'btn-success') {
  return `<div class="inv-detail__acts"><button type="button" class="btn btn-sm ${cls} inv-act-main" data-act="${act}">${label}</button></div>`;
}

const BOOST_ACTS = `
  <div class="inv-detail__hint inv-detail__hint--warn hidden"></div>
  <div class="inv-detail__acts">
    <button type="button" class="btn btn-sm btn-ghost" data-act="buffs">View buffs</button>
    <button type="button" class="btn btn-sm btn-success inv-act-main" data-act="activate">Activate</button>
  </div>`;

function noneHtml(item) {
  if (item.type !== 'recruitment_scroll') return '<div class="inv-detail__hint">Applied automatically — nothing to use here.</div>';
  return `<div class="inv-card-action inv-detail__acts"><button type="button" class="btn btn-sm btn-ghost" disabled title="${RETIRED_TITLE}">Retired</button></div>`;
}

function ownedCardHtml(item, roster) {
  const owned = new Set(roster.filter(h => h.isOwned).map(h => h.id));
  if (item.type === 'hero_card' && item.targetHeroId && owned.has(item.targetHeroId)) {
    return '<div class="inv-detail__acts"><button type="button" class="btn btn-sm btn-ghost" disabled>Owned</button></div>';
  }
  if (item.type === 'hero_card_universal') {
    const ofTier = roster.filter(h => h.tier === item.targetTier);
    if (ofTier.length && ofTier.every(h => owned.has(h.id))) {
      return `<div class="inv-detail__acts"><button type="button" class="btn btn-sm btn-ghost" disabled title="All ${escapeHtml(item.targetTier)} heroes owned">All Owned</button></div>`;
    }
  }
  return null;
}

export function actionHtml(action, item, heroes, roster = []) {
  if (action === 'use') return qtyHtml() + useActsHtml(item.id, false);
  if (action === 'hero') return chipsHtml(heroes) + qtyHtml() + useActsHtml(item.id, true);
  if (action === 'speedup') return '<div class="inv-detail__hint"></div>' + mainActHtml('Use on timer', 'timer');
  if (action === 'boost') return BOOST_ACTS;
  if (action === 'fragment') return '<div class="inv-detail__hint"></div>' + mainActHtml('Recruit in Hero Quarters ›', 'recruit', 'inv-goto-recruit');
  if (action === 'recruit') return ownedCardHtml(item, roster) ?? mainActHtml('Recruit in Hero Quarters ›', 'recruit', 'inv-goto-recruit');
  return noneHtml(item);
}
