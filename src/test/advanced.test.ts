import { expect, test } from 'vitest'
import { analytics, movementHistogram, percentChange } from '../domain/analytics'
import { Exploration, knownMeters } from '../domain/exploration'
import { PlaceIndex } from '../domain/places'
import { mergeTrips, splitTrip, tripsView } from '../domain/trips'
import { prepare } from '../workers/prepare'
import type { Edit, Trip } from '../domain/edits'

const hour = 3_600_000
const visit = (startTime: string, endTime: string, lat: number, lon: number, placeId?: string, name?: string) =>
  ({ startTime, endTime, visit: { topCandidate: { placeLocation: { lat, lon }, placeId, name } } })
const activity = (startTime: string, endTime: string, distanceMeters: number, type = 'WALKING') =>
  ({ startTime, endTime, activity: { distanceMeters, topCandidate: { type } } })

async function normalize(rows: unknown[]) {
  return (await prepare([new File([JSON.stringify(rows)], 'synthetic-advanced.json')], 'UTC', () => {})).events
}

const query = { search: '', sort: 'visits', page: 0, locale: 'en-US' } as const

test('groups stable source IDs and nearby unnamed anchors without conflating distinct IDs', async () => {
  const data = await normalize([
    visit('2025-05-01T10:00:00Z', '2025-05-01T11:00:00Z', -44, -141, 'A', 'Synthetic A'),
    visit('2025-05-01T10:30:00Z', '2025-05-01T11:30:00Z', -44.02, -141, 'A'),
    visit('2025-05-01T13:00:00Z', '2025-05-01T14:00:00Z', -44, -141, 'B', 'Synthetic B'),
    visit('2025-05-01T15:00:00Z', '2025-05-01T16:00:00Z', 0, 179.9999),
    visit('2025-05-01T16:30:00Z', '2025-05-01T17:00:00Z', 0, -179.9999),
  ])
  const result = new PlaceIndex(data).withEdits([]).list(query)
  expect(result.scoped).toBe(3)
  expect(result.rows.find(({ name }) => name === 'Synthetic A')).toMatchObject({ count: 2, duration: 1.5 * hour })
  expect(result.rows.find(({ name }) => name === 'Synthetic B')?.count).toBe(1)
  expect(result.rows.find(({ name }) => !name)?.count).toBe(2)
})

test('replays labels and merge/split against immutable visits and survives an earlier added anchor', async () => {
  const initial = [
    visit('2025-05-03T08:00:00Z', '2025-05-03T09:00:00Z', -44, -141),
    visit('2025-05-04T08:00:00Z', '2025-05-04T09:00:00Z', -44, -140.9999),
    visit('2025-05-06T08:00:00Z', '2025-05-06T09:00:00Z', -44.2, -141, 'B', 'Synthetic B'),
  ]
  const events = await normalize(initial)
  const snapshot = structuredClone(events)
  const base = new PlaceIndex(events)
  const [a, b] = base.withEdits([]).list(query).rows
  if (!a || !b) throw new Error('synthetic setup')
  const label: Edit = { kind: 'label', visit: a.target, label: { name: 'My synthetic dock', tags: ['harbor'], category: 'home' } }
  const grouped = base.withEdits([label, { kind: 'merge', from: b.target, into: a.target }])
  expect(grouped.list({ ...query, search: 'HARBOR' }).rows[0]).toMatchObject({ name: 'My synthetic dock', count: 3 })
  expect(grouped.homes()).toHaveLength(1)
  const split = base.withEdits([label, { kind: 'merge', from: b.target, into: a.target }, { kind: 'split', visit: b.target }])
  expect(split.list(query).rows.map(({ count }) => count)).toEqual([2, 1])
  expect(events).toEqual(snapshot)
  expect(base.withEdits([]).list(query).rows[0]?.name).toBeUndefined()
  const expanded = await normalize([visit('2025-05-02T08:00:00Z', '2025-05-02T09:00:00Z', -44, -141), ...initial])
  const refreshed = new PlaceIndex(expanded).withEdits([label]).list(query)
  expect(refreshed.rows[0]).toMatchObject({ name: 'My synthetic dock', count: 3 })
})

test('requires a confirmed home and a continuous away visit around midnight for suggestions', async () => {
  const away = await normalize([
    visit('2025-05-05T21:00:00Z', '2025-05-06T03:00:00Z', -39, -141, 'away'),
    visit('2025-05-08T21:00:00Z', '2025-05-08T23:00:00Z', -39, -141, 'away'),
    visit('2025-05-09T01:00:00Z', '2025-05-09T03:00:00Z', -39, -141, 'away'),
    visit('2025-05-10T23:30:00Z', '2025-05-11T07:00:00Z', -39, -141, 'away'),
  ])
  const archive = new Exploration(away)
  const options = { zone: 'UTC', range: { kind: 'all' }, distance: 50 } as const
  const home = { lat: -44, lon: -141 }
  expect(tripsView(archive, [], [], options).suggestions).toHaveLength(0)
  expect(tripsView(archive, [], [home, home], options).homeStatus).toBe('multiple')
  const result = tripsView(archive, [], [home], options)
  expect(result.suggestions).toHaveLength(1)
  expect(result.suggestions[0]).toMatchObject({ first: '2025-05-05', last: '2025-05-06', observedMs: 6 * hour })
  const saved = { id: 'a', first: '2025-05-05', last: '2025-05-06', name: 'Synthetic trip', zone: 'UTC' }
  expect(tripsView(archive, [saved], [home], options).suggestions).toHaveLength(0)
  expect(tripsView(archive, [], [home], { ...options, distance: 800 }).suggestions).toHaveLength(0)
  const conflict = await normalize([
    visit('2025-05-05T21:00:00Z', '2025-05-06T03:00:00Z', -39, -141, 'away'),
    visit('2025-05-06T00:00:00Z', '2025-05-06T00:30:00Z', home.lat, home.lon, 'home'),
  ])
  expect(tripsView(new Exploration(conflict), [], [home], options).suggestions).toHaveLength(0)
})

test('trip split and merge preserve adjacent time windows and reject incompatible zones', () => {
  const saved: Trip = { id: 'a', zone: 'UTC', name: 'Synthetic trip', first: '2025-05-03', last: '2025-05-05' }
  const parts = splitTrip(saved, '2025-05-04', 'b')
  if (!parts) throw new Error('synthetic setup')
  expect(parts[0].last).toBe('2025-05-03')
  expect(parts[1].first).toBe('2025-05-04')
  expect(mergeTrips(...parts)).toEqual(saved)
  expect(mergeTrips(parts[0], { ...parts[1], zone: 'America/New_York' })).toBeUndefined()
})

test('default comparison has equal civil days and suppresses percentages for zero or missing baseline', async () => {
  const events = await normalize([
    activity('2025-03-08T16:00:00Z', '2025-03-08T17:00:00Z', 0),
    activity('2025-03-09T16:00:00Z', '2025-03-09T17:30:00Z', 1200),
  ])
  const archive = new Exploration(events)
  const result = analytics(archive, 'America/New_York', { first: '2025-03-09', last: '2025-03-09' })
  expect(result.previous).toMatchObject({ first: '2025-03-08', last: '2025-03-08', days: 1 })
  expect(result.current.days).toBe(1)
  expect(knownMeters(result.previous.summary.distance)).toBe(0)
  expect(result.change.distance).toBeNull()
  expect(result.change.movement).toBe(.5)
  expect(result.modes).toEqual([{ mode: 'walking', ms: 1.5 * hour, meters: 1200, recorded: 1200, estimated: null }])
  expect(percentChange(1, null)).toBeNull()
})

test('histogram conserves observed time on repeated and half-hour DST transitions', async () => {
  const repeated = await normalize([
    activity('2025-11-02T05:15:00Z', '2025-11-02T06:45:00Z', 1000),
    activity('2025-11-02T05:30:00Z', '2025-11-02T06:30:00Z', 1200, 'CYCLING'),
  ])
  const autumn = movementHistogram(repeated, 'America/New_York')
  expect(autumn.byHour[1]).toBe(1.5 * hour)
  expect(autumn.byWeekday[6]).toBe(1.5 * hour)
  expect(autumn.total).toBe(1.5 * hour)
  const skipped = await normalize([activity('2025-10-04T15:20:00Z', '2025-10-04T16:00:00Z', 1000)])
  const spring = movementHistogram(skipped, 'Australia/Lord_Howe')
  expect(spring.byHour[1]).toBe(10 * 60_000)
  expect(spring.byHour[2]).toBe(30 * 60_000)
  expect(spring.total).toBe(40 * 60_000)
})
