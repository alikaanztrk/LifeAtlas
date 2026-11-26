# 02 — UI/UX and visual system

## Direction

Original desktop-first editorial cartography meets professional analytics. Calm, precise, spacious; maps and data take precedence over decoration. No generic dashboard-template look, excessive gradients, glass blur, oversized headers or decorative charts. Build visual identity around a minimal atlas/contour motif, not Google Maps branding.

## Design tokens (proposed starting values)

| Token | Light | Dark |
|---|---|---|
| Background | #F6F8FB | #0B1220 |
| Surface | #FFFFFF | #111B2B |
| Raised surface | #EEF2F7 | #19263A |
| Primary text | #142033 | #E8EEF7 |
| Secondary text | #526176 | #A5B4C8 |
| Border | #DCE3EC | #2A3A50 |
| Accent | #087F76 | #5EEAD4 |
| Data blue | #3569BF | #79A6FF |
| Warning | #9A5B08 | #F3BE65 |
| Error | #B42318 | #FCA5A5 |

Use semantic CSS variables, verify contrast, allow focus rings. Use system font stack or bundled properly licensed font, no remote fonts. Tabular numerals for metrics. Base 14–16px, titles 24–32px, hero metrics 28–40px. Spacing scale 4/8/12/16/24/32/48, card radius 12–16, control radius 8–10. Avoid relying solely on color for data labels. Icons: consistent Lucide style, no emoji-based interface.

## Application shell

Desktop sidebar around 224–248px with logo, Overview, Explore, Timeline, Calendar, Analytics, Places, Trips, Rewind; Settings/Data at bottom. Collapsible sidebar. Top bar contains dataset badge, global date selector (all time/year/month/custom), privacy state, theme and language controls. Page scroll independent of shell. Mobile: compact header and navigation drawer; map/detail panel becomes stacked. Target 1440×900, 1280×800, 390×844 and keyboard-only use.

## Screen specifications

### Welcome / Import
- Single clear primary CTA. Drop zone with native file picker; show local-only processing and optional online map disclosure in plain language. Demo is a separate secondary CTA.
- Step states: selected → inspect → import → results. Progress bar only when measurable; otherwise indeterminate. Cancel, retry and safely discard partial staging. No giant raw JSON preview or personal diagnostic log.
- Import summary includes format, counts, date coverage, missing fields and next action. Allow explicit merge/replace; no surprise replacement.

### Overview
- Header with period label, coverage indicator, period comparison (when available). Four core KPI cards: distance, unique places, known movement duration, days with data. Secondary visit count and recorded time. Cards clickable when they lead to a real detail view.
- Primary row: monthly/daily movement chart (approx. 60%) and transport chart (40%). Next: calendar heatmap, top places, compact map preview. No automatic map tile request in strict mode.
- Show units, denominator, estimate badges, tooltip semantics and an accessible textual alternative. No zero when missing. Chart tooltips and totals use same selector.

### Explore
- Map-dominant workspace with left filter panel or toolbar, optional right inspector. Layer toggles for visits, recorded routes, heatmap; transport colors and legend; fit to selection, zoom, reset, cluster counts.
- Inspect a visit/route via selection with date/time, distance provenance and link to Timeline. Gaps are not connected as if recorded. Large point sets use clustering/aggregation and simplification for display only.
- In strict mode: local vector overlay/grid with no online basemap, clear label. Online mode opt-in shows attribution, loading/error and fallback. Do not fetch tiles before consent or when disabled. Playback bar in Phase 4 with play/pause, scrub, speed, current time and reduced motion.

### Timeline and Calendar
- Timeline: sticky date controls (prev/next, date picker), summary, ordered vertical list of visit/activity/unknown gap rows; map side panel on desktop. Row selection syncs map. Unknown and overlap warning states; day crossing split visually.
- Calendar: month grid and annual heatmap; metric toggle (distance/visits/known activity time). Distinguish no data, zero and outside range using legend/pattern. Selecting day opens side detail and timeline action. Locale-aware week start and date formatting.

### Analytics, Places, Trips
- Analytics: period comparison, distance and time by transport, weekday/hour patterns, top places and coverage; every graph has labels and accessible table/summary. Comparison labels clarify exact windows.
- Places: searchable sortable table with name, visits, known duration, first/last seen, category; detail shows chronological visits and local map. User can rename, label, merge/split with undo or confirm. No silent geocoding.
- Trips: suggested vs confirmed status, list/detail, manual create and edit. Show duration, recorded distance, coverage and local map. Avoid deriving private home automatically without explicit choice.

### Rewind
- Editorial full-screen story with chapter progress and previous/next, pause, skip and keyboard controls. Chapters: coverage, distance, movement modes, places, memorable day, longest recorded journey, comparison (when data supports it). No fictional claims.
- Static share preview (1080×1920 portrait or square) with safe defaults: no exact coordinates, timestamps, place names or home/work. User previews before explicit export. Avoid external resources in safe share generation. Show partial year clearly.

### Settings & data quality
- Dataset list, counts, last import, merge/replace/delete, reset demo, storage status, local data clear. Explicit privacy choices, online map disclosure, units, locale/theme and time policy.
- Errors in plain Turkish and English; diagnostics structural only, no coordinate/name/time dumps. Show unknown field counts and known limitations. Use confirmations for destructive actions.

## Quality bar

Implement real empty/loading/partial/error states, useful tooltips, no dead buttons, no horizontal overflow at target widths, usable focus order and contrast. Respect `prefers-reduced-motion`; map and chart controls must be operable by keyboard where feasible with alternative list. Test screenshots only with synthetic fixture. Owner reviews visual design before later phases.
