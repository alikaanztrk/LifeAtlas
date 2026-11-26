import { createServer } from 'node:http'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

const base = '/LifeAtlas/'
const assets = async () => [
  'index.html', 'atlas-mark.svg', 'atlas-192.png', 'atlas-512.png', 'lifeatlas.webmanifest',
  'lifeatlas-license.txt', 'worker-licenses.txt', 'third-party-licenses.md',
  ...(await readdir('dist/assets')).map((path) => 'assets/' + path),
].sort()
const settings = (page: Page) => page.getByRole('link', { name: 'Data & privacy', exact: true }).click()
const ready = (page: Page) => page.getByText('Ready to open offline', { exact: true })
const cacheNames = (page: Page) => page.evaluate(() => caches.keys())
const cachedPaths = (page: Page) => page.evaluate(async () => {
  const names = (await caches.keys()).filter((name) => name.startsWith('lifeatlas-static:'))
  const entries = await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map(({ url }) => url)))
  return entries.flat().sort()
})

test('opens the installable app and unused lazy views offline, keeping archives out of Cache Storage', async ({ page, context }) => {
  test.setTimeout(60_000)
  await page.goto('./#/data')
  await expect(ready(page)).toBeVisible()
  const origin = new URL(page.url()).origin
  const allowed = (await assets()).map((path) => origin + base + path)
  expect(await cachedPaths(page)).toEqual(allowed)
  const manifest = await page.evaluate(async () => (await fetch('lifeatlas.webmanifest')).json())
  expect(manifest).toMatchObject({ name: 'LifeAtlas', start_url: './', scope: './', display: 'standalone' })
  const chrome = await context.newCDPSession(page)
  const { installabilityErrors } = await chrome.send('Page.getInstallabilityErrors')
  expect(installabilityErrors.filter(({ errorId }) => errorId !== 'in-incognito')).toEqual([])

  // A non-allowlisted same-origin request passes through without being saved.
  await page.evaluate(() => fetch('atlas-mark.svg?variant=synthetic', { cache: 'no-store' }))
  expect(await cachedPaths(page)).toEqual(allowed)
  await context.setOffline(true)
  const restarted = await context.newPage()
  await page.close()
  await restarted.goto(origin + base + 'index.html#/import')
  await expect(restarted.getByRole('heading', { name: 'Your life, mapped.' })).toBeVisible()
  await restarted.getByRole('button', { name: 'Open the demo' }).click()
  await expect(restarted.getByRole('heading', { name: 'Archive overview' })).toBeVisible()
  await expect(restarted.getByRole('heading', { name: 'Movement over time' })).toBeVisible()
  await restarted.getByRole('link', { name: 'Explore map', exact: true }).click()
  await expect(restarted.locator('canvas.maplibregl-canvas')).toBeVisible()
  await restarted.getByRole('link', { name: 'Rewind', exact: true }).click()
  await expect(restarted.getByRole('heading', { name: 'Days with evidence' })).toBeVisible()

  await restarted.getByRole('link', { name: 'Import', exact: true }).click()
  await restarted.locator('input[type=file]').setInputFiles('src/fixtures/synthetic-ios.json')
  await expect(restarted.getByRole('heading', { name: 'Review your import' })).toBeVisible()
  await restarted.getByRole('radio', { name: /In this browser/ }).check()
  await restarted.getByRole('button', { name: 'Open archive' }).click()
  await expect(restarted.getByRole('heading', { name: 'Archive overview' })).toBeVisible()
  await restarted.reload()
  await expect(restarted.getByRole('heading', { name: 'Archive overview' })).toBeVisible()
  await settings(restarted)
  await expect(ready(restarted)).toBeVisible()
  await restarted.getByRole('button', { name: 'Clear all local data' }).click()
  await restarted.getByRole('dialog').getByRole('button', { name: 'Clear all local data' }).click()
  await expect.poll(() => restarted.evaluate(async () => (await indexedDB.databases()).map(({ name }) => name))).toEqual([])
  expect(await cachedPaths(restarted)).toEqual(allowed)
  await expect(restarted.evaluate(() => fetch('atlas-mark.svg?variant=synthetic', { cache: 'no-store' })
    .then(() => false, () => true))).resolves.toBe(true)
})

test('rejects a partial update and waits for all existing tabs before activating a complete version', async ({ browser }) => {
  test.setTimeout(60_000)
  const type: Record<string, string> = {
    html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml',
    png: 'image/png', webmanifest: 'application/manifest+json', md: 'text/plain', txt: 'text/plain',
  }
  const worker = await readFile('dist/service-worker.js', 'utf8')
  const files = new Map(await Promise.all((await assets()).map(async (name) => [name, await readFile(resolve('dist', name))] as const)))
  let version = ''
  let corrupt = false
  let corruptRequests = 0
  const server = createServer((request, response) => {
    const path = request.url?.startsWith(base) ? request.url.slice(base.length) || 'index.html' : ''
    if (path === 'service-worker.js') {
      response.writeHead(200, { 'Content-Type': type.js, 'Cache-Control': 'no-store' })
      response.end(version ? worker.replace(/"version":"[0-9a-f]{64}"/, '"version":"' + version + '"') : worker)
    } else if (corrupt && path === 'worker-licenses.txt') {
      corruptRequests++
      response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
      response.end('Incomplete rollout test fixture')
    } else if (files.has(path)) {
      const extension = path.split('.').at(-1) ?? ''
      response.writeHead(200, { 'Content-Type': type[extension] ?? 'application/octet-stream' })
      response.end(files.get(path))
    } else {
      response.writeHead(404).end()
    }
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Testing server has no TCP address')
  const root = 'http://127.0.0.1:' + address.port + base
  const context = await browser.newContext({ serviceWorkers: 'allow', locale: 'en-US' })
  try {
    const page = await context.newPage()
    corrupt = true
    await page.goto(root + '#/data')
    const retry = page.getByRole('button', { name: 'Retry offline setup' })
    await expect(retry).toBeVisible()
    expect(await cacheNames(page)).toEqual([])
    corrupt = false
    corruptRequests = 0
    await retry.click()
    await expect(ready(page)).toBeVisible()
    const other = await context.newPage()
    await other.goto(root + '#/data')
    await expect(ready(other)).toBeVisible()
    const initial = await cacheNames(page)
    expect(initial).toHaveLength(1)
    const siblingCache = 'lifeatlas-static:' + new URL('/another-project/', root).href + ':synthetic'
    await page.evaluate((name) => caches.open(name).then(() => undefined), siblingCache)

    corrupt = true
    version = '1'.repeat(64)
    const update = () => page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      await registration.update()
      const state = registration.installing
      if (state && state.state !== 'redundant' && state.state !== 'installed') {
        await new Promise<void>((done) => {
          state.addEventListener('statechange', () => {
            if (state.state === 'redundant' || state.state === 'installed') done()
          })
        })
      }
    })
    await update()
    expect(corruptRequests).toBe(1)
    await expect.poll(() => cacheNames(page)).toEqual([...initial, siblingCache])
    await expect(ready(page)).toBeVisible()

    corrupt = false
    version = '2'.repeat(64)
    await update()
    await expect(page.getByText(/An update is ready/)).toBeVisible()
    const waiting = await cacheNames(other)
    expect(waiting).toHaveLength(3)
    await page.close()
    expect(await other.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting))).toBe(true)
    expect(await cacheNames(other)).toEqual(waiting)
    await other.close()

    const reopened = await context.newPage()
    await reopened.goto(root + '#/data')
    await expect(ready(reopened)).toBeVisible()
    expect(await cacheNames(reopened)).toEqual([siblingCache, waiting.find((name) => name.endsWith(version))])
  } finally {
    await context.close()
    await new Promise<void>((done) => server.close(() => done()))
  }
})
