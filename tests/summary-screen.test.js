import assert from "node:assert/strict";
import test from "node:test";
import { correctedSummaryTotals, chaseSummaryResult } from "../screens/summary.js";

test("summary corrections preserve raw and weighted totals", () => {
  assert.deepEqual(correctedSummaryTotals(10, 1, 1.25), { rawTotal: 11, adjustedTotal: 14 });
});

test("summary chase model preserves passed and remaining stages", () => {
  const target = { remaining: 3, label: "Week", leaderNames: ["Rival"] };
  const model = chaseSummaryResult({ stages: [target], complete: false, target, current: target, finalStage: target });
  assert.deepEqual(model, { passed: [], finalStage: "Week", finalLead: 0, remaining: 3, currentStage: "Week", rival: "Rival" });
});
