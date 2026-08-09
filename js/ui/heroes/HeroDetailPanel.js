import { eventBus } from '../../core/EventBus.js';
import { AWAKENING_CONFIG, HERO_CLASSIFICATIONS } from '../../entities/GAME_DATA.js';
import { icon, iconFromEmoji } from '../icons.js';
import { TIER_CSS_SUFFIX } from '../uiUtils.js';
import { portraitHtml, statusChipHtml, TIER_META, videoHtml, bindPlayButton } from './heroCardView.js';
import { squadNameForHero } from './heroSquadLookup.js';

const AURA_LABELS = {
  attack_boost:  'Attack Boost',
  magic_amplify: 'Magic Amplify',
  crit_chance:   'Crit Chance',
  defense_boost: 'Defense Boost',
};

export class HeroDetailPanel {
  constructor(systems) {
    this._s = systems;
    this._root = null;
    this._heroId = null;
  }

  init(rootEl) { this._root = rootEl; }

  showHero(heroId) { this._heroId = heroId; this.render(); }

  render() {
    if (!this._root) return;
    const hero = this._hero();
    if (!hero) { this._root.innerHTML = `<div class="heroes-detail-empty"><p>Select a hero to manage them</p></div>`; return; }
    this._root.innerHTML = this._html(hero);
    this._bind(hero);
  }

  patch() {
    const hero = this._hero();
    if (!hero || !this._root) return;
    const lvl = this._root.querySelector('.hero-detail-level-badge');
    if (lvl) lvl.textContent = `Lv.${hero.level}`;
    const chip = this._root.querySelector('.hero-assignment-chip');
    if (chip) chip.outerHTML = statusChipHtml(hero, { squadName: this._squadName(hero) });
    if (this._root.querySelector('video')) return;
    this.render();
  }

  _hero() { return this._s.heroes.getRosterWithState().find(h => h.id === this._heroId) ?? null; }

  _squadName(hero) { return squadNameForHero(hero, this._s.um); }

  _html(hero) {
    const tierMeta = TIER_META[hero.tier] ?? TIER_META.normal;
    const xpPct    = hero.isOwned ? Math.min(100, ((isFinite(hero.xp) ? hero.xp : 0) / (isFinite(hero.xpToNext) ? hero.xpToNext : 1)) * 100) : 0;

    const statsHtml = `
      <div class="hero-stat-grid">
        <div class="hero-stat"><span class="hero-stat-icon">${icon('heart', 'icon--danger')}</span><span class="hero-stat-label">HP</span><span class="hero-stat-value">${(hero.effectiveStats?.hp ?? hero.stats.hp).toLocaleString()}</span></div>
        <div class="hero-stat"><span class="hero-stat-icon">${icon('sword')}</span><span class="hero-stat-label">ATK</span><span class="hero-stat-value">${hero.effectiveStats?.attack ?? hero.stats.attack}</span></div>
        <div class="hero-stat"><span class="hero-stat-icon">${icon('shield')}</span><span class="hero-stat-label">DEF</span><span class="hero-stat-value">${hero.effectiveStats?.defense ?? hero.stats.defense}</span></div>
      </div>`;

    const auraHtml = `
      <div class="hero-aura-chip">
        <span class="aura-icon">${icon('xp', 'icon--glow')}</span>
        <span>${AURA_LABELS[hero.aura.type] ?? hero.aura.type} +${(hero.aura.value * 100).toFixed(0)}%</span>
      </div>`;

    let contentHtml = '';

    if (!hero.isOwned) {
      const fragPct = (hero.fragmentsNeeded ?? 0) > 0
        ? Math.min(100, Math.round(((hero.fragmentQty ?? 0) / hero.fragmentsNeeded) * 100))
        : 0;

      contentHtml = `
        <div class="hero-detail-section">
          <div class="hero-detail-section-title">Recruitment</div>
          <button class="btn btn-gold btn-goto-recruit w-full" data-hero="${hero.id}">Recruit in the Recruit Hall</button>
        </div>
        <div class="hero-detail-section">
          <div class="hero-detail-section-title">Fragment Progress</div>
          <div class="hero-detail-frag-bar-wrap">
            <div class="hero-detail-frag-bar" style="width:${fragPct}%"></div>
          </div>
          <div class="hero-detail-frag-label">
            <span>${icon('flask-potion')} ${hero.fragmentQty ?? 0} / ${hero.fragmentsNeeded ?? '?'} fragments</span>
            <span>${fragPct}%</span>
          </div>
        </div>`;

    } else {
      const maxStars = AWAKENING_CONFIG.maxStars;
      const starHtml = Array.from({ length: maxStars }, (_, i) =>
        `<span class="hero-star ${i < hero.stars ? 'hero-star--filled' : 'hero-star--empty'}">${i < hero.stars ? '★' : '☆'}</span>`
      ).join('');

      const XP_BUNDLES = [
        { id: 'xp_bundle_small',  label: '+250 XP' },
        { id: 'xp_bundle_medium', label: '+1K XP'  },
        { id: 'xp_bundle_large',  label: '+5K XP'  },
      ];
      const bundlesOwned = XP_BUNDLES.filter(b => (this._s.inventory?.getQuantity(b.id) ?? 0) > 0);
      const bundleHtml = bundlesOwned.length > 0
        ? bundlesOwned.map(b => `
            <button class="btn btn-xs btn-xp-bundle btn-primary" data-hero="${hero.id}" data-bundle="${b.id}">
              ${b.label} <span class="xp-qty-badge">×${this._s.inventory.getQuantity(b.id)}</span>
            </button>`).join('')
        : `<span class="hero-xp-hint">Buy Tomes from <strong>Shop</strong></span>`;

      const skillsHtml = (hero.skills ?? []).map(skill => {
        const typeIcon  = skill.type === 'active' ? icon('lightning') : icon('xp', 'icon--glow');
        const typeLabel = skill.type === 'active' ? 'Active' : 'Passive';
        const locked    = !skill.unlocked;
        return `
          <div class="hero-skill-slot ${locked ? 'hero-skill-slot--locked' : `hero-skill-slot--${skill.type}`}"
               data-skill-id="${skill.id}">
            <span class="hero-skill-icon">${locked ? icon('lock') : (iconFromEmoji(skill.icon ?? '') || typeIcon)}</span>
            <div class="hero-skill-info">
              <span class="hero-skill-name">${skill.name}</span>
              <span class="hero-skill-type hero-skill-type--${skill.type}">${typeLabel}</span>
            </div>
            ${locked
              ? `<span class="hero-skill-unlock">Lv.${skill.unlockLevel}</span>`
              : `<span class="hero-skill-active-badge">✓</span>`}
          </div>`;
      }).join('');

      const atMaxStars = hero.stars >= maxStars;
      const awakenHtml = atMaxStars
        ? `<div class="hero-awaken-maxed">${icon('star-burst', 'icon--gold')} Fully Awakened!</div>`
        : `<div class="hero-awaken-costs">
            <button class="btn btn-xs btn-awaken-shard ${hero.canAwakenByShard ? 'btn-gold' : 'btn-ghost'}" data-hero="${hero.id}" ${!hero.canAwakenByShard ? 'disabled' : ''}>
              ${icon('star-burst', 'icon--gold')} Shards (${hero.shardQty ?? 0}/${hero.nextStarShardCost ?? 0})
            </button>
          </div>`;

      const assignmentStatusChip = statusChipHtml(hero, { squadName: this._squadName(hero) });

      const deployHtml = `
        <button class="btn btn-primary btn-deploy w-full" data-hero="${hero.id}">Deploy…</button>
        <div class="hero-deploy-hint">Squad postings are managed in the Barracks.</div>`;

      contentHtml = `
        <div class="hero-detail-section">
          <div class="hero-detail-section-title">${icon('star-burst', 'icon--gold')} Awakening — Star ${hero.stars}/${maxStars}</div>
          <div class="hero-stars-row">${starHtml}</div>
          ${awakenHtml}
        </div>
        <div class="hero-detail-section">
          <div class="hero-detail-section-title">Experience — Lv.${hero.level}</div>
          <div class="hero-xp-label">
            <span>XP</span><span>${(isFinite(hero.xp) ? hero.xp : 0).toLocaleString()} / ${(isFinite(hero.xpToNext) ? hero.xpToNext : 0).toLocaleString()}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill progress-fill-xp" style="width:${xpPct}%"></div></div>
          <div class="hero-xp-actions">${bundleHtml}</div>
        </div>
        <div class="hero-detail-section">
          <div class="hero-detail-section-title">${icon('lightning')} Skills</div>
          ${skillsHtml || '<span class="hero-skills-empty">No skills defined.</span>'}
        </div>
        <div class="hero-detail-section">
          <div class="hero-detail-section-title">Assignment</div>
          ${assignmentStatusChip}
          ${deployHtml}
        </div>`;
    }

    const detailTierCssSuffix = TIER_CSS_SUFFIX[hero.tier] ?? 'common';
    return `
      <div class="heroes-detail-panel">
        <div class="heroes-detail-hero-header heroes-detail-hero-header--${detailTierCssSuffix}">
          ${portraitHtml(hero, 'splash')}
          ${videoHtml(hero)}
          <div class="hero-detail-header-info">
            <div class="hero-detail-badges-row">
              <div class="hero-tier-badge tier-badge-${detailTierCssSuffix}">${tierMeta.symbol} ${tierMeta.label}</div>
              ${hero.classification ? `<div class="hero-class-badge class-${hero.classification}">${iconFromEmoji(HERO_CLASSIFICATIONS[hero.classification]?.icon ?? '') || icon('sword')} ${(HERO_CLASSIFICATIONS[hero.classification]?.label ?? hero.classification)}</div>` : ''}
            </div>
            <div class="hero-detail-name">${hero.name}</div>
            <div class="hero-detail-title-sub">${hero.title}</div>
          </div>
          ${hero.isOwned ? `<div class="hero-detail-level-badge">Lv.${hero.level}</div>` : ''}
        </div>
        <div class="hero-detail-body">
          <p class="hero-description">${hero.description}</p>
          ${hero.backstory ? `<p class="hero-backstory">${hero.backstory}</p>` : ''}
          ${statsHtml}
          ${auraHtml}
          <div class="hero-detail-sections">${contentHtml}</div>
        </div>
      </div>`;
  }

  _bind(hero) {
    const root = this._root;

    root.querySelector('.btn-goto-recruit')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      eventBus.emit('ui:openHeroesTab', 'recruit');
    });

    root.querySelector('.btn-deploy')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      eventBus.emit('heroes:deployRequest', { heroId: e.currentTarget.dataset.hero });
      eventBus.emit('ui:openHeroesTab', 'assign');
    });

    root.querySelectorAll('.btn-xp-bundle').forEach(btn => {
      btn.addEventListener('click', e => {
        eventBus.emit('ui:click');
        const r = this._s.inventory.useItem(e.currentTarget.dataset.bundle, { heroId: e.currentTarget.dataset.hero });
        if (!r.success) {
          eventBus.emit('ui:error');
          this._s.notifications?.show('warning', 'Cannot Apply', r.reason);
        } else {
          this._s.notifications?.show('success', '📖 XP Applied!', `+${r.xpAmount?.toLocaleString() ?? '?'} XP applied!`);
        }
      });
    });

    root.querySelector('.btn-awaken-shard')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      const r = this._s.heroes.awakenHero(e.currentTarget.dataset.hero);
      if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Awaken', r.reason); }
    });

    bindPlayButton(root);
  }
}
