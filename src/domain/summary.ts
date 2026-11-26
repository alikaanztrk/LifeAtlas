import { countIssue } from './diagnostics'
import type { Activity, Event, EventKind, IssueCounts, Summary } from './model'
import { distanceSources, edgeTotal, recordedFraction } from './path-distance'
import { clip, contains, coverageDays, distanceMeters, mergeIntervals, toWindow } from './primitives'
import type { Window } from './primitives'

function duration(intervals: Window[]): number | null {
  return intervals.length ? mergeIntervals(intervals).reduce((total, row) => total + row.end - row.start, 0) : null
}

function overlappingActivities(activities: Activity[]): Set<string> {
  const sorted = activities.filter((activity) => activity.end.ms > activity.start.ms)
    .toSorted((a, b) => a.start.ms - b.start.ms)
  let furthestEnd = -Infinity
  const excluded = new Set<string>()
  for (let index = 0; index < sorted.length; index++) {
    const activity = sorted[index]
    if (!activity) continue
    if (activity.start.ms < furthestEnd || (sorted[index + 1]?.start.ms ?? Infinity) < activity.end.ms) {
      excluded.add(activity.id)
    }
    furthestEnd = Math.max(furthestEnd, activity.end.ms)
  }
  return excluded
}

function countNearDuplicates(activities: Activity[], visits: Extract<Event, { kind: 'visit' }>[], quality: IssueCounts) {
  const byPlace = new Map<string, typeof visits[number]>()
  for (const visit of visits.toSorted((a, b) => a.start.ms - b.start.ms)) {
    const key = visit.placeId ?? (visit.coord && JSON.stringify(visit.coord))
    if (!key) continue
    const previous = byPlace.get(key)
    if (previous && visit.start.ms - previous.start.ms <= 120_000 &&
        Math.abs(visit.end.ms - previous.end.ms) <= 120_000) countIssue(quality, 'nearDuplicate')
    byPlace.set(key, visit)
  }
  const byMode = new Map<string, Activity>()
  for (const activity of activities.toSorted((a, b) => a.start.ms - b.start.ms)) {
    const previous = byMode.get(activity.mode)
    if (previous?.startCoord && activity.startCoord && previous.endCoord && activity.endCoord &&
        activity.start.ms - previous.start.ms <= 120_000 && Math.abs(activity.end.ms - previous.end.ms) <= 120_000 &&
        distanceMeters(previous.startCoord, activity.startCoord) <= 50 &&
        distanceMeters(previous.endCoord, activity.endCoord) <= 50) countIssue(quality, 'nearDuplicate')
    byMode.set(activity.mode, activity)
  }
}

export function compileMeasurements(events: Event[]) {
  const activities = events.filter((event) => event.kind === 'activity')
  const paths = events.filter((event) => event.kind === 'path')
  const quality: IssueCounts = {}
  return { ...distanceSources(paths, activities, quality), excluded: overlappingActivities(activities), quality }
}

export type Measurements = ReturnType<typeof compileMeasurements>

export function activityDistance(activity: Activity, measurements: Measurements, window?: Window) {
  const range = toWindow(activity)
  const part = clip(range, window)
  const zero = range.start === range.end && contains(range.start, window)
  if (!part && !zero) return { kind: 'outside' } as const
  if (measurements.excluded.has(activity.id)) return { kind: 'overlap' } as const
  const edges = measurements.byActivity.get(activity.id)
  if (activity.recordedMeters !== undefined) {
    if (!part || (part.start === range.start && part.end === range.end)) {
      return { kind: 'recorded', meters: activity.recordedMeters } as const
    }
    return { kind: 'estimated', meters: activity.recordedMeters * recordedFraction(edges, range, part) } as const
  }
  const fallback = edgeTotal(edges ?? [], window)
  return fallback === null ? { kind: 'missing' } as const : { kind: 'estimated', meters: fallback } as const
}

export function summarize(
  events: Event[], zone: string, window?: Window, compiled?: Measurements, detailed = true,
): Summary {
  const activities = events.filter((event) => event.kind === 'activity')
  const evidence: Window[] = []
  const movement: Window[] = []
  const stays: Window[] = []
  const kinds: Record<EventKind, number> = { visit: 0, activity: 0, raw: 0, path: 0 }
  const measurements = compiled ?? compileMeasurements(events)
  const quality: IssueCounts = window ? {} : { ...measurements.quality }
  const stablePlaces = new Set<string>()
  let explicitPlaceVisits = 0
  let placeNames = false
  let first = Infinity
  let last = -Infinity

  const observe = (start: number, end = start) => {
    const range = clip({ start, end: start === end ? end + 1 : end }, window)
    if (!range) return false
    evidence.push(range)
    first = Math.min(first, range.start)
    last = Math.max(last, start === end ? start : range.end)
    return true
  }

  for (const event of events) {
    if (event.kind === 'raw') {
      if (observe(event.point.time.ms)) kinds.raw++
      continue
    }
    if (event.kind === 'path') {
      let seen = false
      for (const point of event.points) if (point.time && observe(point.time.ms)) seen = true
      if (event.start && observe(event.start.ms)) seen = true
      if (event.end && observe(event.end.ms)) seen = true
      if (!seen && window && measurements.byPath.get(event.id)?.some((edge) => clip(edge, window))) {
        for (const edge of measurements.byPath.get(event.id) ?? []) {
          const part = clip(edge, window)
          if (part) seen = observe(part.start, part.end) || seen
        }
      }
      if (seen || !window) kinds.path++
      continue
    }
    const range = toWindow(event)
    if (!observe(range.start, range.end)) continue
    kinds[event.kind]++
    const part = clip(range, window) ?? { start: range.start, end: range.start }
    if (event.kind === 'visit') {
      stays.push(part)
      if (event.placeId) {
        explicitPlaceVisits++
        stablePlaces.add(event.placeId)
      }
      if (event.label) placeNames = true
    } else movement.push(part)
  }

  const known = [...stays, ...movement].toSorted((a, b) => a.start - b.start)
  let end = -Infinity
  for (const interval of known) {
    if (interval.start < end && interval.end > interval.start) countIssue(quality, 'overlap')
    end = Math.max(end, interval.end)
  }
  if (detailed) countNearDuplicates(activities, events.filter((event) => event.kind === 'visit'), quality)

  let recorded: number | null = null
  let estimated = edgeTotal(measurements.independent, window)
  let excludedActivities = 0
  let unknownActivities = 0
  for (const activity of activities) {
    const value = activityDistance(activity, measurements, window)
    if (value.kind === 'overlap') excludedActivities++
    if (value.kind === 'recorded') recorded = (recorded ?? 0) + value.meters
    if (value.kind === 'estimated') estimated = (estimated ?? 0) + value.meters
    if (value.kind === 'missing') {
      unknownActivities++
      countIssue(quality, 'missingDistance')
    }
  }
  const total = (recorded ?? 0) + (estimated ?? 0)

  return {
    kinds, capabilities: { placeNames, stablePlaces: stablePlaces.size > 0 },
    first: Number.isFinite(first) ? first : null, last: Number.isFinite(last) ? last : null, zone,
    evidenceDays: evidence.length ? coverageDays(evidence, zone) : null,
    observedMs: duration(known), visitMs: duration(stays), movementMs: duration(movement),
    stablePlaceCount: stablePlaces.size || null, explicitPlaceVisits,
    distance: { recorded, estimated, unknownActivities, excludedActivities,
      estimatedShare: total > 0 ? (estimated ?? 0) / total : null },
    quality,
  }
}
