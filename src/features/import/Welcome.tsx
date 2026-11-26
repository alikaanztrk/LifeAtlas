import { useRef, useState } from 'react'
import { ArrowDownToLine, ArrowRight, FileJson, Fingerprint, ShieldCheck } from 'lucide-react'
import { t } from '../../locales/i18n'

const contours = Array.from({ length: 15 }, (_, index) => index)

export function Welcome({ onFiles, onDemo }: { onFiles: (files: File[]) => void; onDemo: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const entries = useRef(0)
  const [over, setOver] = useState(false)
  return (
    <>
      <div className="welcome-hero">
        <div className="hero-art" aria-hidden="true">
          {contours.map((contour) => <span key={contour} />)}
          <i className="grid-cross cross-one" /><i className="grid-cross cross-two" />
          <i className="grid-cross cross-three" />
          <Fingerprint className="hero-pin" />
        </div>
        <div className="hero-copy">
          <p className="eyebrow">{t('introLabel')}</p>
          <h1>{t('appTagline')}</h1>
          <p>{t('intro')}</p>
        </div>
      </div>
      <div className="welcome-grid">
        <section className="panel import-panel" aria-labelledby="import-title">
          <h2 id="import-title">{t('importTitle')}</h2>
          <p className="muted">{t('importHint')}</p>
          <div className={'drop-zone' + (over ? ' drag-over' : '')}
            onDragEnter={(event) => {
              if (!event.dataTransfer.types.includes('Files')) return
              event.preventDefault()
              entries.current++
              setOver(true)
            }}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes('Files')) {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'copy'
              }
            }}
            onDragLeave={() => { entries.current = Math.max(0, entries.current - 1); if (!entries.current) setOver(false) }}
            onDrop={(event) => {
              event.preventDefault()
              entries.current = 0
              setOver(false)
              onFiles(Array.from(event.dataTransfer.files))
            }}>
            <div className="icon-tile"><ArrowDownToLine size={22} aria-hidden="true" /></div>
            <strong>{t('dropTitle')}</strong>
            <small>{t('dropHint')}</small>
            <input ref={input} type="file" accept=".json,application/json" multiple hidden
              onChange={(event) => {
                onFiles(Array.from(event.target.files ?? []))
                event.target.value = ''
              }} />
            <button type="button" className="button primary" onClick={() => input.current?.click()}>{t('choose')}</button>
          </div>
          <div className="demo-callout">
            <p className="muted">{t('demoHint')}</p>
            <button className="button link-button" onClick={onDemo}>
              {t('loadDemo')}<ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
        <aside className="welcome-aside">
          <section className="panel context-panel privacy-panel">
            <div className="icon-tile"><ShieldCheck size={21} aria-hidden="true" /></div>
            <h2>{t('deviceTitle')}</h2>
            <p>{t('deviceIntro')}</p>
            <p className="muted">{t('networkDetail')}</p>
          </section>
          <section className="panel context-panel">
            <div className="icon-tile quiet"><FileJson size={21} aria-hidden="true" /></div>
            <h2>{t('formatsTitle')}</h2>
            <p>{t('formatsHint')}</p>
            <p className="muted">{t('formatsCaveat')}</p>
          </section>
        </aside>
      </div>
    </>
  )
}
