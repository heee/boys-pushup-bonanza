export function orderedUserNames(sessions, currentUser, { alphabetical = false, random = Math.random } = {}) {
  const all = [...new Set(sessions.map((session) => session.user).filter(Boolean))];
  const others = all.filter((name) => name !== currentUser);
  if (alphabetical) others.sort((a, b) => a.localeCompare(b));
  else {
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
  }
  return all.includes(currentUser) ? [currentUser, ...others] : others;
}

export function userSelectionModel(names, lastUser, { expanded = false, creating = false } = {}) {
  const recentUser = lastUser && names.includes(lastUser) ? lastUser : "";
  const compact = !!recentUser && !expanded;
  return {
    recentUser,
    compact,
    creating,
    visibleUsers: compact ? [] : names.filter((name) => name !== recentUser),
    showMore: !!recentUser,
    staleRecentUser: !!lastUser && names.length > 0 && !recentUser,
  };
}

export function visibleUserSessions(sessions, user, limit) {
  const mine = sessions
    .filter((session) => session.user === user)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return { sessions: mine.slice(0, limit), hasMore: mine.length > limit, total: mine.length };
}

export function renameCachedIdentity(data, oldName, newName) {
  for (const session of data.sessions || []) if (session.user === oldName) session.user = newName;
  if (data.avatars && Object.prototype.hasOwnProperty.call(data.avatars, oldName)) {
    data.avatars[newName] = data.avatars[oldName];
    delete data.avatars[oldName];
  }
  for (const id of Object.keys(data.challengeParticipants || {})) {
    data.challengeParticipants[id] = data.challengeParticipants[id].map((user) => user === oldName ? newName : user);
  }
  return data;
}
