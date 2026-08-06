export function weightModifierText(profile, multiplier) {
  if (!profile.bodyweightLbs || profile.bodyweightLbs <= 0) return "Enter your bodyweight to enable weighted mode.";
  const example = Math.round(20 * multiplier);
  return `Modifier: ×${multiplier.toFixed(2)} (${profile.bodyweightLbs} lb bodyweight + ${profile.addedWeightLbs || 0} lbs today). For example, 20 reps would count as ${example}.`;
}
