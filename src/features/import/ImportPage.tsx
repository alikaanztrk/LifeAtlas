import { Archive, ArrowLeft, HardDrive, Shield } from 'lucide-react'
import { useState } from 'react'
import { DiagnosticDetails, FileReports, Issues } from '../../components/Reports'
import type { Confirmation } from '../../components/ConfirmDialog'
import type { Dataset } from '../../domain/model'
import { date, number, t } from '../../locales/i18n'
import type { ImportState, Preview, Retention } from './useImport'
import { Welcome } from './Welcome'

type StorageStatus = 'loading' | 'ready' | 'failed'

interface ImportPageProps {
  state: ImportState
  storage: StorageStatus
  persistent: Dataset | null
  session: Dataset | null
  onFiles: (files: File[]) => void
  onDemo: () => void
  onCancel: () => void
  onDiscard: () => void
  onCommit: (retention: Retention, mode: 'merge' | 'replace') => void
  onConfirm: (confirmation: Confirmation) => void
}

const phaseKeys = {
  read: 'phaseRead', normalize: 'phaseNormalize', analyze: 'phaseAnalyze', save: 'phaseSave',
}

function Progress({ state, onCancel }: {
  state: Extract<ImportState, { step: 'working' | 'saving' }>; onCancel: () => void
}) {
  const { progress } = state
  const cancelling = state.step === 'saving' && state.cancelling
  return (
    <section className="panel centered-state" aria-label={t('importTitle')}>
      <div className="icon-tile"><Archive size={24} aria-hidden="true" /></div>
      <h1 role="status">{t(cancelling ? 'cancelling' : phaseKeys[progress.phase])}</h1>
      {progress.file !== undefined && <p className="muted">{t('fileProgress', { file: progress.file })}</p>}
      <progress aria-label={t(phaseKeys[progress.phase])}
        max={progress.total || 1} value={progress.total ? progress.completed : undefined} />
      <button className="button secondary" onClick={onCancel} disabled={cancelling}>{t('cancel')}</button>
    </section>
  )
}

function Review({ value, ...props }: ImportPageProps & { value: Preview }) {
  const [retention, setRetention] = useState<Retention>('session')
  const { summary, report } = value
  const existing = retention === 'session' ? props.session : props.persistent
  const storageDisabled = retention === 'persistent' && props.storage !== 'ready'
  const commit = (mode: 'merge' | 'replace') => props.onCommit(retention, mode)
  return (
    <>
      <button className="button link-button back-button" onClick={props.onDiscard}>
        <ArrowLeft size={16} aria-hidden="true" />{t('retry')}
      </button>
      <header className="page-heading">
        <h1>{t('reviewTitle')}</h1><p>{t('reviewHint')}</p>
      </header>
      {!summary && <p className="notice warning" role="alert">{t('noUsable')}</p>}
      <div className="review-grid">
        <section className="panel">
          {summary && <dl className="fact-list preview-facts">
            <div><dt>{t('normalized')}</dt><dd>{number(Object.values(summary.kinds).reduce((a, b) => a + b, 0))}</dd></div>
            <div><dt>{t('duplicates')}</dt><dd>{number(report.duplicates)}</dd></div>
            <div><dt>{t('period')}</dt><dd>{summary.first === null || summary.last === null ? t('noDate')
              : date(summary.first, summary.zone) + ' – ' + date(summary.last, summary.zone)}</dd></div>
            <div><dt>{t('zone')}</dt><dd>{summary.zone}</dd></div>
          </dl>}
          <FileReports report={report} />
          <DiagnosticDetails report={report} />
          {summary && <>
            <h2 className="section-subtitle">{t('archiveQuality')}</h2>
            <Issues counts={summary.quality} />
          </>}
        </section>
        {summary && <section className="panel storage-panel">
          <fieldset>
            <legend>{t('storeTitle')}</legend>
            <label className="radio-card">
              <input name="retention" type="radio" value="session" checked={retention === 'session'}
                onChange={() => setRetention('session')} />
              <Shield size={19} aria-hidden="true" />
              <span><strong>{t('storeSession')}</strong><small>{t('storeSessionHint')}</small></span>
            </label>
            <label className="radio-card">
              <input name="retention" type="radio" value="persistent" checked={retention === 'persistent'}
                onChange={() => setRetention('persistent')} disabled={props.storage !== 'ready'} />
              <HardDrive size={19} aria-hidden="true" />
              <span><strong>{t('storePersist')}</strong><small>{t('storePersistHint')}</small></span>
            </label>
          </fieldset>
          {props.storage !== 'ready' && <p className="muted" role="status">
            {t(props.storage === 'loading' ? 'storageLoading' : 'storageUnavailable')}
          </p>}
          {existing && <div className="notice warning">
            <strong>{t('existingTitle')}</strong><p>{t('existingHint')}</p>
          </div>}
          <div className="button-row">
            {existing ? <>
              <button className="button primary" onClick={() => commit('merge')} disabled={storageDisabled}>{t('merge')}</button>
              <button className="button secondary" disabled={storageDisabled} onClick={() => props.onConfirm({
                title: 'replaceTitle', description: 'replaceHint', label: 'replace', action: () => commit('replace'),
              })}>{t('replace')}</button>
            </> : <button className="button primary" disabled={storageDisabled} onClick={() => commit('replace')}>
              {t('create')}
            </button>}
          </div>
        </section>}
      </div>
    </>
  )
}

export function ImportPage(props: ImportPageProps) {
  const { state, onCancel, onDemo, onFiles } = props
  if (state.step === 'working' || state.step === 'saving') return <Progress state={state} onCancel={onCancel} />
  if (state.step === 'review') return <Review {...props} value={state.preview} />
  return (
    <>
      {state.step === 'error' && <p className="notice error" role="alert">{t('error.' + state.code)}</p>}
      {state.step === 'idle' && state.note && <p className="notice" role="status">{t(state.note)}</p>}
      <Welcome onFiles={onFiles} onDemo={onDemo} />
    </>
  )
}
