export function squadNameForHero(hero, um) {
  if (!hero.isInSquad || !hero.assignedBuilding) return null;
  const squads = um?.getSquads() ?? [];
  const match = squads.find(s => s.barracksInstanceId === hero.assignedBuilding);
  if (match) return match.name;
  const idx = parseInt(hero.assignedBuilding.replace('barracks_', ''), 10);
  return `Squad ${idx + 1}`;
}
