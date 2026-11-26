import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import axe from 'axe-core'

declare global {
  interface Window { axe: typeof axe }
}

const fixture = (name: string) => 'src/fixtures/synthetic-' + name + '.json'
const review = async (page: Page, names: string[]) => {
  await page.locator('input[type=file]').setInputFiles(names.map(fixture))
  await expect(page.getByRole('heading', { name: 'Review your import' })).toBeVisible()
}
const open = (page: Page) => page.getByRole('button', { name: 'Open archive' }).click()
const importView = (page: Page) => page.getByRole('link', { name: 'Import', exact: true }).click()
const dataView = (page: Page) => page.getByRole('link', { name: 'Data & privacy', exact: true }).click()
const overview = (page: Page) => page.getByRole('heading', { name: 'Archive overview' })

test('imports four representative formats in Chrome, with production subpath and strict networking', async ({ page, context }) => {
  const remote: string[] = []
  const errors: string[] = []
  page.on('pageerror', () => errors.push('runtime'))
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console') })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== 'http://127.0.0.1:4180' || request.method() !== 'GET' || url.search) {
      remote.push('unexpected request')
      await route.abort()
    } else await route.continue()
  })
  await page.goto('./')
  await review(page, ['android', 'ios', 'legacy-semantic', 'legacy-raw'])
  for (const format of ['Android Timeline', 'iOS Timeline', 'Legacy semantic', 'Legacy raw locations']) {
    await expect(page.getByText(format, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('radio', { name: /For this tab only/ })).toBeChecked()
  await open(page)
  await expect(overview(page)).toBeVisible()
  await expect(page.getByText('Session archive', { exact: true })).toBeVisible()
  await expect(page.getByText('2.45 km', { exact: true })).toBeVisible()
  expect(new URL(page.url()).hash).toBe('#/overview')
  expect(await page.evaluate(async () => (await indexedDB.databases()).some(({ name }) => name === 'LifeAtlas'))).toBe(false)
  expect(remote).toEqual([])
  expect(errors).toEqual([])
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Open a Timeline archive' })).toBeVisible()
})

test('isolates synthetic demo from the open session and closes it independently', async ({ page }) => {
  await page.goto('./')
  await review(page, ['legacy-raw'])
  await open(page)
  await expect(overview(page)).toBeVisible()
  const distances = page.getByRole('heading', { name: 'Known distance' }).locator('../..')
  await expect(distances.locator('.metric-value')).toHaveText('Unavailable')
  await importView(page)
  await page.getByRole('button', { name: 'Open the demo' }).click()
  await expect(page.getByText('Synthetic demo', { exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'All records and metrics' })).toBeVisible()
  await expect(distances).toContainText('11.24 km')
  await dataView(page)
  await page.getByRole('button', { name: 'Close demo' }).click()
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await expect(page.getByText('Session archive', { exact: true })).toBeVisible()
  await expect(distances.locator('.metric-value')).toHaveText('Unavailable')
})

test('shows safe partial and rejected diagnostics, including hostile source text', async ({ page }) => {
  const marker = 'SYNTHETIC_PRIVATE_LABEL'
  const hostile = '{"semanticSegments":[{"__proto__":{"polluted":true},"startTime":"2025-01-01T10:00:00Z","endTime":"2025-01-01T11:00:00Z","visit":{"topCandidate":{"name":"<img src=https://invalid.example/' + marker + '>","placeLocation":"broken"}}}]}'
  await page.goto('./')
  await review(page, ['unknown'])
  await expect(page.getByRole('alert')).toContainText('No usable Timeline records')
  await expect(page.getByRole('button', { name: 'Open archive' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose different files' }).click()
  await page.locator('input[type=file]').setInputFiles([
    { name: marker + '.json', mimeType: 'application/json', buffer: Buffer.from(hostile) },
    { name: 'synthetic-truncated.json', mimeType: 'application/json', buffer: Buffer.from('{') },
  ])
  await expect(page.getByRole('heading', { name: 'Review your import' })).toBeVisible()
  await expect(page.locator('.file-list').getByText('Invalid UTF-8 or JSON', { exact: true })).toBeVisible()
  await page.getByText('Diagnostic details', { exact: true }).click()
  await expect(page.getByText('Ignored reserved object keys', { exact: true }).first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText(marker)
  expect(await page.evaluate(() => Object.hasOwn(Object.prototype, 'polluted'))).toBe(false)
  await open(page)
  await expect(overview(page)).toBeVisible()
  await expect(page.getByText('Present', { exact: true })).toBeVisible()
})

test('cancels a delayed worker and accepts a fresh import', async ({ page, context }) => {
  let release = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  await context.route('**/assets/import.worker-*.js', async (route) => {
    await gate
    await route.continue().catch(() => {})
  }, { times: 1 })
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(fixture('android'))
  await expect(page.getByRole('progressbar')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  release()
  await expect(page.getByRole('status')).toHaveText('Import cancelled.')
  await review(page, ['legacy-raw'])
  await open(page)
  await expect(overview(page)).toBeVisible()
})

test('persists only on opt-in, merges, explicitly replaces, and deletes', async ({ page }) => {
  await page.goto('./')
  await review(page, ['android'])
  await page.getByRole('radio', { name: /In this browser/ }).check()
  await open(page)
  await expect(overview(page)).toBeVisible()
  await page.reload()
  await expect(overview(page)).toBeVisible()
  await expect(page.getByText('Saved archive', { exact: true })).toBeVisible()
  await importView(page)
  await review(page, ['android'])
  await page.getByRole('radio', { name: /In this browser/ }).check()
  await page.getByRole('button', { name: 'Merge archives' }).click()
  await expect(page.getByText('Matches with existing archive')).toBeVisible()
  await expect(page.getByText('Matches with existing archive').locator('..')).toContainText('3')
  await importView(page)
  await review(page, ['legacy-raw'])
  await page.getByRole('radio', { name: /In this browser/ }).check()
  await page.getByRole('button', { name: 'Replace archive' }).click()
  let dialog = page.getByRole('dialog', { name: 'Replace this archive?' })
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Review your import' })).toBeVisible()
  await page.getByRole('button', { name: 'Replace archive' }).click()
  dialog = page.getByRole('dialog', { name: 'Replace this archive?' })
  await dialog.getByRole('button', { name: 'Replace archive' }).click()
  await expect(overview(page)).toBeVisible()
  await expect(page.getByText('Raw points', { exact: true }).locator('..')).toContainText('2')
  await dataView(page)
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Local archive data removed' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Empty', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Switch theme' }).click()
  await page.getByRole('button', { name: 'Clear all local data' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Clear all local data' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Local archive data removed' })).toBeVisible()
  expect(await page.evaluate(async () => ({
    archive: (await indexedDB.databases()).some(({ name }) => name === 'LifeAtlas'),
    prefs: localStorage.getItem('lifeatlas.preferences'),
  }))).toEqual({ archive: false, prefs: null })
})

test('merges session batches and keeps the active archive when a preview is discarded', async ({ page }) => {
  await page.goto('./')
  await review(page, ['android'])
  await open(page)
  await expect(overview(page)).toBeVisible()
  await importView(page)
  await review(page, ['android', 'legacy-raw'])
  await page.getByRole('button', { name: 'Merge archives' }).click()
  await expect(page.getByText('Matches with existing archive').locator('..')).toContainText('3')
  await expect(page.getByText('Raw points', { exact: true }).locator('..')).toContainText('2')
  await importView(page)
  await review(page, ['ios'])
  await page.getByRole('button', { name: 'Choose different files' }).click()
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(page.getByText('Raw points', { exact: true }).locator('..')).toContainText('2')
})

test('cancels a pending persistent replacement and refreshes deletion across tabs', async ({ page, context }) => {
  await page.goto('./')
  await review(page, ['android'])
  await page.getByRole('radio', { name: /In this browser/ }).check()
  await open(page)
  await expect(overview(page)).toBeVisible()
  const second = await context.newPage()
  await second.goto('./#/overview')
  await expect(overview(second)).toBeVisible()
  await importView(page)
  await review(page, ['legacy-raw'])
  await page.getByRole('radio', { name: /In this browser/ }).check()
  const hold = await second.evaluateHandle(async () => {
    let release = () => {}
    const held = new Promise<void>((done) => {
      void navigator.locks.request('LifeAtlas dataset writes:LifeAtlas', () => new Promise<void>((unlock) => {
        release = unlock
        done()
      }))
    })
    await held
    return { release }
  })
  await page.getByRole('button', { name: 'Replace archive' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Replace archive' }).click()
  await expect(page.getByRole('progressbar')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Import cancelled.')
  await hold.evaluate((value) => value.release())
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(page.getByText('2.45 km', { exact: true }).first()).toBeVisible()
  await dataView(page)
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(second.getByRole('heading', { name: 'Open a Timeline archive' })).toBeVisible()
})

test('drag and drop follows the same preview flow', async ({ page }) => {
  await page.goto('./')
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(['{"locations":[{"latitudeE7":-410000000,"longitudeE7":-1400000000,"timestampMs":"1738400000000"}]}'],
      'synthetic-drop.json', { type: 'application/json' }))
    return data
  })
  await page.locator('.drop-zone').dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.getByRole('heading', { name: 'Review your import' })).toBeVisible()
  await expect(page.getByText('Legacy raw locations')).toBeVisible()
})

test('keyboard navigation, light and dark contrast, Turkish and responsive layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('./')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  const rail = page.getByRole('button', { name: 'Toggle sidebar width' })
  await rail.click()
  await expect(rail).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: 'Data & privacy' })).toBeVisible()
  await rail.click()
  await page.evaluate(axe.source)
  const audit = () => page.evaluate(async () => (await window.axe.run({
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
  })).violations.map(({ id, nodes }) => ({ id, elements: nodes.map(({ target }) => target) })))
  expect(await audit()).toEqual([])
  await page.getByRole('button', { name: 'Switch theme' }).click()
  await page.getByRole('button', { name: 'Change language' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await audit()).toEqual([])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [width, height] of [[1440, 900], [1280, 800], [390, 844]] as const) {
    await page.setViewportSize({ width, height })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('button', { name: 'Gezinme menüsünü aç veya kapat' }).click()
  await page.getByRole('link', { name: 'Genel bakış' }).click()
  await expect(page.getByRole('heading', { name: 'Zaman Çizelgesi arşivi açın' })).toBeVisible()
  await page.getByRole('button', { name: 'Demoyu aç' }).click()
  await expect(page.getByRole('heading', { name: 'Arşiv özeti' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await audit()).toEqual([])
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
