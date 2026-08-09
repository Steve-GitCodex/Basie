import { HEROES_CONFIG, INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';
import { icon, iconFromEmoji } from '../icons.js';
import { TIER_CSS_SUFFIX } from '../uiUtils.js';
import { portraitHtml, videoHtml, bindPlayButton } from './heroCardView.js';

const OUTCOME_META = {
  hero:     { icon: icon('crown'),        label: 'Hero Recruited' },
  shard:    { icon: icon('star-burst', 'icon--gold'), label: 'Hero Shard' },
  fragment: { icon: icon('flask-potion'), label: 'Hero Fragment' },
  xp:       { icon: icon('xp'),           label: 'XP Card' },
  overflow: { icon: icon('box'),          label: 'Tier Shards' },
};

export function recruitReveal(rootEl, results, { onDone } = {}) {
  rootEl.innerHTML = `
    <div class="recruit-reveal">
      <div class="recruit-reveal-cards">${results.map(r => resultCardHtml(r)).join('')}</div>
      <button class="btn btn-primary recruit-reveal-done">Continue</button>
    </div>`;
  bindPlayButton(rootEl);
  rootEl.querySelector('.recruit-reveal-done')?.addEventListener('click', () => onDone?.());
}

function resultCardHtml(result) {
  const meta = OUTCOME_META[result.outcome] ?? { icon: icon('x-circle'), label: 'Unknown' };

  if (result.grantFailed) {
    return `
      <div class="recruit-result-card recruit-result--error">
        ${icon('warning')}
        <div class="recruit-result-name">${meta.label}</div>
        <div class="recruit-result-sub">${result.reason ?? 'Grant failed.'}</div>
      </div>`;
  }

  switch (result.outcome) {
    case 'hero':      return heroResultHtml(result, meta);
    case 'shard':     return heroCurrencyResultHtml(result, meta);
    case 'fragment':  return heroCurrencyResultHtml(result, meta);
    case 'xp':        return itemResultHtml(result, meta);
    case 'overflow':  return overflowResultHtml(result, meta);
    default:
      return `
        <div class="recruit-result-card">
          ${icon('x-circle')}
          <div class="recruit-result-name">Unknown Outcome</div>
        </div>`;
  }
}

function heroResultHtml(result, meta) {
  const heroCfg = HEROES_CONFIG[result.heroId];
  const tierCss = TIER_CSS_SUFFIX[heroCfg?.tier] ?? 'common';
  const title = result.isDuplicate ? `${icon('warning')} Duplicate Hero!` : meta.label + '!';
  return `
    <div class="recruit-result-card recruit-result--${tierCss}">
      <div class="recruit-result-title">${title}</div>
      ${portraitHtml(heroCfg, 'splash')}
      ${videoHtml(heroCfg)}
      <div class="recruit-result-name">${heroCfg?.name ?? result.heroId}</div>
      <div class="recruit-result-sub">${heroCfg?.title ?? ''}</div>
      ${result.isDuplicate
        ? `<div class="recruit-result-notice recruit-result-notice--warning">Already owned — a duplicate card was added for Awakening.</div>`
        : `<div class="recruit-result-notice recruit-result-notice--info">Hero joined your roster! Visit the Roster tab to manage them.</div>`}
    </div>`;
}

function heroCurrencyResultHtml(result, meta) {
  const heroCfg = result.heroId ? HEROES_CONFIG[result.heroId] : null;
  const itemCfg = result.itemId ? INVENTORY_ITEMS[result.itemId] : null;
  const tier = result.tier ?? heroCfg?.tier ?? 'normal';
  const tierCss = TIER_CSS_SUFFIX[tier] ?? 'common';
  return `
    <div class="recruit-result-card recruit-result--${tierCss}">
      <div class="recruit-result-title">${meta.label}</div>
      <div class="recruit-result-generic-icon">${iconFromEmoji(itemCfg?.icon ?? '') || meta.icon}</div>
      <div class="recruit-result-name">${itemCfg?.name ?? meta.label}</div>
      ${heroCfg ? `<div class="recruit-result-sub">For ${heroCfg.name}</div>` : ''}
    </div>`;
}

function itemResultHtml(result, meta) {
  const itemCfg = result.itemId ? INVENTORY_ITEMS[result.itemId] : null;
  const tierCss = TIER_CSS_SUFFIX[result.tier] ?? 'common';
  return `
    <div class="recruit-result-card recruit-result--${tierCss}">
      <div class="recruit-result-title">${meta.label}</div>
      <div class="recruit-result-generic-icon">${iconFromEmoji(itemCfg?.icon ?? '') || meta.icon}</div>
      <div class="recruit-result-name">${itemCfg?.name ?? meta.label}</div>
      <div class="recruit-result-sub">${itemCfg?.description ?? ''}</div>
    </div>`;
}

function overflowResultHtml(result, meta) {
  const itemCfg = result.itemId ? INVENTORY_ITEMS[result.itemId] : null;
  const tierCss = TIER_CSS_SUFFIX[result.tier] ?? 'common';
  return `
    <div class="recruit-result-card recruit-result--${tierCss}">
      <div class="recruit-result-title">${meta.label}</div>
      <div class="recruit-result-generic-icon">${iconFromEmoji(itemCfg?.icon ?? '') || meta.icon}</div>
      <div class="recruit-result-name">${itemCfg?.name ?? meta.label}</div>
      <div class="recruit-result-sub">Maxed hero — converted to tier shards.</div>
    </div>`;
}
