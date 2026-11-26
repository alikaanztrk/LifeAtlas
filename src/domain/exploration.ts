import { Temporal } from '@js-temporal/polyfill'
import { dayKey, periodDays } from './dates'
import type { CalendarView } from './dates'
import { evidenceBounds, EventIndex } from './event-index'
import type { Activity, Coordinate, Event, Mode, Summary } from './model'
import type { Area } from './geography'
import { clip, dayWindow, mergeIntervals, toWindow } from './primitives'
import type { Window } from './primitives'
import { activityDistance, compileMeasurements, summarize } from './summary'
import type { Measurements } from './summary'

export const modes: Mode[] = [
  'walking', 'running', 'cycling', 'car', 'bus', 'rail', 'subway', 'air', 'boat', 'motorcycle', 'other', 'unknown',
]

export type DayCell = {
  day: string; status: 'outside' | 'empty' | 'evidence'
  meters: number | null; movementMs: number | null; visits: number | null
}
export type DayRow = Window & {
  id: string; kind: Event['kind'] | 'gap'; mode?: Mode; label?: string; area?: Area
  distance?: ReturnType<typeof activityDistance>; clipped?: boolean
}
export type PeriodPoint = { first: string; last: string; movementMs: number | null; evidenceDays: number | null }
export type ModeTime = { mode: Mode; ms: number }

export function knownMeters(distance: Summary['distance']): number | null {
  if (distance.recorded === null && distance.estimated === null) return null
  return (distance.recorded ?? 0) + (distance.estimated ?? 0)
}

export function semanticVisits(summary: Summary): number | null {
  return summary.kinds.visit || summary.kinds.activity ? summary.kinds.visit : null
}

export function modeTime(events: Event[], window?: Window): ModeTime[] {
  const edges: { at: number; delta: number; activity: Activity }[] = []
  for (const event of events) {
    if (event.kind !== 'activity') continue
    const part = clip(toWindow(event), window)
    if (part) edges.push({ at: part.start, delta: 1, activity: event }, { at: part.end, delta: -1, activity: event })
  }

  const active = new Map<string, Mode>()
  const sums = new Map<Mode, number>()
  let previous = 0
  for (const edge of edges.sort((a, b) => a.at - b.at)) {
    if (active.size && edge.at > previous) {
      const mode = active.size === 1 ? active.values().next().value ?? 'unknown' : 'unknown'
      sums.set(mode, (sums.get(mode) ?? 0) + edge.at - previous)
    }
    if (edge.delta === 1) active.set(edge.activity.id, edge.activity.mode)
    else active.delete(edge.activity.id)
    previous = edge.at
  }
  return Array.from(sums, ([mode, ms]) => ({ mode, ms })).sort((a, b) => b.ms - a.ms)
}

export class Exploration {
  private readonly index: EventIndex
  readonly measurements: Measurements

  constructor(events: Event[]) {
    this.index = new EventIndex(events)
    this.measurements = compileMeasurements(events)
  }

  events(window?: Window, limit?: number): Event[] {
    return this.index.at(window, limit)
  }

  bounds() { return this.index.bounds() }

  summary(zone: string, window?: Window, detailed = true, events = this.events(window)): Summary {
    return summarize(events, zone, window, this.measurements, detailed)
  }

  calendar(anchor: string, view: CalendarView, zone: string, filter?: Window): DayCell[] {
    const { first, end } = periodDays(anchor, view)
    const cells: DayCell[] = []
    for (let date = first; Temporal.PlainDate.compare(date, end) < 0; date = date.add({ days: 1 })) {
      const day = date.toString()
      const bounds = clip(dayWindow(day, zone), filter)
      const summary = bounds && this.summary(zone, bounds, false)
      cells.push({
        day, status: !bounds ? 'outside' : summary && summary.evidenceDays ? 'evidence' : 'empty',
        meters: summary ? knownMeters(summary.distance) : null,
        visits: summary ? semanticVisits(summary) : null,
        movementMs: summary ? summary.movementMs : null,
      })
    }
    return cells
  }

  overview(zone: string, filter?: Window) {
    const events = this.events(filter)
    const summary = this.summary(zone, filter, true, events)
    const periods: PeriodPoint[] = []
    const start = filter?.start ?? summary.first
    const end = filter?.end ?? (summary.last === null ? null : summary.last + 1)
    if (start !== null && end !== null && end > start && summary.first !== null) {
      let first = Temporal.PlainDate.from(dayKey(start, zone))
      const last = Temporal.PlainDate.from(dayKey(end - 1, zone))
      const days = first.until(last).days
      const mode = days <= 30 ? 'day' : days <= 800 ? 'month' : days <= 36 * 365 ? 'year' : 'decade'
      if (mode !== 'day') first = first.with({ day: 1, ...(mode === 'month' ? {} : { month: 1 }) })
      if (mode === 'decade') first = first.with({ year: Math.floor(first.year / 10) * 10 })
      while (Temporal.PlainDate.compare(first, last) <= 0) {
        const next = mode === 'day' ? first.add({ days: 1 }) : mode === 'month' ? first.add({ months: 1 })
          : first.add({ years: mode === 'year' ? 1 : 10 })
        const bounds = clip({
          start: first.toZonedDateTime(zone).epochMilliseconds, end: next.toZonedDateTime(zone).epochMilliseconds,
        }, { start, end })
        if (bounds) {
          const value = this.summary(zone, bounds, false)
          periods.push({
            first: dayKey(bounds.start, zone), last: dayKey(bounds.end - 1, zone),
            movementMs: value.movementMs, evidenceDays: value.evidenceDays,
          })
        }
        first = next
      }
    }
    return { summary, periods, modes: modeTime(events, filter) }
  }

  day(day: string, zone: string, filter?: Window, locate?: (coord?: Coordinate) => Area | undefined) {
    const bounds = clip(dayWindow(day, zone), filter)
    if (!bounds) return { bounds, rows: [], omitted: 0, summary: null }
    const events = this.events(bounds)
    const rows: DayRow[] = []
    const known: Window[] = []
    for (const event of events) {
      const evidence = evidenceBounds(event)
      if (!evidence) continue
      if (event.kind === 'raw' || event.kind === 'path') {
        const times = event.kind === 'raw' ? [event.point.time.ms] : [
          event.start?.ms, ...event.points.map((point) => point.time?.ms), event.end?.ms,
        ]
        const inside = times.filter((ms): ms is number => ms !== undefined && ms >= bounds.start && ms < bounds.end)
        if (!inside.length) continue
        rows.push({ id: event.id, kind: event.kind, start: Math.min(...inside), end: Math.max(...inside),
          area: event.kind === 'raw' ? locate?.(event.point.coord) : undefined })
        continue
      }
      const time = toWindow(event)
      const part = clip(time, bounds) ?? (time.start === time.end && clip(evidence, bounds) ? time : undefined)
      if (!part) continue
      if (part.end > part.start) known.push(part)
      rows.push({
        ...part, id: event.id, kind: event.kind, clipped: part.start !== time.start || part.end !== time.end,
        ...(event.kind === 'visit' ? { label: event.label, area: locate?.(event.coord) }
          : { mode: event.mode, distance: activityDistance(event, this.measurements, bounds) }),
      })
    }
    if (known.length) {
      let end = bounds.start
      for (const interval of [...mergeIntervals(known), { start: bounds.end, end: bounds.end }]) {
        if (end < interval.start) rows.push({ id: 'gap-' + end, kind: 'gap', start: end, end: interval.start })
        end = interval.end
      }
    }
    rows.sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id))
    return { bounds, rows: rows.slice(0, 500), omitted: Math.max(0, rows.length - 500), summary: this.summary(zone, bounds) }
  }
}
