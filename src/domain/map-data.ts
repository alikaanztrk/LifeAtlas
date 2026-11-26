import type { Feature, FeatureCollection, LineString, Point, Position } from 'geojson'
import { dayKey } from './dates'
import { evidenceBounds } from './event-index'
import type { Coordinate, Mode, Path } from './model'
import type { Area } from './geography'
import { contains } from './primitives'
import type { Window } from './primitives'
import type { Exploration } from './exploration'

export type MapKind = 'visit' | 'activity' | 'path' | 'raw'
export type MapRow = { id: string; kind: MapKind; day: string | null; label?: string; mode?: Mode; area?: Area }
export type MapProperties = { recordId: string; mode: Mode }
export type MapData = {
  visits: FeatureCollection<Point, MapProperties>; positions: FeatureCollection<Point, MapProperties>
  paths: FeatureCollection<LineString, MapProperties>; tracePoints: FeatureCollection<Point, MapProperties>
  ends: FeatureCollection<Point, MapProperties>
  rows: MapRow[]; mapped: number; omitted: number
  bounds: [number, number, number, number] | null
}

const collection = <G extends Point | LineString>(): FeatureCollection<G, MapProperties> =>
  ({ type: 'FeatureCollection', features: [] })
const position = ({ lon, lat }: Coordinate): Position => [lon, lat]

function point(coord: Coordinate, properties: MapProperties): Feature<Point, MapProperties> {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: position(coord) }, properties }
}

export function splitAntimeridian(from: Coordinate, to: Coordinate): Position[][] {
  const change = to.lon - from.lon
  if (Math.abs(change) <= 180) return [[position(from), position(to)]]
  const boundary = change > 180 ? -180 : 180
  const wrapped = to.lon - Math.sign(change) * 360
  const amount = (boundary - from.lon) / (wrapped - from.lon)
  const latitude = from.lat + amount * (to.lat - from.lat)
  return [[position(from), [boundary, latitude]], [[-boundary, latitude], position(to)]]
}

export function mapBounds(positions: Position[]): MapData['bounds'] {
  if (!positions.length) return null
  const longitude = positions.map((value) => (((value[0] ?? 0) % 360) + 360) % 360).sort((a, b) => a - b)
  let south = 90, north = -90
  for (const value of positions) {
    south = Math.min(south, value[1] ?? 0)
    north = Math.max(north, value[1] ?? 0)
  }
  let gap = -1, west = longitude[0] ?? 0
  for (let index = 0; index < longitude.length; index++) {
    const next = longitude[index + 1] ?? (longitude[0] ?? 0) + 360
    const span = next - (longitude[index] ?? 0)
    if (span > gap) { gap = span; west = next % 360 }
  }
  if (west > 180) west -= 360
  return [west, south, west + 360 - gap, north]
}

function sample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items
  return Array.from({ length: max }, (_, index) => items[Math.floor(index * (items.length - 1) / (max - 1))])
    .filter((item): item is T => item !== undefined)
}

function pathLines(path: Path, experience: Exploration, window?: Window) {
  const lines: Position[][] = []
  let previousIndex = -1
  for (const edge of experience.measurements.byPath.get(path.id) ?? []) {
    const before = path.points[edge.from]
    const after = path.points[edge.to]
    if (!before || !after || !contains(edge.start, window) || !contains(edge.end, window)) continue
    const parts = splitAntimeridian(before.coord, after.coord)
    for (const [index, line] of parts.entries()) {
      const previous = lines.at(-1)
      const end = previous?.at(-1)
      const first = line[0]
      const next = line[1]
      if (previous && first && next && end && index === 0 && previousIndex === edge.from &&
          end[0] === first[0] && end[1] === first[1]) previous.push(next)
      else lines.push(line)
    }
    previousIndex = edge.to
  }
  return lines
}

export function buildMap(
  experience: Exploration, zone: string, window?: Window, mode?: Mode, selected?: string, allowed?: Set<string>,
  locate?: (coord?: Coordinate) => Area | undefined,
): MapData {
  const data: MapData = {
    visits: collection(), positions: collection(), paths: collection(), tracePoints: collection(), ends: collection(),
    rows: [], mapped: 0, omitted: 0, bounds: null,
  }
  const eligible = experience.events(window)
  const events = allowed ? eligible.filter((event) => allowed.has(event.id)) : eligible
  const visits = events.filter((event) => event.kind === 'visit' && event.coord)
  const raw = events.filter((event) => event.kind === 'raw')
  const activities = events.filter((event) => event.kind === 'activity' && (!mode || event.mode === mode) &&
    ((event.startCoord && contains(event.start.ms, window)) || (event.endCoord && contains(event.end.ms, window))))
  const paths = events.filter((event) => event.kind === 'path' && (!mode || experience.measurements.links.get(event.id)?.mode === mode))
  const budget = { visit: 1400, raw: 2600, activity: 600, path: 260 }
  const visible = [...sample(visits, budget.visit), ...sample(raw, budget.raw),
    ...sample(activities, budget.activity), ...sample(paths, budget.path)]
  const focus = selected && events.find((event) => event.id === selected)
  if (focus && !visible.includes(focus)) visible.unshift(focus)
  const points: Position[] = []
  const dayCache = new Map<number, string>()
  const dayAt = (ms: number) => {
    const known = dayCache.get(ms)
    if (known) return known
    const result = dayKey(ms, zone)
    dayCache.set(ms, result)
    return result
  }
  let remaining = 12_000
  data.omitted = Math.max(0, visits.length - budget.visit) + Math.max(0, raw.length - budget.raw) +
    Math.max(0, activities.length - budget.activity) + Math.max(0, paths.length - budget.path)
  for (const event of visible) {
    const linked = event.kind === 'path' ? experience.measurements.links.get(event.id) : undefined
    const eventMode = event.kind === 'activity' ? event.mode : linked?.mode
    const properties = { recordId: event.id, mode: eventMode ?? 'unknown' } satisfies MapProperties
    const bounds = evidenceBounds(event)
    const row: MapRow = {
      id: event.id, kind: event.kind, mode: eventMode,
      day: bounds ? dayAt(Math.max(bounds.start, window?.start ?? bounds.start)) : null,
      label: event.kind === 'visit' ? event.label : undefined,
      area: event.kind === 'visit' ? locate?.(event.coord) : event.kind === 'raw' ? locate?.(event.point.coord) : undefined,
    }
    const before = points.length
    const addPoint = (coord: Coordinate | undefined, source: FeatureCollection<Point, MapProperties>) => {
      if (!coord) return
      const feature = point(coord, properties)
      source.features.push(feature)
      points.push(feature.geometry.coordinates)
    }
    if (event.kind === 'visit') addPoint(event.coord, data.visits)
    if (event.kind === 'raw') addPoint(event.point.coord, data.positions)
    if (event.kind === 'activity') {
      if (contains(event.start.ms, window)) addPoint(event.startCoord, data.ends)
      if (contains(event.end.ms, window)) addPoint(event.endCoord, data.ends)
    }
    if (event.kind === 'path') {
      const lines = pathLines(event, experience, window)
      for (const line of lines) {
        if (remaining < 2) { data.omitted++; break }
        const reduced = sample(line, Math.min(220, remaining))
        remaining -= reduced.length
        data.paths.features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: reduced }, properties })
        points.push(...reduced)
      }
      if (!lines.length && remaining > 0) {
        const available = event.points.filter((point) => point.time && contains(point.time.ms, window))
        const max = Math.min(120, remaining)
        const observed = max === 1 ? available.slice(0, 1) : sample(available, max)
        if (observed.length < available.length) data.omitted++
        for (const entry of observed) addPoint(entry.coord, data.tracePoints)
        remaining -= observed.length
      }
    }
    if (points.length > before) { data.rows.push(row); data.mapped++ }
  }
  data.bounds = mapBounds(points)
  return data
}
