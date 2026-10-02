import { eventBus } from '../core/EventBus.js';
import {
  MONSTERS_CONFIG, CAMPAIGNS_CONFIG, ENCOUNTER_MODIFIERS,
  DIFFICULTY_MODIFIERS, SURVIVAL_MONSTER,
} from '../entities/GAME_DATA.js';
import { BUILDINGS_CONFIG } from '../entities/GAME_DATA.js';
import { COMBAT_RULES } from '../entities/data/combatRules.js';
import { resolveBattle } from './combat/resolveBattle.js';
import {
  battleSides, survivalMonster, squadLosses, wavesCleared, summarizeEstimate,
} from './combat/combatInputs.js';

const MAX_BATTLE_LOG = 20;
const REDUCED_REWARD_SHARE = 0.1;

const freshSeed = () => Date.now() % 2147483647;
const isEmpty = (map) => Object.keys(map).length === 0;

export class CombatManager {
  constructor(unitManager, userManager, resourceManager, heroManager, buildingManager) {
    this.name = 'CombatManager';
    this._um = unitManager;
    this._user = userManager;
    this._rm = resourceManager;
    this._hm = heroManager;
    this._bm = buildingManager ?? null;
    this._battleLog = [];
    /** @type {Record<string, number>} monsterId → total victories */
    this._victoryCounts = {};
    this._techBonuses = {};
    /** @type {Map<string, object|null>} monsterId → rolled encounter modifier */
    this._pendingModifiers = new Map();
    eventBus.on('resources:bonusChanged', b => { this._techBonuses = b || {}; });
    this._difficulty = 'normal';
    eventBus.on('settings:changed', s => {
      if (DIFFICULTY_MODIFIERS[s.difficulty]) this._difficulty = s.difficulty;
    });
    this._gameMode = 'campaign';
    eventBus.on('game:modeChanged', ({ mode }) => { this._gameMode = mode; });
    this._survivalWave = 0;
    this._survivalMult = 1.0;
  }

  update(dt) {}

  attack(monsterId, squadId, { seed = freshSeed() } = {}) {
    const isSurvival = this._isSurvival(monsterId);
    const monster = this._monsterFor(monsterId);
    if (!monster) return { success: false, reason: 'Unknown target.' };

    const squadData = this._um.getSquad(squadId);
    if (!squadData?.units.length) return { success: false, reason: 'You have no units to send.' };
    if (this._um.isSquadDeployed?.(squadId)) return { success: false, reason: 'That squad is away on a march.' };

    const modifier = isSurvival ? null : (this._pendingModifiers.get(monsterId) ?? null);
    if (!isSurvival) this._pendingModifiers.delete(monsterId);

    eventBus.emit('combat:started', { monsterId, monster });

    const report = this._fight(squadId, monster, { modifier, seed });
    const { dead, wounded, victory } = report;

    const victoryCount = this._victoryCounts[monsterId] ?? 0;
    const maxRewarded  = monster.maxRewardedWins ?? 999;
    const isFullReward = victory && (isSurvival || victoryCount < maxRewarded);
    const isReduced    = victory && !isFullReward;
    const rewards = victory ? this._scaleRewards(monster.rewards, isFullReward) : null;

    this._battleLog.unshift({
      timestamp: Date.now(),
      monster: monster.name,
      icon: monster.icon,
      monsterId,
      squadName: squadData.name ?? 'Unknown Squad',
      result: victory ? 'Victory' : 'Defeat',
      rewards,
      reducedReward: isReduced,
      wavesSurvived: wavesCleared(report),
      totalWaves: monster.waves.length,
      modifier: modifier ? { id: modifier.id, name: modifier.name, icon: modifier.icon } : null,
      rulesVersion: report.rulesVersion,
      seed,
      dead,
      wounded,
    });
    if (this._battleLog.length > MAX_BATTLE_LOG) this._battleLog.pop();

    this._applyCasualties(squadId, report);

    if (victory) {
      if (!isSurvival) this._victoryCounts[monsterId] = victoryCount + 1;
      this._user.addXP(rewards.xp ?? 0);
      this._hm.awardBattleXP(Math.floor((monster.rewards.xp ?? 100) * 0.5), squadId);
      eventBus.emit('combat:victory', { monsterId, rewards, dead, wounded, reducedReward: isReduced });
      if (isSurvival) this._advanceSurvival();
    } else {
      eventBus.emit('combat:defeat', { monsterId, dead, wounded });
      if (isSurvival) this._endSurvival();
    }

    eventBus.emit('combat:logUpdated', this._battleLog);
    return { success: true, report, rewards, reducedReward: isReduced, modifier };
  }

  /** Loot returns to MarchManager; emitting combat:victory here would double-grant via MailManager. */
  resolveMarchBattle(squadId, monsterId, milMult = 1, { structure = false, seed = freshSeed() } = {}) {
    const monster = MONSTERS_CONFIG[monsterId];
    if (!monster || !this._um.getSquad(squadId)?.units.length) {
      return { victory: false, dead: {}, wounded: {}, loot: {}, report: null };
    }

    const report = this._fight(squadId, monster, { milMult, structure, seed });
    const { victory, dead, wounded } = report;
    this._applyCasualties(squadId, report);

    const loot = {};
    if (victory) {
      for (const [k, v] of Object.entries(monster.rewards)) {
        if (k === 'xp') { this._user.addXP(v); continue; }
        loot[k] = v;
      }
      this._hm.awardBattleXP(Math.floor((monster.rewards.xp ?? 100) * 0.5), squadId);
    }

    eventBus.emit('combat:marchResolved', {
      monsterId, victory, loot, dead, wounded, wavesSurvived: wavesCleared(report),
    });
    return { victory, dead, wounded, loot, report };
  }

  estimateBattle(squadId, monsterId) {
    const monster = this._monsterFor(monsterId);
    if (!monster || !this._um.getSquad(squadId)?.units.length) return { winChance: 0, avgDead: 0, avgWounded: 0 };
    const modifier = this._isSurvival(monsterId) ? null : this.getPendingModifier(monsterId);
    const { attacker, defender } = this._sidesFor(squadId, monster, { modifier });
    const reports = [];
    for (let seed = 1; seed <= COMBAT_RULES.ESTIMATE_RUNS; seed++) {
      reports.push(resolveBattle(attacker, defender, { seed, rulesVersion: COMBAT_RULES.RULES_VERSION }));
    }
    return summarizeEstimate(reports);
  }

  /**
   * Roll an encounter modifier for a stage.  Called when the player clicks a
   * stage node so they can see the modifier before committing.  Cleared on
   * attack().
   * @param {string} monsterId
   * @returns {object|null}
   */
  rollModifierForStage(monsterId) {
    const roll = Math.random();
    let cumulative = 0;
    for (const mod of ENCOUNTER_MODIFIERS) {
      cumulative += mod.chance;
      if (roll < cumulative) {
        this._pendingModifiers.set(monsterId, mod);
        return mod;
      }
    }
    // ~25% no modifier
    this._pendingModifiers.set(monsterId, null);
    return null;
  }

  getPendingModifier(monsterId) {
    return this._pendingModifiers.get(monsterId) ?? null;
  }

  /**
   * Get current victory count and remaining full-reward wins for a monster.
   */
  getMonsterProgress(monsterId) {
    const monster = MONSTERS_CONFIG[monsterId];
    const count   = this._victoryCounts[monsterId] ?? 0;
    const max     = monster?.maxRewardedWins ?? 999;
    return {
      victories: count,
      rewardedWins: Math.min(count, max),
      rewardsRemaining: Math.max(0, max - count),
      maxRewardedWins: max,
    };
  }

  /**
   * Returns each campaign stage annotated with derived state flags.
   * Mirrors the pattern of BuildingManager.getAllBuildingsWithStatus().
   * @returns {Array<{ isLocked: boolean, isAvailable: boolean, isCompleted: boolean }>}
   */
  getCampaignStagesWithState() {
    const getLvl = this._bm
      ? id => this._bm.getLevelOf(id)
      : () => 0;

    return CAMPAIGNS_CONFIG.map((stage, idx) => {
      const reqs = stage.requires;
      const reqMet = !reqs || Object.entries(reqs).every(([bId, minLvl]) => getLvl(bId) >= minLvl);
      // Use _victoryCounts (persisted, authoritative) rather than the battle log.
      const isCompleted    = (this._victoryCounts[stage.monsterId] ?? 0) > 0;
      const prevCompleted  = idx === 0 || (this._victoryCounts[CAMPAIGNS_CONFIG[idx - 1].monsterId] ?? 0) > 0;
      const isLocked       = !reqMet || !prevCompleted;

      // Build a human-readable lock reason for tooltips / notifications
      let lockReason = null;
      if (isLocked) {
        if (!prevCompleted) {
          lockReason = `Complete Stage ${idx} first`;
        } else if (reqs) {
          const parts = Object.entries(reqs).map(([bId, minLvl]) => {
            const name = BUILDINGS_CONFIG[bId]?.name ?? bId;
            return `${name} Lv.${minLvl}`;
          });
          lockReason = `Requires: ${parts.join(', ')}`;
        }
      }

      return {
        ...stage,
        isCompleted,
        isLocked,
        isAvailable: reqMet && prevCompleted && !isCompleted,
        lockReason,
      };
    });
  }

  getBattleLog() { return this._battleLog; }

  /** @returns {'campaign'|'survival'|'sandbox'} */
  getGameMode() { return this._gameMode; }

  /** @returns {{ wave: number, mult: number }} */
  getSurvivalState() {
    return { wave: this._survivalWave, mult: this._survivalMult };
  }

  serialize() {
    return {
      battleLog:    this._battleLog,
      victoryCounts: this._victoryCounts,
      survivalWave: this._survivalWave,
      survivalMult: this._survivalMult,
    };
  }

  deserialize(data) {
    if (!data) return;
    this._battleLog     = data.battleLog     ?? [];
    this._victoryCounts = data.victoryCounts ?? {};
    this._survivalWave  = data.survivalWave  ?? 0;
    this._survivalMult  = data.survivalMult  ?? 1.0;
  }

  _isSurvival(monsterId) {
    return this._gameMode === 'survival' && monsterId === 'survival_wave';
  }

  _monsterFor(monsterId) {
    return this._isSurvival(monsterId) ? this._buildSurvivalMonster() : MONSTERS_CONFIG[monsterId];
  }

  _buildSurvivalMonster() {
    return survivalMonster(SURVIVAL_MONSTER, this._survivalWave, this._survivalMult);
  }

  _sidesFor(squadId, monster, { milMult = 1, modifier = null } = {}) {
    return battleSides({
      units: this._um.getSquad(squadId).units,
      slotRows: this._um.getSquadRows(squadId),
      heroBonus: this._hm.getCombatBonuses(squadId),
      tech: this._techBonuses,
      hq: this._bm?.getHQBenefits?.() ?? {},
      milMult,
      modifier,
      monster,
      difficulty: DIFFICULTY_MODIFIERS[this._difficulty],
    });
  }

  _fight(squadId, monster, { milMult = 1, modifier = null, structure = false, seed }) {
    const { attacker, defender } = this._sidesFor(squadId, monster, { milMult, modifier });
    return resolveBattle(attacker, defender, { seed, rulesVersion: COMBAT_RULES.RULES_VERSION, structure });
  }

  _applyCasualties(squadId, { dead, wounded }) {
    const losses = squadLosses({ dead, wounded });
    if (!isEmpty(losses)) this._um.removeUnitsFromSquad(squadId, losses);
    if (!isEmpty(wounded)) eventBus.emit('combat:unitsWounded', { squadId, wounded });
  }

  _scaleRewards(rewards, isFullReward) {
    return Object.fromEntries(Object.entries(rewards).map(([k, v]) =>
      [k, isFullReward ? v : Math.max(1, Math.floor(v * REDUCED_REWARD_SHARE))]));
  }

  _advanceSurvival() {
    this._survivalWave++;
    this._survivalMult = parseFloat((this._survivalMult * 1.05).toFixed(4));
    eventBus.emit('survival:waveCompleted', { wave: this._survivalWave, mult: this._survivalMult });
  }

  _endSurvival() {
    const finalScore = this._survivalWave;
    this._user.setWaveHighScore?.(finalScore);
    eventBus.emit('survival:ended', { score: finalScore });
    this._survivalWave = 0;
    this._survivalMult = 1.0;
  }
}
