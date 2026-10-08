import {
  HEROES_CONFIG,
  AWAKENING_CONFIG,
} from '../../entities/GAME_DATA.js';
import { collectEffects, bucketTriggeredByEvent } from './heroSkills.js';
import { statEntry, aggregate } from '../stats/statAggregator.js';
import { globalEffectBonus } from './heroProductionBonus.js';

const bySlot = (a, b) => (a.slotIndex ?? Infinity) - (b.slotIndex ?? Infinity);

export function auraValueFor(hero, cfg, auraFrac = 0) {
  const base = cfg.aura?.value ?? 0;
  if (!base) return 0;

  const levelTerm = AWAKENING_CONFIG.levelScalePerLevel * ((hero.level ?? 1) - 1);
  const starTerm  = (AWAKENING_CONFIG.perStarAuraBonus ?? 0) * (hero.stars ?? 0);
  return base * (1 + levelTerm + starTerm + auraFrac);
}

export class HeroCombat {
  constructor(hero) { this._h = hero; }

  _strikerFor(hero, cfg) {
    return {
      heroId: hero.heroId,
      slotIndex: hero.assignment.slotIndex ?? null,
      attack: hero.effectiveStats?.attack ?? cfg.stats.attack,
      level: hero.level,
    };
  }

  _auraValueFor(hero, cfg, auraFrac = 0) {
    return auraValueFor(hero, cfg, auraFrac);
  }

  /** Aggregate aura bonuses for a squad's heroes plus HQ heroes (null squadId = all). */
  getCombatBonuses(squadId = null) {
    let attackMult     = 1.0;
    let defenseMult    = 1.0;
    const statEntries  = { lossReduction: [], postBattleHeal: [] };
    const triggered    = [];
    const strikers     = [];

    for (const hero of this._h._owned.values()) {
      const a = hero.assignment;
      // Squad heroes = barracks-assigned heroes (barracks_0 → squad_1, etc.)
      const isBarracks = a?.type === 'building' && a.buildingId?.startsWith('barracks_');
      const targetBarracks = squadId !== null ? this._h.barracksIdForSquad(squadId) : null;
      const isSquadHero = isBarracks && (targetBarracks === null || a.buildingId === targetBarracks);
      // HQ hero: actually stationed at a heroquarters building instance (not just configured for one)
      const isHQHero = a?.type === 'building' && a.buildingId?.replace(/_\d+$/, '') === 'heroquarters';
      if (!isSquadHero && !isHQHero) continue;
      const cfg = HEROES_CONFIG[hero.heroId];
      if (!cfg) continue;

      if (isSquadHero) strikers.push(this._strikerFor(hero, cfg));
      const fx = collectEffects(hero, {});
      const auraValue = this._auraValueFor(hero, cfg, fx.auraFrac);

      if (cfg.aura) {
        switch (cfg.aura.type) {
          case 'attack_boost':
          case 'magic_amplify':
          case 'crit_chance':   attackMult  += auraValue; break;
          case 'defense_boost': defenseMult += auraValue; break;
        }
        // defense_boost only gives lossReduction, not double-counted
        if (cfg.aura.type === 'defense_boost') {
          statEntries.lossReduction.push(statEntry('lossReduction', 'hero', auraValue * 0.5, `${hero.heroId}:aura`));
        }
      }

      attackMult     += fx.attackMult;
      defenseMult    += fx.defenseMult;
      if (fx.lossReduction) {
        statEntries.lossReduction.push(statEntry('lossReduction', 'hero', fx.lossReduction, `${hero.heroId}:skills`));
      }
      if (fx.postBattleHeal) {
        statEntries.postBattleHeal.push(statEntry('postBattleHeal', 'hero', fx.postBattleHeal, `${hero.heroId}:skills`));
      }
      triggered.push(...fx.triggered);
    }

    const triggeredByEvent = bucketTriggeredByEvent(triggered);

    return {
      attackMult, defenseMult,
      baseDefense:    globalEffectBonus([...this._h._owned.values()]).baseDefense ?? 0,
      lossReduction:  aggregate('lossReduction', statEntries.lossReduction).total,
      postBattleHeal: aggregate('postBattleHeal', statEntries.postBattleHeal).total,
      statEntries,
      triggeredByEvent, activeSkills: triggeredByEvent.battle_start,
      strikers: strikers.sort(bySlot),
    };
  }
}
