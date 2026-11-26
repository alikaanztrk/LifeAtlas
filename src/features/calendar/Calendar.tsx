import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { dayOfWeek, displayDay, moveDay, movePeriod, validDay } from '../../domain/dates'
import type { CalendarView } from '../../domain/dates'
import type { DayCell } from '../../domain/exploration'
import { formatDistance, locale, number, t, timeDuration } from '../../locales/i18n'

type Metric = 'evidence' | 'meters' | 'movementMs' | 'visits'
const metrics: Record<Metric, string> = { evidence: 'evidence', meters: 'distanceMetric', movementMs: 'movementMetric', visits: 'visitMetric' }
const weekdays = Array.from({ length: 7 }, (_, index) => '2025-01-' + String(index + 6).padStart(2, '0'))
const arrows: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

function valueOf(cell: DayCell, metric: Metric) {
  if (cell.status !== 'evidence') return t(cell.status === 'empty' ? 'emptyDay' : 'outsideRange')
  if (metric === 'evidence') return t('evidenceDay')
  const value = cell[metric]
  if (value === null) return t('unknownMetric')
  if (metric === 'meters') return formatDistance(value)
  if (metric === 'movementMs') return timeDuration(value)
  return number(value)
}

function cellTone(cell: DayCell, metric: Metric, max: number) {
  if (cell.status !== 'evidence') return cell.status
  if (metric === 'evidence') return 'level-2'
  const value = cell[metric]
  if (value === null) return 'unavailable'
  if (value === 0) return 'zero'
  if (value >= max * .66) return 'level-3'
  if (value >= max * .33) return 'level-2'
  return 'level-1'
}

export function MonthGrid({ cells, metric, selected, onSelect, compact = false, max = 1 }: {
  cells: DayCell[]; metric: Metric; selected?: string; onSelect: (day: string) => void; compact?: boolean; max?: number
}) {
  const [focused, setFocused] = useState<string>()
  const first = cells[0]?.day
  if (!first) return null
  const monday = locale() === 'tr-TR'
  const offset = monday ? dayOfWeek(first) - 1 : dayOfWeek(first) % 7
  const labels = monday ? weekdays : [weekdays[6]!, ...weekdays.slice(0, 6)]
  const tabDay = cells.find((cell) => cell.day === (focused ?? selected))?.day ?? first
  return <div className={'month-grid' + (compact ? ' compact-calendar' : '')}>
    {labels.map((day) => <span className="weekday" key={day} aria-hidden="true">
      {displayDay(day, locale(), { weekday: compact ? 'narrow' : 'short' })}
    </span>)}
    {Array.from({ length: offset }, (_, index) => <span key={'empty-' + index} />)}
    {cells.map((cell) => {
      const value = valueOf(cell, metric)
      const label = displayDay(cell.day, locale(), { dateStyle: 'full' }) + ' · ' + value
      return <button type="button" key={cell.day} className={'calendar-cell ' + cellTone(cell, metric, max)}
        aria-label={label} title={label} data-day={cell.day} tabIndex={tabDay === cell.day ? 0 : -1}
        aria-pressed={selected === cell.day} onClick={() => onSelect(cell.day)} onFocus={() => setFocused(cell.day)}
        onKeyDown={(event) => {
          const delta = arrows[event.key]
          if (!delta) return
          const next = moveDay(cell.day, delta)
          const button = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('button[data-day="' + next + '"]')
          if (button) { event.preventDefault(); button.focus() }
        }}>
        <time dateTime={cell.day}>{number(Number(cell.day.slice(-2)))}</time>
        {!compact && metric !== 'evidence' && cell.status === 'evidence' && <small>{value}</small>}
      </button>
    })}
  </div>
}

export function Calendar({ day, view, cells, onDay, onView, openDay }: {
  day: string; view: CalendarView; cells?: DayCell[]; onDay: (day: string) => void
  onView: (view: CalendarView) => void; openDay: (day: string) => void
}) {
  const [metric, setMetric] = useState<Metric>('evidence')
  const months = new Map<string, DayCell[]>()
  for (const cell of cells ?? []) {
    const month = cell.day.slice(0, 7)
    const entries = months.get(month)
    if (entries) entries.push(cell)
    else months.set(month, [cell])
  }
  const max = metric === 'evidence' ? 1 : Math.max(1, ...(cells ?? []).map((cell) => cell[metric] ?? 0))
  const selected = cells?.find((cell) => cell.day === day)
  const step = (distance: number) => {
    const next = movePeriod(day, view, distance)
    if (validDay(next)) onDay(next)
  }
  return <>
    <header className="page-heading"><h1>{t('calendar')}</h1><p>{t('calendarDescription')}</p></header>
    <div className="workspace-split calendar-layout">
      <section className="panel">
        <div className="view-toolbar">
          <button className="icon-button" aria-label={t('previousPeriod')} onClick={() => step(-1)}><ArrowLeft size={17} /></button>
          <h2>{displayDay(day, locale(), view === 'year' ? { year: 'numeric' } : { year: 'numeric', month: 'long' })}</h2>
          <button className="icon-button" aria-label={t('nextPeriod')} onClick={() => step(1)}><ArrowRight size={17} /></button>
          <label className="compact-field">
            <span className="sr-only">{t('calendarPeriod')}</span>
            <input type={view === 'year' ? 'number' : 'month'} key={view + day.slice(0, 7)}
              aria-label={t('calendarPeriod')} defaultValue={day.slice(0, view === 'year' ? 4 : 7)}
              onChange={(event) => {
                const value = event.target.value + (view === 'year' ? '-01-01' : '-01')
                if (validDay(value)) onDay(value)
              }} />
          </label>
        </div>
        <div className="view-toolbar calendar-controls">
          <div className="segmented">
            <button className="button secondary" aria-pressed={view === 'month'} onClick={() => onView('month')}>{t('monthView')}</button>
            <button className="button secondary" aria-pressed={view === 'year'} onClick={() => onView('year')}>{t('yearView')}</button>
          </div>
          <label className="compact-field">{t('calendarMetric')}<select value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>
            {Object.entries(metrics).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
          </select></label>
        </div>
        {!cells && <p className="muted" role="status">{t('loadingView')}</p>}
        <div className={view === 'year' ? 'year-grid' : undefined}>
          {Array.from(months, ([month, values]) => <section key={month}>
            {view === 'year' && <h3>{displayDay(month + '-01', locale(), { month: 'short' })}</h3>}
            <MonthGrid cells={values} metric={metric} max={max} selected={day} onSelect={onDay} compact={view === 'year'} />
          </section>)}
        </div>
        <ul className="calendar-legend">
          {(metric === 'evidence'
            ? [['level-2', 'evidenceDay'], ['empty', 'emptyDay'], ['outside', 'outsideRange']]
            : [['level-2', 'evidenceDay'], ['zero', 'knownZero'], ['unavailable', 'unknownMetric'], ['empty', 'emptyDay'], ['outside', 'outsideRange']])
            .map(([tone, label]) => <li key={tone}><i className={tone} aria-hidden="true" />{t(label ?? '')}</li>)}
        </ul>
      </section>
      <section className="panel day-detail">
        <h2>{t('dayDetails')}</h2><p className="muted">{displayDay(day, locale(), { dateStyle: 'full' })}</p>
        {selected && <><p className="day-evidence">{valueOf(selected, 'evidence')}</p>
          <dl className="fact-list">
            <div><dt>{t('distanceMetric')}</dt><dd>{formatDistance(selected.meters)}</dd></div>
            <div><dt>{t('movementMetric')}</dt><dd>{timeDuration(selected.movementMs)}</dd></div>
            <div><dt>{t('visitMetric')}</dt><dd>{selected.visits === null ? t('noMetric') : number(selected.visits)}</dd></div>
          </dl>
          <button className="button primary" disabled={selected.status === 'outside'} onClick={() => openDay(day)}>{t('openDay')}</button>
        </>}
      </section>
    </div>
  </>
}
