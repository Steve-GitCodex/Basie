export function worldBuffStat(buff) {
  if (buff.flavor === 'economic') return `production.${buff.resource}`;
  if (buff.flavor === 'military') return 'troop.attack';
  return 'march.speed';
}
