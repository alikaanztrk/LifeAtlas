import { dayKey, moveDay, rangeWindow } from './dates'
import type { Days, Trip } from './edits'
import type { Exploration } from './exploration'
import type { Coordinate } from './model'
import { clip, dayWindow, distanceMeters, toWindow } from './primitives'
import type { Window } from './primitives'
import { numberOfDays } from './analytics'

export type Suggestion = Days & { key: string; awayMeters: number; observedMs: number; zone: string }

export function tripWindow(trip: Days & { zone: string }): Window {
  return { start: dayWindow(trip.first, trip.zone).start, end: dayWindow(trip.last, trip.zone).end }
}

export function splitTrip(trip: Trip, splitAt: string, secondId: string): [Trip, Trip] | undefined {
  if (splitAt <= trip.first || splitAt > trip.last) return
  return [{ ...trip, last: moveDay(splitAt, -1) }, { ...trip, id: secondId, first: splitAt }]
}

export function mergeTrips(a: Trip, b: Trip): Trip | undefined {
  if (a.id === b.id || a.zone !== b.zone) return
  const first = a.first < b.first ? a.first : b.first
  const last = a.last > b.last ? a.last : b.last
  return { ...a, first, last }
}

function suggestedTrips(
  archive: Exploration, home: Coordinate, zone: string, minKm: number, trips: Trip[], filter?: Window,
) {
  const suggestions = new Map<string, Suggestion>()
  const covered = trips.map(tripWindow)
  const minimumTime = 2 * 3_600_000
  for (const visit of archive.events(filter)) {
    if (visit.kind !== 'visit' || !visit.coord || visit.end.ms - visit.start.ms < 2 * minimumTime) continue
    const location = visit.coord
    const awayMeters = distanceMeters(home, location)
    if (awayMeters < minKm * 1000) continue
    const first = dayKey(visit.start.ms, zone)
    const last = dayKey(visit.end.ms - 1, zone)
    if (first === last) continue
    const firstBoundary = dayWindow(first, zone).end
    const finalBoundary = dayWindow(last, zone).start
    if (firstBoundary - visit.start.ms < minimumTime || visit.end.ms - finalBoundary < minimumTime) continue
    const witnesses = archive.events(toWindow(visit), 33)
    if (witnesses.length >= 33 || witnesses.some((other) => other.kind === 'visit' &&
      other.id !== visit.id && other.coord && distanceMeters(other.coord, location) > 5_000)) continue
    const window = tripWindow({ first, last, zone })
    if (covered.some((saved) => clip(window, saved))) continue
    const key = first + '/' + last
    const observedMs = visit.end.ms - visit.start.ms
    const previous = suggestions.get(key)
    if (!previous || observedMs > previous.observedMs) {
      suggestions.set(key, { key, first, last, zone, awayMeters, observedMs })
    }
  }
  return [...suggestions.values()].sort((a, b) => b.first.localeCompare(a.first)).slice(0, 30)
}

export function tripsView(archive: Exploration, trips: Trip[], homes: (Coordinate | undefined)[], options: {
  zone: string; range: Parameters<typeof rangeWindow>[0]; distance: number; detail?: string
}) {
  const scope = rangeWindow(options.range, options.zone)
  const saved = trips.filter((trip) => clip(tripWindow(trip), scope))
    .sort((a, b) => b.first.localeCompare(a.first) || a.name.localeCompare(b.name))
  const picked = saved.find((trip) => trip.id === options.detail)
  const full = picked && tripWindow(picked)
  const window = full && clip(full, scope)
  const detail = picked && window && full ? {
    trip: picked, window, summary: archive.summary(options.zone, window),
    days: numberOfDays({ first: dayKey(window.start, options.zone), last: dayKey(window.end - 1, options.zone) }),
    clipped: window.start !== full.start || window.end !== full.end,
  } : undefined
  const home = homes.length === 1 ? homes[0] : undefined
  return {
    saved, detail, homeStatus: home ? 'ready' as const : homes.length > 1 ? 'multiple' as const : 'missing' as const,
    suggestions: home ? suggestedTrips(archive, home, options.zone, options.distance, trips, scope) : [],
  }
}
