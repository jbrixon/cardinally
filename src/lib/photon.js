const SEARCH_URL = 'https://photon.komoot.io/api/'
const MIN_REQUEST_INTERVAL = 1000
const REQUEST_TIMEOUT = 10_000
const CACHE_LIMIT = 50

const cache = new Map()
let lastRequestAt = 0
let rateLimitUntil = 0

export class PhotonRateLimitError extends Error {
  constructor() {
    super('Photon is temporarily limiting searches. Please wait before searching again.')
    this.name = 'PhotonRateLimitError'
  }
}

function abortError() {
  return new DOMException('The search was cancelled.', 'AbortError')
}

function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    const onAbort = () => {
      window.clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      reject(abortError())
    }
    if (signal?.aborted) onAbort()
    else signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function featureLabel(properties) {
  const street = [properties.housenumber, properties.street].filter(Boolean).join(' ')
  const name = properties.name || street || properties.city || properties.state || properties.country
  if (!name) return null

  return [name, properties.city || properties.district || properties.locality || properties.county || properties.state,
    properties.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(', ')
}

function parseFeatures(data) {
  if (!data || !Array.isArray(data.features)) throw new Error('Photon returned an invalid response.')

  return data.features.slice(0, 5).flatMap((feature) => {
    if (feature?.geometry?.type !== 'Point') return []
    const coordinates = feature.geometry.coordinates
    const [longitude, latitude] = Array.isArray(coordinates) ? coordinates : []
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) ||
        longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return []
    const label = featureLabel(feature.properties || {})
    return label ? [{ label, coordinates: [longitude, latitude] }] : []
  })
}

function retryAfterMilliseconds(response) {
  const value = response.headers?.get('Retry-After')
  if (!value) return 0
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0
}

async function waitForRequestSlot(signal) {
  if (signal?.aborted) throw abortError()
  if (Date.now() < rateLimitUntil) throw new PhotonRateLimitError()
  while (Date.now() < lastRequestAt + MIN_REQUEST_INTERVAL) {
    if (signal?.aborted) throw abortError()
    if (Date.now() < rateLimitUntil) throw new PhotonRateLimitError()
    await wait(lastRequestAt + MIN_REQUEST_INTERVAL - Date.now(), signal)
  }
  if (signal?.aborted) throw abortError()
  if (Date.now() < rateLimitUntil) throw new PhotonRateLimitError()
  lastRequestAt = Date.now()
}

export async function searchPhotonPlaces(query, signal) {
  const normalizedQuery = String(query).trim()
  if (normalizedQuery.length < 3) return []
  if (cache.has(normalizedQuery)) {
    const results = cache.get(normalizedQuery)
    cache.delete(normalizedQuery)
    cache.set(normalizedQuery, results)
    return results
  }

  await waitForRequestSlot(signal)

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  if (signal?.aborted) controller.abort()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const url = new URL(SEARCH_URL)
    url.searchParams.set('q', normalizedQuery)
    url.searchParams.set('limit', '5')
    const response = await fetch(url, { signal: controller.signal })
    if (response.status === 429) {
      rateLimitUntil = Math.max(rateLimitUntil, Date.now() + Math.max(60_000, retryAfterMilliseconds(response)))
      throw new PhotonRateLimitError()
    }
    if (!response.ok) throw new Error(`Photon search failed (${response.status}).`)
    const results = parseFeatures(await response.json())
    cache.set(normalizedQuery, results)
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value)
    return results
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new Error('The place search took too long. Please try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
  }
}
