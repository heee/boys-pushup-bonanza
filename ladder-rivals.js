export function buildLadderRivals(sessions, currentUser) {
  const bestByUser = new Map();
  for (const session of sessions || []) {
    if (!session || session.user === currentUser || session.mode !== "ladder") continue;
    const rung = Math.floor(Number(session.ladderMaxRung) || 0);
    if (rung < 1) continue;
    bestByUser.set(session.user, Math.max(bestByUser.get(session.user) || 0, rung));
  }
  const byRung = new Map();
  for (const [name, rung] of bestByUser) {
    if (!byRung.has(rung)) byRung.set(rung, []);
    byRung.get(rung).push(name);
  }
  return Array.from(byRung, ([rung, names]) => ({ rung, names: names.sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.rung - b.rung);
}

export function ladderRivalMilestones(rivals, enteredRung) {
  const milestones = [];
  const passed = rivals.find((rival) => rival.rung === enteredRung - 1);
  if (passed) milestones.push({ type: "passed", rival: passed });
  const matched = rivals.find((rival) => rival.rung === enteredRung);
  if (matched) milestones.push({ type: "matched", rival: matched });
  const approaching = rivals.find((rival) => rival.rung === enteredRung + 2);
  if (approaching) milestones.push({ type: "approaching", rival: approaching });
  return milestones;
}

export function shouldCompactLadderRivals(users) {
  return users.length > 2;
}
