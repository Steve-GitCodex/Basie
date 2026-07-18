/**
 * UIManager.js — Orchestrator
 *
 * Thin bootstrap layer. Instantiates each domain UI controller with only
 * the systems it needs, calls init() on each, then triggers an initial
 * full render. All business logic and rendering belongs in the controllers.
 *
 * Domain controllers:
 *   NavigationUI   — nav, status bar, resource display, live timers
 *   BuildingsUI    — buildings grid
 *   BarracksUI     — reserve units, squads, training queue
 *   HeroesUI       — hero roster
 *   CombatUI       — campaign map, battle modal & animation, battle log
 *   ResearchUI     — tech tree + achievements panel
 *   QuestsUI       — quest cards + quest-completion modal
 *   MarketUI       — trade cards
 *   MailUI         — inbox modal
 *   SettingsUI     — settings modal
 */
import { NavigationUI } from './controllers/NavigationUI.js';
import { BuildingsUI }  from './controllers/BuildingsUI.js';
import { BarracksUI }   from './controllers/BarracksUI.js';
import { HeroesUI }     from './controllers/HeroesUI.js';
import { CombatUI }     from './controllers/CombatUI.js';
import { ResearchUI }   from './controllers/ResearchUI.js';
import { QuestsUI }     from './controllers/QuestsUI.js';
import { MarketUI }     from './controllers/MarketUI.js';
import { MailUI }       from './controllers/MailUI.js';
import { SettingsUI }   from './controllers/SettingsUI.js';
import { InventoryUI }  from './controllers/InventoryUI.js';
import { ShopUI }       from './controllers/ShopUI.js';
import { GachaUI }      from './controllers/GachaUI.js';
import { MilitaryUI }   from './controllers/MilitaryUI.js';
import { ChallengesUI } from './controllers/ChallengesUI.js';
import { EventsUI }     from './controllers/EventsUI.js';
import { WorldMapUI }   from './controllers/WorldMapUI.js';
import { ResourceFlyout } from './fx/resourceFlyout.js';
import { RES_META, openModal, closeModal } from './uiUtils.js';
import { icon, iconFromEmoji } from './icons.js';
import { INVENTORY_ITEMS } from '../entities/GAME_DATA.js';
import { eventBus }     from '../core/EventBus.js';

export class UIManager {
  constructor(systems) {
    this.name      = 'UIManager';
    this._rm            = systems.rm;
    this._inv           = systems.inventory    ?? null;
    this._user          = systems.user         ?? null;
    this._mailMgr       = systems.mail         ?? null;
    this._story         = systems.story        ?? null;
    this._tutorial      = systems.tutorial     ?? null;
    this._sound         = systems.sound        ?? null;
    this._notifications = systems.notifications ?? null;

    // Instantiate each controller with only its required systems
    this._navigation = new NavigationUI({
      rm:            systems.rm,
      bm:            systems.bm,
      um:            systems.um,
      tech:          systems.tech,
      user:          systems.user,
      mail:          systems.mail,
      heroes:        systems.heroes,
      notifications: systems.notifications,
      achievements:  systems.achievements,
    });

    this._buildings = new BuildingsUI({
      rm:            systems.rm,
      bm:            systems.bm,
      tm:            systems.tech,
      um:            systems.um,
      inventory:     systems.inventory,
      notifications: systems.notifications,
      heroes:        systems.heroes,
    });

    this._barracks = new BarracksUI({
      rm:            systems.rm,
      um:            systems.um,
      inventory:     systems.inventory,
      heroes:        systems.heroes,
      notifications: systems.notifications,
    });

    this._military = new MilitaryUI({
      rm:            systems.rm,
      um:            systems.um,
      bm:            systems.bm,
      inventory:     systems.inventory,
      notifications: systems.notifications,
      tech:          systems.tech,
    });

    this._heroes = new HeroesUI({
      rm:            systems.rm,
      um:            systems.um,
      heroes:        systems.heroes,
      inventory:     systems.inventory,
      notifications: systems.notifications,
    });

    this._inventory = new InventoryUI({
      inventory:     systems.inventory,
      heroes:        systems.heroes,
      notifications: systems.notifications,
    });

    this._shop = new ShopUI({
      rm:            systems.rm,
      bm:            systems.bm,
      tech:          systems.tech,
      inventory:     systems.inventory,
      notifications: systems.notifications,
      user:          systems.user,
    });

    this._gacha = new GachaUI({
      inventory:     systems.inventory,
      heroes:        systems.heroes,
      notifications: systems.notifications,
    });

    this._combat = new CombatUI({
      cm:            systems.cm,
      um:            systems.um,
      user:          systems.user,
      notifications: systems.notifications,
      sound:         systems.sound,
    });

    this._research = new ResearchUI({
      rm:            systems.rm,
      tech:          systems.tech,
      inventory:     systems.inventory,
      achievements:  systems.achievements,
      notifications: systems.notifications,
    });

    this._quests = new QuestsUI({
      quest:         systems.quest,
      story:         systems.story,
      notifications: systems.notifications,
    });

    this._market = new MarketUI({
      rm:            systems.rm,
      market:        systems.market,
      notifications: systems.notifications,
    });

    this._mail = new MailUI({
      mail:          systems.mail,
      rm:            systems.rm,
      notifications: systems.notifications,
      sound:         systems.sound,
    });

    this._settings = new SettingsUI({
      settings:             systems.settings,
      sound:                systems.sound,
      user:                 systems.user,
      achievements:         systems.achievements,
      firebase:             systems.firebase,
      saveManager:          systems.saveManager,
      isFirebaseConfigured: systems.isFirebaseConfigured,
    });

    this._challenges = new ChallengesUI({
      challenges: systems.challenges,
    });

    this._events = new EventsUI({
      events:        systems.events,
      rm:            systems.rm,
      notifications: systems.notifications,
    });

    this._world = new WorldMapUI({
      worldMap:      systems.worldMap,
      march:         systems.march,
      um:            systems.um,
      notifications: systems.notifications,
    });

    this._init();
  }

  _init() {
    // Register event subscriptions and one-time DOM bindings
    this._navigation.init();
    this._buildings.init();
    this._barracks.init();
    this._military.init();
    this._heroes.init();
    this._inventory.init();
    this._combat.init();
    this._research.init();
    this._quests.init();
    this._market.init();
    this._mail.init();
    this._settings.init();
    this._shop.init();
    this._gacha.init();
    this._challenges.init();
    this._events.init();
    this._world.init();
    this._flyout = new ResourceFlyout();
    this._installButtonSfx();
    eventBus.on('story:chapter_triggered', chapter => this._showStoryModal(chapter));

    // ── Tutorial overlay ────────────────────────────────────────────────
    this._tutStep = null; // current active step — needed to re-pin ring after re-renders
    eventBus.on('tutorial:stepAdvanced', d  => this._showTutorialStep(d.step, d.stepIndex, d.totalSteps));
    eventBus.on('tutorial:complete',     () => this._hideTutorial());
    // Re-pin the ring whenever BuildingsUI replaces its innerHTML
    eventBus.on('buildings:rendered',    () => this._repositionRing());
    document.getElementById('btn-tutorial-skip')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      this._tutorial?.skip();
    });

    // ── Group 4: Visual feedback animations ──────────────────────────────
    // Card flash on queue completion (setTimeout lets controllers re-render first)
    eventBus.on('building:completed', d => {
      setTimeout(() => {
        document.querySelectorAll(`[data-bid="${d?.id}"]`)
          .forEach(el => this._flashCard(el));
      }, 0);
    });
    eventBus.on('unit:trained', d => {
      setTimeout(() => {
        document.querySelectorAll(`[data-unit-id="${d?.tierKey}"]`)
          .forEach(el => this._flashCard(el));
      }, 0);
    });
    eventBus.on('tech:researched', d => {
      setTimeout(() => {
        document.querySelectorAll(`[data-tech-id="${d?.id}"]`)
          .forEach(el => this._flashCard(el));
      }, 0);
    });

    // Victory / defeat banner on the world map (after modal closes)
    eventBus.on('combat:victory', () => this._showBattleBanner(false));
    eventBus.on('combat:defeat',  () => this._showBattleBanner(true));

    // XP float near the player level badge on level-up
    eventBus.on('user:levelUp', () => this._spawnXpFloat());

    // AchievementManager.claim() already calls grantRewards() before emitting
    // achievement:claimed, so no need to call it again here.
    // grantRewards() emits inventory:updated → InventoryUI → ui:rewardAnimation,
    // which is handled below, covering the animation + chime automatically.
    eventBus.on('achievement:claimed', () => { /* handled via ui:rewardAnimation */ });

    // Floating reward cards + chime — triggered by InventoryUI when it detects
    // that an inventory:updated event originated from grantRewards().
    eventBus.on('ui:rewardAnimation', (items) => {
      this._showRewardAnimation(items);
      this._sound?.playChime();
    });

    // Perform the full initial render
    this._buildings.render();
    // BarracksUI, MilitaryUI & ResearchUI are modal-driven (opened from building tooltips) — no initial render.
    this._heroes.render();
    this._combat.render();
    this._quests.render();
    this._market.render();

    // ── Group 8: Notification hover-pause ───────────────────────────────────────
    const notifEl = document.getElementById('notification-container');
    if (notifEl && this._notifications) {
      notifEl.addEventListener('mouseenter', () => this._notifications.startHoverPause());
      notifEl.addEventListener('mouseleave', () => this._notifications.endHoverPause());
    }
  }

  /** No-op — UIManager is event-driven. Kept for GameEngine compatibility. */
  update(dt) {}

  // ─────────────────────────────────────────────
  // Group 4 animation helpers
  // ─────────────────────────────────────────────

  /**
   * Universal button click sample. Fires ui:click for any button press that a
   * callsite didn't already voice; SoundManager.click() coalesces the duplicate
   * when both fire within the same event.
   */
  _installButtonSfx() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest?.('button, .btn, [role="button"]');
      if (!btn || btn.disabled) return;
      eventBus.emit('ui:click');
    }, true);
  }

  /** Briefly flash a card element with the cardFlash CSS animation. */
  _flashCard(el) {
    if (!el) return;
    el.classList.remove('flash-complete'); // reset if already running
    void el.offsetWidth;                  // force reflow to restart animation
    el.classList.add('flash-complete');
    el.addEventListener('animationend', () => el.classList.remove('flash-complete'), { once: true });
  }

  /** Show a small victory/defeat banner that auto-dismisses after 2.5 s. */
  _showBattleBanner(isDefeat) {
    const existing = document.querySelector('.victory-banner');
    if (existing) existing.remove();

    // Delay slightly so the battle modal finishes closing first
    setTimeout(() => {
      const banner = document.createElement('div');
      banner.className = `victory-banner${isDefeat ? ' defeat' : ''}`;
      banner.innerHTML = isDefeat ? `${icon('x-circle', 'icon--danger')} Defeated!` : `${icon('sword', 'icon--gold')} Victory!`;
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 2500);

      // Shake the current available stage node on defeat
      if (isDefeat) {
        const availableNode = document.querySelector('.campaign-node.available');
        if (availableNode) {
          availableNode.classList.add('defeat-shake');
          availableNode.addEventListener('animationend', () => availableNode.classList.remove('defeat-shake'), { once: true });
        }
      }
    }, 400);
  }

  /**
   * Spawn floating reward cards near the inventory icon for each granted item.
   * Cards pop in with a scale animation then float upward and fade out.
   * @param {Array<{ type: string, itemId: string, quantity: number }>} itemsArray
   */
  _showRewardAnimation(itemsArray) {
    if (!Array.isArray(itemsArray) || itemsArray.length === 0) return;
    const anchor   = document.getElementById('btn-inventory');
    const baseRect = anchor?.getBoundingClientRect();
    const baseX    = baseRect ? baseRect.left + baseRect.width / 2 - 40 : window.innerWidth - 90;
    const baseY    = baseRect ? baseRect.bottom + 8 : 64;

    // P9: cap displayed cards at 5 — show 4 real items then a "+N more" summary card
    const overflow    = itemsArray.length > 5 ? itemsArray.length - 4 : 0;
    const displayList = overflow ? itemsArray.slice(0, 4) : itemsArray;

    const spawnCard = (label, i) => {
      const card = document.createElement('div');
      card.className = 'reward-float-card';
      card.innerHTML = label;
      card.style.left  = `${baseX}px`;
      // Stagger each card so multiple items don't overlap
      card.style.top   = `${baseY + i * 38}px`;
      document.body.appendChild(card);
      card.addEventListener('animationend', () => card.remove(), { once: true });
      // P7: safety fallback in case animationend never fires
      setTimeout(() => card.remove(), 2000);
    };

    displayList.forEach((item, i) => {
      let label;
      if (item.type === 'resource') {
        const ico = RES_META[item.itemId]?.icon ?? '';
        label = `${ico} ×${item.quantity}`;
      } else {
        const cfg  = INVENTORY_ITEMS[item.itemId];
        const ico  = iconFromEmoji(cfg?.icon ?? '') || icon('box');
        const name = cfg?.name ?? item.itemId;
        label = `${ico} ${name} ×${item.quantity}`;
      }
      spawnCard(label, i);
    });

    if (overflow) {
      spawnCard(`+${overflow} more`, displayList.length);
    }
  }

  /** Spawn a "+LEVEL UP!" float near the player-level element in the header. */
  _spawnXpFloat() {
    const anchor = document.getElementById('player-level');
    const span   = document.createElement('span');
    span.className   = 'xp-float';
    span.textContent = '▲ LEVEL UP!';

    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      span.style.left = `${rect.left + rect.width / 2 - 32}px`;
      span.style.top  = `${rect.top - 6}px`;
    } else {
      span.style.left = '50%';
      span.style.top  = '60px';
    }

    document.body.appendChild(span);
    span.addEventListener('animationend', () => span.remove(), { once: true });
  }

  // ─────────────────────────────────────────────
  // Daily Login Modal
  // ─────────────────────────────────────────────

  /**
   * Shows the daily login reward modal.
   * @param {number} day    - cycle day (1–7)
   * @param {number} streak - consecutive login streak
   * @param {object} rewards - resource rewards object
   */
  showDailyLoginModal(day, streak, rewards) {
    const rewardRows = rewards
      .map(r => r.type === 'resource'
        ? `<div class="offline-reward-row"><span>${RES_META[r.itemId]?.icon ?? '\u2728'} ${r.itemId}</span><span style="color:var(--clr-success);font-family:var(--font-mono)">+${r.quantity.toLocaleString()}</span></div>`
        : `<div class="offline-reward-row"><span>\ud83d\udce6 ${r.itemId.replace(/_/g, ' ')}</span><span style="color:var(--clr-success);font-family:var(--font-mono)">×${r.quantity}</span></div>`)
      .join('');

    // 7-day calendar strip
    const calendarCells = Array.from({ length: 7 }, (_, i) => {
      const d       = i + 1;
      const active  = d === day ? 'login-day-active' : d < day ? 'login-day-past' : '';
      return `<div class="login-day-cell ${active}"><span class="login-day-num">${d}</span></div>`;
    }).join('');

    const milestoneNote = streak % 30 === 0
      ? `<p style="color:var(--clr-gold);font-size:0.85rem;text-align:center;margin:0.5rem 0">${icon('star-burst', 'icon--gold')} Milestone: ${streak}-day streak!</p>`
      : '';

    openModal(`
      <div class="modal-inner">
        <div class="modal-top">
          <div class="modal-icon">${icon('gift', 'icon--gold')}</div>
          <div class="modal-title-block">
            <div class="modal-title">Daily Login Reward</div>
            <div class="modal-subtitle">${icon('fire', 'icon--danger')} Day ${day} · ${streak}-day streak</div>
          </div>
        </div>
        ${milestoneNote}
        <div class="modal-section">
          <div class="modal-section-title">Login Streak</div>
          <div class="login-day-strip">${calendarCells}</div>
        </div>
        <div class="modal-section">
          <div class="modal-section-title">Today's Rewards</div>
          <div class="offline-rewards">${rewardRows}</div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-gold" id="btn-login-claim">Claim Rewards</button>
        </div>
      </div>`);

    // Deliver rewards via InventoryManager and close
    let _loginClaimed = false;
    document.getElementById('btn-login-claim')?.addEventListener('click', (e) => {
      if (_loginClaimed) return;
      _loginClaimed = true;
      e.currentTarget.disabled = true;
      this._inv?.grantRewards(rewards);

      // Confirmation mail — summarises what was granted and current streak
      if (this._mailMgr) {
        const rewardLines = rewards
          .map(r => r.type === 'resource'
            ? `+${r.quantity.toLocaleString()} ${r.itemId}`
            : `\u00d7${r.quantity} ${r.itemId.replace(/_/g, ' ')}`)
          .join(', ');
        const isMilestone = streak % 30 === 0;
        this._mailMgr.send({
          type:    'system',
          subject: isMilestone
            ? `\ud83c\udf1f ${streak}-Day Milestone Reward Claimed!`
            : `\ud83c\udf81 Day ${day} Login Reward Claimed`,
          body:    `Your ${streak}-day streak reward has been added to your account.\n\nRewards: ${rewardLines}`,
          icon:    '\ud83c\udf81',
        });
      }

      eventBus.emit('dailyLogin:modalClosed');
      closeModal();
    });
  }

  // ─────────────────────────────────────────────
  // Story Chapter Modal
  // ─────────────────────────────────────────────

  /**
   * Shows the story dialogue modal for a triggered chapter.
   * Steps through dialogue lines one at a time, then shows rewards.
   * @param {object} chapter
   */
  _showStoryModal(chapter) {
    const overlay = document.getElementById('story-modal-overlay');
    const panel   = document.getElementById('story-modal-panel');
    if (!overlay || !panel) return;

    let lineIndex = 0;
    const lines   = chapter.dialogue ?? [];

    const renderLine = () => {
      const line   = lines[lineIndex];
      const isLast = lineIndex === lines.length - 1;

      // Dialogue bubble
      const bubble = document.createElement('div');
      bubble.className = 'story-bubble story-bubble-new';
      bubble.innerHTML = `
        <span class="story-speaker">${line.speaker}</span>
        <p class="story-text">${line.text}</p>`;
      const dialogueEl = panel.querySelector('.story-dialogue');
      dialogueEl.innerHTML = '';
      dialogueEl.appendChild(bubble);

      // Update counter
      const counter = panel.querySelector('.story-line-counter');
      if (counter) counter.textContent = `${lineIndex + 1} / ${lines.length}`;

      // Update button
      const btn = panel.querySelector('#story-btn-next');
      if (btn) btn.textContent = isLast ? 'Collect Rewards' : 'Next ▶';
    };

    // Build the modal content
    const rewardHtml = Object.entries(chapter.rewards ?? {}).map(([k, v]) =>
      `<span class="story-reward-chip">${RES_META[k]?.icon ?? ''} +${v} ${k}</span>`
    ).join('');

    panel.innerHTML = `
      <div class="story-header">
        <span class="story-chapter-arc" style="background:${chapter.arcColor ?? '#6c5ce7'}">${chapter.arc ?? 'Chapter'}</span>
        <span class="story-chapter-icon">${iconFromEmoji(chapter.icon ?? '')}</span>
        <div class="story-chapter-title">${chapter.title}</div>
        <button class="story-skip-btn" id="story-btn-skip">Skip ×</button>
      </div>
      <div class="story-dialogue"></div>
      <div class="story-footer">
        <span class="story-line-counter">1 / ${lines.length}</span>
        <button class="btn btn-primary" id="story-btn-next">Next ▶</button>
      </div>`;

    overlay.classList.remove('hidden');
    renderLine();

    // Advance / finish
    const advanceOrFinish = () => {
      if (lineIndex < lines.length - 1) {
        lineIndex++;
        renderLine();
      } else {
        // Grant rewards via tiered bundles and close.
        if (chapter.rewards) {
          // XP granted directly to the player — not via inventory resource bundles
          if (chapter.rewards.xp) this._user?.addXP(chapter.rewards.xp);
          if (this._inv) {
            const rewardArray = Object.entries(chapter.rewards)
              .filter(([k, v]) => k !== 'xp' && v > 0)
              .map(([k, v]) => ({ type: 'resource', itemId: k, quantity: v }));
            if (rewardArray.length) this._inv.grantRewards(rewardArray);
          }
        }
        overlay.classList.add('hidden');
        if (rewardHtml) {
          eventBus.emit('ui:notification', {
            type: 'success', title: `📜 Chapter Complete: ${chapter.title}`, body: rewardHtml
          });
        }
      }
    };

    panel.querySelector('#story-btn-next')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      advanceOrFinish();
    });
    panel.querySelector('#story-btn-skip')?.addEventListener('click', () => {
      eventBus.emit('ui:click');
      if (chapter.rewards) {
        // XP granted directly to the player — not via inventory resource bundles
        if (chapter.rewards.xp) this._user?.addXP(chapter.rewards.xp);
        if (this._inv) {
          const rewardArray = Object.entries(chapter.rewards)
            .filter(([k, v]) => k !== 'xp' && v > 0)
            .map(([k, v]) => ({ type: 'resource', itemId: k, quantity: v }));
          if (rewardArray.length) this._inv.grantRewards(rewardArray);
        }
      }
      overlay.classList.add('hidden');
      // P10: emit the same reward notification that the normal finish path emits
      if (rewardHtml) {
        eventBus.emit('ui:notification', {
          type: 'success', title: `📜 Chapter Complete: ${chapter.title}`, body: rewardHtml
        });
      }
    });
  }

  // ───────────────────────────────────────────────
  // Tutorial overlay
  // ───────────────────────────────────────────────

  /**
   * Show the tutorial spotlight for the given step.
   * If the step has a buildingFocus, emits buildings:focusBuilding first and
   * waits one render cycle before positioning the spotlight.
   */
  _showTutorialStep(step, stepIndex, totalSteps) {
    this._tutStep = step; // store so _repositionRing() can re-find the target after re-renders
    // Populate text content immediately
    const titleEl = document.getElementById('tutorial-title');
    const instrEl = document.getElementById('tutorial-instruction');
    const labelEl = document.getElementById('tutorial-step-label');
    const dotsEl  = document.getElementById('tutorial-step-dots');
    if (titleEl) titleEl.textContent = step.title;
    if (instrEl) instrEl.textContent = step.instruction;
    if (labelEl) labelEl.textContent = `Step ${stepIndex + 1} of ${totalSteps}`;
    if (dotsEl) {
      dotsEl.innerHTML = Array.from({ length: totalSteps }, (_, i) => {
        const cls = i < stepIndex ? 'done' : i === stepIndex ? 'active' : '';
        return `<div class="tutorial-step-dot ${cls}"></div>`;
      }).join('');
    }

    // Navigate to the correct view first so the building cards are in the DOM
    if (step.navView) eventBus.emit('ui:navigateTo', step.navView);

    // Switch the building sub-tab if needed
    if (step.buildingFocus) eventBus.emit('buildings:focusBuilding', step.buildingFocus);

    // 250 ms gives the view switch + BuildingsUI re-render time to complete
    setTimeout(() => this._applySpotlight(step), 250);
  }

  /**
   * Position the 4 blocker divs, floating ring, and tooltip around the target element.
   * Falls back to nav-button pulse highlight if the selector finds nothing.
   */
  _applySpotlight(step) {
    // Clear any previous fallback nav highlight
    document.querySelectorAll('.tutorial-highlight')
      .forEach(el => el.classList.remove('tutorial-highlight'));

    const ring    = document.getElementById('tut-spotlight-ring');
    const tooltip = document.getElementById('tutorial-tooltip');
    const bTop    = document.getElementById('tut-block-top');
    const bBot    = document.getElementById('tut-block-bottom');
    const bLft    = document.getElementById('tut-block-left');
    const bRgt    = document.getElementById('tut-block-right');
    if (!tooltip) return;

    const targetEl = step.highlightSelector
      ? document.querySelector(step.highlightSelector)
      : null;

    if (targetEl) {
      targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

      requestAnimationFrame(() => {
        const pad  = 6;
        const vw   = window.innerWidth;
        const vh   = window.innerHeight;
        const rect = targetEl.getBoundingClientRect();

        // Floating ring (pointer-events:none — button underneath stays clickable)
        if (ring) {
          ring.classList.remove('hidden');
          ring.style.cssText = `top:${rect.top - pad}px;left:${rect.left - pad}px;width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px`;
        }

        const x1 = Math.max(0, rect.left   - pad);
        const y1 = Math.max(0, rect.top    - pad);
        const x2 = Math.min(vw, rect.right  + pad);
        const y2 = Math.min(vh, rect.bottom + pad);

        if (bTop) { bTop.classList.remove('hidden'); bTop.style.cssText = `top:0;left:0;right:0;height:${y1}px`; }
        if (bBot) { bBot.classList.remove('hidden'); bBot.style.cssText = `top:${y2}px;left:0;right:0;bottom:0`; }
        if (bLft) { bLft.classList.remove('hidden'); bLft.style.cssText = `top:${y1}px;left:0;width:${x1}px;height:${y2 - y1}px`; }
        if (bRgt) { bRgt.classList.remove('hidden'); bRgt.style.cssText = `top:${y1}px;left:${x2}px;right:0;height:${y2 - y1}px`; }

        const tipW  = Math.min(420, vw - 32);
        const tipH  = 160;
        const tipX  = Math.max(8, Math.min(vw - tipW - 8, rect.left + rect.width / 2 - tipW / 2));
        const below = y2 + 12 + tipH < vh;
        const tipY  = below ? y2 + 12 : Math.max(8, y1 - tipH - 12);

        tooltip.classList.remove('hidden');
        tooltip.style.cssText = `left:${tipX}px;top:${tipY}px;width:${tipW}px`;
      });
    } else {
      // Fallback: pulse the nav button, hide ring + blockers, float tooltip
      if (ring) ring.classList.add('hidden');
      document.getElementById(step.highlight)?.classList.add('tutorial-highlight');
      if (bTop) bTop.classList.add('hidden');
      if (bBot) bBot.classList.add('hidden');
      if (bLft) bLft.classList.add('hidden');
      if (bRgt) bRgt.classList.add('hidden');
      const vw   = window.innerWidth;
      const tipW = Math.min(420, vw - 32);
      tooltip.classList.remove('hidden');
      tooltip.style.cssText = `left:${(vw - tipW) / 2}px;bottom:24px;top:auto;width:${tipW}px`;
    }
  }

  /**
   * Re-pin the floating ring to the current step's target after a BuildingsUI re-render.
   * Lightweight — does NOT move blockers or tooltip.
   */
  _repositionRing() {
    if (!this._tutStep?.highlightSelector) return;
    const ring = document.getElementById('tut-spotlight-ring');
    if (!ring || ring.classList.contains('hidden')) return;
    const targetEl = document.querySelector(this._tutStep.highlightSelector);
    if (!targetEl) return;
    const pad  = 6;
    const rect = targetEl.getBoundingClientRect();
    ring.style.cssText = `top:${rect.top - pad}px;left:${rect.left - pad}px;width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px`;
  }

  /** Remove tutorial spotlight ring, blockers, and tooltip. */
  _hideTutorial() {
    this._tutStep = null;
    document.getElementById('tutorial-tooltip')?.classList.add('hidden');
    document.getElementById('tut-spotlight-ring')?.classList.add('hidden');
    ['tut-block-top','tut-block-bottom','tut-block-left','tut-block-right']
      .forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.querySelectorAll('.tutorial-highlight')
      .forEach(el => el.classList.remove('tutorial-highlight'));
  }
}
