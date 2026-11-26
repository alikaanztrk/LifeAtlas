import { validDay } from './day-key'
import { object } from './json-shape'

export type PlaceCategory = 'none' | 'home' | 'work' | 'other'
export type PlaceLabel = { name: string; tags: string[]; category: PlaceCategory }
export type Days = { first: string; last: string }
export type Trip = Days & { id: string; name: string; zone: string }

export type Edit =
  | { kind: 'label'; visit: string; label: PlaceLabel }
  | { kind: 'split'; visit: string }
  | { kind: 'merge'; from: string; into: string }
  | { kind: 'trips'; remove: string[]; save: Trip[] }

export type Journal = { revision: string; actions: Edit[] }
export const emptyJournal: Journal = { revision: 'initial', actions: [] }
export const limitEdits = 1_024
export const categories: PlaceCategory[] = ['none', 'home', 'work', 'other']

const visitId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const tripId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)

export function isDays(value: unknown): value is Days {
  const days = object(value)
  return Boolean(days && typeof days.first === 'string' && typeof days.last === 'string' &&
    validDay(days.first) && validDay(days.last) && days.first <= days.last)
}

export function isZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 80) return false
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
}

function isTrip(value: unknown): value is Trip {
  const trip = object(value)
  return Boolean(trip && tripId(trip.id) &&
    typeof trip.name === 'string' && trip.name.length <= 100 && trip.name.trim() &&
    isZone(trip.zone) && isDays(trip))
}

function isLabel(value: unknown): value is PlaceLabel {
  const label = object(value)
  return Boolean(label && typeof label.name === 'string' && label.name.length <= 100 &&
    categories.some((item) => item === label.category) &&
    Array.isArray(label.tags) && label.tags.length <= 8 &&
    label.tags.every((tag: unknown) => typeof tag === 'string' && tag.length <= 24 && tag.trim()))
}

export function isJournal(value: unknown): value is Journal {
  const journal = object(value)
  return Boolean(journal && typeof journal.revision === 'string' && journal.revision.length <= 64 &&
    Array.isArray(journal.actions) && journal.actions.length <= limitEdits && journal.actions.every(isEdit))
}

export function isEdit(value: unknown): value is Edit {
  const edit = object(value)
  if (!edit) return false
  if (edit.kind === 'label') return visitId(edit.visit) && isLabel(edit.label)
  if (edit.kind === 'split') return visitId(edit.visit)
  if (edit.kind === 'merge') return visitId(edit.from) && visitId(edit.into) && edit.from !== edit.into
  return edit.kind === 'trips' && Array.isArray(edit.remove) && edit.remove.length <= 2 && edit.remove.every(tripId) &&
    Array.isArray(edit.save) && edit.save.length <= 2 && edit.save.every(isTrip) && edit.remove.length + edit.save.length > 0
}

export function tripsFrom(actions: Edit[]): Trip[] {
  const trips = new Map<string, Trip>()
  for (const action of actions) {
    if (action.kind !== 'trips') continue
    if (action.remove.some((id) => !trips.has(id))) continue
    for (const id of action.remove) trips.delete(id)
    for (const trip of action.save) trips.set(trip.id, trip)
  }
  return Array.from(trips.values())
}
