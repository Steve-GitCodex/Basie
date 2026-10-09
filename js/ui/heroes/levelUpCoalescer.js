export function createLevelUpCoalescer(flush, schedule = queueMicrotask) {
  const bursts = new Map();
  return function record({ heroId, name, level }) {
    const burst = bursts.get(heroId);
    if (burst) { burst.to = level; return; }
    bursts.set(heroId, { name, from: level - 1, to: level });
    schedule(() => {
      const done = bursts.get(heroId);
      bursts.delete(heroId);
      flush(done);
    });
  };
}
