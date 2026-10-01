import { eventBus } from '../../core/EventBus.js';
import { HERO_CLASSIFICATIONS } from '../../entities/GAME_DATA.js';
import { icon, iconFromEmoji } from '../icons.js';
import { escapeHtml } from '../uiUtils.js';
import {
  portraitHtml, statusChipHtml, TIER_META, videoHtml, bindPlayButton, rarityClass, starsHtml,
} from './heroCardView.js';
import { squadNameForHero } from './heroSquadLookup.js';
import { detailNavHtml, neighbourIds } from './heroDetailNav.js';
import { detailTabsHtml, selectDetailTab, patchDetailTabs } from './heroDetailTabs.js';
import { unlockPathHtml } from './heroUnlockPath.js';

const AURA_LABELS = {
  attack_boost:  'Attack Boost',
  magic_amplify: 'Magic Amplify',
  crit_chance:   'Crit Chance',
  defense_boost: 'Defense Boost',
};

const XP_BUNDLES = [
  { id: 'xp_bundle_small',  label: 'Tome +250' },
  { id: 'xp_bundle_medium', label: 'Tome +1K'  },
  { id: 'xp_bundle_large',  label: 'Tome +5K'  },
];

const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);

function statValues(hero) {
  const stats = hero.effectiveStats ?? hero.stats;
  return {
    level:   `LV ${hero.level}`,
    hp:      stats.hp.toLocaleString(),
    attack:  String(stats.attack),
    defense: String(stats.defense),
  };
}

function xpText(hero) {
  return `XP ${finite(hero.xp, 0).toLocaleString()} / ${finite(hero.xpToNext, 0).toLocaleString()}`;
}

function xpPct(hero) {
  return Math.min(100, (finite(hero.xp, 0) / finite(hero.xpToNext, 1)) * 100);
}

export class HeroDetailPanel {
  constructor(systems) {
    this._s = systems;
    this._root = null;
    this._heroId = null;
    this._tab = 'skills';
    this._renderedId = null;
    this._renderedOwned = null;
    this._onBack = null;
    this._order = () => [];
  }

  init(rootEl) {
    this._root = rootEl;
    rootEl.addEventListener('click', e => this._onClick(e));
  }

  onBack(cb) { this._onBack = cb; }

  setOrder(fn) { this._order = fn; }

  showHero(heroId) {
    if (heroId !== this._heroId) this._tab = 'skills';
    this._heroId = heroId;
    this.render();
  }

  render() {
    if (!this._root) return;
    const hero = this._hero();
    if (!hero) { this._root.innerHTML = ''; delete this._root.dataset.heroId; return; }
    this._root.dataset.heroId = hero.id;
    this._renderedId = hero.id;
    this._renderedOwned = hero.isOwned;
    this._root.innerHTML = this._html(hero);
    bindPlayButton(this._root);
  }

  patch() {
    const hero = this._hero();
    if (!hero || !this._root) return;
    if (hero.id !== this._renderedId || hero.isOwned !== this._renderedOwned) { this.render(); return; }

    for (const [key, value] of Object.entries(statValues(hero))) {
      const el = this._root.querySelector(`[data-stat="${key}"]`);
      if (el) el.textContent = value;
    }
    const stars = this._root.querySelector('.hq-detail__stars');
    if (stars) stars.innerHTML = starsHtml(hero.stars);
    const xpLabel = this._root.querySelector('.hq-xp__text');
    if (xpLabel) xpLabel.textContent = xpText(hero);
    const xpFill = this._root.querySelector('.hq-bar--xp > i');
    if (xpFill) xpFill.style.width = `${xpPct(hero)}%`;
    const tomes = this._root.querySelector('.hq-xp__tomes');
    if (tomes) tomes.innerHTML = this._tomesHtml();
    const chip = this._root.querySelector('.hq-detail__chip');
    if (chip) chip.innerHTML = statusChipHtml(hero, { squadName: this._squadName(hero) });
    const unlock = this._root.querySelector('.hq-unlock');
    if (unlock) unlock.outerHTML = unlockPathHtml(hero);
    patchDetailTabs(this._root, hero);
  }

  _hero() { return this._s.heroes.getRosterWithState().find(h => h.id === this._heroId) ?? null; }

  _squadName(hero) { return squadNameForHero(hero, this._s.um); }

  _neighbourHeroes(heroId) {
    const roster = this._s.heroes.getRosterWithState();
    const { prev, next } = neighbourIds(this._order(), heroId);
    return { prev: roster.find(h => h.id === prev) ?? null, next: roster.find(h => h.id === next) ?? null };
  }

  _html(hero) {
    const { prev, next } = this._neighbourHeroes(hero.id);
    return `
      <div class="hq-detail ${rarityClass(hero)}${hero.isOwned ? '' : ' hq-detail--locked'}">
        <div class="hq-detail__art">
          ${portraitHtml(hero, 'splash')}
          <div class="hq-detail__nav">${detailNavHtml(prev, next)}</div>
          <div class="hq-detail__clip">${videoHtml(hero)}</div>
        </div>
        <div class="hq-detail__info">
          ${this._headerHtml(hero)}
          ${this._statsHtml(hero)}
          ${hero.isOwned ? this._xpHtml(hero) : unlockPathHtml(hero)}
          ${detailTabsHtml(hero, this._tab)}
          ${hero.isOwned ? this._footerHtml(hero) : ''}
        </div>
      </div>`;
  }

  _headerHtml(hero) {
    const meta = TIER_META[hero.tier] ?? TIER_META.normal;
    const cls = HERO_CLASSIFICATIONS[hero.classification];
    return `
      <div class="hq-detail__head">
        <div class="hq-detail__pills">
          <span class="hq-pill hq-pill--rarity">${meta.label}</span>
          ${cls ? `<span class="hq-pill hq-pill--muted">${iconFromEmoji(cls.icon ?? '') || icon('sword')} ${escapeHtml(cls.label)}</span>` : ''}
        </div>
        <h3 class="hq-detail__name">${escapeHtml(hero.name)}</h3>
        <div class="hq-detail__title">${escapeHtml(hero.title ?? '')}${hero.isOwned ? '' : ' · Not recruited'}</div>
        ${hero.isOwned ? `<div class="hq-detail__stars">${starsHtml(hero.stars)}</div>` : ''}
      </div>`;
  }

  _statsHtml(hero) {
    const v = statValues(hero);
    const stat = (key, label) => `<div class="hq-stat"><b class="hq-stat__value" data-stat="${key}">${v[key]}</b><span class="hq-stat__label">${label}</span></div>`;
    return `
      <div class="hq-stats">
        ${hero.isOwned ? stat('level', 'Level') : ''}
        ${stat('hp', 'HP')}
        ${stat('attack', 'Attack')}
        ${stat('defense', 'Defense')}
        <span class="hq-aura">${icon('xp', 'icon--glow')} ${AURA_LABELS[hero.aura.type] ?? hero.aura.type} +${(hero.aura.value * 100).toFixed(0)}%</span>
      </div>`;
  }

  _xpHtml(hero) {
    return `
      <div class="hq-xp">
        <div class="hq-xp__row">
          <span class="hq-xp__text">${xpText(hero)}</span>
          <span class="hq-xp__tomes">${this._tomesHtml()}</span>
        </div>
        <span class="hq-bar hq-bar--xp"><i style="width:${xpPct(hero)}%"></i></span>
      </div>`;
  }

  _tomesHtml() {
    const owned = XP_BUNDLES
      .map(b => ({ ...b, qty: this._s.inventory?.getQuantity(b.id) ?? 0 }))
      .filter(b => b.qty > 0);
    if (owned.length === 0) return `<span class="hero-xp-hint">Buy Tomes from the <strong>Shop</strong></span>`;
    return owned.map(b => `
      <button type="button" class="btn btn-xs hq-btn-secondary btn-xp-bundle" data-action="tome" data-bundle="${b.id}">
        ${b.label} <span class="xp-qty-badge">×${b.qty}</span>
      </button>`).join('');
  }

  _footerHtml(hero) {
    return `
      <div class="hq-detail__footer">
        <span class="hq-detail__posted">Posted: <span class="hq-detail__chip">${statusChipHtml(hero, { squadName: this._squadName(hero) })}</span></span>
        <span class="hero-deploy-hint">Squad leaders are posted in the Barracks.</span>
        <button type="button" class="btn btn-primary btn-deploy" data-action="change-post">Change post</button>
      </div>`;
  }

  _onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el || !this._root.contains(el) || el.disabled) return;
    const hero = this._hero();
    if (!hero) return;
    eventBus.emit('ui:click');
    const handlers = {
      'nav-back':     () => this._onBack?.(),
      'nav-go':       () => this.showHero(el.dataset.heroId),
      'tab':          () => { this._tab = el.dataset.tab; selectDetailTab(this._root, this._tab); },
      'tome':         () => this._useTome(hero, el.dataset.bundle),
      'awaken':       () => this._report(this._s.heroes.awakenHero(hero.id), 'Cannot Awaken'),
      'level-skill':  () => this._levelSkill(hero, el.dataset.skillId),
      'change-post':  () => {
        eventBus.emit('heroes:deployRequest', { heroId: hero.id });
        eventBus.emit('ui:openHeroesTab', 'assign');
      },
      'convert':      () => this._report(this._s.heroes.convertFragments(hero.id), 'Cannot Convert', '✦ Hero Shard Made', `Fragments became a ${hero.name} Hero Shard.`),
      'unlock':       () => this._report(this._s.heroes.unlockFromShards(hero.id), 'Cannot Unlock', '👑 Hero Recruited!', `${hero.name} has joined your roster!`),
      'goto-recruit': () => eventBus.emit('ui:openHeroesTab', 'recruit'),
    };
    handlers[el.dataset.action]?.();
  }

  _useTome(hero, bundleId) {
    const r = this._s.inventory.useItem(bundleId, { heroId: hero.id });
    this._report(r, 'Cannot Apply', '📖 XP Applied!', `+${r.xpAmount?.toLocaleString() ?? '?'} XP applied!`);
  }

  _levelSkill(hero, skillId) {
    const name = Object.values(hero.skills ?? {}).flat().find(s => s.id === skillId)?.name ?? 'Skill';
    const r = this._s.heroes.levelUpSkill(hero.id, skillId);
    this._report(r, 'Cannot Level Up', '⬆ Skill Leveled', `${name} is now L${r.level}.`);
  }

  _report(result, failTitle, successTitle, successMessage) {
    if (!result?.success) {
      eventBus.emit('ui:error');
      this._s.notifications?.show('warning', failTitle, result?.reason ?? 'Something went wrong.');
      return;
    }
    if (successTitle) this._s.notifications?.show('success', successTitle, successMessage);
  }
}
