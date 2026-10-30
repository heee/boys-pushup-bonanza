# Share message tone — plan

Status: **shipped** (2026-10-29)

A Settings → Preferences control that sets how unhinged share texts are.

## Decisions (from Q&A)

| # | Topic | Decision |
|---|---|---|
| 1 | Scale | 3 levels in a segmented control: **Chill / Spicy / Unhinged**. |
| 2 | Behavior | **Exact level** — each level draws only from lines rated that tone. |
| 3 | Gaps | Rate every existing line, then **write new lines so every pool has ≥ 5 per level**. |
| 4 | Tone guide | See below. |
| 5 | Coverage | **Every share the app writes** — workout results, leaderboard, challenges, Roadtrip theft, Horse / Tug of war, recaps, invites. |
| 6 | Default | **Unhinged** for everyone, including current users. |

## Tone guide (the rating rubric)

- **Chill** — friendly brag, safe for family or coworkers. No insults, no innuendo.
  e.g. "120 pushups today 💪 Your turn!"
- **Spicy** — trash talk at the group ("losers", "cowards"), cocky, mild innuendo.
  e.g. "120 pushups. Pay rent in reps, losers."
- **Unhinged** — absurd, over-the-top, crude, borderline NSFW. Hard limits at every
  level: no slurs, nothing about real people's bodies or identity.
  e.g. "120 pushups and my pecs have filed for independence. Paperwork is sweaty."

## How it works

- **Data:** each template pool becomes `{ chill: [...], spicy: [...], unhinged: [...] }`
  (same template functions, just sorted). ~75 pools in `share-messages.js` plus the
  handful defined in `app.js` (leaderboard, challenge, Roadtrip, Horse).
- **Picking:** one helper, `pickToned(pool)`, reads the saved level and picks from that
  bucket. Every existing `pickFrom(POOL)` call for share copy goes through it.
- **Setting:** Settings → Preferences, "Share message tone", stored per device like the
  other preferences (`bpb-share-tone`), default `unhinged`. A one-line preview under the
  control shows a sample line at the chosen level.
- **Rating + writing:** I rate all ~2,900 lines against the guide and write the new
  lines needed to reach 5 per level per pool. You review a sample before it ships.
- **Tests:** every pool has ≥ 5 lines at each level; every line still renders with
  its pool's context (no undefined fields); the picker never crosses levels.

## Build steps

1. Restructure pools + `pickToned` + setting UI (all lines temporarily "unhinged" so
   nothing changes yet).
2. Rate existing lines pool by pool; write gap-fill lines.
3. Review pass with you (a sampler of each level), then ship.

## Out of scope

Spoken voice lines (`voice-lines.js`) and in-app toasts — only text that gets shared.
