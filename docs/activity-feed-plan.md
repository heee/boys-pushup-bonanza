# Activity Feed (agreed 2026-11-27)

A second page on Home, revealed by swiping left from the start page.

## Navigation
- Home's content area is a two-page pager: **Start** ↔ **Feed**. Header and tab bar stay put.
- Finger-tracking drag, snaps on release (≥25% width or a quick flick). Left from Start → Feed,
  right from Feed → Start. No wraparound; rubber-bands at the ends.
- Two page dots (● ○) at the top of Home, tappable; the Feed dot carries the unread-reactions badge.
- Disabled during active workouts (the pager lives inside `#workout-idle`).
- App open and Home-tab taps always land on Start. Returning from a detail opened from the
  feed (session detail etc.) keeps the Feed page.

## Content
- Scope: the active group (same roster as the Board), including your own items. Solo users
  (no group) see their own activity. All-time, day headers (Today / Yesterday / Tue, Nov 24),
  rendered in pages of 30 as you scroll.
- **Session rows** (compact, like the old Board "History" list). Bursts — same person, same
  exercise, each set within 2h of the previous — collapse into one row ("4 sets · 120 pushups");
  tap to expand, tap a set to open its session detail.
- **Highlight cards** (larger, gold/flame accent):
  - Single-session PR per exercise (reps, or seconds for plank / dead hang). Never on someone's
    first session of that exercise. Pulse, Holland, Chain of Pain and Kettlebell are excluded.
  - Lifetime rep milestones 1k / 5k / 10k / 25k / 50k / 100k (pushups, squats, crunches,
    pull-ups, grip).
  - Streak milestones 7 / 30 / 50 / 100 / 365 days.
  - Daily / weekly #1 in the group by pushup reps — emitted once the day / week is over and
    only when ≥2 members were active.
  - Trophy tiers unlocked (from the Trophy Case model).
  - HORSE and Tug-of-war results, challenge wins, Cock Mode wins. Challenge joins show as
    compact rows (only joins recorded after the `joined_at` column exists have a date).
- Dedupe: a milestone or streak value that is also a trophy threshold for the same
  exercise shows only the trophy card. A session that produced a PR / Cock win shows as that
  highlight instead of a plain row.
- Copy: mostly factual, punchy verbs on highlights.
- Tapping opens the relevant detail: session detail, trophy sheet, game summary, challenge
  detail, user compare (or your own Trophies), Board for #1 cards.
- Not included: Chase passes (the Worker doesn't persist Chase results).
- The Board's "History" list is removed (the feed replaces it).

## Reactions
- Fixed set of 11: 💪 🔥 😂 👑 😤 👏 💀 🫡 🐐 🤡 😮.
- Each item shows its reaction chips with counts (yours highlighted); tap a chip to toggle;
  **+** opens the full picker. Any number of different emoji per person. Long-press a chip to
  see who reacted.
- Badge: count of reactions by others on your items since you last opened the feed; those items
  are highlighted the next time you open it.
- Stored in D1 `reactions` (migration `0011_reactions.sql`, applied by hand in the D1 console).
  `/data` returns `reactions` + `reactionsEnabled`; `POST /react { itemId, owners, user, emoji, on }`.
  Writes go through the offline mutation queue. Until the migration runs the feed still works,
  reaction UI is hidden.

## Item ids (stable, used as reaction keys)
`s:<firstSessionId>` burst/row · `pr:<sessionId>` · `ck:<sessionId>` · `ms:<user>:<exercise>:<value>` ·
`st:<user>:<days>` · `tr:<user>:<card>:<tier>` · `d1:<group>:<YYYY-MM-DD>` · `w1:<group>:<YYYY-MM-DD>` ·
`hg:<gameId>` · `tg:<gameId>` · `cw:<challengeId>` · `cj:<challengeId>:<user>`
