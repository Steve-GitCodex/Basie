export const SKILLS_CONFIG = {
  charge: {
    id: 'charge', name: 'Charge', type: 'active',
    unlockLevel: 5,
    icon: '💨',
    description: 'On battle start, units deal +20% damage for the first round.',
    effect: { trigger: 'battle_start', attackBonus: 0.20, duration: 1 },
  },
  battle_cry: {
    id: 'battle_cry', name: 'Battle Cry', type: 'passive',
    unlockLevel: 10,
    icon: '📣',
    description: '+10% attack to all squad heroes.',
    effect: { stat: 'attack', value: 0.10, scope: 'squad' },
  },
  iron_will: {
    id: 'iron_will', name: 'Iron Will', type: 'passive',
    unlockLevel: 20,
    icon: '🦾',
    description: 'Reduces troop losses by 8% in every battle.',
    effect: { stat: 'lossReduction', value: 0.08 },
  },

  fireball: {
    id: 'fireball', name: 'Fireball', type: 'active',
    unlockLevel: 5,
    icon: '🔥',
    description: 'Deals a burst of magic damage at the start of battle (+25% attack, one round).',
    effect: { trigger: 'battle_start', attackBonus: 0.25, duration: 1 },
  },
  arcane_nova: {
    id: 'arcane_nova', name: 'Arcane Nova', type: 'passive',
    unlockLevel: 10,
    icon: '🌀',
    description: '+15% magic amplify aura bonus (stacks with base aura).',
    effect: { stat: 'auraValue', value: 0.15 },
  },
  mana_shield: {
    id: 'mana_shield', name: 'Mana Shield', type: 'passive',
    unlockLevel: 20,
    icon: '🔵',
    description: '+12% defense for all squad units.',
    effect: { stat: 'defense', value: 0.12, scope: 'squad' },
  },

  shadowstep: {
    id: 'shadowstep', name: 'Shadowstep', type: 'active',
    unlockLevel: 5,
    icon: '🌑',
    description: 'First round: hero evades one attack, dealing no losses to own side.',
    effect: { trigger: 'battle_start', evasion: true, duration: 1 },
  },
  poison_blade: {
    id: 'poison_blade', name: 'Poison Blade', type: 'passive',
    unlockLevel: 10,
    icon: '☠️',
    description: '+12% crit chance aura bonus (stacks with base aura).',
    effect: { stat: 'auraValue', value: 0.12 },
  },
  evasion: {
    id: 'evasion', name: 'Evasion', type: 'passive',
    unlockLevel: 20,
    icon: '🌬️',
    description: 'Reduces troop losses by 10% in every battle.',
    effect: { stat: 'lossReduction', value: 0.10 },
  },

  divine_shield: {
    id: 'divine_shield', name: 'Divine Shield', type: 'active',
    unlockLevel: 5,
    icon: '✨',
    description: 'At battle start, reduces incoming damage by 30% for the first round.',
    effect: { trigger: 'battle_start', defenseBonus: 0.30, duration: 1 },
  },
  holy_light: {
    id: 'holy_light', name: 'Holy Light', type: 'passive',
    unlockLevel: 10,
    icon: '☀️',
    description: '+10% defense aura bonus (stacks with base aura).',
    effect: { stat: 'auraValue', value: 0.10 },
  },
  consecration: {
    id: 'consecration', name: 'Consecration', type: 'passive',
    unlockLevel: 20,
    icon: '🕊️',
    description: 'Reduces troop losses by 12% and restores 5% of lost units after battle.',
    effect: { stat: 'lossReduction', value: 0.12, postBattleHeal: 0.05 },
  },
};
