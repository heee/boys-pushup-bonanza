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

const PACE_NOTE_MIN_REPS = 5;

// Bucket boundaries follow the "20-30/min controlled, 30-40 fast, 40+ sprint"
// reference pace for continuous good-form pushups; below 20/min (>3s/rep) is
// the symmetric slow bucket. The 20-30/min/2-3s window is deliberately silent
// (normal pace, nothing to flag).
export function pushupPaceNote({ rawCount, durationMs }) {
  if (!Number.isFinite(rawCount) || rawCount < PACE_NOTE_MIN_REPS) return null;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  const secPerRep = durationMs / 1000 / rawCount;
  const secText = secPerRep < 10 ? secPerRep.toFixed(1) : Math.round(secPerRep).toString();
  if (secPerRep <= 1.5) {
    return { tier: "sprint", text: `🚀 Sprint pace — ${secText}s/rep. Great hustle, but that's usually where form and full range of motion start slipping.` };
  }
  if (secPerRep <= 2) {
    return { tier: "fast", text: `⚡ Quick pace — ${secText}s/rep. Good pace, just make sure you're hitting full depth each rep.` };
  }
  if (secPerRep <= 3) {
    return null;
  }
  return { tier: "slow", text: `🐢 Slower pace — ${secText}s/rep. Nothing wrong with a grind, but if you're fighting through failure, shorter sets might help.` };
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
