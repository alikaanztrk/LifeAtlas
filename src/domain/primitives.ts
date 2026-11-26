import { Temporal } from '@js-temporal/polyfill'
import type { Coordinate, Instant, Interval } from './model'
import { field, object } from './json-shape'

export { field, object } from './json-shape'
export type { JsonObject } from './json-shape'
export type Window = { start: number; end: number }

export function string(input: unknown, max = 256): string | undefined {
  return typeof input === 'string' && input.trim() && input.length <= max ? input : undefined
}

export function decimal(input: unknown): number | undefined {
  if (typeof input === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(input.trim())) {
    input = Number(input.trim())
  }
  return typeof input === 'number' && Number.isFinite(input) ? input : undefined
}

export function nonnegative(input: unknown): number | undefined {
  const number = decimal(input)
  return number !== undefined && number >= 0 ? number : undefined
}

export function coordinate(lat: unknown, lon: unknown): Coordinate | undefined {
  if (typeof lat !== 'number' || typeof lon !== 'number' ||
      !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return
  return { lat: lat === 0 ? 0 : lat, lon: Math.abs(lon) === 180 ? -180 : lon === 0 ? 0 : lon }
}

export function readCoordinate(input: unknown): Coordinate | undefined {
  if (typeof input === 'string' && input.length <= 96) {
    const pair = /^(?:geo:\s*)?([+-]?\d+(?:\.\d+)?)\s*°?\s*,\s*([+-]?\d+(?:\.\d+)?)\s*°?$/i.exec(input.trim())
    return pair ? coordinate(Number(pair[1]), Number(pair[2])) : undefined
  }
  const value = object(input)
  if (!value) return
  if (field(value, 'latLng') !== undefined) {
    const nested = field(value, 'latLng')
    return typeof nested === 'string' ? readCoordinate(nested) : undefined
  }
  if (field(value, 'latitudeE7') !== undefined || field(value, 'longitudeE7') !== undefined) {
    const lat = field(value, 'latitudeE7')
    const lon = field(value, 'longitudeE7')
    if (typeof lat === 'number' && typeof lon === 'number' && Number.isInteger(lat) && Number.isInteger(lon)) {
      return coordinate(lat / 10_000_000, lon / 10_000_000)
    }
    return
  }
  if (field(value, 'latE7') !== undefined || field(value, 'lngE7') !== undefined) {
    const lat = field(value, 'latE7')
    const lon = field(value, 'lngE7')
    if (typeof lat === 'number' && typeof lon === 'number' && Number.isInteger(lat) && Number.isInteger(lon)) {
      return coordinate(lat / 10_000_000, lon / 10_000_000)
    }
    return
  }
  return coordinate(field(value, 'lat') ?? field(value, 'latitude'), field(value, 'lon') ?? field(value, 'longitude'))
}

const isoPattern = /^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,9})?(Z|[+-]\d\d:\d\d)$/
const minTime = Date.UTC(1900, 0, 1)
const maxTime = Date.UTC(2101, 0, 1) - 1

export function epochMs(input: unknown): Instant | undefined {
  const ms = decimal(input)
  return ms !== undefined && Number.isSafeInteger(ms) && ms >= minTime && ms <= maxTime ? { ms } : undefined
}

export function readTime(input: unknown): Instant | undefined {
  if (typeof input !== 'string' || input.length > 40) return
  const match = isoPattern.exec(input)
  if (!match || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return
  const day = match[1]
  const offsetText = match[5]
  if (!day || !offsetText) return
  const midnight = Date.parse(day)
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== day) return
  const instant = epochMs(Date.parse(input))
  if (!instant || offsetText === '-00:00') return
  const offset = offsetText === 'Z' ? 0
    : (offsetText[0] === '-' ? -1 : 1) * (Number(offsetText.slice(1, 3)) * 60 + Number(offsetText.slice(4)))
  return { ...instant, offset, original: input }
}

export function toWindow(interval: Interval): Window {
  return { start: interval.start.ms, end: interval.end.ms }
}

export function clip(interval: Window, window?: Window): Window | undefined {
  const start = Math.max(interval.start, window?.start ?? interval.start)
  const end = Math.min(interval.end, window?.end ?? interval.end)
  return end > start ? { start, end } : undefined
}

export function contains(ms: number, window?: Window): boolean {
  return !window || (ms >= window.start && ms < window.end)
}

export function mergeIntervals(intervals: Window[]): Window[] {
  const sorted = intervals.toSorted((a, b) => a.start - b.start || a.end - b.end)
  const result: Window[] = []
  for (const interval of sorted) {
    const last = result.at(-1)
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end)
    else result.push({ ...interval })
  }
  return result
}

export function dayWindow(day: string, zone: string): Window {
  const date = Temporal.PlainDate.from(day)
  return {
    start: date.toZonedDateTime(zone).epochMilliseconds,
    end: date.add({ days: 1 }).toZonedDateTime(zone).epochMilliseconds,
  }
}

export function coverageDays(evidence: Window[], zone: string): number {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, calendar: 'iso8601', numberingSystem: 'latn',
    year: 'numeric', month: 'numeric', day: 'numeric',
  })
  let lastValue = Number.NaN
  let lastDay = Number.NaN
  const day = (ms: number) => {
    if (ms === lastValue) return lastDay
    const parts = format.formatToParts(ms)
    const part = (name: string) => Number(parts.find(({ type }) => type === name)?.value)
    lastValue = ms
    lastDay = Date.UTC(part('year'), part('month') - 1, part('day')) / 86_400_000
    return lastDay
  }
  const days = mergeIntervals(mergeIntervals(evidence).map((interval) => ({
    start: day(interval.start), end: day(interval.end - 1) + 1,
  })))
  return days.reduce((sum, interval) => sum + interval.end - interval.start, 0)
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const radians = Math.PI / 180
  const latitude = (b.lat - a.lat) * radians
  const longitude = (b.lon - a.lon) * radians
  const factor = Math.sin(latitude / 2) ** 2 +
    Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(longitude / 2) ** 2
  return 12_742_017.6 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, factor))))
}
