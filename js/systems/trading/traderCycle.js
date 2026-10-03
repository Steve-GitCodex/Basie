export function advanceCycle(visit, now, timing) {
  const next = { ...visit };
  let arrived = false;
  let left = false;
  for (;;) {
    if (next.present && now >= next.leavesAt) {
      next.present = false;
      next.nextVisitAt = next.leavesAt + timing.awayMs;
      left = true;
    } else if (!next.present && now >= next.nextVisitAt) {
      next.present = true;
      next.arrivedAt = next.nextVisitAt;
      next.leavesAt = next.arrivedAt + timing.stayMs;
      arrived = true;
    } else {
      break;
    }
  }
  return { visit: next, arrived, left };
}

export function cutAwayTime(nextVisitAt, now, timing) {
  if (nextVisitAt - now <= timing.minAwayMs) return nextVisitAt;
  return Math.max(now + timing.minAwayMs, nextVisitAt - timing.activityCutMs);
}
