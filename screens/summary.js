export function chaseSummaryText(result) {
  if (!result) return "";
  if (result.finalLead > 0) return `👑 Finished ${result.finalLead} points ahead of ${result.rival} on the ${result.finalStage} board. The throne has been declared structurally unsafe.`;
  return `🔥 Closed the gap on ${result.rival}; ${result.remaining} points remain on the ${result.currentStage} board.`;
}

export function weightedSummaryText({ weightLbs, rawTotal, multiplier, adjustedTotal, formatNumber }) {
  if (multiplier === 1) return "";
  return `🏋️ +${weightLbs} lbs · ${formatNumber(rawTotal)} raw × ${multiplier.toFixed(2)} = ${formatNumber(adjustedTotal)}`;
}

export function correctedSummaryTotals(baseCount, extra, multiplier) {
  const rawTotal = baseCount + extra;
  return { rawTotal, adjustedTotal: Math.round(rawTotal * multiplier) };
}

export function chaseSummaryResult(progress) {
  const stage = progress.target || progress.current || progress.finalStage;
  return {
    passed: progress.complete ? [stage?.label].filter(Boolean) : [],
    finalStage: progress.finalStage?.label || "",
    finalLead: progress.complete ? Math.max(1, progress.finalStage.lead) : 0,
    remaining: progress.current?.remaining || 0,
    currentStage: progress.current?.label || "",
    rival: stage?.leaderNames?.[0] || "the leader",
  };
}
