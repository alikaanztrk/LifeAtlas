# 03 — Technical architecture

## Platform

Static SPA for modern Chrome, TypeScript strict, React, Vite, npm lockfile. No backend, accounts, remote database or secrets. Use hash-based routing or another explicitly tested static-host approach for GitHub Pages subpaths. Dependencies: Tailwind/shadcn-style components, MapLibre GL JS, ECharts (tree-shaken), Dexie, i18next, focused Turf utilities, optional Motion. Evaluate version compatibility and license before installing; avoid unnecessary packages. Bundle assets, fonts, styles and translations locally. Vite PWA in later phase after privacy review.

## Proposed layout

```text
AGENTS.md
CODEX_PROMPT.md
PLAN.md
docs/
public/                  # only non-sensitive static assets
src/
  app/                   # router, providers, shell, global filter
  components/            # design primitives, states, accessible charts
  features/
    import/ overview/ explore/ timeline/ calendar/
    analytics/ places/ trips/ rewind/ settings/
  domain/
    models/ adapters/ analytics/ geo/ time/ quality/
  storage/               # Dexie schema, transactions, repositories
  workers/               # import + analytics protocol, jobs
  maps/                  # local/online style, layers, network policy
  locales/               # en and tr
  styles/                # CSS tokens
  fixtures/              # synthetic fixtures only, no personal files
  test/
e2e/
.github/workflows/
```

Feature UI depends on domain interfaces and repository APIs. Domain functions must not depend on React, Dexie or network. Adapters translate source format into domain models. Persist canonical records, not raw files by default. Analytics and display geometry are derived from canonical data. Never mutate source objects; edits overlay source data.

## Worker pipeline

File selection → size check → worker parsing and format detection → structural validation → canonical normalization → duplicate/overlap detection → staged batches → atomic visibility switch → dataset quality summary → incremental analytics cache → UI. Pass File/Blob to worker rather than building giant strings in main thread. Use typed messages: `start`, `progress`, `batch`, `result`, `cancel`, `error`; include job ID and phase, safe counts only. Throttle progress. Worker-owned parsing/analytics; repository writes may be worker-owned or main-thread batches, but avoid transferring whole history repeatedly. Prefer bounded batches and IndexedDB staging. Cancel/failed import removes staging; previous dataset remains readable. Guard stale worker replies and close workers on cancel.

JSON.parse in worker is still memory-bound. Start with verified size limits and measured memory; for large files use a vetted streaming parser or explicit rejection with instructions, not silent truncation. Do not claim unlimited file support. Keep quota errors recoverable. Initial performance targets in testing spec are goals, not established benchmarks.

## Storage

Dexie schema (logical, refine after fixtures): `datasets`, `visits`, `activities`, `paths` (chunked geometry), `rawPoints` (only if supported and useful), `placeGroups`, `edits`, `trips`, `aggregates`, `settings`, `stagingJobs`. Use dataset ID and time range indexes; stable record IDs and schema version. Avoid indexing giant geometry or storing one giant blob. Support versioned migrations and rollback/recovery. Aggregates keyed by dataset revision, date range, timezone policy, filter, calculation version; invalidate after import/edit/delete. Maintain no persistent source file unless user explicitly chooses it as a separate backup feature (deferred).

Default session-only data, or clear explicit persistence opt-in at import. For session-only mode use in-memory repository with same API; for oversized files offer explicit persistent staging option or safe rejection rather than silent persistence. Deletion removes data, caches, staging, edits, trips and derived data for affected dataset; all-data clear additionally removes app IndexedDB and private app caches/settings. No private content in localStorage, service worker cache, URLs, console or crash reports. Consider persistent-storage request only on opt-in; storage eviction remains possible.

## State and routing

Global state: current dataset(s), date window (half-open), timezone policy, locale, units, theme, map consent. Keep URL limited to non-sensitive route identifiers, no private date/coordinates/place labels or data IDs by default. Local component state for transient UI. Derive selectors from canonical state. Data query cancellation on filter change and stable cache keys. Worker analytics for heavy scans; debounced or cancellable date selection.

## Map architecture

MapLibre GL JS with bundled local style (background and local user overlays; optional licensed simplified world outline). No glyph/sprite/tiles remote URL in strict mode; no map SDK automatic telemetry. Online basemap optional after informed opt-in; OpenFreeMap as candidate, verify terms and attribution. Recreate map or abort requests when turning off online mode. Avoid CDN resources. GeoJSON layers use lon/lat, preserve antimeridian handling. Simplify geometry only for display, not distance math; use clustering/heatmap aggregation and avoid millions of DOM markers. WebGL failure fallback: list and local simplified view when feasible.

## Scripts / release structure

`npm ci`, `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run preview`, `npm run test:e2e`. Add scripts to actual package. CI verifies checks using only synthetic fixtures, artifact scan, and static base path. Release workflow may be prepared but no automatic public deployment until owner approves; avoid deployment triggers on normal push initially. README includes supported formats, Chrome requirements, import, privacy, limitations, license, screenshots and dev commands. No user data in repo, test artifacts or dist.
