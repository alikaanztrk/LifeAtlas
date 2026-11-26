# 06 — Testing, performance and release acceptance

## Test strategy

Vitest unit tests for pure adapters, geometry, temporal calculations and analytics; integration tests for worker and repository (fake IndexedDB where appropriate plus real Chrome checks); Playwright for user workflows and network interception. Synthetic fixtures only; no private file logs/screenshots. Tests must assert expected numeric values, not just snapshots. Include deliberate empty, malformed, unknown and partial cases.

| ID | Acceptance check |
|---|---|
| IMP-01 | Detect each supported fixture format and report normalized event counts; unknown root rejected with safe error. |
| IMP-02 | Malformed JSON, invalid coordinates, missing timestamp, unknown mode and mixed valid/invalid records handled without crash or silent loss. |
| IMP-03 | Reimport same fixture → no duplicate canonical events; near duplicates/conflicts flagged, source provenance retained. |
| IMP-04 | Cancellation, quota error and failed replace leave previous dataset intact; staging removed. |
| IMP-05 | Worker progress responds; stale replies ignored; no giant main-thread parse. |
| TIME-01 | Timezone offsets, DST spring/fall, leap day, overnight event, half-open window boundary and partial intervals tested. |
| GEO-01 | Known coordinate pairs, E7, invalid range, lon/lat order, antimeridian, repeated points and gap handling tested. |
| MET-01 | Recorded distance precedence, path fallback, unknown distance, overlap and split-window conservation verified with exact fixtures/tolerance. |
| MET-02 | Visit/movement durations use union and clipped windows; no double counting; missing day distinct from known zero. |
| MET-03 | Shared date filter drives all views; totals match drilldowns; no baseline-zero percentage. |
| MET-04 | Raw-only dataset does not claim semantic visits/modes; place/city metrics unavailable when unsupported. |
| UX-01 | Import, demo, overview, calendar-to-day and map selection flows work; keyboard and empty/error states. |
| UX-02 | TR/EN, theme, 1440/1280/390 viewport, no clipping/overflow; reduced motion and contrast checks. |
| PRIV-01 | Strict mode network intercept blocks/asserts no third-party requests through import, map, analytics, recap. No raw data in requests/URLs/logs. |
| PRIV-02 | Online mode requires consent; allowlisted tile resources only; revocation returns local map and aborts/ceases requests. |
| PRIV-03 | Session mode leaves no personal records after reload; opt-in persistent mode reload works; deleting dataset/all removes associated data and caches. |
| PRIV-04 | Import malicious strings/keys renders plain text; no script execution, unsafe URLs or prototype pollution. |
| PRIV-05 | Share preview default excludes private names/coordinates/traces/timestamps; output generation stays local. |
| DEP-01 | Build and serve at `/LifeAtlas/` (or actual repo base), direct navigation and refresh work; PWA update/offline smoke when implemented. |
| DEP-02 | No private files in tracked files, build artifacts or test outputs; notices and map attribution present. |

## Synthetic fixture plan

Android-style segments; iOS root array; legacy semantic; legacy raw; unknown root; malformed/truncated input; mixed invalid fields; timezone/DST/overnight; duplicate reimports; overlaps/ambiguous path; raw-only; deliberately sparse history; synthetic long-history generator. Use fictitious labels and artificial trajectories; do not derive fixtures from user's history. Test schema variants against representative public descriptions and note verification gaps.

## Performance targets (not measured results)

Benchmark on documented Chrome version/hardware, including a mid-range machine if available. Generate synthetic exports ~10MB, 50MB, 100MB and larger stress case only if memory allows; record file size, event count, import duration, peak memory estimate, long tasks, first render and filter latency. Target typical 50MB import without UI freeze, visible progress/cancel response within ~250ms when event loop permits, date filter response under ~500ms for cached common ranges, no repeated map full-dataset rebuild. Main-thread long tasks should be minimized, with any recurring >50ms investigated. Do not market these as guaranteed or pass without measurements. If size exceeds tested safe limits, reject clearly before destructive changes; document limit and browser variation. Map display budget via clustering/geometry simplification; original points retained for math.

## Verification commands

Expected after scaffold: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e`. Add scripts in package.json; run actual scripts, record exact outputs and exit status. If browser or environment unavailable, say so, do not skip silently. CI uses synthetic data only; do not publish artifacts that could contain real import data.

## Release gates

All in-scope tests pass, no known critical privacy/data correctness defects, documented unsupported cases, readable UI with synthetic visual review, license/name check, dependency audit and attribution, README, safe sample data, install/offline instructions, build path verified. Owner separately approves public GitHub publication. Real-export smoke test should run locally by owner; report only format and aggregate safe counts as desired, not actual private content. Unsupported real schema blocks claims of full support, not synthetic development.
