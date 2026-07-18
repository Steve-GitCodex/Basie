/**
 * buildQueue.js
 * Pure worker-pool mechanics for the build queue — no manager state, no side
 * effects. A queue is a plain array of items in enqueue order; an item is
 * ACTIVE when its `endsAt` is set and WAITING when `endsAt == null`. Up to
 * `maxWorkers` items run concurrently, and two items sharing an `instanceId`
 * never run at once (upgrades of one building stay serial).
 *
 * @see docs/20-decisions/0016-concurrent-build-workers.md
 */

const WAITING_BUFFER = 2;

const isActive = (item) => item.endsAt != null;

export const buildQueue = {
  WAITING_BUFFER,

  capacity(maxWorkers) {
    return maxWorkers + WAITING_BUFFER;
  },

  activeItems(queue) {
    return queue.filter(isActive);
  },

  hasActiveFor(queue, instanceId) {
    return queue.some(item => isActive(item) && item.instanceId === instanceId);
  },

  nextStartable(queue) {
    for (const item of queue) {
      if (isActive(item)) continue;
      if (!buildQueue.hasActiveFor(queue, item.instanceId)) return item;
    }
    return null;
  },

  /**
   * Stamp timers on waiting items until every worker is busy or nothing is
   * startable. Mutates items in place; returns the items that were started.
   */
  fill(queue, maxWorkers, atMs) {
    const started = [];
    let activeCount = buildQueue.activeItems(queue).length;
    while (activeCount < maxWorkers) {
      const item = buildQueue.nextStartable(queue);
      if (!item) break;
      item.startedAt = atMs;
      item.endsAt    = atMs + item.buildTimeSec * 1000;
      started.push(item);
      activeCount++;
    }
    return started;
  },

  earliestDue(queue, nowMs) {
    let due = null;
    for (const item of queue) {
      if (!isActive(item) || item.endsAt > nowMs) continue;
      if (!due || item.endsAt < due.endsAt) due = item;
    }
    return due;
  },

  earliestActive(queue) {
    let best = null;
    for (const item of queue) {
      if (!isActive(item)) continue;
      if (!best || item.endsAt < best.endsAt) best = item;
    }
    return best;
  },
};
