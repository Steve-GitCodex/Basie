/**
 * main.js  — Phase 3
 * Application bootstrap. Wires all systems including Phase 3 additions:
 * HeroManager, AchievementManager.
 */

import { GameEngine }          from './core/GameEngine.js';
import { SaveManager }         from './core/SaveManager.js';
import { LogManager }          from './core/LogManager.js';
import { eventBus }            from './core/EventBus.js';
import { DEBUG_CONFIG }        from './entities/GAME_DATA.js';

import { ResourceManager }     from './systems/ResourceManager.js';
import { BuildingManager }     from './systems/BuildingManager.js';
import { UnitManager }         from './systems/UnitManager.js';
import { CombatManager }       from './systems/CombatManager.js';
import { NotificationManager } from './systems/NotificationManager.js';
import { MailManager }         from './systems/MailManager.js';
import { UserManager }         from './systems/UserManager.js';
import { QuestManager }        from './systems/QuestManager.js';
import { TechnologyManager }   from './systems/TechnologyManager.js';
import { SettingsManager }     from './systems/SettingsManager.js';
import { MarketManager }       from './systems/MarketManager.js';
import { SoundManager }        from './systems/SoundManager.js';
import { HeroManager }         from './systems/HeroManager.js';
import { InventoryManager }    from './systems/InventoryManager.js';
import { AchievementManager }  from './systems/AchievementManager.js';
import { ChallengeManager }    from './systems/ChallengeManager.js';
import { StoryManager }        from './systems/StoryManager.js';
import { TutorialManager }     from './systems/TutorialManager.js';
import { EventManager }        from './systems/EventManager.js';
import { WorldMapManager }     from './systems/world/WorldMapManager.js';
import { MarchManager }        from './systems/march/MarchManager.js';
import { UIManager }           from './ui/UIManager.js';
import { TimerService }        from './ui/TimerService.js';
import { TooltipService }      from './ui/TooltipService.js';
import { FirebaseDataManager, IS_CONFIGURED } from './core/FirebaseDataManager.js';

// =============================================
// INSTANTIATE SYSTEMS
// =============================================
// LogManager must come first — it is available from the very first tick.
const logManager          = new LogManager({ logPersist: DEBUG_CONFIG.logPersist });

// Global error hooks — route unhandled errors into the in-game log
window.onerror = (msg, src, line) =>
  logManager.log('window', `${msg} at ${src}:${line}`, 'error');
window.addEventListener('unhandledrejection', e =>
  logManager.log('promise', e.reason?.message ?? String(e.reason), 'error'));

const engine              = new GameEngine(logManager);
const saveManager         = new SaveManager();
const firebaseDataManager = new FirebaseDataManager(saveManager);

const userManager      = new UserManager();
const resourceManager  = new ResourceManager();
const buildingManager  = new BuildingManager(resourceManager);
const inventoryManager = new InventoryManager();
const heroManager      = new HeroManager(resourceManager, buildingManager, inventoryManager);
buildingManager.setHeroManager(heroManager);
resourceManager.setBuildingManager(buildingManager);
inventoryManager.setHeroManager(heroManager);
inventoryManager.setResourceManager(resourceManager);
const unitManager      = new UnitManager(resourceManager, buildingManager);
const combatManager    = new CombatManager(unitManager, userManager, resourceManager, heroManager, buildingManager);
resourceManager.setHeroManager(heroManager);
const mailManager      = new MailManager();
const questManager     = new QuestManager(resourceManager, userManager);
const techManager      = new TechnologyManager(resourceManager, buildingManager);
inventoryManager.setBuildingManager(buildingManager);
inventoryManager.setUnitManager(unitManager);
inventoryManager.setTechnologyManager(techManager);
unitManager.setTechnologyManager(techManager);
buildingManager.setUnitManager(unitManager);
const settingsManager  = new SettingsManager(saveManager);
const marketManager    = new MarketManager(resourceManager);
const achievementManager  = new AchievementManager(userManager, mailManager, resourceManager, inventoryManager);
const challengeManager    = new ChallengeManager(resourceManager, mailManager, inventoryManager);
const storyManager = new StoryManager();
const tutorialManager = new TutorialManager(userManager);
const eventManager = new EventManager(resourceManager, mailManager, inventoryManager, userManager);
const worldMapManager = new WorldMapManager();
const marchManager    = new MarchManager(unitManager, combatManager, resourceManager, worldMapManager, buildingManager, inventoryManager);

// Wire InventoryManager into MailManager so mail attachment claims go to inventory
mailManager.setInventoryManager(inventoryManager);

// Validate all required cross-manager dependencies are wired before starting the
// engine. Throws immediately rather than letting the game loop surface silent null errors.
(function _validateWiring() {
  const wires = [
    [buildingManager,  '_hm',            'buildingManager → heroManager'],
    [buildingManager,  '_um',            'buildingManager → unitManager'],
    [resourceManager,  '_buildingManager','resourceManager → buildingManager'],
    [resourceManager,  '_heroManager',   'resourceManager → heroManager'],
    [inventoryManager, '_hm',            'inventoryManager → heroManager'],
    [inventoryManager, '_rm',            'inventoryManager → resourceManager'],
    [inventoryManager, '_bm',            'inventoryManager → buildingManager'],
    [inventoryManager, '_um',            'inventoryManager → unitManager'],
    [inventoryManager, '_tm',            'inventoryManager → techManager'],
    [unitManager,      '_tm',            'unitManager → techManager'],
    [mailManager,      '_inv',           'mailManager → inventoryManager'],
  ];
  for (const [mgr, field, label] of wires) {
    if (!mgr[field]) throw new Error(`[Bootstrap] Dependency not wired: ${label}`);
  }
})();

// ── Event logging hooks — key game events sent to LogManager ───────────────
eventBus.on('building:completed', d => logManager.log('building', `${d?.id ?? '?'} construction complete`, 'info'));
eventBus.on('unit:trained',       d => logManager.log('unit',     `${d?.count ?? '?'}x trained`, 'info'));
eventBus.on('combat:victory',     () => logManager.log('combat',  'victory', 'info'));
eventBus.on('combat:defeat',      () => logManager.log('combat',  'defeat',  'warn'));
eventBus.on('tech:researched',    d => logManager.log('tech',     `${d?.name} Lv.${d?.level}`, 'info'));
eventBus.on('quest:completed',    d => logManager.log('quest',    `"${d?.name}" completed`, 'info'));

let soundManager;
let notificationManager;

// =============================================
// REGISTER WITH ENGINE
// =============================================
engine.registerSystem(resourceManager);
engine.registerSystem(buildingManager);
engine.registerSystem(unitManager);
engine.registerSystem(combatManager);
engine.registerSystem(techManager);
engine.registerSystem(questManager);
engine.registerSystem(mailManager);
engine.registerSystem(heroManager);
engine.registerSystem(marketManager);
engine.registerSystem(challengeManager);
engine.registerSystem(userManager);
engine.registerSystem(achievementManager);
engine.registerSystem(eventManager);
engine.registerSystem(worldMapManager);
engine.registerSystem(marchManager);

// =============================================
// SERIALIZATION
// =============================================
function getGameState() {
  return {
    user:         userManager.serialize(),
    resources:    resourceManager.serialize(),
    buildings:    buildingManager.serialize(),
    units:        unitManager.serialize(),
    combat:       combatManager.serialize(),
    mail:         mailManager.serialize(),
    quests:       questManager.serialize(),
    tech:         techManager.serialize(),
    market:       marketManager.serialize(),
    heroes:       heroManager.serialize(),
    inventory:    inventoryManager.serialize(),
    achievements: achievementManager.serialize(),
    challenges:   challengeManager.serialize(),
    story:        storyManager.serialize(),
    events:       eventManager.serialize(),
    worldMap:     worldMapManager.serialize(),
    march:        marchManager.serialize(),
    gameMode:     engine.gameMode,
    lastSavedTimestamp: Date.now(),
  };
}

function applyGameState(state) {
  if (!state) return;
  // Restore game mode FIRST so all mode-dependent systems receive correct mode
  if (state.gameMode) engine.setGameMode(state.gameMode);
  userManager.deserialize(state.user);
  resourceManager.deserialize(state.resources);
  buildingManager.deserialize(state.buildings);
  unitManager.deserialize(state.units);
  combatManager.deserialize(state.combat);
  mailManager.deserialize(state.mail);
  questManager.deserialize(state.quests);
  techManager.deserialize(state.tech);
  marketManager.deserialize(state.market);
  heroManager.deserialize(state.heroes);
  inventoryManager.deserialize(state.inventory);
  achievementManager.deserialize(state.achievements);
  challengeManager.deserialize(state.challenges);
  storyManager.deserialize(state.story);
  eventManager.deserialize(state.events);
  if (state.worldMap) worldMapManager.deserialize(state.worldMap);
  if (state.march)    marchManager.deserialize(state.march);
}

// =============================================
// NEW-GAME SETUP MODAL
// =============================================
/**
 * Show the mode/difficulty picker whenever the player starts a brand-new game
 * (no existing save).  Calls `onConfirm()` once the player clicks Begin.
 * @param {Function} onConfirm - called after the player confirms their choices
 */
function _showNewGameSetupModal(onConfirm) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  if (!overlay || !content) { onConfirm(); return; }

  let selectedMode = 'campaign';
  let selectedDiff = settingsManager.get('difficulty') ?? 'normal';

  const MODES = [
    { id: 'campaign', label: '⚔️ Campaign',
      desc: 'Follow the story. Fight through 10 stages and reach the endgame.' },
    { id: 'survival', label: '🌊 Survival',
      desc: 'Endless escalating waves. Earn a high score. No story progression.' },
    { id: 'sandbox',  label: '🧪 Sandbox',
      desc: 'Free resources, instant build/train/research. Experiment freely.' },
  ];
  const DIFFS = [
    { id: 'easy',   label: '🟢 Easy',   tip: 'Enemies: −70% HP/ATK. Resource rate: +30%.' },
    { id: 'normal', label: '🟡 Normal', tip: 'Balanced experience. Default setting.' },
    { id: 'hard',   label: '🔴 Hard',   tip: 'Enemies: +40% HP / +30% ATK. Resource rate: −15%.' },
  ];

  const renderModeBtn = (m, active) =>
    `<button class="btn ${active ? 'btn-primary' : 'btn-ghost'} newgame-mode-btn"
      data-mode="${m.id}"
      style="text-align:left;padding:var(--space-3);display:flex;flex-direction:column;gap:2px">
      <span style="font-weight:700">${m.label}</span>
      <span style="font-size:var(--text-xs);color:var(--clr-text-secondary)">${m.desc}</span>
    </button>`;

  const renderDiffBtn = (d, active) =>
    `<button class="btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'} newgame-diff-btn"
      data-diff="${d.id}" title="${d.tip}" style="flex:1">${d.label}</button>`;

  const buildHtml = () => `
    <div class="modal-inner">
      <div class="modal-top">
        <div class="modal-icon">🏰</div>
        <div class="modal-title-block">
          <div class="modal-title">New Game</div>
          <div class="modal-subtitle">Choose your play style and difficulty</div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Game Mode</div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          ${MODES.map(m => renderModeBtn(m, m.id === selectedMode)).join('')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Difficulty</div>
        <div style="display:flex;gap:var(--space-2)">
          ${DIFFS.map(d => renderDiffBtn(d, d.id === selectedDiff)).join('')}
        </div>
        <div style="font-size:var(--text-xs);color:var(--clr-text-muted);margin-top:var(--space-2)">
          Difficulty can also be changed later in Settings.
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary w-full" id="btn-newgame-confirm"
          style="font-size:var(--text-md);padding:var(--space-3)">
          Begin ${selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)}
        </button>
      </div>
    </div>`;

  const rerender = () => {
    content.innerHTML = buildHtml();
    wireButtons();
  };

  const wireButtons = () => {
    content.querySelectorAll('.newgame-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMode = btn.dataset.mode;
        rerender();
      });
    });
    content.querySelectorAll('.newgame-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDiff = btn.dataset.diff;
        rerender();
      });
    });
    document.getElementById('btn-newgame-confirm')?.addEventListener('click', () => {
      engine.setGameMode(selectedMode);
      settingsManager.set('difficulty', selectedDiff);
      overlay.classList.add('hidden');
      content.innerHTML = '';
      onConfirm();
    });
  };

  content.innerHTML = buildHtml();
  overlay.classList.remove('hidden');
  wireButtons();
}

// =============================================
// AUTH SCREEN
// =============================================
function _showAuthError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function _wireLoginForm(authScreen, gameShell, authForm, submitBtn, authError) {
  const emailInput = document.getElementById('auth-email');
  const savedEmail = localStorage.getItem('basie_has_account');
  if (emailInput && savedEmail) emailInput.value = savedEmail;

  authForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = emailInput?.value.trim() ?? '';
    const password = document.getElementById('auth-password')?.value ?? '';
    if (authError) { authError.textContent = ''; authError.classList.add('hidden'); }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing in\u2026'; }

    const result = await firebaseDataManager.signIn(email, password);
    if (!result.success) {
      _showAuthError(authError, result.reason);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
      return;
    }
    userManager.setGuest(false);
    userManager.setUsername(email);
    const firebaseState = await firebaseDataManager.loadGameState();
    launchGame(authScreen, gameShell, firebaseState);
  });
}

function initAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  const gameShell  = document.getElementById('game-shell');
  const submitBtn  = document.getElementById('auth-submit');
  const guestBtn   = document.getElementById('auth-guest');
  const authError  = document.getElementById('auth-error');
  const authForm   = document.getElementById('auth-form');

  const hasAccount = IS_CONFIGURED && !!localStorage.getItem('basie_has_account');

  guestBtn?.addEventListener('click', () => {
    userManager.setGuest(true);
    userManager.setUsername('Guest Commander');
    launchGame(authScreen, gameShell);
  });

  if (!hasAccount) {
    // Hide form fields by default.
    const formInputs = authForm?.querySelectorAll('.form-group, #auth-submit');
    formInputs?.forEach(el => el.style.display = 'none');

    const note = document.createElement('p');
    note.className = 'auth-unavailable';
    note.style.cssText = 'text-align:center;color:var(--clr-text-muted);margin:1rem 0 0.5rem;font-size:0.875rem;';
    note.textContent = IS_CONFIGURED
      ? 'No account yet \u2014 play as guest and create one from your profile.'
      : 'Playing as guest \u2014 account creation unavailable.';
    guestBtn?.parentElement?.insertBefore(note, guestBtn);

    if (IS_CONFIGURED) {
      // Escape hatch: user has an account but cache was cleared
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.textContent = 'Already have an account? Sign in';
      toggle.style.cssText = [
        'display:block;width:100%;margin-top:var(--space-2)',
        'background:none;border:none;cursor:pointer',
        'color:var(--clr-primary);font-size:var(--text-sm);text-align:center',
        'text-decoration:underline;padding:var(--space-1) 0',
      ].join(';');

      toggle.addEventListener('click', () => {
        // Show form, remove the note and toggle
        formInputs?.forEach(el => el.style.display = '');
        note.remove();
        toggle.remove();
        // Persist discovery so next load skips this step
        if (!localStorage.getItem('basie_has_account')) {
          localStorage.setItem('basie_has_account', '');
        }
        _wireLoginForm(authScreen, gameShell, authForm, submitBtn, authError);
      });

      guestBtn?.parentElement?.insertBefore(toggle, guestBtn);
    } else {
      authForm?.addEventListener('submit', e => { e.preventDefault(); });
    }
    return;
  }

  // \u2500\u2500 Firebase configured + account flag present \u2014 show login form directly
  _wireLoginForm(authScreen, gameShell, authForm, submitBtn, authError);
}

// =============================================
// LAUNCH
// =============================================
function launchGame(authScreen, gameShell, externalState = null) {
  const savedState    = externalState ?? saveManager.load();
  const lastTimestamp = savedState?.lastSavedTimestamp ?? null;

  applyGameState(savedState);

  // Broadcast current settings so all managers (ResourceManager difficulty mult,
  // CombatManager difficulty, etc.) pick up their initial values without waiting
  // for a settings change event.
  eventBus.emit('settings:changed', settingsManager.getSettings());

  authScreen.classList.add('hidden');
  gameShell.classList.remove('hidden');

  soundManager = new SoundManager(settingsManager);
  notificationManager = new NotificationManager();

  const ui = new UIManager({
    rm:           resourceManager,
    bm:           buildingManager,
    um:           unitManager,
    cm:           combatManager,
    mail:         mailManager,
    user:         userManager,
    quest:        questManager,
    tech:         techManager,
    settings:     settingsManager,
    market:       marketManager,
    heroes:       heroManager,
    inventory:    inventoryManager,
    achievements:  achievementManager,
    challenges:    challengeManager,
    events:        eventManager,
    worldMap:      worldMapManager,
    march:         marchManager,
    notifications: notificationManager,
    sound:        soundManager,
    story:        storyManager,
    tutorial:     tutorialManager,
    firebase:             firebaseDataManager,
    saveManager:          saveManager,
    isFirebaseConfigured: IS_CONFIGURED,
  });

  // Restore VIP state: broadcasts computed tier from loaded save so all manager
  // multipliers (train speed, research speed, production bonus) are applied before
  // the offline simulation runs.
  userManager.broadcastVipState();

  // Subscribe notification manager to achievement unlocks
  eventBus.on('achievement:unlocked', d => {
    notificationManager.show('success', `🏆 Achievement: ${d.name}`, d.description);
  });

  // Offline progress — capture events during fast simulation
  const offlineEvents = [];
  const offlineListeners = [
    ['building:completed', d => offlineEvents.push({ icon: '🏗️', text: `${d.building?.name ?? d.id} upgraded to Lv ${d.building?.level ?? '?'}` })],
    ['unit:trained',       d => offlineEvents.push({ icon: '🪖', text: `${d.count ?? 1}× ${d.tierKey ?? d.unitId ?? d.name ?? 'unit'} trained` })],
    ['tech:researched',    d => offlineEvents.push({ icon: '🔬', text: `${d.name ?? d.id} researched (Lv ${d.level ?? '?'})` })],
    ['quest:completed',    d => offlineEvents.push({ icon: '📜', text: `Quest "${d.name ?? d.questId}" completed` })],
  ];
  offlineListeners.forEach(([evt, fn]) => eventBus.on(evt, fn));

  const offlineMs = engine.calculateOfflineProgress(lastTimestamp);

  // Remove temporary listeners
  offlineListeners.forEach(([evt, fn]) => eventBus.off(evt, fn));

  // Suppress Welcome Back modal while tutorial is active — the tutorial blockers
  // would prevent the player from closing it, causing a hard deadlock.
  const suppressOfflineModal = !userManager.profile.hasCompletedTutorial;

  // Will be set to a function if there is offline progress worth showing.
  // Scheduled in startEngine() so it never races the daily login modal.
  let _showOfflineModal = null;

  if (!suppressOfflineModal && offlineMs > 5000) {
    const mins = Math.floor(offlineMs / 60000);
    const snap  = resourceManager.getSnapshot();
    const gainSummary = Object.entries(snap)
      .filter(([, r]) => r.perSec > 0)
      .map(([k, r]) => {
        const gained = Math.floor(r.perSec * offlineMs / 1000);
        return `<div class="offline-reward-row"><span>${k}</span><span style="color:var(--clr-success);font-family:var(--font-mono)">+${gained.toLocaleString()}</span></div>`;
      }).join('');

    const eventSummary = offlineEvents.length > 0
      ? `<div class="modal-section">
           <div class="modal-section-title">Completed While Away</div>
           <div class="offline-rewards">${offlineEvents.map(e =>
             `<div class="offline-reward-row"><span>${e.icon} ${e.text}</span></div>`
           ).join('')}</div>
         </div>`
      : '';

    if (gainSummary || eventSummary) {
      _showOfflineModal = () => {
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        content.innerHTML = `
          <div class="modal-inner">
            <div class="modal-top">
              <div class="modal-icon">🌙</div>
              <div class="modal-title-block">
                <div class="modal-title">Welcome Back!</div>
                <div class="modal-subtitle">Away for ${mins} minute${mins !== 1 ? 's' : ''}</div>
              </div>
            </div>
            ${gainSummary ? `<div class="modal-section">
              <div class="modal-section-title">Resources Collected While Away</div>
              <div class="offline-rewards">${gainSummary}</div>
            </div>` : ''}
            ${eventSummary}
            <div class="modal-actions">
              <button class="btn btn-primary" id="btn-offline-close">Collect & Continue</button>
            </div>
          </div>`;
        overlay.classList.remove('hidden');
        document.getElementById('btn-offline-close')?.addEventListener('click', () => overlay.classList.add('hidden'));
      };
    }
  }

  // Welcome mail on first play — delayed until after tutorial completes
  // (tutorial overlay blocks Mail tab access, so we send it after tutorial:complete)
  const sendWelcomeMail = () => {
    if (!savedState) {
      mailManager.send({
        type: 'system',
        subject: '⚔️ Welcome to Basie, Commander!',
        body: 'Your realm awaits! Build structures to generate resources, train soldiers in the Barracks, and recruit legendary Heroes. Study the Research tree for long-term advantages. Good luck, Commander!',
        icon: '👑',
        attachments: { gold: 500, wood: 200, stone: 100 },
      });
      // Starter hero cards — one Common hero card + one Rare hero card
      inventoryManager.addItem('scroll_common', 2);
      inventoryManager.addItem('scroll_rare', 1);
      inventoryManager.addItem('xp_bundle_small', 2);
    }
  };
  
  // If tutorial will run, send welcome mail after it completes. Otherwise send immediately.
  if (!savedState && !userManager.profile.hasCompletedTutorial) {
    eventBus.once('tutorial:complete', () => setTimeout(sendWelcomeMail, 500));
  } else if (!savedState) {
    setTimeout(sendWelcomeMail, 1000);
  }

  saveManager.startAutosave(getGameState);

  // Save immediately whenever the build queue changes so items aren't lost on refresh
  eventBus.on('building:queueUpdated', () => saveManager.save(getGameState()));
  // Trigger save immediately after any shop purchase
  eventBus.on('game:purchaseComplete', () => saveManager.save(getGameState()));
  
  // Wire automation purchases to BuildingManager
  eventBus.on('automation:purchased', (data) => {
    if (data.automation === 'cafeteriaRestock') {
      buildingManager.enableAutomation('cafeteriaRestock');
    }
  });

  // Wire one-time queue-slot purchases to the appropriate manager
  eventBus.on('slot:purchased', ({ slotType }) => {
    if (slotType === 'build')    buildingManager.grantShopBuildSlot();
    if (slotType === 'research') techManager.grantShopResearchSlot();
  });
  
  window.addEventListener('beforeunload', () => saveManager.save(getGameState()));

  new TimerService().init();
  new TooltipService().init();

  // On first launch (no save), show the new-game setup modal, then start.
  // On subsequent launches, start immediately.
  const startEngine = () => {
    // Daily login check — fires once per calendar day, after any setup modal is done
    const loginResult = userManager.checkDailyLogin();
    const canShowLoginModal = loginResult && userManager.profile.hasCompletedTutorial;

    if (canShowLoginModal) {
      // Show daily login modal first; offline modal (if any) waits until it is dismissed
      setTimeout(() => ui.showDailyLoginModal(loginResult.day, loginResult.streak, loginResult.rewards), 600);
      if (_showOfflineModal) {
        eventBus.once('dailyLogin:modalClosed', () => setTimeout(_showOfflineModal, 400));
      }
    } else {
      // No login modal — show offline modal immediately if there is one
      if (_showOfflineModal) setTimeout(_showOfflineModal, 800);
    }

    engine.start();
    setTimeout(() => eventBus.emit('story:start'), 500);
    // Tutorial — first-launch only
    if (!userManager.profile.hasCompletedTutorial) {
      setTimeout(() => eventBus.emit('tutorial:start'), 1200);
    }
  };

  if (!savedState) {
    _showNewGameSetupModal(startEngine);
  } else {
    startEngine();
  }
  window.game = {
    engine, resources: resourceManager, buildings: buildingManager,
    heroes: heroManager, inventory: inventoryManager, units: unitManager,
    combat: combatManager, tech: techManager, mail: mailManager,
    market: marketManager, quests: questManager, user: userManager,
    save:       () => saveManager.save(getGameState()),
    load:       () => applyGameState(saveManager.load()),
    clearSave:  () => saveManager.clear?.(),
    challenges: challengeManager,
    events:     eventManager,
    worldMap:   worldMapManager,
    march:      marchManager,
    eventBus,   // exposed for debugging/automation (watch/emit EventBus traffic)
  };

  console.log('[Basie] 🏰 Phase 4 launched!');
}

// =============================================
// ENTRY
// =============================================
window.addEventListener('DOMContentLoaded', initAuthScreen);
