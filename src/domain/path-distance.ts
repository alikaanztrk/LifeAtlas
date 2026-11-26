import { countIssue } from './diagnostics'
import { sources } from './identity'
import type { Activity, IssueCounts, Path } from './model'
import { clip, distanceMeters, mergeIntervals } from './primitives'
import type { Window } from './primitives'

export type DistanceEdge = Window & { meters: number; from: number; to: number }
type Measurement = { path: Path; bounds: Window; edges: DistanceEdge[] }

export function measure(path: Path, quality: IssueCounts): Measurement | undefined {
  const edges: DistanceEdge[] = []
  for (let index = 1; index < path.points.length; index++) {
    const before = path.points[index - 1]
    const after = path.points[index]
    if (!before || !after || after.breakBefore || !before.time || !after.time) continue
    const start = before.time.ms
    const end = after.time.ms
    const meters = distanceMeters(before.coord, after.coord)
    const seconds = (end - start) / 1_000
    if (seconds === 0 && meters === 0) continue
    if (seconds <= 0 || seconds > 1_800 || meters / seconds > 350 ||
        (edges.at(-1)?.end ?? start) > start) {
      countIssue(quality, 'pathGap')
      continue
    }
    edges.push({ start, end, meters, from: index - 1, to: index })
  }
  const first = edges[0]
  const last = edges.at(-1)
  return first && last ? { path, bounds: { start: first.start, end: last.end }, edges } : undefined
}

function lowerBound<T>(rows: T[], value: number, get: (row: T) => number): number {
  let start = 0
  let end = rows.length
  while (start < end) {
    const middle = Math.floor((start + end) / 2)
    const row = rows[middle]
    if (row !== undefined && get(row) < value) start = middle + 1
    else end = middle
  }
  return start
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, item: V) {
  const existing = map.get(key)
  if (existing) existing.push(item)
  else map.set(key, [item])
}

const startOf = (activity: Activity) => activity.start.ms
const TOLERANCE = 120_000

function spatialMatch(activity: Activity, measurement: Measurement): boolean {
  const { path, bounds } = measurement
  const first = path.points[0]?.coord
  const last = path.points.at(-1)?.coord
  return Boolean(first && last && activity.startCoord && activity.endCoord &&
    bounds.start >= activity.start.ms && bounds.end <= activity.end.ms &&
    bounds.start - activity.start.ms <= TOLERANCE && activity.end.ms - bounds.end <= TOLERANCE &&
    distanceMeters(first, activity.startCoord) <= 500 && distanceMeters(last, activity.endCoord) <= 500)
}

function overlapping(bounds: Window, union: Window[]): boolean {
  const index = lowerBound(union, bounds.end, (interval) => interval.start) - 1
  const candidate = union[index]
  return candidate !== undefined && candidate.end > bounds.start
}

export function distanceSources(paths: Path[], activities: Activity[], quality: IssueCounts) {
  const measured = paths.map((path) => measure(path, quality)).filter((value) => value !== undefined)
  const links = new Map<string, Activity>()
  const sorted = activities.toSorted((a, b) => startOf(a) - startOf(b))
  const detail = new Map<string, Measurement[]>()
  const explicit = new Map<string, Activity[]>()
  const unassigned: Measurement[] = []
  for (const activity of activities) {
    for (const source of sources(activity)) {
      if (source.sourceId) pushTo(explicit, source.format + ':' + source.sourceId, activity)
    }
  }

  for (const item of measured) {
    const explicitId = item.path.activitySourceId
    let candidates: Activity[]
    if (explicitId) {
      candidates = Array.from(new Set(explicit.get(item.path.source.format + ':' + explicitId)))
        .filter((activity) => item.bounds.start >= activity.start.ms && item.bounds.end <= activity.end.ms)
    } else {
      const from = lowerBound(sorted, item.bounds.start - TOLERANCE, startOf)
      const to = lowerBound(sorted, item.bounds.start + 1, startOf)
      if (to - from > 32) {
        countIssue(quality, 'ambiguousPath')
        continue
      }
      candidates = sorted.slice(from, to).filter((activity) => spatialMatch(activity, item))
    }
    const candidate = candidates[0]
    if (candidates.length === 1 && candidate) {
      links.set(item.path.id, candidate)
      pushTo(detail, candidate.id, item)
    }
    else if (candidates.length > 1 || explicitId) countIssue(quality, 'ambiguousPath')
    else unassigned.push(item)
  }

  const activityUnion = mergeIntervals(activities.map(({ start, end }) => ({ start: start.ms, end: end.ms })))
  const independent = unassigned.filter(({ bounds }) => {
    const conflicts = overlapping(bounds, activityUnion)
    if (conflicts) countIssue(quality, 'ambiguousPath')
    return !conflicts
  })
  const byActivity = new Map<string, DistanceEdge[]>()
  for (const [id, traces] of detail) {
    const valid = withoutOverlaps(traces, quality)
    if (valid.length === traces.length) byActivity.set(id, valid.flatMap(({ edges }) => edges))
  }
  return {
    byActivity, independent: withoutOverlaps(independent, quality).flatMap(({ edges }) => edges),
    links, byPath: new Map(measured.map(({ path, edges }) => [path.id, edges])),
  }
}

function withoutOverlaps(rows: Measurement[], quality: IssueCounts): Measurement[] {
  const sorted = rows.toSorted((a, b) => a.bounds.start - b.bounds.start)
  let end = -Infinity
  return sorted.filter((row, index) => {
    const later = sorted[index + 1]
    const overlap = row.bounds.start < end || (later && later.bounds.start < row.bounds.end)
    end = Math.max(end, row.bounds.end)
    if (overlap) countIssue(quality, 'ambiguousPath')
    return !overlap
  })
}

export function edgeTotal(edges: DistanceEdge[], window?: Window): number | null {
  let meters: number | null = null
  const from = window ? lowerBound(edges, window.start + 1, (edge) => edge.end) : 0
  for (let index = from; index < edges.length; index++) {
    const edge = edges[index]
    if (!edge || (window && edge.start >= window.end)) break
    const part = clip(edge, window)
    if (part) meters = (meters ?? 0) + edge.meters * (part.end - part.start) / (edge.end - edge.start)
  }
  return meters
}

export function recordedFraction(edges: DistanceEdge[] | undefined, bounds: Window, part: Window): number {
  if (edges?.[0]?.start === bounds.start && edges.at(-1)?.end === bounds.end &&
      edges.every((edge, index) => index === 0 || edge.start === edges[index - 1]?.end)) {
    const total = edgeTotal(edges) ?? 0
    if (total > 0) return (edgeTotal(edges, part) ?? 0) / total
  }
  return (part.end - part.start) / (bounds.end - bounds.start)
}
