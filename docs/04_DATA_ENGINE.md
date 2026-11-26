# 04 — Timeline import and analytics specification

## Evidence and limits

Google exports are not a single stable documented schema. The owner's real JSON has not been examined. Field examples below are representative, not guarantees. Verify adapters with synthetic fixtures plus an owner-controlled local import. Unknown schema yields safe structural diagnostics, not speculative parsing. Never ask owner to publish the export.

## Format detection and priority

| Format | Representative structure | Handling |
|---|---|---|
| Current Android-style | top-level `semanticSegments` array; optional `rawSignals`, `userLocationProfile` | priority; parse supported segment fields; ignore unused sensitive metadata with count |
| Current iOS-style | root array of segments (`visit`, `activity`, `timelinePath`) | priority; shape validation, support coordinate/time variants |
| Legacy semantic | `timelineObjects` containing `placeVisit`, `activitySegment` | fixture-backed adapter; multi-file import |
| Legacy raw | `locations` records (often `latitudeE7`, `longitudeE7`, timestamp variants) | raw-only capability; no fabricated semantic visits/modes |
| Unknown | other objects/arrays | explain supported formats and report structural counts; never silently treat as empty |

Recognize possible variant fields only after fixture evidence. A file with malformed or unknown entries but supported root can import valid records with explicit warnings. Reject invalid JSON and unsupported roots. No ZIP in initial scope. Never execute input content; treat keys and text as untrusted. Use limits for depth, strings, arrays, numbers and file size; prototype-pollution safe handling.

## Canonical model (conceptual TypeScript contract)

```ts
type Coord = { lat: number; lon: number };
type Timestamp = { utcMs: number; offsetMinutes?: number; original?: string };
type Source = { datasetId: string; format: string; recordKey: string; field?: string };
type Mode = 'walking'|'running'|'cycling'|'car'|'bus'|'rail'|'subway'|'air'|'boat'|'motorcycle'|'other'|'unknown';
type Distance = { meters: number; method: 'recorded'|'path_estimate'|'straight_line_estimate'; source: Source };
type Visit = { id: string; start: Timestamp; end: Timestamp; coord?: Coord; placeId?: string; label?: string; confidence?: number; source: Source };
type Activity = { id: string; start: Timestamp; end: Timestamp; mode: Mode; originalMode?: string; startCoord?: Coord; endCoord?: Coord; distance?: Distance; pathIds: string[]; source: Source };
type PathPoint = { coord: Coord; time?: Timestamp; accuracyMeters?: number };
type Path = { id: string; start?: Timestamp; end?: Timestamp; points: PathPoint[]; source: Source; activityId?: string };
```

Use discriminated unions and optional fields deliberately. Coordinates may be missing; never use 0,0 as default. Keep data provenance, original mode label, confidence when available and warnings. Do not treat visit candidate probability as GPS accuracy. Normalize probabilities only when their scale is verified. Keep original record identifiers locally when available. `recordKey` is a local stable identifier, not a raw data dump. Raw points have independent capability and are not automatically semantic activities.

## Coordinates and timestamps

- Parse numeric lat/lon, E7 integer scaling, `geo:lat,lon` and degree-symbol coordinate strings only for recognized fields/formats. Validate finite latitude −90..90 and longitude −180..180. Never auto-swap ambiguous pairs. GeoJSON uses `[lon, lat]`.
- Parse ISO strings with explicit timezone/offset, verified epoch ms or seconds fields according to format, and supported path point offsets relative to segment start. Invalid times or end before start are diagnostics. Missing timezone must not silently be treated as user local; use selected documented fallback and mark uncertain, or skip unusable timestamps. Preserve offsets where available; no IANA zone inferred from offset.
- Store UTC instants. Default analytics date policy: one explicit selected IANA display timezone (initially browser zone, shown in settings). Later optional recorded-local-day mode only if robust offset coverage; warn where missing. Date filters use half-open `[start,end)` boundaries calculated with timezone-aware utility, not fixed 24h addition; test DST, leap years, overnight events.

## Association, deduplication, editing

- Deterministic source record fingerprints from normalized identity fields and source IDs when reliable; avoid fingerprinting unstable display metadata. Reimport identical file produces no added canonical events. Separate exact duplicates from near duplicates/conflicts; do not silently merge distinct visits. Prefer richer record only for explicitly defined matching identity, with provenance retained. Within/across merged datasets prevent double counts; if ambiguous show overlap warnings and avoid unsafe automatic fusion. Use stable IDs so edits survive reimports.
- Associate timeline paths to activities using explicit identifiers first, then conservative temporal/spatial overlap with documented threshold; ambiguous remains unassigned. Never connect gaps across unrelated segments. Do not double-count assigned path and activity distance. Unassigned paths visible separately; include in distance only when non-overlap is established and label as estimated.
- User edits (name, category, grouping, trip, corrected mode) are separate versioned overlay entries. Originals immutable. Support undo/reset to source when feasible. Merges and replacements require explicit user intent; never delete unrelated data.

## Analytics contract

**Distance:** recorded `distanceMeters` / verified equivalent finite nonnegative field wins. Else sum valid adjacent path segments using geodesic/Haversine distance and gap/outlier guards. No interpolation over missing intervals as if measured. Optional straight-line endpoint estimate is separately labeled lower-bound-like approximation, excluded from default total unless explicitly enabled and disclosed (it is not always a reliable bound under noisy GPS). Path distances use original points, never simplified render geometry. For partially overlapping activity windows, use timestamped path proportion where appropriate, otherwise duration-proportional allocation of recorded distance marked as estimated; avoid double counting and ensure partitions conserve totals. If no defensible method, show unknown. Record missing-distance count and estimated fraction.

**Duration:** clip each interval to window. Use interval union for total observed visit time/movement/coverage; if activities overlap each other or visits, do not report impossible > day totals. Ambiguous intervals flagged; exclusive category breakdown allocates overlap to unknown or explicit documented precedence. No data gaps filled with home or activity. Mode share states denominator (distance or known duration).

**Coverage:** days with at least one valid evidence event/point or interval overlap; distinguish known zero, unknown, not yet occurred. Future dates excluded from current-period default. A sparse point does not imply full-day coverage; show known recorded time independently. Day-level missing distances do not become zero. Use same filters for every aggregate and drilldown.

**Places:** first group by verified stable place ID; for unlabeled coordinates use deterministic spatial clustering (initial candidate radius ~100m, adjustable, not guaranteed to distinguish venues). Do not merge distinct known place IDs purely by proximity. Group centroid is representative, not precise location. Labels from source or user; unknown label is neutral placeholder. Home/work require user opt-in labeling. Track visit count, union duration, first/last seen. Cities/countries only from source metadata or licensed offline boundary dataset with attribution and known coverage; no external coordinate lookup.

**Trips:** phase 3, manually create first; suggested trips via documented rule using user-confirmed home/base and configurable distance/time thresholds (candidate: away >50km and at least one overnight, with adequate evidence). Missing evidence breaks certainty. Suggestions never auto-confirm. Allow edit/split/merge and user labels. No travel claims based solely on sparse points.

**Raw data:** map valid points and data coverage; raw-only GPS distance is estimated with explicit configurable gap/accuracy filters and excluded from semantic mode/visit totals. Do not infer exact routes, transport, addresses or visit durations from raw points without a separately verified algorithm.

## Data quality output

Counts: input records, normalized by kind, exact duplicates, invalid records, unsupported fields/segments, missing coordinate/time/distance/mode, overlaps, rejected path jumps, coverage and format. Counters have defined denominators and may overlap; don't imply they sum if not mutually exclusive. Error detail only safe structural path/index and code (no values). Support capability flags `hasVisits`, `hasActivities`, `hasPaths`, `hasDistance`, `hasPlaceNames`, `hasRawPoints`, etc. Hide/disable inapplicable analytics with reason.
