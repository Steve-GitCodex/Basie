import { eventBus } from '../../core/EventBus.js';
import { heroArt } from '../icons/heroArt.js';
import { TIER_CSS_SUFFIX, escapeHtml } from '../uiUtils.js';

export const TIER_META = {
  normal:    { label: 'Normal',    symbol: '●', cssClass: 'hero-card--common' },
  epic:      { label: 'Epic',      symbol: '◆', cssClass: 'hero-card--rare' },
  legendary: { label: 'Legendary', symbol: '★', cssClass: 'hero-card--legendary' },
};

export function portraitHtml(hero, variant = 'thumb') {
  const src = heroArt(hero?.id)[variant];
  const suffix = TIER_CSS_SUFFIX[hero?.tier] ?? 'common';
  if (!src) {
    return `<span class="hero-portrait hero-portrait--${suffix} hero-portrait--emoji">${hero?.icon ?? ''}</span>`;
  }
  return `<img class="hero-portrait hero-portrait--${suffix} hero-portrait--${variant}" src="${src}" alt="${hero?.name ?? ''}" loading="lazy">`;
}

export function statusChipHtml(hero, { squadName } = {}) {
  if (!hero?.isOwned) return `<span class="hero-assignment-chip chip-unowned">Not recruited</span>`;
  if (hero.isInSquad) {
    return `<span class="hero-assignment-chip chip-squad">${escapeHtml(squadName ?? 'Squad')}</span>`;
  }
  if (hero.isInBuilding) {
    return `<span class="hero-assignment-chip chip-building">${hero.assignedBuilding ?? 'Stationed'}</span>`;
  }
  return `<span class="hero-assignment-chip chip-idle">○ Idle</span>`;
}

export function tierPillHtml(hero) {
  const meta = TIER_META[hero?.tier] ?? TIER_META.normal;
  const suffix = TIER_CSS_SUFFIX[hero?.tier] ?? 'common';
  return `<span class="hero-tier-pill tier-pill-${suffix}">${meta.symbol} ${meta.label}</span>`;
}

export function videoHtml(hero) {
  const src = heroArt(hero?.id).video;
  if (!src) return '';
  return `
    <div class="hero-splash-video" data-src="${src}">
      <button class="hero-play-btn" type="button" aria-label="Play ${hero?.name ?? ''} clip">▶</button>
    </div>`;
}

export function bindPlayButton(rootEl) {
  rootEl.querySelectorAll('.hero-play-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      eventBus.emit('ui:click');
      const wrap = e.currentTarget.closest('.hero-splash-video');
      const video = document.createElement('video');
      video.src = wrap.dataset.src;
      video.controls = true;
      video.className = 'hero-splash-video-el';
      wrap.replaceChildren(video);
      video.play();
    });
  });
}
