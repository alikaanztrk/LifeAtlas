import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Maximize, Pause, Play, Share2 } from 'lucide-react'
import { displayDay, movePeriod, validDay } from '../../domain/dates'
import type { CalendarView } from '../../domain/dates'
import { knownMeters } from '../../domain/exploration'
import type { RewindChapter, RewindReport } from '../../domain/rewind'
import { formatDistance, locale, number, printDays, t, timeDuration } from '../../locales/i18n'
import { ShareCard } from './ShareCard'

const chapterTitles: Record<RewindChapter, string> = {
  coverage: 'chapterCoverage', distance: 'chapterDistance', movement: 'chapterMovement', places: 'chapterPlaces',
  highlightDay: 'chapterDay', longestJourney: 'chapterJourney', comparison: 'chapterComparison',
}

function Chapter({ kind, report, onDay }: { kind: RewindChapter; report: RewindReport; onDay: (day: string) => void }) {
  const { summary, busiest, longest, compare } = report
  if (!summary) return null
  if (kind === 'coverage') return <>
    <p className="story-metric">{number(summary.evidenceDays ?? 0)} <span>/ {number(report.includedDays)}</span></p>
    <p>{t('coverageNote')}</p>
  </>
  if (kind === 'distance') return <>
    <p className="story-metric">{formatDistance(knownMeters(summary.distance))}</p>
    <dl className="story-facts">
      <div><dt>{t('recorded')}</dt><dd>{formatDistance(summary.distance.recorded)}</dd></div>
      <div><dt>{t('estimated')}</dt><dd>{formatDistance(summary.distance.estimated)}</dd></div>
    </dl>
  </>
  if (kind === 'movement') {
    const percent = new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 1 })
    const total = summary.movementMs ?? 0
    return <>
      <p className="story-metric">{timeDuration(summary.movementMs)}</p>
      {total > 0 && <><p>{t('movementDenominator')}</p><dl className="story-facts">
        {report.modes.map(({ mode, ms }) => <div key={mode}><dt>{t('mode.' + mode)}</dt>
          <dd>{timeDuration(ms)} · {percent.format(ms / total)}</dd></div>)}
      </dl></>}
    </>
  }
  if (kind === 'places') return <dl className="story-facts story-places">
    {report.places.map((place, index) => <div key={index}><dt>{place.name || t('unnamedPlace')}</dt>
      <dd>{t(place.count === 1 ? 'onePlaceVisit' : 'placeVisitsCount', { count: number(place.count) })}</dd>
    </div>)}
  </dl>
  if (kind === 'highlightDay' && busiest) return <>
    <p className="story-metric">{timeDuration(busiest.movementMs)}</p>
    <p>{displayDay(busiest.day, locale(), { dateStyle: 'long' })}</p>
    <button className="button secondary" onClick={() => onDay(busiest.day)}>{t('openDay')}</button>
  </>
  if (kind === 'longestJourney' && longest) return <>
    <p className="story-metric">{formatDistance(longest.meters)}</p>
    <p>{displayDay(longest.day, locale(), { dateStyle: 'long' })} · {t('mode.' + longest.mode)}</p>
    <button className="button secondary" onClick={() => onDay(longest.day)}>{t('openDay')}</button>
  </>
  if (kind === 'comparison' && compare) return <>
    <p className="story-metric">{new Intl.NumberFormat(locale(), {
      style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 1,
    }).format(compare.change)}</p>
    <p>{t('rewindCompareNote')}</p>
    <dl className="story-facts"><div><dt>{printDays(compare.dates.first, compare.dates.last)}</dt>
      <dd>{formatDistance(compare.meters)}</dd></div></dl>
    <p>{t('evidenceCounts', { current: number(compare.currentDays), previous: number(compare.previousDays) })}</p>
  </>
  return null
}

function Story({ report, view, demo, onDay }: { report: RewindReport; view: CalendarView; demo: boolean; onDay: (day: string) => void }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [screenError, setScreenError] = useState(false)
  const frame = useRef<HTMLElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const total = report.chapters.length
  const kind = report.chapters[index]
  const running = playing && index < total - 1
  const title = displayDay(report.period.first, locale(), view === 'month' ? { month: 'long', year: 'numeric' } : { year: 'numeric' })

  useEffect(() => {
    if (!running) return
    const timer = window.setTimeout(() => setIndex((value) => value + 1), 8_000)
    const visibility = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', visibility)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', visibility) }
  }, [running, index])

  useEffect(() => {
    const change = () => setFullscreen(document.fullscreenElement === frame.current)
    document.addEventListener('fullscreenchange', change)
    return () => document.removeEventListener('fullscreenchange', change)
  }, [])

  function go(next: number) {
    setPlaying(false)
    setIndex(Math.min(total - 1, Math.max(0, next)))
  }

  function toggle() {
    if (running) setPlaying(false)
    else {
      if (index === total - 1) setIndex(0)
      setPlaying(true)
    }
  }

  async function present() {
    setScreenError(false)
    try {
      if (document.fullscreenElement === frame.current) await document.exitFullscreen()
      else await frame.current?.requestFullscreen()
      panel.current?.focus()
    } catch { setScreenError(true) }
  }

  if (!kind) return null
  const progress = t('rewindStep', { current: number(index + 1), total: number(total) })
  return <section className="rewind-story" ref={frame} aria-label={t('rewind')}>
    <div className="rewind-top">
      <div className="rewind-period-label"><strong>{title}</strong>
        {report.partial && <span className="rewind-partial">{t('rewindPartial')}</span>}
      </div>
      {document.fullscreenEnabled && <button className="button secondary" onClick={() => void present()}>
        <Maximize size={15} aria-hidden="true" />{t(fullscreen ? 'rewindExit' : 'rewindPresent')}
      </button>}
    </div>
    {report.window && <p className="rewind-window muted">{t('rewindScope')} · {printDays(report.window.first, report.window.last)}</p>}
    {report.partial && <p className="rewind-window muted">{t('rewindPartialHint')}</p>}
    {screenError && <p className="notice error" role="alert">{t('rewindScreenError')}</p>}
    <div className="rewind-stage" tabIndex={0} ref={panel} role="region" aria-label={t(chapterTitles[kind])} onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); go(index + (event.key === 'ArrowRight' ? 1 : -1))
      } else if (event.key === ' ' && total > 1) {
        event.preventDefault(); toggle()
      }
    }}>
      <div className="rewind-chapter" key={kind}>
        <h2>{t(chapterTitles[kind])}</h2>
        <Chapter kind={kind} report={report} onDay={onDay} />
      </div>
    </div>
    <div className="rewind-progress">
      <progress max={total} value={index + 1} aria-label={progress} />
      <span role="status">{progress}</span>
    </div>
    <div className="rewind-controls">
      <div className="button-row">
        <button className="icon-button" aria-label={t('previousChapter')} disabled={index === 0} onClick={() => go(index - 1)}><ArrowLeft size={17} /></button>
        <button className="button secondary" disabled={total <= 1} onClick={toggle}>
          {running ? <Pause size={16} /> : <Play size={16} />}{t(running ? 'rewindPause' : 'rewindPlay')}
        </button>
        <button className="icon-button" aria-label={t('nextChapter')} disabled={index + 1 === total} onClick={() => go(index + 1)}><ArrowRight size={17} /></button>
      </div>
      <label className="compact-field">{t('rewindJump')}
        <select aria-label={t('rewindJump')} value={index} onChange={(event) => go(Number(event.target.value))}>
          {report.chapters.map((chapter, position) => <option key={chapter} value={position}>{t(chapterTitles[chapter])}</option>)}
        </select>
      </label>
      <button className="button primary" onClick={() => { setPlaying(false); setSharing(true) }}>
        <Share2 size={17} aria-hidden="true" />{t('openShare')}
      </button>
    </div>
    {sharing && <ShareCard report={report} view={view} demo={demo} onClose={() => setSharing(false)} />}
  </section>
}

export default function Rewind({ day, view, report, demo, onView, onPeriod, onDay }: {
  day: string; view: CalendarView; report?: RewindReport; demo: boolean
  onView: (view: CalendarView) => void; onPeriod: (day: string) => void; onDay: (day: string) => void
}) {
  const step = (offset: number) => {
    const next = movePeriod(day, view, offset)
    if (validDay(next)) onPeriod(next)
  }
  return <>
    <header className="page-heading"><h1>{t('rewind')}</h1><p>{t('rewindIntro')}</p></header>
    <div className="rewind-picker panel view-toolbar">
      <label className="compact-field">{t('rewindView')}
        <select aria-label={t('rewindView')} value={view} onChange={(event) => onView(event.target.value === 'month' ? 'month' : 'year')}>
          <option value="month">{t('rewindMonth')}</option><option value="year">{t('rewindYear')}</option>
        </select>
      </label>
      <button className="icon-button" aria-label={t('previousPeriod')} onClick={() => step(-1)}><ArrowLeft size={17} /></button>
      <label className="compact-field">{t('rewindPeriod')}
        <input aria-label={t('rewindPeriod')} type={view === 'month' ? 'month' : 'number'} key={view + day}
          defaultValue={day.slice(0, view === 'month' ? 7 : 4)}
          onChange={(event) => {
            const selected = event.target.value + (view === 'month' ? '-01' : '-01-01')
            if (validDay(selected)) onPeriod(selected)
          }} />
      </label>
      <button className="icon-button" aria-label={t('nextPeriod')} onClick={() => step(1)}><ArrowRight size={17} /></button>
    </div>
    {!report ? <p className="notice" role="status">{t('loadingView')}</p> : report.chapters.length
      ? <Story key={view + day + JSON.stringify(report.window)} report={report} view={view} demo={demo} onDay={onDay} />
      : <p className="notice" role="status">{t('rewindEmpty')}</p>}
  </>
}
