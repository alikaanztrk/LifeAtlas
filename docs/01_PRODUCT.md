# 01 — Product requirements (PRD)

## Vision

LifeAtlas — Your life, mapped. A local-first personal geography archive for people with years of Google Maps Timeline history. Rediscover where time was spent, compare periods, explore journeys and create privacy-aware recaps. Primary audience: Google Maps Timeline users who want desktop access and analysis without uploading intimate location history.

## Product scope

| Screen | Core deliverable | Phase |
|---|---|---|
| Welcome / Import | Drag/drop or file picker, format preview, progress, safe diagnostics, demo | 0–1 |
| Overview | Filtered distance, coverage, visits, movement time, monthly chart, calendar overview, top places | 1–2 |
| Explore | Map, heatmap, route and visit layers, selection, date/transport filters | 2 |
| Timeline | Day navigation, ordered visits/activities, linked map, gaps | 2 |
| Calendar | Month/year views, metric selector, selected day details | 2 |
| Analytics | Period comparison, time and distance by mode, daily/hourly patterns, coverage | 3 |
| Places | Place grouping, naming, tags, home/work opt-in, visit list | 3 |
| Trips | Suggested multi-day trips, edit/merge/split/name, trip detail | 3 |
| Rewind | Animated monthly/yearly story, safe share cards | 4 |
| Settings / Data | Dataset management, locale, theme, units, time policy, privacy, export/delete | 1–5 |

## Core user journey

1. Open app without account or sign-in. See privacy explanation and choices: Import Timeline or Explore demo.
2. Choose one or more JSON files locally. Show detected format, size, progress and cancellation. Invalid/partial input must not corrupt existing data.
3. Show result summary: date range, imported/duplicate/skipped counts, warnings, available data capabilities. Let user choose replace or merge when a dataset already exists (explicit confirmation for replace).
4. Browse actual statistics; select date range once and share across overview, map, calendar, analytics, places and trips where relevant. Details may refine date or mode without silently resetting the global filter.
5. Inspect day, visit or route; click related chart/map/calendar items to navigate. Save edits separately from original records.
6. Return later if persistence was enabled; delete individual datasets or all local data. Use safe exports on demand.

## Metric requirements

- Distance: recorded activity distance first; defensible path estimates second; straight line only explicitly labeled, not blended invisibly. Unknown distances shown as unknown; avoid double-counting paths and activities.
- Visits: count normalized visit events separately from distinct grouped places. Duration calculated on selected interval only.
- Coverage: days with usable evidence vs days in selected interval; no data does not imply stayed at home, zero motion, or zero distance.
- Transport: original labels mapped to normalized categories; unknown remains unknown. Show whether chart percentages are by distance or time and denominator coverage.
- Time: known visit/activity intervals, avoid double-counted overlaps; uncaptured time remains unknown. Home/work labels are user-provided, not assumed.
- City/country statistics: only if reliable local place metadata or approved offline geographic dataset exists. Otherwise unavailable; no inferred names from coordinate alone.
- Comparison: equal-length date windows by default or clearly label unequal durations; no percentage change when baseline is zero/unknown.

## Priorities

MVP: current Android/iOS-style formats where verified; legacy support with fixtures; safe import and persistence, common date filter, overview, map, timeline, calendar, data quality, TR/EN.

V1: advanced comparisons, place grouping, editable trips, recaps, playback, PNG export, PWA and public release preparation. Keep unimplemented navigation hidden or clearly marked.

Deferred: multi-device sync, remote accounts, cloud backup, arbitrary ZIP import, GPX/KML/GeoJSON import, video export, photo integrations and offline global map packages. No backend or Google account integration for initial release. Native app/Chrome extension are not required.

## Product success criteria

An unfamiliar user can load a supported export, understand its coverage and explore an individual day without documentation. An unsupported export yields actionable local diagnostics. Real data never leaves the browser through application logic. Large history imports keep navigation responsive. Demo data can never be mistaken for the user's real records. Publish only after owner review.
