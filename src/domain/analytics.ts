import { Temporal } from '@js-temporal/polyfill'
import { moveDay } from './dates'
import type { Days } from './edits'
import { knownMeters, modeTime, semanticVisits } from './exploration'
import type { Exploration } from './exploration'
import type { Event, Mode, Summary } from './model'
import { edgeTotal } from './path-distance'
import { clip, dayWindow, mergeIntervals, toWindow } from './primitives'
import type { Window } from './primitives'
import { activityDistance } from './summary'

export type PeriodMetrics = Days & { days: number; summary: Summary }

export function numberOfDays(days: Days): number {
  return Temporal.PlainDate.from(days.first).until(Temporal.PlainDate.from(days.last)).days + 1
}

function priorPeriod(days: Days): Days {
  return { first: moveDay(days.first, -numberOfDays(days)), last: moveDay(days.first, -1) }
}

export function percentChange(value: number | null, baseline: number | null): number | null {
  return value !== null && baseline !== null && baseline > 0 ? (value - baseline) / baseline : null
}

const hour = 3_600_000
const day = 24 * hour
const week = 7 * day
const positiveModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor

export function movementHistogram(events: Event[], zone: string, window?: Window) {
  const byHour = Array<number>(24).fill(0)
  const byWeekday = Array<number>(7).fill(0)
  const intervals = events.flatMap((event) => {
    const part = event.kind === 'activity' ? clip(toWindow(event), window) : undefined
    return part ? [part] : []
  })
  const add = (localStart: number, localEnd: number) => {
    const fullWeeks = Math.floor((localEnd - localStart) / week)
    if (fullWeeks) {
      for (let bin = 0; bin < 24; bin++) byHour[bin] = (byHour[bin] ?? 0) + fullWeeks * 7 * hour
      for (let bin = 0; bin < 7; bin++) byWeekday[bin] = (byWeekday[bin] ?? 0) + fullWeeks * day
      localStart += fullWeeks * week
    }
    while (localStart < localEnd) {
      const clockHour = Math.floor(localStart / hour)
      const next = Math.min(localEnd, (clockHour + 1) * hour)
      const h = positiveModulo(clockHour, 24)
      const w = positiveModulo(Math.floor(localStart / day) + 3, 7)
      byHour[h] = (byHour[h] ?? 0) + next - localStart
      byWeekday[w] = (byWeekday[w] ?? 0) + next - localStart
      localStart = next
    }
  }
  let offset = 0
  let transition = -Infinity
  for (const interval of mergeIntervals(intervals)) {
    let at = interval.start
    while (at < interval.end) {
      if (at >= transition) {
        const civil = Temporal.Instant.fromEpochMilliseconds(at).toZonedDateTimeISO(zone)
        offset = civil.offsetNanoseconds / 1_000_000
        transition = civil.getTimeZoneTransition('next')?.epochMilliseconds ?? Infinity
      }
      const end = Math.min(transition, interval.end)
      add(at + offset, end + offset)
      at = end
    }
  }
  return { byHour, byWeekday, total: byHour.reduce((sum, ms) => sum + ms, 0) }
}

function modeBreakdown(archive: Exploration, events: Event[], window: Window) {
  const blank = (mode: Mode, ms: number | null = null) => ({ mode, ms, meters: null as number | null,
    recorded: null as number | null, estimated: null as number | null })
  const values = new Map<Mode, ReturnType<typeof blank>>()
  for (const { mode, ms } of modeTime(events, window)) values.set(mode, blank(mode, ms))
  const addDistance = (mode: Mode, kind: 'recorded' | 'estimated', meters: number) => {
    const value = values.get(mode) ?? blank(mode)
    value.meters = (value.meters ?? 0) + meters
    value[kind] = (value[kind] ?? 0) + meters
    values.set(mode, value)
  }
  for (const event of events) {
    if (event.kind !== 'activity') continue
    const value = activityDistance(event, archive.measurements, window)
    if (value.kind === 'recorded' || value.kind === 'estimated') addDistance(event.mode, value.kind, value.meters)
  }
  const unassigned = edgeTotal(archive.measurements.independent, window)
  if (unassigned !== null) addDistance('unknown', 'estimated', unassigned)
  return Array.from(values.values()).sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0) || a.mode.localeCompare(b.mode))
}

function periodWindow(days: Days, zone: string) {
  return { start: dayWindow(days.first, zone).start, end: dayWindow(days.last, zone).end }
}

export function analytics(archive: Exploration, zone: string, current: Days, compare?: Days) {
  const previous = compare ?? priorPeriod(current)
  const window = periodWindow(current, zone)
  const events = archive.events(window)
  const summary = archive.summary(zone, window, true, events)
  const baseline = archive.summary(zone, periodWindow(previous, zone))
  const movement = movementHistogram(events, zone, window)
  return {
    current: { ...current, days: numberOfDays(current), summary },
    previous: { ...previous, days: numberOfDays(previous), summary: baseline },
    modes: modeBreakdown(archive, events, window), movement,
    change: {
      distance: percentChange(knownMeters(summary.distance), knownMeters(baseline.distance)),
      movement: percentChange(summary.movementMs, baseline.movementMs),
      visits: percentChange(semanticVisits(summary), semanticVisits(baseline)),
      evidence: percentChange(summary.evidenceDays, baseline.evidenceDays),
    },
  }
}
