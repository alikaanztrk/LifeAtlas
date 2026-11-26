import { numberOfDays, percentChange } from './analytics'
import { dayKey, moveDay, periodDays } from './dates'
import type { CalendarView } from './dates'
import type { Days } from './edits'
import { knownMeters, modeTime } from './exploration'
import type { Exploration, ModeTime } from './exploration'
import type { Mode, Summary } from './model'
import type { PlaceCatalog } from './places'
import { clip, dayWindow } from './primitives'
import type { Window } from './primitives'
import { activityDistance } from './summary'

export type RewindChapter = 'coverage' | 'distance' | 'movement' | 'places' | 'highlightDay' | 'longestJourney' | 'comparison'

export type RewindReport = {
  period: Days; window?: Days; expectedDays: number; includedDays: number; partial: boolean;
  summary?: Summary; modes: ModeTime[]; places: { name?: string; count: number }[];
  busiest?: { day: string; movementMs: number };
  longest?: { day: string; meters: number; mode: Mode };
  compare?: { dates: Days; change: number; meters: number; currentDays: number; previousDays: number };
  chapters: RewindChapter[];
}

export function rewind(
  archive: Exploration, zone: string, day: string, view: CalendarView, catalog: PlaceCatalog,
  filter: Window | undefined, now: number,
): RewindReport {
  const selected = periodDays(day, view)
  const period = { first: selected.first.toString(), last: selected.end.subtract({ days: 1 }).toString() }
  const nominal = { start: dayWindow(period.first, zone).start, end: dayWindow(period.last, zone).end }
  const expectedDays = numberOfDays(period)
  const result: RewindReport = { period, expectedDays, includedDays: 0, partial: true, modes: [], places: [], chapters: [] }
  const window = clip({ ...nominal, end: Math.min(nominal.end, now) }, filter)
  if (!window) return result
  const scope = { first: dayKey(window.start, zone), last: dayKey(window.end - 1, zone) }
  const summary = archive.summary(zone, window)
  const extent = archive.bounds()
  const startsLate = !extent || dayKey(extent.start, zone) > period.first
  const endsEarly = !extent || dayKey(extent.end - 1, zone) < period.last
  const includedDays = numberOfDays(scope)
  const partial = window.start > nominal.start || window.end < nominal.end || startsLate || endsEarly
  const effective = { ...result, summary, window: scope, includedDays, partial }
  if (!summary.evidenceDays) return effective
  const events = archive.events(window)
  const modes = modeTime(events, window)
  const places = catalog.list({ search: '', locale: 'en-US', page: 0, sort: 'visits', window }).rows.slice(0, 3)
    .map(({ name, count }) => ({ name, count }))
  let busiest: RewindReport['busiest']
  for (const cell of archive.calendar(day, view, zone, window)) {
    if (cell.movementMs !== null && cell.movementMs > (busiest?.movementMs ?? 0)) {
      busiest = { day: cell.day, movementMs: cell.movementMs }
    }
  }
  let longest: RewindReport['longest']
  for (const event of events) {
    if (event.kind !== 'activity') continue
    const distance = activityDistance(event, archive.measurements, window)
    if (distance.kind === 'recorded' && distance.meters > (longest?.meters ?? 0)) {
      longest = { day: dayKey(event.start.ms, zone), meters: distance.meters, mode: event.mode }
    }
  }
  const dates = { first: moveDay(scope.first, -includedDays), last: moveDay(scope.first, -1) }
  const past = archive.summary(zone, { start: dayWindow(dates.first, zone).start, end: dayWindow(dates.last, zone).end })
  const baseline = knownMeters(past.distance)
  const change = percentChange(knownMeters(summary.distance), baseline)
  const compare = change !== null && baseline !== null && past.evidenceDays
    ? { dates, change, meters: baseline, currentDays: summary.evidenceDays, previousDays: past.evidenceDays } : undefined
  const chapters: RewindChapter[] = ['coverage']
  if (knownMeters(summary.distance) !== null) chapters.push('distance')
  if (summary.movementMs !== null) chapters.push('movement')
  if (places.length) chapters.push('places')
  if (busiest) chapters.push('highlightDay')
  if (longest) chapters.push('longestJourney')
  if (compare) chapters.push('comparison')
  return { ...effective, chapters, modes, places, busiest, longest, compare }
}
