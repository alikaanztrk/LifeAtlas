import { CalendarRange } from 'lucide-react'
import { useState } from 'react'
import { periodRange, validDay } from '../../domain/dates'
import type { DateRange } from '../../domain/dates'
import { t } from '../../locales/i18n'

const labels = { all: 'allDates', year: 'yearRange', month: 'monthRange', custom: 'customRange' }

export function DateFilter({ range, anchor, onApply }: { range: DateRange; anchor: string; onApply: (range: DateRange) => void }) {
  const [kind, setKind] = useState<DateRange['kind']>(range.kind)
  const [first, setFirst] = useState(range.kind === 'all' ? anchor : range.first)
  const [last, setLast] = useState(range.kind === 'all' ? anchor : range.last)
  const [year, setYear] = useState(first.slice(0, 4))
  const [month, setMonth] = useState(first.slice(0, 7))
  const [error, setError] = useState(false)
  return <form className="date-filter" aria-label={t('range')} onSubmit={(event) => {
    event.preventDefault()
    if (kind === 'all') { setError(false); onApply({ kind }); return }
    const date = kind === 'year' ? year + '-01-01' : kind === 'month' ? month + '-01' : first
    if (!validDay(date) || (kind === 'custom' && (!validDay(last) || first > last))) { setError(true); return }
    setError(false)
    onApply(kind === 'custom' ? { kind, first, last } : periodRange(date, kind))
  }}>
    <label><CalendarRange size={16} aria-hidden="true" /><span>{t('range')}</span>
      <select value={kind} onChange={(event) => { setKind(event.target.value as DateRange['kind']); setError(false) }}>
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
      </select>
    </label>
    {kind === 'year' && <label><span>{t('yearRange')}</span><input aria-label={t('yearRange')} type="number"
      min={1899} max={2100} value={year} onChange={(event) => setYear(event.target.value)} /></label>}
    {kind === 'month' && <label><span>{t('monthRange')}</span><input aria-label={t('monthRange')} type="month"
      min="1899-12" max="2100-12" value={month} onChange={(event) => setMonth(event.target.value)} /></label>}
    {kind === 'custom' && <>
      <label>{t('from')}<input type="date" value={first} onChange={(event) => setFirst(event.target.value)} /></label>
      <label>{t('to')}<input type="date" value={last} onChange={(event) => setLast(event.target.value)} /></label>
    </>}
    <button className="button secondary" type="submit">{t('applyRange')}</button>
    {error && <span role="alert" className="danger-text">{t('invalidRange')}</span>}
  </form>
}
