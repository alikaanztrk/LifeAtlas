import { useEffect, useState } from 'react'

export type OfflineStatus = 'unavailable' | 'preparing' | 'ready' | 'update' | 'failed'

const supported = import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator

export function useOffline() {
  const [status, setStatus] = useState<OfflineStatus>(supported ? 'preparing' : 'unavailable')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!supported) return
    const workers = navigator.serviceWorker
    let registration: ServiceWorkerRegistration | undefined
    let installing: ServiceWorker | undefined
    let cancelled = false
    let idle: number | undefined

    const updateStatus = () => {
      if (cancelled || !registration) return
      if (registration.waiting && registration.active) setStatus('update')
      else if (registration.active?.state === 'activated' && workers.controller === registration.active) setStatus('ready')
      else if (registration.installing || registration.active) setStatus('preparing')
      else setStatus('failed')
    }
    const watchInstall = () => {
      installing?.removeEventListener('statechange', updateStatus)
      installing = registration?.installing ?? undefined
      installing?.addEventListener('statechange', updateStatus)
      updateStatus()
    }
    const run = () => {
      const base = import.meta.env.BASE_URL
      void workers.register(base + 'service-worker.js', { scope: base, updateViaCache: 'none' })
        .then((found) => {
          if (cancelled) return
          registration = found
          registration.addEventListener('updatefound', watchInstall)
          workers.addEventListener('controllerchange', updateStatus)
          watchInstall()
        }).catch(() => { if (!cancelled) setStatus('failed') })
    }
    const schedule = () => { idle = window.requestIdleCallback(run, { timeout: 2_000 }) }
    if (!attempt && document.readyState !== 'complete') window.addEventListener('load', schedule, { once: true })
    else if (!attempt) schedule()
    else run()

    return () => {
      cancelled = true
      if (idle !== undefined) window.cancelIdleCallback(idle)
      window.removeEventListener('load', schedule)
      workers.removeEventListener('controllerchange', updateStatus)
      registration?.removeEventListener('updatefound', watchInstall)
      installing?.removeEventListener('statechange', updateStatus)
    }
  }, [attempt])

  const retry = () => {
    setStatus('preparing')
    setAttempt((count) => count + 1)
  }
  return { status, retry }
}
