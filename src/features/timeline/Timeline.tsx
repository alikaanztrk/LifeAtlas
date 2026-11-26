import { ArrowLeft, ArrowRight, Dot, Footprints, MapPin, Route } from 'lucide-react'
import { displayDay, moveDay, validDay } from '../../domain/dates'
import { knownMeters, semanticVisits } from '../../domain/exploration'
import type { DayRow, Exploration } from '../../domain/exploration'
import type { MapData } from '../../domain/map-data'
import type { Theme } from '../../locales/i18n'
import { formatDistance, locale, number, t, timeDuration } from '../../locales/i18n'
import { MapPanel } from '../explore/MapPanel'

const icons = { visit: MapPin, activity: Footprints, path: Route, raw: Dot, gap: Dot }
const names = { visit: 'sourceVisit', activity: 'sourceActivity', path: 'sourcePath', raw: 'sourceRaw', gap: 'unknownTime' }

export function Timeline({ day, zone, value, map, theme, selected, onSelect, onDay, openMap, openCalendar }: {
  day: string; zone: string; value?: ReturnType<Exploration['day']>; map?: MapData; theme: Theme
  selected?: string; onSelect: (id: string) => void; onDay: (day: string) => void;
  openMap: (day: string, id?: string) => void; openCalendar: () => void
}) {
  const formatter = new Intl.DateTimeFormat(locale(), { timeStyle: 'short', timeZone: zone })
  const shift = (step: number) => { const next = moveDay(day, step); if (validDay(next)) onDay(next) }
  const summary = value?.summary
  const visits = summary && semanticVisits(summary)
  const mapped = map?.rows.some((row) => row.id === selected)
  const rowContent = (row: DayRow) => {
    const Icon = icons[row.kind]
    const distance = row.distance
    return <>
      <Icon size={18} aria-hidden="true" />
      <span><strong>{row.label || (row.mode ? t('mode.' + row.mode) : t(names[row.kind]))}</strong>
        <small>{formatter.format(row.start)}{row.end > row.start ? ' – ' + formatter.format(row.end) : ''}
          {row.clipped && ' · ' + t('clippedEvent')}</small>
        {distance && (distance.kind === 'recorded' || distance.kind === 'estimated') && <small>
          {t(distance.kind)} · {formatDistance(distance.meters)}</small>}
        {distance?.kind === 'overlap' && <small>{t('overlapDistance')}</small>}
      </span>
    </>
  }
  return <>
    <header className="page-heading overview-heading">
      <div><h1>{t('timeline')}</h1><p>{t('timelineDescription')}</p></div>
      <button className="button secondary" onClick={openCalendar}>{t('openCalendar')}</button>
    </header>
    <div className="view-toolbar day-switch panel">
      <button className="icon-button" aria-label={t('previousDay')} onClick={() => shift(-1)}><ArrowLeft size={17} /></button>
      <div><h2>{displayDay(day, locale(), { dateStyle: 'full' })}</h2><span className="muted">{zone}</span></div>
      <button className="icon-button" aria-label={t('nextDay')} onClick={() => shift(1)}><ArrowRight size={17} /></button>
      <input type="date" aria-label={t('selectedDay')} value={day} onChange={(event) => { if (validDay(event.target.value)) onDay(event.target.value) }} />
    </div>
    <div className="workspace-split">
      <section className="panel">
        <h2>{t('dayDetails')}</h2>
        {!value && <p className="muted" role="status">{t('loadingView')}</p>}
        {value && !value.bounds && <p className="notice">{t('dateOutside')}</p>}
        {summary && <>
          <dl className="day-totals">
            <div><dt>{t('distanceMetric')}</dt><dd>{formatDistance(knownMeters(summary.distance))}</dd></div>
            <div><dt>{t('movementMetric')}</dt><dd>{timeDuration(summary.movementMs)}</dd></div>
            <div><dt>{t('visitMetric')}</dt><dd>{visits === null || visits === undefined ? t('noMetric') : number(visits)}</dd></div>
          </dl>
          {!value?.rows.length && <p className="muted">{t('noDayRecords')}</p>}
        </>}
        {!!value?.rows.length && <ol className="timeline-list">
          {value.rows.map((row) => <li key={row.id} className={row.kind === 'gap' ? 'gap-row' : undefined}>
            {row.kind === 'gap' ? <div className="timeline-row">{rowContent(row)}</div>
              : <button type="button" className="timeline-row" aria-pressed={selected === row.id} onClick={() => onSelect(row.id)}>{rowContent(row)}</button>}
          </li>)}
        </ol>}
        {!!value?.omitted && <p className="muted">{t('truncatedRows', { count: number(value.omitted) })}</p>}
      </section>
      {map && value?.bounds && <section className="panel timeline-map">
        <div className="view-toolbar"><h2>{t('archiveMap')}</h2>
          <button className="button secondary" onClick={() => openMap(day, mapped ? selected : undefined)}>{t('mapView')}</button></div>
        <MapPanel data={map} theme={theme} simple selected={selected} onSelect={onSelect} />
      </section>}
    </div>
  </>
}
