import { Linking, Platform } from 'react-native'
import { STATIC_LOCATIONS } from '../constants/staticLocations'
import { Location, LocationAddress } from '../types/location'

/** Previously both locations shared this number in Firestore. */
const LEGACY_SHARED_PHONE = '+12489168700'

function resolveLocationPhone(staticPhone: string, remotePhone?: string): string {
  const remote = remotePhone?.trim()
  if (!remote || remote === LEGACY_SHARED_PHONE) return staticPhone
  return remote
}

export function formatLocationAddress(address: LocationAddress): string {
  return `${address.street}, ${address.city}, ${address.state} ${address.zip}`
}

export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
  }
  return phone
}

export function getGoogleMapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

export function openDirections(address: string): void {
  const url = getGoogleMapsDirectionsUrl(address)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  Linking.openURL(url)
}

export function openPhone(phone: string): void {
  Linking.openURL(`tel:${phone}`)
}

export function formatLocationShort(location: Location): string {
  const dash = location.name.indexOf('—')
  if (dash >= 0) return location.name.slice(dash + 1).trim()
  return location.address.city
}

export function slugifyLocationId(name: string, city: string, state: string): string {
  const base = `${city}-${state}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return base || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function isLocationActive(location: Location): boolean {
  return location.isActive !== false
}

/** Keep all static pickable locations; overlay Firestore fields when present. */
export function mergePickableLocations(remote: Location[]): Location[] {
  const byId = new Map<string, Location>()

  for (const loc of STATIC_LOCATIONS.filter(isLocationActive)) {
    byId.set(loc.id, loc)
  }

  for (const loc of remote.filter(isLocationActive)) {
    const base = byId.get(loc.id)
    byId.set(
      loc.id,
      base
        ? {
            ...base,
            ...loc,
            phone: resolveLocationPhone(base.phone, loc.phone),
          }
        : loc,
    )
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}
