/**
 * CombatManager.js — Phase 4
 * Adds repeatable monster fights with diminishing returns:
 *  - Tracks victory count per monster
 *  - Full rewards for first N wins (monster.maxRewardedWins)
 *  - 10% rewards thereafter (still beatable, just no more full loot)
 */
import { eventBus } from '../core/EventBus.js';
import {
  MONSTERS_CONFIG, UNITS_CONFIG, CAMPAIGNS_CONFIG, ENCOUNTER_MODIFIERS,
  DIFFICULTY_MODIFIERS, SURVIVAL_MONSTER,
} from '../entities/GAME_DATA.js';
import { BUILDINGS_CONFIG } from '../entities/GAME_DATA.js';
import { sumTriggeredEffects } from './hero/heroSkills.js';

const MAX_BATTLE_LOG = 20;

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
    // Difficulty — kept in sync with SettingsManager via event
    this._difficulty = 'normal';
    eventBus.on('settings:changed', s => {
      if (s.difficulty) this._difficulty = s.difficulty;
    });
    // Game mode — set by GameEngine.setGameMode()
    this._gameMode = 'campaign';
    eventBus.on('game:modeChanged', ({ mode }) => { this._gameMode = mode; });
    // Survival mode state
    this._survivalWave = 0;
    this._survivalMult = 1.0;
  }

  update(dt) {}

  attack(monsterId, squadId) {
    // Survival mode uses a dynamic monster built from SURVIVAL_MONSTER base
    const isSurvival = (this._gameMode === 'survival' && monsterId === 'survival_wave');
    const monster = isSurvival
      ? this._buildSurvivalMonster()
      : MONSTERS_CONFIG[monsterId];
    if (!monster) return { success: false, reason: 'Unknown target.' };

    const squadData = this._um.getSquad(squadId);
    const army = squadData ? squadData.units : [];
    if (army.length === 0) return { success: false, reason: 'You have no units to send.' };
    if (this._um.isSquadDeployed?.(squadId)) return { success: false, reason: 'That squad is away on a march.' };

    // Consume the pending encounter modifier (if any) — not used in survival
    const modifier = isSurvival ? null : (this._pendingModifiers.get(monsterId) ?? null);
    if (!isSurvival) this._pendingModifiers.delete(monsterId);

    eventBus.emit('combat:started', { monsterId, monster });

    const result = this._simulateBattle(army, monster, modifier, squadId);

    // Determine if this win still yields full rewards
    const victoryCount = this._victoryCounts[monsterId] ?? 0;
    const maxRewarded  = monster.maxRewardedWins ?? 999;
    const isFullReward = result.victory && (isSurvival || victoryCount < maxRewarded);
    const isReduced    = result.victory && !isFullReward;

    // Scale rewards
    let rewards = null;
    if (result.victory) {
      rewards = {};
      for (const [k, v] of Object.entries(monster.rewards)) {
        rewards[k] = isFullReward ? v : Math.max(1, Math.floor(v * 0.1));
      }
    }

    // Log entry
    this._battleLog.unshift({
      timestamp: Date.now(),
      monster: monster.name,
      icon: monster.icon,
      monsterId,
      squadName: squadData?.name ?? 'Unknown Squad',
      result: result.victory ? 'Victory' : 'Defeat',
      rewards,
      reducedReward: isReduced,
      wavesSurvived: result.wavesSurvived,
      totalWaves: monster.waves.length,
      modifier: modifier ? { id: modifier.id, name: modifier.name, icon: modifier.icon } : null,
    });
    if (this._battleLog.length > MAX_BATTLE_LOG) this._battleLog.pop();

    // Apply losses
    if (result.losses && Object.keys(result.losses).length) {
      this._um.removeUnitsFromSquad(squadId, result.losses);
    }

    if (result.victory) {
      if (!isSurvival) this._victoryCounts[monsterId] = victoryCount + 1;
      // Resources delivered via mail attachment — MailManager hears combat:victory below.
      this._user.addXP(rewards.xp ?? 0);
      this._hm?.awardBattleXP(Math.floor((monster.rewards.xp ?? 100) * 0.5), squadId);
      eventBus.emit('combat:victory', { monsterId, rewards, losses: result.losses, reducedReward: isReduced });

      // Survival: escalate for next wave
      if (isSurvival) {
        this._survivalWave++;
        this._survivalMult = parseFloat((this._survivalMult * 1.05).toFixed(4));
        eventBus.emit('survival:waveCompleted', {
          wave: this._survivalWave,
          mult: this._survivalMult,
        });
      }
    } else {
      eventBus.emit('combat:defeat', { monsterId, losses: result.losses });

      // Survival: session ends on defeat
      if (isSurvival) {
        const finalScore = this._survivalWave;
        this._user.setWaveHighScore?.(finalScore);
        eventBus.emit('survival:ended', { score: finalScore });
        this._survivalWave = 0;
        this._survivalMult = 1.0;
      }
    }

    eventBus.emit('combat:logUpdated', this._battleLog);
    return { success: true, result, rewards, reducedReward: isReduced, modifier };
  }

  /**
   * Resolve a world-map march battle: a squad attacks a POI's garrison. Unlike
   * attack(), loot is RETURNED to the caller (MarchManager carries it home and
   * credits it on the army's return) rather than delivered via mail — so it must
   * NOT emit combat:victory (that would double-grant through MailManager).
   * @returns {{ victory:boolean, losses:object, loot:object }}
   */
  resolveMarchBattle(squadId, monsterId, milMult = 1) {
    const monster   = MONSTERS_CONFIG[monsterId];
    const squadData = this._um.getSquad(squadId);
    const army      = squadData ? squadData.units : [];
    if (!monster || army.length === 0) return { victory: false, losses: {}, loot: {} };

    const modifier = milMult > 1 ? { playerAttackMult: milMult } : null;
    const result = this._simulateBattle(army, monster, modifier, squadId);

    if (result.losses && Object.keys(result.losses).length) {
      this._um.removeUnitsFromSquad(squadId, result.losses);
    }

    let loot = {};
    if (result.victory) {
      for (const [k, v] of Object.entries(monster.rewards)) {
        if (k === 'xp') { this._user.addXP(v); continue; } // xp credited now; not carried as cargo
        loot[k] = v;
      }
      this._hm?.awardBattleXP(Math.floor((monster.rewards.xp ?? 100) * 0.5), squadId);
    }

    eventBus.emit('combat:marchResolved', {
      monsterId, victory: result.victory, loot, losses: result.losses,
      wavesSurvived: result.wavesSurvived,
    });
    return { victory: result.victory, losses: result.losses ?? {}, loot };
  }

  /**
   * Build a survival-mode monster from the base template, scaled by the current
   * _survivalMult.  Called each time the player enters a survival fight.
   * @private
   */
  _buildSurvivalMonster() {
    const base = SURVIVAL_MONSTER.baseWave;
    const m    = this._survivalMult;
    return {
      ...SURVIVAL_MONSTER,
      waves: [
        {
          name:    `${base.name} (Wave ${this._survivalWave + 1})`,
          hp:      Math.round(base.hp     * m),
          attack:  Math.round(base.attack * m),
          count:   Math.round(base.count  * (1 + (this._survivalWave * 0.02))),
        },
      ],
    };
  }

_simulateBattle(army, monster, modifier = null, squadId = null) {
    // Apply difficulty modifiers to wave stats
    const diffMod = DIFFICULTY_MODIFIERS[this._difficulty ?? 'normal'] ?? DIFFICULTY_MODIFIERS.normal;

    const heroBonus = this._hm?.getCombatBonuses(squadId) ?? { attackMult: 1, defenseMult: 1, lossReduction: 0 };
    const tech = this._techBonuses || {};

    let playerTotalAttack  = 0;
    let playerTotalDefense = 0;
    let playerTotalHP      = 0;

    for (const unit of army) {
      // Resolve stats from tier config if available, fall back to top-level stats for legacy data
      const baseCfg = UNITS_CONFIG[unit.unitId] ?? {};
      const tier    = unit.tier ?? 1;
      const tierCfg = baseCfg.tiers?.[tier - 1];
      const stats   = tierCfg?.stats ?? baseCfg.stats ?? { attack: 10, defense: 5, hp: 100 };

      let uAttack  = stats.attack  * (1 + (tech.attackBonus  || 0));
      let uDefense = stats.defense + (tech.defenseBonus || 0);
      let uHp      = stats.hp      * (1 + (tech.hpBonus      || 0));

      playerTotalAttack  += uAttack  * unit.count;
      playerTotalDefense += uDefense * unit.count;
      playerTotalHP      += uHp      * unit.count;
    }

    playerTotalAttack  *= heroBonus.attackMult;
    playerTotalDefense *= heroBonus.defenseMult;

    // Apply HQ-level combat bonuses
    if (this._bm) {
      const hqBenefits = this._bm.getHQBenefits();
      if (hqBenefits.attackBonus > 0)  playerTotalAttack  *= (1 + hqBenefits.attackBonus);
      if (hqBenefits.defenseBonus > 0) playerTotalDefense *= (1 + hqBenefits.defenseBonus);
    }

    // Apply modifier player-side multipliers
    if (modifier?.playerAttackMult) playerTotalAttack *= modifier.playerAttackMult;
    if (modifier?.playerHpMult)     playerTotalHP     *= modifier.playerHpMult;

    // Apply encounter modifier to wave stats
    const modifiedWaves = modifier?.waveTransform
      ? monster.waves.map(modifier.waveTransform)
      : monster.waves;

    // Apply difficulty scaling (always applied, including to survival waves)
    const waves = modifiedWaves.map(w => ({
      ...w,
      hp:     Math.round(w.hp     * diffMod.enemyHpMult),
      attack: Math.round(w.attack * diffMod.enemyAtkMult),
    }));

    const buckets = heroBonus.triggeredByEvent
      ?? { battle_start: [], wave_start: [], final_wave: [], losing: [] };

    // Post-battle heal from passive skills (e.g. consecration's postBattleHeal)
    const postBattleHeal = heroBonus.postBattleHeal ?? 0;

    let remainingPlayerHP = playerTotalHP;
    let wavesSurvived = 0;
    let waveIndex = 0;
    let triggeredLossReduction = 0;
    const waveDetails = [];

    for (const wave of waves) {
      if (remainingPlayerHP <= 0) break;

      let waveHP  = wave.hp    * wave.count;
      const waveAtk = wave.attack * wave.count;

      // heal: enemy regenerates a fraction of its max HP before fighting
      if (wave.specialAbility === 'heal') {
        const healAmount = waveHP * (wave.abilityValue ?? 0.2);
        waveHP = Math.round(waveHP + healAmount);
      }

      const rawDamage = Math.max(1, waveAtk - playerTotalDefense * 0.5);
      let dmgToPlayer = rawDamage;

      if (wave.specialAbility === 'aoe_blast') {
        dmgToPlayer += remainingPlayerHP * (wave.abilityValue ?? 0.3);
      }

      const isFirstWave = (wavesSurvived === 0);
      const isFinalWave = (waveIndex === waves.length - 1);
      const isLosing    = remainingPlayerHP < playerTotalHP * 0.4;

      const active = buckets.battle_start
        .filter(e => waveIndex < (e.skill.effect?.duration ?? 1))
        .concat(buckets.wave_start);
      if (isFinalWave) active.push(...buckets.final_wave);
      if (isLosing)    active.push(...buckets.losing);

      const waveFx = sumTriggeredEffects(active);
      triggeredLossReduction = Math.max(triggeredLossReduction, waveFx.lossReduction);

      let currentAttack = playerTotalAttack
        * (1 + (isFirstWave ? (tech.firstWaveBonus || 0) : 0) + waveFx.attackBonus);
      let currentDmg = dmgToPlayer;
      if (waveFx.evasion) currentDmg = 0;
      if (waveFx.defenseBonus > 0) currentDmg *= Math.max(0, 1 - waveFx.defenseBonus);

      const waveKillRounds = Math.ceil(waveHP / Math.max(1, currentAttack));
      const totalDmgTaken  = currentDmg * waveKillRounds * 0.3;

      remainingPlayerHP = Math.max(0, remainingPlayerHP - totalDmgTaken);
      wavesSurvived++;

      waveDetails.push({
        waveIndex,
        wave: wave.name,
        playerHP: Math.max(0, Math.round(remainingPlayerHP)),
        dmgReceived: Math.round(totalDmgTaken),
        rounds: waveKillRounds,
        ability: wave.specialAbility ?? null,
        waveHP,
      });

      // revive: spawn a weakened second pass of this wave
      if (wave.specialAbility === 'revive' && remainingPlayerHP > 0) {
        const revivedHP    = Math.round(waveHP * (wave.abilityValue ?? 0.3));
        const revivedAtk   = waveAtk;
        const revRounds    = Math.ceil(revivedHP / Math.max(1, currentAttack));
        const revDmgTaken  = Math.max(1, revivedAtk - playerTotalDefense * 0.5) * revRounds * 0.3;
        remainingPlayerHP  = Math.max(0, remainingPlayerHP - revDmgTaken);
        waveDetails.push({
          waveIndex,
          wave: `${wave.name} (Revived)`,
          playerHP: Math.max(0, Math.round(remainingPlayerHP)),
          dmgReceived: Math.round(revDmgTaken),
          rounds: revRounds,
          ability: 'revive_spawned',
          waveHP: revivedHP,
        });
      }

      waveIndex++;
    }

    const victory     = remainingPlayerHP > 0;
    const survivalRate = Math.max(0, Math.min(1, remainingPlayerHP / playerTotalHP));
    const baseLossRate = victory
      ? Math.max(0.02, 1 - survivalRate)
        * Math.max(0, 1 - heroBonus.lossReduction - triggeredLossReduction - (tech.lossReduction || 0))
      : 0.5 + (1 - survivalRate) * 0.5;

    const losses = {};
    for (const unit of army) {
      const lossKey = unit.tierKey ?? unit.unitId; // prefer tierKey ('infantry_t1'), fall back for legacy
      const lost    = Math.round(unit.count * baseLossRate);
      if (lost > 0) losses[lossKey] = Math.min(lost, unit.count);
    }

    // Post-battle heal: consecration restores a fraction of lost units
    if (victory && postBattleHeal > 0) {
      for (const [lossKey, lostCount] of Object.entries(losses)) {
        const restored = Math.floor(lostCount * postBattleHeal);
        if (restored > 0) {
          losses[lossKey] = Math.max(0, lostCount - restored);
          if (losses[lossKey] === 0) delete losses[lossKey];
        }
      }
    }

    return { victory, losses, wavesSurvived, waveDetails, survivalRate, initialPlayerHP: playerTotalHP };
  }

  /**
   * Estimates squad survival against a monster without side effects.
   * Safe to call from UI before committing an attack.
   * @param {string} squadId
   * @param {string} monsterId
   * @returns {{ survivalPct: number, victory: boolean, likelyTooWeak: boolean }}
   */
  estimateSurvival(squadId, monsterId) {
    // For survival_wave, use the current dynamically built monster
    const monster = monsterId === 'survival_wave'
      ? this._buildSurvivalMonster()
      : MONSTERS_CONFIG[monsterId];
    const squadData = this._um.getSquad(squadId);
    const army      = squadData?.units ?? [];
    if (!monster || army.length === 0) return { survivalPct: 0, victory: false, likelyTooWeak: true };
    const result = this._simulateBattle(army, monster, null);
    const pct = Math.round(result.survivalRate * 100);
    return { survivalPct: pct, victory: result.victory, likelyTooWeak: pct < 30 };
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
}
