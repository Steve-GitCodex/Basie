import { eventBus } from '../../core/EventBus.js';
import {
  HEROES_CONFIG,
  INVENTORY_ITEMS,
  GACHA_CONFIG,
  AWAKENING_CONFIG,
} from '../../entities/GAME_DATA.js';

export class HeroRecruitment {
  constructor(hero) {
    this._h = hero;
  }

  /** Roll a recruitment scroll (consumes one) and return the outcome. */
  rollScroll(scrollTier) {
    const scrollId = `scroll_${scrollTier}`;
    if (!this._h._inv?.hasItem(scrollId)) {
      return { outcome: null, reason: 'No scroll of this tier.' };
    }

    this._h._inv.removeItem(scrollId, 1);

    const outcome = this._weightedRandom(GACHA_CONFIG.outcomeWeights[scrollTier]);
    let result = { outcome, scrollTier };

    if (outcome === 'resource') {
      const pool   = GACHA_CONFIG.resourcePool;
      const itemId = pool[Math.floor(Math.random() * pool.length)];
      if (this._h._inv.addItem(itemId, 1)) {
        result.itemId = itemId;
      } else {
        result.grantFailed = true;
        result.reason = `Failed to grant reward item: ${itemId}.`;
      }

    } else if (outcome === 'xp_item') {
      const pool   = GACHA_CONFIG.xpPool[scrollTier];
      const itemId = pool[Math.floor(Math.random() * pool.length)];
      if (this._h._inv.addItem(itemId, 1)) {
        result.itemId = itemId;
      } else {
        result.grantFailed = true;
        result.reason = `Failed to grant reward item: ${itemId}.`;
      }

    } else if (outcome === 'buff') {
      const pool   = GACHA_CONFIG.buffPool[scrollTier];
      const itemId = pool[Math.floor(Math.random() * pool.length)];
      if (this._h._inv.addItem(itemId, 1)) {
        result.itemId = itemId;
      } else {
        result.grantFailed = true;
        result.reason = `Failed to grant reward item: ${itemId}.`;
      }

    } else if (outcome === 'fragment') {
      const heroTier    = this._weightedRandom(GACHA_CONFIG.heroTierWeights[scrollTier]);
      const heroesOfTier = Object.values(HEROES_CONFIG).filter(h => h.tier === heroTier);
      const heroTarget  = heroesOfTier[Math.floor(Math.random() * heroesOfTier.length)];
      const fragmentId  = GACHA_CONFIG.fragmentItemId[heroTarget.id];
      if (fragmentId && this._h._inv.addItem(fragmentId, 1)) {
        result.itemId  = fragmentId;
        result.heroId  = heroTarget.id;
        result.tier    = heroTier;
        // Check if enough fragments to summon
        const needed   = GACHA_CONFIG.fragmentsToSummon[heroTarget.tier];
        const owned    = this._h._inv.getQuantity(fragmentId);
        result.fragmentsOwned  = owned;
        result.fragmentsNeeded = needed;
        result.canSummon       = owned >= needed && !this._h._owned.has(heroTarget.id);
      } else {
        result.grantFailed = true;
        result.reason = `Failed to grant fragment: ${fragmentId}.`;
      }

    } else if (outcome === 'hero') {
      const heroTier     = this._weightedRandom(GACHA_CONFIG.heroTierWeights[scrollTier]);
      const candidates   = Object.values(HEROES_CONFIG).filter(h => h.tier === heroTier);
      const heroCfg      = candidates[Math.floor(Math.random() * candidates.length)];
      result.heroId      = heroCfg.id;
      result.tier        = heroTier;
      result.isDuplicate = this._h._owned.has(heroCfg.id);

      if (!result.isDuplicate) {
        this._recruitHero(heroCfg.id);
      } else {
        // Give a specific hero card as duplicate compensation
        const cardId = heroCfg.recruitCard;
        if (cardId && INVENTORY_ITEMS[cardId] && this._h._inv.addItem(cardId, 1)) {
          result.itemId = cardId;
        } else {
          result.grantFailed = true;
          result.reason = `Failed to grant duplicate compensation card: ${cardId}.`;
        }
      }
    }

    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return result;
  }

  /** @private weighted random pick from { key: weight } object */
  _weightedRandom(table) {
    let roll = Math.random() * 100;
    for (const [key, weight] of Object.entries(table)) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return Object.keys(table).at(-1);
  }

  /** @private Summon a fragment-based hero if enough fragments are held */
  summonFromFragments(heroId) {
    const heroCfg    = HEROES_CONFIG[heroId];
    if (!heroCfg) return { success: false, reason: 'Unknown hero.' };
    if (this._h._owned.has(heroId)) return { success: false, reason: 'Hero already owned.' };
    const fragmentId = GACHA_CONFIG.fragmentItemId[heroId];
    const needed     = GACHA_CONFIG.fragmentsToSummon[heroCfg.tier];
    if (!fragmentId || !needed) return { success: false, reason: 'No fragment config for this hero.' };
    if (!this._h._inv.hasItem(fragmentId, needed)) {
      return { success: false, reason: `Need ${needed} fragments (have ${this._h._inv.getQuantity(fragmentId)}).` };
    }
    this._h._inv.removeItem(fragmentId, needed);
    this._recruitHero(heroId);
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true, heroId };
  }

  /** Awaken a hero by spending a duplicate card or fragments. */
  awakenHero(heroId, method) {
    const hero    = this._h._owned.get(heroId);
    const heroCfg = HEROES_CONFIG[heroId];
    if (!hero || !heroCfg) return { success: false, reason: 'Hero not in roster.' };
    if (hero.stars >= AWAKENING_CONFIG.maxStars) return { success: false, reason: 'Hero is at max stars.' };

    const costCfg    = AWAKENING_CONFIG.starCosts[hero.stars];
    const cardId     = heroCfg.recruitCard;
    const fragmentId = GACHA_CONFIG.fragmentItemId[heroId];
    const fragNeeded = costCfg.fragments[heroCfg.tier];

    if (method === 'card') {
      if (!cardId || !this._h._inv.hasItem(cardId, costCfg.cards)) {
        return { success: false, reason: `Need ${costCfg.cards} duplicate ${heroCfg.name} card(s).` };
      }
      this._h._inv.removeItem(cardId, costCfg.cards);

    } else if (method === 'fragment') {
      if (!fragmentId || !this._h._inv.hasItem(fragmentId, fragNeeded)) {
        return { success: false, reason: `Need ${fragNeeded} fragments (have ${this._h._inv.getQuantity(fragmentId ?? '')}).` };
      }
      this._h._inv.removeItem(fragmentId, fragNeeded);

    } else {
      return { success: false, reason: 'Invalid awakening method.' };
    }

    hero.stars++;
    this._h.applySkillPassives(hero);
    eventBus.emit('hero:awakened', { heroId, name: heroCfg.name, stars: hero.stars });
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true, stars: hero.stars };
  }

  /** @private Create owned hero record and emit */
  _recruitHero(heroId) {
    const cfg = HEROES_CONFIG[heroId];
    if (!cfg) return;
    const hero = {
      heroId,
      level:    1,
      xp:       0,
      xpToNext: cfg.xpPerLevel ?? 500,
      stars:    0,
      effectiveStats: { ...cfg.stats },
      assignment: { type: 'none' },
    };
    this._h._owned.set(heroId, hero);
    this._h.applySkillPassives(hero);
    eventBus.emit('hero:recruited', { heroId, name: cfg.name, tier: cfg.tier });
  }

  /** Recruit via a specific hero card or a universal tier card (random unowned hero). */
  recruitWithCard(cardId) {
    const itemCfg = INVENTORY_ITEMS[cardId];
    if (!itemCfg) return { success: false, reason: 'Unknown card.' };

    if (!this._h._inv?.hasItem(cardId)) {
      return { success: false, reason: `You don't have a ${itemCfg.name}.` };
    }

    let heroId = null;

    if (itemCfg.type === 'hero_card') {
      heroId = itemCfg.targetHeroId;
      if (this._h._owned.has(heroId)) {
        return { success: false, reason: `${HEROES_CONFIG[heroId]?.name ?? heroId} is already in your roster.` };
      }

    } else if (itemCfg.type === 'hero_card_universal') {
      const tier       = itemCfg.targetTier;
      const candidates = Object.values(HEROES_CONFIG)
        .filter(cfg => cfg.tier === tier && !this._h._owned.has(cfg.id));
      if (candidates.length === 0) {
        return { success: false, reason: `You already own all ${tier} heroes!` };
      }
      heroId = candidates[Math.floor(Math.random() * candidates.length)].id;

    } else {
      return { success: false, reason: 'This item is not a hero card.' };
    }

    const cfg = HEROES_CONFIG[heroId];
    if (!cfg) return { success: false, reason: 'Hero config not found.' };

    this._h._inv.removeItem(cardId, 1);
    this._recruitHero(heroId);
    eventBus.emit('heroes:updated', this._h.getRosterWithState());
    return { success: true, heroId };
  }
}
