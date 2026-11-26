import { useState } from 'react'
import { displayDay } from '../../domain/dates'
import { isDays } from '../../domain/edits'
import type { Days } from '../../domain/edits'
import { knownMeters, semanticVisits } from '../../domain/exploration'
import type { PeriodMetrics } from '../../domain/analytics'
import { formatDistance, locale, number, printDays, t, timeDuration } from '../../locales/i18n'
import type { ExploreResult, RankedPlace } from '../../workers/explore-protocol'

type Value = NonNullable<Extract<ExploreResult, { kind: 'analytics' }>['value']>

function ComparisonForm({ value, onCompare }: { value: Days; onCompare: (value?: Days) => void }) {
  const [first, setFirst] = useState(value.first)
  const [last, setLast] = useState(value.last)
  const [invalid, setInvalid] = useState(false)
  return <form className="view-toolbar compare-form" onSubmit={(event) => {
    event.preventDefault()
    const days = { first, last }
    if (!isDays(days)) { setInvalid(true); return }
    setInvalid(false)
    onCompare(days)
  }}>
    <label className="compact-field">{t('compareFrom')}<input type="date" required value={first}
      onChange={(event) => setFirst(event.target.value)} /></label>
    <label className="compact-field">{t('compareTo')}<input type="date" required value={last}
      onChange={(event) => setLast(event.target.value)} /></label>
    <button className="button primary" type="submit">{t('applyRange')}</button>
    <button className="button secondary" type="button" onClick={() => { setInvalid(false); onCompare(undefined) }}>{t('previousEqual')}</button>
    {invalid && <p className="notice error" role="alert">{t('invalidRange')}</p>}
  </form>
}

function Comparison({ value }: { value: Value }) {
  const signed = new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' })
  const visits = (period: PeriodMetrics) => {
    const count = semanticVisits(period.summary)
    return count === null ? t('noMetric') : number(count)
  }
  const coverage = (period: PeriodMetrics) => t(period.days === 1 ? 'coverageDay' : 'coverageFraction', {
    count: number(period.summary.evidenceDays ?? 0), total: number(period.days),
  })
  const rows = [
    { label: 'distance', show: (p: PeriodMetrics) => formatDistance(knownMeters(p.summary.distance)), delta: value.change.distance },
    { label: 'recorded', show: (p: PeriodMetrics) => formatDistance(p.summary.distance.recorded) },
    { label: 'estimated', show: (p: PeriodMetrics) => formatDistance(p.summary.distance.estimated) },
    { label: 'movement', show: (p: PeriodMetrics) => timeDuration(p.summary.movementMs), delta: value.change.movement },
    { label: 'visits', show: visits, delta: value.change.visits },
    { label: 'coverageLabel', show: coverage, delta: value.change.evidence },
  ]
  return <>
    <div className="compare-periods">
      {([['currentPeriod', value.current], ['baselinePeriod', value.previous]] as const).map(([key, period]) => <div key={key}>
        <strong>{t(key)}</strong><p>{printDays(period.first, period.last)}</p>
        <small>{t(period.days === 1 ? 'periodOneDay' : 'periodDaysCount', { count: number(period.days) })}</small>
      </div>)}
    </div>
    {value.current.days !== value.previous.days && <p className="notice warning">{t('unequalPeriods')}</p>}
    <div className="table-wrap" role="region" aria-label={t('comparison')} tabIndex={0}><table className="archive-table compare-table">
      <thead><tr><th scope="col">{t('metricLabel')}</th><th scope="col">{t('currentPeriod')}</th>
        <th scope="col">{t('baselinePeriod')}</th><th scope="col">{t('delta')}</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.label}>
        <th scope="row">{t(row.label)}</th><td>{row.show(value.current)}</td><td>{row.show(value.previous)}</td>
        <td>{row.delta == null ? '—' : signed.format(row.delta)}</td>
      </tr>)}</tbody>
    </table></div>
    {Object.values(value.change).some((delta) => delta === null) && <p className="muted">{t('changeUnavailable')}</p>}
  </>
}

function Modes({ value }: { value: Value }) {
  const percent = new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 1 })
  const time = value.current.summary.movementMs
  const distance = knownMeters(value.current.summary.distance)
  const share = (mode: string, metric: string, part: number | null, total: number | null) => {
    if (part === null || total === null || total === 0) return '—'
    const fraction = part / total
    const text = percent.format(fraction)
    return <span className="share-value"><meter max={1} value={Math.min(1, fraction)}
      aria-label={t('mode.' + mode) + ' · ' + t(metric) + ' · ' + text} />{text}</span>
  }
  return <section className="panel">
    <h2>{t('modeAnalysis')}</h2><p className="muted">{t('modeAnalysisHint')}</p>
    {!value.modes.length ? <p className="muted chart-empty">{t('noChart')}</p> :
      <div className="table-wrap" role="region" aria-label={t('modeAnalysis')} tabIndex={0}>
      <table className="archive-table modes-table">
        <thead><tr><th scope="col">{t('transportMode')}</th><th scope="col">{t('movementMetric')}</th>
          <th scope="col">{t('share')}</th><th scope="col">{t('distanceMetric')}</th><th scope="col">{t('share')}</th></tr></thead>
        <tbody>{value.modes.map((item) => <tr key={item.mode}><th scope="row">{t('mode.' + item.mode)}</th>
          <td>{timeDuration(item.ms)}</td><td>{share(item.mode, 'movementMetric', item.ms, time)}</td>
          <td>{formatDistance(item.meters)}
            {item.recorded !== null && <small>{t('recorded')} · {formatDistance(item.recorded)}</small>}
            {item.estimated !== null && <small>{t('estimated')} · {formatDistance(item.estimated)}</small>}
          </td><td>{share(item.mode, 'distanceMetric', item.meters, distance)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>
}

function MovementBars({ labels, values, total, title }: {
  labels: string[]; values: number[]; total: number; title: string
}) {
  const max = Math.max(1, ...values)
  return <section className="panel">
    <h2>{t(title)}</h2>
    {total > 0 ? <ul className="histogram">
      {labels.map((label, index) => {
        const ms = values[index] ?? 0
        return <li key={label}><span>{label}</span>
          <meter value={ms} max={max} aria-label={label + ' · ' + timeDuration(ms)} />
          <strong>{timeDuration(ms)}</strong></li>
      })}
    </ul> : <p className="muted chart-empty">{t('noChart')}</p>}
  </section>
}

export function Analytics({ value, baseline, onCompare, zone, ready, places, onPlace }: {
  value?: Value; baseline?: Days; onCompare: (next?: Days) => void; zone: string; ready: boolean
  places: RankedPlace[]; onPlace: (target: string) => void
}) {
  const weekday = Array.from({ length: 7 }, (_, index) => displayDay('2025-01-' + String(index + 6).padStart(2, '0'),
    locale(), { weekday: 'short' }))
  const clock = new Intl.NumberFormat(locale(), { minimumIntegerDigits: 2 })
  const hours = Array.from({ length: 24 }, (_, index) => clock.format(index) + ':00')
  const inputs = baseline ?? value?.previous
  return <>
    <header className="page-heading"><h1>{t('analytics')}</h1><p>{t('analyticsIntro')}</p></header>
    <div className="advanced-stack">
      <section className="panel">
        <h2>{t('comparison')}</h2>
        {inputs && <ComparisonForm key={inputs.first + inputs.last} value={inputs} onCompare={onCompare} />}
        {value ? <Comparison value={value} /> : <p role="status" className="muted">{t(ready ? 'noChart' : 'loadingView')}</p>}
      </section>
      {value && <>
        <Modes value={value} />
        <section className="panel">
          <h2>{t('topLocalPlaces')}</h2>
          {places.length ? <dl className="fact-list">
            {places.map((place) => <div key={place.key}><dt><button className="button link-button" onClick={() => onPlace(place.target)}>
              {place.name || t('unnamedPlace')}</button></dt><dd>{t(place.count === 1 ? 'onePlaceVisit' : 'placeVisitsCount',
              { count: number(place.count) })}</dd></div>)}
          </dl> : <p className="muted">{t('noPlaces')}</p>}
        </section>
        <p className="muted clock-note">{t('clockPolicy', { zone })}</p>
        <div className="insight-grid"><MovementBars labels={weekday} values={value.movement.byWeekday} total={value.movement.total} title="weekdayMovement" />
          <MovementBars labels={hours} values={value.movement.byHour} total={value.movement.total} title="hourlyMovement" /></div>
      </>}
    </div>
  </>
}
