const SKILL_GROUP_ORDER = ['support', 'major', 'passive'];

const canTrigger = (skill) => skill.domain === 'combat'
  && skill.unlocked
  && !!skill.effect?.trigger
  && !(skill.type === 'major' && (skill.level ?? 0) < 1);

function skillIdsFor(rosterEntry, fired) {
  const known = SKILL_GROUP_ORDER
    .flatMap(group => rosterEntry?.skills?.[group] ?? [])
    .filter(canTrigger)
    .map(skill => skill.id);
  return [...new Set([...known, ...Object.keys(fired ?? {})])];
}

export function heroBarModel(roster, { squadHeroes = [], supportHeroes = [] }, skillCatalog = {}) {
  const byId = new Map(roster.map(entry => [entry.id, entry]));
  const base = (heroId) => ({ heroId, level: byId.get(heroId)?.level ?? 1, tier: byId.get(heroId)?.tier ?? 'normal' });
  return {
    squadHeroes: [...squadHeroes]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map(({ heroId, slotIndex }) => ({ ...base(heroId), slotIndex, skillIds: skillIdsFor(byId.get(heroId), skillCatalog[heroId]) })),
    supportHeroes: supportHeroes.map(({ heroId }) => base(heroId)),
  };
}
