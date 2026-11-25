import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route(/https?:\/\/[^/]*\.tile\.openstreetmap\.org\/.*/, (route) => route.abort())
})

test('adds, compares, removes, and restores visited places', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'Cardinally.' })).toBeVisible()
  await expect(page.getByTestId('box-area')).toHaveText('0 km²')
  await expect(page.getByText('Enter coordinates or double-click the map.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Places visited' })).toHaveCount(0)

  await page.getByLabel('Latitude').fill('48.2082')
  await page.getByLabel('Longitude').fill('16.3738')
  await page.getByRole('button', { name: 'Add place' }).click()
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(1)
  await expect(page.getByTestId('north-south-span')).toHaveText('0 km')

  await page.getByLabel('Latitude').fill('40.7128')
  await page.getByLabel('Longitude').fill('-74.006')
  await page.getByRole('button', { name: 'Add place' }).click()
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(2)
  await expect(page.getByTestId('box-area')).not.toHaveText('0 km²')
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(3)

  await page.getByRole('button', { name: 'Fit box' }).click()
  const desktopBox = await page
    .locator('.leaflet-overlay-pane path')
    .last()
    .evaluate((path) => path.getBoundingClientRect().toJSON())
  const desktopPanel = await page.locator('.controls-panel').evaluate((panel) => panel.getBoundingClientRect().toJSON())
  expect(desktopBox.left).toBeGreaterThanOrEqual(desktopPanel.right)
  await expect(page.getByRole('button', { name: /^Remove visit/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Place visited at 48.2082°, 16.3738°', exact: true }).click()
  await expect(page.locator('.visit-popup')).toContainText('48.2082°, 16.3738°')
  await page.getByRole('button', { name: 'Remove visit at 48.2082°, 16.3738°' }).click()
  await expect(page.locator('.visit-popup')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(1)
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(2)

  await page.reload()
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(1)
  await expect(page.getByText('Visits are saved in this browser.')).toBeVisible()
  const remainingMarker = page.getByRole('button', { name: 'Place visited at 40.7128°, -74.006°', exact: true })
  await remainingMarker.focus()
  await remainingMarker.press('Enter')
  await expect(page.getByRole('button', { name: 'Remove visit at 40.7128°, -74.006°' })).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(0)
})

test('validates coordinates, rejects duplicates, and accepts a map double-click', async ({ page }) => {
  await page.goto('./')

  await page.getByLabel('Latitude').fill('91')
  await page.getByLabel('Longitude').fill('16')
  await page.getByRole('button', { name: 'Add place' }).click()
  await expect(page.getByRole('alert')).toContainText('Latitude must be between')
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(0)

  await page.getByLabel('Latitude').fill('0')
  await page.getByLabel('Longitude').fill('180')
  await page.getByRole('button', { name: 'Add place' }).click()
  await page.getByLabel('Latitude').fill('0')
  await page.getByLabel('Longitude').fill('-180')
  await page.getByRole('button', { name: 'Add place' }).click()
  await expect(page.getByRole('alert')).toContainText('already on your map')
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(1)

  const map = page.locator('.leaflet-container')
  await map.dblclick({ position: { x: 900, y: 180 } })
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(2)
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(3)
})

test('does not overwrite unreadable saved visits without explicit replacement', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('travelbox.visits.v1', '{broken')
  })
  await page.goto('./')

  await expect(page.getByTestId('storage-warning')).toContainText('could not be read')
  await page.getByLabel('Latitude').fill('10')
  await page.getByLabel('Longitude').fill('20')
  await page.getByRole('button', { name: 'Add place' }).click()
  expect(await page.evaluate(() => localStorage.getItem('travelbox.visits.v1'))).toBe('{broken')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Replace unreadable saved data' }).click()
  await expect(page.getByText('Visits are saved in this browser.')).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('travelbox.visits.v1')))).toEqual([
    [20, 10]
  ])
})

test('remains usable when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage is blocked', 'SecurityError')
      }
    })
  })
  await page.goto('./')

  await expect(page.getByText(/Browser storage is unavailable/)).toBeVisible()
  await page.getByLabel('Latitude').fill('10')
  await page.getByLabel('Longitude').fill('20')
  await page.getByRole('button', { name: 'Add place' }).click()
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(1)
})

test('keeps the panel, map controls, and attribution usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('travelbox.visits.v1', '[[16.3738,48.2082],[-74.006,40.7128]]')
  })
  await page.goto('./')

  const panel = page.locator('.controls-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(2)
  await expect(page.locator('.leaflet-control-zoom')).toBeVisible()
  await expect(page.locator('.leaflet-control-attribution')).toBeVisible()
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    panelHeight: document.querySelector('.controls-panel').getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
    panelTop: document.querySelector('.controls-panel').getBoundingClientRect().top,
    boxBottom: [...document.querySelectorAll('.leaflet-overlay-pane path')]
      .at(-1)
      .getBoundingClientRect().bottom
  }))
  expect(dimensions.documentWidth).toBe(dimensions.viewportWidth)
  expect(dimensions.panelHeight).toBeLessThanOrEqual(dimensions.viewportHeight * 0.48 + 1)
  expect(dimensions.boxBottom).toBeLessThanOrEqual(dimensions.panelTop)
})


test('opens a marker card with a touch tap above the phone panel and removes the place', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await context.newPage()
  await page.route(/https?:\/\/[^/]*\.tile\.openstreetmap\.org\/.*/, (route) => route.abort())
  await page.addInitScript(() => {
    localStorage.setItem('travelbox.visits.v1', '[[16.3738,48.2082],[-74.006,40.7128]]')
  })
  await page.goto('./')
  await page.getByRole('button', { name: 'Place visited at 48.2082°, 16.3738°', exact: true }).tap()
  const popup = page.locator('.visit-popup')
  await expect(popup).toBeVisible()
  await expect.poll(async () => {
    const popupBounds = await popup.boundingBox()
    const panelBounds = await page.locator('.controls-panel').boundingBox()
    return popupBounds.y + popupBounds.height <= panelBounds.y
  }).toBe(true)
  await page.getByRole('button', { name: 'Remove visit at 48.2082°, 16.3738°' }).tap()
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(1)
  await expect(popup).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('travelbox.visits.v1')))).toEqual([[-74.006, 40.7128]])
  await context.close()
})
