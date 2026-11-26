export const formats = ['android', 'ios', 'legacySemantic', 'legacyRaw'] as const
export type Format = typeof formats[number]

export const diagnosticCodes = [
  'sizeLimit', 'inputLimit', 'invalidJson', 'unknownFormat', 'unknownRecord', 'unusedField',
  'unsafeKey', 'invalidRecord', 'invalidTime', 'invalidCoord', 'missingCoord',
  'invalidDistance', 'missingDistance', 'unknownMode', 'invalidPoint', 'pathGap',
  'ambiguousPath', 'overlap', 'nearDuplicate', 'provenanceLimit',
] as const
export type DiagnosticCode = typeof diagnosticCodes[number]
export type Diagnostic = { code: DiagnosticCode; file: number; record?: number }
export type IssueCounts = Partial<Record<DiagnosticCode, number>>

export type Coordinate = { lat: number; lon: number }
export type Instant = { ms: number; offset?: number; recordedLocalOffset?: number; original?: string }
export type Interval = { start: Instant; end: Instant }
export type Source = { fileKey: string; format: Format; index: number; field: string; sourceId?: string }
export type Mode = 'walking' | 'running' | 'cycling' | 'car' | 'bus' | 'rail' |
  'subway' | 'air' | 'boat' | 'motorcycle' | 'other' | 'unknown'
export type PathPoint = { coord: Coordinate; time?: Instant; accuracy?: number; breakBefore?: true }

type Canonical = { id: string; source: Source; additionalSources?: Source[] }
export type Visit = Canonical & Interval & {
  kind: 'visit'; coord?: Coordinate; placeId?: string; label?: string; confidence?: number
}
export type Activity = Canonical & Interval & {
  kind: 'activity'; mode: Mode; originalMode?: string; startCoord?: Coordinate;
  endCoord?: Coordinate; recordedMeters?: number
}
export type Path = Canonical & {
  kind: 'path'; start?: Instant; end?: Instant; points: PathPoint[]; activitySourceId?: string
}
export type RawPoint = Canonical & { kind: 'raw'; point: PathPoint & { time: Instant } }
export type Event = Visit | Activity | Path | RawPoint
export type EventKind = Event['kind']

export type FileReport = {
  slot: number; bytes: number; format?: Format; input: number; accepted: number;
  skipped: number; failure?: 'sizeLimit' | 'inputLimit' | 'invalidJson' | 'unknownFormat'
}
export type ImportReport = {
  files: FileReport[]; counts: IssueCounts; examples: Diagnostic[]; duplicates: number
}
export type Summary = {
  kinds: Record<EventKind, number>; capabilities: { placeNames: boolean; stablePlaces: boolean };
  first: number | null; last: number | null; zone: string; evidenceDays: number | null;
  observedMs: number | null; visitMs: number | null; movementMs: number | null;
  distance: { recorded: number | null; estimated: number | null; unknownActivities: number;
    excludedActivities: number; estimatedShare: number | null };
  stablePlaceCount: number | null; explicitPlaceVisits: number;
  quality: IssueCounts;
}
export type Dataset = {
  id: string; revision: string; updatedAt: number; formats: Format[]; summary: Summary;
  report: ImportReport; mergedDuplicates: number
}
