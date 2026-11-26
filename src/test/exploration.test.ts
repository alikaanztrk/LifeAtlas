import { expect, test } from 'vitest'
import { dayKey, periodRange, rangeWindow } from '../domain/dates'
import { Exploration, knownMeters, modeTime } from '../domain/exploration'
import { buildMap, mapBounds, splitAntimeridian } from '../domain/map-data'
import { dayWindow } from '../domain/primitives'
import { prepare } from '../workers/prepare'
import ios from '../fixtures/synthetic-ios.json'
import legacyRaw from '../fixtures/synthetic-legacy-raw.json'
import { tileAddress, tileTemplate } from '../maps/online-policy'

async function archive(input: unknown) {
  const { events } = await prepare([new File([JSON.stringify(input)], 'synthetic.json')], 'UTC', () => {})
  return new Exploration(events)
}

function activity(start: string, end: string, distanceMeters: number, type = 'WALKING') {
  return { startTime: start, endTime: end, activity: { distanceMeters, topCandidate: { type } } }
}

test('day and chart windows share recorded allocation across midnight', async () => {
  const data = await archive([activity('2025-05-03T23:50:00Z', '2025-05-04T00:10:00Z', 1000)])
  const calendar = data.calendar('2025-05-01', 'month', 'UTC')
  expect(calendar.slice(2, 4).map(({ meters, movementMs }) => [meters, movementMs]))
    .toEqual([[500, 600_000], [500, 600_000]])
  const day = data.day('2025-05-04', 'UTC')
  expect(day.rows.find((row) => row.kind === 'activity')).toMatchObject({
    clipped: true, start: Date.parse('2025-05-04T00:00:00Z'), distance: { kind: 'estimated', meters: 500 },
  })
  expect(day.rows.some((row) => row.kind === 'gap')).toBe(true)
  const overview = data.overview('UTC')
  expect(overview.periods.map(({ movementMs }) => movementMs)).toEqual([600_000, 600_000])
  expect(knownMeters(overview.summary.distance)).toBe(1000)
})

test('shared filtering keeps distance exclusions from the full archive', async () => {
  const data = await archive([
    activity('2025-05-01T23:45:00Z', '2025-05-02T00:00:00Z', 900),
    activity('2025-05-01T23:55:00Z', '2025-05-02T00:15:00Z', 1300, 'CYCLING'),
  ])
  const next = dayWindow('2025-05-02', 'UTC')
  const filtered = data.summary('UTC', next)
  expect(filtered.distance).toMatchObject({ recorded: null, estimated: null, excludedActivities: 1 })
  expect(data.day('2025-05-02', 'UTC').rows.find((row) => row.kind === 'activity')?.distance?.kind).toBe('overlap')
  expect(modeTime(data.events())).toEqual([
    { mode: 'cycling', ms: 900_000 }, { mode: 'walking', ms: 600_000 }, { mode: 'unknown', ms: 300_000 },
  ])
})

test('calendar distinguishes no evidence, known zero, and days outside the shared range', async () => {
  const data = await archive([activity('2025-05-03T10:00:00Z', '2025-05-03T11:00:00Z', 0)])
  const day = dayWindow('2025-05-03', 'UTC')
  const calendar = data.calendar('2025-05-01', 'month', 'UTC', { start: day.start, end: day.end + 86_400_000 })
  expect(calendar.slice(1, 4).map(({ status, meters }) => [status, meters])).toEqual([
    ['outside', null], ['evidence', 0], ['empty', null],
  ])
  const march = rangeWindow(periodRange('2025-03-09', 'month'), 'America/New_York')
  expect(march?.end).toBe(Date.parse('2025-04-01T04:00:00Z'))
  expect(dayKey(march?.start ?? 0, 'America/New_York')).toBe('2025-03-01')
})

test('map keeps observed paths, antimeridian continuity, and raw-only semantics', async () => {
  const traces = buildMap(await archive(ios), 'UTC')
  expect(traces.paths.features).toHaveLength(2)
  expect(traces.paths.features[0]?.geometry.coordinates.at(-1)?.[0]).toBe(180)
  expect(traces.paths.features[1]?.geometry.coordinates[0]?.[0]).toBe(-180)
  expect(traces.bounds).not.toBeNull()
  const [west,, east] = traces.bounds ?? [0, 0, 360, 0]
  expect(east - west).toBeLessThan(.02)
  expect(mapBounds([[0, 0], [1, 2]])).toEqual([0, 0, 1, 2])
  expect(splitAntimeridian({ lon: -179, lat: 25 }, { lon: 179, lat: 27 })[0]?.[1]).toEqual([-180, 26])
  const positions = await archive(legacyRaw)
  expect(positions.overview('UTC').modes).toEqual([])
  const map = buildMap(positions, 'UTC')
  expect(map.visits.features).toHaveLength(0)
  expect(map.positions.features).toHaveLength(2)
})

test('map skips invalid gaps and never draws a route between activity endpoints', async () => {
  const timeline = await archive([{
    ...activity('2025-05-03T10:00:00Z', '2025-05-03T11:00:00Z', 1005),
    timelinePath: [
      { point: 'geo:-40,-141', time: '2025-05-03T10:02:00Z' },
      { point: 'broken', time: '2025-05-03T10:03:00Z' },
      { point: 'geo:-40,-140.97', time: '2025-05-03T10:07:00Z' },
    ],
  }])
  expect(buildMap(timeline, 'UTC').paths.features).toHaveLength(0)
  expect(buildMap(timeline, 'UTC').positions.features).toHaveLength(0)
  expect(buildMap(timeline, 'UTC').tracePoints.features).toHaveLength(2)
})

test('basemap policy permits only the provider manifest template and valid z/x/y', () => {
  const template = tileTemplate({
    tiles: ['https://tiles.openfreemap.org/planet/20261122_124456_pt/{z}/{x}/{y}.pbf'],
  })
  expect(tileAddress(template, '/5/10/12')).toContain('/5/10/12.pbf')
  expect(() => tileAddress(template, '/15/0/0')).toThrow()
  expect(() => tileAddress(template, '/2/4/0')).toThrow()
  expect(() => tileAddress(template, '/2/2/0?data=private')).toThrow()
  expect(() => tileTemplate({ tiles: [template.replace('tiles.openfreemap.org', 'other.invalid')] })).toThrow()
})
