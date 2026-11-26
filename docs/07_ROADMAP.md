# 07 — Development roadmap and milestone gates

Work in vertical slices; do not start all features simultaneously. Phase 0 + 1 is initial Codex task. Stop at each owner review boundary with working local build, actual verification, updated `PLAN.md` and Turkish summary.

## Phase 0 — Foundation

- Inspect repo; scaffold React/TS/Vite, npm lockfile, scripts, gitignore, basic CI checks (not deployment), module layout, tests.
- Design tokens, shell, navigation, TR/EN, theme, accessibility primitives, empty/error states. Build welcome/import screen; demo clearly separated. Strict map privacy policy and no network dependencies on startup beyond app assets.
- Establish synthetic fixtures, sample generator and provisional documentation. No real data in repo.

Gate: clean build/typecheck/lint, shell responsive, demo clearly marked, no real data access, initial tests run. No placeholder statistics presented as genuine.

## Phase 1 — Data engine

- Format detection, current Android/iOS representative adapters and legacy fixture adapters; capability flags; safe diagnostics and partial import rules.
- Worker pipeline, progress/cancel, local persistence opt-in, staging, dedupe, transactions, deletion. Implement canonical models, timezone and coordinate handling.
- Implement reliable core metrics with tests and simple real normalized summary/data quality display. Demo uses same engine. No final claim of owner's format compatibility without local verification.

Gate: IMP/TIME/GEO/core MET/PRIV checks applicable; real import flow usable using synthetic files, cancel/replace safe, user can test own export locally. Stop for owner review.

## Phase 2 — Core experience (MVP)

- Full Overview (actual metrics/charts), Explore local map + optional online basemap, linked daily Timeline, Calendar, shared date filtering and drilldowns, quality indicators, Settings.
- Map performance and layer controls; handling missing data and map fallback. Mobile layout and keyboard usability.

Gate: filtered totals consistent, calendar-to-day-to-map works, offline/local mode and online consent verified, no dead controls, visual review. MVP can be previewed locally; not published automatically.

## Phase 3 — Advanced exploration

- Analytics and period comparisons, transport/time/weekday-hour charts; grouped places with local labels and edits; manual trips and conservative suggestions. Only city/country analytics with reliable local metadata/boundaries.
- Data revision invalidation, edit/undo, conflict diagnostics and tests.

Gate: MET checks, no fake geocoding/modes or overlap double count, edit and reimport behavior verified.

## Phase 4 — Rewind & playback

- Route playback (timestamped evidence only; gaps visible, no invented paths), speed, scrub, pause; reduced motion.
- Monthly/yearly story mode, safe share PNG, preview and redaction, partial year labels. Locally generated original design, no external screenshot service.

Gate: PRIV-05, export privacy review, replay controls usable, no fake location detail.

## Phase 5 — Release hardening

- PWA caching app assets only, offline launch after cache availability, storage and update behavior; benchmark and optimize; final accessibility and localization sweep.
- README, CONTRIBUTING, SECURITY, privacy explanation, license/third-party notices, screenshots with demo, GitHub Pages base path and workflow (manual release trigger initially), dependency checks and tests.

Gate: complete release checklist in testing spec, owner approves name/license and publishing separately. Report remaining limitations honestly. No automatic deployment.

## Later backlog (not part of first release)

ZIP, GPX/KML/GeoJSON imports, CSV/PDF export, video generation, offline regional tiles, advanced offline geographic boundaries, multiple device reconciliation, optional photo linking. Reassess privacy and licensing for each. No sync/backend by default.
