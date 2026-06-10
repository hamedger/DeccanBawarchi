import { Location, LocationAddress } from '../types/location'

export function formatLocationAddress(address: LocationAddress): string {
  return `${address.street}, ${address.city}, ${address.state} ${address.zip}`
}

export function formatLocationShort(location: Location): string {
  return location.address.city
}

export function slugifyLocationId(name: string, city: string, state: string): string {
  const base = `${city}-${state}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return base || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function isLocationActive(location: Location): boolean {
  return location.isActive !== false
}
