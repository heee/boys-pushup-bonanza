// Groups (docs/groups-plan.md) — pure helpers shared by the Board, Challenges,
// Games and the header switcher. `groups` is /data's array:
// [{ id, name, inviteCode, createdBy, members: [{ name, role, joinedAt }] }].

export const LEGACY_GROUP_ID = "the-boys-21";

export function groupsForUser(groups, user) {
  return (groups || []).filter((group) => group.members.some((m) => m.name === user));
}

export function isGroupAdmin(group, user) {
  return !!group?.members.some((m) => m.name === user && m.role === "admin");
}

export function groupMemberNames(group) {
  return (group?.members || []).map((m) => m.name);
}

// The stored choice if the user is still a member, else The Boys 2.1 if
// they're in it, else their first group, else null (solo).
export function resolveActiveGroupId(groups, user, storedId) {
  const mine = groupsForUser(groups, user);
  if (storedId && mine.some((g) => g.id === storedId)) return storedId;
  return (mine.find((g) => g.id === LEGACY_GROUP_ID) || mine[0])?.id || null;
}

// Board scope: "me", "all", or a group id. Returns the set of names to keep,
// or null for no filter.
export function scopeUserNames(scope, { groups, user }) {
  if (scope === "all") return null;
  if (scope === "me") return new Set([user]);
  const group = (groups || []).find((g) => g.id === scope);
  return group ? new Set(groupMemberNames(group)) : new Set([user]);
}

// Custom challenges carry visibility/groupId from /data; built-ins (no
// createdBy) are global. A challenge you've already joined stays visible
// even if you've since left its group.
export function challengeVisibleTo(challenge, { user, groups, participants = [] }) {
  if (!challenge?.createdBy) return true;
  if (challenge.createdBy === user || participants.includes(user)) return true;
  if (challenge.visibility === "public") return true;
  if (challenge.visibility === "group") return groupsForUser(groups, user).some((g) => g.id === challenge.groupId);
  return false;
}

// "Who's flexing today?" once groups are on (docs/groups-plan.md): profiles
// used on this device, plus every member of any group one of them belongs
// to — so a Boys 2.1 phone keeps its full roster while a brand-new install
// only sees itself. Keeps the incoming order; members with no sessions yet
// go last.
export function pickerUserNames(orderedNames, { deviceProfiles, groups }) {
  const mine = new Set(deviceProfiles);
  const roster = new Set(deviceProfiles);
  for (const group of groups || []) {
    if (group.members.some((m) => mine.has(m.name))) for (const m of group.members) roster.add(m.name);
  }
  const ordered = orderedNames.filter((name) => roster.has(name));
  for (const name of roster) if (!ordered.includes(name)) ordered.push(name);
  return ordered;
}
