import { describe, expect, it } from 'vitest'
import {
  addVisit,
  createTravelBox,
  normalizeLongitude,
  parseStoredVisits,
  unwrapLongitude,
  validateCoordinates
} from '../travelbox.js'

describe('createTravelBox', () => {
  it('returns no box for an empty visit list', () => {
    expect(createTravelBox([])).toBeNull()
  })

  it('calculates ordinary bounds and approximate spherical metrics', () => {
    const box = createTravelBox([
      [16.3738, 48.2082],
      [2.3522, 48.8566],
      [-0.1276, 51.5072]
    ])

    expect(box.west).toBeCloseTo(-0.1276)
    expect(box.east).toBeCloseTo(16.3738)
    expect(box.south).toBeCloseTo(48.2082)
    expect(box.north).toBeCloseTo(51.5072)
    expect(box.areaKm2).toBeGreaterThan(0)
    expect(box.northSouthKm).toBeCloseTo(367, 0)
    expect(box.eastWestKm).toBeGreaterThan(0)
  })

  it('uses the short enclosing interval across the date line', () => {
    const box = createTravelBox([
      [170, -10],
      [-170, 10]
    ])

    expect(box.west).toBe(170)
    expect(box.east).toBe(190)
    expect(box.east - box.west).toBe(20)
    expect(unwrapLongitude(-170, box.west)).toBe(190)
  })

  it('supports the smallest enclosing interval when it exceeds 180 degrees', () => {
    const box = createTravelBox([
      [0, -1],
      [120, 0],
      [-120, 1]
    ])

    expect(box.west).toBe(120)
    expect(box.east - box.west).toBe(240)
  })

  it('resolves equal longitude gaps deterministically regardless of visit order', () => {
    const firstOrder = createTravelBox([
      [0, 0],
      [180, 1]
    ])
    const reverseOrder = createTravelBox([
      [180, 1],
      [0, 0]
    ])

    expect(firstOrder.west).toBe(-180)
    expect(firstOrder.east).toBe(0)
    expect(reverseOrder).toEqual(firstOrder)
  })

  it('measures east–west at the latitude in the box closest to the equator', () => {
    const crossingBox = createTravelBox([
      [0, -10],
      [1, 20]
    ])
    const northernBox = createTravelBox([
      [0, 10],
      [1, 20]
    ])

    expect(crossingBox.eastWestKm).toBeCloseTo(111.19, 1)
    expect(northernBox.eastWestKm).toBeCloseTo(109.5, 0)
  })

  it('returns zero metrics for one visit, a point, a horizontal span, and a pole', () => {
    const oneVisit = createTravelBox([[12, 34]])
    const samePoint = createTravelBox([
      [12, 34],
      [12, 34]
    ])
    const horizontalSpan = createTravelBox([
      [10, 20],
      [20, 20]
    ])
    const pole = createTravelBox([
      [0, 90],
      [100, 90]
    ])

    expect(oneVisit.areaKm2).toBe(0)
    expect(oneVisit.northSouthKm).toBe(0)
    expect(oneVisit.eastWestKm).toBe(0)
    expect(samePoint.areaKm2).toBe(0)
    expect(horizontalSpan.areaKm2).toBe(0)
    expect(horizontalSpan.northSouthKm).toBe(0)
    expect(pole.eastWestKm).toBe(0)
  })
})

describe('coordinate handling', () => {
  it('requires finite coordinates inside the latitude and longitude ranges', () => {
    expect(validateCoordinates('', 10).error).toContain('both')
    expect(validateCoordinates('north', 10).error).toContain('valid numbers')
    expect(validateCoordinates(91, 10).error).toContain('between')
    expect(validateCoordinates(20, -181).error).toContain('between')
    expect(validateCoordinates(90, 180).coordinates).toEqual([-180, 90])
  })

  it('normalizes equivalent longitudes and rejects duplicate locations', () => {
    expect(normalizeLongitude(180)).toBe(-180)
    const added = addVisit([], 0, 180)
    const duplicate = addVisit(added.points, 0, -180)

    expect(added.points).toEqual([[-180, 0]])
    expect(duplicate.error).toContain('already')
    expect(duplicate.points).toHaveLength(1)
  })

  it('accepts only a valid, duplicate-free saved visit list', () => {
    expect(parseStoredVisits('[[16.37,48.2]]')).toEqual({
      points: [[16.37, 48.2]],
      error: null
    })
    expect(parseStoredVisits('{broken').error).toContain('JSON')
    expect(parseStoredVisits('{"place":[]}').error).toContain('list')
    expect(parseStoredVisits('[[181,0]]').error).toContain('invalid')
    expect(parseStoredVisits('[[180,0],[-180,0]]').error).toContain('already')
  })
})
