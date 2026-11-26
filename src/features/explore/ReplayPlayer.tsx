import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { Coordinate } from '../../domain/model'
import type { Replay } from '../../domain/replay'
import { replayFrame, replayStep } from '../../domain/replay'
import { locale, number, t } from '../../locales/i18n'

const speeds = [1, 60, 300, 900]
const states = { observation: 'replayPoint', held: 'replayHeld', gap: 'replayGap', conflict: 'replayConflict' }

export function ReplayPlayer({ replay, zone, children }: {
  replay: Extract<Replay, { kind: 'ready' }>; zone: string; children: (marker?: Coordinate) => ReactNode
}) {
  const { samples } = replay
  const first = samples[0]!.at
  const last = samples.at(-1)!.at
  const [at, setAt] = useState(first)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(60)
  const position = useRef(first)
  const language = locale()
  const time = useMemo(() => new Intl.DateTimeFormat(language, {
    dateStyle: 'medium', timeStyle: 'medium', timeZone: zone,
  }), [language, zone])

  useEffect(() => {
    if (!playing) return
    const started = performance.now()
    const initial = position.current
    let emitted = -Infinity
    let request = 0
    const tick = (now: number) => {
      const next = Math.min(last, initial + Math.floor((now - started) * speed))
      if (now - emitted >= 80 || next >= last) {
        position.current = next
        setAt(next)
        emitted = now
      }
      if (next < last) request = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    const visibility = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', visibility)
    request = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(request)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [playing, speed, last])

  const seek = (next: number) => {
    setPlaying(false)
    position.current = next
    setAt(next)
  }
  const previous = replayStep(samples, at, -1)
  const following = replayStep(samples, at, 1)
  const frame = replayFrame(samples, at)
  return <>
    <section className="replay-bar" aria-label={t('replayTitle')}>
      <p className="muted">{t('replayIntro')}</p>
      <div className="replay-controls">
        <button className="icon-button" type="button" aria-label={t('replayPrevious')} disabled={previous === undefined}
          onClick={() => { if (previous !== undefined) seek(previous) }}><SkipBack size={16} /></button>
        <button className="button primary" type="button" disabled={first === last} onClick={() => {
          if (!playing && position.current >= last) {
            position.current = first
            setAt(first)
          }
          setPlaying(!playing)
        }}>{playing ? <Pause size={16} /> : <Play size={16} />}{t(playing ? 'replayPause' : 'replayPlay')}</button>
        <button className="icon-button" type="button" aria-label={t('replayNext')} disabled={following === undefined}
          onClick={() => { if (following !== undefined) seek(following) }}><SkipForward size={16} /></button>
        <label className="compact-field">{t('replaySpeed')}
          <select aria-label={t('replaySpeed')} value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            {speeds.map((choice) => <option value={choice} key={choice}>{number(choice)}×</option>)}
          </select>
        </label>
      </div>
      <input className="replay-seek" aria-label={t('replaySeek')} aria-valuetext={time.format(at)} type="range"
        min={0} max={last - first || 1} step={1} value={at - first} disabled={first === last}
        onChange={(event) => seek(first + Number(event.target.value))} />
      <div className="replay-readout">
        <output aria-label={t('replayClock')} aria-live="off">{time.format(at)} · {zone}</output>
        <div className={'replay-frame ' + frame.kind} role="status">
          {t(states[frame.kind])}
          {frame.sample && <span className="muted"> · {t(frame.sample.source === 'raw' ? 'replayRaw' : 'replayPath')}</span>}
        </div>
      </div>
      <small className="muted">{t('replayCount', {
        count: number(samples.length), gaps: number(replay.gaps), conflicts: number(replay.conflicts),
      })}</small>
    </section>
    {children('coord' in frame ? frame.coord : undefined)}
  </>
}
