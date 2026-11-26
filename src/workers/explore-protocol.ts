import { validDay } from '../domain/dates'
import type { CalendarView, DateRange } from '../domain/dates'
import { modes } from '../domain/exploration'
import type { Exploration } from '../domain/exploration'
import type { MapData } from '../domain/map-data'
import type { Dataset, Event, Mode } from '../domain/model'
import { field, object } from '../domain/primitives'
import type { analytics } from '../domain/analytics'
import { isDays, isJournal } from '../domain/edits'
import type { Days, Journal } from '../domain/edits'
import type { PlaceCatalog, PlaceSort, PlaceSummary } from '../domain/places'
import type { tripsView } from '../domain/trips'
import type { Replay } from '../domain/replay'
import type { RewindReport } from '../domain/rewind'

type Base = { zone: string; range: DateRange }
export type RankedPlace = Pick<PlaceSummary, 'key' | 'target' | 'name' | 'count'>
export type ExploreQuery = Base & (
  { kind: 'overview' } | { kind: 'calendar'; day: string; view: CalendarView } |
  { kind: 'day'; day: string } | { kind: 'map'; day?: string; mode?: Mode; selected?: string; replay?: boolean } |
  { kind: 'places'; search: string; sort: PlaceSort; page: number; detail?: string; locale: 'tr-TR' | 'en-US' } |
  { kind: 'trips'; distance: number; detail?: string } | { kind: 'analytics'; compare?: Days } |
  { kind: 'rewind'; day: string; view: CalendarView }
)

export type ExploreResult =
  | { kind: 'overview'; value: ReturnType<Exploration['overview']>; map: MapData; calendar: ReturnType<Exploration['calendar']> }
  | { kind: 'calendar'; value: ReturnType<Exploration['calendar']> }
  | { kind: 'day'; value: ReturnType<Exploration['day']>; map: MapData }
  | { kind: 'map'; value: MapData; replay?: Replay }
  | { kind: 'rewind'; value: RewindReport }
  | { kind: 'places'; value: ReturnType<PlaceCatalog['list']>; map?: MapData }
  | { kind: 'trips'; value: ReturnType<typeof tripsView>; map?: MapData }
  | { kind: 'analytics'; value?: ReturnType<typeof analytics>; places: RankedPlace[] }

export type ExploreRequest =
  | { type: 'seed'; saved?: Dataset } | { type: 'batch'; events: Event[] } | { type: 'seedDone' }
  | { type: 'query'; sequence: number; query: ExploreQuery }
  | { type: 'journal'; journal: Journal }

export type ExploreResponse = { type: 'ready' } | { type: 'error'; sequence?: number } |
  { type: 'result'; sequence: number; result: ExploreResult }

export function isQuery(input: unknown): input is ExploreQuery {
  const value = object(input)
  if (!value || typeof value.zone !== 'string' || value.zone.length > 80) return false
  const range = object(value.range)
  if (!range) return false
  const date = (key: unknown): key is string => typeof key === 'string' && validDay(key)
  if (range.kind !== 'all' &&
    (!['year', 'month', 'custom'].includes(String(range.kind)) ||
      !date(range.first) || !date(range.last) || range.first > range.last)) return false
  if (value.kind === 'overview') return true
  if (value.kind === 'calendar' || value.kind === 'rewind') return date(value.day) && (value.view === 'month' || value.view === 'year')
  if (value.kind === 'day') return date(value.day)
  const detail = value.detail === undefined || (typeof value.detail === 'string' && value.detail.length <= 128)
  if (value.kind === 'places') return detail && typeof value.search === 'string' && value.search.length <= 120 &&
    ['visits', 'duration', 'recent', 'name'].some((sort) => value.sort === sort) &&
    typeof value.page === 'number' && Number.isInteger(value.page) && value.page >= 0 &&
    (value.locale === 'tr-TR' || value.locale === 'en-US')
  if (value.kind === 'trips') return detail && typeof value.distance === 'number' && Number.isInteger(value.distance) &&
    value.distance >= 10 && value.distance <= 1000
  if (value.kind === 'analytics') return value.compare === undefined || isDays(value.compare)
  return value.kind === 'map' && (value.day === undefined || date(value.day)) &&
    (value.mode === undefined || modes.some((mode) => mode === value.mode)) &&
    (value.replay === undefined || typeof value.replay === 'boolean') &&
    (value.selected === undefined || (typeof value.selected === 'string' && value.selected.length <= 128))
}

export function isExploreRequest(input: unknown): input is ExploreRequest {
  const value = object(input)
  const type = field(value, 'type')
  if (type === 'seedDone') return true
  if (type === 'journal') return isJournal(field(value, 'journal'))
  if (type === 'seed') {
    const saved = field(value, 'saved')
    const data = object(saved)
    return saved === undefined || (typeof data?.id === 'string' && typeof data?.revision === 'string')
  }
  if (type === 'batch') {
    const events = field(value, 'events')
    return Array.isArray(events) && events.length <= 256
  }
  return type === 'query' && Number.isSafeInteger(field(value, 'sequence')) && isQuery(field(value, 'query'))
}
