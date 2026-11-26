import { useState } from 'react'
import { CalendarDays, Plus, Undo2 } from 'lucide-react'
import type { Confirmation } from '../../components/ConfirmDialog'
import { dayKey, moveDay } from '../../domain/dates'
import { isDays } from '../../domain/edits'
import type { Days, Edit, Trip } from '../../domain/edits'
import { knownMeters, semanticVisits } from '../../domain/exploration'
import { mergeTrips, splitTrip } from '../../domain/trips'
import { formatDistance, number, printDays, t, timeDuration } from '../../locales/i18n'
import type { Theme } from '../../locales/i18n'
import type { ExploreResult } from '../../workers/explore-protocol'
import { MapPanel } from '../explore/MapPanel'

export type TripQuery = { distance: number; detail?: string }
type Result = Extract<ExploreResult, { kind: 'trips' }>
type Apply = (edit: Edit) => Promise<boolean>
type Draft = Days & { name: string; zone: string; id?: string }

function TripForm({ initial, busy, onSave, dismiss }: {
  initial: Draft; busy: boolean; onSave: (trip: Trip) => Promise<void>; dismiss: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const [invalid, setInvalid] = useState(false)
  return <form className="edit-form trip-form" onSubmit={(event) => {
    event.preventDefault()
    if (!isDays(draft) || !draft.name.trim()) { setInvalid(true); return }
    setInvalid(false)
    void onSave({ ...draft, id: draft.id ?? crypto.randomUUID(), name: draft.name.trim() })
  }}>
    <h2>{t(draft.id ? 'editTrip' : 'createTrip')}</h2>
    <label>{t('tripName')}<input value={draft.name} required maxLength={100}
      onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
    <div className="inline-fields">
      <label>{t('from')}<input type="date" required value={draft.first}
        onChange={(event) => setDraft({ ...draft, first: event.target.value })} /></label>
      <label>{t('to')}<input type="date" required value={draft.last}
        onChange={(event) => setDraft({ ...draft, last: event.target.value })} /></label>
    </div>
    <p className="muted">{t('tripZone')} · {draft.zone}</p>
    {invalid && <p role="alert" className="notice error">{t('editInvalid')}</p>}
    <div className="button-row">
      <button type="submit" className="button primary" disabled={busy}>{t(draft.id ? 'saveEdit' : 'createTrip')}</button>
      <button type="button" className="button secondary" onClick={dismiss}>{t('cancel')}</button>
    </div>
  </form>
}

function TripOperations({ trip, saved, busy, apply, onConfirm, onEdit }: {
  trip: Trip; saved: Trip[]; busy: boolean; apply: Apply; onConfirm: (value: Confirmation) => void; onEdit: () => void
}) {
  const [split, setSplit] = useState('')
  const [second, setSecond] = useState('')
  const [other, setOther] = useState('')
  const candidates = saved.filter((item) => item.id !== trip.id && item.zone === trip.zone)
  return <div className="advanced-edit">
    <div className="button-row">
      <button className="button secondary" disabled={busy} onClick={onEdit}>{t('editTrip')}</button>
      <button className="button secondary danger-text" disabled={busy} onClick={() => onConfirm({
        title: 'deleteTripConfirm', description: 'deleteTripHint', label: 'deleteTrip',
        action: () => { void apply({ kind: 'trips', remove: [trip.id], save: [] }) },
      })}>{t('deleteTrip')}</button>
    </div>
    {trip.first < trip.last && <details className="details-fields">
      <summary>{t('splitTrip')}</summary>
      <form className="edit-form" onSubmit={(event) => {
        event.preventDefault()
        if (!isDays({ first: split, last: split }) || !second.trim()) return
        const parts = splitTrip(trip, split, crypto.randomUUID())
        if (parts) void apply({ kind: 'trips', remove: [trip.id], save: [parts[0], { ...parts[1], name: second.trim() }] })
      }}>
        <label>{t('splitDate')}<input type="date" required min={moveDay(trip.first, 1)} max={trip.last} value={split}
          onChange={(event) => setSplit(event.target.value)} /></label>
        <label>{t('secondTripName')}<input required maxLength={100} value={second} onChange={(event) => setSecond(event.target.value)} /></label>
        <button className="button secondary" disabled={busy}>{t('splitTrip')}</button>
      </form>
    </details>}
    {candidates.length > 0 && <details className="details-fields">
      <summary>{t('mergeTrip')}</summary>
      <form className="edit-form" onSubmit={(event) => {
        event.preventDefault()
        const match = candidates.find((item) => item.id === other)
        const merged = match && mergeTrips(trip, match)
        if (match && merged) void apply({ kind: 'trips', remove: [trip.id, match.id], save: [merged] })
      }}>
        <p className="muted">{t('mergeTripHint')}</p>
        <label>{t('mergeTripTarget')}<select aria-label={t('mergeTripTarget')} value={other} onChange={(event) => setOther(event.target.value)}>
          <option value="">{t('pickTrip')}</option>
          {candidates.map((item) => <option value={item.id} key={item.id}>{item.name} · {printDays(item.first, item.last)}</option>)}
        </select></label>
        <button className="button secondary" disabled={busy || !candidates.some((item) => item.id === other)}>{t('mergeTrip')}</button>
      </form>
    </details>}
  </div>
}

export function Trips({ result, controls, defaultDates, zone, theme, busy, undoable, onControls, onDay, apply, undo, onConfirm }: {
  result?: Result; controls: TripQuery; defaultDates: Days; zone: string; theme: Theme; busy: boolean; undoable: boolean;
  onControls: (next: Partial<TripQuery>) => void; onDay: (day: string) => void; apply: Apply; undo: () => void;
  onConfirm: (value: Confirmation) => void
}) {
  const [draft, setDraft] = useState<Draft>()
  const [distance, setDistance] = useState(String(controls.distance))
  const value = result?.value
  const detail = value?.detail
  const visits = detail && semanticVisits(detail.summary)
  return <>
    <header className="page-heading overview-heading">
      <div><h1>{t('trips')}</h1><p>{t('tripsIntro')}</p></div>
      <div className="button-row">
        <button className="button secondary" disabled={!undoable || busy} onClick={undo}><Undo2 size={16} aria-hidden="true" />{t('undoEdit')}</button>
        <button className="button primary" disabled={busy} onClick={() => setDraft({ ...defaultDates, zone, name: '' })}>
          <Plus size={17} aria-hidden="true" />{t('createTrip')}</button>
      </div>
    </header>
    <div className="advanced-layout">
      <div className="advanced-stack">
        <section className="panel">
          <h2>{t('savedTrips')}</h2>
          {!value && <p className="muted" role="status">{t('loadingView')}</p>}
          {value && !value.saved.length && <p className="muted">{t('noTrips')}</p>}
          <ul className="advanced-records">
            {value?.saved.map((trip) => <li key={trip.id} className={controls.detail === trip.id ? 'selected-record' : undefined}>
              <button className="button link-button trip-row" onClick={() => { setDraft(undefined); onControls({ detail: trip.id }) }}>
                <CalendarDays size={17} aria-hidden="true" /><span><strong>{trip.name}</strong><small>{printDays(trip.first, trip.last)}</small></span>
              </button>
            </li>)}
          </ul>
        </section>
        <section className="panel">
          <h2>{t('suggestedTrips')}</h2><p className="muted">{t('suggestionHelp')}</p>
          {value && value.homeStatus !== 'ready' && <p className="notice">{t(value.homeStatus === 'multiple' ? 'severalHomes' : 'pickHome')}</p>}
          {value?.homeStatus === 'ready' && <form className="view-toolbar suggestion-controls" onSubmit={(event) => {
            event.preventDefault()
            const km = Number(distance)
            if (Number.isInteger(km) && km >= 10 && km <= 1000) onControls({ distance: km })
          }}>
            <label className="compact-field">{t('awayThreshold')}<input type="number" min={10} max={1000} value={distance}
              onChange={(event) => setDistance(event.target.value)} required /></label>
            <button className="button secondary">{t('applyRange')}</button>
          </form>}
          {value?.homeStatus === 'ready' && !value.suggestions.length && <p className="muted">{t('noTripEvidence')}</p>}
          <ul className="advanced-records suggestion-list">
            {value?.suggestions.map((item) => <li key={item.key}>
              <div><strong>{printDays(item.first, item.last)}</strong>
                <p className="muted">{t('awayFromHome', { distance: formatDistance(item.awayMeters) })} · {t('overnightEvidence', { duration: timeDuration(item.observedMs) })}</p>
              </div>
              <button className="button secondary" disabled={busy} onClick={() => setDraft({ ...item, name: '' })}>{t('saveSuggestion')}</button>
            </li>)}
          </ul>
        </section>
      </div>
      {(draft || detail) && <section className="panel trip-detail">
        {draft ? <TripForm key={draft.id ?? draft.first + draft.last} initial={draft} busy={busy}
          onSave={async (trip) => {
            if (await apply({ kind: 'trips', remove: draft.id ? [trip.id] : [], save: [trip] })) {
              onControls({ detail: trip.id }); setDraft(undefined)
            }
          }} dismiss={() => setDraft(undefined)} />
          : detail && <>
            <h2>{detail.trip.name}</h2>
            <p className="muted">{printDays(detail.trip.first, detail.trip.last)} · {detail.trip.zone}</p>
            {detail.clipped && <p className="notice">{t('tripClipped')}</p>}
            <dl className="fact-list">
              <div><dt>{t('distance')}</dt><dd>{formatDistance(knownMeters(detail.summary.distance))}</dd></div>
              <div><dt>{t('recorded')}</dt><dd>{formatDistance(detail.summary.distance.recorded)}</dd></div>
              <div><dt>{t('estimated')}</dt><dd>{formatDistance(detail.summary.distance.estimated)}</dd></div>
              <div><dt>{t('movement')}</dt><dd>{timeDuration(detail.summary.movementMs)}</dd></div>
              <div><dt>{t('visits')}</dt><dd>{visits == null ? t('noMetric') : number(visits)}</dd></div>
              <div><dt>{t('coverageLabel')}</dt><dd>{t(detail.days === 1 ? 'coverageDay' : 'coverageFraction',
                { count: number(detail.summary.evidenceDays ?? 0), total: number(detail.days) })}</dd></div>
            </dl>
            <TripOperations key={detail.trip.id + detail.trip.first + detail.trip.last} trip={detail.trip} saved={value?.saved ?? []}
              busy={busy} apply={apply} onConfirm={onConfirm} onEdit={() => setDraft(detail.trip)} />
            {result?.map && <MapPanel data={result.map} theme={theme} simple defer />}
            {detail.summary.first !== null && <button className="button secondary advanced-controls"
              onClick={() => onDay(dayKey(detail.summary.first!, zone))}>{t('openDay')}</button>}
          </>}
      </section>}
    </div>
  </>
}
