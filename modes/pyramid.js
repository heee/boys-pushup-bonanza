export const PYRAMID_SIZES = [
  { id: "flaccid", label: "Flaccid", base: 5 },
  { id: "semi", label: "Semi", base: 8 },
  { id: "firm", label: "Firm", base: 10 },
  { id: "rockhard", label: "Rock Hard", base: 12 },
  { id: "anaconda", label: "Anaconda", base: 15 },
];

export function pyramidUpOnlyReps(base) {
  return (base * (base + 1)) / 2;
}

export function pyramidTotalReps(base, direction) {
  return direction === "updown" ? base * base : pyramidUpOnlyReps(base);
}

export function pyramidRowStatus(row, currentRow, phase) {
  if (phase === "ascending") {
    if (row < currentRow) return "cleared";
    if (row === currentRow) return "active";
    return "locked";
  }
  if (row > currentRow) return "cleared";
  if (row === currentRow) return "active";
  return "locked";
}

export function pyramidRows(base, direction, currentRow, phase) {
  const rows = [];
  for (let row = base; row >= 1; row -= 1) rows.push(row);
  return rows.map((row) => ({ row, status: pyramidRowStatus(row, currentRow, phase) }));
}
