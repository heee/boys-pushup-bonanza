# Roadtrip map — plan

Status: **shipped** (2026-10-29)

A filled map card on the Roadtrip screen, styled like the Board chart card:
countries heat-shaded by reps, tap a country to drill into its cities.

## Decisions (from Q&A)

| # | Topic | Decision |
|---|---|---|
| 1 | Placement | Map card directly under the Day/Week/… tabs; ranked list stays below (Board layout). |
| 2 | Data scope | Follows the selected period tab — map and list always agree. |
| 3 | Shading | One accent (app orange), intensity by reps; inactive countries a muted outline. |
| 4 | Drill-down | Map always starts on countries. Tap a country → zoom to it, city dots appear, list filters to that country's cities (tier → City). Back control returns to the world. The tier picker keeps working on the list. |
| 5 | Default view | Fit to the countries with activity in the period; whole world only when activity spans several continents. A "World" button always zooms fully out. |
| 6 | Gestures | Tap only — no pinch/drag (avoids fighting page scroll and the tab swipe). |
| 7 | Counts | Rep-count pills on active countries (world view) and city dots (country view); pills that would overlap are hidden; the list below always has every number. |

## How it works

- **Rendering:** inline SVG, no map tiles or third-party map service.
  `d3-geo` (projection + paths) and `topojson-client` (decode), plus
  `world-atlas` countries-110m (~100KB) — all **vendored into the repo**
  (`vendor/`) and precached by the service worker, so it works offline and
  needs no new CDN.
- **Country match:** sessions store ISO-2 codes (`US`); world-atlas uses
  ISO-3166 numeric ids (`840`). Ship a small ISO-2 → numeric lookup table.
- **City dots:** reuse the existing `resolveCityCoords` (Worker
  `/geocode-city` + local cache, already used by the group recap). Houston
  gets a hard-coded coordinate like the recap. New cities geocode once and
  are cached; a city still resolving just appears on the next render.
- **Neighborhoods:** no coordinates, so they stay list-only.
- **Zoom:** animated `fitExtent` transition between world/fit view and a
  country's bounds; dots sized by reps (sqrt scale), labelled with pills.
- **Pure logic in a testable module** (`roadtrip-map.js`): per-country and
  per-city aggregates for a period, shading scale, fit-to-activity bounds
  choice, label collision culling. Unit tests for each.
- **Theming:** colors from existing CSS tokens; works in light and dark.

## Build steps

1. Vendor the libraries + atlas + ISO table; SW precache; aggregate/scale
   module + tests.
2. Map card (world view): shaded countries, count pills, fit-to-activity,
   World button, follows the period tabs.
3. Country drill-down: zoom, city dots + pills, list filter, back control,
   tap dot → existing city detail.
4. Verify on phone width against this spec (element by element), light +
   dark, empty period, single-country data, offline.

## Out of scope

Pinch/drag, neighborhood dots, per-user territory coloring, street-level maps.
