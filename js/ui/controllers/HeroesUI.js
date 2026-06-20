/**
 * HeroesUI.js
 * Two-column hero management: compact roster list on the left with separate
 * sections for owned vs recruitable heroes; full detail/management panel on
 * the right that updates on card selection without re-rendering the roster.
 */
import { eventBus }        from '../../core/EventBus.js';
import { INVENTORY_ITEMS,
         AWAKENING_CONFIG,
         HERO_CLASSIFICATIONS } from '../../entities/GAME_DATA.js';
import { icon, iconFromEmoji } from '../icons.js';

const TIER_META = {
  common:    { label: 'Common',    symbol: '●', cssClass: 'hero-card--common' },
  rare:      { label: 'Rare',      symbol: '◆', cssClass: 'hero-card--rare' },
  legendary: { label: 'Legendary', symbol: '★', cssClass: 'hero-card--legendary' },
};

const AURA_LABELS = {
  attack_boost:  'Attack Boost',
  magic_amplify: 'Magic Amplify',
  crit_chance:   'Crit Chance',
  defense_boost: 'Defense Boost',
};

export class HeroesUI {
  /** @param {{ rm, heroes, inventory, notifications }} systems */
  constructor(systems) {
    this._s              = systems;
    this._tierFilter     = 'all';
    this._selectedHeroId = null;
  }

  init() {
    eventBus.on('ui:viewChanged', v => { if (v === 'heroes') this.render(); });
    eventBus.on('heroes:updated',  () => this.render());
    eventBus.on('inventory:updated', () => this.render());
    eventBus.on('buffs:updated',   () => this._refreshBuffSection());
    eventBus.on('hero:levelUp',    d => {
      this._s.notifications?.show('success', '⚔️ Hero Level Up!', `${d.name} reached Lv.${d.level}!`);
      // Apply golden glow to the roster card for 2 s
      const heroCard = document.querySelector(`.hero-roster-card[data-hero-id="${d.heroId ?? d.id}"]`);
      if (heroCard) {
        heroCard.classList.add('hero-glow');
        setTimeout(() => heroCard.classList.remove('hero-glow'), 2000);
      }
    });
    eventBus.on('hero:awakened',   d => this._s.notifications?.show('success', '✨ Awakened!', `${d.name} is now ★${d.stars}!`));
    eventBus.on('buff:activated',  d => this._s.notifications?.show('success', '⛏️ Buff Active!', `+${(d.value * 100).toFixed(0)}% production for ${(d.durationMs / 60000).toFixed(0)}m`));
  }

  render() {
    const grid = document.getElementById('heroes-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const roster      = this._s.heroes.getRosterWithState();
    const bonuses     = this._s.heroes.getCombatBonuses(); // null = aggregate all squad heroes
    const totalSquad  = this._s.heroes.getAllSquadHeroIds().length;

    // ── Control Bar ─────────────────────────────────────────────────────────
    const controlBar = document.createElement('div');
    controlBar.className = 'hero-control-bar';
    controlBar.innerHTML = `
      <div class="tier-filter-bar">
        <button class="tier-pill ${this._tierFilter === 'all'       ? 'tier-pill--active' : ''}" data-tier="all">All Heroes</button>
        <button class="tier-pill pill-common ${this._tierFilter === 'common'    ? 'tier-pill--active' : ''}" data-tier="common">● Common</button>
        <button class="tier-pill pill-rare ${this._tierFilter === 'rare'      ? 'tier-pill--active' : ''}" data-tier="rare">◆ Rare</button>
        <button class="tier-pill pill-legendary ${this._tierFilter === 'legendary' ? 'tier-pill--active' : ''}" data-tier="legendary">★ Legendary</button>
      </div>
      <div class="hero-bonus-strip">
        <span class="hero-bonus-chip" title="Attack multiplier">${icon('sword')} ×${bonuses.attackMult.toFixed(2)}</span>
        <span class="hero-bonus-chip" title="Defense multiplier">${icon('shield')} ×${bonuses.defenseMult.toFixed(2)}</span>
        ${bonuses.lossReduction > 0 ? `<span class="hero-bonus-chip hero-bonus-chip--green">${icon('heart', 'icon--success')} -${(bonuses.lossReduction * 100).toFixed(0)}%</span>` : ''}
        <span class="hero-squad-badge">${icon('sword')} ${totalSquad} Assigned</span>
      </div>`;

    controlBar.querySelectorAll('.tier-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this._tierFilter = btn.dataset.tier;
        eventBus.emit('ui:click');
        this.render();
      });
    });
    grid.appendChild(controlBar);

    // Apply filter
    const filtered = this._tierFilter === 'all'
      ? roster
      : roster.filter(h => h.tier === this._tierFilter);

    // If selected hero no longer in current filter, clear selection
    if (this._selectedHeroId && !filtered.find(h => h.id === this._selectedHeroId)) {
      this._selectedHeroId = null;
    }
    // Default select the first hero
    if (!this._selectedHeroId && filtered.length > 0) {
      this._selectedHeroId = filtered[0].id;
    }

    // ── Two-column Split ─────────────────────────────────────────────────────
    const split = document.createElement('div');
    split.className = 'heroes-split-layout';
    grid.appendChild(split);

    // LEFT: roster pane
    const rosterPane = document.createElement('div');
    rosterPane.className = 'heroes-roster-pane';
    split.appendChild(rosterPane);

    if (filtered.length === 0) {
      rosterPane.innerHTML = `<div class="heroes-empty">No heroes in this tier yet.</div>`;
    } else {
      const owned   = filtered.filter(h => h.isOwned);
      const recruit = filtered.filter(h => !h.isOwned);

      if (owned.length > 0) {
        rosterPane.appendChild(this._makeSectionLabel(`Your Heroes (${owned.length})`));
        owned.forEach(h => rosterPane.appendChild(this._buildRosterCard(h)));
      }
      if (recruit.length > 0) {
        const lbl = this._makeSectionLabel(`Available to Recruit (${recruit.length})`);
        lbl.classList.add('heroes-section-label--recruit');
        rosterPane.appendChild(lbl);
        recruit.forEach(h => rosterPane.appendChild(this._buildRosterCard(h)));
      }
    }

    // RIGHT: detail pane
    const detailPane = document.createElement('div');
    detailPane.className = 'heroes-detail-pane';
    split.appendChild(detailPane);

    const selected = filtered.find(h => h.id === this._selectedHeroId);
    if (selected) {
      detailPane.innerHTML = this._buildDetailPanel(selected);

      // Wire rich skill tooltips (replaces native browser title attribute)
      detailPane.querySelectorAll('.hero-skill-slot[data-skill-id]').forEach(el => {
        const skill = (selected.skills ?? []).find(s => s.id === el.dataset.skillId);
        if (!skill) return;
        const locked    = !skill.unlocked;
        const typeLabel = skill.type === 'active' ? `${icon('lightning')} Active` : 'Passive';
        el.dataset.tooltipHtml = locked
          ? `<div class="tt-title">${skill.icon ?? ''} ${skill.name}</div><div class="tt-row tt-sub">${typeLabel} · Unlocks at Lv.${skill.unlockLevel}</div><div class="tt-sep"></div><div class="tt-row tt-muted">${skill.description}</div>`
          : `<div class="tt-title">${skill.icon ?? ''} ${skill.name}</div><div class="tt-row tt-sub">${typeLabel}</div><div class="tt-sep"></div><div class="tt-row">${skill.description}</div>`;
      });

      this._bindDetailListeners(detailPane, selected);
    } else {
      detailPane.innerHTML = `<div class="heroes-detail-empty"><p>Select a hero to manage them</p></div>`;
    }
  }
  // ── Buff Section ────────────────────────────────────────────────────────────────────────

  _buildBuffSection() {
    const section = document.createElement('div');
    section.className = 'heroes-buff-section';
    section.id = 'heroes-buff-section';
    const heading = document.createElement('div');
    heading.className = 'heroes-buff-heading';
    heading.innerHTML = `<span class="buff-heading-icon">${icon("production")}</span> Active Buffs <span class="buff-heading-sub">(production boosts from Inventory items)</span>`;
    section.appendChild(heading);
    this._renderBuffCards(section);
    return section;
  }

  _renderBuffCards(container) {
    // Remove old cards but keep the heading
    container.querySelectorAll('.buff-card-list').forEach(el => el.remove());

    const buffs = this._s.heroes.getActiveBuffsWithRemaining?.() ?? [];
    const list  = document.createElement('div');
    list.className = 'buff-card-list';

    if (buffs.length === 0) {
      list.innerHTML = `
        <div class="buff-empty">
          <span class="buff-empty-icon">⏳</span>
          <p>No active buffs.</p>
          <p class="buff-empty-hint">Use production boost items from your Inventory to temporarily increase all resource rates.</p>
        </div>`;
    } else {
      buffs.forEach((b, i) => {
        const remainSec = Math.ceil(b.remaining / 1000);
        const hours     = Math.floor(remainSec / 3600);
        const mins      = Math.floor((remainSec % 3600) / 60);
        const secs      = remainSec % 60;
        const timeStr   = hours > 0
          ? `${hours}h ${mins}m`
          : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        const card = document.createElement('div');
        card.className = 'buff-card';
        card.dataset.buffIndex = i;
        card.innerHTML = `
          <div class="buff-card-icon">${icon("production")}</div>
          <div class="buff-card-body">
            <div class="buff-card-name">Production Boost</div>
            <div class="buff-card-effect">+${(b.value * 100).toFixed(0)}% all resources</div>
          </div>
          <div class="buff-card-timer">
            <div class="buff-timer-label">Time Left</div>
            <div class="buff-timer-value">${timeStr}</div>
            <div class="buff-timer-bar"><div class="buff-timer-fill" style="width:${Math.min(100, (b.remaining / b.durationMs) * 100).toFixed(1)}%"></div></div>
          </div>`;
        list.appendChild(card);
      });
    }

    container.appendChild(list);
  }

  _refreshBuffSection() {
    const section = document.getElementById('heroes-buff-section');
    if (!section) return;
    this._renderBuffCards(section);
  }
  // ── Helpers ──────────────────────────────────────────────────────────────

  _makeSectionLabel(text) {
    const el = document.createElement('div');
    el.className = 'heroes-section-label';
    el.textContent = text;
    return el;
  }

  /** @private Maps squadId → barracksId (mirrors HeroManager._barracksIdForSquad) */
  _barracksIdForSquad(squadId) {
    const num = parseInt(squadId?.replace('squad_', '') ?? '1', 10);
    return `barracks_${Math.max(0, num - 1)}`;
  }

  // ── Compact roster card (left pane) ─────────────────────────────────────

  _buildRosterCard(hero) {
    const tierMeta   = TIER_META[hero.tier] ?? TIER_META.common;
    const isSelected = hero.id === this._selectedHeroId;

    let statusHtml = '';
    if (hero.isOwned) {
      let chipClass = 'chip-idle', chipText = '○ Idle';
      if (hero.isInSquad) {
        chipClass = 'chip-squad';
        const barracksIdx = parseInt((hero.assignedBuilding ?? '').replace('barracks_', ''), 10);
        const squads = this._s.um?.getSquads() ?? [];
        const squadName = squads[barracksIdx]?.name ?? `Squad ${barracksIdx + 1}`;
        chipText = `${icon('sword')} ${squadName}`;
      } else if (hero.isInBuilding) {
        chipClass = 'chip-building';
        chipText = `${icon('house')} ${hero.assignedBuilding ?? 'Building'}`;
      }
      statusHtml = `<span class="hero-assignment-chip ${chipClass}">${chipText}</span>`;
    } else {
      const hasCard = (hero.specificCardQty > 0) || (hero.universalCardQty > 0);
      const fragPct = (hero.fragmentsNeeded ?? 0) > 0
        ? Math.min(100, Math.round(((hero.fragmentQty ?? 0) / hero.fragmentsNeeded) * 100))
        : 0;
      if (hasCard) {
        statusHtml = `<span class="hero-card-ready-pill">🃏 Ready</span>`;
      } else {
        statusHtml = `
          <div class="hero-roster-frag-wrap">
            <div class="hero-roster-frag-bar"><div class="hero-roster-frag-fill" style="width:${fragPct}%"></div></div>
            <span class="hero-roster-frag-text">${hero.fragmentQty ?? 0}/${hero.fragmentsNeeded ?? '?'}</span>
          </div>`;
      }
    }

    const card = document.createElement('div');
    card.className = `hero-roster-card hero-roster-card--${hero.tier}${isSelected ? ' hero-roster-card--selected' : ''}`;
    card.dataset.heroId = hero.id;
    card.innerHTML = `
      <div class="hero-roster-portrait hero-roster-portrait--${hero.tier}">${hero.icon}</div>
      <div class="hero-roster-info">
        <div class="hero-roster-name">${hero.name}</div>
        <div class="hero-roster-sub">
          <span class="hero-tier-pill tier-pill-${hero.tier}">${tierMeta.symbol} ${tierMeta.label}</span>
          ${hero.isOwned ? `<span class="hero-level-pip">Lv.${hero.level}</span>` : ''}
        </div>
      </div>
      <div class="hero-roster-status">${statusHtml}</div>`;

    card.addEventListener('click', () => {
      eventBus.emit('ui:click');
      this._selectedHeroId = hero.id;
      document.querySelectorAll('.hero-roster-card').forEach(c => c.classList.remove('hero-roster-card--selected'));
      card.classList.add('hero-roster-card--selected');
      const detailPane = document.querySelector('.heroes-detail-pane');
      if (detailPane) {
        const freshRoster = this._s.heroes.getRosterWithState();
        const fresh       = freshRoster.find(h => h.id === hero.id);
        if (fresh) {
          detailPane.innerHTML = this._buildDetailPanel(fresh);
          this._bindDetailListeners(detailPane, fresh);
        }
      }
    });

    return card;
  }

  // ── Full detail panel (right pane) ──────────────────────────────────────

  _buildDetailPanel(hero) {
    const tierMeta = TIER_META[hero.tier] ?? TIER_META.common;
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
      // ── Unowned: recruitment + fragment UI ───────────────────────────────
      const hasSpecific  = hero.specificCardQty > 0;
      const hasUniversal = hero.universalCardQty > 0;
      const canRecruit   = hasSpecific || hasUniversal;
      const cardUsed     = hasSpecific ? hero.recruitCard : hero.universalCardId;
      const cardName     = hasSpecific
        ? (INVENTORY_ITEMS[hero.recruitCard]?.name ?? 'Specific Card')
        : (INVENTORY_ITEMS[hero.universalCardId]?.name ?? 'Universal Card');
      const fragPct = (hero.fragmentsNeeded ?? 0) > 0
        ? Math.min(100, Math.round(((hero.fragmentQty ?? 0) / hero.fragmentsNeeded) * 100))
        : 0;

      contentHtml = `
        <div class="hero-detail-section">
          <div class="hero-detail-section-title">Recruitment</div>
          <div class="hero-card-req ${canRecruit ? 'req-available' : 'req-missing'}">
            <span class="req-icon">${hasSpecific ? icon('scroll') : hasUniversal ? icon('gift') : icon('lock')}</span>
            <span class="req-label">${canRecruit
              ? `${cardName} ×${hasSpecific ? hero.specificCardQty : hero.universalCardQty}`
              : `Requires: ${tierMeta.label} Hero Card`}</span>
          </div>
          <button class="btn btn-gold btn-recruit w-full" data-hero="${hero.id}" data-card="${cardUsed ?? ''}" ${!canRecruit ? 'disabled' : ''}>
            ${canRecruit ? `${icon('crown')} Recruit Hero` : `${icon('lock')} Card Required`}
          </button>
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
          ${hero.canSummonByFrags
            ? `<button class="btn btn-primary btn-summon-frags w-full" data-hero="${hero.id}">${icon('star-burst', 'icon--gold')} Summon from Fragments</button>`
            : ''}
        </div>`;

    } else {
      // ── Owned: full management UI ────────────────────────────────────────
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
      const fragNeeded = hero.nextStarCost?.fragments[hero.tier] ?? 0;
      const awakenHtml = atMaxStars
        ? `<div class="hero-awaken-maxed">${icon('star-burst', 'icon--gold')} Fully Awakened!</div>`
        : `<div class="hero-awaken-costs">
            <button class="btn btn-xs btn-awaken-card ${hero.canAwakenByCard ? 'btn-gold' : 'btn-ghost'}" data-hero="${hero.id}" ${!hero.canAwakenByCard ? 'disabled' : ''}>
              ${icon('scroll')} Card (${hero.nextStarCost?.cards ?? 1} dup${(hero.nextStarCost?.cards ?? 1) > 1 ? 's' : ''})
            </button>
            <button class="btn btn-xs btn-awaken-frag ${hero.canAwakenByFrag ? 'btn-primary' : 'btn-ghost'}" data-hero="${hero.id}" ${!hero.canAwakenByFrag ? 'disabled' : ''}>
              ${icon('flask-potion')} Frags (${hero.fragmentQty ?? 0}/${fragNeeded})
            </button>
          </div>`;

      const squadNameDisplay = (() => {
        if (!hero.isInSquad || !hero.assignedBuilding) return 'Squad';
        const barracksIdx = parseInt(hero.assignedBuilding.replace('barracks_', ''), 10);
        const squads = this._s.um?.getSquads() ?? [];
        return squads[barracksIdx]?.name ?? `Squad ${barracksIdx + 1}`;
      })();
      const _classCfg = HERO_CLASSIFICATIONS[hero.classification] ?? HERO_CLASSIFICATIONS.combat;

      const assignmentStatusChip = hero.isInSquad
        ? `<div class="hero-assignment-chip chip-squad mb-3">${icon('sword')} ${squadNameDisplay}</div>`
        : hero.isInBuilding
          ? `<div class="hero-assignment-chip chip-building mb-3">${icon('house')} ${hero.assignedBuilding ?? 'Building'}</div>`
          : `<div class="hero-assignment-chip chip-idle mb-3">○ Unassigned</div>`;

      // Squad assignment: show dropdown of available squads or unassign button
      const squads      = this._s.um?.getSquads() ?? [];
      const assignHtml  = hero.isInSquad
        ? `<button class="btn btn-danger btn-unassign-squad w-full" data-hero="${hero.id}">Remove from Squad</button>`
        : hero.isInBuilding
          ? `<button class="btn btn-danger btn-unassign-building w-full" data-hero="${hero.id}">Unstation from Building</button>`
          : squads.length === 0
            ? `<div class="hero-no-squads-hint">${icon('sword')} Create a squad in the Barracks first, then assign heroes there.</div>`
            : `<div class="hero-squad-assign-row">
                <div class="squad-dropdown hero-squad-dropdown" data-hero="${hero.id}">
                  <button type="button" class="squad-dropdown-trigger">
                    <span class="squad-select-label">Choose a squad...</span>
                    <span class="chevron">▼</span>
                  </button>
                  <div class="squad-dropdown-panel">
                    ${squads.map(s => {
                      const count = this._s.heroes.getHeroesForSquad(s.id).length;
                      return `<div class="squad-dropdown-option${count >= 4 ? ' disabled' : ''}" data-value="${s.id}">${s.name} <span class="squad-opt-units">(${count}/4)</span></div>`;
                    }).join('')}
                  </div>
                  <input type="hidden" class="squad-select-value" value="">
                </div>
                <button class="btn btn-primary btn-assign-squad" data-hero="${hero.id}">${icon('sword')} Assign</button>
              </div>
              <button class="btn btn-secondary btn-assign-building mt-2" data-hero="${hero.id}" data-hero-name="${hero.name}">${icon('house')} Station at Building</button>`;

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
          ${assignHtml}
        </div>`;
    }

    return `
      <div class="heroes-detail-panel">
        <div class="heroes-detail-hero-header heroes-detail-hero-header--${hero.tier}">
          <div class="hero-detail-portrait hero-detail-portrait--${hero.tier}">${hero.icon}</div>
          <div class="hero-detail-header-info">
            <div class="hero-detail-badges-row">
              <div class="hero-tier-badge tier-badge-${hero.tier}">${tierMeta.symbol} ${tierMeta.label}</div>
              ${hero.classification ? `<div class="hero-class-badge class-${hero.classification}">${iconFromEmoji(HERO_CLASSIFICATIONS[hero.classification]?.icon ?? '') || icon('sword')} ${(HERO_CLASSIFICATIONS[hero.classification]?.label ?? hero.classification)}</div>` : ''}
            </div>
            <div class="hero-detail-name">${hero.name}</div>
            <div class="hero-detail-title-sub">${hero.title}</div>
          </div>
          ${hero.isOwned ? `<div class="hero-detail-level-badge">Lv.${hero.level}</div>` : ''}
        </div>
        <div class="hero-detail-body">
          <p class="hero-description">${hero.description}</p>
          ${statsHtml}
          ${auraHtml}
          <div class="hero-detail-sections">${contentHtml}</div>
        </div>
      </div>`;
  }

  // ── Bind action listeners on the detail panel ────────────────────────────

  _bindDetailListeners(detailPane, hero) {
    detailPane.querySelector('.btn-recruit')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      const r = this._s.heroes.recruitWithCard(e.currentTarget.dataset.card);
      if (!r.success) {
        eventBus.emit('ui:error');
        this._s.notifications?.show('warning', 'Cannot Recruit', r.reason);
      } else {
        const cfg = this._s.heroes.getRosterWithState().find(h => h.id === r.heroId);
        this._s.notifications?.show('success', '👑 Hero Recruited!', `${cfg?.name ?? r.heroId} has joined your roster!`);
      }
    });

    detailPane.querySelector('.btn-summon-frags')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      const r = this._s.heroes.summonFromFragments(e.currentTarget.dataset.hero);
      if (!r.success) {
        eventBus.emit('ui:error');
        this._s.notifications?.show('warning', 'Cannot Summon', r.reason);
      } else {
        const cfg = this._s.heroes.getRosterWithState().find(h => h.id === r.heroId);
        this._s.notifications?.show('success', '✨ Hero Summoned!', `${cfg?.name ?? r.heroId} materialised from fragments!`);
      }
    });

    detailPane.querySelector('.btn-assign-squad')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      const heroId  = e.currentTarget.dataset.hero;
      const hidden  = detailPane.querySelector('.squad-select-value');
      const squadId = hidden?.value;
      if (!squadId) {
        this._s.notifications?.show('warning', 'No Squad Selected', 'Please choose a squad from the dropdown.');
        return;
      }
      // Route through the unified barracks model (squad_1 → barracks_0 → type:'building')
      const r = this._s.heroes.assignHeroToBuilding(heroId, this._barracksIdForSquad(squadId));
      if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Assign', r.reason); }
    });

    // Wire custom squad dropdown in hero detail
    detailPane.querySelectorAll('.hero-squad-dropdown').forEach(dd => {
      const trig   = dd.querySelector('.squad-dropdown-trigger');
      const hidden = dd.querySelector('.squad-select-value');
      trig?.addEventListener('click', () => {
        eventBus.emit('ui:click');
        dd.classList.toggle('open');
      });
      dd.querySelectorAll('.squad-dropdown-option:not(.disabled)').forEach(opt => {
        opt.addEventListener('click', () => {
          eventBus.emit('ui:click');
          hidden.value = opt.dataset.value;
          trig.querySelector('.squad-select-label').textContent = opt.textContent;
          dd.querySelectorAll('.squad-dropdown-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          dd.classList.remove('open');
        });
      });
      document.addEventListener('click', (ev) => {
        if (!dd.contains(ev.target)) dd.classList.remove('open');
      }, { capture: true });
    });

    detailPane.querySelector('.btn-unassign-squad')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      this._s.heroes.unassignHeroFromSquad(e.currentTarget.dataset.hero);
    });

    detailPane.querySelector('.btn-unassign-building')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      this._s.heroes.unassignHeroFromBuilding(e.currentTarget.dataset.hero);
    });

    detailPane.querySelector('.btn-assign-building')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      eventBus.emit('ui:navigateTo', 'base');
      this._s.notifications?.show('info', 'Go to Buildings', `Open the Base tab and station ${e.currentTarget.dataset.heroName ?? 'your hero'} from their compatible building card.`);
    });

    detailPane.querySelectorAll('.btn-xp-bundle').forEach(btn => {
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

    detailPane.querySelector('.btn-awaken-card')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      const r = this._s.heroes.awakenHero(e.currentTarget.dataset.hero, 'card');
      if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Awaken', r.reason); }
    });

    detailPane.querySelector('.btn-awaken-frag')?.addEventListener('click', e => {
      eventBus.emit('ui:click');
      const r = this._s.heroes.awakenHero(e.currentTarget.dataset.hero, 'fragment');
      if (!r.success) { eventBus.emit('ui:error'); this._s.notifications?.show('warning', 'Cannot Awaken', r.reason); }
    });
  }
}
