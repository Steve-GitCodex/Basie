/**
 * QuestManager.js
 * Manages active, completed, and failed quests.
 * Listens to EventBus for progress triggers and hands out rewards on completion.
 */
import { eventBus } from '../core/EventBus.js';
import { QUESTS_CONFIG } from '../entities/GAME_DATA.js';

export class QuestManager {
  /**
   * @param {import('./ResourceManager.js').ResourceManager} rm
   * @param {import('./UserManager.js').UserManager} um
   */
  constructor(rm, um) {
    this.name = 'QuestManager';
    this._rm = rm;
    this._um = um;
    /** @type {Map<string, { progress: number, completed: boolean }>} */
    this._state = new Map();

    // Init all quests as not started
    for (const id of Object.keys(QUESTS_CONFIG)) {
      this._state.set(id, { progress: 0, completed: false });
    }

    this._registerEvents();
  }

  _registerEvents() {
    eventBus.on('building:completed',  () => this._progress('build'));
    eventBus.on('unit:trained',        d  => this._progress('train', d?.count ?? 1));
    eventBus.on('combat:victory',      () => this._progress('combat_win'));
    eventBus.on('tech:researched',     () => this._progress('research'));
    eventBus.on('user:levelUp',        d  => this._progress('reach_level', d?.level ?? 0));
  }

  /**
   * Advance quest progress for matching objectives.
   * Quests with a prerequisiteQuest are skipped until that quest is completed.
   * @param {string} type
   * @param {number} [amount=1]
   */
  _progress(type, amount = 1) {
    let changed = false;
    for (const [id, cfg] of Object.entries(QUESTS_CONFIG)) {
      const state = this._state.get(id);
      if (!state || state.completed) continue;

      // Gate: prerequisite quest must be completed first
      if (cfg.prerequisiteQuest) {
        const prereqState = this._state.get(cfg.prerequisiteQuest);
        if (!prereqState?.completed) continue;
      }

      for (const obj of cfg.objectives) {
        if (obj.type === type) {
          const before = state.progress ?? 0;
          if (type === 'reach_level') {
            state.progress = Math.max(before, amount);
          } else {
            state.progress = Math.min(before + amount, obj.count);
          }
          if (state.progress !== before) changed = true;
          // reach_level uses obj.target; all other types use obj.count.
          const threshold = type === 'reach_level' ? obj.target : obj.count;
          if (state.progress >= threshold) {
            this._complete(id, cfg);
          }
        }
      }
    }
    if (changed) eventBus.emit('quests:updated', this.getQuestsWithState());
  }

  _complete(id, cfg) {
    const state = this._state.get(id);
    if (state.completed) return;
    state.completed = true;

    // Resources delivered via mail attachment — MailManager hears quest:completed below.
    const xp = cfg.rewards?.xp ?? 0;
    this._um.addXP(xp);

    eventBus.emit('quest:completed', {
      id,
      name: cfg.name,
      description: cfg.description,
      rewards: cfg.rewards,
    });
  }

  getQuestsWithState() {
    return Object.values(QUESTS_CONFIG).map(cfg => ({
      ...cfg,
      ...this._state.get(cfg.id),
    }));
  }

  update(dt) { /* No tick needed */ }

  serialize() { return Object.fromEntries(this._state); }

  deserialize(data) {
    if (!data) return;
    for (const [id, s] of Object.entries(data)) {
      if (this._state.has(id)) this._state.set(id, s);
    }
    // P12: notify UI panels to refresh after a save load
    eventBus.emit('quests:updated', { source: 'load' });
  }
}
