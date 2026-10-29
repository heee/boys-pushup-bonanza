# Groups + expanded game session types — plan

Status: **approved, building** (2026-10-29). Phases 1–3 shipped dark: everything is gated on `/data`'s `groupsEnabled`, which turns true only once the 0009 SQL has run — until then the app behaves exactly as before.

Groundwork for a broader App Store launch. Real groups replace the single
implicit "Boys Bonanza" pool; every current user lands in **The Boys 2.1**.
Accounts (Sign in with Apple) are a separate, later project — this build
keeps today's name-based identity.

## Decisions (from Q&A)

| # | Topic | Decision |
|---|---|---|
| 1 | Membership | A user can belong to multiple groups; one is "active". |
| 2 | Scope | Board, Challenges, Games follow the active group. Roadtrip stays global. Streak / Just-me stats are personal. |
| 3 | Joining | Invite link / short code; tapping it joins instantly. |
| 4 | Admin | Creator is admin; admins can promote others, rename, remove members, delete group. Henning = admin of The Boys 2.1. |
| 5 | Identity | Groups now on name-based identity; accounts later. |
| 6 | Switcher | Tap the "Bonanza" header wordmark for a quick group menu; full management under Settings → Groups. |
| 7–9 | Board dropdown | Lists **Just me**, each of my groups, **All players**. Defaults to the active group; it's a Board-only view (doesn't change the active group). |
| 8 | New user | After picking a name: Create group / Join with code / Play solo (no group). |
| 10 | Challenges | Built-in seasonal = global (leaderboard filtered by the Board-style scope). Custom: creator picks **Personal**, **Group** (active group) or **Public**. Existing custom challenges → The Boys 2.1. |
| 11 | Tug of war | Same four session types as Horse; "Online" renamed "Invite". |
| 12 | Discovery | Group sessions appear in members' Games → Open and light the nav dot. Public sessions appear in a separate "Public" section, no dot. |
| 13 | Player cap | Host picks max players (2–8, default 4) for Group/Public; closes when full or on Start. |
| 14 | Leaving | Drops off the group's Board/challenges/games going forward; sessions are personal so history returns on rejoin; finished games keep the name. |
| 15 | Rep history | A member's full history counts on every group they're in. |
| 16 | User picker | New devices show only profiles used on this device + New player + Join via invite. |
| 17 | New device | Open any group invite → see members → tap your name to add it to the device. |
| 17b | **Zero change for current users** | Any device that already has a Boys 2.1 profile keeps showing the full Boys 2.1 roster in the picker (exactly as today), lands with The Boys 2.1 active, and Board defaults to it. Nothing to tap, no prompts. |

## Session types (Horse + Tug of war)

| Type | Copy |
|---|---|
| **Live** | Pass the phone around in person — everyone plays on this device. |
| **Invite** | Pick specific players; they compete on their own devices. |
| **Group** | Everyone in *{active group}* gets notified and can join on their own device. |
| **Public** | Anyone on the app can find and join on their own device. |

Group disabled (with hint "Join or create a group") when the user has no group.
Existing `open` games are treated as `group` for The Boys 2.1 (read-time alias, no rewrite).

## Data

New D1 tables + seed, all in `worker/migrations/0009_groups.sql` (DDL —
**Henning runs it in the Cloudflare D1 console**; the MCP credential can't run
DDL): `groups`, `group_members`, and `challenge_scopes` (a side table rather
than an ALTER on `custom_challenges`). The seed puts every existing user in
The Boys 2.1 (Henning admin, invite code BOYS21) and scopes existing custom
challenges to it.

Horse / Tug of war games are JSON blobs — `sessionType`, `groupId`,
`maxPlayers` added in the JSON, no schema change.

Worker: `/data` returns `groups` (with members) and `groupsEnabled`; one
`/group-action` endpoint (create/join/leave/rename/promote/remove/delete); challenge + game create/join
endpoints validate group membership and `maxPlayers`.

## Build phases (each shipped + verified separately)

1. **Data + migration** — SQL, seed, Worker `/data` + group endpoints. No UI change.
2. **Active group + header switcher + Settings → Groups** (create, invite/share code, join, rename, members, promote/remove, leave, delete).
3. **Board scope dropdown** — Just me / groups / All players.
4. **Challenges** — Personal / Group / Public at creation; list + leaderboards respect scope.
5. **Games** — Live / Invite / Group / Public for Horse and Tug of war, max-players picker, Games tab Group + Public sections, nav-dot rules.
6. **User picker + onboarding** — device-profile picker, invite-link join + claim-name, new-user Create / Join / Solo; Boys 2.1 devices unchanged.

## Out of scope / later

- Accounts / Sign in with Apple, push notifications, group avatars, discoverable/searchable groups, Roadtrip per-group view.
