/** Hero recruitment/awakening currency items — cards, fragments, shards, tokens, XP cards. */
export const HERO_ECONOMY_ITEMS = {
  // ── Specific Hero Cards ──────────────────────────────────────────────────
  card_hero_warlord: {
    id: 'card_hero_warlord', type: 'hero_card',
    name: 'Hero Card: Marcus Kestrel', icon: '⚔️',
    description: 'Recruit the legendary Warlord, Marcus Kestrel.',
    rarity: 'legendary', targetHeroId: 'warlord',
  },
  card_hero_archsorceress: {
    id: 'card_hero_archsorceress', type: 'hero_card',
    name: 'Hero Card: Vera Sable', icon: '🔮',
    description: 'Recruit the legendary Arch Sorceress, Vera Sable.',
    rarity: 'legendary', targetHeroId: 'archsorceress',
  },
  card_hero_shadowblade: {
    id: 'card_hero_shadowblade', type: 'hero_card',
    name: 'Hero Card: Kira Nightwhisper', icon: '🗡️',
    description: 'Recruit the elusive Shadow Blade, Kira Nightwhisper.',
    rarity: 'common', targetHeroId: 'shadowblade',
  },
  card_hero_paladin: {
    id: 'card_hero_paladin', type: 'hero_card',
    name: 'Hero Card: Aldric Cross', icon: '✝️',
    description: 'Recruit the noble Paladin, Aldric Cross.',
    rarity: 'rare', targetHeroId: 'paladin',
  },
  card_hero_junovane: {
    id: 'card_hero_junovane', type: 'hero_card',
    name: 'Hero Card: Juno Vane', icon: '📡',
    description: 'Recruit the Signal Runner, Juno Vane.',
    rarity: 'rare', targetHeroId: 'junovane',
  },
  card_hero_kaelenthorne: {
    id: 'card_hero_kaelenthorne', type: 'hero_card',
    name: 'Hero Card: Kaelen Thorne', icon: '🏹',
    description: 'Recruit the Wastewalker, Kaelen Thorne.',
    rarity: 'common', targetHeroId: 'kaelenthorne',
  },
  // ── Universal Hero Cards ─────────────────────────────────────────────────
  card_normal: {
    id: 'card_normal', type: 'hero_card_universal',
    name: 'Normal Hero Card', icon: '🃏',
    description: 'Recruits a random unowned Normal-tier hero.',
    rarity: 'common', targetTier: 'normal',
  },
  card_epic: {
    id: 'card_epic', type: 'hero_card_universal',
    name: 'Epic Hero Card', icon: '🎴',
    description: 'Recruits a random unowned Epic-tier hero.',
    rarity: 'rare', targetTier: 'epic',
  },
  card_legendary: {
    id: 'card_legendary', type: 'hero_card_universal',
    name: 'Legendary Hero Card', icon: '👑',
    description: 'Recruits a random unowned Legendary-tier hero.',
    rarity: 'legendary', targetTier: 'legendary',
  },
  // ── Hero Fragments ────────────────────────────────────────────────────────
  fragment_warlord: {
    id: 'fragment_warlord', type: 'hero_fragment',
    name: 'Fragment: Marcus Kestrel', icon: '⚔️',
    description: 'A fragment of Marcus Kestrel\' essence. Collect 30 to summon the hero or use for awakening.',
    rarity: 'legendary', targetHeroId: 'warlord', xpValue: 50,
  },
  fragment_archsorceress: {
    id: 'fragment_archsorceress', type: 'hero_fragment',
    name: 'Fragment: Vera Sable', icon: '🔮',
    description: 'A fragment of Vera Sable\' power. Collect 30 to summon the hero or use for awakening.',
    rarity: 'legendary', targetHeroId: 'archsorceress', xpValue: 50,
  },
  fragment_shadowblade: {
    id: 'fragment_shadowblade', type: 'hero_fragment',
    name: 'Fragment: Kira Nightwhisper', icon: '🗡️',
    description: 'A fragment of Kira Nightwhisper\' shadow. Collect 10 to summon the hero or use for awakening.',
    rarity: 'common', targetHeroId: 'shadowblade', xpValue: 50,
  },
  fragment_paladin: {
    id: 'fragment_paladin', type: 'hero_fragment',
    name: 'Fragment: Aldric Cross', icon: '✝️',
    description: 'A fragment of Aldric Cross\' holy light. Collect 20 to summon the hero or use for awakening.',
    rarity: 'rare', targetHeroId: 'paladin', xpValue: 50,
  },
  fragment_junovane: {
    id: 'fragment_junovane', type: 'hero_fragment',
    name: 'Fragment: Juno Vane', icon: '📡',
    description: 'A fragment of Juno Vane\' salvaged tech. Collect 20 to summon the hero or use for awakening.',
    rarity: 'rare', targetHeroId: 'junovane', xpValue: 50,
  },
  fragment_kaelenthorne: {
    id: 'fragment_kaelenthorne', type: 'hero_fragment',
    name: 'Fragment: Kaelen Thorne', icon: '🏹',
    description: 'A fragment of Kaelen Thorne\' trail markings. Collect 10 to summon the hero or use for awakening.',
    rarity: 'common', targetHeroId: 'kaelenthorne', xpValue: 50,
  },
  // ── Hero Shards (full-copy currency: unlock + awakening) ──────────────────
  shard_warlord: {
    id: 'shard_warlord', type: 'hero_shard',
    name: 'Hero Shard: Marcus Kestrel', icon: '⚔️',
    description: '8 shards unlock Marcus Kestrel outright; also spent on awakening stars.',
    rarity: 'legendary', targetHeroId: 'warlord',
  },
  shard_archsorceress: {
    id: 'shard_archsorceress', type: 'hero_shard',
    name: 'Hero Shard: Vera Sable', icon: '🔮',
    description: '8 shards unlock Vera Sable outright; also spent on awakening stars.',
    rarity: 'legendary', targetHeroId: 'archsorceress',
  },
  shard_shadowblade: {
    id: 'shard_shadowblade', type: 'hero_shard',
    name: 'Hero Shard: Kira Nightwhisper', icon: '🗡️',
    description: '4 shards unlock Kira Nightwhisper outright; also spent on awakening stars.',
    rarity: 'common', targetHeroId: 'shadowblade',
  },
  shard_paladin: {
    id: 'shard_paladin', type: 'hero_shard',
    name: 'Hero Shard: Aldric Cross', icon: '✝️',
    description: '6 shards unlock Aldric Cross outright; also spent on awakening stars.',
    rarity: 'rare', targetHeroId: 'paladin',
  },
  shard_junovane: {
    id: 'shard_junovane', type: 'hero_shard',
    name: 'Hero Shard: Juno Vane', icon: '📡',
    description: '6 shards unlock Juno Vane outright; also spent on awakening stars.',
    rarity: 'rare', targetHeroId: 'junovane',
  },
  shard_kaelenthorne: {
    id: 'shard_kaelenthorne', type: 'hero_shard',
    name: 'Hero Shard: Kaelen Thorne', icon: '🏹',
    description: '4 shards unlock Kaelen Thorne outright; also spent on awakening stars.',
    rarity: 'common', targetHeroId: 'kaelenthorne',
  },
  // ── Recruit Tokens (gacha currency, per tier) ──────────────────────────────
  token_normal: {
    id: 'token_normal', type: 'recruit_token',
    name: 'Normal Recruit Token', icon: '🎫',
    description: 'Pull the Normal-tier recruit gacha for a chance at an unowned hero, fragments, a Hero Shard, or XP.',
    rarity: 'common', tier: 'normal',
  },
  token_epic: {
    id: 'token_epic', type: 'recruit_token',
    name: 'Epic Recruit Token', icon: '🎟️',
    description: 'Pull the Epic-tier recruit gacha for a chance at an unowned hero, fragments, a Hero Shard, or XP.',
    rarity: 'rare', tier: 'epic',
  },
  token_legendary: {
    id: 'token_legendary', type: 'recruit_token',
    name: 'Legendary Recruit Token', icon: '🏵️',
    description: 'Pull the Legendary-tier recruit gacha for a chance at an unowned hero, fragments, a Hero Shard, or XP.',
    rarity: 'legendary', tier: 'legendary',
  },
  // ── Tier Shards (exchange-only currency, per tier) ─────────────────────────
  tier_shard_normal: {
    id: 'tier_shard_normal', type: 'tier_shard',
    name: 'Normal Tier Shard', icon: '🔹',
    description: 'Exchange-only currency. 3 Tier Shards convert to 1 Hero Shard of the same tier.',
    rarity: 'common', tier: 'normal',
  },
  tier_shard_epic: {
    id: 'tier_shard_epic', type: 'tier_shard',
    name: 'Epic Tier Shard', icon: '🔷',
    description: 'Exchange-only currency. 3 Tier Shards convert to 1 Hero Shard of the same tier.',
    rarity: 'rare', tier: 'epic',
  },
  tier_shard_legendary: {
    id: 'tier_shard_legendary', type: 'tier_shard',
    name: 'Legendary Tier Shard', icon: '💠',
    description: 'Exchange-only currency. 3 Tier Shards convert to 1 Hero Shard of the same tier.',
    rarity: 'legendary', tier: 'legendary',
  },
  // ── XP Cards (flat hero XP, per tier) ──────────────────────────────────────
  xpcard_normal: {
    id: 'xpcard_normal', type: 'xp_card',
    name: 'Normal XP Card', icon: '📗',
    description: 'Grants 500 Hero XP to a chosen hero.',
    rarity: 'common', tier: 'normal', xpValue: 500,
  },
  xpcard_epic: {
    id: 'xpcard_epic', type: 'xp_card',
    name: 'Epic XP Card', icon: '📘',
    description: 'Grants 2,500 Hero XP to a chosen hero.',
    rarity: 'rare', tier: 'epic', xpValue: 2500,
  },
  xpcard_legendary: {
    id: 'xpcard_legendary', type: 'xp_card',
    name: 'Legendary XP Card', icon: '📙',
    description: 'Grants 12,000 Hero XP to a chosen hero.',
    rarity: 'legendary', tier: 'legendary', xpValue: 12000,
  },
};
