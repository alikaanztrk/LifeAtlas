import { Activity, CalendarDays, Footprints, Layers, Route } from 'lucide-react'
import type { ReactNode } from 'react'
import { DiagnosticDetails, FileReports, Issues } from '../../components/Reports'
import type { ImportReport, Summary } from '../../domain/model'
import { date, formatDistance, number, t, timeDuration } from '../../locales/i18n'

type MetricProps = { icon: ReactNode; title: string; value: string; children: ReactNode }

function Metric({ icon, title, value, children }: MetricProps) {
  return (
    <section className="panel metric">
      <div className="metric-title"><span className="metric-icon" aria-hidden="true">{icon}</span><h2>{title}</h2></div>
      <p className="metric-value">{value}</p>
      <div className="metric-details">{children}</div>
    </section>
  )
}

export type OverviewData = { summary: Summary; report: ImportReport; mergedDuplicates?: number }

export function Overview({ value, isDemo, loading, onDemo, onImport, extra, filtered = false }: {
  value: OverviewData | null; isDemo: boolean; loading: boolean; onDemo: () => void; onImport: () => void
  extra?: ReactNode; filtered?: boolean
}) {
  if (loading) return <div className="panel centered-state" role="status">{t('storageLoading')}</div>
  if (!value) return (
    <section className="panel centered-state">
      <div className="icon-tile"><Layers aria-hidden="true" /></div>
      <h1>{t('emptyTitle')}</h1><p className="muted">{t('emptyHint')}</p>
      <div className="button-row">
        <button className="button primary" onClick={onImport}>{t('import')}</button>
        <button className="button secondary" onClick={onDemo}>{t('loadDemo')}</button>
      </div>
    </section>
  )
  const { summary, report } = value
  const { distance, kinds, first, last, zone } = summary
  const total = distance.recorded === null && distance.estimated === null ? null
    : (distance.recorded ?? 0) + (distance.estimated ?? 0)

  return (
    <>
      <header className="page-heading overview-heading">
        <div><h1>{t('archiveTitle')}</h1><p>{t(filtered ? 'filtered' : 'archiveIntro')}</p></div>
        <dl className="period">
          <dt>{t('period')}</dt>
          <dd>{first === null || last === null ? t('noDate') : date(first, zone) + ' – ' + date(last, zone)}</dd>
          <dt>{t('zone')}</dt><dd>{zone}</dd>
        </dl>
      </header>
      {isDemo && <p className="notice warning" role="status">{t('demoNotice')}</p>}
      <div className="metric-grid">
        <Metric icon={<Route size={18} />} title={t('distance')} value={formatDistance(total)}>
          <dl className="distance-parts">
            <div><dt>{t('recorded')}</dt><dd>{formatDistance(distance.recorded)}</dd></div>
            <div><dt>{t('estimated')}</dt><dd>{formatDistance(distance.estimated)}</dd></div>
          </dl>
          {(distance.unknownActivities > 0 || distance.excludedActivities > 0) && <p>
            {t('distanceDetail', { unknown: number(distance.unknownActivities), excluded: number(distance.excludedActivities) })}
          </p>}
        </Metric>
        <Metric icon={<CalendarDays size={18} />} title={t('days')}
          value={summary.evidenceDays === null ? t('noMetric') : number(summary.evidenceDays)}>
          <p>{t('daysDetail')}</p>
        </Metric>
        <Metric icon={<Activity size={18} />} title={t('movement')} value={timeDuration(summary.movementMs)}>
          <p>{t('movementDetail')}</p>
        </Metric>
        <Metric icon={<Footprints size={18} />} title={t('visits')}
          value={kinds.visit || kinds.activity ? number(kinds.visit) : t('noMetric')}>
          <p>{t('visitsDetail')}</p>
        </Metric>
      </div>
      {extra}
      <section className="quality-section" aria-labelledby="quality-heading">
        <h2 id="quality-heading">{t('quality')}</h2><p className="muted">{t('qualityIntro')}</p>
        <div className="review-grid">
          <section className="panel">
            <h3>{t('archiveQuality')}</h3>
            <dl className="fact-list">
              <div><dt>{t('visitCount')}</dt><dd>{number(kinds.visit)}</dd></div>
              <div><dt>{t('activityCount')}</dt><dd>{number(kinds.activity)}</dd></div>
              <div><dt>{t('pathCount')}</dt><dd>{number(kinds.path)}</dd></div>
              <div><dt>{t('rawCount')}</dt><dd>{number(kinds.raw)}</dd></div>
              <div><dt>{t('visitTime')}</dt><dd>{timeDuration(summary.visitMs)}</dd></div>
              <div><dt>{t('observed')}</dt><dd>{timeDuration(summary.observedMs)}</dd></div>
              <div><dt>{t('places')}
                {summary.capabilities.stablePlaces && <small>{t('placesHint', { count: number(summary.explicitPlaceVisits) })}</small>}
              </dt><dd>{summary.stablePlaceCount === null ? t('noMetric') : number(summary.stablePlaceCount)}</dd></div>
              <div><dt>{t('hasLabels')}</dt><dd>{t(summary.capabilities.placeNames ? 'yes' : 'no')}</dd></div>
            </dl>
            <Issues counts={summary.quality} />
          </section>
          <section className="panel">
            <h3>{t('lastImport')}</h3>
            <dl className="fact-list preview-facts">
              <div><dt>{t('duplicates')}</dt><dd>{number(report.duplicates)}</dd></div>
              {Boolean(value.mergedDuplicates) && <div>
                <dt>{t('mergedDuplicates')}</dt><dd>{number(value.mergedDuplicates ?? 0)}</dd>
              </div>}
            </dl>
            <FileReports report={report} />
            <DiagnosticDetails report={report} />
          </section>
        </div>
      </section>
    </>
  )
}
