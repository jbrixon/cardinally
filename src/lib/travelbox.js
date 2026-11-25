export const EARTH_RADIUS_KM = 6371

const LONGITUDE_EPSILON = 1e-10
const DUPLICATE_EPSILON = 1e-6

export function normalizeLongitude(longitude) {
  if (longitude >= -180 && longitude < 180) {
    return Object.is(longitude, -0) ? 0 : longitude
  }

  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180
  return Object.is(normalized, -0) ? 0 : normalized
}

export function validateCoordinates(latitudeInput, longitudeInput) {
  if (String(latitudeInput).trim() === '' || String(longitudeInput).trim() === '') {
    return { coordinates: null, error: 'Enter both latitude and longitude.' }
  }

  const latitude = Number(latitudeInput)
  const longitude = Number(longitudeInput)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { coordinates: null, error: 'Latitude and longitude must be valid numbers.' }
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return {
      coordinates: null,
      error: 'Latitude must be between −90° and 90°, and longitude between −180° and 180°.'
    }
  }

  return {
    coordinates: [normalizeLongitude(longitude), Object.is(latitude, -0) ? 0 : latitude],
    error: null
  }
}

export function addVisit(points, latitudeInput, longitudeInput) {
  const result = validateCoordinates(latitudeInput, longitudeInput)
  if (result.error) return { points, coordinates: null, error: result.error }

  if (points.some((point) => coordinatesMatch(point, result.coordinates))) {
    return { points, coordinates: null, error: 'That place is already on your map.' }
  }

  return {
    points: [...points, result.coordinates],
    coordinates: result.coordinates,
    error: null
  }
}

export function parseStoredVisits(rawValue) {
  let storedPoints
  try {
    storedPoints = JSON.parse(rawValue)
  } catch {
    return { points: null, error: 'Saved visits are not valid JSON.' }
  }

  if (!Array.isArray(storedPoints)) {
    return { points: null, error: 'Saved visits must be a list of coordinates.' }
  }

  const points = []
  for (const point of storedPoints) {
    if (!Array.isArray(point) || point.length !== 2) {
      return { points: null, error: 'A saved visit does not contain a longitude and latitude.' }
    }

    const result = addVisit(points, point[1], point[0])
    if (result.error) return { points: null, error: `A saved visit is invalid: ${result.error}` }
    points.push(result.coordinates)
  }

  return { points, error: null }
}

export function createTravelBox(points) {
  if (points.length === 0) return null

  const longitudes = points
    .map(([longitude]) => {
      const normalized = normalizeLongitude(longitude)
      return normalized < 0 ? normalized + 360 : normalized
    })
    .sort((left, right) => left - right)

  let largestGap = -1
  let startLongitude = longitudes[0]

  // Sorted gap order makes equal largest gaps resolve the same way every time.
  for (let index = 0; index < longitudes.length; index += 1) {
    const current = longitudes[index]
    const next = index + 1 < longitudes.length ? longitudes[index + 1] : longitudes[0] + 360
    const gap = next - current

    if (gap > largestGap + LONGITUDE_EPSILON) {
      largestGap = gap
      startLongitude = next % 360
    }
  }

  const west = normalizeLongitude(startLongitude)
  const east = west + (360 - largestGap)
  const south = Math.min(...points.map(([, latitude]) => latitude))
  const north = Math.max(...points.map(([, latitude]) => latitude))
  const longitudeSpan = east - west
  const latitudeSpan = north - south
  const closestLatitude =
    south <= 0 && north >= 0
      ? 0
      : Math.abs(south) < Math.abs(north)
        ? south
        : north

  const areaKm2 =
    EARTH_RADIUS_KM ** 2 *
    toRadians(longitudeSpan) *
    (Math.sin(toRadians(north)) - Math.sin(toRadians(south)))
  const northSouthKm = EARTH_RADIUS_KM * toRadians(latitudeSpan)
  const eastWestKm =
    EARTH_RADIUS_KM * Math.cos(toRadians(closestLatitude)) * toRadians(longitudeSpan)

  return {
    west,
    east,
    south,
    north,
    areaKm2: cleanZero(areaKm2),
    northSouthKm: cleanZero(northSouthKm),
    eastWestKm: cleanZero(eastWestKm)
  }
}

export function unwrapLongitude(longitude, west) {
  return west + (((normalizeLongitude(longitude) - west) % 360) + 360) % 360
}

export function isBoundaryVisit([longitude, latitude], box) {
  const unwrappedLongitude = unwrapLongitude(longitude, box.west)
  return (
    latitude === box.north ||
    latitude === box.south ||
    Math.abs(unwrappedLongitude - box.west) < LONGITUDE_EPSILON ||
    Math.abs(unwrappedLongitude - box.east) < LONGITUDE_EPSILON
  )
}

function coordinatesMatch([firstLongitude, firstLatitude], [secondLongitude, secondLatitude]) {
  const longitudeDifference = Math.abs(normalizeLongitude(firstLongitude - secondLongitude))
  return (
    longitudeDifference < DUPLICATE_EPSILON &&
    Math.abs(firstLatitude - secondLatitude) < DUPLICATE_EPSILON
  )
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

function cleanZero(value) {
  return Math.abs(value) < 1e-9 ? 0 : value
}
