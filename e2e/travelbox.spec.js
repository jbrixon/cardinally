import { test, expect } from '@playwright/test'

function photonFeature(name, coordinates, details = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: { name, ...details }
  }
}

async function mockPhoton(page, searches) {
  await page.route('https://photon.komoot.io/api/**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')
    const result = searches[query] ?? []
    const status = result.status ?? 200
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ type: 'FeatureCollection', features: result.features ?? result })
    })
  })
}

test.beforeEach(async ({ page }) => {
  await page.route(/https?:\/\/(?:[^/]+\.)?tile\.openstreetmap\.org\/.*/, (route) => route.abort())
  await mockPhoton(page, {})
})

test('adds, compares, removes, and restores visited places', async ({ page }) => {
  await mockPhoton(page, {
    Vienna: [photonFeature('Vienna', [16.3738, 48.2082], { city: 'Wien', country: 'Austria' })],
    'New York': [photonFeature('New York', [-74.006, 40.7128], { city: 'New York', country: 'United States' })]
  })
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'Cardinally.' })).toBeVisible()
  await expect(page.getByTestId('box-area')).toHaveText('0 km²')
  await expect(page.getByText('Search by name or double-click the map.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Places visited' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Photon' })).toBeVisible()

  await page.getByRole('combobox', { name: 'Place name' }).fill('Vienna')
  await page.getByRole('option', { name: 'Vienna, Wien, Austria' }).click()
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(1)
  await expect(page.getByTestId('north-south-span')).toHaveText('0 km')

  const search = page.getByRole('combobox', { name: 'Place name' })
  await search.fill('New York')
  await expect(page.getByRole('option', { name: 'New York, United States' })).toBeVisible()
  await search.press('ArrowDown')
  await search.press('Enter')
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(2)
  await expect(page.getByTestId('box-area')).not.toHaveText('0 km²')
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(3)
  const newestMarker = page.getByRole('button', { name: 'Place visited at 40.7128°, -74.006°', exact: true })
  expect(await newestMarker.evaluate((marker) => marker.parentElement.lastElementChild === marker)).toBe(true)

  await search.fill('Vienna')
  await page.getByRole('option', { name: 'Vienna, Wien, Austria' }).click()
  await expect(page.getByRole('alert')).toContainText('already on your map')
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(2)

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

test('lets the user distinguish ambiguous search results and still accepts a map double-click', async ({ page }) => {
  await mockPhoton(page, {
    Springfield: [
      photonFeature('Springfield', [-89.65, 39.78], { state: 'Illinois', country: 'United States' }),
      photonFeature('Springfield', [-72.59, 42.10], { state: 'Massachusetts', country: 'United States' })
    ]
  })
  await page.goto('./')

  const search = page.getByRole('combobox', { name: 'Place name' })
  await search.fill('Springfield')
  await expect(page.getByRole('option')).toHaveCount(2)
  await expect(page.getByRole('option', { name: 'Springfield, Massachusetts, United States' })).toBeVisible()
  await search.press('ArrowDown')
  await search.press('ArrowDown')
  await search.press('Enter')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('travelbox.visits.v1')))).toEqual([
    [-72.59, 42.1]
  ])

  const map = page.locator('.leaflet-container')
  await map.dblclick({ position: { x: 900, y: 180 } })
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(2)
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(3)
})

test('shows empty and failed Photon search states', async ({ page }) => {
  await mockPhoton(page, { Broken: { status: 503, features: [] } })
  await page.goto('./')

  const search = page.getByRole('combobox', { name: 'Place name' })
  await search.fill('Unknown place')
  await expect(page.locator('.search-message')).toContainText('No places found')
  await search.fill('Broken')
  await expect(page.getByRole('alert')).toContainText('Photon search failed (503)')
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(0)
})

test('ignores a slow result after a newer place query replaces it', async ({ page }) => {
  let firstRequestStarted
  const started = new Promise((resolve) => { firstRequestStarted = resolve })
  let finishOldResponse
  const oldResponseDone = new Promise((resolve) => { finishOldResponse = resolve })
  await page.route('https://photon.komoot.io/api/**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')
    if (query === 'Springfield') {
      firstRequestStarted()
      await new Promise((resolve) => setTimeout(resolve, 1400))
      try {
        await route.fulfill({
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ features: [photonFeature('Springfield', [-89.65, 39.78])] })
        })
      } catch {
        // The stale request may already have been aborted by the input change.
      } finally {
        finishOldResponse()
      }
      return
    }
    await route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ features: [photonFeature('Cambridge', [0.12, 52.2], { country: 'United Kingdom' })] })
    })
  })
  await page.goto('./')
  const search = page.getByRole('combobox', { name: 'Place name' })
  await search.fill('Springfield')
  await started
  await search.fill('Cambridge')
  await expect(page.getByRole('option', { name: 'Cambridge, United Kingdom' })).toBeVisible()
  await oldResponseDone
  await expect(page.getByRole('option')).toHaveCount(1)
  await expect(page.getByRole('option', { name: /Springfield/ })).toHaveCount(0)
})

test('does not overwrite unreadable saved visits without explicit replacement', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('travelbox.visits.v1', '{broken')
  })
  await page.goto('./')

  await expect(page.getByTestId('storage-warning')).toContainText('could not be read')
  await page.locator('.leaflet-container').dblclick({ position: { x: 900, y: 180 } })
  expect(await page.evaluate(() => localStorage.getItem('travelbox.visits.v1'))).toBe('{broken')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Replace unreadable saved data' }).click()
  await expect(page.getByText('Visits are saved in this browser.')).toBeVisible()
  const replaced = await page.evaluate(() => JSON.parse(localStorage.getItem('travelbox.visits.v1')))
  expect(replaced).toHaveLength(1)
  expect(replaced[0]).toHaveLength(2)
})

test('adds a visit after panning into a repeated copy of the world', async ({ page }) => {
  await page.goto('./')
  await page.mouse.move(1100, 300)
  await page.mouse.down()
  await page.mouse.move(450, 300, { steps: 20 })
  await page.mouse.up()
  await page.locator('.leaflet-container').dblclick({ position: { x: 1000, y: 180 } })
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(1)
  const [[longitude, latitude]] = await page.evaluate(() => JSON.parse(localStorage.getItem('travelbox.visits.v1')))
  expect(longitude).toBeGreaterThanOrEqual(-180)
  expect(longitude).toBeLessThan(180)
  expect(Number.isFinite(latitude)).toBe(true)
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
  await page.locator('.leaflet-container').dblclick({ position: { x: 900, y: 180 } })
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
  await expect(page.locator('.leaflet-control-attribution a', { hasText: 'OpenStreetMap' }))
    .toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
  await expect(page.locator('.leaflet-control-attribution a', { hasText: 'Photon' }))
    .toHaveAttribute('href', 'https://photon.komoot.io/')
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
  await page.route(/https?:\/\/(?:[^/]+\.)?tile\.openstreetmap\.org\/.*/, (route) => route.abort())
  await mockPhoton(page, {
    Salzburg: [photonFeature('Salzburg', [13.0458, 47.8095], { country: 'Austria' })]
  })
  await page.addInitScript(() => {
    localStorage.setItem('travelbox.visits.v1', '[[16.3738,48.2082],[-74.006,40.7128]]')
  })
  await page.goto('./')
  const search = page.getByRole('combobox', { name: 'Place name' })
  await search.fill('Salzburg')
  await page.getByRole('option', { name: 'Salzburg, Austria' }).tap()
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(3)
  await page.getByRole('button', { name: 'Place visited at 48.2082°, 16.3738°', exact: true }).tap()
  const popup = page.locator('.visit-popup')
  await expect(popup).toBeVisible()
  await expect.poll(async () => {
    const popupBounds = await popup.boundingBox()
    const panelBounds = await page.locator('.controls-panel').boundingBox()
    return popupBounds.y + popupBounds.height <= panelBounds.y
  }).toBe(true)
  await page.getByRole('button', { name: 'Remove visit at 48.2082°, 16.3738°' }).tap()
  await expect(page.getByRole('button', { name: /^Place visited at/ })).toHaveCount(2)
  await expect(popup).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('travelbox.visits.v1')))).toEqual([
    [-74.006, 40.7128],
    [13.0458, 47.8095]
  ])
  await context.close()
})
