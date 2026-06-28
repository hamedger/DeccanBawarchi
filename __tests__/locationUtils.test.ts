import {
  locationIdsForFirestoreQuery,
  mergeAllLocations,
  mergePickableLocations,
  normalizeLocationId,
  resolveOrderLocationLabel,
} from '../lib/locationUtils'
import { Location } from '../types/location'

describe('normalizeLocationId', () => {
  it('maps legacy admin Farmington doc id to canonical static id', () => {
    expect(normalizeLocationId('farmingtonhills')).toBe('farmington-hills-mi')
    expect(normalizeLocationId('FarmingtonHills')).toBe('farmington-hills-mi')
  })

  it('leaves canonical ids unchanged', () => {
    expect(normalizeLocationId('northville-mi')).toBe('northville-mi')
  })
})

describe('locationIdsForFirestoreQuery', () => {
  it('includes legacy Farmington id when filtering canonical id', () => {
    expect(locationIdsForFirestoreQuery('farmington-hills-mi')).toEqual([
      'farmington-hills-mi',
      'farmingtonhills',
    ])
  })

  it('normalizes legacy filter id before expanding aliases', () => {
    expect(locationIdsForFirestoreQuery('farmingtonhills')).toEqual([
      'farmington-hills-mi',
      'farmingtonhills',
    ])
  })
})

describe('mergePickableLocations', () => {
  it('does not duplicate Farmington Hills when Firestore uses legacy doc id', () => {
    const remote: Location[] = [
      {
        id: 'farmingtonhills',
        name: 'Deccan Bawarchi - Farmington Hills',
        phone: '+1 947-286-8794',
        isActive: true,
        address: {
          street: '24234 Orchard Lake Rd',
          city: 'Farmington Hills',
          state: 'MI',
          zip: '48336',
          country: 'US',
        },
      } as Location,
    ]

    const merged = mergePickableLocations(remote)
    const farmington = merged.filter((l) => l.address.city === 'Farmington Hills')

    expect(merged).toHaveLength(2)
    expect(farmington).toHaveLength(1)
    expect(farmington[0].id).toBe('farmington-hills-mi')
    expect(farmington[0].phone).toBe('+1 947-286-8794')
  })
})

describe('mergeAllLocations', () => {
  it('always includes static locations even when Firestore has one doc', () => {
    const remote: Location[] = [
      {
        id: 'northville-mi',
        name: 'Deccan Bawarchi — Northville',
        isActive: true,
        address: {
          street: '17933 Haggerty Rd',
          city: 'Township of Northville',
          state: 'MI',
          zip: '48168',
          country: 'US',
        },
      } as Location,
    ]

    const merged = mergeAllLocations(remote)
    expect(merged.map((l) => l.id).sort()).toEqual(['farmington-hills-mi', 'northville-mi'])
  })
})

describe('resolveOrderLocationLabel', () => {
  it('returns short name for canonical and legacy ids', () => {
    expect(resolveOrderLocationLabel('northville-mi')).toBe('Northville')
    expect(resolveOrderLocationLabel('farmingtonhills')).toBe('Farmington Hills')
  })

  it('falls back when locationId is missing', () => {
    expect(resolveOrderLocationLabel(undefined)).toBe('Unknown location')
  })
})
