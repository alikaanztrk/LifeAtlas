import { lazy, Suspense } from 'react'
import { MonthGrid } from '../calendar/Calendar'
import { MapPanel } from '../explore/MapPanel'
import type { Theme } from '../../locales/i18n'
import { number, t } from '../../locales/i18n'
import type { ExploreResult } from '../../workers/explore-protocol'

const Charts = lazy(() => import('./Charts'))

export function OverviewInsights({ data, theme, openCalendar, openMap }: {
  data: Extract<ExploreResult, { kind: 'overview' }>; theme: Theme
  openCalendar: (day: string) => void; openMap: () => void
}) {
  const { places, periods, modes } = data.value
  return <div className="overview-insights">
    <Suspense fallback={<p className="notice" role="status">{t('loadingView')}</p>}>
      <Charts periods={periods} modes={modes} theme={theme} openCalendar={openCalendar} />
    </Suspense>
    <div className="insight-grid">
      <section className="panel">
        <h2>{t('calendarPreview')}</h2>
        <MonthGrid cells={data.calendar} metric="evidence" onSelect={openCalendar} compact />
      </section>
      <section className="panel">
        <h2>{t('topPlaces')}</h2>
        <p className="muted">{t('topPlacesHint', { count: number(places.covered) })}</p>
        {places.ranked.length > 0 ? <dl className="fact-list">
          {places.ranked.map((row, index) => <div key={index}><dt>{row.label || t('unnamedPlace')}</dt><dd>{number(row.visits)}</dd></div>)}
        </dl> : <p className="muted">{t('noChart')}</p>}
      </section>
    </div>
    <section className="panel overview-map">
      <div className="view-toolbar"><h2>{t('archiveMap')}</h2>
        <button className="button secondary" onClick={openMap}>{t('mapView')}</button></div>
      <MapPanel data={data.map} theme={theme} simple defer />
    </section>
  </div>
}
