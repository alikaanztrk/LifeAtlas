import { expect, test } from '@playwright/test'

test('uses the offline atlas for named and unnamed visits and opens the selected place', async ({ page, context }) => {
  const outside: string[] = []
  const fetched = new Set<string>()
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:4180' || url.search || route.request().method() !== 'GET') {
      outside.push(url.hostname)
      await route.abort()
    } else {
      if (url.pathname.endsWith('.mapdata')) fetched.add(url.pathname)
      await route.continue()
    }
  })
  // Artificial visits, using public municipal coordinates as reference points.
  const points = [
    { lat: 41.01384, lon: 28.94966 },
    { lat: 48.85341, lon: 2.3488, name: 'Synthetic gallery' },
    { lat: 0, lon: -140 },
  ]
  const data = points.map(({ lat, lon, name }, index) => ({
    startTime: '2025-05-0' + (index + 1) + 'T09:00:00Z', endTime: '2025-05-0' + (index + 1) + 'T09:30:00Z',
    visit: { topCandidate: { placeID: 'synthetic-atlas-' + index, placeLocation: { lat, lon }, name } },
  }))
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic-atlas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)),
  })
  await page.getByRole('button', { name: 'Open archive' }).click()
  const atlas = page.getByRole('region', { name: 'Where the archive takes you' })
  await expect(atlas).toContainText('Matched 2 of 3 visits')
  const paris = page.locator('.geography-breakdown dt').filter({ hasText: 'Near Paris' })
  await expect(paris).toBeVisible()
  await expect(page.getByText(/Türkiye|Turkey/).first()).toBeAttached()
  const dateRange = page.getByRole('combobox', { name: 'Date range' })
  const apply = page.getByRole('form', { name: 'Date range' }).getByRole('button', { name: 'Apply', exact: true })
  await dateRange.selectOption('custom')
  await page.getByLabel('Start date', { exact: true }).fill('2025-05-01')
  await page.getByLabel('End date', { exact: true }).fill('2025-05-01')
  await apply.click()
  await expect(atlas).toContainText('Matched 1 of 1 visits')
  await expect(paris).toHaveCount(0)
  await dateRange.selectOption('all')
  await apply.click()
  await page.getByRole('link', { name: 'Places', exact: true }).click()
  const places = page.getByRole('table')
  await expect(places.getByRole('button', { name: 'Synthetic gallery', exact: true })).toBeVisible()
  await expect(places.getByRole('button', { name: 'Near İstanbul', exact: true })).toBeVisible()
  await expect(places.getByText('Unnamed place')).toHaveCount(0)
  await page.getByLabel('Search places').fill('istanbul')
  await expect(places.getByRole('row')).toHaveCount(2)
  await places.getByRole('button', { name: 'Near İstanbul', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Near İstanbul', exact: true })).toBeVisible()
  await expect(page.getByText('The export has no name for this visit.')).toBeVisible()
  await page.getByLabel('Place name', { exact: true }).fill('Synthetic bakery')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic bakery', exact: true })).toBeVisible()
  await expect(page.getByText('Approximate area')).toBeVisible()
  expect(fetched.size).toBe(2)
  expect(outside).toEqual([])
})
