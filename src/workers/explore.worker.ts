import { dayKey, rangeWindow } from '../domain/dates'
import { Exploration } from '../domain/exploration'
import { limits } from '../domain/limits'
import { buildMap } from '../domain/map-data'
import type { Event } from '../domain/model'
import { clip, dayWindow } from '../domain/primitives'
import { readEvents } from '../storage/database'
import { isExploreRequest } from './explore-protocol'
import type { ExploreQuery, ExploreRequest, ExploreResponse, ExploreResult } from './explore-protocol'
import { analytics } from '../domain/analytics'
import { emptyJournal, tripsFrom } from '../domain/edits'
import { PlaceIndex } from '../domain/places'
import type { PlaceCatalog } from '../domain/places'
import { tripsView } from '../domain/trips'
import type { MapData } from '../domain/map-data'
import { buildReplay } from '../domain/replay'
import { rewind } from '../domain/rewind'

const worker = self as DedicatedWorkerGlobalScope
const send = (message: ExploreResponse) => worker.postMessage(message)
let experience: Exploration | undefined
let initial: Event[] = []
let seeding = false
let seeded = false
const cache = new Map<string, ExploreResult>()
let journal = emptyJournal
let basePlaces: PlaceIndex | undefined
let catalog: PlaceCatalog | undefined

function places(archive: Exploration) {
  basePlaces ??= new PlaceIndex(archive.events())
  catalog ??= basePlaces.withEdits(journal.actions)
  return catalog
}

function labels(archive: Exploration, map: MapData) {
  if (journal.actions.some((edit) => edit.kind === 'label')) {
    const groups = places(archive)
    for (const row of map.rows) if (row.kind === 'visit') row.label = groups.labelFor(row.id) ?? row.label
  }
  return map
}

function ready(events: Event[]) {
  experience = new Exploration(events)
  initial = []
  seeded = true
  send({ type: 'ready' })
}

async function seed(request: Extract<ExploreRequest, { type: 'seed' }>) {
  seeding = true
  if (request.saved) ready(await readEvents(request.saved))
}

function query(data: ExploreQuery, archive: Exploration): ExploreResult {
  const { zone, range } = data
  const bounds = rangeWindow(range, zone)
  if (data.kind === 'overview') {
    const value = archive.overview(zone, bounds)
    const anchor = bounds ? dayKey(bounds.end - 1, zone) : dayKey(value.summary.last ?? Date.now(), zone)
    return { kind: 'overview', value, map: labels(archive, buildMap(archive, zone, bounds)), calendar: archive.calendar(anchor, 'month', zone, bounds) }
  }
  if (data.kind === 'calendar') return { kind: 'calendar', value: archive.calendar(data.day, data.view, zone, bounds) }
  if (data.kind === 'day') {
    const value = archive.day(data.day, zone, bounds)
    if (journal.actions.some((edit) => edit.kind === 'label')) {
      const groups = places(archive)
      for (const row of value.rows) if (row.kind === 'visit') row.label = groups.labelFor(row.id) ?? row.label
    }
    return { kind: 'day', value, map: labels(archive, buildMap(archive, zone, value.bounds ?? { start: 0, end: 0 })) }
  }
  if (data.kind === 'places') {
    const value = places(archive).list({ ...data, window: bounds })
    const map = value.active && labels(archive, buildMap(archive, zone, bounds, undefined, undefined,
      new Set(value.active.visits.map((visit) => visit.id))))
    return { kind: 'places', value, map }
  }
  if (data.kind === 'trips') {
    const value = tripsView(archive, tripsFrom(journal.actions), places(archive).homes(), data)
    const map = value.detail && labels(archive, buildMap(archive, zone, value.detail.window))
    return { kind: 'trips', value, map }
  }
  if (data.kind === 'analytics') {
    const extent = archive.bounds()
    const period = range.kind !== 'all' ? range : extent && { first: dayKey(extent.start, zone), last: dayKey(extent.end - 1, zone) }
    const ranked = period ? places(archive).list({ window: bounds, sort: 'visits', page: 0, search: '', locale: 'en-US' })
      .rows.slice(0, 5).map(({ key, target, name, count }) => ({ key, target, name, count })) : []
    return { kind: 'analytics', value: period ? analytics(archive, zone, period, data.compare) : undefined, places: ranked }
  }
  if (data.kind === 'rewind') return { kind: 'rewind', value: rewind(archive, zone, data.day, data.view,
    places(archive), bounds, Date.now()) }
  const time = data.day ? clip(dayWindow(data.day, zone), bounds) ?? { start: 0, end: 0 } : bounds
  return { kind: 'map', value: labels(archive, buildMap(archive, zone, time, data.mode, data.selected)),
    replay: data.replay ? buildReplay(archive, time, data.mode) : undefined }
}

worker.onmessage = ({ data }: MessageEvent<unknown>) => {
  if (!isExploreRequest(data)) return
  try {
    if (data.type === 'seed' && !seeding) void seed(data).catch(() => send({ type: 'error' }))
    if (data.type === 'batch' && seeding && !seeded) {
      if (initial.length + data.events.length > limits.events) throw new Error()
      for (const event of data.events) initial.push(event)
    }
    if (data.type === 'seedDone' && seeding && !seeded) ready(initial)
    if (data.type === 'journal' && data.journal.revision !== journal.revision) {
      journal = data.journal
      catalog = undefined
      cache.clear()
    }
    if (data.type !== 'query' || !experience) return
    const key = JSON.stringify(data.query)
    const rewindQuery = data.query.kind === 'rewind'
    const value = (rewindQuery ? undefined : cache.get(key)) ?? query(data.query, experience)
    if (!rewindQuery) {
      cache.delete(key)
      cache.set(key, value)
    }
    if (cache.size > 6) {
      const first = cache.keys().next().value
      if (first !== undefined) cache.delete(first)
    }
    send({ type: 'result', sequence: data.sequence, result: value })
  } catch {
    send({ type: 'error', sequence: data.type === 'query' ? data.sequence : undefined })
  }
}
