declare const LIFEATLAS_BUILD: { version: string; assets: [path: string, integrity: string][] }

const offlineWorker = self as unknown as ServiceWorkerGlobalScope
const scope = offlineWorker.registration.scope
const shell = new URL('index.html', scope).href
const allowed = new Map(LIFEATLAS_BUILD.assets.map(([path, integrity]) => [new URL(path, scope).href, integrity]))
const cachePrefix = 'lifeatlas-static:' + scope + ':'
const cacheName = cachePrefix + LIFEATLAS_BUILD.version

offlineWorker.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    const results = await Promise.allSettled([...allowed].map(async ([url, integrity]) => {
      const response = await fetch(url, {
        integrity, cache: 'reload', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
      })
      if (response.status !== 200) throw new Error('Offline asset is unavailable')
      await cache.put(url, response)
    }))
    if (results.some(({ status }) => status === 'rejected')) {
      await caches.delete(cacheName)
      throw new Error('Offline preparation failed')
    }
  })())
})

offlineWorker.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name)))
    // Updates activate after the previous worker's clients close.
    await offlineWorker.clients.claim()
  })())
})

offlineWorker.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.headers.has('Range') || request.headers.has('Authorization')) return
  let url = request.url
  if (request.mode === 'navigate') {
    // Chrome can include the hash route on navigation requests.
    const destination = new URL(url)
    destination.hash = ''
    url = destination.href
  }
  // Use one app shell cache key for the two production entry points.
  const key = request.mode === 'navigate' ? (url === scope || url === shell ? shell : undefined) : url
  if (!key || !allowed.has(key)) return
  event.respondWith((async () => {
    let response: Response | undefined
    try { response = await caches.match(key, { cacheName }) } catch { /* Cache Storage can be unavailable. */ }
    return response ?? fetch(request)
  })())
})
