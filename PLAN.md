# LifeAtlas — Living implementation plan

Status: Phases 0–5 completed locally on 26 November 2026. The owner approved the LifeAtlas name, the MIT license and first publication to [alikaanztrk/LifeAtlas](https://github.com/alikaanztrk/LifeAtlas).

## Current target

Phase 5 under [the roadmap](docs/07_ROADMAP.md) passed its local gate. The production subpath, install and offline/update behavior, synthetic performance and accessibility checks, release documents, and manual Pages workflow are ready for owner review.

## Progress

- [x] P0: inspect repo, scaffold, lock dependencies, add scripts and CI checks
- [x] P0: app shell, tokens, bilingual navigation, demo isolation, strict mode default
- [x] P1: synthetic fixtures and format detection
- [x] P1: worker, normalization, import progress/cancel, safe diagnostics
- [x] P1: transactional IndexedDB, deduplication, deletion and persistence tests
- [x] P1: computed archive summary and data quality panel using the same engine for the demo
- [x] P1: automated verification and owner-authorized local import smoke test
- [x] Owner requested Phase 2 continuation
- [x] P2: archive-revision worker queries and one shared date range
- [x] P2: linked calendar, day timeline, map selection and overview charts
- [x] P2: local map layers, accessible fallback and opt-in online basemap
- [x] P2: Chrome drilldown, privacy, responsive and large-range verification
- [x] P3: versioned overlays, IndexedDB migration and merge/replace lifecycle
- [x] P3: deterministic local place grouping, edits, and conservative trip suggestions
- [x] P3: manual trips, equal-day period comparisons, and known-movement breakdowns
- [x] P3: Chrome drilldowns, overlap, reimport, undo, and privacy verification
- [x] P4: evidence-only replay with gaps, seek, and keyboard controls
- [x] P4: worker-backed monthly and annual Rewind with partial coverage
- [x] P4: aggregate-only PNG preview, redaction, and explicitly initiated download
- [x] P4: Chrome verification of replay, accessibility, and export privacy
- [x] P5: immutable app-asset cache, installable manifest, offline and update lifecycle
- [x] P5: startup and import performance, Chrome accessibility and localization sweep
- [x] P5: release documentation, synthetic screenshots, artifact checks and manual Pages workflow

## Decisions and assumptions

- Static Vite app with hash routing at `/LifeAtlas/`. The release workflow verifies the configured Pages path.
- Session memory is default. There is one personal archive per retention choice, plus the synthetic demo. The Worker keeps previews until confirmation. The persistent archive publishes canonical events and metadata in one revision-checked IndexedDB transaction with bounded batches and rollback. Web Locks coordinate database operations across Chrome tabs. BroadcastChannel signals saved-archive changes using an empty payload.
- Exact fingerprints use normalized identity and local SHA-256. Reimports retain up to 16 distinct provenance references per event and report excess. Temporal or spatial near matches remain separate with quality warnings. Conflicting activity distances are excluded, and duration totals use interval unions.
- Timed path edges qualify with a maximum 30-minute gap and 350 m/s speed. Known activity links take precedence. Spatial fallback requires one candidate, both endpoints within 500 m, and path bounds inside the activity and within two minutes of its edges. Unassigned paths contribute only where their observed distance intervals are separate from activity and other path intervals.
- One displayed IANA zone per archive. Time windows are half-open. Missing-offset ISO input is reported. The local iOS export exposed transport spelling with different case and separators, now covered by synthetic regression data. Unknown transport remains a separate classification.
- JSON input is bounded by 50 MiB per file and 64 MiB per selection, plus record and geometry limits. The local development server denies direct HTTP access to JSON inputs. Production packs local assets, app and dependency license notices, and a same-origin CSP.
- React 19.3.1, TypeScript 5.9.3 and Vite 7.3.8 underpin this milestone. [Third-party notices](THIRD_PARTY_NOTICES.md) record versioned dependencies and licenses. The owner approved the project's [MIT license](LICENSE) for first publication.

### Phase 2 decisions

- Overview, Explore, Timeline and Calendar receive the same archive-revision-bound date range. The date window is half-open in the chosen IANA time zone. An explicit day drilldown leaves the date range in place. The URL carries only the view name.
- One archive Worker builds an interval index and compiles distance associations and conflicts once. It keeps six results for the active revision. Overlapping activities remain excluded from distance when their conflict extends outside the selected window. The known-movement chart totals and its accessible values use the same calculation. The transport chart puts overlapping movement time in Unknown.
- MapLibre 6.19.0 and Apache ECharts 6.1.0 load with their respective views. A sampled, clustered map is used for display. Metric calculations still use all canonical records. Broken traces are split, untimed geometry is omitted from the trace display, and isolated timestamped points can be drawn individually.
- The local map makes no external requests. Explore can request OpenFreeMap vector tiles after explicit tab-scoped consent. The policy allows only the public planet manifest and validated z/x/y tiles, with no credentials, referrer, persistent cache or redirects. Tile errors restore the local overlay. A keyboard-accessible record list is available when WebGL fails. The live provider and attribution were checked with the synthetic demo. [OpenFreeMap Quick Start](https://openfreemap.org/quick_start/)
- Units and an optional display time zone are browser preferences. Online permission, dates, coordinates, camera and selected record IDs are in-memory state.

### Phase 3 decisions

- Place groups use stable source IDs first. Visits without IDs use a deterministic 100 m anchor radius in a three-dimensional spatial grid. Separate known source IDs remain separate unless the user explicitly merges them. Place durations union evidence inside each group and date window.
- Labels, tags, categories, group membership edits and trips live in a versioned edit history. IndexedDB schema 2 adds an archive-scoped store. A write checks the archive revision and edit revision in the same transaction. Merge keeps an archive's history. Replacement and deletion remove it. Undo removes the latest operation per archive. The maximum history is 1,024 operations.
- Home and Work are explicit user labels. Suggestions require one Home anchor and a recorded away visit spanning midnight with at least two observed hours on both sides. The threshold uses straight-line distance. Conflicting visit coordinates and ambiguous witness density suppress suggestions. Suggestions become trips only through Save. A saved trip retains its original IANA zone.
- Analytics compares prior equal-length calendar days by default and labels custom unequal periods. Zero or absent baselines produce no percentage. Transport separates known movement shares and known distance shares, including recorded and estimated components. The hourly histogram accounts for offset transitions and unions overlaps. The place ranking uses the active range and current local grouping. City/country metrics require reliable offline geographic data.

### Phase 4 decisions

- Playback reuses canonical timestamps and the existing validated-path edges. A marker stays at the last observed coordinate only between accepted adjacent samples. Conflicting positions at one instant and other unvalidated intervals omit the marker. Raw positions can be visited individually. Playback stays local and accepts up to 32,000 observations per view.
- Rewind uses the chosen civil month or year intersected with the active filter and elapsed time. Partial periods are labelled. Unsupported chapters are omitted. The day highlight is based on known movement and the longest activity highlight requires a complete recorded measurement. A comparison uses immediately preceding equal-length calendar days and a nonzero baseline.
- The PNG renderer receives allowlisted aggregate measurements and an optional coarse month/year label. Each field can be hidden before download. The preview is the real canvas being exported. There is no detailed export in this milestone. Portrait and square layouts use local system fonts and drawing primitives. Demo images retain their synthetic label.

### Phase 5 decisions

- The production build generates a scoped service worker and a SHA-256 inventory of the exact shell, scripts, lazy views, workers, styles, icons, manifest and notices. It prepares the cache after initial page load and verifies every static response. Partial installations drop their candidate cache. The worker serves only approved static URLs and the two exact shell navigation URLs with any hash route. It makes no runtime cache writes and never caches imports, tiles, query-string requests or share images. [Fetch Standard](https://fetch.spec.whatwg.org/#concept-request-integrity-metadata)
- A complete update waits for all controlled tabs and windows to close. The next instance uses the verified generation and removes older caches for that scope. Archive deletion keeps app assets so it still works offline. Chrome site data controls can remove both. [Service worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
- The welcome route checks the local database catalog under the existing Web Lock and loads Dexie only when an existing database is present or a storage operation needs it. Archive-specific styles load with the archive workspace. Chart, map and worker bundles remain separate.
- The Pages workflow is manually dispatched on the default branch. The publish input defaults to false. Publishing requires a separately authorized run, a matching project path, and a verified build. Actions used in the workflows are pinned to release commits. [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## Acceptance and verification

- Foundation: install from the lockfile, lint, type-check, test, and build for `/LifeAtlas/`. Verify keyboard, contrast, three viewport widths, both locales/themes, and no third-party traffic in Chrome.
- Import: exercise four representative formats, malformed and mixed input, bounded input, cancellation, exact duplicates and conflicts. Verify summaries against deterministic temporal and geospatial fixtures.
- Storage: verify default session expiry, opt-in reload, explicit merge/replace, rollback on quota/write failure, and dataset/all-data deletion. Record results here and stop for owner review before Phase 2.
- Commands: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e`, `npm run scan:artifacts`.
- Phase 2: date windows and all drilldowns must use the same distance and duration rules, including when overlaps extend outside the selection. Verify year/month/day and no-data cases, date/transport filter scope, and retention after reload.
- Phase 2: use bundled MapLibre/ECharts and zero remote map requests in strict mode. Validate the provider's narrow endpoint policy before enabling tiles. Consent and camera state stay in this tab. Test revocation and network failure, WebGL fallback, and keyboard-accessible record selection.
- Phase 3: source records stay immutable. Edits must follow the same archive on merge and survive opted-in reload. Verify migration, stale-write rejection, undo and replace/delete cleanup.
- Phase 3: place grouping honors source IDs and uses only local geometry. Suggestions require a user-marked home and observed overnight evidence. Verify missing/zero values, day-window comparison, time-zone boundaries and overlap reconciliation. Run all baseline commands and exercise the new views through Chrome with synthetic data.
- Phase 4: replay points require a source timestamp. Unvalidated intervals and conflicting points must remain gaps. Verify that play, pause, seek and next observation work while playback remains on the local map.
- Phase 4: compare chapter metrics with the shared date window, label partial periods, and omit unsupported highlights. Verify PNG dimensions, the exact painted content, redaction, and zero external traffic during preview and download.
- Phase 5: verify offline startup including uncached-by-browsing views, scoped cache keys, failed version install, updates waiting for open tabs, and browser storage and deletion. Compare production first-render bytes and benchmark synthetic 10/50/100 MiB cases in Chrome. Run all baseline commands, audit the dependencies, and validate the Pages artifact and workflow without publishing.

## Evidence log

| Date | Milestone | Commands actually run | Result / limitations |
|---|---|---|---|
| 26 Nov 2026 | Foundation | `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build` | Passed. Chrome loaded the development demo and the production `/LifeAtlas/` path. npm reported an esbuild install-script advisory and the Vite build reported two ignored client directives in Lucide. |
| 26 Nov 2026 | Data engine and storage | `npm run test` | 23 passed. Four format fixtures, partial/invalid data, offset and DST boundaries, distance precedence and allocation, overlap, deduplication, IndexedDB deletion, simulated quota rollback and active transaction cancellation. |
| 26 Nov 2026 | Chrome flows and accessibility | `npm run test:e2e` | 9 passed in installed Chrome 158.0.8127.37. Three viewport widths, TR/EN, dark/light, keyboard/axe checks, drop/picker, cancellation, session and persistent merge, replacement confirmation, cross-tab deletion and network interception. Synthetic screenshots reviewed at 1440×900 and 390×844. |
| 26 Nov 2026 | Private import smoke | Isolated production Chrome session | Owner's file recognized as iOS Timeline. Preview and session overview loaded. Reload cleared the session. Network observation recorded zero external requests and the archive created no IndexedDB database. This checks one real export variant. |
| 26 Nov 2026 | Artifact and dependency checks | `npm run scan:artifacts`, `npm audit --audit-level=high`, `git check-ignore -q -- Timeline.json` | Passed. npm audit reported zero vulnerabilities. The input is ignored by Git. Local development server returned 403 to a HEAD request to its path. CI workflow is prepared for future remote execution. |
| 26 Nov 2026 | Phase 2 build and engine | `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run scan:artifacts`, `npm audit --audit-level=high` | Passed. 29 unit and integration tests. The lockfile includes MapLibre and ECharts. npm audit reported zero vulnerabilities. Vite reports large lazy map and chart chunks and two ignored Lucide client directives. |
| 26 Nov 2026 | Phase 2 Chrome flows | `npm run test:e2e` | 15 passed in Chrome 158.0.8127.37. Shared filter, year and daily drilldown, direct canvas selection, keyboard list, offline zoom with loaded assets, consent, endpoint restrictions, request abort, WebGL fallback, and saved timezone and units. The development server and `/LifeAtlas/` production preview were exercised with the synthetic demo. |
| 26 Nov 2026 | Phase 2 map regression and visual inspection | `npm run test:e2e -- --grep 'single observed point'`, then full Chrome rerun | The initial test failed. MapLibre's lazy stylesheet set the map container to relative positioning and its height collapsed to zero. The app now keeps the canvas area positioned and sized, and the direct map selection test passes. Reviewed rendered synthetic overview, map, and Turkish dark mobile calendar. |
| 26 Nov 2026 | Phase 2 live provider and filter measurement | Isolated Chrome synthetic checks | Zero provider requests before consent. One manifest and a vector tile returned successfully after consent, with attribution visible. On the 50 MiB fixture, two first-time single-day selections took 144–180 ms and two cached selections took 207–337 ms from Apply to visible filtered metrics. These are samples on the prior Windows test machine, not a hardware performance guarantee. |
| 26 Nov 2026 | Phase 3 domain, storage, and build | `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run scan:artifacts`, `npm audit --audit-level=high` | Passed. 37 unit and integration tests cover immutable source events, antimeridian grouping, conflicting trip evidence, zero baselines, repeated and half-hour DST, schema migration, stale writes, merge and replacement cleanup. No dependency changes. Audit reported zero vulnerabilities. Vite still reports large lazy map/chart chunks and ignored client directives. |
| 26 Nov 2026 | Phase 3 Chrome and accessibility | `npm run test:e2e` plus isolated axe and development/preview smoke checks | 20 passed in Chrome 158.0.8127.37. Place editing, merge/split/undo, manual and suggested trips, comparison-to-place navigation, reload and reimport were exercised. The initial focused run exposed ambiguous category control labels. Explicit accessible names resolved both failures. Three synthetic views passed the scoped axe check. Preview reported zero external requests, console errors and horizontal page overflow. |
| 26 Nov 2026 | Phase 4 engine, build, and artifacts | `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run scan:artifacts`, `npm audit --audit-level=high`, `git check-ignore -q -- Timeline.json` | Passed. 42 unit and integration tests cover replay gaps, simultaneous conflicts, size limits, civil periods and comparisons, and the PNG input allowlist. No dependency changes or vulnerabilities reported. Vite still reports large lazy map/chart chunks and ignored Lucide directives. |
| 26 Nov 2026 | Phase 4 Chrome and export privacy | `npm run test:e2e` and isolated production preview checks with axe | 24 passed in Chrome 158.0.8127.37. Verified month and year recaps, active filtering, keyboard navigation, reduced motion, replay seek and pause, gaps without markers, and online tile suspension during playback. Verified painted text and field redaction, square PNG bytes and portrait preview dimensions, and zero external requests during preview and export. The English desktop story and dialog and Turkish dark mobile story had no scoped axe violations or horizontal overflow. Fullscreen entry and exit worked. Synthetic screenshots were reviewed at 1440×900 and 390×844. |
| 26 Nov 2026 | Phase 5 install, build and artifact checks | `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run scan:artifacts`, `npm audit --audit-level=high`, `actionlint -no-color`, `git check-ignore -- Timeline.json` | Passed. 42 unit and integration tests, no npm vulnerabilities, and workflow syntax passed actionlint 1.7.12. Checked the web app manifest and generated offline asset digests. The build contains 23 files and is about 3.46 MB uncompressed. On the first install attempt, the running previews locked esbuild on Windows. Stopping those previews let `npm ci` succeed. The install-script advisory and Vite chunk/client-directive warnings remain. The private input remains ignored and was not read in Phase 5. |
| 26 Nov 2026 | Phase 5 Chrome PWA and accessibility | `npm run test:e2e` and isolated Chrome production checks with axe and the installability detector | 26 passed in Chrome 158.0.8127.37. Verified offline import, saved archive reopen and deletion, lazy views on first offline use, asset-only caching, first install retry, integrity rejection, and update activation after two tabs close. The first offline hash navigation failed until the worker normalized the navigation fragment. The initial mobile sweep found two unfocusable scrolling tables. Both now support keyboard scrolling. The final scoped axe sweep found zero violations and zero horizontal page overflow across 10 views at each of three viewport sizes in English and Turkish. The clean regular profile reported zero installability errors. Three synthetic screenshots were reviewed and added to the README. |

### Synthetic import benchmark

Chrome 158.0.8127.37 in headless mode on Windows with an Intel Core i5-1135G7 and 8 GiB RAM. `npm run fixture:generate -- <MiB>` created the datasets. Browser timings are one run per size and include the time to reach the displayed milestone. Worker memory and persistent-mode throughput were not measured.

| Target | Canonical records | First view | Selection to preview | Preview to session overview | Main-thread tasks ≥50 ms |
|---|---:|---:|---:|---:|---:|
| 10 MiB | 33,190 | 183 ms | 1,381 ms | 193 ms | 0 during import |
| 50 MiB | 165,954 | 200 ms | 5,504 ms | 764 ms | 0 during import |
| 100 MiB | — | — | 29 ms to size rejection | — | — |

A separate 50 MiB run reached the cancellation message in 235 ms after the test requested cancellation during normalization.

### Phase 5 production comparison

The previous and current production builds were served locally with `npm run preview` and measured in fresh Chrome 158.0.8127.37 contexts on the same Windows i5-1135G7 machine with 8 GiB RAM. Service worker activity was blocked for this startup comparison. The first visible view transferred 156,040 compressed JS and CSS bytes before the optimization and 121,531 after it, a 22.1% reduction. First view timing across the three current samples was 318–366 ms. The offline cache was tested separately.

| Synthetic target | Canonical records | Selection to review, previous / current | Review to overview, previous / current |
|---|---:|---:|---:|
| 10 MiB | 33,190 | 1,563 / 2,034 ms | 977 / 1,026 ms |
| 50 MiB | 165,954 | 6,555 / 6,082 ms | 1,320 / 1,604 ms |
| 100 MiB | — | Rejected in 44 / 74 ms | — |

On the current 50 MiB sample, two first-time single-day filters took 408–462 ms and two cached selections took 250–271 ms. The observer reported no main-thread tasks of at least 50 ms between file selection and review or between confirmation and overview. A separate DevTools session sampled 190 MiB as the largest observed import Worker JS heap value over 55 readings, and the browser document sample reached about 6 MiB. These are JS heap samples for a synthetic session import. Whole-process peak memory and persistent import throughput remain unmeasured. Timings are single-run observations on this machine.

## Open decisions

- Additional Android and legacy real-world variants are pending owner-authorized samples. Evidence today covers representative synthetic formats and one owner-supplied iOS-style file.
- Offline startup requires a completed first download and browser storage that has not been cleared or evicted. Long-range rendering uses bounded sampling. The live basemap depends on the provider's endpoint and availability.
- City and country breakdowns need reliable local geographic data. The archive edit history is currently bounded to 1,024 operations.
- The owner confirmed the LifeAtlas name and `/LifeAtlas/` repository path after reviewing the existing public product using the same name. [Existing product](https://life-atlas.shop/)
- Any future offline basemap data requires its own licensing review.

## Next action

Verify the reviewed source files on GitHub and the production app at the [approved Pages address](https://alikaanztrk.github.io/LifeAtlas/). Use the manual Pages workflow for future authorized releases.
