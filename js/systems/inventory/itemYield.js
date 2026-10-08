export const BATCHABLE = new Set(['resource_bundle', 'xp_bundle', 'xp_card', 'hero_fragment']);
export const HERO_XP_TYPES = new Set(['xp_bundle', 'xp_card', 'hero_fragment']);

export function xpPerUnit(cfg) {
  if (cfg.type === 'xp_bundle') return cfg.xpAmount ?? cfg.grants?.xp ?? 0;
  if (cfg.type === 'xp_card') return cfg.xpValue ?? 0;
  if (cfg.type === 'hero_fragment') return cfg.xpValue ?? 50;
  return 0;
}

export function resourceYield(grants, qty, snapshot, mult) {
  const out = { grants: {}, lost: {} };
  for (const [res, per] of Object.entries(grants)) {
    const requested = per * qty * mult;
    const slot = snapshot[res];
    const room = !slot ? 0 : slot.cap === Infinity ? Infinity : Math.max(0, slot.cap - slot.amount);
    const gained = Math.min(requested, room);
    out.grants[res] = gained;
    if (requested > gained) out.lost[res] = requested - gained;
  }
  return out;
}
