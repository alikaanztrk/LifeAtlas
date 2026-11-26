import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const portal = 'https://tiles.openfreemap.org'
const planet = portal + '/planet'
const template = portal + '/planet/20261122_124456_pt/{z}/{x}/{y}.pbf'
const demo = async (page: Page) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Open the demo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Archive overview' })).toBeVisible()
}
const explore = (page: Page) => page.getByRole('link', { name: 'Explore map', exact: true }).click()

test('renders a single observed point and selects it directly on the map canvas', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-single-position.json', mimeType: 'application/json',
    buffer: Buffer.from('{"locations":[{"latitudeE7":-440100000,"longitudeE7":-1412000000,"timestampMs":"1738400000000"}]}') })
  await page.getByRole('button', { name: 'Open archive' }).click()
  await explore(page)
  await expect(page.getByRole('button', { name: 'Fit to records' })).toBeVisible()
  const canvas = page.locator('.map-canvas canvas')
  const dimensions = await canvas.evaluate((element) => ({ x: element.clientWidth / 2, y: element.clientHeight / 2 }))
  await expect(async () => {
    await canvas.click({ position: dimensions })
    await expect(page.locator('.map-selection')).toContainText('Raw position', { timeout: 350 })
  }).toPass({ timeout: 4500 })
})

test('keeps one date range across overview, calendar, day, and rendered local map', async ({ page, context }) => {
  let external = 0
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.name))
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console error') })
  await context.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:4180') { external++; await route.abort() }
    else await route.continue()
  })
  await demo(page)
  await expect(page.getByRole('heading', { name: 'Movement over time' })).toBeVisible()
  const range = page.getByRole('combobox', { name: 'Date range' })
  await range.selectOption('custom')
  await page.getByLabel('Start date').fill('2025-05-03')
  await page.getByLabel('End date').fill('2025-05-03')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.locator('.active-scope')).toContainText('May 3, 2025')
  const distance = page.getByRole('heading', { name: 'Known distance' }).locator('../..').locator('.metric-value')
  await expect(distance).toHaveText('1.71 km')
  await page.getByRole('link', { name: 'Calendar', exact: true }).click()
  const may3 = page.getByRole('button', { name: /May 3, 2025.*Evidence present/ })
  const may4 = page.getByRole('button', { name: /May 4, 2025.*Outside selected range/ })
  await expect(may3).toBeVisible()
  await may3.focus()
  await page.keyboard.press('ArrowRight')
  await expect(may4).toBeFocused()
  await page.getByRole('combobox', { name: 'Calendar metric' }).selectOption('meters')
  await expect(page.getByRole('button', { name: /May 3, 2025.*1.71 km/ })).toBeVisible()
  await page.getByRole('button', { name: 'Year view', exact: true }).click()
  await expect(page.locator('.calendar-cell')).toHaveCount(365)
  await page.getByRole('button', { name: 'Open in Timeline', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Timeline', exact: true })).toBeVisible()
  await expect(page.locator('.day-totals')).toContainText('1.71 km')
  await expect(page.getByText('Unobserved interval', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Paper Bay/ }).click()
  await page.getByRole('button', { name: 'Open map', exact: true }).click()
  await expect(page.getByText('Day on map', { exact: false })).toBeVisible()
  await expect(page.locator('.map-canvas canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fit to records' })).toBeVisible()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.locator('.map-canvas canvas')).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('checkbox', { name: 'Point density' }).check()
  await page.getByRole('combobox', { name: 'Transport on map' }).selectOption('walking')
  await page.getByText('Mapped records', { exact: true }).click()
  await page.getByRole('button', { name: 'Paper Bay', exact: false }).click()
  await page.getByRole('button', { name: 'Open in Timeline', exact: true }).click()
  await expect(page.locator('.active-scope')).toContainText('May 3, 2025')
  await expect(page.getByRole('button', { name: /Paper Bay/ })).toHaveAttribute('aria-pressed', 'true')
  expect(new URL(page.url()).hash).toBe('#/timeline')
  expect(new URL(page.url()).search).toBe('')
  expect(external).toBe(0)
  expect(errors).toEqual([])
})

test('online tiles require explicit opt-in, use allowlisted tile addresses and stop on revocation', async ({ page, context }) => {
  const requests: string[] = []
  const invalid: string[] = []
  let receivedPlanet = 0
  let tileFailures = 0
  let releaseTiles = () => {}
  const tileGate = new Promise<void>((release) => { releaseTiles = release })
  page.on('requestfailed', (request) => { if (request.url().endsWith('.pbf')) tileFailures++ })
  await context.route(portal + '/**', async (route) => {
    const request = route.request()
    requests.push(request.url())
    if (request.method() !== 'GET' || request.headers()['referer'] || request.postData()) invalid.push('request metadata')
    if (request.url() === planet) {
      receivedPlanet++
      await route.fulfill({ json: { tiles: [template] }, headers: { 'access-control-allow-origin': '*' } })
      return
    }
    if (!/^https:\/\/tiles\.openfreemap\.org\/planet\/20261122_124456_pt\/\d+\/\d+\/\d+\.pbf$/.test(request.url())) {
      invalid.push('endpoint')
      await route.abort()
      return
    }
    // Leave one tile in flight until the permission is revoked.
    await tileGate
    await route.fulfill({ body: Buffer.alloc(0), headers: { 'access-control-allow-origin': '*' } }).catch(() => {})
  })
  await demo(page)
  await explore(page)
  await expect(page.getByRole('button', { name: 'Fit to records' })).toBeVisible()
  expect(requests).toEqual([])
  await page.getByRole('button', { name: 'Enable online basemap' }).click()
  await expect(page.getByRole('dialog')).toContainText('your IP address')
  expect(requests).toEqual([])
  await page.getByRole('dialog').getByRole('button', { name: 'Enable online basemap' }).click()
  let after: number
  try {
    await expect.poll(() => requests.some((url) => url.endsWith('.pbf'))).toBe(true)
    await expect(page.getByRole('link', { name: '© OpenStreetMap' })).toBeVisible()
    await page.getByRole('button', { name: 'Turn off online basemap' }).click()
    after = requests.length
    await expect.poll(() => tileFailures).toBeGreaterThan(0)
  } finally { releaseTiles() }
  await expect(page.getByText('Local map · no basemap tiles')).toBeVisible()
  await expect(page.getByRole('link', { name: '© OpenStreetMap' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Fit to records' }).click()
  expect(receivedPlanet).toBe(1)
  expect(invalid).toEqual([])
  expect(requests).toHaveLength(after)
})

test('reports online network errors and keeps the local map available', async ({ page, context }) => {
  await context.route(planet, (route) => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } }))
  await demo(page)
  await explore(page)
  await page.getByRole('button', { name: 'Enable online basemap' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enable online basemap' }).click()
  await expect(page.getByText('Online tiles are unavailable. Showing the local map.')).toBeVisible()
  await expect(page.locator('.map-canvas canvas')).toBeVisible()
})

test('keeps keyboard-accessible selection when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...options: unknown[]) {
      if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null
      return Reflect.apply(original, this, [kind, ...options])
    } as typeof original
  })
  await demo(page)
  await explore(page)
  await expect(page.getByText('The interactive map requires WebGL.', { exact: false })).toBeVisible()
  await page.getByText('Mapped records', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: /Paper Bay/ }).first().focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Open in Timeline' })).toBeVisible()
  for (const width of [1440, 1280, 390]) {
    await page.setViewportSize({ width, height: 850 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('opens filtered persistent records in the query worker after reload', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles('src/fixtures/synthetic-android.json')
  await page.getByRole('radio', { name: /In this browser/ }).check()
  await page.getByRole('button', { name: 'Open archive' }).click()
  await expect(page.getByRole('heading', { name: 'Archive overview' })).toBeVisible()
  await page.getByRole('link', { name: 'Data & privacy', exact: true }).click()
  await page.getByRole('combobox', { name: 'Display time zone' }).selectOption('Pacific/Honolulu')
  await page.getByRole('combobox', { name: 'Distance units' }).selectOption('imperial')
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(page.locator('.period')).toContainText('Pacific/Honolulu')
  await expect(page.locator('.metric-value').first()).toHaveText('1.52 mi')
  await page.reload()
  await page.getByRole('link', { name: 'Timeline', exact: true }).click()
  await expect(page.getByRole('button', { name: /Paper Harbor/ })).toBeVisible()
  await expect(page.locator('.day-totals')).toContainText('1.52 mi')
  await expect(page.locator('.day-switch')).toContainText('Pacific/Honolulu')
})
