import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { Confirmation } from '../components/ConfirmDialog'
import type { Failure } from '../domain/limits'
import { ImportPage } from '../features/import/ImportPage'
import { useImport } from '../features/import/useImport'
import type { Retention, SessionData } from '../features/import/useImport'
import { Overview } from '../features/overview/Overview'
import { DataPage } from '../features/settings/DataPage'
import type { Selection } from '../features/settings/DataPage'
import { demoFile } from '../fixtures/demo'
import { applyPreferences, defaults, initialPreferences, savePreferences, t } from '../locales/i18n'
import type { Preferences } from '../locales/i18n'
import type { ArchiveSnapshot } from '../storage/database'
import { hasLocalArchive, storageFailure } from '../storage/browser'
import { useOffline } from '../pwa/useOffline'
import { emptyJournal } from '../domain/edits'
import type { Journal } from '../domain/edits'
import { ImportFailure } from '../domain/limits'
import { Shell, routeFromHash } from './Shell'
import type { Route } from './Shell'
const ArchiveWorkspace = lazy(() => import('./ArchiveWorkspace'))
type EditableMemory = SessionData & { journal: Journal }

export function App() {
  const offline = useOffline()
  const [route, setRoute] = useState(routeFromHash)
  const [prefs, setPrefs] = useState(initialPreferences)
  const [session, setSession] = useState<EditableMemory | null>(null)
  const [saved, setSaved] = useState<ArchiveSnapshot | null>(null)
  const [storage, setStorage] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [demo, setDemo] = useState<EditableMemory | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteNotice, setDeleteNotice] = useState(false)
  const [deleteError, setDeleteError] = useState<Failure>()
  const [online, setOnline] = useState(false)
  const channel = useRef<BroadcastChannel | null>(null)
  const storageRead = useRef(0)
  const invalidateReads = useCallback(() => ++storageRead.current, [])

  const refresh = useCallback(async (startup = false) => {
    const request = invalidateReads()
    try {
      const loaded = await hasLocalArchive() ? await (await import('../storage/database')).readArchive() : null
      if (request !== storageRead.current) return
      setSaved((current) => {
        if (!current || !loaded || current.dataset.revision !== loaded.dataset.revision) return loaded
        return current.journal.revision === loaded.journal.revision ? current : { ...current, journal: loaded.journal }
      })
      setStorage('ready')
      setSelection((current) => {
        if (startup && !current && loaded) return 'persistent'
        return current === 'persistent' && !loaded ? null : current
      })
    } catch {
      if (request === storageRead.current) setStorage('failed')
    }
  }, [invalidateReads])

  useEffect(() => {
    const readRoute = () => setRoute(routeFromHash())
    const updates = new BroadcastChannel('lifeatlas.archive')
    channel.current = updates
    updates.onmessage = () => { void refresh() }
    void refresh(true)
    window.addEventListener('hashchange', readRoute)
    return () => {
      invalidateReads()
      channel.current = null
      updates.close()
      window.removeEventListener('hashchange', readRoute)
    }
  }, [invalidateReads, refresh])

  function navigate(next: Route) {
    if (routeFromHash() !== next) location.hash = '/' + next
    setRoute(next)
    requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
    window.scrollTo(0, 0)
  }

  function setPreferences(next: Preferences, persist = true) {
    applyPreferences(next)
    setPrefs(next)
    savePreferences(persist ? next : undefined)
  }

  const importer = useImport({
    onDemo(preview, events) {
      if (!preview.summary) return
      setDemo({ events, journal: emptyJournal, dataset: { id: 'demo', revision: 'demo', updatedAt: Date.now(), formats: ['android'],
        summary: preview.summary, report: preview.report, mergedDuplicates: 0 } })
      setSelection('demo')
      navigate('overview')
    },
    onResult(retention, result) {
      if (retention === 'session') setSession((previous) => ({ ...result,
        journal: previous?.dataset.id === result.dataset.id ? previous.journal : emptyJournal }))
      else {
        invalidateReads()
        setSaved((previous) => ({ dataset: result.dataset,
          journal: previous?.dataset.id === result.dataset.id ? previous.journal : emptyJournal }))
        setStorage('ready')
        channel.current?.postMessage(null)
        void refresh()
      }
      setSelection(retention)
      navigate('overview')
    },
    onChanged: () => { void refresh() },
  })
  const persistent = saved?.dataset ?? null

  const startDemo = () => {
    if (deleting) return
    if (demo) {
      setSelection('demo')
      navigate('overview')
    } else {
      navigate('import')
      importer.start([demoFile()], true)
    }
  }

  function deleteLocal(type: Retention | 'all') {
    if (deleting || importer.state.step === 'saving') return
    importer.discard()
    setDeleting(true)
    setDeleteNotice(false)
    setDeleteError(undefined)
    void (async () => {
      try {
        if (type !== 'session') {
          const { eraseDataset } = await import('../storage/database')
          await eraseDataset(persistent?.revision, type === 'all')
          invalidateReads()
          setSaved(null)
          setStorage('ready')
          channel.current?.postMessage(null)
        }
        if (type !== 'persistent') setSession(null)
        if (type === 'all') {
          setDemo(null)
          setOnline(false)
          setPreferences(defaults(), false)
        }
        setSelection((current) => type === 'all' || current === type ? null : current)
        setDeleteNotice(true)
      } catch (error) {
        const failure = storageFailure(error)
        setDeleteError(failure.code)
        if (failure.code === 'changed') void refresh()
      } finally {
        setDeleting(false)
      }
    })()
  }

  function toggleOnline() {
    if (online) setOnline(false)
    else setConfirmation({ title: 'onlineConsent', description: 'onlineDisclosure', label: 'onlineOn',
      tone: 'primary', action: () => setOnline(true) })
  }

  const memory = selection === 'session' ? session : selection === 'demo' ? demo : null
  const active = selection === 'persistent' ? persistent : memory?.dataset
  const busy = deleting || importer.state.step === 'saving'
  const journal = (selection === 'persistent' ? saved?.journal : memory?.journal) ?? emptyJournal

  async function updateJournal(next: Journal) {
    if (!active || busy) throw new ImportFailure('changed')
    if (selection === 'persistent') {
      try {
        const { writeJournal } = await import('../storage/database')
        await writeJournal(active, journal.revision, next)
        invalidateReads()
        setSaved((current) => current?.dataset.revision === active.revision ? { ...current, journal: next } : current)
        channel.current?.postMessage(null)
        void refresh()
      } catch (error) {
        if (storageFailure(error).code === 'changed') void refresh()
        throw error
      }
    } else {
      const apply = (current: EditableMemory | null) => current?.dataset.revision === active.revision
        ? { ...current, journal: next } : current
      if (selection === 'demo') setDemo(apply)
      if (selection === 'session') setSession(apply)
    }
  }

  return (
    <Shell route={route} selection={active ? selection : null} preferences={prefs} online={online}
      onNavigate={navigate} onPreferences={setPreferences}>
      {route === 'import' && <ImportPage state={importer.state} storage={storage}
        persistent={persistent} session={session?.dataset ?? null}
        onFiles={(files) => { if (!deleting) importer.start(files) }}
        onDemo={startDemo} onCancel={importer.cancel} onDiscard={importer.discard} onConfirm={setConfirmation}
        onCommit={(retention, mode) => {
          if (deleting) return
          const existing = retention === 'session' ? session?.dataset ?? null : persistent
          importer.commit(retention, mode, existing, retention === 'session' ? session?.events : undefined)
        }} />}
      {active && <Suspense fallback={route !== 'import' && route !== 'data' ? <p className="notice" role="status">{t('loadingView')}</p> : null}>
        <ArchiveWorkspace key={active.id} dataset={active} journal={journal} onJournal={updateJournal} onConfirm={setConfirmation}
        source={memory ? { kind: 'memory', events: memory.events } : { kind: 'saved', dataset: active }}
        route={route} demo={selection === 'demo'} theme={prefs.theme} zone={prefs.zone || active.summary.zone}
        online={online} onOnline={toggleOnline} onNavigate={navigate} onDemo={startDemo} />
      </Suspense>}
      {!active && route !== 'import' && route !== 'data' && <Overview value={null} isDemo={false} loading={storage === 'loading'}
        onDemo={startDemo} onImport={() => navigate('import')} />}
      {route === 'data' && <DataPage selection={selection} persistent={persistent} session={session?.dataset ?? null}
        demo={Boolean(demo)} storage={storage} busy={busy} notice={deleteNotice} error={deleteError}
        offline={offline}
        online={online} onOnline={toggleOnline} zone={prefs.zone} units={prefs.units}
        onZone={(zone) => setPreferences({ ...prefs, zone })} onUnits={(units) => setPreferences({ ...prefs, units })}
        onOpen={(type) => { setSelection(type); navigate('overview') }} onDelete={deleteLocal} onConfirm={setConfirmation}
        onCloseDemo={() => {
          setDemo(null)
          setSelection((current) => current === 'demo' ? null : current)
        }} />}
      {confirmation && <ConfirmDialog value={confirmation} onDismiss={() => setConfirmation(null)} />}
    </Shell>
  )
}
