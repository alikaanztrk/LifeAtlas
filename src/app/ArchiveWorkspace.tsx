import { lazy, Suspense, useDeferredValue, useRef, useState } from 'react'
import { DateFilter } from '../features/explore/DateFilter'
import { ExploreMap } from '../features/explore/ExploreMap'
import { Calendar } from '../features/calendar/Calendar'
import { Timeline } from '../features/timeline/Timeline'
import { Overview } from '../features/overview/Overview'
import { OverviewAtlas, OverviewInsights } from '../features/overview/OverviewInsights'
import { dayKey, displayDay, periodDays } from '../domain/dates'
import type { CalendarView, DateRange } from '../domain/dates'
import type { Dataset, Mode } from '../domain/model'
import { locale, t } from '../locales/i18n'
import type { Theme } from '../locales/i18n'
import type { ExploreQuery } from '../workers/explore-protocol'
import { useArchiveQuery } from './useArchiveQuery'
import type { ArchiveSource } from './useArchiveQuery'
import type { Route } from './Shell'
import type { Confirmation } from '../components/ConfirmDialog'
import { isEdit, limitEdits } from '../domain/edits'
import type { Days, Edit, Journal } from '../domain/edits'
import { storageFailure } from '../storage/browser'
import { Places } from '../features/places/Places'
import type { PlaceQuery } from '../features/places/Places'
import { Trips } from '../features/trips/Trips'
import type { TripQuery } from '../features/trips/Trips'
import { Analytics } from '../features/analytics/Analytics'
import '../styles/advanced.css'
import '../styles/rewind.css'
import '../styles/atlas.css'

const Rewind = lazy(() => import('../features/rewind/Rewind'))

export default function ArchiveWorkspace({ route, dataset, source, demo, theme, online, zone, journal, onJournal,
  onConfirm, onOnline, onNavigate, onDemo }: {
  route: Route; dataset: Dataset; source: ArchiveSource; demo: boolean; theme: Theme; online: boolean;
  zone: string; onOnline: () => void; onNavigate: (route: Route) => void; onDemo: () => void
  journal: Journal; onJournal: (next: Journal) => Promise<void>; onConfirm: (value: Confirmation) => void
}) {
  const [range, setRange] = useState<DateRange>({ kind: 'all' })
  const [cursor, setCursor] = useState<string>()
  const [calendarView, setCalendarView] = useState<CalendarView>('month')
  const [selected, setSelected] = useState<string>()
  const [mapDay, setMapDay] = useState<string>()
  const [mode, setMode] = useState<Mode>()
  const [replayOpen, setReplayOpen] = useState(false)
  const [rewindView, setRewindView] = useState<CalendarView>('year')
  const [rewindDay, setRewindDay] = useState<string>()
  const [placeQuery, setPlaceQuery] = useState<PlaceQuery>({ search: '', sort: 'visits', page: 0 })
  const placeSearch = useDeferredValue(placeQuery.search)
  const [tripQuery, setTripQuery] = useState<TripQuery>({ distance: 50 })
  const [compare, setCompare] = useState<Days>()
  const [editNotice, setEditNotice] = useState<{ key: string; failure: boolean }>()
  const [editing, setEditing] = useState(false)
  const editLock = useRef(false)
  const anchor = dayKey(dataset.summary.last ?? Date.now(), zone)
  const day = cursor ?? anchor
  const storyDay = rewindDay ?? (range.kind === 'all' ? anchor : range.last)
  let query: ExploreQuery | null = null
  const base = { zone, range }
  if (route === 'overview') query = { ...base, kind: 'overview' }
  if (route === 'calendar') query = { ...base, kind: 'calendar', day: periodDays(day, calendarView).first.toString(), view: calendarView }
  if (route === 'timeline') query = { ...base, kind: 'day', day }
  // Selecting a displayed record changes the inspector and highlight without rebuilding the viewport.
  if (route === 'explore') query = { ...base, kind: 'map', mode, day: mapDay, replay: replayOpen }
  if (route === 'places') query = { ...base, kind: 'places', ...placeQuery, search: placeSearch, locale: locale() }
  if (route === 'trips') query = { ...base, kind: 'trips', ...tripQuery }
  if (route === 'analytics') query = { ...base, kind: 'analytics', compare }
  if (route === 'rewind') query = { ...base, kind: 'rewind', day: periodDays(storyDay, rewindView).first.toString(), view: rewindView }
  const { result, error, retry } = useArchiveQuery(source, query, dataset.revision, journal)
  if (!query) return null

  function changeDay(next: string) {
    setCursor(next)
    setSelected(undefined)
  }
  function openDay(next: string, id?: string) {
    changeDay(next)
    setSelected(id)
    onNavigate('timeline')
  }
  function openMap(next?: string, id?: string) {
    setMode(undefined)
    setReplayOpen(false)
    setMapDay(next)
    setSelected(id)
    onNavigate('explore')
  }
  function openCalendar(next: string) {
    changeDay(next)
    onNavigate('calendar')
  }
  function openPlace(detail?: string) {
    setPlaceQuery({ detail, search: '', sort: 'visits', page: 0 })
    onNavigate('places')
  }
  function apply(next: DateRange) {
    setRange(next)
    if (next.kind !== 'all' && (day < next.first || day > next.last)) setCursor(next.last)
    setMapDay(undefined)
    setSelected(undefined)
    setPlaceQuery((previous) => ({ ...previous, page: 0 }))
  }

  async function edit(action?: Edit): Promise<boolean> {
    if (editLock.current || (!action && !journal.actions.length)) return false
    if (action && (!isEdit(action) || journal.actions.length >= limitEdits)) {
      setEditNotice({ key: isEdit(action) ? 'editLimit' : 'editInvalid', failure: true })
      return false
    }
    editLock.current = true
    setEditing(true)
    setEditNotice(undefined)
    try {
      const actions = action ? [...journal.actions, action] : journal.actions.slice(0, -1)
      await onJournal({ revision: crypto.randomUUID(), actions })
      setEditNotice({ key: action ? 'editSaved' : 'editUndone', failure: false })
      return true
    } catch (failure) {
      setEditNotice({ key: storageFailure(failure).code === 'changed' ? 'editConflict' : 'editFailed', failure: true })
      return false
    } finally {
      editLock.current = false
      setEditing(false)
    }
  }

  const overview = result?.kind === 'overview' ? result : undefined
  const summary = overview?.value.summary ?? (range.kind === 'all' && zone === dataset.summary.zone ? dataset.summary : null)
  return <>
    <div className="scope-bar">
      <DateFilter range={range} anchor={anchor} onApply={apply} />
      <p className="active-scope">
        <span>{t('scope')}</span>{' '}
        <strong>{range.kind === 'all' ? t('allDates') : displayDay(range.first, locale(), { dateStyle: 'medium' }) +
          ' – ' + displayDay(range.last, locale(), { dateStyle: 'medium' })}</strong>
      </p>
    </div>
    {demo && route !== 'overview' && <p className="notice warning" role="status">{t('demoNotice')}</p>}
    {editNotice && (route === 'places' || route === 'trips') && <p role={editNotice.failure ? 'alert' : 'status'}
      className={editNotice.failure ? 'notice error' : 'notice'}>{t(editNotice.key)}</p>}
    {error ? <div className="panel centered-state" role="alert">
      <h1>{t('queryError')}</h1><button className="button secondary" onClick={retry}>{t('tryAgain')}</button>
    </div> : <>
      {route === 'overview' && (summary
        ? <Overview value={{ ...dataset, summary }} isDemo={demo} loading={false} filtered={range.kind !== 'all'}
          onDemo={onDemo} onImport={() => onNavigate('import')}
          atlas={overview && <OverviewAtlas data={overview} theme={theme} openMap={() => openMap()} />}
          extra={overview ? <OverviewInsights data={overview} theme={theme} openCalendar={openCalendar} openPlaces={openPlace} />
            : <p className="notice" role="status">{t('loadingView')}</p>} />
        : <p className="notice" role="status">{t('loadingView')}</p>)}
      {route === 'calendar' && <Calendar day={day} view={calendarView}
        cells={result?.kind === 'calendar' ? result.value : undefined} onDay={changeDay} onView={setCalendarView} openDay={openDay} />}
      {route === 'timeline' && <Timeline day={day} zone={zone} theme={theme}
        value={result?.kind === 'day' ? result.value : undefined} map={result?.kind === 'day' ? result.map : undefined}
        selected={selected} onSelect={setSelected} onDay={changeDay} openMap={openMap} openCalendar={() => openCalendar(day)} />}
      {route === 'explore' && <ExploreMap map={result?.kind === 'map' ? result.value : undefined} theme={theme}
        online={online} onOnline={onOnline} selected={selected} onSelect={setSelected} mode={mode}
        onMode={(next) => { setMode(next); setSelected(undefined) }} day={mapDay}
        onClear={() => { setMapDay(undefined); setSelected(undefined) }} openDay={openDay}
        zone={zone} replayOpen={replayOpen} replay={result?.kind === 'map' ? result.replay : undefined}
        onReplay={() => setReplayOpen((visible) => !visible)} />}
      {route === 'places' && <Places controls={placeQuery} result={result?.kind === 'places' ? result : undefined}
        theme={theme} zone={zone} busy={editing} undoable={journal.actions.length > 0}
        onControls={(next) => setPlaceQuery((previous) => ({ ...previous, ...next }))} onDay={openDay}
        mutate={edit} undo={() => { void edit() }} />}
      {route === 'trips' && <Trips controls={tripQuery} result={result?.kind === 'trips' ? result : undefined}
        theme={theme} zone={zone} busy={editing} undoable={journal.actions.length > 0} onConfirm={onConfirm}
        defaultDates={range.kind === 'all' ? { first: day, last: day } : range}
        onControls={(next) => setTripQuery((previous) => ({ ...previous, ...next }))} onDay={openDay}
        apply={edit} undo={() => { void edit() }} />}
      {route === 'analytics' && <Analytics zone={zone} value={result?.kind === 'analytics' ? result.value : undefined}
        ready={result?.kind === 'analytics'} baseline={compare} onCompare={setCompare}
        places={result?.kind === 'analytics' ? result.places : []}
        onPlace={openPlace} />}
      {route === 'rewind' && <Suspense fallback={<p className="notice" role="status">{t('loadingView')}</p>}>
        <Rewind day={storyDay} view={rewindView} report={result?.kind === 'rewind' ? result.value : undefined}
          demo={demo} onView={setRewindView} onPeriod={setRewindDay} onDay={openDay} />
      </Suspense>}
    </>}
  </>
}
