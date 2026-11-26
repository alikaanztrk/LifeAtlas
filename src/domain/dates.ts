import { Temporal } from '@js-temporal/polyfill'
import { dayWindow } from './primitives'
import type { Window } from './primitives'

export type DateRange = { kind: 'all' } | { kind: 'year' | 'month' | 'custom'; first: string; last: string }
export type CalendarView = 'month' | 'year'
export { validDay } from './day-key'

export function dayKey(ms: number, zone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(zone).toPlainDate().toString()
}

export function moveDay(day: string, by: number): string {
  return Temporal.PlainDate.from(day).add({ days: by }).toString()
}

export function periodDays(anchor: string, view: CalendarView) {
  const date = Temporal.PlainDate.from(anchor)
  const first = view === 'year' ? date.with({ month: 1, day: 1 }) : date.with({ day: 1 })
  const end = view === 'year' ? first.add({ years: 1 }) : first.add({ months: 1 })
  return { first, end }
}

export function movePeriod(anchor: string, view: CalendarView, by: number): string {
  const { first } = periodDays(anchor, view)
  return (view === 'year' ? first.add({ years: by }) : first.add({ months: by })).toString()
}

export function periodRange(anchor: string, kind: CalendarView): DateRange {
  const { first, end } = periodDays(anchor, kind)
  return { kind, first: first.toString(), last: end.subtract({ days: 1 }).toString() }
}

export function rangeWindow(range: DateRange, zone: string): Window | undefined {
  if (range.kind === 'all') return
  return { start: dayWindow(range.first, zone).start, end: dayWindow(range.last, zone).end }
}

export function dayOfWeek(day: string): number {
  return Temporal.PlainDate.from(day).dayOfWeek
}

export function displayDay(day: string, language: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(language, { ...options, timeZone: 'UTC' }).format(Date.parse(day + 'T12:00:00Z'))
}
