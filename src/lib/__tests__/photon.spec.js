import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function feature(name, coordinates = [16.3738, 48.2082], details = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: { name, ...details }
  }
}

function response(features = [], status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name] || null },
    json: async () => ({ type: 'FeatureCollection', features })
  }
}

describe('Photon place search', () => {
  let searchPhotonPlaces

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    vi.stubGlobal('fetch', vi.fn())
    vi.resetModules()
    ;({ searchPhotonPlaces } = await import('../photon.js'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('requests five results and converts GeoJSON coordinates into labeled places', async () => {
    fetch.mockResolvedValue(response([
      feature('Vienna', [16.3738, 48.2082], { city: 'Wien', country: 'Austria' }),
      feature('No coordinates', [Infinity, 0]),
      feature('', [0, 0], {})
    ]))

    await expect(searchPhotonPlaces('  Vienna & Wien  ')).resolves.toEqual([
      { label: 'Vienna, Wien, Austria', coordinates: [16.3738, 48.2082] }
    ])
    const url = new URL(fetch.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api/')
    expect(url.searchParams.get('q')).toBe('Vienna & Wien')
    expect(url.searchParams.get('limit')).toBe('5')
  })

  it('does not request short queries and caches empty results', async () => {
    fetch.mockResolvedValue(response())
    await expect(searchPhotonPlaces('  ab ')).resolves.toEqual([])
    await searchPhotonPlaces('Nowhere')
    await searchPhotonPlaces('Nowhere')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('spaces request starts at least one second apart', async () => {
    fetch.mockResolvedValue(response())
    await searchPhotonPlaces('Vienna')
    const second = searchPhotonPlaces('Berlin')
    await Promise.resolve()
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await second
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('cancels a query waiting for the request slot', async () => {
    fetch.mockResolvedValue(response())
    await searchPhotonPlaces('Vienna')
    const controller = new AbortController()
    const second = searchPhotonPlaces('Berlin', controller.signal).catch((error) => error)
    controller.abort()
    expect((await second).name).toBe('AbortError')
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('times out a request after ten seconds', async () => {
    fetch.mockImplementation((_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const pending = searchPhotonPlaces('Vienna')
    const rejection = expect(pending).rejects.toThrow('took too long')
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(10_000)
    await rejection
  })

  it('pauses after HTTP 429 and honors a longer Retry-After value', async () => {
    fetch.mockResolvedValueOnce(response([], 429, { 'Retry-After': '120' }))
    await expect(searchPhotonPlaces('Vienna')).rejects.toMatchObject({ name: 'PhotonRateLimitError' })
    await vi.advanceTimersByTimeAsync(119_999)
    await expect(searchPhotonPlaces('Berlin')).rejects.toMatchObject({ name: 'PhotonRateLimitError' })
    fetch.mockResolvedValue(response())
    await vi.advanceTimersByTimeAsync(1)
    await searchPhotonPlaces('Berlin')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('evicts least recently used successful queries after fifty entries', async () => {
    fetch.mockResolvedValue(response())
    for (let index = 0; index < 51; index += 1) {
      const pending = searchPhotonPlaces(`Place ${index}`)
      await vi.advanceTimersByTimeAsync(1000)
      await pending
    }
    const repeated = searchPhotonPlaces('Place 0')
    await vi.advanceTimersByTimeAsync(1000)
    await repeated
    expect(fetch).toHaveBeenCalledTimes(52)
  })
})
