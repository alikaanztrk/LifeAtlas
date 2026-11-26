import { limits } from './limits'
import type { Warn } from './diagnostics'
import type { Activity, Event, Format, Instant, Interval, Mode, Path, PathPoint, Source, Visit } from './model'
import { decimal, epochMs, field, nonnegative, object, readCoordinate, readTime, string } from './primitives'
import type { JsonObject } from './primitives'

const shapeKeys = ['visit', 'activity', 'timelinePath'] as const
const rootFormats = [
  ['semanticSegments', 'android'], ['timelineObjects', 'legacySemantic'], ['locations', 'legacyRaw'],
] as const

export function detect(input: unknown, warn: Warn): { format: Format; entries: unknown[] } | undefined {
  if (Array.isArray(input)) {
    if (input.some((entry: unknown) => shapeKeys.some((key) => field(object(entry), key) !== undefined))) {
      return { format: 'ios', entries: input }
    }
    return
  }
  const root = object(input)
  if (!root) return
  const matches = rootFormats.filter(([key]) => Array.isArray(field(root, key)))
  if (matches.length !== 1 || !matches[0]) return
  const [key, format] = matches[0]
  const entries = field(root, key)
  if (!Array.isArray(entries)) return
  unknownFields(root, [key], warn)
  return { format, entries }
}

export function shapeWithinLimits(input: unknown, warn: Warn): boolean {
  let nodes = 0
  let unsafe = 0
  const fits = (value: unknown, depth: number): boolean => {
    if (++nodes > 5_000_000 || depth > limits.depth) return false
    if (typeof value === 'string') return value.length <= limits.stringLength
    if (Array.isArray(value)) {
      return value.length <= limits.inputRecords && value.every((item: unknown) => fits(item, depth + 1))
    }
    const obj = object(value)
    if (!obj) return true
    const keys = Object.keys(obj)
    return keys.length <= limits.objectKeys && keys.every((key) => {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') unsafe++
      return key.length <= limits.stringLength && fits(obj[key], depth + 1)
    })
  }
  const valid = fits(input, 0)
  if (unsafe) warn('unsafeKey', unsafe)
  return valid
}

function unknownFields(input: JsonObject, known: readonly string[], warn: Warn) {
  const count = Object.keys(input).filter((key) => !known.includes(key)).length
  if (count) warn('unusedField', count)
}

function interval(start: Interval['start'] | undefined, end: Interval['end'] | undefined, warn: Warn) {
  if (!start || !end || end.ms < start.ms) {
    warn('invalidTime')
    return
  }
  return { start, end }
}

function legacyTime(input: JsonObject | undefined, key: string) {
  const iso = field(input, key + 'Timestamp')
  return iso === undefined ? epochMs(field(input, key + 'TimestampMs')) : readTime(iso)
}

function modernTime(input: JsonObject, key: 'startTime' | 'endTime', warn: Warn): Instant | undefined {
  const instant = readTime(field(input, key))
  const metadata = field(input, key + 'TimezoneUtcOffsetMinutes')
  const offset = decimal(metadata)
  if (offset !== undefined && Number.isInteger(offset) && Math.abs(offset) <= 14 * 60) {
    return instant && { ...instant, recordedLocalOffset: offset }
  }
  if (metadata !== undefined) warn('invalidTime')
  return instant
}

function sourceFor(source: Source, fieldName: string, item?: JsonObject): Source {
  return { ...source, field: fieldName, sourceId: string(field(item, 'id'), 128) }
}

function optionalCoord(input: unknown, warn: Warn) {
  const result = readCoordinate(input)
  if (!result) warn(input === undefined ? 'missingCoord' : 'invalidCoord')
  return result
}

function confidence(input: unknown): number | undefined {
  const value = decimal(input)
  return value !== undefined && value >= 0 && value <= 1 ? value : undefined
}

const modes = new Map<string, Mode>([
  ['WALKING', 'walking'], ['WALK', 'walking'], ['RUNNING', 'running'], ['RUN', 'running'],
  ['CYCLING', 'cycling'], ['ON_BICYCLE', 'cycling'], ['BIKING', 'cycling'],
  ['IN_PASSENGER_VEHICLE', 'car'], ['DRIVING', 'car'], ['IN_CAR', 'car'],
  ['IN_BUS', 'bus'], ['ON_BUS', 'bus'], ['BUS', 'bus'], ['IN_TRAIN', 'rail'], ['TRAIN', 'rail'],
  ['IN_SUBWAY', 'subway'], ['SUBWAY', 'subway'], ['FLYING', 'air'], ['IN_AIRPLANE', 'air'],
  ['IN_BOAT', 'boat'], ['BOATING', 'boat'], ['MOTORCYCLING', 'motorcycle'],
  ['ON_MOTORCYCLE', 'motorcycle'], ['OTHER', 'other'],
])

const modeKey = (original: string) => original.trim().toUpperCase().replace(/[\s-]+/g, '_')

function visit(input: JsonObject, time: Interval, source: Source, warn: Warn, legacy: boolean): Visit {
  const place = object(field(input, legacy ? 'location' : 'topCandidate'))
  const coord = optionalCoord(legacy ? field(input, 'location') : field(place, 'placeLocation'), warn)
  return {
    kind: 'visit', id: '', source, ...time, coord,
    placeId: string(field(place, 'placeId'), 256) ?? (!legacy ? string(field(place, 'placeID'), 256) : undefined),
    label: string(field(place, 'name')),
    confidence: legacy ? undefined : confidence(field(place, 'probability')),
  }
}

function activity(input: JsonObject, time: Interval, source: Source, warn: Warn, legacy: boolean): Activity {
  const candidate = object(field(input, 'topCandidate'))
  const originalMode = string(legacy ? field(input, 'activityType') : field(candidate, 'type'), 80)
  const mode = modes.get(originalMode ? modeKey(originalMode) : '') ?? 'unknown'
  if (mode === 'unknown') warn('unknownMode')
  const recorded = field(input, legacy ? 'distance' : 'distanceMeters')
  const meters = nonnegative(recorded)
  const recordedMeters = meters !== undefined && meters <= 1_000_000_000 ? meters : undefined
  if (recordedMeters === undefined && recorded !== undefined) warn('invalidDistance')
  return {
    kind: 'activity', id: '', source, ...time, mode, originalMode, recordedMeters,
    startCoord: optionalCoord(field(input, legacy ? 'startLocation' : 'start'), warn),
    endCoord: optionalCoord(field(input, legacy ? 'endLocation' : 'end'), warn),
  }
}

function path(
  entries: unknown[], source: Source, warn: Warn,
  options: { start?: Path['start']; end?: Path['end']; legacy?: boolean; activitySourceId?: string },
): Path | undefined {
  if (entries.length > limits.pointsPerPath) {
    warn('inputLimit')
    return
  }
  const points: PathPoint[] = []
  let gap = false
  for (const value of entries) {
    const item = object(value)
    const coord = readCoordinate(options.legacy ? value : field(item, 'point'))
    if (!coord) {
      warn('invalidPoint')
      gap = true
      continue
    }
    const timeValue = field(item, 'time')
    const offsetValue = field(item, 'durationMinutesOffsetFromStartTime')
    const offset = nonnegative(offsetValue)
    const time = timeValue !== undefined ? readTime(timeValue)
      : offset !== undefined && options.start ? epochMs(options.start.ms + offset * 60_000) : undefined
    if (!options.legacy && !time) warn('invalidTime')
    points.push({ coord, time, breakBefore: gap ? true : undefined })
    gap = false
  }
  if (!points.length) return
  const { start, end, activitySourceId } = options
  return { kind: 'path', id: '', source, start, end, points, activitySourceId }
}

function readModern(input: JsonObject, source: Source, warn: Warn): Event[] {
  unknownFields(input, [...shapeKeys, 'startTime', 'endTime', 'startTimeTimezoneUtcOffsetMinutes',
    'endTimeTimezoneUtcOffsetMinutes', 'id'], warn)
  const events: Event[] = []
  const start = modernTime(input, 'startTime', warn)
  const end = modernTime(input, 'endTime', warn)
  for (const key of shapeKeys) {
    const value = field(input, key)
    if (value === undefined) continue
    const itemSource = sourceFor(source, key, object(value))
    if (key === 'timelinePath' && Array.isArray(value)) {
      const bounds = start && end && end.ms >= start.ms ? { start, end } : {}
      if ((field(input, 'startTime') !== undefined || field(input, 'endTime') !== undefined) && !bounds.start) {
        warn('invalidTime')
      }
      const trace = path(value, itemSource, warn, bounds)
      if (trace) events.push(trace)
      else warn('invalidRecord')
      continue
    }
    const item = object(value)
    if (!item || key === 'timelinePath') {
      warn('invalidRecord')
      continue
    }
    const time = interval(start, end, warn)
    if (!time) continue
    events.push(key === 'visit' ? visit(item, time, itemSource, warn, false)
      : activity(item, time, itemSource, warn, false))
  }
  if (!shapeKeys.some((key) => field(input, key) !== undefined)) warn('unknownRecord')
  return events
}

function readLegacy(input: JsonObject, source: Source, warn: Warn): Event[] {
  const keys = ['placeVisit', 'activitySegment'] as const
  unknownFields(input, keys, warn)
  const events: Event[] = []
  for (const key of keys) {
    const value = field(input, key)
    if (value === undefined) continue
    const item = object(value)
    if (!item) {
      warn('invalidRecord')
      continue
    }
    const duration = object(field(item, 'duration'))
    const time = interval(legacyTime(duration, 'start'), legacyTime(duration, 'end'), warn)
    if (!time) continue
    const itemSource = sourceFor(source, key, item)
    if (key === 'placeVisit') {
      events.push(visit(item, time, itemSource, warn, true))
      continue
    }
    events.push(activity(item, time, itemSource, warn, true))
    const waypoints = field(object(field(item, 'waypointPath')), 'waypoints')
    const rawPath = field(item, 'waypointPath')
    if (Array.isArray(waypoints)) {
      const trace = path(waypoints, sourceFor(source, 'waypointPath'), warn, {
        ...time, legacy: true, activitySourceId: itemSource.sourceId,
      })
      if (trace) events.push(trace)
      else warn('invalidRecord')
    } else if (rawPath !== undefined) warn('invalidRecord')
  }
  if (!keys.some((key) => field(input, key) !== undefined)) warn('unknownRecord')
  return events
}

export function adapt(value: unknown, source: Source, warn: Warn): Event[] {
  const input = object(value)
  if (!input) {
    warn('invalidRecord')
    return []
  }
  if (source.format === 'legacySemantic') return readLegacy(input, source, warn)
  if (source.format !== 'legacyRaw') return readModern(input, source, warn)

  const coord = optionalCoord(input, warn)
  const timestamp = field(input, 'timestamp')
  const time = timestamp === undefined ? epochMs(field(input, 'timestampMs')) : readTime(timestamp)
  if (!time) warn('invalidTime')
  if (!coord || !time) return []
  return [{
    kind: 'raw', id: '', source: sourceFor(source, 'location', input),
    point: { coord, time, accuracy: nonnegative(field(input, 'accuracy')) },
  }]
}
