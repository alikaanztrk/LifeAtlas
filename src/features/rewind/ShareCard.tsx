import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import type { RewindReport } from '../../domain/rewind'
import type { CalendarView } from '../../domain/dates'
import { displayDay } from '../../domain/dates'
import { shareFields, shareMeasurements } from '../../domain/share-card'
import type { ShareField, ShareLayout, ShareMeasurement } from '../../domain/share-card'
import { formatDistance, locale, number, t, timeDuration } from '../../locales/i18n'
import { drawCard } from './card-image'

const labels: Record<ShareField, string> = {
  coverage: 'chapterCoverage', distance: 'distance', movement: 'movementMetric', visits: 'visits',
}

function cardText(metric: ShareMeasurement) {
  const title = t(labels[metric.kind])
  if (metric.kind === 'coverage') return { title, value: number(metric.count) + ' / ' + number(metric.total) }
  if (metric.kind === 'movement') return { title, value: timeDuration(metric.ms) }
  if (metric.kind === 'visits') return { title, value: number(metric.count) }
  const detail = [
    metric.recorded === null ? '' : t('recorded') + ' ' + formatDistance(metric.recorded),
    metric.estimated === null ? '' : t('estimated') + ' ' + formatDistance(metric.estimated),
  ].filter(Boolean).join(' · ')
  return { title, value: formatDistance(metric.meters), detail }
}

export function ShareCard({ report, view, demo, onClose }: {
  report: RewindReport; view: CalendarView; demo: boolean; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const preview = useRef<HTMLCanvasElement>(null)
  const [layout, setLayout] = useState<ShareLayout>('portrait')
  const [fields, setFields] = useState<ShareField[]>([...shareFields])
  const [showPeriod, setShowPeriod] = useState(true)
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)
  const alive = useRef(false)
  const language = locale()
  const options = shareMeasurements(report, shareFields)
  const metrics = useMemo(() => shareMeasurements(report, fields).map(cardText), [report, fields])
  const title = t(view === 'month' ? 'rewindMonth' : 'rewindYear')
  const edition = showPeriod ? displayDay(report.period.first, language,
    view === 'month' ? { month: 'long', year: 'numeric' } : { year: 'numeric' }) : undefined
  const status = report.partial ? t('rewindPartial') : undefined
  const footer = demo ? t('shareDemo') + ' · ' + t('shareMadeLocal') : t('shareMadeLocal')
  const image = useMemo(() => ({ title, edition, status, footer, metrics }), [title, edition, status, footer, metrics])

  useEffect(() => {
    const element = dialog.current
    alive.current = true
    element?.showModal()
    close.current?.focus()
    return () => { alive.current = false; element?.close() }
  }, [])

  useLayoutEffect(() => {
    if (preview.current && image.metrics.length) setFailed(!drawCard(preview.current, layout, image))
  }, [image, layout])

  function download() {
    const canvas = preview.current
    if (!canvas || failed || pending || !image.metrics.length) return
    setPending(true)
    canvas.toBlob((blob) => {
      if (!alive.current) return
      setPending(false)
      if (!blob) { setFailed(true); return }
      const address = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = address
      link.download = 'lifeatlas-rewind.png'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(address), 1_000)
    }, 'image/png')
  }

  return <dialog ref={dialog} className="dialog share-dialog" aria-labelledby="share-title" onCancel={(event) => {
    event.preventDefault()
    onClose()
  }}>
    <div className="share-heading">
      <div><h2 id="share-title">{t('shareHeading')}</h2><p>{t('shareIntro')}</p></div>
      <button ref={close} className="icon-button" aria-label={t('dismiss')} onClick={onClose}><X size={18} /></button>
    </div>
    <div className="share-workspace">
      <div className="share-options">
        <p>{t('sharePrivacy')}</p>
        <label className="compact-field">{t('shareLayout')}
          <select aria-label={t('shareLayout')} value={layout} onChange={(event) => setLayout(event.target.value === 'square' ? 'square' : 'portrait')}>
            <option value="portrait">{t('sharePortrait')}</option><option value="square">{t('shareSquare')}</option>
          </select>
        </label>
        <fieldset>
          <legend>{t('shareFields')}</legend>
          <label><input type="checkbox" checked={showPeriod} onChange={(event) => setShowPeriod(event.target.checked)} />{t('sharePeriod')}</label>
          {options.map(({ kind }) => <label key={kind}><input type="checkbox" checked={fields.includes(kind)} onChange={(event) => {
            const checked = event.target.checked
            setFields((previous) => checked ? [...previous, kind] : previous.filter((field) => field !== kind))
          }} />{t(labels[kind])}</label>)}
        </fieldset>
        <button className="button primary" onClick={download} disabled={failed || pending || !metrics.length}><Download size={17} />{t('shareDownload')}</button>
      </div>
      <div className="share-art">
        {metrics.length ? <canvas ref={preview} className="share-preview" role="img" aria-label={t('sharePreview')} />
          : <p className="notice">{t('shareNoFields')}</p>}
        {failed && <p className="notice error" role="alert">{t('shareFailed')}</p>}
        <dl className="sr-only">{metrics.map((metric) => <div key={metric.title}><dt>{metric.title}</dt><dd>{metric.value} {metric.detail}</dd></div>)}</dl>
      </div>
    </div>
  </dialog>
}
