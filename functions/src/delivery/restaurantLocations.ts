export interface RestaurantLocation {
  id: string
  name: string
  pickupAddress: string
  pickupPhone: string
  prepBufferMinutes: number
  timezone: string
}

const LOCATIONS: Record<string, RestaurantLocation> = {
  'northville-mi': {
    id: 'northville-mi',
    name: 'Deccan Bawarchi — Northville',
    pickupAddress: '17933 Haggerty Rd, Township of Northville, MI 48168',
    pickupPhone: '+12489857209',
    prepBufferMinutes: 30,
    timezone: 'America/Detroit',
  },
  'farmington-hills-mi': {
    id: 'farmington-hills-mi',
    name: 'Deccan Bawarchi — Farmington Hills',
    pickupAddress: '24234 Orchard Lake Rd, Farmington Hills, MI 48336',
    pickupPhone: '+19472868794',
    prepBufferMinutes: 30,
    timezone: 'America/Detroit',
  },
}

const LOCATION_ALIASES: Record<string, string> = {
  farmingtonhills: 'farmington-hills-mi',
}

export function resolveRestaurantLocation(locationId?: string | null): RestaurantLocation {
  const key = (locationId ?? '').trim().toLowerCase()
  const normalized = LOCATION_ALIASES[key] ?? key
  return LOCATIONS[normalized] ?? LOCATIONS['northville-mi']
}
