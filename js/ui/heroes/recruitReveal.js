import { HEROES_CONFIG, INVENTORY_ITEMS } from '../../entities/GAME_DATA.js';
import { icon, iconFromEmoji } from '../icons.js';
import { escapeHtml } from '../uiUtils.js';
import { portraitHtml, TIER_META } from './heroCardView.js';

const OUTCOME_META = {
  hero:     { icon: icon('crown'),                    label: 'Hero' },
  shard:    { icon: icon('star-burst', 'icon--gold'), label: 'Hero Shard' },
  fragment: { icon: icon('flask-potion'),             label: 'Hero Fragment' },
  xp:       { icon: icon('xp'),                       label: 'XP Card' },
  overflow: { icon: icon('box'),                      label: 'Tier Shards' },
};

const tierLabel = tier => TIER_META[tier]?.label ?? '';

export function resultCardHtml(result) {
  const meta = OUTCOME_META[result.outcome] ?? { icon: icon('x-circle'), label: 'Unknown' };
  if (result.grantFailed) {
    return `
      <div class="recruit-result-card recruit-result--error">
        <span class="recruit-result-generic-icon">${icon('warning')}</span>
        <span class="recruit-result-name">${meta.label}</span>
        <span class="recruit-result-sub">${escapeHtml(result.reason ?? 'Grant failed.')}</span>
      </div>`;
  }
  if (result.outcome === 'hero') return heroFaceHtml(result);
  return itemFaceHtml(result, meta);
}

function heroFaceHtml(result) {
  const cfg = HEROES_CONFIG[result.heroId];
  return `
    <div class="recruit-result-card recruit-result--hero">
      ${result.isDuplicate ? '' : '<span class="recruit-result-tag">New</span>'}
      <span class="recruit-result-art">${portraitHtml(cfg, 'splash')}</span>
      <span class="recruit-result-name">${escapeHtml(cfg?.name ?? result.heroId)}</span>
      <span class="recruit-result-sub recruit-result-sub--rarity">${tierLabel(cfg?.tier)} hero</span>
    </div>`;
}

function itemFaceHtml(result, meta) {
  const itemCfg = result.itemId ? INVENTORY_ITEMS[result.itemId] : null;
  const heroCfg = result.heroId ? HEROES_CONFIG[result.heroId] : null;
  const sub = result.outcome === 'overflow'
    ? 'Maxed hero — converted to tier shards'
    : heroCfg ? `For ${heroCfg.name}` : (itemCfg?.description ?? tierLabel(result.tier));
  return `
    <div class="recruit-result-card">
      <span class="recruit-result-generic-icon">${iconFromEmoji(itemCfg?.icon ?? '') || meta.icon}</span>
      <span class="recruit-result-name">${escapeHtml(itemCfg?.name ?? meta.label)}</span>
      <span class="recruit-result-sub">${escapeHtml(sub)}</span>
    </div>`;
}
