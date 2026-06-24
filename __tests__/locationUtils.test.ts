import { mergePickableLocations, normalizeLocationId } from '../lib/locationUtils'
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
