import { Linking, Platform } from 'react-native'
import { Location, LocationAddress } from '../types/location'

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
