# Trophies (Trophy Case) + Games-to-pill plan

Status: **draft, awaiting Henning's sign-off** (2026-11-20).

## Settled decisions
- **Name:** bottom tab label "Trophies"; screen title "Trophy Case".
- **Scope:** lifetime-volume cards per exercise **plus** feat cards (best set, streak,
  mode-specific feats, rivals wins).
- **Tiers:** metal ladder. Locked = greyscale → **Bronze → Silver → Gold → Platinum → Diamond**.
- **Social:** your own case by default; a person picker (same as the Board's) shows anyone
  else's. A tier unlocked by a session gets a celebration on that session's summary. No
  group-feed posts.
- **Games leaves the bottom nav.** Trophies takes its slot (2nd: Home · Trophies ·
  Challenges · Roadtrip · Board). A games icon shows in the header pill (left of the
  streak) **only while you have an open or active game**; a dot on it when it's your
  turn or there's an invite. New Horse / Tug of war games start from Choose your mode →
  Rivals (already there).

## Card catalog (draft thresholds — to calibrate against live data before build)

### Volume (lifetime totals)
| Card | Bronze | Silver | Gold | Platinum | Diamond |
|---|---|---|---|---|---|
| Pushups (reps) | 100 | 1,000 | 5,000 | 25,000 | 100,000 |
| Squats (reps) | 100 | 1,000 | 5,000 | 25,000 | 100,000 |
| Situps (reps) | 100 | 1,000 | 5,000 | 25,000 | 100,000 |
| Pull-ups (reps) | 50 | 250 | 1,000 | 5,000 | 20,000 |
| Plank (time) | 10 min | 1 h | 5 h | 20 h | 50 h |
| Dead hang (time) | 5 min | 30 min | 2 h | 10 h | 25 h |
| Grip (time) | 5 min | 30 min | 2 h | 10 h | 25 h |
| Kettlebell (lbs moved) | 5k | 50k | 250k | 1M | 5M |
| Circuits (Holland + Chain of Pain rounds) | 5 | 25 | 100 | 250 | 500 |

### Feats (all-around)
| Card | Bronze | Silver | Gold | Platinum | Diamond |
|---|---|---|---|---|---|
| Best pushup set (one session) | 25 | 50 | 75 | 100 | 150 |
| Streak (days) | 7 | 30 | 90 | 180 | 365 |
| Sessions logged | 10 | 100 | 500 | 1,000 | 2,500 |
| Explorer (distinct modes played) | 3 | 6 | 10 | 15 | every mode |
| Globetrotter (cities logged in) | 2 | 5 | 10 | 25 | 50 |

### Mode feats
| Card | Bronze | Silver | Gold | Platinum | Diamond |
|---|---|---|---|---|---|
| Ladder (highest rung) | 5 | 10 | 15 | 20 | 25 |
| Pyramid (apex completed, by size) | S | M | L | XL | XXL |
| Poker (hands collected; Diamond = Royal Flush) | 3 | 5 | 7 | 9 | Royal Flush |
| Sharpshooter (targets in one run) | 5 | 10 | 20 | 30 | 50 |
| Pulse (sessions held in band) | 1 | 10 | 25 | 50 | 100 |
| Cock Mode (wins) | 1 | 5 | 15 | 30 | 60 |

### Rivals
| Card | Bronze | Silver | Gold | Platinum | Diamond |
|---|---|---|---|---|---|
| Horse (games won) | 1 | 5 | 15 | 30 | 60 |
| Tug of war (games won) | 1 | 5 | 15 | 30 | 60 |
| Chase (leaders passed) | 1 | 5 | 15 | 30 | 60 |
| Challenges (won) | 1 | 3 | 10 | 25 | 50 |

## Screen design
- Header: "Trophy Case" + person picker; summary line ("14 of 125 tiers").
- Sections: Volume · Feats · Modes · Rivals. 2-column grid of cards.
- Card: mode stroke icon, title, current tier name, slim progress bar + "3,420 / 5,000"
  toward the next tier. Locked cards greyscale. Each metal has its own gradient + edge.
  Diamond gets the moving-sheen treatment used on reached goals.
- Tap a card → detail sheet: all five tiers with threshold, ✓ + unlock date for earned ones.

## Build notes
- Pure client-side: computed from sessions already synced (no Worker/D1 change).
  Unlock dates come from replaying sessions in time order.
- Logic in a new `screens/trophies.js` (pure, unit-tested); rendering in app.js.
- Summary celebration: diff the user's tiers before vs. after the saved session.
- Remove `btn-nav-games`; games icon + existing attention dot move into `.header-actions`.
- Changelog entry: "Added Trophies".

## Open points
- Recent-games history is only reachable while the games icon is showing.
- Thresholds above are first guesses; check them against real lifetime totals so most
  boys start with a few Bronzes, not zero or everything.
