export function createRepCounter(config = {}) {
  const cfg = {
    down: config.down ?? 0.55,
    up: config.up ?? 0.32,
    minMsBetweenReps: config.minMsBetweenReps ?? 280,
    confirmMs: config.confirmMs ?? 80,
  };
  let phase = "up";
  let count = 0;
  let lastRepAt = -Infinity;
  let prev = null;

  return {
    advance(rawRatio, tMs) {
      const confirms = (test) => prev != null && (test(prev.ratio) || tMs - prev.t > cfg.confirmMs);
      let counted = false;
      if (phase === "up" && rawRatio >= cfg.down && confirms((ratio) => ratio >= cfg.down)) {
        phase = "down";
      } else if (phase === "down" && rawRatio <= cfg.up && confirms((ratio) => ratio <= cfg.up)) {
        phase = "up";
        if (tMs - lastRepAt >= cfg.minMsBetweenReps) {
          count += 1;
          lastRepAt = tMs;
          counted = true;
        }
      }
      prev = { ratio: rawRatio, t: tMs };
      return { smoothed: rawRatio, phase, count, counted };
    },
    setThresholds(down, up) {
      cfg.down = down;
      cfg.up = up;
    },
    get count() { return count; },
    get phase() { return phase; },
  };
}
