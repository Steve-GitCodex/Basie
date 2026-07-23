/**
 * NavigationUI.js
 * Handles: navigation view switching, status bar, resource display,
 * player profile, live progress-bar timers, save indicator, mail badge.
 *
 * Emits `ui:viewChanged` when the active view changes so domain
 * controllers can re-render themselves.
 */
import { eventBus } from '../../core/EventBus.js';
import { RES_META, fmt } from '../uiUtils.js';
import { tickTo } from '../fx/numberTicker.js';
import { VIP_TIERS, TAB_UNLOCK_CONDITIONS, TAB_GROUPS, BUILDING_TAB_MAP, HQ_UNLOCK_TABLE, BUILDINGS_CONFIG, UNITS_CONFIG } from '../../entities/GAME_DATA.js';
import { icon } from '../icons.js';
import { devMute } from '../../core/devMute.js';

export class NavigationUI {
  /**
   * @param {{ rm, bm, um, tech, user, mail, heroes, notifications }} systems
   */
  constructor(systems) {
    this._s = systems;
    this._activeView = 'base';
    // The last-shown "primary" map view (base|world); the flip button toggles between them.
    this._primaryView = 'base';
    this._sessionStartMs = Date.now();
    // Tracks the last-active sub-tab id per group view — derived from TAB_GROUPS so new groups are automatically included
    this._activeSubTab = Object.fromEntries(Object.keys(TAB_GROUPS).map(k => [k, null]));
    // Badge store: tabKey → string[] of messages
    this._badgeStore = new Map();
    // Throttle for resources:tick → DOM writes capped at 2Hz
    this._resTickThrottle = 0;
  }

  init() {
    this._bindNavigation();
    this._bindHeaderButtons();
    this._bindMoreMenu();
    this._bindFlip();
    this._updateFlipButton();
    this._subscribeToEvents();
    this._renderResources(this._s.rm.getSnapshot());
    this._renderProfile(this._s.user.getProfile());
    this._updateMailBadge(this._s.mail.getUnreadCount());
    this._refreshStatusBar();
    this._refreshUnlockStates();
    if (this._s.achievements) {
      this._updateAchievementsBadge(this._s.achievements.getAll());
    }
    this._refreshMoreBadges();
  }

  // ---- NAVIGATION ----
  _bindNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      if (!btn.dataset.view) return; // non-view buttons (e.g. #nav-build) bind separately
      btn.addEventListener('click', () => {
        eventBus.emit('ui:click');
        if (btn.classList.contains('nav-tab--locked')) {
          this._showLockedTooltip(btn, this._getTabLockReason(btn.dataset.view));
          return;
        }
        this._switchView(btn.dataset.view);
      });
    });
    // Build button opens the Buildables panel (full catalog, no plot context)
    document.getElementById('nav-build')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      eventBus.emit('ui:openBuildables', {});
    });
    this._bindSubTabs();
  }

  /** Wire click handlers for all horizontal sub-tab buttons inside group views. */
  _bindSubTabs() {
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        eventBus.emit('ui:click');
        const groupId   = btn.dataset.group;
        const subViewId = btn.dataset.subView;
        if (groupId && subViewId) this._switchSubTab(groupId, subViewId);
      });
    });
  }

  _switchView(viewId) {
    // If this is a group view, just restore its active sub-tab
    if (TAB_GROUPS[viewId]) {
      document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(`view-${viewId}`)?.classList.remove('hidden');
      document.getElementById(`nav-${viewId}`)?.classList.add('active');
      this._activeView = viewId;

      const group = TAB_GROUPS[viewId];
      let subTabId = this._activeSubTab[viewId];
      const isValidActive = subTabId && this._isSubTabUnlocked(`sub:${subTabId}`);
      if (!isValidActive) {
        subTabId = group.subTabs.find(st => this._isSubTabUnlocked(`sub:${st.id}`))?.id
          ?? group.subTabs[0].id;
      }
      this._switchSubTab(viewId, subTabId);
      return; // ui:viewChanged emitted inside _switchSubTab
    }

    // Check if viewId is a sub-tab viewId living inside a group
    // (e.g. 'barracks', 'shop', 'quests', 'challenges', 'market', 'military')
    for (const [groupId, group] of Object.entries(TAB_GROUPS)) {
      const subTab = group.subTabs.find(st => st.viewId === viewId);
      if (subTab) {
        // Navigate to the parent group view, then activate this sub-tab
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`view-${groupId}`)?.classList.remove('hidden');
        document.getElementById(`nav-${groupId}`)?.classList.add('active');
        this._activeView = groupId;
        this._switchSubTab(groupId, subTab.id);
        return;
      }
    }

    // Standalone view (base, heroes, combat, research, events)
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${viewId}`)?.classList.remove('hidden');
    document.getElementById(`nav-${viewId}`)?.classList.add('active');
    this._activeView = viewId;
    this._clearBadge(viewId);
    eventBus.emit('ui:viewChanged', viewId);
  }

  /**
   * Switch the active sub-tab within a group view.
   * @param {string} groupId   — key in TAB_GROUPS (e.g. 'military')
   * @param {string} subTabId  — sub-tab id (e.g. 'barracks', 'training')
   */
  _switchSubTab(groupId, subTabId) {
    const group = TAB_GROUPS[groupId];
    if (!group) return;

    // Update sub-tab button active state
    document.querySelectorAll(`.sub-tab-btn[data-group="${groupId}"]`).forEach(b => {
      b.classList.toggle('active', b.dataset.subView === subTabId);
    });

    // Hide all sub-views and the locked card for this group
    group.subTabs.forEach(st => {
      document.getElementById(`sub-view-${st.id}`)?.classList.add('hidden');
    });
    const lockedCard = document.getElementById(`sub-locked-${groupId}`);
    lockedCard?.classList.add('hidden');

    const unlocked = this._isSubTabUnlocked(`sub:${subTabId}`);

    if (unlocked) {
      document.getElementById(`sub-view-${subTabId}`)?.classList.remove('hidden');
      this._activeSubTab[groupId] = subTabId;
      this._clearBadge(`sub:${subTabId}`);
      // Emit the viewId the domain controller expects (e.g. 'barracks', 'military')
      const subTabCfg = group.subTabs.find(st => st.id === subTabId);
      eventBus.emit('ui:viewChanged', subTabCfg?.viewId ?? subTabId);
    } else {
      // Show locked-state card with unlock requirement
      if (lockedCard) {
        const cond  = TAB_UNLOCK_CONDITIONS[`sub:${subTabId}`];
        const label = group.subTabs.find(st => st.id === subTabId)?.label ?? subTabId;
        const titleEl  = lockedCard.querySelector('.locked-title');
        const reasonEl = lockedCard.querySelector('.locked-reason');
        if (titleEl)  titleEl.textContent  = `${label} — Locked`;
        if (reasonEl) reasonEl.textContent = cond?.label ?? 'Complete earlier objectives to unlock.';
        lockedCard.classList.remove('hidden');
      }
    }
    // A locked sub-tab skips the ui:viewChanged emit above, so refresh the flip
    // button here too — otherwise its label/lock state lags the active view.
    this._updateFlipButton();
  }

  /**
   * Flip destination. On a map view, toggle to the other map view; from any other
   * view (a group/standalone tab like Economy) return to the current map view so
   * there's always a path back to Base — even while World is still HQ-locked.
   */
  _flipTarget() {
    const onMap = this._activeView === 'base' || this._activeView === 'world';
    if (!onMap) return this._primaryView;
    return this._primaryView === 'base' ? 'world' : 'base';
  }

  /** Wire the single Base⇄World flip button (replaces the two map tabs). */
  _bindFlip() {
    document.getElementById('nav-flip')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      const target = this._flipTarget();
      if (target === 'world' && !this._isTabUnlocked('world')) {
        this._showLockedTooltip(document.getElementById('nav-flip'), this._getTabLockReason('world'));
        return;
      }
      this._switchView(target);
    });
  }

  /** Reflect the flip button's destination (where tapping it will take you). */
  _updateFlipButton() {
    const target = this._flipTarget();
    const icon  = document.getElementById('flip-icon');
    const label = document.getElementById('flip-label');
    if (icon)  icon.className = `nav-icon nav-icon--${target}`;
    if (label) label.textContent = target === 'world' ? 'World' : 'Base';
    document.getElementById('nav-flip')?.classList.toggle('dock-flip--locked',
      target === 'world' && !this._isTabUnlocked('world'));
  }

  /** Wire the "More" overflow popover (Quests / Combat / Economy / Events / Arena). */
  _bindMoreMenu() {
    const btn  = document.getElementById('nav-more');
    const menu = document.getElementById('nav-more-menu');
    if (!btn || !menu) return;

    const close = () => { menu.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
    const open  = () => { menu.classList.add('is-open');    btn.setAttribute('aria-expanded', 'true');  };

    btn.addEventListener('click', e => {
      e.stopPropagation();
      eventBus.emit('ui:click');
      menu.classList.contains('is-open') ? close() : open();
    });
    // Selecting a menu item navigates (via the .nav-btn binding) then closes the menu
    menu.querySelectorAll('.nav-btn').forEach(item => item.addEventListener('click', () => close()));
    // Close on outside click
    document.addEventListener('click', e => {
      if (menu.classList.contains('is-open') && !menu.contains(e.target) && e.target !== btn) close();
    });
  }

  _bindHeaderButtons() {
    document.getElementById('btn-mail')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      eventBus.emit('ui:openMail');
    });
    document.getElementById('btn-inventory')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      eventBus.emit('ui:openInventory');
    });
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      eventBus.emit('ui:openSettings');
    });
    document.getElementById('player-chip')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      eventBus.emit('ui:openProfile');
    });
    // Buff badge → Heroes (manage buffs); Heroes is now building-tied, no nav button
    document.getElementById('buff-hud-badge')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      eventBus.emit('ui:navigateTo', 'heroes');
    });
  }

  // ---- EVENT SUBSCRIPTIONS ----
  _subscribeToEvents() {
    eventBus.on('resources:tick', snap => {
      const now = Date.now();
      if (now - this._resTickThrottle < 500) return;
      this._resTickThrottle = now;
      this._renderResources(snap);
    });
    eventBus.on('resources:ratesChanged', snap => this._renderResources(snap));
    eventBus.on('user:profileUpdated',    p    => this._renderProfile(p));
    eventBus.on('user:levelUp',           ()   => this._renderProfile(this._s.user.getProfile()));
    eventBus.on('user:xpGained',          d    => this._renderProfile(d.profile));
    eventBus.on('mail:received',          d    => this._updateMailBadge(d.unreadCount));
    eventBus.on('mail:updated',           d    => this._updateMailBadge(d.unreadCount)); // covers mail:read and mail:deleted
    eventBus.on('game:saved',             ()   => this._flashSaveIndicator());
    eventBus.on('tick:ui',               ()   => { this._refreshStatusBar(); this._refreshBuffBadgeTick(); });
    eventBus.on('building:completed', d => {
      this._refreshStatusBar();
      this._refreshUnlockStates();
      this._renderAllBadges(); // keep badge visuals in sync after unlock state changes
      this._onBuildingCompleted(d);
      this._refreshMoreBadges();
    });
    eventBus.on('building:started',       ()   => this._refreshStatusBar());
    eventBus.on('building:queueUpdated',  ()   => this._refreshMoreBadges()); // plot occupancy changed
    eventBus.on('building:relocated',     ()   => this._refreshMoreBadges());
    eventBus.on('unit:trained',           d    => { this._refreshStatusBar(); if (d) this._onUnitTrained(d); });
    eventBus.on('army:updated',           ()   => this._refreshStatusBar());
    eventBus.on('tech:researched',        d    => { this._refreshStatusBar(); if (d) this._onTechResearched(d); this._refreshMoreBadges(); });
    eventBus.on('tech:started',           ()   => this._refreshStatusBar());
    eventBus.on('ui:viewChanged',         v    => {
      if (v === 'base' || v === 'world') this._primaryView = v;
      this._updateFlipButton();
    });
    eventBus.on('ui:navigateTo',          v    => this._switchView(v));
    // Building click → Train / Manage Squads now open compact modals (handled by
    // MilitaryUI / BarracksUI). NavigationUI no longer switches to a Military view.
    eventBus.on('population:updated',     ()   => this._refreshStatusBar());
    eventBus.on('buffs:updated',          buffs => this._updateBuffBadge(buffs));
    eventBus.on('building:cafeteria:shortfall', ({ severity, message } = {}) => {
      const title = severity === 'info' ? 'Restock Reminder' : 'Food Running Low';
      this._s.notifications?.show(severity ?? 'warning', title,
        message ?? 'Cafeteria supplies are low — restock food & water.');
    });
    eventBus.on('challenges:updated',  challenges => this._updateChallengesBadge(challenges));
    eventBus.on('events:updated',       state      => { this._updateEventsBadge(state); this._refreshMoreBadges(); });
    eventBus.on('user:vipUpdate',       ()         => this._renderProfile(this._s.user.getProfile()));
    eventBus.on('achievement:unlocked', d          => {
      if (devMute.isMuted('achievements')) return;
      this._s.notifications?.show('success', '🏆 Achievement Unlocked!', d?.name ?? 'Achievement unlocked');
    });
    eventBus.on('achievements:updated', all        => this._updateAchievementsBadge(all));
  }

  // ---- TAB UNLOCK STATES ----
  /**
   * Re-evaluate every nav button and sub-tab button.
   * Applies '.nav-tab--locked' to locked top-level buttons and
   * '.sub-tab-btn--locked' to locked sub-tab buttons.
   * Called on init and every time a building completes.
   */
  _refreshUnlockStates() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const viewId = btn.dataset.view;
      if (!viewId) return;
      const locked = !this._isTabUnlocked(viewId);
      btn.classList.toggle('nav-tab--locked', locked);
      btn.setAttribute('aria-disabled', String(locked));
    });

    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      const subViewId = btn.dataset.subView;
      if (!subViewId) return;
      const locked = !this._isSubTabUnlocked(`sub:${subViewId}`);
      btn.classList.toggle('sub-tab-btn--locked', locked);
    });

    this._updateFlipButton(); // world may have just unlocked (Rally Point built)
  }

  /** Returns true if the top-level tab for viewId is currently accessible. */
  _isTabUnlocked(viewId) {
    const cond = TAB_UNLOCK_CONDITIONS[viewId];
    if (!cond) return true;
    return this._checkCondition(cond, viewId);
  }

  /** Returns true if a sub-tab (keyed as 'sub:id') is currently accessible. */
  _isSubTabUnlocked(subKey) {
    const cond = TAB_UNLOCK_CONDITIONS[subKey];
    if (!cond) return true;
    return this._checkCondition(cond, subKey);
  }

  _checkCondition(cond, key) {
    switch (cond.type) {
      case 'always':       return true;
      case 'building':     return (this._s.bm.getLevelOf(cond.buildingId) ?? 0) >= 1;
      case 'building_any': return cond.buildingIds.some(id => (this._s.bm.getLevelOf(id) ?? 0) >= 1);
      case 'hq_level':     return (this._s.bm.getLevelOf('townhall') ?? 0) >= cond.level;
      case 'group_any': {
        const group = TAB_GROUPS[key];
        return group?.subTabs.some(st => this._isSubTabUnlocked(`sub:${st.id}`)) ?? true;
      }
      default: return true;
    }
  }

  _getTabLockReason(viewId) {
    const cond = TAB_UNLOCK_CONDITIONS[viewId];
    if (!cond || cond.type === 'group_any') {
      // For group tabs, derive the reason from the first locked sub-tab
      const group = TAB_GROUPS[viewId];
      if (group) {
        const firstLocked = group.subTabs.find(st => !this._isSubTabUnlocked(`sub:${st.id}`));
        if (firstLocked) {
          const sc = TAB_UNLOCK_CONDITIONS[`sub:${firstLocked.id}`];
          return sc?.label ?? 'Complete earlier objectives to unlock.';
        }
      }
    }
    return cond?.label ?? 'Complete earlier objectives to unlock.';
  }

  /**
   * Show a small tooltip near btn for 2.5 seconds stating the lock reason.
   * Positioned to the right of the nav sidebar button.
   */
  _showLockedTooltip(btn, message) {
    document.getElementById('tab-lock-tooltip')?.remove();
    const tooltip = document.createElement('div');
    tooltip.id        = 'tab-lock-tooltip';
    tooltip.className = 'tab-unlock-tooltip';
    tooltip.innerHTML = `${icon('lock')} ${message}`;
    const rect = btn.getBoundingClientRect();
    tooltip.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    tooltip.style.left   = `${Math.min(rect.left + rect.width / 2, window.innerWidth - 140)}px`;
    tooltip.style.transform = 'translateX(-50%)';
    document.body.appendChild(tooltip);
    setTimeout(() => tooltip.classList.add('tab-unlock-tooltip--fade'), 2000);
    setTimeout(() => tooltip.remove(), 2500);
  }

  // ---- ACTIVITY BADGES ----

  /**
   * Add a badge message for a tab. 'tabKey' matches keys in TAB_UNLOCK_CONDITIONS
   * (e.g. 'base', 'research', 'heroes', 'sub:training', 'sub:barracks').
   */
  _addBadge(tabKey, message) {
    if (!tabKey) return;
    const msgs = this._badgeStore.get(tabKey) ?? [];
    msgs.push(message);
    this._badgeStore.set(tabKey, msgs);
    this._renderAllBadges();
  }

  /** Clear all badge messages for a tab and re-render. */
  _clearBadge(tabKey) {
    if (!this._badgeStore.has(tabKey)) return;
    this._badgeStore.delete(tabKey);
    this._renderAllBadges();
  }

  /** True if any sub-tab in the given group has pending badges. */
  _hasGroupBadge(groupId) {
    const group = TAB_GROUPS[groupId];
    if (!group) return false;
    return group.subTabs.some(st => this._badgeStore.has(`sub:${st.id}`));
  }

  /** Apply or remove badge dots and chips on all nav buttons. */
  _renderAllBadges() {
    // Standalone top-level tabs — derived dynamically so newly added tabs are included automatically
    const standaloneKeys = Object.keys(TAB_UNLOCK_CONDITIONS).filter(k => !k.startsWith('sub:') && !TAB_GROUPS[k]);
    for (const key of standaloneKeys) {
      const btn = document.getElementById(`nav-${key}`);
      if (!btn) continue;
      btn.classList.toggle('tab-has-badge', this._badgeStore.has(key));
      this._applyBadgeDot(btn, this._badgeStore.get(key) ?? []);
    }
    // Group parent buttons — dot if any child sub-tab has badges
    for (const [groupId, group] of Object.entries(TAB_GROUPS)) {
      const btn = document.getElementById(`nav-${groupId}`);
      if (btn) {
        const hasBadge = this._hasGroupBadge(groupId);
        btn.classList.toggle('tab-has-badge', hasBadge);
        const allMsgs = hasBadge
          ? group.subTabs.flatMap(st => this._badgeStore.get(`sub:${st.id}`) ?? [])
          : [];
        this._applyBadgeDot(btn, allMsgs);
      }
      // Sub-tab buttons
      for (const st of group.subTabs) {
        const subBtn = document.querySelector(
          `.sub-tab-btn[data-group="${groupId}"][data-sub-view="${st.id}"]`
        );
        if (!subBtn) continue;
        const msgs = this._badgeStore.get(`sub:${st.id}`) ?? [];
        subBtn.classList.toggle('tab-has-badge', msgs.length > 0);
        this._applyBadgeDot(subBtn, msgs);
      }
    }
  }

  /**
   * Refresh the More grid's attention cues: a "build available" dot on #nav-build,
   * plus an aggregate dot on the closed More FAB when anything inside needs action.
   */
  _refreshMoreBadges() {
    const buildAvailable = this._buildAvailable();
    document.getElementById('nav-build-dot')?.classList.toggle('hidden', !buildAvailable);

    const eventsActive = !document.getElementById('events-badge')?.classList.contains('hidden');
    const gridBadged = ['nav-quests', 'nav-combat', 'nav-economy', 'nav-events']
      .some(id => document.getElementById(id)?.classList.contains('tab-has-badge'));
    const any = buildAvailable || eventsActive || gridBadged;
    document.getElementById('nav-more-dot')?.classList.toggle('hidden', !any);
  }

  /** True if any building is unlocked, unbuilt, and has a free plot to sit on. */
  _buildAvailable() {
    return (this._s.bm.getBuildablesCatalog?.() ?? [])
      .some(i => i.availableToBuild && i.hasFreePlot);
  }

  /** Add or remove the attention dot + chip on a single button element. */
  _applyBadgeDot(btn, messages) {
    if (!btn) return;
    let dot  = btn.querySelector('.tab-attention-dot');
    let chip = btn.querySelector('.tab-attention-chip');
    if (messages.length === 0) {
      dot?.remove();
      chip?.remove();
      return;
    }
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'tab-attention-dot';
      btn.appendChild(dot);
    }
    if (!chip) {
      chip = document.createElement('span');
      chip.className = 'tab-attention-chip';
      btn.appendChild(chip);
    }
    chip.textContent = messages[messages.length - 1]; // show most recent
  }

  // ---- BADGE EVENT HANDLERS ----

  /**
   * Tabs reached by clicking a building (no bottom-bar button). Their attention
   * cue is redirected to the Base toggle, where the player goes to find them.
   */
  _isBuildingTiedTab(tabKey) {
    return tabKey === 'heroes' || tabKey === 'research'
        || tabKey === 'sub:barracks' || tabKey === 'sub:training';
  }

  _onBuildingCompleted(d) {
    if (!d) return;
    const buildingId   = d.id; // always set per BuildingManager emit
    const cfg          = buildingId ? BUILDINGS_CONFIG[buildingId] : null;
    const buildingName = cfg?.name ?? buildingId ?? 'Building';

    // Badge 'base' whenever a building finishes (if not already on base)
    if (this._activeView !== 'base') {
      this._addBadge('base', `${buildingName} complete`);
    }

    // Badge the mapped gameplay tab if the player isn't already viewing it.
    // Building-tied tabs (heroes/research/barracks/training) have no bar button —
    // the 'base' badge above already covers them, so skip the orphaned key.
    const tabKey = buildingId ? BUILDING_TAB_MAP[buildingId] : null;
    if (tabKey && !this._isBuildingTiedTab(tabKey)) {
      const isSub  = tabKey.startsWith('sub:');
      const subId  = isSub ? tabKey.slice(4) : null;
      const isVisible = isSub
        ? this._activeSubTab[this._getGroupForSubTab(subId)] === subId
        : this._activeView === tabKey;
      if (!isVisible) {
        this._addBadge(tabKey, `${buildingName} ready`);
      }
    }

    // HQ level-up → badge newly unlocked buildings' tabs
    if (buildingId === 'townhall' && d.building?.level) {
      const unlocked = HQ_UNLOCK_TABLE[d.building.level]?.buildings ?? [];
      for (const bid of unlocked) {
        const name   = BUILDINGS_CONFIG[bid]?.name ?? bid;
        if (this._activeView !== 'base') {
          this._addBadge('base', `New: ${name}`);
        }
        const bTabKey = BUILDING_TAB_MAP[bid];
        if (bTabKey && !this._isBuildingTiedTab(bTabKey)) {
          const bIsSub  = bTabKey.startsWith('sub:');
          const bSubId  = bIsSub ? bTabKey.slice(4) : null;
          const bVisible = bIsSub
            ? this._activeSubTab[this._getGroupForSubTab(bSubId)] === bSubId
            : this._activeView === bTabKey;
          if (!bVisible) {
            this._addBadge(bTabKey, `Unlocked: ${name}`);
          }
        }
      }
    }
  }

  _onUnitTrained(d) {
    if (!d) return;
    // Training is building-tied — surface the cue on the Base toggle (unless on base).
    if (this._activeView !== 'base') {
      const unitCfg = d.tierKey ? UNITS_CONFIG[d.tierKey] : null;
      const label   = unitCfg?.name ?? d.tierKey ?? 'Unit';
      this._addBadge('base', `Training complete: ${label}`);
    }
  }

  _onTechResearched(d) {
    // Research is building-tied (Workshop) — cue the Base toggle instead of a nav button.
    if (this._activeView !== 'base') {
      const name = d.name ?? 'Technology';
      const lvl  = d.level ? ` Lv ${d.level}` : '';
      this._addBadge('base', `${name}${lvl} researched`);
    }
  }

  /** Returns the group id containing a given sub-tab id, or null. */
  _getGroupForSubTab(subTabId) {
    for (const [groupId, group] of Object.entries(TAB_GROUPS)) {
      if (group.subTabs.some(st => st.id === subTabId)) return groupId;
    }
    return null;
  }


  _renderResources(snap) {
    for (const key of Object.keys(RES_META)) {
      if (key === 'xp') continue;
      const res = snap[key];
      if (!res) continue;
      const valEl  = document.getElementById(`v-${key}`);
      const rateEl = document.getElementById(`r-${key}`);
      const capEl  = document.getElementById(`c-${key}`);
      if (valEl)  tickTo(valEl, res.amount, fmt);
      if (rateEl) rateEl.textContent = res.perSec > 0 ? `+${res.perSec.toFixed(1)}/s` : '';
      if (capEl && res.cap !== Infinity) capEl.textContent = `/ ${fmt(res.cap)}`;
      // Capacity fill-bar (HUD v2): drive the chip's ::after width via --fill.
      const chip = document.getElementById(`res-${key}`);
      if (chip && res.cap && res.cap !== Infinity) {
        const pct = Math.max(0, Math.min(1, res.amount / res.cap));
        chip.style.setProperty('--fill', pct.toFixed(3));
        chip.title = `${RES_META[key]?.name ?? key}: ${fmt(res.amount)} / ${fmt(res.cap)}`;
      }
    }
    // Cafeteria aggregate stock chip
    this._renderCafeteriaChip();
  }

  _renderCafeteriaChip() {
    const chip   = document.getElementById('res-cafeteria');
    if (!chip) return;
    const stocks = this._s.bm?.getCafeteriaStock?.() ?? [];
    if (stocks.length === 0) { chip.style.display = 'none'; return; }
    chip.style.display = '';
    let totalFood = 0, totalWater = 0, totalCapFood = 0, totalCapWater = 0;
    for (const s of stocks) {
      totalFood    += s.stock.food;
      totalWater   += s.stock.water;
      totalCapFood += s.stockCap.food;
      totalCapWater += s.stockCap.water;
    }
    const minStock = Math.min(totalFood, totalWater);
    const minCap   = Math.min(totalCapFood, totalCapWater);
    const valEl    = document.getElementById('v-cafeteria');
    const capEl    = document.getElementById('c-cafeteria');
    const rateEl   = document.getElementById('r-cafeteria');
    if (valEl)  valEl.textContent  = fmt(Math.floor(minStock));
    if (capEl)  capEl.textContent  = `/ ${fmt(minCap)}`;
    // Color the chip when stock is low
    const pct = minCap > 0 ? minStock / minCap : 1;
    chip.style.borderColor = pct < 0.2 ? 'var(--clr-danger)' : '';
    if (rateEl) rateEl.innerHTML = pct < 0.2 ? `${icon('warning')} Low` : '';
  }

  // ---- PROFILE ----
  _renderProfile(profile) {
    const nameEl  = document.getElementById('player-name');
    const levelEl = document.getElementById('player-level');
    const badgeEl = document.getElementById('vip-badge');
    if (nameEl)  nameEl.textContent  = profile.username;
    if (levelEl) levelEl.textContent = `Lv. ${profile.level}`;
    // VIP badge
    if (badgeEl) {
      const tier = this._s.user?.getVipTier() ?? 0;
      if (tier > 0) {
        const tierCfg = VIP_TIERS.find(t => t.tier === tier);
        badgeEl.innerHTML = `${icon('crown')} ${tierCfg?.label ?? `VIP ${tier}`}`;
        badgeEl.title           = tierCfg?.description ?? '';
        badgeEl.classList.remove('hidden');
        badgeEl.dataset.vipTier = tier;
      } else {
        badgeEl.classList.add('hidden');
      }
    }
  }

  // ---- STATUS BAR ----
  _refreshStatusBar() {
    const el = id => document.getElementById(id);
    if (el('sb-army')) el('sb-army').textContent = this._s.um.getTotalUnitCount?.() ?? 0;
    const activeBld = this._s.bm.getAllBuildingsWithStatus().find(b => b.isBuilding);
    if (el('sb-building')) el('sb-building').textContent = activeBld
      ? `${activeBld.name} (${Math.max(0, Math.ceil((activeBld.constructionEndsAt - Date.now()) / 1000))}s)`
      : 'None';
    const activeRes = this._s.tech.getTechWithState().find(t => t.researchEndsAt);
    if (el('sb-research')) el('sb-research').textContent = activeRes
      ? `${activeRes.name} (${Math.max(0, Math.ceil((activeRes.researchEndsAt - Date.now()) / 1000))}s)`
      : 'None';
    const pop = this._s.rm.getPopulation();
    if (el('sb-population')) el('sb-population').textContent = `${Math.floor(pop.current)} / ${pop.cap}`;
    const mins = Math.floor((Date.now() - this._sessionStartMs) / 60000);
    if (el('sb-time')) el('sb-time').textContent = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  _flashSaveIndicator() {
    const el = document.getElementById('sb-save');
    if (!el) return;
    el.textContent = '💾 Saving...'; el.style.color = 'var(--clr-gold)';
    setTimeout(() => { el.textContent = '✅ Saved'; el.style.color = 'var(--clr-success)'; }, 1200);
  }

  // ---- BUFF BADGE ----
  _updateBuffBadge(buffs) {
    const badge = document.getElementById('buff-hud-badge');
    if (!badge) return;
    if (!buffs || buffs.length === 0) {
      badge.classList.add('hidden');
      return;
    }
    badge.classList.remove('hidden');
    const shortest = Math.min(...buffs.map(b => b.remaining));
    const secs = Math.ceil(shortest / 1000);
    const mins = Math.floor(secs / 60);
    const sec  = secs % 60;
    const timeStr = mins > 0 ? `${mins}m ${sec < 10 ? '0' : ''}${sec}s` : `${secs}s`;
    const countEl = badge.querySelector('#buff-badge-count');
    const timerEl = badge.querySelector('#buff-badge-timer');
    if (countEl) countEl.textContent = buffs.length;
    if (timerEl) timerEl.textContent = timeStr;
  }

  _refreshBuffBadgeTick() {
    const buffs = this._s.heroes?.getActiveBuffsWithRemaining?.() ?? [];
    this._updateBuffBadge(buffs);
  }

  // ---- MAIL BADGE ----
  _updateMailBadge(count) {
    const badge = document.getElementById('mail-badge');
    if (!badge) return;
    count > 0
      ? (badge.textContent = count > 99 ? '99+' : count, badge.classList.remove('hidden'))
      : badge.classList.add('hidden');
  }

  // ---- CHALLENGES BADGE ----
  _updateChallengesBadge(payload) {
    const badge = document.getElementById('challenges-badge');
    if (!badge) return;
    const challenges = Array.isArray(payload) ? payload : (payload?.challenges ?? []);
    const claimable  = challenges.filter(c => c.completed && !c.claimed).length;

    // Also count unclaimed pass milestone chests
    const unclaimedMs = (pass) => (pass?.milestones ?? []).filter(m => m.unlocked && !m.claimed).length;
    const milestoneClaimable = unclaimedMs(payload?.dailyPass) + unclaimedMs(payload?.weeklyPass);

    const total = claimable + milestoneClaimable;
    total > 0
      ? (badge.textContent = total > 99 ? '99+' : total, badge.classList.remove('hidden'))
      : badge.classList.add('hidden');
  }

  // ---- EVENTS BADGE ----
  _updateEventsBadge(state) {
    const badge = document.getElementById('events-badge');
    if (!badge) return;
    state?.activeEvent
      ? (badge.textContent = '!', badge.classList.remove('hidden'))
      : badge.classList.add('hidden');
  }

  // ---- ACHIEVEMENTS BADGE ----
  _updateAchievementsBadge(all) {
    const badge = document.getElementById('achievements-badge');
    if (!badge) return;
    const unclaimed = Array.isArray(all)
      ? all.filter(a => a.completed && !a.claimed).length
      : 0;
    unclaimed > 0
      ? (badge.textContent = unclaimed > 99 ? '99+' : String(unclaimed), badge.classList.remove('hidden'))
      : badge.classList.add('hidden');
  }
}
