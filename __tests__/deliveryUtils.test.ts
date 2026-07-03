import {
  buildDropoffAddressComponents,
  extractFirstName,
  formatDropoffAddress,
  isValidUSPhone,
  toE164USPhone,
  toPickupTimeIso,
} from '../lib/deliveryUtils'

describe('deliveryUtils', () => {
  it('formats US phone to E.164', () => {
    expect(toE164USPhone('2485550100')).toBe('+12485550100')
    expect(toE164USPhone('(248) 555-0100')).toBe('+12485550100')
    expect(isValidUSPhone('2485550100')).toBe(true)
    expect(isValidUSPhone('123')).toBe(false)
  })

  it('extracts first name from display name', () => {
    expect(extractFirstName('Jane Doe')).toBe('Jane')
    expect(extractFirstName('')).toBe('Guest')
  })

  it('builds dropoff address string and components', () => {
    const addr = {
      street: '123 Main St',
      city: 'Northville',
      state: 'MI',
      zip: '48167',
      country: 'US',
      unit: 'Apt 2',
    }
    expect(formatDropoffAddress(addr)).toBe('123 Main St, Apt 2, Northville, MI 48167')
    expect(buildDropoffAddressComponents(addr)).toEqual({
      street_address: '123 Main St',
      sub_premise: 'Apt 2',
      city: 'Northville',
      state: 'MI',
      zip_code: '48167',
      country: 'US',
    })
  })

  it('converts scheduled pickup to ISO UTC', () => {
    const iso = toPickupTimeIso('2030-01-15', '3:30 PM', 30)
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})
