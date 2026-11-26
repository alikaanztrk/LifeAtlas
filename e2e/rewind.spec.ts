import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const demo = async (page: Page) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Open the demo' }).click()
  await expect(page.getByRole('heading', { name: 'Archive overview' })).toBeVisible()
}
const nav = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).click()
const story = (page: Page) => page.locator('.rewind-stage')

test('annual and monthly rewinds follow the shared range and offer keyboard chapters with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await demo(page)
  await nav(page, 'Rewind')
  await expect(story(page)).toContainText('8 / 365')
  await expect(page.getByText('Partial period', { exact: true })).toBeVisible()
  await story(page).focus()
  await page.keyboard.press('ArrowRight')
  await expect(story(page).getByRole('heading', { name: 'Distance on record' })).toBeVisible()
  await expect(story(page)).toContainText('18.09 km')
  expect(await story(page).locator('.rewind-chapter').evaluate((node) => getComputedStyle(node).animationName)).toBe('none')
  await page.clock.install()
  await page.getByRole('button', { name: 'Play story' }).click()
  await page.clock.fastForward(8100)
  await expect(story(page).getByRole('heading', { name: 'Time in motion' })).toBeVisible()
  await page.getByRole('button', { name: 'Pause story' }).click()
  await page.clock.fastForward(8100)
  await expect(story(page).getByRole('heading', { name: 'Time in motion' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Recap length' }).selectOption('month')
  await expect(story(page)).toContainText('8 / 31')
  await page.getByRole('combobox', { name: 'Date range' }).selectOption('custom')
  await page.getByLabel('Start date', { exact: true }).fill('2025-05-03')
  await page.getByLabel('End date', { exact: true }).fill('2025-05-04')
  await page.getByRole('form', { name: 'Date range' }).getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(story(page)).toContainText('2 / 2')
  await page.getByRole('combobox', { name: 'Go to chapter' }).selectOption({ label: 'Day with the most known movement' })
  await story(page).getByRole('button', { name: 'Open in Timeline' }).click()
  await expect(page.locator('.active-scope')).toContainText('May 3, 2025')
  await expect(page.getByRole('heading', { name: 'Timeline', exact: true })).toBeVisible()
})

test('renders only approved aggregate text in a local PNG and applies redaction before download', async ({ page, context }) => {
  let outside = 0
  let downloads = 0
  const errors: string[] = []
  page.on('download', () => downloads++)
  page.on('pageerror', ({ name }) => errors.push(name))
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console') })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== 'http://127.0.0.1:4180' || request.method() !== 'GET' || url.search) {
      outside++; await route.abort()
    } else await route.continue()
  })
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.fillText
    Object.defineProperty(window, 'syntheticCardPaint', { value: [] as string[], configurable: true })
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, width) {
      if (this.canvas.classList.contains('share-preview')) (Reflect.get(window, 'syntheticCardPaint') as string[]).push(text)
      if (width === undefined) original.call(this, text, x, y)
      else original.call(this, text, x, y, width)
    }
  })
  const paint = () => page.evaluate(() => Reflect.get(window, 'syntheticCardPaint') as string[])
  const reset = () => page.evaluate(() => { (Reflect.get(window, 'syntheticCardPaint') as string[]).length = 0 })
  await demo(page)
  await nav(page, 'Rewind')
  await page.getByRole('combobox', { name: 'Go to chapter' }).selectOption({ label: 'Most visited places' })
  await expect(story(page)).toContainText('Paper Bay')
  await page.getByRole('button', { name: 'Preview share card' }).click()
  const card = page.getByRole('dialog', { name: 'Share card' })
  await expect(card.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  const canvas = card.getByRole('img', { name: 'Preview of the generated PNG' })
  await expect(canvas).toHaveAttribute('width', '1080')
  await expect(canvas).toHaveAttribute('height', '1920')
  const defaultText = await paint()
  expect(defaultText).toEqual(expect.arrayContaining(['2025', '8 / 365', '18.09 km', '4 hr']))
  expect(defaultText.join(' ')).not.toMatch(/Paper Bay|Compass Field|2025-05|May 3|latitude|longitude|-137|09:15/)
  expect(downloads).toBe(0)
  await card.getByRole('checkbox', { name: 'Month or year' }).uncheck()
  await card.getByRole('checkbox', { name: 'Known distance' }).uncheck()
  await reset()
  await card.getByRole('combobox', { name: 'Image layout' }).selectOption('square')
  await expect(canvas).toHaveAttribute('height', '1080')
  const redacted = await paint()
  expect(redacted).toContain('8 / 365')
  expect(redacted.join(' ')).not.toMatch(/2025|18\.09|11\.24|Paper Bay/)
  const ready = page.waitForEvent('download')
  await card.getByRole('button', { name: 'Download PNG' }).click()
  const downloaded = await ready
  expect(downloaded.suggestedFilename()).toBe('lifeatlas-rewind.png')
  const bytes = await readFile(await downloaded.path())
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(bytes.readUInt32BE(16)).toBe(1080)
  expect(bytes.readUInt32BE(20)).toBe(1080)
  expect(bytes.includes(Buffer.from('Paper Bay'))).toBe(false)
  for (const name of ['Days with evidence', 'Movement time', 'Visits']) await card.getByRole('checkbox', { name, exact: true }).uncheck()
  await expect(card.getByRole('button', { name: 'Download PNG' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(card).toHaveCount(0)
  expect(outside).toBe(0)
  expect(errors).toEqual([])
})

test('route controls show actual markers, seek into a gap, and hide the marker there', async ({ page }) => {
  const data = [{
    startTime: '2025-05-03T10:00:00Z', endTime: '2025-05-03T11:10:00Z',
    timelinePath: [
      { point: 'geo:-44,-141', time: '2025-05-03T10:00:00Z' },
      { point: 'geo:-44,-140.99', time: '2025-05-03T10:10:00Z' },
      { point: 'geo:-44,-140.98', time: '2025-05-03T11:00:00Z' },
      { point: 'geo:-44,-140.97', time: '2025-05-03T11:10:00Z' },
    ],
  }]
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic-playback.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)),
  })
  await page.getByRole('button', { name: 'Open archive' }).click()
  await expect(page.getByRole('heading', { name: 'Archive overview' })).toBeVisible()
  await nav(page, 'Explore map')
  await page.getByRole('button', { name: 'Route playback' }).click()
  const marker = page.locator('.replay-marker')
  await expect(marker).toBeVisible()
  await expect(page.getByText('4 observations · 1 gaps · 0 conflicting instants')).toBeVisible()
  const slider = page.getByRole('slider', { name: 'Playback position' })
  await slider.evaluate((element) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, '1200000')
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.getByText('Gap in recorded positions', { exact: true })).toBeVisible()
  await expect(marker).toHaveCount(0)
  await page.getByRole('button', { name: 'Next observation' }).click()
  await expect(page.getByLabel('Playback time', { exact: true })).toContainText('11:00:00 AM')
  await expect(marker).toBeVisible()
  await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('1')
  await page.getByRole('button', { name: 'Play route' }).click()
  await expect(page.getByText('Last recorded position', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Pause route' }).click()
  const output = page.getByLabel('Playback time', { exact: true })
  const paused = await output.textContent()
  await page.waitForTimeout(250)
  await expect(output).toHaveText(paused ?? '')
  await page.getByRole('button', { name: 'Close playback' }).click()
  await expect(slider).toHaveCount(0)
})

test('opening playback goes local even when online tiles were explicitly enabled', async ({ page, context }) => {
  const provider = 'https://tiles.openfreemap.org'
  let requests = 0
  await context.route(provider + '/**', async (route) => {
    requests++
    const headers = { 'access-control-allow-origin': '*' }
    if (route.request().url().endsWith('/planet')) {
      await route.fulfill({ headers, json: { tiles: [provider + '/planet/20261122_124456_pt/{z}/{x}/{y}.pbf'] } })
    } else await route.fulfill({ headers, body: Buffer.alloc(0) })
  })
  await demo(page)
  await nav(page, 'Explore map')
  await page.getByRole('button', { name: 'Enable online basemap' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enable online basemap' }).click()
  await expect.poll(() => requests).toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Route playback' }).click()
  await expect(page.locator('.replay-marker')).toBeVisible()
  const after = requests
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.getByText('Local map · no basemap tiles', { exact: true })).toBeVisible()
  expect(requests).toBe(after)
})
