import { useState } from 'react'
import { MapPin, Search, Undo2 } from 'lucide-react'
import { categories } from '../../domain/edits'
import type { Edit, PlaceCategory } from '../../domain/edits'
import type { PlaceSort, PlaceSummary } from '../../domain/places'
import { dayKey } from '../../domain/dates'
import { date, number, t, timeDuration } from '../../locales/i18n'
import { areaDetail, areaSubtitle, placeTitle } from '../../locales/geography'
import type { Theme } from '../../locales/i18n'
import type { ExploreResult } from '../../workers/explore-protocol'
import { MapPanel } from '../explore/MapPanel'

export type PlaceQuery = { search: string; sort: PlaceSort; page: number; detail?: string }
const sortLabels: Record<PlaceSort, string> = { visits: 'sortCount', duration: 'sortDuration', recent: 'sortRecent', name: 'sortName' }
const categoryLabels: Record<PlaceCategory, string> = { none: 'categoryNone', home: 'categoryHome', work: 'categoryWork', other: 'categoryOther' }

function PlaceEditor({ place, options, busy, zone, mutate }: {
  place: PlaceSummary; options: PlaceSummary[]; busy: boolean; zone: string; mutate: (edit: Edit) => Promise<boolean>
}) {
  const [name, setName] = useState(place.label?.name ?? '')
  const [tags, setTags] = useState(place.label?.tags.join(', ') ?? '')
  const [category, setCategory] = useState<PlaceCategory>(place.label?.category ?? 'none')
  const [from, setFrom] = useState('')
  const [error, setError] = useState(false)
  const candidates = options.filter((option) => option.key !== place.key)
  return <div className="advanced-edit">
    <form className="edit-form" aria-label={t('placeEdit')} onSubmit={(event) => {
      event.preventDefault()
      const uniqueTags = [...new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean))]
      if (uniqueTags.length > 8 || uniqueTags.some((tag) => tag.length > 24)) { setError(true); return }
      setError(false)
      void mutate({ kind: 'label', visit: place.target, label: { name: name.trim(), category, tags: uniqueTags } })
    }}>
      <h3>{t('placeEdit')}</h3>
      <label>{t('placeName')}<input value={name} maxLength={100} placeholder={place.name} onChange={(event) => setName(event.target.value)} /></label>
      <p className="muted">{t('labelHint')}</p>
      <label>{t('placeTags')}<input value={tags} maxLength={208} onChange={(event) => setTags(event.target.value)} /></label>
      <p className="muted">{t('tagHint')}</p>
      <label>{t('placeCategory')}<select aria-label={t('placeCategory')} value={category} onChange={(event) => {
        setCategory(categories.find((entry) => entry === event.target.value) ?? 'none')
      }}>
        {categories.map((entry) => <option key={entry} value={entry}>{t(categoryLabels[entry])}</option>)}
      </select></label>
      {error && <p className="notice error" role="alert">{t('editInvalid')}</p>}
      <button className="button primary" disabled={busy} type="submit">{t('saveEdit')}</button>
    </form>
    {candidates.length > 0 && <form className="edit-form" onSubmit={(event) => {
      event.preventDefault()
      if (candidates.some((item) => item.target === from)) void mutate({ kind: 'merge', from, into: place.target })
    }}>
      <h3>{t('placesMerge')}</h3><p className="muted">{t('mergeHelp')}</p>
      <label>{t('mergeTarget')}<select aria-label={t('mergeTarget')} value={from} onChange={(event) => setFrom(event.target.value)}>
        <option value="">{t('pickPlace')}</option>
        {candidates.map((candidate) => <option key={candidate.key} value={candidate.target}>
          {placeTitle(candidate.name, candidate.area, date(candidate.last, zone))} · {number(candidate.count)}
        </option>)}
      </select></label>
      <button className="button secondary" disabled={busy || !candidates.some((option) => option.target === from)}>{t('placesMerge')}</button>
    </form>}
  </div>
}

type Result = Extract<ExploreResult, { kind: 'places' }>
export function Places({ controls, result, zone, theme, busy, undoable, onControls, onDay, mutate, undo }: {
  controls: PlaceQuery; result?: Result; zone: string; theme: Theme; busy: boolean; undoable: boolean
  onControls: (update: Partial<PlaceQuery>) => void; onDay: (day: string, id: string) => void
  mutate: (edit: Edit) => Promise<boolean>; undo: () => void
}) {
  const value = result?.value
  const active = value?.active
  return <>
    <header className="page-heading overview-heading">
      <div><h1>{t('placesHeading')}</h1><p>{t('placesIntro')}</p></div>
      <button className="button secondary" disabled={!undoable || busy} onClick={undo}><Undo2 size={16} aria-hidden="true" />{t('undoEdit')}</button>
    </header>
    <div className="advanced-layout">
      <section className="panel place-directory">
        <div className="view-toolbar">
          <label className="compact-field"><Search size={15} aria-hidden="true" />{t('placeSearch')}
            <input type="search" maxLength={120} value={controls.search} onChange={(event) => onControls({ search: event.target.value, page: 0 })} />
          </label>
          <label className="compact-field">{t('placeSort')}
            <select aria-label={t('placeSort')} value={controls.sort} onChange={(event) => onControls({ sort: event.target.value as PlaceSort, page: 0 })}>
              {Object.entries(sortLabels).map(([key, name]) => <option key={key} value={key}>{t(name)}</option>)}
            </select>
          </label>
        </div>
        {!value && <p role="status" className="muted">{t('loadingView')}</p>}
        {value && <p className="muted">{t('placeCount', { count: number(value.scoped) })}</p>}
        {value && !value.rows.length && <p className="notice">{t(value.scoped ? 'noPlaceMatch' : 'noPlaces')}</p>}
        {!!value?.rows.length && <div className="table-wrap"><table className="archive-table">
          <thead><tr><th scope="col">{t('placeName')}</th><th scope="col">{t('visits')}</th>
            <th scope="col">{t('sortDuration')}</th><th scope="col">{t('lastSeen')}</th></tr></thead>
          <tbody>{value.rows.map((place) => <tr key={place.key} className={active?.place.key === place.key ? 'selected-record' : undefined}>
            <th scope="row"><button type="button" className="button link-button" onClick={() => onControls({ detail: place.target })}>
              <MapPin size={15} aria-hidden="true" />{placeTitle(place.name, place.area, date(place.last, zone))}</button>
              {areaSubtitle(place.name, place.area) && <small className="place-region">{areaSubtitle(place.name, place.area)}</small>}
              {!!place.label?.tags.length && <small>{place.label.tags.join(' · ')}</small>}</th>
            <td>{number(place.count)}</td><td>{timeDuration(place.duration)}</td><td>{date(place.last, zone)}</td>
          </tr>)}</tbody>
        </table></div>}
        {value && value.matches > value.size && <div className="button-row advanced-controls">
          <button className="button secondary" disabled={value.page === 0} onClick={() => onControls({ page: value.page - 1 })}>{t('previousPage')}</button>
          <button className="button secondary" disabled={(value.page + 1) * value.size >= value.matches}
            onClick={() => onControls({ page: value.page + 1 })}>{t('nextPage')}</button>
        </div>}
      </section>
      {active && <section className="panel place-details">
        <header className="place-dossier"><h2>{placeTitle(active.place.name, active.place.area, date(active.place.last, zone))}</h2><p>{t('placeDetails')}
          {active.place.label?.category && active.place.label.category !== 'none' && ' · ' + t(categoryLabels[active.place.label.category])}</p></header>
        {active.place.area && <p className="place-geography"><strong>{t('geographicContext')}</strong> · {areaDetail(active.place.area)}
          {' · '}<a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></p>}
        {!active.place.name && <p className="muted">{t('nameUnavailable')}</p>}
        <dl className="fact-list">
          <div><dt>{t('firstSeen')}</dt><dd>{date(active.place.first, zone)}</dd></div>
          <div><dt>{t('lastSeen')}</dt><dd>{date(active.place.last, zone)}</dd></div>
          <div><dt>{t('visits')}</dt><dd>{number(active.place.count)}</dd></div>
          <div><dt>{t('sortDuration')}</dt><dd>{timeDuration(active.place.duration)}</dd></div>
        </dl>
        <PlaceEditor key={active.place.key + JSON.stringify(active.place.label)} place={active.place} options={value?.rows ?? []} busy={busy}
          zone={zone} mutate={mutate} />
        {result?.map && <MapPanel data={result.map} simple defer theme={theme} />}
        <h3>{t('recentVisits')}</h3>
        <p className="muted">{t('placeVisitTotal', { count: number(active.place.total) })}</p>
        <ul className="advanced-records">
          {active.visits.map((visit) => <li key={visit.id}>
            <button className="button link-button" onClick={() => onDay(dayKey(visit.dayAt, zone), visit.id)}>
              {date(visit.start, zone)} · {timeDuration(visit.end - visit.start)}
            </button>
            {active.place.total > 1 && <button className="button secondary" disabled={busy}
              onClick={() => void mutate({ kind: 'split', visit: visit.id })}>{t('separateVisit')}</button>}
          </li>)}
        </ul>
        {!!active.more && <p className="muted">{t('limitedVisits', { count: number(active.more) })}</p>}
      </section>}
    </div>
  </>
}
