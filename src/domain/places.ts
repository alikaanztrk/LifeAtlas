import type { Edit, PlaceLabel } from './edits'
import type { Coordinate, Event, Visit } from './model'
import { clip, contains, distanceMeters, mergeIntervals, toWindow } from './primitives'
import type { Window } from './primitives'

type Place = { key: string; members: Visit[]; anchor?: Coordinate; label?: PlaceLabel }
export type PlaceSort = 'visits' | 'duration' | 'recent' | 'name'
export type PlaceSummary = {
  key: string; target: string; name?: string; label?: PlaceLabel; count: number; total: number;
  duration: number; first: number; last: number; anchor?: Coordinate
}
export type PlaceVisit = Window & { id: string; dayAt: number }

const radius = 100
const earth = 6_371_008.8
const order = (a: Visit, b: Visit) => a.start.ms - b.start.ms || a.id.localeCompare(b.id)

function spatialCell(coord: Coordinate) {
  const lat = coord.lat * Math.PI / 180
  const lon = coord.lon * Math.PI / 180
  const scale = earth / radius
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
    .map((value) => Math.floor(value * scale)) as [number, number, number]
}

function groupPlaces(events: Event[]) {
  const items = new Map<string, Place>()
  const cells = new Map<string, Place[]>()
  for (const visit of events.filter((event) => event.kind === 'visit').sort(order)) {
    if (visit.placeId) {
      const key = 'source:' + visit.placeId
      const group = items.get(key) ?? { key, members: [] }
      group.members.push(visit)
      group.anchor ??= visit.coord
      items.set(key, group)
      continue
    }
    if (!visit.coord) continue
    const cell = spatialCell(visit.coord)
    let nearest: Place | undefined
    let distance = radius
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const key = [cell[0] + dx, cell[1] + dy, cell[2] + dz].join(',')
      for (const candidate of cells.get(key) ?? []) {
        if (!candidate.anchor) continue
        const meters = distanceMeters(candidate.anchor, visit.coord)
        if (meters < distance || (meters <= distance && (!nearest || candidate.key < nearest.key))) {
          nearest = candidate
          distance = meters
        }
      }
    }
    if (nearest) nearest.members.push(visit)
    else {
      const key = 'coordinate:' + visit.id
      const group = { key, members: [visit], anchor: visit.coord }
      const homeCell = cell.join(',')
      const bucket = cells.get(homeCell) ?? []
      bucket.push(group)
      cells.set(homeCell, bucket)
      items.set(key, group)
    }
  }
  return items
}

function replay(base: Map<string, Place>, actions: Edit[]) {
  const groups = new Map(Array.from(base, ([key, place]) => [key, { ...place, members: [...place.members] }]))
  const membership = new Map<string, Place>()
  for (const place of groups.values()) for (const visit of place.members) membership.set(visit.id, place)
  for (const action of actions) {
    if (action.kind === 'trips') continue
    if (action.kind === 'merge') {
      const from = membership.get(action.from)
      const into = membership.get(action.into)
      if (!from || !into || from === into) continue
      into.members.push(...from.members)
      into.label ??= from.label
      into.anchor ??= from.anchor
      groups.delete(from.key)
      for (const visit of from.members) membership.set(visit.id, into)
      continue
    }
    const place = membership.get(action.visit)
    if (!place) continue
    if (action.kind === 'label') { place.label = action.label; continue }
    if (place.members.length <= 1) continue
    const item = place.members.find((member) => member.id === action.visit)
    if (!item) continue
    place.members = place.members.filter((member) => member.id !== item.id)
    place.anchor = place.members.find((member) => member.coord)?.coord
    const split = { key: 'split:' + item.id, members: [item], anchor: item.coord }
    groups.set(split.key, split)
    membership.set(item.id, split)
  }
  return { groups, membership }
}

function visibleVisit(visit: Visit, window?: Window): PlaceVisit | undefined {
  const time = toWindow(visit)
  const interval = clip(time, window) ?? (time.start === time.end && contains(time.start, window) ? time : undefined)
  return interval ? { ...interval, id: visit.id, dayAt: interval.start } : undefined
}

export class PlaceIndex {
  private readonly base: Map<string, Place>

  constructor(events: Event[]) { this.base = groupPlaces(events) }

  withEdits(actions: Edit[]) { return new PlaceCatalog(replay(this.base, actions)) }
}

export class PlaceCatalog {
  constructor(private readonly data: ReturnType<typeof replay>) {}

  homes() {
    return [...this.data.groups.values()].filter((place) => place.label?.category === 'home')
      .map(({ anchor }) => anchor)
  }

  labelFor(visit: string) { return this.data.membership.get(visit)?.label?.name || undefined }

  list(options: { window?: Window; search: string; sort: PlaceSort; page: number; detail?: string; locale: string }) {
    const { window, detail, page, sort, locale } = options
    const search = options.search.trim().toLocaleLowerCase(locale)
    const rows: PlaceSummary[] = []
    let active: { place: PlaceSummary; visits: PlaceVisit[]; more: number } | undefined
    let scoped = 0
    for (const place of this.data.groups.values()) {
      const vis = place.members.flatMap((visit) => {
        const time = visibleVisit(visit, window)
        return time ? [time] : []
      })
      const target = place.members[0]?.id
      if (!vis.length || !target) continue
      scoped++
      const times = mergeIntervals(vis)
      const name = place.label?.name || place.members.find((visit) => visit.label)?.label
      const summary: PlaceSummary = {
        key: target, target, name, label: place.label, count: vis.length, total: place.members.length,
        duration: times.reduce((total, time) => total + time.end - time.start, 0),
        first: times[0]?.start ?? 0, last: times.at(-1)?.end ?? 0,
        anchor: place.anchor,
      }
      if (detail && this.data.membership.get(detail) === place) {
        vis.sort((a, b) => b.start - a.start || a.id.localeCompare(b.id))
        active = { place: summary, visits: vis.slice(0, 100), more: Math.max(0, vis.length - 100) }
      }
      const searchable = [name ?? '', place.label?.tags.join(' ') ?? '', place.label?.category ?? '']
      if (searchable.some((value) => value.toLocaleLowerCase(locale).includes(search))) rows.push(summary)
    }
    const compareName = (a: PlaceSummary, b: PlaceSummary) => (a.name ?? '').localeCompare(b.name ?? '', locale)
    rows.sort((a, b) => (sort === 'duration' ? b.duration - a.duration : sort === 'recent' ? b.last - a.last
      : sort === 'name' ? compareName(a, b) : b.count - a.count) || a.key.localeCompare(b.key))
    const size = 30
    const current = Math.min(page, Math.max(0, Math.ceil(rows.length / size) - 1))
    return { rows: rows.slice(current * size, (current + 1) * size), matches: rows.length, scoped, page: current, size, active }
  }
}
