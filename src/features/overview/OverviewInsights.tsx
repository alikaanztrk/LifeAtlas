import { lazy, Suspense } from 'react'
import { ArrowUpRight, Compass, Globe2, MapPin } from 'lucide-react'
import { MonthGrid } from '../calendar/Calendar'
import { MapPanel } from '../explore/MapPanel'
import type { Theme } from '../../locales/i18n'
import { number, t } from '../../locales/i18n'
import { areaDetail, areaName, countryName, placeTitle } from '../../locales/geography'
import type { ExploreResult } from '../../workers/explore-protocol'

const Charts = lazy(() => import('./Charts'))

type OverviewResult = Extract<ExploreResult, { kind: 'overview' }>

export function OverviewAtlas({ data, theme, openMap }: {
  data: OverviewResult; theme: Theme; openMap: () => void
}) {
  const { areas } = data
  const { kinds } = data.value.summary
  const primaryTown = areas?.towns[0]?.area
  const primaryCountry = areas?.regions[0]
  return <section className="atlas-overview" aria-labelledby="atlas-overview-heading">
      <div className="atlas-story">
        <p className="atlas-eyebrow"><Compass size={17} aria-hidden="true" />{t('geography')}</p>
        <h2 id="atlas-overview-heading">{t('geographicOverview')}</h2>
        <p>{areas
          ? areas.inspected ? t(areas.basis === 'visits' ? 'geographicVisits' : 'geographicPositions', {
            matched: number(areas.matched), total: number(areas.inspected),
          }) : t('noGeography')
          : t(kinds.visit || kinds.raw ? 'geographyUnavailable' : 'noGeography')}</p>
        {primaryCountry && <p className="atlas-primary-area">
          {primaryTown ? areaDetail(primaryTown) : countryName(primaryCountry.code)}
        </p>}
        {!!areas?.matched && <dl className="atlas-totals">
          <div><dt><Globe2 size={16} aria-hidden="true" />{t('countriesSeen')}</dt><dd>{number(areas.countries)}</dd></div>
          <div><dt><MapPin size={16} aria-hidden="true" />{t('settlementsSeen')}</dt><dd>{number(areas.settlements)}</dd></div>
        </dl>}
        <button className="button atlas-action" type="button" onClick={openMap}>{t('mapView')}<ArrowUpRight size={17} aria-hidden="true" /></button>
      </div>
      <MapPanel data={data.map} theme={theme} simple />
  </section>
}

export function OverviewInsights({ data, theme, openCalendar, openPlaces }: {
  data: OverviewResult; theme: Theme; openCalendar: (day: string) => void; openPlaces: (detail?: string) => void
}) {
  const { periods, modes } = data.value
  const { areas, places } = data
  return <div className="overview-insights">
    {!!areas?.matched && <div className="geography-breakdown">
      <section className="panel">
        <h2>{t('countryRanking')}</h2>
        <dl>{areas.regions.map((region) => <div key={region.code}>
          <dt>{countryName(region.code)}</dt><dd>{number(region.count)}</dd>
        </div>)}</dl>
      </section>
      <section className="panel">
        <h2>{t('settlementRanking')}</h2>
        {areas.towns.length > 0 ? <dl>{areas.towns.map(({ area, count }) => <div key={area.settlement?.id}>
          <dt>{areaName(area)}<small>{countryName(area.country)}</small></dt><dd>{number(count)}</dd>
        </div>)}</dl> : <p className="muted">{t('noGeography')}</p>}
        <p className="muted">{t('geographyMethod')} <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></p>
      </section>
    </div>}
    <Suspense fallback={<p className="notice" role="status">{t('loadingView')}</p>}>
      <Charts periods={periods} modes={modes} theme={theme} openCalendar={openCalendar} />
    </Suspense>
    <div className="insight-grid">
      <section className="panel">
        <h2>{t('calendarPreview')}</h2>
        <MonthGrid cells={data.calendar} metric="evidence" onSelect={openCalendar} compact />
      </section>
      <section className="panel">
        <div className="view-toolbar"><h2>{t('topPlaces')}</h2>
          {places.length > 0 && <button className="button secondary" type="button" onClick={() => openPlaces()}>{t('viewLocations')}</button>}
        </div>
        {places.length > 0 ? <dl className="fact-list">
          {places.map((row) => <div key={row.key}>
            <dt><button className="button link-button" type="button" onClick={() => openPlaces(row.target)}>
              {placeTitle(row.name, row.area)}
            </button></dt><dd>{number(row.count)}</dd>
          </div>)}
        </dl> : <p className="muted">{t('noChart')}</p>}
      </section>
    </div>
  </div>
}
