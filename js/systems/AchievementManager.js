/**
 * AchievementManager.js
 * Tracks player milestones and unlocks achievements.
 * Listens to EventBus events and persists unlocked / claimed state.
 * Rewards are NOT auto-granted on unlock — the player must click Claim
 * in the Profile → Achievements tab, which calls claim(id).
 */
import { eventBus } from '../core/EventBus.js';
import { ACHIEVEMENTS_CONFIG } from '../entities/GAME_DATA.js';

const RARITY_COLORS = {
  common: 'var(--clr-text-secondary)',
  uncommon: 'var(--clr-success)',
  rare: 'var(--clr-primary)',
  legendary: 'var(--clr-gold)',
};

export class AchievementManager {
  /**
   * @param {import('./UserManager.js').UserManager} um
   * @param {import('./MailManager.js').MailManager} mail
   * @param {import('./ResourceManager.js').ResourceManager} rm
   * @param {import('./InventoryManager.js').InventoryManager} inv
   */
  constructor(um, mail, rm, inv) {
    this.name = 'AchievementManager';
    this._um   = um;
    this._mail = mail;
    this._rm   = rm;
    this._inv  = inv;
    /** @type {Map<string, { progress: number, unlocked: boolean, unlockedAt?: number, claimed: boolean }>} */
    this._state = new Map();
    this._ratchetTimer    = 0;
    this._lastMoneyChecked = 0;
    this._lastIronChecked  = 0;

    for (const id of Object.keys(ACHIEVEMENTS_CONFIG)) {
      this._state.set(id, { progress: 0, unlocked: false, claimed: false });
    }

    this._registerEvents();
  }

  _registerEvents() {
    eventBus.on('combat:victory',    () => this._progress('combat_win'));
    eventBus.on('unit:trained',      d  => this._progress('unit_trained', d?.count ?? 1));
    eventBus.on('building:completed',() => this._progress('build'));
    eventBus.on('quest:completed',   () => this._progress('quest_completed'));
    eventBus.on('tech:researched',   () => this._progress('research'));
    eventBus.on('hero:recruited',    () => this._progress('hero_recruited'));
    // New triggers
    eventBus.on('user:levelUp',      d  => this._progressSet('user_level', d?.level ?? 1));
    eventBus.on('dailyLogin:claimed', d  => this._progressSet('login_streak', d?.streak ?? 1));
    eventBus.on('market:traded',     () => this._progress('market_trade'));
  }

  _progress(trigger, amount = 1) {
    let changed = false;
    for (const [id, cfg] of Object.entries(ACHIEVEMENTS_CONFIG)) {
      if (cfg.trigger !== trigger) continue;
      const state = this._state.get(id);
      if (state.unlocked) continue;
      const before = state.progress ?? 0;
      state.progress = Math.min(before + amount, cfg.count);
      if (state.progress !== before) changed = true;
      if (state.progress >= cfg.count) {
        this._unlock(id, cfg);
      }
    }
    if (changed) eventBus.emit('achievements:updated', this.getAll());
  }

  /**
   * Set progress to an absolute value (used for streak/level/ratchet triggers
   * where the event data already carries the current total).
   */
  _progressSet(trigger, value) {
    let changed = false;
    for (const [id, cfg] of Object.entries(ACHIEVEMENTS_CONFIG)) {
      if (cfg.trigger !== trigger) continue;
      const state = this._state.get(id);
      if (state.unlocked) continue;
      const newProg = Math.min(value, cfg.count);
      if (newProg > (state.progress ?? 0)) {
        state.progress = newProg;
        changed = true;
        if (state.progress >= cfg.count) this._unlock(id, cfg);
      }
    }
    if (changed) eventBus.emit('achievements:updated', this.getAll());
  }

  _unlock(id, cfg) {
    const state = this._state.get(id);
    if (state.unlocked) return;
    state.unlocked   = true;
    state.unlockedAt = Date.now();
    state.claimed    = false; // reward must be manually claimed via claim(id)

    eventBus.emit('achievement:unlocked', { id, ...cfg });
  }

  /**
   * Returns all achievements in a normalised shape for the UI.
   * Milestone flag = top 10% by count threshold (hardest to reach).
   * @returns {Array<{ id, name, description, icon, rarity, progress, target, completed, claimed, reward, milestone }>}
   */
  getAll() {
    const cfgs   = Object.values(ACHIEVEMENTS_CONFIG);
    const sorted = [...cfgs].sort((a, b) => b.count - a.count);
    const msCut  = Math.ceil(sorted.length * 0.1);
    const msIds  = new Set(sorted.slice(0, msCut).map(c => c.id));

    return cfgs.map(cfg => {
      const state = this._state.get(cfg.id) ?? {};
      return {
        id:          cfg.id,
        name:        cfg.name,
        description: cfg.description,
        icon:        cfg.icon,
        rarity:      cfg.rarity,
        progress:    state.progress   ?? 0,
        target:      cfg.count,
        completed:   state.unlocked   ?? false,
        claimed:     state.claimed    ?? false,
        reward:      cfg.reward       ?? {},
        milestone:   msIds.has(cfg.id),
      };
    });
  }

  /**
   * Claim the reward for a completed achievement.
   * Applies XP immediately and passes resource/item rewards through
   * InventoryManager.grantRewards(). Emits achievement:claimed.
   * @param {string} id
   * @returns {{ success: boolean, reason?: string }}
   */
  claim(id) {
    const cfg   = ACHIEVEMENTS_CONFIG[id];
    const state = this._state.get(id);
    if (!cfg || !state)           return { success: false, reason: 'Unknown achievement.' };
    if (!state.unlocked)          return { success: false, reason: 'Achievement not yet completed.' };
    if (state.claimed)            return { success: false, reason: 'Reward already claimed.' };

    // XP is applied directly — not routed through grantRewards
    if (cfg.reward?.xp) this._um.addXP(cfg.reward.xp);

    // Build a rewardArray compatible with InventoryManager.grantRewards()
    const rewardArray = [];
    for (const [key, val] of Object.entries(cfg.reward ?? {})) {
      if (key === 'xp' || key === 'items') continue;
      if (typeof val === 'number' && val > 0) {
        rewardArray.push({ type: 'resource', itemId: key, quantity: val });
      }
    }
    if (cfg.reward?.items?.length) {
      for (const entry of cfg.reward.items) {
        const itemId = typeof entry === 'string' ? entry : entry.id;
        const qty    = typeof entry === 'string' ? 1     : (entry.qty ?? 1);
        rewardArray.push({ type: 'item', itemId, quantity: qty });
      }
    }

    if (rewardArray.length > 0) this._inv?.grantRewards(rewardArray);

    state.claimed = true;
    eventBus.emit('achievement:claimed', { id, rewardArray });
    eventBus.emit('achievements:updated', this.getAll());
    return { success: true };
  }

  /** @deprecated Use getAll() instead. Kept for backward-compat subscribers. */
  getAchievementsWithState() {
    return Object.values(ACHIEVEMENTS_CONFIG).map(cfg => ({
      ...cfg,
      ...this._state.get(cfg.id),
    }));
  }

  getUnlockedCount() {
    return [...this._state.values()].filter(s => s.unlocked).length;
  }

  update(dt) {
    // Ratchet-check cumulative resource totals once per minute
    this._ratchetTimer += dt;
    if (this._ratchetTimer < 60) return;
    this._ratchetTimer = 0;
    const stats = this._um.getProfile().stats;
    if (!stats) return;
    if (stats.moneyEarned > this._lastMoneyChecked) {
      this._progressSet('total_money', stats.moneyEarned);
      this._lastMoneyChecked = stats.moneyEarned;
    }
    if (stats.ironEarned > this._lastIronChecked) {
      this._progressSet('total_iron', stats.ironEarned);
      this._lastIronChecked = stats.ironEarned;
    }
  }

  serialize() { return Object.fromEntries(this._state); }

  deserialize(data) {
    if (!data) return;
    for (const [id, s] of Object.entries(data)) {
      if (!this._state.has(id)) continue;
      // Backward-compat: saves written before the deferred-claim system was
      // introduced have no `claimed` field for already-unlocked achievements.
      // Default those to claimed=true so players cannot double-collect.
      if (s.unlocked && s.claimed === undefined) s.claimed = true;
      this._state.set(id, s);
    }
  }
}
