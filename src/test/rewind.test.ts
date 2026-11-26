import { expect, test } from 'vitest'
import { Exploration } from '../domain/exploration'
import type { Event } from '../domain/model'
import { PlaceIndex } from '../domain/places'
import { dayWindow } from '../domain/primitives'
import { buildReplay, replayFrame, replayLimit, replayStep } from '../domain/replay'
import { rewind } from '../domain/rewind'
import { shareMeasurements } from '../domain/share-card'
import { demoFile } from '../fixtures/demo'
import { prepare } from '../workers/prepare'

const range = (day: string) => dayWindow(day, 'UTC')
const ms = (moment: string) => Date.parse(moment)
async function normalize(input: unknown) {
  return (await prepare([new File([JSON.stringify(input)], 'synthetic-rewind.json')], 'UTC', () => {})).events
}
function report(events: Event[], day: string, view: 'month' | 'year' = 'month', window?: { start: number; end: number },
  now = ms('2026-11-26T10:00:00Z')) {
  return rewind(new Exploration(events), 'UTC', day, view, new PlaceIndex(events).withEdits([]), window, now)
}

test('replay holds only an observed point between accepted adjacent edges and clears it in gaps', async () => {
  const data = await normalize([{ timelinePath: [
    { point: 'geo:-44,-141', time: '2025-05-03T10:00:00Z' },
    { point: 'geo:-44,-140.99', time: '2025-05-03T10:10:00Z' },
    { point: 'geo:-44,-140.98', time: '2025-05-03T11:00:00Z' },
    { point: 'geo:-44,-140.97', time: '2025-05-03T11:10:00Z' },
    { point: 'geo:-44,-140.96' },
  ] }])
  const replay = buildReplay(new Exploration(data))
  if (replay.kind !== 'ready') throw new Error('synthetic setup')
  expect(replay.gaps).toBe(1)
  expect(replay.samples).toHaveLength(4)
  expect(replayFrame(replay.samples, ms('2025-05-03T10:01:00Z'))).toMatchObject({
    kind: 'held', coord: { lat: -44, lon: -141 },
  })
  expect(replayFrame(replay.samples, ms('2025-05-03T10:20:00Z'))).toEqual({ kind: 'gap' })
  expect(replayStep(replay.samples, ms('2025-05-03T10:20:00Z'), 1)).toBe(ms('2025-05-03T11:00:00Z'))
  expect(replayStep(replay.samples, ms('2025-05-03T10:20:00Z'), -1)).toBe(ms('2025-05-03T10:10:00Z'))
  expect(buildReplay(new Exploration(data), range('2025-05-04'))).toEqual({ kind: 'empty' })
  expect(buildReplay(new Exploration(data), undefined, 'walking')).toEqual({ kind: 'empty' })
})

test('replay deduplicates matching observations and leaves raw intervals and simultaneous conflicts unlocated', async () => {
  const data = await normalize({ locations: [
    { timestamp: '2025-05-03T08:00:00Z', latitudeE7: -441000000, longitudeE7: -1410000000, accuracy: 10 },
    { timestamp: '2025-05-03T08:00:00Z', latitudeE7: -441000000, longitudeE7: -1410000000, accuracy: 20 },
    { timestamp: '2025-05-03T08:01:00Z', latitudeE7: -441010000, longitudeE7: -1410000000 },
    { timestamp: '2025-05-03T08:02:00Z', latitudeE7: -441020000, longitudeE7: -1410000000 },
    { timestamp: '2025-05-03T08:02:00Z', latitudeE7: -443000000, longitudeE7: -1410000000 },
  ] })
  const replay = buildReplay(new Exploration(data))
  if (replay.kind !== 'ready') throw new Error('synthetic setup')
  expect(replay.samples).toHaveLength(3)
  expect(replay.conflicts).toBe(1)
  expect(replayFrame(replay.samples, ms('2025-05-03T08:00:30Z'))).toEqual({ kind: 'gap' })
  expect(replayFrame(replay.samples, ms('2025-05-03T08:02:00Z'))).toEqual({ kind: 'conflict' })
  const raw = data.find((event) => event.kind === 'raw')
  if (!raw) throw new Error('synthetic setup')
  const large = Array.from({ length: replayLimit + 1 }, (_value, index) => ({ ...raw, id: String(index) }))
  expect(buildReplay(new Exploration(large))).toEqual({ kind: 'limit' })
})

test('rewind matches the selected scope and omits future periods and unavailable comparisons', async () => {
  const { events } = await prepare([demoFile()], 'UTC', () => {})
  const year = report(events, '2025-05-03', 'year')
  expect(year).toMatchObject({ partial: true, expectedDays: 365, includedDays: 365, summary: { evidenceDays: 8 } })
  expect(year.chapters).toEqual(['coverage', 'distance', 'movement', 'places', 'highlightDay', 'longestJourney'])
  const oneDay = report(events, '2025-05-03', 'month', range('2025-05-03'))
  expect(oneDay).toMatchObject({ partial: true, includedDays: 1, expectedDays: 31, summary: { evidenceDays: 1 } })
  expect(oneDay.chapters).not.toContain('longestJourney')
  const elapsed = report(events, '2025-05-03', 'month', undefined, ms('2025-05-03T09:20:00Z'))
  expect(elapsed).toMatchObject({ partial: true, includedDays: 3, summary: { evidenceDays: 1, movementMs: 300_000 } })
  expect(report(events, '2027-01-01').chapters).toEqual([])
})

test('show recorded longest activity and compare same-length earlier evidence only with a positive baseline', async () => {
  const activity = (month: string, distanceMeters: number) => ({
    startTime: '2025-' + month + '-03T08:00:00Z', endTime: '2025-' + month + '-03T09:00:00Z',
    activity: { distanceMeters, topCandidate: { type: 'WALKING' } },
  })
  const rows = [activity('04', 1000), activity('05', 2000)]
  const value = report(await normalize(rows), '2025-05-03')
  expect(value.longest).toEqual({ day: '2025-05-03', meters: 2000, mode: 'walking' })
  expect(value.compare).toMatchObject({
    change: 1, currentDays: 1, previousDays: 1, dates: { first: '2025-03-31', last: '2025-04-30' },
  })
  expect(report(await normalize([activity('04', 0), rows[1]]), '2025-05-03').compare).toBeUndefined()
})

test('share projection contains only selected aggregates and preserves source distance attribution', async () => {
  const { events } = await prepare([demoFile()], 'UTC', () => {})
  const value = report(events, '2025-05-03')
  expect(value.places.some(({ name }) => name === 'Paper Bay')).toBe(true)
  const share = shareMeasurements(value, ['coverage', 'distance', 'visits'])
  expect(share).toMatchObject([
    { kind: 'coverage', count: 8, total: 31 }, { kind: 'distance', recorded: 11240 },
    { kind: 'visits', count: 8 },
  ])
  expect(JSON.stringify(share)).not.toMatch(/Paper Bay|2025-05|coord|source|walking/)
  expect(shareMeasurements(value, [])).toEqual([])
  const raw = await normalize({ locations: [{
    timestamp: '2025-05-03T08:00:00Z', latitudeE7: -441000000, longitudeE7: -1410000000,
  }] })
  expect(shareMeasurements(report(raw, '2025-05-03'), ['coverage', 'distance', 'movement', 'visits']))
    .toEqual([{ kind: 'coverage', count: 1, total: 31 }])
})
