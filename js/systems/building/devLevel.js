/**
 * devLevel.js
 * Dev-only: force an already-placed building instance to any level, bypassing
 * cost/queue, so a sprite's per-level anchor/scale can be eyeballed in-game
 * without grinding a real upgrade (@see docs/20-decisions/0014-dev-session-flag.md).
 */
export const devLevel = {
  setLevel(instances, cfg, level, instanceIndex = 0) {
    if (!cfg) return { success: false, reason: 'Unknown building.' };
    const inst = instances?.[instanceIndex];
    if (!inst) return { success: false, reason: 'Building not placed yet.' };
    const clamped = Math.max(1, Math.min(cfg.maxLevel, level | 0));
    inst.level = clamped;
    return { success: true, level: clamped };
  },
};
