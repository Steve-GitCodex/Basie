/**
 * TutorialManager.js
 * Manages the new-player tutorial: a linear 5-step interactive overlay
 * that triggers on first launch and walks the player through core gameplay.
 *
 * Steps follow a prescriptive resource-safe path:
 *   Lumber Mill → Barracks → Train a unit → First battle → First quest
 *
 * Steps with `filterBuildingId` only advance when THAT specific building
 * completes — so the player can't skip the path by building something else.
 *
 * When all steps are done (or the player skips), calls
 * userManager.completeTutorial() and emits 'tutorial:complete'.
 */
import { eventBus } from '../core/EventBus.js';

export const TUTORIAL_STEPS = [
  {
    id:               "lumbermill",
    title:            "Build a Lumber Mill",
    instruction:      "Tap the Lumber Mill tile on your base, then tap Build in the panel that opens. It only costs stone and starts generating wood.",
    highlight:        "nav-base",
    navView:          "base",
    buildingFocus:    "lumbermill",
    highlightSelector: ".base-tile[data-building-id=\"lumbermill\"]",
    waitFor:          "building:completed",
    filterBuildingId: "lumbermill",
  },
  {
    id:               "mine",
    title:            "Build an Iron Mine",
    instruction:      "Tap the Iron Mine tile and tap Build. Wood from your Lumber Mill covers the cost. Iron is needed for the Quarry and military buildings.",
    highlight:        "nav-base",
    navView:          "base",
    buildingFocus:    "mine",
    highlightSelector: ".base-tile[data-building-id=\"mine\"]",
    waitFor:          "building:completed",
    filterBuildingId: "mine",
  },
  {
    id:               "quarry",
    title:            "Build a Stone Quarry",
    instruction:      "Tap the Stone Quarry tile and tap Build to keep stone flowing. It costs wood and a little iron, both now in production.",
    highlight:        "nav-base",
    navView:          "base",
    buildingFocus:    "quarry",
    highlightSelector: ".base-tile[data-building-id=\"quarry\"]",
    waitFor:          "building:completed",
    filterBuildingId: "quarry",
  },
  {
    id:               "barracks",
    title:            "Build a Barracks",
    instruction:      "Tap the Barracks tile and tap Build. Barracks house your squads, the formations your units fight in.",
    highlight:        "nav-base",
    navView:          "base",
    buildingFocus:    "barracks",
    highlightSelector: ".base-tile[data-building-id=\"barracks\"]",
    waitFor:          "building:completed",
    filterBuildingId: "barracks",
  },
  {
    id:               "townhall",
    title:            "Upgrade HQ to Level 2",
    instruction:      "Tap the HQ tile and tap Upgrade. Level 2 unlocks the Infantry Hall and increases your resource caps.",
    highlight:        "nav-base",
    navView:          "base",
    buildingFocus:    "townhall",
    highlightSelector: ".base-tile[data-building-id=\"townhall\"]",
    waitFor:          "building:completed",
    filterBuildingId: "townhall",
  },
  {
    id:               "infantryhall",
    title:            "Build an Infantry Hall",
    instruction:      "Tap the Infantry Hall tile and tap Build. This is where infantry units are trained. Squads without troops cannot fight!",
    highlight:        "nav-base",
    navView:          "base",
    buildingFocus:    "infantryhall",
    highlightSelector: ".base-tile[data-building-id=\"infantryhall\"]",
    waitFor:          "building:completed",
    filterBuildingId: "infantryhall",
  },
  {
    id:               'train',
    title:            '🪖 Train Your First Unit',
    instruction:      'Tap your Infantry Hall on the map, then choose 🗡️ Train to recruit at least one soldier.',
    highlight:        'nav-base',
    navView:          'base',
    buildingFocus:    'infantryhall',
    highlightSelector: '.base-tile[data-building-id="infantryhall"]',
    waitFor:          'unit:trained',
  },
  {
    id:               'combat',
    title:            '🔥 Enter Your First Battle',
    instruction:      'Head to Combat, pick an available stage, assemble your squad, and launch your first attack.',
    highlight:        'nav-combat',
    navView:          'combat',
    highlightSelector: '.campaign-node.available',
    waitFor:          'combat:started',
  },
  {
    id:               'quest',
    title:            '📜 Complete a Quest',
    instruction:      'Visit the Quests tab. Some quests are already in progress from your building work. Finish one to earn rewards.',
    highlight:        'nav-quests',
    navView:          'quests',
    highlightSelector: '.quest-card:not(.completed)',
    waitFor:          'quest:completed',
  },
];

export class TutorialManager {
  /**
   * @param {import('./UserManager.js').UserManager} userManager
   */
  constructor(userManager) {
    this.name  = 'TutorialManager';
    this._user = userManager;

    /** @type {number} current step index into TUTORIAL_STEPS */
    this._stepIndex   = 0;
    this._active      = false;

    /** @type {Function|null} unsubscribe fn for the current waitFor/prereq listener */
    this._stepCleanup = null;

    eventBus.on('tutorial:start', () => this._start());
  }

  // ─────────────────────────────────────────────
  // Public API (called by UIManager skip button)
  // ─────────────────────────────────────────────

  /** Skip tutorial immediately, mark as complete. */
  skip() {
    if (!this._active) return;
    this._cleanup();
    this._finish();
  }

  // ─────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────

  _start() {
    if (this._active) return;
    this._active    = true;
    // Resume from the last saved step so a page refresh does not restart from step 0
    this._stepIndex = this._user.profile.tutorialStep || 0;
    this._showStep();
  }

  _showStep() {
    this._cleanup();

    const step = TUTORIAL_STEPS[this._stepIndex];
    if (!step) {
      this._finish();
      return;
    }

    eventBus.emit('tutorial:stepAdvanced', {
      step,
      stepIndex:  this._stepIndex,
      totalSteps: TUTORIAL_STEPS.length,
    });
    eventBus.emit('ui:navigateTo', step.navView);

    const handler = (d) => {
      // If this step targets a specific building, only advance for that building
      if (step.filterBuildingId && d?.id !== step.filterBuildingId) return;
      // Persist immediately — before the 500ms delay — so the save triggered by
      // building:queueUpdated captures the updated step, not the old one.
      this._user.setTutorialStep(this._stepIndex + 1);
      setTimeout(() => {
        this._stepIndex++;
        this._showStep();
      }, 500);
    };
    this._stepCleanup = eventBus.on(step.waitFor, handler);
  }

  _cleanup() {
    if (this._stepCleanup) {
      this._stepCleanup();
      this._stepCleanup = null;
    }
  }

  _finish() {
    this._active = false;
    this._user.completeTutorial();
    // completeTutorial() also emits 'tutorial:complete' — UIManager hides the overlay there
  }
}
