import { Archive, Database, HardDriveDownload, ShieldCheck } from 'lucide-react'
import type { Dataset } from '../../domain/model'
import { date, t, timeZones } from '../../locales/i18n'
import type { Units } from '../../locales/i18n'
import type { Retention } from '../import/useImport'
import type { Confirmation } from '../../components/ConfirmDialog'
import type { OfflineStatus } from '../../pwa/useOffline'

export type Selection = Retention | 'demo' | null
const offlineLabels: Record<OfflineStatus, string> = {
  unavailable: 'offlineUnavailable', preparing: 'offlinePreparing', ready: 'offlineReady',
  update: 'offlineUpdate', failed: 'offlineFailed',
}

export function DataPage({ selection, session, persistent, demo, storage, busy, notice, error, online, onOnline, zone, onZone, units, onUnits,
  offline, onOpen, onDelete, onConfirm, onCloseDemo }: {
  selection: Selection; session: Dataset | null; persistent: Dataset | null; demo: boolean;
  storage: 'loading' | 'ready' | 'failed'; busy: boolean; notice: boolean; error?: string;
  online: boolean; onOnline: () => void; zone: string; onZone: (zone: string) => void;
  offline: { status: OfflineStatus; retry: () => void };
  units: Units; onUnits: (units: Units) => void;
  onOpen: (type: Selection) => void; onDelete: (type: Retention | 'all') => void;
  onConfirm: (confirmation: Confirmation) => void; onCloseDemo: () => void
}) {
  const rows = [
    { type: 'session', title: 'sessionArchive', data: session, hint: 'storeSessionHint', Icon: Archive },
    { type: 'persistent', title: 'savedArchive', data: persistent, hint: 'storePersistHint', Icon: Database },
  ] as const
  return (
    <>
      <header className="page-heading"><h1>{t('dataTitle')}</h1><p>{t('dataIntro')}</p></header>
      {busy && <p className="notice" role="status">{t('deleting')}</p>}
      {notice && <p className="notice" role="status">{t('deleted')}</p>}
      {error && <p className="notice error" role="alert">{t('error.' + error)}</p>}
      <div className="review-grid">
        <section className="panel">
          <h2>{t('storageTitle')}</h2>
          <ul className="archive-list">
            {rows.map(({ type, title, data, hint, Icon }) => (
              <li key={type}>
                <div className="icon-tile quiet"><Icon size={20} aria-hidden="true" /></div>
                <div className="archive-copy">
                  <strong>{t(title)}</strong>
                  <p className="muted">{data ? t('updated', { date: date(data.updatedAt, data.summary.zone) })
                    : type === 'persistent' && storage !== 'ready'
                      ? t(storage === 'loading' ? 'storageLoading' : 'storageUnavailable')
                      : t('storageEmpty')}</p>
                  <p className="muted">{t(hint)}</p>
                </div>
                {data && <div className="button-row">
                  <button className="button secondary" disabled={busy} onClick={() => onOpen(type)}>
                    {t(selection === type ? 'active' : 'open')}
                  </button>
                  <button className="button secondary danger-text" disabled={busy} onClick={() => onConfirm({
                    title: 'eraseTitle', description: 'eraseHint', label: 'erase', action: () => onDelete(type),
                  })}>{t('erase')}</button>
                </div>}
              </li>
            ))}
          </ul>
          <p className="muted">{t('dataNotice')}</p>
          <div className="button-row data-actions">
            {demo && <button className="button secondary" disabled={busy} onClick={onCloseDemo}>{t('resetDemo')}</button>}
            <button className="button secondary danger-text" disabled={busy || storage === 'loading'} onClick={() => onConfirm({
              title: 'clearTitle', description: 'clearHint', label: 'clear', action: () => onDelete('all'),
            })}>{t('clear')}</button>
          </div>
        </section>
        <div className="settings-stack"><section className="panel context-panel privacy-panel">
          <div className="icon-tile"><ShieldCheck size={22} aria-hidden="true" /></div>
          <h2>{t('privacyTitle')}</h2>
          <p>{t('privacyCopy')}</p><p className="muted">{t('scopePrivacy')}</p>
          {import.meta.env.PROD && <p><a href={import.meta.env.BASE_URL + 'geography-notices.txt'} target="_blank" rel="noreferrer">{t('geographicCredits')}</a></p>}
          <button className="button secondary" onClick={onOnline}>{t(online ? 'onlineOff' : 'onlineOn')}</button>
        </section>
        <section className="panel context-panel">
          <h2>{t('displayPolicy')}</h2>
          <label className="compact-field zone-field">{t('timeZoneSetting')}
            <select value={zone} onChange={(event) => onZone(event.target.value)}>
              <option value="">{t('archiveZone')}</option>
              {timeZones.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <label className="compact-field zone-field">{t('unitSetting')}
            <select value={units} onChange={(event) => onUnits(event.target.value === 'imperial' ? 'imperial' : 'metric')}>
              <option value="metric">{t('metricUnits')}</option>
              <option value="imperial">{t('imperialUnits')}</option>
            </select>
          </label>
        </section>
        <section className="panel context-panel" aria-labelledby="offline-title">
          <div className="icon-tile"><HardDriveDownload size={22} aria-hidden="true" /></div>
          <h2 id="offline-title">{t('offlineTitle')}</h2>
          <p role="status">{t(offlineLabels[offline.status])}</p>
          <p className="muted">{t('offlineStorage')}</p>
          {(offline.status === 'ready' || offline.status === 'update') && <p className="muted">{t('offlineInstall')}</p>}
          {offline.status === 'failed' && <button className="button secondary" onClick={offline.retry}>{t('offlineRetry')}</button>}
        </section></div>
      </div>
    </>
  )
}
