import { describe, expect, test } from 'vitest'
import { mergeEvents } from '../domain/identity'
import { limits } from '../domain/limits'
import { dayWindow, distanceMeters, readCoordinate, readTime } from '../domain/primitives'
import { summarize } from '../domain/summary'
import { demoFile } from '../fixtures/demo'
import android from '../fixtures/synthetic-android.json'
import ios from '../fixtures/synthetic-ios.json'
import semantic from '../fixtures/synthetic-legacy-semantic.json'
import raw from '../fixtures/synthetic-legacy-raw.json'
import partial from '../fixtures/synthetic-partial.json'
import unknown from '../fixtures/synthetic-unknown.json'
import { prepare } from '../workers/prepare'

const hour = 3_600_000
const file = (value: unknown) => new File([JSON.stringify(value)], 'synthetic.json')
const parse = (value: unknown, zone = 'UTC') => prepare([file(value)], zone, () => {})

describe('fixture import', () => {
  test.each([
    ['android', android, { visit: 1, activity: 1, path: 1, raw: 0 }],
    ['ios', ios, { visit: 1, activity: 1, path: 1, raw: 0 }],
    ['legacySemantic', semantic, { visit: 1, activity: 1, path: 1, raw: 0 }],
    ['legacyRaw', raw, { visit: 0, activity: 0, path: 0, raw: 2 }],
  ] as const)('detects %s and counts canonical events', async (format, input, kinds) => {
    const result = await parse(input)
    expect(result.diagnostics.files[0]?.format).toBe(format)
    expect(result.diagnostics.files[0]?.skipped).toBe(0)
    expect(result.summary?.kinds).toEqual(kinds)
  })

  test('reports mixed invalid records, unknown transport, and missing distance without losing valid parts', async () => {
    const result = await parse(partial)
    expect(result.summary?.kinds).toEqual({ visit: 1, activity: 1, path: 0, raw: 0 })
    expect(result.diagnostics.files[0]).toMatchObject({ input: 5, accepted: 2, skipped: 3 })
    expect(result.diagnostics.counts).toMatchObject({
      invalidCoord: 1, invalidTime: 1, unknownMode: 1, missingCoord: 2, invalidDistance: 1,
      unknownRecord: 1, invalidRecord: 1,
    })
    expect(result.summary?.distance).toMatchObject({ recorded: null, estimated: null, unknownActivities: 1 })
    expect(result.events.find((event) => event.kind === 'activity')?.originalMode).toBe('FUTURE_SYNTHETIC_TRANSPORT')
  })

  test('distinguishes unknown, empty, truncated and invalid UTF-8 alongside a good file', async () => {
    const result = await prepare([
      file(unknown), file({ semanticSegments: [] }), new File(['{"locations":['], 'synthetic-truncated.json'),
      new File([new Uint8Array([0xff])], 'synthetic-encoding.json'), file(raw),
    ], 'UTC', () => {})
    expect(result.diagnostics.files.map(({ failure, input }) => [failure, input])).toEqual([
      ['unknownFormat', 0], [undefined, 0], ['invalidJson', 0], ['invalidJson', 0], [undefined, 2],
    ])
    expect(result.summary?.kinds.raw).toBe(2)
    expect((await parse([])).summary).toBeNull()
  })

  test('rejects oversized selection and deep input with explicit diagnostics', async () => {
    await expect(prepare(Array.from({ length: limits.fileCount + 1 }, () => file({})), 'UTC', () => {}))
      .rejects.toMatchObject({ code: 'tooManyFiles' })
    let nested: unknown = 'synthetic'
    for (let level = 0; level <= limits.depth; level++) nested = { nested }
    expect((await parse({ semanticSegments: [], nested })).diagnostics.files[0]?.failure).toBe('inputLimit')
  })

  test('ignores reserved JSON keys and keeps diagnostics structural', async () => {
    const content = JSON.stringify(android).replace('"rawSignals":',
      '"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"rawSignals":')
    const result = await prepare([new File([content], 'synthetic-private-name.json')], 'UTC', () => {})
    expect(result.diagnostics.counts.unsafeKey).toBe(3)
    expect(result.summary?.kinds.visit).toBe(1)
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false)
    expect(JSON.stringify(result.diagnostics.report())).not.toMatch(/Paper Harbor|private-name|polluted|-141\.2/)
  })

  test('emits correctly bounded progress and imports a separate synthetic demo', async () => {
    const phases: string[] = []
    const result = await prepare([demoFile()], 'UTC', ({ phase }) => phases.push(phase))
    expect(phases).toEqual(['read', 'normalize', 'analyze'])
    expect(result.summary).toMatchObject({ kinds: { visit: 8, activity: 8, path: 8, raw: 0 }, evidenceDays: 8 })
    expect(result.summary?.distance.recorded).toBe(11_240)
    expect(result.summary?.distance.estimated).toBeGreaterThan(6000)
  })

  test('deduplicates reimports, retains distinct provenance and flags near duplicates', async () => {
    const androidAgain = await parse(android)
    const twoFiles = await prepare([file(android), file(android)], 'UTC', () => {})
    expect(twoFiles.diagnostics.duplicates).toBe(3)
    expect(twoFiles.events).toHaveLength(3)
    expect(twoFiles.events.every((item) => item.additionalSources?.length === 0)).toBe(true)
    const reordered = await parse({ semanticSegments: [...android.semanticSegments].reverse() })
    const merged = mergeEvents(androidAgain.events, reordered.events)
    expect(merged.duplicates).toBe(3)
    expect(merged.events).toHaveLength(3)
    expect(merged.events.every((item) => item.additionalSources?.length === 1)).toBe(true)
    const original = android.semanticSegments[0]
    const near = await parse({ semanticSegments: [original, {
      ...original, startTime: '2025-02-02T15:01:00+03:00', endTime: '2025-02-02T16:31:00+03:00',
    }] })
    expect(near.summary?.kinds.visit).toBe(2)
    expect(near.summary?.quality.nearDuplicate).toBe(1)
  })
})

describe('time and geography', () => {
  test('validates explicit offsets and leap days without inferring a local zone', () => {
    expect(readTime('2024-02-29T23:30:00+03:30')).toMatchObject({ ms: Date.UTC(2024, 1, 29, 20), offset: 210 })
    expect(readTime('2025-02-29T23:30:00Z')).toBeUndefined()
    expect(readTime('2024-02-29T23:30:00')).toBeUndefined()
    expect(readTime('2024-02-29T23:30:00-00:00')).toBeUndefined()
    expect(readTime('2024-02-29T24:00:00Z')).toBeUndefined()
  })

  test('uses short and long DST days, and a half-open midnight boundary', async () => {
    const march = dayWindow('2025-03-09', 'America/New_York')
    const november = dayWindow('2025-11-02', 'America/New_York')
    expect(march.end - march.start).toBe(23 * hour)
    expect(november.end - november.start).toBe(25 * hour)
    const { events, summary } = await parse(semantic)
    expect(summary?.evidenceDays).toBe(2)
    expect(summarize(events, 'UTC', dayWindow('2024-02-29', 'UTC')).visitMs).toBe(hour / 2)
    expect(summarize(events, 'UTC', dayWindow('2024-03-01', 'UTC')).visitMs).toBe(hour / 2)
    expect(summarize(events, 'UTC', dayWindow('2024-03-02', 'UTC')).evidenceDays).toBeNull()
  })

  test('checks coordinate variants, order, bounds and antimeridian distance', () => {
    expect(readCoordinate({ latitudeE7: 125000000, longitudeE7: -1420000000 })).toEqual({ lat: 12.5, lon: -142 })
    expect(readCoordinate('geo:12.5,-142')).toEqual({ lat: 12.5, lon: -142 })
    expect(readCoordinate('-142°, 12.5°')).toBeUndefined()
    expect(readCoordinate({ lat: 0, lon: 0 })).toEqual({ lat: 0, lon: 0 })
    expect(readCoordinate({ latitudeE7: 1.5, longitudeE7: 0 })).toBeUndefined()
    expect(distanceMeters({ lat: 0, lon: 179.995 }, { lat: 0, lon: -179.995 })).toBeCloseTo(1111.95, 1)
  })
})

describe('summary metrics', () => {
  test('prefers source distance and conserves partial-window estimates', async () => {
    const { events, summary } = await parse(android)
    expect(summary?.distance).toMatchObject({ recorded: 2450, estimated: null })
    const start = Date.parse('2025-02-02T13:30:00Z')
    const mid = start + 15 * 60_000
    const left = summarize(events, 'UTC', { start, end: mid })
    const right = summarize(events, 'UTC', { start: mid, end: start + 30 * 60_000 })
    expect(left.distance.recorded).toBeNull()
    expect(left.distance.estimated).toBe(1225)
    expect(right.distance.estimated).toBe(1225)
    expect(left.movementMs).toBe(900_000)
  })

  test('uses attributed timed path across antimeridian and honors source offsets', async () => {
    const { summary, events } = await parse(ios, 'America/New_York')
    expect(events.find((event) => event.kind === 'visit')).toMatchObject({
      start: { offset: -300 }, end: { offset: -240 }, placeId: 'synthetic-meridian',
    })
    expect(events.find((event) => event.kind === 'activity')).toMatchObject({ mode: 'cycling', originalMode: 'on bicycle' })
    expect(summary?.distance.recorded).toBeNull()
    expect(summary?.distance.estimated).toBeCloseTo(876.23, 0)
    expect(summary?.visitMs).toBe(hour)
    expect(summary?.movementMs).toBe(hour / 3)
    expect(summary?.stablePlaceCount).toBe(1)
  })

  test('allocates recorded distance by complete timed path rather than equal duration', async () => {
    const start = '2025-03-01T12:00:00Z'
    const mid = '2025-03-01T12:15:00Z'
    const end = '2025-03-01T12:30:00Z'
    const { events } = await parse([{
      startTime: start, endTime: end,
      activity: { start: 'geo:0,0', end: 'geo:0,0.04', distanceMeters: 4_000, topCandidate: { type: 'CYCLING' } },
      timelinePath: [
        { point: 'geo:0,0', time: start }, { point: 'geo:0,0.01', time: mid }, { point: 'geo:0,0.04', time: end },
      ],
    }])
    expect(summarize(events, 'UTC', { start: Date.parse(start), end: Date.parse(mid) }).distance.estimated)
      .toBeCloseTo(1000)
    expect(summarize(events, 'UTC', { start: Date.parse(mid), end: Date.parse(end) }).distance.estimated)
      .toBeCloseTo(3000)
  })

  test('ignores GPS jumps and does not bridge malformed path points', async () => {
    const points = [
      { point: 'geo:0,0', time: '2025-03-01T00:00:00Z' },
      { point: 'geo:0,0', time: '2025-03-01T00:05:00Z' },
      { point: 'geo:0,120', time: '2025-03-01T00:06:00Z' },
      { point: 'broken', time: '2025-03-01T00:07:00Z' },
      { point: 'geo:0,120.01', time: '2025-03-01T00:30:00Z' },
      { point: 'geo:0,120.02', time: '2025-03-01T01:10:00Z' },
    ]
    const result = await parse([{ timelinePath: points }])
    expect(result.diagnostics.counts.invalidPoint).toBe(1)
    expect(result.summary?.quality.pathGap).toBe(2)
    expect(result.summary?.distance.estimated).toBe(0)
  })

  test('unions observed intervals across types and excludes conflicting activity distance', async () => {
    const activity = android.semanticSegments[1]?.activity
    const result = await parse({ semanticSegments: [
      android.semanticSegments[0],
      { startTime: '2025-02-02T13:00:00Z', endTime: '2025-02-02T13:45:00Z', activity },
      { startTime: '2025-02-02T13:30:00Z', endTime: '2025-02-02T14:00:00Z', activity },
    ] })
    expect(result.summary).toMatchObject({
      observedMs: 2 * hour, movementMs: hour, visitMs: 1.5 * hour,
      distance: { recorded: null, estimated: null, excludedActivities: 2 }, quality: { overlap: 2 },
    })
  })

  test('keeps recorded zero, raw-only capabilities, and untimed waypoints distinct', async () => {
    const legacy = await parse(semantic)
    expect(legacy.summary?.distance.recorded).toBe(0)
    expect(legacy.events.find((event) => event.kind === 'path')?.points.every((point) => !point.time)).toBe(true)
    const positions = await parse(raw)
    expect(positions.summary).toMatchObject({
      evidenceDays: 2, movementMs: null, visitMs: null, stablePlaceCount: null,
      distance: { recorded: null, estimated: null },
    })
  })
})
