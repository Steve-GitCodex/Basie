/**
 * EventManager.js
 * Manages limited-time in-game events: lifecycle, objective tracking,
 * resource multiplier application, and reward delivery.
 *
 * Lifecycle per event:
 *   null timestamps → always inactive.
 *   startTs <= now < endTs → active; effects applied via ResourceManager.addModifier().
 *   now >= endTs → expired; effects removed via ResourceManager.removeModifier().
 *
 * Events emitted:
 *   events:started  — { event }  when an event becomes active
 *   events:expired  — { event }  when an active event's endTs passes
 *   events:updated  — public state snapshot (for UI and nav badge)
 *   events:rewardClaimed — { eventId } when the player claims an event reward
 */
import { eventBus }      from '../core/EventBus.js';
import { EVENTS_CONFIG } from '../entities/GAME_DATA.js';

const CHECK_INTERVAL_MS = 60_000; // check event timers once per minute

export class EventManager {
  /**
   * @param {import('./ResourceManager.js').ResourceManager} resourceManager
   * @param {import('./MailManager.js').MailManager}         mailManager
   * @param {import('./InventoryManager.js').InventoryManager} inventoryManager
   * @param {import('./UserManager.js').UserManager} [userManager]
   */
  constructor(resourceManager, mailManager, inventoryManager, userManager) {
    this.name   = 'EventManager';
    this._rm    = resourceManager;
    this._mail  = mailManager;
    this._inv   = inventoryManager;
    this._um    = userManager ?? null;

    /** Id of the currently active event, or null. */
    this._activeEventId = null;
    /** Set of event ids whose reward has already been claimed this activation. */
    this._claimedEventIds = new Set();
    /** Objective progress map: eventId → { objectiveId → progress } */
    this._objectiveProgress = {};

    this._tickAccumMs = CHECK_INTERVAL_MS; // check immediately on first tick

    this._registerEvents();
  }

  // ─── LIFECYCLE ─────────────────────────────────────────────────

  _registerEvents() {
    // Track combat wins for "win battles" objectives
    eventBus.on('combat:victory', () => this._progressObjective('win_battles', 1));
  }

  /** Called every engine tick (dt ≈ 0.05 s). Throttled check. */
  update(dt) {
    this._tickAccumMs += dt * 1000;
    if (this._tickAccumMs >= CHECK_INTERVAL_MS) {
      this._tickAccumMs = 0;
      this._checkEvents();
    }
  }

  /** Compare all event timestamps to now; activate/expire as needed. */
  _checkEvents() {
    const now = Date.now();

    // Check if current active event has expired
    if (this._activeEventId !== null) {
      const activeCfg = EVENTS_CONFIG.find(e => e.id === this._activeEventId);
      if (!activeCfg || activeCfg.endTs === null || now >= activeCfg.endTs) {
        this._deactivateEvent(activeCfg);
      }
      return; // Only one event active at a time
    }

    // Check for a newly starting event
    for (const cfg of EVENTS_CONFIG) {
      if (cfg.startTs !== null && now >= cfg.startTs && cfg.endTs !== null && now < cfg.endTs) {
        this._activateEvent(cfg);
        break; // Only activate one event at a time
      }
    }
  }

  _activateEvent(cfg) {
    this._activeEventId = cfg.id;
    // Initialise objective progress if not already tracked
    if (!this._objectiveProgress[cfg.id]) {
      this._objectiveProgress[cfg.id] = {};
      for (const obj of (cfg.objectives ?? [])) {
        this._objectiveProgress[cfg.id][obj.id] = 0;
      }
    }
    // Apply production multipliers
    for (const [resourceType, multiplier] of Object.entries(cfg.effects ?? {})) {
      this._rm.addModifier(resourceType, multiplier, cfg.id);
    }
    eventBus.emit('events:started', { event: this._getPublicEvent(cfg) });
    eventBus.emit('events:updated', this.getPublicState());
  }

  _deactivateEvent(cfg) {
    if (!cfg) { this._activeEventId = null; return; }
    // Remove production multipliers — tag must match the one used in _activateEvent (cfg.id)
    for (const resourceType of Object.keys(cfg.effects ?? {})) {
      this._rm.removeModifier(cfg.id, resourceType);
    }
    this._activeEventId = null;
    eventBus.emit('events:expired', { event: this._getPublicEvent(cfg) });
    eventBus.emit('events:updated', this.getPublicState());
  }

  // ─── OBJECTIVE PROGRESS ────────────────────────────────────────

  _progressObjective(objectiveId, amount) {
    if (this._activeEventId === null) return;
    const progress = this._objectiveProgress[this._activeEventId];
    if (!progress || !(objectiveId in progress)) return;
    progress[objectiveId] = Math.min(
      progress[objectiveId] + amount,
      this._getObjectiveTarget(this._activeEventId, objectiveId)
    );
    eventBus.emit('events:updated', this.getPublicState());
  }

  _getObjectiveTarget(eventId, objectiveId) {
    const cfg = EVENTS_CONFIG.find(e => e.id === eventId);
    const obj = cfg?.objectives?.find(o => o.id === objectiveId);
    return obj?.target ?? Infinity;
  }

  // ─── REWARD CLAIM ──────────────────────────────────────────────

  /**
   * Claim the reward for the active event, if objectives are met and unclaimed.
   * @param {string} eventId
   */
  claimReward(eventId) {
    if (this._activeEventId !== eventId) return;
    if (this._claimedEventIds.has(eventId)) return;

    const cfg = EVENTS_CONFIG.find(e => e.id === eventId);
    if (!cfg) return;

    // Verify all objectives are completed
    const progress = this._objectiveProgress[eventId] ?? {};
    const allDone = (cfg.objectives ?? []).every(obj =>
      (progress[obj.id] ?? 0) >= obj.target
    );
    if (!allDone) return;

    this._claimedEventIds.add(eventId);
    if (cfg.reward) {
      // XP is granted directly to the player — not via inventory resource bundles
      if (cfg.reward.xp) this._um?.addXP(cfg.reward.xp);
      if (this._inv) {
        const rewardArray = Object.entries(cfg.reward)
          .filter(([k, v]) => k !== 'xp' && v > 0)
          .map(([k, v]) => ({ type: 'resource', itemId: k, quantity: v }));
        if (rewardArray.length) this._inv.grantRewards(rewardArray);
      }
    }
    eventBus.emit('events:rewardClaimed', { eventId });
    eventBus.emit('events:updated', this.getPublicState());
  }

  // ─── PUBLIC API ────────────────────────────────────────────────

  getPublicState() {
    const now = Date.now();
    let activeEvent = null;

    if (this._activeEventId !== null) {
      const cfg = EVENTS_CONFIG.find(e => e.id === this._activeEventId);
      if (cfg) activeEvent = this._getPublicEvent(cfg);
    }

    return {
      activeEvent,
      events: EVENTS_CONFIG.map(cfg => this._getPublicEvent(cfg)),
    };
  }

  _getPublicEvent(cfg) {
    const now      = Date.now();
    const isActive = cfg.id === this._activeEventId;
    const progress = this._objectiveProgress[cfg.id] ?? {};

    const objectives = (cfg.objectives ?? []).map(obj => ({
      ...obj,
      progress: progress[obj.id] ?? 0,
      completed: (progress[obj.id] ?? 0) >= obj.target,
    }));

    const allObjectivesDone = objectives.length === 0 || objectives.every(o => o.completed);

    return {
      id:             cfg.id,
      name:           cfg.name,
      icon:           cfg.icon,
      description:    cfg.description,
      startTs:        cfg.startTs,
      endTs:          cfg.endTs,
      effects:        cfg.effects ?? {},
      objectives,
      reward:         cfg.reward ?? {},
      isActive,
      timeRemainingMs: isActive && cfg.endTs ? Math.max(0, cfg.endTs - now) : 0,
      claimed:        this._claimedEventIds.has(cfg.id),
      canClaim:       isActive && allObjectivesDone && !this._claimedEventIds.has(cfg.id),
    };
  }

  // ─── SERIALIZATION ────────────────────────────────────────────

  serialize() {
    return {
      activeEventId:     this._activeEventId,
      claimedEventIds:   [...this._claimedEventIds],
      objectiveProgress: this._objectiveProgress,
    };
  }

  deserialize(data) {
    if (!data) return;
    this._activeEventId     = data.activeEventId   ?? null;
    this._claimedEventIds   = new Set(data.claimedEventIds ?? []);
    this._objectiveProgress = data.objectiveProgress ?? {};

    // Re-apply multipliers for active event immediately on load
    if (this._activeEventId !== null) {
      const cfg = EVENTS_CONFIG.find(e => e.id === this._activeEventId);
      if (cfg && cfg.endTs !== null && Date.now() < cfg.endTs) {
        for (const [resourceType, multiplier] of Object.entries(cfg.effects ?? {})) {
          this._rm.addModifier(resourceType, multiplier, cfg.id);
        }
      } else {
        // Event expired while offline — clean up
        this._activeEventId = null;
      }
    }

    // Force immediate check
    this._tickAccumMs = CHECK_INTERVAL_MS;
    eventBus.emit('events:updated', this.getPublicState());
  }
}
