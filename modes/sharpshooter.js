export function sharpshooterTargetForBest(best, random = Math.random) {
  const personalBest = Math.max(0, Math.floor(Number(best) || 0));
  const min = personalBest > 0 ? Math.max(1, Math.ceil(personalBest * 0.5)) : 5;
  const max = personalBest > 0 ? Math.max(min, Math.floor(personalBest * 0.9)) : 15;
  const roll = Math.min(0.999999999, Math.max(0, Number(random()) || 0));
  return min + Math.floor(roll * (max - min + 1));
}
