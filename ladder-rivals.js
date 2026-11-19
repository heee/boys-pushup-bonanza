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

const DAY_MS = 24 * 60 * 60 * 1000;
export const LADDER_LATEST_WINDOW_DAYS = 30;

// Every Ladder marker to draw: each user's all-time best rung ("best") plus
// their most recent climb ("latest") if it landed within the window. When
// the latest climb sits on the best rung the two fold into one "both"
// marker; freshPB flags a latest climb that itself set that best.
// Includes the current user, flagged self.
export function buildLadderMarkers(sessions, currentUser, now = Date.now(), windowDays = LADDER_LATEST_WINDOW_DAYS) {
  const byUser = new Map();
  for (const session of sessions || []) {
    if (!session || session.mode !== "ladder" || !session.user) continue;
    const rung = Math.floor(Number(session.ladderMaxRung) || 0);
    if (rung < 1) continue;
    const time = Date.parse(session.timestamp) || 0;
    if (!byUser.has(session.user)) byUser.set(session.user, []);
    byUser.get(session.user).push({ rung, time });
  }
  const markers = [];
  for (const [name, runs] of byUser) {
    runs.sort((a, b) => a.time - b.time);
    const best = Math.max(...runs.map((run) => run.rung));
    const latest = runs[runs.length - 1];
    const self = name === currentUser;
    const fresh = latest.time > 0 && now - latest.time <= windowDays * DAY_MS;
    const ageDays = fresh ? Math.max(0, Math.floor((now - latest.time) / DAY_MS)) : null;
    if (fresh && latest.rung === best) {
      const freshPB = runs.slice(0, -1).every((run) => run.rung < best);
      markers.push({ name, rung: best, kind: "both", ageDays, freshPB, self });
    } else {
      markers.push({ name, rung: best, kind: "best", ageDays: null, freshPB: false, self });
      if (fresh) markers.push({ name, rung: latest.rung, kind: "latest", ageDays, freshPB: false, self });
    }
  }
  return markers;
}

// Groups markers by rung for the rung rows: bests (and merged) first, then
// latest ghosts, the current user last within each kind.
export function groupLadderMarkers(markers) {
  const kindOrder = { both: 0, best: 0, latest: 1 };
  const byRung = new Map();
  for (const marker of markers) {
    if (!byRung.has(marker.rung)) byRung.set(marker.rung, []);
    byRung.get(marker.rung).push(marker);
  }
  return Array.from(byRung, ([rung, users]) => ({
    rung,
    users: users.sort((a, b) => (kindOrder[a.kind] - kindOrder[b.kind]) || (a.self - b.self) || a.name.localeCompare(b.name)),
  })).sort((a, b) => a.rung - b.rung);
}

// Rung milestones over marker groups. Per milestone: rival names whose best
// sits there (best wins — a rival with both on that rung is counted once,
// as best), rival names whose latest-only ghost sits there, and whether the
// player's own latest ghost is there.
export function ladderMarkerMilestones(groups, enteredRung) {
  const at = (rung) => groups.find((group) => group.rung === rung);
  const split = (group) => {
    const rivals = group.users.filter((user) => !user.self);
    return {
      best: rivals.filter((user) => user.kind !== "latest").map((user) => user.name),
      latest: rivals.filter((user) => user.kind === "latest").map((user) => user.name),
      selfLatest: group.users.some((user) => user.self && user.kind === "latest"),
    };
  };
  const milestones = [];
  for (const [type, rung] of [["passed", enteredRung - 1], ["matched", enteredRung], ["approaching", enteredRung + 2]]) {
    const group = at(rung);
    if (!group) continue;
    const parts = split(group);
    if (parts.best.length || parts.latest.length || (type === "passed" && parts.selfLatest)) milestones.push({ type, ...parts });
  }
  return milestones;
}
